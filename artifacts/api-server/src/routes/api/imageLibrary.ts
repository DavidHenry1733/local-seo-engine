/**
 * imageLibrary.ts — API routes for the controlled Image Library system.
 *
 * GET  /api/image-library/manifest           — full manifest (all images)
 * GET  /api/image-library/serve/:svc/:slot/:file — serve an image file
 * POST /api/image-library/upload             — upload + add to manifest
 * PATCH /api/image-library/:id/approve       — toggle approved flag
 * DELETE /api/image-library/:id              — remove entry (+ optionally file)
 * GET  /api/image-library/usage/:slug        — which pages use each image
 */

import { Router, Request, Response, NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { randomUUID } from "node:crypto";
import {
  loadManifest,
  saveManifest,
  imageFilePath,
  buildUsageMap,
  MANIFEST_PATH,
  KNOWN_SERVICES,
  KNOWN_SLOTS,
} from "../../../../../src/generator/imageLibrary.js";
import type { LibraryImage } from "../../../../../src/generator/imageLibrary.js";

const __filename     = fileURLToPath(import.meta.url);
const __dirname      = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const IMAGE_LIB_DIR  = path.join(WORKSPACE_ROOT, "assets", "image-library");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");

const ALLOWED_MIMES  = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const HARD_LIMIT     = 20 * 1024 * 1024; // 20 MB

const router = Router();

// ── Multer: save uploads to a temp area, then move to library ─────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const tmp = path.join(IMAGE_LIB_DIR, "_tmp");
    fs.mkdirSync(tmp, { recursive: true });
    cb(null, tmp);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: HARD_LIMIT },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/svg+xml" || file.mimetype === "image/gif") {
      cb(new Error("Unsupported format. Upload JPG, PNG, or WebP."));
    } else {
      cb(null, true);
    }
  },
});

function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Image exceeds 20 MB limit." });
      return;
    }
    if (err instanceof Error) {
      res.status(422).json({ error: err.message });
      return;
    }
    next();
  });
}

/** Detect real MIME from magic bytes. */
function detectMime(filePath: string): string {
  try {
    const buf = Buffer.alloc(12);
    const fd  = fs.openSync(filePath, "r");
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    if (buf[0] === 0xFF && buf[1] === 0xD8)                                    return "image/jpeg";
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "image/png";
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  } catch { /* fallback */ }
  return "image/jpeg";
}

function mimeToExt(mime: string): string {
  if (mime === "image/webp") return ".webp";
  if (mime === "image/png")  return ".png";
  return ".jpg";
}

// ── GET /api/image-library/manifest ──────────────────────────────────────────

router.get("/image-library/manifest", (_req, res) => {
  const manifest = loadManifest();
  res.json({ images: manifest.images ?? [] });
});

// ── GET /api/image-library/serve/:service/:slot/:filename ─────────────────────

