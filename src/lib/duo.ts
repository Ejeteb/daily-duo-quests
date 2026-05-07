export type Slot = "a" | "b";
export type AccentKey = "purple" | "cyan" | "pink" | "green";

export const ACCENT_HEX: Record<AccentKey, string> = {
  purple: "var(--neon-purple)",
  cyan: "var(--neon-cyan)",
  pink: "var(--neon-pink)",
  green: "var(--neon-green)",
};

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function weekStart(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day; // start Sunday
  const start = new Date(d.setDate(diff));
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
}

export function isSunday(): boolean {
  return new Date().getDay() === 0;
}

export function msUntilMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function formatCountdown(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const LEVELS = [
  { min: 0, title: "Newbies", num: 1 },
  { min: 100, title: "Crushing", num: 2 },
  { min: 300, title: "Going Steady", num: 3 },
  { min: 700, title: "Power Couple", num: 4 },
  { min: 1500, title: "Soulmates", num: 5 },
  { min: 3000, title: "Legendary Duo", num: 6 },
];

export function levelFor(xp: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.min) current = l;
  const next = LEVELS.find((l) => l.min > xp);
  const progress = next
    ? (xp - current.min) / (next.min - current.min)
    : 1;
  return { ...current, next, progress };
}

const ACTIVE_SLOT_KEY = "duo.activeSlot";
export function getActiveSlot(): Slot {
  if (typeof window === "undefined") return "a";
  return ((localStorage.getItem(ACTIVE_SLOT_KEY) as Slot) || "a");
}
export function setActiveSlot(slot: Slot) {
  if (typeof window !== "undefined") localStorage.setItem(ACTIVE_SLOT_KEY, slot);
}
