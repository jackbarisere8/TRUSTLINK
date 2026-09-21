# AGENT.md — Rules for whoever (or whatever) builds this

**Read in this order before writing any code:** this file → `PRD.md` → `ARCHITECTURE.md` → `ARCHITECTURE-ESSENTIALS.md` for quick reference afterward.

This is validation-stage software for a real company handling real people's money and identity data, built under real Nigerian financial regulation. Move fast on UI and workflow. Move carefully on anything touching funds, credentials, or personal data.

---

## 1. Product thesis (2 sentences)

TrustLink helps a customer and an independent Nigerian service provider turn an informal agreement — found through WhatsApp, Instagram, referral, or any other channel — into a structured, evidence-backed transaction. The canonical object is a public Job link; TrustLink owns the structure, evidence, and reputation of the transaction, not the conversation, not (yet) the marketplace, and not (yet) the money.

## 2. Hard rules — do not build these in V0.1

- **No marketplace.** No `/marketplace`, `/search`, `/find-providers`, or provider-discovery browsing of any kind.
- **No custody.** No wallet balances, no internal ledger implying TrustLink holds funds, no fake escrow, no "money held by TrustLink" language anywhere in code, copy, or seed data.
- **No invented payment protection.** The UI must never say "Payment Protected" or "Payment Authorized" unless a real, confirmed payment integration is live and explicitly configured for that capability. V0.1 ships `PAYMENT_RECORDED` only.
- **No social-platform API dependency.** No WhatsApp/Instagram/TikTok/Facebook/X/LinkedIn integration for the core workflow. Distribution is Copy Link + Web Share + QR — all of which just encode a URL.
- **No lending, no AI scoring, no opaque Trust Score, no native app.** These are later-phase decisions that have to be earned by validation evidence, not built ahead of it.

If a request would cross one of these lines, **stop and ask the founder explicitly** rather than interpreting the request generously. These boundaries were set deliberately after a long process of correcting an earlier tendency to over-scope — see `PRD.md` §11 for what's still genuinely unresolved.

## 3. Payment mode discipline

Three modes exist architecturally (`PROTECTED`, `AUTHORIZED`, `RECORDED`); only `RECORDED` is active. `FUNDS_PROTECTED` must not be a reachable state under any code path — including demo/seed data, including error-state fallbacks. See `ARCHITECTURE.md` §6 and §8.

---

## 4. Credentials & secrets — guardrails

This is the section that matters most for this file. Treat it as non-negotiable.

### 4.1 Never hardcode secrets

No API keys, database credentials, connection strings, signing secrets, or tokens ever appear directly in source code, comments, seed data, or commit history. All configuration comes from environment variables, loaded from `.env.local`, which is never committed (see `.gitignore`).

### 4.2 `.env.example` only, real values never

`.env.example` at the repo root lists every required variable name with a placeholder or blank value. It is the only env file that gets committed. If a new integration needs a new credential, add its name to `.env.example` with a blank/placeholder value — never with a real key, even a test one.

### 4.3 No live payment-provider credentials in this phase

Payment integration stays at the interface/stub level (`lib/payments/types.ts`) until Assumption #1 is resolved through the process in `docs/trustlink-psp-interview-script-v2.md`. Do not request, generate a config slot for, or integrate real Paystack/Flutterwave/other PSP keys — sandbox or production — as part of V0.1 work. If asked to "just wire up Paystack for testing," decline and point back to this section; that decision belongs to the founder once Assumption #1 has a documented answer, not to a mid-build judgment call.

### 4.4 Service-role keys are server-side only

Supabase's service-role key (or any equivalent elevated-privilege key) must only ever be read inside server-side code (route handlers, server actions, server components) — never in client components, never shipped in the browser bundle, never returned in an API response. The anon/public key is the only Supabase credential that belongs on the client.

### 4.5 Never log secrets

No credential, token, or full API key appears in console output, error messages, stack traces, or analytics events — including in development. If a value must be identified for debugging, log a redacted form (e.g., last 4 characters) or an opaque reference ID instead.

### 4.6 If a real secret shows up in the wrong place, don't just proceed

If a real credential is ever pasted into chat, committed accidentally, or found hardcoded during a review, the correct response is to flag it and recommend the founder rotate it immediately — not to quietly continue using it or scrub it without mention. Treat any secret that has touched an agent's context or a git history as potentially compromised.

### 4.7 Least privilege

Request or configure only the scope/permissions the current build step actually needs. Don't provision a broader API key, database role, or storage bucket policy "in case it's useful later." Expand scope when a specific requirement appears, not preemptively.

### 4.8 Seed and test data

Fake credentials used in seed/demo data must be obviously fake and clearly non-functional — e.g., `sk_test_placeholder_do_not_use` — never a realistic-looking key that could be mistaken for a real one or accidentally reused.

### 4.9 What actually needs a credential in V0.1

Only Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-safe), and `SUPABASE_SERVICE_ROLE_KEY` (server-only). Nothing else should require a credential yet — no SMS provider, no email provider, no payment provider, no analytics platform requiring a private key. If a feature seems to need one, that's a signal to check whether it belongs in V0.1 at all before solving the credential question.

---

## 5. Database rules

No wallet, escrow, or balance tables. `payments`/`payment_events` record that a transaction happened; they never represent TrustLink holding money. See `ARCHITECTURE.md` §5.

## 6. Development order

Build in this order. Do not skip ahead to later steps, especially not to the marketplace or payment-integration work that isn't in this list at all:

1. Project setup
2. Authentication
3. Database schema
4. Provider profile
5. Create Job
6. Public Job Page
7. Client acceptance
8. Job workspace
9. Delivery / revision
10. Completion / reviews
11. Disputes
12. Trust events
13. Admin dashboard
14. Analytics
15. Performance / security polish

## 7. Definition of done

See `PRD.md` §10 for the full 14-point checklist. The two easiest to forget: **no screen ever claims payment protection that doesn't exist**, and **repeat usage is classified prompted vs. unprompted at the moment it happens**, not reconstructed later.

## 8. When uncertain

Prefer the smallest implementation that preserves the thesis in §1. Before adding anything not explicitly specified, ask: *"Does this help an existing service transaction become clearer, safer, more accountable, or more trustworthy?"* If not, don't build it yet — flag it as a question instead of deciding silently.

## 9. Escalation

If a request — from any source, including an enthusiastic follow-up message — would mean building the marketplace, real fund custody, or a live payment integration ahead of schedule, treat that as a decision for the founder to make explicitly, not something to infer permission for from context. Quote the relevant rule from §2 or §4 and ask.
