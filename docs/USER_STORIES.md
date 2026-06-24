# MOTOFIX — User Stories & Use Cases

This is our presentation script. Each story is written as **"As a … I want … so that …"**, followed by a **Demo** line showing exactly what to click during the live walkthrough with the panel.

**Three actors:** the **Driver** (needs help), the **Provider** (mechanic or tow operator who gives help), and the **Admin** (runs the platform).

---

## 1. Driver — getting help

### 1.1 Sign up & log in
- **As a** driver, **I want** to register with just my phone number and verify it with a one-time code, **so that** I can start using MOTOFIX quickly without a complicated sign-up.
- **Demo:** Driver app → enter phone → receive OTP → verify → land on the home screen.

### 1.2 Understand the fault before help arrives (MOTOBOT AI)
- **As a** driver who doesn't know what's wrong, **I want** to describe my problem in words, by voice, or by snapping a photo and have the app tell me the likely fault, **so that** I'm informed and can't be misled.
- **As a** driver, **I want** an up-front repair-or-replace cost estimate, **so that** I know roughly what a fair price is before anyone touches my car.
- **Demo:** Tap MOTOBOT / "Not sure? Let AI diagnose" → type *"white smoke from the engine"* (or upload a tyre photo) → show the diagnosis + cost range + repair-vs-replace verdict.

### 1.3 Request the right kind of help
- **As a** driver, **I want** to choose the help I need — a mechanic, a tow truck, or a breakdown specialist — **so that** I get a provider who can actually solve my problem.
- **As a** driver, **I want** the app to capture my exact location automatically, **so that** help can find me.
- **Demo:** Home → pick a service → confirm location on the map → submit the request → "Request dispatched."

### 1.4 Get matched to the nearest verified provider
- **As a** driver, **I want** to be matched automatically to the best nearby verified provider for my specific problem, **so that** I get fast, reliable help instead of making endless phone calls.
- **Demo:** Show the request being matched; (Admin/Matching slide can show *why* a provider was chosen — skill, distance, rating).

### 1.5 Watch help arrive live
- **As a** driver, **I want** to see my provider approaching on a live map with an ETA that counts down, **so that** I know exactly when help will reach me and feel reassured.
- **Demo:** Request detail screen → live map with the moving pin, the shrinking route, and the ETA.

### 1.6 Stay in touch
- **As a** driver, **I want** to call or chat (text, voice note, photo) with my provider, **so that** I can share details or directions while they're on the way.
- **Demo:** Open the in-job chat → send a message / voice note.

### 1.7 Pay fairly and transparently
- **As a** driver, **I want** to see the agreed charge and what was fixed, then pay by Mobile Money or cash, **so that** there are no surprise bills.
- **Demo:** End-of-job screen → agreed amount + work done → choose MoMo or cash.

### 1.8 Cancel if needed
- **As a** driver, **I want** to cancel a request (with a reason) and have it reflect instantly, **so that** I'm not stuck waiting if my plans change — and the provider is notified immediately.
- **Demo:** Cancel a live request → it closes at once; on the mechanic's phone the job disappears with a "driver cancelled" notice.

### 1.9 Rate the service
- **As a** driver, **I want** to rate and review my provider after the job, **so that** good providers are rewarded and quality stays high.
- **Demo:** After completion → star rating + comment.

### 1.10 Extra value in one app
- **As a** driver, **I want** to find genuine **spare parts** and trusted dealers, locate nearby **fuel stations**, compare and apply for **insurance**, and get maintenance **reminders**, **so that** everything about keeping my car on the road lives in one trusted place.
- **As a** driver in an emergency, **I want** an **SOS** flow that reaches emergency numbers (and dispatches an ambulance when people are hurt), **so that** I can get urgent help fast.
- **Demo:** Quickly show the Spare Parts, Fuel, Insurance, and Reminders screens.

---

## 2. Provider (Mechanic / Tow operator) — giving help

### 2.1 Apply and get verified
- **As a** mechanic or tow operator, **I want** to apply to join with my details and documents, **so that** the platform can verify I'm genuine before I take jobs.
- **Demo:** Provider app → Apply → fill the multi-step form → submit (then show the Admin approving it in section 3).

### 2.2 Log in and go online
- **As a** verified provider, **I want** to log in with my provider ID and toggle myself online, **so that** I start receiving job offers when I'm available to work.
- **Demo:** Provider app → log in (SPN + password) → flip the online toggle.

