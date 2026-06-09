#!/usr/bin/env python3
"""Rebuild data/resources.json + resources.csv from the verified + enriched research.
Adds `location` and `date`, drops paused items, fixes URLs, appends new EU/NL + languages PD,
tags INSET/in-house with location+date, and re-curates `featured`."""
import json, csv, html, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
data = json.load(open(ROOT / "data/resources.json"))
rows = data["resources"]

DROP = {"National Geographic Educator Certification"}

URL_FIX = {
    "NPQ for Headship (NPQH) — International": "https://www.bpninternational.com/qualifications/leadership-npqs/npqh",
    "NPQ Senior Leadership (NPQSL) — International": "https://www.bpninternational.com/qualifications/leadership-npqs/npqsl",
    "NPQ for SENCOs — International": "https://www.bpninternational.com/qualifications/leadership-npqs/npq-for-sencos",
    "ECIS Leadership Conference": "https://ecis.org/event/leadership2026/",
}
FORMAT_FIX = {
    "Concept-Based Curriculum & Instruction (CBCI)": "Online (live)",
    "Visible Thinking (Project Zero)": "Online (live)",
    "DEIJ Leadership Development Cohort": "Online (live)",
    "Child Protection Workshops": "Online (live)",
    "UDL Practitioner Certificate": "Blended",
}
# short, card-friendly locations (from the verification agent)
LOC = {
    "IB Category 1 Workshop": "Online + in person", "IB Category 2 Workshop": "Online + in person",
    "IB Category 3 Workshop": "Online + in person", "IB Face-to-Face Workshops": "In person · Europe",
    "IB Online Workshops (4-week)": "Online", "IB Virtual Workshops (live, 3-day)": "Online · live",
    "IB In-School / Team Workshops": "In-school", "IB Educator Certificate (IBEC)": "Online / blended",
    "Instructional Coaching (Impact Cycle)": "Online or on-site",
    "Certificate of International School Leadership": "Online + in person",
    "IB Leadership Certificate": "Online / blended",
    "NPQ for Headship (NPQH) — International": "Online · live",
    "NPQ Senior Leadership (NPQSL) — International": "Online · live",
    "ECIS Middle Leaders Certificate": "Online · live", "DEIJ Leadership Development Cohort": "Online · live",
    "ECIS Leadership Conference": "Lisbon, PT", "CIS Global Forum (Admission & Guidance)": "Prague, CZ",
    "COBIS Annual Conference": "London, UK", "Learning2 Conference": "Europe (rotating)",
    "Bett UK (EdTech Show)": "London, UK", "Google for Education Events & Educator Groups": "Online + meetups",
    "Google Certified Educator Level 1": "Online", "Google Certified Educator Level 2": "Online",
    "Microsoft Certified Educator (MCE)": "Online", "Apple Teacher": "Online",
    "Common Sense Educator Certification": "Online", "Generative AI for Educators (with Gemini)": "Online",
    "AI for Educators / Microsoft Elevate": "Online", "AI Deep Dive for Educators": "Online",
    "AI Basics for K-12 Teachers": "Online", "ChatGPT Foundations for K-12 Educators": "Online",
    "Child Protection Workshops": "Online · live", "Safeguarding Training for International Schools": "Online",
    "NPQ for SENCOs — International": "Online · live", "UDL Practitioner Certificate": "Online",
    "Visible Thinking (Project Zero)": "Online · live", "Concept-Based Curriculum & Instruction (CBCI)": "Online · live",
    "Introduction to UDL": "Online", "Assessment for Learning": "Online", "Formative Assessment (Dylan Wiliam)": "Online",
}
DATES = {"IB Global Conference, Lyon 2026": "2026-10-22"}  # INSET dates handled below
FEATURED = {
    "IB Category 1 Workshop", "Instructional Coaching (Impact Cycle)",
    "Certificate of International School Leadership", "Generative AI for Educators (with Gemini)",
    "Google Certified Educator Level 1", "Visible Thinking (Project Zero)",
    "Fortbildungen für Deutschlehrkräfte (German Teacher CPD, NL)", "IB Global Conference, Lyon 2026",
    "AI Fluency for Educators", "The Bell Foundation — EAL Online Courses (International Schools)",
    "EEF Teaching and Learning Toolkit",
}

