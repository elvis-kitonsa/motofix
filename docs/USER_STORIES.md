# MOTOFIX — User Stories

**System:** MOTOFIX, a Smart Vehicle Breakdown Response System (SVBRS) connecting stranded
drivers in Kampala with verified mechanics and towing providers.

**How to read this document**

- Stories follow the form: *As a **[role]**, I want **[capability]**, so that **[benefit]**.*
- Each story has an **ID**, a **priority** (MoSCoW: **Must** / **Should** / **Could** / **Won't‑yet**),
  and, for the more complex ones, **acceptance criteria**.
- Roles (personas): **Driver**, **Provider** (mechanic / towing), **Administrator**, **System/AI**.

| Prefix | Area |
|---|---|
| `US-D-*` | Driver app |
| `US-P-*` | Provider (mechanic / towing) app |
| `US-A-*` | Administrator portal |
| `US-S-*` | Cross‑cutting (AI, real‑time, security, resilience) |

---

## 1. Personas

- **Driver (Customer)** — a motorist who has broken down and needs help fast; price‑sensitive,
  often stressed, may have a low‑end phone and patchy data.
- **Mechanic / Towing Provider** — an informal‑sector tradesperson who earns by accepting jobs;
  often has oily/tired hands on the job and wants minimal typing.
- **Administrator** — MOTOFIX staff who verify providers, keep the platform trustworthy, and
  monitor operations and revenue.
- **System / AI** — the platform itself: AI diagnosis, matching, real‑time events, and safeguards.

---

## 2. Driver Stories

### 2.1 Registration & Identity

**US-D-01 — Passwordless sign‑up** *(Must)*
As a new driver, I want to sign up with just my name, phone number and vehicle number plate and
verify with an SMS code, so that I can get help quickly without remembering a password.
*Acceptance:*
- Phone is normalised to Ugandan `+256` format; rejected if not at least 9 digits.
- Full name must contain at least two words.
- Number plate is validated against recognised Ugandan plate formats.
- A 6‑digit OTP is sent; it expires after 5 minutes; resend is allowed after a 30‑second cooldown.
- The OTP is never returned in the API response.

**US-D-02 — Returning login** *(Must)*
As a returning driver, I want to log in with only my phone number and an SMS code, so that I can
re‑enter the app in seconds.

**US-D-03 — Deferred ID verification** *(Should)*
As a driver, I want to optionally add my National ID, so that I am verified, while still being able
to start using the app immediately and complete verification later.
*Acceptance:* the step is skippable; National ID is validated for minimum length; verification
becomes mandatory after the free‑request limit.

**US-D-04 — Verified badge** *(Could)*
As a verified driver, I want a verified badge beside my name, so that mechanics can trust I am a
genuine, vetted user; tapping it explains what verification means.

### 2.2 AI Diagnosis (MOTOBOT)

**US-D-05 — Describe my fault in plain language** *(Must)*
As a driver, I want to tell an AI assistant what is wrong in everyday words and get a likely
diagnosis, so that I understand my problem before help is sent.
*Acceptance:* returns fault category, severity (colour‑coded), recommended provider type, confidence,
and immediate safety actions.

**US-D-06 — Photo diagnosis** *(Should)*
As a driver, I want to upload a photo of the fault and have the AI assess it, so that the mechanic
arrives already knowing the problem.
*Acceptance:* image relevance is checked; non‑vehicle / mismatched photos are rejected with feedback.

**US-D-07 — Voice diagnosis** *(Should)*
As a driver, I want to describe the fault by voice note in any local language, so that I do not have
to type while stressed; the system transcribes it to English and diagnoses it.

**US-D-08 — Pre‑dispatch cost transparency** *(Should)*
As a driver, I want to see a typical price range (parts, labour, minor on‑site fee) for my fault
before a provider is sent, so that I know what a fair price looks like and avoid being overcharged.

**US-D-09 — Seamless chat‑to‑request** *(Could)*
As a driver, I want the diagnostic chat to turn directly into a service request once enough is known,
so that I do not repeat myself.

### 2.3 Requesting Help

**US-D-10 — Submit a breakdown request** *(Must)*
As a driver, I want to submit a request that captures my GPS location and fault, so that a nearby
provider can be dispatched to me.
*Acceptance:* location is captured with high accuracy; on permission denial it falls back to a default
Kampala coordinate that the driver can correct; the server rejects a blank location.

**US-D-11 — Choose service type** *(Must)*
As a driver, I want to choose mechanic, towing, or breakdown‑rescue, so that the right kind of help
is matched to me.

**US-D-12 — Breakdown‑rescue preferences** *(Should)*
As a driver in a breakdown, I want to say whether I want a fix on the spot and whether towing is
allowed (and to which garage), so that the responder knows the outcome I expect.

**US-D-13 — SOS emergency dispatch** *(Should)*
As a stranded driver in an emergency, I want a one‑tap SOS that dispatches the nearest responder,
so that I get help with no extra steps.

**US-D-14 — Re‑dispatch on no response** *(Must)*
As a driver, I want the system to offer to find the next provider if no one accepts in time, so that
I am never left waiting indefinitely.

### 2.4 Live Tracking & Communication

**US-D-15 — Track my provider live** *(Must)*
As a driver, I want to see my provider moving toward me on a map with both pins and a route, so that
I know help is really coming and how far away it is.
*Acceptance:* both the driver (blue) and provider (red) pins are visible; the route shrinks as the
provider approaches; ETA and distance are shown and match the provider's app.

**US-D-16 — Prominent ETA** *(Should)*
As a driver, I want the estimated time of arrival shown clearly above the arrival progress bar, so
that I can see at a glance how long until help arrives.

**US-D-17 — "Almost there" prompt** *(Could)*
As a driver, I want a prompt when the provider is very close asking if I can see them, so that I can
confirm and start the service.

**US-D-18 — In‑app chat** *(Must)*
As a driver, I want to chat with my assigned provider in the app, so that we can coordinate without
sharing personal numbers.

**US-D-19 — Reveal‑on‑demand call** *(Should)*
As a driver, I want to call my provider only when I choose, so that contact details stay private by
default; I can pick phone dialer or in‑app calling.

### 2.5 Completion, Billing & Payment

**US-D-20 — Confirm the work is done** *(Must)*
As a driver, I want to confirm the job is complete before anything is finalised, so that I am never
charged for work that was not done.

**US-D-21 — See an itemised bill** *(Must)*
As a driver, I want to see what was fixed and the total charge after I confirm completion, so that I
understand exactly what I am paying for.
*Acceptance:* the "What was done" list and total appear only at completion, before rating.

**US-D-22 — Proceed to pay** *(Must)*
As a driver, I want a clear "Proceed to Pay" button that lets me pay by Mobile Money or cash, so
that I can settle up in the way that suits me.
*Acceptance:* the pay option appears only after completion; cash always remains available; the
transaction is recorded either way.

**US-D-23 — Rate my provider** *(Must)*
As a driver, I want to rate and comment on my provider after the job, so that good providers are
rewarded and others are warned; the prompt is dismissible and reminds me once.

### 2.6 Supporting Services

**US-D-24 — Find spare parts** *(Should)*
As a driver, I want to browse parts by category with price guidance and order from a nearby dealer
(e.g. via WhatsApp), so that I can source what I need without driving around.

**US-D-25 — Insurance** *(Could)*
As a driver, I want to browse motor insurers, apply for cover, and submit a claim, so that I can
manage insurance from the same app.

**US-D-26 — Fuel advisor & stations** *(Could)*
As a driver, I want guidance on the correct fuel for my vehicle and a list of nearby fuel stations,
so that I refuel correctly and conveniently.

**US-D-27 — Maintenance reminders** *(Could)*
As a driver, I want due‑aware reminders (e.g. tyre pressure, weekly checks) with simple yes/not‑yet
answers, so that I keep my vehicle healthy between breakdowns.

**US-D-28 — Notifications inbox** *(Should)*
As a driver, I want all job and reminder alerts collected in one inbox with an unread badge, so that
I never miss a time‑sensitive update.

**US-D-29 — Fresh, friendly home messages** *(Could)*
As a driver, I want the home greeting to feel alive and change over time, so that the app feels
personal rather than static.

**US-D-30 — Contact support** *(Should)*
As a driver, I want a support screen with clear channels, so that I can get help with account,
location, payment, or safety issues.

---

## 3. Provider (Mechanic / Towing) Stories

### 3.1 Onboarding & Access

**US-P-01 — Apply to join** *(Must)*
As a mechanic or towing provider, I want to apply with my details, specialisations, and supporting
documents, so that I can be verified and start receiving jobs.
*Acceptance:* required fields adapt to individual vs registered business; documents (ID, work proof,
workplace photo) are uploaded; the application starts in `pending`.

**US-P-02 — Secure login + forced first‑login password change** *(Must)*
As a provider, I want to log in with my Service Provider Number and password and be forced to change
it on first login, so that my account is secure from the start.

**US-P-03 — No access until approved** *(Must)*
As the platform, I want unverified providers excluded from dispatch, so that only vetted providers
reach drivers.

**US-P-04 — Verified badge & profile** *(Should)*
As a verified provider, I want a verified badge and a public profile (rating, jobs done, garage), so
that drivers trust me when I am assigned.

### 3.2 Availability & Dispatch

**US-P-05 — Toggle availability** *(Must)*
As a provider, I want to set myself online/offline, so that I only receive jobs when I am ready to
work.

**US-P-06 — Receive matched job alerts** *(Must)*
As a provider, I want real‑time alerts for jobs near me with the fault, distance, ETA and an
indicative payout, plus a countdown to accept, so that I can decide quickly.
*Acceptance:* if the countdown lapses, the job auto‑passes to the next matched provider.

**US-P-07 — Capability‑correct matching** *(Should)*
As a provider, I want breakdown‑rescue jobs needing both repair and towing routed only to those who
can do both, so that I am not sent jobs I cannot complete.

**US-P-08 — One‑tap accept** *(Must)*
As a provider, I want to accept a job with a single tap, with the first acceptor winning, so that I
secure work without race conditions.

### 3.3 Job Workflow

**US-P-09 — Drive the journey** *(Must)*
As a provider, I want to mark "On the Way" and have arrival auto‑detected, so that the driver is
kept informed without me fiddling with the app while driving.

**US-P-10 — Navigation map** *(Must)*
As a provider, I want a map showing me and the driver with a route and live ETA, so that I can reach
them efficiently; the ETA matches what the driver sees.

**US-P-11 — Contact the driver in context** *(Should)*
As a provider, I want call / chat / navigate actions right beside the current job step, so that I can
reach the driver without hunting through the app.

**US-P-12 — Specific job‑progress wording** *(Could)*
As a provider, I want the progress steps to reflect the actual job (e.g. "Working on your flat tyre",
"Refuelling", "Towing"), so that the status is meaningful, not generic.

**US-P-13 — On‑site AI diagnostic tool** *(Could)*
As a provider, I want an AI diagnostic helper on arrival, so that I can confirm the fault and
suggested work.

**US-P-14 — Cancel safely with warnings** *(Should)*
As a provider, I want to cancel a job I cannot do (before work starts) with a reason and a clear
warning about strikes, so that I understand the consequences of pulling out.

### 3.4 Completion & Billing

**US-P-15 — Tick what I fixed (no typing)** *(Must)*
As a provider with oily, tired hands, I want to tick AI‑suggested fixes for this specific fault
instead of typing an essay, so that I can close the job quickly and accurately.
*Acceptance:* the fix options are generated for the actual fault; an optional free‑text box remains.

**US-P-16 — AI cost & transport estimate** *(Should)*
As a provider, I want an AI estimate of fair transport (boda for the distance I travelled), labour
and parts, so that I have a sensible reference when setting my charge.

**US-P-17 — Price reasonableness check** *(Should)*
As a provider, I want immediate feedback on whether my entered charge is within, above, or below the
typical range, so that I price fairly and know what the driver will see.

**US-P-18 — Notify driver of completion** *(Must)*
As a provider, I want to send the final charge and the fix summary to the driver for confirmation, so
that they can confirm and pay.

### 3.5 Platform Fees & Conduct

**US-P-19 — Pay per job, not a subscription** *(Must)*
As a provider, I want to owe a small flat platform fee only for jobs I actually complete, so that
joining is free and I pay in line with what I earn.
*Acceptance:* a flat fee accrues per completed job; the fee is the same regardless of the bill size.

**US-P-20 — See and settle my balance** *(Must)*
As a provider, I want to see my owed balance with the jobs it covers and settle it (with AI‑verified
MoMo or recorded payment), so that I stay in good standing.
*Acceptance:* a running balance and per‑job breakdown are shown; settlement clears the balance and
notifies the admin.

**US-P-21 — Fair gating, not instant lockout** *(Should)*
As a provider, I want to keep accepting jobs until I reach a cap of unpaid jobs (not be blocked after
a single one), so that my workflow is not disrupted by every small fee.
*Acceptance:* new‑job acceptance is blocked only once the unpaid‑job cap is reached; an overdue
balance can hard‑lock the account.

**US-P-22 — Reliability strikes & support‑mediated reinstatement** *(Should)*
As the platform, I want repeated pick‑up cancellations to trigger a temporary suspension that the
provider must resolve via support, so that unreliable providers do not damage driver trust.
*Acceptance:* warnings escalate per cancellation; suspension after the strike limit; reinstatement is
admin‑mediated and repeat offences escalate.

### 3.6 Performance

**US-P-23 — Performance & earnings summary** *(Should)*
As a provider, I want my rating, jobs today/this week, and earnings on my dashboard, so that I can
track my performance.

**US-P-24 — Read my reviews** *(Could)*
As a provider, I want to see drivers' ratings and comments, so that I can improve my service.

---

## 4. Administrator Stories

**US-A-01 — Secure admin access** *(Must)*
As an administrator, I want a secure login (no default guessable credential), so that platform
controls are protected.

**US-A-02 — Operations dashboard** *(Must)*
As an administrator, I want headline metrics (users, providers, requests, completion rate, revenue,
pending collections) with a revenue chart, so that I can see platform health at a glance.

**US-A-03 — Verify providers** *(Must)*
As an administrator, I want to review pending provider applications and approve or reject them with a
reason, so that only vetted providers operate; the outcome is sent by SMS.

**US-A-04 — Manage providers** *(Should)*
As an administrator, I want to create, edit, ban/unban and delete provider records, so that I can
keep the provider base accurate and safe.

**US-A-05 — Reinstate suspended mechanics** *(Should)*
As an administrator, I want to lift a cancellation suspension after the provider contacts support, so
that genuine providers can return, while repeat offenders are escalated.

**US-A-06 — Oversee platform fees** *(Should)*
As an administrator, I want to be notified when providers settle fees and to view owed balances, so
that I can monitor revenue and defaulters.

**US-A-07 — Maintain the spare‑parts catalog** *(Could)*
As an administrator, I want to maintain a fault‑keyed spare‑parts catalog, so that drivers and
providers get relevant parts information.

**US-A-08 — Live field map** *(Could)*
As an administrator, I want a live map of active drivers and providers, so that I have geographic
oversight of ongoing jobs.

**US-A-09 — Requests & payments oversight** *(Should)*
As an administrator, I want filterable lists of requests and payments with durations and statuses, so
that I can audit operations and finances.

**US-A-10 — Reviews oversight** *(Could)*
As an administrator, I want to see ratings and comments per provider, so that I can spot quality
issues.

**US-A-11 — Compliance & audit log** *(Should)*
As an administrator, I want significant actions logged and a compliance report available, so that the
platform meets the Uganda Data Protection and Privacy Act (2019) and can report to regulators.

---

## 5. Cross‑cutting / System Stories

**US-S-01 — Reliable real‑time updates** *(Must)*
As a user, I want status, location, chat and payment events delivered instantly over WebSockets, so
that all three apps stay in sync without manual refresh; dropped connections auto‑reconnect.

**US-S-02 — Graceful AI degradation** *(Must)*
As the platform, I want AI features to fall back to sensible defaults when the AI service is
unavailable, so that diagnosis, fix lists, estimates and greetings never block the core flow.

**US-S-03 — Push & SMS notifications** *(Should)*
As a user, I want job alerts and outcomes via push and SMS, so that I am reached even when the app is
not open.

**US-S-04 — Anti‑stall safeguards** *(Must)*
As the platform, I want unaccepted jobs re‑dispatched and stalled jobs auto‑completed by a watchdog,
so that neither party is stranded indefinitely.

**US-S-05 — Privacy by design** *(Must)*
As a user, I want my phone number hidden by default and only safe public fields shared, so that my
personal data is protected.

**US-S-06 — Secure sessions & access control** *(Must)*
As the platform, I want signed session tokens and role‑based access on every endpoint, so that each
user can only do what their role permits.

**US-S-07 — Input & upload safeguards** *(Should)*
As the platform, I want validation of phone numbers, plates, OTPs, required fields and file
type/size, so that bad or malicious input cannot reach the system.

**US-S-08 — Neutral, fair pricing posture** *(Should)*
As the platform, I want my revenue (a flat per‑job fee) to be independent of the bill size, so that I
have no incentive to inflate prices and can act as the driver's price‑transparency advocate.

**US-S-09 — Resilient deployment** *(Could)*
As an operator, I want health checks, a recovery script and idempotent startup, so that the platform
can be restored quickly after an infrastructure interruption.

---

## 6. Deferred / Future (Won't‑yet)

- **US-F-01** ML‑based fraud & anomaly detection.
- **US-F-02** Formal dispute‑resolution workflow.
- **US-F-03** Reward points for drivers and providers.
- **US-F-04** Live (production) mobile‑money collection & disbursement.
- **US-F-05** Native mobile push via a native shell (e.g. TWA/Capacitor).
- **US-F-06** Expansion beyond Kampala to other Ugandan cities.

---

*This backlog reflects the system as currently built and the latest product decisions (per‑job
platform fee, AI‑assisted tickable completion with fair‑price estimate, and the driver pay‑with‑
breakdown flow). Priorities are a guide for sprint planning, not a contractual commitment.*
