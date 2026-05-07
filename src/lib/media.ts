import { supabase } from "@/integrations/supabase/client";

export async function getSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("duo-media").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
