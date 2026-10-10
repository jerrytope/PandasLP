import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BRAND_CASE_STATUS_LABELS } from "@/lib/brandSheet";
import { RETRY_DELAYS_MINUTES } from "@/lib/brandWebhookFormat";

// The brand API's documentation for the brand's developers (phase 5C of
// plans/phase-5-api-intake.md). The machine-readable version is /api/v1/openapi.json
// (lib/brandApiSpec.ts); this page is the same API explained for people, with examples.

export const metadata: Metadata = {
  title: "Brand API documentation",
  description:
    "Send borrowers to Pandas LP by API, receive status webhooks, and download approved letters of demand.",
  alternates: { canonical: "/developers/api" },
  robots: { index: false, follow: false },
};

const BASE = "https://pandaslp.com.ng/api/v1";

const STATUS_MEANING: Record<string, string> = {
  new: "Accepted and queued for drafting.",
  checking: "Being checked and drafted right now.",
  missing_documents:
    "Something is missing or wrong. `missing` says exactly what; resend the loan or add a note.",
  letter_drafted: "Drafted, waiting for a lawyer.",
  lawyer_approved: "A lawyer approved the letter. You can download it.",
  served: "Served on the borrower. The 14-day response period has started.",
  day7_sent: "Day 7 reminder sent to the borrower (you are copied).",
  day14_sent:
    "Day 14 reminder sent. After this we need your decision: court or close.",
  paid: "The borrower paid.",
  disputed: "The borrower disputes the debt.",
  closed: "Closed.",
};

function Code({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        padding: "14px 16px",
        overflowX: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        lineHeight: 1.55,
        margin: "12px 0 20px",
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginTop: 36 }}>
      <h3
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 16,
          display: "flex",
          gap: 10,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "var(--accent)", fontWeight: 700 }}>
          {method}
        </span>
        <span style={{ overflowWrap: "anywhere" }}>{path}</span>
      </h3>
      {children}
    </section>
  );
}

