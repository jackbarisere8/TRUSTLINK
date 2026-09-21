# Competitive Positioning Audit
### TRUSTLINK REALITY AUDIT v1 — Section 3: What Already Exists?

**Prepared:** 2026-09-16  
**Research basis:** Live platform verification (September 2026)  
**Author:** Internal competitive audit — not a marketing document

---

## Purpose

Before committing to build any feature, answer: **Does an existing Nigerian platform already own this territory?**

If yes — the question is not "can we build a better version?" but "should TrustLink enter this space at all, or route users there?"

---

## Section 1: Government Platforms

### 1.1 NiYA — Nigerian Youth Academy
**URL:** niya.gov.ng | **Operator:** Federal Ministry of Youth Development | **Status:** ✅ Live and operational

**What it actually offers:**
- **NiYA Academy** — Free skills training ("One Youth, Two Skills" program)
- **NiYA Jobs** — National job-matching portal
- **NiYA Gigs** (gigs.niya.gov.ng) — Freelance marketplace with **built-in escrow payment system** (bid-based, portfolio-driven)
- **NiYA Community** — Networking and collaboration

**Target user:** Young Nigerians aged 18–35

**Overlap with TrustLink:**

| TrustLink Feature | NiYA Equivalent | Assessment |
|------------------|----------------|-----------|
| Career discovery / Explore | NiYA Academy training catalog | **Overlap** — NiYA owns this officially |
| Opportunities page | NiYA Jobs | **Direct overlap** |
| Gig transactions | NiYA Gigs + escrow | **Direct overlap** — NiYA Gigs even has escrow |
| Transaction trust / TrustLink Job | Not equivalent | **No overlap** — NiYA's escrow is internal to its marketplace, not a general-purpose trust layer |

**Critical insight:** NiYA Gigs has a payment escrow feature. This is the most important competitive finding. However, NiYA's escrow is a walled garden — it only works for transactions initiated on NiYA's platform. It does not address the broader trust problem in WhatsApp commerce, Instagram shops, or peer-to-peer transactions in Nigeria's informal economy. **That gap is where TrustLink's thesis lives.**

---

### 1.2 LEEP Jobs — Labour Employment and Empowerment Programme
**URL:** jobs.leep.gov.ng | **Operator:** Federal Ministry of Labour and Employment | **Launched:** April 2025 | **Status:** ✅ Live

**What it actually offers:**
- Jobs portal with employer-verified vacancies
- LEEP Digital Academy (software, data, AI training)
- Vocational & Entrepreneurship Programme (clean energy, agric, hospitality)
- Digital Nomads (remote/international work facilitation)
- Physical job fairs

**Target user:** All working-age Nigerians

**Overlap with TrustLink:**

| TrustLink Feature | LEEP Equivalent | Assessment |
|------------------|----------------|-----------|
| Opportunities page | LEEP Jobs portal | **Direct overlap** |
| Learn section | LEEP Digital Academy + VEP | **Overlap** |
| Transaction trust | None | **No overlap** |

**Assessment:** LEEP is a government jobs board with training. It does not address transaction trust. TrustLink's core thesis (transaction-layer trust) is uncovered by LEEP. The Opportunities and Learn sections TrustLink built are, however, in territory LEEP already occupies at national scale with government backing.

---

### 1.3 NASIC — National Skills Information Center
**URL:** nasic.education.gov.ng | **Operator:** Federal Ministry of Education | **Status:** ✅ Live

**What it actually offers:**
- Database of certified artisans (electricians, plumbers, carpenters, tailors, etc.)
- Rating and performance system for artisans
- Employer hiring portal
- Feeds into the Nigerian Skills Qualifications Framework (NSQF) and NBS workforce data

**Target user:** Artisans, skilled tradespeople, employers of artisans

**Overlap with TrustLink:**

| TrustLink Feature | NASIC Equivalent | Assessment |
|------------------|-----------------|-----------|
| Trust Profile (for artisans) | NASIC artisan database + rating | **Partial overlap** |
| Transaction trust | None | **No overlap** |
| Skill verification | NASIC credential verification | **Overlap — but credential, not transaction-based** |

**Key distinction:** NASIC's trust model is credential-based (you are certified → trusted). TrustLink's trust model is transaction-based (you delivered → trusted). These are complementary, not identical. NASIC cannot be used by a graphic designer or a web developer. TrustLink can.

---

### 1.4 ITF SIWES
**URL:** siwes.itf.gov.ng | **Status:** ✅ Live (2024/2025 session active)

**What it actually offers:** Institutional internship placement management — for university students on mandatory industrial training. Not a public job board. Students are placed by their institutions.

**Overlap with TrustLink:** Negligible. Entirely different category.

**Note on opp_03:** The sample opportunity listing `opp_03` claims it comes from "ITF SIWES Portal / KoraPay Careers." SIWES placements are not browsable public listings — they are handled by university coordinators. This framing is misleading and should be corrected.

---

### 1.5 FME TVET
**URL:** tvet.education.gov.ng | **Status:** ✅ Live (registration active 2025–2026)

**What it actually offers:** Free vocational training registration with NIN + BVN verification. Monthly stipends. Two tracks: short-term certificates and innovation programs. Partnered with NBTE, NELFUND, TETFUND.

**Overlap with TrustLink:** None at the transaction layer. TrustLink's "Learn" section linking to TVET is appropriate as a **Router** move — direct users to this program rather than building competing training content.

