# Midea NPS Survey Portal

A professional quality assurance platform for managing Customer Satisfaction (NPS) surveys, specifically designed for Midea Aftersales operations.

## 🚀 Features

### For Agents (Operations)
- **Daily Call Queue:** Efficiently manage today's calls and future appointments.
- **Guided Survey Script:** A step-by-step "Snake Workflow" with integrated Myanmar language scripts.
- **Resolution Verification:** Real-time check if the customer's appliance is working correctly.
- **NPS & Compliance Tracking:** Capture NPS scores and technician compliance (Uniform, Politeness, etc.).
- **Escalation Trigger:** One-click escalation for unresolved customer issues.
- **Smart Callbacks:** Schedule follow-up calls with automatic queue management.

### For Supervisors (Management)
- **Executive Dashboard:** Real-time visualization of NPS scores, CSAT, and branch rankings using Recharts.
- **Data Ingestion:** Easy CSV upload with intelligent auto-mapping of fields.
- **Technician Quality Directory:** In-depth scorecards for every technician, tracking historical performance.
- **Escalation Management:** Track and resolve customer complaints with a dedicated lifecycle workflow.
- **Team Provisioning:** Manage agent accounts and assign dedicated jobs.
- **Master Reporting:** Export comprehensive NPS reports in CSV format.

## 🛠️ Tech Stack
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4.
- **Backend:** Supabase (Auth, PostgreSQL, RLS).
- **Icons:** Lucide React.
- **Charts:** Recharts.
- **Data Processing:** PapaParse.

## 📋 Prerequisites
- Node.js (v18+)
- Supabase Project

## ⚙️ Configuration
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🏗️ Database Setup
Run the SQL script found in `supabase_schema.sql` in your Supabase SQL Editor to:
1. Create `profiles`, `work_orders`, and `surveys` tables.
2. Setup Row Level Security (RLS) policies.
3. Configure the `handle_new_user` trigger.

## 🧑‍💻 Development
```bash
npm install
npm run dev
```

---
**Version:** 2.0.0 (Production)
**Developed by:** Astra (Product Engineer)
