import { describe, it, expect } from 'vitest'
import {
  buildAppraisalFooterCards,
  deriveAppraisalCycleStatus,
  formatAppraisalWindowFooter,
} from './cycleSummary'
import { DEFAULT_APPRAISAL_CYCLES } from '@/lib/settings/types'

describe('Appraisals cycle status and footer (#157)', () => {
  it('formats footer text from Settings › Appraisal window months and lead days', () => {
    const july = formatAppraisalWindowFooter(DEFAULT_APPRAISAL_CYCLES[0], {
      appraisal_lead_days: 14,
    })
    expect(july.title).toBe('July Cycle Cadence')
    expect(july.description).toContain('April and September')
    expect(july.description).toContain('14 days before the July appraisal window')

    const december = formatAppraisalWindowFooter(DEFAULT_APPRAISAL_CYCLES[1], {
      appraisal_lead_days: 14,
    })
    expect(december.title).toBe('December Cycle Cadence')
    expect(december.description).toContain('October and March')
    expect(december.description).toContain('14 days before the December appraisal window')
  })

  it('changing the appraisal window or lead days changes the footer text', () => {
    const modified = buildAppraisalFooterCards(
      [
        {
          ...DEFAULT_APPRAISAL_CYCLES[0],
          cohort_start_month: 1,
          cohort_end_month: 6,
          cycle_month: 8,
        },
        {
          ...DEFAULT_APPRAISAL_CYCLES[1],
          cohort_start_month: 7,
          cohort_end_month: 12,
          is_active: false,
        },
      ],
      { appraisal_lead_days: 21 }
    )

    expect(modified[0].description).toContain('January and June')
    expect(modified[0].description).toContain('21 days before the August appraisal window')
    expect(modified[1].description).toContain('July to December cohort')
    expect(modified[1].description).toContain('disabled in Settings › Appraisal')
  })

  it('derives Cycle Status from review_cycles and Settings › Appraisal', () => {
    expect(
      deriveAppraisalCycleStatus({
        reviewCycles: [{ stage: 'in_review' }, { stage: 'self_review' }, { stage: 'closed' }],
      })
    ).toEqual({
      badge: '2 In Progress',
      subtitle: '1 completed',
      tone: 'active',
    })

    expect(
      deriveAppraisalCycleStatus({
        reviewCycles: [{ stage: 'closed' }],
      })
    ).toEqual({
      badge: 'Completed',
      subtitle: '1 review cycle closed',
      tone: 'completed',
    })

    expect(
      deriveAppraisalCycleStatus({
        reviewCycles: [],
        appraisalCycles: DEFAULT_APPRAISAL_CYCLES,
      })
    ).toEqual({
      badge: 'Scheduled',
      subtitle: 'July Cycle (July) · December Cycle (December)',
      tone: 'scheduled',
    })

    expect(
      deriveAppraisalCycleStatus({
        reviewCycles: [],
        appraisalCycles: DEFAULT_APPRAISAL_CYCLES.map((c) => ({ ...c, is_active: false })),
      })
    ).toEqual({
      badge: 'Paused',
      subtitle: 'No active appraisal windows in Settings',
      tone: 'paused',
    })
  })
})
