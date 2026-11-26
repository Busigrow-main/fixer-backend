# Fixxer — P2-09 Customer & Appliance Timeline: Manual Testing Guide

## 1. Overview

This guide covers manual post-deploy test scenarios for P2-09: Customer & Appliance Timeline. It is based on the existing frontend pages and backend API endpoints in the repository.

**Features under test:**
- Search customers by phone and appliances by serial number
- Map appliances (serial numbers) to customer phone numbers
- Add additional phone numbers to an existing appliance mapping
- View appliance service timelines and associated customer accounts
- View per-customer unified service history (bookings, visits, parts, warranties, feedback)
- View booking details with visits, parts consumed, warranties, and job sheet

**Test environment:**
- Frontend: `http://localhost:3000` (Next.js dev server)
- Backend API: `http://localhost:3000/api/v1` (or `NEXT_PUBLIC_API_URL`)
- Auth: Admin JWT bearer token required for all `/api/v1/admin/*` endpoints

**Prerequisites:**
1. Backend running with a populated database (customers, bookings, visits, spare parts, appliance mappings)
2. Frontend running and reachable
3. Admin user account with JWT token
4. At least one customer with phone, bookings, and mapped appliances for positive test cases

---

## 2. Appliance Mapping & Phone Search (`/admin/appliance-mappings`)

**Page:** `app/admin/appliance-mappings/page.tsx`
**API client:** `app/lib/admin-appliance-mappings-api.ts`
**Backend controller:** `src/customer-appliances/customer-appliances.controller.ts` (`AdminApplianceMappingsController`)

### API endpoints exercised

| # | Endpoint | Method | Purpose |
|---|----------|--------|---------|
| 2-1 | `GET /api/v1/admin/appliance-mappings?page=&limit=` | GET | List paginated appliance mappings |
| 2-2 | `GET /api/v1/admin/appliance-mappings/search?phone=` | GET | Search customers/bookings/appliances by phone |
| 2-3 | `GET /api/v1/admin/appliance-mappings/by-serial/:serial` | GET | Lookup mapping by appliance serial |
| 2-4 | `POST /api/v1/admin/appliance-mappings/map` | POST | Map a serial number to a customer phone |
| 2-5 | `POST /api/v1/admin/appliance-mappings/:serial/phones` | POST | Add an additional phone to a serial mapping |
| 2-6 | `GET /api/v1/admin/appliance-mappings/by-serial/:serial/timeline` | GET | Paginated appliance service timeline |

### Scenario S2-01: List appliance mappings (directory)

**Preconditions:** Admin authenticated; appliance mappings exist in DB.

**Steps:**
1. Open `/admin/appliance-mappings`.
2. Verify the page loads and shows "Appliance mapping directory" with total record count.
3. Verify a table renders with columns: Serial, Customer phones, Brand/model, Primary booking, Updated, Timeline.
4. Click "Refresh" and verify the table reloads without error.
5. Click "Timeline" on a mapping row and verify the appliance timeline section expands/loads.

**Expected result:** Mapping records display correctly; pagination controls appear when `totalPages > 1`.

### Scenario S2-02: Search customer by phone (positive)

**Preconditions:** A customer exists with a phone number and associated bookings.

**Steps:**
1. On `/admin/appliance-mappings`, enter a valid 10-digit phone number in "Search customer phone".
2. Click "Search by phone".
3. Verify the customer lookup card renders with name, phone, email (if present).
4. Verify "Phone service history" lists bookings with status, date, and serial number.
5. Verify "Mapped appliances" lists mapped appliances with serial and phone count.
6. Click "Open customer service history" and verify navigation to `/admin/customers/[customerId]`.

**Expected result:** Customer profile, phone bookings, and mapped appliances display correctly.

### Scenario S2-03: Search customer by phone (no account)

**Preconditions:** A phone number with bookings but no customer account exists.

**Steps:**
1. Enter a phone number that has bookings but no linked customer account.
2. Click "Search by phone".
3. Verify "No customer account found" message appears.
4. Verify phone service history and mapped appliances still render (contact-phone bookings are reviewable without an account).

**Expected result:** Graceful degradation — bookings/mappings visible, customer account link absent.

### Scenario S2-04: Search customer by phone (no results)

**Preconditions:** A phone number with no bookings or mappings.

