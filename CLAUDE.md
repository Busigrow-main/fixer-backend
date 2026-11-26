# CLAUDE.md — fixer-backend (Fixxer API)

This repo is the **NestJS + MongoDB (Mongoose) API** for Fixxer. The web app lives in the sibling repo `fixer-frontend` (Next.js).

## Working norms (read first)
- **Ponytail / YAGNI:** smallest complete change; no speculative abstractions.
- **Do not commit unless asked.**
- Local API often points at the deployed Mongo — see `docs/local-production-database.md` before running anything that writes.
- Slot assignment uses Mongo transactions → needs a **replica-set** database.
- Keep module dependencies one-way: **Bookings → Technician Engine** (never the reverse).
- Corrections add new audit/events; `changeHistory` is append-only and is never silently overwritten.

## Runtime
- API on `:8081`, all routes under `/api/v1/*`.
- Auth: JWT + role guards (`ADMIN`, technicians, customers). History / recovery / ops endpoints are admin-only. Technician payloads strip forbidden booking fields (techs never see or edit history).

## Modules (high level)
auth, users, services, bookings, visits, warranties, technicians / technician-engine / technician-platform, spare-parts, appliances, part-orders, shop, shop-part-help, leads, offers, serviceable-pincodes, gst, feedback, ops, admin, customer-appliances.

## Codebase map (read before searching)
- **`docs/CODEBASE_MAP.md`** maps every feature to its route(s), files, schemas, crons, tests and the web page that calls it, plus the dependency graph and known quirks. Use it to find files before grepping.
- The other side of each feature is in `../fixer-frontend/docs/CODEBASE_MAP.md`.
- When you add or move a route, page, component, schema or cron, update the matching row in the map in the same change.

---

# Fixxer — Project Context

**Brand:** Fixxer (operated by Cool Air Refrigeration)
**Market:** Patna / Bihar, India — mobile-first home appliance customers
**Repos:** `fixer-backend` (NestJS API) + `fixer-frontend` (Next.js web)
**Separate:** technician field app (Fixxer-mobile / Expo) — **not in production yet**; operations run entirely from the admin panel today.

## Subject
Fixxer is a **local appliance repair + parts/appliance commerce platform**. It digitizes Cool Air Refrigeration's on-ground service business: book a technician, complete the job with pricing/warranty/visits, sell spare parts and complete appliances (especially ACs), and run ops from an admin console.

It is **not** a generic national marketplace clone. The product bet: trusted local expert + technician validation + service follow-through, with Urban Company–style guided service and Flipkart-like catalog convenience where useful.

## What it is trying to achieve
1. **Get broken appliances fixed fast** — same-day visits, verified technicians, clear booking → dispatch → job → bill → warranty loop.
2. **Make pricing and warranty trustworthy** — base charges before booking, explained extras, invoice/warranty after work, 60-day labour warranty + part-specific cover.
3. **Sell the right part / appliance** — spare-parts fit confidence, "identify a part" assisted flow, AC catalogue with installation/enquiry; Patna delivery & installation.
4. **Run the business operationally** — admin dispatch, technicians, settlements, GST/invoices, leads, serviceable pincodes, shop orders, quality review, recovery queue, ops pending/overdue queues, append-only audit history.
5. **Close the quality loop** — customer feedback, low-rating recovery, supervisor quality review, corrective bookings without wiping paid/earnings history.

**North star:** a customer in Patna who does not know the SKU still gets a working appliance; Fixxer captures the job, the parts margin, and a recoverable relationship.

## Product pillars
| Pillar | Customer job | Surfaces |
|--------|--------------|----------|
| **Fixxer Service** | Book repair / installation visit | `/`, `/services`, booking modal, `/my-bookings` |
| **Fixxer Shop** | Parts, appliances, part-help | `/shop`, spare parts, appliances, cart/checkout, orders |
| **Admin / Ops** | Dispatch, scheduling, money, quality, recovery | `/admin/*` |
| **Technician platform** | Accept jobs, visits, job sheet, earnings | Backend `technician-*` modules + mobile app (partners only, not launched) |

## Goals
### Customer
- Transparent pricing (estimate vs live invoice), technician/status visibility, warranty proof.
- One place post-booking: My Bookings (repairs, shop orders, part help, warranty).
- Assisted commerce is a first-class conversion path (call, WhatsApp, enquiry, tech identify-part).

### Operations
- Dispatch with unclaimed escalation (~10 min TTL).
- Pending/overdue ops queue (unassigned, accepted-not-started, parts waits, overdue reviews).
- Quality review (`PENDING` / `APPROVED` / `NEEDS_FOLLOW_UP`) + corrective bookings via `parentId`.
- Feedback recovery for rating ≤2 or unresolved jobs (owner, due, resolution).
- Append-only change history on critical booking fields (assign, price, parts, status, warranty, review, schedule); techs never see/edit history.

### Commerce
- Spare parts + AC appliances catalog; cart/orders; GST; part-help requests.
- Compatibility / fit before hard sell; installation scheduling for appliances.

