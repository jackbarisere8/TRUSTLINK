# TRUSTLINK

## PSP / Payment-Partner Due-Diligence Interview — v2

### Assumption #1 Validation Document

**Purpose:** Determine whether TrustLink can implement a legally, commercially and technically viable payment model in Nigeria.

**Product context:** TrustLink converts informal service agreements into structured transactions. A customer and provider agree on scope, price and delivery terms. TrustLink coordinates the transaction, evidence, approval and reputation.

**Critical constraint:** TrustLink does not want to become the custodian of customer funds merely to create the product.

---

## What changed in v2

Two corrections, both found by checking primary sources directly rather than relying on documentation summaries:

1. **Paystack's card preauthorization is restricted to South African businesses only.** Its own documentation states this explicitly, and every example uses ZAR and South African banks. It is not currently available to a Nigerian business in Naira. Any claim in v1 that this confirms a Mode B path for TrustLink has been removed. The underlying question — does *any* NGN-capable authorize/capture mechanism exist, at Paystack, Flutterwave, or elsewhere — remains open and is still worth asking directly.

2. **The CBN fined Paystack ₦250 million in April–May 2025** for operating its consumer product Zap as a digital wallet. The finding: Paystack holds a *switching and processing licence*, which permits routing transactions but does not permit holding customer funds — that requires a microfinance or full banking licence. Paystack had structured Zap in partnership with a licensed bank specifically to handle the deposit-taking piece, and the CBN still fined them. This is now direct, recent evidence that "protected funds" style products likely require the payment partner to hold licensing beyond a standard PSP licence. It's been added as its own line of questioning below (Section G) and as a named red flag (Section 28).

Everything else in v1 held up and is unchanged.

---

## 1. The three payment models under evaluation

### MODEL A — Protected funds

```text
Customer pays
      ↓
Funds remain protected
      ↓
Provider performs work
      ↓
Customer approves
      ↓
Funds released
```

TrustLink wants to know whether a licensed payment partner — or a partner working alongside a separately licensed deposit-taking institution — can provide this structure for Nigerian transactions.

### MODEL B — Authorization / capture

```text
Customer authorizes payment
      ↓
Amount is held/authorized
      ↓
Provider performs work
      ↓
Customer approves
      ↓
Payment captured
```

Whether a genuine, NGN-capable version of this exists at any given PSP is unconfirmed and must be asked about directly, per payment rail, in this interview. Do not assume it exists because a similar-sounding product exists elsewhere in that PSP's documentation.

### MODEL C — No-custody

```text
Agreement
      ↓
Customer pays provider
      ↓
TrustLink records transaction
      ↓
Work
      ↓
Delivery
      ↓
Completion
      ↓
Reputation
```

This can operate without TrustLink or its payment partner controlling customer funds at all, and should be treated as the realistic working default until Model A or B is independently confirmed.

---

## 2. The primary question

Do not begin the meeting by asking:

> "Does your API support escrow?"

Instead ask:

> **"Can your infrastructure support the actual TrustLink transaction lifecycle — payment commitment, provider execution, customer approval, disputes, refunds and settlement — without TrustLink or your platform taking custody of customer funds outside what your licence permits?"**

That framing surfaces the licensing question immediately instead of five questions later.

---

## 3. Section A — Current product capability

1. What payment products do you currently offer that could support a two-sided marketplace or service transaction?
2. Which of those products are currently available to new Nigerian businesses, specifically — not available in other markets you operate in?
3. Which are production-ready rather than beta, legacy, regionally restricted, or private/closed products?
4. Which payment methods are supported? (Cards / bank transfer / USSD / direct debit / mobile wallets / other local rails)
5. Which payment methods support authorization or delayed capture, **for Nigerian merchants in NGN specifically**?
6. Which support funds being held before settlement?
7. Which support platform-controlled release?
8. Which support customer approval before release?
9. Which support dispute-triggered suspension?
10. Which support partial release?
11. Which support partial refund?

---

## 4. Section B — Exact Mode A question

Ask this exactly:

> **"Can you support a production transaction where the customer's payment is received, the service provider is not yet paid, and the provider's eventual settlement is conditional on a defined event such as customer approval or an agreed dispute-resolution outcome?"**

### If YES:

