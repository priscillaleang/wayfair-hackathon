import { tool } from "ai";
import { z } from "zod";

/**
 * MCP → AI SDK tool bridge (starter template)
 *
 * Subconscious chat completions use standard OpenAI function tools. MCP servers
 * expose their own tool schemas — your job is to wrap them as AI SDK `tool()`
 * definitions and call the MCP client in `execute`.
 *
 * Quick start during the hackathon:
 * 1. `pnpm add @modelcontextprotocol/sdk`
 * 2. Connect to an MCP server (stdio, SSE, or streamable HTTP)
 * 3. List tools with `client.listTools()`
 * 4. For each MCP tool, create an AI SDK tool that forwards `execute` to `client.callTool()`
 *
 * @example
 * ```ts
 * import { Client } from "@modelcontextprotocol/sdk/client/index.js";
 * import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
 *
 * const transport = new StdioClientTransport({ command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"] });
 * const client = new Client({ name: "hackathon", version: "1.0.0" });
 * await client.connect(transport);
 * const { tools } = await client.listTools();
 * ```
 *
 * Cloudflare, Baseten, and custom MCP servers follow the same pattern — only the
 * transport changes.
 */

export type McpToolDefinition = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

/** Example placeholder — swap the execute body for a real MCP callTool. */
export const exampleMcpLookup = tool({
  description:
    "Example MCP-style lookup. Replace execute() with client.callTool({ name, arguments }).",
  inputSchema: z.object({
    resource: z.string().describe("Resource or entity to look up"),
  }),
  execute: async ({ resource }) => {
    return {
      resource,
      status: "stub",
      message:
        "Wire this tool to your MCP server in lib/tools/mcp-tools.ts. See file comments for the pattern.",
    };
  },
});

export function createMcpTools() {
  return {
    exampleMcpLookup,
  };
}
