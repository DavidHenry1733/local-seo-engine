import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? path.resolve(process.cwd(), "output");

const router = Router();

function dashboardPath(projectSlug: string): string {
  return path.join(OUTPUT_DIR, projectSlug, "index-dashboard.json");
}

router.get("/index-dashboard", (req, res) => {
  const { projectSlug } = req.query as Record<string, string>;
  if (!projectSlug) {
    res.status(400).json({ error: "projectSlug is required" });
    return;
  }
  if (!/^[a-z0-9_-]+$/i.test(projectSlug)) {
    res.status(400).json({ error: "Invalid projectSlug" });
    return;
  }

  const file = dashboardPath(projectSlug);
  if (!fs.existsSync(file)) {
    res.status(404).json({
      error: "index-dashboard.json not found. Build the Index Dashboard data layer first.",
      projectSlug,
    });
    return;
  }

  try {
    res.json({ dashboard: JSON.parse(fs.readFileSync(file, "utf8")) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message || "Failed to read index-dashboard.json" });
  }
});

export default router;
