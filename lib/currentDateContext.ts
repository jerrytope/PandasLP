// The model has no clock of its own — without being told the real date, it can only guess
// "today" from training-data patterns, which is how a drafted document, a notice period, or a
// relative reference like "last year" ends up dated wrong. This builds the system-prompt block
// that tells it the actual current date on every request. Takes `now` as a parameter (rather
// than calling `new Date()` internally) purely so tests can pass a fixed date.
export function buildCurrentDateContext(now: Date): string {
  const todayFormatted = now.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Lagos',
  })
  return `CURRENT DATE: Today is ${todayFormatted} (Africa/Lagos time). Use this as "today" for every date calculation — notice periods, statutory deadlines, "X months/years from today", and any relative reference the client makes ("last year", "6 months ago", "next quarter"). When a document needs today's date and the client hasn't given a different one, use this date. Never default to an earlier year from habit or training data — this is the real, current date, and it changes on every request.`
}
