export interface PaymentConfirmedEmailData {
  recipientEmail: string
  recipientName: string
  caseTitle: string
  amountPaid: number
  siteUrl: string
}

export interface FollowUpEmailData {
  recipientEmail: string
  recipientName: string
  debtorName: string
  amount: number
  caseId: string
  agentId: string
  day: 0 | 7 | 14
  siteUrl: string
}

export interface ResolutionEmailData {
  recipientName: string
  caseTitle: string
  siteUrl: string
  // No Google Business Profile exists yet — omit the review ask entirely rather than
  // fabricate a link. Set GOOGLE_REVIEW_URL once the profile is live (see lib/sendCaseEmail.ts).
  reviewUrl?: string
}

export interface ReviewedDocumentEmailData {
  recipientName: string
  caseTitle: string
  reviewedBy: string
  deliveryOption: string | null
  siteUrl: string
}

export interface NegotiationReplyEmailData {
  recipientName: string
  caseTitle: string
  // The exact text staff logged for this round — never re-summarized or reworded by the
  // email template, so the client reads precisely what was sent on their behalf, not a
  // paraphrase of it. See lib/sendCaseEmail.ts's negotiation_reply branch.
  replySummary: string
  siteUrl: string
}

export interface NewOrderAlertEmailData {
  caseTitle: string
  clientEmail: string
  amountPaid: number
  agentId: string
  caseId: string
  siteUrl: string
  // Set by app/api/verify-payment/route.ts once it knows whether the editable DOCX (see
  // lib/docxGenerator.js) actually got built and attached — a case can reach "paid" with no
  // document yet (e.g. property law's percentage-fee deeds), so this can't just be assumed true.
  hasEditableDraftAttached?: boolean
}

