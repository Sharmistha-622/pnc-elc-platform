export function getAppraisalCohort(referenceDate: Date): 'july' | 'december' {
  const month = referenceDate.getMonth() + 1 // JS months are 0-indexed; convert to 1-12

  // April (4) through September (9) inclusive → July cycle
  // October (10) through March (3) → December cycle
  if (month >= 4 && month <= 9) {
    return 'july'
  }
  return 'december'
}