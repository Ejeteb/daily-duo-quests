import { Link, useLocation } from "@tanstack/react-router";
import { Home, Trophy, Images } from "lucide-react";

const links = [
  { to: "/", label: "Today", icon: Home },
  { to: "/leaderboard", label: "Versus", icon: Trophy },
  { to: "/history", label: "History", icon: Images },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="min-h-dvh pb-28">
      {children}
      <nav className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
        <div className="glass flex items-center gap-1 rounded-full px-2 py-2 shadow-2xl">
          {links.map(({ to, label, icon: Icon }) => {
            const active = loc.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground glow-purple"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
