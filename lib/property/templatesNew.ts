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

// ─── Phase 4: Wills & probate, Land title disputes. LAWYER TO CHECK every one. ───

export const WILL = `THIS IS THE LAST WILL AND TESTAMENT of me, [TESTATOR_NAME], of [TESTATOR_ADDRESS], [OCCUPATION], made this ____ day of ____________ 20____.

1. REVOCATION
I revoke all former wills, codicils and other testamentary dispositions made by me.

2. EXECUTORS AND TRUSTEES
I appoint [EXECUTOR_1_NAME] of [EXECUTOR_1_ADDRESS] and [EXECUTOR_2_NAME] of [EXECUTOR_2_ADDRESS] (together "my Executors") to be the executors and trustees of this my Will.

3. GUARDIAN
[GUARDIAN_CLAUSE — only if the testator has children under 18: "I appoint (name) of (address) to be the guardian of any of my children who are minors at my death." Otherwise leave this clause out and renumber.]

4. GIFTS OF PROPERTY
[SPECIFIC_GIFTS — one numbered sub-clause per gift: "I give my property situate at (address), covered by (title document and its registration particulars), to (beneficiary's full name and relationship to me) absolutely."]

5. RESIDUARY ESTATE
I give all the rest of my estate, of whatever kind and wherever situate, not otherwise disposed of by this Will ("my Residuary Estate"), to [RESIDUARY_BENEFICIARIES, with their shares].

6. DEBTS AND EXPENSES
My Executors shall pay my just debts, funeral and testamentary expenses out of my Residuary Estate.

7. GIFTS TO MINORS
Any gift under this Will to a person under the age of eighteen years shall be held by my Executors on trust for that person until they reach that age, and my Executors may apply the income or capital for that person's maintenance, education or benefit in the meantime.

IN WITNESS WHEREOF I have signed this Will on the day and year first above written.

SIGNED by the above-named Testator, [TESTATOR_NAME], as his/her last Will, in our presence, both of us being present at the same time, and by us in his/her presence and in the presence of each other:

________________________
[TESTATOR_NAME]
Testator

FIRST WITNESS
Name: ______________________
Address: ______________________
Occupation: ______________________
Signature: ______________________

SECOND WITNESS
Name: ______________________
Address: ______________________
Occupation: ______________________
Signature: ______________________`

export const CODICIL = `THIS IS A CODICIL to the last Will of me, [TESTATOR_NAME], of [TESTATOR_ADDRESS], which Will is dated [WILL_DATE], made this ____ day of ____________ 20____.

1. [CHANGES — one numbered clause per change, e.g. "I revoke clause 4(b) of my Will." or "I give my property situate at (address) to (beneficiary) absolutely, in place of the gift in clause 4(b) of my Will."]

2. In all other respects I confirm my Will.

IN WITNESS WHEREOF I have signed this Codicil on the day and year first above written.

SIGNED by the above-named Testator, [TESTATOR_NAME], as a Codicil to his/her last Will, in our presence, both of us being present at the same time, and by us in his/her presence and in the presence of each other:

________________________
[TESTATOR_NAME]
Testator

FIRST WITNESS
Name: ______________________
Address: ______________________
Occupation: ______________________
Signature: ______________________

SECOND WITNESS
Name: ______________________
Address: ______________________
Occupation: ______________________
Signature: ______________________`

/** Given to the client in the message with a will or codicil. Not a document: no price. */
export const WILL_SIGNING_INSTRUCTIONS = `HOW TO SIGN YOUR WILL (a will signed the wrong way may not be valid):
1. Sign at the end, in the presence of TWO witnesses who are both in the room at the same time, watching you sign.
2. Each witness then signs, in your presence and in each other's presence, and writes their name, address and occupation.
3. A witness must NOT be someone who receives anything under the will, nor the husband or wife of such a person: a gift to a witness or a witness's spouse fails.
4. Use adult witnesses who can read, and who are not your executors if you can avoid it.
5. Do not staple, unstaple or attach anything to the will after signing, and do not write on it afterwards. To change it, ask us for a codicil.
6. Keep the original somewhere safe and tell your executors where it is. Pandas LP or the Probate Registry can keep it for you.
7. A later marriage under the Marriage Act cancels this will unless it was made expressly in contemplation of that marriage: come back to us if you marry.`

