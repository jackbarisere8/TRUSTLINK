# TRUSTLINK REALITY AUDIT v1
**Date:** 2026-09-16  
**Status:** Internal — not a product plan, not a marketing document  
**Purpose:** Honest assessment of what is real, what is claimed, what already exists, and what deserves to remain

> *"The ecosystem is now a hypothesis with a working prototype. Stop polishing it until evidence tells us what role it should play."*

---

## The Four Questions

```
1. WHAT IS REAL?           → docs/data-provenance-audit.md
2. WHAT IS TECHNICALLY     → docs/age-safety-audit.md (+ payment, auth, trust events)
   CLAIMED?
3. WHAT ALREADY EXISTS?    → docs/competitive-positioning.md
4. WHAT DESERVES TO        → docs/product-boundary-audit.md
   REMAIN?
```

This document is the executive summary. Each section links to a full supporting document.

---

## Section 1: What Is Real?

*Full detail: [data-provenance-audit.md](./data-provenance-audit.md)*

### The honest data state

| Data Type | Count | SOURCE_VERIFIED | SOURCE_REFERENCED | PLACEHOLDER |
|-----------|-------|-----------------|-------------------|-------------|
| Career income ranges | 8 | **0** | 8 | 0 |
| Career trend signals | 8 | **0** | 8 | 0 |
| Opportunity listings | 8 | **0** | 3 | **5** |
| Homepage trending signals | 3 | **0** | 3 | 0 |

**The most important finding:** Not a single piece of data across career income ranges, trend signals, or opportunity listings is `SOURCE_VERIFIED` — meaning no figure has been retrieved directly from a live, linkable, re-verifiable source.

This does not mean the data is fabricated. The career information (typical employers, skills required, entry routes) is directionally accurate. The trend signals describe real market dynamics. But the specific numbers and citations were constructed editorially rather than retrieved from real documents.

### Immediate implications

**Income ranges:** All 8 are plausible but unverified estimates. They must be labeled: *"Estimated range — not independently verified."*

**5 opportunity listings are PLACEHOLDER status:**
- `opp_01` (FibreWave Broadband) — Organization not confirmed real; source URL self-references TrustLink
- `opp_02` (SunGrid Power Solutions) — Organization not confirmed real
- `opp_04` (AfriDigital Studios) — Organization not confirmed real
- `opp_06` (Precision AutoCare) — Organization not confirmed real
- `opp_07` (SecureShield Nigeria) — Organization not confirmed real; source URL self-references TrustLink

**These 5 listings must not be shown to real users.** Showing fabricated opportunity listings on a platform whose thesis is "trust" would be a founding integrity failure.

**Copy error:** The homepage says "Explore 40+ high-demand Nigerian careers." There are 8 careers in the taxonomy. This must be corrected.

---

## Section 2: What Is Technically Claimed?

*Full detail: [age-safety-audit.md](./age-safety-audit.md)*

### 2.1 Payment Model

| Claim | Technical Reality | Assessment |
|-------|------------------|-----------|
| "Non-custodial" — TrustLink does not hold funds | ✅ `RecordedPaymentAdapter` enforces `protectedFunds: false` | **Claim is real** |
| `PAYMENT_RECORDED` event | ✅ Implemented in `lib/payments/index.ts` | **Works** |
| `verifyPayment()` returns `verified: true` for all references | ⚠️ Always returns true — no actual verification | **Stub-level only** |
| FUNDS_PROTECTED | ✅ Deliberately locked out until PSP partner confirmed | **Correctly constrained** |

**Payment is the best-implemented core feature.** The `RecordedPaymentAdapter` is honest about what it does and does not do.

---

### 2.2 Trust Events Ledger

| Claim | Technical Reality | Assessment |
|-------|------------------|-----------|
| Append-only transaction ledger | ✅ `recordTrustEvent()` exists with 15 event types | **Type system is real** |
| Ledger persistence | ❌ In-memory only — no database | **Not persistent** |
| "Immutable public profile" (homepage copy) | ❌ No database, no persistence | **Overclaims** |

The ledger architecture is correct. The persistence — the thing that makes it actually immutable and permanent — does not exist yet.

---

### 2.3 Age Verification and Protection

| Claim / Implication | Technical Reality | Assessment |
|---------------------|------------------|-----------|
| `Youth Eligible` badge | Static label in sample data | **Not enforced** |
| `18+ Required` badge | Decorative UI label | **Not enforced** |
| `suitableForMinors: false` Pathfinder filter | Only fires on self-declared `student_minor` | **Trivially bypassed** |
| "Contract requires 18+" (Terms page) | Legal text only | **No technical enforcement** |
| Age verification on signup | Auth is a STUB (`export {}`) | **Does not exist** |

