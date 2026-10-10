// The brand API's OpenAPI 3.1 description, for the brand's developers. Served as JSON at
// /api/v1/openapi.json and summarised for people at /developers/api. Phase 5C of
// plans/phase-5-api-intake.md. lib/__tests__/brandApiSpec.test.ts checks every path here has a
// route file and every route file is described here, so the two can't drift apart.

import { BRAND_CASE_STATUS_LABELS } from './brandSheet'
import { API_FIELDS, MAX_BATCH, MAX_DOCUMENTS } from './brandApiInput'
import { RETRY_DELAYS_MINUTES } from './brandWebhookFormat'

const STATUSES = Object.keys(BRAND_CASE_STATUS_LABELS)

const error = (code: string, message: string) => ({
  description: message,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: { code, message } } } },
})

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Our Case ID (e.g. `ACME-0004`) or your own loan ID.',
  schema: { type: 'string' },
}

const webhook = (event: string, summary: string, data: Record<string, unknown>) => ({
  post: {
    summary,
    description: 'Sent to your web address, signed. Answer with any 2xx within 10 seconds.',
    parameters: [
      { name: 'X-PandasLP-Event', in: 'header', schema: { type: 'string', example: event } },
      { name: 'X-PandasLP-Delivery', in: 'header', description: 'The same as the body’s `id`. Use it to ignore a repeat.', schema: { type: 'string' } },
      { name: 'X-PandasLP-Signature', in: 'header', description: '`t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with your webhook secret>`', schema: { type: 'string' } },
    ],
    requestBody: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/WebhookEvent' },
          example: { id: '6f1c2c1e-6a43-4bd5-9a0e-0d6c1d2f9b11', event, occurred_at: '2026-10-12T09:30:00.000Z', test: false, data },
        },
      },
    },
    responses: { '2XX': { description: 'Received. Anything else, or no answer in 10 seconds, is retried.' } },
  },
})

const base = { case_id: 'ACME-0004', loan_id: 'LN-2026-0042' }

