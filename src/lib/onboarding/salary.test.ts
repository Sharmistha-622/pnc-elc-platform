import { describe, it, expect } from 'vitest';
import {
  deriveBreakdown,
  annexureRows,
  renderAnnexureHtml,
  DEFAULT_RULE,
  type SalaryRule,
} from './salary';

/**
 * The FTE rule as seeded: basic 51.0638% of gross, HRA 40% of basic, employer
 * PF 12% of basic capped at the ₹15,000/month statutory wage ceiling.
 */
const FTE = DEFAULT_RULE;

/** Consultants and interns are paid a single figure, not a split. */
const FLAT: SalaryRule = {
  ...DEFAULT_RULE,
  code: 'ftc_consultant',
  employee_type_code: 'ftc',
  basic_percent_of_gross: 100,
  hra_percent_of_basic: 0,
  pf_applicable: false,
  ctc_includes_employer_pf: false,
  is_default: false,
};

describe('deriveBreakdown', () => {
  describe('the reference annexure', () => {
    // Basic 48,000 / HRA 19,200 / Special 26,800 / Gross 94,000 /
    // Employer PF 1,800 / CTC 95,800 monthly, 11,49,600 annual.
    const expected = {
      basic_monthly: 48000,
      hra_monthly: 19200,
      special_allowance_monthly: 26800,
      gross_monthly: 94000,
      employer_pf_monthly: 1800,
      ctc_monthly: 95800,
      ctc_annual: 1149600,
    };

    it('reproduces it from the monthly CTC', () => {
      expect(deriveBreakdown(95800, 'monthly', FTE)).toMatchObject(expected);
    });

    it('reproduces it from the annual CTC', () => {
      expect(deriveBreakdown(1149600, 'annual', FTE)).toMatchObject(expected);
    });

    it('treats the monthly and annual forms of one salary as identical', () => {
      expect(deriveBreakdown(1149600, 'annual', FTE)).toEqual(
        deriveBreakdown(95800, 'monthly', FTE)
      );
    });
  });

  describe('the arithmetic always closes', () => {
    // The point of deriving backwards from CTC: whatever the input, the parts
    // must add back up to the figure that was actually negotiated. A salary
    // that is a few rupees short of what was agreed is a real defect, so this
    // is checked across the whole plausible range rather than at one value.
    const monthlyFigures = [
      8000, 12500, 15000, 18000, 20000, 25000, 33333, 40000, 47500, 60000,
      75000, 88888, 95800, 120000, 150000, 250000, 400000, 999999,
    ];

    it.each(monthlyFigures)('components sum to gross and CTC at ₹%i/month', (ctc) => {
      const s = deriveBreakdown(ctc, 'monthly', FTE);

      expect(s.basic_monthly + s.hra_monthly + s.special_allowance_monthly + s.other_allowance_monthly)
        .toBe(s.gross_monthly);

      expect(s.gross_monthly + s.employer_pf_monthly + s.gratuity_monthly).toBe(s.ctc_monthly);

      // No rupee is created or lost between the input and the breakdown.
      expect(s.ctc_monthly).toBe(ctc);
      expect(s.ctc_annual).toBe(ctc * 12);
    });

    it.each(monthlyFigures)('produces no negative component at ₹%i/month', (ctc) => {
      const s = deriveBreakdown(ctc, 'monthly', FTE);
      for (const [key, value] of Object.entries(s)) {
        if (typeof value === 'number') expect(value, key).toBeGreaterThanOrEqual(0);
      }
    });

    it('closes for an annual figure that does not divide evenly by 12', () => {
      // 1,00,001 / 12 is recurring; the annual total must still be honoured.
      const s = deriveBreakdown(100001, 'annual', FTE);
      expect(s.gross_monthly + s.employer_pf_monthly + s.gratuity_monthly).toBe(s.ctc_monthly);
      expect(Math.abs(s.ctc_annual - 100001)).toBeLessThanOrEqual(12);
    });
  });

  describe('the PF wage ceiling', () => {
    it('caps the employer contribution at 12% of the ceiling', () => {
      const s = deriveBreakdown(95800, 'monthly', FTE);
      // 12% of ₹15,000, not 12% of ₹48,000.
      expect(s.employer_pf_monthly).toBe(1800);
      expect(s.employer_pf_monthly).toBeLessThan(s.basic_monthly * 0.12);
    });

    it('computes on actual basic when basic is below the ceiling', () => {
      const s = deriveBreakdown(20000, 'monthly', FTE);
      expect(s.basic_monthly).toBeLessThan(FTE.pf_wage_ceiling_monthly);
      expect(s.employer_pf_monthly).toBe(Math.round(s.basic_monthly * 0.12));
    });

    it('stays capped as salary grows', () => {
      const low = deriveBreakdown(100000, 'monthly', FTE);
      const high = deriveBreakdown(500000, 'monthly', FTE);
      expect(low.employer_pf_monthly).toBe(1800);
      expect(high.employer_pf_monthly).toBe(1800);
    });

    it('uses actual basic when no ceiling is configured', () => {
      const uncapped: SalaryRule = { ...FTE, pf_wage_ceiling_monthly: 0 };
      const s = deriveBreakdown(95800, 'monthly', uncapped);
      expect(s.employer_pf_monthly).toBe(Math.round(s.basic_monthly * 0.12));
      expect(s.employer_pf_monthly).toBeGreaterThan(1800);
    });
  });

  describe('rules without a split', () => {
    it('pays a consultant one figure, with no HRA and no PF', () => {
      const s = deriveBreakdown(60000, 'monthly', FLAT);
      expect(s).toMatchObject({
        basic_monthly: 60000,
        hra_monthly: 0,
        special_allowance_monthly: 0,
        employer_pf_monthly: 0,
        gross_monthly: 60000,
        ctc_monthly: 60000,
        ctc_annual: 720000,
      });
    });

    it('leaves gross equal to CTC when CTC excludes the employer contribution', () => {
      const excluded: SalaryRule = { ...FTE, ctc_includes_employer_pf: false };
      const s = deriveBreakdown(94000, 'monthly', excluded);
      expect(s.gross_monthly).toBe(94000);
      // The contribution sits on top rather than being carved out.
      expect(s.ctc_monthly).toBe(94000 + s.employer_pf_monthly);
    });

    it('disables PF entirely when the rule says it does not apply', () => {
      const noPf: SalaryRule = { ...FTE, pf_applicable: false };
      const s = deriveBreakdown(94000, 'monthly', noPf);
      expect(s.employer_pf_monthly).toBe(0);
      expect(s.gross_monthly).toBe(s.ctc_monthly);
    });
  });

  describe('gratuity', () => {
    it('is carved out of CTC alongside PF and still closes', () => {
      const withGratuity: SalaryRule = { ...FTE, gratuity_percent_of_basic: 4.81 };
      const s = deriveBreakdown(95800, 'monthly', withGratuity);
      expect(s.gratuity_monthly).toBeGreaterThan(0);
      expect(s.gross_monthly + s.employer_pf_monthly + s.gratuity_monthly).toBe(s.ctc_monthly);
      expect(s.ctc_monthly).toBe(95800);
    });

    it('is zero by default', () => {
      expect(deriveBreakdown(95800, 'monthly', FTE).gratuity_monthly).toBe(0);
    });

    // Regression: rounding gross, PF and gratuity independently and adding them
    // up landed a rupee above the agreed CTC. Gross is now whatever is left of
    // CTC once the rounded contributions are removed.
    it.each([20000, 47500, 95800, 150000, 333333])(
      'does not shift the agreed CTC at ₹%i/month',
      (ctc) => {
        const withGratuity: SalaryRule = { ...FTE, gratuity_percent_of_basic: 4.81 };
        expect(deriveBreakdown(ctc, 'monthly', withGratuity).ctc_monthly).toBe(ctc);
      }
    );
  });

  describe('a misconfigured rule', () => {
    // Percentages that exceed gross are a configuration error, but they must
    // not produce a negative line item on a letter someone is about to sign.
    const overAllocated: SalaryRule = {
      ...FTE,
      basic_percent_of_gross: 100,
      hra_percent_of_basic: 40,
    };

    it('clamps rather than emitting a negative allowance', () => {
      const s = deriveBreakdown(94000, 'monthly', overAllocated);
      expect(s.special_allowance_monthly).toBeGreaterThanOrEqual(0);
      expect(s.hra_monthly).toBeGreaterThanOrEqual(0);
    });

    it('still closes', () => {
      const s = deriveBreakdown(94000, 'monthly', overAllocated);
      expect(s.basic_monthly + s.hra_monthly + s.special_allowance_monthly + s.other_allowance_monthly)
        .toBe(s.gross_monthly);
      expect(s.gross_monthly + s.employer_pf_monthly + s.gratuity_monthly).toBe(s.ctc_monthly);
    });
  });

  it('records which rule produced the figures', () => {
    expect(deriveBreakdown(60000, 'monthly', FLAT).rule_code).toBe('ftc_consultant');
  });

  it('returns whole rupees, never paise', () => {
    const s = deriveBreakdown(77777, 'monthly', FTE);
    for (const value of Object.values(s)) {
      if (typeof value === 'number') expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('annexureRows', () => {
  const s = deriveBreakdown(95800, 'monthly', FTE);

  it('annualises every row as twelve times the monthly figure', () => {
    for (const row of annexureRows(s)) {
      expect(row.annual).toBe(row.monthly * 12);
    }
  });

  it('emphasises gross and total CTC, and nothing else', () => {
    const emphasised = annexureRows(s).filter((r) => r.emphasis).map((r) => r.label);
    expect(emphasised).toEqual([
      'Gross Salary (Including Employee PF)',
      'Total CTC (in Rs.)',
    ]);
  });

  it('omits rows that would read as a zero line item', () => {
    const labels = annexureRows(deriveBreakdown(60000, 'monthly', FLAT)).map((r) => r.label);
    expect(labels).not.toContain("Employer's Contribution to PF");
    expect(labels).not.toContain('Gratuity');
    expect(labels).not.toContain('Other Allowances');
  });

  it('includes the PF row when there is a contribution', () => {
    expect(annexureRows(s).map((r) => r.label)).toContain("Employer's Contribution to PF");
  });
});

describe('renderAnnexureHtml', () => {
  const html = renderAnnexureHtml(deriveBreakdown(95800, 'monthly', FTE), {
    employeeName: 'Sample Employee',
    designation: 'Program Manager',
  });

  it('names the employee and the designation', () => {
    expect(html).toContain('Sample Employee');
    expect(html).toContain('Program Manager');
  });

  it('formats figures in the Indian grouping', () => {
    expect(html).toContain('5,76,000'); // annual basic
    expect(html).toContain('11,49,600'); // annual CTC
    expect(html).not.toContain('576000');
  });

  it('renders one row per line item plus a header row', () => {
    const rowCount = (html.match(/<tr/g) ?? []).length;
    expect(rowCount).toBe(annexureRows(deriveBreakdown(95800, 'monthly', FTE)).length + 1);
  });
});
