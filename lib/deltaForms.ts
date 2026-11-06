// Delta State Small Claims: the letter of demand MUST be served "as in Form SCC 1" before a
// claim can be commenced (Practice Direction on Small Claims 2023, Article 2(1)(e)). This is
// Form SCC 1 exactly as printed on page 14 of the Practice Direction, with «…» where the
// particulars go. Used by the chat agent (appended to a Delta demand letter) and by the
// Court filing tab (the form filed with the claim), so both always match the prescribed form.
//
// Article 2(1): a Delta claim lies where the claimant or the defendant resides or carries on
// business in Delta State, or the cause of action arose wholly or in part there.

export const DELTA_SCC1_TEMPLATE = `FORM SCC 1
SMALL CLAIMS COURT
LETTER OF DEMAND

FROM:
«claimant's full name, as written, not in capitals»
WORK ADDRESS: «work address, or …………………………… if not known»
RESIDENTIAL ADDRESS: «residential address, or …………………………… if not known»
TELEPHONE NO. (S) AND E-MAIL: «telephone; e-mail, or …………………………… if not known»

TO
«debtor's full name, as written, not in capitals»
WORK ADDRESS: «work address, or …………………………… if not known»
RESIDENTIAL ADDRESS: «residential address, or …………………………… if not known»
TELEPHONE NO (S) AND E-MAIL: «telephone; e-mail, or …………………………… if not known»

SIR/MADAM

DEMAND:
I hereby claim from you «the particulars, as one sentence in the claimant's own voice: the sum in figures then words in brackets, then what it is for and when it fell due — e.g. "the sum of ₦300,000.00 (Three Hundred Thousand Naira) being the loan I made to you on 18 May 2022, which you undertook to repay on 19 May 2022 but have failed to repay despite my repeated demands."»

Unless you comply with this demand within fourteen (14) days after receipt of this letter, summons will be issued against you in the Small Claims Court

……………………………………
PLAINTIFF'S SIGNATURE`

// The fixed lines of the prescribed form: every Form SCC 1 we produce must contain each one.
export const DELTA_SCC1_FIXED_LINES = [
  'FORM SCC 1',
  'SMALL CLAIMS COURT',
  'LETTER OF DEMAND',
  'FROM:',
  'TO',
  'SIR/MADAM',
  'DEMAND:',
  'Unless you comply with this demand within fourteen (14) days after receipt of this letter, summons will be issued against you in the Small Claims Court',
  "PLAINTIFF'S SIGNATURE",
]

// Enforcement (Article 13(3)): the garnishee motion ex parte, Form SCC 9, and its affidavit in
// support, Form SCC 9A, as printed on pages 27 to 30 of the Practice Direction. The printed
// "[INSERT A NAME]" and "[state …]" prompts become «…» fills here.
export const DELTA_SCC9_TEMPLATE = `FORM SCC 9
IN THE MAGISTRATE COURT OF DELTA STATE (SMALL CLAIMS)
IN THE «magisterial district, or ………………………» MAGISTERIAL DISTRICT
HOLDEN AT «town, or ………………………»

CLAIM NO: «claim number, or ………………………»

BETWEEN:
«JUDGMENT CREDITOR'S FULL NAME IN CAPITALS» ……………………… JUDGMENT CREDITOR
AND
«JUDGMENT DEBTOR'S FULL NAME IN CAPITALS» ……………………… JUDGMENT DEBTOR
AND
«GARNISHEE BANK'S NAME IN CAPITALS, or ………………………» ……………………… GARNISHEE (S)

MOTION EX-PARTE
SECTIONS 83 AND 84 OF THE SHERIFFS AND CIVIL PROCESS ACT AND ORDER IV RULE 1 (2), ORDER VIII RULES 3 (1), (2), 4, 5, AND 8 OF THE JUDGMENT (ENFORCEMENT) RULES AND UNDER THE INHERENT JURISDICTION OF THIS COURT

TAKE NOTICE that this Honourable Court shall be moved on the ………day of ……………… 20… at 9 O'clock in the forenoon or so soon thereafter as the judgment creditor praying for the following reliefs:

1. An Order attaching the funds standing to the credit of the judgment debtor in the custody of the garnishee(s) to the outstanding judgment sum of «the judgment sum in figures then words in brackets, or ………………………» ("the judgment debt").

2. An Order directing the garnishees to appear before this Court within fourteen (14) days of service of the order to show cause why an order should not be made for payment to the judgment creditor of the judgment debt accruing to the judgment debtor or so much thereof as will satisfy the judgment debt.

3. An Order directing the garnishees to respectively disclose forthwith funds standing to the credit of the judgment debtor with the garnishee(s) as at the date of the service of the order of Court, and that such disclosures be made on oath and verified by an affidavit sworn and filed before the Court within eight (8) days of the service of the order of this Court.

And for such order or orders as the Court may deem fit to make.
Dated………… day of …………20……………

……………………………………
JUDGMENT CREDITOR'S SIGNATURE`

export const DELTA_SCC9A_TEMPLATE = `FORM SCC 9A
IN THE MAGISTRATE COURT OF DELTA STATE (SMALL CLAIMS)
IN THE «magisterial district, or ………………………» MAGISTERIAL DISTRICT
HOLDEN AT «town, or ………………………»

CLAIM NO: «claim number, or ………………………»

BETWEEN:
«JUDGMENT CREDITOR'S FULL NAME IN CAPITALS» ……………………… JUDGMENT CREDITOR
AND
«JUDGMENT DEBTOR'S FULL NAME IN CAPITALS» ……………………… JUDGMENT DEBTOR
AND
«GARNISHEE BANK'S NAME IN CAPITALS, or ………………………» ……………………… GARNISHEE (S)

AFFIDAVIT IN SUPPORT

I, «judgment creditor's full name» of «judgment creditor's address, or ………………………», Delta State do hereby make an oath and state as follows:

1. I am the judgment creditor in this case.

2. The judgment debtor is «judgment debtor's full name» of «judgment debtor's address, or ………………………».

3. On «the date judgment was delivered, or ………………………» judgment was entered against the judgment debtor in the sum of «the judgment sum in figures then words in brackets, or ………………………»«, and if the judgment is payable by instalments: the amount of the instalments that have fallen due and remain unpaid; otherwise nothing».

4. I know that the «garnishee bank's name, or ………………………» of «the garnishee's address, or ………………………» has to its credit sums belonging to the judgment debtor by way of «for a bank: funds in the judgment debtor's account at the «branch, or ………………………» branch, account number «account number, or ………………………»».

5. To the best of my knowledge or belief the said garnishee (a) is within the jurisdiction of this court, and (b) owes money to or holds money to the credit of the judgment debtor.

6. To the best of my knowledge or belief no other person other than «judgment debtor's full name» has any claim to the money owed by the garnishee.

7. I have not obtained or instituted any other garnishee application against the judgment debtor in respect of the same judgment debt.

8. I depose to this affidavit conscientiously, believing all the depositions contained herein to be true and correct by the Oaths Law of Delta State.

……………………………………
DEPONENT

SWORN TO at the Registry of the Small Claims Court Registry, ……………… State……………… this……… day of ………………20…

BEFORE ME

COMMISSIONER FOR OATHS`
