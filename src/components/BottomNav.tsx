import { Link, useLocation } from "@tanstack/react-router";
import { Home, Image, Trophy, ShoppingBag } from "lucide-react";

const TABS = [
  { to: "/home", icon: Home, label: "Today" },
  { to: "/gallery", icon: Image, label: "Gallery" },
  { to: "/leaderboard", icon: Trophy, label: "Versus" },
  { to: "/shop", icon: ShoppingBag, label: "Shop" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  if (pathname === "/login" || pathname === "/" || pathname === "/penalty") return null;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md px-4 pb-4">
        <div className="rounded-full bg-card/90 backdrop-blur border border-border shadow-[var(--shadow-pillow)] flex items-center justify-around py-2">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-full text-xs transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className="text-[10px] tracking-wide">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
