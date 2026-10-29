import { describe, it, expect } from 'vitest'
import {
  parseCsv,
  parseImportDate,
  planEmployeeImport,
  IMPORT_TEMPLATE_CSV,
  type ExistingEmployee,
  type ImportContext,
} from './import'

const HEADER = 'email,name,employee_type,joining_date,manager_email,team,status,confirmation_date,conversion_date'

function person(over: Partial<ExistingEmployee> & { id: string; email: string }): ExistingEmployee {
  return {
    employee_code: null,
    name: over.email.split('@')[0],
    employee_type: 'fte',
    joining_date: '2024-01-01',
    manager_id: null,
    team: null,
    status: 'active',
    confirmation_date: null,
    conversion_date: null,
    ...over,
  }
}

function ctx(existing: ExistingEmployee[] = []): ImportContext {
  return {
    existing,
    employeeTypes: [
      { id: 't-fte', code: 'fte', name: 'Full-Time Employee (FTE)' },
      { id: 't-intern', code: 'intern', name: 'Intern' },
    ],
    departments: ['CEO Office', 'Finance'],
    allowedDomains: ['navgurukul.org'],
  }
}

const plan = (body: string, existing: ExistingEmployee[] = []) => planEmployeeImport(`${HEADER}\n${body}`, ctx(existing))

