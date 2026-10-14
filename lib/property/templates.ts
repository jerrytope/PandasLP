// Document templates for the rebuilt Property Law Agent's areas (lib/property/areas/).
// Copied from the current Property Law Agent prompt (lib/agents.ts), which stays live until the
// Phase 5 cut-over, then corrected against the firm's scope document where the plan says so.
// Every template is PENDING LAWYER SIGN-OFF (docs/property_agent_plans/, task 2.15).
//
// [BRACKETED] blanks must all be filled before emit_document accepts a document.

/** Wraps a template in the markers the area prompts use. */
export function template(name: string, body: string): string {
  return `DOCUMENT TEMPLATE — ${name}:

---TEMPLATE START---
${body.trim()}
---TEMPLATE END---`
}

export const NOTICE_TO_QUIT = `[TENANT_NAME]
[PROPERTY_ADDRESS]

Dear Sir/Madam,

NOTICE TO QUIT AND DELIVER UP VACANT POSSESSION

We are Solicitors to [LANDLORD_NAME] ("our Client"), the landlord/agent of the premises situate at [PROPERTY_ADDRESS], and write on our Client's instructions.

TAKE NOTICE that our Client hereby gives you notice to QUIT AND DELIVER UP vacant possession of the said premises which you hold as our Client's tenant, on or before **[QUIT_DATE]**, being the expiration of **[NOTICE_PERIOD]** from the date this notice is served on you.

TAKE FURTHER NOTICE that if you fail to deliver up vacant possession of the said premises within the period stated above, steps will be taken on our Client's instructions to recover possession through the appropriate court, and you will be held liable for all costs and mesne profits arising therefrom.

GROUNDS: [GROUNDS_FOR_NOTICE]

Yours Faithfully,


________________________
For: Pandas LP
Solicitors to the Landlord, [LANDLORD_NAME]`

export const SEVEN_DAYS_NOTICE = `[TENANT_NAME]
[PROPERTY_ADDRESS]

Dear Sir/Madam,

SEVEN (7) DAYS' NOTICE OF OWNER'S INTENTION TO APPLY TO RECOVER POSSESSION

We are Solicitors to [LANDLORD_NAME] ("our Client") and write on our Client's instructions.

[RECITAL — use the ONE that fits:
 (a) after a Notice to Quit: "TAKE NOTICE that a Notice to Quit dated **(date)** requiring you to deliver up vacant possession of the premises situate at (address) expired on **(date)**, and you have failed, refused, or neglected to give up possession."
 (b) after a fixed term ended by itself (no Notice to Quit was needed): "TAKE NOTICE that your tenancy of the premises situate at (address) for a fixed term expired on **(date)**, and you have failed, refused, or neglected to give up possession."]

TAKE FURTHER NOTICE that our Client intends to apply to the appropriate Court for an Order of Recovery of Possession of the said premises on the expiration of **seven (7) days** from the date of service of this Notice, together with mesne profits at the rate of **[DAILY_RATE] per day** from the date the tenancy determined until possession is given up.

Yours Faithfully,


________________________
For: Pandas LP
Solicitors to the Landlord, [LANDLORD_NAME]`

export const TENANCY_AGREEMENT = `TENANCY AGREEMENT

THIS TENANCY AGREEMENT is made this [DATE]

BETWEEN

[LANDLORD_NAME] of [LANDLORD_ADDRESS] (hereinafter called "the Landlord")

AND

[TENANT_NAME] of [TENANT_ADDRESS] (hereinafter called "the Tenant")

WHEREAS the Landlord is the owner/lawful occupier of the premises situate at [PROPERTY_ADDRESS] ("the Premises") and has agreed to let same to the Tenant on the terms set out below.

THIS AGREEMENT WITNESSES AS FOLLOWS:

1. TERM
The Landlord lets and the Tenant takes the Premises for a term of **[TENANCY_TERM]** commencing on **[START_DATE]**.

2. RENT
The Tenant shall pay rent of **₦[RENT_AMOUNT]** per [FREQUENCY], payable in advance.

3. DEPOSIT
[DEPOSIT_CLAUSE]

4. USER
The Premises shall be used solely for [PERMITTED_USE] and for no other purpose without the Landlord's prior written consent.

5. REPAIRS AND MAINTENANCE
[REPAIR_CLAUSE]

6. QUIET ENJOYMENT
The Tenant shall be entitled to quiet enjoyment of the Premises without interruption from the Landlord, provided the Tenant complies with the terms of this Agreement.

7. SUBLETTING AND ASSIGNMENT
[SUBLETTING_CLAUSE]

8. FORFEITURE
If the Tenant breaches any term of this Agreement, including non-payment of rent for [ARREARS_PERIOD], the Landlord may re-enter the Premises after service of the requisite statutory notice.

9. DISPUTE RESOLUTION
Any dispute arising from this Agreement shall first be referred to mediation before resort to litigation, without prejudice to either party's right to pursue statutory recovery-of-premises procedure.

IN WITNESS WHEREOF the parties have executed this Agreement on the day and year first above written.

[EXECUTION BLOCK — see EXECUTION BLOCKS in SHARED RULES below; pick the variant matching each party's type]`