export const PROBATE_APPLICATION = `[DATE]

The Probate Registrar
[PROBATE_REGISTRY — from choose_probate_path]

Dear Sir/Madam,

APPLICATION FOR [GRANT — "PROBATE" / "LETTERS OF ADMINISTRATION" / "LETTERS OF ADMINISTRATION WITH THE WILL ANNEXED" / "RESEALING OF A GRANT"] IN THE ESTATE OF [DECEASED_NAME] (DECEASED)

We are Solicitors to [APPLICANT_NAMES] ("our Clients"), the [APPLICANT_CAPACITY — e.g. "executors named in the Will dated (date)" / "widow and eldest son"] of [DECEASED_NAME] (deceased), late of [DECEASED_ADDRESS], who died on [DATE_OF_DEATH] at [PLACE_OF_DEATH].

On our Clients' instructions, we apply for the grant of [GRANT] in respect of the estate of the deceased, and enclose the documents listed in the Schedule below.

We shall be grateful to be advised of the fees payable and of any further requirement of the Registry.

Yours faithfully,


________________________
For: Pandas LP
Solicitors to [APPLICANT_NAMES]

SCHEDULE OF DOCUMENTS ENCLOSED
[DOCUMENTS — one per line, from choose_probate_path]`

export const ASSENT = `DEED OF ASSENT

THIS ASSENT is made this ____ day of ____________ 20____

BY [PERSONAL_REPRESENTATIVES — full names and addresses] (hereinafter called "the Personal Representatives"), the personal representatives of [DECEASED_NAME] (deceased), late of [DECEASED_ADDRESS]

IN FAVOUR OF [BENEFICIARY_NAME] of [BENEFICIARY_ADDRESS] (hereinafter called "the Beneficiary")

WHEREAS:
(a) [DECEASED_NAME] (hereinafter called "the Deceased") died on [DATE_OF_DEATH] seised of the property described in the Schedule hereto ("the Property"), held under [ROOT_OF_TITLE].
(b) [GRANT — "Probate of the Will dated (date) of the Deceased" / "Letters of Administration of the estate of the Deceased"] was granted to the Personal Representatives by the Probate Registry of the High Court of [STATE] on [GRANT_DATE].
(c) [ENTITLEMENT — "By clause (N) of the said Will the Deceased gave the Property to the Beneficiary." / "The Beneficiary is entitled to the Property under the Administration of Estates Law of (State)."]
(d) The Personal Representatives have paid or provided for the debts and expenses of the estate, and the Property is not required for their payment.

NOW THIS DEED WITNESSES that the Personal Representatives, as personal representatives of the Deceased, HEREBY ASSENT to the vesting in the Beneficiary of ALL THAT the Property described in the Schedule hereto, TO HOLD UNTO the Beneficiary absolutely, subject to the provisions of the Land Use Act Cap L5, LFN, 2004.

SCHEDULE
(Property description: [PROPERTY_DESCRIPTION])

IN WITNESS WHEREOF the Personal Representatives have executed this Deed on the day and year first above written.

[EXECUTION BLOCK — one "SIGNED, SEALED AND DELIVERED" block for each Personal Representative, with a witness]`

export const DISPUTE_BRIEF = `LAWYER BRIEF: LAND TITLE DISPUTE
For the Pandas LP litigation team. Prepared from the client's account; NOTHING IN IT HAS BEEN VERIFIED.

Client: [CLIENT_NAME]
Contact number: [CLIENT_PHONE]
Date of brief: [DATE]

1. THE LAND
Address and description: [PROPERTY_DESCRIPTION]
State and Local Government Area: [STATE_AND_LGA]
Size and survey plan, if any: [SIZE_AND_SURVEY — or "None given"]

2. THE CLIENT'S CLAIM TO THE LAND
How the client says they hold it: [TITLE_ROUTE — which of the five ways of proving title the facts point to: traditional history, documents of title, acts of ownership, long possession and enjoyment, possession of connected or adjacent land]
Documents the client holds (unverified): [DOCUMENTS — one per line, with numbers and dates, or "None"]
Possession history: [POSSESSION — who has been in possession, since when, and what they did on the land]

3. THE OTHER SIDE
Who they are: [OTHER_PARTY]
Their claim, as the client understands it: [OTHER_CLAIM]
What they have done (entry, building, threats, sale to others): [OTHER_ACTS]

4. PROCEEDINGS AND REPORTS
Any court case, past or pending (court, suit number, stage): [COURT_CASES — or "None known"]
Any police report or petition: [POLICE — or "None"]

5. KEY DATES
[DATES — when the client acquired the land; when possession was lost or the dispute began; any other date that matters]

6. ISSUES
[ISSUES — the questions the dispute turns on, in plain words]

7. REMEDIES TO CONSIDER
[REMEDIES — e.g. declaration of title, damages for trespass, injunction, recovery of possession]

8. FLAGS
Limitation: [LIMITATION — from check_limitation: years since possession was lost, and its flag]
Pending case / land under litigation: [PENDING_CASE_FLAG]
Land grabbers: [LAND_GRABBER_FLAG — in Lagos, note the Lagos State Properties Protection Law 2016]
Urgency (building in progress, threats, a sale about to happen): [URGENCY]`