**The age safety problem is structural:** The entire auth module is a stub. No user can register. Therefore no user's age can be checked. Every age-related safeguard in the product is a UI label with zero enforcement.

This must be disclosed honestly in documentation. The platform must not claim "under-18 protection" until the auth system and age verification are implemented.

---

### 2.4 Authentication and User Identity

| Module | State |
|--------|-------|
| `lib/auth/index.ts` | STUB — `export {}` |
| `lib/validation/index.ts` | STUB — `export {}` |
| `lib/jobs/index.ts` | STUB — `export {}` |
| `lib/disputes/index.ts` | STUB — `export {}` |
| `lib/reputation/index.ts` | STUB — `export {}` |
| `lib/notifications/index.ts` | STUB — `export {}` |

**5 of 6 service modules are stubs.** The product exists as a UI prototype over a set of type definitions and one real payment adapter. This is the correct state for a V0.1 prototype — but it means every claim about what TrustLink "does" is a claim about what it will do.

---

## Section 3: What Already Exists?

*Full detail: [competitive-positioning.md](./competitive-positioning.md)*

### The Nigerian landscape

| Platform | Core Territory | Live? | TrustLink Overlap |
|----------|--------------|-------|-------------------|
| **NiYA** (niya.gov.ng) | Skills training + job portal + gig marketplace + **escrow** | ✅ | Career discovery, gig matching, partial escrow |
| **LEEP Jobs** (jobs.leep.gov.ng) | Federal employment portal + training | ✅ (since Apr 2025) | Opportunities page, Learn section |
| **NASIC** (nasic.education.gov.ng) | Artisan credential database + rating system | ✅ | Trust Profile (artisan segment only) |
| **SIWES** (siwes.itf.gov.ng) | Institutional student internship placement | ✅ | opp_03 references it misleadingly |
| **FME TVET** (tvet.education.gov.ng) | Free vocational training registration | ✅ | Learn / training content |
| **Jobberman** | Leading private job board, ~1M monthly visits | ✅ | Opportunities page |
| **MyJobMag** | Job aggregator + salary benchmarking | ✅ | Income ranges, opportunity listings |

### The structural finding

Every existing platform operates in the **"before the transaction"** space:

```
BEFORE TRANSACTION (crowded):
  ✓ Career discovery — NiYA Academy, LEEP Digital Academy, TVET
  ✓ Skills training — ALX, Semicolon, TVET, ITF SUPA
  ✓ Job matching — Jobberman, LEEP Jobs, NiYA Jobs, MyJobMag
  ✓ Credential verification — NASIC, ITF SUPA
  ✓ Placement — SIWES, NiYA Gigs, LEEP VEP

THE TRANSACTION ITSELF (uncovered):
  ✗ Verifiable digital work agreement for informal economy
  ✗ Non-custodial payment recording with cryptographic reference
  ✗ Dispute record tied to a real job
  ✗ Portable trust profile built from transaction evidence (not CV claims)
  ✗ Cross-platform trust layer for WhatsApp / Instagram commerce
```

**TrustLink's real thesis lives in the uncovered space.** The Career Atlas, Learn section, and Opportunities page that were built are all in the already-covered space — territory owned by better-resourced platforms.

### The NiYA Gigs finding

NiYA Gigs has an internal escrow feature. This is the closest existing product to TrustLink's core. The critical difference: NiYA's escrow only works for transactions initiated on NiYA's platform. **It doesn't help the woman who found her embroiderer on Instagram, or the business owner who hired a developer through a WhatsApp referral.** That is TrustLink's opportunity.

---

## Section 4: What Deserves to Remain?

*Full detail: [product-boundary-audit.md](./product-boundary-audit.md)*

### The classification

| Feature | Classification | Why |
|---------|---------------|-----|
| TrustLink Job (agreement, delivery, completion) | **CORE** | The product thesis. Nobody else owns this. |
| Payment Recording (`PAYMENT_RECORDED`) | **CORE** | Only fully implemented core feature. |
| Trust Events Ledger | **CORE** | Foundation of the moat. Needs database persistence. |
| Public Provider Profile (`/p/[username]`) | **CORE** | The portable trust signal. |
| Job Public View (`/j/[publicId]`) | **CORE** | The WhatsApp-shareable moment. |
| Dispute Module | **ADJACENT** | Required for complete lifecycle. Not yet built. |
| Provider Portfolio / Work Evidence | **ADJACENT** | Strengthens Core. Build after first real transaction. |
| Dashboard | **ADJACENT** | Needs real data before it adds value. |
| Career Atlas (`/explore`) | **EXPERIMENTAL** | Test one real user. Don't expand until evidence. |
| Pathfinder Quiz (`/pathfinder`) | **EXPERIMENTAL** | Test one pathway question. Fix minor bypass first. |
| Learn / Practice (`/learn`) | **EXPERIMENTAL** | More likely becomes a Router to ALX/TVET/Semicolon. |
| Opportunities (`/opportunities`) | **ROUTER** | Link to LEEP, NiYA, Jobberman. Don't maintain a database. |
| Income data (as-is) | **HIDE until verified** | No figure is SOURCE_VERIFIED. |
| "Verified Opportunity" language | **REMOVE** | Claim cannot be supported. |
| opp_01, opp_02, opp_04, opp_06, opp_07 | **HIDE immediately** | Organizations unconfirmed. |
| "40+ careers" copy | **CORRECT immediately** | False — only 8 careers exist. |
| Under-18 enforcement claims | **REMOVE** | Auth is a stub. Enforcement impossible. |