**Steps:**
1. Enter a phone number with no associated data.
2. Click "Search by phone".
3. Verify "No bookings found for this phone" and "No appliances are currently mapped to this phone."

**Expected result:** Empty states render without errors.

### Scenario S2-05: Lookup appliance by serial (positive)

**Preconditions:** An appliance mapping exists for a known serial number.

**Steps:**
1. Enter a valid serial number in "Lookup appliance serial".
2. Click "Lookup serial".
3. Verify the mapping card renders with serial number, brand, model, primary booking ID.
4. Verify the appliance timeline section loads with bookings and pagination.

**Expected result:** Serial mapping and timeline display correctly.

### Scenario S2-06: Lookup appliance by serial (not found)

**Preconditions:** A serial number with no mapping.

**Steps:**
1. Enter a serial number that does not exist in any mapping.
2. Click "Lookup serial".
3. Verify "Appliance mapping not found." error appears.

**Expected result:** Error message displays; no mapping or timeline shown.

### Scenario S2-07: Map appliance to customer

**Preconditions:** Phone search has returned results; serial, brand, model fields are fillable.

**Steps:**
1. Perform a phone search (S2-02).
2. In "Map appliance to this customer", enter a serial number.
3. Optionally enter brand, model, and select a booking from the dropdown.
4. Click "Map serial to customer" and confirm in the dialog.
5. Verify success message: "Serial X is associated with Y."
6. Verify the mapping appears in "Mapped appliances" and the directory table.

**Expected result:** New mapping created; phone search results refresh; mapping persists in directory.

### Scenario S2-08: Add additional phone to mapping

**Preconditions:** An appliance mapping exists with at least one phone.

**Steps:**
1. Select a mapping (click a serial in "Mapped appliances" or "Timeline" from directory).
2. In the "Associated phones" section, enter a new phone number.
3. Click "Add" and confirm in the dialog.
4. Verify success message and the new phone appears in the phone list.

**Expected result:** Additional phone associated with the serial mapping.

### Scenario S2-09: View appliance timeline

**Preconditions:** A mapping has associated bookings.

**Steps:**
1. Select a mapping to open its timeline.
2. Verify "Appliance timeline" shows serial, brand/model, associated phones, customer accounts.
3. Verify "Relevant service history" lists bookings with status, date, contact phone, technician.
4. Click "Booking details" on a timeline booking and verify navigation to `/admin/bookings/[id]`.
5. Use pagination controls to navigate pages (if `totalPages > 1`).
6. Click "Retry timeline" after an error state and verify reload.

**Expected result:** Timeline bookings render with links; pagination works; retry recovers from errors.

### Scenario S2-10: Timeline coverage notes

**Preconditions:** Timeline returns history limitations.

**Steps:**
1. Open an appliance timeline.
2. If "Timeline coverage notes" appears, expand it and verify limitation notes are listed.

**Expected result:** Coverage limitations are transparent to the admin.

### Scenario S2-11: Phone matches identify contact details only

**Preconditions:** Phone search returns bookings without a customer account.

**Steps:**
1. Perform a phone search for a phone without a customer account.
2. Verify the disclaimer: "Phone matches identify contact details only. Confirm the correct booking and appliance before creating a link."

**Expected result:** Disclaimer visible when no customer account exists.

### Scenario S2-12: Map serial with attached booking

**Preconditions:** Phone search returned bookings; mapping dialog is open.

**Steps:**
1. In "Map appliance to this customer", select a booking from the "Attach booking (optional)" dropdown.
2. Confirm mapping.
3. Verify success message includes the booking ID.
4. Verify the booking's appliance serial is updated in the backend.

**Expected result:** Mapping created with booking association; booking updated.

### Scenario S2-13: Search via URL query params

**Preconditions:** Direct URL navigation with `?phone=` or `?serial=`.

**Steps:**
1. Navigate directly to `/admin/appliance-mappings?phone=<valid-phone>`.
2. Verify phone search auto-executes and results render.
3. Navigate to `/admin/appliance-mappings?serial=<valid-serial>`.
4. Verify serial lookup auto-executes and mapping renders.

**Expected result:** URL query params trigger the corresponding search on page load.

---

## 3. Customer Service History (`/admin/customers/[customerId]`)