describe('parseCsv', () => {
  it('keeps commas, quotes and line breaks inside quoted cells', () => {
    expect(parseCsv('a,b\n"Rao, Sneha","say ""hi""\nthere"\r\n')).toEqual([
      ['a', 'b'],
      ['Rao, Sneha', 'say "hi"\nthere'],
    ])
  })

  it('drops a byte-order mark and blank lines', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n,\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('parseImportDate', () => {
  it('reads ISO and Indian day-first dates', () => {
    expect(parseImportDate('2026-08-05')).toBe('2026-08-05')
    expect(parseImportDate('5/8/2026')).toBe('2026-08-05')
    expect(parseImportDate('05-08-2026')).toBe('2026-08-05')
  })

  it('refuses dates that do not exist or are not dates', () => {
    expect(parseImportDate('31/02/2026')).toBeNull()
    expect(parseImportDate('08/05/26')).toBeNull()
    expect(parseImportDate('Aug 5 2026')).toBeNull()
  })
})

describe('planEmployeeImport', () => {
  it('accepts the downloadable template as it is', () => {
    const p = planEmployeeImport(IMPORT_TEMPLATE_CSV, ctx())
    expect(p.counts).toEqual({ create: 2, update: 0, unchanged: 0, error: 0 })
    expect(p.canImport).toBe(true)
  })

  it('plans a new person with a manager who is also new, in any order', () => {
    const p = plan(
      'joiner@navgurukul.org,Joiner,FTE,05/08/2026,boss@navgurukul.org,ceo office,,,\n' +
        'boss@navgurukul.org,Boss,Full-Time Employee (FTE),2024-04-01,,CEO Office,,2024-07-01,'
    )
    expect(p.canImport).toBe(true)
    const joiner = p.rows[0]
    expect(joiner.action).toBe('create')
    expect(joiner.write).toMatchObject({
      email: 'joiner@navgurukul.org',
      employee_type: 'fte',
      employee_type_id: 't-fte',
      joining_date: '2026-08-05',
      team: 'CEO Office',
      status: 'active',
    })
    expect(joiner.managerEmail).toBe('boss@navgurukul.org')
    expect(p.rows[1].warnings).toContain('No manager: their reviews cannot be sent until one is set.')
  })

  it('needs name, type and joining date only for someone new', () => {
    const p = plan('new@navgurukul.org,,,,,,,,\nold@navgurukul.org,,,,,Finance,,,', [person({ id: 'o', email: 'old@navgurukul.org' })])
    expect(p.rows[0].errors).toEqual([
      'name is needed for someone new.',
      'employee_type is needed for someone new.',
      'joining_date is needed for someone new.',
    ])
    expect(p.rows[1].action).toBe('update')
    expect(p.rows[1].changes).toEqual([{ field: 'team', from: null, to: 'Finance' }])
    expect(p.canImport).toBe(false)
  })

  it('leaves empty cells alone and reports a matching row as no change', () => {
    const boss = person({ id: 'b', email: 'boss@navgurukul.org' })
    const p = plan('Old@NavGurukul.org,,fte,2024-01-01,boss@navgurukul.org,,,,', [
      boss,
      person({ id: 'o', email: 'old@navgurukul.org', manager_id: 'b' }),
    ])
    expect(p.rows[0].action).toBe('unchanged')
    expect(p.rows[0].write).toEqual({ email: 'old@navgurukul.org', employee_type: 'fte', employee_type_id: 't-fte', joining_date: '2024-01-01' })
    expect(p.canImport).toBe(false)
  })

  it('refuses bad cells with a reason for each', () => {
    const p = plan(
      'a@gmail.com,A,fte,2026-01-01,,,,,\n' +
        'b@navgurukul.org,B,staff,2026-13-01,,Marketing,left,,\n' +
        'c@navgurukul.org,C,fte,2026-01-01,c@navgurukul.org,,,,\n' +
        'd@navgurukul.org,D,fte,2026-01-01,ghost@navgurukul.org,,,,'
    )
    expect(p.rows[0].errors).toEqual(['Only @navgurukul.org addresses can sign in.'])
    expect(p.rows[1].errors).toEqual([
      'Unknown employee_type "staff".',
      'joining_date "2026-13-01" is not a date (use YYYY-MM-DD or DD/MM/YYYY).',
      'status must be active or exited, not "left".',
      'No department called "Marketing". Add it in Data Management → Departments first.',
    ])
    expect(p.rows[2].errors).toEqual(['A person cannot be their own manager.'])
    expect(p.rows[3].errors).toEqual(['Manager ghost@navgurukul.org is not in this file or the directory.'])
    expect(p.counts.error).toBe(4)
  })

  it('refuses the same email twice in the file, and an email the directory holds twice', () => {
    const p = plan('a@navgurukul.org,A,fte,2026-01-01,,,,,\nA@navgurukul.org,A2,fte,2026-01-01,,,,,\ndup@navgurukul.org,,,,,,,,', [
      person({ id: '1', email: 'dup@navgurukul.org' }),
      person({ id: '2', email: 'DUP@navgurukul.org' }),
    ])
    expect(p.rows[1].errors).toEqual(['The same email is on line 2.'])
    expect(p.rows[2].errors).toEqual(['Two people in the directory already share this email. Fix that first.'])
  })

  it('refuses a manager line that loops, through the file or the directory', () => {
    const inFile = plan('a@navgurukul.org,A,fte,2026-01-01,b@navgurukul.org,,,,\nb@navgurukul.org,B,fte,2026-01-01,a@navgurukul.org,,,,')
    expect(inFile.rows.map((r) => r.errors)).toEqual([
      ['This manager line loops back to the person.'],
      ['This manager line loops back to the person.'],
    ])

    const viaDirectory = plan('boss@navgurukul.org,,,,worker@navgurukul.org,,,,', [
      person({ id: 'b', email: 'boss@navgurukul.org' }),
      person({ id: 'w', email: 'worker@navgurukul.org', manager_id: 'b' }),
    ])
    expect(viaDirectory.rows[0].errors).toEqual(['This manager line loops back to the person.'])
  })

  it('takes an employee ID, in capitals, once per person', () => {
    const existing = [person({ id: 'h', email: 'holder@navgurukul.org', name: 'Holder', employee_code: 'NG-0100' })]
    const run = (body: string) => planEmployeeImport(`email,employee_code,name,employee_type,joining_date\n${body}`, ctx(existing))

    const ok = run('a@navgurukul.org,ng-0669,A,fte,2026-01-01')
    expect(ok.rows[0].write.employee_code).toBe('NG-0669')
    expect(ok.canImport).toBe(true)

    const bad = run(
      'b@navgurukul.org,NG 0670,B,fte,2026-01-01\n' +
        'c@navgurukul.org,NG-0671,C,fte,2026-01-01\n' +
        'd@navgurukul.org,ng-0671,D,fte,2026-01-01\n' +
        'e@navgurukul.org,NG-0100,E,fte,2026-01-01'
    )
    expect(bad.rows.map((r) => r.errors)).toEqual([
      ['employee_code "NG 0670" may use only capitals, digits and hyphens (2–20 characters).'],
      [],
      ['The same employee_code is on line 3.'],
      ['employee_code NG-0100 already belongs to Holder (holder@navgurukul.org).'],
    ])

    // A person keeping, or newly getting, their own code is fine.
    const same = run('holder@navgurukul.org,NG-0100,,,')
    expect(same.rows[0].action).toBe('unchanged')
    const changed = run('holder@navgurukul.org,NG-0101,,,')
    expect(changed.rows[0].changes).toEqual([{ field: 'employee_code', from: 'NG-0100', to: 'NG-0101' }])
  })

  it('warns on dates that are allowed but look wrong', () => {
    const p = plan('a@navgurukul.org,A,fte,2026-01-01,,,,2025-12-01,2026-02-01')
    expect(p.rows[0].warnings).toEqual(
      expect.arrayContaining(['confirmation_date is before joining_date.', 'conversion_date is only used for interns.'])
    )
    expect(p.canImport).toBe(true)
  })

  it('stops on a file without an email column, and names ignored columns', () => {
    expect(planEmployeeImport('name,team\nA,Finance', ctx()).fileErrors).toEqual(['The header row has no "email" column.'])
    const p = planEmployeeImport('Email,Full Name,Name,Employee Type,Joining Date,PAN\na@navgurukul.org,x,A,fte,2026-01-01,ABCDE1234F', ctx())
    expect(p.fileWarnings).toEqual(['Ignored columns: full_name, pan.'])
    expect(p.rows[0].action).toBe('create')
  })
})
