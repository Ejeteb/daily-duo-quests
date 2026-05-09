import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveSlot, useAuthUser } from "@/lib/auth-hooks";
import { ensureTodayQuest, msUntilMidnight, todayISO, weekStartISO } from "@/lib/duo";
import { Camera, Mic, Type, Bell, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/home")({ component: HomePage });

type Quest = { id: string; prompt: string; accepts: "image" | "audio" | "text"; category: string };

function useCountdown() {
  const [ms, setMs] = useState(msUntilMidnight());
  useEffect(() => {
    const i = setInterval(() => setMs(msUntilMidnight()), 1000);
    return () => clearInterval(i);
  }, []);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Loser({ userId, slot }: { userId: string; slot: "a" | "b" }) {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.from("weekly_winners").select("winner_slot, loser_accepted")
      .eq("user_id", userId).eq("week_start", weekStartISO()).maybeSingle()
      .then(({ data }) => {
        if (data && !data.loser_accepted && data.winner_slot && data.winner_slot !== slot) {
          navigate({ to: "/penalty" });
        }
      });
  }, [userId, slot, navigate]);
  return null;
}

function HomePage() {
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();
  const [slot] = useActiveSlot();
  const countdown = useCountdown();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [mySub, setMySub] = useState<{ id: string; verdict: string } | null>(null);
  const [partnerSub, setPartnerSub] = useState<{ verdict: string } | null>(null);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const dq = await ensureTodayQuest(user.id);
      if (!dq) return;
      const { data: q } = await supabase.from("quests").select("*").eq("id", dq.quest_id).single();
      setQuest(q as Quest);
      const date = todayISO();
      const { data: subs } = await supabase
        .from("submissions").select("id, slot, verdict")
        .eq("user_id", user.id).eq("quest_date", date);
      setMySub(subs?.find((s) => s.slot === slot) ?? null);
      const partnerSlot = slot === "a" ? "b" : "a";
      setPartnerSub(subs?.find((s) => s.slot === partnerSlot) ?? null);
    })();
  }, [user, slot]);

  // realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`subs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `user_id=eq.${user.id}` },
        (p) => {
          const row = (p.new ?? p.old) as { slot: string; quest_date: string; verdict: string; id: string };
          if (row.quest_date !== todayISO()) return;
          if (p.eventType === "DELETE") {
            if (row.slot === slot) setMySub(null);
            return;
          }
          if (row.slot === slot) setMySub({ id: row.id, verdict: row.verdict });
          else setPartnerSub({ verdict: row.verdict });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, slot]);

  async function handleUpload(file: File | null) {
    if (!user || !quest) return;
    setUploading(true);
    try {
      let mediaUrl = "";
      const mediaType = quest.accepts;
      if (mediaType !== "text") {
        if (!file) throw new Error("Pick a file");
        const ext = file.name.split(".").pop() || (mediaType === "image" ? "jpg" : "webm");
        const path = `${user.id}/${todayISO()}/${slot}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("duo-media").upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        mediaUrl = path;
      }
      const { error: insErr } = await supabase.from("submissions").insert({
        user_id: user.id, slot, quest_date: todayISO(),
        media_type: mediaType, media_url: mediaUrl,
        text_content: mediaType === "text" ? text : null,
        verdict: "approved",
      });
      if (insErr) throw insErr;
      toast.success("Posted! +10 XP");
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  }

  async function nudge() {
    if (!user) return;
    const partnerSlot = slot === "a" ? "b" : "a";
    await supabase.from("nudges").insert({
      user_id: user.id, from_slot: slot, to_slot: partnerSlot, kind: "reminder",
    });
    toast.success("Nudge sent 💌");
  }

  if (loading || !user) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-md px-5 py-6 grain">
      <Loser userId={user.id} slot={slot} />
      <div className="text-center mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Today's Quest</p>
        <p className="mt-2 font-display text-3xl text-primary text-balance">
          {quest?.prompt ?? "…"}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">Resets in {countdown}</p>
      </div>

      <div className="rounded-3xl bg-card border border-border shadow-[var(--shadow-pillow)] p-6 space-y-4">
        {mySub?.verdict === "approved" ? (
          <div className="text-center py-8">
            <div className="mx-auto h-14 w-14 rounded-full bg-mocha grid place-items-center text-cream">
              <Check className="h-7 w-7" />
            </div>
            <p className="mt-4 font-display text-xl">You're done for today</p>
            <p className="text-sm text-muted-foreground">
              {partnerSub?.verdict === "approved"
                ? "Both of you crushed it. +50 XP each."
                : "Waiting on your partner to seal the bonus."}
            </p>
          </div>
        ) : quest?.accepts === "text" ? (
          <>
            <textarea
              value={text} onChange={(e) => setText(e.target.value)}
              rows={4} placeholder="Type your answer…"
              className="w-full rounded-2xl bg-secondary p-4 outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <button onClick={() => handleUpload(null)} disabled={uploading || !text.trim()}
              className="w-full rounded-full bg-primary text-primary-foreground py-3 font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Type className="h-4 w-4" />}
              Submit text
            </button>
          </>
        ) : (
          <>
            <input ref={fileRef} type="file"
              accept={quest?.accepts === "image" ? "image/*" : "audio/*"}
              capture={quest?.accepts === "image" ? "environment" : undefined}
              onChange={(e) => handleUpload(e.target.files?.[0] ?? null)} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full rounded-full bg-primary text-primary-foreground py-4 font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                quest?.accepts === "image" ? <Camera className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              {uploading ? "Uploading…" : quest?.accepts === "image" ? "Take a photo" : "Record audio"}
            </button>
          </>
        )}
        <button onClick={nudge}
          className="w-full rounded-full bg-secondary text-foreground py-3 text-sm inline-flex items-center justify-center gap-2 hover:bg-accent">
          <Bell className="h-4 w-4" /> Nudge your partner
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {[{ slot, sub: mySub, label: "You" }, { slot: slot === "a" ? "b" : "a", sub: partnerSub, label: "Partner" }].map((b) => (
          <div key={b.label} className="rounded-2xl bg-card border border-border p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{b.label}</p>
            <p className="mt-2 font-display text-lg">
              {b.sub?.verdict === "approved" ? "✓ Done" : b.sub?.verdict === "pending" ? "Judging…" : "Waiting"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
