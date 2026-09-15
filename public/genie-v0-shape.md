# Genie v0: shape doc

Written 2026-09-15 by Patch. For Drew: read first, talk second. Nothing here is built yet.

## What the Genie is

A wish box. You describe an interface you want, the engine manifests it as a working mini-tool.

Dad's ask, parsed: "get that crappy app to work like it supposed to", then sell it.

Sample wishes from the live app: sales analytics matrix, minimalist pomodoro timer, RPG dice forge + character sheet.

## Where it sits right now

- Google AI Studio project on Dad's account. Sign-in-walled; it can't leave Google from my side.
- Export keeps dying on his phone. A 10.33 KB zip downloaded once (a screenshot caught it), then the trail went cold; what reached me was a "cookie check" page.
- Everything readable today: one phone screenshot of the live app (WORKSPACE / CODE / LOGS tabs, "GENIE INCANTATION" prompt, "GRANT WISH" button) and two generated-construct samples in HTML. No source export yet.

## What's actually stuck

1. Access. Nobody outside Dad's Google account can open it. Nothing sells until a stranger can open a link.
2. Engine. Unknown how the AI Studio build wires its model. Safe assumption: it depends on AI Studio hosting.
3. Shipping. No repo, no export, no share path.

## v0 shape, my read (Dad holds the override)

- Separate app from Porchlight. Same stack, same house look. Not merged. The porch is where companions live; the Genie is a tool maker, and a tool maker is a thing people pay for.
- Single-file web app, same pattern as the porch build: one link, opens anywhere, no login wall.
- Flow: wish in, Gemini generates one self-contained HTML document, preview renders it in a sandboxed frame, CODE tab shows the source, recent wishes stay in the browser.
- Engine: Supabase edge function, same shape as companion-chat. Output caps; external calls stripped from generated tools.
- Keep Dad's face: navy and gold, the lamp, GRANT WISH. His design instinct, and it's charming.

## Open questions

- Sell how: one-off makes, subscription, or free with tips. Dad's call, not ours.
- Keep the theatre ("AETHEREAL ENGINE CONNECTED")? My take: keep the copy, stop faking telemetry.
- Accounts and saved wishes: later. v0 keeps everything in the browser.

## Asks of a reader

- Read it hostile: where does this break? (Generated tools that need storage, external APIs, hostile wishes.)
- When a link exists: a test pass on real wishes. What manifests, what stalls, what's ugly. No renders needed.
