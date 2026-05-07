import { supabase } from "@/integrations/supabase/client";
import type { AccentKey, Slot } from "./duo";

export type Partner = {
  id: string;
  user_id: string;
  slot: Slot;
  display_name: string;
  accent: AccentKey;
  avatar_url: string | null;
  lifetime_xp: number;
  weekly_xp: number;
  streak: number;
  last_completed_date: string | null;
};

export async function fetchPartners(userId: string): Promise<Partner[]> {
  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .eq("user_id", userId)
    .order("slot");
  if (error) throw error;
  return (data ?? []) as Partner[];
}
