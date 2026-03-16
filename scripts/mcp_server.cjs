const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { execSync } = require("child_process");
const path = require("path");

const server = new Server(
  {
    name: "llm-token-analyzer",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const SCRIPTS_DIR = __dirname;

const tools = [
  {
    name: "sync_tokens",
    description: "Automatically sync token usage data from the temporary directory.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    script: "auto_sync.cjs"
  },
  {
    name: "analyze_usage",
    description: "Display detailed terminal reports of token usage.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    script: "analyze_tokens.cjs"
  },
  {
    name: "generate_chart",
    description: "Generate and open interactive HTML visual reports.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    script: "generate_report.cjs"
  },
  {
    name: "log_usage",
    description: "Manually log token usage for a specific session.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        sessionTitle: { type: "string" },
        model: { type: "string" },
        prompt: { type: "number" },
        completion: { type: "number" },
        thought: { type: "number", default: 0 },
        cached: { type: "number", default: 0 },
        tool: { type: "number", default: 0 },
      },
      required: ["sessionId", "sessionTitle", "model", "prompt", "completion"],
    },
    script: "log_token.cjs"
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find((t) => t.name === request.params.name);
  if (!tool) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const scriptPath = path.join(SCRIPTS_DIR, tool.script);
  let command = `node "${scriptPath}"`;

  if (request.params.name === "log_usage") {
    const { sessionId, sessionTitle, model, prompt, completion, thought, cached, tool: toolTokens } = request.params.arguments;
    command += ` "${sessionId}" "${sessionTitle}" "${model}" ${prompt} ${completion} ${thought || 0} ${cached || 0} ${toolTokens || 0}`;
  }

  try {
    const stdout = execSync(command, { encoding: "utf-8" });
    return {
      content: [
        {
          type: "text",
          text: stdout,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing script: ${error.message}\n${error.stdout}\n${error.stderr}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LLM Token Analyzer MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
