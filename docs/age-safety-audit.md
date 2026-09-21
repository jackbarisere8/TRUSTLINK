# Age Safety Audit
### TRUSTLINK REALITY AUDIT v1 — Section 2: What Is Technically Claimed?

**Prepared:** 2026-09-16  
**Scope:** All age-related safeguards, claims, and controls across the codebase  
**Author:** Internal technical audit — not a product promise

---

## 1. What TrustLink Currently Claims About Age

The product currently implies several things about age that may not be technically enforced:

| Surface | Implied Claim | What Actually Happens |
|---------|-------------|----------------------|
| Opportunities page — `Youth Eligible` badge | "This opportunity is appropriate for young people" | The `isYouthEligible` boolean was manually set in `SAMPLE_OPPORTUNITIES`. No user's age was checked. |
| Opportunities page — `18+ Required` badge | "This opportunity requires the user to be 18 or older" | The badge is decorative. No gate prevents a 15-year-old from viewing or applying. |
| Pathfinder — `suitableForMinors: false` filter | "This career path is filtered for underage users" | The filter only fires when `answers.situation === "student_minor"` — i.e., only if the user self-identifies as a minor. A minor who selects any other option bypasses the filter entirely. |
| Terms page | "contract creation requires 18+ capacity to contract" | This is a legal statement. There is no technical enforcement of this rule anywhere in the codebase. |
| Auth module (`lib/auth/index.ts`) | — | **STUB** — the module contains only `export {}`. There is no auth logic implemented. |
| Signup page | — | Markup only. No age field. No date-of-birth verification. |

---

## 2. Technical Audit of Age Controls

### 2.1 Auth System

```
lib/auth/index.ts — LINE 1-4:
// STUB — auth service module
// Business logic lives here, not in page components.
export {};
```

**Finding:** There is no authentication implementation in the codebase. No user can currently be registered. No user's age can be verified. All age-related safeguards are entirely UI-layer labels with no enforcement.

---

### 2.2 Pathfinder Quiz Filter

```typescript
// lib/discovery/pathfinder.ts — calculatePathfinderRecommendations()
// Filter: skip careers with suitableForMinors: false when situation === "student_minor"
```

**Finding:**
- The filter is only triggered by `answers.situation === "student_minor"`
- The `situation` question offers: `"working"`, `"studying_polytechnic"`, `"school_leaver"`, `"student_minor"`, `"parent_guardian"`
- A 14-year-old who selects `"school_leaver"` or `"working"` will receive career recommendations that include `suitableForMinors: false` entries (e.g., Solar Technician, Automotive Tech, Electrical)
- The filter is self-declared only, not verified

**Severity:** Medium. Pathfinder recommending hazardous-equipment careers to an unverified minor is a real risk if this feature is made public.

---

### 2.3 Opportunity `ageRequirement` and `isYouthEligible`

```typescript
// lib/opportunities/index.ts
ageRequirement: "ALL_AGES" | "18_PLUS" | "YOUTH_FOCUSED";
isYouthEligible: boolean;
```

**Finding:**
- Both fields are static data labels on the sample records
- There is no code that reads a logged-in user's age and gates access based on `ageRequirement`
- The `youthOnly` filter toggle on the opportunities page shows/hides cards based on `isYouthEligible` — this is a discovery filter, not a protection mechanism
- There is no "18+ only" gate that would prevent a minor from applying to an `18_PLUS` opportunity

---

### 2.4 Terms of Service

```
app/terms/page.tsx — Line 35:
"not an escrow agent and does not take custody of customer funds."
```

The Terms page also references contractual capacity. Legal text claiming protection is not equivalent to technical enforcement.

---

## 3. What TrustLink Needs Before It Can Honestly Claim Age Safeguards

### 3.1 The `age_status` Problem

Currently, TrustLink has no concept of a user's age_status anywhere in the type system. The recommended classification was:

```typescript
type AgeStatus = "VERIFIED" | "SELF_DECLARED" | "UNKNOWN";
```

This field doesn't exist in any live user model in the codebase (because there is no live user model — auth is a stub).

### 3.2 Minimum Honest State for V0.1

| What to claim | What it requires technically |
|--------------|------------------------------|
| "Youth-eligible opportunities" | Badge can remain but must add: "You are responsible for confirming your eligibility." |
| "18+ required" | Cannot currently be enforced. Must remove the implication that TrustLink enforces this. |
| "Under-18 protected" | **Cannot be claimed at all.** There is no age verification system. |
| "Contract capacity confirmed" | **Cannot be claimed at all.** Auth is a stub. |

---

## 4. Required Actions Before Making Any Age Protection Claims

| Action | Priority | Reason |
|--------|----------|--------|
| Add explicit disclaimer on opportunities page: "TrustLink does not verify user age. Check opportunity requirements directly with the provider." | **Immediate** | Without this, the `18+ Required` badge implies a protection that doesn't exist |
| Remove any copy suggesting TrustLink verifies or enforces age | **Immediate** | Legal risk |
| Add `age_status` field to user schema when auth is built | Before auth launch | Needed for honest age claims |
| Change Pathfinder `suitableForMinors` filter to require explicit self-declaration with an acknowledgement checkbox | Before Pathfinder public launch | Current filter is trivially bypassed |
| Document in AGENT.md: "The platform does not currently verify user age. Do not add code or copy that implies verified age checking." | Immediate | Prevents future agent from re-claiming this |

---

## 5. Legal Note

> ⚠️ This document does not constitute legal advice. Before TrustLink makes any public claims about under-18 protection or contract capacity requirements, qualified Nigerian legal counsel should review the Children's Right Act 2003, the Nigerian Data Protection Act 2023 (NDPA), and related regulations on digital service operators contracting with minors.

The architectural decision to add `age_status = VERIFIED | SELF_DECLARED | UNKNOWN` is technically sound. Implementing it as verified requires either:
- A government-linked ID verification partner (e.g., NIN integration), or
- An explicit declaration that the platform relies on self-declaration only and assumes no responsibility for age misrepresentation

**For V0.1: Self-declaration with explicit user acknowledgement is the correct and honest approach.**
