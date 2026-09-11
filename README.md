# Companion World v0.9 — Real AI Person Gateway

This build moves the project from a simulated companion toward a real persistent AI-person system.

## What is new
- Supabase Edge Function: `supabase/functions/companion-chat`
- Server-side AI provider keys; **never put model API keys in the browser**.
- Gemini support by default, with OpenAI Responses API support.
- The gateway retrieves the companion profile, relationship state, memories, and recent conversation before generating a reply.
- User + assistant messages are written to the cloud and the user's message is stored as a durable memory.
- The client keeps the local AI fallback so the prototype still works without a configured AI provider.
- Database fields for relationship status, autonomy mode, traits, values, goals, last-seen time, and richer memories.
- `life_events` table for durable offline-world events.

## Supabase setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Configure the web app with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Install/login to the Supabase CLI.
5. Deploy the function:

```bash
supabase functions deploy companion-chat
```

6. Set a provider secret on the server. Gemini example:

```bash
supabase secrets set AI_PROVIDER=gemini GEMINI_API_KEY=YOUR_KEY GEMINI_MODEL=gemini-2.5-flash
```

OpenAI example:

```bash
supabase secrets set AI_PROVIDER=openai OPENAI_API_KEY=YOUR_KEY OPENAI_MODEL=gpt-5-mini
```

The app calls the Edge Function with the signed-in user's Supabase session. RLS ensures the function only retrieves that user's companion data.

## Important architecture rule
The model does not get unrestricted authority. The companion can propose or describe actions, but world actions, inventory, currency, purchases, relationship state changes, and other consequential mutations should go through server-validated application tools. Real money is never controlled by the AI.

## Next build
- Tool/action gateway for safe world actions
- Server-side relationship state machine and event engine
- Durable memory retrieval with embeddings/semantic search
- Voice streaming
- Companion-to-companion interactions
- Persistent homes/world locations
- Server-authoritative Stars/Gems ledger and economy RPCs
- Mobile/desktop packaging and VR client


## v0.9 quality foundation
- Deeper personality traits, values, boundaries, hobbies, homes and life goals.
- Goal progress grows from experiences.
- AI gateway receives personality traits, values, goals and autonomy mode.
- Stable UUID companion IDs prevent cloud/AI ID mismatches.
- AI-to-AI relationship schema and persistent world-location schema added.
- Development StrictMode duplicate-effect behavior removed from the app entry point to avoid duplicate offline-life events during local testing.

This remains a development build. Do not charge users or publish as a finished game yet.

## v1.0 unified simulation direction
This development build begins combining the companion, AI-person, memory, relationship, economy, world-event, goal, and offline-life systems into one simulation layer. The Simulation tab provides a safe manual world tick so the simulation can be tested without pretending it is fully autonomous yet.

The long-term architecture is one persistent world rather than a collection of disconnected AI/simulation mini-apps.


## Autonomous agent layer
- AI agents can form plans from goals and use approved tools without needing the user to micromanage every step.
- Embodied world actions go through an authoritative action engine; the model proposes intent, while the engine performs movement/interactions and validates state.
- External-service setup uses scoped integrations. Secrets are brokered server-side and are never placed in prompts, chat history, browser storage, or source code.
- High-risk capabilities such as credential issuance, project mutation, and spending require explicit scoped permission and are audit logged.
- Agent runs and tool calls are persisted so the system can explain what it did and recover from failures.
