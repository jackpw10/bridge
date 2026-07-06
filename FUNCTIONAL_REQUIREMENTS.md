# BRIDGE — Functional Requirements

A web application that guides clinical dispatch / patient-flow staff through
the triage of inter-facility transfer (IFT) calls. The system picks the
appropriate Call Type, surfaces the matching Process Card and Action Card
for the destination/service pair, and produces a structured case summary
that can be copied to downstream systems.

---

## 1. Scope and audience

| Role | Responsibilities |
| --- | --- |
| **Admin** | Configures Call Types, Workflows (questions + process steps), Specialty Services, Facilities, Health Authorities, Diagnoses, Override Reasons, Reference Cards, Card Overrides. |
| **User** | Runs triage cases (one or many open at once), reviews the Result page, looks up Process Cards, acknowledges notifications. |

Authentication is required for both roles; admin features are not accessible
to users.

---

## 2. Glossary

- **Call Type** — a single, flat classification of an IFT call (e.g. High
  Acuity, Advice, Repatriation, Scheduled, Discharge). Each call type
  carries a one-character `letter` used in Process Card codes.
- **Workflow** — the question + process-step configuration bound to one
  Call Type. One workflow per call type.
- **Specialty Service** — a clinical service line (e.g. Cardiology,
  Nephrology). Each carries a two-digit `number` used in Process Card
  codes, the list of Call Types it is offered for, and per-Call-Type
  Service Templates.
- **Service Template** — a flat, ordered list of Process Card steps for
  one `(specialty, callType)` pair.
- **Process Card** — the rendered output of the Service Template for a
  given `(service, callType)`, plus any facility-specific Card Override.
  Every step is unconditional.
- **Action Card** — the workflow's flat list of process steps, shown on
  the Result page for every case that uses that workflow.
- **Card Override** — facility + service-specific deactivations,
  additions, and re-orderings applied on top of a base Service Template.
- **Process Card Code** — short identifier in the form `NN-L-NNN`
  (`service number` – `call-type letter` – `facility code`).
- **Triage Case** — a single in-progress triage run. Multiple cases can
  be open at once (tabbed UI); each case has its own answers, current
  index, phase, `notifsSent` flag, and notes.
- **Transport Advisor (TA) Card** — a service- and HA-scoped card that
  must be acknowledged mid-triage before the user can advance past the
  referral question.
- **Initial Call Question** — a question asked on the "New Case" screen
  *before* the user picks a call type. Applies to every case regardless
  of call type. Types: `yesno`, `dropdown`, `text`. Admin-configurable.
  Answers are frozen on the case and appear on the Result summary.

Removed in this rewrite (no longer part of the domain):

- Sub-versions of call types (LLTO/HLOC, PTN variants, etc.)
- Post-triage screen and PTN question
- Service template `preQuestions` and conditional step visibility

---

## 3. Roles and permissions

| Capability | User | Admin |
| --- | :---: | :---: |
| Sign in / sign out | ✓ | ✓ |
| Start, switch, close triage cases | ✓ | ✓ |
| Run the triage workflow | ✓ | ✓ |
| View Result page (summary, Process Card, Action Card, Process Card lookup) | ✓ | ✓ |
| Acknowledge / delete personal notifications | ✓ | ✓ |
| Open admin pages | ✗ | ✓ |
| Create / edit / delete Call Types, Workflows, Services, Facilities, HAs, Diagnoses, Reasons, Reference Cards, Card Overrides | ✗ | ✓ |

Admin status is enforced server-side via Supabase RLS using the
`is_admin()` SECURITY DEFINER function; the UI also hides admin routes
when the session role is `user`.

---

## 4. Domain entities

Simplified entity map (see `src/types/index.ts` for canonical TypeScript
definitions):

