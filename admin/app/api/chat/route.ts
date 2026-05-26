import { createAgentUIStreamResponse } from "ai";
import { chatAgent, researchAgent, type AgentMode } from "@/lib/agents";
import { requireSubconsciousApiKey } from "@/lib/subconscious";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    requireSubconsciousApiKey();
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Missing Subconscious API key",
      },
      { status: 500 },
    );
  }

  const body = await request.json();
  const messages = body.messages ?? [];
  const mode: AgentMode = body.mode === "agent" ? "agent" : "chat";

  if (mode === "agent") {
    return createAgentUIStreamResponse({
      agent: researchAgent,
      uiMessages: messages,
    });
  }

  return createAgentUIStreamResponse({
    agent: chatAgent,
    uiMessages: messages,
  });
}
