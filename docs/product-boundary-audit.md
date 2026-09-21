# Product Boundary Audit (Audit 0)
### TRUSTLINK REALITY AUDIT v1 — Section 4: What Deserves to Remain?

**Prepared:** 2026-09-16  
**Scope:** Every current product surface across `app/`, `components/`, and `lib/`  
**Author:** Internal product audit — not an implementation plan  

> **Purpose of this document:** Before asking "how should we refine this feature?" — ask "should TrustLink own this capability at all?"

---

## The Boundary Test

For each capability, answer five questions:

1. **Core thesis fit** — Does this directly serve "I have a transaction; make it trustworthy"?
2. **Differentiation** — Does TrustLink have a unique advantage here, or does an existing platform already own it?
3. **Data ownership need** — Does TrustLink need to own and maintain the underlying data?
4. **Operational cost** — What does it cost to keep this fresh, accurate, and honest?
5. **Strategic distraction** — Does this pull engineering and narrative attention away from the transaction thesis?

---

## Feature Classification System

| Class | Meaning |
|-------|---------|
| **CORE** | TrustLink must own this for V0.1. The product fails without it. |
| **ADJACENT** | Enhances Core. Worth building after Core is validated. |
| **EXPERIMENTAL** | May belong here. Evidence needed before promoting to Adjacent. |
| **ROUTER** | TrustLink should surface this, but not own the underlying data. Link out. |
| **REMOVE / HIDE** | Should not be public-facing until the boundary question is answered with evidence. |

---

## Section 1: CORE (TrustLink Must Own This)

### 1.1 TrustLink Job (the transaction unit)

**Technical state:** Type system defined in concept; `lib/jobs/index.ts` is a STUB. No implementation.  
**Core thesis fit:** ✅ This IS the product. The transaction agreement is the entire wedge.  
**Differentiation:** ✅ No Nigerian platform currently offers a structured, verifiable digital work agreement at this granularity.  
**Decision:** **CORE — build this first.**

---

### 1.2 Payment Recording (`PAYMENT_RECORDED`)

**Technical state:** ✅ Implemented. `lib/payments/index.ts` has a real `RecordedPaymentAdapter`. It correctly enforces non-custodial constraint. `protectedFunds: false`, `authorization: false`.  
**Core thesis fit:** ✅ Essential to the trust thesis. Even without escrow, recording that payment happened is high-value.  
**Differentiation:** ✅ Formally recording payment events in a structured ledger is not what WhatsApp DMs, verbal agreements, or bank transfers do.  
**Decision:** **CORE — the one implemented feature that actually works end-to-end at the adapter level.**

---

### 1.3 Trust Events Ledger

**Technical state:** ✅ Implemented. `lib/trust-events/index.ts` has `TrustEventType` enum (15 event types), `TrustEvent` interface, and `recordTrustEvent()` function. In-memory only — no database persistence.  
**Core thesis fit:** ✅ The append-only ledger is the foundation of the Trust Profile moat.  
**Differentiation:** ✅ This is the core moat architecture. Verified economic history that persists.  
**Decision:** **CORE — but needs database persistence before it means anything.**

---

### 1.4 Public Provider Profile (`/p/[username]`)

**Technical state:** ✅ Page exists and renders.  
**Core thesis fit:** ✅ The public-facing trust signal. The thing a client shares to verify a provider.  
**Differentiation:** ✅ Differs from LinkedIn because it shows completed TrustLink transactions, not self-reported claims.  
**Decision:** **CORE — but currently shows hardcoded sample data. Needs real data before claiming value.**

---

### 1.5 Job Public View (`/j/[publicId]`)

**Technical state:** ✅ Route exists. Client acceptance UI built (`components/jobs/public-job-view.tsx`).  
**Core thesis fit:** ✅ The shareable job link — the "send this to your client on WhatsApp" moment.  
**Differentiation:** ✅ Unique in the Nigerian market.  
**Decision:** **CORE.**

---

## Section 2: ADJACENT (Enhances Core — Build After Validation)

### 2.1 Provider Portfolio / Work Evidence

