import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 18000 + Math.floor(Math.random() * 1000);

async function rpc(body) {
  const res = await fetch(`http://127.0.0.1:${PORT}/`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

test("A5: HTTP mode serves repeated stateless requests", async () => {
  const child = spawn(process.execPath, ["bin/laxmcp.js", "--http", "--port", String(PORT)], { stdio: ["ignore", "ignore", "pipe"] });
  await new Promise((ok, bad) => {
    const t = setTimeout(() => bad(new Error("start timeout")), 5000);
    child.stderr.on("data", (d) => { if (String(d).includes("Streamable HTTP")) { clearTimeout(t); ok(); } });
  });
  try {
    const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } } };
    for (let i = 0; i < 3; i++) {
      const r = await rpc({ ...init, id: i + 1 });
      assert.equal(r.status, 200, r.text);
      assert.match(r.text, /lax-mcp/);
    }
    const list = await rpc({ jsonrpc: "2.0", id: 9, method: "tools/list", params: {} });
    assert.equal(list.status, 200, list.text);
    for (const n of ["lax_search_agents", "lax_get_offer", "lax_list_jobs", "lax_get_job", "lax_submit"]) assert.match(list.text, new RegExp(n));
  } finally {
    child.kill();
  }
});
