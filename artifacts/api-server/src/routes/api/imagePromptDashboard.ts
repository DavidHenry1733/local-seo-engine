/**
 * Image Prompt Dashboard API — Campaign Content Image Library backend.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { randomUUID } from "node:crypto";
import {
  exportPromptPack,
  exportSinglePrompt,
  getCoverageReport,
  getCurrentImages,
  getDashboardMeta,
  getFutureIndustryReadiness,
  getPrompts,
  getUploadOptions,
  getUploadQueue,
  handleApprovalAction,
  listIndustries,
  listPacks,
  listServices,
  listTemplateFamilies,
  saveUploadedImage,
} from "../../../../../src/image-intelligence/imagePromptDashboardService.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../../../..");
const UPLOAD_TMP = path.join(WORKSPACE_ROOT, "assets", "pharmacy-image-library", "_tmp");
const HARD_LIMIT = 20 * 1024 * 1024;

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOAD_TMP, { recursive: true });
    cb(null, UPLOAD_TMP);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".webp";
    cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: HARD_LIMIT },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();
    if (ext === ".webp" || mime === "image/webp") {
      cb(null, true);
      return;
    }
    cb(new Error("Please upload a .webp file"));
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

function q(req: Request, key: string): string | undefined {
  const val = req.query[key];
  return typeof val === "string" && val.trim() ? val.trim() : undefined;
}

function qPack(req: Request): string | undefined {
  return q(req, "packKey") ?? q(req, "pack");
}

function bodyStr(req: Request, key: string): string | undefined {
  const val = (req.body as Record<string, unknown>)?.[key];
  return typeof val === "string" && val.trim() ? val.trim() : undefined;
}

function uploadFields(req: Request): {
  industry: string;
  pack?: string;
  imageKey?: string;
  slot?: string;
  uploadedBy?: string;
  approvalStatus: string;
} {
  return {
    industry: bodyStr(req, "industry") ?? "pharmacy",
    pack: bodyStr(req, "pack") ?? bodyStr(req, "packKey") ?? bodyStr(req, "imagePack"),
    imageKey: bodyStr(req, "imageKey") ?? bodyStr(req, "selectedImageKey"),
    slot: bodyStr(req, "slot"),
    uploadedBy: bodyStr(req, "uploadedBy"),
    approvalStatus: bodyStr(req, "approvalStatus") ?? "uploaded",
  };
}

router.get("/image-prompt-dashboard/meta", (_req, res) => {
  try {
    res.json(getDashboardMeta());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompt-dashboard/industries", (_req, res) => {
  try {
    res.json({ industries: listIndustries() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompt-dashboard/template-families", (req, res) => {
  try {
    const industry = q(req, "industry") ?? "pharmacy";
    res.json({ industry, templateFamilies: listTemplateFamilies(industry) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompt-dashboard/services", (req, res) => {
  try {
    const industry = q(req, "industry") ?? "pharmacy";
    const templateFamily = q(req, "templateFamily");
    res.json({ industry, templateFamily, services: listServices(industry, templateFamily) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompt-dashboard/packs", (req, res) => {
  try {
    const industry = q(req, "industry") ?? "pharmacy";
    const templateFamily = q(req, "templateFamily");
    res.json({ industry, templateFamily, packs: listPacks(industry, templateFamily) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompt-dashboard/upload-options", (req, res) => {
  try {
    const industry = q(req, "industry") ?? "pharmacy";
    res.json(getUploadOptions(industry));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompt-dashboard/current-images", (req, res) => {
  try {
    const industry = q(req, "industry") ?? "pharmacy";
    res.json({ industry, images: getCurrentImages(industry) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompt-dashboard/prompts", (req, res) => {
  try {
    const filters = {
      industry: q(req, "industry") ?? "pharmacy",
      templateFamily: q(req, "templateFamily"),
      serviceKey: q(req, "serviceKey"),
      packKey: qPack(req),
    };
    res.json({ ...filters, prompts: getPrompts(filters) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompt-dashboard/upload-queue", (req, res) => {
  try {
    const industry = q(req, "industry") ?? "pharmacy";
    res.json({ industry, ...getUploadQueue(industry) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompt-dashboard/coverage", (req, res) => {
  try {
    const industry = q(req, "industry") ?? "pharmacy";
    res.json({ industry, ...getCoverageReport(industry) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompt-dashboard/future-industries", (_req, res) => {
  try {
    res.json({ industries: getFutureIndustryReadiness() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompt-dashboard/export", (req, res) => {
  try {
    const filters = {
      industry: q(req, "industry") ?? "pharmacy",
      serviceKey: q(req, "serviceKey"),
      templateFamily: q(req, "templateFamily"),
      packKey: qPack(req),
    };
    const payload = exportPromptPack(filters);
    const filename = `prompt-pack-${filters.serviceKey ?? filters.packKey ?? filters.industry}-${Date.now()}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompt-dashboard/export-prompt", (req, res) => {
  try {
    const payload = exportSinglePrompt({
      industry: q(req, "industry") ?? "pharmacy",
      packKey: qPack(req),
      serviceKey: q(req, "serviceKey"),
      templateFamily: q(req, "templateFamily"),
      imageKey: q(req, "imageKey"),
    });
    if (!payload) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const filename = `prompt-${q(req, "imageKey") ?? "single"}-${Date.now()}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/image-prompt-dashboard/upload", uploadMiddleware, (req, res) => {
  try {
    const fields = uploadFields(req);
    const { industry, pack, imageKey, slot, uploadedBy, approvalStatus } = fields;

    if (!pack || !imageKey || !slot) {
      res.status(400).json({ ok: false, error: "pack, imageKey, and slot are required" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ ok: false, error: "file is required" });
      return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const mime = (req.file.mimetype || "").toLowerCase();
    if (ext !== ".webp" && mime !== "image/webp") {
      res.status(422).json({ ok: false, error: "Please upload a .webp file" });
      return;
    }

    const record = saveUploadedImage({
      industry,
      pack,
      imageKey,
      slot,
      sourcePath: req.file.path,
      uploadedBy,
      approvalStatus: approvalStatus as "uploaded",
    });

    try {
      fs.unlinkSync(req.file.path);
    } catch {
      /* temp cleanup best-effort */
    }

    res.json({
      ok: true,
      success: true,
      uploadPath: record.uploadPath,
      record,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/image-prompt-dashboard/approval-action", (req, res) => {
  try {
    const { industry, pack, imageKey, slot, action, actor, reviewNotes } = (req.body ?? {}) as {
      industry?: string;
      pack?: string;
      imageKey?: string;
      slot?: string;
      action?: string;
      actor?: string;
      reviewNotes?: string;
    };

    if (!industry || !pack || !imageKey || !slot || !action) {
      res.status(400).json({ error: "industry, pack, imageKey, slot, and action are required" });
      return;
    }

    const allowed = new Set(["mark-uploaded", "approve", "reject", "reset"]);
    if (!allowed.has(action)) {
      res.status(400).json({ error: `Invalid action: ${action}` });
      return;
    }

    const record = handleApprovalAction({
      industry,
      pack,
      imageKey,
      slot,
      action: action as "mark-uploaded" | "approve" | "reject" | "reset",
      actor,
      reviewNotes,
    });

    res.json({ success: true, record });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
