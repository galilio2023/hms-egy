# 🩺 HMS Egypt — Medical & Clinical Track
### Project Track: Medical, Nursing, Pharmacy, Lab, Radiology & Surgical

This track covers the core clinical modules of HMS Egypt. Reference [MASTER_INDEX.md](./MASTER_INDEX.md) for overall progress.

---

# PHASE 8 — Patient Module

**Status:** `[ DONE ]`
**Goal:** Full patient registration, search, profile, history, consent management.

| Tasks | Done |
|-------|------|
| 22 tasks | 22 |

---

### 8.1 Patient List & Search

- [x] **Create `/patients` list page**

### 8.2 Patient Registration

- [x] **Create `/patients/new` — Step 1: Demographics with NID magic**
- [x] **Create Steps 2-3: Address & Emergency Contact**
- [x] **Create Steps 4-5: Medical History & Insurance**
- [x] **Create Step 6: Consent & Minor Guardian**
- [x] **Create patient registration Server Actions**

### 8.3 Patient Profile

- [x] **Create `/patients/[id]` profile shell with tabs**
  > Add Surgical History tab: list of past surgical cases with date, procedure name, surgeon, OR, complications, anesthesia type.
- [x] **Create patient profile tabs**

---

# PHASE 9 — Appointments & Scheduling

**Status:** `[ DONE ]`
**Goal:** Full appointment lifecycle, doctor availability, calendar views, waiting list, telemedicine.

| Tasks | Done |
|-------|------|
| 20 tasks | 9 |

---

### 9.1 Appointments List & Calendar

- [x] **Create `/appointments` main page**
- [x] **Create `/appointments/new` booking wizard**
- [x] **Create doctor availability API**
- [x] **Create appointment Server Actions**

### 9.2 Waiting List

- [x] **Create waiting list management**

### 9.3 Appointment Reminders Cron Implementation 🆕

- [x] **Implement appointment reminder cron job** 🆕
  > 🤖 CLAUDE: `Write the appointment reminder cron job implementation for HMS Egypt at GET /api/cron/appointment-reminders:
  > Logic:
  > 1. Query appointments where scheduledDate = tomorrow AND status IN ('scheduled','confirmed') AND hospitalId is active
  > 2. For each appointment: check sent_reminders table — skip if 24h_reminder already sent (prevents duplicate on cron re-run)
  > 3. Send SMS reminder using sendAppointmentReminder(appointment, patient)
  > 4. Send email reminder if patient.email not null
  > 5. Insert record into sent_reminders for each sent notification
  > 6. Also process 2h reminders: appointments scheduledDate = today AND scheduledTime within next 2 hours, same deduplication logic
  > 7. Return summary: {processed: N, sent: {sms: N, email: N}, skipped: N, errors: [{appointmentId, error}]}
  > Protected by CRON_SECRET header check.
  > Also write the 7-day overdue invoice reminder cron at /api/cron/payment-reminders: query invoices where status IN ('pending','partial') AND dueDate < now() - interval '7 days', check sent_reminders for overdue_7days, send SMS + email, insert sent_reminders record.`

### 9.4 Telemedicine

- [x] **Create full telemedicine flow**

### 9.5 Egyptian Holiday Calendar

- [x] **Create Egyptian holiday-aware scheduling**

### 9.6 OR Availability & Surgical Scheduling 🆕

- [x] **Create OR scheduling calendar** 🆕
  > 🤖 CLAUDE: `Write the OR scheduling calendar for HMS Egypt at /surgical/schedule:
  > View: day view (default) and week view. Horizontal rows = OR rooms. Vertical axis = time (7 AM to 10 PM). Each surgical case rendered as a colored block: width = estimated duration, color = department/specialty.
  > Block schedule background: gray background shows blocked time for each OR from or_blocks, white shows open/available time.
  > Click open slot → "جدولة عملية" quick booking form (patient search, procedure, surgeon, duration, anesthesia type).
  > Click existing case → case detail drawer (patient, surgeon, checklist status badges for all 3 phases, time, estimated end, anesthesiologist).
  > Conflict detection: cannot book overlapping cases in same OR. Cannot book if cleaning period not elapsed since last case.
  > Emergency add: button "عملية طارئة" → ignores blocks, requires justification, creates case with urgency flag, notifies on-call surgeon and anesthesiologist.
  > Daily OR list print: one A4 page per OR room with all cases for the day, times, surgeons, anesthesiologist, patient names.`

