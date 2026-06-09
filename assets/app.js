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

/* ---------- 5. Load data: Google Sheet first, JSON fallback ---------- */
async function loadData() {
  if (CONFIG.SHEET_ID) {
    try {
      const rows = await fetchSheet(CONFIG.SHEET_ID, CONFIG.SHEET_TAB);
      const clean = rows.map(mapRecord).filter((r) => r.title);
      if (clean.length) {
        state.all = clean;
        state.source = "sheet";
        return;
      }
    } catch (err) {
      console.warn("[ISH PD Hub] Google Sheet not reachable, using built-in list.", err);
    }
  }
  // Fallback
  const res = await fetch(CONFIG.FALLBACK, { cache: "no-store" });
  const data = await res.json();
  const resources = data && Array.isArray(data.resources) ? data.resources : [];
  state.all = resources.map(mapRecord).filter((r) => r.title);
  state.lastReviewed = norm(data && data.meta && data.meta.lastReviewed);
  state.source = "fallback";
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
  let list = state.all.filter(matches);

  // featured first, then alphabetical
  list.sort((a, b) => (b.featured - a.featured) || a.title.localeCompare(b.title));

  $("#count").textContent = list.length;
  const anyFilter = state.q || Object.values(state.filters).some((s) => s.size);
  $("#clearBtn").hidden = !anyFilter;
  $("#empty").hidden = list.length > 0;
  announceResults(list.length, anyFilter);

  list.forEach((r) => grid.appendChild(card(r)));
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
  if (r.audience) meta.appendChild(el("span", "tag tag--audience", r.audience));
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
  if (state.source === "sheet") {
    pill.classList.remove("is-fallback");
    txt.textContent = "Live from Google Sheet";
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

  try {
    await loadData();
  } catch (err) {
    console.error("[ISH PD Hub] Could not load any data.", err);
    $("#sourceTxt").textContent = "Could not load resources";
    return;
  }
  buildChips();
  setStats();
  setSource();
  wireAddLinks();
  render();
}

document.addEventListener("DOMContentLoaded", init);
