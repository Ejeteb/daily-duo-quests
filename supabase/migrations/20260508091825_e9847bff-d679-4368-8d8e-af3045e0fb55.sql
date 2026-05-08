
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.finalize_weeks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  r record;
  v_week date := date_trunc('week', now())::date;
  v_a_xp int; v_b_xp int; v_winner text; v_pid uuid;
begin
  for r in select distinct user_id from public.partners loop
    select coalesce(weekly_xp,0) into v_a_xp from public.partners where user_id = r.user_id and slot='a';
    select coalesce(weekly_xp,0) into v_b_xp from public.partners where user_id = r.user_id and slot='b';
    if v_a_xp = v_b_xp then v_winner := null;
    elsif v_a_xp > v_b_xp then v_winner := 'a';
    else v_winner := 'b';
    end if;
    select id into v_pid from public.punishments order by random() limit 1;
    insert into public.weekly_winners(user_id, week_start, a_xp, b_xp, winner_slot, loser_punishment_id, loser_accepted)
      values (r.user_id, v_week, v_a_xp, v_b_xp, v_winner, v_pid, false)
      on conflict (user_id, week_start) do update
        set a_xp = excluded.a_xp, b_xp = excluded.b_xp,
            winner_slot = excluded.winner_slot,
            loser_punishment_id = coalesce(public.weekly_winners.loser_punishment_id, excluded.loser_punishment_id);
    update public.partners set weekly_xp = 0 where user_id = r.user_id;
  end loop;
end;
$$;

REVOKE ALL ON FUNCTION public.finalize_weeks() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('daily-duo-finalize-week', '59 23 * * 0',
  $$ SELECT public.finalize_weeks(); $$);
