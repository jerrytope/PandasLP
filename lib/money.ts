// Money for invoices and the finance dashboard. Amounts are held in KOBO as integers so that
// VAT and part-payments never produce floating-point drift (7.5% of ₦33,333 is a fraction of a
// naira). The older case columns (cases.amount_paid, recoveries.amount_recovered) are whole
// naira; convert those with nairaToKobo before mixing them with invoice amounts.

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100)
}

export function koboToNaira(kobo: number): number {
  return kobo / 100
}

/** Parses what a person types in an amount box ("50,000", "₦50000.50", "50 000") into kobo. */
export function parseNairaInput(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, '').replace(/^NGN/i, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return nairaToKobo(Number(cleaned))
}

/** ₦50,000.00 — or 50,000.00 with symbol: false (for table columns headed "Amount (₦)"). */
export function formatKobo(kobo: number, { symbol = true, decimals = 2 }: { symbol?: boolean; decimals?: number } = {}): string {
  const n = (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return symbol ? `₦${n}` : n
}

/** VAT on a subtotal at a percentage rate (7.5 → 7.5%), rounded to the nearest kobo. */
export function vatOn(subtotalKobo: number, ratePercent: number): number {
  return Math.round((subtotalKobo * ratePercent) / 100)
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion']

function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`)
  if (rest) {
    const words = rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ''}`
    parts.push(hundreds ? `and ${words}` : words)
  }
  return parts.join(' ')
}

/** 3300000 → "Three Million, Three Hundred Thousand" — the style the firm's letters use. */
export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error('numberToWords expects a non-negative integer')
  if (n === 0) return 'Zero'
  const groups: string[] = []
  let scale = 0
  let rest = n
  while (rest > 0) {
    const chunk = rest % 1000
    if (chunk) groups.unshift(`${underThousand(chunk)}${SCALES[scale] ? ` ${SCALES[scale]}` : ''}`)
    rest = Math.floor(rest / 1000)
    scale++
    if (scale >= SCALES.length && rest > 0) throw new Error('Amount too large to write in words')
  }
  return groups.join(', ')
}

/** 5000000 kobo → "Fifty Thousand Naira Only"; 5000050 → "Fifty Thousand Naira and Fifty Kobo Only". */
export function amountInWords(kobo: number): string {
  const naira = Math.floor(kobo / 100)
  const k = kobo % 100
  const nairaPart = `${numberToWords(naira)} Naira`
  return k ? `${nairaPart} and ${numberToWords(k)} Kobo Only` : `${nairaPart} Only`
}