**Page:** `app/admin/customers/[customerId]/page.tsx`
**API:** `GET /api/v1/admin/customers/:customerId/service-history?page=&limit=&phone=`

### Scenario S3-01: View customer profile

**Preconditions:** A customer ID is known.

**Steps:**
1. Navigate to `/admin/customers/<customerId>`.
2. Verify customer profile card shows full name, phone, email, and "Customer since" date.
3. Verify total service booking count displays.

**Expected result:** Customer profile information renders correctly.

### Scenario S3-02: Unified service timeline

**Preconditions:** Customer has service events.

**Steps:**
1. Verify "Unified service timeline" lists events chronologically.
2. Verify each event shows: icon, type (booking, job_completion, cancellation, payment, invoice, visit, part_transaction, warranty, feedback, follow_up), timestamp, and key details (status, service, invoice, rating, condition, follow-up owner/due/resolution).
3. Verify booking ID link is shown for each event.

**Expected result:** Chronological timeline with event icons and details.

### Scenario S3-03: No service events

**Preconditions:** Customer exists but has no service events.

**Steps:**
1. Navigate to a customer with no bookings/events.
2. Verify "No service events found for this customer." empty state.

**Expected result:** Empty state renders without error.

### Scenario S3-04: View customer appliances

**Preconditions:** Customer has mapped appliances.

**Steps:**
1. Verify "Appliances" section lists serial numbers with brand/model.
2. Click "Timeline" on an appliance and verify navigation to `/admin/appliance-mappings?serial=<serial>`.
3. Verify "Mapped [date] · N booking(s) on this page" displays.

**Expected result:** Appliance cards with timeline links render correctly.

### Scenario S3-05: No appliances

**Preconditions:** Customer has no mapped appliances.

**Steps:**
1. Verify "No appliances are associated with the bookings on this page." empty state.

**Expected result:** Empty state renders.

### Scenario S3-06: Paginated service history

**Preconditions:** Customer has more bookings than the page limit (20).

**Steps:**
1. Verify "Service history" table shows bookings with date, service, appliance, status, details.
2. Verify pagination controls: "Page X of Y", Previous/Next buttons.
3. Click Next and verify page 2 loads with older bookings.
4. Click Previous and verify return to page 1.
5. Verify buttons disable at boundaries (Previous on page 1, Next on last page).

**Expected result:** Pagination works correctly with boundary handling.

### Scenario S3-07: Search customer by phone on customer page

**Preconditions:** Customer page loaded.

**Steps:**
1. Enter a phone number in "Search customer by phone" and click "Search by phone".
2. Verify history reloads filtered by phone.
3. Click "Clear" and verify history resets to the original customer's full history.

**Expected result:** Phone search and clear work on the customer page.

### Scenario S3-08: Booking details link from customer history

**Preconditions:** Customer has bookings.

**Steps:**
1. In the service history table, click "Booking details" for a booking.
2. Verify navigation to `/admin/bookings/<bookingId>`.
3. Verify booking detail page loads with the booking's data.

**Expected result:** Navigation to booking detail works.

### Scenario S3-09: Expandable booking timeline details

**Preconditions:** Customer has bookings with visits/parts/warranties/feedback.

**Steps:**
1. In the service history table, each booking row has a "Record details" expandable section.
2. Expand a booking and verify sections render: Job completion, Visits, Parts and inventory movements, Warranty and related work, Feedback, Invoice snapshot (if present).
3. Verify visit details show visit order, status, time in/out, technician, job description.
4. Verify parts show part name, quantity, visit, installed date.
5. Verify warranty records show type, status, description, date range.
6. Verify feedback shows rating and comment.
7. Verify related booking links appear for warranty claims/corrective jobs.

**Expected result:** All booking detail sections render with correct data.

### Scenario S3-10: No linked records in timeline details

**Preconditions:** A booking has no visits, parts, warranties, or feedback.

**Steps:**
1. Expand a booking with no linked records.
2. Verify "No linked visit records.", "No linked part records.", "No linked warranty records.", "No feedback record." messages appear as appropriate.

**Expected result:** Graceful empty states for each section.

### Scenario S3-11: History coverage notes

**Preconditions:** Customer history returns limitations.

**Steps:**
1. If "History coverage notes" appears, expand and verify limitation notes.

