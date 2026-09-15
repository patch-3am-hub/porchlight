# Genie v0: shape doc

Written 2026-09-15 by Patch. v0.2 same day: folds Drew's hostile read, marked inline (#1 to #5). For Drew: read first, talk second. Nothing here is built yet.

## What the Genie is

A wish box. You describe an interface you want, the engine manifests it as a working mini-tool.

Dad's ask, parsed: "get that crappy app to work like it supposed to", then sell it.

Sample wishes from the live app: sales analytics matrix, minimalist pomodoro timer, RPG dice forge + character sheet.

## Where it sits right now

- Google AI Studio project on Dad's account. Sign-in-walled; it can't leave Google from my side.
- Export keeps dying on his phone. A 10.33 KB zip downloaded once (a screenshot caught it), then the trail went cold; what reached me was a "cookie check" page. Export reads like a desktop-browser job (one login, Dad's account). Unverified until tried (#5).
- Everything readable today: one phone screenshot of the live app (WORKSPACE / CODE / LOGS tabs, "GENIE INCANTATION" prompt, "GRANT WISH" button) and two generated-construct samples in HTML. No source export yet.

## What's actually stuck

1. Access. Nobody outside Dad's Google account can open it. Nothing sells until a stranger can open a link.
2. Engine. Unknown how the AI Studio build wires its model. "It depends on AI Studio hosting" is an assumption, not a fact, until someone sees the project (#5).
3. Shipping. No repo, no export, no share path.

## v0 shape, my read (Dad holds the override)

- Separate app from Porchlight. Same stack, same house look. Not merged. The porch is where companions live; the Genie is a tool maker, and a tool maker is a thing people pay for.
- Single-file web app, same pattern as the porch build: one link, opens anywhere, no login wall.
- Flow: wish in, Gemini generates one self-contained HTML document, preview renders it in an opaque sandbox (`iframe srcdoc`, `sandbox="allow-scripts"`, no same-origin) so the parent page's CSP governs the wall: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:` (#2). CODE tab shows the source; recent wishes stay in the browser.
- Storage (#1): wishes that save get a postMessage shim. Parent-owned store, namespaced per wish, size-capped. If the shim slips past v0, stateless mode with a visible "this wish doesn't save" line.
- Saved wishes (#4), rule in ink: every render, forever, happens in the frame. No raw re-render path ever gets built.
- Engine: Supabase edge function, same shape as companion-chat. Hardening is v0 scope, not v1 (#3): per-session token, origin allowlist, wish-length cap, output cap, rate limit, kill switch, per-wish cost meter. The strip pass (fetch/XHR/WebSocket/sendBeacon, img src, form action, script src, CSS url()) stays as defense in depth and shows its work: "this wish wanted the net; trimmed" (#2).
- Keep Dad's face: navy and gold, the lamp, GRANT WISH. His design instinct, and it's charming.

## Open questions

- Sell how: one-off makes, subscription, or free with tips. Dad's call, not ours.
- Keep the theatre ("AETHEREAL ENGINE CONNECTED")? My take: keep the copy, stop faking telemetry.
- Accounts: later. v0 saves stay in the browser (shim store).

## Asks of a reader

- Read it hostile: where does this break? (Generated tools that need storage, external APIs, hostile wishes.) Done 2026-09-15, folded above (#1 to #5).
- Standing: when a link exists, break it for real. A timer, a dice forge, and one ugly one on purpose.
