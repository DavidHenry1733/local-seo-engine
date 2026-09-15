import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const router = Router();

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const PREVIEW_ROOT = path.join(ROOT, "output/pharmacy-area-preview-v1");

router.get("/pharmacy-area-preview-v1", (_req, res) => {
  const file = path.join(PREVIEW_ROOT, "index.html");
  if (!fs.existsSync(file)) return res.status(404).send("Area preview index not found. Generate service area pages first.");
  res.sendFile(file);
});

router.get("/pharmacy-area-preview-v1/", (_req, res) => {
  const file = path.join(PREVIEW_ROOT, "index.html");
  if (!fs.existsSync(file)) return res.status(404).send("Area preview index not found. Generate service area pages first.");
  res.sendFile(file);
});

router.get("/pharmacy-area-preview-v1/:slug/:pageSlug", (req, res) => {
  const file = path.join(PREVIEW_ROOT, req.params.slug, req.params.pageSlug, "index.html");
  if (!fs.existsSync(file)) return res.status(404).send("Area preview page not found");
  res.sendFile(file);
});

router.get("/pharmacy-area-preview-v1/:slug/:pageSlug/", (req, res) => {
  const file = path.join(PREVIEW_ROOT, req.params.slug, req.params.pageSlug, "index.html");
  if (!fs.existsSync(file)) return res.status(404).send("Area preview page not found");
  res.sendFile(file);
});

export default router;
