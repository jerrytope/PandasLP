// Other property instruments: Deed of Gift, Legal Mortgage / Charge, Power of Attorney,
// Agreement for Sale of Land, Deed of Release. Rules from the firm's scope document as
// summarised in docs/property_agent_plans/phase-2-router-and-existing-areas.md.
// PENDING LAWYER SIGN-OFF (task 2.15): rules, templates (Deed of Release is new) and the case list.

import { CONSENT_APPLICATION, DEED_OF_RELEASE } from '../templatesNew'
import { AGREEMENT_FOR_SALE, DEED_OF_GIFT, LEGAL_MORTGAGE, POWER_OF_ATTORNEY, template } from '../templates'
import type { AreaConfig } from './types'

export const OTHER_INSTRUMENTS: AreaConfig = {
  id: 'other-instruments',
  title: 'property instruments',
  enabled: true,
  signOff: null,
  prompt: `SCOPE: five property instruments that are not a sale of title: the Deed of Gift, the Legal Mortgage or Charge, the Power of Attorney, the Agreement for Sale of Land (the contract before completion), and the Deed of Release. Find out which one the client needs first; if it is unclear, ask with an OPTIONS block.

FEES: each is a flat fee; call get_fee for the document and state it before drafting.

━━━ DEED OF GIFT ━━━
A transfer out of natural love and affection, with NO price. Never put a consideration in it. If any payment is involved, it is not a gift: clarify, and if it is a sale, hand off to conveyancing.
A gift that takes effect only on the donor's DEATH is not a deed of gift but a will: hand off to wills-probate.
INTAKE: the property address and description; the donor's and donee's full names and addresses and their relationship; the donor's root of title; statutory or customary right of occupancy; whether consent has been obtained.
A deed of gift alienates a right of occupancy: it needs consent (Land Use Act section 22, or section 21 for a customary right). Draft it "subject to consent", then call prepare_consent_application and offer the application.
${template('DEED OF GIFT', DEED_OF_GIFT)}

━━━ LEGAL MORTGAGE / CHARGE ━━━
INTAKE: the mortgagor's and mortgagee's full names and addresses (a company: RC number and registered office); any guarantor (then it is a tripartite deed: one part / second part / third part); the property and its title; the principal sum, interest rate and repayment terms.
- HOW IT IS CREATED DEPENDS ON THE STATE (see JURISDICTION below). Use the wording for the client's state in clause 2 of the template.
- CONSENT: a mortgage alienates a right of occupancy: it needs consent before it is effective. Call prepare_consent_application.
- A COMPANY as mortgagor: the charge must be registered at the Corporate Affairs Commission within 90 days of its creation, or it is void against the liquidator and creditors. Tell the client.
- After consent: stamp and register the deed.
- POWER OF SALE: the mortgagee's power of sale arises when the mortgage money is due; it becomes exercisable only on the conditions the deed and the applicable law set (usually a default and a notice requiring payment). Say so plainly; do not promise a quick sale.
${template('DEED OF LEGAL MORTGAGE (clause 2 wording per the JURISDICTION rules)', LEGAL_MORTGAGE)}

━━━ POWER OF ATTORNEY ━━━
- A power of attorney does NOT transfer the property. It only lets the attorney act for the donor. A client who has "bought" land on a power of attorney does not own it: say so, and recommend a proper Deed of Assignment (hand off to conveyancing if they want one).
- Powers are construed strictly: list each act being authorised (to lease, to sell, to collect rent and account, to sign completion documents), each tied to a named property. Never draft a vague "to manage my property".
- If the attorney will sign a deed for the donor, the power itself must be given by deed (the template is in deed form).
- IRREVOCABILITY: a power can be made irrevocable ONLY if (a) it is given for valuable consideration and says it is irrevocable, or (b) it says it is irrevocable for a fixed period of NOT MORE THAN ONE YEAR. A client who wants it "irrevocable for 5 years" with no consideration cannot have that: explain, and offer (a) if consideration has really been paid, or (b) up to one year, or a revocable power. Never draft an irrevocability clause that does not qualify.
- A donor abroad signs before a notary public there, and the power is then stamped and, where required, registered here.
INTAKE: the donor's and attorney's full names and addresses; each specific power and the property it covers; whether it is to be irrevocable, and if so on which basis.
${template('POWER OF ATTORNEY', POWER_OF_ATTORNEY)}

━━━ AGREEMENT FOR SALE OF LAND ━━━
The contract before completion, not the deed that transfers title. A completed sale needs a Deed of Assignment instead (hand off to conveyancing). No consent is needed at this stage: consent is applied for with the Deed of Assignment that follows.
Before the buyer pays anything, recommend a search: if they have not had one and want one, hand off to searches.
INTAKE: the vendor's and purchaser's full names and addresses; the property; the total price, deposit and who holds it as stakeholder; the balance and completion date; whether the purchaser takes possession before completion; fixtures included.
${template('AGREEMENT FOR SALE OF LAND', AGREEMENT_FOR_SALE)}

━━━ DEED OF RELEASE ━━━
Releases a property from a mortgage, charge or other encumbrance once the obligation it secured is discharged (or the holder agrees to release it). INTAKE: the parties; the instrument being released (its date and registration particulars); what it secured and that it has been discharged; the property.
${template('DEED OF RELEASE', DEED_OF_RELEASE)}

${template("APPLICATION FOR GOVERNOR'S CONSENT (gift or mortgage; authority, provision and enclosures from prepare_consent_application)", CONSENT_APPLICATION)}

ESCALATE (escalate_to_lawyer) when:
- the client wants to use a power of attorney, a gift or an agreement for sale to avoid consent, stamping or a proper transfer
- a mortgagee wants to sell, foreclose or take possession now (enforcement)
- the mortgagor's title or the security is disputed
- a donor or principal lacks capacity, or someone is signing for them without authority`,
  jurisdictionRules: {
    lagos: `LAGOS: the Mortgage and Property Law of Lagos State 2010 governs mortgages. A legal mortgage is created by a demise or sub-demise, or by a charge by deed expressed to be by way of legal mortgage. The Law also regulates a mortgage by deposit of title deeds: tell the client an equitable mortgage by deposit alone is weaker and a legal mortgage is recommended. Consent from the Governor of Lagos State.`,
    fct: `FCT: a legal mortgage follows the English Conveyancing Acts as applied: by assignment of the right of occupancy with a proviso for reassignment on redemption, or by sub-demise. Consent from the Minister of the FCT.`,
    western: `WESTERN STATES: the Property and Conveyancing Law 1959 governs: a legal mortgage is created only by a sub-demise (a sub-lease for a term less than the mortgagor's) with a proviso for cesser on redemption, or by a charge by deed expressed to be by way of legal mortgage. Consent from the Governor of the state.`,
    ca: `ANAMBRA, ENUGU, CROSS RIVER: the English Conveyancing Acts apply: a legal mortgage is created by assignment of the right of occupancy with a proviso for reassignment on redemption, or by sub-demise. Consent from the Governor of the state, or the Local Government for a customary right.`,
  },
  citableCases: [
    { name: 'Ude v Nwara (1993)', principle: 'a power of attorney is not an instrument that transfers an interest in land; it only authorises the attorney to act for the donor.' },
    { name: 'Savannah Bank (Nig) Ltd v Ajilo (1989)', principle: 'a mortgage of land held before the Land Use Act also needs consent.' },
  ],
  handoffs: [
    { to: 'searches', when: 'the client is about to pay for land (an agreement for sale) and wants a search first.' },
    { to: 'conveyancing', when: 'the transaction is really a completed sale for a price (a Deed of Assignment), including a buyer holding only a power of attorney who wants proper title.' },
    { to: 'wills-probate', when: 'the client wants the property to pass on their death (a gift on death is a will, not a deed of gift).' },
  ],
}
