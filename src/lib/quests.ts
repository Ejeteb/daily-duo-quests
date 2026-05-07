import { supabase } from "@/integrations/supabase/client";
import { todayKey } from "./duo";

export async function ensureTodayQuest(userId: string) {
  const date = todayKey();

  const { data: existing } = await supabase
    .from("daily_quests")
    .select("quest_id, used_quest_ids, quests(*)")
    .eq("user_id", userId)
    .eq("quest_date", date)
    .maybeSingle();

  if (existing) return existing;

  // Find latest used pool
  const { data: latest } = await supabase
    .from("daily_quests")
    .select("used_quest_ids")
    .eq("user_id", userId)
    .order("quest_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let used: string[] = latest?.used_quest_ids ?? [];

  const { data: allQuests } = await supabase.from("quests").select("id");
  const all = (allQuests ?? []).map((q) => q.id);
  let pool = all.filter((id) => !used.includes(id));
  if (pool.length === 0) {
    used = [];
    pool = all;
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  used = [...used, pick];

  await supabase.from("daily_quests").insert({
    user_id: userId,
    quest_date: date,
    quest_id: pick,
    used_quest_ids: used,
  });

  const { data: full } = await supabase
    .from("daily_quests")
    .select("quest_id, used_quest_ids, quests(*)")
    .eq("user_id", userId)
    .eq("quest_date", date)
    .single();
  return full!;
}
