# CliniQ — Step-by-Step Build Guide

> **How to use this**: Each step below is a **self-contained prompt** you drop into a new conversation (or continue this one) to get that specific piece built. Complete them in order — each step depends on the previous one.

---

## 🗂️ Pre-Work (Do This First — Manual Steps)

### Reset Your Supabase Database
1. Go to [supabase.com](https://supabase.com) → your project
2. **Settings → Database → Reset database** *(or just run the new migrations on top — they use `DROP IF EXISTS` + `CREATE`)*
3. Keep your `.env.local` as-is — same project, just clean tables

---

## STEP 1 — Database Schema (Foundation)

**What it does**: Creates all tables, RLS policies, indexes, and the ICD-10 search function. Wipes old schema.

**Prompt to use**:
```
Build the complete Supabase PostgreSQL schema for CliniQ.

Requirements:
- Wipe old tables: users, patients, consultations, transcripts, emr_entries, 
  safety_alerts, prescriptions, billing_drafts, audit_log (DROP IF EXISTS CASCADE)
- Create fresh tables: users, patients, consultations, transcripts, emr_entries,
  emr_diagnoses, icd10_codes, prescriptions, safety_alerts, audit_log
- icd10_codes must have: id UUID, code TEXT UNIQUE, description TEXT, category TEXT, 
  chapter TEXT, is_billable BOOLEAN, parent_code TEXT, is_common BOOLEAN,
  search_vector TSVECTOR (generated from code + ' ' + description)
- emr_diagnoses: id, emr_entry_id FK→emr_entries, icd_code_id FK→icd10_codes,
  diagnosis_text TEXT, is_primary BOOLEAN, confidence ENUM(high/medium/low/ai_suggested),
  added_by ENUM(ai/doctor)
- Enable RLS on all tables with appropriate policies
- Create GIN index on icd10_codes.search_vector
- Create SQL function search_icd10(query_text TEXT, result_limit INT) using pg full-text search
- Create updated_at trigger function and apply to all tables that have updated_at

Write this as: supabase/migrations/001_core_schema.sql
```

---

## STEP 2 — ICD-10 Seed Data (Common Codes)

**What it does**: Populates ~300 most common ICD-10 codes across major specialties. These are the codes that cover ~85% of real outpatient visits.

**Prompt to use**:
```
Generate a SQL seed file for the icd10_codes table with ~300 of the most commonly used 
ICD-10-CM codes in Indian outpatient/primary care settings.

Cover these categories (schema: code, description, category, chapter, is_billable, 
parent_code, is_common):
- Respiratory: J00-J18 (common cold, flu, pneumonia, asthma, COPD, bronchitis)
- Cardiovascular: I10-I25 (hypertension, chest pain, CAD, heart failure)
- Endocrine: E10-E14 (Type 1/2 diabetes, thyroid disorders)
- GI: K20-K92 (GERD, gastritis, IBS, appendicitis, constipation)
- Musculoskeletal: M00-M79 (back pain, arthritis, fractures)
- Neurological: G40-G47 (epilepsy, migraine, vertigo)
- Mental Health: F10-F45 (anxiety, depression, PTSD, insomnia)
- Infections: A00-B99 (typhoid, dengue, malaria, UTI, TB)
- Dermatology: L00-L99 (eczema, psoriasis, dermatitis)
- OB/Gyn: N00-N99, O00-O99 (UTI, PCOS, menstrual disorders)
- Pediatric: common childhood illnesses
- Injuries: S00-S99 (fractures, lacerations, sprains)
- Preventive: Z00-Z99 (routine checkup, vaccinations)

Mark all as is_common = TRUE.
Write as: supabase/migrations/002_icd10_seed.sql
```

---

## STEP 3 — Consultation Seed Data (Demo Data)

**What it does**: Creates 1 demo doctor user, 5 demo patients, and 3 past consultations so the dashboard isn't empty on first load.

**Prompt to use**:
```
Generate a SQL seed file for CliniQ demo data. 

Create:
1. One doctor user:
   - id: a fixed UUID (use '11111111-1111-1111-1111-111111111111')
   - email: doctor@cliniq.demo
   - role: doctor
   - name: Dr. Arjun Mehta
   - specialization: General Physician

2. Five patients with realistic Indian names, ages 20-70, varied conditions:
   - Mix of genders, blood groups
   - allergies and chronic_conditions populated for 2 of them
   - Phone numbers starting with +91

3. Three completed consultations (status: completed) for the doctor:
   - Each linked to a different patient
   - Each with a transcript (raw_text and 3+ segments)
   - Each with an emr_entry (chief_complaint, symptoms, assessment, clinical_summary)
   - Each with 1-2 emr_diagnoses linked to real ICD-10 codes from the seed

Write as: supabase/migrations/003_seed_data.sql

Note: These are Supabase auth-bypass records — use service role for insert.
```

---

## STEP 4 — Supabase Client Setup

**What it does**: Sets up both browser and server Supabase clients correctly using `@supabase/ssr`.

**Prompt to use**:
```
Set up Supabase client utilities for Next.js App Router in CliniQ.

Create these files:
1. src/lib/supabase/client.ts — browser client using createBrowserClient from @supabase/ssr
2. src/lib/supabase/server.ts — server client using createServerClient + cookies() from next/headers
3. src/lib/supabase/middleware.ts — session refresh middleware helper
4. src/middleware.ts — Next.js middleware that:
   - Refreshes session on every request
   - Redirects unauthenticated users to /login
   - Redirects authenticated users away from /login
   - Protects /doctor/* routes (only role='doctor' can access)

Use environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
TypeScript types should be defined in src/lib/supabase/types.ts covering all tables.
```

---

## STEP 5 — Theme System (Light/Dark)

**What it does**: CSS variable-based theme system with a toggle. No flicker on load.

**Prompt to use**:
```
Implement a complete light/dark theme system for CliniQ (Next.js + TailwindCSS v4).

Requirements:
1. Use next-themes (already installed) with ThemeProvider in src/app/layout.tsx
2. Define CSS custom properties in src/app/globals.css:
   - Light theme: clean white/gray palette, blue accent (#2563EB)
   - Dark theme: deep navy/slate palette (#0F172A base), same blue accent
   - Variables: --bg-primary, --bg-secondary, --bg-card, --text-primary, --text-secondary,
     --text-muted, --border, --accent, --accent-hover, --accent-fg, --danger, --success, 
     --warning, --radius (8px), --shadow-sm, --shadow-md
3. Create src/components/theme/ThemeToggle.tsx — animated sun/moon icon button
4. Create src/components/theme/ThemeProvider.tsx — wraps next-themes provider
5. Update src/app/layout.tsx to include ThemeProvider and set suppressHydrationWarning

Design: The dark theme should feel like a premium medical app — deep navy, not pure black.
Use HSL color system for consistent theming.
```

---

## STEP 6 — Base UI Component Library

**What it does**: Core reusable components used everywhere. Build these first so everything else uses them.

**Prompt to use**:
```
Build the base UI component library for CliniQ.

Create these components in src/components/ui/:

1. Button.tsx — variants: primary, secondary, ghost, danger; sizes: sm, md, lg; 
   loading state with spinner; icon-left and icon-right props

2. Card.tsx — Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter

3. Badge.tsx — variants: default, success, warning, danger, info, outline

4. Input.tsx — with label, error, icon-left support; styled for both themes

5. Select.tsx — custom styled dropdown (use Radix UI Select — already installed)

6. Avatar.tsx — circular avatar with fallback initials, size variants

7. Spinner.tsx — animated loading spinner, size variants

8. Modal.tsx — accessible dialog (use Radix UI Dialog — already installed) with 
   header, body, footer slots

9. Tooltip.tsx — (use Radix UI Tooltip)

All components must:
- Use CSS custom properties (--accent, --bg-card, --border, etc.) — no hardcoded colors
- Have TypeScript props with proper types
- Work in both light and dark themes
- Have subtle hover/focus animations
```

---

## STEP 7 — Doctor Dashboard Layout

**What it does**: The persistent shell — sidebar, header, theme toggle. This wraps all doctor pages.

**Prompt to use**:
```
Build the Doctor Dashboard layout for CliniQ.

Files to create:
1. src/app/doctor/layout.tsx — wraps all doctor pages with:
   - Left sidebar (collapsible, 240px expanded / 64px collapsed)
   - Top header bar (page title + doctor avatar + theme toggle)
   - Main content area with proper scroll

2. src/components/doctor/Sidebar.tsx:
   Nav items:
   - Dashboard (home icon) → /doctor
   - Patients (users icon) → /doctor/patients
   - Consultations (stethoscope icon) → /doctor/consultations  
   - History (clock icon) → /doctor/history
   - Settings (gear icon) → /doctor/settings
   
   At bottom: Doctor profile card (avatar + name + specialization)
   
   Behavior: On mobile → hidden drawer; on desktop → persistent collapsible sidebar
   Active state: accent color highlight with left border indicator

3. src/components/doctor/Header.tsx:
   - Current page title (dynamic)
   - Date + time (live updating)
   - Notification bell (for safety alerts)
   - ThemeToggle component
   - Doctor avatar → dropdown (Profile, Logout)

Design requirements:
- Sidebar background: --bg-secondary in both themes
- Feel premium — use subtle gradients, clean typography (Inter font from Google Fonts)
- Smooth collapse animation (framer-motion — already installed)
- The nav should feel like a clinical command center, not a generic admin panel
```

---

## STEP 8 — Dashboard Home Page

**What it does**: The landing page after login. Shows today's schedule, stats, and quick actions.

**Prompt to use**:
```
Build the Doctor Dashboard home page for CliniQ at src/app/doctor/page.tsx.

Sections:
1. Welcome header — "Good morning, Dr. [Name]" + today's date

2. Stats row (4 cards):
   - Today's Appointments: count from consultations where date = today
   - Active Consultations: count where status = 'active'  
   - Patients This Week: distinct patient count, last 7 days
   - Pending Reviews: emr_entries where requires_review = true

3. Quick Actions:
   - "Start New Consultation" button → opens patient search modal → creates consultation
   - "View Today's Schedule" → scrolls to schedule section

4. Today's Schedule (list):
   - List of today's consultations from DB
   - Each item: patient name, avatar, age, chief complaint, time, status badge
   - Click → navigate to /doctor/consultation/[id]
   - Empty state with illustration text if no consultations

5. Recent Patients (grid of 6):
   - Most recently consulted patients
   - Compact card: avatar, name, last visit, primary condition

Data: Fetch from Supabase using server component where possible, client component for 
real-time stats. Use the demo seed data to show populated state.

Design: Premium medical dashboard aesthetic. Use recharts for a small "consultations 
this week" sparkline chart. Subtle card shadows, clean typography.
```

---

## STEP 9 — Patient List & Patient Detail

**What it does**: Browse and search patients; view a patient's full history.

**Prompt to use**:
```
Build the patient management pages for CliniQ doctor dashboard.

1. src/app/doctor/patients/page.tsx — Patient List:
   - Search bar (filter by name, phone, ABHA ID) — real-time filtering
   - Table/grid toggle
   - Each patient row: avatar, name, age, gender, blood group, phone, 
     last consultation date, chronic conditions badges
   - Click row → /doctor/patients/[id]
   - "Add New Patient" button → modal form
   - Pagination (10 per page)

2. src/app/doctor/patients/[id]/page.tsx — Patient Detail:
   - Patient header: large avatar, name, age, blood group, allergies (red badges), 
     chronic conditions (orange badges), ABHA ID
   - Tabs:
     a. Overview: key vitals from last consultation, emergency contact
     b. Consultation History: timeline of past consultations, each expandable showing
        chief complaint, diagnosis (ICD-10 codes as badges), prescribed medications
     c. Medications: all medications ever prescribed, grouped by consultation

3. Add Patient Modal (src/components/doctor/AddPatientModal.tsx):
   - Fields: name, dob, gender, blood_group, phone, allergies (tag input), 
     chronic_conditions (tag input), address
   - Validates required fields
   - Inserts to patients table
   - Shows success toast

All data fetched from Supabase. No mock data — use the actual seed patients.
```

---

## STEP 10 — New Consultation Flow

**What it does**: The "start consultation" flow — select patient, create consultation record, navigate to the live session.

**Prompt to use**:
```
Build the New Consultation flow for CliniQ.

1. Start Consultation Modal (src/components/doctor/StartConsultationModal.tsx):
   - Step 1: Search + select patient (typeahead search from patients table)
   - Step 2: Consultation type select (General, Follow-up, Emergency, Teleconsult)
   - Step 3: Chief complaint text area (optional, can fill later)
   - "Start Session" button → creates consultation in DB (status: active) → 
     navigates to /doctor/consultation/[id]

2. Create the consultation route handler:
   POST /api/consultations/create
   Body: { patient_id, type, chief_complaint? }
   Returns: { consultation_id }
   
3. src/app/doctor/consultation/[id]/page.tsx — Consultation Shell:
   - Left panel (60%): STT + Transcript (Step 11 will fill this)
   - Right panel (40%): EMR form (Step 12 will fill this)
   - Top bar: Patient name, consultation type, timer (elapsed time), 
     "End Consultation" button
   - Real-time consultation status saved every 30 seconds

This page is the CORE of the app — make it feel like a clinical workstation.
Split-panel layout, both panels independently scrollable.
```

---

## STEP 11 — STT Recording Engine

**What it does**: The speech-to-text recording system using Deepgram Nova-2-Medical. The most critical feature.

**Prompt to use**:
```
Build the STT (Speech-to-Text) recording system using Deepgram for CliniQ.

1. API Route: src/app/api/stt/transcribe/route.ts
   - POST endpoint that accepts audio blob
   - Uses @deepgram/sdk with model: nova-2-medical
   - Returns: { transcript, confidence, words[] }
   - Uses DEEPGRAM_API_KEY from env

2. Hook: src/hooks/useSTT.ts
   - Uses browser MediaRecorder API to capture microphone audio
   - Records in 3-second chunks (configurable)
   - Sends each chunk to /api/stt/transcribe
   - Maintains running transcript: { id, text, speaker?, timestamp, confidence }[]
   - States: 'idle' | 'requesting_permission' | 'recording' | 'paused' | 'processing'
   - Exposes: { start, stop, pause, resume, status, segments, fullText, error }
   - Auto-saves transcript to Supabase transcripts table every 10 seconds
   - On stop: saves final transcript + marks processing_status as 'completed'

3. Component: src/components/stt/STTRecorder.tsx
   - Large microphone button (center) — animated pulse when recording
   - Recording timer HH:MM:SS
   - Status indicator ("Listening...", "Processing...", "Paused")
   - Waveform visualizer using AnalyserNode (animated bars that react to audio)
   - Pause / Resume / Stop buttons
   - Toggle: "Doctor speaking" / "Patient speaking" (sets speaker label on segments)

4. Component: src/components/stt/TranscriptViewer.tsx
   - Scrollable area showing all transcript segments
   - Each segment: speaker label (Doctor/Patient), timestamp, text
   - Color coded: doctor = blue tint, patient = gray tint
   - Auto-scrolls to bottom as new segments arrive
   - "Copy transcript" button
   - Word count indicator

Use: NEXT_PUBLIC_DEEPGRAM_API_KEY for client-side if streaming, DEEPGRAM_API_KEY for server-side.
```

---

## STEP 12 — LLM EMR Extraction

**What it does**: Takes the transcript text and uses Groq (LLaMA) to extract structured medical data.

**Prompt to use**:
```
Build the LLM EMR extraction pipeline for CliniQ.

1. API Route: src/app/api/emr/extract/route.ts
   - POST endpoint, body: { consultation_id, transcript_text, patient_context }
   - Uses groq-sdk with model: llama-3.3-70b-versatile (or latest)
   - System prompt: Medical transcription AI. Extract structured EMR from doctor-patient conversation.
   - Request JSON output with these fields:
     {
       chief_complaint: string,
       history_of_present_illness: string,
       symptoms: string[],
       physical_examination: string,
       assessment: string,
       plan: string,
       vitals: { bp?, hr?, temp?, spo2?, weight?, height? },
       medications: { name, dosage, frequency, duration, route }[],
       lab_tests_ordered: string[],
       icd_suggestions: { code: string, description: string, confidence: "high"|"medium"|"low" }[],
       clinical_summary: string,
       patient_summary: string
     }
   - After extraction: validate icd_suggestions codes against icd10_codes table
   - Save to emr_entries table
   - Save validated ICD codes to emr_diagnoses table (added_by = 'ai')
   - Return the full structured EMR

2. Hook: src/hooks/useEMRExtraction.ts
   - { extract, status, emrData, error }
   - Calls /api/emr/extract
   - status: 'idle' | 'extracting' | 'done' | 'error'

3. Component: src/components/emr/ExtractButton.tsx  
   - "Extract from Transcript" button
   - Shows loading state with "AI is analyzing the transcript..."
   - On success: triggers EMR form population
   - Shows confidence indicator

Use GROQ_API_KEY (server-side only).
```

---

## STEP 13 — ICD-10 Search Component

**What it does**: The ICD-10 code search — both AI-suggested chips and manual search. The heart of the coding workflow.

**Prompt to use**:
```
Build the ICD-10 search and selection component for CliniQ.

1. API Route: src/app/api/icd/search/route.ts
   - GET /api/icd/search?q=respiratory+infection&limit=10
   - Uses Supabase RPC call to search_icd10() function
   - Fallback: if results < 3, call NIH API:
     https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms={q}&maxList=10
   - Returns: { codes: { id, code, description, category, is_billable, is_common }[] }

2. Component: src/components/emr/ICD10Search.tsx
   - Combobox-style search input (type to search, debounced 300ms)
   - Dropdown shows results: "[J06.9] — Acute upper respiratory infection, unspecified"
   - Shows category tag and is_common star indicator
   - On select: adds code to "selected diagnoses" list
   - Selected diagnoses shown as removable chips below the input
   - Each chip: [IsPrimary toggle] [Code badge] [Description] [Remove button]
   - "Primary diagnosis" toggle (only one can be primary)
   - Confidence badge on AI-suggested codes (shows "AI" tag in amber)

3. Component: src/components/emr/AISuggestions.tsx
   - Shows AI-suggested ICD codes from extraction as clickable chips
   - "Accept" or "Reject" each suggestion
   - Accepted → moves to selected diagnoses with added_by = 'ai'
   - "Accept All" button

Design: This component gets heavy use — make it feel fast and precise.
Show ICD code in a monospace badge (like a pill), description in normal text.
```

---

## STEP 14 — EMR Form Panel

**What it does**: The right-side panel in a consultation. Auto-populated by AI, doctor can edit everything.

**Prompt to use**:
```
Build the EMR (Electronic Medical Record) form panel for CliniQ consultation page.

Component: src/components/emr/EMRPanel.tsx

Sections (all pre-fillable from AI extraction, all editable by doctor):

1. Vitals Row:
   - BP (sys/dia), Heart Rate, Temperature, SpO2, Weight, Height
   - Inline edit inputs, compact display

2. Chief Complaint:
   - Single line text input

3. History / Symptoms:
   - Tag-style input for symptoms list
   - Free text area for history of present illness

4. Examination:
   - Free text area for physical examination findings

5. Assessment & Plan:
   - Two side-by-side text areas (Assessment | Plan)

6. Diagnoses (ICD-10):
   - ICD10Search component (Step 13)
   - AISuggestions component (Step 13)

7. Medications:
   - Dynamic list — "Add Medication" button
   - Each row: name, dosage, frequency, duration, route
   - Delete row button

8. Lab Tests:
   - Tag-style input for lab tests ordered

9. Clinical Summary (AI-generated):
   - Read-only text area (doctor can edit)
   - Shows "AI Generated" badge

10. Patient-Friendly Summary:
    - Read-only, for patient portal (future)

Footer:
- "Save Draft" button (status: draft)
- "Complete Consultation" button → sets status: completed, ended_at: now()
- Auto-save indicator ("Saved 2s ago")

Auto-save: debounced 3s after any change → PUT /api/emr/[id]
```

---

## STEP 15 — Consultation History Page

**What it does**: Browse past consultations with their full EMR records.

**Prompt to use**:
```
Build the consultation history page for CliniQ doctor dashboard.

1. src/app/doctor/consultations/page.tsx — Consultation List:
   - Filter bar: date range, patient name, status (completed/draft/cancelled)
   - Table: date, patient (avatar + name), type, chief complaint, 
     ICD codes (first 2 as badges + "+N more"), duration, status
   - Click → /doctor/consultations/[id]
   - Pagination

2. src/app/doctor/consultations/[id]/page.tsx — Consultation Review:
   - Read-only view of the full consultation record
   - Patient info header card
   - Transcript section: show full transcript with speaker labels
   - EMR summary: all fields displayed (not form mode, display mode)
   - Diagnoses: ICD codes as badges
   - Medications: formatted table
   - Action buttons: "Export PDF", "Edit EMR" (if status === 'completed' and recent)
   
3. PDF Export: use jspdf (already installed) to generate a formatted consultation summary PDF
   - Header: CliniQ logo + doctor name + date
   - Patient info table
   - Diagnoses with ICD codes
   - Medications table  
   - Clinical summary
   - Doctor signature line
```

---

## STEP 16 — Polish & Production-Ready

**What it does**: Final glue — error boundaries, loading states, empty states, responsiveness, performance.

**Prompt to use**:
```
Polish the CliniQ doctor dashboard for production readiness.

1. Error boundaries: src/components/ErrorBoundary.tsx
   - Catch & display friendly errors with retry button

2. Loading skeletons for:
   - Dashboard stats cards
   - Patient list rows
   - Consultation timeline

3. Empty states (with illustrations using SVG) for:
   - No patients found
   - No consultations today
   - No transcript yet

4. Toast notifications (use Radix UI Toast — already installed):
   - Success: "Consultation saved", "Patient added"
   - Error: "Failed to save", "Microphone permission denied"
   - Warning: "Drug interaction detected"

5. Responsive layout:
   - Mobile: sidebar becomes bottom nav, split panel stacks vertically
   - Tablet: sidebar collapses to icons only

6. SEO: Add proper meta tags to each page (title, description)

7. Performance:
   - Add React.memo to TranscriptViewer (frequent re-renders)
   - Add useMemo to patient list filtering
   - Add suspense boundaries to data-fetching components

8. Auth:
   - Create /login page with email + password form
   - Magic link option
   - After login → redirect to /doctor (if role=doctor)
   - Logout button in sidebar
```

---

## 📌 Order Summary

| Step | What | Time est. |
|------|------|-----------|
| Pre-work | Reset Supabase DB | 2 min manual |
| 1 | Database schema | ~5 min |
| 2 | ICD-10 seed (~300 codes) | ~3 min |
| 3 | Demo consultation seed data | ~3 min |
| 4 | Supabase client setup | ~5 min |
| 5 | Theme system | ~10 min |
| 6 | Base UI components | ~15 min |
| 7 | Dashboard layout + sidebar | ~15 min |
| 8 | Dashboard home page | ~15 min |
| 9 | Patient list + detail | ~15 min |
| 10 | New consultation flow | ~10 min |
| **11** | **STT Recording Engine** | ~20 min |
| **12** | **LLM EMR Extraction** | ~15 min |
| **13** | **ICD-10 Search Component** | ~15 min |
| **14** | **EMR Form Panel** | ~20 min |
| 15 | Consultation history | ~15 min |
| 16 | Polish + production | ~20 min |

**Steps 11–14 are the core innovation — everything else is scaffolding.**

---

## 🔑 Keys/Services Summary

| Service | Key Location | Used For |
|---------|-------------|----------|
| Supabase | `.env.local` | DB + Auth + Realtime |
| Deepgram | `NEXT_PUBLIC_DEEPGRAM_API_KEY` | STT (Nova-2-Medical model) |
| Groq | `GROQ_API_KEY` | LLM EMR extraction (LLaMA 3.3 70B) |
| NIH ICD API | No key needed | Free ICD-10 search fallback |

---

## 🚀 How to Start Right Now

Just say: **"Start Step 1"** — I'll build the complete schema immediately.
Or: **"Start Steps 1-3"** — I'll build all DB migrations in one shot.

