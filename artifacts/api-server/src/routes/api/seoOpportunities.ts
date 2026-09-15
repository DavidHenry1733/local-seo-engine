import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? path.resolve(process.cwd(), "output");

const router = Router();

function opportunitiesPath(projectSlug: string): string {
  return path.join(OUTPUT_DIR, projectSlug, "seo-opportunities.json");
}

router.get("/seo-opportunities", (req, res) => {
  const { projectSlug } = req.query as Record<string, string>;
  if (!projectSlug) {
    res.status(400).json({ error: "projectSlug is required" });
    return;
  }
  if (!/^[a-z0-9_-]+$/i.test(projectSlug)) {
    res.status(400).json({ error: "Invalid projectSlug" });
    return;
  }

  const file = opportunitiesPath(projectSlug);
  if (!fs.existsSync(file)) {
    res.status(404).json({
      error: "seo-opportunities.json not found. Build the SEO Opportunity data layer first.",
      projectSlug,
    });
    return;
  }

  try {
    res.json({ report: JSON.parse(fs.readFileSync(file, "utf8")) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message || "Failed to read seo-opportunities.json" });
  }
});

export default router;