export const DEED_OF_ASSIGNMENT = `DEED OF ASSIGNMENT

THIS DEED OF ASSIGNMENT is made this [DATE]

BETWEEN

[ASSIGNOR_NAME] of [ASSIGNOR_ADDRESS] (hereinafter called "the Assignor")

AND

[ASSIGNEE_NAME] of [ASSIGNEE_ADDRESS] (hereinafter called "the Assignee")

WHEREAS the Assignor is seised of the property described in the Schedule hereto ("the Property") by virtue of [ROOT_OF_TITLE], and has agreed to assign the Property to the Assignee for the consideration stated below.

THIS DEED WITNESSES AS FOLLOWS:

1. In consideration of the sum of **₦[CONSIDERATION]** paid by the Assignee to the Assignor (the receipt of which the Assignor hereby acknowledges), the Assignor as beneficial owner HEREBY ASSIGNS unto the Assignee ALL THAT the Property described in the Schedule hereto, TOGETHER WITH all rights, easements, and appurtenances thereto, TO HOLD UNTO the Assignee for the term unexpired, free of all encumbrances and subject to the provisions of the Land Use Act Cap L5, LFN, 2004.

2. The Assignor COVENANTS with the Assignee that the Assignor has good right to assign the Property and that the Property is free from encumbrances save as disclosed.

3. This Deed is subject to the Governor's Consent being obtained pursuant to Section 22 of the Land Use Act, and the parties undertake to do all things necessary to perfect this assignment, including stamping and registration.

SCHEDULE
(Property description: [PROPERTY_DESCRIPTION], including plot number, layout, and boundaries, more particularly delineated on the survey plan referred to above)

IN WITNESS WHEREOF the parties have executed this Deed on the day and year first above written.

[EXECUTION BLOCK — see EXECUTION BLOCKS in SHARED RULES below; pick the variant matching each party's type]`

export const DEED_OF_GIFT = `DEED OF GIFT

THIS DEED OF GIFT is made this [DATE]

BETWEEN

[DONOR_NAME] of [DONOR_ADDRESS] (hereinafter called "the Donor", which expression shall where the context so admits include the Donor's heirs, personal representatives, successors-in-title and assigns) of the one part

AND

[DONEE_NAME] of [DONEE_ADDRESS] (hereinafter called "the Donee" which expression where the context so admits include the Donee's heirs, successors in title, executors, personal representatives, assigns and those deriving title from the Donee) of the other part

WHEREAS the Donor is seised of the property described in the Schedule hereto ("the Property") by virtue of [ROOT_OF_TITLE], and the Donor, out of natural love and affection for the Donee and without any monetary consideration, has agreed to voluntarily transfer and gift all right, title and interest in the Property to the Donee.

THIS DEED WITNESSES AS FOLLOWS:

In consideration of the natural love and affection which the Donor bears towards the Donee, and in furtherance of the Donor's desire to make a voluntary and irrevocable gift, the Donor, as beneficial owner, HEREBY GIVES, GRANTS, CONVEYS, TRANSFERS AND ASSIGNS unto the Donee ALL THAT the Property described in the Schedule hereto, TOGETHER WITH all rights, easements and appurtenances thereto, TO HOLD UNTO and TO THE USE of the Donee for the term unexpired, free of all encumbrances and subject to the provisions of the Land Use Act Cap L5, LFN, 2004.

This Deed is subject to the Governor's Consent being obtained pursuant to Section 22 of the Land Use Act, and the parties undertake to do all things necessary to perfect this gift, including stamping and registration.

DONOR'S COVENANTS
The Donor covenants with the Donee:
a. That the Donor has good and marketable title to the Property and full power and authority to transfer it by way of gift.
b. That the Property is free from all known encumbrances, liens, charges, adverse interests or claims, save as disclosed.
c. That the Donor shall, upon reasonable request and at the Donee's expense, execute all documents and do all acts necessary for the perfection of the Donee's title.
d. That the Donor shall indemnify the Donee against any loss arising from any defect in the Donor's title.
e. That the Donee shall quietly hold, occupy and enjoy the Property without interference from the Donor or any person claiming through the Donor.

DONEE'S COVENANTS
The Donee covenants with the Donor:
a. To pay all present and future land use charges, rates, taxes and other statutory outgoings relating to the Property from the date of execution.
b. To take immediate possession of the Property upon execution.
c. To comply with all rules, statutes and orders relating to the use of the Property.
d. To indemnify the Donor for any loss suffered by reason of the Donee's breach of this Deed.

SCHEDULE
(Property description: [PROPERTY_DESCRIPTION], including plot number, layout, and boundaries, more particularly delineated on the survey plan referred to above)

IN WITNESS WHEREOF the parties have executed this Deed on the day and year first above written.

[EXECUTION BLOCK — see EXECUTION BLOCKS in SHARED RULES below]`

