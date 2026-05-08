import { supabase } from "@/integrations/supabase/client";

export type Slot = "a" | "b";

export const ACCENTS = {
  warm: { label: "Warm Mocha", color: "oklch(0.55 0.06 55)" },
  rose: { label: "Dusty Rose", color: "oklch(0.65 0.08 25)" },
  sage: { label: "Sage", color: "oklch(0.65 0.05 130)" },
  caramel: { label: "Caramel", color: "oklch(0.7 0.1 60)" },
} as const;

export type AccentKey = keyof typeof ACCENTS;

export const LEVELS = [
  { name: "Newbies", min: 0 },
  { name: "Steady", min: 200 },
  { name: "Kins", min: 600 },
  { name: "Soulmates", min: 1200 },
  { name: "Legendary Duo", min: 2500 },
];

export function levelFor(xp: number) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].min) idx = i;
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1];
  const progress = next ? (xp - current.min) / (next.min - current.min) : 1;
  return { idx, name: current.name, current, next, progress: Math.max(0, Math.min(1, progress)) };
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function weekStartISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0 sun
  const diff = (day + 6) % 7; // distance from monday
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function msUntilMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function isSunday(): boolean {
  return new Date().getDay() === 0;
}

export async function ensureTodayQuest(userId: string) {
  const date = todayISO();
  const { data: existing } = await supabase
    .from("daily_quests")
    .select("quest_id, used_quest_ids")
    .eq("user_id", userId)
    .eq("quest_date", date)
    .maybeSingle();
  if (existing) return existing;

  // get latest used
  const { data: latest } = await supabase
    .from("daily_quests")
    .select("used_quest_ids")
    .eq("user_id", userId)
    .order("quest_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const used: string[] = latest?.used_quest_ids ?? [];

  const { data: pool } = await supabase.from("quests").select("id");
  const all = pool?.map((q) => q.id) ?? [];
  const remaining = all.filter((id) => !used.includes(id));
  const candidates = remaining.length > 0 ? remaining : all;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const newUsed = remaining.length > 0 ? [...used, pick] : [pick];

  const { data: inserted } = await supabase
    .from("daily_quests")
    .insert({ user_id: userId, quest_date: date, quest_id: pick, used_quest_ids: newUsed })
    .select("quest_id, used_quest_ids")
    .single();
  return inserted;
}

export async function getSignedMediaUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("duo-media").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
