/* =================================================================
   ISH Professional Development Hub
   Data source: a shared Google Sheet (live) with a bundled JSON fallback.
   No build step, no dependencies — works on GitHub Pages or any static host.
   ================================================================= */

/* ---------- 1. CONFIG — the only thing leaders/IT need to change ---------- */
const CONFIG = {
  // Paste the Google Sheet ID here to go live. Leave "" to use the built-in list.
  // The ID is the long string in the sheet URL:
  //   https://docs.google.com/spreadsheets/d/<<THIS PART>>/edit
  SHEET_ID: "",
  SHEET_TAB: "Resources",      // the tab (sheet) name that holds the data
  FALLBACK: "data/resources.json",
  // ishweb.nl backend (PHP) for the SHARED additions. When set, the site reads
  // staff-added resources from here (GET) and posts new ones here (POST).
  // See backend/api.php. The 80 baseline items always come from FALLBACK below.
  API_URL: "https://ishweb.nl/pd/api.php",
  // (Alternative backend) Google Apps Script web-app /exec URL.
  // Leave both "" and the form still works locally for previewing.
  ADD_ENDPOINT: "",
  // Access control: anyone can BROWSE, but only staff with this code can ADD.
  // The code is checked on the device AND again server-side in scripts/Code.gs
  // (set the same code there). Set REQUIRE_PASSCODE:false to let anyone add.
  REQUIRE_PASSCODE: true,
  PASSCODE_SHA256: "ce2a11b57d142f4711894fab16fb26e4818b3a87e777728fec8a9908f38d8cdd", // = "ISHpd2026" — change this
};

/* ---------- 2. Category metadata ---------- */
const CATS = {
  "IB Official":                          { key: "ib",         color: "#195386" },
  "School-Based & Coaching":              { key: "coaching",   color: "#6f8f1f" },
  "Leadership":                           { key: "leadership", color: "#8a3f97" },
  "Conferences & Networks":               { key: "conf",       color: "#d8541a" },
  "Online Courses & Certifications":      { key: "online",     color: "#0076d5" },
  "EdTech & AI":                          { key: "ai",         color: "#c62b4a" },
  "Wellbeing & Inclusion":                { key: "wellbeing",  color: "#0e8f86" },
  "Subject & Pedagogy":                   { key: "pedagogy",   color: "#b07d00" },
};
const catKey   = (c) => (CATS[c] ? CATS[c].key : "ib");
const catColor = (c) => (CATS[c] ? CATS[c].color : "#195386");

/* ---------- 3. State ---------- */
const state = {
  all: [],
  source: "fallback",
  lastReviewed: "",
  q: "",
  showPast: false,
  filters: { category: new Set(), audience: new Set(), format: new Set(), cost: new Set() },
};

/* ---------- 4. Helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const norm = (s) => (s == null ? "" : String(s)).trim();
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SHEET_FIELDS = {
  title: ["title", "name", "resource", "opportunity"],
  category: ["category"],
  provider: ["provider", "organisation", "organization"],
  format: ["format", "delivery", "mode"],
  audience: ["audience", "intended audience", "staff audience"],
  cost: ["cost", "fee", "price"],
  description: ["description", "summary", "details"],
  url: ["url", "link", "website", "provider url"],
  featured: ["featured", "highlight", "spotlight"],
  location: ["location", "where", "region", "venue", "place"],
  date: ["date", "when", "deadline", "expires", "end date", "event date"],
};

let detailReturnFocus = null;
let searchInputHandler = null;

// Only allow safe outbound links
function safeUrl(u) {
  u = norm(u);
  if (!/^https?:\/\//i.test(u)) return "";
  try {
    const parsed = new URL(u);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") ? parsed.href : "";
  } catch { return ""; }
}
function truthy(v) {
  const s = norm(v).toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "y" || s === "★" || s === "x";
}
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;     // textContent = XSS-safe
  return n;
}
function svgEl(tag, attrs = {}) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  return n;
}
function externalIcon() {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2.2",
    "aria-hidden": "true",
  });
  svg.appendChild(svgEl("path", {
    d: "M7 17 17 7M9 7h8v8",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  }));
  return svg;
}
function canonicalHeader(h) {
  const key = norm(h)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/[\s_-]+/g, " ")
    .trim();
  for (const [field, aliases] of Object.entries(SHEET_FIELDS)) {
    if (aliases.includes(key)) return field;
  }
  return "";
}
function cellText(cell) {
  if (!cell) return "";
  return norm(cell.v == null ? cell.f : cell.v);
}
function rowHeaders(row) {
  return ((row && row.c) || []).map((cell) => canonicalHeader(cellText(cell)));
}
function isHeaderRow(headers) {
  return headers.includes("title") && headers.filter(Boolean).length >= 2;
}
function prefersReducedMotion() {
  try {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}
function storageGet(key) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); }
  catch { /* Theme still toggles if storage is unavailable. */ }
}

