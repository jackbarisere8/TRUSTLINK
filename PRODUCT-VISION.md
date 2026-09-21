# TrustLink Product Vision & Operating Charter

## 1. Executive Summary

TrustLink is evolving from an informal transaction-trust utility into a comprehensive Nigerian **career-to-work ecosystem**:

> **DISCOVER → LEARN → PRACTICE → OPPORTUNITY → WORK → PROVE**

We do not simply build a jobs board or a course marketplace. Nigeria already has national platforms covering segments of this space (LEEP Jobs, NiYA, FME TVET, NSIC). TrustLink's unique value is connecting the fragmented journey:
- From *"I don't know what to do"*
- To *"I know what I can become"*
- To *"I know how to learn it"*
- To *"I have practiced and built evidence"*
- To *"I can find real opportunities"*
- To *"I can formalize work under clear terms"*
- To *"I have a portable, verifiable Trust Profile and Skill Passport."*

---

## 2. Core Product Theses

### Thesis A: The Fragmented Journey
The path from potential to productive work in Nigeria is broken into disconnected silos:
- Interest, but no career direction.
- Career interest, but no idea what skills are employable.
- Skills, but no practical portfolio or proof.
- Experience, but no accessible jobs.
- Completed work, but no verifiable professional history.

TrustLink connects the entire chain.

### Thesis B: The Three-Engine Architecture
TrustLink is powered by three reinforcing engines:
1. **Discovery Engine**: What can I become? (Career Atlas, Pathfinder, Skill Pathways)
2. **Opportunity Engine**: Where can I use it? (Jobs, Gigs, Internships, Apprenticeships, SIWES, Scholarships, Fellowships, Training)
3. **Trust Engine**: Can I prove what I have done? (Universal Job Link, Payment Recorded, Delivery Evidence, Append-Only Trust Events, Skill Passport, Trust Profile)

The Discovery and Opportunity engines feed into the Trust engine, and the Trust engine makes the professional more discoverable for higher-value opportunities.

---

## 3. The 5 Main Worlds of TrustLink

The user experience is anchored around five primary destinations:

1. **Explore (`/explore`, `/careers`, `/pathfinder`)**:
   - For students, school leavers, and career switchers who need direction.
   - Includes the **Career Pathfinder** questionnaire and the **Career & Trade Atlas**.
2. **Learn (`/learn`, `/learning-paths`)**:
   - Structured skill paths with free/open resources, accredited training centers, and practical exercises.
   - Emphasis on **Practice**: documenting project evidence (schematics, code, photos, live links).
3. **Opportunities (`/opportunities`)**:
   - Universal opportunity discovery across Nigeria: Full-time Jobs, Contract Gigs, Internships, Apprenticeships, SIWES placements, Scholarships, and Fellowships.
4. **Work (`/dashboard`, `/dashboard/jobs/new`, `/j/[publicId]`)**:
   - The original transaction infrastructure: structuring deals from WhatsApp/Instagram into verifiable agreements with itemized scope, NGN pricing, deadlines, revision caps, and delivery evidence.
5. **Profile (`/p/[username]`, `/passport`)**:
   - The portable professional identity: **Skill Passport** (skills, courses, projects, certificates) + **Trust Profile** (completed transactions, mutual reviews, on-time rates, repeat hire percentages).

---

## 4. Fundamental Rules & Guardrails

### 1. Equal Dignity for Trades and Degrees
University-linked professions and practical vocational trades stand side-by-side with identical depth, prestige, and UI quality:
- Software Engineering is presented with the same gravity as Electrical Installation.
- Cybersecurity Analyst is presented with the same detail as Solar Technician or Welding Specialist.

### 2. Strict Architectural Separation (Content vs Transaction)
To prevent monolithic corruption, the platform enforces strict data separation:
- **Discovery & Content Engine** (Taxonomies, Career paths, Skill definitions, Opportunity feeds, Provenance metadata).
- **Transaction & Trust Engine** (Job agreements, Client acceptance, Delivery files, Dispute cases, Append-only `trust_events`, Financial status).

### 3. Payment Discipline (`PAYMENT_RECORDED`)
In V0.1, TrustLink remains strictly payment-neutral:
- Only `PAYMENT_RECORDED` is active.
- Zero wallet tables, zero stored balances, zero internal escrow claims.
- Any future custody capability must be implemented through an external, licensed partner adapter per `ARCHITECTURE.md` §8.

### 4. Opportunity Provenance (Anti-Scraping Discipline)
Opportunities are never deceptively presented as TrustLink-owned:
- Every external listing must record `source`, `source_url`, `source_name`, `date_found`, and `expires_at`.
- Direct outbound links give credit to original sources and employer portals.

### 5. Age-Aware Safeguards (<18)
Because TrustLink serves secondary-school students:
- Users under 18 are directed toward education, approved vocational apprenticeships, and safe learning resources.
- Minors are never exposed to unvetted direct commercial contracts or hazardous work arrangements.

### 6. Channel Independence
No direct dependency on WhatsApp, Instagram, or social media APIs:
- Universal URLs (`trustlink.ng/j/...`, `trustlink.ng/p/...`) are shared across WhatsApp, SMS, QR codes, or Web Share API.
- The `source_channel` is captured as analytics metadata.

---

## 5. Development Order (The 10-Phase Roadmap)

1. **Phase 1 — Premium Website Foundation** [COMPLETED]
   - Next.js App Router, Tailwind design tokens (navy, slate, teal), accessible components, responsive navigation shell.
2. **Phase 2 — Original TrustLink Transaction MVP** [COMPLETED]
   - Create Job form, Universal Job URL, Public Job Page (`/j/[publicId]`), interactive client acceptance, payment recorded status, transaction timeline.
3. **Phase 3 — Opportunity Discovery Foundation** [CURRENT]
   - `/opportunities` with multi-category filters (Jobs, Gigs, Internships, Apprenticeships, SIWES, Training) and Nigerian state/city locations.
4. **Phase 4 — Career Atlas** [CURRENT]
   - `/explore` with rich career profiles covering workday tasks, required skills, tools, entry pathways, and trend indicators.
5. **Phase 5 — Career Pathfinder** [CURRENT]
   - `/pathfinder` interactive exploration matching user interests, work preferences, and current situation to plausible paths with transparent reasoning.
6. **Phase 6 — Learning & Skill Passport**
   - Step-by-step learning roadmaps, practical project evidence submission, and the `/passport` view.
7. **Phase 7 — Universal Search**
   - Single omni-search returning Careers, Skills, Courses, Opportunities, and Verified Professionals.
8. **Phase 8 — Skill ↔ Opportunity Matching**
   - "Missing Skills" analysis turning opportunity rejections into actionable learning paths.
9. **Phase 9 — Integrated Professional Trust Profile**
   - Combining transaction history, Skill Passport, client reviews, and verified identity.
10. **Phase 10 — National-Scale Ecosystem**
    - Employer portal, verified training partner integration, and national analytics.

