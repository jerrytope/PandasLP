// Templates that are NOT in the current Property Law Agent prompt: written for the rebuild.
// LAWYER TO CHECK each one before the Phase 5 cut-over (docs/property_agent_plans/, task 2.15).

export const RENT_DEMAND_LETTER = `[TENANT_NAME]
[PROPERTY_ADDRESS]

Dear Sir/Madam,

DEMAND FOR PAYMENT OF ARREARS OF RENT

We are Solicitors to [LANDLORD_NAME] ("our Client"), the landlord of the premises situate at [PROPERTY_ADDRESS] which you occupy as our Client's tenant, and write on our Client's instructions.

Our Client informs us that rent of **₦[RENT_AMOUNT]** per [FREQUENCY] is payable by you in advance, and that you have failed to pay the rent due for the period from **[ARREARS_FROM]** to **[ARREARS_TO]**, being arrears of **₦[ARREARS_AMOUNT]**.

We are instructed to demand, as we hereby do, that you pay the said sum of **₦[ARREARS_AMOUNT]** to our Client within **[DAYS_TO_PAY] days** of your receipt of this letter.

TAKE NOTICE that if you fail to pay within that time, our Client reserves the right to take such further steps as the law allows to recover the arrears and possession of the premises, without further reference to you.

Yours Faithfully,


________________________
For: Pandas LP
Solicitors to the Landlord, [LANDLORD_NAME]`

export const DEED_OF_LEASE = `DEED OF LEASE

THIS DEED OF LEASE is made this [DATE]

BETWEEN

[LESSOR_NAME] of [LESSOR_ADDRESS] (hereinafter called "the Lessor", which expression shall where the context so admits include the Lessor's successors-in-title and assigns) of the one part

AND

[LESSEE_NAME] of [LESSEE_ADDRESS] (hereinafter called "the Lessee", which expression shall where the context so admits include the Lessee's successors-in-title and permitted assigns) of the other part

WHEREAS the Lessor is seised of the property described in the Schedule hereto ("the Property") by virtue of [ROOT_OF_TITLE], and has agreed to grant a lease of the Property to the Lessee on the terms below.

THIS DEED WITNESSES AS FOLLOWS:

1. TERM: In consideration of the rent and the covenants below, the Lessor HEREBY DEMISES unto the Lessee ALL THAT the Property TO HOLD UNTO the Lessee for a term of **[TERM]** commencing on **[START_DATE]** and ending on **[END_DATE]**.

2. RENT: The Lessee shall pay rent of **₦[RENT_AMOUNT]** per [FREQUENCY], payable in advance.

3. RENT REVIEW: [RENT_REVIEW_CLAUSE]

4. THE LESSEE COVENANTS with the Lessor:
a. To pay the rent on the days and in the manner stated above.
b. To use the Property solely for [PERMITTED_USE].
c. To keep the interior of the Property in good and tenantable repair, fair wear and tear excepted.
d. Not to assign, sublet or part with possession of the Property or any part of it without the Lessor's prior written consent.
e. To pay all charges for utilities consumed on the Property during the term.
f. To yield up the Property at the end of the term in the state of repair required by this Deed.

5. THE LESSOR COVENANTS with the Lessee:
a. That the Lessee, paying the rent and observing the covenants, shall quietly hold and enjoy the Property during the term without interruption by the Lessor or any person claiming through the Lessor.
b. [LESSOR_OBLIGATIONS — e.g. structural repairs, land use charge, ground rent]

6. FORFEITURE: If the rent or any part of it is unpaid for [ARREARS_PERIOD] after it falls due, or the Lessee breaches any covenant, the Lessor may re-enter the Property after serving the notices the law requires, and this lease shall then end, without prejudice to the Lessor's other remedies.

7. NOTICE TO DETERMINE: [NOTICE_CLAUSE — the notice either party must give to end the lease, and how it is served]

8. GOVERNOR'S CONSENT: This Deed is subject to the Governor's Consent being obtained pursuant to Section 22 of the Land Use Act, and the parties undertake to do all things necessary to perfect this lease, including stamping and registration.

9. DISPUTE RESOLUTION: Any dispute arising from this Deed shall first be referred to mediation before resort to litigation, without prejudice to either party's statutory rights.

SCHEDULE
(Property description: [PROPERTY_DESCRIPTION])

IN WITNESS WHEREOF the parties have executed this Deed on the day and year first above written.

[EXECUTION BLOCK — see EXECUTION BLOCKS in the shared rules; pick the variant matching each party's type]`

