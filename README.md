# MediFlow

MediFlow is an AI-assisted outpatient clinical documentation platform built for high-volume clinics.
It helps doctors reduce time spent on manual documentation by turning consultation conversations into structured EMR data in real time.

## Demo Video

https://drive.google.com/file/d/1hRLmQ0q5aWjXYqqNvjyfLfftncEREua2/view?usp=sharing

## Problem Statement

In many outpatient settings, doctors spend significant time documenting consultations while also managing diagnosis, prescriptions, and follow-ups.
This creates workflow friction and can reduce time available for patient interaction.

MediFlow addresses this by combining live transcription, structured EMR extraction, and safety-focused clinical workflows in a single product experience.

## Project Explanation

MediFlow supports an end-to-end clinic flow from receptionist intake to doctor consultation review:

1. Receptionist searches patient and saves intake details.
2. Doctor opens active consultation from dashboard.
3. Conversation is transcribed live.
4. EMR fields are continuously structured from transcript context.
5. Medication and allergy checks surface warnings.
6. Follow-up and consultation closure update patient history and records.
7. Consultation can be reviewed later with transcript and audit trail.

## Core Features

- Real-time speech-to-text pipeline (Deepgram Nova model family).
- AI-assisted EMR extraction and incremental updates.
- ICD-aware diagnosis and medication structuring.
- Clinical safety guards for allergy and medication conflict warnings.
- Follow-up capture and continuity-focused patient history.
- Role-based workflows for receptionist and doctor.
- Consultation audit trail for timeline and accountability.
- Searchable patient and consultation views for fast retrieval.

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: Next.js API routes
- Data: MongoDB Atlas (primary), Supabase types/utilities in project
- AI and STT: Groq LLM integration, Deepgram SDK

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Add environment variables in `.env.local`.

3. Start development server:

```bash
npm run dev
```

4. Open:

http://localhost:3000

## Team

- Jayraj Rathi
- Sarvesh Rathi
- Pranav Navandar
- Shubham Soni
