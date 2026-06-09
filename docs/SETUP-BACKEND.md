# Backend setup (the school's own server)

The Hub shows **80 baseline opportunities** from the version-controlled `data/resources.json`,
plus any **staff-added** items from a tiny PHP endpoint on the school's own server (ishweb.nl).
Anyone can browse; only staff with the **access code** can add. The code is enforced on the
**server**, so it can't be bypassed.

This is already live. These notes are for re-deploying or moving it.

## Files
- `backend/api.php` — the endpoint. `GET` returns the shared additions; `POST` appends one
  (only if the correct `token`/access code is sent). It sends `Access-Control-Allow-Origin: *`
  so the static site can read it cross-origin.
- `backend/data.json` — the store. Starts as `{"resources":[]}`.

## Deploy (ICDSoft, via the Web SSH Terminal)
The control panel is `panel.s951.sureserver.com` → **Web SSH Terminal**. The public web root
for ishweb.nl is **`~/www/www/`** (note: the top-level `~/www` is *not* the docroot).

```bash
mkdir -p www/www/pd
# Pull the files straight from the public repo (no copy-paste needed):
curl -fsS -o www/www/pd/api.php  https://raw.githubusercontent.com/tanasel/ish-pd-hub/main/backend/api.php
curl -fsS -o www/www/pd/data.json https://raw.githubusercontent.com/tanasel/ish-pd-hub/main/backend/data.json
chmod 644 www/www/pd/api.php
chmod 664 www/www/pd/data.json
# Set the REAL access code on the server (the repo only ships a placeholder):
sed -i 's/__SET_ON_SERVER__/YOUR-REAL-CODE-HERE/' www/www/pd/api.php
php -l www/www/pd/api.php   # should say: No syntax errors detected
```

That serves the endpoint at **`https://ishweb.nl/pd/api.php`**.

## Wire the site to it
In `assets/app.js` → `CONFIG`:
- `API_URL` = the endpoint URL (already set to `https://ishweb.nl/pd/api.php`).
- `PASSCODE_SHA256` = the **SHA-256 of your access code** (compute with
  `printf '%s' 'YOUR-REAL-CODE-HERE' | shasum -a 256`). The plaintext code lives **only on the
  server** — never commit it to this public repo.

## Test
```bash
curl -s https://ishweb.nl/pd/api.php                                  # → {"resources":[]}
curl -s -X POST -d '{"title":"t","category":"Leadership","token":"YOUR-REAL-CODE-HERE"}' https://ishweb.nl/pd/api.php   # → {"ok":true}
curl -s -X POST -d '{"title":"t","category":"Leadership","token":"wrong"}' https://ishweb.nl/pd/api.php                  # → {"ok":false,...}
```

## How it behaves (so nothing ever looks broken)
- Backend reachable → site shows the 80 baseline **plus** the shared additions, pill reads
  **“Live — shared with all staff.”**
- Backend unreachable → site silently shows just the 80 baseline (built-in list). It can never
  go blank.
- All text is rendered safely and links are forced to `http(s)`, so a malicious addition can't
  run scripts or hijack the page.