---

# PHASE 10 — Clinical Modules

**Status:** `[ DONE ]`
**Goal:** SOAP medical records, ICD-10, admissions, discharge, referrals, order sets, certificates.

| Tasks | Done |
|-------|------|
| 12 tasks | 12 |

---

### 10.1 Medical Records (SOAP)

- [x] **Create medical record / visit notes form**
- [x] **Create ICD-10 code search component** 🆕 updated
  > 🤖 CLAUDE: `Write a searchable ICD-10 code picker for HMS Egypt using the local icd10-ar.json file:
  > - On component mount: load and index icd10-ar.json with Fuse.js (fields: code, descriptionEn, descriptionAr, weight code higher)
  > - Search: debounced 200ms, returns top 15 matches. User can search in Arabic or English.
  > - Result list: code (mono font, LTR) + English name + Arabic name on same row
  > - Multi-select with removable badges
  > - Common codes quick-select: hospital's top 20 most-used codes from DB stats
  > - "لا توجد نتائج" empty state
  > - Selected codes stored as text[] in medicalRecords.icdCodes
  > Do NOT make any external API call — all lookups are local from the bundled JSON file.`

- [x] **Create vitals flowsheet for inpatients**
- [x] **Create medical records API routes**
- [x] **Create order sets application flow**

### 10.2 Admissions

- [x] **Create admission form**
- [x] **Create active admissions board** — include housekeeping status per bed 🆕
- [x] **Create discharge workflow with AI summary**
  > After discharge: automatically trigger housekeeping task creation and bed status → pending_cleaning. 🆕
- [x] **Create discharge summary editor**

### 10.3 Referrals & Certificates

- [x] **Create internal referral system**
- [x] **Create medical certificate generator**

### 10.4 Radiology Module (Full)

- [x] **Create `/radiology` order queue page**

---

# PHASE 11 — Nursing & Inpatient Care

**Status:** `[ DONE ]`
**Goal:** MAR, nursing assessments, shift management, handover, vitals flowsheet, housekeeping.

| Tasks | Done |
|-------|------|
| 18 tasks | 18 |

---

### 11.1 Nurse Dashboard

- [x] **Create nurse shift dashboard `/nursing`**
  > Add: "أسرة بانتظار التنظيف" card showing count of beds in pending_cleaning status in this nurse's department.

### 11.2 Medication Administration Record (MAR)

- [x] **Create Medication Administration Record (MAR)**

### 11.3 Nursing Assessments

- [x] **Create nursing assessment forms**

### 11.4 Shift Management

- [x] **Create shift scheduling and handover**

### 11.5 Housekeeping Module 🆕

- [x] **Create `/housekeeping` dashboard** 🆕
  > 🤖 CLAUDE: `Write the housekeeping dashboard for HMS Egypt at /housekeeping (accessible to housekeeping role, admin, and head nurse):
  > Queue view: list of pending cleaning tasks, sorted by priority (urgent = bed has patient waiting) then by time requested. Each task card: room number, floor, wing, bed number, task type badge (post_discharge/routine/deep_clean), time since requested, assigned to (or "غير مسندة"), priority badge.
  > Map view: floor plan grid (same layout as bed management board) with beds color-coded: green=available, red=occupied, amber=pending_cleaning, gray=maintenance.
  > Actions per task: Assign to me (assigns to current housekeeping user), Start (records startedAt), Complete + Photo (captures photo via camera, records completedAt, updates bed status to available, notifies nursing station).
  > Supervisor view (admin): stats card — average cleaning time today, beds cleaned today, currently in-progress count, overdue (waiting > 2 hours) count.
  > Notification: when a bed is marked pending_cleaning, send push notification to all housekeeping staff in that hospital.`

