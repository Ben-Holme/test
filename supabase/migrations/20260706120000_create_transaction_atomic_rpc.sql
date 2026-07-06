-- Atomic transaction creation: inserts the transaction header and all of its
-- journal rows in a single PL/pgSQL function call. If the rows insert fails
-- for any reason, Postgres rolls back the whole function invocation (header
-- included), so it's impossible to end up with an orphaned header and zero rows.
create or replace function public.create_transaction_with_rows(
  p_datum date,
  p_beskrivning text,
  p_typ text,
  p_status text,
  p_bilagor text[],
  p_rader jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into transactions (datum, beskrivning, typ, status, bilagor)
  values (p_datum, p_beskrivning, p_typ, p_status, coalesce(p_bilagor, '{}'))
  returning id into v_id;

  insert into transaction_rader (transaction_id, konto, debet, kredit)
  select
    v_id,
    (r ->> 'konto')::numeric,
    (r ->> 'debet')::numeric,
    (r ->> 'kredit')::numeric
  from jsonb_array_elements(p_rader) as r;

  return v_id;
end;
$$;
