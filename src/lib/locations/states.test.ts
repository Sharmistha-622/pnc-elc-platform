import { describe, it, expect } from 'vitest'
import { stateFromAddress, stateLabel } from './states'
import type { IndianState } from './types'

const STATES: IndianState[] = [
  { code: 'MH', name: 'Maharashtra', kind: 'state', aliases: [] },
  { code: 'KA', name: 'Karnataka', kind: 'state', aliases: [] },
  { code: 'CG', name: 'Chhattisgarh', kind: 'state', aliases: ['Chattisgarh'] },
  { code: 'HP', name: 'Himachal Pradesh', kind: 'state', aliases: [] },
  { code: 'MP', name: 'Madhya Pradesh', kind: 'state', aliases: [] },
  { code: 'TG', name: 'Telangana', kind: 'state', aliases: [] },
  { code: 'OD', name: 'Odisha', kind: 'state', aliases: ['Orissa'] },
  { code: 'DL', name: 'Delhi', kind: 'union_territory', aliases: ['New Delhi', 'NCT of Delhi'] },
  { code: 'GA', name: 'Goa', kind: 'state', aliases: [] },
]

describe('stateFromAddress', () => {
  it('reads the state from the seeded campus addresses', () => {
    expect(stateFromAddress('NavGurukul Pune Campus, Hinjewadi Phase 2, Pune, Maharashtra 411057', STATES)).toBe('MH')
    expect(stateFromAddress('NavGurukul Bangalore Campus, Electronic City Phase 1, Bengaluru, Karnataka 560100', STATES)).toBe('KA')
    expect(stateFromAddress('NavGurukul Dharamshala Campus, Vill. Sarah, Kangra, Himachal Pradesh 176215', STATES)).toBe('HP')
  })

  it('takes the state named last, as an address ends with it', () => {
    expect(stateFromAddress('Plot 4, Madhya Pradesh Road, Hyderabad, Telangana 500001', STATES)).toBe('TG')
  })

  it('knows older names and the capital', () => {
    expect(stateFromAddress('Old Orissa office, Bhubaneswar', STATES)).toBe('OD')
    expect(stateFromAddress('Some street, New Delhi 110001', STATES)).toBe('DL')
    expect(stateFromAddress('Near the market, Chattisgarh', STATES)).toBe('CG')
  })

  it('matches whole words only, in any case', () => {
    expect(stateFromAddress('Goalpara Road, Guwahati', STATES)).toBeNull()
    expect(stateFromAddress('panaji, goa 403001', STATES)).toBe('GA')
  })

  it('gives null when there is nothing to go on', () => {
    expect(stateFromAddress('No state here', STATES)).toBeNull()
    expect(stateFromAddress('', STATES)).toBeNull()
    expect(stateFromAddress(null, STATES)).toBeNull()
  })
})

describe('stateLabel', () => {
  it('names the state, or falls back to the code', () => {
    expect(stateLabel('MH', STATES)).toBe('Maharashtra (MH)')
    expect(stateLabel('ZZ', STATES)).toBe('ZZ')
    expect(stateLabel(null, STATES)).toBe('')
  })
})
