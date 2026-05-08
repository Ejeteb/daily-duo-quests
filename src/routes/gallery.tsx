import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/auth-hooks";
import { getSignedMediaUrl } from "@/lib/duo";

export const Route = createFileRoute("/gallery")({ component: GalleryPage });

const EMOJIS = ["🤎", "😂", "🔥", "🙌"] as const;

type Sub = { id: string; slot: string; quest_date: string; media_type: string; media_url: string; text_content: string | null; verdict: string };

function Reactions({ submissionId, mySlot, userId }: { submissionId: string; mySlot: "a" | "b"; userId: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Record<string, boolean>>({});
  useEffect(() => {
    supabase.from("reactions").select("emoji, slot").eq("submission_id", submissionId).then(({ data }) => {
      const c: Record<string, number> = {}; const m: Record<string, boolean> = {};
      data?.forEach((r) => { c[r.emoji] = (c[r.emoji] ?? 0) + 1; if (r.slot === mySlot) m[r.emoji] = true; });
      setCounts(c); setMine(m);
    });
  }, [submissionId, mySlot]);
  async function toggle(emoji: string) {
    if (mine[emoji]) {
      await supabase.from("reactions").delete().eq("submission_id", submissionId).eq("slot", mySlot).eq("emoji", emoji);
      setMine({ ...mine, [emoji]: false }); setCounts({ ...counts, [emoji]: Math.max(0, (counts[emoji] ?? 1) - 1) });
    } else {
      await supabase.from("reactions").insert({ submission_id: submissionId, user_id: userId, slot: mySlot, emoji });
      setMine({ ...mine, [emoji]: true }); setCounts({ ...counts, [emoji]: (counts[emoji] ?? 0) + 1 });
    }
  }
  return (
    <div className="flex gap-1.5 mt-2">
      {EMOJIS.map((e) => (
        <button key={e} onClick={() => toggle(e)}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm border transition ${
            mine[e] ? "bg-accent border-mocha" : "bg-secondary border-border"
          }`}>
          <span>{e}</span>{counts[e] ? <span className="text-xs text-muted-foreground">{counts[e]}</span> : null}
        </button>
      ))}
    </div>
  );
}

function MediaThumb({ sub }: { sub: Sub }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (sub.media_url && sub.media_type !== "text") getSignedMediaUrl(sub.media_url).then(setUrl); }, [sub]);
  if (sub.media_type === "text") return <div className="aspect-square rounded-2xl bg-accent grid place-items-center p-4 text-center font-display text-primary text-balance">{sub.text_content}</div>;
  if (sub.media_type === "audio") return <audio src={url ?? undefined} controls className="w-full"/>;
  return <div className="aspect-square rounded-2xl overflow-hidden bg-secondary">{url && <img src={url} alt="" className="w-full h-full object-cover"/>}</div>;
}

function GalleryPage() {
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [partners, setPartners] = useState<Record<string, string>>({});
  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);
  useEffect(() => {
    if (!user) return;
    supabase.from("submissions").select("*").eq("user_id", user.id).eq("verdict", "approved")
      .order("quest_date", { ascending: false }).then(({ data }) => setSubs((data ?? []) as Sub[]));
    supabase.from("partners").select("slot, display_name").eq("user_id", user.id)
      .then(({ data }) => { const m: Record<string, string> = {}; data?.forEach((p) => { m[p.slot] = p.display_name; }); setPartners(m); });
  }, [user]);
  if (loading || !user) return null;
  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <h1 className="font-display text-3xl text-primary mb-5">Gallery</h1>
      {subs.length === 0 && <p className="text-muted-foreground text-center py-12">No approved posts yet.</p>}
      <div className="space-y-5">
        {subs.map((s) => (
          <div key={s.id} className="rounded-3xl bg-card border border-border p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="font-medium">{partners[s.slot] ?? s.slot.toUpperCase()}</span>
              <span className="text-muted-foreground text-xs">{s.quest_date}</span>
            </div>
            <MediaThumb sub={s} />
            <Reactions submissionId={s.id} mySlot={(s.slot === "a" ? "b" : "a") as "a" | "b"} userId={user.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
