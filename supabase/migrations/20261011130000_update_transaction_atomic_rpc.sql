-- Atomic draft editing: updates a transaction's beskrivning and/or replaces
-- its journal rows in a single call, so a partial failure can't leave rows
-- deleted without their replacement inserted. Restricted to utkast (draft)
-- status — a bokförd/betald transaction must go through
-- update_transaction_status / delete_transaction instead, so already-filed
-- numbers can't be silently rewritten from a chat session.
create or replace function public.update_transaction_with_rows(
  p_id uuid,
  p_beskrivning text default null,
  p_rader jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from transactions where id = p_id for update;

  if v_status is null then
    raise exception 'Transaction % not found', p_id;
  end if;

  if v_status <> 'utkast' then
    raise exception 'Only draft (utkast) transactions can be edited with update_transaction — this transaction has status %', v_status;
  end if;

  if p_beskrivning is not null then
    update transactions set beskrivning = p_beskrivning where id = p_id;
  end if;

  if p_rader is not null then
    delete from transaction_rader where transaction_id = p_id;

    insert into transaction_rader (transaction_id, konto, debet, kredit)
    select
      p_id,
      (r ->> 'konto')::numeric,
      (r ->> 'debet')::numeric,
      (r ->> 'kredit')::numeric
    from jsonb_array_elements(p_rader) as r;
  end if;

  return p_id;
end;
$$;
