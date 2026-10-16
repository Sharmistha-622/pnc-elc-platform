'use client';

import React from 'react';
import { formatIndianNumber } from '@/lib/onboarding/compensation';
import type { OnboardingSalaryStructure } from '@/lib/onboarding/types';

/**
 * Annexure A, as P&C and the candidate see it.
 *
 * Reads the stored structure rather than recomputing from CTC, so what is shown
 * is what was issued — a later change to the split rules does not silently
 * rewrite an annexure someone has already signed against.
 */
export function AnnexureTable({
  structure,
  employeeName,
  designation,
}: {
  structure: OnboardingSalaryStructure;
  employeeName: string;
  designation: string;
}) {
  const rows: { label: string; monthly: number; emphasis?: boolean }[] = [
    { label: 'Basic Pay', monthly: structure.basic_monthly },
    { label: 'HRA', monthly: structure.hra_monthly },
    { label: 'Special Allowance', monthly: structure.special_allowance_monthly },
    ...(structure.other_allowance_monthly > 0
      ? [{ label: 'Other Allowances', monthly: structure.other_allowance_monthly }]
      : []),
    { label: 'Gross Salary (Including Employee PF)', monthly: structure.gross_monthly, emphasis: true },
    ...(structure.employer_pf_monthly > 0
      ? [{ label: "Employer's Contribution to PF", monthly: structure.employer_pf_monthly }]
      : []),
    ...(structure.gratuity_monthly > 0 ? [{ label: 'Gratuity', monthly: structure.gratuity_monthly }] : []),
    { label: 'Total CTC (in Rs.)', monthly: structure.ctc_monthly, emphasis: true },
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{employeeName}</span> · {designation}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="text-left font-semibold px-3 py-2">Description</th>
              <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Monthly (Rs.)</th>
              <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Annual (Rs.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.label} className={row.emphasis ? 'bg-muted/30 font-bold text-foreground' : ''}>
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatIndianNumber(row.monthly)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatIndianNumber(row.monthly * 12)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        All figures are in Indian Rupees and are subject to statutory deductions as applicable.
      </p>
    </div>
  );
}
