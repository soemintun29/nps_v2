-- ==========================================
-- SUPABASE SYNC & MIGRATION SCRIPT
-- ==========================================
-- Purpose: Sync the NPS Survey App database structure without data loss.
-- This script adds missing tables/columns, updates functions, and refreshes policies.
-- ==========================================

-- 1. CREATE TABLES (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    role TEXT CHECK (role IN ('agent', 'supervisor')) DEFAULT 'agent',
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_no TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    customer_phone2 TEXT,
    address TEXT,
    product_model TEXT,
    product_type TEXT,
    brand TEXT,
    repair_date DATE,
    warranty TEXT,
    total_fee NUMERIC,
    technician_name TEXT,
    service_center TEXT,
    solution TEXT,
    remark TEXT,
    escalation_note TEXT,
    voice_of_technician TEXT,
    internal_remark TEXT,
    new_technician_assigned TEXT,
    new_work_order_no TEXT,
    new_solution TEXT,
    scheduled_date DATE,
    completed_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    callback_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    assigned_to UUID REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE,
    survey_work_order_no TEXT,
    agent_id UUID REFERENCES public.profiles(id) DEFAULT auth.uid(),
    nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
    is_working BOOLEAN,
    verbatim TEXT,
    driver_l1 TEXT,
    driver_l2 TEXT,
    compliance_uniform BOOLEAN,
    compliance_politeness BOOLEAN,
    compliance_explanation BOOLEAN,
    compliance_cleanup BOOLEAN,
    compliance_receipt BOOLEAN,
    compliance_id_card BOOLEAN,
    compliance_2hr_call BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. ENSURE ALL COLUMNS EXIST (Migration)

-- Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('agent', 'supervisor')) DEFAULT 'agent';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Work Orders
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS work_order_no TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_phone2 TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS product_model TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS repair_date DATE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS warranty TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS total_fee NUMERIC;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS technician_name TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS service_center TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS solution TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS escalation_note TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS voice_of_technician TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS internal_remark TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS new_technician_assigned TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS new_work_order_no TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS new_solution TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS completed_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS callback_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id);

-- Surveys
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS survey_work_order_no TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.profiles(id) DEFAULT auth.uid();
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10);
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS is_working BOOLEAN;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS verbatim TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS driver_l1 TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS driver_l2 TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS compliance_uniform BOOLEAN;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS compliance_politeness BOOLEAN;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS compliance_explanation BOOLEAN;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS compliance_cleanup BOOLEAN;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS compliance_receipt BOOLEAN;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS compliance_id_card BOOLEAN;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS compliance_2hr_call BOOLEAN;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. IDENTITY FUNCTIONS (Security & Auto-Naming)
CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'supervisor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id, 
    CASE 
      WHEN new.email = 'yinmyothu@vsk.com.mm' THEN 'Yin Myo Thu'
      WHEN new.email = 'mrsoemintun@gmail.com' THEN 'Soe Min Tun'
      WHEN new.email = 'ygnmideacare@vsk.com.mm' THEN 'Win Lai Mon'
      WHEN new.email = 'winlai.mon@vsk.com.mm' THEN 'Win Lai Mon'
      WHEN new.email = 'soemintun@vsk.com.mm' THEN 'Soe Min Tun'
      ELSE INITCAP(REPLACE(SPLIT_PART(new.email, '@', 1), '.', ' '))
    END,
    new.email,
    CASE 
      WHEN new.email IN (
        'mrsoemintun@gmail.com', 
        'yinmyothu@vsk.com.mm', 
        'winlai.mon@vsk.com.mm', 
        'soemintun@vsk.com.mm', 
        'ygnmideacare@vsk.com.mm'
      ) THEN 'supervisor'
      ELSE 'agent'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. SETUP TRIGGER (Safe Creation)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END;
$$;

-- 5. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 6. SECURITY POLICIES (Refresh)

-- Profiles
DROP POLICY IF EXISTS "Supervisors view all profiles" ON public.profiles;
CREATE POLICY "Supervisors view all profiles" ON public.profiles FOR SELECT USING (public.is_supervisor());
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- Work Orders
DROP POLICY IF EXISTS "Supervisors manage work orders" ON public.work_orders;
CREATE POLICY "Supervisors manage work orders" ON public.work_orders FOR ALL USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());
DROP POLICY IF EXISTS "Agents view assigned jobs" ON public.work_orders;
CREATE POLICY "Agents view assigned jobs" ON public.work_orders FOR SELECT USING (auth.uid() = assigned_to OR assigned_to IS NULL);
DROP POLICY IF EXISTS "Agents update assigned jobs" ON public.work_orders;
CREATE POLICY "Agents update assigned jobs" ON public.work_orders FOR UPDATE USING (auth.uid() = assigned_to OR assigned_to IS NULL) WITH CHECK (auth.uid() = assigned_to OR assigned_to IS NULL);

