import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SetupSession } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR = path.join(WORKSPACE_ROOT, "output");

const router = Router();

function sessionPath(slug: string, campaignId?: string): string {
  if (campaignId) {
    const dir = path.join(OUTPUT_DIR, slug, "sessions");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${campaignId}.json`);
  }
  return path.join(OUTPUT_DIR, slug, "session.json");
}

router.get("/session/:slug", (req, res) => {
  const { slug } = req.params;
  const campaignId = req.query.campaign as string | undefined;
  const filePath = sessionPath(slug, campaignId);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: `No session found for slug: ${slug}` });
    return;
  }

  try {
    const session = JSON.parse(fs.readFileSync(filePath, "utf8")) as SetupSession;
    res.json({ session });
  } catch {
    res.status(500).json({ error: "Failed to parse session file" });
  }
});

router.put("/session/:slug", (req, res) => {
  const { slug } = req.params;
  const campaignId = req.query.campaign as string | undefined;
  const body = req.body as Partial<SetupSession>;

  const dir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = sessionPath(slug, campaignId);
  let existing: Partial<SetupSession> = {};

  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, "utf8")) as SetupSession;
    } catch {
      existing = {};
    }
  }

  const updated: SetupSession = {
    ...existing,
    ...body,
    clientSlug: slug,
    updatedAt: new Date().toISOString(),
  } as SetupSession;

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
  res.json({ session: updated });
});

router.delete("/session/:slug", (req, res) => {
  const { slug } = req.params;
  const campaignId = req.query.campaign as string | undefined;
  const filePath = sessionPath(slug, campaignId);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  fs.unlinkSync(filePath);

  // Also remove the corresponding campaign config entry so it doesn't show
  // stale data on the dashboard after the session file is deleted.
  if (campaignId) {
    const campaignsPath = path.join(WORKSPACE_ROOT, "config", "campaigns", `${slug}.json`);
    if (fs.existsSync(campaignsPath)) {
      try {
        const campaigns = JSON.parse(fs.readFileSync(campaignsPath, "utf8")) as Array<Record<string, unknown>>;
        const updated = campaigns.filter((c) => c.id !== campaignId);
        if (updated.length !== campaigns.length) {
          fs.writeFileSync(campaignsPath, JSON.stringify(updated, null, 2), "utf8");
        }
      } catch { /* non-fatal */ }
    }
  }

  res.json({ deleted: true, slug });
});

export default router;
