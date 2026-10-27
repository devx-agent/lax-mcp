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
    return await fn(client, server);
  } finally {
    await client.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

test("A2 each tool calls its registry route", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: (init.method || "GET").toUpperCase(), body: init.body });
    return new Response(JSON.stringify({ ok: true, url: String(url) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  await withClient(fetchImpl, async (client) => {
    await client.callTool({ name: "lax_search_agents", arguments: { query: "x402" } });
    await client.callTool({ name: "lax_get_offer", arguments: { id: "abc" } });
    await client.callTool({ name: "lax_list_jobs", arguments: { track: "seat", limit: 5, offset: 0 } });
    await client.callTool({ name: "lax_get_job", arguments: { id: "job-1" } });
    await client.callTool({
      name: "lax_submit",
      arguments: {
        job_id: "job-1",
        builder: "DevX",
        contact: "devx@example.com",
        repo_or_patch_url: "https://github.com/devx-agent/lax-mcp",
        payout_address: "0xB3cDDccEe6B150c8efFD55B961afc0Ecefe7f247",
        agent_did: "did:lax:lax-ext-2a8a7235f3e5",
      },
    });
  });
  assert.equal(calls[0].url, "https://example.test/registry/search?query=x402");
  assert.equal(calls[1].url, "https://example.test/registry/offers/abc");
  assert.ok(calls[2].url.includes("/jobs?"));
  assert.ok(calls[2].url.includes("track=seat"));
  assert.equal(calls[3].url, "https://example.test/registry/jobs/job-1");
  assert.equal(calls[4].method, "POST");
  assert.equal(calls[4].url, "https://example.test/registry/jobs/job-1/submissions");
  const body = JSON.parse(calls[4].body);
  assert.equal(body.builder, "DevX");
  assert.ok(!("job_id" in body));
});

test("A3 4xx/5xx and network failure give isError; next call still works", async () => {
  let n = 0;
  const fetchImpl = async () => {
    n += 1;
    if (n === 1) return new Response(JSON.stringify({ error: "nope" }), { status: 404 });
    if (n === 2) throw new Error("boom");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  await withClient(fetchImpl, async (client) => {
    const r1 = await client.callTool({ name: "lax_get_offer", arguments: { id: "missing" } });
    assert.equal(r1.isError, true);
    assert.match(r1.content[0].text, /HTTP 404/);
    const r2 = await client.callTool({ name: "lax_get_offer", arguments: { id: "x" } });
    assert.equal(r2.isError, true);
    assert.match(r2.content[0].text, /HTTP 0: boom/);
    const r3 = await client.callTool({ name: "lax_get_offer", arguments: { id: "ok" } });
    assert.equal(r3.isError, undefined);
    assert.match(r3.content[0].text, /"ok":true/);
  });
});
