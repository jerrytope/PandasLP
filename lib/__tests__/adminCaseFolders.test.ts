import { describe, expect, it } from 'vitest'
import { folderOfCase } from '@/app/admin/components/types'

describe('folderOfCase', () => {
  it('groups drafts and unpaid documents as saved', () => {
    expect(folderOfCase({ status: 'draft', brand_id: null })).toBe('saved')
    expect(folderOfCase({ status: 'document_ready', brand_id: null })).toBe('saved')
  })

  it('groups paid cases and brand letters awaiting review together', () => {
    expect(folderOfCase({ status: 'paid', brand_id: null })).toBe('review')
    expect(folderOfCase({ status: 'document_ready', brand_id: 'brand-1' })).toBe('review')
  })

  it('groups served, court, and completed cases by their workflow stage', () => {
    expect(folderOfCase({ status: 'letter_served', brand_id: null })).toBe('served')
    expect(folderOfCase({ status: 'filed', brand_id: null })).toBe('court')
    expect(folderOfCase({ status: 'judgment_obtained', brand_id: null })).toBe('court')
    expect(folderOfCase({ status: 'closed', brand_id: null })).toBe('completed')
  })

  it('keeps unknown statuses visible in the saved folder', () => {
    expect(folderOfCase({ status: 'unknown', brand_id: null })).toBe('saved')
  })
})
