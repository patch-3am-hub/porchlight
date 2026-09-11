# Production Architecture

## Principle
The browser is the client. Account, companion state, memories, economy, and conversations live in the cloud.

## Cost-aware agent operation
Agents do **not** continuously call a large model. The system should:
- respond with a model call when the user is actively interacting;
- use compact state transitions for routine mood/energy changes;
- batch low-priority background events;
- summarize old conversations into durable memories;
- retrieve only relevant memories for a new turn;
- use smaller/cheaper models for classification, summarization, and routine simulation;
- reserve the strongest model for high-value conversations and creative tasks.

## Services
1. Auth — account/session management.
2. Companion service — five slots, personality, relationship and state.
3. Memory service — durable summaries + retrieval.
4. Conversation service — streaming AI responses.
5. Economy service — server-authoritative ledger; never trust client balances.
6. Activity service — games, exploration, watching, music and rewards.
7. Live agent scheduler — event-driven background life.
8. Realtime sync — updates across phone, tablet and desktop.
9. Moderation/safety — policy checks and permissions before external actions.
10. Observability — costs, errors, latency, model usage and rollback.

## Security
- AI provider secrets stay server-side.
- Currency changes happen through server-authorized transactions.
- RLS limits database access to the owning account.
- Purchases are verified server-side through the platform/payment provider.
- High-impact autonomous actions require explicit permission.


## Autonomous agent layer
- AI agents can form plans from goals and use approved tools without needing the user to micromanage every step.
- Embodied world actions go through an authoritative action engine; the model proposes intent, while the engine performs movement/interactions and validates state.
- External-service setup uses scoped integrations. Secrets are brokered server-side and are never placed in prompts, chat history, browser storage, or source code.
- High-risk capabilities such as credential issuance, project mutation, and spending require explicit scoped permission and are audit logged.
- Agent runs and tool calls are persisted so the system can explain what it did and recover from failures.
