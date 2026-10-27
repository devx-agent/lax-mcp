import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface LaxMcpServerOptions {
  /** LAX registry base URL. Default: https://lax.kognai.ai/registry */
  baseUrl?: string;
  /** Custom fetch implementation (e.g. for tests). Default: globalThis.fetch */
  fetch?: typeof globalThis.fetch;
}

/** Create an MCP server exposing the five LAX registry tools. Not connected. */
export declare function createLaxMcpServer(options?: LaxMcpServerOptions): McpServer;
export default createLaxMcpServer;