/* ---------- 4b. Dates + auto-archive + locally-added resources ---------- */
function parseDate(s) {
  s = norm(s);
  if (!s) return "";
  let m = s.match(/^Date\((\d+),(\d+),(\d+)/); // gviz date, month is 0-indexed
  if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/); // DD/MM/YYYY
  if (m) return `${m[3]}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
function isPast(r) {
  if (!r.date) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(`${r.date}T00:00:00`);
  return !isNaN(d.getTime()) && d < today;
}
function prettyDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
const LS_ADDED = "ish-pd-added";
function loadLocalAdded() {
  try { const a = JSON.parse(localStorage.getItem(LS_ADDED) || "[]"); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function saveLocalAdded(rec) {
  try { const a = loadLocalAdded(); a.push(rec); localStorage.setItem(LS_ADDED, JSON.stringify(a)); }
  catch { /* ignore */ }
}
function mergeLocalAdded() {
  const seen = new Set(state.all.map((r) => `${r.title}|${r.provider}`.toLowerCase()));
  loadLocalAdded().map(mapRecord).forEach((r) => {
    const k = `${r.title}|${r.provider}`.toLowerCase();
    if (r.title && !seen.has(k)) { state.all.push(r); seen.add(k); }
  });
}

/* ---------- 4c. Access code (only selected staff can add) ---------- */
async function sha256Hex(text) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return ""; }
}
async function codeIsValid(code) {
  if (!CONFIG.REQUIRE_PASSCODE) return true;
  if (!code) return false;
  return (await sha256Hex(code)) === CONFIG.PASSCODE_SHA256;
}

/* ---------- 5. Load data: Google Sheet first, JSON fallback ---------- */
async function loadData() {
  // Base list = the bundled, version-controlled file (always works → never blank).
  const res = await fetch(CONFIG.FALLBACK, { cache: "no-store" });
  const data = await res.json();
  const resources = data && Array.isArray(data.resources) ? data.resources : [];
  state.all = resources.map(mapRecord).filter((r) => r.title);
  state.lastReviewed = norm(data && data.meta && data.meta.lastReviewed);
  state.source = "fallback";

  // Shared, staff-added resources from the ishweb.nl backend, merged on top.
  if (CONFIG.API_URL) {
    try {
      const r2 = await fetch(CONFIG.API_URL, { cache: "no-store" });
      const j = await r2.json();
      state.source = "api"; // backend reachable
      const extra = (Array.isArray(j) ? j : (j && j.resources) || []).map(mapRecord).filter((r) => r.title);
      const seen = new Set(state.all.map((r) => `${r.title}|${r.provider}`.toLowerCase()));
      extra.forEach((r) => {
        const k = `${r.title}|${r.provider}`.toLowerCase();
        if (!seen.has(k)) { state.all.push(r); seen.add(k); }
      });
    } catch (err) {
      console.warn("[ISH PD Hub] additions endpoint unreachable; showing built-in list.", err);
    }
  }
}

// gviz endpoint returns typed JSON wrapped in a JS callback — parse robustly.
async function fetchSheet(id, tab) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  const start = txt.indexOf("{");
  const end = txt.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Invalid Google Sheet response");
  const json = JSON.parse(txt.slice(start, end + 1));
  const table = json.table || {};
  let headers = (Array.isArray(table.cols) ? table.cols : []).map((c) => canonicalHeader(c && c.label));
  let dataRows = Array.isArray(table.rows) ? table.rows : [];
  const firstRowHeaders = rowHeaders(dataRows[0]);

  // If gviz did not infer useful labels, or included the header row as data, use row 1 as headers.
  if (isHeaderRow(firstRowHeaders) && (!isHeaderRow(headers) || firstRowHeaders.filter(Boolean).length >= headers.filter(Boolean).length)) {
    headers = firstRowHeaders;
    dataRows = dataRows.slice(1);
  }

  return dataRows.map((row) => {
    const cells = (row && row.c) || [];
    const obj = {};
    headers.forEach((h, i) => {
      if (!h) return;
      obj[h] = cellText(cells[i]);
    });
    return obj;
  });
}

function mapRecord(r) {
  // accept either JSON keys or Sheet header names (case-insensitive)
  const g = (k) => {
    if (!r || typeof r !== "object") return "";
    const lower = k.toLowerCase();
    const hit = Object.keys(r).find((name) => name.toLowerCase() === lower);
    return norm(hit ? r[hit] : "");
  };
  return {
    title:       g("title"),
    category:    g("category") || "IB Official",
    provider:    g("provider"),
    format:      g("format"),
    audience:    g("audience"),
    cost:        g("cost"),
    description: g("description"),
    url:         safeUrl(g("url")),
    featured:    truthy(g("featured")),
    location:    g("location"),
    date:        parseDate(g("date")),
  };
}

/* ---------- 6. Build filter chips from the data ---------- */
function uniqueOrdered(values, preferred) {
  const set = new Set(values.filter(Boolean));
  const out = [];
  preferred.forEach((p) => { if (set.has(p)) { out.push(p); set.delete(p); } });
  return out.concat([...set].sort());
}

function buildChips() {
  const cats = uniqueOrdered(state.all.map((r) => r.category), Object.keys(CATS));
  const auds = uniqueOrdered(state.all.map((r) => r.audience),
    ["All staff", "New teachers", "Coordinators", "Subject leads", "Senior leaders"]);
  const fmts = uniqueOrdered(state.all.map((r) => r.format),
    ["In-school", "Face-to-face", "Online (live)", "Online (self-paced)", "Blended"]);
  const costs = uniqueOrdered(state.all.map((r) => r.cost), ["Free", "Paid", "Subscription", "Varies"]);

  renderChipRow($("#catChips"), cats, "category", true);
  renderChipRow($("#audChips"), auds, "audience", false);
  renderChipRow($("#fmtChips"), fmts, "format", false);
  renderChipRow($("#costChips"), costs, "cost", false);
}

function renderChipRow(container, values, group, withDot) {
  container.replaceChildren();
  values.forEach((val) => {
    const chip = el("button", "chip");
    chip.type = "button";
    chip.setAttribute("aria-pressed", "false");
    chip.dataset.group = group;
    chip.dataset.value = val;
    if (withDot) {
      const dot = el("span", `dot dot--${catKey(val)}`);
      chip.appendChild(dot);
    }
    chip.appendChild(document.createTextNode(val));
    chip.addEventListener("click", () => {
      const on = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!on));
      state.filters[group][on ? "delete" : "add"](val);
      render();
    });
    container.appendChild(chip);
  });
}

/* ---------- 7. Filtering + render ---------- */
function matches(r) {
  const f = state.filters;
  if (f.category.size && !f.category.has(r.category)) return false;
  if (f.audience.size && !f.audience.has(r.audience)) return false;
  if (f.format.size   && !f.format.has(r.format))     return false;
  if (f.cost.size     && !f.cost.has(r.cost))         return false;
  if (state.q) {
    const hay = `${r.title} ${r.provider} ${r.description} ${r.category} ${r.audience} ${r.format}`.toLowerCase();
    if (!hay.includes(state.q)) return false;
  }
  return true;
}

function render() {
  const grid = $("#grid");
  grid.replaceChildren();
  // Auto-archive: hide dated opportunities whose date has passed (unless "show past" is on).
  let list = state.all.filter((r) => (state.showPast || !isPast(r)) && matches(r));

  // featured first, then alphabetical
  list.sort((a, b) => (b.featured - a.featured) || a.title.localeCompare(b.title));

  $("#count").textContent = list.length;
  const anyFilter = state.q || Object.values(state.filters).some((s) => s.size);
  $("#clearBtn").hidden = !anyFilter;
  $("#empty").hidden = list.length > 0;
  updatePastToggle();
  announceResults(list.length, anyFilter);

  list.forEach((r) => grid.appendChild(card(r)));
}

function updatePastToggle() {
  const btn = $("#pastToggle");
  if (!btn) return;
  const pastCount = state.all.filter(isPast).length;
  btn.hidden = pastCount === 0;
  btn.setAttribute("aria-pressed", String(state.showPast));
  btn.textContent = state.showPast ? "Hide past events" : `Show past events (${pastCount})`;
}

function announceResults(count, anyFilter) {
  const status = $("#resultStatus");
  if (!status) return;
  if (count > 0) {
    status.textContent = `${count} ${count === 1 ? "opportunity" : "opportunities"} shown.`;
  } else {
    status.textContent = anyFilter
      ? "No matching opportunities. Try removing a filter or searching a broader term."
      : "No opportunities are available.";
  }
}

function card(r) {
  const key = catKey(r.category);
  const c = el("article", "card");
  c.setAttribute("role", "listitem");
  c.dataset.cat = key;
  if (r.featured) c.classList.add("featured-flag");

  const bar = el("div", "card__bar");
  bar.style.background = catColor(r.category);
  c.appendChild(bar);

  const body = el("div", "card__body");

  const cat = el("span", "card__cat");
  const dot = el("span", `dot dot--${key}`);
  cat.appendChild(dot);
  cat.appendChild(document.createTextNode(r.category));
  cat.style.background = `var(--t-${key})`;
  body.appendChild(cat);

  body.appendChild(el("h3", null, r.title));
  if (r.provider) body.appendChild(el("div", "card__provider", r.provider));
  if (r.description) body.appendChild(el("p", "card__desc", r.description));

  const meta = el("div", "card__meta");
  if (r.cost)     meta.appendChild(el("span", `tag ${/free/i.test(r.cost) ? "tag--free" : "tag--cost"}`, r.cost));
  if (r.format)   meta.appendChild(el("span", "tag tag--format", r.format));
  if (r.location) meta.appendChild(el("span", "tag tag--loc", r.location));
  if (r.audience) meta.appendChild(el("span", "tag tag--audience", r.audience));
  if (r.date)     meta.appendChild(el("span", `tag tag--date${isPast(r) ? " tag--past" : ""}`, (isPast(r) ? "Past · " : "") + prettyDate(r.date)));
  body.appendChild(meta);
  c.appendChild(body);

  const foot = el("div", "card__foot");
  if (r.url) {
    const a = el("a", "card__link");
    a.href = r.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", `Visit provider for ${r.title}`);
    a.appendChild(document.createTextNode("Visit provider "));
    a.appendChild(externalIcon());
    foot.appendChild(a);
  } else {
    foot.appendChild(el("span", "card__inhouse", "In-house · ask your line manager"));
  }
  const more = el("button", "card__star");
  more.type = "button";
  more.textContent = r.featured ? "★ Details" : "Details";
  more.setAttribute("aria-haspopup", "dialog");
  more.setAttribute("aria-label", `Details for ${r.title}`);
  more.addEventListener("click", () => openDetail(r, more));
  foot.appendChild(more);
  c.appendChild(foot);
  return c;
}

/* ---------- 8. Detail modal ---------- */
function openDetail(r, trigger) {
  const d = $("#detail");
  const key = catKey(r.category);
  detailReturnFocus = trigger || document.activeElement;
  $("#dBar").style.background = catColor(r.category);
  const dCat = $("#dCat");
  dCat.replaceChildren();
  dCat.appendChild(el("span", `dot dot--${key}`));
  dCat.appendChild(document.createTextNode(r.category));
  dCat.style.background = `var(--t-${key})`;
  $("#dTitle").textContent = r.title;
  $("#dProvider").textContent = r.provider || "";
  $("#dDesc").textContent = r.description || "";
  const tags = $("#dTags"); tags.replaceChildren();
  [["cost", r.cost], ["format", r.format], ["audience", r.audience]].forEach(([t, v]) => {
    if (v) tags.appendChild(el("span", `tag tag--${t === "cost" && /free/i.test(v) ? "free" : t}`, v));
  });
  const link = $("#dLink");
  if (r.url) {
    link.href = r.url;
    link.hidden = false;
    link.textContent = "Visit provider ↗";
    link.setAttribute("aria-label", `Visit provider for ${r.title}`);
  } else {
    link.hidden = true;
    link.removeAttribute("href");
    link.removeAttribute("aria-label");
  }
  if (typeof d.showModal === "function" && !d.open) d.showModal();
  else d.setAttribute("open", "");
  requestAnimationFrame(() => $("#dClose").focus({ preventScroll: true }));
}

function closeDetail() {
  const d = $("#detail");
  if (typeof d.close === "function" && d.open) d.close();
  else {
    d.removeAttribute("open");
    restoreDetailFocus();
  }
}

function restoreDetailFocus() {
  const target = detailReturnFocus;
  detailReturnFocus = null;
  if (target && typeof target.focus === "function" && document.contains(target)) {
    target.focus({ preventScroll: true });
  }
}

function visibleFocusable(root) {
  return $$(FOCUSABLE, root).filter((node) =>
    !node.hidden && node.getAttribute("aria-hidden") !== "true" && !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length)
  );
}

function trapDetailFocus(e) {
  const d = $("#detail");
  if (e.key !== "Tab" || !(d.open || d.hasAttribute("open"))) return;
  const focusable = visibleFocusable(d);
  if (!focusable.length) {
    e.preventDefault();
    d.focus({ preventScroll: true });
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ---------- 9. Stats ---------- */
function setStats() {
  $("#statTotal").textContent  = state.all.length;
  $("#statFree").textContent   = state.all.filter((r) => /free/i.test(r.cost)).length;
  $("#statOnline").textContent = state.all.filter((r) => /online|blended/i.test(r.format)).length;
  $("#stats").removeAttribute("aria-hidden");
}

function setSource() {
  const pill = $("#sourcePill"), txt = $("#sourceTxt");
  if (state.source === "api" || state.source === "sheet") {
    pill.classList.remove("is-fallback");
    txt.textContent = "Live — shared with all staff";
  } else {
    pill.classList.add("is-fallback");
    txt.textContent = "Showing the built-in list";
  }
  if (state.lastReviewed) $("#footNote").textContent =
    `Curious, connected and compassionate — inspiring personal excellence. · Last reviewed ${state.lastReviewed}`;
}

function wireAddLinks() {
  const editUrl = CONFIG.SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/edit`
    : "docs/SETUP-GOOGLE-SHEET.md";
  $("#openSheetBtn").href = editUrl;
  if (!CONFIG.SHEET_ID) $("#openSheetBtn").removeAttribute("target");
}

