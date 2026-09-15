'use server'

import { google } from 'googleapis'

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
)

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

function createEmailBody(to: string, subject: string, htmlBody: string) {
  const messageParts = [
    `From: ${process.env.GOOGLE_SENDER_EMAIL}`,
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    htmlBody,
  ]
  const message = messageParts.join('\n')

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function sendEmail(
  template: string,
  data: Record<string, string>,
  recipient: string
) {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client })

    const subject = data.subject || `Notification: ${template}`
    const htmlBody = data.body || `<p>You have a new notification: ${template}</p>`

    const raw = createEmailBody(recipient, subject, htmlBody)

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })

    return { success: true, messageId: response.data.id }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error: String(error) }
  }
}