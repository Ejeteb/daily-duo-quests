
# The Daily Duo — Build Plan

A premium dark-themed relationship game where you and your partner complete one shared daily quest, reveal each other's submissions, and battle for weekly XP supremacy.

## Core experience

**Daily flow**
- One quest per UTC day, picked randomly from a 100+ pool (no repeat until pool exhausted, tracked per duo).
- Each partner has their own board. Their post stays blurred to the other until BOTH have uploaded — then both unblur instantly.
- 24-hour countdown timer until quest resets at midnight.
- Upload supports image (camera/gallery) or audio recording, depending on quest type. Some quests are "either" (action/memory) and accept both.

**XP & Levels**
- Both submit within 24h → +50 XP each
- Only one submits → that partner gets +10 XP
- Lifetime XP drives Level Title:
  - L1 Newbies (0) · L2 Crushing (100) · L3 Going Steady (300) · L4 Power Couple (700) · L5 Soulmates (1500) · L6 Legendary Duo (3000)
- Weekly XP tracked separately, resets Sunday 11:59pm. Sunday celebration screen crowns the week's winner ("You pick dinner / movie tonight!").

## Screens

1. **Auth** — single shared account login (email + password). On first login, you set both partners' display names + accent colors (e.g., "Alex 💜" vs "Sam 💚").
2. **Today** (home) — quest card, countdown, two side-by-side boards (You / Partner). Upload button on your side. Partner's tile shows blurred preview + "Waiting for them…" or "Tap to reveal" once both done.
3. **Versus Leaderboard** — big VS layout: avatars, lifetime XP bars, level titles, this week's score, current streak.
4. **History** — scrollable gallery grid of past days (date, quest text, both reveals side-by-side, audio playback). Filterable by partner.
5. **Sunday Winner** — modal/route shown Sunday night with confetti and the prize prompt.

## Visual design

- Dark base (#0A0A0F), card surface (#14141C), neon accents: electric purple (#A855F7) + cyan (#22D3EE), with each partner assigned one accent.
- Glow shadows on active elements, subtle gradient borders, blurred glass cards.
- Typography: tight modern sans (Inter), oversized display numbers for XP/countdown.
- Micro-animations: blur lift on reveal, XP counter tick-up, level-up burst.

## Quest pool (100+)

Mixed across categories — Visual, Audio, Action, Memory, Silly, Sensory. Stored in a `quests` table seeded on setup. Examples included like "Snap your favorite snack right now," "Hum a song I have to guess," "Selfie with a flower or leaf," "Photo of something that reminds you of our first date," plus many more (sky right now, weirdest face, left shoe, view from your window, mug you used today, song lyric in your voice, something red, oldest thing in your bag, etc.).

## Data model (Lovable Cloud)

- `profiles` — partner_slot ('a'|'b'), display_name, accent_color, avatar_url, lifetime_xp, weekly_xp, streak, last_completed_date
- `quests` — id, prompt, category, accepts ('image'|'audio'|'either')
- `daily_quests` — date (PK), quest_id, used_quest_ids (array for no-repeat tracking)
- `submissions` — id, date, partner_slot, media_url, media_type, created_at
- `xp_events` — for audit/history
- Storage bucket `duo-media` (private, signed URLs)
- Realtime enabled on `submissions` and `profiles` so reveals + XP sync live across both phones.

## Server logic

- Server function picks/creates today's quest on first load (atomic).
- On submission insert: check if partner has also submitted today → if yes, award +50 to both and mark reveal; if 24h elapses without partner, scheduled check awards +10 to the lone submitter.
- Weekly reset job (server fn checked on each load): if it's a new week, snapshot weekly winner, reset weekly_xp.

## Technical notes

- TanStack Start routes: `/` (today), `/login`, `/leaderboard`, `/history`, `/sunday`. Auth-protected via `_authenticated` layout.
- Supabase via Lovable Cloud; realtime channels for live unblur.
- Audio recording via MediaRecorder API; image upload via standard file input with camera capture attribute.
- Countdown derived from UTC midnight client-side.

## Out of scope (v1)

- Push notifications (browser only, can add later)
- Multiple duos / friend codes (single shared account model chosen)
- Comments / reactions on posts
