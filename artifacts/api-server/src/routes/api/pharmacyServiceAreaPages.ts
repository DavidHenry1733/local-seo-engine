import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const router = Router();

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const DATA_DIR = path.join(ROOT, "data/pharmacy-generated-service-area-pages");

function safeSlug(v: string) {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function readJson(file: string, fallback: any = null) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function getStatus(slug: string) {
  const blueprint = readJson(path.join(ROOT, "data/pharmacy-content-blueprints", `${slug}.json`));
  const index = readJson(path.join(DATA_DIR, slug, "_index.json"));
  const previewIndex = path.join(ROOT, "output/pharmacy-area-preview-v1/index.html");

  let previewPageCount = 0;
  const previewDir = path.join(ROOT, "output/pharmacy-area-preview-v1", slug);
  if (fs.existsSync(previewDir)) {
    previewPageCount = fs
      .readdirSync(previewDir)
      .filter((f) => fs.existsSync(path.join(previewDir, f, "index.html"))).length;
  }

  return {
    ok: true,
    slug,
    expectedPageCount: blueprint?.serviceAreaPages?.length || 0,
    generatedPageCount: index?.pageCount || 0,
    previewPageCount,
    hasIndex: !!index,
    hasPreviewIndex: fs.existsSync(previewIndex),
    lastGeneratedAt: index?.generatedAt || null,
    generator: index?.generator || null,
    pages: index?.pages || [],
  };
}

router.get("/pharmacy-service-area-pages/:slug/status", (req, res) => {
  const slug = safeSlug(req.params.slug);
  res.json(getStatus(slug));
});

router.get("/pharmacy-service-area-pages/:slug", (req, res) => {
  const slug = safeSlug(req.params.slug);
  const index = readJson(path.join(DATA_DIR, slug, "_index.json"));

  if (!index) {
    return res.json({ ok: true, exists: false, slug, index: null, pages: [] });
  }

  const pages = (index.pages || []).map((entry: any) =>
    readJson(path.join(DATA_DIR, slug, `${entry.pageSlug}.json`)),
  ).filter(Boolean);

  res.json({ ok: true, exists: true, slug, index, pages });
});

router.post("/pharmacy-service-area-pages/:slug/generate", (req, res) => {
  const slug = safeSlug(req.params.slug);
  // CPR-PLATFORM-RECOVERY-02 — legacy service-area generator quarantined from production.
  return res.status(410).json({
    ok: false,
    quarantined: true,
    code: "LEGACY_CONTENT_ENGINE_QUARANTINED",
    slug,
    error:
      "Legacy pharmacy service-area page generation is quarantined. " +
      "Production locality pages use Content Engine V1 (generateLocalLocationHierarchyPages).",
    status: getStatus(slug),
  });
});

export default router;
