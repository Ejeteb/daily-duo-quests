import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/auth-hooks";
import { levelFor } from "@/lib/duo";

export const Route = createFileRoute("/leaderboard")({ component: LB });

type P = { slot: string; display_name: string; lifetime_xp: number; weekly_xp: number; streak: number };

function LB() {
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();
  const [partners, setPartners] = useState<P[]>([]);
  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);
  useEffect(() => {
    if (!user) return;
    const load = () => supabase.from("partners").select("slot, display_name, lifetime_xp, weekly_xp, streak")
      .eq("user_id", user.id).order("slot").then(({ data }) => setPartners((data ?? []) as P[]));
    load();
    const ch = supabase.channel(`p-${user.id}`).on("postgres_changes",
      { event: "*", schema: "public", table: "partners", filter: `user_id=eq.${user.id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);
  if (loading || !user) return null;
  const [a, b] = partners;
  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <h1 className="font-display text-3xl text-primary mb-2">Versus</h1>
      <p className="text-muted-foreground text-sm mb-6">Weekly resets each Sunday at midnight.</p>
      <div className="grid grid-cols-2 gap-3 items-stretch">
        {[a, b].map((p, i) => p && (
          <div key={p.slot} className="rounded-3xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{i === 0 ? "Player 1" : "Player 2"}</div>
            <div className="font-display text-2xl mt-1">{p.display_name}</div>
            {(() => { const l = levelFor(p.lifetime_xp); return (
              <>
                <div className="mt-3 text-sm">Lvl {l.idx + 1} <span className="text-muted-foreground">· {l.name}</span></div>
                <div className="h-2 mt-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-mocha" style={{ width: `${l.progress * 100}%` }} />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">Lifetime XP</div>
                <div className="font-display text-2xl">{p.lifetime_xp}</div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>Week: {p.weekly_xp}</span>
                  <span>🔥 {p.streak}</span>
                </div>
              </>
            );})()}
          </div>
        ))}
      </div>
      {a && b && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">This week's lead</p>
          <p className="font-display text-2xl mt-1">
            {a.weekly_xp === b.weekly_xp ? "Tied 🤎" : (a.weekly_xp > b.weekly_xp ? a.display_name : b.display_name)}
          </p>
        </div>
      )}
    </div>
  );
}
