# TrustLink Web — PRD v0.1

**Status:** Pre-MVP, post-validation-planning. Payment custody (Assumption #1) unresolved — see `docs/trustlink-psp-interview-script-v2.md`.
**Owner:** Founder
**Read alongside:** `ARCHITECTURE.md`, `AGENT.md`

---

## 1. Product summary

TrustLink turns an informal Nigerian service agreement — usually already negotiated on WhatsApp, Instagram, or in person — into a structured, shareable transaction: identity, scope, price, deadline, delivery evidence, dispute handling, and a reputation record.

TrustLink does not create the customer relationship. It formalizes one that already exists. The canonical object is the **Job**, represented by a public URL (`trustlink.ng/j/[id]`) that works in a browser with no login and no app install.

## 2. The problem

A provider and a customer who don't fully trust each other need to transact. Today that happens through fragmented channels — WhatsApp, voice notes, bank transfers, screenshots — with no structure, no record, and no accountable process when something goes wrong.

## 3. Users

- **Provider** — independent professional (IT, design, dev, photo/video, digital marketing) who already has clients.
- **Client** — the person or business hiring the provider. Must be able to use the core flow without installing anything.
- **Admin** — TrustLink operator; reviews disputes, manages users, reads trust events.

A single person may act as both provider and client over time — do not force a permanent role.

## 4. Scope

### In scope for V0.1

- Provider signup, profile, Trust Profile (transparent stats, no opaque score)
- Create Job (scope, price, deadline, revisions, cancellation terms, source channel)
- Public Job Page (no login required)
- Client acceptance flow
- Job workspace: timeline, messages, delivery, revisions
- Structured dispute flow with evidence upload
- Completion + mutual reviews
- Append-only `trust_events` ledger
- Minimal admin console (users, jobs, disputes, events)
- Nigeria-wide data model (no city hard-coding)
- Channel-agnostic distribution (`source_channel` metadata, Copy Link, Web Share, QR)
- Analytics instrumented specifically to distinguish **prompted vs. unprompted repeat use**

### Explicitly out of scope for V0.1

- Marketplace / provider search / discovery (`/marketplace`, `/search`, `/find-providers` do not exist yet)
- Wallet, TrustLink-held balances, or any internal ledger implying TrustLink holds customer money
- Real payment-provider integration (Paystack/Flutterwave or otherwise) beyond an inert interface stub
- `FUNDS_PROTECTED` or `PAYMENT_AUTHORIZED` as active, reachable states
- Native mobile app
- Social-platform API integrations (WhatsApp/Instagram/TikTok/etc.) for the core workflow
- Lending or any financial product beyond transaction recording
- AI scoring, matching, or pricing intelligence
- Multi-language support beyond English

## 5. Core object: the Job

Everything attaches to a Job: provider, client, service, scope, price, deadline, milestones, revisions, payment state, delivery, evidence, messages, disputes, outcome, reputation event. The profile is a derived view of completed Jobs, not the primary object.

## 6. User journeys

**Provider:** sign up → verify identity → create profile → create Job → define scope/price/deadline → generate link → share anywhere.

**Client:** open link → review provider + agreement → accept → payment step (recorded, not protected, in V0.1) → transaction begins.

**During work:** in progress → messages → evidence → delivery.

**Completion:** delivery submitted → client review → approve or request revision → settlement (recorded) → completed → reputation event.

## 7. Page requirements (brief)

- **Landing** — headline "Turn any deal into a trusted transaction," before/after framing, 4-step how-it-works, no payment-protection claims.
- **Provider dashboard** — active/recent/completed jobs, Trust Profile summary, create-job CTA.
- **Create Job** — service, category, scope, price (NGN default), deadline, revisions, cancellation terms, source channel, payment mode (only the currently-active mode is selectable).
- **Agreement preview** — full terms + explicit "I confirm these terms are accurate" before publish.
- **Public Job Page** — the highest-priority page in the product. Must load without login, work on a slow mobile connection, and carry Open Graph metadata for when it's shared. Sections: provider, service, scope, price, deadline, payment state, Trust Profile, agreement, primary action.
- **Job workspace** — status, agreement, timeline, messages, delivery, dispute entry point.
- **Dispute flow** — labeled "Open Transaction Dispute," not "report user." Category + description + evidence.
- **Completion/reviews** — mutual 1–5 rating + repeat-hire question.
- **Admin** — users, jobs (filterable by state), disputes (open/under review/resolved), read-only trust-event timeline.

## 8. Payment mode discipline

Three possible modes exist architecturally; **only one is active in V0.1**:

| Mode | UI copy | V0.1 status |
|---|---|---|
| A — Protected funds | "Payment Protected" | Not built. Requires confirmed PSP capability. |
| B — Authorize/capture | "Payment Authorized" | Not built. Requires confirmed NGN-capable mechanism. |
| C — No-custody | "Payment Recorded" | **Active.** |

The UI must never display a capability the active payment provider doesn't actually have. See `AGENT.md` for the hard rule against inventing `FUNDS_PROTECTED`.

## 9. Data to capture

- `source_channel` on every Job (WhatsApp, Instagram, Facebook, TikTok, X, LinkedIn, Telegram, SMS, Email, QR, Referral, Direct, Other) — metadata, not a dependency.
- National fields: `country`, `state`, `city`, `service_area` on providers; `provider_location`, `client_location`, `job_location` on jobs.
- Repeat-use classification: `PROMPTED` vs `UNPROMPTED`. This is the single most important validation signal and must not be inferred after the fact — capture it at the moment of the repeat action.

## 10. Definition of done

1. Provider can create an account and profile.
2. Provider can create a Job; a unique public URL is generated.
3. The public URL works without login, on mobile.
4. Client can review and accept the agreement.
5. Provider can mark work started and submit delivery.
6. Client can request revision, approve, or open a dispute.
7. Admin can review and resolve a dispute.
8. Job can reach `COMPLETED`.
9. A `trust_events` record is created for every major transition.
10. Provider reputation stats update from completed Jobs.
11. `source_channel` is captured on every Job.
12. Repeat usage is classified prompted/unprompted.
13. No screen ever claims payment protection that doesn't exist.
14. No marketplace route or feature exists.

## 11. Open questions

- **Assumption #1 (payment custody):** unresolved. Do not build toward it speculatively — see `docs/trustlink-psp-interview-script-v2.md` for the live validation process.
- **Pilot geography:** one primary city, one optional comparison city (product itself remains national-ready regardless).
- **Fee model for V0.1:** must work without custody (per-job provider fee, credits, or pilot subscription) — not yet implemented in this build.
