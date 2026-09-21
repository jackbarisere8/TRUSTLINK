# Data Provenance Audit
### TRUSTLINK REALITY AUDIT v1 — Section 1: What Is Real?

**Prepared:** 2026-09-16  
**Scope:** Every data record in `lib/discovery/careers.ts`, `lib/opportunities/index.ts`, and `app/page.tsx` (trending signals)  
**Author:** Internal reality audit — not a product plan

---

## Provenance Classification System

| Status | Meaning |
|--------|---------|
| `SOURCE_VERIFIED` | The exact number/fact was retrieved directly from the cited source and can be re-verified by opening the source URL today |
| `SOURCE_REFERENCED` | A plausible source is named, but the exact figure was not retrieved from that source; it is an estimate consistent with what that source might publish |
| `SOURCE_MISSING` | No source is named; the data is editorial/assumed |
| `PLACEHOLDER` | Data was generated to fill a field; it is AI-produced and has no external anchor |

---

## Section 1: Career Taxonomy (`lib/discovery/careers.ts`)

The file contains **8 careers** (car_01 through car_08 — the file was originally described as 10 but currently contains 8).

### 1.1 Income Ranges

Every income range in the file is a `typicalIncomeRange` string (e.g., `₦120,000 – ₦450,000 / month`).

| Career | Income Range Claimed | Cited Source | Provenance Status | Finding |
|--------|---------------------|--------------|-------------------|---------|
| Network Technician | ₦120k–₦450k/month | "Nigerian Communications Commission / Industry Reports" | `SOURCE_REFERENCED` | NCC publishes infrastructure reports but not individual technician salary bands. No URL. Plausible range. |
| UI/UX Designer | ₦180k–₦750k+/month | "TechCabal African Tech Talent Survey" | `SOURCE_REFERENCED` | TechCabal does publish annual talent surveys. The exact 2026 edition and its salary bands were not verified against a live URL. |
| Software Engineer | ₦250k–₦1,500k+/month | "NISER Labour Market Analysis" | `SOURCE_REFERENCED` | NISER (Nigerian Institute of Social and Economic Research) publishes labour market reports. The specific report, page, and year were not verified. |
| Solar Energy Technician | ₦150k–₦800k+/project/month | "Rural Electrification Agency (REA) / NISER 2026" | `SOURCE_REFERENCED` | REA publishes solar deployment data; it does not publish artisan salary surveys. The income figure has no verifiable REA source. |
| Electrical Installation Specialist | ₦120k–₦600k/month | "Federal Ministry of Works / Construction Labour Index" | `SOURCE_REFERENCED` | A "Construction Labour Index" from FMWorks could not be confirmed as a real published document. |
| Automotive Diagnostics Technician | ₦150k–₦700k+/month | "Nigerian Automotive Industry Development Plan" | `SOURCE_REFERENCED` | NADP is a real policy document (NAIDP). It does not contain salary benchmarks for individual technicians. |
| Fashion Designer & Bespoke Apparel | ₦150k–₦1,000k+/month | "Bank of Industry Creative Sector Report" | `SOURCE_REFERENCED` | BOI publishes SME and creative sector reports. The exact salary figure was not verified against a live BOI report. |
| Cybersecurity Analyst | ₦300k–₦1,800k+/month | "Nigeria Data Protection Commission (NDPC) Annual Report" | `SOURCE_REFERENCED` | NDPC publishes compliance enforcement reports — not salary surveys. The income range has no NDPC anchor. |

**Summary finding:** All 8 income ranges are `SOURCE_REFERENCED` at best. None are `SOURCE_VERIFIED`. Several cited sources either do not publish salary data or the specific document could not be confirmed. The ranges themselves are *plausible* for Nigeria's 2026 market, but they should not be presented to users as independently verified figures.

**Required action before public use:**
- Either verify each figure against a real, linkable source, or
- Label all income data explicitly as: *"Estimated range — not independently verified. Actual compensation varies by region, experience, and employer."*

---

### 1.2 Trend Signals

Each career has a `trendSignal` object with a `summary`, `source`, and `date`.

| Career | Signal Source Claimed | Date | Provenance Status |
|--------|----------------------|------|-------------------|
| Network Technician | "Nigerian Communications Commission / Industry Reports" | Q1 2026 | `SOURCE_REFERENCED` |
| UI/UX Designer | "TechCabal African Tech Talent Survey" | 2026 | `SOURCE_REFERENCED` |
| Software Engineer | "NISER Labour Market Analysis" | Q1 2026 | `SOURCE_REFERENCED` |
| Solar Technician | "Rural Electrification Agency (REA) / NISER 2026" | Q1 2026 | `SOURCE_REFERENCED` |
| Electrical Artisan | "Federal Ministry of Works / Construction Labour Index" | 2026 | `SOURCE_REFERENCED` |
| Automotive Technician | "Nigerian Automotive Industry Development Plan" | 2026 | `SOURCE_REFERENCED` |
| Fashion Designer | "Bank of Industry Creative Sector Report" | 2026 | `SOURCE_REFERENCED` |
| Cybersecurity Analyst | "Nigeria Data Protection Commission (NDPC) Annual Report" | 2026 | `SOURCE_REFERENCED` |

**Finding:** All trend signals are `SOURCE_REFERENCED`. The trend _observations_ (e.g., "solar adoption is surging due to grid pressure" and "NDPA is driving security demand") are directionally accurate and publicly discussable. However, the specific quarterly reports cited may not exist in the exact form named, or may not contain these signals in this precise wording.

**The signal _direction_ is real. The source _citations_ are editorial.**

---

### 1.3 Employer Names

Several career records list specific Nigerian company names as "typical employers":

