-- NPS Survey Application Schema

-- 1. Profiles Table (User Management)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT CHECK (role IN ('agent', 'supervisor')) DEFAULT 'agent',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to allow re-running the script
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Supervisors can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Supervisors can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'supervisor'
        )
    );

-- 2. Work Orders Table (CSV Uploads)
CREATE TABLE IF NOT EXISTS public.work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_no TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    customer_phone2 TEXT,
    address TEXT,
    product_model TEXT,
    product_type TEXT,
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
    status TEXT CHECK (status IN (
        'pending',           -- Ready for initial Agent call
        'callback',          -- Escalated, Complaint Received
        'finding_root_cause',-- Supervisor investigation
        'internal_discussion',
        'waiting_parts',
        'technician_assigned',
        'visit_scheduled',
        'issue_resolved',    -- Fixed by supervisor, ready for Agent re-call
        'completed',         -- Final NPS survey done (standard)
        'escalation_completed', -- Final NPS survey done (escalated)
        'refused'
    )) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    callback_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    assigned_to UUID REFERENCES public.profiles(id)
);

-- Enable RLS for work_orders
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Agents can view assigned work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Supervisors can manage all work orders" ON public.work_orders;

CREATE POLICY "Agents can view assigned work orders" ON public.work_orders
    FOR SELECT USING (auth.uid() = assigned_to OR assigned_to IS NULL);

CREATE POLICY "Supervisors can manage all work orders" ON public.work_orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'supervisor'
        )
    );

-- 3. Surveys Table (NPS Results)
CREATE TABLE public.surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE,
    survey_work_order_no TEXT, -- Store WO1 or WO2 specifically here
    agent_id UUID REFERENCES public.profiles(id),

    nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
    is_working BOOLEAN, -- Resolution Check
    verbatim TEXT,
    driver_l1 TEXT, -- L1 Driver: Call Center, Speed, Quality, Cost, Product
    driver_l2 TEXT, -- L2 Driver sub-category
    
    -- Compliance Checklist
    compliance_uniform BOOLEAN,
    compliance_politeness BOOLEAN,
    compliance_explanation BOOLEAN,
    compliance_cleanup BOOLEAN,
    compliance_receipt BOOLEAN,
    compliance_id_card BOOLEAN,
    compliance_2hr_call BOOLEAN,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for surveys
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Agents can view their own surveys" ON public.surveys;
DROP POLICY IF EXISTS "Supervisors can view all surveys" ON public.surveys;
DROP POLICY IF EXISTS "Agents can insert their own surveys" ON public.surveys;

CREATE POLICY "Agents can view their own surveys" ON public.surveys
    FOR SELECT USING (agent_id = auth.uid());

CREATE POLICY "Supervisors can view all surveys" ON public.surveys
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'supervisor'
        )
    );

CREATE POLICY "Agents can insert their own surveys" ON public.surveys
    FOR INSERT WITH CHECK (agent_id = auth.uid());

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', COALESCE(new.raw_user_meta_data->>'role', 'agent'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