---

## Section 2: Private Platforms

### 2.1 Jobberman
**URL:** jobberman.com | **Status:** ✅ Market leader, 329K+ new users in 2025, ~1M monthly visits

**What it offers:** Job board + career development; acquired Ngcareers (2022); backed by Mastercard Foundation; part of The African Talent Company.

**Overlap with TrustLink's Opportunities page:** **Direct and significant.** Jobberman is the dominant Nigerian job board.

**Assessment:** TrustLink should not try to compete here. Router model is the right answer.

---

### 2.2 MyJobMag
**URL:** myjobmag.com | **Status:** ✅ Active

**What it offers:** Job aggregator with daily updates, strong for entry-level, NGO, and government roles; includes salary benchmarking.

**Assessment:** Salary benchmarking is a direct overlap with TrustLink's income range data. MyJobMag likely has better-sourced salary data for Nigerian roles than TrustLink's editorial estimates.

---

### 2.3 ITF SUPA (Skill-Up Artisans Programme)
**URL:** supa.itf.gov.ng | **Status:** ✅ More active than NASIC for artisan registration

**What it offers:** Artisan registration, skills documentation, training tracking.

**Assessment:** Overlaps with TrustLink's artisan/skilled trade trust features. A potential partner or router destination, not a competitor.

---

## Section 3: The Trust Gap Map

What none of these platforms address:

```
The Nigerian Trust Gap
═══════════════════════════════════════════════════════════════

Before the transaction:         ← Government platforms own this
  → Career discovery (NiYA Academy, LEEP Digital Academy)
  → Skills training (TVET, ITF SUPA, ALX)
  → Job matching (LEEP Jobs, NiYA Jobs, Jobberman)
  → Credential verification (NASIC, SUPA)

───────────────────────────────────────────────────────────────

The transaction itself:         ← THE GAP TrustLink addresses
  → "I found a client on Instagram. How do we agree on scope?"
  → "I paid this freelancer on WhatsApp. Did they deliver?"
  → "We had a deal. They're disputing now. What's the record?"
  → "I want to know this person's delivery history before I hire."

No existing platform — government or private — provides:
  ✗ A verifiable digital work agreement for informal economy
  ✗ A ledger of completed transactions (not self-reported)
  ✗ A portable trust profile built from transaction evidence
  ✗ A dispute record tied to a real job, not just a review

───────────────────────────────────────────────────────────────

After the transaction:          ← Partial (NASIC credential; NiYA profile)
  → Building long-term reputation
  → Proving delivery history
  → Accessing better opportunities
```

**This gap is where TrustLink has a real thesis.**

---

## Section 4: The "Verified Opportunity" Problem in Context

Documented fraud and fake listings are endemic across Nigerian job and training platforms:
- Multiple government agencies (FCSC, ITF, individual ministries) publish explicit warnings about fake portals
- WhatsApp scams impersonating government agencies are widespread
- Fraudulent payment requests on job platforms are reported frequently

This means **every new Nigerian digital platform needs to solve its own trust problem**, even before it can help users trust each other.

TrustLink's opportunity listings (opp_01–opp_08) that cannot be verified against real organizations add to this trust problem rather than solving it. The platform that is supposed to build trust must start by being honest about its own data.

---

## Section 5: What TrustLink Can Route vs. Own

| User Journey Moment | Route To | Don't Build |
|--------------------|---------|-------------|
| "I want to learn a skill" | ALX, Semicolon, TVET, NiYA Academy | Competing learning curriculum |
| "I need job listings" | Jobberman, LEEP Jobs, NiYA Jobs | Competing jobs database |
| "I need apprenticeship placement" | LEEP VEP, NiYA Academy, ITF SUPA | Competing placement system |
| "I need SIWES placement" | siwes.itf.gov.ng (via institution) | Competing SIWES portal |
| "I want free vocational training" | tvet.education.gov.ng | Competing training content |
| "I want to find certified artisans" | NASIC, ITF SUPA | Competing artisan directory |

| User Journey Moment | TrustLink Owns | Nobody Else Does |
|---------------------|---------------|-----------------|
| "I need this work agreement to be formal and verifiable" | ✅ TrustLink Job | Correct |
| "I need to record that I paid / was paid" | ✅ PAYMENT_RECORDED | Correct |
| "I need to prove I delivered this work" | ✅ Delivery record + Trust Event | Correct |
| "Client wants to see my real work history, not a CV" | ✅ Trust Profile | Correct |
| "We have a dispute — what's the record?" | ✅ Dispute module (planned) | Correct |

---

## Key Decisions Implied by This Research

1. **The transaction-trust thesis is real and uncovered.** No government or private platform owns it.

2. **The career/learning/opportunity content territory is crowded.** Government platforms at national scale already claim it. TrustLink should be a router, not a competitor.

3. **NiYA Gigs is the closest competitor.** Its escrow is internal and platform-specific. TrustLink's advantage is: a general-purpose, cross-platform trust layer usable regardless of where the client and provider found each other (Instagram, WhatsApp, referral).

4. **NASIC is a potential partner.** An artisan registered on NASIC who also uses TrustLink for their transactions gets credential + transaction trust — a stronger signal than either alone.

5. **LEEP is a potential router destination.** When a TrustLink user says "I need an opportunity," send them to LEEP Jobs — don't maintain a competing database.
