CREATE TABLE public.bet_attempts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pool_id uuid,
  sets_count integer DEFAULT 0 NOT NULL,
  total_amount numeric(14,2),
  outcome text NOT NULL,
  message text,
  number_sets jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT bet_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT bet_attempts_outcome_check CHECK (outcome IN ('success', 'failed')),
  CONSTRAINT bet_attempts_sets_count_check CHECK (sets_count >= 0)
);