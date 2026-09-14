export function getConfirmationTriggerDate(
  employeeType: string,
  joiningDate: string
): Date | null {
  const joining = new Date(joiningDate)
  const offsets: Record<string, number> = {
    apprentice_nontech: 1,
    apprentice_tech: 3,
    intern: 3,
    fte: 12,
    ftc: 3,
    // contractor: dynamic, not calculated here
  }

  const months = offsets[employeeType]
  if (months === undefined) return null // contractor or unknown type — needs manual entry

  const trigger = new Date(joining)
  trigger.setMonth(trigger.getMonth() + months)
  return trigger
}