function baseWrapper(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Pandas LP</title>
</head>
<body style="margin:0;padding:0;background:#182A3A;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#182A3A;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <!-- Header -->
      <tr>
        <td style="background:#1F3446;border:1px solid rgba(243, 239, 227,0.1);border-radius:16px 16px 0 0;padding:28px 32px;border-bottom:none;">
          <span style="font-size:20px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">
            Pandas <span style="color:#D6BB80;">LP</span>
          </span>
          <span style="display:block;font-size:11px;color:#ABB1A2;margin-top:4px;letter-spacing:0.06em;text-transform:uppercase;">
            Licensed Legal Practitioners, Lagos, Nigeria
          </span>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="background:#1F3446;border:1px solid rgba(243, 239, 227,0.1);border-left:1px solid rgba(243, 239, 227,0.1);border-right:1px solid rgba(243, 239, 227,0.1);padding:32px;">
          ${content}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:#1F3446;border:1px solid rgba(243, 239, 227,0.1);border-top:1px solid rgba(243, 239, 227,0.06);border-radius:0 0 16px 16px;padding:20px 32px;">
          <p style="margin:0;font-size:11px;color:#ABB1A2;line-height:1.6;">
            Pandas LP · Licensed Legal Practitioners, Lagos, Nigeria<br/>
            pandaslegalpractitioners@gmail.com · +234 811 808 0189<br/>
            <a href="https://pandaslp.com.ng" style="color:#ABB1A2;">pandaslp.com.ng</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

export function getPaymentConfirmedEmail(data: PaymentConfirmedEmailData): { subject: string; html: string; text: string } {
  const { recipientName, caseTitle, amountPaid, siteUrl } = data
  const dashboardUrl = `${siteUrl}/dashboard`
  const formatted = `₦${amountPaid.toLocaleString()}`

  const text = `Hi ${recipientName},

We have received your payment of ${formatted} and your case, ${caseTitle}, is now with the Pandas LP legal team.

We are working towards getting this resolved on your behalf. A member of our team will reach out to you shortly to ensure they have full context on your matter before we proceed.

View your case: ${dashboardUrl}

If you have any questions before we reach out, reply to this email or call us on +234 811 808 0189.

Pandas LP
pandaslegalpractitioners@gmail.com`

  return {
    subject: `We've received your case | Pandas LP`,
    text,
    html: baseWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">
        Case received. We're on it.
      </h2>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        Hi ${recipientName},
      </p>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        We have received your payment of <strong style="color:#D6BB80;">${formatted}</strong> and your case,
        <strong style="color:#F3EFE3;">${caseTitle}</strong>, is now with the Pandas LP legal team.
      </p>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        We are working towards getting this resolved on your behalf.
        A member of our team will reach out to you shortly to ensure they have full context on your matter
        before we proceed.
      </p>
      <p style="margin:0 0 28px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        You can track the progress of your case at any time from your dashboard.
      </p>
      <a href="${dashboardUrl}" style="display:inline-block;background:#D6BB80;color:#182A3A;font-size:14px;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:12px;">
        View My Case Dashboard →
      </a>
      <p style="margin:28px 0 0;font-size:12px;color:#79806F;line-height:1.6;">
        If you have any questions before we reach out, reply to this email or call us on +234 811 808 0189.
      </p>
    `),
  }
}

export function getFollowUpEmail(data: FollowUpEmailData): { subject: string; html: string; text: string } {
  const { recipientName, debtorName, amount, caseId, agentId, day, siteUrl } = data
  const dashboardUrl = `${siteUrl}/dashboard`
  const resumeUrl   = `${siteUrl}/agent/${agentId}?resume=${caseId}&fileCourt=1`
  const formatted   = `₦${amount.toLocaleString()}`

  if (day === 0) {
    return {
      subject: `Your Letter of Demand has been served | ${debtorName}`,
      text: `Hi ${recipientName},

Your Letter of Demand for ${formatted} has been formally served on ${debtorName}. The clock is now running.

The debtor has 14 days to respond or make payment. We will notify you automatically at Day 7 and Day 14.

View your case: ${dashboardUrl}

Pandas LP
pandaslegalpractitioners@gmail.com`,
      html: baseWrapper(`
        <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">
          Letter served successfully
        </h2>
        <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
          Hi ${recipientName},
        </p>
        <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
          Your Letter of Demand for <strong style="color:#F3EFE3;">${formatted}</strong> has been formally served on
          <strong style="color:#F3EFE3;">${debtorName}</strong>. The clock is now running.
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#ABB1A2;line-height:1.6;">
          The debtor has <strong style="color:#D6BB80;">14 days</strong> to respond or make payment. We will notify you automatically at Day 7 and Day 14.
        </p>
        <a href="${dashboardUrl}" style="display:inline-block;background:#D6BB80;color:#182A3A;font-size:14px;font-weight:600;text-decoration:none;padding:13px 24px;border-radius:12px;">
          View Your Case →
        </a>
      `),
    }
  }

  if (day === 7) {
    return {
      subject: `Deadline reminder: ${debtorName} has 7 days left to respond`,
      text: `Hi ${recipientName},

It has been 7 days since your Letter of Demand was served on ${debtorName} for ${formatted}.

The debtor has 7 days remaining. If they do not respond or pay by the deadline, you can instruct us to escalate the matter to the Small Claims Court.

View case status: ${dashboardUrl}

Pandas LP
pandaslegalpractitioners@gmail.com`,
      html: baseWrapper(`
        <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">
          7 days left on the deadline
        </h2>
        <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
          Hi ${recipientName},
        </p>
        <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
          It has been 7 days since your Letter of Demand was served on
          <strong style="color:#F3EFE3;">${debtorName}</strong> for
          <strong style="color:#F3EFE3;">${formatted}</strong>.
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#ABB1A2;line-height:1.6;">
          The debtor has <strong style="color:#D6BB80;">7 days remaining</strong>. If they do not respond or pay by the deadline,
          you can instruct us to escalate the matter to the Small Claims Court.
        </p>
        <a href="${dashboardUrl}" style="display:inline-block;background:#D6BB80;color:#182A3A;font-size:14px;font-weight:600;text-decoration:none;padding:13px 24px;border-radius:12px;">
          View Case Status →
        </a>
      `),
    }
  }

  // day === 14
  return {
    subject: `Deadline has passed: escalate against ${debtorName}?`,
    text: `Hi ${recipientName},

${debtorName} has not responded to your Letter of Demand for ${formatted} within the 14-day period.

You may now escalate to the Small Claims Court. Pandas LP can file the claim on your behalf: the conversation you've already had with our agent will be pre-loaded, so there's no need to start over.

Resume your case and instruct us to file: ${resumeUrl}

Pandas LP
pandaslegalpractitioners@gmail.com`,
    html: baseWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">
        The 14-day deadline has passed
      </h2>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        Hi ${recipientName},
      </p>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        <strong style="color:#F3EFE3;">${debtorName}</strong> has not responded to your Letter of Demand for
        <strong style="color:#F3EFE3;">${formatted}</strong> within the 14-day period.
      </p>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        You may now escalate to the Small Claims Court. Pandas LP can file the claim on your behalf:
        the conversation you've already had with our agent will be pre-loaded, so there's no need to start over.
      </p>
      <p style="margin:0 0 28px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        Click below to resume your case and instruct us to file:
      </p>
      <a href="${resumeUrl}" style="display:inline-block;background:#D6BB80;color:#182A3A;font-size:14px;font-weight:600;text-decoration:none;padding:13px 24px;border-radius:12px;">
        Escalate to Court Filing →
      </a>
    `),
  }
}