```
CallType ──< Workflow ──< WorkflowQuestion
                └──< processSteps: ProcessStep[]    (flat Action Card)

SpecialtyService
   ├── number                                    (2-digit, zero-padded)
   ├── enabledCallTypeIds: string[]              (which call types this service is offered for)
   ├── templates[callTypeId] = { steps: ProcessCardStep[] }   (flat Process Card)
   └── transportAdvisor.cards[]                  (callTypeIds × haIds × steps)

Facility
   ├── abbreviation
   ├── code                                      (3-digit, used in Process Card codes)
   ├── healthAuthorityId
   ├── onSiteServiceIds: string[]
   ├── referralPatterns[svcId] = {d1, d2, d3}    (default destinations per service)
   ├── notificationRequirements[]
   └── serviceNotifs[svcId] = {enabled, message}

CardOverride (per facility × service)
   └── parts[callTypeId] = { deactivated, addedSteps, sOrder }

Diagnosis, OverrideReason, HealthAuthority, ReferenceCard, Notification — simple records.
```

---

## 5. Functional requirements

### 5.1 Authentication and session

- FR-AUTH-1 — Users sign in via Supabase Auth (email + password). On success,
  the app loads role (`admin`/`user`) and renders the appropriate nav.
- FR-AUTH-2 — A signed-in user's session is restored from Supabase Auth on
  page load.
- FR-AUTH-3 — Sign-out clears the session and returns to the login screen.

### 5.2 Multi-case triage

- FR-CASE-1 — A user can have multiple triage cases open simultaneously.
  Each case is identified by a generated id and tracks: `workflowId`,
  `initialAnswers`, `answers`, `currentIndex`, `taShown`, `phase`
  (`workflow` | `result`), `notifsSent`, `notes`.
- FR-CASE-2 — Open cases are persisted to **sessionStorage** under the key
  `bridge-triage-cases` so a page refresh keeps every open tab. They are
  cleared when the browser tab is closed.
- FR-CASE-3 — Starting a case is a two-step flow on the "New Case" screen:
  1. Answer every configured **Initial Call Question**. If none are
     configured, this step is skipped and the user goes straight to
     step 2.
  2. Pick a Call Type, click **Start Case**. The case is created with
     `initialAnswers` frozen from step 1, `currentIndex = 0`, and
     `phase = 'workflow'`.
- FR-CASE-4 — A tab bar shows every open case; clicking switches the active
  case and navigates to the appropriate route (`/triage/run`,
  `/triage/result`).
- FR-CASE-5 — Closing a case removes it; if it was the active case, the
  most-recently-opened remaining case becomes active. If none remain, the
  user lands at `/triage`.

### 5.3 Initial Triage Questions (workflow phase)

- FR-WF-1 — Questions render in order from `Workflow.questions`, filtered
  by `condQid`/`condVal` visibility rules. Only the current visible
  question is editable; previously answered ones can be jumped to via the
  Progress list.
- FR-WF-2 — Supported question types: `yesno`, `triage` (legacy yes/no),
  `dropdown`, `text`, `facility`, `receiving_facility`, `specialty_multi`,
  `diagnosis_multi`, `referral_resolve`.
- FR-WF-3 — `specialty_multi` lists only services whose
  `enabledCallTypeIds` includes the case's call type.
- FR-WF-4 — `facility` and `receiving_facility` allow an optional free-text
  entry alongside the facility picker (`allowFreeText`).
- FR-WF-5 — Each question may carry an `additionalInfo` reference panel,
  displayed in a side card on the right of the question.

#### Keyboard behaviour

| Key(s) | Behaviour |
| --- | --- |
| `Y` / `N` | Answers a yes/no or triage question **and** auto-advances. |
| `1`–`9` | In any numbered combobox (`dropdown`, `facility`, `receiving_facility`, referral picker), selects the displayed result. |
| Dropdown / facility digit select | Auto-advances to the next question. |
| `Enter` (single-answer questions) | Advances if the current question is answerable. |
| `Enter` in `diagnosis_multi` filter with no match | Adds the typed text as a free-text diagnosis **and** advances. |
| `Enter` in a multi-select with matches | Toggles the highlighted option (does not advance). |
| `Tab` | Advances out of a multi-select question. |
| `B` | Goes back to the previous question. |
| `F` | Forward — advances if answerable. |
| `A` | Acknowledges the topmost Transport Advisor card. |
| `O` (referral_resolve) | Opens the custom-destination override flow. |
| `1`/`2`/`3` (referral_resolve) | Picks default destination 1/2/3. |

