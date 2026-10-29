-- Billing: the Pro trial, paid-up state and payment attempts live on the workspace and are only ever written by the API
-- (service role). The browser can read nothing about it except through GET /billing/status.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_until timestamptz;
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_status_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_status_check CHECK (plan_status IN ('none', 'trialing', 'active', 'expired'));

-- Extend the guard from the plan column to every billing column.
CREATE OR REPLACE FUNCTION public.organizations_guard_plan()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
       NEW.plan IS DISTINCT FROM OLD.plan
    OR NEW.plan_status IS DISTINCT FROM OLD.plan_status
    OR NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at
    OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
    OR NEW.trial_used IS DISTINCT FROM OLD.trial_used
    OR NEW.paid_until IS DISTINCT FROM OLD.paid_until
  ) THEN
    RAISE EXCEPTION 'Billing details can only be changed by TaskFlow';
  END IF;
  RETURN NEW;
END;
$$;

-- Mithil's workspace is already on the paid Business plan.
UPDATE public.organizations SET plan_status = 'active'
  WHERE id = 'b500c6fa-ae97-4e4a-97a3-1ddcf18a631a' AND plan = 'business';

-- Payment attempts. A row is created when checkout starts and ends as succeeded, failed or cancelled.
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  plan text NOT NULL CHECK (plan IN ('pro', 'business')),
  provider text NOT NULL,
  provider_ref text,
  amount_minor integer NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_org_created_idx ON public.payments (org_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_ref_uidx ON public.payments (provider, provider_ref) WHERE provider_ref IS NOT NULL;

-- Requests from the Business "Contact Team Unimisk" form (public form, written by the API only).
CREATE TABLE IF NOT EXISTS public.business_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  work_email text NOT NULL,
  company text NOT NULL,
  job_title text NOT NULL,
  team_size text NOT NULL,
  requirements text NOT NULL,
  required_features text[] NOT NULL DEFAULT '{}',
  contact_method text NOT NULL,
  phone text,
  budget text,
  message text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_inquiries_email_created_idx ON public.business_inquiries (lower(work_email), created_at DESC);

-- Row level security with no policies: only the API (service role) can read or write these tables.
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_inquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payments FROM anon, authenticated;
REVOKE ALL ON public.business_inquiries FROM anon, authenticated;
