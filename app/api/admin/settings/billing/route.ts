export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { loadBillingSettings } from '@/lib/billing'

// The firm's billing settings: bank details printed on invoices, VAT, payment terms, and the
// naira/dollar rate the finance dashboard uses to show AI cost in naira. One row (id = 1).
export async function GET(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  return Response.json({ settings: await loadBillingSettings() })
}

function cleanText(v: unknown, max = 120): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

export async function PUT(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-billing-settings:${getClientIp(req)}`, 20, 10 * 60 * 1000)
  if (!allowed) {
    return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  }
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const accountNumber = cleanText(body.bankAccountNumber, 20)
  // Nigerian bank accounts (NUBAN) are exactly ten digits.
  if (accountNumber && !/^\d{10}$/.test(accountNumber)) {
    return Response.json({ error: 'The account number must be 10 digits.' }, { status: 400 })
  }
  const vatRate = Number(body.vatRate ?? 0)
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
    return Response.json({ error: 'VAT must be between 0 and 100 per cent.' }, { status: 400 })
  }
  const terms = Number(body.paymentTermsDays ?? 7)
  if (!Number.isInteger(terms) || terms < 0 || terms > 365) {
    return Response.json({ error: 'Payment terms must be a whole number of days, 0 to 365.' }, { status: 400 })
  }
  let fx: number | null = null
  if (body.usdNgnRate !== undefined && body.usdNgnRate !== null && body.usdNgnRate !== '') {
    fx = Number(body.usdNgnRate)
    if (!Number.isFinite(fx) || fx <= 0) {
      return Response.json({ error: 'The naira/dollar rate must be a positive number.' }, { status: 400 })
    }
  }

  const { error } = await supabaseAdmin.from('firm_settings').upsert({
    id: 1,
    bank_account_name: cleanText(body.bankAccountName),
    bank_account_number: accountNumber,
    bank_name: cleanText(body.bankName),
    vat_rate: Math.round(vatRate * 100) / 100,
    tax_id: cleanText(body.taxId, 40),
    payment_terms_days: terms,
    usd_ngn_rate: fx,
    updated_at: new Date().toISOString(),
    updated_by: authResult.user.email ?? 'unknown',
  })
  if (error) {
    console.error('Failed to save billing settings:', error)
    return Response.json({ error: `Could not save the settings. (${error.message})` }, { status: 500 })
  }
  return Response.json({ ok: true, settings: await loadBillingSettings() })
}