**Expected result:** Coverage notes transparent.

### Scenario S3-12: Customer not found

**Preconditions:** Invalid customer ID.

**Steps:**
1. Navigate to `/admin/customers/<invalid-id>`.
2. Verify "Customer or service history not found." error with "Try again" button.

**Expected result:** Error state with retry option.

### Scenario S3-13: Customer since date

**Preconditions:** Customer has a createdAt timestamp.

**Steps:**
1. Verify "Customer since" displays a formatted date.

**Expected result:** Date displays in en-IN locale format.

### Scenario S3-14: Back to appliance mappings

**Preconditions:** Customer page loaded.

**Steps:**
1. Click "← Customer & appliance lookup" link.
2. Verify navigation to `/admin/appliance-mappings`.

**Expected result:** Back navigation works.

### Scenario S3-15: Warranty record count badge

**Preconditions:** A booking has warranty records.

**Steps:**
1. In service history table, verify warranty record count badge appears next to "Booking details" link when warranties exist.

**Expected result:** Warranty badge displays count.

### Scenario S3-16: Job closed indicator

**Preconditions:** A booking is closed.

**Steps:**
1. Verify "Closed <date>" appears under status for closed bookings.

**Expected result:** Closed date indicator displays.

### Scenario S3-17: Change history count

**Preconditions:** A booking has change history events.

**Steps:**
1. Verify "<N> recorded booking change event(s)" appears when change history exists.

**Expected result:** Change history count displays.

### Scenario S3-18: Timeline event types

**Preconditions:** Customer has varied service events.

**Steps:**
1. Verify timeline includes events of types: booking, job_completion, cancellation, payment, invoice, visit, part_transaction, warranty, feedback, follow_up.
2. Verify each type shows the correct emoji icon.

**Expected result:** All event types render with icons.

---

## 4. Booking Details (`/admin/bookings/[id]`)

**Page:** `app/admin/bookings/[id]/page.tsx`
**Component:** `app/admin/components/CustomerBookingTimelineDetails.tsx`
**API:** `GET /api/v1/admin/bookings/:id`, `PUT /api/v1/admin/bookings/:id/status`, `PUT /api/v1/admin/bookings/:id/assign`, `PUT /api/v1/admin/bookings/:id/job-details`, `PUT /api/v1/admin/bookings/:id/product-details`, `PUT /api/v1/admin/bookings/:id/service-properties`, `PUT /api/v1/admin/bookings/:id/invoice-manual`, `PUT /api/v1/admin/bookings/:id/finalize-invoice`, `PUT /api/v1/admin/bookings/:id/quality-review`, `POST /api/v1/admin/bookings/:id/corrective`, `GET /api/v1/admin/bookings/:id/warranties`, `GET /api/v1/admin/warranties?serial=`

### Scenario S4-01: View booking details

**Preconditions:** A booking ID is known.

**Steps:**
1. Navigate to `/admin/bookings/<bookingId>`.
2. Verify header shows service number, service type, warranty status badge, creation date.
3. Verify parent/corrective/claim booking links appear when applicable.
4. Verify quality review status shows when reviewed or job finished.

**Expected result:** Booking header and metadata render correctly.

### Scenario S4-02: Product & service details

**Preconditions:** Booking has product details.

**Steps:**
1. Verify "Product & Service Details" card shows Brand, Model Number, Serial Number, Service Category.
2. Verify "Manage serial mapping" link appears when serial number is present, linking to `/admin/appliance-mappings?serial=...&phone=...`.
3. Click "Save Info" and verify changes persist.

**Expected result:** Product details editable and serial mapping link works.

### Scenario S4-03: Customer details

**Preconditions:** Booking has customer data.

**Steps:**
1. Verify "Customer Details" card shows name, phone, address (with pincode if present).

**Expected result:** Customer information displays.

### Scenario S4-04: Cancellation details

**Preconditions:** Booking status is CANCELLED.

**Steps:**
1. Verify "Cancellation Details" card shows reason and cancelled-at timestamp.

**Expected result:** Cancellation info displays for cancelled bookings.

### Scenario S4-05: Job sheet entries

**Preconditions:** Booking has job details.

