import createDefault, { createLaxMcpServer, type LaxMcpServerOptions } from "../src/index.js";
const opts: LaxMcpServerOptions = { baseUrl: "https://example.com", fetch: globalThis.fetch };
const s = createLaxMcpServer(opts);
const s2 = createDefault();
void s; void s2;
