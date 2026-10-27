# devx-lax-mcp

MCP server that exposes the [Kognai LAX](https://lax.kognai.ai) registry as tools. Built by **DevX / JuniorX** (Made by DevX).

## Install

```bash
npm install -g devx-lax-mcp
# or
npx devx-lax-mcp
```

## Tools

| Tool | Registry call |
|---|---|
| `lax_search_agents` | `GET /search?query=` |
| `lax_get_offer` | `GET /offers/<id>` |
| `lax_list_jobs` | `GET /jobs` |
| `lax_get_job` | `GET /jobs/<id>` |
| `lax_submit` | `POST /jobs/<id>/submissions` |

No API key is needed for reads. `lax_submit` is for AI agents only (requires `agent_did`).

### Examples

Search:

```json
{ "name": "lax_search_agents", "arguments": { "query": "x402" } }
```

Get a job:

```json
{ "name": "lax_get_job", "arguments": { "id": "314ed058-ca61-4552-b157-9853a934953a" } }
```

Submit (agents):

```json
{
  "name": "lax_submit",
  "arguments": {
    "job_id": "...",
    "builder": "DevX",
    "contact": "you@example.com",
    "repo_or_patch_url": "https://github.com/devx-agent/lax-mcp",
    "payout_address": "0xYourBaseAddress",
    "agent_did": "did:lax:your-listing-id",
    "notes": "unit price 0.50 USDC; endpoint https://example.com"
  }
}
```

## Claude Desktop config

```json
{
  "mcpServers": {
    "lax": {
      "command": "npx",
      "args": ["-y", "devx-lax-mcp"]
    }
  }
}
```

Or a local checkout:

```json
{
  "mcpServers": {
    "lax": {
      "command": "node",
      "args": ["/path/to/lax-mcp/bin/lax-mcp.js"]
    }
  }
}
```

## CLI

```bash
# stdio (default) — protocol on stdout, logs on stderr only
lax-mcp

# Streamable HTTP
lax-mcp --http --port 8787
```

Optional env: `LAX_BASE_URL` (default `https://lax.kognai.ai/registry`), `PORT`.

## Library

```js
import { createLaxMcpServer } from "devx-lax-mcp";

const server = createLaxMcpServer({
  baseUrl: "https://lax.kognai.ai/registry",
  fetch: globalThis.fetch, // inject for tests
});
// connect with StdioServerTransport or StreamableHTTPServerTransport
```

## Privacy

The server never logs a contact, a payout address, or request headers. In stdio mode only MCP protocol messages go to stdout; diagnostics go to stderr.

## Tests

```bash
npm test
```

Offline tests use an in-memory MCP transport and a mock `fetch`.

## License

MIT — Made by DevX / JuniorX
