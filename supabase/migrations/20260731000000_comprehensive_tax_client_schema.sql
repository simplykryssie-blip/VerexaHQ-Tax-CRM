-- Migration: Comprehensive Tax Professional Client Schema
-- Extends the existing clients table and adds related tables for tax preparation.

-- 1. Extend clients table with personal and professional fields
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS middle_name text,
  ADD COLUMN IF NOT EXISTS suffix text,
  ADD COLUMN IF NOT EXISTS filing_status text CHECK (filing_status IN ('single', 'mfj', 'mfs', 'hoh', 'qss')),
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS id_number text,
  ADD COLUMN IF NOT EXISTS id_state text,
  ADD COLUMN IF NOT EXISTS id_expiration date,
  ADD COLUMN IF NOT EXISTS id_issue_date date,
  ADD COLUMN IF NOT EXISTS mailing_address_id uuid REFERENCES public.client_addresses(id),
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS ero_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS service_package text,
  ADD COLUMN IF NOT EXISTS client_since date DEFAULT CURRENT_DATE;

COMMENT ON COLUMN public.clients.filing_status IS 'IRS filing status for the current tax year.';
COMMENT ON COLUMN public.clients.id_number IS 'Driver''s license or State ID number for e-file verification.';

-- 2. Create client_spouses table
CREATE TABLE IF NOT EXISTS public.client_spouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  suffix text,
  ssn_encrypted text,
  date_of_birth date,
  occupation text,
  email text,
  phone text,
  id_number text,
  id_state text,
  id_expiration date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_spouses ENABLE ROW LEVEL SECURITY;

-- 3. Create client_dependents table
CREATE TABLE IF NOT EXISTS public.client_dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  ssn_encrypted text,
  date_of_birth date,
  relationship text,
  months_lived_with integer CHECK (months_lived_with >= 0 AND months_lived_with <= 12),
  support_percent numeric DEFAULT 0,
  is_student boolean DEFAULT false,
  is_disabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_dependents ENABLE ROW LEVEL SECURITY;

-- 4. Create client_banking table
CREATE TABLE IF NOT EXISTS public.client_banking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  bank_name text NOT NULL,
  routing_number text,
  account_number text,
  account_type text CHECK (account_type IN ('checking', 'savings')),
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_banking ENABLE ROW LEVEL SECURITY;

-- 5. Create client_tax_history table
CREATE TABLE IF NOT EXISTS public.client_tax_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  tax_year integer NOT NULL,
  agi numeric,
  refund_amount numeric,
  has_irs_notices boolean DEFAULT false,
  carryforward_loss numeric DEFAULT 0,
  carryforward_credits numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, tax_year)
);

ALTER TABLE public.client_tax_history ENABLE ROW LEVEL SECURITY;

-- 6. Create client_employment table
CREATE TABLE IF NOT EXISTS public.client_employment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  employer_name text,
  employer_ein text,
  employer_address text,
  income_type text,
  is_self_employed boolean DEFAULT false,
  business_entity_type text,
  naics_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_employment ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies (mirrored from existing clients policies)
-- Assuming a function `public.is_workspace_member(workspace_id)` exists.

DO $$
BEGIN
  -- Spouses
  CREATE POLICY "spouses_select" ON public.client_spouses FOR SELECT USING (public.is_workspace_member(workspace_id));
  CREATE POLICY "spouses_insert" ON public.client_spouses FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
  CREATE POLICY "spouses_update" ON public.client_spouses FOR UPDATE USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
  CREATE POLICY "spouses_delete" ON public.client_spouses FOR DELETE USING (public.is_workspace_member(workspace_id));

  -- Dependents
  CREATE POLICY "dependents_select" ON public.client_dependents FOR SELECT USING (public.is_workspace_member(workspace_id));
  CREATE POLICY "dependents_insert" ON public.client_dependents FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
  CREATE POLICY "dependents_update" ON public.client_dependents FOR UPDATE USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
  CREATE POLICY "dependents_delete" ON public.client_dependents FOR DELETE USING (public.is_workspace_member(workspace_id));

  -- Banking
  CREATE POLICY "banking_select" ON public.client_banking FOR SELECT USING (public.is_workspace_member(workspace_id));
  CREATE POLICY "banking_insert" ON public.client_banking FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
  CREATE POLICY "banking_update" ON public.client_banking FOR UPDATE USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
  CREATE POLICY "banking_delete" ON public.client_banking FOR DELETE USING (public.is_workspace_member(workspace_id));

  -- Tax History
  CREATE POLICY "tax_history_select" ON public.client_tax_history FOR SELECT USING (public.is_workspace_member(workspace_id));
  CREATE POLICY "tax_history_insert" ON public.client_tax_history FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
  CREATE POLICY "tax_history_update" ON public.client_tax_history FOR UPDATE USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
  CREATE POLICY "tax_history_delete" ON public.client_tax_history FOR DELETE USING (public.is_workspace_member(workspace_id));

  -- Employment
  CREATE POLICY "employment_select" ON public.client_employment FOR SELECT USING (public.is_workspace_member(workspace_id));
  CREATE POLICY "employment_insert" ON public.client_employment FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
  CREATE POLICY "employment_update" ON public.client_employment FOR UPDATE USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
  CREATE POLICY "employment_delete" ON public.client_employment FOR DELETE USING (public.is_workspace_member(workspace_id));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