export function getResolutionEmail(data: ResolutionEmailData): { subject: string; html: string; text: string } {
  const { recipientName, caseTitle, siteUrl, reviewUrl } = data
  const dashboardUrl = `${siteUrl}/dashboard`

  const reviewTextBlock = reviewUrl
    ? `\n\nIf you have a moment, a review helps other people in the same situation find us: ${reviewUrl}`
    : ''
  const reviewHtmlBlock = reviewUrl
    ? `<a href="${reviewUrl}" style="display:inline-block;background:#D6BB80;color:#182A3A;font-size:14px;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:12px;margin-top:8px;">
        Leave a Review →
      </a>`
    : ''

  return {
    subject: `Your case is resolved | ${caseTitle}`,
    text: `Hi ${recipientName},

Your case, ${caseTitle}, has been resolved. Thank you for trusting Pandas LP to handle this on your behalf.

View your case: ${dashboardUrl}${reviewTextBlock}

Pandas LP
pandaslegalpractitioners@gmail.com`,
    html: baseWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">
        Your case is resolved
      </h2>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        Hi ${recipientName},
      </p>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        Your case, <strong style="color:#F3EFE3;">${caseTitle}</strong>, has been resolved.
        Thank you for trusting Pandas LP to handle this on your behalf.
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        ${reviewUrl ? 'If you have a moment, a review helps other people in the same situation find us.' : 'You can view the full history of your case at any time from your dashboard.'}
      </p>
      ${reviewHtmlBlock}
    `),
  }
}

// Sent whenever staff log our reply to a counter-offer from the debtor's own lawyer — see
// app/api/admin/negotiations/route.ts. Keeps the client in the loop on negotiation activity
// without them having to ask; the attached PDF (if a stamped one was generated) is added by
// the caller in lib/sendCaseEmail.ts, not this function.
export function getNegotiationReplyEmail(data: NegotiationReplyEmailData): { subject: string; html: string; text: string } {
  const { recipientName, caseTitle, replySummary, siteUrl } = data
  const dashboardUrl = `${siteUrl}/dashboard`

  return {
    subject: `We've replied on your case | ${caseTitle}`,
    text: `Hi ${recipientName},

The other side responded to our letter on your case, ${caseTitle}, and we've now replied on your behalf. Here's what we sent:

${replySummary}

View your case: ${dashboardUrl}

Pandas LP
pandaslegalpractitioners@gmail.com`,
    html: baseWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">
        We've replied on your case
      </h2>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        Hi ${recipientName},
      </p>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        The other side responded to our letter on <strong style="color:#F3EFE3;">${caseTitle}</strong>, and we've now
        replied on your behalf. Here's what we sent:
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#F3EFE3;line-height:1.7;white-space:pre-wrap;background:rgba(255,255,255,0.04);border-radius:10px;padding:16px 18px;">${replySummary}</p>
      <p style="margin:0;font-size:15px;color:#ABB1A2;line-height:1.6;">
        You can see the full history of your case at any time from your dashboard.
      </p>
    `),
  }
}

export function getReviewedDocumentEmail(data: ReviewedDocumentEmailData): { subject: string; html: string; text: string } {
  const { recipientName, caseTitle, reviewedBy, deliveryOption, siteUrl } = data
  const dashboardUrl = `${siteUrl}/dashboard`

  // pandas-serves cases: staff still deliver it, this email is the client's own record copy.
  // self-serve cases: this email IS the delivery — the client prints/sends it themselves,
  // since there's no in-app download anymore (see components/AgentChat.tsx).
  const nextStepText =
    deliveryOption === 'pandas-serves'
      ? "Our team will serve this on your behalf, and we'll update your dashboard once that's done. This email is your copy for your own records."
      : "This is now yours to print and serve on the other party, attached as a PDF, ready to send. Important: the moment you've delivered it, come back to your dashboard and click \"Mark Letter as Served.\" That's what starts the 14-day response clock. If we don't hear from you, we can't track when the other party's deadline passes or follow up on your behalf."

  return {
    subject: `Your reviewed document | ${caseTitle}`,
    text: `Hi ${recipientName},

${caseTitle} has been reviewed by ${reviewedBy} and is attached to this email as a PDF.

${nextStepText}

Also attached: our Terms of Use. Please read, sign, and return it at your convenience — it covers the terms under which we're acting for you on this matter.

View your case: ${dashboardUrl}

Pandas LP
pandaslegalpractitioners@gmail.com`,
    html: baseWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">
        Your document has been reviewed
      </h2>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        Hi ${recipientName},
      </p>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        <strong style="color:#F3EFE3;">${caseTitle}</strong> has been reviewed by
        <strong style="color:#F3EFE3;">${reviewedBy}</strong> and is attached to this email as a PDF.
      </p>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        ${nextStepText}
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        Also attached: our Terms of Use. Please read, sign, and return it at your convenience —
        it covers the terms under which we're acting for you on this matter.
      </p>
      <a href="${dashboardUrl}" style="display:inline-block;background:#D6BB80;color:#182A3A;font-size:14px;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:12px;">
        View Your Case →
      </a>
    `),
  }
}