export const POWER_OF_ATTORNEY = `POWER OF ATTORNEY

BY THIS POWER OF ATTORNEY made this [DATE]

I, [DONOR_NAME] of [DONOR_ADDRESS] ("the Donor") appoint [DONEE_NAME] of [DONEE_ADDRESS] ("the Donee") to be my true and lawful Attorney and in my name and on my behalf to do all or any of the following acts or things, namely:

1. [SPECIFIC_POWER_1 — e.g. "To lease my property at (address) for a term not exceeding (X) years and to collect and receive the rent therefrom"]
2. [SPECIFIC_POWER_2]

AND to do all things necessary and incidental to the matters above as I may lawfully do.

[IRREVOCABILITY — include ONE of these only if the client wants the Power to be irrevocable AND it qualifies (see the POWER OF ATTORNEY rules); otherwise leave this out entirely:
 (a) GIVEN FOR VALUABLE CONSIDERATION: "AND IT IS DECLARED that this Power of Attorney is given for valuable consideration, namely the sum of ₦[AMOUNT] paid by the Donee to the Donor (the receipt of which the Donor acknowledges), and is irrevocable."
 (b) FOR A FIXED PERIOD OF NOT MORE THAN ONE YEAR: "AND IT IS DECLARED that this Power of Attorney shall be irrevocable for a period of [PERIOD, not exceeding one year] from the [DATE]."]

IN WITNESS WHEREOF I, the Donor, have executed this Power of Attorney in the manner below on the day and year first above written.

SIGNED, SEALED AND DELIVERED:
By the Donor

________________________
[DONOR_NAME]

IN THE PRESENCE OF:
Name:
Address:
Occupation:
Signature:
Date:`

export const LEGAL_MORTGAGE = `DEED OF LEGAL MORTGAGE

THIS DEED OF LEGAL MORTGAGE is made this [DATE]

BETWEEN

[MORTGAGOR_NAME] of [MORTGAGOR_ADDRESS] ("the Mortgagor") of the one part

AND

[MORTGAGEE_NAME] of [MORTGAGEE_ADDRESS] ("the Mortgagee") of the other part

[IF A GUARANTOR IS INVOLVED: restructure the parties as "of the one part / ... ("the Guarantor") of the second part / ... of the third part", and add the guarantor's undertaking as an additional numbered clause below]

WHEREAS the Mortgagor is seised of the property described in the Schedule hereto ("the Property") by virtue of [ROOT_OF_TITLE], and the Mortgagee has agreed to advance to the Mortgagor the sum of ₦[PRINCIPAL_SUM] upon the security of the Property on the terms below.

THIS DEED WITNESSES AS FOLLOWS:

1. The Mortgagor covenants to repay to the Mortgagee the principal sum of ₦[PRINCIPAL_SUM] together with interest at the rate of [INTEREST_RATE]% per annum, repayable on or before [REPAYMENT_DATE].

2. The Mortgagor, as beneficial owner, HEREBY MORTGAGES unto the Mortgagee ALL THAT the Property described in the Schedule hereto, TOGETHER WITH all rights, easements and appurtenances thereto, TO HOLD UNTO the Mortgagee as security for repayment of the said principal sum and interest, subject to the provisions of the Land Use Act Cap L5, LFN, 2004.

3. This Deed is subject to the Governor's Consent being obtained pursuant to Section 22 of the Land Use Act, and the parties undertake to do all things necessary to perfect this mortgage, including stamping and registration.

THE MORTGAGOR COVENANTS with the MORTGAGEE:
a. To keep the Property in good repair.
b. To insure the Property against fire and other usual risks to its full value.
c. Not to create any further charge on the Property without the Mortgagee's prior written consent.
d. That upon default in repayment, the Mortgagee shall be entitled to exercise the statutory power of sale, or to apply to court for foreclosure or possession, as the case may be.

SCHEDULE
(Property description: [PROPERTY_DESCRIPTION])

IN WITNESS WHEREOF the parties have executed this Deed on the day and year first above written.

[EXECUTION BLOCK — see EXECUTION BLOCKS in SHARED RULES below; a corporate Mortgagee normally executes under its common seal, or by director(s)/secretary if it has none]`

