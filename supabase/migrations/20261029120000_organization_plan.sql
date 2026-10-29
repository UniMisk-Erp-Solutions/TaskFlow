-- Which pricing plan a workspace is on. New workspaces start on Free; changing it is done by the operators (service role / SQL),
-- never from the browser.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_plan_check CHECK (plan IN ('free', 'pro', 'business'));

CREATE OR REPLACE FUNCTION public.organizations_guard_plan()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'The plan can only be changed by TaskFlow';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS organizations_guard_plan ON public.organizations;
CREATE TRIGGER organizations_guard_plan BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.organizations_guard_plan();

-- Mithil's workspace is on the Business plan.
UPDATE public.organizations SET plan = 'business' WHERE id = 'b500c6fa-ae97-4e4a-97a3-1ddcf18a631a';
