import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// A tiny stand-in for the payment_references table: a set of used references, with
// Postgres's unique-violation code on a duplicate insert.
const used = new Set<string>()
vi.mock('../supabaseAdmin', () => ({
  supabaseAdmin: {
    from: () => ({
      insert: async (row: { reference: string }) => {
        if (used.has(row.reference)) return { error: { code: '23505', message: 'duplicate key' } }
        used.add(row.reference)
        return { error: null }
      },
    }),
  },
}))

import { verifyPayment, claimPaymentReference } from '../paystackVerify'

function paystackReplies(data: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: true, data }), { status: 200 })))
}

describe('verifyPayment', () => {
  beforeEach(() => {
    delete process.env.VERCEL_ENV
    delete process.env.ALLOW_STUB_PAYMENTS
  })
  afterEach(() => vi.unstubAllGlobals())

  describe('with a real Paystack key', () => {
    beforeEach(() => {
      process.env.PAYSTACK_SECRET_KEY = 'sk_test_real'
    })

    it('accepts a successful payment of the expected amount, using Paystack’s figure', async () => {
      paystackReplies({ status: 'success', amount: 1_000_000, reference: 'ref-1', currency: 'NGN' })
      const result = await verifyPayment({ reference: 'ref-1', expectedAmount: 10000, clientAmount: 1, stub: false })
      expect(result).toEqual({ ok: true, amount: 10000, reference: 'ref-1' })
    })

    it('ignores the browser’s amount and rejects an underpayment', async () => {
      paystackReplies({ status: 'success', amount: 10_000, reference: 'ref-2', currency: 'NGN' }) // ₦100
      const result = await verifyPayment({ reference: 'ref-2', expectedAmount: 10000, clientAmount: 10000 })
      expect(result.ok).toBe(false)
    })

    it('rejects a payment Paystack reports as failed', async () => {
      paystackReplies({ status: 'failed', amount: 1_000_000, reference: 'ref-3' })
      expect(await verifyPayment({ reference: 'ref-3', expectedAmount: 10000 })).toMatchObject({ ok: false, status: 402 })
    })

    it('ignores a stub flag sent by the browser', async () => {
      paystackReplies({ status: 'failed', amount: 0, reference: 'fake' })
      const result = await verifyPayment({ reference: 'fake', expectedAmount: 10000, clientAmount: 10000, stub: true })
      expect(result.ok).toBe(false)
    })
  })

  describe('without a Paystack key (stub mode)', () => {
    beforeEach(() => {
      process.env.PAYSTACK_SECRET_KEY = 'sk_placeholder'
    })

    it('accepts the stub checkout outside production', async () => {
      expect(await verifyPayment({ reference: 's-1', expectedAmount: 10000, clientAmount: 10000, stub: true })).toEqual({
        ok: true,
        amount: 10000,
        reference: 's-1',
      })
    })

    it('still enforces the expected amount', async () => {
      expect((await verifyPayment({ reference: 's-2', expectedAmount: 10000, clientAmount: 100, stub: true })).ok).toBe(false)
    })

    it('refuses stub payments in real production unless explicitly allowed', async () => {
      process.env.VERCEL_ENV = 'production'
      expect(await verifyPayment({ reference: 's-3', expectedAmount: 10000, clientAmount: 10000, stub: true })).toMatchObject({
        ok: false,
        status: 503,
      })
    })
  })
})

describe('claimPaymentReference', () => {
  beforeEach(() => used.clear())

  it('lets a reference pay for one thing only, across flows', async () => {
    expect(await claimPaymentReference('ref-x', 'case', 25000, 'case-1')).toEqual({ ok: true })
    expect(await claimPaymentReference('ref-x', 'case', 25000, 'case-2')).toMatchObject({ ok: false, status: 409 })
    expect(await claimPaymentReference('ref-x', 'custom_claim', 25000, null)).toMatchObject({ ok: false, status: 409 })
  })
})
