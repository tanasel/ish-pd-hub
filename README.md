# ISH Professional Development Hub

A curated, searchable hub of **professional development opportunities** for staff at the
**International School of The Hague (ISH)** — designed so school leaders can keep it stocked
themselves with a simple form: no spreadsheet, no code.

Built for ISH leadership. Elegant editorial design on the real ISH brand
(logo blue `#195386`, rose accent, *Fraunces* + *DM Sans*), light **and** dark mode,
fully responsive, accessible, and dependency-free.

![Status](https://img.shields.io/badge/status-v1-blue) ![No build step](https://img.shields.io/badge/build-none-success) ![Dependencies](https://img.shields.io/badge/dependencies-0-success)

---

## What it does

- **80 opportunities** across **8 categories** — IB Official, School-Based & Coaching,
  Leadership, Conferences & Networks, Online Courses & Certifications, EdTech & AI,
  Wellbeing & Inclusion, Subject & Pedagogy. Each one checked to be online or within Europe.
- **Search** by name / provider / topic, and **filter** by category, audience, format and cost.
- A **spotlight** for in-house events (currently the whole-staff **INSET Day, 10 June 2026** — its
  ten sessions are included and link to the official overview).
- **Leaders add resources with a short in-app form** — access-code protected, so only selected
  staff can add (everyone can browse). No spreadsheet, no code.
- Past-dated events **auto-archive**; a dark-mode toggle; works on phones and laptops.

## How the data works

```
data/resources.json  (80 baseline, version-controlled)  ──►  the Hub
                                                              ▲
ishweb.nl PHP backend (shared staff additions)  ────────────┘
   GET = read additions · POST = add one (access code checked, server-side)
```

- The 80 baseline always load first, so the page is never blank. Then any shared additions are
  fetched from the backend and merged on top. If the backend is unreachable, you simply see the 80.
- All data is treated as **untrusted**: text is rendered as plain text and links are restricted to
  `http(s)`, so a malicious addition can't run scripts or hijack the page.
- **Access control:** anyone can browse; only staff with the **access code** can add. The code is
  enforced on the server (`backend/api.php`); the public site ships only its SHA-256 hash.

Backend setup: **[`docs/SETUP-BACKEND.md`](docs/SETUP-BACKEND.md)**.
For leaders maintaining the content: **[`docs/HOW-TO-ADD.md`](docs/HOW-TO-ADD.md)**.

## Run it locally

It’s a static site — any static server works:

```bash
python3 -m http.server 4188     # then open http://localhost:4188
```

## Deploy (free, GitHub Pages)

```bash
gh repo create ish-pd-hub --public --source=. --push
# then: repo Settings → Pages → Build from branch → main → / (root)
```

Or drag the folder into Netlify / Cloudflare Pages. No build command, output dir = project root.

## Configure

Everything tweakable lives in the `CONFIG` block at the top of `assets/app.js`:

```js
const CONFIG = {
  FALLBACK:         "data/resources.json",         // the 80 baseline items (always loaded)
  API_URL:          "https://ishweb.nl/pd/api.php", // the school's backend for shared additions
  REQUIRE_PASSCODE: true,                           // require the staff access code to add
  PASSCODE_SHA256:  "…",                             // SHA-256 of the code (plaintext lives only on the server)
};
```

## Project structure

```
ish-pd-hub/
├── index.html              # markup
├── assets/
│   ├── styles.css          # design system (ISH brand, light/dark)
│   ├── app.js              # data loading, search/filter, render, theme, access code
│   └── ish-logo.png        # official ISH logo
├── data/
│   ├── resources.json      # the 80 baseline opportunities (version-controlled)
│   └── resources.csv       # the same list as CSV (handy export)
├── backend/
│   ├── api.php             # the school's add/read endpoint (deployed to ishweb.nl)
│   └── data.json           # starter store for shared additions ({"resources":[]})
├── docs/
│   ├── HOW-TO-ADD.md       # 1-page guide for leaders (non-technical)
│   └── SETUP-BACKEND.md    # one-time backend setup
└── README.md
```

## Accessibility

Keyboard-operable throughout, visible focus rings, skip link, dialog focus handling,
`aria-live` result announcements, honours `prefers-reduced-motion`, AA-contrast palette,
and colour is never the only signal (every category also carries a label).

## Notes

- The INSET session facilitators’ names come from ISH’s own published overview PDF. If the Hub is
  ever made fully public, those names can be removed by editing the data.
- The brand colours, fonts and mission wording were verified from ISH’s live site and guiding statements.

---

*Curious, connected and compassionate — inspiring personal excellence.*
