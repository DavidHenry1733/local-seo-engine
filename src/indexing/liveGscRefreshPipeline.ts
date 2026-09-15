import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fetchAccessToken, detectAuthMethod, runIndexTracking } from "./indexTrackingEngine";
import { buildUrlLifecycle } from "./urlLifecycleEngine";
import { buildIndexDashboard } from "./indexDashboardEngine";
import { buildSeoHealthScore } from "./seoHealthScoreEngine";
import { buildFullPageAudit } from "./fullPageAuditEngine";
import { syncDashboardSeoIntelligenceContract } from "./syncDashboardSeoIntelligenceContract";

export interface LiveGscRefreshMetrics {
  score: number | null;
  grade: string | null;
  indexed: number | null;
  notIndexed: number | null;
  lifecycleGaps: number | null;
}

export interface LiveGscRefreshResult {
  success: boolean;
  projectSlug: string;
  gscPropertyUsed: string;
  runtimeMs: number;
  before: LiveGscRefreshMetrics;
  after: LiveGscRefreshMetrics;
  filesRefreshed: string[];
  contractRefreshed: boolean;
  error?: string;
}

const REFRESH_FILES = [
  "index-tracking.json",
  "url-lifecycle.json",
  "index-dashboard.json",
  "seo-health-score.json",
  "full-page-audit.json",
  "dashboard-seo-intelligence-contract.json",
] as const;

function ensureGscOAuthEnv(): void {
  if (process.env.GSC_OAUTH_CLIENT_ID && process.env.GSC_OAUTH_CLIENT_SECRET) return;
  try {
    const require = createRequire(import.meta.url);
    const eco = require(path.resolve(process.cwd(), "ecosystem.config.cjs")) as {
      apps?: Array<{ env?: Record<string, string> }>;
    };
    const pm2Env = eco.apps?.[0]?.env ?? {};
    for (const [key, value] of Object.entries(pm2Env)) {
      if (key.startsWith("GSC_") && value && !process.env[key]) {
        process.env[key] = String(value);
      }
    }
  } catch {
    // ecosystem.config.cjs may be unavailable in some environments
  }
}

export function resolveGscDomainProperty(projectSlug: string, workspaceRoot: string): string {
  const configPath = path.join(workspaceRoot, "config", "projects", `${projectSlug}.json`);
  if (!fs.existsSync(configPath)) return "sc-domain:local.inboxingproweb.com";
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as { domain?: string };
    const hostname = new URL(String(config.domain || "")).hostname;
    return hostname ? `sc-domain:${hostname}` : "sc-domain:local.inboxingproweb.com";
  } catch {
    return "sc-domain:local.inboxingproweb.com";
  }
}

export function readLiveGscRefreshMetrics(
  projectSlug: string,
  outputDir: string,
): LiveGscRefreshMetrics {
  const projectDir = path.join(outputDir, projectSlug);
  const scorePath = path.join(projectDir, "seo-health-score.json");
  const lifecyclePath = path.join(projectDir, "url-lifecycle.json");
  const dashPath = path.join(projectDir, "index-dashboard.json");

  let score: number | null = null;
  let grade: string | null = null;
  let indexed: number | null = null;
  let notIndexed: number | null = null;
  let lifecycleGaps: number | null = null;

  if (fs.existsSync(scorePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(scorePath, "utf8")) as {
        overallScore?: number;
        grade?: string;
        componentScores?: { indexing?: { metrics?: { indexed?: number; notIndexed?: number } } };
      };
      score = data.overallScore ?? null;
      grade = data.grade ?? null;
      indexed = data.componentScores?.indexing?.metrics?.indexed ?? null;
      notIndexed = data.componentScores?.indexing?.metrics?.notIndexed ?? null;
    } catch { /* ignore */ }
  }

  if (fs.existsSync(dashPath)) {
    try {
      const dash = JSON.parse(fs.readFileSync(dashPath, "utf8")) as { summary?: { indexed?: number; notIndexed?: number } };
      indexed = dash.summary?.indexed ?? indexed;
      notIndexed = dash.summary?.notIndexed ?? notIndexed;
    } catch { /* ignore */ }
  }

  if (fs.existsSync(lifecyclePath)) {
    try {
      const lifecycle = JSON.parse(fs.readFileSync(lifecyclePath, "utf8")) as {
        summary?: { missingLifecycleDataCount?: number; urlsMissingLifecycleData?: unknown[] };
      };
      lifecycleGaps = lifecycle.summary?.missingLifecycleDataCount
        ?? lifecycle.summary?.urlsMissingLifecycleData?.length
        ?? null;
    } catch { /* ignore */ }
  }

  return { score, grade, indexed, notIndexed, lifecycleGaps };
}

export async function runLiveGscRefreshPipeline(options: {
  projectSlug: string;
  outputDir?: string;
  workspaceRoot?: string;
  timeoutMs?: number;
}): Promise<LiveGscRefreshResult> {
  const started = Date.now();
  const outputDir = options.outputDir ?? path.resolve(process.cwd(), "output");
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
  const gscPropertyUsed = resolveGscDomainProperty(options.projectSlug, workspaceRoot);
  const before = readLiveGscRefreshMetrics(options.projectSlug, outputDir);

  const run = async (): Promise<LiveGscRefreshResult> => {
    ensureGscOAuthEnv();
    if (detectAuthMethod() === "none") {
      throw new Error("No Google Search Console credentials configured. Connect GSC OAuth first.");
    }
    const token = await fetchAccessToken();
    if (!token) {
      throw new Error("Failed to obtain a Google access token for GSC.");
    }

    const limit = Number(process.env.GSC_INDEX_LIMIT || "200");
    await runIndexTracking(options.projectSlug, {
      outputDir,
      limit,
      delayMs: 400,
      concurrency: 5,
    });

    await buildUrlLifecycle(options.projectSlug, { outputDir });
    buildIndexDashboard(options.projectSlug, { outputDir });
    buildSeoHealthScore(options.projectSlug, { outputDir });
    buildFullPageAudit(options.projectSlug, { outputDir });
    const contractRefreshed = syncDashboardSeoIntelligenceContract(options.projectSlug, outputDir);

    const after = readLiveGscRefreshMetrics(options.projectSlug, outputDir);
    const filesRefreshed = REFRESH_FILES.map((file) => `output/${options.projectSlug}/${file}`);

    return {
      success: true,
      projectSlug: options.projectSlug,
      gscPropertyUsed,
      runtimeMs: Date.now() - started,
      before,
      after,
      filesRefreshed,
      contractRefreshed,
    };
  };

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(`Live GSC refresh timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    return result;
  } catch (error) {
    return {
      success: false,
      projectSlug: options.projectSlug,
      gscPropertyUsed,
      runtimeMs: Date.now() - started,
      before,
      after: readLiveGscRefreshMetrics(options.projectSlug, outputDir),
      filesRefreshed: [],
      contractRefreshed: false,
      error: (error as Error).message || "Live GSC refresh failed",
    };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
