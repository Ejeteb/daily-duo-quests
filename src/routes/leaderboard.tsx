import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { fetchPartners, type Partner } from "@/lib/partners";
import { ACCENT_HEX, levelFor } from "@/lib/duo";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Flame } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Versus — The Daily Duo" },
      { name: "description", content: "Live XP showdown between you two." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { session, loading } = useSession();
  const nav = useNavigate();
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    if (!loading && !session) nav({ to: "/login" });
  }, [loading, session, nav]);

  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;
    fetchPartners(uid).then(setPartners);
    const ch = supabase
      .channel("lb-" + uid)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partners", filter: `user_id=eq.${uid}` },
        () => fetchPartners(uid).then(setPartners)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session]);

  if (!session || partners.length < 2) {
    return (
      <AppShell>
        <div className="p-10 text-center text-sm text-muted-foreground">Setting up…</div>
      </AppShell>
    );
  }

  const [a, b] = partners;
  const aWins = a.weekly_xp > b.weekly_xp;
  const tied = a.weekly_xp === b.weekly_xp;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-5 pt-6">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            This Week's Versus
          </p>
          <h1 className="mt-2 text-4xl font-bold text-glow-purple">
            {tied ? "Dead Heat" : aWins ? `${a.display_name} leads` : `${b.display_name} leads`}
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <PartnerStat partner={a} winning={!tied && aWins} />
          <PartnerStat partner={b} winning={!tied && !aWins} />
        </div>

        <div className="mt-8 glass rounded-3xl p-6">
          <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
            Sunday Prize
          </p>
          <p className="text-sm">
            Whoever has more weekly XP on Sunday picks dinner or the movie. 👑
          </p>
        </div>

        <div className="mt-6 glass rounded-3xl p-6">
          <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
            Lifetime Levels
          </p>
          <div className="space-y-4">
            {partners.map((p) => {
              const lvl = levelFor(p.lifetime_xp);
              return (
                <div key={p.slot}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold" style={{ color: ACCENT_HEX[p.accent] }}>
                      {p.display_name}
                    </span>
                    <span className="text-muted-foreground">
                      Lvl {lvl.num} · {lvl.title} · {p.lifetime_xp} XP
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, lvl.progress * 100)}%`,
                        background: ACCENT_HEX[p.accent],
                        boxShadow: `0 0 12px ${ACCENT_HEX[p.accent]}`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function PartnerStat({ partner, winning }: { partner: Partner; winning: boolean }) {
  const lvl = levelFor(partner.lifetime_xp);
  return (
    <div
      className="glass relative rounded-3xl p-5 text-center"
      style={{
        boxShadow: winning
          ? `0 0 50px ${ACCENT_HEX[partner.accent]}66, 0 0 0 1px ${ACCENT_HEX[partner.accent]}`
          : `0 0 0 1px ${ACCENT_HEX[partner.accent]}30`,
      }}
    >
      {winning && (
        <Crown
          className="absolute -top-3 left-1/2 h-7 w-7 -translate-x-1/2"
          style={{ color: ACCENT_HEX[partner.accent] }}
          fill="currentColor"
        />
      )}
      <p className="text-sm font-bold" style={{ color: ACCENT_HEX[partner.accent] }}>
        {partner.display_name}
      </p>
      <p className="mt-3 text-5xl font-bold tabular-nums">{partner.weekly_xp}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">weekly xp</p>
      <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <span>Lvl {lvl.num}</span>
        <span className="flex items-center gap-1">
          <Flame className="h-3 w-3" /> {partner.streak}
        </span>
      </div>
    </div>
  );
}
