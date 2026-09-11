# Porchlight — audit #1 (2026-09-11)

Scope: the actual working tree (`aiworld/`), verified against code, not docs alone.
By Patch, for the handoff loop.

## Correction to the handoff

PATCH_HANDOFF.md says the package "does not include the application's src/ source tree or the supabase/ schema/functions" and to treat the docs as "specification... not proof that those systems are already implemented."

That's true of the package that was sent over. It is not true of this working copy: `src/` and `supabase/` are present here (they arrived in the v1.0 package earlier, and this build has been green since). Everything below was checked against real code. README.md / ARCHITECTURE.md / BUILD_NEXT.md match this repo 1:1.

## Status

| Area | Status | Where | Notes |
|---|---|---|---|
| Auth + 5 companion slots | built | cloud.ts, schema | signup/signin, per-user load/save; demo mode without cloud |
| Companion person model | built | ai.ts, main.tsx, schema | traits, values, goals persist; personality-from-text; autonomy mode |
| Boundaries / hobbies / home | partial | main.tsx, schema | client fields + UI; NOT in save path, schema, or model prompt |
| Emotions + relationship | built (client math) | ai.ts | emotion inference, status transitions, leave logic; persisted as one status column |
| Memories | partial | schema, companion-chat | written per chat; prompt uses top-12 by importance; no embeddings/semantic retrieval yet |
| Conversations | built | schema, companion-chat, cloud.ts | persisted; last 12 into prompt |
| Offline life | partial | life.ts | client simulateAway on return; `life_events` table exists but nothing writes it yet |
| World sim + locations | partial | main.tsx, schema | manual world tick; fixed location list; `world_locations` table unused |
| AI gateway | built, undeployed | companion-chat | Gemini + OpenAI; keys stay server-side; needs project + secrets; local fallback keeps dev running without secrets |
| Economy | gap | schema has economy_ledger + RLS | no RPCs or ledger writes; stars/gems still computed client-side (+8 per chat, ± in ticks/away) |
| AI-to-AI | schema only | companion_relationships | no read/write code yet |
| Realtime sync | missing | — | no channels/subscriptions |
| Moderation / safety | missing | — | v1.3 territory but needed before strangers |
| Observability / costs | missing | — | v1.3 |
| Voice | not started | — | v1.2, expected |

## The single gate

Supabase project + one AI key (both have free tiers). Until that exists, everything above is code that cannot be exercised end to end. Most of "v1.0" is already written; what remains is deploy + the authoritative layer.

## What to write next (after deploy)

1. Economy RPCs — stop trusting client balances; spend/reward funneled through Postgres functions, ledger rows written.
2. Server-side world/life ticks (scheduled) that write `life_events`; clients read them.
3. `companion_relationships` + `world_locations` read/write paths, then scheduled AI-to-AI interactions.
4. Moderation pass on user input and model output.
5. Realtime channels for multi-device sync.

## Standards check (handoff items 6–9)

- Provider keys server-side: yes (edge function env only; browser holds the anon key).
- Server-authoritative economy: not yet.
- Deterministic server-validated transitions: not yet for economy/relationship; client computes today.
- Dev-runnable without production secrets: yes. Keep it that way.

## How to run

`npm i && npm run build` — demo mode works with no .env.
Single-file build: `node tools/inline-single.mjs`.