- Spectranet, Smile, FibreOne, ipNX (Network Technician) — **real companies**
- Interswitch, Paystack, Flutterwave, Moniepoint (Software Engineer) — **real companies**
- Renewsys, Starsight, Daystar, Arnergy (Solar) — **real companies**
- Deola Sagoe Atelier / House of Tara (Fashion, opp_05) — **real brands**
- KoraPay Technologies (opp_03) — **real company**
- GIG, Sendbox (Automotive) — **real companies**

**Finding:** Named employers are real Nigerian entities. However, TrustLink has no relationship with any of these companies. Their inclusion implies they are hiring via TrustLink — they are not. They are included as "typical employers in this sector," which is editorially appropriate but must not imply endorsement or active job postings.

---

## Section 2: Opportunities (`lib/opportunities/index.ts`)

8 opportunity records (opp_01 through opp_08).

### 2.1 Opportunity Provenance by Record

| ID | Organization | Claimed Source | Source URL | Is Real Org? | Is Listing Verifiable? | Status |
|----|-------------|----------------|-----------|-------------|----------------------|--------|
| opp_01 | FibreWave Broadband Services | "Employer Direct Posting" | `trustlink.ng/opportunities/opp_01` | **Unknown** — FibreWave is not a confirmed real company | **No** — the URL points to TrustLink itself | `PLACEHOLDER` |
| opp_02 | SunGrid Power Solutions Ltd | "FME TVET Initiative / SunGrid" | `tvet.education.gov.ng` | **Unknown** — SunGrid is not a confirmed real company | **Not verified** — the TVET URL may exist but doesn't confirm SunGrid | `PLACEHOLDER` |
| opp_03 | KoraPay Technologies | "ITF SIWES Portal / KoraPay Careers" | `siwes.itf.gov.ng` | **Yes** — KoraPay is a real company | **Not verified** — no active KoraPay SIWES listing was confirmed | `SOURCE_REFERENCED` |
| opp_04 | AfriDigital Studios | "AfriDigital Job Board" | `afridigital.com/careers` | **Unknown** — AfriDigital Studios is not a confirmed real company | **Not verified** | `PLACEHOLDER` |
| opp_05 | Deola Sagoe Atelier / House of Tara | "NiYA Gigs & Creative Directory" | `niya.gov.ng` | **Yes** — both are real brands | **Not verified** — no active NiYA listing for this gig was confirmed | `SOURCE_REFERENCED` |
| opp_06 | Precision AutoCare Services | "LEEP Jobs National Placement Feed" | `jobs.leep.gov.ng` | **Unknown** — Precision AutoCare is not a confirmed real company | **Not verified** | `PLACEHOLDER` |
| opp_07 | SecureShield Nigeria MSSP | "Employer Direct Posting" | `trustlink.ng/opportunities/opp_07` | **Unknown** — SecureShield Nigeria is not a confirmed real company | **No** — URL self-references TrustLink | `PLACEHOLDER` |
| opp_08 | Federal Ministry of Education / NABTEB | "FME TVET National Initiative" | `tvet.education.gov.ng` | **Yes** — FME and NABTEB are real institutions | **Partially verified** — FME/NABTEB do run TVET programs. Specific Kaduna intake not confirmed | `SOURCE_REFERENCED` |

### 2.2 Summary

| Status | Count | Records |
|--------|-------|---------|
| `SOURCE_VERIFIED` | 0 | — |
| `SOURCE_REFERENCED` | 3 | opp_03, opp_05, opp_08 |
| `PLACEHOLDER` | 5 | opp_01, opp_02, opp_04, opp_06, opp_07 |

**Critical finding:** 5 of 8 opportunity listings reference organizations that could not be confirmed as real Nigerian entities. 2 of those (opp_01, opp_07) source themselves back to TrustLink's own domain — a circular provenance that would not pass any honest audit.

**None of the 8 listings can be verified as live, active, real opportunities as of the audit date.**

---

## Section 3: Trending Signals (`app/page.tsx`)

3 homepage trending signals.

| Signal | Source Cited | Status |
|--------|-------------|--------|
| Solar & Inverter Installation | "NISER Energy Infrastructure Bulletin (Q2 2026)" | `SOURCE_REFERENCED` — NISER publishes bulletins; this specific Q2 2026 energy infrastructure edition not verified |
| Enterprise Network & Cabling | "NITDA Local Infrastructure Review (2026)" | `SOURCE_REFERENCED` — NITDA publishes digital economy reports; "Local Infrastructure Review" was not confirmed as a real titled document |
| Cybersecurity & Data Protection | "NDPC Annual Compliance Report (2026)" | `SOURCE_REFERENCED` — NDPC does publish compliance reports. The direction (NDPA driving demand) is factually accurate, but the specific annual report citation was not verified |

**Finding:** The trend _observations_ are directionally correct and defensible. The specific document titles may not match what NISER, NITDA, or NDPC actually published. They should either be linked to live PDFs or reclassified as editorial observations.

---

## Required Actions Before Public Use

### Immediate (block public launch of content):
1. **All 8 income ranges** must be relabeled with an explicit disclaimer that they are estimated ranges, not independently verified data
2. **opp_01, opp_02, opp_04, opp_06, opp_07** — 5 opportunity listings — must either be replaced with verified real listings or moved to a private/draft state before public display
3. **Self-referencing source URLs** (opp_01, opp_07 pointing to `trustlink.ng/...`) must be corrected

### Before claiming "verified" for any content:
4. Every trend signal source citation should have a live, linkable URL to the actual document
5. Income ranges should trace to a real salary survey, official publication, or disclosed methodology

### Design recommendation:
6. Introduce a data badge system on the UI:
   - ✅ **Source-linked** — URL confirmed active today
   - 📋 **Source-referenced** — publication named but not linked
   - 🔍 **Editorial estimate** — informed range, no external anchor