#### Referral resolution

- FR-REF-1 — A `referral_resolve` question reads the previously-answered
  facility and primary specialty service from the case to look up
  `facility.referralPatterns[primarySvcId]`. The three default
  destinations (`d1`/`d2`/`d3`) are shown as buttons.
- FR-REF-2 — If no pattern is defined for that sending facility / primary
  service, an inline warning is shown and the user must choose a custom
  destination.
- FR-REF-3 — Choosing **Override** opens a custom-destination combobox
  (filtered to facilities whose `onSiteServiceIds` include the primary
  service) followed by a mandatory reason picker.
- FR-REF-4 — The referral question cannot be advanced past until any
  applicable Transport Advisor cards have been acknowledged.

#### Transport Advisor

- FR-TA-1 — After the referral question is answered, the system computes
  `taItems` from each selected service's `transportAdvisor.cards`, filtered
  by the case's call type and the destination facility's Health Authority.
- FR-TA-2 — Each TA card is displayed once per case (tracked in `taShown`)
  and must be acknowledged via the `A` hotkey or button before the user
  can advance.

### 5.4 Post-workflow transition

- FR-END-1 — When all visible workflow questions are answered, the case
  transitions directly to `phase = 'result'` and the user is navigated to
  `/triage/result`. There is no post-triage screen.

### 5.5 Result page

- FR-RES-0 — Displays the **Initial call answers** captured on the "New
  Case" screen at the top of the main column (only when at least one is
  non-empty). The same answers are included in the case summary text.
- FR-RES-1 — Renders one Process Card per `(service, destinationFacility)`
  in the case's AC queue. Each card is
  `service.templates[callTypeId].steps` plus any `CardOverride` for
  `(facility, service)` keyed by `callTypeId`.
- FR-RES-2 — Renders the Action Card (`workflow.processSteps`).
- FR-RES-3 — Builds and displays a case summary string usable for
  copy/paste into downstream systems.
- FR-RES-4 — Sends notifications **once per case** (`notifsSent` flag):
  per-service `serviceNotifs` and per-diagnosis `notifMessage` if enabled
  and the case has a logged-in session.
- FR-RES-5 — Includes a **Process Card lookup** panel (see §5.6).

### 5.6 Process Card lookup (Result page)

- FR-PCL-1 — Allows the user to find a Process Card by Facility + Service
  or by typing a `NN-L-NNN` code.
- FR-PCL-2 — **Scope:** The lookup is locked to the current case's Call
  Type; the user cannot view cards for any other call type.
- FR-PCL-3 — When a code is typed, its letter must match the case's Call
  Type letter. Any other letter shows `Code <X> is not part of this call
  type.`
- FR-PCL-4 — When facility + service are resolved, the panel displays:
  - The current Process Card code badge.
  - The flat Process Card step list.

### 5.7 Process Card code system

- FR-CODE-1 — Format: `NN-L-NNN` where:
  - `NN` = `SpecialtyService.number`, zero-padded to 2 digits.
  - `L` = the Call Type's `letter`.
  - `NNN` = `Facility.code`, a 3-digit identifier.
- FR-CODE-2 — `processCardCode(svc, ct, fac)` returns the code, using
  filler characters when any input is missing.
- FR-CODE-3 — `parseProcessCardCode(raw)` parses a typed string into
  `{ serviceNumber, letter, facilityCode }`, accepting flexible
  whitespace.

### 5.8 Admin

Each admin page provides full CRUD over its entity and writes through to
Supabase. Idempotent `diffSyncList` is used to upsert collections.

- FR-ADM-0 — **Initial Call Questions**: name, ordered list of questions
  (yes/no, dropdown with options, free text). Editable via drag-to-reorder.
  Applied on the "New Case" screen before the call-type picker.
