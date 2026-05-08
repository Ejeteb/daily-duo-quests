import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveSlot, useAuthUser } from "@/lib/auth-hooks";
import { weekStartISO } from "@/lib/duo";

export const Route = createFileRoute("/penalty")({ component: Penalty });

function Penalty() {
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();
  const [slot] = useActiveSlot();
  const [punishment, setPunishment] = useState<string | null>(null);
  const [winnerName, setWinnerName] = useState<string>("");

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: w } = await supabase.from("weekly_winners").select("*")
        .eq("user_id", user.id).eq("week_start", weekStartISO()).maybeSingle();
      if (!w || w.loser_accepted || w.winner_slot === slot) { navigate({ to: "/home" }); return; }
      let pid = w.loser_punishment_id as string | null;
      if (!pid) {
        const { data: list } = await supabase.from("punishments").select("id, text");
        if (list && list.length) {
          const pick = list[Math.floor(Math.random() * list.length)];
          pid = pick.id;
          await supabase.from("weekly_winners").update({ loser_punishment_id: pid })
            .eq("user_id", user.id).eq("week_start", weekStartISO());
        }
      }
      const { data: p } = await supabase.from("punishments").select("text").eq("id", pid!).maybeSingle();
      setPunishment(p?.text ?? "Buy dessert.");
      const { data: pn } = await supabase.from("partners").select("display_name")
        .eq("user_id", user.id).eq("slot", w.winner_slot!).maybeSingle();
      setWinnerName(pn?.display_name ?? "Your partner");
    })();
  }, [user, slot, navigate]);

  async function accept() {
    if (!user) return;
    await supabase.from("weekly_winners").update({ loser_accepted: true })
      .eq("user_id", user.id).eq("week_start", weekStartISO());
    navigate({ to: "/home" });
  }

  if (!user || !punishment) return <div className="p-10 text-center text-muted-foreground">…</div>;
  return (
    <div className="min-h-screen grain bg-background flex items-center justify-center px-5">
      <div className="max-w-md w-full text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Weekly Verdict</p>
        <h1 className="mt-3 font-display text-4xl text-primary">{winnerName} won this week.</h1>
        <p className="mt-2 text-muted-foreground">Your punishment is:</p>
        <div className="mt-6 rounded-3xl bg-card border border-border p-7 shadow-[var(--shadow-pillow)]">
          <p className="font-display text-2xl text-balance">{punishment}</p>
        </div>
        <button onClick={accept}
          className="mt-7 rounded-full bg-primary text-primary-foreground px-8 py-3.5 font-medium">
          I Accept My Punishment
        </button>
      </div>
    </div>
  );
}
