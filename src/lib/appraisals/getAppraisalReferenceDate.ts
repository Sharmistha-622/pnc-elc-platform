export function getAppraisalReferenceDate(employee: {
  employeeType: string
  joiningDate: string
  conversionDate: string | null
}): Date | null {
  if (employee.employeeType === 'intern') {
    return employee.conversionDate ? new Date(employee.conversionDate) : null
  }

  if (employee.employeeType === 'fte' || employee.employeeType === 'ftc') {
    const reference = new Date(employee.joiningDate)
    reference.setMonth(reference.getMonth() + 6)
    return reference
  }

  // apprentices, contractors — not eligible
  return null
}