// JSON.stringify doesn't escape `<`, so a raw </script> substring in any interpolated
// value would break out of the <script type="application/ld+json"> tag it's embedded in.
// Not currently exploitable (every JSON-LD field here is static/developer-controlled), but
// cheap to close off permanently rather than rely on that staying true.
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
