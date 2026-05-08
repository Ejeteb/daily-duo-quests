import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveSlot, useAuthUser } from "@/lib/auth-hooks";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

export function Header() {
  const { user } = useAuthUser();
  const [slot, setSlot] = useActiveSlot();
  const [partners, setPartners] = useState<{ slot: string; display_name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("partners")
      .select("slot, display_name")
      .eq("user_id", user.id)
      .then(({ data }) => setPartners(data ?? []));
  }, [user]);

  const active = partners.find((p) => p.slot === slot);

  if (!user) return null;
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border/50">
      <div className="mx-auto max-w-md px-5 py-4 flex items-center justify-between">
        <h1 className="font-display text-xl text-primary">Daily Duo</h1>
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm"
          >
            <span className="h-7 w-7 rounded-full bg-mocha text-cream grid place-items-center text-xs font-medium">
              {(active?.display_name ?? "·").slice(0, 1).toUpperCase()}
            </span>
            <span className="font-medium">{active?.display_name ?? "—"}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          {open && (
            <div
              className="absolute right-0 mt-2 w-48 rounded-2xl bg-card border border-border shadow-[var(--shadow-pillow)] p-1.5 text-sm"
              onMouseLeave={() => setOpen(false)}
            >
              {partners.map((p) => (
                <button
                  key={p.slot}
                  onClick={() => {
                    setSlot(p.slot as "a" | "b");
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl hover:bg-secondary ${
                    p.slot === slot ? "bg-secondary" : ""
                  }`}
                >
                  Playing as <span className="font-medium">{p.display_name}</span>
                </button>
              ))}
              <div className="border-t border-border my-1" />
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/login" });
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-secondary text-muted-foreground"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