export const SUBLEASE_AGREEMENT = `SUBLEASE AGREEMENT

THIS SUBLEASE AGREEMENT is made this [DATE]

BETWEEN

[SUBLESSOR_NAME] of [SUBLESSOR_ADDRESS] (hereinafter called "the Sublessor") of the one part

AND

[SUBLESSEE_NAME] of [SUBLESSEE_ADDRESS] (hereinafter called "the Sublessee") of the other part

WHEREAS by a [HEAD_LEASE_DESCRIPTION] dated [HEAD_LEASE_DATE] ("the Head Lease") made between [HEAD_LANDLORD_NAME] ("the Head Landlord") and the Sublessor, the premises situate at [PROPERTY_ADDRESS] ("the Premises") were let to the Sublessor for a term ending on [HEAD_LEASE_END_DATE], and the Sublessor has agreed to sublet the Premises to the Sublessee on the terms below.

[HEAD_LANDLORD_CONSENT_RECITAL — e.g. "AND WHEREAS the Head Landlord has consented in writing to this sublease by a letter dated (date)." Include only where the Head Lease requires consent; otherwise leave this out.]

THIS AGREEMENT WITNESSES AS FOLLOWS:

1. TERM: The Sublessor lets and the Sublessee takes the Premises for a term of **[TERM]** commencing on **[START_DATE]** and ending on **[END_DATE]**, being at least one day shorter than the unexpired term of the Head Lease.

2. RENT: The Sublessee shall pay rent of **₦[RENT_AMOUNT]** per [FREQUENCY], payable in advance.

3. HEAD LEASE COVENANTS: The Sublessee shall observe and perform the covenants on the tenant's part contained in the Head Lease, so far as they relate to the Premises (other than the payment of the rent reserved by the Head Lease), and shall not do anything that would put the Sublessor in breach of the Head Lease.

4. USER: The Premises shall be used solely for [PERMITTED_USE].

5. REPAIRS: [REPAIR_CLAUSE]

6. NO FURTHER SUBLETTING: The Sublessee shall not assign, sublet or part with possession of the Premises or any part of it.

7. QUIET ENJOYMENT: The Sublessee, paying the rent and observing the terms of this Agreement, shall quietly enjoy the Premises during the term without interruption by the Sublessor or any person claiming through the Sublessor.

8. NOTICE TO DETERMINE: [NOTICE_CLAUSE]

9. FORFEITURE: If the Sublessee breaches any term of this Agreement, including non-payment of rent for [ARREARS_PERIOD], the Sublessor may re-enter the Premises after service of the notices the law requires.

IN WITNESS WHEREOF the parties have executed this Agreement on the day and year first above written.

[EXECUTION BLOCK — see EXECUTION BLOCKS in the shared rules; pick the variant matching each party's type]`

export const DEED_OF_SUBLEASE = `DEED OF SUBLEASE

THIS DEED OF SUBLEASE is made this [DATE]

BETWEEN

[SUBLESSOR_NAME] of [SUBLESSOR_ADDRESS] (hereinafter called "the Sublessor", which expression shall where the context so admits include the Sublessor's successors-in-title and assigns) of the one part

AND

[SUBLESSEE_NAME] of [SUBLESSEE_ADDRESS] (hereinafter called "the Sublessee", which expression shall where the context so admits include the Sublessee's successors-in-title and permitted assigns) of the other part

WHEREAS by a Deed of Lease dated [HEAD_LEASE_DATE] ("the Head Lease") made between [HEAD_LANDLORD_NAME] ("the Head Landlord") and the Sublessor, the property described in the Schedule hereto ("the Property") was demised to the Sublessor for a term of [HEAD_LEASE_TERM] commencing on [HEAD_LEASE_START_DATE].

[HEAD_LANDLORD_CONSENT_RECITAL — include only where the Head Lease requires the Head Landlord's consent; otherwise leave this out.]

AND WHEREAS the Sublessor has agreed to grant a sublease of the Property to the Sublessee on the terms below.

THIS DEED WITNESSES AS FOLLOWS:

1. TERM: In consideration of the rent and the covenants below, the Sublessor HEREBY DEMISES unto the Sublessee ALL THAT the Property TO HOLD UNTO the Sublessee for a term of **[TERM]** commencing on **[START_DATE]** and ending on **[END_DATE]**, being at least one day shorter than the unexpired residue of the Head Lease.

2. RENT: The Sublessee shall pay rent of **₦[RENT_AMOUNT]** per [FREQUENCY], payable in advance.

3. HEAD LEASE COVENANTS: The Sublessee covenants to observe and perform the covenants on the lessee's part in the Head Lease, so far as they relate to the Property (other than payment of the rent reserved by the Head Lease), and to indemnify the Sublessor against any breach of them.

4. THE SUBLESSOR COVENANTS to pay the rent reserved by the Head Lease and to observe the Head Lease covenants, so far as the Sublessee is not bound to do so under this Deed, and that the Sublessee shall quietly enjoy the Property during the term.

5. USER, REPAIRS AND ALIENATION: [USER_REPAIRS_ALIENATION_CLAUSES]

6. FORFEITURE: If the rent or any part of it is unpaid for [ARREARS_PERIOD] after it falls due, or the Sublessee breaches any covenant, the Sublessor may re-enter the Property after serving the notices the law requires.

7. GOVERNOR'S CONSENT: This Deed is subject to the Governor's Consent being obtained pursuant to Section 22 of the Land Use Act, and the parties undertake to do all things necessary to perfect this sublease, including stamping and registration.

SCHEDULE
(Property description: [PROPERTY_DESCRIPTION])

IN WITNESS WHEREOF the parties have executed this Deed on the day and year first above written.

[EXECUTION BLOCK — see EXECUTION BLOCKS in the shared rules; pick the variant matching each party's type]`

