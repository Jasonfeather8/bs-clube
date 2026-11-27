CREATE TABLE public.pool_rounds (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  pool_id uuid NOT NULL,
  draw_id uuid NOT NULL,
  round_number integer NOT NULL,
  published_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT pool_rounds_pkey PRIMARY KEY (id),
  CONSTRAINT pool_rounds_round_number_check CHECK (round_number > 0),
  CONSTRAINT pool_rounds_pool_round_key UNIQUE (pool_id, round_number),
  CONSTRAINT pool_rounds_pool_draw_key UNIQUE (pool_id, draw_id),
  CONSTRAINT pool_rounds_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.pools(id) ON DELETE CASCADE,
  CONSTRAINT pool_rounds_draw_id_fkey FOREIGN KEY (draw_id) REFERENCES public.draws(id) ON DELETE RESTRICT
)