**Steps:**
1. Verify "Job Sheet Entries" card shows Diagnosis, Work Done, Recommendations, Warranty Period.
2. Verify "Asset & Warranty Details" sub-section shows Asset, Invoice Number, Warranty Code, Warranty Desc, Asset Sale Date, Asset Expiry Date.
3. Verify "Contract & Category" sub-section shows Contract Code, Contract Desc, Contract Start Date, Contract Expiry Date, Visit Category.
4. Click "Save Entries" and verify changes persist.
5. Verify fields become read-only when sheet is locked, billed, or technician is live-editing.

**Expected result:** Job sheet editable with read-only enforcement.

### Scenario S4-06: Visits history

**Preconditions:** Booking has visits.

**Steps:**
1. Verify "Visits History" card lists visits with visit order, status, scheduled date, description.
2. Click "+ Manage Visits" and verify the visits modal opens.

**Expected result:** Visits list and manage modal work.

### Scenario S4-07: Previously installed parts (original job)

**Preconditions:** Booking has original parts.

**Steps:**
1. Verify "Previously installed parts (original job)" table shows part, serial, warranty status (Covered/replace free or warranty status).

**Expected result:** Original parts table renders.

### Scenario S4-08: Spare parts consumed

**Preconditions:** Booking has parts used in visits.

**Steps:**
1. Verify "Spare Parts Consumed" table shows part name, serial, installed date, type (Self/Inventory), quantity, cost.
2. Click "+ Add Part" and verify the add-part modal opens.
3. Verify self-sourced parts show "₹100 tech fee" note.
4. Verify warranty-covered parts show "Warranty ₹0".

**Expected result:** Parts consumed table renders with correct cost calculations.

### Scenario S4-09: Warranties

**Preconditions:** Booking has warranty records.

**Steps:**
1. Verify "Warranties" section lists warranty type, status, description, date range.
2. Use "Lookup by part serial" to search warranties by serial number.
3. Verify lookup result shows warranty details or "No warranty found for that serial."
4. Click "Open booking" from a lookup result and verify navigation.

**Expected result:** Warranty list and serial lookup work.

### Scenario S4-10: Update booking status

**Preconditions:** Booking is in an editable status.

**Steps:**
1. Use the status control to change booking status (e.g., PENDING → CONFIRMED → ASSIGNED → IN_PROGRESS → COMPLETED).
2. Verify status changes persist and page reloads.
3. For COMPLETED, verify 6-digit FIXXER CODE is required before closing.
4. Verify error appears when setting ASSIGNED/EN_ROUTE/IN_PROGRESS without a technician assigned.

**Expected result:** Status transitions work with proper validation.

### Scenario S4-11: Assign technician

**Preconditions:** Booking needs a technician.

**Steps:**
1. Use "Assigned Technician" control to select a technician.
2. Verify assignment persists and booking reloads.
3. Verify error appears when no technician is selected.

**Expected result:** Technician assignment works.

### Scenario S4-12: Finalize invoice

**Preconditions:** Booking is completed and not billed.

**Steps:**
1. Enter 6-digit FIXXER CODE.
2. Click "Finalize invoice" and confirm.
3. Verify "Service Completed and Bill Sent to User." message.
4. Verify booking reloads as billed.

**Expected result:** Invoice finalized with fixxer code validation.

### Scenario S4-13: Quality review

**Preconditions:** Booking is finished.

**Steps:**
1. Select "APPROVED" or "NEEDS_FOLLOW_UP" quality review status.
2. For NEEDS_FOLLOW_UP, enter remarks and verify alert appears if remarks are empty.
3. Verify review status updates on the booking.

**Expected result:** Quality review saved with remarks validation.

### Scenario S4-14: Create corrective booking

**Preconditions:** Booking is paid/completed.

**Steps:**
1. Click the corrective booking action (from review or job-finished state).
2. Confirm the dialog warning that the original job will not be changed.
3. Verify a new corrective booking is created and navigation occurs to it.

**Expected result:** Corrective booking created and linked.

### Scenario S4-15: Serial lookup from booking page

**Preconditions:** Booking page loaded.

**Steps:**
1. Enter a part serial in "Lookup by part serial…" and click Lookup.
2. Verify warranty details display or "No warranty found for that serial."

**Expected result:** Warranty serial lookup works.

### Scenario S4-16: Sheet locked / live from technician

**Preconditions:** Booking is billed, locked, or technician is editing.

