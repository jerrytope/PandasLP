// Word-level diff between the original extracted text and whatever the user edited it to —
// powers the inline diff view in ExtractionConfirmModal.tsx. Deliberately word-granularity,
// not character-level: a legal-document reviewer cares "which words changed," not "which
// individual letters," and word-level output is far more readable for that purpose.
export type DiffPart = { text: string; type: 'same' | 'added' | 'removed' }

function tokenize(text: string): string[] {
  // Keep whitespace as its own tokens so the rejoined output preserves original spacing/newlines.
  return text.split(/(\s+)/).filter((t) => t.length > 0)
}

// Standard LCS (longest common subsequence) table, then walk it backwards to emit a
// same/added/removed sequence — the textbook approach for a readable two-way diff.
export function wordDiff(original: string, edited: string): DiffPart[] {
  const a = tokenize(original)
  const b = tokenize(edited)
  const n = a.length
  const m = b.length

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const parts: DiffPart[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      parts.push({ text: a[i], type: 'same' })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      parts.push({ text: a[i], type: 'removed' })
      i++
    } else {
      parts.push({ text: b[j], type: 'added' })
      j++
    }
  }
  while (i < n) parts.push({ text: a[i++], type: 'removed' })
  while (j < m) parts.push({ text: b[j++], type: 'added' })

  // Merge adjacent same-type parts so whitespace tokens don't fragment the highlight into
  // one-character-wide spans.
  const merged: DiffPart[] = []
  for (const part of parts) {
    const last = merged[merged.length - 1]
    if (last && last.type === part.type) last.text += part.text
    else merged.push({ ...part })
  }
  return merged
}

export function hasChanges(parts: DiffPart[]): boolean {
  return parts.some((p) => p.type !== 'same')
}
