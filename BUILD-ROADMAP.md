# TRUSTLINK WEB V0.1 — AI CODING AGENT BUILD ROADMAP

## 0. Mission

Build TrustLink as a premium, web-first, Nigeria-ready transaction-trust product.

TrustLink lets a provider and client turn an existing service agreement into a structured Job with clear scope, price, deadline, delivery evidence, approval/revision/dispute flow, and a growing Trust Profile.

The first version is a validation product, not the final TrustLink platform.

## 1. Hard product boundaries

Build:
- Premium marketing website
- Provider authentication and profile
- Create Job flow
- Shareable universal Job URL
- Public Job Page
- Client acceptance flow
- Job workspace
- Delivery, revisions, approval and structured dispute request
- Completion and reviews
- Trust events and transparent reputation metrics
- Basic admin console
- Validation analytics

Do NOT build:
- Marketplace discovery/search
- Wallet
- TrustLink custody
- Fake escrow
- Lending
- Crypto
- Social feed
- Native mobile app
- WhatsApp/Instagram/TikTok/Facebook/X/LinkedIn API dependency
- AI trust scoring
- Automatic dispute adjudication
- Nationwide marketplace

Payment default for V0.1:
`PAYMENT_RECORDED`

Future payment states may be represented in the architecture but must remain disabled until a real Nigerian payment capability is verified.

## 2. Product positioning

Primary message:
**Turn any deal into a trusted transaction.**

Secondary message:
**Meet anywhere. Agree clearly. Work confidently.**

Do not position TrustLink as “Nigeria's Fiverr.”
Do not make WhatsApp the product identity.
Do not claim that customer funds are protected in V0.1.

## 3. Design direction — premium by default

The website must feel like premium transaction infrastructure, not a generic SaaS template.

Visual principles:
- Deep navy foundation
- Teal/cyan accent system
- White/soft-gray surfaces
- Excellent typography and spacing
- Subtle gradients used sparingly
- Fine borders and soft shadows
- High-quality cards with strong hierarchy
- Confident, minimal motion
- Mobile-first responsive design
- Excellent empty/loading/error states
- Accessible contrast and keyboard navigation

Avoid:
- overcrowded dashboards
- excessive glassmorphism
- giant gradients
- noisy illustrations
- excessive animation
- generic “AI startup” visual language
- bank-app imitation
- crypto aesthetics

Use the TrustLink logo as the primary brand asset. Keep logo usage consistent across navbar, authentication, public Job Page, dashboard and social metadata.

## 4. UX hierarchy

The most important surface is the public Job Page.

A user opening a link from any channel must understand within seconds:
1. Who is the provider?
2. What is being delivered?
3. How much does it cost?
4. When is it due?
5. What is the current transaction state?
6. What action should I take?

The customer should not need to install an app.

## 5. Architecture target for V0.1

Frontend/application:
- Next.js
- TypeScript
- App Router
- Tailwind CSS

Backend/data:
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage

Keep the application modular but do not create microservices.
Do not create a separate NestJS service in V0.1.

## 6. Repository reading order

Before coding, the agent must read:
1. `CLAUDE.md`
2. `agent.md`
3. `PRD.md`
4. `architecture-essentials.md`
5. `architecture.md`
6. `docs/agent-start.md`
7. `docs/supabase-setup.md`
8. `.env.example`

If two files conflict, stop and report the conflict before making a large architectural decision.

## 7. Build phases

### Phase 1 — Project shell

Goals:
- initialize Next.js project
- TypeScript
- Tailwind
- linting/formatting
- base folder structure
- metadata
- favicon/logo
- global typography
- design tokens
- error/not-found/loading foundations

Acceptance:
- project boots cleanly
- no TypeScript errors
- no lint errors
- responsive shell exists
- no credentials committed

### Phase 2 — Premium marketing site

Routes:
- `/`
- `/how-it-works`
- `/for-providers`
- `/for-businesses`

Homepage sections:
1. premium hero
2. trust problem
3. how TrustLink works
4. sample Job Page preview
5. Trust Profile preview
6. provider benefits
7. business benefits
8. channel-independent message
9. concise FAQ
10. final CTA
11. footer