// Goes to GMAIL_USER (staff), not the client — built and sent directly from
// app/api/verify-payment/route.ts rather than through sendCaseEmail, which resolves its
// recipient from the case owner. This is the "click here to review" alert a payment triggers.
export function getNewOrderAlertEmail(data: NewOrderAlertEmailData): { subject: string; html: string; text: string } {
  const { caseTitle, clientEmail, amountPaid, agentId, caseId, siteUrl, hasEditableDraftAttached } = data
  const reviewUrl = `${siteUrl}/admin?caseId=${caseId}`
  const amountStr = `₦${amountPaid.toLocaleString()}`
  const attachmentNoteText = hasEditableDraftAttached
    ? '\nAn editable copy of the draft (.docx) is attached — open it in Word to review and mark up before upload-reviewed-document / markReviewed.\n'
    : ''
  const attachmentNoteHtml = hasEditableDraftAttached
    ? `<p style="margin:0 0 20px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        An editable copy of the draft (<strong style="color:#F3EFE3;">.docx</strong>) is attached — open it in Word to review and mark up before uploading the reviewed version.
      </p>`
    : ''

  return {
    subject: `New paid order | ${caseTitle}`,
    text: `We've received a payment on a new order.

Client: ${clientEmail}
Service: ${agentId}
Amount: ${amountStr}
Document: ${caseTitle}
${attachmentNoteText}
Click here to review the document: ${reviewUrl}

Pandas LP`,
    html: baseWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">
        New paid order
      </h2>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        We've received a payment on a new order, <strong style="color:#F3EFE3;">${caseTitle}</strong>.
      </p>
      <table style="width:100%;margin:0 0 20px;font-size:14px;color:#ABB1A2;">
        <tr><td style="padding:4px 0;">Client</td><td style="padding:4px 0;color:#F3EFE3;">${clientEmail}</td></tr>
        <tr><td style="padding:4px 0;">Service</td><td style="padding:4px 0;color:#F3EFE3;">${agentId}</td></tr>
        <tr><td style="padding:4px 0;">Amount</td><td style="padding:4px 0;color:#F3EFE3;">${amountStr}</td></tr>
      </table>
      ${attachmentNoteHtml}
      <a href="${reviewUrl}" style="display:inline-block;background:#D6BB80;color:#182A3A;font-size:14px;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:12px;">
        Click to Review Document →
      </a>
    `),
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   Recovery confirmed.

   Sent when a member of the firm confirms money has actually reached a
   client. It is the only email we send at a genuinely good moment, so it
   is also the one place a repeat instruction or a review is worth asking
   for. Two tones, chosen by isFull:

   Full     the whole claim landed. Warm, and it asks for the review.
   Partial  some of it landed. It states the shortfall and the recorded
            reason in plain words, invites a conversation about the
            balance, and does NOT ask for a review. Asking a client who
            is still owed money to go and praise us publicly is the kind
            of thing that reads as tone deaf, and deserves to.

   `offers` is built by the caller from the agents that are actually live
   (see lib/sendCaseEmail.ts). Nothing here invents a service.
   ───────────────────────────────────────────────────────────────────────── */

export interface RecoveryOffer {
  name: string
  line: string
  href: string
}

export interface RecoveryConfirmedEmailData {
  recipientName: string
  caseTitle: string
  amountRecovered: number
  isFull: boolean
  shortfallReason?: string
  siteUrl: string
  // Omitted entirely when GOOGLE_REVIEW_URL is unset, and never sent on a partial recovery.
  reviewUrl?: string
  offers: RecoveryOffer[]
}

const money = (n: number) => '₦' + n.toLocaleString('en-NG')

export function getRecoveryConfirmedEmail(data: RecoveryConfirmedEmailData): { subject: string; html: string; text: string } {
  const { recipientName, caseTitle, amountRecovered, isFull, shortfallReason, siteUrl, reviewUrl, offers } = data
  const dashboardUrl = `${siteUrl}/dashboard`
  const amount = money(amountRecovered)

  // A review ask only ever rides on a full recovery.
  const askForReview = isFull && !!reviewUrl

  const openingText = isFull
    ? `${amount} has been recovered on your matter, ${caseTitle}. That is the full amount claimed, and it is now with you.`
    : `${amount} has been recovered on your matter, ${caseTitle}. That is part of what was claimed rather than all of it.`

  const shortfallText = !isFull && shortfallReason
    ? `\n\nWhy the balance was not recovered: ${shortfallReason}\n\nIf you want to pursue the rest, reply to this email. We will tell you honestly whether it is worth what it would cost you.`
    : ''

  const shortfallHtml = !isFull && shortfallReason
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr><td style="border-left:2px solid #D6BB80;padding:2px 0 2px 14px;">
          <span style="display:block;font-size:11px;color:#ABB1A2;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Why the balance was not recovered</span>
          <span style="font-size:15px;color:#F3EFE3;line-height:1.6;">${shortfallReason}</span>
        </td></tr>
      </table>
      <p style="margin:0 0 20px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        If you want to pursue the rest, reply to this email. We will tell you honestly whether
        it is worth what it would cost you.
      </p>`
    : ''

  const offersText = offers.length
    ? `\n\nWhat else we can do for you:\n${offers.map((o) => `- ${o.name}: ${o.line}\n  ${o.href}`).join('\n')}`
    : ''

  const offersHtml = offers.length
    ? `<p style="margin:24px 0 12px;font-size:11px;color:#ABB1A2;letter-spacing:0.06em;text-transform:uppercase;">
         What else we can do for you
       </p>
       <table width="100%" cellpadding="0" cellspacing="0">
         ${offers.map((o) => `
         <tr><td style="padding:12px 0;border-top:1px solid rgba(243,239,227,0.1);">
           <a href="${o.href}" style="font-size:15px;font-weight:600;color:#F3EFE3;text-decoration:none;">${o.name} &rarr;</a>
           <span style="display:block;font-size:14px;color:#ABB1A2;line-height:1.6;margin-top:4px;">${o.line}</span>
         </td></tr>`).join('')}
       </table>`
    : ''

  const reviewText = askForReview
    ? `\n\nIf you have a moment, a review helps other people in the same situation find us: ${reviewUrl}`
    : ''

  const reviewHtml = askForReview
    ? `<p style="margin:24px 0 12px;font-size:15px;color:#ABB1A2;line-height:1.6;">
         If you have a moment, a review helps the next person in the same situation find us.
       </p>
       <a href="${reviewUrl}" style="display:inline-block;background:#D6BB80;color:#182A3A;font-size:14px;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:12px;">
         Leave a Review &rarr;
       </a>`
    : ''

  return {
    subject: isFull
      ? `Recovered in full: ${amount} | ${caseTitle}`
      : `A part payment has been recovered | ${caseTitle}`,

    text: `Hi ${recipientName},

${openingText}${shortfallText}

Thank you for trusting us with it. Most people in your position write the money off rather than chase it. You did not.

View your case: ${dashboardUrl}${offersText}${reviewText}

Pandas LP
pandaslegalpractitioners@gmail.com`,

    html: baseWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">
        ${isFull ? 'Your money has been recovered' : 'A part payment has been recovered'}
      </h2>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        Hi ${recipientName},
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr><td style="background:#182A3A;border:1px solid rgba(243,239,227,0.1);border-radius:12px;padding:20px 24px;">
          <span style="display:block;font-size:11px;color:#ABB1A2;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">
            ${isFull ? 'Recovered in full' : 'Recovered so far'}
          </span>
          <span style="font-size:30px;font-weight:700;color:#D6BB80;letter-spacing:-0.02em;">${amount}</span>
          <span style="display:block;font-size:14px;color:#ABB1A2;line-height:1.6;margin-top:8px;">${caseTitle}</span>
        </td></tr>
      </table>

      <p style="margin:0 0 20px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        ${isFull
          ? 'That is the full amount claimed, and it is now with you.'
          : 'That is part of what was claimed rather than all of it.'}
      </p>

      ${shortfallHtml}

      <p style="margin:0 0 20px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        Thank you for trusting us with it. Most people in your position write the money off
        rather than chase it. You did not.
      </p>

      <a href="${dashboardUrl}" style="display:inline-block;border:1px solid rgba(243,239,227,0.2);color:#F3EFE3;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:12px;">
        View your case &rarr;
      </a>

      ${offersHtml}
      ${reviewHtml}
    `),
  }
}
