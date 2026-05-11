import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");

export const USAGE_LOG = path.join(WORKSPACE_ROOT, "output", "usage-log.jsonl");

export interface UsageEntry {
  ts: string;
  slug: string;
  keySource: "server" | "project";
  model: string;
  cost: number;
  slot: string;
}

// Cost per image in USD (Ideogram V_2 standard)
export const COST_PER_IMAGE: Record<string, number> = {
  V_2:       0.08,
  V_2_TURBO: 0.02,
};

export const DEFAULT_MONTHLY_LIMIT = parseInt(process.env.MAX_MONTHLY_SERVER_IMAGES ?? "50", 10);

// ─── Append one entry to the log ───────────────────────────────────────────
export function logUsage(entry: UsageEntry): void {
  try {
    const dir = path.dirname(USAGE_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(USAGE_LOG, JSON.stringify(entry) + "\n");
  } catch { /* non-fatal */ }
}

// ─── Read all log entries ───────────────────────────────────────────────────
export function readUsageLog(): UsageEntry[] {
  if (!fs.existsSync(USAGE_LOG)) return [];
  return fs
    .readFileSync(USAGE_LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) as UsageEntry; }
      catch { return null; }
    })
    .filter(Boolean) as UsageEntry[];
}

// ─── This-month filter ─────────────────────────────────────────────────────
function isThisMonth(ts: string): boolean {
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// ─── Count server-key generations for a slug this month ────────────────────
export function serverKeyUsageThisMonth(slug: string): number {
  return readUsageLog().filter(
    (e) => e.slug === slug && e.keySource === "server" && isThisMonth(e.ts)
  ).length;
}

// ─── Check limit — returns error string or null ────────────────────────────
export function checkServerKeyLimit(slug: string): string | null {
  const used = serverKeyUsageThisMonth(slug);
  if (used >= DEFAULT_MONTHLY_LIMIT) {
    return `Monthly server-key limit reached (${used}/${DEFAULT_MONTHLY_LIMIT} images). Add your own Ideogram key in Stage 1 to continue, or contact the admin to increase the limit.`;
  }
  return null;
}

// ─── Summary aggregation ───────────────────────────────────────────────────
export interface UsageSummary {
  monthlyLimit: number;
  serverKeyThisMonth: { total: number; cost: number };
  projectKeyThisMonth: { total: number; cost: number };
  perProject: Record<string, { thisMonth: { count: number; cost: number; keySource: string[] }; allTime: { count: number; cost: number } }>;
  allTimeTotal: { count: number; cost: number };
}

export function buildSummary(filterSlug?: string): UsageSummary {
  const all = readUsageLog();
  const thisMonth = all.filter((e) => isThisMonth(e.ts));
  const relevant = filterSlug ? thisMonth.filter((e) => e.slug === filterSlug) : thisMonth;

  const serverThisMonth = thisMonth.filter((e) => e.keySource === "server");
  const projectThisMonth = thisMonth.filter((e) => e.keySource === "project");

  const perProject: UsageSummary["perProject"] = {};

  for (const e of all) {
    if (!perProject[e.slug]) {
      perProject[e.slug] = { thisMonth: { count: 0, cost: 0, keySource: [] }, allTime: { count: 0, cost: 0 } };
    }
    perProject[e.slug].allTime.count++;
    perProject[e.slug].allTime.cost = +(perProject[e.slug].allTime.cost + e.cost).toFixed(4);
    if (isThisMonth(e.ts)) {
      perProject[e.slug].thisMonth.count++;
      perProject[e.slug].thisMonth.cost = +(perProject[e.slug].thisMonth.cost + e.cost).toFixed(4);
      if (!perProject[e.slug].thisMonth.keySource.includes(e.keySource)) {
        perProject[e.slug].thisMonth.keySource.push(e.keySource);
      }
    }
  }

  const sum = (arr: UsageEntry[]) => ({
    total: arr.length,
    cost: +arr.reduce((a, e) => a + e.cost, 0).toFixed(4),
  });

  const allTimeCost = +all.reduce((a, e) => a + e.cost, 0).toFixed(4);

  return {
    monthlyLimit: DEFAULT_MONTHLY_LIMIT,
    serverKeyThisMonth: sum(serverThisMonth),
    projectKeyThisMonth: sum(projectThisMonth),
    perProject,
    allTimeTotal: { count: all.length, cost: allTimeCost },
  };
}

// ─── Routes ────────────────────────────────────────────────────────────────
const router = Router();

router.get("/usage/summary", (req, res) => {
  const { slug } = req.query as { slug?: string };
  res.json(buildSummary(slug));
});

router.get("/usage/project/:slug", (req, res) => {
  const { slug } = req.params;
  const all = readUsageLog().filter((e) => e.slug === slug);
  const thisMonth = all.filter((e) => isThisMonth(e.ts));
  const serverThisMonth = thisMonth.filter((e) => e.keySource === "server");
  const usedThisMonth = serverThisMonth.length;
  const costThisMonth = +thisMonth.reduce((a, e) => a + e.cost, 0).toFixed(4);
  const allTimeCost = +all.reduce((a, e) => a + e.cost, 0).toFixed(4);

  res.json({
    slug,
    monthlyLimit: DEFAULT_MONTHLY_LIMIT,
    serverKeyUsedThisMonth: usedThisMonth,
    serverKeyRemainingThisMonth: Math.max(0, DEFAULT_MONTHLY_LIMIT - usedThisMonth),
    costThisMonth,
    allTimeCount: all.length,
    allTimeCost,
    recentEntries: all.slice(-10).reverse(),
  });
});

export default router;