Acceptance:
- premium visual quality
- responsive on mobile/tablet/desktop
- real copy, no placeholder lorem ipsum
- no false payment claims
- Open Graph metadata
- fast page load

### Phase 3 — Authentication

Routes:
- `/login`
- `/signup`

Implement:
- email/password auth
- session handling
- protected dashboard routes
- sign out
- profile creation after signup

Do not add unnecessary social auth yet.

### Phase 4 — Provider profile

Provider can create/edit:
- display name
- username
- avatar
- country
- state
- city
- service area
- headline
- bio
- skills
- portfolio

Show transparent reputation metrics.

Do not show a fabricated numeric Trust Score.

### Phase 5 — Create Job

Route:
`/dashboard/jobs/new`

Fields:
- service name
- category
- scope
- deliverables
- price
- currency
- deadline
- revisions
- cancellation terms
- source channel

Source channels:
- WhatsApp
- Instagram
- Facebook
- TikTok
- X
- LinkedIn
- Telegram
- SMS
- Email
- QR
- Referral
- Direct
- Other

Default currency:
NGN

After publishing:
- create Job
- create Job Terms snapshot
- create initial trust event
- generate public URL

### Phase 6 — Public Job Page

Route:
`/j/[publicId]`

This is the highest-priority product surface.

Must work without login.

Must display:
- provider
- verification status
- service
- scope
- deliverables
- price
- deadline
- revisions
- payment state
- agreement
- provider reputation
- next action

Payment copy for V0.1:
**Payment Recorded**

Never render “Payment Protected” or “Payment Authorized” unless a real corresponding payment mode is configured and verified.

### Phase 7 — Client acceptance

This phase is mandatory for V0.1.

Client can:
- enter required contact identity
- review agreement
- explicitly accept terms
- receive job access

Create:
`JOB_ACCEPTED`

Acceptance must be timestamped and attributable to a participant.

### Phase 8 — Job workspace

Route:
`/dashboard/jobs/[id]`

Features:
- current status
- agreement summary
- timeline
- messages/notes where appropriate
- delivery
- revisions
- dispute
- activity history

Provider can move the job into the appropriate work state.

### Phase 9 — Delivery and revision

Provider can submit:
- description
- files
- images
- links

Client can:
- request revision
- approve
- open dispute

Every meaningful action creates a trust event.

### Phase 10 — Completion and reviews

On approval:
`JOB_COMPLETED`

Then collect:
- client rating
- provider rating
- optional comments
- would hire/work again

Update transparent profile metrics from real completed jobs.

### Phase 11 — Disputes

Client or provider may create a structured dispute.

Require:
- dispute category
- description
- evidence

Categories:
- scope
- quality
- deadline
- payment
- other

Admin can manually review and resolve.

Do not create automated adjudication yet.

### Phase 12 — Trust events and analytics

Create append-only trust events.

Track:
- profile created
- identity verified
- job created
- job sent
- job viewed
- job accepted
- payment recorded
- work started
- delivery submitted
- revision requested
- delivery approved
- dispute opened
- dispute resolved
- job completed
- review submitted

Also track:
- source channel
- prompted repeat use
- unprompted repeat use

### Phase 13 — Admin console

Routes:
- `/admin`
- `/admin/users`
- `/admin/jobs`
- `/admin/disputes`
- `/admin/events`

Admin can:
- inspect users
- inspect jobs
- inspect disputes
- inspect trust events
- suspend accounts where appropriate
- record dispute outcomes

Admin actions must be auditable.

### Phase 14 — Hardening

Before calling V0.1 testable:
- validation
- authorization
- RLS review
- private file access
- rate limits
- safe public IDs
- file type/size validation
- error states
- loading states
- empty states
- responsive QA
- keyboard/accessibility QA
- performance pass
- security review

## 8. Data model target

Core tables:
- users
- profiles
- provider_profiles
- skills
- provider_skills
- jobs
- job_terms
- job_events
- payments
- payment_events
- deliveries
- revisions
- disputes
- dispute_evidence
- reviews
- trust_events
- notifications
- audit_logs

