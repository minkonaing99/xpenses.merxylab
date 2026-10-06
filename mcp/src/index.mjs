#!/usr/bin/env node
// Local stdio MCP adapter. Credentials remain in the process environment.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "./client.mjs";
import { createMcpServer } from "./server.mjs";

const client = createClient({
  baseUrl: process.env.XPENSES_API_URL,
  token: process.env.XPENSES_API_TOKEN,
});
await createMcpServer(client).connect(new StdioServerTransport());