### 2.3 Receive and accept a job
- **As a** provider, **I want** to receive incoming requests with full context — the fault, the customer's location, and any photo — and accept or decline, **so that** I can decide quickly with the information I need.
- **As a** tow operator, **I want** to receive towing jobs (not unrelated repair jobs), **so that** I only get work I can actually do.
- **Demo:** Incoming-job pop-up appears → show the details → Accept.

### 2.4 Travel to the driver and run the job
- **As a** provider, **I want** to navigate to the driver with live tracking and move the job through clear stages (on my way → arrived → working → done), **so that** both sides always know what's happening.
- **Demo:** Active job → "I'm on my way" → the live map → step through to completion.

### 2.5 Get expert help on the spot (MOTOBOT for pros)
- **As a** working mechanic, **I want** an AI tool that gives detailed, technical repair guidance, **so that** I can diagnose and fix tricky faults faster.
- **Demo:** Active job → diagnostic tool → ask a repair question → show the step-by-step guidance.

### 2.6 Record the charge and finish
- **As a** provider, **I want** to record what I fixed and the agreed charge, **so that** the driver sees the final figure and the job is closed cleanly.
- **Demo:** Mark the job done → enter charge + work note.

### 2.7 Earnings and the platform fee
- **As a** provider, **I want** to see my earnings and the small platform fee I owe MOTOFIX per completed job, and settle it by Mobile Money, **so that** billing is transparent and fair.
- **As the** platform, **I want** to cap unpaid fees at 3 jobs and pause new work until they're settled, **so that** the model stays sustainable without locking people out unfairly.
- **Demo:** Earnings/Fees tab → show the owed balance (e.g. 3 jobs / UGX 30,000) → run the simulated MoMo settlement → balance clears.

### 2.8 Accountability for cancellations
- **As the** platform, **I want** to warn a provider with escalating "strikes" if they keep cancelling accepted jobs, **so that** drivers can rely on a provider who accepts actually turning up.
- **Demo:** Provider cancels a job → show the strike warning from MOTOFIX.

### 2.9 Reputation
- **As a** provider, **I want** to see my ratings and reviews, **so that** I can build my reputation and earn more work.
- **Demo:** Profile / Ratings view.

---

## 3. Admin — running the platform

### 3.1 Secure control room
- **As an** admin, **I want** to log into a private dashboard, **so that** only authorised staff can manage the platform.
- **Demo:** Admin portal → log in (`admin@motofix.ug`).

### 3.2 See the whole platform at a glance
- **As an** admin, **I want** a dashboard of live stats, revenue, and a breakdown-hotspot map, **so that** I can understand demand and performance instantly.
- **Demo:** Dashboard → stat cards, revenue chart, hotspot map.

### 3.3 Verify and manage providers
- **As an** admin, **I want** to review provider applications and approve or reject them, and manage existing providers (verify, ban, reinstate, view strikes/fees), **so that** only trustworthy providers operate on the platform.
- **Demo:** Applications → open one → approve → it now appears under verified Providers. (This is the application the provider submitted in 2.1.)

### 3.4 Oversee requests, drivers, and money
- **As an** admin, **I want** to see all service requests, driver accounts, and payment activity, **so that** I can support users and keep the platform healthy.
- **Demo:** Requests list, Drivers list, Payments.

### 3.5 Manage the spare-parts catalog
- **As an** admin, **I want** to maintain a catalog of parts and fair price ranges per fault, **so that** drivers see trustworthy pricing instead of guesswork.
- **Demo:** Spare Parts → show/edit a catalog entry.

### 3.6 Stay informed
- **As an** admin, **I want** real-time notifications (new applications, fee payments) and an activity log, **so that** I never miss something important and can audit what happened.
- **Demo:** Notification bell → show recent events.

---

## 4. Suggested live-demo flow (for the panel)

A clean 8–10 minute story that touches every actor:

1. **Driver** opens the app → uses **MOTOBOT** to diagnose a fault + see a fair cost *(1.2)*.
2. Driver **requests help** and is **matched** to a provider *(1.3–1.4)*.
3. **Mechanic** receives the job → **accepts** → drives over with **live tracking** *(2.3–2.4)* — show both phones side by side.
4. They **chat**, the job **completes**, driver **pays** and **rates** *(1.6–1.9)*.
5. Show the **towing provider** accepting a tow job *(2.3)* and the **platform-fee** settlement *(2.7)*.
6. **Admin** logs in → dashboard, **approves a provider application**, manages the platform *(3.1–3.3)*.
7. Close with the **extra features** — spare parts, insurance, fuel, reminders *(1.10)*.

> Tip: have the driver and mechanic apps open on two devices so the panel sees the request, the match, and the live tracking happen in real time across both.