**Steps:**
1. Verify warning banner appears: "Sheet locked · editing disabled" or "Live from technician · sheet fields are read-only".
2. Verify job sheet fields are disabled.

**Expected result:** Read-only enforcement with appropriate banners.

### Scenario S4-17: Job sheet and tax invoice

**Preconditions:** Booking has data.

**Steps:**
1. Click "Job Sheet" button and verify job sheet opens/prints.
2. Click "Tax Invoice" button and verify invoice opens/prints.

**Expected result:** Job sheet and invoice generation work.

### Scenario S4-18: Booking not found

**Preconditions:** Invalid booking ID.

**Steps:**
1. Navigate to `/admin/bookings/<invalid-id>`.
2. Verify "Booking not found." message.

**Expected result:** Error state for missing booking.

---

## 5. CustomerBookingTimelineDetails Component

**Component:** `app/admin/components/CustomerBookingTimelineDetails.tsx`

This expandable component is embedded in:
- `/admin/appliance-mappings` (phone search results and appliance timeline)
- `/admin/customers/[customerId]` (service history table)

### Section coverage

| Section | Data source | Fields verified |
|---|---|---|
| Job completion | `booking.jobCompletion` | jobClosed, jobClosedAt, paidAt, jobSheetRevision |
| Visits | `booking.visits` | visitOrder, status, timeIn, timeOut, technicianId, jobDescription |
| Parts & inventory | `booking.partsHistory.data` + `inventoryTransactions` | partName, quantity, visitOrder, installedAt, type, occurredAt |
| Warranty & related work | `booking.warranties`, `booking.warrantyClaims`, `booking.parentId`, `booking.claimBookingIds`, `booking.correctiveBookingIds` | type, status, description, dates, related booking links |
| Feedback | `booking.feedback` | rating, comment, createdAt |
| Invoice snapshot | `booking.invoiceData` | key-value pairs |

**Expected result:** All sections render with correct data; "Record details" expandable works; empty states display when no records exist.

---

## 6. Common failure modes to watch

| Symptom | Likely cause | Check |
|---|---|---|
| "No customer account found" | Phone has bookings but no customer profile | Expected; verify bookings still list |
| "Appliance mapping not found" | Serial not in mapping collection | Verify serial exists in DB |
| Status change rejected (403/400) | Job billed/closed/locked or no technician assigned | Check booking status and technician assignment |
| FIXXER CODE required | Completing a job | Enter 6-digit numeric code |
| Sheet read-only | Booking billed, locked, or technician live-editing | Check sheetLockedAt, isBilled, status |
| Pagination disabled | Single page of results | Expected when totalPages <= 1 |
| Timeline error | Backend API unavailable | Verify `/api/v1/admin/appliance-mappings/.../timeline` reachable |
| 401 Unauthorized | Missing or expired admin JWT | Re-authenticate and refresh token |

---

## 7. Test execution order (recommended)

1. **S2-01 → S2-06**: Appliance mapping directory and lookups (read-only)
2. **S2-07 → S2-08**: Mapping creation and phone association (write)
3. **S2-09 → S2-13**: Timeline, coverage notes, URL params (read + navigation)
4. **S3-01 → S3-06**: Customer profile, timeline, appliances, pagination (read)
5. **S3-07 → S3-13**: Phone search, clear, coverage notes, error states (read + write)
6. **S3-14 → S3-18**: Back navigation, badges, indicators, event types (read)
7. **S4-01 → S4-09**: Booking details, product, customer, visits, parts, warranties (read)
8. **S4-10 → S4-14**: Status, assignment, invoice, review, corrective (write)
9. **S4-15 → S4-18**: Serial lookup, lock banners, job sheet/invoice, not found (read + edge cases)

---

## 8. Backend API smoke checklist

Before frontend testing, verify these endpoints return 200 with a valid admin JWT:

- `GET /api/v1/admin/appliance-mappings`
- `GET /api/v1/admin/appliance-mappings/search?phone=<test-phone>`
- `GET /api/v1/admin/appliance-mappings/by-serial/<test-serial>`
- `GET /api/v1/admin/customers/<test-customer-id>/service-history`
- `GET /api/v1/admin/bookings/<test-booking-id>`
- `GET /api/v1/admin/warranties?serial=<test-serial>`
