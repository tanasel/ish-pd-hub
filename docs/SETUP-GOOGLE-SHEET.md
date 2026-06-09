# Connecting the Hub to a Google Sheet (one-time, ~3 minutes)

The Hub works out of the box from the built-in list (`data/resources.json`). To let leaders
maintain it from a **live Google Sheet**, do this once.

## 1. Create the sheet

**Option A — import the starter list (recommended):**
1. Go to <https://sheets.new> (sign in with the **school** Google account).
2. **File → Import → Upload**, choose `data/resources.csv` from this project.
3. Choose **Replace current sheet**. You now have all columns + the starter resources.

**Option B — start blank:** create a sheet and make the first row exactly:

```
Title | Category | Provider | Format | Audience | Cost | Description | URL | Featured | Location | Date
```

## 2. Make it readable by the website

The Hub reads the sheet with Google’s public **gviz** endpoint, which needs the sheet to be
link-viewable:

1. Click **Share** (top right).
2. Under *General access*, choose **Anyone with the link → Viewer**.
3. **Done.** (Editors can still be a named list — only *viewing* is public, and only the data, never edit rights.)

> Prefer not to make it link-viewable? Use **File → Share → Publish to web** instead and switch the
> fetch in `assets/app.js` to the published CSV URL. Link-viewable + gviz is simpler and is the default.

## 3. Tell the Hub which sheet to use

1. Copy the **Sheet ID** from the sheet’s URL — the long code between `/d/` and `/edit`:

   ```
   https://docs.google.com/spreadsheets/d/  1A2b3C4d5E6f7G8h9...  /edit
                                            └──────── this ────────┘
   ```
2. Open `assets/app.js` and paste it into the CONFIG block at the very top:

   ```js
   const CONFIG = {
     SHEET_ID: "1A2b3C4d5E6f7G8h9...",   // ← paste here
     SHEET_TAB: "",                       // "" = first tab (leave blank unless you renamed it)
     FALLBACK: "data/resources.json",
   };
   ```
3. Save and refresh. The status pill should switch from **“Showing the built-in list”** to
   **“Live from Google Sheet.”** The *Add a resource* button now opens your sheet directly.

## 4. (Optional but recommended) Turn on the in-app "Add a resource" form

So leaders can add resources **without ever opening the sheet**, deploy the small Apps Script in
`scripts/Code.gs`:

1. In the sheet: **Extensions ▸ Apps Script**. Paste the contents of `scripts/Code.gs`, then Save.
2. **Deploy ▸ New deployment ▸ Web app** — *Execute as: Me*, *Who has access: Anyone* — Deploy, authorise, and copy the Web-app URL (it ends in `/exec`).
3. Paste it into `assets/app.js`:
   ```js
   ADD_ENDPOINT: "https://script.google.com/macros/s/AKfy…/exec",
   ```

Now the Hub's **“Add a resource”** form writes straight to the sheet. Until you connect it, the
form still works for whoever is using it (their additions are remembered in their own browser) —
connecting the endpoint is simply what shares those additions with everyone.

## How it behaves (so nothing ever looks broken)

- **Sheet reachable →** the Hub shows live sheet data.
- **Sheet unreachable / empty / not shared →** it silently falls back to `data/resources.json` and shows the
  built-in list, with the status pill indicating the fallback. The page never errors out.
- All sheet text is rendered as plain text and links are restricted to `http(s)`, so a stray
  formula or pasted HTML in the sheet can’t break or hijack the page.

## Keeping the built-in fallback fresh (optional)

`data/resources.json` is the safety net shown if the sheet is down. To refresh it from the sheet,
re-export the sheet as CSV and regenerate (a teammate comfortable with a terminal can run the small
script in the project), or simply edit `data/resources.json` by hand — same columns.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Still says “built-in list” | Check the Sheet ID is correct and sharing is **Anyone with the link → Viewer**. |
| Some rows missing | Every shown row needs a **Title**. Blank-title rows are skipped. |
| A link doesn’t open | URLs must start with `http://` or `https://`. |
| Renamed the tab | Put the tab’s name in `SHEET_TAB`, or move the data back to the first tab. |
