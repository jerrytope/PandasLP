// In the Google Sheet, add/confirm tabs named Register and Payments, open Extensions >
// Apps Script, paste this file, replace the secret below, then deploy as a web app that
// executes as the owner. Set the /exec URL and same secret in the app server environment.
// Never use the placeholder below in production.
const SECRET = 'REPLACE-WITH-A-RANDOM-SECRET'

const REGISTER = 'Register'
const PAYMENTS = 'Payments'
const HEADER_ROW = 7
const FIRST_ROW = 8
const COL = { sn: 1, matter: 2, client: 3, ref: 4, contact: 5, owed: 6, recovered: 7, balance: 8, status: 9, action: 10, next: 11, discussion: 12, opened: 13, updated: 14, caseId: 15 }
const PAY = { sn: 1, date: 2, amount: 3, matter: 4, note: 5, recoveryId: 6 }

function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    const body = JSON.parse(e.postData.contents)
    if (SECRET === 'REPLACE-WITH-A-RANDOM-SECRET' || body.secret !== SECRET) return reply({ ok: false, error: 'unauthorised' })
    if (body.type === 'matter') return reply(addMatter(body.row))
    if (body.type === 'payment') return reply(addPayment(body.payment))
    return reply({ ok: false, error: 'unknown type' })
  } catch (error) {
    return reply({ ok: false, error: String(error) })
  } finally {
    lock.releaseLock()
  }
}

function doGet() {
  return reply({ ok: true, sheet: SpreadsheetApp.getActive().getName() })
}

function reply(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)
}

function sheet(name) {
  const result = SpreadsheetApp.getActive().getSheetByName(name)
  if (!result) throw new Error('No sheet called "' + name + '"')
  return result
}

function ymd(value) {
  if (!value) return ''
  const parts = String(value).split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function ensureIdColumns() {
  const register = sheet(REGISTER)
  if (!register.getRange(HEADER_ROW, COL.caseId).getValue()) {
    register.getRange(HEADER_ROW, COL.caseId).setValue('System case ID').setFontColor('#6E6E6E')
  }
  const payments = sheet(PAYMENTS)
  if (!payments.getRange(1, PAY.recoveryId).getValue()) {
    payments.getRange(1, PAY.recoveryId).setValue('System recovery ID').setFontColor('#6E6E6E')
  }
}

function findCaseRow(caseId) {
  const register = sheet(REGISTER)
  const last = Math.max(register.getLastRow(), FIRST_ROW)
  const ids = register.getRange(FIRST_ROW, COL.caseId, last - FIRST_ROW + 1, 1).getValues()
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] && String(ids[i][0]) === String(caseId)) return FIRST_ROW + i
  }
  return 0
}

function nextEmptyRow(targetSheet, firstRow, keyColumn, formulaColumns) {
  const last = Math.max(targetSheet.getLastRow(), firstRow)
  const keys = targetSheet.getRange(firstRow, keyColumn, last - firstRow + 2, 1).getValues()
  let row = firstRow
  for (let i = 0; i < keys.length; i++) {
    if (keys[i][0] === '' || keys[i][0] === null) {
      row = firstRow + i
      break
    }
  }
  if (row > firstRow) {
    formulaColumns.forEach(function (column) {
      if (!targetSheet.getRange(row, column).getFormula() && targetSheet.getRange(row - 1, column).getFormula()) {
        targetSheet.getRange(row - 1, column).copyTo(targetSheet.getRange(row, column))
      }
    })
  }
  return row
}

function addMatter(row) {
  if (!row || !row.caseId || !row.matter) return { ok: false, error: 'missing matter' }
  ensureIdColumns()
  const existing = findCaseRow(row.caseId)
  if (existing) return { ok: true, duplicate: true, row: existing }

  const register = sheet(REGISTER)
  const formulaColumns = [COL.sn, COL.ref, COL.recovered, COL.balance]
  const targetRow = nextEmptyRow(register, FIRST_ROW, COL.matter, formulaColumns)
  register.getRange(targetRow, COL.matter).setValue(row.matter)
  register.getRange(targetRow, COL.client).setValue(row.client || '')
  register.getRange(targetRow, COL.ref).setValue(row.systemRef || '')
  register.getRange(targetRow, COL.contact).setValue(row.contact || '')
  register.getRange(targetRow, COL.owed).setValue(row.amountOwed == null ? '' : row.amountOwed)
  register.getRange(targetRow, COL.status).setValue(row.status || 'Outstanding')
  register.getRange(targetRow, COL.action).setValue(row.actionItem || '')
  register.getRange(targetRow, COL.discussion).setValue(row.discussion || '')
  register.getRange(targetRow, COL.opened).setValue(ymd(row.dateOpened))
  register.getRange(targetRow, COL.updated).setValue(ymd(row.lastUpdated))
  register.getRange(targetRow, COL.caseId).setValue(row.caseId)
  return { ok: true, row: targetRow }
}

function addPayment(payment) {
  if (!payment || !payment.caseId || !payment.recoveryId || !(payment.amount > 0)) {
    return { ok: false, error: 'missing payment' }
  }
  ensureIdColumns()
  const registerRow = findCaseRow(payment.caseId)
  if (!registerRow) return { ok: false, error: 'this matter is not on the register' }

  const payments = sheet(PAYMENTS)
  const last = Math.max(payments.getLastRow(), 2)
  const ids = payments.getRange(2, PAY.recoveryId, last - 1, 1).getValues()
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(payment.recoveryId)) return { ok: true, duplicate: true }
  }

  const paymentRow = nextEmptyRow(payments, 2, PAY.sn, [PAY.matter])
  payments.getRange(paymentRow, PAY.sn).setValue(registerRow - (FIRST_ROW - 1))
  payments.getRange(paymentRow, PAY.date).setValue(ymd(payment.date))
  payments.getRange(paymentRow, PAY.amount).setValue(payment.amount)
  payments.getRange(paymentRow, PAY.note).setValue(payment.note || '')
  payments.getRange(paymentRow, PAY.recoveryId).setValue(payment.recoveryId)

  const register = sheet(REGISTER)
  register.getRange(registerRow, COL.updated).setValue(ymd(payment.date))
  if (payment.cleared) register.getRange(registerRow, COL.status).setValue('Cleared')
  return { ok: true, row: paymentRow }
}