**Technical state:** Partially implied in Trust Profile. Not separately built.  
**Core thesis fit:** ✅ Supporting. Evidence of past work strengthens the trust signal.  
**Differentiation:** Medium. Behance, LinkedIn exist. But TrustLink-linked portfolio tied to verified transactions is stronger.  
**Decision:** **ADJACENT — worth building after first real transaction is recorded.**

---

### 2.2 Dispute Module

**Technical state:** `lib/disputes/index.ts` is a STUB. Route `/disputes` exists in the app directory.  
**Core thesis fit:** ✅ Required for the full transaction lifecycle. A product with no dispute resolution is incomplete.  
**Differentiation:** ✅ Structured dispute records are not available on WhatsApp or verbal agreements.  
**Decision:** **ADJACENT — needed before V1, but not before first real transaction is tested.**

---

### 2.3 Dashboard (Provider)

**Technical state:** `/dashboard` exists, renders with hardcoded sample data.  
**Core thesis fit:** Supporting. Providers need a management interface.  
**Decision:** **ADJACENT — functional UI exists. Needs real data before it adds value.**

---

## Section 3: EXPERIMENTAL (Evidence Required Before Promoting)

### 3.1 Career Atlas (`/explore`)

**Technical state:** ✅ Built. 8 career records, filterable UI, detail modals.  
**Core thesis fit:** ❌ Indirect. Career discovery is not the same as transaction trust.  
**Differentiation:** ⚠️ Medium. Career guidance exists via NiYA, JobberMan, MyJobMag, government TVET resources.  
**Data ownership need:** ⚠️ High — 8 careers is trivially small. 40+ would require ongoing editorial work.  
**Operational cost:** High — income data goes stale; source verification is continuous work.  
**Decision:** **EXPERIMENTAL. Hypothesis: "Career Atlas helps users discover TrustLink's transaction value." This needs one real user test before expanding.**

---

### 3.2 Pathfinder Quiz (`/pathfinder`)

**Technical state:** ✅ Built. 4 questions, scoring, top-3 recommendations.  
**Core thesis fit:** ❌ Indirect. Path-finding is pre-transaction, not transaction-trust.  
**Differentiation:** Medium. Simple career quiz with scoring. Not technically complex.  
**Key risk:** Current `suitableForMinors` filter is trivially bypassed (see age-safety-audit.md).  
**Decision:** **EXPERIMENTAL. Hypothesis: "Guided pathway discovery helps Nigerians move from uncertainty to an actionable first step." Do not expand until tested.**

---

### 3.3 Learn (`/learn`)

**Technical state:** ✅ Built. 6 practice blueprints rendered.  
**Core thesis fit:** ❌ Indirect. Learning content is not transaction trust.  
**Differentiation:** ⚠️ Low. YouTube, Coursera, ALX, Semicolon, and countless Nigerian learning platforms exist.  
**Data ownership need:** High — learning content requires ongoing curation.  
**Decision:** **EXPERIMENTAL. More likely to become a ROUTER (link to ALX, Semicolon, TVET, etc.) than a content owner.**

---

## Section 4: ROUTER (Surface, Don't Own)

### 4.1 Opportunities Page (`/opportunities`)

**Technical state:** ✅ Built. 8 sample listings. Filter UI complete.  
**Core thesis fit:** Weak — opportunities discovery is pre-TrustLink-transaction. It's table-stakes content.  
**Differentiation:** ⚠️ Low. LEEP Jobs, NiYA, Jobberman, MyJobMag all own this space.  
**Data ownership cost:** Extremely high — listings go stale in days. Verification is continuous.  
**The right model:** TrustLink should show a small, curated surface that links users to LEEP, NiYA, ITF SIWES — not compete with them.  
**Decision:** **ROUTER. Keep the discovery moment ("I need an opportunity") but link out to credible sources rather than maintaining a competing database.**

---

### 4.2 Learning Resources

**Decision:** **ROUTER — link to ALX, Semicolon, NABTEB/TVET, Coursera Africa, local bootcamps. TrustLink does not need to own the learning content.**

---

### 4.3 Scholarship / Fellowship Listings

**Decision:** **ROUTER — surface and link. Do not maintain internally.**

---

## Section 5: REMOVE / HIDE (Before Evidence Arrives)

### 5.1 Income Data (as currently labeled)

