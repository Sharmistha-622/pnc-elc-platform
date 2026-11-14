/**
 * Utility functions for tenure calculation, employment type formatting, and date display.
 */

/**
 * Calculates human-readable tenure between a start date and an end date (or current date).
 * Examples:
 * - "1 year 2 months"
 * - "2 years 1 month"
 * - "10 years 4 months"
 * - "5 months"
 * - "2 years"
 * - "< 1 month"
 */
export function calculateTenure(
  startDateStr?: string | null,
  endDateStr?: string | null
): string {
  if (!startDateStr) return '—';

  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '—';
  if (end < start) return '< 1 month';

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0 && months <= 0) {
    return '< 1 month';
  }

  const yearPart = years > 0 ? `${years} ${years === 1 ? 'year' : 'years'}` : '';
  const monthPart = months > 0 ? `${months} ${months === 1 ? 'month' : 'months'}` : '';

  if (yearPart && monthPart) {
    return `${yearPart} ${monthPart}`;
  }
  return yearPart || monthPart || '< 1 month';
}

/**
 * Returns total elapsed months between start date and end date for numerical sorting.
 */
export function getTenureInMonths(
  startDateStr?: string | null,
  endDateStr?: string | null
): number {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

  const years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();
  if (days < 0) months -= 1;

  return Math.max(0, years * 12 + months);
}

/**
 * Prettifies employment type string.
 */
export function formatEmploymentType(type?: string | null): string {
  if (!type) return 'Full-Time';
  const clean = type.toLowerCase().trim();
  switch (clean) {
    case 'fte':
      return 'FTE';
    case 'ftc':
      return 'FTC';
    case 'intern':
      return 'Intern';
    case 'contractor':
      return 'Contractor';
    case 'apprentice_tech':
      return 'Apprentice (Tech)';
    case 'apprentice_nontech':
      return 'Apprentice (Non-Tech)';
    default:
      return type
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/**
 * Formats ISO date to readable string (e.g. "Jun 1, 2026").
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