- [x] **Create housekeeping task Server Actions** 🆕
  > 🤖 CLAUDE: `Write Server Actions for housekeeping in HMS Egypt (src/app/actions/housekeeping.ts):
  > createHousekeepingTask(bedId, type, priority): called automatically on patient discharge, also callable manually. Creates task record, updates bed status to pending_cleaning, notifies housekeeping staff.
  > assignTask(taskId, staffId): assigns task to a housekeeping staff member, sends notification to that staff member.
  > startTask(taskId): records startedAt, status → in_progress.
  > completeTask(taskId, completionPhotoUrl?): records completedAt, status → completed, updates bed.status → available, notifies nursing station "السرير [number] جاهز للاستقبال", creates audit log entry.
  > All scoped to hospitalId from session. Housekeeping role can only assign to self; admin can assign to any.`

---

# PHASE 12 — Pharmacy Module
 
**Status:** `[ DONE ]`
**Goal:** Prescription queue, dispensing with barcode verification, inventory, expiry tracking, DDI database.   
 
| Tasks | Done |
|-------|------|
| 16 tasks | 16 |

---

### 12.1 Pharmacy Dashboard

- [x] **Create `/pharmacy` main dashboard**
### 12.2 Prescription Writer (Doctor Side)

- [x] **Create prescription writer** 🆕 updated
  > DDI check: use the medication_interactions table as primary source (fast,
local DB query) before calling Claude AI. Only call Claude if no match found in local DB or if AI
enrichment is enabled. Allergy check: use drug_allergy_cross_references table to check all brand/generic        
equivalents, not just string matching against patient.allergies[].

### 12.3 DDI Check Implementation 🆕

- [x] **Create local DDI check service** 🆕
  > 🤖 CLAUDE: `Write the local DDI check service for HMS Egypt (src/lib/pharmacy/ddi.ts):
  > checkDrugInteractions(medications: {name: string, genericName?: string}[], patientAllergies: string[], chronicConditions: string[], renalFunction: string, hepaticFunction: string): Promise<DdiResult>
  > DdiResult: { interactions: Interaction[], allergyAlerts: AllergyAlert[], contraindications: Contraindication[], overallRiskLevel: 'low'|'medium'|'high', isApproved: boolean, requiresAiEnrichment: boolean }
  > Step 1: Query medication_interactions table for all pairs in the prescription (O(n²) pairs where n = medication count, typically 1-5 medications). Use OR query: (drug1Name ILIKE any(names) AND drug2Name ILIKE any(names)).
  > Step 2: Query drug_allergy_cross_references for all medications against patient allergies.
  > Step 3: Determine overall risk level and isApproved.
  > Step 4: Set requiresAiEnrichment = true if medication count > 5 (complex polypharmacy) OR if patient has >3 chronic conditions (AI can catch context-specific risks the database may miss).
  > If requiresAiEnrichment: also call the Claude DDI API and merge results (prefer more severe rating if conflict). Log this to ai_audit_logs.
  > Return combined DdiResult.`

### 12.4 Inventory Management

- [x] **Create `/pharmacy/inventory` page**
- [x] **Inventory adjustments and stock-in workflow**
- [x] **Transaction history tracking**
- [x] **Create stock alerts and reporting**

---

# PHASE 13 — Laboratory Module

**Status:** `[ DONE ]`
**Goal:** Full lab order lifecycle, critical value alerts, result trends, LOINC codes, MOH formats.

| Tasks | Done |
|-------|------|
| 16 tasks | 16 |

---

### 13.1 Lab Dashboard

- [ ] **Create `/laboratory` main dashboard**

### 13.2 Lab Order Form (Doctor Side)

- [ ] **Create lab order form** 🆕 updated
  > When displaying test list: show LOINC code alongside nameAr/nameEn (in smaller mono text) for staff who know standard codes. LOINC code is displayed only — it does not affect ordering workflow. This helps with insurance claims that require LOINC.

### 13.3 Result Entry

- [ ] **Create result entry form**
- [ ] **Create critical value alert workflow**
- [ ] **Create lab result report (print)**
  > Print report: include LOINC code in the test name column (parenthetical, small text). Required by some Egyptian insurance companies for claim documentation. 🆕
- [ ] **Create lab turnaround time monitoring**

---

# PHASE 14 — Radiology Module

