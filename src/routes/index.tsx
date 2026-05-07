import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { fetchPartners, type Partner } from "@/lib/partners";
import { ensureTodayQuest } from "@/lib/quests";
import { getSignedUrl } from "@/lib/media";
import {
  ACCENT_HEX,
  formatCountdown,
  getActiveSlot,
  msUntilMidnight,
  setActiveSlot,
  todayKey,
  type AccentKey,
  type Slot,
} from "@/lib/duo";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import { Camera, Mic, Lock, LogOut, Sparkles, Square } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — The Daily Duo" },
      { name: "description", content: "Today's quest is waiting. Snap, share, level up." },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { session, loading } = useSession();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !session) nav({ to: "/login" });
  }, [loading, session, nav]);
  if (loading) return <Splash />;
  if (!session) return <Splash />;
  return <Authed userId={session.user.id} />;
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="text-center">
        <Sparkles className="mx-auto h-8 w-8 animate-pulse text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading your duo…</p>
      </div>
    </div>
  );
}

function Authed({ userId }: { userId: string }) {
  const [partners, setPartners] = useState<Partner[] | null>(null);

  useEffect(() => {
    fetchPartners(userId).then(setPartners);
    const ch = supabase
      .channel("partners-" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partners", filter: `user_id=eq.${userId}` },
        () => fetchPartners(userId).then(setPartners)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  if (partners === null) return <Splash />;
  if (partners.length < 2) return <SetupPartners userId={userId} onDone={() => fetchPartners(userId).then(setPartners)} />;

  return (
    <AppShell>
      <Today userId={userId} partners={partners} />
    </AppShell>
  );
}

/* ---------- Setup ---------- */

const ACCENT_OPTIONS: AccentKey[] = ["purple", "cyan", "pink", "green"];

function SetupPartners({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [a, setA] = useState({ name: "", accent: "purple" as AccentKey });
  const [b, setB] = useState({ name: "", accent: "cyan" as AccentKey });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!a.name || !b.name) return toast.error("Both partners need a name");
    if (a.accent === b.accent) return toast.error("Pick different accent colors");
    setBusy(true);
    const { error } = await supabase.from("partners").insert([
      { user_id: userId, slot: "a", display_name: a.name, accent: a.accent },
      { user_id: userId, slot: "b", display_name: b.name, accent: b.accent },
    ]);
    setBusy(false);
    if (error) return toast.error(error.message);
    setActiveSlot("a");
    onDone();
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-glow-purple">Meet the Duo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set both partners up. You'll switch sides when handing off the phone.
        </p>
      </div>
      <div className="space-y-5">
        <PartnerCard label="Partner A" value={a} onChange={setA} />
        <PartnerCard label="Partner B" value={b} onChange={setB} />
      </div>
      <button
        onClick={save}
        disabled={busy}
        className="mt-8 w-full rounded-2xl bg-primary py-4 font-semibold text-primary-foreground glow-purple disabled:opacity-50"
      >
        {busy ? "Creating…" : "Begin our quest"}
      </button>
    </div>
  );
}

function PartnerCard({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { name: string; accent: AccentKey };
  onChange: (v: { name: string; accent: AccentKey }) => void;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <input
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder="Display name"
        className="mb-4 w-full rounded-xl bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
      />
      <div className="flex gap-2">
        {ACCENT_OPTIONS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onChange({ ...value, accent: a })}
            style={{ background: ACCENT_HEX[a] }}
            className={`h-9 w-9 rounded-full transition ${
              value.accent === a ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : "opacity-60"
            }`}
            aria-label={a}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Today ---------- */

type SubmissionRow = {
  id: string;
  slot: Slot;
  media_url: string;
  media_type: "image" | "audio";
  created_at: string;
};

function Today({ userId, partners }: { userId: string; partners: Partner[] }) {
  const [activeSlot, _setActiveSlot] = useState<Slot>(getActiveSlot());
  const me = partners.find((p) => p.slot === activeSlot)!;
  const them = partners.find((p) => p.slot !== activeSlot)!;

  const [quest, setQuest] = useState<{ prompt: string; accepts: string; category: string } | null>(null);
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [countdown, setCountdown] = useState(msUntilMidnight());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setCountdown(msUntilMidnight()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const dq = await ensureTodayQuest(userId);
      const q = (dq as { quests: { prompt: string; accepts: string; category: string } }).quests;
      setQuest(q);
    })();
  }, [userId]);

  async function loadSubs() {
    const { data } = await supabase
      .from("submissions")
      .select("id, slot, media_url, media_type, created_at")
      .eq("user_id", userId)
      .eq("quest_date", todayKey());
    setSubs((data ?? []) as SubmissionRow[]);
  }

  useEffect(() => {
    loadSubs();
    const ch = supabase
      .channel("subs-" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `user_id=eq.${userId}` },
        () => loadSubs()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function switchTo(slot: Slot) {
    setActiveSlot(slot);
    _setActiveSlot(slot);
  }

  async function handleUpload(file: Blob, mediaType: "image" | "audio") {
    if (subs.find((s) => s.slot === activeSlot)) {
      return toast.error("You already submitted today");
    }
    setUploading(true);
    try {
      const ext = mediaType === "image" ? "jpg" : "webm";
      const path = `${userId}/${todayKey()}-${activeSlot}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("duo-media").upload(path, file, {
        contentType: file.type || (mediaType === "image" ? "image/jpeg" : "audio/webm"),
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("submissions").insert({
        user_id: userId,
        quest_date: todayKey(),
        slot: activeSlot,
        media_url: path,
        media_type: mediaType,
      });
      if (insErr) throw insErr;
      toast.success("Sent! +10 XP — bonus when your duo posts");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const mySub = subs.find((s) => s.slot === activeSlot);
  const themSub = subs.find((s) => s.slot !== activeSlot);
  const bothDone = !!mySub && !!themSub;

  return (
    <div className="mx-auto max-w-2xl px-5 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {partners.map((p) => (
            <button
              key={p.slot}
              onClick={() => switchTo(p.slot)}
              style={{ borderColor: activeSlot === p.slot ? ACCENT_HEX[p.accent] : "transparent" }}
              className={`rounded-full border-2 px-3 py-1 text-xs font-semibold transition ${
                activeSlot === p.slot ? "bg-card" : "opacity-60"
              }`}
            >
              {p.display_name}
            </button>
          ))}
        </div>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.reload();
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* Countdown + Quest */}
      <div className="glass mb-6 rounded-3xl p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Today's Quest
        </p>
        <h2 className="mt-3 text-2xl font-bold leading-tight">
          {quest?.prompt ?? "Loading…"}
        </h2>
        <p className="mt-3 font-mono text-sm text-glow-cyan accent-cyan">
          {formatCountdown(countdown)} left
        </p>
        {quest && (
          <span className="mt-3 inline-block rounded-full bg-secondary px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            {quest.category}
          </span>
        )}
      </div>

      {/* Boards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Board
          partner={me}
          isMe
          submission={mySub}
          revealed
          onUpload={handleUpload}
          uploading={uploading}
          accepts={quest?.accepts ?? "image"}
        />
        <Board
          partner={them}
          isMe={false}
          submission={themSub}
          revealed={bothDone}
        />
      </div>

      {bothDone && (
        <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-center text-sm">
          🎉 Both done — <span className="font-bold accent-purple">+50 XP</span> each. Keep the streak alive!
        </div>
      )}
    </div>
  );
}

function Board({
  partner,
  isMe,
  submission,
  revealed,
  onUpload,
  uploading,
  accepts,
}: {
  partner: Partner;
  isMe: boolean;
  submission?: SubmissionRow;
  revealed: boolean;
  onUpload?: (f: Blob, t: "image" | "audio") => void;
  uploading?: boolean;
  accepts?: string;
}) {
  const [signed, setSigned] = useState<string | null>(null);
  useEffect(() => {
    if (submission && (revealed || isMe)) {
      getSignedUrl(submission.media_url).then(setSigned);
    } else {
      setSigned(null);
    }
  }, [submission, revealed, isMe]);

  return (
    <div
      className="glass relative overflow-hidden rounded-3xl p-4"
      style={{ boxShadow: `0 0 0 1px ${ACCENT_HEX[partner.accent]}30` }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold" style={{ color: ACCENT_HEX[partner.accent] }}>
          {isMe ? "You" : partner.display_name}
        </p>
        {submission ? (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Done ✓</span>
        ) : (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Waiting</span>
        )}
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-secondary">
        {submission ? (
          revealed || isMe ? (
            submission.media_type === "image" ? (
              signed ? (
                <img src={signed} alt="" className="h-full w-full object-cover" />
              ) : (
                <Skeleton />
              )
            ) : (
              <div className="flex h-full items-center justify-center p-4">
                {signed ? <audio controls src={signed} className="w-full" /> : <Skeleton />}
              </div>
            )
          ) : (
            <BlurredPlaceholder name={partner.display_name} />
          )
        ) : isMe ? (
          <UploadArea onUpload={onUpload!} uploading={!!uploading} accepts={accepts ?? "image"} />
        ) : (
          <EmptyWaiting name={partner.display_name} />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Lvl XP: {partner.lifetime_xp}</span>
        <span>🔥 {partner.streak}</span>
      </div>
    </div>
  );
}

function Skeleton() {
  return <div className="h-full w-full animate-pulse bg-muted" />;
}

function BlurredPlaceholder({ name }: { name: string }) {
  return (
    <div className="relative h-full w-full">
      <div
        className="h-full w-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, var(--neon-purple), transparent 60%), radial-gradient(circle at 70% 70%, var(--neon-cyan), transparent 60%), var(--card)",
          filter: "blur(40px) saturate(1.4)",
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <Lock className="h-7 w-7 text-foreground/80" />
        <p className="mt-2 text-xs text-foreground/80">{name} posted</p>
        <p className="text-[10px] text-muted-foreground">Upload yours to reveal</p>
      </div>
    </div>
  );
}

function EmptyWaiting({ name }: { name: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="text-sm text-muted-foreground">Waiting for {name}…</p>
    </div>
  );
}

function UploadArea({
  onUpload,
  uploading,
  accepts,
}: {
  onUpload: (f: Blob, t: "image" | "audio") => void;
  uploading: boolean;
  accepts: string;
}) {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  function pickFile(type: "image" | "audio") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = type === "image" ? "image/*" : "audio/*";
    if (type === "image") input.capture = "environment" as never;
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) onUpload(f, type);
    };
    input.click();
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        onUpload(blob, "audio");
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
      rec.start();
      setMediaRecorder(rec);
      setRecording(true);
    } catch {
      toast.error("Mic access denied");
    }
  }

  function stopRec() {
    mediaRecorder?.stop();
  }

  const showImage = accepts === "image" || accepts === "either";
  const showAudio = accepts === "audio" || accepts === "either";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
      {uploading ? (
        <p className="text-sm text-muted-foreground">Uploading…</p>
      ) : recording ? (
        <button
          onClick={stopRec}
          className="flex items-center gap-2 rounded-full bg-destructive px-5 py-3 text-sm font-semibold text-destructive-foreground"
        >
          <Square className="h-4 w-4" fill="currentColor" /> Stop recording
        </button>
      ) : (
        <>
          {showImage && (
            <button
              onClick={() => pickFile("image")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground glow-purple"
            >
              <Camera className="h-4 w-4" /> Snap photo
            </button>
          )}
          {showAudio && (
            <button
              onClick={startRec}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground glow-cyan"
            >
              <Mic className="h-4 w-4" /> Record audio
            </button>
          )}
        </>
      )}
    </div>
  );
}
