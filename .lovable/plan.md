# Daily Duo — Premium Build Plan

A complete rebuild of the existing scaffold to match the new spec: nude/brown luxury aesthetic, AI Strict Judge, open gallery, reactions, XP shop, weekly penalty, nudges, and PWA install.

## Visual System

- **Palette (oklch tokens in `src/styles.css`)**: cream `#F5EFE6`, latte `#D9C4A9`, mocha `#8B6F4E`, deep chocolate `#2E1F14`, soft ivory cards, warm shadow.
- **Type**: Fraunces (display) + Inter (body) via Google Fonts.
- **Components**: pill buttons (`rounded-full`), soft drop shadows, generous spacing, subtle grain texture on hero.
- All colors via semantic tokens — no hardcoded Tailwind colors.

## Routes (TanStack Start)

```
src/routes/
  __root.tsx         shell + Toaster + bottom tab nav (auth-aware)
  index.tsx          → redirect to /home or /login
  login.tsx          shared-account auth + first-run partner setup
  _app/              wrapper with bottom tabs
    home.tsx         today's quest, countdown, upload, nudge
    gallery.tsx      both partners' posts, reactions
    leaderboard.tsx  VS layout, levels, weekly + lifetime XP
    shop.tsx         XP shop (locked Mon–Sat, open Sunday)
    penalty.tsx      shown when current user is weekly loser
```

I'll skip `/_app/` folder layouts (per TanStack guidance) and instead use a flat layout via `__root.tsx` plus a `BottomNav` component that hides on `/login`.

## Database Changes (additive migration)

Existing `partners`, `quests`, `daily_quests`, `submissions`, `weekly_winners` stay. Add:

- **`quests`**: add seed rows for `text` accept type. Reseed to 30 curated quests covering photo / audio / text.
- **`submissions`**: add `verdict text default 'pending'` (`pending|approved|rejected`), `rejection_reason text`, `text_content text` (for text quests).
- **`reactions`** new table: `id, submission_id, user_id, slot, emoji, created_at`. RLS: user can insert/delete own; both partners (same `user_id` on shared account) can read.
- **`shop_items`** new table: `id, name, description, cost_xp, icon`. Seeded with ~10 rewards. Public read.
- **`shop_purchases`** new table: `id, user_id, slot, item_id, week_start, created_at`. Own-row RLS.
- **`punishments`** new table (catalog): `id, text`. Seeded with ~15 playful punishments. Public read.
- **`weekly_winners`**: add `loser_punishment_id uuid`, `loser_accepted boolean default false`.
- **`nudges`** new table: `id, user_id, from_slot, to_slot, created_at`. Realtime enabled for live toast.
- Update `handle_submission_xp` trigger so XP is **only awarded when `verdict = 'approved'`** (rejected = 0 XP, no streak, deletes media via separate cleanup).

## AI Strict Judge

Edge function `verify-submission` invoked right after upload:

- Inputs: `submission_id`, quest prompt, media URL or text.
- Calls Lovable AI Gateway (`google/gemini-2.5-flash` for image/text, returns structured `{verdict, reason}` via tool calling).
- For audio: transcribe via Gemini multimodal then judge transcript.
- On `rejected`: delete storage object, delete submission row, insert a `nudges`-style realtime broadcast so partner sees "Upload rejected" toast, return reason to uploader.
- On `approved`: flip `verdict='approved'` → existing trigger awards XP.

## Weekly Penalty

- pg_cron job `weekly-finalize` runs Sundays 23:59 UTC: picks loser, picks random punishment, writes `weekly_winners` row, resets `weekly_xp` Monday 00:01.
- `/penalty` route shown automatically when current week's row has `loser_accepted=false` and current slot is loser. Big "I Accept My Punishment" pill unlocks Monday quest.

## XP Shop

- Locked card with countdown Mon–Sat; full grid on Sundays.
- Purchase deducts XP atomically via `purchase_shop_item` SQL function (checks balance, inserts purchase, decrements `lifetime_xp`).

## Nudge

- Button on Home → inserts `nudges` row → realtime channel triggers a toast on partner's device with quest reminder.

## Reactions

- Long-press / tap reaction bar under each gallery post with 🤎 😂 🔥 🙌.
- Optimistic update; realtime sync.

## PWA (installable, no service worker)

Per Lovable guidance, **manifest-only** install — no `vite-plugin-pwa`, no service worker (these break the editor preview iframe). I'll add:

- `public/manifest.webmanifest` with name, icons, `display: standalone`, brown theme color.
- Generated 192/512 app icons.
- `<link rel="manifest">` and apple touch icons in `__root.tsx` head.

> **Heads up**: full offline support needs a service worker, which is unsafe inside the Lovable editor preview. Manifest-only still gives you "Add to Home Screen" on iOS/Android. If you later want offline caching, we can add it carefully for the published build only.

## Auth

Shared-account email/password (existing). On first sign-in, prompt for both partner display names + accent (warm/cool brown). Stored as two `partners` rows under one `user_id`. Session toggles which slot is "active" — a small avatar switcher in the header.

## Out of scope (v1)

- Push notifications (web push needs a service worker — Nudge uses in-app realtime toast instead).
- Multiple duos, friend codes, comments, profile editing beyond names/accent.

## Tech notes

- All AI verdicts via Lovable AI Gateway through edge function (no client calls).
- Storage bucket `duo-media` already exists (private); signed URLs returned to client.
- Realtime channels: `submissions`, `reactions`, `nudges`, `partners`.
- Built atomically: one big migration → seed data → edge function → frontend rewrite.