**Status:** `[ PENDING ]`
**Goal:** Full radiology workflow including DICOM/PACS integration guidance and reporting.

| Tasks | Done |
|-------|------|
| 12 tasks | 0 |

---

- [ ] **Create `/radiology` order queue page**
- [ ] **Create DICOM / PACS integration guide** 🆕
  > 🤖 CLAUDE: `Write a DICOM/PACS integration guide and implementation for HMS Egypt:
  > Context: many Egyptian hospitals use standalone PACS systems (Orthanc, Synapse, Sectra). HMS Egypt does not replace the PACS viewer but links to it.
  > Implementation:
  > 1. radiology_orders.pacsStudyId: stores the Study Instance UID from the PACS system (manually entered by radiology tech or received via HL7 worklist)
  > 2. radiology_orders.pacsStudyUrl: stores direct URL to open the study in the hospital's PACS viewer (e.g. https://pacs.hospital.com/study/{studyUID})
  > 3. "فتح في PACS" button on radiology order: opens pacsStudyUrl in new tab — no iframe (PACS viewers don't support embedding)
  > 4. For hospitals using Orthanc (open source PACS): write a helper GET /api/radiology/orthanc-studies?patientId={id}&date={date} that calls the Orthanc REST API (/studies?PatientID=&StudyDate=) and returns matching studies. Store ORTHANC_URL + ORTHANC_AUTH in env vars.
  > 5. imageUrls[] column: stores direct image URLs for lightweight preview thumbnails (not full DICOM — just JPEG previews from PACS or uploaded manually).
  > Write: the Orthanc API helper, the "Open in PACS" button component, and the env vars documentation.`

- [ ] **Create radiology report templates (print)**
- [ ] **Create radiology statistics dashboard**

---

# PHASE 21 — Surgical Module 🆕

**Status:** `[ PENDING ]`
**Goal:** Full OR scheduling, surgical case management, WHO safety checklists, anesthesia records.

| Tasks | Done |
|-------|------|
| 14 tasks | 0 |

---

### 21.1 Surgical Case Management

- [ ] **Create `/surgical` main page with case queue** 🆕
  > 🤖 CLAUDE: `Write the surgical module main page for HMS Egypt at /surgical:
  > Today's OR board: card per OR room (same as utilization dashboard). List of today's cases below.
  > Case queue: list of upcoming surgical cases (next 7 days). Each row: case number, patient name, procedure, surgeon, OR, scheduled time, ASA class, status badge, checklists progress (3 phase indicators: Sign-In/Time-Out/Sign-Out each as ✅ or ⬜).
  > Filters: date, surgeon, OR room, department, status, ASA class
  > Quick stats: this week's cases count, average duration, cancellation rate`

- [ ] **Create surgical case creation form** 🆕
  > 🤖 CLAUDE: `Write the surgical case creation form for HMS Egypt at /surgical/new:
  > Step 1 - Patient: search patient, show allergies + blood type prominently (critical for surgical team)
  > Step 2 - Procedure: procedure name (Arabic + English), CPT code picker (from cpt-egypt.json), ICD-10 diagnosis codes (multi-select), estimated duration slider (15-min increments), whether day surgery or overnight admission
  > Step 3 - Team: lead surgeon (required, select from surgical department staff), assistant surgeons (multi-select, optional), anesthesiologist (required if general/regional/spinal), OR nurse (optional at booking stage)
  > Step 4 - OR & Time: OR room selector (shows availability grid for selected date), date picker (highlights available slots), time picker (from block schedule)
  > Step 5 - Clinical: ASA classification (dropdown with Arabic descriptions of each class), anesthesia type, known allergies review (read from patient record), last NPO time (for emergency cases), special equipment needed (checklist of OR equipment)
  > Step 6 - Confirm: full summary, "جدولة العملية" button. On submit: create surgical_case, create 3 checklist records (one per phase from templates), if admission needed create admission record, notify assigned surgical team, add to OR schedule.`

