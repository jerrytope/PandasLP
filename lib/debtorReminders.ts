export const DEBTOR_REMINDERS = [
  { key: 'day7', day: 7, label: 'Day 7 reminder' },
  { key: 'day10', day: 10, label: 'Day 10 notice' },
  { key: 'day14', day: 14, label: 'Day 14 final day' },
  { key: 'day15', day: 15, label: 'Day 15 filing notice' },
] as const

export const RESPONSE_DAYS = 14

export type DebtorReminderKey = (typeof DEBTOR_REMINDERS)[number]['key']
export type DebtorReminderState = 'sent' | 'prepared' | 'due' | 'upcoming' | 'passed'

export interface DebtorReminderRecord {
  reminder_key: DebtorReminderKey
  status: 'prepared' | 'sent'
  prepared_at: string
  sent_at: string | null
  sent_by: string | null
  channel: 'whatsapp' | 'other'
  message: string
}

export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function getReceiptDate(input: {
  enteredDate: string | null
  deadlineAt: string | null
  serviceRecords: { dispatched_at: string; link_opened_at: string | null; acknowledged_at?: string | null; negotiation_id?: string | null }[]
}): { date: string; source: 'entered' | 'link_opened' | 'acknowledged' | 'marked_served' } | null {
  if (input.enteredDate) return { date: input.enteredDate.slice(0, 10), source: 'entered' }
  const records = input.serviceRecords.filter((row) => !row.negotiation_id)
  const opened = records.map((row) => row.link_opened_at).filter((value): value is string => Boolean(value)).sort()[0]
  if (opened) return { date: lagosToday(new Date(opened)), source: 'link_opened' }
  const acknowledged = records.map((row) => row.acknowledged_at).filter((value): value is string => Boolean(value)).sort()[0]
  if (acknowledged) return { date: lagosToday(new Date(acknowledged)), source: 'acknowledged' }
  if (input.deadlineAt) {
    const deadline = new Date(input.deadlineAt)
    return { date: addCalendarDays(lagosToday(deadline), -14), source: 'marked_served' }
  }
  return null
}

export function reminderRows(received: string, sent: DebtorReminderRecord[], today = lagosToday()) {
  const sentByKey = new Map(sent.map((record) => [record.reminder_key, record]))
  const latestDue = [...DEBTOR_REMINDERS].reverse().find((item) => item.key !== 'day15' && addCalendarDays(received, item.day) <= today)
  return DEBTOR_REMINDERS.map((item) => {
    const record = sentByKey.get(item.key)
    const due = addCalendarDays(received, item.day)
    const state: DebtorReminderState = record?.status === 'sent'
      ? 'sent'
      : record
        ? 'prepared'
      : due > today
        ? 'upcoming'
        : item.key === 'day15'
          ? 'due'
          : latestDue?.key === item.key && today <= addCalendarDays(received, 14)
            ? 'due'
            : 'passed'
    return { ...item, due, state, record: record ?? null }
  })
}

export function buildDebtorReminderMessage(input: {
  key: DebtorReminderKey
  received: string
  caseReference: string
  debtorName?: string | null
  clientName?: string | null
  documentTitle?: string | null
}): string {
  const dueDate = addCalendarDays(input.received, 14)
  const greeting = input.debtorName ? `Dear ${input.debtorName},` : 'Dear Sir/Madam,'
  const client = input.clientName ? ` for ${input.clientName}` : ''
  const matter = input.documentTitle ? ` concerning ${input.documentTitle}` : ''
  const heading = `Re: Demand letter ${input.caseReference}${matter}`
  const base = `${greeting}\n\n${heading}\n\nWe refer to the demand letter received on ${input.received}, sent on behalf of our client${client}.`

  if (input.key === 'day7') {
    return `${base}\n\nThis is a reminder that seven days have passed since receipt. The response period ends on ${dueDate}. Please contact us to confirm your response or discuss settlement.\n\nPandas Legal Practitioners`
  }
  if (input.key === 'day10') {
    return `${base}\n\nTen days have passed since receipt and we have not recorded payment or a response. The response period ends on ${dueDate}. If the matter remains unresolved after that date, our client may consider the next steps available to them, including court proceedings.\n\nPandas Legal Practitioners`
  }
  if (input.key === 'day14') {
    return `${base}\n\nToday, ${dueDate}, is the final day of the response period stated in the letter. Please contact us promptly if you have paid or wish to discuss the matter.\n\nPandas Legal Practitioners`
  }
  return `${base}\n\nThe fourteen-day response period ended on ${dueDate}. As the matter remains unresolved, our client is considering the next steps available, which may include preparing a claim for filing. Please contact us promptly if you have paid or wish to discuss the matter.\n\nPandas Legal Practitioners`
}
import { lagosToday } from './negotiationStatus'