12. Who controls the funds during this period?
13. Where are the funds held?
14. Is the arrangement considered escrow?
15. Is it legally characterized as escrow, safeguarded funds, deferred settlement, marketplace settlement, or something else?
16. Who has authority to release the funds?
17. Can the platform trigger release?
18. Can the customer trigger release?
19. Can the payment provider trigger release?
20. What happens when the customer raises a dispute?
21. Does the dispute automatically prevent release?
22. Can both parties agree to release?
23. Can partial release occur?
24. Can the remaining amount stay protected?

---

## 5. Section C — If they say "we support escrow"

Do not stop at the word "escrow." Ask:

> **"Can you show us the current production product or documentation for the exact flow, confirmed for a Nigerian, NGN-denominated business?"**

25. What is the product name?
26. Is it currently offered to new Nigerian merchants — check for a feature-availability notice restricting it by country?
27. What API version supports it?
28. What production endpoint is used?
29. What payment rails does it support?
30. What are the settlement states?
31. Who signs the commercial agreement?
32. What onboarding requirements apply?
33. Can we test the exact flow in sandbox?
34. Can we test the exact flow in production with a small amount?
35. Is there a current account manager/product specialist we can work with?
36. Can you provide written confirmation of the supported flow, specific to Nigeria?

---

## 6. Section D — Authorize / capture (revised)

**This section no longer treats any specific product as confirmed.** Ask the following as genuinely open questions rather than a checklist to confirm something already assumed to exist:

37. Do you offer any hold/authorization mechanism — under any product name — available to Nigerian merchants transacting in NGN?
38. If yes: which payment methods does it cover? Is it card-only, or does it extend to bank transfer or USSD?
39. Is it available to new businesses, or restricted to specific account tiers, partners, or regions?
40. What is the maximum authorization/hold period, and can it be extended?
41. What happens when the authorization expires — automatic capture, automatic release, or something else?
42. Can the platform capture the full amount? A smaller amount?
43. Can the platform release the full amount? A partial amount?
44. What happens if the customer disputes before capture?
45. What happens if the provider fails to deliver?
46. What happens if the customer disappears?
47. If no card-based mechanism exists for Nigeria: is there any equivalent for bank transfer or USSD?
48. If nothing like this currently exists for Nigerian merchants: is it on your roadmap, and is there a realistic timeline?

**Do not treat a "yes" here as confirmed until you have Section 22's written documentation and a working sandbox test.** A verbal "yes, we support that" from a sales contact is the weakest form of evidence on the hierarchy below — confirm with actual current documentation and, ideally, a live test.

---

## 7. Section E — Payment rail matrix

Ask the PSP to help complete this table.

| Capability           | Card | Bank Transfer | USSD | Other |
| --------------------- | ---- | -------------- | ---- | ----- |
| Immediate payment     |      |                |      |       |
| Preauthorization      |      |                |      |       |
| Deferred capture      |      |                |      |       |
| Protected funds       |      |                |      |       |
| Platform release      |      |                |      |       |
| Customer approval     |      |                |      |       |
| Dispute freeze        |      |                |      |       |
| Partial release       |      |                |      |       |
| Partial refund        |      |                |      |       |
| Automatic settlement  |      |                |      |       |

This table is extremely important. A provider might say "yes, we support preauthorization" while only meaning it for one country or one payment rail. TrustLink needs the experience **per payment rail, per country**.

---

## 8. Section F — Split payments

Split/multi-split settlement products are commonly documented and commonly misread as escrow. They are not the same thing. Ask:

53. How does split settlement work?
54. When does settlement occur?
55. Can the platform control *when* the provider receives their share, or only *how much*?
56. Can settlement be delayed?
57. Can a split be changed after payment?
58. Can the platform reverse a settlement?
59. Can a dispute prevent settlement?
60. Can a transaction split be used across multiple vendors?
61. Can the platform collect a fee while the provider receives the remainder?
62. What happens when a transaction is refunded?

Ask the provider to explain, in their own words, the difference between split settlement and escrow. Their answer tells you a lot about how carefully they've thought about the distinction themselves.

---

## 9. Section G — Custody and legal responsibility

This is the most important section in the interview.

63. If funds remain unsettled after the customer's payment, who legally controls them?
64. Who is legally responsible for those funds?
65. Does TrustLink, or your platform, ever take possession or custody?
66. Is the payment provider acting purely as an intermediary, or does any part of this arrangement resemble deposit-taking?
67. Does TrustLink require a special regulatory authorization for the model we've described?
68. Does the arrangement change if TrustLink determines when payment is released?
69. Does the arrangement change if TrustLink adjudicates a dispute?
70. Would you require a different legal agreement because TrustLink coordinates the release?
71. Is there any regulatory distinction between: ordinary payment collection; marketplace settlement; safeguarded funds; escrow; deferred settlement; payment authorization?
72. What would your compliance team require TrustLink to disclose to users?