export const BRAND_API_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Pandas LP Brand API',
    version: '1.0.0',
    description: [
      'Send borrowers to Pandas LP for a lawyer-approved letter of demand, served and followed up on Day 7 and Day 14. We tell your system what happens (webhooks), and you can pull the letter once a lawyer has approved it.',
      '',
      '**Keys.** Send `Authorization: Bearer <key>` on every call. A test key (`plp_test_…`) and a live key (`plp_live_…`) see separate borrowers. 60 calls a minute per key.',
      '',
      '**Test mode.** Test borrowers are checked exactly like live ones, but nothing real happens: no lawyer, no serving, no emails, no bill. They get a SAMPLE letter and move through the whole journey on their own (about every 15 minutes), sending each webhook to your test address. `POST /borrowers/{id}/advance` takes the next step at once. You get a live key once your integration has passed with the test key.',
      '',
      '**Never twice.** Your `loan_id` is unique per key mode. Sending the same loan again returns the same case; it never creates a second one.',
    ].join('\n'),
  },
  servers: [{ url: 'https://pandaslp.com.ng/api/v1' }],
  security: [{ bearer: [] }],
  paths: {
    '/borrowers': {
      post: {
        summary: 'Send one borrower, or several',
        description: `One borrower as the body, or \`{ "borrowers": [ … ] }\` with up to ${MAX_BATCH}. Keep each request under 5 MB: with documents inside the JSON that's about 3 borrowers; with document links, up to ${MAX_BATCH}. Each borrower gets its own answer in \`results\`, in the order sent; one bad borrower never stops the others.`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { oneOf: [{ $ref: '#/components/schemas/BorrowerInput' }, { type: 'object', required: ['borrowers'], properties: { borrowers: { type: 'array', maxItems: MAX_BATCH, items: { $ref: '#/components/schemas/BorrowerInput' } } } }] },
              example: {
                loan_id: 'LN-2026-0042',
                borrower_full_name: 'Adebayo Ogunleye',
                phone_number: '08031234567',
                email: 'adebayo@example.com',
                address_for_service: '12 Isokan Street, Olosan, Ibadan, Oyo State',
                loan_amount: 500000,
                amount_outstanding: 380000,
                loan_date: '2026-03-15',
                last_payment_date: '2026-06-01',
                notes: 'Promised to pay in July; has not.',
                documents: [
                  { filename: 'loan-agreement.pdf', content_base64: 'JVBERi0xLjQK…' },
                  { filename: 'statement.pdf', url: 'https://files.acme.ng/statements/LN-2026-0042.pdf' },
                ],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'One result per borrower.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { test: { type: 'boolean' }, results: { type: 'array', items: { $ref: '#/components/schemas/SubmitResult' } } } },
                example: {
                  test: false,
                  results: [
                    { loan_id: 'LN-2026-0042', case_id: 'ACME-0004', status: 'new' },
                    { loan_id: 'LN-2026-0043', case_id: 'ACME-0005', status: 'missing_documents', missing: ['Email (needed to send the reminders)'] },
                    { loan_id: 'LN-2026-0040', case_id: 'ACME-0002', status: 'served', duplicate: true, flagged: ['Amount Outstanding'], note: 'This loan is already being worked on, so the changed details were not applied. Our staff have been told and will decide whether to use them. Send other updates as a note.' },
                  ],
                },
              },
            },
          },
          '400': error('invalid_json', 'The request body is not valid JSON.'),
          '401': error('unauthorized', 'This API key is not valid. It may have been revoked.'),
          '413': error('too_large', 'The request is over 5 MB. Send fewer borrowers per call, or use document links.'),
          '429': error('rate_limited', 'Too many requests. Slow down and retry shortly.'),
        },
      },
    },
    '/borrowers/{id}': {
      get: {
        summary: 'One borrower’s status and dates',
        parameters: [idParam],
        responses: {
          '200': { description: 'The borrower.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Borrower' } } } },
          '404': error('not_found', 'No borrower "LN-1" on this live key.'),
        },
      },
    },
    '/borrowers/{id}/letter': {
      get: {
        summary: 'Download the demand letter (PDF)',
        description:
          'Available once a lawyer has approved the letter. Before serving it is the approved letter; once served, the stamped copy that was served. `X-Letter-Version` says which (`approved` or `served`), `X-Letter-Stamped` whether it is the stamped copy (`yes`/`no`). Test borrowers get a SAMPLE letter.',
        parameters: [idParam],
        responses: {
          '200': {
            description: 'The letter.',
            headers: { 'X-Letter-Version': { schema: { type: 'string', enum: ['approved', 'served'] } }, 'X-Letter-Stamped': { schema: { type: 'string', enum: ['yes', 'no'] } } },
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          '404': error('not_found', 'No borrower "LN-1" on this live key.'),
          '409': error('letter_not_available', 'The letter is available once a lawyer has approved it. This borrower is "letter_drafted".'),
        },
      },
    },
    '/borrowers/{id}/notes': {
      post: {
        summary: 'Add a note',
        description:
          'Notes are added, dated, never replaced. Use them for updates, or to answer what a borrower in Missing Documents is waiting for: before drafting starts the note becomes part of the borrower’s details (and a Missing Documents borrower is checked again). After that, it goes to our staff. To change other details before we start, send the loan again.',
        parameters: [idParam],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['note'], properties: { note: { type: 'string', maxLength: 2000 } } }, example: { note: 'Borrower’s correct email is adebayo.o@example.com.' } } } },
        responses: {
          '200': {
            description: 'Added.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { case_id: { type: 'string' }, status: { type: 'string', enum: STATUSES }, reopened: { type: 'boolean' }, used_for_letter: { type: 'boolean' } } },
                example: { case_id: 'ACME-0005', status: 'new', reopened: true, used_for_letter: true },
              },
            },
          },
          '400': error('invalid_note', 'Send the note as { "note": "…" }.'),
          '404': error('not_found', 'No borrower "LN-1" on this live key.'),
        },
      },
    },
    '/borrowers/{id}/advance': {
      post: {
        summary: 'Test mode: take the next step now',
        description: 'Test key only. Moves a test borrower to its next step (drafted → approved → served → Day 7 → Day 14 → closed) and sends that step’s webhook straight away.',
        parameters: [idParam],
        responses: {
          '200': { description: 'Moved on.', content: { 'application/json': { example: { case_id: 'ACME-0001', from: 'letter_drafted', status: 'lawyer_approved' } } } },
          '403': error('test_key_only', 'Only test borrowers can be moved on. Use your test key.'),
          '409': error('cannot_advance', 'The test journey has ended ("closed").'),
        },
      },
    },
  },
  webhooks: {
    'borrower.missing_documents': webhook('borrower.missing_documents', 'Something is missing or wrong', { ...base, status: 'missing_documents', missing: ['Phone Number (not a valid Nigerian number)'] }),
    'borrower.letter_drafted': webhook('borrower.letter_drafted', 'The letter is drafted, waiting for a lawyer', { ...base, status: 'letter_drafted' }),
    'borrower.lawyer_approved': webhook('borrower.lawyer_approved', 'A lawyer approved the letter; it can be downloaded', { ...base, status: 'lawyer_approved', letter_available: true, letter_url: 'https://pandaslp.com.ng/api/v1/borrowers/ACME-0004/letter' }),
    'borrower.served': webhook('borrower.served', 'The letter was served on the borrower', { ...base, status: 'served', served_at: '2026-10-12T09:30:00.000Z', letter_url: 'https://pandaslp.com.ng/api/v1/borrowers/ACME-0004/letter' }),
    'borrower.day7_sent': webhook('borrower.day7_sent', 'Day 7 reminder sent', { ...base, status: 'day7_sent', sent_at: '2026-10-19T09:30:00.000Z' }),
    'borrower.day14_sent': webhook('borrower.day14_sent', 'Day 14 reminder sent', { ...base, status: 'day14_sent', sent_at: '2026-10-26T09:30:00.000Z' }),
    'borrower.awaiting_decision': webhook('borrower.awaiting_decision', 'Day 14 has passed: we need your decision (court or close)', { ...base, status: 'day14_sent', awaiting_decision_since: '2026-10-26T09:30:00.000Z' }),
    'borrower.outcome': webhook('borrower.outcome', 'Paid, disputed or closed', { ...base, status: 'paid', outcome: 'paid' }),
  },
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer', description: '`plp_test_…` or `plp_live_…`' } },
    schemas: {
      BorrowerInput: {
        type: 'object',
        required: ['loan_id'],
        additionalProperties: false,
        properties: {
          loan_id: { type: 'string', maxLength: 100, description: 'Your own ID for the loan. Letters, numbers and . _ / : -' },
          ...Object.fromEntries(
            Object.entries(API_FIELDS).map(([field, column]) => [
              field,
              {
                type: ['string', 'number'],
                description:
                  column === 'Loan Date' || column === 'Last Payment Date'
                    ? `${column}: YYYY-MM-DD (or DD/MM/YYYY).`
                    : column === 'Phone Number'
                      ? `${column}: a Nigerian number, e.g. 08031234567 or +2348031234567.`
                      : column === 'Notes'
                        ? 'Anything the lawyer should know (up to 2000 characters).'
                        : `${column}.`,
              },
            ]),
          ),
          documents: {
            type: 'array',
            maxItems: MAX_DOCUMENTS,
            description: 'The loan agreement and/or statement: PDF, JPG or PNG (checked from the content), under 1 MB in total per borrower. Each one is sent inside the JSON or as an https link we fetch once.',
            items: {
              type: 'object',
              properties: { filename: { type: 'string' }, content_base64: { type: 'string' }, url: { type: 'string', format: 'uri' } },
              oneOf: [{ required: ['content_base64'] }, { required: ['url'] }],
            },
          },
        },
      },
      SubmitResult: {
        type: 'object',
        properties: {
          loan_id: { type: ['string', 'null'] },
          case_id: { type: 'string', description: 'Our Case ID. Keep it, or use your loan ID.' },
          status: { type: 'string', enum: STATUSES },
          missing: { type: 'array', items: { type: 'string' }, description: 'When status is missing_documents: exactly what to fix.' },
          duplicate: { type: 'boolean', description: 'This loan was sent before: the existing case is returned.' },
          updated: { type: 'boolean', description: 'An earlier submission not yet worked on was corrected by this one.' },
          flagged: { type: 'array', items: { type: 'string' }, description: 'Fields changed after we started: not applied, passed to our staff.' },
          note: { type: 'string' },
          error: { type: 'string', description: 'This borrower could not be accepted (the shape was wrong). Fix and resend.' },
        },
      },
      Borrower: {
        type: 'object',
        properties: {
          case_id: { type: 'string' },
          loan_id: { type: 'string' },
          status: { type: 'string', enum: STATUSES },
          test: { type: 'boolean' },
          missing: { type: 'array', items: { type: 'string' } },
          letter_available: { type: 'boolean' },
          served_at: { type: ['string', 'null'], format: 'date-time' },
          day7_sent_at: { type: ['string', 'null'], format: 'date-time' },
          day14_sent_at: { type: ['string', 'null'], format: 'date-time' },
          awaiting_decision_since: { type: ['string', 'null'], format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      WebhookEvent: {
        type: 'object',
        description: `Retried after ${RETRY_DELAYS_MINUTES.join(', ')} minutes (just under 24 hours) if your system doesn't answer 2xx. Delivered at least once: the same \`id\` may arrive twice.`,
        properties: {
          id: { type: 'string', description: 'Stable across retries.' },
          event: { type: 'string' },
          occurred_at: { type: 'string', format: 'date-time' },
          test: { type: 'boolean' },
          data: { type: 'object' },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } } },
      },
    },
  },
} as const
