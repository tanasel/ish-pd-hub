# ISH Professional Development Hub

A curated, searchable hub of **professional development opportunities** for staff at the
**International School of The Hague (ISH)** — designed so school leaders can keep it stocked
themselves by editing a single Google Sheet.

Built for ISH leadership. Elegant editorial design on the real ISH brand
(logo blue `#195386`, rose accent, *Fraunces* + *DM Sans*), light **and** dark mode,
fully responsive, accessible, and dependency-free.

![Status](https://img.shields.io/badge/status-v1-blue) ![No build step](https://img.shields.io/badge/build-none-success) ![Dependencies](https://img.shields.io/badge/dependencies-0-success)

---

## What it does

- **57 starter opportunities** across **8 categories** — IB Official, School-Based & Coaching,
  Leadership, Conferences & Networks, Online Courses & Certifications, EdTech & AI,
  Wellbeing & Inclusion, Subject & Pedagogy.
- **Search** by name / provider / topic, and **filter** by category, audience, format and cost.
- A **spotlight** for in-house events (currently the whole-staff **INSET Day, 10 June 2026** — its
  ten sessions are included and link to the official overview).
- **Leaders add resources by editing a Google Sheet** — add a row, refresh, done. No code.
- Live **Google-Sheet** data source with an automatic **built-in fallback** so the page never breaks.

## How the data works

```
Google Sheet (live, leaders edit it)  ──►  the Hub
        │  (if unreachable / not yet set up)
        └──────────────►  data/resources.json  (built-in fallback)
```

- The site reads the sheet via Google’s public **gviz** endpoint and maps columns by their header
  names. If that fails for any reason, it falls back to `data/resources.json` and says so.
- All external data is treated as **untrusted**: text is rendered as plain text and links are
  restricted to `http(s)`, so nothing in the sheet can break or hijack the page.

To connect a live sheet, see **[`docs/SETUP-GOOGLE-SHEET.md`](docs/SETUP-GOOGLE-SHEET.md)**.
For leaders maintaining the content, see **[`docs/HOW-TO-ADD.md`](docs/HOW-TO-ADD.md)**.

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
  SHEET_ID:  "",                    // paste a Google Sheet ID to go live; "" = built-in list
  SHEET_TAB: "Resources",           // "" or first-tab name
  FALLBACK:  "data/resources.json", // the safety-net list
};
```

## Project structure

```
ish-pd-hub/
├── index.html              # markup
├── assets/
│   ├── styles.css          # design system (ISH brand, light/dark)
│   ├── app.js              # data loading, search/filter, render, theme
│   └── ish-logo.png        # official ISH logo (for reference / future use)
├── data/
│   ├── resources.json      # built-in fallback list (57 resources)
│   └── resources.csv       # same list, ready to import into Google Sheets
├── docs/
│   ├── HOW-TO-ADD.md       # 1-page guide for leaders (non-technical)
│   └── SETUP-GOOGLE-SHEET.md
└── README.md
```

## Accessibility

Keyboard-operable throughout, visible focus rings, skip link, dialog focus handling,
`aria-live` result announcements, honours `prefers-reduced-motion`, AA-contrast palette,
and colour is never the only signal (every category also carries a label).

## Notes

- The INSET session facilitators’ names come from ISH’s own published overview PDF. If the Hub is
  ever made fully public, those names can be removed by editing the sheet/JSON.
- The brand colours, fonts and mission wording were verified from ISH’s live site and guiding statements.

---

*Curious, connected and compassionate — inspiring personal excellence.*
