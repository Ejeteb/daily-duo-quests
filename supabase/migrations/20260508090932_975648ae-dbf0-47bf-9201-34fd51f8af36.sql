
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS verdict text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS text_content text;

ALTER TABLE public.weekly_winners
  ADD COLUMN IF NOT EXISTS loser_punishment_id uuid,
  ADD COLUMN IF NOT EXISTS loser_accepted boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL,
  user_id uuid NOT NULL,
  slot text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, slot, emoji)
);
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own reactions" ON public.reactions;
CREATE POLICY "own reactions" ON public.reactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.shop_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  cost_xp integer NOT NULL,
  icon text NOT NULL DEFAULT '🎁'
);
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read shop" ON public.shop_items;
CREATE POLICY "read shop" ON public.shop_items FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.shop_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  slot text NOT NULL,
  item_id uuid NOT NULL,
  week_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own purchases" ON public.shop_purchases;
CREATE POLICY "own purchases" ON public.shop_purchases
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.punishments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text text NOT NULL
);
ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read punishments" ON public.punishments;
CREATE POLICY "read punishments" ON public.punishments FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.nudges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  from_slot text NOT NULL,
  to_slot text NOT NULL,
  kind text NOT NULL DEFAULT 'reminder',
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nudges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own nudges" ON public.nudges;
CREATE POLICY "own nudges" ON public.nudges
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_submission_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  other_exists boolean;
  other_slot text;
begin
  if NEW.verdict <> 'approved' then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.verdict = 'approved' then
    return NEW;
  end if;

  other_slot := case when NEW.slot = 'a' then 'b' else 'a' end;

  if NOT NEW.awarded_solo then
    update public.partners
       set lifetime_xp = lifetime_xp + 10,
           weekly_xp = weekly_xp + 10
     where user_id = NEW.user_id and slot = NEW.slot;
    update public.submissions set awarded_solo = true where id = NEW.id;
  end if;

  select exists(
    select 1 from public.submissions
     where user_id = NEW.user_id
       and quest_date = NEW.quest_date
       and slot = other_slot
       and verdict = 'approved'
  ) into other_exists;

  if other_exists then
    update public.partners
       set lifetime_xp = lifetime_xp + 40,
           weekly_xp = weekly_xp + 40,
           streak = streak + 1,
           last_completed_date = NEW.quest_date
     where user_id = NEW.user_id;

    update public.submissions
       set awarded_bonus = true
     where user_id = NEW.user_id and quest_date = NEW.quest_date and verdict = 'approved' and awarded_bonus = false;
  end if;

  return NEW;
end;
$function$;

DROP TRIGGER IF EXISTS submissions_xp_insert ON public.submissions;
DROP TRIGGER IF EXISTS submissions_xp_update ON public.submissions;
CREATE TRIGGER submissions_xp_insert
  AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_submission_xp();
CREATE TRIGGER submissions_xp_update
  AFTER UPDATE OF verdict ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_submission_xp();

CREATE OR REPLACE FUNCTION public.purchase_shop_item(p_item_id uuid, p_slot text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_user uuid := auth.uid();
  v_cost int;
  v_xp int;
  v_week date := date_trunc('week', now())::date;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'unauthenticated'); end if;
  select cost_xp into v_cost from public.shop_items where id = p_item_id;
  if v_cost is null then return jsonb_build_object('ok', false, 'error', 'no_item'); end if;
  select lifetime_xp into v_xp from public.partners where user_id = v_user and slot = p_slot;
  if v_xp is null then return jsonb_build_object('ok', false, 'error', 'no_partner'); end if;
  if v_xp < v_cost then return jsonb_build_object('ok', false, 'error', 'not_enough_xp'); end if;
  update public.partners set lifetime_xp = lifetime_xp - v_cost where user_id = v_user and slot = p_slot;
  insert into public.shop_purchases(user_id, slot, item_id, week_start) values (v_user, p_slot, p_item_id, v_week);
  return jsonb_build_object('ok', true);
end;
$$;

DO $$ BEGIN
  PERFORM 1; -- realtime adds, ignore if already added
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.nudges; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.partners; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_winners; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.submissions REPLICA IDENTITY FULL;
ALTER TABLE public.reactions REPLICA IDENTITY FULL;
ALTER TABLE public.nudges REPLICA IDENTITY FULL;
ALTER TABLE public.partners REPLICA IDENTITY FULL;
ALTER TABLE public.weekly_winners REPLICA IDENTITY FULL;