### 73. The direct licensing question — ask this one explicitly

> **"In 2025 the CBN fined Paystack for operating a wallet-like product outside the scope of its switching-and-processing licence, on the grounds that holding customer funds requires a microfinance or banking licence. Under what specific licence would your organization's support for TrustLink's proposed model be structured, and does that licence explicitly cover holding funds pending a release condition?"**

Do not accept a vague answer to this question. If the person you're speaking with doesn't know their own institution's licence category, or deflects, that itself is information — escalate to someone in compliance or legal before proceeding further with that partner.

74. Has your organization, or any product you currently offer, been subject to CBN scrutiny or sanction related to fund custody or wallet-like functionality?
75. If your model relies on a partnership with a separately licensed bank or microfinance institution to hold funds (the way Paystack's Zap relied on Titan Trust Bank), can you name that partner and confirm the licence covers this specific use case?

---

## 10. Section H — TrustLink's role

Describe this proposed architecture:

```text
Customer
    ↓
Payment Provider
    ↓
TrustLink transaction state
    ↓
Provider
```

76. Which activities can TrustLink perform?
77. Can TrustLink define the job terms?
78. Can TrustLink receive payment status?
79. Can TrustLink submit a release request?
80. Can TrustLink submit a refund request?
81. Can TrustLink freeze a transaction during a dispute?
82. Can TrustLink decide a dispute? If not, who can?
83. Can TrustLink maintain the transaction record while the PSP maintains the funds?

---

## 11. Section I — Disputes

84. What happens when the customer says the service was not delivered?
85. What happens when the provider says the customer changed the agreed scope?
86. Can funds remain unresolved during a dispute?
87. Who controls the amount during the dispute?
88. Is there a dispute window?
89. Can the platform provide evidence?
90. What evidence format is accepted — screenshots, uploaded files, timestamps, the original agreement?
91. Can a dispute result in a partial settlement?
92. Who makes the final financial decision?
93. What is the typical resolution timeline?

---

## 12. Section J — Refunds

94. Can a customer request a refund? Can the platform initiate it? Can the provider?
95. Can a partial refund occur?
96. Can refunds happen after provider settlement?
97. What happens if there is insufficient balance for a refund?
98. What happens when there is a chargeback? Who absorbs the cost?

---

## 13. Section K — Chargebacks and fraud

99. Who carries chargeback liability?
100. What happens when the customer claims the transaction was unauthorized?
101. Does the provider lose the funds?
102. Does TrustLink bear any liability?
103. What fraud controls are available?
104. Can TrustLink receive fraud signals?
105. Can suspicious transactions be blocked or delayed for risk review?

---

## 14. Section L — KYC

106. What KYC is required from TrustLink, from providers, and from customers respectively?
107. Can individuals use the system, or only registered businesses?
108. What documents are required?
109. Can KYC be performed through your existing infrastructure?
110. Can TrustLink receive only a verification result rather than the underlying identity documents?
111. How long are KYC records retained, and who is responsible for storing them?

---

## 15. Section M — Data and privacy

112. What customer data does the payment provider receive? What provider data?
113. What data can TrustLink legally retain? What can be shared with TrustLink?
114. What are the retention requirements?
115. Can TrustLink avoid storing raw card data?
116. Who is the data controller/processor for each part of the transaction?
117. What privacy documentation is required? What security standards apply to TrustLink?

---

## 16. Section N — Webhooks and technical events

118. What webhooks are available? Which events indicate: payment initiated, payment successful, payment failed, authorization created, authorization expired, authorization captured, authorization released, refund initiated, refund completed, dispute opened, chargeback created?
119. Are webhooks signed? How are signatures verified?
120. Can events arrive more than once? Out of order?
121. Is there an event ID?
122. Is there a way to retrieve the authoritative transaction state through the API, independent of webhook delivery?
123. Can TrustLink safely reconcile its own state against your system?

---

## 17. Section O — Idempotency and reconciliation

124. How should we prevent duplicate capture/release calls?
125. Do your APIs support idempotency keys?
126. What happens if TrustLink's request times out, or succeeds but the response is lost?
127. How should we reconcile daily transactions? Is there a downloadable settlement report?
128. Can transaction states be queried individually?

---

## 18. Section P — Commercial terms

129. Transaction fee? Platform fee? Marketplace fee?
130. Fee for protected funds, authorization, capture, or refunds specifically?
131. Chargeback fee? Dispute fee? KYC fee?
132. Minimum monthly volume? Reserve requirements?
133. Are settlement cycles configurable?

---

## 19. Section Q — Scale

134. Can this architecture support 1,000 transactions/month? 10,000? 100,000?
135. Are there transaction, daily, or account limits?
136. Are there geographic, industry, or transaction-size restrictions?

---

## 20. Section R — Marketplace requirements

Tell the PSP:

> "TrustLink may eventually become a marketplace, but the initial product is transaction infrastructure."

137. Does our current model require marketplace onboarding?
138. Would marketplace status change your KYC requirements or settlement behavior?
139. Would the product require a different contract?
140. Would providers need individual subaccounts?
141. Could TrustLink onboard providers programmatically?

---

## 21. Section S — Live pilot

142. Can we run a live pilot with 10–30 providers?
143. Can we process low-value transactions, and test refunds, disputes, failed payments and expired authorizations specifically?
144. Can we get technical support during the pilot, and a named relationship manager?
145. Can we get written confirmation of the pilot architecture?

---

## 22. Request these documents

Before considering Assumption #1 validated, request:

- **Product documentation** — current production documentation for the relevant payment mechanism, confirmed as applicable to Nigeria/NGN
- **API documentation** — current version, not legacy
- **Commercial documentation** — current pricing and settlement terms
- **Compliance requirements** — TrustLink's onboarding requirements
- **KYC requirements** — for providers and customers
- **Dispute documentation** — the actual dispute process
- **Settlement documentation** — when and how funds move
- **Written product confirmation** — a current business/product/compliance contact confirming, in writing, that the proposed flow is supported for a Nigerian business

---

## 23. The critical distinction

Never accept these statements as equivalent:

> "We support split payments." / "We support marketplace payments." / "We support delayed settlement." / "We support authorization." / "We support escrow."

They are different capabilities, and — as the South Africa-only preauthorization case shows — a real, currently-documented capability can still be entirely unavailable in your market. The founder must ask:

> **Which exact state transitions does your system support, for Nigerian merchants, in NGN, today?**

---

## 24. TrustLink state-machine mapping

Give the PSP this proposed flow:

```text
JOB_CREATED
     ↓
AGREED
     ↓
PAYMENT_PENDING
     ↓
PAYMENT_COMMITTED
     ↓
WORK_STARTED
     ↓
DELIVERY_SUBMITTED
     ↓
CLIENT_REVIEW
     ↓
APPROVED
     ↓
SETTLEMENT
     ↓
COMPLETED
```

Then ask:

> **"Which of these states can your payment system guarantee, and which must TrustLink manage itself?"**

---

## 25. Payment capability matrix

Complete this after the call.

| Capability                   | Supported? | Payment rail | Nigeria-confirmed? | Conditions | Evidence |
| ----------------------------- | ---------- | ------------- | ------------------- | ---------- | -------- |
| Payment collection            |            |               |                      |            |          |
| Protected funds                |            |               |                      |            |          |
| Authorization/hold             |            |               |                      |            |          |
| Capture                        |            |               |                      |            |          |
| Release                        |            |               |                      |            |          |
| Partial capture                |            |               |                      |            |          |
| Partial release                |            |               |                      |            |          |
| Refund                         |            |               |                      |            |          |
| Partial refund                 |            |               |                      |            |          |
| Dispute freeze                 |            |               |                      |            |          |
| Platform-triggered release     |            |               |                      |            |          |
| Customer-triggered release     |            |               |                      |            |          |
| Provider settlement            |            |               |                      |            |          |
| Split settlement                |            |               |                      |            |          |
| Webhooks                       |            |               |                      |            |          |
| Reconciliation                 |            |               |                      |            |          |

*(The "Nigeria-confirmed?" column is new in v2 — a capability that exists elsewhere in the PSP's business doesn't count until it's confirmed for this market specifically.)*

---

## 26. PSP decision scorecard

Score each candidate.

**Product capability:** 0 = impossible · 1 = workaround · 2 = supported with restrictions · 3 = directly supported

**Nigerian availability:** 0 = unavailable · 1 = unclear · 2 = available with restrictions · 3 = clearly available and confirmed for NGN

**Payment-rail coverage:** 0 = one weak rail · 1 = card only · 2 = multiple rails · 3 = strong local coverage

**Dispute support:** 0 = none · 1 = manual · 2 = structured · 3 = structured + scalable

**Compliance clarity:** 0 = unclear · 1 = significant uncertainty · 2 = mostly clear · 3 = clearly documented, licence explicitly named

**Technical quality:** 0 = unsuitable · 1 = difficult · 2 = workable · 3 = strong API/webhook support

**Economics:** 0 = impossible · 1 = expensive · 2 = acceptable · 3 = attractive

**Partnership:** 0 = no support · 1 = generic support · 2 = assigned contact · 3 = active partner relationship

**Maximum: 24**

---

## 27. Decision thresholds

**GREEN — Proceed (19–24):** no critical legal blocker; exact payment flow confirmed for Nigeria; relevant payment rail is production available; commercial relationship feasible; specific licence named and understood.

**AMBER — Conditional (13–18):** the product may be viable, but one or more major constraints remain. Consider a limited pilot while resolving the open issue.

**RED — Stop this payment path (0–12), or any critical legal/compliance blocker regardless of score.** Do not build the payment architecture around it.

---

## 28. Critical red flags

Immediately escalate if the PSP says any of the following:

> "We aren't sure whether this is allowed."

> "You can just hold the money in your own account."

> "Use split payments; it should be basically the same as escrow."

> "The old documentation may still work."

> "We'll figure out settlement later."

> "The customer can pay you and you can manually refund them."

> "You don't need to worry about disputes yet."

> **"We can hold the funds for you"** — without being able to name the specific licence that permits it. (This is the exact structure the CBN fined Paystack ₦250m for in 2025. Treat any fund-holding claim without a named, confirmed licence as unverified, not reassuring.)

> A capability confirmed by pointing to documentation without checking whether it's geographically or currency-restricted. (Confirmed by direct experience — Paystack's card preauthorization page reads as generally available at a glance and is in fact South Africa-only.)

---

## 29. The three possible outcomes (revised)

### Outcome A
Protected funds are genuinely available through a partner who can name the specific licence covering it — either their own, or a named, confirmed banking/microfinance partner. TrustLink can design `FUNDS_PROTECTED` with evidence.

### Outcome B
No protected-funds product is available, but a genuine NGN-capable authorization/capture mechanism is confirmed — in writing, for Nigeria specifically, not inferred from a similar product in another market. TrustLink supports `PAYMENT_AUTHORIZED` for the confirmed payment methods only. This has not yet been confirmed for any specific PSP as of this writing and should be treated as unresolved until a partner interview produces it.

### Outcome C
Neither protected funds nor confirmed authorization is available. TrustLink starts with `PAYMENT_RECORDED` and focuses on agreement, evidence, accountability and reputation, while continuing to monitor the payment landscape for future options. Given what's currently confirmed, **this is the outcome to plan around by default**, with A or B as upside if the PSP conversations produce stronger evidence than currently exists.

---

## 30. Final rule

The founder should never ask:

> "Which payment provider should we use?"

until after asking:

> **"Which transaction behavior do we need?"**

Then:

> **"Which regulated partner can actually provide that behavior, under what specific licence, confirmed for Nigeria?"**

Then:

> **"Under what legal, commercial and technical conditions?"**

Only then:

> **"Which API should we integrate?"**

---

## 31. Assumption #1 status — recording template

At the end of each PSP conversation, record:

```text
Provider:
Date:
Contact:
Product discussed:
Payment rails covered:
Confirmed available in Nigeria (Y/N):
Specific licence named:
Legal/compliance status:
Production availability:
Technical availability:
Commercial viability:
Written confirmation obtained (Y/N):
Zap-precedent question asked and answered clearly (Y/N):
Final decision: GO / CONDITIONAL / NO-GO
```

---

## 32. Founder's final test

Before writing `FUNDS_PROTECTED` into production code, the answer to all four questions must be clear:

> **Who controls the money, under what specific licence?**

> **When can it be released?**

> **What happens during a dispute?**

> **Which exact payment methods, confirmed for Nigeria, support the behavior?**

If any answer is unclear — including "the documentation says yes but nobody has confirmed it's available in Nigeria" — **the state remains unresolved.** That is better than building the wrong financial architecture, or building toward a licence the partner doesn't actually have.
