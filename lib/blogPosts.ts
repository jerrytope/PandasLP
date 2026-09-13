export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  readTime: string
  category: string
  author: string
  content: string // HTML string
  /* Optional. When present, the post renders a visible FAQ block AND emits FAQPage
     structured data for it. Google requires the two to match, so they are driven from
     this one array rather than being written twice. Questions should be phrased the way
     someone actually searches, not the way a lawyer would title a clause. */
  faqs?: { question: string; answer: string }[]
}

// Every post is reviewed by a licensed member of the Pandas LP team before publishing, see
// app/blog/[slug]/page.tsx for where this renders. Keep this the single source of truth so a
// future change of reviewer only needs updating here, not in every post.
export const DEFAULT_AUTHOR = 'Adebayo Sobayo & Adeyemo Adedeji, Legal Practitioner'

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'how-to-evict-a-tenant-legally-in-lagos',
    title: 'How to Evict a Tenant Legally in Lagos: Notice Periods and the Two Notices You Must Serve',
    description: 'How much notice a Lagos landlord must give, why a short notice is void, and the second notice most landlords never serve before going to court.',
    date: '2026-09-05',
    readTime: '8 min read',
    category: 'Property Law',
    author: DEFAULT_AUTHOR,
    faqs: [
      {
        question: 'How much notice must I give my tenant in Nigeria?',
        answer: 'It depends on how the tenancy runs, not on how long the tenant has lived there. A weekly tenancy needs one week, a monthly tenancy one month, a quarterly or half-yearly tenancy three months, and a yearly tenancy six months. A fixed-term lease follows the term agreed in the lease itself. Notice periods vary between states, so the tenancy must be checked against the law of the state where the property is.',
      },
      {
        question: 'Can I change the locks or throw my tenant out if they have not paid rent?',
        answer: 'No. Removing a tenant, changing the locks, cutting off power or water, or putting their belongings outside without a court order is unlawful in Nigeria regardless of how much rent is owed. It exposes the landlord to a claim from the tenant and can undermine the recovery case. Possession is recovered by serving the correct notices and then applying to court.',
      },
      {
        question: 'Is one notice enough to take my tenant to court?',
        answer: 'No. Two separate notices are required, served one after the other. The Notice to Quit ends the tenancy on a future date. If the tenant is still in the property after that date, a second notice, the seven days Notice of Owner’s Intention to Apply to Recover Possession, must then be served before court proceedings can be filed. They are two distinct documents and cannot be combined into one.',
      },
      {
        question: 'What happens if I give my tenant less notice than the law requires?',
        answer: 'The notice is void. It has no legal effect, the tenancy has not been validly ended, and the court can dismiss the recovery action on that ground alone. The landlord then starts again from the beginning with a fresh notice and a fresh notice period, having lost the months already spent. This is the most common and most expensive mistake in a recovery of premises.',
      },
      {
        question: 'Can I claim the unpaid rent as well as recover the property?',
        answer: 'Yes. Rent that fell due before the tenancy ended is claimed as arrears, and the sum charged for the period the tenant stays on after the tenancy has ended is claimed as mesne profits. Both should be stated as specific calculated figures, not as a general reference to outstanding rent.',
      },
    ],
    content: `
<p>Most recovery of premises cases in Lagos are not lost in court. They are lost before the case is ever filed, on a notice that was served too short, served in the wrong order, or served as one document when the law requires two.</p>

<p>This guide sets out how long the notice must be, the two notices a landlord has to serve, and the mistakes that send a landlord back to the beginning after months of waiting.</p>

<h2>First, the word "eviction" is the wrong one</h2>

<p>Nigerian law does not give a landlord a power of eviction. It gives a procedure for <strong>recovery of possession</strong>, and that procedure runs through a court. The distinction matters because it decides what a landlord is allowed to do while the tenant is still in the property.</p>

<p>A landlord may not remove a tenant, change the locks, remove the roof or doors, cut off electricity or water, or put the tenant's belongings outside. None of that becomes lawful because the rent is unpaid, because the tenancy has expired, or because the tenant has stopped responding. Self-help of that kind exposes the landlord to a claim from the tenant, and it can damage the recovery case the landlord is trying to bring.</p>

<p>The lawful route is narrow and it is the same every time: serve the correct notice, wait out the notice period, serve the second notice, then apply to court.</p>

<h2>How much notice the law requires</h2>

<p>The single most common question, and the single most common mistake. The notice period is fixed by <strong>how the tenancy runs</strong>, which usually means how the rent is paid. It is not fixed by how long the tenant has been in the property, and it is not fixed by how much rent is owed.</p>

<div class="table-scroll">
<table>
  <thead>
    <tr><th>Type of tenancy</th><th>Notice required</th></tr>
  </thead>
  <tbody>
    <tr><td>Weekly tenancy, tenant at will, or licensee</td><td>1 week</td></tr>
    <tr><td>Monthly tenancy</td><td>1 month</td></tr>
    <tr><td>Quarterly tenancy</td><td>3 months</td></tr>
    <tr><td>Half-yearly tenancy</td><td>3 months</td></tr>
    <tr><td>Yearly tenancy</td><td>6 months</td></tr>
    <tr><td>Fixed-term tenancy</td><td>As stated in the lease, or as the law of the state requires if the lease is silent</td></tr>
  </tbody>
</table>
</div>

<p>A yearly tenant therefore gets six months, not the one month a landlord has often already sent by text message. Tenancy in Lagos is governed by the Lagos State Tenancy Law, and other states have their own legislation, so the tenancy always has to be checked against the law of the state where the property actually sits before a notice is drafted.</p>

<h2>A short notice is void, not merely weak</h2>

<p>This is worth stating plainly because landlords routinely assume a short notice is better than nothing. It is not. A notice shorter than the period the law requires has no legal effect at all. The tenancy has not been ended. The court can dismiss the recovery action on that ground alone, without ever reaching the question of unpaid rent.</p>

<p>The practical cost is not the filing fee. It is time. A landlord who serves one month on a yearly tenant, waits, and files, can lose the better part of a year and then have to start again with a fresh six month notice. The tenant remains in the property throughout.</p>

<h2>The second notice most landlords never serve</h2>

<p>Even landlords who get the notice period right often stop at one document. The law requires two, served in sequence, and they cannot be combined.</p>

<h3>1. The Notice to Quit</h3>
<p>This ends the tenancy on a future date. It must give the full statutory period set out in the table above, and it must expire correctly against the tenancy's own cycle. Until this notice has been served and has expired, the tenancy is still alive and the tenant is not a trespasser.</p>

<h3>2. The seven days Notice of Owner's Intention to Apply to Recover Possession</h3>
<p>This is a separate statutory notice, and it is served only <strong>after</strong> the Notice to Quit has expired and the tenant has stayed on. It tells the tenant the landlord is now going to court. It cannot be served at the same time as the Notice to Quit, it cannot be folded into the same document, and proceedings cannot properly be filed until it has been served and its seven days have run.</p>

<p>Drafting both as one letter is one of the fastest ways to have a recovery case thrown out.</p>

<h2>Claiming the money as well as the property</h2>

<p>Two different sums arise, and they are claimed differently:</p>

<ul>
  <li><strong>Arrears of rent</strong> are the sums that fell due while the tenancy was still running.</li>
  <li><strong>Mesne profits</strong> are what the tenant is charged for occupying the property after the tenancy has ended.</li>
</ul>

<p>Both should appear as specific figures, calculated from the rent and the number of unpaid periods, rather than as a general reference to outstanding rent. A notice that states a precise sum is materially stronger than one that gestures at a debt, and a vague figure invites a dispute the landlord has to answer later.</p>

<h2>What a landlord should have ready</h2>

<p>Before a notice can be drafted properly, these need to be settled:</p>

<ul>
  <li>The property address and the state it is in</li>
  <li>The tenancy type and how the rent is paid, since this fixes the notice period</li>
  <li>The rent, and the date rent was last paid</li>
  <li>When the tenancy started</li>
  <li>The grounds on which possession is being sought</li>
  <li>Any notice already served on this tenant, and when</li>
  <li>The tenant's full name and address, as they should appear on the notice</li>
</ul>

<p>That last point catches people out. A notice addressed to "the occupant" or to a first name is open to challenge, and a notice served on the wrong name may not be a valid notice at all.</p>

<h2>Getting the notice drafted</h2>

<p>Pandas LP's <a href="/agents/property-law">Property Law Agent</a> takes this as a conversation. You describe the tenancy in ordinary words, and it works out which instrument the situation calls for, applies the statutory notice period for that tenancy type, and drafts the notice. A licensed practitioner reviews and signs it before it is served, because an unsigned notice is not a notice.</p>

<p>It also handles the sequence rather than a single document, so the seven days notice is drafted when the Notice to Quit has expired instead of being forgotten. Each tenancy or lease document is <strong>₦25,000</strong>: the agreement, a notice to quit, a recovery-of-possession notice. A matter needing more than one is charged per document.</p>

<p>It will not advise self-help eviction, and it will not invent a figure or an identifier you have not supplied. Where the matter is contested, where ownership is disputed, or where there is live litigation over the property, it escalates to a practitioner rather than drafting.</p>

<p>If your situation is a sale or transfer rather than a tenancy, the same agent covers deeds of assignment, deeds of gift, mortgages, powers of attorney and property searches. The full list is on the <a href="/agents/property-law">Property Law Agent page</a>.</p>

<p><em>This article is general information about Nigerian property law and is not legal advice on your specific matter. Notice periods and procedure vary between states, and the facts of a particular tenancy can change the position.</em></p>
`,
  },
  {
    slug: 'how-to-recover-debt-lagos-small-claims-court',
    title: 'How to Recover Debt Through the Lagos Small Claims Court',
    description: 'A step-by-step guide to using the Lagos Small Claims Court to recover money owed to you, without hiring a lawyer.',
    date: '2026-06-01',
    readTime: '7 min read',
    category: 'Debt Recovery',
    author: DEFAULT_AUTHOR,
    content: `
<p>If someone owes you money in Lagos and refuses to pay, you don't necessarily need a lawyer or an expensive court battle. The Lagos Small Claims Court was set up specifically to help individuals and small businesses recover debts quickly and affordably.</p>

<h2>What is the Small Claims Court?</h2>
<p>The Lagos Small Claims Court (SCC) is a fast-track court established under the Lagos State Magistrates' Court (Civil Procedure) Rules. It handles simple money claims without the formality of a regular court: no lawyers are allowed to appear for parties, proceedings are conducted in plain English, and judgments are typically obtained within 60 days.</p>

<h2>Who Can Use It?</h2>
<p>Any individual, sole trader, or business can file a small claim in Lagos as long as:</p>
<ul>
  <li>The amount owed does not exceed <strong>₦5,000,000</strong> (five million naira)</li>
  <li>The dispute is purely about money, not land or criminal matters</li>
  <li>The defendant's address or place of business is within Lagos State</li>
</ul>

<h2>Step 1: Send a Letter of Demand First</h2>
<p>Before filing in court, you must send a formal Letter of Demand giving the debtor a chance to pay. This is a legal requirement under the Pre-Action Protocol. The letter should:</p>
<ul>
  <li>State the exact amount owed</li>
  <li>Explain how the debt arose (goods sold, services rendered, loan, etc.)</li>
  <li>Give a deadline, typically 7 to 14 days</li>
  <li>Warn that court action will follow if unpaid</li>
</ul>
<p>Pandas LP can draft and serve your Letter of Demand for you. Most debtors pay at this stage, since it signals you are serious.</p>

<h2>Step 2: Complete Forms SCA 1 and SCA 2</h2>
<p>If the debtor ignores the letter, you file your claim using two forms:</p>
<ul>
  <li><strong>Form SCA 1</strong>: The Claim Form. This sets out who you are, who owes you money, and the amount claimed.</li>
  <li><strong>Form SCA 2</strong>: The Statement of Claim. This tells the story: how the debt arose, what evidence you have, and what you are asking the court to order.</li>
</ul>
<p>Both forms must be completed accurately. Any errors can cause delays or dismissal.</p>

<h2>Step 3: File at the Registry and Pay the Court Fee</h2>
<p>Take your completed forms (three copies) to the Small Claims Court Registry at the Lagos Magistrates' Court closest to the defendant's address. Pay the prescribed filing fee, which varies based on the amount of your claim but is generally between ₦3,000 and ₦15,000. You will be given a suit number.</p>

<h2>Step 4: Serve the Defendant</h2>
<p>The court will issue a Summons, which must be served on the defendant. Service is usually done by a court bailiff, but you can also instruct a process server. The defendant has a set number of days to respond.</p>

<h2>Step 5: Attend the Hearing</h2>
<p>On the hearing date, appear in person with all your evidence: invoices, receipts, messages, contracts, payment records. The magistrate will hear both sides and, if your claim is valid, enter judgment in your favour.</p>

<h2>What Happens If They Still Don't Pay After Judgment?</h2>
<p>A court judgment gives you the legal right to enforce payment. If the debtor still refuses, you can apply for a Garnishee Order to attach their bank account, or a Writ of Execution to seize their assets. Pandas LP handles judgment enforcement too.</p>

<h2>How Long Does It Take?</h2>
<p>From filing to judgment: typically 30 to 90 days, depending on whether the defendant contests the claim. Uncontested claims are faster.</p>

<h2>Get Started with Pandas LP</h2>
<p>Our Small Claims Agent walks you through the full process: drafts your Letter of Demand, prepares Forms SCA 1 and SCA 2, and files the claim on your behalf. See our full <a href="/recover-debt/lagos">guide to recovering a debt in Lagos</a> for claim limits and court locations.</p>
    `,
  },
  {
    slug: 'what-is-a-letter-of-demand-nigeria',
    title: 'What is a Letter of Demand in Nigeria? (And When Do You Need One)',
    description: 'Everything you need to know about the Letter of Demand under Nigerian law: what it is, when to send one, and what happens if it is ignored.',
    date: '2026-06-08',
    readTime: '5 min read',
    category: 'Debt Recovery',
    author: DEFAULT_AUTHOR,
    content: `
<p>A Letter of Demand is a formal written notice from a creditor to a debtor, demanding payment of an outstanding debt within a specified period. In Nigeria, it is one of the most important steps before taking legal action, and in many cases, it is enough to get you paid without ever going to court.</p>

<h2>Is a Letter of Demand Legally Required in Nigeria?</h2>
<p>For most civil debt claims, Nigerian courts expect you to have first given the debtor a reasonable opportunity to pay before suing. The Pre-Action Protocol for the Small Claims Court explicitly requires a Letter of Demand. Even in higher courts, judges look unfavourably on claimants who rushed to sue without first making a formal demand.</p>
<p>More practically: most debtors will pay once they receive a letter on legal letterhead, because it signals you are serious and know your rights.</p>

<h2>What Must a Letter of Demand Contain?</h2>
<p>A valid Nigerian Letter of Demand should include:</p>
<ul>
  <li>Your full name and address (the creditor)</li>
  <li>The debtor's full name and address</li>
  <li>The exact amount owed, in Nigerian Naira</li>
  <li>How the debt arose (invoice for goods/services, loan, contract breach, etc.)</li>
  <li>The date the debt became due</li>
  <li>A clear deadline, typically 7 to 14 days</li>
  <li>A warning that legal action will follow if the debt is not paid</li>
  <li>A statement reserving all your legal rights</li>
</ul>

<h2>How Should It Be Served?</h2>
<p>The letter should be delivered in a way that creates proof of service:</p>
<ul>
  <li><strong>Personal service</strong>: hand-delivered to the debtor with a witness</li>
  <li><strong>Registered courier</strong>: with proof of delivery</li>
  <li><strong>Email</strong>: if agreed or if the debtor has used email for all prior communications</li>
  <li><strong>Process server</strong>: a licensed agent who files an affidavit of service</li>
</ul>
<p>Pandas LP can serve the letter on your behalf through our delivery service: we handle the logistics and provide proof of service.</p>

<h2>What Happens After 7 Days?</h2>
<p>Three possible outcomes:</p>
<ol>
  <li><strong>The debtor pays</strong>: the most common outcome. The matter is resolved.</li>
  <li><strong>The debtor responds and disputes the debt</strong>: you now have their position in writing and can assess whether to negotiate or proceed to court.</li>
  <li><strong>The debtor ignores the letter</strong>: you have grounds to file a court claim. The court will note that you gave the debtor a fair opportunity to pay.</li>
</ol>

<h2>Does the Letter Need to Be on Law Firm Letterhead?</h2>
<p>Technically, no. You can send a Letter of Demand yourself. But letters on professional legal letterhead carry significantly more weight. Debtors are far more likely to take a letter from a law firm seriously than one they suspect was drafted informally.</p>
<p>Pandas LP drafts your Letter of Demand on our official firm letterhead at a fraction of what a traditional law firm would charge.</p>

<h2>How Much Does It Cost?</h2>
<p>A Letter of Demand from Pandas LP starts from <strong>₦10,000</strong> for a self-serve PDF. If you want Pandas LP to serve it on the debtor on your behalf, the fee is <strong>₦25,000</strong>.</p>
    `,
  },
  {
    slug: 'what-happens-if-you-ignore-a-letter-of-demand',
    title: 'What Happens If You Ignore a Letter of Demand in Nigeria?',
    description: 'If you receive a Letter of Demand and do nothing, here is exactly what the creditor can do next, and why ignoring it is almost always the wrong move.',
    date: '2026-06-15',
    readTime: '4 min read',
    category: 'Debt Recovery',
    author: DEFAULT_AUTHOR,
    content: `
<p>If you have received a Letter of Demand in Nigeria and are wondering whether you can simply ignore it, the short answer is that you can, but it will cost you significantly more in the end.</p>
<p>This article explains what happens next from the creditor's perspective, so whether you are the one owed money or the one receiving the letter, you understand the legal process.</p>

<h2>What Happens at the End of the Deadline?</h2>
<p>A Letter of Demand typically gives the debtor 7 to 14 days to pay or respond. When that deadline passes with no response, the creditor has several options.</p>

<h2>Option 1: File at the Small Claims Court</h2>
<p>For debts up to ₦5,000,000 in Lagos (limits vary by state), the creditor can immediately file at the Small Claims Court. The court will issue a Summons on the debtor: a formal court document requiring them to appear. Ignoring a court summons is far more serious than ignoring a letter.</p>
<p>In an uncontested claim (where the debtor does not show up or does not dispute the debt), the creditor can obtain a <strong>default judgment</strong>: a court order stating the debtor must pay. This typically happens within 30 days of filing.</p>

<h2>Option 2: File in the Magistrates' or High Court</h2>
<p>For larger debts, the creditor can file in the Magistrates' Court (above SCC limits) or the High Court. These courts have greater enforcement powers and the proceedings are more formal.</p>

<h2>What Can the Creditor Do With a Court Judgment?</h2>
<p>Once a judgment is obtained, the creditor can enforce it in several ways:</p>
<ul>
  <li><strong>Garnishee Order</strong>: A court order that attaches money directly from the debtor's bank account</li>
  <li><strong>Writ of Execution</strong>: A sheriff seizes and sells the debtor's assets to satisfy the judgment</li>
  <li><strong>Attachment of Earnings</strong>: The debtor's employer is ordered to deduct money from their salary</li>
  <li><strong>Oral Examination</strong>: The debtor is summoned to court and must disclose all their assets under oath</li>
</ul>

<h2>Does Ignoring the Letter Make It Worse?</h2>
<p>Yes, in two important ways:</p>
<ol>
  <li><strong>Cost escalation</strong>: Court costs, filing fees, and legal costs are added on top of the original debt. If the creditor wins (which they usually do in clear debt cases), they can ask the court to make the debtor pay these costs too.</li>
  <li><strong>Loss of negotiating power</strong>: Before filing, the creditor may be open to a payment plan or partial settlement. Once a court judgment is obtained, the full amount plus costs is owed, no negotiation.</li>
</ol>

<h2>If You Dispute the Debt</h2>
<p>If you receive a Letter of Demand and you genuinely dispute the debt (wrong amount, already paid, goods never delivered), you should respond in writing within the deadline, clearly stating your position. Silence is treated as acceptance. A written response creates a record and may avoid court entirely.</p>

<h2>If You Are the Creditor</h2>
<p>If your Letter of Demand has been ignored, Pandas LP can file the court claim on your behalf. Our Small Claims Agent pre-loads all the information from your original case, so you don't need to repeat yourself.</p>
    `,
  },
  {
    slug: 'can-you-sue-for-small-amount-nigeria',
    title: 'Can You Sue Someone for a Small Amount in Nigeria? (₦50,000 to ₦5 Million)',
    description: 'Yes, and it is cheaper and faster than most people realise. Here is how the Small Claims Court works for smaller debts in Nigeria.',
    date: '2026-06-22',
    readTime: '5 min read',
    category: 'Debt Recovery',
    author: DEFAULT_AUTHOR,
    content: `
<p>A common misconception in Nigeria is that going to court is only worth it for large amounts, that suing over ₦50,000 or even ₦500,000 is too expensive or complicated to bother with. This is no longer true.</p>
<p>The Small Claims Court was designed specifically to make it practical to recover smaller debts, without needing a lawyer and without spending more on legal fees than the amount you are owed.</p>

<h2>What Is the Minimum Amount You Can Sue For?</h2>
<p>There is no formal minimum. The Small Claims Court rules do not set a floor. In practice, however, you should weigh the court filing fee against the amount owed:</p>
<ul>
  <li>Filing fees in Lagos typically range from <strong>₦3,000 to ₦15,000</strong> depending on the claim amount</li>
  <li>For claims below ₦50,000, the cost-benefit may be tight, but sending a well-drafted Letter of Demand alone often produces payment without filing at all</li>
  <li>For claims of ₦50,000 and above, the Small Claims Court is almost always worth it</li>
</ul>

<h2>What Is the Maximum Amount for Small Claims?</h2>
<p>This varies by state:</p>
<ul>
  <li><strong>Lagos State</strong>: ₦5,000,000</li>
  <li><strong>FCT (Abuja)</strong>: ₦5,000,000</li>
  <li><strong>Rivers State</strong>: ₦2,000,000</li>
  <li><strong>Other states</strong>: Check your state's Magistrates' Court rules (most have been updated in the last 5 years)</li>
</ul>
<p>For amounts above the Small Claims limit, you would file in the Magistrates' Court or High Court, but these require more formal procedure and usually a lawyer.</p>

<h2>Do You Need a Lawyer?</h2>
<p>No, and in fact, the Lagos Small Claims Court rules <strong>prohibit legal representation</strong>. Both parties appear personally. This was intentional: the system was designed so that ordinary people could represent themselves without legal training.</p>
<p>However, you still need properly prepared documents: Form SCA 1, Form SCA 2, a Letter of Demand, and organised evidence. This is where Pandas LP helps: we prepare everything for you, and you file and appear yourself.</p>

<h2>Common Debts That Qualify</h2>
<ul>
  <li>Unpaid invoices for goods or services</li>
  <li>Personal loans not repaid</li>
  <li>Rent arrears (where recovery of premises is not also in dispute)</li>
  <li>Deposits not returned</li>
  <li>Contractor fees owed</li>
  <li>Salary unpaid by an employer</li>
  <li>Goods paid for but never delivered</li>
</ul>

<h2>What Debts Cannot Go to Small Claims?</h2>
<ul>
  <li>Land disputes or title claims</li>
  <li>Claims involving defamation</li>
  <li>Criminal matters</li>
  <li>Matters involving government agencies (different procedure)</li>
  <li>Amounts above the monetary limit for that state</li>
</ul>

<h2>How Long Does It Take?</h2>
<p>The Lagos Small Claims Court aims to resolve cases within 60 days. In practice:</p>
<ul>
  <li>Uncontested claims (defendant doesn't show up or doesn't dispute): <strong>30 to 45 days</strong></li>
  <li>Contested claims (defendant appears and disputes): <strong>60 to 120 days</strong></li>
</ul>
<p>This is substantially faster than a regular court case, which can take years.</p>

<h2>Start Your Claim with Pandas LP</h2>
<p>Our Small Claims Agent interviews you, drafts your Letter of Demand, prepares Forms SCA 1 and SCA 2, and, if needed, files the claim and represents you in court. Starting from ₦10,000.</p>
    `,
  },
  {
    slug: 'mistakes-to-avoid-recovering-a-debt-in-nigeria',
    title: '3 Mistakes to Avoid When Recovering a Debt in Nigeria',
    description: 'The most common mistakes people make chasing unpaid debts in Nigeria, and the simple fixes that actually get you paid, according to the law.',
    date: '2026-07-25',
    readTime: '5 min read',
    category: 'Debt Recovery',
    author: DEFAULT_AUTHOR,
    content: `
<p>Someone owes you money. They keep promising "next week." Weeks turn into months. If this sounds familiar, you are not alone, and the way most people handle it in Nigeria almost guarantees they never get paid.</p>
<p>Here are the three mistakes we see constantly, and what to do instead.</p>

<h2>Mistake 1: Everything Stays Verbal</h2>
<p>Calls. WhatsApp voice notes. "I'll send it next week, I promise." Nothing ever gets written down that states the amount owed, what it was for, and when it was due.</p>
<p>This feels harmless in the moment: you trust them, or you don't want to make things awkward. But the day you finally decide to act, you have nothing to act on. No court, and no lawyer writing a demand letter, can point to a specific, provable debt if there's no record of one.</p>
<p><strong>The fix:</strong> put the debt in writing today, even informally. A text message stating the amount and the due date, which they reply to and acknowledge (even with something as simple as "yes, I'll pay by Friday") changes your legal position completely. It turns a vague understanding into evidence.</p>

<h2>Mistake 2: Waiting Too Long</h2>
<p>The longer a debt sits unpaid, the harder it becomes to recover. Debtors relocate. Businesses close down or change names. Conversations get deleted or "forgotten." Memories conveniently fade about what was agreed.</p>
<p>Time also matters in a way most people don't realise: under Nigerian law, debts don't stay enforceable forever. The Limitation Law in most states gives you a fixed window (typically six years for a simple contract debt) after which a court can refuse to hear your claim at all, no matter how clearly you were owed.</p>
<p><strong>The fix:</strong> if a debt is 60 days or more overdue and the excuses have started repeating themselves, that's your signal to escalate, not wait for a "better time."</p>

<h2>Mistake 3: Going From Zero Straight to a Fight</h2>
<p>Public callouts on social media. Threatening messages. Showing up unannounced at someone's home or office. It feels justified, and for a day it might even feel good, but it can expose <em>you</em> to legal liability, for defamation, harassment, or worse, while doing nothing to actually secure your money.</p>
<p>The correct escalation is far less dramatic, and it works: a formal Letter of Demand. It states the amount owed, the basis of the debt, a clear deadline to pay, and what happens if that deadline passes.</p>
<p><strong>The fix:</strong> skip the confrontation. A demand letter on a law firm's letterhead does two things a WhatsApp message never can: it shows the debtor you are serious enough to involve a lawyer, and it creates the exact paper trail a court will expect to see if the matter ever gets that far. Many disputes never go past this single letter.</p>

<h2>Putting It Together</h2>
<p>None of this requires you to be aggressive, or to already have a lawyer on retainer. It requires getting the debt in writing, acting before too much time passes, and escalating in the order the law actually respects: demand first, court second, enforcement third.</p>

<h2>Start Your Claim with Pandas LP</h2>
<p>Our Small Claims Agent interviews you, drafts a proper Letter of Demand on firm letterhead, and, if it's ignored, prepares your court filing. Starting from ₦10,000. See our full <a href="/recover-debt/lagos">guide to recovering a debt in Lagos</a> for claim limits and court locations in your state.</p>
<p><em>P.S.: We're covering all of this live on X Spaces, Thursday 30 July at 7PM WAT, with a lawyer taking questions. Find us at @PandasLP on X.</em></p>
    `,
  },
  {
    slug: 'how-to-register-a-business-in-nigeria-cac',
    title: 'How to Register a Business in Nigeria (CAC Registration Explained)',
    description: 'Business Name or Limited Company? Here is exactly what CAC registration involves in Nigeria, what each option costs, and how to choose between them.',
    date: '2026-07-26',
    readTime: '6 min read',
    category: 'Business Registration',
    author: DEFAULT_AUTHOR,
    content: `
<p>Every legitimate business in Nigeria has to be registered with the Corporate Affairs Commission (CAC). It's what turns "a thing you do to make money" into a recognised legal entity that can open a business bank account, sign contracts, and be taken seriously by clients and partners. Here's what that actually involves.</p>

<h2>Business Name vs. Limited Company: Which Do You Need?</h2>
<p>This is the first decision, and it matters more than most people realise.</p>
<ul>
  <li><strong>Business Name (BN)</strong>: the simpler, cheaper option. You (or you and a partner) register a trading name. There's no separation between you and the business legally, so you're personally liable for its debts and obligations. Fastest to set up, fine for freelancers, small traders, and sole proprietors.</li>
  <li><strong>Limited Company (Ltd/RC)</strong>: creates a separate legal entity from its owners. Shareholders' liability is limited to what they've invested. Needed if you want to raise investment, bring in shareholders, or simply want the legal separation between you and the business. More paperwork, higher cost, but the standard choice once a business is past its earliest stage.</li>
</ul>
<p>Neither is "better," they suit different situations. A one-person consulting practice rarely needs the complexity of a Limited Company. A startup planning to raise money from investors needs one from day one, because investors generally can't take equity in a Business Name.</p>

<h2>What You Need Before You Start</h2>
<ul>
  <li>Two proposed names, in order of preference (CAC checks availability and can reject names too similar to an existing one)</li>
  <li>A valid means of identification (National ID, international passport, or driver's license) for every proprietor/director</li>
  <li>A passport photograph for each proprietor/director</li>
  <li>A registered business address</li>
  <li>For a Limited Company: at least one director and one shareholder (can be the same person), and details of share allocation</li>
</ul>

<h2>The Registration Process</h2>
<ol>
  <li><strong>Name reservation</strong>: submit your proposed name(s) via the CAC portal (post.cac.gov.ng) for availability check and reservation, valid for 60 days.</li>
  <li><strong>Complete the registration form</strong>: Form CAC-BN1 for a Business Name, or the incorporation forms (including CAC-IT1) for a Limited Company.</li>
  <li><strong>Upload documents</strong>: ID, passport photograph, and (for a Limited Company) your Memorandum and Articles of Association.</li>
  <li><strong>Pay the CAC fee</strong>: varies by structure and, for a Limited Company, by share capital.</li>
  <li><strong>Receive your certificate</strong>: a Business Name typically takes a few days; a Limited Company can take longer depending on CAC's processing volume.</li>
</ol>

<h2>What You Get at the End</h2>
<p>A Business Name registration gives you a BN number and a status report you can print. This is what most banks accept to open a business account. A Limited Company registration gives you an RC number, a Certificate of Incorporation, and your Memorandum & Articles: the fuller legal identity a growing business needs.</p>
<p><strong>A note from experience:</strong> Pandas LP itself is registered as a Business Name (BN 9646741), not a Limited Company. For a firm at our stage, that was the right call, and it's worth genuinely thinking through which structure fits your business rather than defaulting to whichever sounds more official.</p>

<h2>Common Mistakes</h2>
<ul>
  <li>Choosing a name too similar to an existing registered business, which wastes the reservation and delays everything</li>
  <li>Registering a Business Name when you actually need investor-ready structure, then having to convert later</li>
  <li>Using a residential address that later causes issues opening a business bank account</li>
  <li>Missing the 60-day name reservation window and having to start over</li>
</ul>

<h2>Register with Pandas LP</h2>
<p>Our CAC Registration Agent walks you through the choice between a Business Name and a Limited Company, prepares your CAC forms, and guides you through submission, from ₦15,000.</p>
    `,
  },
  {
    slug: 'what-is-governors-consent-nigeria-property',
    title: "What Is a Governor's Consent, and Why Does Your Property Transfer Need It?",
    description: "Under the Land Use Act, a Nigerian property transfer without the Governor's Consent doesn't actually transfer anything. Here's what consent is, when it's required, and what happens if a deal skips it.",
    date: '2026-09-13',
    readTime: '7 min read',
    category: 'Property Law',
    author: DEFAULT_AUTHOR,
    faqs: [
      {
        question: "What is Governor's Consent in Nigeria?",
        answer: "It's the state Governor's approval, required under the Land Use Act, before a right of occupancy over land can be validly transferred, mortgaged, or subleased. Nigerian land law does not give individuals absolute ownership of land itself — it's held in trust by the Governor of the state, and a right of occupancy is what an individual or company actually holds.",
      },
      {
        question: "Do I need Governor's Consent to sell my house?",
        answer: "If what you hold is a right of occupancy (which covers the great majority of privately held land in Nigeria), then yes — assigning that right to a buyer requires the Governor's prior consent to be valid. This applies whether the sale is documented as a Deed of Assignment or any other form of transfer.",
      },
      {
        question: "What happens if a property is sold without Governor's Consent?",
        answer: "The transaction does not effectively pass title until consent is obtained. This has real practical consequences: the buyer cannot safely rely on the transfer, a mortgage lender will generally refuse to lend against the property, and a subsequent buyer or the seller's other creditors can create genuine problems for whoever is left holding an unconsented transfer. Consent sought and obtained later can regularise a transaction, which is exactly why it should be pursued as part of the sale, not treated as optional paperwork.",
      },
      {
        question: "Does every lease need Governor's Consent?",
        answer: "Short, ordinary tenancies generally don't. It's leases and subleases granted for a longer fixed term, along with an outright assignment or a mortgage, that fall within the alienations the Land Use Act requires consent for. Where the exact line sits for a specific lease is worth confirming for the term actually being granted, since getting this wrong is a common and expensive mistake.",
      },
      {
        question: "Is the Governor's Consent fee the same as Pandas LP's fee?",
        answer: "No — they're two separate things. The Governor's Consent fee, stamp duty, and registration charges are government fees, assessed by the state and paid to it directly. Pandas LP's 2.5% is our professional fee for drafting the Deed of Assignment and handling the consent application itself; it is invoiced separately and is not a substitute for the government charges.",
      },
    ],
    content: `
<p>A surprising number of Nigerian property disputes trace back to the same missing step: nobody applied for Governor's Consent, or the deal closed before it came through. The buyer paid, the seller handed over the keys, and years later a bank, an heir, or a second buyer surfaces to say the transfer was never actually valid.</p>

<p>Here's what Governor's Consent actually is, why Nigerian land law requires it at all, and what it takes to get it right.</p>

<h2>Why a "sale" of land in Nigeria needs government permission at all</h2>
<p>The starting point is the Land Use Act 1978, which changed the basic structure of land ownership in Nigeria. Rather than individuals holding land outright, all land in a state is vested in the Governor, held in trust for the people of that state. What an individual, family, or company holds instead is a <strong>right of occupancy</strong>: the right to use and possess a specific piece of land, evidenced by a Certificate of Occupancy or an equivalent instrument, rather than absolute ownership of the land itself.</p>
<p>Because the underlying land sits with the Governor, transferring a right of occupancy from one person to another — an <strong>alienation</strong>, in the Act's own language — requires the Governor's consent to be effective. This covers an assignment (a sale or transfer of the right of occupancy itself), a mortgage over it, and a sublease or lease for a longer term.</p>

<h2>What actually needs consent</h2>
<ul>
  <li><strong>An assignment</strong> — a sale or any other transfer of the right of occupancy from one party to another.</li>
  <li><strong>A mortgage</strong> — using the right of occupancy as security for a loan.</li>
  <li><strong>A lease or sublease for a longer term</strong> — ordinary, short periodic tenancies generally sit outside this, but a lease granted for a longer fixed term typically falls within it. Where exactly that line sits for a specific lease is a detail worth confirming for the actual term being granted, rather than assuming either way.</li>
</ul>
<p>A straightforward monthly or yearly tenancy of the kind covered in our <a href="/blog/how-to-evict-a-tenant-legally-in-lagos">guide to notice periods and recovery of possession</a> is a different thing entirely from an assignment or a long lease, and does not itself require Governor's Consent.</p>

<h2>What happens if a transfer skips it</h2>
<p>An assignment made without the Governor's prior consent does not effectively transfer the right of occupancy. In practice, this means the buyer cannot safely rely on having good title until consent is actually obtained — even after money has changed hands and possession has passed. Consent sought and obtained afterwards can regularise the position, which is exactly why chasing it down is worth doing rather than treating it as a formality nobody will ever ask about.</p>
<p>The real-world cost of skipping it shows up later, usually at the worst possible time: a bank refusing to accept the property as mortgage security, a subsequent buyer's own search turning up an irregular title history, or a family dispute over a deceased owner's estate reopening a transfer nobody thought would ever be examined again.</p>

<h2>Getting consent — what to expect</h2>
<p>The application goes to the relevant state Lands Bureau (in Lagos, the Lagos State Lands Bureau) with the executed instrument, evidence of the underlying right of occupancy, and payment of the assessed consent fee, stamp duty, and registration charges. These are separate, government-assessed sums — not a fixed, published fee schedule — and processing time varies considerably by state and by how complete the application is. Building in a realistic timeline, rather than assuming a same-week turnaround, avoids a lot of unnecessary pressure on a closing.</p>

<h2>What Pandas LP does</h2>
<p>Our Deed of Assignment includes the Governor's Consent undertaking as part of the instrument, invoiced at <strong>2.5% of the consideration</strong> — that figure is our professional fee for drafting the deed and handling the consent application, separate from and in addition to the government's own consent fee, stamp duty, and registration charges, which are assessed and paid directly to the state.</p>
<p>It will not invent a Certificate of Occupancy number, plot number, or consideration figure that hasn't actually been supplied, and where ownership is disputed, litigation is already live, or the matter otherwise sits outside a straightforward transfer, it escalates to a practitioner rather than drafting around the problem.</p>

<p><em>This article is general information about Nigerian land law and is not legal advice on your specific transaction. Requirements and processing vary between states, and the facts of a particular transfer can change the position.</em></p>
    `,
  },
  {
    slug: 'deed-of-assignment-vs-deed-of-gift-nigeria',
    title: "Deed of Assignment vs. Deed of Gift: Why They're Not the Same Document",
    description: "Selling property and gifting it outright are legally different transactions in Nigeria. Using a Deed of Assignment to disguise a gift, or the reverse, can put the transfer at real risk.",
    date: '2026-09-16',
    readTime: '6 min read',
    category: 'Property Law',
    author: DEFAULT_AUTHOR,
    faqs: [
      {
        question: 'What is the difference between a Deed of Assignment and a Deed of Gift?',
        answer: "A Deed of Assignment transfers a right of occupancy in exchange for consideration — a purchase price paid by the buyer. A Deed of Gift transfers it with no consideration at all: a genuine gift, most often between family members. The instruments record two legally different transactions, not two names for the same one.",
      },
      {
        question: 'Does a Deed of Gift still need Governor\'s Consent?',
        answer: "Yes. Consent under the Land Use Act attaches to the alienation of the right of occupancy itself, not to whether money changed hands. A gift is still an alienation, so it still needs the Governor's consent to be valid, the same as a sale does.",
      },
      {
        question: "Can I use a Deed of Assignment for a property I'm giving away for free?",
        answer: "You shouldn't. Recording a genuine gift as a sale, often to show a token or reduced consideration figure, creates a document that misstates the actual transaction. That mismatch can surface later in a dispute among the giver's heirs, in a tax query over an understated price, or in a subsequent buyer's title search — and it's the kind of thing that's far cheaper to avoid at drafting stage than to untangle afterward.",
      },
      {
        question: 'Why does the distinction affect stamp duty?',
        answer: "Stamp duty on a Deed of Assignment is generally calculated as a percentage of the stated consideration, so it rises and falls with the sale price. A Deed of Gift has no consideration figure to calculate that percentage from, so it's treated differently. Recording the wrong transaction type doesn't just misdescribe the deal — it can misstate what's actually owed.",
      },
    ],
    content: `
<p>"It's basically the same thing, just put whatever price on it" is one of the more expensive sentences in Nigerian property practice. A sale and a gift are different transactions in law, and the deed has to say which one actually happened.</p>

<h2>A Deed of Assignment: a transfer for a price</h2>
<p>A Deed of Assignment transfers a right of occupancy from the assignor to the assignee in exchange for <strong>consideration</strong> — a purchase price, stated as a specific figure. That figure isn't decorative: it's what stamp duty is calculated against, it's what the Governor's Consent application is assessed on, and it's the number a later buyer's own title search will measure the property's history against.</p>

<h2>A Deed of Gift: a transfer for nothing</h2>
<p>A Deed of Gift transfers the right of occupancy with no consideration at all. It's the instrument for a genuine gift — a parent transferring property to a child, a transfer between spouses, or a transfer made as part of settling a family estate. It still requires Governor's Consent, because consent attaches to the alienation of the right of occupancy, not to whether a price was paid. What it doesn't have is a consideration figure to calculate stamp duty from in the way an assignment does.</p>

<h2>Why the two get confused, and why that's a problem</h2>
<p>The confusion usually comes from trying to make a gift look like a sale, or the reverse — most often to show a lower price than what actually changed hands, or because nobody thought the label mattered as long as the property "moved." It matters for three reasons:</p>
<ul>
  <li><strong>Stamp duty and consent fees</strong> are assessed differently depending on which transaction actually happened, so misdescribing it can misstate what's owed.</li>
  <li><strong>A challenge from other family members or heirs</strong> is far easier to bring against a "sale" that was really a gift with an invented price, since the paper trail itself becomes evidence of something irregular.</li>
  <li><strong>A later buyer's title search</strong> reads the deed for what it says happened. A mismatch between the deed's story and the real history of the property is exactly what a diligent search is built to catch, and exactly what causes a sale to stall or collapse.</li>
</ul>

<h2>What Pandas LP drafts</h2>
<p>We draft each as its own instrument, matched to the transaction actually taking place rather than the transaction it's convenient to describe. A Deed of Assignment is invoiced at 2.5% of the actual consideration; a Deed of Gift, with no consideration figure to calculate a percentage from, is <strong>₦30,000</strong>. Neither is relabelled as the other. It will not invent a consideration figure that hasn't been confirmed, and where the facts suggest something more complicated than a straightforward gift or sale — a disputed estate, an unclear chain of prior title — it escalates to a practitioner rather than guessing at the right instrument.</p>

<p><em>This article is general information about Nigerian land law and is not legal advice on your specific transaction. Stamp duty rates, consent fees, and processing requirements vary between states.</em></p>
    `,
  },
  {
    slug: 'tenancy-agreement-vs-lease-agreement-nigeria',
    title: "Tenancy Agreement vs. Lease Agreement in Nigeria: What's Actually Different?",
    description: 'The two terms get used interchangeably in everyday conversation, but a short periodic tenancy and a longer fixed-term lease follow different rules in Nigeria — including whether Governor\'s Consent applies.',
    date: '2026-09-19',
    readTime: '6 min read',
    category: 'Property Law',
    author: DEFAULT_AUTHOR,
    faqs: [
      {
        question: 'Is a tenancy agreement the same as a lease agreement in Nigeria?',
        answer: "In everyday conversation, yes, people use them interchangeably. Legally, they describe different arrangements. A tenancy is typically a shorter, periodic arrangement — weekly, monthly, quarterly, or yearly — governed by the tenancy law of the state the property sits in. A lease is typically a longer, fixed-term arrangement agreed for a set number of years up front.",
      },
      {
        question: 'How does a lease end differently from a tenancy?',
        answer: "A periodic tenancy is ended by serving the correct notice to quit for that tenancy type, as covered in our guide to recovery of possession. A fixed-term lease is agreed to run for a set period and generally expires automatically at the end of that term, though re-entry for a breach during the term still has to follow proper procedure rather than self-help.",
      },
      {
        question: 'Does a long lease need Governor\'s Consent when a short tenancy does not?',
        answer: "Generally, yes — an ordinary short tenancy typically sits outside the Land Use Act's consent requirement, while a lease granted for a longer fixed term is more likely to fall within it. Exactly where that line sits for a specific arrangement is worth confirming against the actual term being agreed.",
      },
      {
        question: 'Which one do I need for my situation?',
        answer: "It follows from the facts, not from which word sounds more formal: how long the arrangement is meant to run, whether there's a lump-sum premium in addition to or instead of ongoing rent, and what both sides actually intend to happen at the end. Describing the real arrangement clearly is what determines which structure — and which statutory rules — actually apply.",
      },
    ],
    content: `
<p>Landlords and tenants in Nigeria use "tenancy agreement" and "lease agreement" almost interchangeably in conversation. The law doesn't treat them as interchangeable, and which one actually applies to a given arrangement decides how it can be ended, and whether Governor's Consent comes into the picture at all.</p>

<h2>A tenancy: short, periodic, and governed by tenancy law</h2>
<p>A tenancy runs in recurring periods — weekly, monthly, quarterly, or yearly — and is governed by the tenancy legislation of the state the property is in (the Lagos State Tenancy Law 2011, for property in Lagos). It doesn't automatically renew forever, but it continues period to period until it's properly ended. Ending one means serving the correct statutory notice to quit for that tenancy type — the subject of our <a href="/blog/how-to-evict-a-tenant-legally-in-lagos">guide to notice periods and recovery of possession</a> — not simply telling the tenant to leave.</p>

<h2>A lease: a fixed term, agreed up front</h2>
<p>A lease is granted for a specific, agreed term — a set number of years fixed at the outset, rather than running period to period. It often involves a premium (a lump sum paid up front) in addition to or instead of ongoing rent, and it generally comes to an end automatically once the agreed term expires, rather than needing the same notice-to-quit process a periodic tenancy does. Ending it early for a breach still has to follow proper procedure, not a change of the locks.</p>
<p>A lease granted for a longer fixed term is also more likely to require Governor's Consent under the Land Use Act, the subject of our <a href="/blog/what-is-governors-consent-nigeria-property">guide to Governor's Consent</a> — a distinction that generally doesn't arise for an ordinary short tenancy at all.</p>

<h2>Why getting the label right actually matters</h2>
<p>Calling a long, fixed-term arrangement a "tenancy," or a short periodic arrangement a "lease," isn't just a wording choice. It affects which notice provisions apply when things need to end, whether Governor's Consent should have been sought before the arrangement started, and what either side can reasonably expect to happen once the term is up. A document that describes the arrangement accurately, rather than borrowing whichever word sounds more official, is what actually protects both sides when a dispute arises.</p>

<h2>What Pandas LP drafts</h2>
<p>Tenancy agreements and lease agreements are drafted under the same service, at <strong>₦25,000</strong> per document, because which structure applies follows from the facts of the arrangement — the term, the payment structure, what's actually agreed — not from which word the client used to describe it. It will not freehand a structure the facts don't support, and where an arrangement is genuinely unusual or contested, it escalates to a practitioner rather than guessing.</p>

<p><em>This article is general information about Nigerian property law and is not legal advice on your specific arrangement. Tenancy legislation and consent requirements vary between states.</em></p>
    `,
  },
  {
    slug: 'can-ai-draft-valid-letter-of-demand-nigeria',
    title: 'Can an AI Draft a Legally Valid Letter of Demand in Nigeria?',
    description: "A Letter of Demand isn't a fixed statutory form, so the question isn't whether AI can produce one — it's whether the facts are right and a licensed practitioner has actually signed it. Here's what makes one hold up.",
    date: '2026-09-22',
    readTime: '6 min read',
    category: 'Debt Recovery',
    author: DEFAULT_AUTHOR,
    faqs: [
      {
        question: 'Is a Letter of Demand drafted by AI legally valid in Nigeria?',
        answer: "There's no rule against a document being drafted with the help of AI, the same way there's no rule against drafting one in a word processor instead of by hand. What makes a Letter of Demand effective is that it accurately states the amount owed, the basis for the claim, and a real deadline, and that it's reviewed and signed by a licensed legal practitioner before it goes out — not the tool used to produce the first draft.",
      },
      {
        question: 'Does a Letter of Demand have to follow a specific format?',
        answer: "No single statutory form is prescribed for a Letter of Demand the way it is for some court documents. What matters is substance: it has to clearly identify the debtor, state the amount owed and how it arose, and give a genuine deadline to pay before further action follows. A vague or unsupported demand is weak regardless of how official it looks.",
      },
      {
        question: 'Why does a lawyer need to sign an AI-drafted letter?',
        answer: "Signature by a licensed practitioner is what puts real, accountable weight behind the letter — it tells the recipient a lawyer has actually looked at the claim and is prepared to stand behind it, not just that a form was filled in. It's also the point where an inaccurate figure, an overstated claim, or a legal error gets caught before it's sent, not after.",
      },
      {
        question: 'Can an AI agent decide whether my claim is strong?',
        answer: "Not honestly, no — and one that claims to is overselling. Pandas LP's own debt recovery agent is explicit about this: it will not predict your odds of winning or guarantee an outcome. What it can usefully do is tell you where your evidence is thin, which is a more useful answer than a false confidence score.",
      },
    ],
    content: `
<p>"Can a robot really write a legal letter?" undersells what's actually being asked. The real question is whether the letter that goes out is accurate, properly reasoned, and something a lawyer is willing to put their name to — and that question has the same answer whether the first draft came from an AI, a template, or a solicitor typing from scratch.</p>

<h2>A Letter of Demand isn't a fixed statutory form</h2>
<p>Unlike some court documents, there's no single prescribed format a Letter of Demand has to follow. What makes one effective is substance, not form: it has to name the debtor correctly, state the sum owed and how it arose, reference any relevant agreement or transaction, and give a genuine deadline before further action follows. Our existing guides to <a href="/blog/what-is-a-letter-of-demand-nigeria">what a Letter of Demand actually is</a> and <a href="/blog/what-happens-if-you-ignore-a-letter-of-demand">what happens if one is ignored</a> cover the substance in more detail.</p>

<h2>So what does "AI-drafted" actually change?</h2>
<p>Very little, if the process around it is right. Drafting is the mechanical part: taking the facts of a dispute and assembling them into the letter's structure. An AI system can do this competently, the same way a well-built template does — the risk was never in who or what assembles the words, it's in whether the facts going in are accurate and whether anyone with legal judgment checks the result before it goes out.</p>
<p>That's the part that shouldn't be automated away, and it's the part Pandas LP's own agent is built not to skip. It drafts the letter from what you tell it. A licensed legal practitioner then reviews and signs it before it's served — because an unsigned letter, however well-worded, doesn't carry the same weight as one a lawyer has actually put their name to.</p>

<h2>Where an AI-only approach actually fails</h2>
<ul>
  <li><strong>Inventing authority.</strong> A demand letter that cites a statute section, a case, or a monetary limit that doesn't actually apply is worse than one that cites nothing — it hands the debtor's own lawyer an easy line of attack. Pandas LP's agent is explicitly built not to do this: unsure of a figure or a provision, it asks rather than guesses.</li>
  <li><strong>Predicting an outcome.</strong> No honest system, human or otherwise, can guarantee a debtor will pay or that a court will rule a particular way. What's actually useful is an honest read on where the evidence is strong or thin, not a false confidence score.</li>
  <li><strong>Skipping the escalation point.</strong> A claim above the Small Claims threshold, a disputed liability, or anything with a hint of fraud needs a practitioner's judgment, not a template. Pandas LP's agent is built to hand these off rather than draft around them.</li>
</ul>

<h2>What actually makes a demand letter hold up</h2>
<ol>
  <li>An accurate, specific figure — not a rounded estimate or a vague reference to "outstanding amounts."</li>
  <li>A clear statement of how the debt arose, with dates and reference numbers where they exist.</li>
  <li>A real, stated deadline to pay.</li>
  <li>Review and signature by a licensed legal practitioner before it's sent.</li>
  <li>Proof it was actually served, since the court will expect evidence a demand was sent before a claim is filed.</li>
</ol>

<h2>How Pandas LP does it</h2>
<p>Our <a href="/agents/debt-recovery">Debt Recovery Agent</a> interviews you in plain language, drafts the Letter of Demand, and a licensed practitioner reviews and signs it before it's served — from ₦10,000 to draft and serve it yourself, or ₦25,000 for Pandas LP to serve it on your behalf. What it won't do is published on its own page: see <a href="/agents/debt-recovery/limits">where the AI stops and a lawyer starts</a>.</p>

<p><em>This article is general information about Nigerian debt recovery practice and is not legal advice on your specific claim.</em></p>
    `,
  },
  {
    slug: 'small-claims-court-vs-magistrate-court-nigeria',
    title: 'Small Claims Court vs. Magistrate Court in Nigeria: Which One Handles Your Debt?',
    description: "In most states, the Small Claims Court isn't a separate courthouse — it's a simplified track inside the Magistrate Court, for claims under a fixed limit. Here's how the two actually differ.",
    date: '2026-09-25',
    readTime: '6 min read',
    category: 'Debt Recovery',
    author: DEFAULT_AUTHOR,
    faqs: [
      {
        question: 'Is the Small Claims Court a different court from the Magistrate Court?',
        answer: "Usually not a separate courthouse — in most states that have set one up, the Small Claims Court operates as a dedicated, simplified track or registry within the Magistrate Court system, following its own Practice Direction rather than the ordinary civil procedure rules.",
      },
      {
        question: 'What makes a claim eligible for the Small Claims Court?',
        answer: "A simple, liquidated money claim — a specific, undisputed sum owed to you — under the claim limit set by that state's Practice Direction. It does not hear land disputes, criminal matters, or claims where liability is genuinely and substantially contested on complex legal grounds.",
      },
      {
        question: 'Do I need a lawyer for the Small Claims Court?',
        answer: "No — the Small Claims Court is specifically designed for self-representation, and lawyers are generally not permitted to appear for either side at the hearing itself. Where a lawyer helps is earlier: preparing the Letter of Demand that has to be sent before filing, and afterward, if a matter needs to escalate.",
      },
      {
        question: "What happens if my claim is too big or too complicated for Small Claims?",
        answer: "It goes through the Magistrate Court's ordinary civil process instead — full pleadings, generally with lawyers involved, and a longer timeline than the Small Claims track. This is also where a claim goes if liability is genuinely disputed rather than just a matter of an unpaid, agreed sum.",
      },
    ],
    content: `
<p>A common point of confusion for someone owed money for the first time: is the Small Claims Court a separate court, or another name for the Magistrate Court? The honest answer, in most states, is that it's neither entirely separate nor exactly the same thing.</p>

<h2>The Small Claims Court is usually a track inside the Magistrate Court</h2>
<p>Rather than a new courthouse, most states that have set up a Small Claims Court have built it as a dedicated, simplified procedure operating within the existing Magistrate Court system — a registry and a set of judges or magistrates following a specific Practice Direction, rather than a wholly separate institution. It exists to give straightforward money claims a faster, cheaper, self-representation-friendly route than the Magistrate Court's ordinary civil process.</p>

<h2>What actually qualifies for the Small Claims track</h2>
<ul>
  <li><strong>A liquidated claim</strong> — a specific, calculable sum, not a claim for damages that still needs a court to work out how much is owed.</li>
  <li><strong>Under the state's claim limit</strong> — this varies by state; see our <a href="/recover-debt/lagos">state-by-state guide</a> for the current figures where verified.</li>
  <li><strong>Genuinely undisputed liability</strong> — the debtor owes the money and the real dispute, if any, is only about payment, not about whether the debt exists at all.</li>
</ul>
<p>Land disputes, criminal matters, and claims turning on a complex or seriously contested legal question sit outside the Small Claims track regardless of the amount involved, and go through the Magistrate Court's ordinary civil procedure instead.</p>

<h2>What actually differs in practice</h2>
<div class="table-scroll">
<table>
  <thead><tr><th></th><th>Small Claims track</th><th>Magistrate Court (ordinary civil)</th></tr></thead>
  <tbody>
    <tr><td>Claim type</td><td>Simple, liquidated money claims only</td><td>Any civil claim within its jurisdiction, including disputed liability</td></tr>
    <tr><td>Lawyers at the hearing</td><td>Generally not permitted</td><td>Standard practice</td></tr>
    <tr><td>Procedure</td><td>Simplified, plain-English</td><td>Formal pleadings and rules of procedure</td></tr>
    <tr><td>Typical timeline</td><td>Weeks to a few months</td><td>Often considerably longer</td></tr>
  </tbody>
</table>
</div>

<h2>Where a Letter of Demand fits either way</h2>
<p>Before a Small Claims filing, sending a Letter of Demand and giving the debtor a chance to pay is a mandatory first step, not optional — the court will expect proof one was sent. It's good practice ahead of an ordinary Magistrate Court claim too, since it establishes that the debtor was given a real opportunity to pay before litigation started.</p>

<h2>How Pandas LP helps either way</h2>
<p>Our <a href="/agents/debt-recovery">Debt Recovery Agent</a> works out whether your claim fits the Small Claims track, drafts and serves your Letter of Demand, and files at the Small Claims Court on your behalf if the debtor doesn't pay — from ₦10,000. Where a matter turns out to be genuinely contested or above the limit, it says so rather than drafting around the problem.</p>

<p><em>This article is general information about Nigerian civil procedure and is not legal advice on your specific claim. Court structure, claim limits, and procedure vary between states.</em></p>
    `,
  },
  {
    slug: 'can-you-sue-a-company-small-claims-court-nigeria',
    title: 'Can a Company Be Sued in the Small Claims Court in Nigeria?',
    description: 'Yes — a company can be both a claimant and a defendant in the Small Claims Court, but suing one correctly means serving the company itself, not a director, and getting the name right.',
    date: '2026-09-29',
    readTime: '5 min read',
    category: 'Debt Recovery',
    author: DEFAULT_AUTHOR,
    faqs: [
      {
        question: 'Can I sue a company, not just an individual, in the Small Claims Court?',
        answer: "Yes. The Small Claims Court's eligibility turns on the nature and size of the claim — a simple, liquidated sum under the state's limit — not on whether the debtor is an individual or a registered company.",
      },
      {
        question: 'Do I serve the Letter of Demand on the company or on a director personally?',
        answer: "On the company itself, at its registered address, rather than on a director or employee personally — unless the facts genuinely support pursuing an individual directly, which is a different and less common claim. A company is a separate legal entity from the people who run it, and the demand and any claim should be addressed to the entity that actually owes the money.",
      },
      {
        question: "What if the company doesn't respond to a Letter of Demand?",
        answer: "The same process applies as with an individual debtor: if payment isn't made within the response period, a claim can be filed at the Small Claims Court, naming the company as the defendant.",
      },
      {
        question: 'Can I sue a business by its trading name instead of its registered company name?',
        answer: "It's safer to use the exact registered name — the one on its CAC certificate — rather than a trading or shop-front name, since a claim and any resulting judgment need to be enforceable against the correct legal entity. Confirming a debtor's registered name before filing is worth the extra step.",
      },
    ],
    content: `
<p>Debt recovery clients often assume the Small Claims Court is only for disputes between individuals. It isn't — a registered company can be sued there too, provided the claim itself is the kind of simple, liquidated sum the Small Claims track exists for.</p>

<h2>A company is its own legal entity</h2>
<p>A registered company has a separate legal personality from its directors, shareholders, and staff. That cuts both ways: the company can be sued in its own name for what it owes, and — outside genuinely unusual circumstances — a director or employee generally isn't personally on the hook for the company's debts just because they signed an invoice or ran the transaction. The claim and the eventual judgment belong against the company itself.</p>

<h2>What that means for serving a demand or a claim</h2>
<p>A Letter of Demand addressed to a company should go to the company at its registered address, not to a director's personal address or a staff member's inbox — though sending it to whoever actually handles the account is sensible practice alongside the formal address. Get the company's exact registered name right: the name on its CAC certificate, not a trading name, a shop sign, or a shortened version people use in conversation. A judgment obtained against the wrong name can be difficult or impossible to enforce.</p>

<h2>The claim itself works the same way</h2>
<p>Once the response period on the Letter of Demand has passed without payment, a claim can be filed at the Small Claims Court naming the company as defendant, the same way it would name an individual debtor — provided the claim is still a simple, liquidated sum under the state's limit. If liability is genuinely disputed, or the sum is above the limit, the claim goes through the Magistrate Court's ordinary civil process instead, the distinction covered in our <a href="/blog/small-claims-court-vs-magistrate-court-nigeria">guide to Small Claims vs. Magistrate Court</a>.</p>

<h2>What to have ready before pursuing a company debtor</h2>
<ul>
  <li>The company's exact registered name and registered address</li>
  <li>The invoice, contract, or other record showing what's owed and why</li>
  <li>Any prior communication about the debt, including who you dealt with at the company</li>
  <li>The company's CAC registration details, if you have them, to confirm the correct legal name</li>
</ul>

<h2>How Pandas LP helps</h2>
<p>Our <a href="/agents/debt-recovery">Debt Recovery Agent</a> drafts and serves your Letter of Demand whether the debtor is an individual or a company, and files at the Small Claims Court if it's ignored — from ₦10,000.</p>

<p><em>This article is general information about Nigerian debt recovery practice and is not legal advice on your specific claim.</em></p>
    `,
  },
  {
    slug: 'cost-to-register-a-business-in-nigeria',
    title: 'How Much Does It Cost to Register a Business in Nigeria?',
    description: "CAC's own fees are periodically revised, so any specific naira figure printed here would go stale. Here's the actual structure of what you pay, and where to check the current numbers before you budget.",
    date: '2026-10-02',
    readTime: '5 min read',
    category: 'Business Registration',
    author: DEFAULT_AUTHOR,
    faqs: [
      {
        question: 'How much does CAC registration cost in Nigeria?',
        answer: "It depends on the structure (Business Name vs. Limited Company) and, for a Limited Company, on the share capital declared — and CAC's fee schedule is revised from time to time. Rather than quote a figure here that may already be out of date by the time you read it, check the current schedule directly on CAC's own portal (post.cac.gov.ng) before budgeting.",
      },
      {
        question: 'Is a Business Name cheaper to register than a Limited Company?',
        answer: "Generally, yes — a Business Name has a simpler registration process and no share capital to declare, which keeps both the CAC fee and the overall cost lower than a Limited Company. See our full comparison of the two structures for what else differs beyond cost.",
      },
      {
        question: 'Does share capital affect how much a Limited Company costs to register?',
        answer: "Yes — a Limited Company's CAC registration fee is tied to the share capital declared at incorporation, so a higher declared share capital generally means a higher registration cost. This is worth discussing with whoever is helping you register, rather than declaring a figure without understanding the cost consequence.",
      },
      {
        question: 'Are there costs beyond the CAC fee itself?',
        answer: "Usually, yes. Beyond CAC's own registration fee, there's commonly a charge for professional help preparing and filing the application correctly (if you use one), and for a Limited Company, the cost of preparing the Memorandum and Articles of Association. Budget for the full picture, not just the government fee line.",
      },
    ],
    content: `
<p>A specific naira figure for "how much CAC registration costs" would be out of date the moment CAC next revises its fee schedule — which it periodically does. What's actually useful, and doesn't go stale, is understanding the structure of what you're paying for and where to check the real number before you budget.</p>

<h2>What the cost is actually made up of</h2>
<ul>
  <li><strong>The CAC fee itself</strong> — the government charge for the registration, which differs between a Business Name and a Limited Company, and for a Limited Company scales with the share capital declared.</li>
  <li><strong>Professional or agent fees</strong> — if you use a lawyer, accountant, or registration agent to prepare and file the application, their fee is separate from and in addition to what CAC itself charges.</li>
  <li><strong>Incorporation documents</strong> — a Limited Company additionally needs Memorandum and Articles of Association prepared, which may carry its own cost depending on who prepares them.</li>
</ul>

<h2>Why a Business Name is generally the cheaper option</h2>
<p>As covered in our <a href="/blog/how-to-register-a-business-in-nigeria-cac">full guide to CAC registration</a>, a Business Name is the simpler structure: no share capital to declare, no Memorandum and Articles to prepare, and a more straightforward CAC filing overall. That simplicity is reflected in the cost, which is why it's the common starting point for freelancers, small traders, and sole proprietors, while a Limited Company is the standard choice once a business needs the legal separation of a proper company structure or plans to raise investment.</p>

<h2>Where to check the actual current fee</h2>
<p>CAC's own portal (post.cac.gov.ng) publishes the current fee schedule, and this is the source to check before budgeting rather than a figure repeated from an article that may predate the last revision. If you're registering through a professional or an agent, ask them to confirm both the CAC fee and their own fee as two separate line items, so it's clear what's a government charge and what's a service fee.</p>

<h2>A note from experience</h2>
<p>Pandas LP itself is registered as a Business Name (BN 9646741), not a Limited Company — the right call for a firm at our stage, and worth genuinely thinking through for your own business rather than defaulting to whichever structure sounds more official.</p>

<h2>Register with Pandas LP</h2>
<p>Our CAC Registration Agent walks you through the choice between a Business Name and a Limited Company, prepares your CAC forms, and guides you through submission, from ₦15,000 — separate from CAC's own government fee.</p>

<p><em>This article is general information about CAC registration in Nigeria and is not legal or financial advice. Government fees are set and revised by CAC directly; confirm the current schedule before budgeting.</em></p>
    `,
  },
  {
    slug: 'enforcing-a-small-claims-judgment-nigeria',
    title: 'What Happens After You Win a Small Claims Judgment in Nigeria?',
    description: "Winning the judgment isn't the same as getting paid. Here's what garnishee proceedings, writs of execution, and the other real enforcement routes actually involve when a debtor still won't pay.",
    date: '2026-10-06',
    readTime: '6 min read',
    category: 'Debt Recovery',
    author: DEFAULT_AUTHOR,
    faqs: [
      {
        question: 'What if a debtor still refuses to pay after I win my case?',
        answer: "A judgment establishes that the debt is legally owed, but it doesn't move money on its own. If the debtor still doesn't pay voluntarily, the judgment has to be enforced through the court, most commonly through garnishee proceedings or a writ of execution against the debtor's property.",
      },
      {
        question: 'What is a garnishee proceeding?',
        answer: "It's a procedure that reaches money the debtor is owed by a third party — most commonly funds held in the debtor's bank account. The court orders the third party (the bank, in that example) to pay the judgment sum directly, rather than to the debtor, out of what it's already holding on the debtor's behalf.",
      },
      {
        question: 'What is a writ of execution?',
        answer: "A court order authorising a sheriff or bailiff to seize and sell the debtor's movable property to satisfy the judgment debt from the proceeds. It's generally pursued when there's identifiable property to seize, as an alternative or addition to garnishee proceedings.",
      },
      {
        question: "How do I know which enforcement method to use?",
        answer: "It depends on what's actually known about the debtor's assets — whether there's a bank account worth garnishing, movable property worth seizing, or neither, in which case other routes may need to be explored. This is generally where a licensed practitioner's judgment matters, since the wrong choice can waste time and money without moving the debtor any closer to paying.",
      },
    ],
    content: `
<p>A Small Claims judgment feels like the end of the process. For a debtor who still won't pay voluntarily, it's actually the start of a second one: enforcement.</p>

<h2>A judgment is a legal finding, not a payment</h2>
<p>Winning establishes, formally and on the record, that the debtor owes you a specific sum. It doesn't move any money by itself. Some debtors pay as soon as judgment is entered, simply because the matter is now settled and further delay has real consequences. Others don't, and that's when enforcement procedure comes in.</p>

<h2>Garnishee proceedings — reaching money held by someone else</h2>
<p>A garnishee proceeding targets money a third party is holding on the debtor's behalf — most commonly a bank account. Rather than chasing the debtor directly, the court orders the third party (the bank) to pay the judgment sum straight to you out of the debtor's funds it's already holding. This is often the most direct route where the debtor is known to bank somewhere identifiable.</p>

<h2>Writ of execution — seizing and selling property</h2>
<p>Where there's little to garnish but the debtor has identifiable movable property — vehicles, equipment, stock — a writ of execution authorises a sheriff or bailiff to seize that property and sell it, with the proceeds going toward satisfying the judgment. This route depends on there being something concrete and accessible to seize.</p>

<h2>Choosing between them</h2>
<p>The right route depends entirely on what's actually known about the debtor's situation — a bank account worth garnishing, property worth seizing, or neither, which is a harder position and where a practitioner's judgment on next steps genuinely matters. Enforcement is also where a matter has clearly moved beyond what a self-represented Small Claims process is designed for, which is exactly why the court doesn't expect you to navigate it alone.</p>

<h2>Where Pandas LP fits in</h2>
<p>A Judgment Enforcement service is something we're actively building out, rather than a fully self-serve product yet. If you've already won a judgment and the debtor still hasn't paid, reach out directly at <a href="mailto:pandaslegalpractitioners@gmail.com">pandaslegalpractitioners@gmail.com</a> and we'll talk through the right enforcement route for your specific judgment.</p>

<p><em>This article is general information about Nigerian civil enforcement procedure and is not legal advice on your specific judgment. Enforcement procedure and available routes vary between states.</em></p>
    `,
  },
  {
    slug: 'where-the-ai-stops-and-a-lawyer-starts',
    title: "Where the AI Stops and a Lawyer Starts: How Pandas LP's Agent Actually Works",
    description: "Every Pandas LP agent follows the same shape: interview, draft, a licensed practitioner reviews and signs, then serve or file. Here's what that actually looks like, and every refusal built into it.",
    date: '2026-10-09',
    readTime: '6 min read',
    category: 'Business Registration',
    author: DEFAULT_AUTHOR,
    content: `
<p>"How much of this is actually AI, and how much is a real lawyer?" is a fair question to ask before trusting a service with a debt recovery matter or a property transaction. Here's the honest, specific answer.</p>

<h2>The same four steps, every time</h2>
<p>Every Pandas LP agent follows the same shape, whether the matter is a debt recovery claim or a property instrument:</p>
<ol>
  <li><strong>Interview.</strong> You describe your situation in ordinary language — no legal vocabulary required, no form to fill in cold.</li>
  <li><strong>Draft.</strong> The agent works out which document the situation actually calls for and drafts it from the firm's own templates for that instrument, not from a blank page.</li>
  <li><strong>Review and sign.</strong> A licensed Nigerian legal practitioner reviews the draft and signs it. Nothing reaches a debtor, a tenant, or a court unsigned.</li>
  <li><strong>Serve or file.</strong> Depending on what you've chosen, the firm serves the document, follows up on the statutory schedule, and files at court if the matter escalates.</li>
</ol>
<p>The AI does the drafting and the organising. The signature — the point where an actual lawyer stands behind the document — is never automated.</p>

<h2>What each agent will not do</h2>
<p>Both agents publish their limits in full, because the refusals say more about whether to trust the system than the capabilities do:</p>
<ul>
  <li>The <a href="/agents/debt-recovery/limits">Debt Recovery Agent's limits</a> — it won't take a claim above the Small Claims threshold, invent legal authority, predict your odds, or claim to represent you in court.</li>
  <li>The <a href="/agents/property-law/limits">Property Law Agent's limits</a> — it won't advise self-help eviction, invent a Certificate of Occupancy or plot number you haven't supplied, freehand an instrument outside the nine it actually covers, or draft around a contested or litigated matter.</li>
</ul>

<h2>Why this matters more than the marketing usually says</h2>
<p>A system that claims to do everything a lawyer does, end to end, without a lawyer in the loop, is either overselling itself or quietly taking on legal risk it hasn't disclosed. Pandas LP's approach is the opposite: the agent handles the part that's genuinely mechanical — turning a plain-language description into a properly structured, correctly worded document — and hands the part that requires actual legal judgment to an actual lawyer, every time, before anything is served or filed.</p>

<h2>What this looks like from your side</h2>
<p>You describe your situation once, in your own words. You see the drafted document before anything happens with it. A licensed practitioner has reviewed and signed it by the time it's served or filed. And if your matter turns out to be more complicated than the agent is built to handle — disputed liability, contested ownership, live litigation — you're told that plainly, rather than being handed a document that pretends the complication doesn't exist.</p>

<p>Start with <a href="/agents/debt-recovery">Debt Recovery</a> or <a href="/agents/property-law">Property Law</a> to see it in practice.</p>
    `,
  },
]

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug)
}
