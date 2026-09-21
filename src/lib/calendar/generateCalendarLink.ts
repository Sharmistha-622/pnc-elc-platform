export function generateCalendarLink({
  title,
  description,
  startDateTime,
  durationMinutes = 30,
  guestEmail,
}: {
  title: string
  description: string
  startDateTime: Date
  durationMinutes?: number
  guestEmail?: string
}) {
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000)

  function formatDate(date: Date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: description,
    dates: `${formatDate(startDateTime)}/${formatDate(endDateTime)}`,
  })

  if (guestEmail) {
    params.append('add', guestEmail)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}