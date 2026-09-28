# RecallDesk

RecallDesk is a customer-support workspace where one Groq-powered AI agent answers tickets with optional persistent Hindsight memory.

## Product workflow

1. Load customers and tickets from Supabase.
2. Select a customer and ticket, or create new records.
3. Chat with the single support agent.
4. With Memory OFF, answer from the current ticket and conversation only.
5. With Memory ON, recall relevant Hindsight context and show the actual returned memories.
6. Resolve the ticket with a written resolution.
7. The resolution is stored in Supabase, added to the ticket timeline, and retained in Hindsight for future incidents.

## Architecture

```text
Supabase customers/tickets/messages
              ↓
        Next.js UI
              ↓
         /api/chat
       ↙           ↘
Hindsight recall   Groq single agent
       ↓           ↓
Recalled context ← answer
              ↓
Supabase messages + Hindsight retain
```

## Tech stack

- Next.js App Router, TypeScript, React, Tailwind CSS
- Supabase Postgres via `@supabase/supabase-js`
- Groq via `groq-sdk`
- Hindsight Cloud via `@vectorize-io/hindsight-client`
- Anime.js 4 for restrained UI motion
- Zod and Lucide icons

## Setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Add these server-side environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b

HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=
HINDSIGHT_BANK_ID=recalldesk-support
```

The service role key, Groq key, and Hindsight key are only read by route handlers. They are never exposed to client components.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run [supabase/migrations/001_recalldesk.sql](supabase/migrations/001_recalldesk.sql).
4. Start the app and click **Seed Supabase + memory**.

The seed action upserts three customers, eight realistic tickets, previous messages, resolution events, and corresponding Hindsight resolution memories. It is safe to run again because seed records use stable UUIDs and Hindsight uses stable document IDs.

## API routes

- `GET/POST /api/customers`
- `GET/PATCH /api/customers/[id]`
- `GET/POST /api/customers/[id]/tickets`
- `POST /api/tickets`
- `GET/PATCH /api/tickets/[id]`
- `POST /api/chat`
- `POST /api/seed`

## Hindsight integration

[src/lib/hindsight.ts](src/lib/hindsight.ts) owns the official `HindsightClient`:

- `ensureMemoryBank()` creates or updates the `recalldesk-support` bank.
- `recallRelevantMemories()` queries Hindsight with customer, ticket, environment, and current issue context.
- `retainInteraction()` stores a concise ticket conversation summary.
- `retainResolution()` stores the successful fix when a ticket is resolved.

The Memory panel renders the real `memory.text`, `memory.type`, timestamp, and score returned by Hindsight. It never fabricates memory cards.

## Demo

1. Run the SQL migration.
2. Add environment variables.
3. Start the app.
4. Click **Seed Supabase + memory**.
5. Select Rahul Sharma and the API timeout ticket.
6. Run **Cold Start Demo**. The request uses Memory OFF and no Hindsight recall.
7. Run **Memory Demo**. The request uses Memory ON, recalls Rahul's previous timeout incident, and displays the returned Hindsight context.
8. Create or select a ticket, chat, and resolve it with a resolution.
9. Refresh the browser. Customers, tickets, and conversations remain because they are stored in Supabase.

## Error behavior

- Missing Supabase variables show a clear database configuration error.
- Missing Groq variables prevent chat without a fake response.
- Memory ON fails clearly when Hindsight is unavailable.
- Memory OFF remains independent of Hindsight recall.
- Invalid UUIDs, customers, tickets, and form payloads return clean validation errors.

## Verification

```bash
npm run lint
npm run build
```

This is a hackathon MVP: it intentionally has no authentication, billing, multi-agent orchestration, or external CRM integrations.

