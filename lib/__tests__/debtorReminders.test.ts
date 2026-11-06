import { describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  buildDebtorReminderMessage,
  getReceiptDate,
  reminderRows,
  type DebtorReminderRecord,
} from '@/lib/debtorReminders'

describe('debtor reminder schedule', () => {
  it('uses calendar days and marks only the latest due reminder actionable', () => {
    expect(addCalendarDays('2026-10-01', 14)).toBe('2026-10-15')
    const rows = reminderRows('2026-10-01', [], '2026-10-12')
    expect(rows.find((row) => row.key === 'day7')?.state).toBe('passed')
    expect(rows.find((row) => row.key === 'day10')?.state).toBe('due')
    expect(rows.find((row) => row.key === 'day14')?.state).toBe('upcoming')
  })

  it('keeps prepared reminders distinct from actually sent reminders', () => {
    const records: DebtorReminderRecord[] = [{
      reminder_key: 'day7',
      status: 'prepared',
      prepared_at: '2026-10-08T10:00:00.000Z',
      sent_at: null,
      sent_by: 'staff@example.com',
      channel: 'whatsapp',
      message: 'Draft',
    }]
    expect(reminderRows('2026-10-01', records, '2026-10-08')[0].state).toBe('prepared')
    records[0].status = 'sent'
    records[0].sent_at = '2026-10-08T10:10:00.000Z'
    expect(reminderRows('2026-10-01', records, '2026-10-08')[0].state).toBe('sent')
  })

  it('prefers staff-confirmed receipt date over inferred service dates', () => {
    expect(getReceiptDate({
      enteredDate: '2026-10-03',
      deadlineAt: null,
      serviceRecords: [{ dispatched_at: '2026-10-01T10:00:00Z', link_opened_at: '2026-10-02T10:00:00Z' }],
    })).toEqual({ date: '2026-10-03', source: 'entered' })
  })

  it('uses an opened or acknowledged service record, never dispatch alone, as receipt evidence', () => {
    expect(getReceiptDate({
      enteredDate: null,
      deadlineAt: null,
      serviceRecords: [{ dispatched_at: '2026-10-01T10:00:00Z', link_opened_at: null }],
    })).toBeNull()
    expect(getReceiptDate({
      enteredDate: null,
      deadlineAt: null,
      serviceRecords: [{ dispatched_at: '2026-10-01T10:00:00Z', link_opened_at: '2026-10-02T10:00:00Z' }],
    })).toMatchObject({ date: '2026-10-02', source: 'link_opened' })
  })

  it('builds a reminder without inventing party details', () => {
    const message = buildDebtorReminderMessage({ key: 'day14', received: '2026-10-01', caseReference: 'PLP/2026/000001' })
    expect(message).toContain('Dear Sir/Madam')
    expect(message).toContain('PLP/2026/000001')
    expect(message).toContain('2026-10-15')
  })
})
