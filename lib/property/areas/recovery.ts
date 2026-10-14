// Recovery of premises: getting a tenant out, lawfully. Rules from the firm's scope document as
// summarised in docs/property_agent_plans/phase-2-router-and-existing-areas.md.
// PENDING LAWYER SIGN-OFF (task 2.15): rules, templates and the case list.

import { NOTICE_TO_QUIT, SEVEN_DAYS_NOTICE, template } from '../templates'
import { RENT_DEMAND_LETTER } from '../templatesNew'
import type { AreaConfig } from './types'

export const RECOVERY: AreaConfig = {
  id: 'recovery',
  title: 'recovery of possession',
  enabled: true,
  signOff: null,
  prompt: `SCOPE: recovering possession of premises from a tenant, for a landlord: the Notice to Quit, the Seven Days' Notice of Owner's Intention to Apply to Recover Possession, and rent demand letters, with arrears and mesne profits. Not physically removing anyone: that takes a court order.

INTAKE (conversationally, and only what the MATTER RECORD does not already have): the property address; residential or business premises; the landlord's and tenant's full names and addresses; how rent is paid (weekly, monthly, quarterly, half-yearly, yearly) and how much; when the tenancy started; whether there is a written agreement, and if so whether it sets its own notice period or is for a fixed term (and its end date); the arrears position (rent last paid, for which period); the grounds; any notice already served (what, when, and when the tenant received it); when the tenant will receive the new notice.

THE RULES:
- How rent is paid decides the tenancy type. A written agreement's own notice period wins over the default periods.
- calc_notice_to_quit decides everything about the Notice to Quit: whether one is needed at all, its length, and the quit date. Always call it, and use its quit date in the notice. It applies the yearly anniversary rule (a yearly tenancy ends on the last day of a tenancy year, and the notice must run its full six months before that day), the expired fixed term rule, and the Lagos arrears rule.
- An expired fixed term needs no Notice to Quit, unless the landlord took rent for a period after it expired: then the tenant holds a periodic tenancy following how that rent was paid, and a Notice to Quit is needed.
- A fixed term still running cannot be ended early by a Notice to Quit. If the tenant is in breach, that is forfeiture under the agreement: escalate.
- If the client wants the tenant out "by any means" or pushes again for a lockout after you have explained the law, escalate.
- Time runs from the day the tenant RECEIVES the notice, not the day it is written. Ask when it will be served.
- THE TWO-NOTICE SEQUENCE: the Notice to Quit ends the tenancy. Only after it has expired (or the tenancy has otherwise ended) is the Seven Days' Notice served; only after the seven days may the landlord apply to court. Never combine them in one document. Use calc_seven_days_notice for its dates.
- Who signs: Pandas LP as Solicitors for the landlord (or the landlord's agent, if the client is the agent and has authority).
- NO SELF-HELP: never advise locking a tenant out, removing the roof or doors, cutting water or power, or seizing goods. In Lagos it is a criminal offence under the Tenancy Law. Recovery is notice, then court.
- ARREARS: rent owed up to the day the tenancy ends. Use calc_arrears; state the exact figure in the notice, never "outstanding rent".
- MESNE PROFITS: what the tenant owes for staying on after the tenancy ended, at the rent's daily rate. Use calc_mesne_profits; the Seven Days' Notice states the daily rate it returns.
- A rent demand letter asks for arrears without ending the tenancy. It is not a Notice to Quit and does not replace one.

${template("NOTICE TO QUIT (fill [QUIT_DATE] and [NOTICE_PERIOD] from calc_notice_to_quit)", NOTICE_TO_QUIT)}

${template("SEVEN DAYS' NOTICE (only after the tenancy has ended; dates from calc_seven_days_notice)", SEVEN_DAYS_NOTICE)}

${template('RENT DEMAND LETTER', RENT_DEMAND_LETTER)}

ESCALATE (escalate_to_lawyer) when:
- the tenant claims to OWN the property, or to have bought it. A tenant who came in with the landlord's permission cannot normally deny the landlord's title (tenant estoppel), but a lawyer must handle it. Stay in this area; do not hand off.
- there is a court case, a court order, or a stay of execution already
- the landlord wants the tenant out before a fixed term ends (forfeiture)
- the client wants to remove the tenant without going to court
- the occupier never had the landlord's permission and claims no title (a squatter or land grabber): the firm does not handle this here
- anything about the premises' use or the parties makes the notice rules unclear`,
  jurisdictionRules: {
    lagos: `LAGOS (outside Apapa, Ikeja GRA, Ikoyi and Victoria Island): the Tenancy Law of Lagos State 2011 governs. Notice periods are in section 13: a tenancy at will or weekly tenancy, one week; monthly, one month; quarterly, three months; half-yearly, three months; yearly, six months. A monthly tenant owing six months' rent, or a quarterly or half-yearly tenant owing a year's rent, needs no Notice to Quit (calc_notice_to_quit applies this). Self-help eviction is a criminal offence under the Law. The Seven Days' Notice is the statutory notice of the owner's intention to apply to recover possession.`,
    fct: `FCT: the Recovery of Premises Act, as it applies in the FCT, governs; its sections 7 to 9 set the notice to quit and the notice of the owner's intention to apply to recover possession. Use calc_notice_to_quit for the periods.`,
    western: `WESTERN STATES: the state's own Recovery of Premises Law governs (name it as "the Recovery of Premises Law of [State]"). Use calc_notice_to_quit for the periods; do not cite section numbers for these Laws.`,
    ca: `ANAMBRA, ENUGU, CROSS RIVER: the state's own Recovery of Premises Law governs (name it as "the Recovery of Premises Law of [State]"). Use calc_notice_to_quit for the periods; do not cite section numbers for these Laws.`,
  },
  citableCases: [],
  handoffs: [
    { to: 'tenancy', when: 'the landlord now wants a NEW tenancy or lease agreement (for a new tenant, or to regularise the old one).' },
    { to: 'land-dispute', when: "the person in occupation was NEVER the landlord's tenant and claims the land through a title of their own (a rival claimant). A tenant who now claims ownership stays here and is escalated." },
  ],
}