### Trust & brand
- Primary red `#C8102E`, golden accent `#D48F0E`.
- Positioning: precision home services, 60-day warranty, same-day arrival, background-checked pros (~150k+ repairs claim on marketing).

## Architecture
```
Customer / Admin browser (Next.js :3000/3001)
        │  JWT
        ▼
NestJS API (:8081)  /api/v1/*
        │
        ▼
MongoDB (Mongoose)  — bookings, users, technicians, shop, feedback, ops, …
```

## Technician types & scheduling
Two kinds of technician (`Technician.employmentType`):
- **PARTNER** — independent; self-signs up in the (future) app, claims marketplace jobs, one job at a time (`ON_JOB` when assigned). Schema default.
- **FIXXER_STAFF** — Fixxer-owned, fully admin-managed. Admin-added technicians default to this (all existing technicians were backfilled to staff). **No technician-app access** (OTP login and `TechnicianGuard` refuse them); no app notifications; never in marketplace broadcasts. Staff jobs still create technician earnings.

**The admin panel is the substitute for the technician app** for staff: the `/admin/schedule` board is where the admin starts jobs, extends them, flags parts waits and completes them (completion code from the customer still required). Off duty is set by the admin on the technician page.

Staff are **scheduled into time slots** (`Booking.scheduledStart` / `scheduledEnd`):
- Duration is always entered by the admin (no per-service default). No travel gap — back-to-back slots don't clash.
- **No slots in the past** (15-minute grace for "starting now"). A slot must start and end on the same IST day.
- **8 AM – 9 PM IST is a soft limit** for the admin: outside hours is a warning they can override with a reason. It stays a hard limit for the automatic overrun shift.
- Assigning staff requires a slot; job is auto-accepted and stays `ASSIGNED` (no new statuses — `EN_ROUTE`/`IN_PROGRESS` remain post-arrival). `expectedArrivalAt` mirrors the slot start for customers.
- A clash (busy / off duty / outside hours) is a **warning**: API returns 409 `SLOT_CONFLICT` with next free time + free staff (filtered by service category and area where the technician has them set); admin can go ahead with a reason (logged in change history).
- **Overrun rule** (cron every 5 min): if a job is past its end and not closed, the technician's later not-started jobs move +1h, cascading. Never moves EN_ROUTE/IN_PROGRESS jobs; never pushes past 9 PM (shown as overflow on the board). Jobs flagged waiting-for-parts (`opsPartsWait`) never push. "Closed" depends on the admin marking the job COMPLETED.
- **Extending a running job** (admin) keeps its start, moves its end, and pushes overlapping later jobs forward right away by whole hours.
- Staff jobs with no slot (assigned before scheduling existed) show in "Needs a time" on the board; setting a time also completes acceptance.
- Staff are `ON_JOB` only while a job is live (EN_ROUTE/IN_PROGRESS); future slots don't make them busy.
- Customer's `preferredVisitDate` / `preferredVisitSlot` informs the admin but never blocks. Today's board also lists older/undated unassigned bookings.

Code layout (keep dependencies one-way, Bookings → Engine):
- Pure rules: `technician-engine/technician-schedule.ts`
- Reads + per-technician slot lock (transaction): `TechnicianScheduleService` in `TechnicianEngineModule` — uses Booking/Technician models only, never `BookingsService`.
- Writes (assign / change time / extend / overrun shift + history): `BookingsService`; cron `BookingSlotShiftScheduler` in `BookingsModule`.
- Admin UI: `/admin/schedule` day board (job panel), `StaffSlotModal` for assign / change time / extend (also used from bookings list, booking detail, Manage Visits).
- Import pure engine files directly (not the `technician-engine` index) from controllers — the index re-exports the Nest module and pulls in AuthModule.

## Domain vocabulary
- **Booking** — core repair/service job; invoice, assignment, status, warranty, review, ops flags, `changeHistory`.
- **Visit / job sheet** — on-site work, parts used.
- **Feedback / follow-up** — post-job rating; recovery queue for bad outcomes.
- **Quality review** — supervisor gate after completion; may spawn corrective booking.
- **Ops queue** — derived pending/overdue work for admins.
- **Settlement** — Fixxer vs technician share of labour/parts.
- **Part help** — customer cannot name the part; tech identifies.
- **Slot** — admin-planned time window for a Fixxer-staff booking.

## Current strategic focus (recent P1)
Customer & quality follow-through:
1. Feedback + recovery queue
2. Supervisor quality review + corrective bookings
3. Pending/overdue ops queue
4. Append-only change history for critical actions
5. Admin slot scheduling for Fixxer-staff technicians (admin panel as app substitute)

Earlier P1 themes: pricing transparency, warranty transparency, technician/status visibility on customer web.

## Success looks like
- Customer books with clear price expectations, tracks job, pays a believable bill, understands warranty.
- Wrong-part / unknown-model customers convert via assisted flows.
- Admins can dispatch, plan and run a staff technician's day, recover unhappy customers, approve quality, and audit who changed money/status/assignment/schedule.
- Technicians get job info they need — not admin history or secrets.
- Corrections add new audit/events; history is never silently overwritten.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
