import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ACCENTS, type AccentKey } from "@/lib/duo";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [accentA, setAccentA] = useState<AccentKey>("warm");
  const [accentB, setAccentB] = useState<AccentKey>("rose");
  const [busy, setBusy] = useState(false);
  const [needSetup, setNeedSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: partners } = await supabase
          .from("partners").select("id").eq("user_id", data.session.user.id);
        if (partners && partners.length >= 2) navigate({ to: "/home" });
        else { setNeedSetup(true); setUserId(data.session.user.id); }
      }
    });
  }, [navigate]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) { setUserId(data.user!.id); setNeedSetup(true); }
        else toast.success("Check your email to confirm.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: partners } = await supabase
          .from("partners").select("id").eq("user_id", data.user.id);
        if (partners && partners.length >= 2) navigate({ to: "/home" });
        else { setUserId(data.user.id); setNeedSetup(true); }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally { setBusy(false); }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    try {
      await supabase.from("partners").delete().eq("user_id", userId);
      const { error } = await supabase.from("partners").insert([
        { user_id: userId, slot: "a", display_name: nameA, accent: accentA },
        { user_id: userId, slot: "b", display_name: nameB, accent: accentB },
      ]);
      if (error) throw error;
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grain bg-background flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="font-display text-5xl text-primary tracking-tight">Daily Duo</div>
          <p className="mt-3 text-muted-foreground">One quest a day, just for the two of you.</p>
        </div>

        <div className="rounded-3xl bg-card border border-border shadow-[var(--shadow-pillow)] p-7">
          {needSetup ? (
            <form onSubmit={handleSetup} className="space-y-5">
              <h2 className="font-display text-2xl">Meet the duo</h2>
              <p className="text-sm text-muted-foreground -mt-3">Two names, one shared account.</p>
              {[
                { label: "Partner A", val: nameA, set: setNameA, accent: accentA, setAccent: setAccentA },
                { label: "Partner B", val: nameB, set: setNameB, accent: accentB, setAccent: setAccentB },
              ].map((p) => (
                <div key={p.label} className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">{p.label}</label>
                  <input value={p.val} onChange={(e) => p.set(e.target.value)} required
                    className="w-full rounded-full bg-secondary px-5 py-3 outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Name"/>
                  <div className="flex gap-2">
                    {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
                      <button type="button" key={k} onClick={() => p.setAccent(k)}
                        className={`h-7 w-7 rounded-full border-2 transition ${p.accent === k ? "border-primary scale-110" : "border-transparent"}`}
                        style={{ background: ACCENTS[k].color }} title={ACCENTS[k].label} />
                    ))}
                  </div>
                </div>
              ))}
              <button disabled={busy} className="w-full rounded-full bg-primary text-primary-foreground py-3 font-medium disabled:opacity-50">
                {busy ? "Saving…" : "Start playing →"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <h2 className="font-display text-2xl">{mode === "signup" ? "Create your duo" : "Welcome back"}</h2>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Email" className="w-full rounded-full bg-secondary px-5 py-3 outline-none focus:ring-2 focus:ring-ring"/>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Password" className="w-full rounded-full bg-secondary px-5 py-3 outline-none focus:ring-2 focus:ring-ring"/>
              <button disabled={busy} className="w-full rounded-full bg-primary text-primary-foreground py-3 font-medium disabled:opacity-50">
                {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
              </button>
              <button type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                className="w-full text-sm text-muted-foreground hover:text-primary">
                {mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
