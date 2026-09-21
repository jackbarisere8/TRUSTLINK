# Future Vision: Integrated Career-to-Work Ecosystem & Optional Spinout

## Executive Summary

This document establishes the strategic, architectural, and operational charter for TrustLink's long-term evolution: **an integrated Career-to-Work Ecosystem with an optional standalone spinout path**.

---

## 1. The Core Strategic Doctrine: Integration for Experimentation

Rather than prematurely deciding that Career Discovery and TrustLink must exist on separate domains on Day 1, the platform operates on a deliberate experimental hypothesis:

> **Does a single Nigerian platform become fundamentally more valuable when a worker's journey continues seamlessly from career discovery all the way into trusted client transactions?**

The current ecosystem is **intentionally integrated into TrustLink** to test this holistic journey in real market conditions:

```text
DISCOVERY
   ↓
CAPABILITY
   ↓
OPPORTUNITY
   ↓
WORK
   ↓
TRUST & REPUTATION
```

### The Optional Spinout Criteria:
If empirical user validation later demonstrates that:
1. Career Discovery has a distinctly separate audience (e.g. secondary schools, federal education boards, non-commercial minors) with different usage rhythms;
2. Career Discovery commands an independent institutional sponsorship or government TVET subsidy model;
3. The transaction trust layer functions better with a stripped-down, purely transactional brand footprint;

...then, and only then, will the Career Discovery layer spin out into a standalone sibling brand (e.g. *FutureHands* or *SabiPath*).

**Until users tell us otherwise, the integrated model is our strongest strategic moat.**

---

## 2. Distinct Jobs-to-be-Done Under One Roof

Even within an integrated platform, the distinct moments in a user's life are honored without confusing UX:

| Domain Layer | User Mindset | What TrustLink Provides | UX Surface |
| :--- | :--- | :--- | :--- |
| **Discovery** | *“I'm not sure what path fits me.”* | Career & Trade Atlas, Pathfinder quiz, empirical trend signals, required tools. | `/explore`, `/pathfinder` |
| **Capability** | *“I want to learn a skill.”* | Curricula roadmaps, hand toolkits, verifiable practice blueprints. | `/learn` |
| **Opportunity** | *“I need an opportunity.”* | Verified apprenticeships, SIWES placements, TVET training, gigs, and jobs with strict provenance. | `/opportunities` |
| **Trust** | *“I have a client / deal.”* | 1-on-1 deal formalization in minutes, locked scope, `PAYMENT_RECORDED`, delivery evidence, dispute workspace. | `/dashboard`, `/j/[publicId]` |

---

## 3. The 10-Year Career Lifecycle Architecture

An integrated platform allows one unified Nigerian identity to grow across an entire decade:

```text
Age 17:  CAREER DISCOVERY       (“What can I become?” → Explorer on /explore)
           ↓
Age 18:  PRACTICAL LEARNING     (“How do I master the tools?” → Learner on /learn)
           ↓
Age 19:  PRACTICE BLUEPRINTS    (“Can I build evidence?” → Practitioner on /learn#practice)
           ↓
Age 20:  APPRENTICESHIP / SIWES (“Give me supervised experience” → Apprentice on /opportunities)
           ↓
Age 21:  FIRST CLIENT WORK      (“I have a client agreement” → Provider creating TrustLink)
           ↓
Age 23:  REPUTATION ACCRUAL     (“My work is verified on record” → Proven Profile on /p/[username])
           ↓
Age 26:  MICRO-AGENCY / STUDIO  (“I take on corporate subcontracts with payment recorded”)
           ↓
Age 30:  MASTER CRAFTSMAN       (“I train apprentices and formalize their milestones on TrustLink”)
```

---

## 4. The Apprenticeship Bridge: The Natural Handoff

The most vital structural link in the Nigerian informal economy is **structured vocational apprenticeship**.

When a learner completes foundational practice blueprints in a trade (Solar Installation, Automotive Diagnostics, Bespoke Tailoring, Network Cabling), TrustLink connects them to a verified master craftsperson or workshop:

```text
Trainer (Master Artisan)
   ↓
Apprentice (Learner)
   ↓
Scope & Syllabus (Skills to be taught)
   ↓
Duration & Milestones (e.g. 6–12 months with practical check-offs)
   ↓
Evidence of Competence (Passed installations, diagnostic scan reports)
   ↓
Completion Sign-Off
```

This structured apprenticeship agreement mirrors the exact milestone, evidence, and sign-off mechanics of a `TrustLinkJob`.
- Today's apprentice learns under a structured milestone agreement.
- Tomorrow's graduate creates their own TrustLink transactions with direct clients.

---

## 5. Platform-Wide Safety & Integrity Boundaries

1. **Platform-Wide Age Safeguards**:
   - Secondary school students (<18) are restricted from direct commercial contracting, adult gig agreements, or financial transactions.
   - For minors, the platform highlights TVET training, apprenticeships, scholarships, and career exploration.
2. **Opportunity Freshness & Provenance**:
   - Every opportunity tracks: `sourceName`, `sourceUrl`, `dateFound`, `lastCheckedAt`, `deadline`, `expiresAt`, and `status` (`ACTIVE`, `DEADLINE_PASSED`, `EXPIRED`, `REMOVED`).
   - Stale listings are purged or flagged; no phantom vacancies.
3. **Non-Custodial Transaction Trust**:
   - `PAYMENT_RECORDED` remains the immutable economic model for V0.1. TrustLink does not hold user funds.
4. **Validation Discipline**:
   - All capabilities are **implemented and technically verified; awaiting real-user validation**.
