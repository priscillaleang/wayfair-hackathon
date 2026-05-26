<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Hackathon starter

Next.js chat + agents on **Subconscious** via **Vercel AI SDK** `ToolLoopAgent`.

## Hackathon tracks

1. **Consumer shopping** — discovery & buyer experience for furniture
2. **Supply chain** — manage shipping, suppliers, inventory, ops
3. **FinOps & customer service** — internal ops, finance, support

See `README.md` for full challenge descriptions and starter ideas.

## Before coding

1. `SUBCONSCIOUS_API_KEY` required — https://www.subconscious.dev/platform
2. Subconscious API reference: `.agents/skills/subconscious-dev/SKILL.md`
3. Extend tools in `lib/tools/`, agents in `lib/agents/`

## Repo map

- `lib/subconscious.ts` — model provider
- `lib/tools/` — function tools + MCP template
- `lib/agents/` — chat vs research agents
- `app/api/chat/route.ts` — streaming API
- `components/chat-app.tsx` — UI