# ---- transform existing ----
out = []
for r in rows:
    title, prov = r["title"], r.get("provider", "")
    if title in DROP:
        continue
    r.setdefault("location", ""); r.setdefault("date", "")
    if "INSET" in prov:                          # one-off INSET sessions
        r["location"] = "The Hague, NL"; r["date"] = "2026-06-10"; r["featured"] = False
    elif "International School of The Hague" in prov:   # in-house
        r["location"] = "ISH · The Hague"
    if title in URL_FIX:    r["url"] = URL_FIX[title]
    if title in FORMAT_FIX: r["format"] = FORMAT_FIX[title]
    if title in LOC:        r["location"] = LOC[title]
    if title in DATES:      r["date"] = DATES[title]
    r["featured"] = title in FEATURED or (r.get("featured") and "INSET" not in prov and "International School of The Hague" not in prov and title in FEATURED)
    out.append(r)

# ---- append the 24 new (verified) opportunities ----
NEW_RAW = json.loads(open(ROOT / "scripts/new_opportunities.json").read())
NEW_LOC = {
 "Fortbildungen für Deutschlehrkräfte (German Teacher CPD, NL)": "Rotterdam/Amsterdam, NL",
 "Deutsch Lehren Lernen (DLL)": "Online", "Supporting Multilingual Classrooms": "Graz, AT / Online",
 "ECML Training & Consultancy (TaC) Activities 2026": "Europe (rotating)",
 "EUROLTA — European Certificate in Language Teaching": "Europe / Online",
 "Instituto Cervantes — Teacher Training for ELE": "Online / Europe",
 "BELC — Université d'été (French Language Educators)": "France / Online",
 "CLIL (Content and Language Integrated Learning) Course": "Dublin, IE",
 "IB Global Conference, Lyon 2026": "Lyon, FR", "IB Free Learning — DP & MYP Webinars and IB Exchange": "Online",
 "Oxford Professional Development for the IB": "Online", "Nuffic / Erasmus+ Internationalisation Support (NL)": "The Hague, NL",
 "EARLI Biennial Conference & SIGs": "Europe (rotating)", "CIS Foundations of Transitions-Care Course": "Online · live",
 "CIS Developing Socially Responsible School Governance & Leadership": "Online · live",
 "AAIE Institute for International School Leadership": "Online",
 "HGSE Instructional Leadership Certificate (ILC)": "Online", "AI Fluency for Educators": "Online",
 "AI in Education": "Online", "Free Self-Paced Courses (Teacher Academy)": "Online",
 "The Bell Foundation — EAL Online Courses (International Schools)": "Online",
 "Chartered College of Teaching — International Affiliate": "Online",
 "EEF Teaching and Learning Toolkit": "Online", "The Science of Well-Being (Yale)": "Online",
}
for item in NEW_RAW:
    rec = {k: html.unescape(v) if isinstance(v, str) else v for k, v in item.items()}
    rec["featured"] = rec["title"] in FEATURED
    rec["location"] = NEW_LOC.get(rec["title"], rec.get("location", ""))
    rec["date"] = DATES.get(rec["title"], "")
    out.append(rec)

# ---- write JSON ----
data["resources"] = out
data["meta"]["lastReviewed"] = "2026-06-09"
data["meta"]["note"] = ("Built-in seed/fallback. Keys match the Google Sheet headers (case-insensitive): "
    "Title, Category, Provider, Format, Audience, Cost, Description, URL, Featured, Location, Date.")
json.dump(data, open(ROOT / "data/resources.json", "w"), ensure_ascii=False, indent=2)
open(ROOT / "data/resources.json", "a").write("\n")

# ---- write CSV ----
H = ["Title","Category","Provider","Format","Audience","Cost","Description","URL","Featured","Location","Date"]
with open(ROOT / "data/resources.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(H)
    for r in out:
        w.writerow([r.get("title",""), r.get("category",""), r.get("provider",""), r.get("format",""),
                    r.get("audience",""), r.get("cost",""), r.get("description",""), r.get("url",""),
                    "Yes" if r.get("featured") else "", r.get("location",""), r.get("date","")])

from collections import Counter
c = Counter(r["category"] for r in out)
print("total:", len(out), "| featured:", sum(1 for r in out if r.get("featured")))
for k, v in sorted(c.items()): print(f"  {v:2d}  {k}")
