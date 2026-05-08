import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveSlot, useAuthUser } from "@/lib/auth-hooks";
import { isSunday } from "@/lib/duo";
import { Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/shop")({ component: Shop });

type Item = { id: string; name: string; description: string; cost_xp: number; icon: string };

function Shop() {
  const { user, loading } = useAuthUser();
  const navigate = useNavigate();
  const [slot] = useActiveSlot();
  const [items, setItems] = useState<Item[]>([]);
  const [xp, setXp] = useState(0);
  const open = isSunday();
  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);
  useEffect(() => {
    if (!user) return;
    supabase.from("shop_items").select("*").order("cost_xp").then(({ data }) => setItems((data ?? []) as Item[]));
    supabase.from("partners").select("lifetime_xp").eq("user_id", user.id).eq("slot", slot).maybeSingle()
      .then(({ data }) => setXp(data?.lifetime_xp ?? 0));
  }, [user, slot]);
  async function buy(item: Item) {
    const { data, error } = await supabase.rpc("purchase_shop_item", { p_item_id: item.id, p_slot: slot });
    if (error) return toast.error(error.message);
    const r = data as { ok: boolean; error?: string };
    if (!r.ok) return toast.error(r.error ?? "Failed");
    setXp((x) => x - item.cost_xp);
    toast.success(`Bought ${item.name}!`);
  }
  if (loading || !user) return null;
  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-display text-3xl text-primary">XP Shop</h1>
          <p className="text-muted-foreground text-sm">{open ? "Sunday only — spend wisely." : "Opens every Sunday."}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Your XP</div>
          <div className="font-display text-2xl">{xp}</div>
        </div>
      </div>
      {!open && (
        <div className="rounded-3xl bg-card border border-border p-8 text-center shadow-[var(--shadow-soft)] mb-6">
          <Lock className="h-8 w-8 mx-auto text-mocha"/>
          <p className="mt-3 font-display text-xl">Shop is closed</p>
          <p className="text-sm text-muted-foreground mt-1">Come back Sunday.</p>
        </div>
      )}
      <div className={`grid grid-cols-2 gap-3 ${!open ? "opacity-60 pointer-events-none" : ""}`}>
        {items.map((it) => (
          <div key={it.id} className="rounded-3xl bg-card border border-border p-4 flex flex-col shadow-[var(--shadow-soft)]">
            <div className="text-3xl">{it.icon}</div>
            <div className="font-display text-lg mt-1">{it.name}</div>
            <div className="text-xs text-muted-foreground mt-1 flex-1">{it.description}</div>
            <button onClick={() => buy(it)} disabled={xp < it.cost_xp}
              className="mt-3 rounded-full bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-40">
              {it.cost_xp} XP
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