export const DEED_OF_RELEASE = `DEED OF RELEASE

THIS DEED OF RELEASE is made this [DATE]

BETWEEN

[RELEASOR_NAME] of [RELEASOR_ADDRESS] (hereinafter called "the Releasor") of the one part

AND

[RELEASEE_NAME] of [RELEASEE_ADDRESS] (hereinafter called "the Releasee") of the other part

WHEREAS by a [INSTRUMENT_DESCRIPTION] dated [INSTRUMENT_DATE] [REGISTRATION_PARTICULARS] ("the Instrument"), the Releasee [created a mortgage or charge over / granted an interest in] the property described in the Schedule hereto ("the Property") in favour of the Releasor to secure [SECURED_OBLIGATION].

AND WHEREAS [the said obligation has been fully paid and discharged / RELEASE_REASON], and the Releasor has agreed to release the Property from the Instrument.

THIS DEED WITNESSES AS FOLLOWS:

1. The Releasor, as [mortgagee / chargee / the person entitled], HEREBY RELEASES and DISCHARGES ALL THAT the Property from the Instrument and from all claims and demands under it, TO THE INTENT that the Property shall be held by the Releasee freed and discharged from the Instrument.

2. The Releasor acknowledges that [RELEASE_BASIS, e.g. "the sum of ₦X secured by the Instrument has been paid in full"], and that nothing further is owed under the Instrument.

3. The Releasor shall, at the Releasee's request and expense, deliver up the title documents held under the Instrument and execute any further document needed to record this release at the Land Registry.

SCHEDULE
(Property description: [PROPERTY_DESCRIPTION])

IN WITNESS WHEREOF the parties have executed this Deed on the day and year first above written.

[EXECUTION BLOCK — see EXECUTION BLOCKS in the shared rules; pick the variant matching each party's type]`

export const CONSENT_APPLICATION = `[DATE]

[CONSENT_AUTHORITY_TITLE]
[CONSENT_AUTHORITY_ADDRESS]

Dear Sir,

APPLICATION FOR CONSENT TO [TRANSACTION, e.g. ASSIGNMENT / LEGAL MORTGAGE / SUBLEASE] OF THE PROPERTY SITUATE AT [PROPERTY_ADDRESS], COVERED BY [TITLE_DOCUMENT AND ITS REGISTRATION PARTICULARS]

We are Solicitors to [APPLICANT_NAME] ("our Client") and write on our Client's instructions.

Our Client is a party, as [APPLICANT_ROLE], to a [INSTRUMENT_NAME] dated [INSTRUMENT_DATE] made between [PARTY_1_NAME] and [PARTY_2_NAME] in respect of the property described above, for [CONSIDERATION, or "natural love and affection" for a gift].

Pursuant to [CONSENT_PROVISION, from prepare_consent_application], we hereby apply on our Client's behalf for consent to the said transaction.

We enclose the following documents in support of this application:
[ENCLOSURES — one per line, from prepare_consent_application]

We shall be grateful for your favourable consideration of this application, and for advice on the fees and charges payable.

Yours faithfully,


________________________
For: Pandas LP
Solicitors to [APPLICANT_NAME]`
