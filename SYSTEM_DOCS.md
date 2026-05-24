# Midea NPS Portal - System Documentation

## 1. Overview
The Midea NPS Portal is a professional quality assurance platform designed to manage the end-to-end lifecycle of Customer Satisfaction surveys, from initial call to service recovery (escalation).

## 2. Supabase Configuration (Backend)

### 2.1 Database Schema
All SQL table definitions, triggers, and Row Level Security (RLS) policies are located in:
`D:\My_AI_Team\Owner's Inbox\nps-survey-app\supabase_schema.sql`

**Key Tables:**
*   `profiles`: User accounts (Agents/Supervisors).
*   `work_orders`: Central job repository (Imported from CSV).
*   `surveys`: NPS results and compliance checklists.

### 2.2 Critical SQL Maintenance Commands
If you ever reset the database, ensure these columns and constraints are active:
```sql
-- Standard Service Center & Recovery fields
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS service_center TEXT,
ADD COLUMN IF NOT EXISTS new_work_order_no TEXT,
ADD COLUMN IF NOT EXISTS new_solution TEXT,
ADD COLUMN IF NOT EXISTS escalation_note TEXT,
ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scheduled_date DATE,
ADD COLUMN IF NOT EXISTS completed_date TIMESTAMP WITH TIME ZONE;

-- Status Lifecycle Constraint
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_status_check 
CHECK (status IN ('pending', 'callback', 'finding_root_cause', 'internal_discussion', 'waiting_parts', 'technician_assigned', 'visit_scheduled', 'issue_resolved', 'completed', 'escalation_completed', 'refused'));
```

### 2.3 Authentication Setup
1.  Go to **Authentication > Settings**.
2.  Enable **Email/Password** provider.
3.  Set **Email Rate Limit** to a higher value (e.g., 30/hour) for team provisioning.
4.  Standard Email domain used: `@midea-internal.com`.

---

## 3. Deployment Documentation (Vercel)

### 3.1 Environment Variables
When deploying to Vercel, you **must** add these Environment Variables in the Vercel Project Settings:

| Key | Value |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anon/Public Key |

### 3.2 Vercel Deployment Steps
1.  Login to [vercel.com](https://vercel.com) using your GitHub account.
2.  Click **"Add New"** > **"Project"**.
3.  Select the **`NPS_Survey`** repository.
4.  **Framework Preset:** Vite (should auto-detect).
5.  **Build Command:** `npm run build`.
6.  **Output Directory:** `dist`.
7.  Click **"Environment Variables"** and add the keys from Section 3.1.
8.  Click **"Deploy"**.

---

## 4. Operational Guide

### 4.1 Supervisor Workflow
1.  **Dashboard:** Visual performance analytics by branch/tech.
2.  **Upload:** CSV data ingestion (DD/MM/YYYY format supported).
3.  **Escalation:** Management of unresolved issues.
4.  **Admin:** Provisioning team accounts and password resets.

### 4.2 Agent Workflow
1.  **Daily Queue:** Active jobs for calling.
2.  **Snake Workflow:** Guided 18-step survey script.
3.  **Callbacks:** Rescheduling for line drops or customer requests.

---
**Version:** 1.0.0 (Release Candidate)
**Author:** Astra (AI Product Engineer)