export const AGREEMENT_FOR_SALE = `AGREEMENT FOR SALE OF LAND

THIS AGREEMENT is made this [DATE]

BETWEEN

[VENDOR_NAME] of [VENDOR_ADDRESS] ("the Vendor") of the one part

AND

[PURCHASER_NAME] of [PURCHASER_ADDRESS] ("the Purchaser") of the other part

IT IS AGREED that the Vendor sells and the Purchaser buys ALL THAT property situate at [PROPERTY_ADDRESS], more particularly described in the Schedule to this Agreement, on the following terms.

THIS AGREEMENT WITNESSES AS FOLLOWS:

1. CONSIDERATION: The consideration for the sale of the property shall be the sum of ₦[CONSIDERATION] ([CONSIDERATION_IN_WORDS]).
2. DEPOSIT: The sum of ₦[DEPOSIT] shall be paid by the Purchaser on exchange of this contract as deposit to [STAKEHOLDER_NAME], who shall hold it as stakeholder pending completion.
3. BALANCE AND INTEREST: The balance of ₦[BALANCE] shall be paid at completion; if payment is delayed by the Purchaser's default, interest shall accrue at the prevailing bank rate.
4. CAPACITY OF VENDOR: The Vendor sells as beneficial owner.
5. CONDITION OF PROPERTY: The Purchaser acknowledges having inspected the property and is satisfied with its condition, without reliance on any warranty from the Vendor, express or implied.
6. POSSESSION BEFORE COMPLETION: [IF APPLICABLE] The Purchaser may take possession of the property as licensee upon execution of this Agreement; if the Purchaser defaults in payment of the balance at completion, the Purchaser shall peaceably give up possession and the deposit shall be forfeited.
7. DATE AND PLACE OF COMPLETION: Time is of the essence. Completion shall take place on or before [COMPLETION_DATE] at [COMPLETION_PLACE].
8. COST: The Purchaser shall bear all costs incidental to the preparation and execution of this Agreement and of the Deed of Assignment to follow.
9. ACKNOWLEDGEMENT FOR SAFE CUSTODY AND PRODUCTION: The Vendor shall retain the original title documents in safe custody and undertakes to produce them whenever reasonably requested by the Purchaser.
10. INDEMNITY: The Vendor shall indemnify the Purchaser for any loss arising from any defect in the Vendor's title.
11. GOVERNOR'S CONSENT: The Vendor undertakes to execute a Deed of Assignment and such other documents as may be required to vest legal title in the Purchaser, and to apply for the Governor's Consent to the transaction.
12. This Agreement supersedes all previous negotiations between the parties and contains the entire agreement finally agreed.

SCHEDULE
(Description of the property)

IN WITNESS WHEREOF the parties have executed this Agreement on the day and year first above written.

[EXECUTION BLOCK — see EXECUTION BLOCKS in SHARED RULES below; pick the variant matching each party's type]`

export const SEARCH_INSTRUCTION = `PROPERTY SEARCH INSTRUCTION

This is an instruction to the Pandas LP legal team to carry out a standard property search. It is NOT a search report, and nothing in it has been verified. Every entry below is what the client has told us or shown us, recorded so the team can go and check it.

Prepared for: [CLIENT_NAME]
Contact number: [CLIENT_PHONE]
Date of instruction: [DATE]
Search type: Standard property search

PROPERTY
Address: [PROPERTY_ADDRESS]
State: [STATE]
Local Government Area: [LGA]
Survey plan number: [SURVEY_NUMBER, or "None provided"]
Surveyor: [SURVEYOR_NAME, or "None provided"]

AS-CLAIMED OWNERSHIP (unverified)
Owner/vendor as named by the client: [OWNER_NAME]
Client's relationship to that person: [HOW THE CLIENT CAME TO BE DEALING WITH THEM]

DOCUMENTS THE CLIENT HAS SEEN OR HOLDS (unverified)
[EACH DOCUMENT, one per line, with its number and date where the client could give one. Write "None seen" if the client has not seen any.]

PURPOSE OF THE SEARCH
[Purchase / mortgage or loan / other, as stated. If a mortgage to a company: company name, RC number, date of incorporation.]

MATTERS THE CLIENT ALREADY KNOWS OF
[Any encumbrance, dispute, litigation, or government acquisition the client disclosed. Write "None disclosed" if none.]

WHAT THE TEAM NEEDS TO ESTABLISH
Registered ownership of the property, any registered encumbrances against it, and the basic title position at the [STATE] Land Registry.

FEE
As shown with this instruction. The team carries out the search once it is paid.`
