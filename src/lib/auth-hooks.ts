import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, loading };
}

const ACTIVE_SLOT_KEY = "daily-duo-active-slot";

export function useActiveSlot(): ["a" | "b", (s: "a" | "b") => void] {
  const [slot, setSlot] = useState<"a" | "b">(() => {
    if (typeof window === "undefined") return "a";
    return (localStorage.getItem(ACTIVE_SLOT_KEY) as "a" | "b") || "a";
  });
  const update = (s: "a" | "b") => {
    setSlot(s);
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_SLOT_KEY, s);
    window.dispatchEvent(new CustomEvent("active-slot-changed", { detail: s }));
  };
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<"a" | "b">).detail;
      setSlot(detail);
    };
    window.addEventListener("active-slot-changed", handler);
    return () => window.removeEventListener("active-slot-changed", handler);
  }, []);
  return [slot, update];
}