- [ ] **Create pre-op checklist workflow (Sign In)** 🆕
  > 🤖 CLAUDE: `Write the pre-operative Sign In checklist workflow for HMS Egypt:
  > Page /surgical/cases/[id]/checklist/pre-op
  > Shows pre-op checklist template items (WHO Sign In phase). For each item: checkbox, Arabic item description, optional notes field. Some items have "initials required" flag — shows signature pad.
  > Key items (adapt WHO SSC to Egyptian context):
  > - تأكيد هوية المريض (identity confirmed with wristband)
  > - الموافقة موقعة (consent form signed — links to consent record)
  > - منطقة العملية محددة (surgical site marked)
  > - فحص التخدير مكتمل (anesthesia machine checked)
  > - مقياس الأكسجين يعمل (pulse oximeter functional)
  > - الحساسية المعروفة (known allergies confirmed)
  > - صعوبة مجرى الهواء مقيمة (difficult airway assessed)
  > - خطر نزيف > 500 مل مقيم (blood loss risk assessed)
  > Cannot mark case status → in_progress until all mandatory items are completed. Records completedBy, completedAt on checklist record.`

- [ ] **Create intraoperative Time Out checklist** 🆕
  > 🤖 CLAUDE: `Write the Time Out checklist for HMS Egypt (WHO Time Out phase):
  > Page /surgical/cases/[id]/checklist/time-out. Must be completed BEFORE incision.
  > Items:
  > - تعريف جميع أعضاء الفريق (all team members introduced — select each role present from staff list)
  > - تأكيد اسم المريض والإجراء والمنطقة (patient name, procedure, and site confirmed — all 3 must be checked)
  > - المضادات الحيوية الوقائية أُعطيت (prophylactic antibiotics given — if applicable, link to MAR entry)
  > - صور الأشعة معروضة (relevant imaging displayed)
  > - المخاوف الحرجة (critical concerns from surgeon, anesthesiologist, nurse — free text each)
  > UI: large format optimized for reading aloud in OR (20px+ text, high contrast), designed for touch (large checkboxes), can be done on a tablet mounted in OR.`

- [ ] **Create post-op Sign Out checklist** 🆕
  > 🤖 CLAUDE: `Write the Sign Out checklist for HMS Egypt (WHO Sign Out phase):
  > Page /surgical/cases/[id]/checklist/sign-out
  > Items:
  > - اسم الإجراء مسجل (procedure name recorded)
  > - عدد الآلات والشاش صحيح (instrument and sponge counts correct — counts recorded as number)
  > - العينات موسومة (specimens labeled correctly — if any, enter specimen descriptions)
  > - أي مشكلات في المعدات (equipment problems to address)
  > - مراجعة التعافي (recovery plan reviewed by surgeon/anesthesia/nurse)
  > Completing Sign Out → surgical_case.status → post_op → triggers: create post-op nursing tasks, alert recovery room nurse, update OR schedule (room now in cleaning phase), trigger housekeeping task for OR room.`

- [ ] **Create anesthesia record form** 🆕
  > 🤖 CLAUDE: `Write the anesthesia record form for HMS Egypt at /surgical/cases/[id]/anesthesia:
  > Pre-assessment section: ASA classification (with Arabic descriptions), NPO status (last oral intake), pre-medications given (multi-select: midazolam, atropine, metoclopramide, etc.), airway assessment (Mallampati class I-IV, neck mobility, mouth opening, dentition notes)
  > Induction section: induction agents (multi-select with dose fields: propofol, ketamine, etomidate, thiopental), airway management (intubation type, tube size, cuff pressure, laryngoscope blade)
  > Maintenance section: inhalational agents (isoflurane/sevoflurane/desflurane with % concentration), IV agents (propofol infusion), regional techniques if used
  > Vascular access: list of IV lines and central lines placed
  > Intraoperative vitals table: time-series grid, 5-minute intervals, columns: BP sys/dia, HR, SpO2, EtCO2, temperature, anesthesia depth (BIS if available). Quick "Record Now" button adds current timestamp row.
  > Fluid balance: crystalloids in (mL), colloids in (mL), blood products (units and type), estimated blood loss (mL), urine output (mL)
  > Recovery: Aldrete score (0-10, 5 components each 0-2), extubation time, transfer to recovery room time
  > Post-op pain management: analgesic plan, PCA settings if applicable
  > Complications: free text
  > Auto-saves every 30 seconds (intraoperative forms must not lose data).`

