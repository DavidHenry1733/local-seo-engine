import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const router = Router();

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const CONFIG_DIR = path.join(ROOT, "config", "pharmacy");

function readJson(name: string) {
  const file = path.join(CONFIG_DIR, name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

router.get("/pharmacy/setup-schema", (_req, res) => {
  const data = readJson("setup-schema.json");
  if (!data) return res.status(404).json({ ok: false, error: "setup-schema.json not found" });
  res.json({ ok: true, schema: data });
});

router.get("/pharmacy/service-library", (_req, res) => {
  const data = readJson("service-library.json");
  if (!data) return res.status(404).json({ ok: false, error: "service-library.json not found" });
  res.json({ ok: true, library: data });
});

router.get("/pharmacy/setup-bundle", (_req, res) => {
  const schema = readJson("setup-schema.json");
  const library = readJson("service-library.json");
  res.json({ ok: true, schema, library });
});


router.get("/pharmacy/postcode-lookup", async (req, res) => {
  const raw = String(req.query.postcode || "").trim();

  if (!raw) {
    return res.status(400).json({ ok: false, error: "Postcode is required" });
  }

  const postcode = encodeURIComponent(raw);

  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${postcode}`);

    if (!response.ok) {
      return res.status(404).json({ ok: false, error: "Postcode not found" });
    }

    const json: any = await response.json();
    const r = json.result || {};

    res.json({
      ok: true,
      postcode: r.postcode || raw.toUpperCase(),
      townCity: r.admin_district || "",
      county: r.admin_county || r.admin_district || "",
      localAuthority: r.admin_district || "",
      nhsRegion: r.nhs_ha || "",
      icb: r.ccg || "",
      country: r.country || "",
      region: r.region || "",
      latitude: r.latitude || null,
      longitude: r.longitude || null
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err?.message || "Postcode lookup failed"
    });
  }
});

export default router;
