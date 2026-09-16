export function generateCalendarLink({
  title,
  description,
  startDateTime,
  durationMinutes = 30,
}: {
  title: string
  description: string
  startDateTime: Date
  durationMinutes?: number
}) {
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000)

  // Format dates as YYYYMMDDTHHMMSSZ (Google Calendar's required format)
  function formatDate(date: Date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: description,
    dates: `${formatDate(startDateTime)}/${formatDate(endDateTime)}`,
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}