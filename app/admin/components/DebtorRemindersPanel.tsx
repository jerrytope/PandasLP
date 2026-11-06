'use client'

import { useCallback, useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import type { DebtorReminderKey, DebtorReminderState } from '@/lib/debtorReminders'

interface ReminderRow {
  key: DebtorReminderKey
  day: number
  label: string
  due: string
  state: DebtorReminderState
  message: string
  record: { status: 'prepared' | 'sent'; prepared_at: string; sent_at: string | null; sent_by: string | null; channel: string } | null
}

interface Schedule {
  receipt: { date: string; source: string } | null
  deadline: string | null
  rows: ReminderRow[]
  phone: string | null
}

const stateLabels: Record<DebtorReminderState, string> = {
  sent: 'Sent',
  prepared: 'Prepared; confirm after sending',
  due: 'Due now',
  upcoming: 'Upcoming',
  passed: 'Earlier notice not sent',
}

export default function DebtorRemindersPanel({ caseId }: { caseId: string }) {
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [messageByKey, setMessageByKey] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [receiptDate, setReceiptDate] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await authedFetch(`/api/admin/debtor-reminders?caseId=${encodeURIComponent(caseId)}`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not load debtor reminders.')
      setSchedule(json)
      setReceiptDate(json.receipt?.date ?? '')
      setMessageByKey(Object.fromEntries((json.rows ?? []).map((row: ReminderRow) => [row.key, row.message])))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load debtor reminders.')
    }
  }, [caseId])

  useEffect(() => {
    void load()
  }, [load])

  async function saveReceiptDate(value: string | null) {
    setBusy('date')
    setError('')
    try {
      const response = await authedFetch('/api/admin/debtor-reminders', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, receivedOn: value }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not save receipt date.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save receipt date.')
    } finally {
      setBusy('')
    }
  }

  async function prepare(row: ReminderRow, channel: 'whatsapp' | 'other') {
    const message = messageByKey[row.key] ?? row.message
    const popup = channel === 'whatsapp' ? window.open('about:blank', '_blank') : null
    setBusy(row.key)
    setError('')
    try {
      const response = await authedFetch('/api/admin/debtor-reminders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, key: row.key, channel, message }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not record reminder.')
      if (popup && json.whatsappLink) popup.location.href = json.whatsappLink
      else popup?.close()
      if (channel === 'other') await navigator.clipboard.writeText(message)
      await load()
    } catch (err) {
      popup?.close()
      setError(err instanceof Error ? err.message : 'Could not prepare reminder.')
    } finally {
      setBusy('')
    }
  }

  async function confirmSent(key: DebtorReminderKey) {
    setBusy(key)
    setError('')
    try {
      const response = await authedFetch('/api/admin/debtor-reminders', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, reminderKey: key }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not confirm reminder.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm reminder.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="card" style={{ padding: 16, marginTop: 18 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Debtor reminders</h3>
      <p style={{ margin: '0 0 12px', color: 'var(--text-2)', fontSize: 12.5 }}>
        Confirm when the debtor received the demand letter. Suggested messages should be reviewed before sending.
      </p>
      {error && <p role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
      {!schedule ? (
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading reminder schedule…</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <label htmlFor={`received-on-${caseId}`}>Debtor received letter:</label>
            <input id={`received-on-${caseId}`} className="input" type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} style={{ width: 'auto' }} />
            <button type="button" className="btn btn-sm" disabled={busy === 'date' || !receiptDate || receiptDate === schedule.receipt?.date} onClick={() => void saveReceiptDate(receiptDate)}>Save date</button>
            {schedule.receipt?.source === 'entered' && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy === 'date'} onClick={() => { setReceiptDate(''); void saveReceiptDate(null) }}>Use service record</button>
            )}
          </div>
          {!schedule.receipt ? (
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 10 }}>No service date is recorded yet. Enter the receipt date to start the schedule.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {schedule.rows.map((row) => (
                <details key={row.key} className="card" style={{ padding: 12, background: 'var(--bg-1)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    {row.label} · {stateLabels[row.state]} · {row.due}
                  </summary>
                  {row.record && <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{row.record.status === 'sent' ? `Marked sent ${row.record.sent_at ? new Date(row.record.sent_at).toLocaleString() : ''}` : `Prepared ${new Date(row.record.prepared_at).toLocaleString()}`} by {row.record.sent_by || 'staff'} via {row.record.channel}.</p>}
                  {row.record?.status === 'prepared' && (
                    <button type="button" className="btn btn-sm btn-primary" disabled={Boolean(busy)} onClick={() => void confirmSent(row.key)}>
                      {busy === row.key ? 'Saving…' : 'Confirm actually sent'}
                    </button>
                  )}
                  {!row.record && (
                    <>
                      <textarea
                        aria-label={`${row.label} message`}
                        className="input"
                        value={messageByKey[row.key] ?? row.message}
                        onChange={(event) => setMessageByKey((current) => ({ ...current, [row.key]: event.target.value }))}
                        rows={5}
                        style={{ width: '100%', resize: 'vertical', marginTop: 8 }}
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {row.state === 'due' && schedule.phone && (
                          <button type="button" className="btn btn-sm btn-primary" disabled={Boolean(busy)} onClick={() => void prepare(row, 'whatsapp')}>
                            {busy === row.key ? 'Opening…' : 'Record and open WhatsApp'}
                          </button>
                        )}
                        {row.state === 'due' && (
                          <button type="button" className="btn btn-sm" disabled={Boolean(busy)} onClick={() => void prepare(row, 'other')}>
                            Prepare and copy message
                          </button>
                        )}
                        {!schedule.phone && row.state === 'due' && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Add the debtor phone number to use WhatsApp.</span>}
                      </div>
                    </>
                  )}
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
