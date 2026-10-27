#!/usr/bin/env node
import { createLaxMcpServer } from "../src/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";

function parseArgs(argv) {
  const out = { http: false, port: Number(process.env.PORT) || 8787 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--http") out.http = true;
    else if (a === "--port") out.port = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      process.stderr.write(
        "Usage: devx-lax-mcp [--http] [--port N]\n  default: stdio\n  --http: Streamable HTTP on --port (or PORT)\n"
      );
      process.exit(0);
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.http) {
    // Stateless Streamable HTTP: a fresh server + transport per request.
    // A single stateless transport cannot be reused across requests in SDK 1.x.
    const httpServer = createServer(async (req, res) => {
      const reqServer = createLaxMcpServer({ baseUrl: process.env.LAX_BASE_URL || undefined });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => {
        transport.close().catch(() => {});
        reqServer.close().catch(() => {});
      });
      try {
        await reqServer.connect(transport);
        await transport.handleRequest(req, res);
      } catch (e) {
        process.stderr.write(`http error: ${e && e.message ? e.message : e}\n`);
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "internal" }));
        }
      }
    });
    httpServer.listen(opts.port, () => {
      process.stderr.write(`lax-mcp Streamable HTTP on :${opts.port}\n`);
    });
  } else {
    const server = createLaxMcpServer({ baseUrl: process.env.LAX_BASE_URL || undefined });
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e && e.message ? e.message : e}\n`);
  process.exit(1);
});
