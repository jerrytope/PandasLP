'use client'

import { useState, useMemo } from 'react'
import { AGENTS, type AgentId } from '@/lib/agents'
import { formatNaira } from '@/lib/formatNaira'
import CaseCard from './CaseCard'
import {
  formatDate,
  STAGE_LABEL,
  STAGE_BADGE_STYLE,
  type AdminCaseRow,
  type CaseAction,
} from './types'
import {
  Search,
  Filter,
  Download,
  LayoutGrid,
  List,
  ExternalLink,
  ArrowUpDown,
  X,
  ShieldAlert,
} from 'lucide-react'

interface AdminCasesViewProps {
  cases: AdminCaseRow[]
  loading: boolean
  updatingId: string | null
  deletingId?: string | null
  confirmDeleteId?: string | null
  regeneratingId?: string | null
  togglingTestId?: string | null
  filterAgent: string
  filterTest: 'live' | 'test' | 'all'
  filterStatus: string
  deepLinkCaseId: string | null
  onAgentChange: (agentId: string) => void
  onTestFilterChange: (testFilter: 'live' | 'test' | 'all') => void
  onStatusChange: (status: string) => void
  onAction: (caseId: string, action: CaseAction, reviewChecklist?: Record<string, boolean>) => void
  onDeleteAction?: (caseId: string, action: 'request' | 'cancel' | 'confirm') => void
  onRegenerateDocument?: (caseId: string) => void
  onToggleTest?: (caseId: string, isTest: boolean) => void
  onOpenDrawer: (c: AdminCaseRow) => void
}

type SortOption = 'newest' | 'oldest' | 'amount_desc' | 'urgency'
type ViewMode = 'cards' | 'table'

