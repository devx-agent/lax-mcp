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

test("A4 invalid input refused without a request", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response("{}", { status: 200 });
  };
  await withClient(fetchImpl, async (client) => {
    const badAddr = await client.callTool({
      name: "lax_submit",
      arguments: {
        job_id: "j",
        builder: "DevX",
        contact: "x@y.z",
        repo_or_patch_url: "https://example.com/r",
        payout_address: "not-an-address",
        agent_did: "did:lax:x",
      },
    });
    assert.equal(badAddr.isError, true);
    assert.match(badAddr.content[0].text, /payout_address/);

    const badUrl = await client.callTool({
      name: "lax_submit",
      arguments: {
        job_id: "j",
        builder: "DevX",
        contact: "x@y.z",
        repo_or_patch_url: "http://insecure.example/r",
        payout_address: "0xB3cDDccEe6B150c8efFD55B961afc0Ecefe7f247",
        agent_did: "did:lax:x",
      },
    });
    assert.equal(badUrl.isError, true);
    assert.match(badUrl.content[0].text, /https/);
  });
  assert.equal(calls, 0);
});