export default function BrandApiDocsPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <header className="navbar" role="banner">
        <div className="container navbar-inner">
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            Pandas <span className="accent">LP</span>
          </Link>
          <a
            href="/api/v1/openapi.json"
            className="btn btn-ghost"
            style={{ fontSize: 14 }}
          >
            OpenAPI (JSON)
          </a>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 64, paddingBottom: 96 }}>
        <article style={{ maxWidth: 760, margin: "0 auto" }}>
          <span className="label-mono">For developers</span>
          <h1
            style={{
              margin: "8px 0 12px",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px,4.5vw,44px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.12,
            }}
          >
            Brand API
          </h1>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: 16,
              marginBottom: 40,
            }}
          >
            Send us borrowers, and we handle the rest: a letter of demand
            approved by a lawyer, served, and followed up on Day 7 and Day 14.
            We tell your system each step, and you can download the letter once
            it’s approved.
          </p>

          <div className="blog-content">
            <h2>1. Keys</h2>
            <p>
              Pandas LP gives you two keys. Send one on every call as{" "}
              <code>Authorization: Bearer &lt;key&gt;</code>. Keep them secret;
              if one leaks, ask us to revoke it and issue a new one.
            </p>
            <ul>
              <li>
                <strong>Test key</strong> (<code>plp_test_…</code>): for
                building your integration. Nothing real happens (see Test mode).
              </li>
              <li>
                <strong>Live key</strong> (<code>plp_live_…</code>): real
                letters, served on real borrowers, billed monthly. Issued once
                your integration has passed with the test key.
              </li>
            </ul>
            <p>
              Each key sees only its own borrowers. Limit: 60 calls a minute per
              key (above that you get <code>429</code> with a{" "}
              <code>Retry-After</code> header). Errors always look like{" "}
              <code>{'{ "error": { "code": "…", "message": "…" } }'}</code>.
            </p>

            <h2>2. Send a borrower</h2>
            <Endpoint method="POST" path="/borrowers">
              <p>
                The same fields as our Google Sheet, plus your own{" "}
                <code>loan_id</code>. Documents (the loan agreement and/or
                statement) are PDF, JPG or PNG, under 1 MB in total per
                borrower, each either inside the JSON as base64 or as an https
                link we download once.
              </p>
              <Code>{`curl -X POST ${BASE}/borrowers \\
  -H "Authorization: Bearer plp_test_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "loan_id": "LN-2026-0042",
    "borrower_full_name": "Adebayo Ogunleye",
    "phone_number": "08031234567",
    "email": "adebayo@example.com",
    "address_for_service": "12 Isokan Street, Olosan, Ibadan, Oyo State",
    "loan_amount": 500000,
    "amount_outstanding": 380000,
    "loan_date": "2026-03-15",
    "last_payment_date": "2026-06-01",
    "notes": "Promised to pay in July; has not.",
    "documents": [
      { "filename": "loan-agreement.pdf", "content_base64": "JVBERi0xLjQK..." },
      { "filename": "statement.pdf", "url": "https://files.example.ng/LN-2026-0042.pdf" }
    ]
  }'`}</Code>
              <p>
                Every borrower is checked straight away, and the answer comes
                back in the same response:
              </p>
              <Code>{`{
  "test": true,
  "results": [
    { "loan_id": "LN-2026-0042", "case_id": "ACME-0004", "status": "new" }
  ]
}`}</Code>
              <ul>
                <li>
                  <code>status: "new"</code>: accepted and queued. Keep our{" "}
                  <code>case_id</code>, or keep using your <code>loan_id</code>.
                </li>
                <li>
                  <code>status: "missing_documents"</code> with{" "}
                  <code>missing</code>: exactly what to fix. Resend the loan
                  with the fix, or add a note.
                </li>
                <li>
                  <code>error</code>: the borrower couldn’t be accepted at all
                  (an unknown field, no <code>loan_id</code>…). Fix and resend.
                </li>
              </ul>
              <p>
                <strong>Several at once:</strong> send{" "}
                <code>{'{ "borrowers": [ … ] }'}</code> with up to 50. Keep each
                request under 5 MB: with documents inside the JSON that’s about
                3 borrowers per call; with links, up to 50. Each borrower gets
                its own result, in the order sent.
              </p>
              <p>
                <strong>Never twice:</strong> sending the same{" "}
                <code>loan_id</code> again (a retry, say) returns the same case
                with <code>duplicate: true</code>. Before we start on a
                borrower, a resend with changed details corrects it (
                <code>updated: true</code>). After we’ve started, changes aren’t
                applied: they come back in <code>flagged</code> and our staff
                decide. Send updates as notes instead.
              </p>
            </Endpoint>

            <h2>3. Check a borrower</h2>
            <Endpoint method="GET" path="/borrowers/{case_id or loan_id}">
              <Code>{`curl ${BASE}/borrowers/LN-2026-0042 -H "Authorization: Bearer plp_test_..."`}</Code>
              <Code>{`{
  "case_id": "ACME-0004", "loan_id": "LN-2026-0042", "status": "served", "test": true,
  "missing": [], "letter_available": true,
  "served_at": "2026-10-12T09:30:00.000Z", "day7_sent_at": null, "day14_sent_at": null,
  "awaiting_decision_since": null, "created_at": "…", "updated_at": "…"
}`}</Code>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(BRAND_CASE_STATUS_LABELS).map((s) => (
                      <tr key={s}>
                        <td>
                          <code>{s}</code>
                        </td>
                        <td>{STATUS_MEANING[s]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Endpoint>

            <h2>4. Download the letter</h2>
            <Endpoint method="GET" path="/borrowers/{id}/letter">
              <p>
                A PDF, available once a lawyer has approved the letter (before
                that: <code>409 letter_not_available</code>). Before serving
                it’s the approved letter; once served, it’s the stamped copy
                that was served. Two headers tell you which you have:{" "}
                <code>X-Letter-Version</code> (<code>approved</code> or{" "}
                <code>served</code>) and <code>X-Letter-Stamped</code> (
                <code>yes</code> or <code>no</code>).
              </p>
              <Code>{`curl -OJ ${BASE}/borrowers/ACME-0004/letter -H "Authorization: Bearer plp_live_..."`}</Code>
            </Endpoint>

            <h2>5. Add a note</h2>
            <Endpoint method="POST" path="/borrowers/{id}/notes">
              <p>
                Notes are added with the date, never replaced. Before we start
                on a borrower, a note becomes part of their details, and a
                borrower in Missing Documents is checked again. After that it
                goes to our staff (for example: “the borrower called and paid
                half”).
              </p>
              <Code>{`curl -X POST ${BASE}/borrowers/LN-2026-0043/notes \\
  -H "Authorization: Bearer plp_live_..." -H "Content-Type: application/json" \\
  -d '{ "note": "Correct email is adebayo.o@example.com" }'

{ "case_id": "ACME-0005", "status": "new", "reopened": true, "used_for_letter": true }`}</Code>
            </Endpoint>

            <h2>6. Updates to your system (webhooks)</h2>
            <p>
              Give us one https address for live borrowers and one for test
              borrowers. We send a signed <code>POST</code> each time a borrower
              moves on:
            </p>
            <ul>
              <li>
                <code>borrower.missing_documents</code>: with{" "}
                <code>missing</code>
              </li>
              <li>
                <code>borrower.letter_drafted</code>
              </li>
              <li>
                <code>borrower.lawyer_approved</code>: the letter can be
                downloaded (<code>letter_url</code>)
              </li>
              <li>
                <code>borrower.served</code>: with <code>served_at</code>
              </li>
              <li>
                <code>borrower.day7_sent</code> and{" "}
                <code>borrower.day14_sent</code>
              </li>
              <li>
                <code>borrower.awaiting_decision</code>: Day 14 has passed; we
                need your decision (court or close)
              </li>
              <li>
                <code>borrower.outcome</code>: <code>paid</code>,{" "}
                <code>disputed</code> or <code>closed</code>
              </li>
            </ul>
            <Code>{`POST https://your-system.example/pandas-webhooks
X-PandasLP-Event: borrower.served
X-PandasLP-Delivery: 6f1c2c1e-6a43-4bd5-9a0e-0d6c1d2f9b11
X-PandasLP-Signature: t=1791797400,v1=5f2b…

{
  "id": "6f1c2c1e-6a43-4bd5-9a0e-0d6c1d2f9b11",
  "event": "borrower.served",
  "occurred_at": "2026-10-12T09:30:00.000Z",
  "test": false,
  "data": {
    "case_id": "ACME-0004", "loan_id": "LN-2026-0042", "status": "served",
    "served_at": "2026-10-12T09:30:00.000Z",
    "letter_url": "${BASE}/borrowers/ACME-0004/letter"
  }
}`}</Code>
            <p>
              <strong>Answer 2xx within 10 seconds.</strong> Anything else is
              retried after {RETRY_DELAYS_MINUTES.join(", ")} minutes (just
              under 24 hours), then we stop and our staff contact you. An update
              may occasionally arrive twice: the <code>id</code> is the same, so
              ignore one you’ve already handled. You can always check a borrower
              with <code>GET /borrowers/{"{id}"}</code>.
            </p>
            <p>
              <strong>Check the signature</strong> with the webhook secret we
              gave you, on the raw body, and refuse calls more than 5 minutes
              old:
            </p>
            <Code>{`// Node.js
const crypto = require('crypto')
function isFromPandas(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')))
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false
  const expected = crypto.createHmac('sha256', secret).update(parts.t + '.' + rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(parts.v1, 'hex'))
}`}</Code>
            <Code>{`# Python
import hmac, hashlib, time
def is_from_pandas(raw_body: bytes, header: str, secret: str) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    if abs(time.time() - int(parts["t"])) > 300:
        return False
    expected = hmac.new(secret.encode(), f"{parts['t']}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts["v1"])`}</Code>

            <h2>7. Test mode</h2>
            <p>
              With the test key, everything is checked exactly as it will be
              live, but nothing real happens: no lawyer, no serving, no emails,
              no bill.
            </p>
            <ul>
              <li>
                A complete test borrower walks the whole journey by itself, one
                step about every 15 minutes: drafted, approved, served, Day 7,
                Day 14 (awaiting decision), closed. Each step sends its webhook
                to your <strong>test</strong> address.
              </li>
              <li>
                Its letter is a SAMPLE, from the same step a real one would be.
              </li>
              <li>Don’t want to wait? Take the next step at once:</li>
            </ul>
            <Endpoint method="POST" path="/borrowers/{id}/advance">
              <Code>{`curl -X POST ${BASE}/borrowers/LN-TEST-1/advance -H "Authorization: Bearer plp_test_..."

{ "case_id": "ACME-0001", "from": "letter_drafted", "status": "lawyer_approved" }`}</Code>
              <p>
                To test Missing Documents, send a borrower with a gap (no email,
                say). <strong>You get your live key</strong> once you’ve sent a
                test borrower, taken one through to Day 14, downloaded its
                letter, and received a webhook.
              </p>
            </Endpoint>

            <h2>8. Everything else</h2>
            <p>
              The full description is{" "}
              <a href="/api/v1/openapi.json">/api/v1/openapi.json</a> (OpenAPI
              3.1). Import it into Postman, Swagger UI or a code generator.
              Questions:{" "}
              <a href="mailto:pandaslegalpractitioners@gmail.com">
                pandaslegalpractitioners@gmail.com
              </a>
              .
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
