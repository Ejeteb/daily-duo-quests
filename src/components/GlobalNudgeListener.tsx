import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/auth-hooks";
import { toast } from "sonner";

export function GlobalNudgeListener() {
  const { user } = useAuthUser();
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`nudges-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "nudges", filter: `user_id=eq.${user.id}` },
        () => {
          toast("💌 Nudge!", {
            description: `Don't forget today's quest!`,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
  return null;
}
