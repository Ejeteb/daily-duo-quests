
ALTER TABLE public.quests DROP CONSTRAINT IF EXISTS quests_accepts_check;
ALTER TABLE public.quests ADD CONSTRAINT quests_accepts_check CHECK (accepts IN ('image','audio','text'));
