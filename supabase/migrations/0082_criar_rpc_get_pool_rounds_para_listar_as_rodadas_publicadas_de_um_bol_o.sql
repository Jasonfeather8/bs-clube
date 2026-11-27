create or replace function public.get_pool_rounds(p_pool_id uuid)
returns table (
  id uuid,
  round_number integer,
  contest text,
  draw_date date,
  location text,
  numbers integer[],
  published_at timestamp with time zone
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    pr.id,
    pr.round_number,
    d.contest,
    d.draw_date,
    d.location,
    d.numbers,
    pr.published_at
  from public.pool_rounds pr
  join public.draws d on d.id = pr.draw_id
  where pr.pool_id = p_pool_id
    and d.is_published
  order by pr.round_number;
$function$;