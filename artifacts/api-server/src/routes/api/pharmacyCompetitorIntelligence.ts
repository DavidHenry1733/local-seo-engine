import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { runCompetitorIntelligencePipeline } from "../../../../../src/pharmacy/pharmacyCompetitorIntelligenceService.ts";

const router = Router();

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const INTEL_DIR = path.join(ROOT, "data", "pharmacy-competitor-intelligence");
const OPP_DIR = path.join(ROOT, "data", "pharmacy-opportunity-engine");

function safeSlug(v: string) {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function dashboardPath(slug: string) {
  const primary = path.join(INTEL_DIR, `${slug}-dashboard.json`);
  const fallback = path.join(OPP_DIR, `${slug}-dashboard.json`);
  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(fallback)) return fallback;
  return primary;
}

function getStatus(slug: string) {
  const dashFile = dashboardPath(slug);
  const discoveryFile = path.join(INTEL_DIR, `${slug}.json`);
  const gapFile = path.join(INTEL_DIR, `${slug}-gap-analysis.json`);
  const oppFile = path.join(OPP_DIR, `${slug}.json`);

  const hasDashboard = fs.existsSync(dashFile);
  const dashboard = hasDashboard ? readJson(dashFile) : null;

  return {
    ok: true,
    slug,
    hasData: hasDashboard,
    hasDiscovery: fs.existsSync(discoveryFile),
    hasGapAnalysis: fs.existsSync(gapFile),
    hasOpportunities: fs.existsSync(oppFile),
    competitorCount: dashboard?.competitorSummary?.count || dashboard?.competitors?.length || 0,
    serviceComparisons: dashboard?.serviceCoverage?.length || 0,
    opportunityCount: dashboard?.opportunities?.length || 0,
    highPriorityOpportunities: (dashboard?.opportunities || []).filter(
      (o: { priority: string }) => o.priority === "Critical" || o.priority === "High",
    ).length,
    generatedAt: dashboard?.generatedAt || null,
    source: dashboard?.competitors?.[0]?.source || null,
    paths: {
      dashboard: hasDashboard ? dashFile : null,
      discovery: fs.existsSync(discoveryFile) ? discoveryFile : null,
      gapAnalysis: fs.existsSync(gapFile) ? gapFile : null,
      opportunities: fs.existsSync(oppFile) ? oppFile : null,
    },
  };
}

router.get("/pharmacy-competitor-intelligence/:slug/status", (req, res) => {
  const slug = safeSlug(req.params.slug);
  res.json(getStatus(slug));
});

router.get("/pharmacy-competitor-intelligence/:slug/dashboard", (req, res) => {
  const slug = safeSlug(req.params.slug);
  const file = dashboardPath(slug);

  if (!fs.existsSync(file)) {
    return res.json({ ok: true, exists: false, slug, dashboard: null });
  }

  res.json({ ok: true, exists: true, slug, dashboard: readJson(file) });
});

router.post("/pharmacy-competitor-intelligence/:slug/build", async (req, res) => {
  const slug = safeSlug(req.params.slug);
  const profileFile = path.join(ROOT, "data", "pharmacy-profiles", `${slug}.json`);

  if (!fs.existsSync(profileFile)) {
    return res.status(404).json({ ok: false, error: "Saved pharmacy profile not found" });
  }

  try {
    const result = await runCompetitorIntelligencePipeline(slug);
    res.json({ ok: true, built: true, result, status: getStatus(slug) });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: String(err?.message || err || "Competitor intelligence build failed"),
    });
  }
});

export default router;