router.get("/image-library/serve/:service/:slot/:filename", (req, res) => {
  const { service, slot, filename } = req.params;
  const filePath = path.join(IMAGE_LIB_DIR, service, slot, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const mime = detectMime(filePath);
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.sendFile(filePath);
});

// ── POST /api/image-library/upload ───────────────────────────────────────────

router.post("/image-library/upload", uploadMiddleware, async (req, res) => {
  const {
    service     = "",
    slot        = "hero",
    description = "",
    altTemplate = "",
    tags        = "",
    approved    = "true",
  } = req.body as Record<string, string>;

  // Validate service (slot defaults to "hero" — no longer required from client)
  const normService = service.toLowerCase().replace(/_/g, "-");
  if (!KNOWN_SERVICES.includes(normService)) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(400).json({ error: `Invalid service. Allowed: ${KNOWN_SERVICES.join(", ")}` });
    return;
  }
  const normSlot = (KNOWN_SLOTS as readonly string[]).includes(slot) ? slot : "hero";
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const tmpPath = req.file.path;
  const mime    = detectMime(tmpPath);
  if (!ALLOWED_MIMES.includes(mime)) {
    fs.unlinkSync(tmpPath);
    res.status(422).json({ error: "Unsupported image format. Upload JPG, PNG, or WebP." });
    return;
  }

  // Enforce 9-images-per-service cap (across all slots)
  const existingManifest = loadManifest();
  const existingForService = (existingManifest.images ?? []).filter((i) => i.service === normService);
  if (existingForService.length >= 9) {
    fs.unlinkSync(tmpPath);
    res.status(400).json({
      error: `"${normService}" already has ${existingForService.length} image(s) in the library (maximum is 9 per service). Delete an existing image first.`,
    });
    return;
  }

  const ext      = mimeToExt(mime);
  const imageId  = `${normService}-${normSlot}-${randomUUID().slice(0, 8)}`;
  const filename = `${imageId}${ext}`;
  const destDir  = path.join(IMAGE_LIB_DIR, normService, normSlot);
  const destPath = path.join(destDir, filename);

  fs.mkdirSync(destDir, { recursive: true });
  fs.renameSync(tmpPath, destPath);

  // Default alt template if not supplied
  const SERVICE_DISPLAY: Record<string, string> = {
    "web-hosting": "Web Hosting", "web-design": "Web Design", "local-seo": "Local SEO",
    "google-business-profile": "Google Business Profile", "email-marketing": "Email Marketing",
  };
  const SLOT_DEFAULTS: Record<string, string> = {
    hero:       "{{Service}} {{Location}} — professional {{service}} services",
    support:    "{{Service}} {{Location}} — expert support and reliable results",
    trust:      "{{Service}} {{Location}} — trusted and experienced professionals",
    conversion: "{{Service}} {{Location}} — grow your local enquiries and revenue",
  };
  const finalAltTemplate = altTemplate.trim() || SLOT_DEFAULTS[normSlot] || "{{Service}} {{Location}} — professional service";

  const entry: LibraryImage = {
    id:          imageId,
    service:     normService,
    slot:        normSlot,
    filename,
    description: description.trim(),
    altTemplate: finalAltTemplate,
    tags:        tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    approved:    approved !== "false",
    addedAt:     new Date().toISOString(),
  };

  const manifest = loadManifest();
  manifest.images = manifest.images ?? [];
  manifest.images.push(entry);
  saveManifest(manifest);

  // Optional Sharp thumbnail for the UI
  try {
    const sharp = (await import("sharp")).default;
    const thumbPath = path.join(destDir, `${imageId}-thumb.jpg`);
    await sharp(destPath).resize(400, 280, { fit: "cover" }).jpeg({ quality: 75 }).toFile(thumbPath);
    (entry as LibraryImage & { thumbnailUrl?: string }).thumbnailUrl =
      `/api/image-library/serve/${normService}/${normSlot}/${imageId}-thumb.jpg`;
  } catch { /* sharp not available — no thumb */ }

  res.json({
    ok:    true,
    image: {
      ...entry,
      serveUrl: `/api/image-library/serve/${normService}/${normSlot}/${filename}`,
    },
  });
});

// ── PATCH /api/image-library/:id/approve ─────────────────────────────────────

router.patch("/image-library/:id/approve", (req, res) => {
  const { id }      = req.params;
  const { approved } = req.body as { approved?: boolean };

  const manifest = loadManifest();
  const img = manifest.images?.find((i) => i.id === id);
  if (!img) {
    res.status(404).json({ error: `Image "${id}" not found` });
    return;
  }

  img.approved = approved !== false;
  saveManifest(manifest);
  res.json({ ok: true, id, approved: img.approved });
});

// ── DELETE /api/image-library/:id ─────────────────────────────────────────────

router.delete("/image-library/:id", (req, res) => {
  const { id }         = req.params;
  const { deleteFile } = req.query as { deleteFile?: string };

  const manifest = loadManifest();
  const idx = manifest.images?.findIndex((i) => i.id === id) ?? -1;
  if (idx === -1) {
    res.status(404).json({ error: `Image "${id}" not found` });
    return;
  }

  const [removed] = manifest.images!.splice(idx, 1);
  saveManifest(manifest);

  if (deleteFile !== "false") {
    try {
      const fp = imageFilePath(removed);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      // Also remove thumbnail if it exists
      const thumbPath = fp.replace(/\.[^.]+$/, "-thumb.jpg");
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    } catch { /* non-fatal */ }
  }

  res.json({ ok: true, id });
});

// ── GET /api/image-library/usage/:slug ────────────────────────────────────────

router.get("/image-library/usage/:slug", (req, res) => {
  const { slug } = req.params;
  const outputDir = path.join(OUTPUT_DIR, slug);
  const usageMap  = buildUsageMap(outputDir);
  res.json({ usage: usageMap });
});

// ── GET /api/image-library/push-status ───────────────────────────────────────
// Returns which library images exist locally (useful for pre-deploy checks)

router.get("/image-library/status", (_req, res) => {
  const manifest = loadManifest();
  const images   = manifest.images ?? [];
  const status   = images.map((img) => ({
    id:       img.id,
    service:  img.service,
    slot:     img.slot,
    filename: img.filename,
    approved: img.approved,
    exists:   fs.existsSync(imageFilePath(img)),
  }));
  res.json({ images: status, total: status.length, approved: status.filter((s) => s.approved).length });
});

