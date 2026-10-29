import { describe, it, expect } from 'vitest'
import { parseLocationFields } from './input'

describe('parseLocationFields', () => {
  it('keeps only the fields a location has, trimmed', () => {
    const r = parseLocationFields(
      { id: 'x', created_at: 'y', name: '  Patna ', type: 'Campus', address: '  Patna, Bihar ', state_code: 'BR', status: 'active' },
      { requireName: true }
    )
    expect(r).toEqual({ ok: true, value: { name: 'Patna', type: 'Campus', address: 'Patna, Bihar', state_code: 'BR', status: 'active' } })
  })

  it('needs a name to create, not to edit', () => {
    expect(parseLocationFields({}, { requireName: true })).toEqual({ ok: false, error: 'Location name is required.' })
    expect(parseLocationFields({ status: 'closed' }, { requireName: false })).toEqual({ ok: true, value: { status: 'closed' } })
  })

  it('clears an address or state sent empty', () => {
    expect(parseLocationFields({ address: '  ', state_code: '' }, { requireName: false })).toEqual({
      ok: true,
      value: { address: null, state_code: null },
    })
  })

  it('refuses values the database would refuse', () => {
    expect(parseLocationFields({ type: 'Office' }, { requireName: false }).ok).toBe(false)
    expect(parseLocationFields({ status: 'open' }, { requireName: false }).ok).toBe(false)
    expect(parseLocationFields({ state_code: 'Maharashtra' }, { requireName: false }).ok).toBe(false)
    expect(parseLocationFields({ address: 12 }, { requireName: false }).ok).toBe(false)
  })
})