-- Surveys
DROP POLICY IF EXISTS "Supervisors view all surveys" ON public.surveys;
CREATE POLICY "Supervisors view all surveys" ON public.surveys FOR SELECT USING (public.is_supervisor());
DROP POLICY IF EXISTS "Agents manage own surveys" ON public.surveys;
CREATE POLICY "Agents manage own surveys" ON public.surveys FOR ALL USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());

-- Settings
DROP POLICY IF EXISTS "Everyone can view settings" ON public.settings;
CREATE POLICY "Everyone can view settings" ON public.settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Supervisors can manage settings" ON public.settings;
CREATE POLICY "Supervisors can manage settings" ON public.settings FOR ALL USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());

-- 7. SYNC CURRENT TEAM (Preserving user edits where appropriate, but ensuring roles are correct)
INSERT INTO public.profiles (id, full_name, email, role)
SELECT 
    id, 
    CASE 
      WHEN email = 'yinmyothu@vsk.com.mm' THEN 'Yin Myo Thu'
      WHEN email = 'mrsoemintun@gmail.com' THEN 'Soe Min Tun'
      WHEN email = 'ygnmideacare@vsk.com.mm' THEN 'Win Lai Mon'
      WHEN email = 'winlai.mon@vsk.com.mm' THEN 'Win Lai Mon'
      WHEN email = 'soemintun@vsk.com.mm' THEN 'Soe Min Tun'
      ELSE INITCAP(REPLACE(SPLIT_PART(email, '@', 1), '.', ' '))
    END,
    email, 
    CASE 
      WHEN email IN (
        'mrsoemintun@gmail.com', 
        'yinmyothu@vsk.com.mm', 
        'winlai.mon@vsk.com.mm', 
        'soemintun@vsk.com.mm', 
        'ygnmideacare@vsk.com.mm'
      ) THEN 'supervisor'
      ELSE 'agent'
    END
FROM auth.users
ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    role = EXCLUDED.role; 
    -- Note: full_name is NOT updated here to preserve manual edits if any, 
    -- unless you want to force sync it too.

-- 8. SEED INITIAL SETTINGS (Preserve existing values)
INSERT INTO public.settings (key, value) VALUES 
('nps_target', '40'),
('drivers_taxonomy', '{
  "promoter": {
    "Call Center": ["Easy to get in touch with CC", "Took a short time to register complaint", "Easy to navigate automatic answering system", "CC employee was polite and courteous", "Clear information provided on expected time of visit", "Information provided on current status", "Others"],
    "Speed of Service": ["No delay in fixing appointment", "On-time engineer visit", "Did not take a long time to complete the job", "Did not take a long time to get spares", "Did not take a long time to get product replacement", "Did not visited multiple times to complete the job", "Others"],
    "Quality of Service": ["Engineer was knowledgeable", "Engineer was polite and courteous", "Engineer was dressed neatly", "Engineer clearly explained the problem to me", "Engineer provided proper repair", "Engineer used genuine parts", "Engineer was adequately prepared for the job", "Engineer installed the machine properly", "Others"],
    "Cost of Service": ["Engineer charged correctly", "Service was not expensive", "Engineer provided receipt", "Warranty coverage was adequate", "Free service was provided", "Others"],
    "Product Experience": ["Machine does not break down", "Machine parts are of high quality", "Machine is easy to use", "Machine cools / wash effectively", "Does not take long time to cool /wash", "Machine does not make noise", "Machine was delivered in proper condition", "Machine has good design / looks", "Machine parts and accessories meet requirements", "Customer are aware in products knowledge", "Others"]
  },
  "detractor": {
    "Call Center": ["Difficult to get through to CC", "Took a long time to register complaint", "Difficult to navigate automatic answering system", "CC employee was impolite", "No information on expected time of visit", "No information on current status", "Others"],
    "Speed of Service": ["CC employee was impolite", "Delay in engineer visit", "Long time to complete the job", "Long time to get spares", "Long time to get product replacement", "Visited multiple times to complete the job", "Others"],
    "Quality of Service": ["Engineer was not knowledgeable", "Engineer was impolite", "Engineer was dressed shabbily", "Engineer did not explain the problem to me", "Engineer did not provide proper repair", "Engineer did not use genuine parts", "Engineer was not adequately prepared for the job", "Engineer did not install the machine properly", "Others"],
    "Cost of Service": ["Engineer charged incorrectly", "Service was expensive", "Engineer did not provide receipt", "Warranty coverage was inadequate", "Free service was not provided", "Others"],
    "Product Experience": ["Machine breaks down frequently", "Machine parts are of poor quality", "Machine is difficult to use", "Does not cool / wash effectively", "Long time to cool /wash", "Machine is noisy", "Machine was delivered in damaged condition", "Machine design / looks should be improved", "Machine parts and accessories do not meet requirements", "Customer are not aware in products knowledge", "Others"]
  }
}') ON CONFLICT (key) DO NOTHING;