// ── POST /api/image-library/push-ftp/:slug ───────────────────────────────────
// Upload all approved library images to the live FTP server so they are
// served from {domain}/assets/image-library/{service}/{slot}/{filename}.

router.post("/image-library/push-ftp/:slug", async (req, res) => {
  const { slug } = req.params;

  const projectsDir = path.join(OUTPUT_DIR, "..", "config", "projects");
  let project: { deploy?: { enabled?: boolean; host?: string; port?: number; username?: string; password?: string; remoteRoot?: string } } | null = null;
  try {
    const pf = path.join(projectsDir, `${slug}.json`);
    project  = JSON.parse(fs.readFileSync(pf, "utf8"));
  } catch {
    res.status(404).json({ error: `Project "${slug}" not found` });
    return;
  }

  const deploy = project?.deploy;
  if (!deploy?.enabled) {
    res.status(400).json({ error: "FTP deploy is not enabled for this project" });
    return;
  }

  const ftpUser = deploy.username || process.env.DEPLOY_USERNAME;
  const ftpPass = deploy.password || process.env.DEPLOY_PASSWORD;
  if (!ftpUser || !ftpPass) {
    res.status(400).json({ error: "FTP credentials (DEPLOY_USERNAME / DEPLOY_PASSWORD) are not configured" });
    return;
  }

  const manifest   = loadManifest();
  const approved   = (manifest.images ?? []).filter((img) => img.approved);
  const remoteRoot = (deploy.remoteRoot ?? "").replace(/\/+$/, "");
  const uploaded: string[] = [];
  const failed:   string[] = [];

  let client: import("basic-ftp").Client | null = null;
  try {
    const ftp  = await import("basic-ftp");
    client     = new ftp.Client(60_000);
    await client.access({
      host:          deploy.host ?? "ftp.inboxingproweb.com",
      port:          deploy.port ?? 21,
      user:          ftpUser,
      password:      ftpPass,
      secure:        true,
      secureOptions: { rejectUnauthorized: false },
    });

    for (const img of approved) {
      const localPath  = imageFilePath(img);
      if (!fs.existsSync(localPath)) { failed.push(img.id + " (file missing)"); continue; }

      const remoteDir = [remoteRoot, "assets", "image-library", img.service, img.slot]
        .join("/").replace(/\/+/g, "/");

      try {
        await client.ensureDir(remoteDir);
        // ensureDir changes CWD to remoteDir — upload using filename only
        await client.uploadFrom(localPath, img.filename);
        uploaded.push(`${img.service}/${img.slot}/${img.filename}`);
      } catch (e) {
        failed.push(`${img.service}/${img.slot}/${img.filename}: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    res.status(500).json({ error: `FTP connection failed: ${(e as Error).message}` });
    return;
  } finally {
    try { client?.close(); } catch { /* */ }
  }

  res.json({
    ok:       failed.length === 0,
    uploaded: uploaded.length,
    failed:   failed.length,
    details:  { uploaded, failed },
    message:  `${uploaded.length} image(s) uploaded to FTP${failed.length ? `; ${failed.length} failed` : ""}`,
  });
});

// ── PATCH /api/image-library/config/:slug ────────────────────────────────────
// Merge imageLibrary config fields into the project JSON file.

router.patch("/image-library/config/:slug", (req, res) => {
  const { slug }    = req.params;
  const projectsDir = path.join(WORKSPACE_ROOT, "config", "projects");
  const filePath    = path.join(projectsDir, `${slug}.json`);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: `Project not found: ${slug}` });
    return;
  }

  let project: Record<string, unknown>;
  try {
    project = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    res.status(500).json({ error: "Failed to parse project config" });
    return;
  }

  const { enabled, mode, allowFallback } = req.body as {
    enabled?: boolean;
    mode?: string;
    allowFallback?: boolean;
  };

  project.imageLibrary = {
    ...((project.imageLibrary as object) ?? {}),
    ...(enabled      !== undefined ? { enabled }      : {}),
    ...(mode         !== undefined ? { mode }          : {}),
    ...(allowFallback !== undefined ? { allowFallback } : {}),
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(project, null, 2) + "\n", "utf8");
    res.json({ ok: true, imageLibrary: project.imageLibrary });
  } catch {
    res.status(500).json({ error: "Failed to write project config" });
  }
});

export default router;