export default function AdminCasesView({
  cases,
  loading,
  updatingId,
  deletingId,
  confirmDeleteId,
  regeneratingId,
  togglingTestId,
  filterAgent,
  filterTest,
  filterStatus,
  deepLinkCaseId,
  onAgentChange,
  onTestFilterChange,
  onStatusChange,
  onAction,
  onDeleteAction,
  onRegenerateDocument,
  onToggleTest,
  onOpenDrawer,
}: AdminCasesViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  // Multi-field Client-Side Search and Sorting
  const filteredAndSortedCases = useMemo(() => {
    let result = [...cases]

    // Universal text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((c) => {
        const caseNo = String(c.case_number || '')
        const title = (c.document_title || '').toLowerCase()
        const email = (c.userEmail || '').toLowerCase()
        const clientEmail = (c.client_email || '').toLowerCase()
        const phone = (c.client_phone || '').toLowerCase()
        const recipientPhone = (c.recipient_phone || '').toLowerCase()
        const id = c.id.toLowerCase()

        return (
          caseNo.includes(q) ||
          title.includes(q) ||
          email.includes(q) ||
          clientEmail.includes(q) ||
          phone.includes(q) ||
          recipientPhone.includes(q) ||
          id.includes(q)
        )
      })
    }

    // Sort
    result.sort((a, b) => {
      if (sortOption === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortOption === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      if (sortOption === 'amount_desc') {
        return (b.amount_paid || 0) - (a.amount_paid || 0)
      }
      if (sortOption === 'urgency') {
        // Cases paid but unserved come first, sorted by paid_at oldest
        if (a.status === 'paid' && b.status !== 'paid') return -1
        if (b.status === 'paid' && a.status !== 'paid') return 1
        return new Date(a.paid_at ?? a.created_at).getTime() - new Date(b.paid_at ?? b.created_at).getTime()
      }
      return 0
    })

    return result
  }, [cases, searchQuery, sortOption])

  // CSV Export
  function handleExportCsv() {
    if (filteredAndSortedCases.length === 0) return

    const headers = [
      'Case Number',
      'Document Title / Agent',
      'Status',
      'Is Test',
      'Client Account Email',
      'Client Delivery Email',
      'Client Phone',
      'Debtor Phone',
      'Amount Paid (NGN)',
      'Quoted Amount (NGN)',
      'Delivery Option',
      'Reviewed At',
      'Reviewed By',
      'Created Date',
    ]

    const rows = filteredAndSortedCases.map((c) => [
      c.case_number || c.id.slice(0, 8),
      `"${(c.document_title || AGENTS[c.agent_id as AgentId]?.name || c.agent_id).replace(/"/g, '""')}"`,
      c.status,
      c.is_test ? 'YES' : 'NO',
      c.userEmail || '',
      c.client_email || '',
      c.client_phone || '',
      c.recipient_phone || '',
      c.amount_paid || 0,
      c.expected_amount || '',
      c.delivery_option || '',
      c.reviewed_at ? new Date(c.reviewed_at).toISOString() : '',
      c.reviewed_by || '',
      new Date(c.created_at).toISOString(),
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `pandas-lp-cases-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Controls: Universal Search, Sort, View Toggle & CSV Export */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 320px', maxWidth: 480, position: 'relative' }}>
          <Search size={16} strokeWidth={1.8} style={{ position: 'absolute', left: 14, color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input
            className="input"
            placeholder="Search by case #, client email, phone, debtor phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 40, fontSize: 13, minHeight: 42 }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-3)',
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Right Tools: Sort, View mode, CSV Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowUpDown size={14} style={{ color: 'var(--text-3)' }} />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--text-1)',
                cursor: 'pointer',
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount_desc">Highest Value</option>
              <option value="urgency">Urgency / Unserved First</option>
            </select>
          </div>

          {/* View Toggle (Cards vs Table) */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-1)',
              padding: 3,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              className="btn btn-sm"
              style={{
                padding: '6px 10px',
                minHeight: 30,
                background: viewMode === 'cards' ? 'var(--bg-2)' : 'transparent',
                borderColor: viewMode === 'cards' ? 'var(--border-subtle)' : 'transparent',
                boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
              onClick={() => setViewMode('cards')}
              title="Card View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                padding: '6px 10px',
                minHeight: 30,
                background: viewMode === 'table' ? 'var(--bg-2)' : 'transparent',
                borderColor: viewMode === 'table' ? 'var(--border-subtle)' : 'transparent',
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
              onClick={() => setViewMode('table')}
              title="Table Spreadsheet View"
            >
              <List size={14} />
            </button>
          </div>

          {/* Export to CSV */}
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleExportCsv}
            disabled={filteredAndSortedCases.length === 0}
            title="Download CSV spreadsheet of current matters"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Section: Agent, Test/Live, and Status Pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: 'var(--bg-1)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
        {/* Agent Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginRight: 4 }}>Agent:</span>
          {[{ id: '', name: 'All Practice Areas' }, ...Object.values(AGENTS)].map((a) => (
            <button
              key={a.id}
              type="button"
              className={`btn btn-sm ${filterAgent === a.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                minHeight: 28,
              }}
              onClick={() => onAgentChange(a.id)}
            >
              {a.name}
            </button>
          ))}
        </div>

        {/* Live vs Test Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginRight: 4 }}>Scope:</span>
          {([
            { value: 'live', label: 'Live Matters Only' },
            { value: 'test', label: 'Test Leads Only' },
            { value: 'all', label: 'All (Live + Test)' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`btn btn-sm ${filterTest === opt.value ? '' : 'btn-ghost'}`}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                minHeight: 28,
                background: filterTest === opt.value ? 'var(--secondary)' : 'transparent',
                color: filterTest === opt.value ? 'white' : 'inherit',
              }}
              onClick={() => onTestFilterChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status Lifecycle Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginRight: 4 }}>Status:</span>
          {[
            { value: '', label: 'All Statuses' },
            { value: 'paid_plus', label: 'Paid+ (Real Clients)' },
            { value: 'has_document', label: 'Has Letter Generated' },
            ...Object.entries(STAGE_LABEL).map(([k, v]) => ({ value: k, label: v })),
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`btn btn-sm ${filterStatus === opt.value ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                minHeight: 28,
              }}
              onClick={() => onStatusChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Case Count Summary */}
      <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          Showing <strong>{filteredAndSortedCases.length}</strong> matter{filteredAndSortedCases.length !== 1 ? 's' : ''}
          {searchQuery ? ` matching "${searchQuery}"` : ''}
        </span>
      </div>

      {/* Loading state */}
      {loading && <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: '32px 0' }}>Loading cases…</p>}

      {/* Empty State */}
      {!loading && filteredAndSortedCases.length === 0 && (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
          <Filter size={32} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>No matching cases found</div>
          <p style={{ fontSize: 13, marginTop: 4 }}>Try clearing or adjusting your search query or filters.</p>
        </div>
      )}

      {/* Content: Card View */}
      {!loading && viewMode === 'cards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredAndSortedCases.map((c) => (
            <CaseCard
              key={c.id}
              c={c}
              updatingId={updatingId}
              deletingId={deletingId}
              confirmDeleteId={confirmDeleteId}
              regeneratingId={regeneratingId}
              togglingTestId={togglingTestId}
              onAction={onAction}
              onDeleteAction={onDeleteAction}
              onRegenerateDocument={onRegenerateDocument}
              onToggleTest={onToggleTest}
              onOpenDrawer={onOpenDrawer}
              domId={`case-${c.id}`}
              accentColor={c.id === deepLinkCaseId ? 'var(--accent)' : undefined}
            />
          ))}
        </div>
      )}

      {/* Content: Compact Table / Spreadsheet View */}
      {!loading && viewMode === 'table' && filteredAndSortedCases.length > 0 && (
        <div
          className="card"
          style={{
            padding: 0,
            overflowX: 'auto',
            background: 'var(--bg-2)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-2)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>#</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Matter / Document</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Client</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Paid</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedCases.map((c) => {
                const badgeStyle = STAGE_BADGE_STYLE[c.status] ?? STAGE_BADGE_STYLE.draft
                return (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s',
                    }}
                    className="table-row-hover"
                  >
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)' }}>
                      #{c.case_number || c.id.slice(0, 6)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div
                        onClick={() => onOpenDrawer(c)}
                        style={{ fontWeight: 600, color: 'var(--text-1)', cursor: 'pointer' }}
                        className="case-title-link"
                      >
                        {c.document_title ?? AGENTS[c.agent_id as AgentId]?.name ?? c.agent_id}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {AGENTS[c.agent_id as AgentId]?.name ?? c.agent_id}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div>{c.client_email || c.userEmail || '—'}</div>
                      {c.client_phone && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.client_phone}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        className="badge"
                        style={{
                          background: badgeStyle.bg,
                          color: badgeStyle.color,
                          borderColor: badgeStyle.border,
                        }}
                      >
                        {STAGE_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: c.amount_paid > 0 ? '#16a34a' : 'inherit' }}>
                      {formatNaira(c.amount_paid)}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-3)', fontSize: 12 }}>
                      {formatDate(c.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => onOpenDrawer(c)}
                      >
                        Open <ExternalLink size={12} style={{ marginLeft: 4 }} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
