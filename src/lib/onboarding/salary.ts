// ============================================================================
// SALARY STRUCTURE — the Annexure A breakdown
// ----------------------------------------------------------------------------
// A CTC figure on its own cannot produce an annexure: the split into basic,
// HRA, allowances and the employer's PF contribution is a policy, and it
// differs per employee type. This module holds that policy, derives the
// breakdown from a single CTC figure, and renders it.
//
// Derived figures are persisted rather than recomputed on read. An annexure
// that has been signed must keep saying what it said at the time, even after
// the rules change.
// ============================================================================

import { onboardingDb } from './db';
import { formatIndianNumber, type CtcFrequency } from './compensation';

export interface SalaryRule {
  code: string;
  label: string;
  employee_type_code: string | null;
  basic_percent_of_gross: number;
  hra_percent_of_basic: number;
  employer_pf_percent_of_basic: number;
  pf_wage_ceiling_monthly: number;
  pf_applicable: boolean;
  gratuity_percent_of_basic: number;
  ctc_includes_employer_pf: boolean;
  is_default: boolean;
}

export interface SalaryBreakdown {
  basic_monthly: number;
  hra_monthly: number;
  special_allowance_monthly: number;
  other_allowance_monthly: number;
  employer_pf_monthly: number;
  gratuity_monthly: number;
  gross_monthly: number;
  ctc_monthly: number;
  ctc_annual: number;
  rule_code: string;
}

/** Used when `salary_rules` cannot be read, so an annexure can still be drawn. */
export const DEFAULT_RULE: SalaryRule = {
  code: 'fte_standard',
  label: 'Full-Time Employee — standard split',
  employee_type_code: 'fte',
  basic_percent_of_gross: 51.0638,
  hra_percent_of_basic: 40,
  employer_pf_percent_of_basic: 12,
  pf_wage_ceiling_monthly: 15000,
  pf_applicable: true,
  gratuity_percent_of_basic: 0,
  ctc_includes_employer_pf: true,
  is_default: true,
};

/** Rupees, rounded to whole units — payroll does not deal in paise here. */
function rupees(value: number): number {
  return Math.round(value);
}

export async function getSalaryRules(): Promise<SalaryRule[]> {
  try {
    const { data, error } = await onboardingDb()
      .from('salary_rules')
      .select('*')
      .eq('is_active', true);
    if (error || !data || data.length === 0) return [DEFAULT_RULE];
    return data.map((r) => ({
      ...r,
      basic_percent_of_gross: Number(r.basic_percent_of_gross),
      hra_percent_of_basic: Number(r.hra_percent_of_basic),
      employer_pf_percent_of_basic: Number(r.employer_pf_percent_of_basic),
      pf_wage_ceiling_monthly: Number(r.pf_wage_ceiling_monthly),
      gratuity_percent_of_basic: Number(r.gratuity_percent_of_basic),
    })) as SalaryRule[];
  } catch {
    return [DEFAULT_RULE];
  }
}

/** The rule for an employee type code, falling back to the default rule. */
export async function resolveSalaryRule(employeeTypeCode?: string | null): Promise<SalaryRule> {
  const rules = await getSalaryRules();
  if (employeeTypeCode) {
    const match = rules.find((r) => r.employee_type_code === employeeTypeCode);
    if (match) return match;
  }
  return rules.find((r) => r.is_default) ?? rules[0] ?? DEFAULT_RULE;
}

/**
 * Split a total CTC into its components.
 *
 * Works backwards from CTC, because CTC is the number that was negotiated and
 * the one written into the offer. Everything else is derived so the parts
 * always add back up to it.
 */
