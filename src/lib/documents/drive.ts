import { google, drive_v3 } from 'googleapis'
import { Readable } from 'stream'

// Server-only helper. Uses the same Google OAuth credentials as email and calendar.
// The refresh token must include the drive.file scope for these calls to work.
function getDrive(): drive_v3.Drive {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Google credentials are not configured')
  }
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN })
  return google.drive({ version: 'v3', auth })
}

function getRootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  if (!id) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID is not set')
  return id
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function findOrCreateFolder(drive: drive_v3.Drive, name: string, parentId: string): Promise<string> {
  const existing = await drive.files.list({
    q: `name = '${escapeQuery(name)}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive',
  })
  const found = existing.data.files?.[0]?.id
  if (found) return found

  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  })
  if (!created.data.id) throw new Error(`Could not create folder: ${name}`)
  return created.data.id
}

// Walks a folder path under the root folder, creating any folder that is missing
export async function findOrCreatePath(path: string[]): Promise<string> {
  const drive = getDrive()
  let parentId = getRootFolderId()
  for (const name of path) {
    parentId = await findOrCreateFolder(drive, name, parentId)
  }
  return parentId
}

export async function uploadFile(input: {
  name: string
  mimeType: string
  data: Buffer
  parentId: string
}): Promise<{ id: string; url: string }> {
  const drive = getDrive()
  const res = await drive.files.create({
    requestBody: { name: input.name, parents: [input.parentId] },
    media: { mimeType: input.mimeType, body: Readable.from(input.data) },
    fields: 'id, webViewLink',
  })
  if (!res.data.id) throw new Error('Upload failed')
  return { id: res.data.id, url: res.data.webViewLink ?? '' }
}