**Finding (from data-provenance-audit.md):** All 8 income ranges are `SOURCE_REFERENCED` at best. None are `SOURCE_VERIFIED`.  
**Decision:** **Do not remove the Career Atlas. But hide or heavily disclaim the income ranges until each figure has a real, linkable source. Replace with: "Estimated range — not independently verified."**

---

### 5.2 "Verified Opportunities" Language

**Finding:** The word "verified" in the opportunities context implies TrustLink has independently confirmed each listing. Currently 5 of 8 listings reference organizations that cannot be confirmed as real.  
**Decision:** **Remove the word "verified" from opportunity-related copy. Replace with "Source-referenced" or "Community-sourced."**

---

### 5.3 opp_01, opp_02, opp_04, opp_06, opp_07 (5 of 8 listings)

**Finding (from data-provenance-audit.md):** These 5 listings reference organizations that could not be confirmed as real. Two self-reference TrustLink's own domain as their source.  
**Decision:** **Move these 5 listings to `status: "UNVERIFIED"` and hide them from the public-facing opportunities page immediately. Show only opp_03, opp_05, opp_08 — the 3 that at least reference real organizations.**

---

### 5.4 "40+ high-demand careers" copy (homepage)

**Finding:** The homepage currently says "Explore 40+ high-demand Nigerian careers." The career taxonomy contains 8 careers.  
**Decision:** **Correct the copy immediately. Use the actual count or remove the number.**

---

### 5.5 Trending Signals (homepage)

**Finding:** 3 signals, all `SOURCE_REFERENCED`. The trend directions are correct. The citations are editorial.  
**Decision:** **Keep the signals, but relabel as "Market Observation" rather than sourced data. Add: "Based on publicly available industry reporting."**

---

## Summary Classification Table

| Feature / Surface | Classification | Reason |
|-------------------|---------------|--------|
| TrustLink Job (agreement, delivery, completion) | **CORE** | The product thesis |
| Payment Recording (PAYMENT_RECORDED) | **CORE** | Only fully implemented core feature |
| Trust Events Ledger | **CORE** | Foundation of the moat — needs database |
| Public Provider Profile | **CORE** | The shareable trust signal |
| Job Public View / Link | **CORE** | The WhatsApp-shareable moment |
| Portfolio / Work Evidence | **ADJACENT** | Strengthens Core — build after validation |
| Dispute Module | **ADJACENT** | Required for complete lifecycle |
| Dashboard | **ADJACENT** | Needed operationally — needs real data |
| Career Atlas | **EXPERIMENTAL** | Test one real user; don't expand yet |
| Pathfinder Quiz | **EXPERIMENTAL** | Test one pathway question; don't expand |
| Learn / Practice | **EXPERIMENTAL** | Likely becomes a Router |
| Opportunities Page | **ROUTER** | Link to LEEP/NiYA/ITF; don't own the data |
| Learning Resources | **ROUTER** | Link to ALX/Semicolon/TVET |
| Income data (as-is) | **HIDE until verified** | No data is SOURCE_VERIFIED |
| "Verified Opportunity" language | **REMOVE** | Cannot support this claim |
| opp_01, 02, 04, 06, 07 | **HIDE** | Organizations unconfirmed |
| "40+ careers" copy | **CORRECT** | Currently false — only 8 exist |
| Under-18 enforcement claims | **REMOVE** | Auth is a stub; enforcement impossible |

---

## The Product Boundary Decision

**TrustLink's core identity should be:**

```
TrustLink
 └── Trusted path to work
      ├── DISCOVER — navigate your options (Pathfinder, Career Atlas as thin experimental layer)
      ├── PREPARE — link to trusted external learning (Router)
      ├── FIND — surface credible external opportunities (Router to LEEP, NiYA)
      └── PROVE & TRANSACT — the moat (CORE: Job, Agreement, Delivery, Trust Events, Profile)
```

**Not:**

```
TrustLink
 ├── Career website (content owner)
 ├── Learning platform (content owner)  
 ├── Job board (content owner)
 └── Transaction platform (core)
```

The first model requires TrustLink to be excellent at one thing.  
The second model requires TrustLink to be operational at four different businesses simultaneously, before validating any of them.