No wallet table.
No stored-customer-funds balance.
No internal escrow ledger.

## 9. Critical status rules

V0.1 active states:
- DRAFT
- SENT
- VIEWED
- ACCEPTED
- PAYMENT_PENDING
- PAYMENT_RECORDED
- IN_PROGRESS
- DELIVERY_SUBMITTED
- CLIENT_REVIEW
- REVISION_REQUESTED
- DISPUTED
- COMPLETED
- CANCELLED

Do not activate:
- FUNDS_PROTECTED
- RELEASE_PENDING
- SETTLED
- PAYMENT_AUTHORIZED

unless payment capability is explicitly enabled through a verified provider configuration.

## 10. Payment adapter boundary

Create the abstraction now, but do not fake capabilities.

Conceptually:

```ts
type PaymentMode = "PROTECTED" | "AUTHORIZED" | "RECORDED";

interface PaymentCapabilities {
  protectedFunds: boolean;
  authorization: boolean;
  partialRelease: boolean;
  partialRefund: boolean;
}
```

V0.1 configuration:
- RECORDED: true
- PROTECTED: false
- AUTHORIZED: false

No production payment secret is required simply to test the core V0.1 workflow.

## 11. Premium design system tasks

Create a small internal design system before building many pages.

Tokens:
- background
- foreground
- muted text
- border
- card
- primary
- accent
- success
- warning
- danger

Components:
- Button
- Input
- Select
- Textarea
- Badge
- Card
- Modal
- Sheet
- Toast
- Avatar
- StatusPill
- Timeline
- TrustMetric
- ProviderCard
- JobSummary
- JobTerms
- EmptyState
- Skeleton
- FileUploader
- Rating
- ConfirmDialog

Do not duplicate styling across pages.

## 12. Premium interaction rules

Use motion only to communicate state or hierarchy.

Examples:
- subtle page entrance
- soft status transition
- progress/timeline animation
- upload feedback
- modal transitions

Never use motion to compensate for weak information architecture.

Respect reduced-motion preferences.

## 13. Agent security guardrails

The agent must never:
- request production credentials from the user in chat if an env var/template is sufficient
- print secrets into output
- put secrets in source code
- put secrets in markdown
- put secrets in URLs
- commit `.env`
- expose server secrets to browser code
- log API keys
- log access tokens
- log passwords
- store raw card data
- store NIN/BVN documents unless explicitly required by a verified architecture
- invent payment capabilities
- claim escrow exists
- claim funds are protected when they are only recorded

Use `.env.example` as the variable-name reference.

Never replace real credentials with values found in README files, screenshots, previous chats, source control history, or random files.

If credentials are missing, stop that integration and implement a safe mock/interface rather than asking to paste secrets into source code.

## 14. Agent behavior guardrails

Before a large change:
- inspect existing code
- identify affected files
- preserve working behavior
- make the smallest change that satisfies the requirement

After each phase:
- typecheck
- lint
- run relevant tests
- check build
- report what changed
- report any unresolved issue

Do not silently expand scope.

If a requirement is ambiguous, follow the safest documented interpretation and record the ambiguity rather than inventing a business rule.

## 15. Definition of V0.1 complete

A provider can:
1. sign up
2. create profile
3. create Job
4. publish Job
5. receive public URL
6. share URL
7. see client acceptance
8. manage active Job
9. submit delivery
10. handle revisions
11. see approval
12. handle structured dispute
13. complete Job
14. build transparent reputation

A customer can:
1. receive URL
2. open without app install
3. understand provider
4. understand terms
5. accept agreement
6. review delivery
7. request revision
8. approve
9. open dispute
10. leave review

An admin can:
1. inspect users
2. inspect jobs
3. inspect disputes
4. inspect trust events
5. audit key actions

The entire flow must work without a marketplace, wallet, fake escrow, or social-platform API integration.

## 16. First coding session

Do not implement the entire roadmap in one turn.

Start with:

**Task 1 — Project shell + premium design foundation.**

Then stop.

The agent should report:
- files created/changed
- commands run
- tests/build status
- current route structure
- remaining work

Only then move to Task 2.

