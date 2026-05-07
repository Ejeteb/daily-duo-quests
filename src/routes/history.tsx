import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { getSignedUrl } from "@/lib/media";
import { ACCENT_HEX } from "@/lib/duo";
import { fetchPartners, type Partner } from "@/lib/partners";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — The Daily Duo" },
      { name: "description", content: "Every quest, every reveal. Your shared archive." },
    ],
  }),
  component: HistoryPage,
});

type Row = {
  id: string;
  slot: "a" | "b";
  media_url: string;
  media_type: "image" | "audio";
  quest_date: string;
};

type Day = {
  date: string;
  prompt: string;
  a?: Row;
  b?: Row;
};

function HistoryPage() {
  const { session, loading } = useSession();
  const nav = useNavigate();
  const [days, setDays] = useState<Day[] | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    if (!loading && !session) nav({ to: "/login" });
  }, [loading, session, nav]);

  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;
    (async () => {
      const [{ data: subs }, { data: dq }] = await Promise.all([
        supabase
          .from("submissions")
          .select("id, slot, media_url, media_type, quest_date")
          .eq("user_id", uid)
          .order("quest_date", { ascending: false }),
        supabase
          .from("daily_quests")
          .select("quest_date, quests(prompt)")
          .eq("user_id", uid),
      ]);
      const byDate: Record<string, Day> = {};
      type DqRow = { quest_date: string; quests: { prompt: string } | null };
      for (const d of (dq ?? []) as DqRow[]) {
        byDate[d.quest_date] = {
          date: d.quest_date,
          prompt: d.quests?.prompt ?? "",
        };
      }
      for (const s of (subs ?? []) as Row[]) {
        if (!byDate[s.quest_date])
          byDate[s.quest_date] = { date: s.quest_date, prompt: "" };
        byDate[s.quest_date][s.slot] = s;
      }
      setDays(
        Object.values(byDate).sort((x, y) => (x.date < y.date ? 1 : -1))
      );
      fetchPartners(uid).then(setPartners);
    })();
  }, [session]);

  if (!session) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-5 pt-6">
        <h1 className="mb-6 text-3xl font-bold text-glow-cyan">History</h1>
        {!days ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : days.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No quests yet. Today's quest will appear here once both of you submit.
          </p>
        ) : (
          <div className="space-y-6">
            {days.map((d) => (
              <DayCard key={d.date} day={d} partners={partners} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function DayCard({ day, partners }: { day: Day; partners: Partner[] }) {
  const both = day.a && day.b;
  const a = partners.find((p) => p.slot === "a");
  const b = partners.find((p) => p.slot === "b");
  return (
    <div className="glass rounded-3xl p-5">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="font-mono text-muted-foreground">{day.date}</span>
        {!both && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
            Incomplete
          </span>
        )}
      </div>
      <p className="mb-4 text-sm font-medium">{day.prompt || "—"}</p>
      <div className="grid grid-cols-2 gap-3">
        <Tile row={day.a} partner={a} reveal={!!both} />
        <Tile row={day.b} partner={b} reveal={!!both} />
      </div>
    </div>
  );
}

function Tile({
  row,
  partner,
  reveal,
}: {
  row?: Row;
  partner?: Partner;
  reveal: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (row && reveal) getSignedUrl(row.media_url).then(setSrc);
  }, [row, reveal]);

  return (
    <div
      className="aspect-square overflow-hidden rounded-2xl bg-secondary"
      style={{
        boxShadow: partner
          ? `0 0 0 1px ${ACCENT_HEX[partner.accent]}40`
          : undefined,
      }}
    >
      {!row ? (
        <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-muted-foreground">
          {partner?.display_name ?? "—"} didn't submit
        </div>
      ) : !reveal ? (
        <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-muted-foreground">
          Hidden — partner missed
        </div>
      ) : row.media_type === "image" ? (
        src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full animate-pulse bg-muted" />
        )
      ) : (
        <div className="flex h-full items-center justify-center p-3">
          {src ? <audio controls src={src} className="w-full" /> : null}
        </div>
      )}
    </div>
  );
}
