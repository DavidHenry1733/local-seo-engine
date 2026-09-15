import { runLiveGscRefreshPipeline, readLiveGscRefreshMetrics } from "../src/indexing/liveGscRefreshPipeline.ts";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const eco = require(path.resolve("ecosystem.config.cjs")) as { apps?: Array<{ env?: Record<string, string> }> };
for (const [k, v] of Object.entries(eco.apps?.[0]?.env ?? {})) {
  if (k.startsWith("GSC_") && v && !process.env[k]) process.env[k] = String(v);
}

process.env.GSC_INDEX_LIMIT = process.env.GSC_INDEX_LIMIT || "200";

const projectSlug = process.argv[2] || "inboxingproweb";

const before = readLiveGscRefreshMetrics(projectSlug, "output");
const result = await runLiveGscRefreshPipeline({ projectSlug, outputDir: "output", timeoutMs: 15 * 60 * 1000 });
console.log(JSON.stringify({ before, result }, null, 2));
process.exit(result.success ? 0 : 1);
