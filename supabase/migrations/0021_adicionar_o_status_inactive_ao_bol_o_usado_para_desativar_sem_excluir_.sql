DO $$
BEGIN
  ALTER TABLE public.pools DROP CONSTRAINT pools_status_check;
  ALTER TABLE public.pools ADD CONSTRAINT pools_status_check CHECK (status = ANY (ARRAY['draft'::text, 'open'::text, 'late_registration'::text, 'closed'::text, 'completed'::text, 'inactive'::text]));
END $$