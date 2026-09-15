import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const router = Router();

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine/output/pharmacy-preview-v2";

router.get("/pharmacy-preview-v2", (_req, res) => {
  const file = path.join(ROOT, "index.html");
  if (!fs.existsSync(file)) return res.status(404).send("Preview index not found");
  res.sendFile(file);
});

router.get("/pharmacy-preview-v2/", (_req, res) => {
  const file = path.join(ROOT, "index.html");
  if (!fs.existsSync(file)) return res.status(404).send("Preview index not found");
  res.sendFile(file);
});

router.get("/pharmacy-preview-v2/:slug/:serviceId", (req, res) => {
  const file = path.join(ROOT, req.params.slug, req.params.serviceId, "index.html");
  if (!fs.existsSync(file)) return res.status(404).send("Preview page not found");
  res.sendFile(file);
});

router.get("/pharmacy-preview-v2/:slug/:serviceId/", (req, res) => {
  const file = path.join(ROOT, req.params.slug, req.params.serviceId, "index.html");
  if (!fs.existsSync(file)) return res.status(404).send("Preview page not found");
  res.sendFile(file);
});

export default router;
