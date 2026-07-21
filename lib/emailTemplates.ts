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
            Professional Legal Services, Powered by AI
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
            Pandas LP — Professional Legal Services, Powered by AI<br/>
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

We have received your payment of ${formatted} and your case — ${caseTitle} — is now with the Pandas LP legal team.

We are working towards getting this resolved on your behalf. A member of our team will reach out to you shortly to ensure they have full context on your matter before we proceed.

View your case: ${dashboardUrl}

If you have any questions before we reach out, reply to this email or call us on +234 811 808 0189.

Pandas LP
pandaslegalpractitioners@gmail.com`

  return {
    subject: `We've received your case — Pandas LP`,
    text,
    html: baseWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">
        Case received. We're on it.
      </h2>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        Hi ${recipientName},
      </p>
      <p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        We have received your payment of <strong style="color:#D6BB80;">${formatted}</strong> and your case —
        <strong style="color:#F3EFE3;">${caseTitle}</strong> — is now with the Pandas LP legal team.
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
      subject: `Your Letter of Demand has been served — ${debtorName}`,
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
    subject: `Deadline has passed — escalate against ${debtorName}?`,
    text: `Hi ${recipientName},

${debtorName} has not responded to your Letter of Demand for ${formatted} within the 14-day period.

You may now escalate to the Small Claims Court. Pandas LP can file the claim on your behalf — the conversation you've already had with our agent will be pre-loaded, so there's no need to start over.

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
        You may now escalate to the Small Claims Court. Pandas LP can file the claim on your behalf —
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
    subject: `Your case is resolved — ${caseTitle}`,
    text: `Hi ${recipientName},

Your case — ${caseTitle} — has been resolved. Thank you for trusting Pandas LP to handle this on your behalf.

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
        Your case — <strong style="color:#F3EFE3;">${caseTitle}</strong> — has been resolved.
        Thank you for trusting Pandas LP to handle this on your behalf.
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#ABB1A2;line-height:1.6;">
        ${reviewUrl ? 'If you have a moment, a review helps other people in the same situation find us.' : 'You can view the full history of your case at any time from your dashboard.'}
      </p>
      ${reviewHtmlBlock}
    `),
  }
}
