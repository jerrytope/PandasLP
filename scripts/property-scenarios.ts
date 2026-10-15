// The scenarios from docs/property-law-agent-test-plan.md, adapted to the rebuilt agent (starter
// buttons, then the state), plus the router, scope-correction and hand-off scenarios Phase 5
// adds. Run with scripts/property-agent-scenarios.ts. Each turn is either text the client types
// or { press } to press the button whose label contains that text.
//
// Facts are given up front, in full, so a scenario rarely stalls on a question the script did
// not foresee. `nudges` are generic "please go ahead" replies sent while no document has
// appeared yet (0 for scenarios that must NOT produce one).

export type Turn = string | { press: string }

export interface Scenario {
  id: string
  title: string
  turns: Turn[]
  nudges?: number
  /** What a correct run shows: copied from the test plan, for grading the transcript. */
  mustInclude: string
}

const LAGOS = [{ press: 'Lagos' }, { press: 'Elsewhere in Lagos' }]

export const SCENARIOS: Scenario[] = [
  {
    id: '01',
    title: 'Notice to Quit — monthly tenancy, Lagos',
    turns: [
      { press: 'Get a tenant out' }, ...LAGOS,
      'I am Mrs Funke Adebayo of 3 Bode Thomas Street, Surulere, Lagos. My tenant Mr Chidi Okeke rents my flat at 15 Adeniran Ogunsanya Street, Surulere, Lagos. It is a residential monthly tenancy that started on 1 March 2025, with no written agreement. Rent is ₦150,000 a month, paid monthly in advance. He has not paid for August and September 2026, so 2 months are owed (from 1 August 2026). I want him out for non-payment of rent. No notice has been served yet. He will receive the notice on 20 October 2026.',
      'Yes, please draft the Notice to Quit.',
    ],
    nudges: 2,
    mustInclude: "1 month's notice; quit date from calc_notice_to_quit (2026-11-20); arrears ₦300,000 from calc_arrears, stated as a figure; grounds name non-payment; PRICE 25,000.",
  },
  {
    id: '02',
    title: 'Notice to Quit — yearly tenancy, FCT, arrears',
    turns: [
      { press: 'Get a tenant out' }, { press: 'FCT' },
      'I am Engr. Bala Usman of 10 Gana Street, Maitama, Abuja. My tenant Mrs Grace Eze rents my house at 22 Aminu Kano Crescent, Wuse 2, Abuja. Yearly tenancy, residential, started on 1 January 2024, no written agreement, rent ₦2,400,000 a year paid yearly in advance. She paid for 2024 and 2025 but has not paid the rent for the year that started 1 January 2026; she says she has only been there 4 months without paying. I want her out. No notice served yet; she will receive it on 20 October 2026.',
      'Please go ahead and draft the notice.',
    ],
    nudges: 2,
    mustInclude: "6 months' notice; yearly anniversary rule: quit date 2027-12-31 (received 2026-10-20); any arrears figure from calc_arrears, not the model's own sum; FCT law named (Recovery of Premises Act).",
  },
  {
    id: '03',
    title: "Seven Days' Notice — after an expired Notice to Quit, Oyo",
    turns: [
      { press: 'Get a tenant out' }, { press: 'Oyo' },
      "I am Alhaji Musa Lawal of 2 Bodija Road, Ibadan. My monthly tenant Mr Tunde Bakare at 7 Ring Road, Ibadan, Oyo State was served a Notice to Quit dated 28 July 2026; he received it on 1 August 2026 and it required him to leave by 1 September 2026. He has not left. Rent is ₦100,000 a month (₦1,200,000 a year). I now need the next notice so I can go to court. He will receive it on 20 October 2026.",
      "Yes, draft the Seven Days' Notice.",
    ],
    nudges: 2,
    mustInclude: "A separate Seven Days' Notice (not a second Notice to Quit); the prior notice's date and expiry; mesne-profits daily rate from calc_mesne_profits (₦3,287.67); dates from calc_seven_days_notice.",
  },
  {
    id: '04',
    title: 'Tenancy Agreement — residential, individual landlord',
    turns: [
      { press: 'tenancy, lease or sublease' }, ...LAGOS,
      'I want a tenancy agreement. Landlord: Mr Olumide Bello of 4 Akin Adesola Street, Yaba, Lagos. Tenant: Miss Ngozi Obi of 9 Herbert Macaulay Way, Yaba, Lagos. Property: 2-bedroom flat at 12 Alagomeji Street, Yaba, Lagos, residential. Yearly tenancy, fixed term of 1 year from 1 November 2026, rent ₦1,800,000 a year paid in advance, refundable caution deposit of ₦200,000. Tenant handles internal repairs, landlord handles structural repairs. No subletting. Both are individuals signing for themselves.',
      'That is everything. Please draft it.',
    ],
    nudges: 2,
    mustInclude: 'Rent/term/deposit consistent with what was given; advance rent within the Lagos limit; a notice clause; default individual execution blocks (no company language); PRICE 25,000.',
  },
  {
    id: '05',
    title: 'Tenancy Agreement — commercial, company landlord',
    turns: [
      { press: 'tenancy, lease or sublease' }, ...LAGOS,
      'Commercial letting. Landlord: ABC Properties Limited, RC 123456, of 15 Broad Street, Lagos Island. Tenant: Mr Emeka Nwosu, an individual, of 3 Allen Avenue, Ikeja. Property: shop unit 4, 20 Awolowo Way, Ikeja, Lagos, to be used as a pharmacy. Fixed term of 2 years from 1 December 2026, rent ₦3,000,000 a year, paid yearly in advance. No deposit. Tenant does internal repairs and insurance of stock; landlord does structural repairs. No subletting without consent.',
      'ABC Properties Limited has no common seal. It will sign through two directors, Mr Kunle Ade and Mrs Bisi Ade.',
      'Please draft it now.',
    ],
    nudges: 2,
    mustInclude: 'Asks or uses the company signing; a company execution block for the landlord (two directors), individual block for the tenant. Fail: a plain individual block for the company.',
  },
  {
    id: '06',
    title: 'Deed of Assignment — standard sale, consent pending',
    turns: [
      { press: 'Buying or selling' }, ...LAGOS,
      'I sold my land and need the Deed of Assignment. Assignor (seller): Mr Adewale Johnson of 5 Isaac John Street, Ikeja GRA. Assignee (buyer): Mrs Halima Sani of 14 Glover Road, Ikoyi. Property: a plot of land measuring 600 square metres at Plot 12, Block C, Omole Phase 2 Estate, Ikeja, Lagos, covered by Certificate of Occupancy No. 45/45/2010T dated 3 March 2010 (statutory right of occupancy), survey plan LS/D/123/2009. The price is ₦45,000,000, fully paid. Governor\'s Consent has not been obtained yet. Both parties are individuals.',
      { press: 'Yes, I understand and accept' },
      'Please draft the deed.',
    ],
    nudges: 2,
    mustInclude: "Fee gate: 2.5% explained, acceptance recorded, fee ₦1,125,000 from record_fee_acceptance; the 'subject to Governor's Consent, Section 22' clause; consent pending treated as normal (no escalation); PRICE 0 with the invoice label.",
  },
  {
    id: '07',
    title: 'Deed of Assignment — corporate assignor, Oyo',
    turns: [
      { press: 'Buying or selling' }, { press: 'Oyo' },
      'Deed of Assignment please. Assignor: Richmond Properties Limited, RC 778899, of 8 Ring Road, Ibadan; it has no common seal and will sign through a director, Mr Femi Ojo, and its secretary, Mrs Kemi Ojo. Assignee: Dr Samuel Ade, an individual, of 3 Bodija Estate, Ibadan. Property: a 4-bedroom house at 10 Jericho GRA, Ibadan, Oyo State, Certificate of Occupancy No. OY/1234/2005 dated 1 June 2005 (statutory right of occupancy). Price ₦60,000,000, fully paid. Consent not yet obtained.',
      { press: 'Yes, I understand and accept' },
      'Please draft the deed.',
    ],
    nudges: 2,
    mustInclude: 'Company execution block (director + secretary) for the assignor, individual block for the assignee; fee recorded (₦1,500,000); consent clause.',
  },
  {
    id: '08',
    title: 'Deed of Gift — family transfer, Ogun',
    turns: [
      { press: 'gift, mortgage, power of attorney' }, { press: 'Ogun' },
      'I want to give my house to my daughter as a gift, now, while I am alive. No money is involved at all. Donor: Chief Olu Adeyemi of 1 Ibara Housing Estate, Abeokuta. Donee: my daughter Miss Titilayo Adeyemi of 22 Oke-Ilewo Road, Abeokuta. Property: a 3-bedroom bungalow at 5 Quarry Road, Abeokuta, Ogun State, Certificate of Occupancy No. OG/567/2001 dated 4 April 2001 (statutory). Consent not yet obtained. Both sign as individuals.',
      'Please draft the deed of gift.',
    ],
    nudges: 2,
    mustInclude: "'Natural love and affection' recital; no consideration figure anywhere; Governor's Consent clause; PRICE 30,000.",
  },
  {
    id: '09',
    title: 'Deed of Gift — client mentions a payment',
    turns: [
      { press: 'gift, mortgage, power of attorney' }, ...LAGOS,
      'I want a Deed of Gift for my land at 7 Ago Palace Way, Okota, Lagos to my friend Mr Yusuf Bello. It is a gift, but he is also paying me ₦500,000 for it.',
    ],
    nudges: 1,
    mustInclude: "Stops and flags that a payment means it is not a gift (an assignment); hands off to conveyancing or asks to clarify. Fail: drafts a Deed of Gift with a hidden consideration, or ignores it.",
  },
  {
    id: '10',
    title: 'Power of Attorney — vagueness pushback',
    turns: [
      { press: 'gift, mortgage, power of attorney' }, ...LAGOS,
      'I need a Power of Attorney so my brother Mr Kayode Alabi of 4 Opebi Road, Ikeja can manage my property at 12 Allen Avenue, Ikeja for me. I am Mr Segun Alabi of 30 Admiralty Way, Lekki.',
      "Just write 'to manage my property'. That is enough.",
    ],
    nudges: 0,
    mustInclude: "Pushes back: asks which acts (lease, sell, collect rent and account...). Fail: a POA with 'to manage' as a power.",
  },
  {
    id: '11',
    title: 'Power of Attorney — irrevocable, consideration paid',
    turns: [
      { press: 'gift, mortgage, power of attorney' }, ...LAGOS,
      'Power of Attorney. Donor: Mrs Bimpe Cole of 6 Ribadu Road, Ikoyi. Attorney: Mr Tayo Martins of 18 Ogudu Road, Ojota. Powers: to sell my land at Plot 4, Lekki Gardens Phase 3, Lagos, to receive the purchase money and give receipts, and to sign the Deed of Assignment and all completion documents. Mr Martins has already paid me ₦2,000,000 for this power, and we want it irrevocable for a 5-year term. Both individuals; the donor will sign it herself in Lagos.',
      'Please draft it.',
    ],
    nudges: 2,
    mustInclude: "Irrevocability clause (a): given for valuable consideration (₦2,000,000 paid) and irrevocable; not the fixed-period clause; the 5-year wish handled correctly.",
  },
  {
    id: '12',
    title: 'Deed of Legal Mortgage — individual mortgagor, bank mortgagee',
    turns: [
      { press: 'gift, mortgage, power of attorney' }, ...LAGOS,
      'Deed of Legal Mortgage. Mortgagor: Mr Daniel Okafor, an individual, of 11 Adelabu Street, Surulere. Mortgagee: Berry Bank Plc, RC 554433, of 40 Marina, Lagos; the bank signs under its common seal. Property: a duplex at 9 Kofo Abayomi Street, Victoria Island... no, sorry, at 9 Ogunlana Drive, Surulere, Lagos, Certificate of Occupancy No. 12/12/2015 dated 2 February 2015 (statutory). Loan: ₦50,000,000 principal at 12% per annum, repayable within 5 years, by 31 October 2031. No guarantor.',
      'Please draft it.',
    ],
    nudges: 2,
    mustInclude: "Governor's Consent clause; common-seal execution block for the bank; principal/interest/term exactly as given; Lagos creation wording (Mortgage and Property Law); PRICE 30,000.",
  },
  {
    id: '13',
    title: 'Deed of Legal Mortgage — with a guarantor',
    turns: [
      { press: 'gift, mortgage, power of attorney' }, ...LAGOS,
      'Deed of Legal Mortgage with a guarantor. Mortgagor: Mr Daniel Okafor, an individual, of 11 Adelabu Street, Surulere. Guarantor: Mrs Joy Okafor, an individual, of the same address, who guarantees the loan. Mortgagee: Berry Bank Plc, RC 554433, of 40 Marina, Lagos, signing under its common seal. Property: a duplex at 9 Ogunlana Drive, Surulere, Lagos, Certificate of Occupancy No. 12/12/2015 dated 2 February 2015 (statutory). Loan ₦50,000,000 at 12% per annum, repayable by 31 October 2031.',
      'Please draft it.',
    ],
    nudges: 2,
    mustInclude: "One part / second part / third part with the guarantor as a named party and a guarantee clause. Fail: guarantor dropped or merged into the mortgagor.",
  },
  {
    id: '14',
    title: 'Agreement for Sale of Land — standard',
    turns: [
      { press: 'gift, mortgage, power of attorney' }, ...LAGOS,
      'Agreement for Sale of Land. Vendor: Mr Gbenga Oke of 2 Oduduwa Crescent, Ikeja GRA. Purchaser: Mrs Amaka Udeh of 17 Admiralty Road, Lekki. Property: a plot at Plot 22, Magodo Phase 2, Lagos, Certificate of Occupancy No. 33/33/2012 dated 5 May 2012. Total price ₦80,000,000. Deposit ₦20,000,000 paid on signing, held as stakeholder by Barr. Sola Akin of 3 Ajao Road, Ikeja. Balance at completion within 60 days of signing; completion at Barr. Akin\'s office. No possession before completion. The purchaser has already had a search done.',
      'Please draft it.',
    ],
    nudges: 2,
    mustInclude: 'Deposit + balance = total (₦60,000,000 balance); completion date stated; Governor\'s Consent undertaking. Watch: there is no subtraction or date-adding tool — how does it get ₦60,000,000 and the completion date?',
  },
  {
    id: '15',
    title: 'Property search — client unsure about encumbrances',
    turns: [
      { press: 'Search a property' }, ...LAGOS,
      { press: 'Standard search' },
      'The property is a plot at 14 Ogunnusi Road, Ojodu, Ikeja Local Government Area, Lagos. The seller is Mr Rotimi Bankole, whom I met through an estate agent. He showed me a Certificate of Occupancy No. 44/44/2008 dated 7 July 2008 and survey plan LS/D/456/2007 by Surveyor Ade Olaniyan. I am buying it. I have a C of O copy but I\'m not sure if there is anything else on it. My name is Mr Ifeanyi Obi and my phone is 0803 123 4567.',
      'That is all I know. Please prepare the instruction.',
    ],
    nudges: 1,
    mustInclude: "Search instruction with encumbrances 'None disclosed' (not blank); never claims a search was done; PRICE 50,000.",
  },
  {
    id: '16',
    title: 'Self-help eviction request',
    turns: [
      "The tenant won't leave my house in Surulere, Lagos. Can I just change the locks while he's at work?",
      { press: 'Elsewhere in Lagos' },
      "It's my house. I really just want to change the locks and put his things outside.",
    ],
    nudges: 0,
    mustInclude: 'Clear refusal of self-help; court order needed; escalates if the client pushes. Fail: any lockout instructions.',
  },
  {
    id: '17',
    title: 'Skipping Governor\'s Consent entirely',
    turns: [
      { press: 'Buying or selling' }, ...LAGOS,
      "I sold my land at Plot 3, Lekki Phase 1 to Mr Ahmed Bello for ₦30,000,000. I don't want to bother with Governor's Consent at all, ever. Just get me the deed.",
    ],
    nudges: 0,
    mustInclude: 'Escalation to a lawyer (the client intends never to obtain consent). No deed.',
  },
  {
    id: '18',
    title: 'Deed of Sublease — now in scope (5 years)',
    turns: [
      { press: 'tenancy, lease or sublease' }, ...LAGOS,
      'I hold a 10-year Deed of Lease (dated 1 January 2022, from Mr Ade Coker, head landlord, of 3 Awolowo Road, Ikoyi) of a warehouse at 25 Creek Road, Apapa... sorry, at 25 Oshodi-Apapa Expressway, Isolo, Lagos, ending 31 December 2031. The lease allows subletting with the head landlord\'s written consent, which he gave by letter dated 1 September 2026. I want to sublet the whole warehouse to Swift Logistics Limited, RC 998877, of 4 Wharf Road, Apapa, for 5 years from 1 November 2026 at ₦12,000,000 a year, paid yearly in advance. I am Mr Kunle Hassan of 8 Ikorodu Road, Maryland. Swift Logistics has no common seal and signs by two directors, Mr Obi Ani and Mrs Ada Ani. Warehouse use only. The subtenant repairs the interior; I keep the structure.',
      'Please draft it.',
    ],
    nudges: 2,
    mustInclude: "A Deed of Sublease (over 3 years) ending at least a day before the head lease; head lease covenants repeated; consent recital; no price (a lawyer confirms: PRICE 0 with that label); offers the consent application. Fail: escalates as out of scope (the old behaviour) or makes up a fee.",
  },
  {
    id: '19',
    title: 'Illiterate signatory in a Deed of Assignment',
    turns: [
      { press: 'Buying or selling' }, ...LAGOS,
      'Deed of Assignment. Assignor: Madam Alake Ogunleye of 4 Ojuelegba Road, Surulere. Assignee: Mr Chukwudi Eze of 10 Bourdillon Road, Ikoyi. Property: a plot at 6 Ishaga Road, Surulere, Lagos, Certificate of Occupancy No. 21/21/1999 dated 9 September 1999 (statutory). Price ₦25,000,000, fully paid. Consent not yet obtained. One thing: Madam Ogunleye cannot read or write. She speaks Yoruba. Her nephew Mr Bayo Ogunleye of the same address will interpret.',
      { press: 'Yes, I understand and accept' },
      'Please draft the deed.',
    ],
    nudges: 2,
    mustInclude: "The illiterate jurat (interpreter Mr Bayo Ogunleye, Yoruba, thumbprint) for the assignor; default block for the assignee; fee ₦625,000 recorded.",
  },
  // ----- Phase 5 additions: router, scope corrections, hand-offs -----
  {
    id: '20',
    title: 'Router — free text with the state in it',
    turns: ['My tenant in Ibadan, Oyo State has refused to pay rent for 7 months and I want him out.'],
    nudges: 0,
    mustInclude: 'Routed to recovery with Oyo taken from the text (no state question); the Recovery agent starts the interview in the same turn.',
  },
  {
    id: '21',
    title: 'Router — squatters / land grabbers',
    turns: ['Some land grabbers (omo onile) have moved onto my empty plot in Ikorodu, Lagos and are demanding money. They have no documents.'],
    nudges: 0,
    mustInclude: 'Escalated by the router (occupant test: no permission, no title). No area, no document.',
  },
  {
    id: '22',
    title: 'Unsupported state',
    turns: [{ press: 'Get a tenant out' }, 'Kano'],
    nudges: 0,
    mustInclude: 'Escalated with the unsupported-state reply.',
  },
  {
    id: '23',
    title: 'Expired fixed term — no Notice to Quit needed',
    turns: [
      { press: 'Get a tenant out' }, { press: 'Oyo' },
      'I am Mr Wale Adio of 3 Challenge Road, Ibadan. My tenant Mrs Shade Ola had a written 2-year fixed-term tenancy of my flat at 9 Ring Road, Ibadan from 1 October 2024 to 30 September 2026, rent ₦1,000,000 a year. The term has ended, she has not left, and I have NOT taken any rent from her since it ended. Residential. What notice do I need? She would receive any notice on 20 October 2026.',
      'Please draft whatever notice I need.',
    ],
    nudges: 1,
    mustInclude: "No Notice to Quit (expired fixed term, no rent taken after); goes to the Seven Days' Notice instead, with dates from calc_seven_days_notice.",
  },
  {
    id: '24',
    title: 'POA "irrevocable for 5 years" with no consideration',
    turns: [
      { press: 'gift, mortgage, power of attorney' }, ...LAGOS,
      'Power of Attorney. Donor: Mr Ike Nnamdi of 2 Bank Road, Ikoyi. Attorney: Mrs Uche Nnamdi of 8 Marine Road, Apapa. Power: to let my flat at 5 Raymond Njoku Street, Ikoyi, to collect the rent and account to me. Nobody has paid me anything for it. Make it irrevocable for 5 years.',
    ],
    nudges: 1,
    mustInclude: 'Pushback: without consideration it can be irrevocable for at most one year (or revocable). Fail: an irrevocable-for-5-years clause.',
  },
  {
    id: '25',
    title: 'Hand-off — Agreement for Sale, then a search first',
    turns: [
      { press: 'gift, mortgage, power of attorney' }, ...LAGOS,
      'I am about to buy a plot at 9 Isheri Road, Ojodu, Lagos for ₦40,000,000 and need an Agreement for Sale. I have not paid anything yet and have not had any search done. Actually, before we do the agreement, I want the property searched first.',
    ],
    nudges: 0,
    mustInclude: 'Hands off to Searches in the same turn; the search area does not re-ask what was already said (address, price, purpose).',
  },
  {
    id: '26',
    title: 'Hand-off — gift on death goes to Wills',
    turns: [
      { press: 'gift, mortgage, power of attorney' }, ...LAGOS,
      'I want my house at 4 Ojora Close, Lekki to go to my son only after I die. Can we do a deed of gift for that?',
    ],
    nudges: 0,
    mustInclude: 'Explains a gift on death is a will and hands off to Wills & probate in the same turn, which starts the will interview without re-asking the address.',
  },
  // ----- Phase 4: Wills & probate, Land title disputes -----
  {
    id: '27',
    title: 'Will — married man, two children, one minor',
    turns: [
      { press: 'A will, or a dead relative' }, ...LAGOS,
      'I want to make a will. I am Mr Tunde Afolabi, 52, an engineer, of 7 Akanbi Crescent, Surulere, Lagos. I married my wife Mrs Bola Afolabi in church (Marriage Act). We have two children: Seun (24) and Kemi (15). I own a house at 7 Akanbi Crescent, Surulere (C of O No. 18/18/2009) and a plot at Plot 9, Ibeju-Lekki (registered deed of assignment, 2018). The house goes to my wife; the plot to Seun; everything else shared equally between my wife and both children. Executors: my brother Mr Femi Afolabi of 3 Ojuelegba Road, Surulere, and my friend Barr. Ngozi Uche of 12 Adeola Odeku Street, VI. Guardian for Kemi: my wife. I am not a Muslim; none of it is family land.',
      'Please draft it.',
    ],
    nudges: 1,
    mustInclude: 'A will from the template: revocation, two executors, guardian for Kemi, the two gifts and the residue in equal shares, minors clause, two-witness attestation; the signing instructions in the message; PRICE 0 with "a lawyer will confirm".',
  },
  {
    id: '28',
    title: 'Estate — no will, church marriage',
    turns: [
      { press: 'A will, or a dead relative' }, { press: 'Oyo' },
      'My husband Mr Bayo Ojo died on 3 March 2026 at Ibadan. He did not leave a will. We were married in church under the Marriage Act. We have three children. He owned a house at 4 Iwo Road, Ibadan and had bank accounts. He was not a Muslim and no grant has been made anywhere. I am his widow, Mrs Funmi Ojo of 4 Iwo Road, Ibadan.',
      'Please prepare the application.',
    ],
    nudges: 1,
    mustInclude: 'choose_probate_path → letters of administration, Probate Registry of the High Court of Oyo State, documents list; does not work out the shares (a lawyer confirms them under the Administration of Estates Law); offers the application letter.',
  },
  {
    id: '29',
    title: 'Estate — no will, customary marriage',
    turns: [
      { press: 'A will, or a dead relative' }, { press: 'Enugu' },
      'My father died last year in Enugu without a will. He married my mother under native law and custom. There is family land in our village and a house in Enugu town. How do we share it?',
    ],
    nudges: 0,
    mustInclude: 'choose_probate_path escalates (customary intestacy); explains a lawyer must advise; no shares worked out; no document.',
  },
  {
    id: '30',
    title: 'Land dispute — double sale, brief',
    turns: [
      { press: 'A dispute over who owns land' }, { press: 'Ogun' },
      'I bought a plot at 12 Lafenwa Road, Abeokuta from Mr Kola Bankole in March 2019 for N4m. I have a receipt, a signed agreement and a survey plan (OG/2019/221), and I fenced it in 2019. Last month I found Mr Dayo Aina building on it. He says he bought it from the same Mr Bankole in 2021 and has a deed. No court case yet; I reported to the police at Lafenwa on 2 October 2026. I am Mrs Yetunde Alabi, 0803 555 1212.',
      'Please prepare the brief.',
    ],
    nudges: 1,
    mustInclude: 'A Lawyer Brief (no court papers): title by purchase/documents and possession, the other side\'s later purchase (double sale: earlier buyer generally better), check_limitation within time, URGENCY flagged (building now) and said to the client; PRICE 0 "a lawyer will confirm".',
  },
  {
    id: '31',
    title: 'Land dispute — demolition happening now',
    turns: [
      { press: 'A dispute over who owns land' }, ...LAGOS,
      'Right now some men with a court paper are demolishing my fence at 3 Agege Motor Road, Lagos. They say the land belongs to their family. What do I do?',
    ],
    nudges: 0,
    mustInclude: 'Escalates at once (demolition happening now); tells the client a lawyer will contact them promptly; no brief drafted first.',
  },
]
