import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? path.resolve(process.cwd(), "output");

const router = Router();

type RankRecord = {
  keyword?: string;
  url?: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  averagePosition?: number;
  previousAveragePosition?: number | null;
  positionChange?: number | null;
  direction?: string;
};

type RankTrackingReport = {
  summary?: Record<string, unknown>;
  topRankingOpportunities?: RankRecord[];
  records?: RankRecord[];
  [key: string]: unknown;
};

function rankTrackingPath(projectSlug: string): string {
  return path.join(OUTPUT_DIR, projectSlug, "rank-tracking.json");
}

function opportunityScore(record: RankRecord): number {
  const impressions = Number(record.impressions || 0);
  const clicks = Number(record.clicks || 0);
  const position = Number(record.averagePosition || 0);
  if (position < 8 || position > 30 || impressions <= 0) return 0;
  const clickGap = Math.max(0, impressions - clicks);
  const positionWeight = Math.max(1, 31 - position);
  return Number((clickGap * positionWeight).toFixed(2));
}

router.get("/rank-tracking", (req, res) => {
  const { projectSlug } = req.query as Record<string, string>;
  if (!projectSlug) {
    res.status(400).json({ error: "projectSlug is required" });
    return;
  }
  if (!/^[a-z0-9_-]+$/i.test(projectSlug)) {
    res.status(400).json({ error: "Invalid projectSlug" });
    return;
  }

  const file = rankTrackingPath(projectSlug);
  if (!fs.existsSync(file)) {
    res.status(404).json({
      error: "rank-tracking.json not found. Build the GSC Rank Tracking data layer first.",
      projectSlug,
    });
    return;
  }

  try {
    const report = JSON.parse(fs.readFileSync(file, "utf8")) as RankTrackingReport;
    const topRankingOpportunities = (report.topRankingOpportunities || []).map((record) => ({
      ...record,
      opportunityScore: opportunityScore(record),
    }));
    const movementRecords = (report.records || [])
      .filter((record) => record.direction && record.direction !== "same")
      .slice(0, 50);

    res.json({ report: { ...report, topRankingOpportunities, movementRecords } });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message || "Failed to read rank-tracking.json" });
  }
});

export default router;
