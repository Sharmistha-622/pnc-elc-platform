import type { DocumentType } from '@/lib/settings/types'

// Two separate destinations (Stage 1.6). Team Member is PnC only; Verification Docs is Finance + PnC.
// A document is never routed by guesswork: unknown types or destinations are rejected.
export type DriveDestination = 'team_member' | 'verification_docs'

const FOLDER_NAMES: Record<DriveDestination, string> = {
  team_member: 'Team Member',
  verification_docs: 'Verification Docs',
}

function isDestination(value: string): value is DriveDestination {
  return value === 'team_member' || value === 'verification_docs'
}

export type DocumentRoute = {
  destination: DriveDestination
  folderPath: string[]
  fileBaseName: string
}

export function resolveDocumentRoute(
  documentTypeName: string,
  types: DocumentType[],
  employee: { id: string; name: string }
): DocumentRoute {
  const type = types.find((t) => t.name === documentTypeName && t.is_active)
  if (!type) throw new Error(`Unknown or inactive document type: ${documentTypeName}`)
  if (!isDestination(type.destination)) {
    throw new Error(`Document type ${type.name} has no valid destination`)
  }

  const label = `${employee.name} (${employee.id.slice(0, 8)})`
  const folderPath =
    type.destination === 'team_member'
      ? [FOLDER_NAMES.team_member, label]
      : [FOLDER_NAMES.verification_docs]

  return { destination: type.destination, folderPath, fileBaseName: `${label} - ${type.display_name}` }
}

// Required, active document types that have not been uploaded yet
export function missingDocuments(types: DocumentType[], uploadedTypeNames: string[]): DocumentType[] {
  const uploaded = new Set(uploadedTypeNames)
  return types
    .filter((t) => t.is_active && t.is_required && !uploaded.has(t.name))
    .sort((a, b) => a.sort_order - b.sort_order)
}
