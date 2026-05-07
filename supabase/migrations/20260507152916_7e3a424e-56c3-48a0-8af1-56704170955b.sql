
-- ============ TABLES ============

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null check (slot in ('a','b')),
  display_name text not null,
  accent text not null default 'purple' check (accent in ('purple','cyan','pink','green')),
  avatar_url text,
  lifetime_xp int not null default 0,
  weekly_xp int not null default 0,
  streak int not null default 0,
  last_completed_date date,
  current_week_start date,
  created_at timestamptz not null default now(),
  unique (user_id, slot)
);

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  category text not null check (category in ('visual','audio','action','memory','silly','sensory')),
  accepts text not null default 'image' check (accepts in ('image','audio','either'))
);

create table public.daily_quests (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_date date not null,
  quest_id uuid not null references public.quests(id),
  used_quest_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, quest_date)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_date date not null,
  slot text not null check (slot in ('a','b')),
  media_url text not null,
  media_type text not null check (media_type in ('image','audio')),
  awarded_solo boolean not null default false,
  awarded_bonus boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, quest_date, slot)
);

create table public.weekly_winners (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  a_xp int not null default 0,
  b_xp int not null default 0,
  winner_slot text check (winner_slot in ('a','b','tie')),
  primary key (user_id, week_start)
);

-- ============ INDEXES ============
create index on public.submissions (user_id, quest_date);
create index on public.partners (user_id);

-- ============ RLS ============
alter table public.partners enable row level security;
alter table public.quests enable row level security;
alter table public.daily_quests enable row level security;
alter table public.submissions enable row level security;
alter table public.weekly_winners enable row level security;

create policy "own partners" on public.partners for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "read quests" on public.quests for select
  to authenticated using (true);

create policy "own daily" on public.daily_quests for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own submissions" on public.submissions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own winners" on public.weekly_winners for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ XP TRIGGER ============
create or replace function public.handle_submission_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other_exists boolean;
  other_slot text;
begin
  other_slot := case when new.slot = 'a' then 'b' else 'a' end;

  -- Award +10 solo XP immediately
  update public.partners
     set lifetime_xp = lifetime_xp + 10,
         weekly_xp = weekly_xp + 10
   where user_id = new.user_id and slot = new.slot;

  update public.submissions set awarded_solo = true where id = new.id;

  -- If partner already submitted today, award +40 bonus to both => total 50 each
  select exists(
    select 1 from public.submissions
     where user_id = new.user_id
       and quest_date = new.quest_date
       and slot = other_slot
  ) into other_exists;

  if other_exists then
    update public.partners
       set lifetime_xp = lifetime_xp + 40,
           weekly_xp = weekly_xp + 40,
           streak = streak + 1,
           last_completed_date = new.quest_date
     where user_id = new.user_id;

    update public.submissions
       set awarded_bonus = true
     where user_id = new.user_id and quest_date = new.quest_date;
  end if;

  return new;
end;
$$;

create trigger submissions_xp_trigger
after insert on public.submissions
for each row execute function public.handle_submission_xp();

-- ============ STORAGE BUCKET ============
insert into storage.buckets (id, name, public)
values ('duo-media', 'duo-media', true)
on conflict (id) do nothing;

create policy "duo upload" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'duo-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "duo read" on storage.objects for select
  using (bucket_id = 'duo-media');

create policy "duo delete own" on storage.objects for delete
  to authenticated
  using (bucket_id = 'duo-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ REALTIME ============
alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.partners;
