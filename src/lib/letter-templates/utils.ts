/**
 * Pure client-safe utility functions for letter templates.
 */

export function populateTemplatePlaceholders(
  templateContent: string,
  candidateData: Record<string, any>
): string {
  if (!templateContent) return '';

  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const map: Record<string, string> = {
    '{{Full Name}}': candidateData.candidate_name || candidateData.full_name || '{{Full Name}}',
    '{{Offer Letter Date}}': candidateData.offer_letter_date || currentDate,
    '{{Designation}}': candidateData.designation || '{{Designation}}',
    '{{Department}}': candidateData.department || candidateData.team_name || '{{Department}}',
    '{{Reporting Manager}}': candidateData.manager_name || candidateData.reporting_manager || 'Reporting Manager',
    '{{Date of Joining}}': candidateData.joining_date || candidateData.date_of_joining || '{{Date of Joining}}',
    '{{Work Location}}': candidateData.location || candidateData.work_location || 'NavGurukul Campus / Remote',
    '{{Travel Requirement}}': candidateData.travel_requirement || 'As required for campus visits and programmatic needs (approx 10-20%)',
    '{{Monthly Compensation}}': candidateData.monthly_compensation || candidateData.ctc || '₹50,000',
    // Salary placeholders resolve from the stored annexure where one exists,
    // so a letter and its annexure can never quote different figures.
    '{{Annual CTC}}': candidateData.annual_ctc || candidateData.ctc || '',
    '{{Basic Pay}}': candidateData.basic_pay || '',
    '{{Gross Salary}}': candidateData.gross_salary || '',
    '{{Payment and Invoice Terms}}':
      candidateData.payment_terms ||
      'Invoices submitted by the 25th will be processed by the 5th of the following month, subject to applicable TDS deductions.',
    '{{Role Overview}}':
      candidateData.role_responsibilities ||
      candidateData.role_overview ||
      'Deliver on core project objectives, drive high-impact educational outcomes, and support student empowerment initiatives.',
    '{{Working Days and Leave Terms}}':
      candidateData.leave_terms ||
      '5 working days per week. Leaves subject to organizational consultant leave guidelines as shared in the Handbook.',
    '{{Notice Period}}': candidateData.notice_period || '1 Month',
    '{{Review Period}}': candidateData.probation_period || '3 Months',
    '{{Termination Clause}}':
      'Either party may discontinue this engagement by providing written notice in accordance with the notice period.',
    '{{Acceptance Period}}': '7 days',
    '{{Authorized Signatory Name}}': candidateData.signatory_name || 'Authorised Signatory',
    '{{Authorized Signatory Title}}': candidateData.signatory_title || 'People & Culture, NavGurukul',
    '{{Date of Acceptance}}': currentDate,
    '{{Personal Email}}': candidateData.personal_email || candidateData.email || '{{Personal Email}}',
  };

  let result = templateContent;
  for (const [key, val] of Object.entries(map)) {
    result = result.replaceAll(key, val);
  }
  return result;
}
