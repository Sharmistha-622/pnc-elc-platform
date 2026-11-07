import { describe, it, expect } from 'vitest'
import { isChild, guardianStatusFor, guardianBlocks } from './children'

const today = new Date('2026-11-07T00:00:00Z')

describe('isChild', () => {
  it('treats anyone under 18 on the day as a child', () => {
    expect(isChild('2008-11-08', today)).toBe(true) // turns 18 tomorrow
    expect(isChild('2008-11-07', today)).toBe(false) // 18 today
    expect(isChild('1990-01-01', today)).toBe(false)
  })

  it('does not guess when the date is missing or invalid', () => {
    expect(isChild(null, today)).toBeNull()
    expect(isChild('not a date', today)).toBeNull()
  })
})

describe('guardianStatusFor', () => {
  it('holds a child for guardian consent and clears an adult', () => {
    expect(guardianStatusFor('not_checked', '2010-05-01', today)).toBe('required')
    expect(guardianStatusFor('not_checked', '1995-05-01', today)).toBe('not_required')
  })

  it('never lets the joiner clear a hold by entering another date', () => {
    expect(guardianStatusFor('required', '1995-05-01', today)).toBe('required')
  })

  it('keeps recorded consent, and re-checks after PnC confirms an adult', () => {
    expect(guardianStatusFor('given', '2010-05-01', today)).toBe('given')
    expect(guardianStatusFor('not_required', '2010-05-01', today)).toBe('required')
  })

  it('blocks only while consent is required', () => {
    expect(guardianBlocks('required')).toBe(true)
    expect(guardianBlocks('given')).toBe(false)
    expect(guardianBlocks('not_checked')).toBe(false)
  })
})