export function deriveBreakdown(
  ctcAmount: number,
  frequency: CtcFrequency,
  rule: SalaryRule
): SalaryBreakdown {
  const ctcMonthly = frequency === 'annual' ? ctcAmount / 12 : ctcAmount;

  const basicPct = rule.basic_percent_of_gross / 100;
  const hraPct = rule.hra_percent_of_basic / 100;
  const pfPct = rule.pf_applicable ? rule.employer_pf_percent_of_basic / 100 : 0;
  const gratuityPct = rule.gratuity_percent_of_basic / 100;

  // When CTC includes the employer's contributions, gross is what is left once
  // those are carved out. Solving for gross directly keeps the components
  // adding back to exactly the CTC that was agreed, instead of leaving a
  // rounding gap in the special allowance.
  //
  //   ctc = gross + basic * (pf% + gratuity%)
  //   basic = gross * basic%
  //   => ctc = gross * (1 + basic% * (pf% + gratuity%))
  //
  // The PF ceiling breaks that proportionality, so it is applied afterwards
  // and gross is re-solved against the now-fixed contribution.
  let grossMonthly: number;
  if (rule.ctc_includes_employer_pf) {
    grossMonthly = ctcMonthly / (1 + basicPct * (pfPct + gratuityPct));
    const uncappedBasic = grossMonthly * basicPct;
    const ceiling = rule.pf_wage_ceiling_monthly;
    if (pfPct > 0 && ceiling > 0 && uncappedBasic > ceiling) {
      // Contribution is now a flat amount, so gross is simply CTC minus it.
      const cappedPf = ceiling * pfPct;
      const gratuityOnCapped = ceiling * gratuityPct;
      grossMonthly = ctcMonthly - cappedPf - gratuityOnCapped;
    }
  } else {
    grossMonthly = ctcMonthly;
  }

  const basic = grossMonthly * basicPct;
  const pfBase = rule.pf_wage_ceiling_monthly > 0 ? Math.min(basic, rule.pf_wage_ceiling_monthly) : basic;
  const employerPf = pfBase * pfPct;
  const gratuity = pfBase * gratuityPct;
  const hra = basic * hraPct;

  // Special allowance absorbs the remainder, so the parts always sum to gross
  // exactly rather than leaving a few rupees unexplained.
  const basicR = rupees(basic);
  const hraR = rupees(hra);
  const employerPfR = rupees(employerPf);
  const gratuityR = rupees(gratuity);
  const grossR = rupees(grossMonthly);
  const specialR = Math.max(0, grossR - basicR - hraR);

  const ctcMonthlyR = grossR + employerPfR + gratuityR;

  return {
    basic_monthly: basicR,
    hra_monthly: hraR,
    special_allowance_monthly: specialR,
    other_allowance_monthly: 0,
    employer_pf_monthly: employerPfR,
    gratuity_monthly: gratuityR,
    gross_monthly: grossR,
    ctc_monthly: ctcMonthlyR,
    ctc_annual: ctcMonthlyR * 12,
    rule_code: rule.code,
  };
}

export interface SalaryStructure extends SalaryBreakdown {
  id: string;
  onboarding_id: string | null;
  employee_id: string | null;
  effective_from: string;
  currency: string;
  notes: string | null;
}

/** Read the stored structure for an onboarding record, if one exists. */
export async function getSalaryStructure(onboardingId: string): Promise<SalaryStructure | null> {
  const { data, error } = await onboardingDb()
    .from('salary_structures')
    .select('*')
    .eq('onboarding_id', onboardingId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    ...data,
    basic_monthly: Number(data.basic_monthly),
    hra_monthly: Number(data.hra_monthly),
    special_allowance_monthly: Number(data.special_allowance_monthly),
    other_allowance_monthly: Number(data.other_allowance_monthly),
    employer_pf_monthly: Number(data.employer_pf_monthly),
    gratuity_monthly: Number(data.gratuity_monthly),
    gross_monthly: Number(data.gross_monthly),
    ctc_monthly: Number(data.ctc_monthly),
    ctc_annual: Number(data.ctc_annual),
  } as SalaryStructure;
}

/**
 * Derive and store the structure for an onboarding record.
 *
 * Returns null when there is no CTC to split — an intern on an unspecified
 * stipend gets no annexure rather than one full of zeroes.
 */
