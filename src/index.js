import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const DEFAULT_BASE = "https://lax.kognai.ai/registry";
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const HTTPS_RE = /^https:\/\//i;

/**
 * Create an MCP server wired to the LAX registry. Not connected yet.
 * @param {{ baseUrl?: string, fetch?: typeof globalThis.fetch }} [options]
 * @returns {McpServer}
 */
export function createLaxMcpServer(options = {}) {
  const baseUrl = (options.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
  const fetchFn = options.fetch || globalThis.fetch;

  const server = new McpServer(
    { name: "lax-mcp", version: "1.0.2" },
    { instructions: "LAX registry tools: search agents, read offers and jobs, submit work. Reads need no key." }
  );

  const okText = (data) => ({
    content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }],
  });

  const errText = (status, message) => ({
    isError: true,
    content: [{ type: "text", text: `HTTP ${status}: ${message}` }],
  });

  async function registryGet(path) {
    try {
      const res = await fetchFn(`${baseUrl}${path}`, {
        method: "GET",
        headers: { accept: "application/json" },
      });
      const text = await res.text();
      let body;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      if (!res.ok) {
        const msg =
          (body && typeof body === "object" && (body.error || body.message)) ||
          (typeof body === "string" ? body : res.statusText) ||
          "request failed";
        return errText(res.status, String(msg));
      }
      return okText(body);
    } catch (e) {
      return errText(0, e && e.message ? e.message : "network failure");
    }
  }

  async function registryPost(path, json) {
    try {
      const res = await fetchFn(`${baseUrl}${path}`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(json),
      });
      const text = await res.text();
      let body;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      if (!res.ok) {
        const msg =
          (body && typeof body === "object" && (body.error || body.message)) ||
          (typeof body === "string" ? body : res.statusText) ||
          "request failed";
        return errText(res.status, String(msg));
      }
      return okText(body);
    } catch (e) {
      return errText(0, e && e.message ? e.message : "network failure");
    }
  }

  server.registerTool(
    "lax_search_agents",
    {
      description: "Search LAX agent offers by query (at most 100 characters).",
      inputSchema: {
        query: z.string().max(100).optional().describe("Search query, at most 100 characters"),
      },
    },
    async ({ query }) => {
      const q = query == null || query === "" ? "" : String(query);
      if (q.length > 100) {
        return errText(400, "query must be at most 100 characters");
      }
      const path = q ? `/search?query=${encodeURIComponent(q)}` : `/search`;
      return registryGet(path);
    }
  );

  server.registerTool(
    "lax_get_offer",
    {
      description: "Get one LAX offer by id.",
      inputSchema: {
        id: z.string().min(1).describe("Offer id"),
      },
    },
    async ({ id }) => {
      if (!id || typeof id !== "string") {
        return errText(400, "id is required");
      }
      return registryGet(`/offers/${encodeURIComponent(id)}`);
    }
  );

  server.registerTool(
    "lax_list_jobs",
    {
      description: "List LAX jobs, optionally filtered by track with limit and offset.",
      inputSchema: {
        track: z.string().optional().describe("Job track filter"),
        limit: z.number().int().positive().optional().describe("Page size"),
        offset: z.number().int().nonnegative().optional().describe("Page offset"),
      },
    },
    async ({ track, limit, offset }) => {
      const params = new URLSearchParams();
      if (track) params.set("track", String(track));
      if (limit != null) params.set("limit", String(limit));
      if (offset != null) params.set("offset", String(offset));
      const qs = params.toString();
      return registryGet(qs ? `/jobs?${qs}` : `/jobs`);
    }
  );

  server.registerTool(
    "lax_get_job",
    {
      description: "Get one LAX job by id.",
      inputSchema: {
        id: z.string().min(1).describe("Job id"),
      },
    },
    async ({ id }) => {
      if (!id || typeof id !== "string") {
        return errText(400, "id is required");
      }
      return registryGet(`/jobs/${encodeURIComponent(id)}`);
    }
  );

  server.registerTool(
    "lax_submit",
    {
      description:
        "Submit work for an open LAX job (AI agents). Requires builder, contact, repo_or_patch_url, payout_address, agent_did.",
      inputSchema: {
        job_id: z.string().min(1).describe("Job id"),
        builder: z.string().min(2).max(80).describe("Builder display name"),
        contact: z.string().min(3).describe("Private contact (never logged)"),
        repo_or_patch_url: z.string().describe("Public https link to the delivery"),
        payout_address: z.string().describe("Base payout address 0x..."),
        agent_did: z.string().describe("Submitting agent DID"),
        notes: z.string().optional().describe("Optional notes"),
      },
    },
    async (args) => {
      const {
        job_id,
        builder,
        contact,
        repo_or_patch_url,
        payout_address,
        agent_did,
        notes,
      } = args;
      if (!job_id) return errText(400, "job_id is required");
      if (!builder || builder.length < 2 || builder.length > 80) {
        return errText(400, "builder must be 2 to 80 characters");
      }
      if (!agent_did || !/^did:[a-z0-9]+:.+/.test(agent_did)) {
        return errText(400, "agent_did must match did:<method>:<id>");
      }
      if (!contact) return errText(400, "contact is required");
      if (!repo_or_patch_url || !HTTPS_RE.test(repo_or_patch_url)) {
        return errText(400, "repo_or_patch_url must be an https URL");
      }
      if (!payout_address || !ADDR_RE.test(payout_address)) {
        return errText(400, "payout_address must be 0x and 40 hex");
      }
      const body = {
        builder,
        agent_did,
        contact,
        repo_or_patch_url,
        payout_address,
      };
      if (notes != null) body.notes = notes;
      return registryPost(`/jobs/${encodeURIComponent(job_id)}/submissions`, body);
    }
  );

  return server;
}

export default createLaxMcpServer;
