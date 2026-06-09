/**
 * ISH Professional Development Hub — "Add a resource" backend (Google Apps Script).
 *
 * This is what lets the in-app form save straight to the Google Sheet, so leaders
 * never have to open the spreadsheet themselves.
 *
 * ONE-TIME SETUP (≈3 minutes):
 *  1. Open your "Resources" Google Sheet.
 *  2. Extensions ▸ Apps Script. Delete anything there and paste this whole file.
 *  3. Click Save.
 *  4. Deploy ▸ New deployment ▸ (gear) Web app.
 *       - Description: "ISH PD Hub add endpoint"
 *       - Execute as: Me
 *       - Who has access: Anyone
 *     Deploy, authorise, and COPY the Web app URL (ends in /exec).
 *  5. Paste that URL into CONFIG.ADD_ENDPOINT in assets/app.js.
 *  6. Set ACCESS_CODE (below) to your chosen staff code, and put the SAME code's
 *     SHA-256 hash in CONFIG.PASSCODE_SHA256 in assets/app.js. Only staff who
 *     know the code can add; everyone else can still browse. Done.
 *
 * The sheet's header row must be (columns A–K):
 *   Title | Category | Provider | Format | Audience | Cost | Description | URL | Featured | Location | Date
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000); // avoid two people adding at the exact same moment
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Resources') || ss.getSheets()[0];
    var d = JSON.parse(e.postData.contents);
    var clean = function (s) { return (s == null ? '' : String(s)).slice(0, 600); };

    // Access control: only requests carrying the staff code may add a resource.
    // Set ACCESS_CODE to the same code used in assets/app.js. Empty string = open to all.
    var ACCESS_CODE = 'ISHpd2026';
    if (ACCESS_CODE && String(d.token || '') !== ACCESS_CODE) {
      return json_({ ok: false, error: 'Not authorised to add a resource.' });
    }
    if (!clean(d.title) || !clean(d.category)) {
      return json_({ ok: false, error: 'Title and category are required.' });
    }
    sheet.appendRow([
      clean(d.title), clean(d.category), clean(d.provider), clean(d.format),
      clean(d.audience), clean(d.cost), clean(d.description), clean(d.url),
      d.featured ? 'Yes' : '', clean(d.location), clean(d.date)
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function doGet() {
  return ContentService.createTextOutput(
    'ISH PD Hub add-endpoint is live. POST JSON here to add a resource.'
  );
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
