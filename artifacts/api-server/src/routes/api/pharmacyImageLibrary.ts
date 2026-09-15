/**
 * PharmaConnect Image Operating System V1 — JSON API routes.
 * Adapted from Local SEO Engine /api/images/* workflow patterns.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import {
  assignSlotImage,
  buildAiImagePrompt,
  buildImageOperatingSystemDashboard,
  clearSlotAssignment,
  createAiImageRequest,
  isImageLibraryPackKey,
  listLibraryImagesFiltered,
  loadImageAssignments,
  normalizeImageLibraryServiceId,
  registerUpload,
  resolveImageLibraryServiceId,
  updateAiRequestStatus,
  uploadDir,
  type ImageCategory,
  type ImageMatrixSlot,
} from "../../../../../src/pharmacy/pharmacyImageOperatingSystem.ts";
import { normalizeServiceId } from "../../../../../src/pharmacy/pharmacyServiceLibraryService.ts";
import {
  autoFillServiceImagesFromMasterStock,
  loadMasterStockImages,
  masterStockUploadDir,
  registerMasterStockUpload,
} from "../../../../../src/pharmacy/pharmacyMasterStockImageService.ts";
import {
  addCustomerUploadToLibrary,
  activateTenantImage,
  approveTenantImage,
  buildTenantImageLibraryView,
  deactivateTenantImage,
  includeApprovedStockImages,
  MAX_ACTIVE_TENANT_IMAGES,
} from "../../../../../src/pharmacy/pharmacyTenantImageLibraryContract.ts";

const router = Router();
const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";

function safeSlug(v: string): string {
  return (
    String(v || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".svg"];

const uploadStorage = multer.diskStorage({
  destination(req, _file, cb) {
    const slug = safeSlug(String(req.params.slug || req.body?.slug || "pharmaconnect"));
    cb(null, uploadDir(slug));
  },
  filename(req, file, cb) {
    const serviceId = String(req.body?.serviceId || "general").replace(/[^a-z0-9-]/gi, "-");
    const slot = String(req.body?.slot || "hero").replace(/[^a-z0-9-]/gi, "-");
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXT.includes(ext) ? ext : ".webp";
    cb(null, `${serviceId}-${slot}-${Date.now()}${safeExt}`);
  },
});

const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.includes(ext) || /^image\//.test(file.mimetype) || file.originalname.endsWith(".svg")) {
      cb(null, true);
    } else {
      cb(new Error("Allowed formats: jpg, png, webp, svg"));
    }
  },
});

function resolveServiceId(raw: unknown, res: import("express").Response): string | null {
  if (!raw) return null;
  const str = String(raw).trim();
  const normalized = normalizeServiceId(str);
  if (isImageLibraryPackKey(str)) {
    res.status(400).json({
      ok: false,
      error: `Invalid service id: ${str} is an image category pack — use a service id such as travel-vaccinations`,
    });
    return null;
  }
  const id = normalizeImageLibraryServiceId(str);
  if (!id) {
    const hint = normalized && ["hero", "support", "trust", "conversion"].includes(normalized)
      ? " (slot name — use service id)"
      : "";
    res.status(400).json({ ok: false, error: `Invalid service id: ${str}${hint}` });
    return null;
  }
  return id;
}

function resolveLibraryQueryService(req: import("express").Request): string | undefined {
  const raw = req.query.service ?? req.query.serviceId;
  return raw ? resolveImageLibraryServiceId(String(raw)) : undefined;
}

router.get("/pharmacy/image-library/:slug/data", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const serviceId = req.query.service ? resolveImageLibraryServiceId(String(req.query.service)) : undefined;
    const campaignId = req.query.campaignId ? String(req.query.campaignId) : undefined;
    res.json({
      ok: true,
      dashboard: buildImageOperatingSystemDashboard(slug, { serviceId, campaignId }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/pharmacy/image-library/:slug/library", (req, res) => {
  try {
    const serviceId = resolveLibraryQueryService(req);
    const slot = req.query.slot ? String(req.query.slot) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const images = listLibraryImagesFiltered({ serviceId, slot, category });
    res.json({ ok: true, images, count: images.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/pharmacy/image-library/:slug/assignments", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    res.json({ ok: true, assignments: loadImageAssignments(slug) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/image-library/:slug/preview-prompt", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const { serviceId: rawServiceId, slot, category } = req.body || {};
    if (!rawServiceId || !slot) {
      return res.status(400).json({ ok: false, error: "serviceId and slot are required" });
    }
    const serviceId = resolveServiceId(rawServiceId, res);
    if (!serviceId) return;
    const prompt = buildAiImagePrompt(
      slug,
      serviceId,
      slot as ImageMatrixSlot,
      (category || slot) as ImageCategory,
    );
    res.json({ ok: true, prompt });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/image-library/:slug/assign", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const { serviceId: rawServiceId, slot, source, libraryRef, uploadId, aiRequestId, campaignId, altText, title } =
      req.body || {};
    if (!rawServiceId || !slot || !source) {
      return res.status(400).json({ ok: false, error: "serviceId, slot, and source are required" });
    }
    const serviceId = resolveServiceId(rawServiceId, res);
    if (!serviceId) return;
    const assignment = assignSlotImage(slug, serviceId, slot as ImageMatrixSlot, {
      source,
      libraryRef,
      uploadId,
      aiRequestId,
      campaignId,
      altText,
      title,
    });
    res.json({
      ok: true,
      message: "Image assigned successfully.",
      assignment,
      dashboard: buildImageOperatingSystemDashboard(slug, {
        serviceId,
        campaignId: campaignId ? String(campaignId) : undefined,
      }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/image-library/:slug/upload", (req, res) => {
  uploadMiddleware.single("file")(req, res, (err: unknown) => {
    if (err) return res.status(400).json({ ok: false, error: String(err) });
    try {
      const slug = safeSlug(req.params.slug);
      if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });

      const relPath = path.relative(ROOT, req.file.path).replace(/\\/g, "/");
      const category = String(req.body?.category || req.body?.slot || "hero") as ImageCategory;
      const entry = registerUpload(slug, {
        filename: req.file.filename,
        path: relPath.startsWith("assets/") ? relPath : `assets/pharmacy-uploads/${slug}/${req.file.filename}`,
        category,
        mimeType: req.file.mimetype,
        label: req.body?.label ? String(req.body.label) : undefined,
      });

      let assignment = null;
      const rawServiceId = req.body?.serviceId ? String(req.body.serviceId) : undefined;
      const serviceId = rawServiceId ? normalizeImageLibraryServiceId(rawServiceId) : null;
      if (rawServiceId && !serviceId) {
        return res.status(400).json({ ok: false, error: `Invalid serviceId: ${rawServiceId}` });
      }
      if (serviceId && req.body?.slot) {
        assignment = assignSlotImage(slug, serviceId, req.body.slot as ImageMatrixSlot, {
          source: "upload",
          uploadId: entry.id,
          campaignId: req.body?.campaignId ? String(req.body.campaignId) : undefined,
        });
      }

      const tenantLibrary = addCustomerUploadToLibrary(slug, {
        filename: req.file.filename,
        path: entry.path,
        mimeType: req.file.mimetype,
        originalFilename: req.file.originalname,
      });

      res.json({
        ok: true,
        message: assignment ? "Image assigned successfully." : "Upload saved.",
        upload: entry,
        assignment,
        tenantLibrary: tenantLibrary.library,
        libraryRecord: tenantLibrary.record,
        activeCount: tenantLibrary.library.images.filter((img) => img.active).length,
        maxActive: MAX_ACTIVE_TENANT_IMAGES,
        dashboard: buildImageOperatingSystemDashboard(slug, {
          serviceId: serviceId || undefined,
          campaignId: req.body?.campaignId ? String(req.body.campaignId) : undefined,
        }),
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });
});

router.post("/pharmacy/image-library/:slug/unassign", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const { serviceId: rawServiceId, slot, campaignId } = req.body || {};
    if (!rawServiceId || !slot) {
      return res.status(400).json({ ok: false, error: "serviceId and slot are required" });
    }
    const serviceId = resolveServiceId(rawServiceId, res);
    if (!serviceId) return;
    const removed = clearSlotAssignment(
      slug,
      serviceId,
      slot as ImageMatrixSlot,
      campaignId ? String(campaignId) : undefined,
    );
    res.json({
      ok: true,
      removed,
      dashboard: buildImageOperatingSystemDashboard(slug, {
        serviceId,
        campaignId: campaignId ? String(campaignId) : undefined,
      }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/image-library/:slug/ai-request", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const { serviceId: rawServiceId, slot, category, prompt, assignToSlot, campaignId } = req.body || {};
    if (!rawServiceId || !slot) {
      return res.status(400).json({ ok: false, error: "serviceId and slot are required" });
    }
    const serviceId = resolveServiceId(rawServiceId, res);
    if (!serviceId) return;
    const request = createAiImageRequest(
      slug,
      serviceId,
      slot as ImageMatrixSlot,
      (category || slot) as ImageCategory,
      prompt ? String(prompt) : undefined,
      {
        assignToSlot: assignToSlot !== false,
        campaignId: campaignId ? String(campaignId) : undefined,
      },
    );
    res.json({
      ok: true,
      message: "AI image request recorded. Images are not generated here.",
      request,
      dashboard: buildImageOperatingSystemDashboard(slug, {
        serviceId,
        campaignId: campaignId ? String(campaignId) : undefined,
      }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.patch("/pharmacy/image-library/:slug/ai-request/:requestId", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const { status, resultPath, error } = req.body || {};
    const updated = updateAiRequestStatus(
      slug,
      req.params.requestId,
      status,
      resultPath,
      error,
    );
    if (!updated) return res.status(404).json({ ok: false, error: "AI request not found" });
    res.json({ ok: true, request: updated, dashboard: buildImageOperatingSystemDashboard(slug) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const masterStockStorage = multer.diskStorage({
  destination(req, _file, cb) {
    const slug = safeSlug(String(req.params.slug || "pharmaconnect"));
    const dir = masterStockUploadDir(slug);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXT.includes(ext) ? ext : ".webp";
    cb(null, `master-${Date.now()}${safeExt}`);
  },
});

const masterStockUpload = multer({ storage: masterStockStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/pharmacy/image-library/:slug/master-stock", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    res.json({ ok: true, store: loadMasterStockImages(slug) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/image-library/:slug/master-stock/upload", (req, res) => {
  masterStockUpload.array("files", 20)(req, res, (err: unknown) => {
    if (err) return res.status(400).json({ ok: false, error: String(err) });
    try {
      const slug = safeSlug(req.params.slug);
      const types = String(req.body?.types || "support")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const subjects = String(req.body?.subjects || "general")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const files = (req.files as Express.Multer.File[]) || [];
      const created = files.map((file) =>
        registerMasterStockUpload(slug, {
          filename: file.filename,
          absolutePath: file.path,
          label: req.body?.label ? String(req.body.label) : file.originalname,
          types: types as never[],
          subjects: subjects as never[],
          mimeType: file.mimetype,
        }),
      );
      res.json({ ok: true, created, store: loadMasterStockImages(slug) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });
});

router.post("/pharmacy/image-library/:slug/auto-fill", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const serviceId = req.body?.serviceId ? resolveServiceId(String(req.body.serviceId), res) : undefined;
    if (req.body?.serviceId && !serviceId) return;
    const result = autoFillServiceImagesFromMasterStock(slug, {
      serviceId: serviceId || undefined,
      allServices: req.body?.allServices === true,
      overwrite: req.body?.overwrite === true,
    });
    res.json({
      ok: true,
      ...result,
      dashboard: buildImageOperatingSystemDashboard(slug, { serviceId: serviceId || undefined }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const tenantLibraryUpload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const slug = safeSlug(String(req.params.slug || "pharmaconnect"));
      cb(null, uploadDir(slug));
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ALLOWED_EXT.includes(ext) ? ext : ".webp";
      cb(null, `tenant-library-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.includes(ext) || /^image\//.test(file.mimetype) || file.originalname.endsWith(".svg")) {
      cb(null, true);
    } else {
      cb(new Error("Allowed formats: jpg, png, webp, svg"));
    }
  },
});

router.get("/pharmacy/image-library/:slug/tenant-library", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    res.json({ ok: true, ...buildTenantImageLibraryView(slug) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/image-library/:slug/tenant-library/upload", (req, res) => {
  tenantLibraryUpload.array("files", 21)(req, res, (err: unknown) => {
    if (err) return res.status(400).json({ ok: false, error: String(err) });
    try {
      const slug = safeSlug(req.params.slug);
      const files = (req.files as Express.Multer.File[] | undefined) || [];
      if (!files.length) return res.status(400).json({ ok: false, error: "No files uploaded" });
      const results = files.map((file) => {
        const relPath = path.relative(ROOT, file.path).replace(/\\/g, "/");
        const stored = relPath.startsWith("assets/") ? relPath : `assets/pharmacy-uploads/${slug}/${file.filename}`;
        registerUpload(slug, {
          filename: file.filename,
          path: stored,
          category: "support",
          mimeType: file.mimetype,
          label: file.originalname,
        });
        return addCustomerUploadToLibrary(slug, {
          filename: file.filename,
          path: stored,
          mimeType: file.mimetype,
          originalFilename: file.originalname,
        });
      });
      const view = buildTenantImageLibraryView(slug);
      res.json({
        ok: results.every((item) => item.ok || item.duplicate),
        results,
        ...view,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });
});

router.post("/pharmacy/image-library/:slug/tenant-library/:imageId/deactivate", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    deactivateTenantImage(slug, String(req.params.imageId || ""));
    res.json({ ok: true, ...buildTenantImageLibraryView(slug) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/image-library/:slug/tenant-library/:imageId/activate", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    activateTenantImage(slug, String(req.params.imageId || ""));
    res.json({ ok: true, ...buildTenantImageLibraryView(slug) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/image-library/:slug/tenant-library/:imageId/approve", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    approveTenantImage(slug, String(req.params.imageId || ""));
    res.json({ ok: true, ...buildTenantImageLibraryView(slug) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/image-library/:slug/tenant-library/include-stock", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    includeApprovedStockImages(slug, String(req.body?.serviceId || "pharmacy-first"));
    res.json({ ok: true, ...buildTenantImageLibraryView(slug) });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
