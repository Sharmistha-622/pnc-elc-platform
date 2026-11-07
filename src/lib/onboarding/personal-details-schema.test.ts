import { describe, it, expect } from 'vitest'
import { buildPersonalDetailsSchema, personalDetailsDefaults } from './personal-details-schema'
import { DEFAULT_OPTIONAL_FIELDS } from '@/lib/dpdp/optional-fields'

const today = new Date('2026-11-07T00:00:00Z')
const valid = {
  full_name: 'Asha Example',
  date_of_birth: '2000-02-29',
  phone: '+91 90000 00001',
  permanent_address: '12 Example Street, Example Town',
  city: 'Example City',
  state: '',
  pincode: '560001',
  emergency_contact_name: 'Ravi Example',
  emergency_contact_relation: 'Sibling',
  emergency_contact_phone: '+91 90000 00002',
}

describe('candidate personal details', () => {
  it('starts every field empty, apart from what the record already holds for this person', () => {
    const d = personalDetailsDefaults(null, { candidate_name: 'Asha Example', phone: null })
    expect(d.full_name).toBe('Asha Example')
    for (const key of ['date_of_birth', 'gender', 'blood_group', 'emergency_contact_relation', 'emergency_contact_name']) {
      expect(d[key], key).toBe('')
    }
  })

  it('keeps what the candidate saved', () => {
    expect(personalDetailsDefaults({ gender: 'Female' }, {}).gender).toBe('Female')
  })

  it('requires the core fields, date of birth included', () => {
    const schema = buildPersonalDetailsSchema(DEFAULT_OPTIONAL_FIELDS, today)
    expect(schema.safeParse(valid).success).toBe(true)
    expect(schema.safeParse({ ...valid, date_of_birth: '' }).success).toBe(false)
    expect(schema.safeParse({ ...valid, emergency_contact_relation: '' }).success).toBe(false)
    expect(schema.safeParse({ ...valid, date_of_birth: '2030-01-01' }).success).toBe(false)
  })

  it('stores an unanswered optional field as empty, never a guess', () => {
    const parsed = buildPersonalDetailsSchema(DEFAULT_OPTIONAL_FIELDS, today).parse({ ...valid, gender: '', blood_group: '' })
    expect(parsed.gender).toBeNull()
    expect(parsed.blood_group).toBeNull()
    expect(parsed.state).toBeNull()
  })

  it('drops unknown keys and fields that are not collected', () => {
    const settings = { ...DEFAULT_OPTIONAL_FIELDS, blood_group: { collect: false, required: false } }
    const parsed = buildPersonalDetailsSchema(settings, today).parse({ ...valid, blood_group: 'O+', onboarding_id: 'x', is_alumni: true })
    expect(parsed).not.toHaveProperty('blood_group')
    expect(parsed).not.toHaveProperty('onboarding_id')
    expect(parsed).not.toHaveProperty('is_alumni')
  })

  it('requires an optional field when the settings say so', () => {
    const settings = { ...DEFAULT_OPTIONAL_FIELDS, emergency_contact_email: { collect: true, required: true } }
    const schema = buildPersonalDetailsSchema(settings, today)
    expect(schema.safeParse(valid).success).toBe(false)
    expect(schema.safeParse({ ...valid, emergency_contact_email: 'ravi@example.com' }).success).toBe(true)
  })

  it('refuses values outside the offered options', () => {
    expect(buildPersonalDetailsSchema(DEFAULT_OPTIONAL_FIELDS, today).safeParse({ ...valid, blood_group: 'Z' }).success).toBe(false)
  })
})
