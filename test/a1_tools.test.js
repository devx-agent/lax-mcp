import { test } from "node:test";
import assert from "node:assert/strict";
import { createLaxMcpServer } from "../src/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

async function withClient(fetchImpl, fn) {
  const server = createLaxMcpServer({ fetch: fetchImpl, baseUrl: "https://example.test/registry" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

test("A1 tools/list returns the five tools with schemas", async () => {
  await withClient(async () => new Response("{}", { status: 200 }), async (client) => {
    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "lax_get_job",
      "lax_get_offer",
      "lax_list_jobs",
      "lax_search_agents",
      "lax_submit",
    ]);
    for (const t of listed.tools) {
      assert.ok(t.description && t.description.length > 0, `${t.name} needs description`);
      assert.ok(t.inputSchema, `${t.name} needs inputSchema`);
    }
  });
});
