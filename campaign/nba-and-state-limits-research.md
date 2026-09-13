# Research memo: NBA referral-fee rules + state Small Claims limits

**Status: research starting point, not verified legal advice.** Compiled via web search
(secondary sources — law firm blogs, Mondaq summaries, court websites) on 2026-08-17.
Two primary-source PDFs (Lagos's 2023 revised Practice Direction, Oyo's Practice Direction)
returned fetch errors and could not be read directly. Nothing here should be treated as
confirmed until an actual lawyer or the relevant court registry verifies it.

---

## 1. NBA referral-fee / non-lawyer intermediary question

**What I found:** Rule 39 of the Rules of Professional Conduct for Legal Practitioners 2007
prohibits touting and solicitation, but **Rule 39(1) explicitly permits advertising/promotion
"provided it is fair and proper in all the circumstances and complies with the rules."**
Multiple sources (Olisa Agbakoba Legal, Mondaq/TrustedAdvisorsLaw reprints of the same
article) describe Rules 39-44 collectively as governing "what a lawyer may do in attracting
business" without a blanket prohibition on promotion.

**What I did NOT find:** a clear, direct answer to the specific question this matters for —
whether paying a referral fee/commission to a *non-lawyer* (an accountant, estate agent, or
CAC agent) for referring a client counts as prohibited touting, or as fee-splitting with an
unqualified person (a distinct ethical issue in most common-law jurisdictions, separate from
touting). None of the sources I found addressed referral-fee arrangements with non-lawyer
intermediaries specifically.

**Conclusion: this sub-question is still open.** My search corroborates that advertising/
promotion generally isn't banned outright, which is mildly encouraging for the broader
referral-network idea, but it does **not** confirm referral commissions to non-lawyers are
safe. This is exactly the 1-2 day check the council recommended calling the NBA ethics desk
for — the general Rule 39 text I found isn't a substitute for that specific answer.

Sources:
- [Law Firm Marketing in Nigeria and the RPC – Rule 39 — OAL](https://oal.law/law-firm-marketing-in-nigeria-and-the-rpc-rule-39/) *(fetch blocked — 403; found via search summary only)*
- [Rule 39 Of The Rule Of Professional Conduct, 2007 And Law Firm Marketing — Mondaq](https://www.mondaq.com/nigeria/advertising-marketing-branding/1324496/rule-39-of-the-rule-of-professional-conduct-2007-and-law-firm-marketing-a-practical-perspective)
- [Thou shalt not advertise — the line between business development and solicitation — BusinessDay NG](https://businessday.ng/news/legal-business/article/thou-shalt-not-advertise-the-line-between-business-development-and-solicitation/)

---

## 2. Small Claims Court monetary limits, state by state

| State | Codebase currently has | What I found | Confidence |
|---|---|---|---|
| Lagos | ₦5,000,000, verified: false | ₦5,000,000 confirmed independently (2 sources) | Matches — reasonably confident |
| Abuja (FCT) | ₦7,000,000, with a note flagging it "may describe counterclaims rather than primary claim limit" | ₦7,000,000 confirmed as the **primary claim limit** (not just counterclaims) — this resolves the existing note's ambiguity | Matches, and the note can likely be relaxed |
| Rivers | ₦5,000,000, verified: false | ₦5,000,000 confirmed independently | Matches — reasonably confident |
| Kano | ₦5,000,000, verified: false | ₦5,000,000 confirmed independently | Matches — reasonably confident |
| Enugu | ₦5,000,000 base + note "rises to ₦10,000,000 where the claim involves a counterclaim" | Independently found: counterclaims capped at ₦10,000,000 — matches the existing note exactly | Matches — reasonably confident |
| Oyo | ₦5,000,000, verified: false | **Could not confirm the monetary limit at all.** One source (Lawyard, reporting on the Dec 2022 signing) suggested the court "was yet to begin operations" as of that report. The actual Practice Direction PDF 404'd on fetch. | **Genuinely unresolved — flag this one specifically, including whether the court is even operational yet, not just the figure** |

**Recommendation:** Lagos, Abuja/FCT, Rivers, Kano, and Enugu's existing figures are
corroborated by independent secondary sources and are reasonable candidates for a lawyer's
quick sign-off before flipping `verified: true`. **Oyo needs real attention** — both the limit
and whether the court is actually hearing cases yet — before it's presented publicly as an
option at all.

Sources:
- [FCT judiciary launches small claims court — The Guardian Nigeria](https://guardian.ng/features/fct-judiciary-launches-small-claims-court/)
- [Lagos State Small Claims Court: A Milestone In Dispute Resolution — Mondaq](https://www.mondaq.com/nigeria/personal-injury/756388/lagos-state-small-claims-court-a-milestone-in-dispute-resolution)
- [Small Claims - Enugu State Judiciary](https://judiciary.en.gov.ng/assets/handbook.pdf)
- [About Small Claims Courts - Kano State Judiciary High Court](https://kanojudiciary.com/about-small-claim-court/)
- [Small Claims Court – Rivers State Judiciary](https://judiciary.rv.gov.ng/small-claims-court/)
- [Oyo, Rivers States Move To Establish Small Claims Courts — Lawyard](https://www.lawyard.org/news/oyo-rivers-states-move-to-establish-small-claims-courts/)