export async function upsertSalaryStructure(
  onboardingId: string,
  input: {
    ctcAmount?: number | null;
    ctcFrequency?: CtcFrequency | null;
    employeeTypeCode?: string | null;
    effectiveFrom?: string;
    createdBy?: string;
    overrides?: Partial<SalaryBreakdown>;
  }
): Promise<SalaryStructure | null> {
  if (!input.ctcAmount || input.ctcAmount <= 0) return null;

  const rule = await resolveSalaryRule(input.employeeTypeCode);
  const derived = deriveBreakdown(input.ctcAmount, input.ctcFrequency ?? 'annual', rule);
  const merged = { ...derived, ...(input.overrides ?? {}) };

  const { data, error } = await onboardingDb()
    .from('salary_structures')
    .upsert(
      {
        onboarding_id: onboardingId,
        effective_from: input.effectiveFrom ?? new Date().toISOString().slice(0, 10),
        basic_monthly: merged.basic_monthly,
        hra_monthly: merged.hra_monthly,
        special_allowance_monthly: merged.special_allowance_monthly,
        other_allowance_monthly: merged.other_allowance_monthly,
        employer_pf_monthly: merged.employer_pf_monthly,
        gratuity_monthly: merged.gratuity_monthly,
        rule_code: merged.rule_code,
        created_by: input.createdBy ?? null,
      },
      { onConflict: 'onboarding_id' }
    )
    .select('*')
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to store salary structure:', error?.message);
    return null;
  }
  return getSalaryStructure(onboardingId);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

interface AnnexureRow {
  label: string;
  monthly: number;
  annual: number;
  emphasis?: boolean;
}

export function annexureRows(s: SalaryBreakdown): AnnexureRow[] {
  const row = (label: string, monthly: number, emphasis = false): AnnexureRow => ({
    label,
    monthly,
    annual: monthly * 12,
    emphasis,
  });

  const rows: AnnexureRow[] = [
    row('Basic Pay', s.basic_monthly),
    row('HRA', s.hra_monthly),
    row('Special Allowance', s.special_allowance_monthly),
  ];
  if (s.other_allowance_monthly > 0) rows.push(row('Other Allowances', s.other_allowance_monthly));
  rows.push(row('Gross Salary (Including Employee PF)', s.gross_monthly, true));
  if (s.employer_pf_monthly > 0) rows.push(row("Employer's Contribution to PF", s.employer_pf_monthly));
  if (s.gratuity_monthly > 0) rows.push(row('Gratuity', s.gratuity_monthly));
  rows.push(row('Total CTC (in Rs.)', s.ctc_monthly, true));
  return rows;
}

/** Annexure A as a standalone HTML fragment, matching the letter styling. */
export function renderAnnexureHtml(
  s: SalaryBreakdown,
  meta: { employeeName: string; designation: string }
): string {
  const cells = annexureRows(s)
    .map((r) => {
      const strong = (text: string) => (r.emphasis ? `<strong>${text}</strong>` : text);
      return `      <tr${r.emphasis ? ' class="annexure-total"' : ''}>
        <td>${strong(r.label)}</td>
        <td class="num">${strong(formatIndianNumber(r.monthly))}</td>
        <td class="num">${strong(formatIndianNumber(r.annual))}</td>
      </tr>`;
    })
    .join('\n');

  return `<div class="annexure">
  <h2>Annexure A</h2>
  <p><strong>Employee Name:</strong> ${meta.employeeName}<br />
  <strong>Designation:</strong> ${meta.designation}</p>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="num">Monthly (Rs. Per Month)</th>
        <th class="num">Annual (In Rs.)</th>
      </tr>
    </thead>
    <tbody>
${cells}
    </tbody>
  </table>
  <p class="annexure-note">All figures are in Indian Rupees and are subject to statutory deductions as applicable.</p>
</div>`;
}
