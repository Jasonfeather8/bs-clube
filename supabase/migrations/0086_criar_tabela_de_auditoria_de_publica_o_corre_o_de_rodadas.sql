CREATE TABLE public.pool_round_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.pool_rounds(id) ON DELETE SET NULL,
  draw_id uuid REFERENCES public.draws(id) ON DELETE SET NULL,
  round_number integer NOT NULL,
  action text NOT NULL CHECK (action IN ('publish', 'correct')),
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  old_numbers integer[],
  new_numbers integer[] NOT NULL,
  old_draw_date date,
  new_draw_date date NOT NULL
);