- FR-ADM-1 — **Call Types**: name + single-character letter (no sub-versions).
- FR-ADM-2 — **Workflows**: bound to a Call Type. Editor exposes:
  - Questions list (with type, options, conditional visibility on other
    questions, `additionalInfo`).
  - Action Card process steps (single ordered flat list).
- FR-ADM-3 — **Specialty Services**: name, 2-digit number,
  `enabledCallTypeIds`, per-call-type Process Card Template (a flat list
  of steps), Transport Advisor cards.
- FR-ADM-4 — **Facilities**: name, abbreviation, 3-digit code,
  Health Authority, on-site services, referral patterns per service,
  per-service notifications, notification requirements.
- FR-ADM-5 — **Health Authorities, Diagnoses, Override Reasons,
  Reference Cards**: simple CRUD.
- FR-ADM-6 — **Card Overrides**: per facility × service, keyed by
  `callTypeId`. Stores deactivated ids, added steps, and an explicit
  step re-ordering array.

### 5.9 Data integrity rules

- FR-DATA-1 — **No silent data wipes.** Seeding only `INSERT`s when a
  table is empty; it never `UPSERT`s on top of existing rows. Any
  destructive operation must be initiated by the user.
- FR-DATA-2 — Schema is forward-compatible: new columns are added with
  `add column if not exists`; existing rows are left unchanged. Column
  removals are shipped as a separate migration SQL file the user runs
  manually.
- FR-DATA-3 — **Legacy shape tolerance.** DB mappers read both the
  pre-rewrite JSONB shape (per-sub-version templates, per-sub-version
  process-step keys, `ctId:svId` override keys) and the new flat shape.
  On the next admin save the row is rewritten in the new shape.
- FR-DATA-4 — `loadAllData` is deduped (single in-flight load) to
  prevent concurrent seed inserts producing duplicate-key errors.

### 5.10 Persistence and sync

- FR-PERSIST-1 — Reference data (call types, workflows, services,
  facilities, etc.) lives in Supabase Postgres tables.
- FR-PERSIST-2 — Open triage cases live in sessionStorage only (not
  Supabase). They are a transient working set scoped to the browser tab.
- FR-PERSIST-3 — Realtime channels keep admin pages in sync across users
  when reference data changes.

---

## 6. User workflows

### 6.1 First-time admin setup

```
Sign in (admin)
   ↓
Create Health Authorities
   ↓
Create Facilities (abbreviation, 3-digit code, HA, on-site services)
   ↓
Create Call Types (name + one letter each)
   ↓
Create Specialty Services (number, enabledCallTypeIds, flat step
   template per call type)
   ↓
Create / edit Workflows for each Call Type
   ├── questions
   └── Action Card process steps (single flat list)
   ↓
Set Referral Patterns on each sending facility per primary service
   ↓
(Optional) create Card Overrides for facility-specific deviations
```

### 6.2 Run a triage call (happy path)

```
1. User clicks "New Case".
   → If any Initial Call Questions exist, answer them first.
   → Click "Next — pick call type →".
   → Pick a Call Type → Start Case.
   → A new triage case is opened in a new tab.
   → Phase = workflow, currentIndex = 0.
   → initialAnswers are frozen on the case.

2. Initial Triage Questions
   For each visible question:
     • If yes/no → press Y or N → answer set & advance.
     • If dropdown / facility → type to filter, press 1–9 → advance.
     • If specialty_multi / diagnosis_multi → check options, then Tab to
       advance. (For diagnosis: typing unmatched text + Enter adds it as
       free text and advances.)
     • If text → type, press Enter to advance.
     • If referral_resolve → press 1/2/3 to pick a default destination,
       or O to override. Override picks a custom facility then a reason.
       Any Transport Advisor cards must be A-cknowledged before advance.

3. End of workflow questions
   → System transitions to phase = result and navigates to /triage/result.

4. Result page
   • Process Cards render per (service, destinationFacility) using the
     flat template steps + any facility Card Override.
   • Action Card (workflow process steps) renders.
   • Case summary is displayed and copyable.
   • Per-service / per-diagnosis notifications fire once.
   • User can use the Process Card lookup to inspect other facility/service
     combinations within the same call type.

5. Close the case
   • Closing removes it from the tab bar. If another case is open, that
     becomes active.
```

