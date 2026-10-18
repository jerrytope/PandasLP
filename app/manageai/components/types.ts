// Shapes returned by /api/manageai/* (see app/api/manageai/instructions/route.ts).

export interface TargetSummary {
  target: string
  name: string
  group: 'focus' | 'property-area' | 'other'
  live: { version: number; hasText: boolean; createdBy: string; createdAt: string } | null
  hasDraft: boolean
  signOff: SignOff | null
}

export interface Version {
  target: string
  version: number
  body: string
  note: string
  restoredFrom: number | null
  createdBy: string
  createdAt: string
}

export interface Draft {
  target: string
  body: string
  basedOnVersion: number | null
  updatedBy: string
  updatedAt: string
}

export interface SignOff {
  target: string
  version: number
  signedBy: string
  signedName: string
  note: string
  createdAt: string
}

export interface TargetDetail {
  target: string
  name: string
  group: TargetSummary['group']
  propertyV2: boolean
  base: string
  starterMessage: string
  draft: Draft | null
  versions: Version[]
  signOffs: SignOff[]
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
}
