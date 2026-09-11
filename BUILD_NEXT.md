# Build roadmap

## v1.0 Unified AI + Simulation
- Combine AI people, memories, relationships, goals, economy, locations, homes, activities, and offline life into one authoritative simulation.
- Keep AI provider keys server-side.
- Add deterministic event IDs and server-side transactions.
- Add AI-to-AI social graph and scheduled routines.
- Add durable world clock and server tick processing.

## v1.1 Social world
- Companion-to-companion conversations and relationships.
- Shared events, groups, friendships, conflict, reconciliation.
- World locations and persistent homes.

## v1.2 Voice and richer interaction
- Streaming voice.
- Avatar state and emotional animation.
- Shared media/game sessions.

## v1.3 Production hardening
- Server-authoritative economy.
- Purchase verification.
- Observability, backups, migration tests, rate limits, abuse prevention.
- Automated regression tests and staged deployment.


## Autonomous agent layer
- AI agents can form plans from goals and use approved tools without needing the user to micromanage every step.
- Embodied world actions go through an authoritative action engine; the model proposes intent, while the engine performs movement/interactions and validates state.
- External-service setup uses scoped integrations. Secrets are brokered server-side and are never placed in prompts, chat history, browser storage, or source code.
- High-risk capabilities such as credential issuance, project mutation, and spending require explicit scoped permission and are audit logged.
- Agent runs and tool calls are persisted so the system can explain what it did and recover from failures.