### 6.3 Overriding a referral pattern

```
At the referral_resolve question:
   1. User reviews the three default destinations.
   2. Defaults are wrong (e.g., diversion). User presses O.
   3. A custom facility combobox opens, filtered to facilities that have
      the primary service on site. User types to filter, picks one
      (number key or click).
   4. A "Reason for override" combobox opens. User picks a reason.
   5. The override is recorded against the question id:
        choice = "__custom__"
        customfacid = <fac id>
        reasonid = <reason id>
   6. Once any Transport Advisor cards are acknowledged, F (or Enter)
      advances.
```

### 6.4 Looking up a Process Card on the Result page

```
1. User opens the "Process card lookup" panel on the Result page.
2. Two equivalent ways to resolve:
     A. Type a code (e.g. "07-A-303")
        • Letter must match the case's call type letter → otherwise
          inline error "Code 07-A-303 is not part of this call type."
        • Service number / facility code are matched against the catalogs.
     B. Pick a facility and a service from the pickers.
3. The panel shows:
   • The current Process Card code badge.
   • The flat step list.
4. User can click "Clear" to reset and look up a different one.
```

### 6.5 Multi-case triage

```
Concurrent calls scenario:
   1. User opens Case A (High Acuity) and gets partway through.
   2. A second call arrives; user clicks "New Case" → Case B opens in a
      new tab, becomes active. Case A retains all its state.
   3. User completes Case B → /triage/result for Case B.
   4. User clicks Case A's tab → switches back; Case A continues at the
      same question it was on.
   5. Refreshing the browser preserves both tabs (sessionStorage).
   6. Closing the browser tab clears them (intentional — transient).
```

### 6.6 Admin updates a workflow mid-day

```
1. Admin edits a Workflow's questions or Action Card process steps.
2. Save is a diffSync against Supabase. Realtime notifies other clients.
3. New cases opened after the change use the new configuration.
4. Cases already in progress on other clients continue with their stored
   answers; the workflow definition they reference is re-read on each
   render, so they see the new questions only if they revisit them.
```

---

## 7. Non-functional requirements

- **NFR-1 (Responsiveness):** Triage flow is keyboard-driven; every common
  step has a single-key shortcut. The active item is always visually
  highlighted with a ring.
- **NFR-2 (Resilience to RLS):** Writes that are silently blocked by RLS
  (Supabase returns `{data: [], error: null}`) are detected by comparing
  the `.select()` count and surfaced via `lastError`.
- **NFR-3 (Browser support):** Modern evergreen browsers; the persisted
  triage state relies on sessionStorage.
- **NFR-4 (Data safety):** No automatic destructive operations against
  Supabase tables. Seeding is `INSERT`-only on empty tables; column
  removals are shipped as manual migration SQL.
- **NFR-5 (Idempotent additive migrations):** `add column if not exists`
  for every schema addition; the app degrades gracefully when newly added
  columns are not yet present.
- **NFR-6 (Performance):** All collection sync uses a single round-trip
  diff (`diffSyncList`); reference data load is deduped via an in-flight
  promise.

---

## 8. Out of scope (current release)

- Server-side push of notifications (everything is in-browser).
- Multi-tenant isolation beyond row-level admin checks.
- Mobile-first layouts (designed for desktop dispatch workstations).
- Offline mode / queued writes.

---

## 9. Open questions / future work

- Should completed cases be archived to Supabase for audit / reporting?
- Should the Process Card lookup widen to other call types (with a
  feature flag) for cross-team training?
- Should Card Overrides support a single "global" entry that applies to
  every call type at once, in addition to per-call-type entries?