---

## The Two Experiments

This audit confirms what you identified. There are now two separate hypotheses — and neither should be confused with the other:

### Experiment A — TrustLink Core (Transaction Trust)
> *"Can structured transaction trust change behavior in Nigeria's informal economy?"*

**What this needs:** One real provider. One real customer. One real transaction.

Build: Job → Agreement → `PAYMENT_RECORDED` → Delivery → Completion → Trust Event → Profile update

Then ask both parties: Did this change how they behaved? Did the written agreement prevent a dispute? Did the trust profile make the next client hire faster?

**This is the only hypothesis that can be tested today. The core UI already exists.**

---

### Experiment B — Career Discovery (Optional, Separate)
> *"Can guided pathway discovery help Nigerians move from uncertainty to an actionable first step?"*

**What this needs:** One real user facing career uncertainty. Run Pathfinder. Then ask: Did they take a concrete next step they would not have taken without this?

**This does not need to be validated before Experiment A. And it does not need more features before the first test.**

---

## The Moat — What This Audit Confirms

The moat is not:
- 8 careers (or even 40)
- 8 opportunity listings
- 6 practice blueprints
- 3 trending signals with editorial citations

The moat is:
> **Verified economic history. Transaction evidence that cannot be self-reported.**

Every feature that does not feed users toward that moat is overhead until the moat is proven.

---

## What the Agent Should Do Next

The agent should **not** add features, consolidate UX, or expand any content.

The agent should make 5 honest corrections to the existing build:

### Immediate corrections (before any real user sees the product):

1. **Fix the "40+ careers" copy** on the homepage → change to the accurate count or remove the number

2. **Hide 5 opportunity listings** → set `opp_01`, `opp_02`, `opp_04`, `opp_06`, `opp_07` to `status: "UNVERIFIED"` and filter them from the public opportunities page

3. **Add income range disclaimer** on every career card: *"Estimated range — not independently verified. Actual compensation varies."*

4. **Remove "18+ Required" gate implication** — the badge can remain but add: *"TrustLink does not verify user age. Confirm eligibility directly with the provider."*

5. **Correct any copy saying "verified opportunities"** → replace with "source-referenced" or "community-sourced"

### Then: Stop and find a real user.

---

## Founder Decision Table

| Area | Decision | Reasoning from Audit |
|------|---------|---------------------|
| TrustLink transaction engine | **Continue** | Uncovered by competitors. Real thesis. |
| Trust Events Ledger | **Continue → needs database** | Architecture correct. Persistence missing. |
| Trust Profile | **Continue** | Core moat. Currently shows hardcoded sample data. |
| Payment Recording | **Continue** | Only working core feature. |
| Career Atlas | **Freeze / experiment** | Territory is crowded. Test before expanding. |
| Pathfinder | **Freeze / experiment** | Fix minor bypass. Test one user. |
| Learning | **Freeze → likely becomes Router** | ALX, TVET, Semicolon exist. |
| Opportunities | **Freeze → become Router** | Jobberman, LEEP Jobs, NiYA Jobs exist. |
| Marketplace | **Do not build** | NiYA Gigs already exists with escrow. |
| Payment custody | **Unresolved** | Correct. No PSP partner confirmed. |
| Income data | **Audit before public use** | Zero SOURCE_VERIFIED entries. |
| Opportunity data | **Audit before public use** | 5 of 8 are PLACEHOLDER. |
| Under-18 safeguards | **Audit before claiming protection** | Auth is a stub. Claims are impossible. |
| UX consolidation | **Pause** | Wrong question until Experiment A is tested. |

---

## Closing Statement

TrustLink has built something that answers the question:

> **"Can we build a representation of the entire career-to-work journey in one product?"**

The answer is yes. The prototype proves that.

The question the product has not yet answered — and cannot answer from code — is:

> **"Should this representation exist in this form? And does the transaction-trust thesis hold when exposed to real Nigerians?"**

That question requires one real transaction.

Not a better homepage. Not a more polished career atlas. Not a fresher set of opportunity listings.

**One real provider. One real client. One real job. Watch what happens.**

That is the next step.
