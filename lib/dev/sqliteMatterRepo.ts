// LOCAL TESTING ONLY. The property matter store (lib/property/matterStore.ts) on SQLite, using
// Node's built-in node:sqlite, so the orchestrator can be tested without Supabase. Same tables
// and rules as add-property-matters.sql (JSON is stored as text), plus a cases table and the
// chat messages, so a test conversation can be resumed. Never imported by the app.

import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import type { MatterRepository } from '../property/matterStore'
import { isPropertyArea, type MatterEvent, type MatterEventKind, type MatterStatus, type PropertyArea, type PropertyMatter } from '../property/types'

const EVENT_KINDS: MatterEventKind[] = ['routed', 'handoff', 'escalated', 'fee_accepted', 'document_emitted', 'law_lookup', 'web_search']
const STATUSES: MatterStatus[] = ['routing', 'active', 'escalated', 'closed']

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cases (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL DEFAULT 'recovery-of-premises',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id     TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS property_matters (
  case_id     TEXT PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
  state       TEXT,
  lagos_area  TEXT,
  area        TEXT CHECK (area IS NULL OR area IN ('recovery', 'tenancy', 'conveyancing', 'other-instruments', 'searches', 'wills-probate', 'land-dispute')),
  facts       TEXT NOT NULL DEFAULT '{}' CHECK (json_type(facts) = 'object'),
  status      TEXT NOT NULL DEFAULT 'routing' CHECK (status IN ('routing', 'active', 'escalated', 'closed')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS property_matter_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id     TEXT NOT NULL REFERENCES property_matters(case_id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('routed', 'handoff', 'escalated', 'fee_accepted', 'document_emitted', 'law_lookup', 'web_search')),
  payload     TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS property_matter_events_case_idx ON property_matter_events (case_id, id);
`

type MatterRow = { case_id: string; state: string | null; lagos_area: string | null; area: string | null; facts: string; status: string }

export class SqliteMatterRepo implements MatterRepository {
  readonly db: DatabaseSync

  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.db.exec(SCHEMA)
  }

  close(): void {
    this.db.close()
  }

  // ----- Test-harness extras: cases and the chat transcript -----

  createCase(): string {
    const id = randomUUID()
    this.db.prepare('INSERT INTO cases (id) VALUES (?)').run(id)
    return id
  }

  caseExists(id: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM cases WHERE id = ?').get(id)
  }

  latestCase(): string | null {
    const row = this.db.prepare('SELECT id FROM cases ORDER BY created_at DESC, rowid DESC LIMIT 1').get() as { id: string } | undefined
    return row?.id ?? null
  }

  addMessage(caseId: string, role: 'user' | 'assistant', content: string): void {
    this.db.prepare('INSERT INTO messages (case_id, role, content) VALUES (?, ?, ?)').run(caseId, role, content)
  }

  messages(caseId: string): { role: 'user' | 'assistant'; content: string }[] {
    return (this.db.prepare('SELECT role, content FROM messages WHERE case_id = ? ORDER BY id').all(caseId) as { role: 'user' | 'assistant'; content: string }[])
      .map((m) => ({ role: m.role, content: m.content }))
  }

  // ----- MatterRepository -----

  async getOrCreateMatter(caseId: string): Promise<PropertyMatter> {
    this.db.prepare('INSERT OR IGNORE INTO property_matters (case_id) VALUES (?)').run(caseId)
    const row = this.db.prepare('SELECT case_id, state, lagos_area, area, facts, status FROM property_matters WHERE case_id = ?').get(caseId) as MatterRow
    return {
      caseId: row.case_id,
      state: row.state,
      lagosArea: row.lagos_area,
      area: isPropertyArea(row.area) ? row.area : null,
      facts: JSON.parse(row.facts),
      status: row.status as MatterStatus,
    }
  }

  private update(caseId: string, set: string, ...values: (string | null)[]): void {
    const result = this.db.prepare(`UPDATE property_matters SET ${set}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE case_id = ?`).run(...values, caseId)
    if (result.changes === 0) throw new Error(`Property matter: no matter for case ${caseId}`)
  }

  async setState(caseId: string, state: string, lagosArea: string | null = null): Promise<void> {
    this.update(caseId, 'state = ?, lagos_area = ?', state, lagosArea)
  }

  async setArea(caseId: string, area: PropertyArea): Promise<void> {
    this.update(caseId, "area = ?, status = 'active'", area)
  }

  async setStatus(caseId: string, status: MatterStatus): Promise<void> {
    if (!STATUSES.includes(status)) throw new Error(`Unknown status ${status}`)
    this.update(caseId, 'status = ?', status)
  }

  /**
   * Like merge_property_matter_facts (Postgres jsonb ||): top-level keys replace the same keys.
   * node:sqlite is synchronous, so this read-then-write cannot interleave with another call.
   */
  async mergeFacts(caseId: string, facts: Record<string, unknown>): Promise<Record<string, unknown>> {
    const row = this.db.prepare('SELECT facts FROM property_matters WHERE case_id = ?').get(caseId) as { facts: string } | undefined
    if (!row) throw new Error(`Property matter: no matter for case ${caseId}`)
    const merged = { ...JSON.parse(row.facts), ...facts }
    this.update(caseId, 'facts = ?', JSON.stringify(merged))
    return merged
  }

  async logEvent(caseId: string, kind: MatterEventKind, payload: Record<string, unknown> = {}): Promise<void> {
    if (!EVENT_KINDS.includes(kind)) throw new Error(`Unknown event kind ${kind}`)
    this.db.prepare('INSERT INTO property_matter_events (case_id, kind, payload) VALUES (?, ?, ?)').run(caseId, kind, JSON.stringify(payload))
  }

  async events(caseId: string, kind?: MatterEventKind): Promise<MatterEvent[]> {
    const rows = (kind
      ? this.db.prepare('SELECT kind, payload, created_at FROM property_matter_events WHERE case_id = ? AND kind = ? ORDER BY id').all(caseId, kind)
      : this.db.prepare('SELECT kind, payload, created_at FROM property_matter_events WHERE case_id = ? ORDER BY id').all(caseId)) as { kind: string; payload: string; created_at: string }[]
    return rows.map((r) => ({ kind: r.kind as MatterEventKind, payload: JSON.parse(r.payload), createdAt: r.created_at }))
  }
}