/* ---------- 10. Theme ---------- */
function initTheme() {
  const saved = storageGet("ish-theme");
  const sys = (() => {
    try { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; }
    catch { return false; }
  })();
  setTheme(saved || (sys ? "dark" : "light"));
  $("#themeBtn").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });
}
function setTheme(t, persist = false) {
  t = t === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  if (persist) storageSet("ish-theme", t);
  const btn = $("#themeBtn");
  btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
  const icon = $("#themeIcon");
  if (t === "dark") {
    icon.replaceChildren(
      svgEl("circle", { cx: "12", cy: "12", r: "4.5" }),
      svgEl("path", {
        d: "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19",
        "stroke-linecap": "round",
      })
    );
  } else {
    icon.replaceChildren(svgEl("path", {
      d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
      "stroke-linejoin": "round",
    }));
  }
}

/* ---------- 11. Wire up ---------- */
function debounce(fn, ms) {
  let t;
  function debounced(...a) {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  }
  debounced.cancel = () => clearTimeout(t);
  return debounced;
}

function setQuery(value) {
  const q = $("#q");
  if (q) q.value = value;
  state.q = norm(value).toLowerCase();
}

function clearAll({ renderNow = true } = {}) {
  if (searchInputHandler) searchInputHandler.cancel();
  state.q = ""; $("#q").value = "";
  Object.values(state.filters).forEach((s) => s.clear());
  $$(".chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
  if (renderNow) render();
}

async function init() {
  initTheme();
  searchInputHandler = debounce((e) => { setQuery(e.target.value); render(); }, 120);
  $("#q").addEventListener("input", searchInputHandler);
  $("#clearBtn").addEventListener("click", clearAll);
  $("#emptyReset").addEventListener("click", clearAll);
  const insetBtn = $("#insetBtn");
  if (insetBtn) insetBtn.addEventListener("click", () => {
    clearAll({ renderNow: false });
    setQuery("INSET Day");
    render();
    $("#main").scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  });
  $("#dClose").addEventListener("click", closeDetail);
  $("#detail").addEventListener("click", (e) => { if (e.target.id === "detail") closeDetail(); });
  $("#detail").addEventListener("cancel", (e) => { e.preventDefault(); closeDetail(); });
  $("#detail").addEventListener("close", restoreDetailFocus);
  $("#detail").addEventListener("keydown", trapDetailFocus);

  // Add-a-resource form + past-events toggle
  const addBtnTop = $("#addBtnTop");
  if (addBtnTop) addBtnTop.addEventListener("click", (e) => { e.preventDefault(); openAddForm(addBtnTop); });
  const openAddBtn = $("#openAddBtn");
  if (openAddBtn) openAddBtn.addEventListener("click", () => openAddForm(openAddBtn));
  const addForm = $("#addForm");
  if (addForm) addForm.addEventListener("submit", submitAddForm);
  const addCancel = $("#addCancel");
  if (addCancel) addCancel.addEventListener("click", closeAddForm);
  const addClose = $("#addClose");
  if (addClose) addClose.addEventListener("click", closeAddForm);
  const addModal = $("#addModal");
  if (addModal) {
    addModal.addEventListener("click", (e) => { if (e.target.id === "addModal") closeAddForm(); });
    addModal.addEventListener("cancel", (e) => { e.preventDefault(); closeAddForm(); });
    addModal.addEventListener("close", restoreAddFocus);
    addModal.addEventListener("keydown", (e) => trapFocusIn(addModal, e));
  }
  const pastToggle = $("#pastToggle");
  if (pastToggle) pastToggle.addEventListener("click", () => { state.showPast = !state.showPast; render(); });

  try {
    await loadData();
  } catch (err) {
    console.error("[ISH PD Hub] Could not load any data.", err);
    $("#sourceTxt").textContent = "Could not load resources";
    return;
  }
  mergeLocalAdded();
  buildChips();
  setStats();
  setSource();
  wireAddLinks();
  render();
}

/* ---------- 12. Add-a-resource form ---------- */
let addReturnFocus = null;

function trapFocusIn(d, e) {
  if (e.key !== "Tab" || !(d.open || d.hasAttribute("open"))) return;
  const focusable = visibleFocusable(d);
  if (!focusable.length) { e.preventDefault(); d.focus({ preventScroll: true }); return; }
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function openAddForm(trigger) {
  const d = $("#addModal");
  if (!d) return;
  addReturnFocus = trigger || document.activeElement;
  $("#addForm").reset();
  $("#addError").hidden = true;
  const codeRow = $("#af-code-row");
  if (codeRow) codeRow.hidden = !CONFIG.REQUIRE_PASSCODE;
  if (CONFIG.REQUIRE_PASSCODE) {
    try { const saved = sessionStorage.getItem("ish-pd-code"); if (saved) $("#af-code").value = saved; } catch { /* ignore */ }
  }
  if (typeof d.showModal === "function" && !d.open) d.showModal();
  else d.setAttribute("open", "");
  requestAnimationFrame(() => { const t = $("#af-title"); if (t) t.focus({ preventScroll: true }); });
}
function closeAddForm() {
  const d = $("#addModal");
  if (typeof d.close === "function" && d.open) d.close();
  else { d.removeAttribute("open"); restoreAddFocus(); }
}
function restoreAddFocus() {
  const t = addReturnFocus; addReturnFocus = null;
  if (t && typeof t.focus === "function" && document.contains(t)) t.focus({ preventScroll: true });
}
function showAddError(msg) {
  const e = $("#addError");
  if (e) { e.textContent = msg; e.hidden = false; }
}
async function submitAddForm(e) {
  e.preventDefault();
  const v = (id) => norm((($("#" + id)) || {}).value);
  const code = v("af-code");
  const rec = {
    title: v("af-title"), category: v("af-category"), provider: v("af-provider"),
    format: v("af-format"), audience: v("af-audience"), cost: v("af-cost"),
    location: v("af-location"), date: v("af-date"), description: v("af-description"),
    url: v("af-url"), featured: "",
  };
  if (!rec.title || !rec.category) { showAddError("Please add at least a title and a category."); return; }
  if (rec.url && !safeUrl(rec.url)) { showAddError("The link should start with http:// or https:// — or leave it blank."); return; }
  if (!(await codeIsValid(code))) { showAddError("That access code isn't right — only selected staff can add resources."); return; }
  if (CONFIG.REQUIRE_PASSCODE) { try { sessionStorage.setItem("ish-pd-code", code); } catch { /* ignore */ } }
  saveLocalAdded(rec);          // remember in this browser (persists on refresh)
  state.all.unshift(mapRecord(rec));  // show it straight away
  postToEndpoint(rec, code);    // send to the Google Sheet back-end (with the staff token) if connected
  clearAll({ renderNow: false });
  buildChips();
  setStats();
  render();
  closeAddForm();
  showToast(`Added “${rec.title}”. Thank you!`);
  $("#main").scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}
function postToEndpoint(rec, code) {
  const url = CONFIG.API_URL || CONFIG.ADD_ENDPOINT;
  if (!url) return;
  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...rec, token: code || "" }),
    }).catch((err) => console.warn("[ISH PD Hub] add endpoint failed", err));
  } catch (err) { console.warn("[ISH PD Hub] add endpoint failed", err); }
}
let toastTimer = null;
function showToast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg; t.hidden = false;
  requestAnimationFrame(() => t.classList.add("is-on"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove("is-on"); setTimeout(() => { t.hidden = true; }, 250); }, 4000);
}

document.addEventListener("DOMContentLoaded", init);
