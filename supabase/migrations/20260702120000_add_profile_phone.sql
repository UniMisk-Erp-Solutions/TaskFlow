-- Optional mobile number on profiles.
-- Set by an admin when creating a user (applies to BOTH employee and admin
-- roles). Nullable by design — the field is optional. Used for WhatsApp/SMS
-- notifications. Safe/idempotent so it can be re-run.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.profiles.phone IS 'Optional mobile number set by an admin at user creation (E.164 or local format). NULL when not provided.';