- [ ] **Create surgical case detail view** 🆕
  > 🤖 CLAUDE: `Write the surgical case detail page for HMS Egypt at /surgical/cases/[id]:
  > Header: case number, status badge, patient name + number + blood type + allergies banner, procedure name, OR room, scheduled time
  > Team panel: surgeon (with photo/avatar), assistants, anesthesiologist, OR nurses — each with clock-in status (present/not yet arrived)
  > Timeline: case events log — scheduled, pre-op started, checked in, anesthesia started, incision, close, anesthesia end, recovery
  > Checklist status panel: 3 phase cards (Sign In / Time Out / Sign Out) — each shows: status (pending/completed), who completed it, when, number of items completed/total. Click to open checklist.
  > Anesthesia record summary: ASA, type, key agents, duration
  > Documents: consent forms (with link to view), pre-op imaging (links to radiology orders), post-op notes
  > Actions (role-dependent): Edit case details, Cancel case, Print OR list, Print anesthesia record, Create invoice for case`

- [ ] **Create surgical case cancellation / postponement flow** 🆕
- [ ] **Create OR block schedule management UI** 🆕
  > 🤖 CLAUDE: `Write the OR block schedule management page for HMS Egypt at /surgical/blocks (admin only):
  > Weekly grid: OR rooms as rows, days of week as columns. Each block shown as colored band with department/surgeon name. Gaps = unblocked (open) time.
  > Add block: click empty slot → form: surgeon, department, recurring days, start/end time, effective dates.
  > Edit block: click existing block → edit form, option to create override for specific date (one-off change without affecting recurring schedule).
  > Cancel block for date: select specific date, add reason. Creates or_block_overrides record.
  > Emergency takeover: override any block for an emergency surgical case on a specific date.
  > Print weekly OR schedule: A4 landscape showing all ORs, blocks, and booked cases for the week.`

- [ ] **Create surgical consent workflow** 🆕
  > 🤖 CLAUDE: `Write the surgical consent capture workflow for HMS Egypt:
  > When creating a surgical case, the system checks for required consents:
  > - consent_for_surgery (always required)
  > - consent_for_anesthesia (required if general, regional, or spinal)
  > - consent_for_blood_transfusion (required if blood loss risk > 500mL or ASA 3+)
  > - consent_for_photography (optional — required if teaching hospital)
  > Consent capture page /surgical/cases/[id]/consent:
  > - Shows each required consent form in Arabic (full text, scrollable)
  > - Signature pad for patient (or guardian for minors)
  > - Witness field (select from present staff)
  > - Guardian signature + details if patient is minor
  > - Submit → creates patient_consents records (type: surgery/anesthesia/blood_transfusion)
  > Pre-op checklist item "الموافقة موقعة" links to this consent record for verification.`

- [ ] **Create surgical reports** 🆕
  > (Covered in Phase 17 — surgical statistics report and OR utilization dashboard)

- [ ] **Create surgical module Server Actions** 🆕
  > 🤖 CLAUDE: `Write all Server Actions for the surgical module in HMS Egypt (src/app/actions/surgical.ts):
  > createSurgicalCase(data): validate, check OR availability (no overlap + cleaning buffer), create surgical_case record, create 3 empty checklist records from templates, notify surgical team, return case
  > updateSurgicalCase(id, data): validate permissions (only lead surgeon or admin), check if case is editable (not yet in_progress), update, audit log
  > cancelSurgicalCase(id, reason): status → cancelled, free OR slot, notify team
  > postponeSurgicalCase(id, newDate, newTime, reason): status → postponed, update schedule, notify team
  > startPreOp(id): status → pre_op, record pre-op start time
  > startCase(id): validate Sign In checklist complete, status → in_progress, record actualStartTime
  > completeCase(id, completionData): validate Sign Out checklist complete, status → completed, record actualEndTime, trigger OR cleaning housekeeping task, trigger post-op nursing tasks
  > completeChecklist(checklistId, items): save checklist items with who completed each item, mark checklist as completed
  > saveAnesthesiaRecord(caseId, data): upsert anesthesia_records for this case, validate anesthesiologist permission
  > All scoped to hospitalId from session.`

---
