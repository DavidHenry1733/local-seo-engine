/**
 * Standalone server-rendered pharmacy image upload page — no dashboard JS dependency.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { randomUUID } from "node:crypto";
import {
  friendlyImageKeyLabel,
  getUploadOptions,
  saveUploadedImage,
} from "../../../../src/image-intelligence/imagePromptDashboardService.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../../../..");
const UPLOAD_TMP = path.join(WORKSPACE_ROOT, "assets", "pharmacy-image-library", "_tmp");
const HARD_LIMIT = 20 * 1024 * 1024;

const DEFAULT_PACK = "clinical-nhs-services";
const DEFAULT_IMAGE_KEY = "pharmacy-first-consultation";
const DEFAULT_SLOT = "hero";
const PREVIEW_URL = "/pharmacy-preview/pharmacy-first-rotherham/";

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOAD_TMP, { recursive: true });
    cb(null, UPLOAD_TMP);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}.webp`);
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
      res.status(413).send(renderErrorPage("Image exceeds 20 MB limit.", req));
      return;
    }
    if (err instanceof Error) {
      res.status(422).send(renderErrorPage(err.message, req));
      return;
    }
    next();
  });
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function q(req: Request, key: string): string | undefined {
  const val = req.query[key] ?? (req.body as Record<string, unknown>)?.[key];
  return typeof val === "string" && val.trim() ? val.trim() : undefined;
}

function pageContext(req: Request) {
  return {
    slug: q(req, "slug") ?? "",
    token: q(req, "_t") ?? process.env.SESSION_SECRET ?? "",
  };
}

function buildPageUrl(ctx: { slug: string; token: string }, extra?: Record<string, string>): string {
  const parts: string[] = [];
  if (ctx.slug) parts.push(`slug=${encodeURIComponent(ctx.slug)}`);
  if (ctx.token) parts.push(`_t=${encodeURIComponent(ctx.token)}`);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return `/api/image-upload${parts.length ? `?${parts.join("&")}` : ""}`;
}

function renderLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<style>
:root{--brand:#005EB8;--border:#e2e8f0;--muted:#64748b;--bg:#f8fafc;--card:#fff;--text:#0f172a}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);line-height:1.5}
.wrap{max-width:720px;margin:0 auto;padding:24px 20px 48px}
h1{font-size:1.35rem;margin-bottom:6px}
.sub{color:var(--muted);font-size:.88rem;margin-bottom:18px}
.panel{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:18px;margin-bottom:16px}
label{display:block;font-size:.82rem;color:var(--muted);margin-bottom:12px}
select,input[type=file]{display:block;width:100%;margin-top:4px;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:.88rem}
.btn{display:inline-block;padding:10px 18px;border-radius:6px;border:none;background:var(--brand);color:#fff;font-weight:700;font-size:.88rem;cursor:pointer;text-decoration:none}
.btn:hover{background:#004a94}
.btn-secondary{background:#fff;color:var(--text);border:1px solid #cbd5e1}
.links{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.success{background:#ecfdf5;border:1px solid #86efac;color:#065f46;padding:16px;border-radius:8px;margin-bottom:16px}
.error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:16px;border-radius:8px;margin-bottom:16px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.82rem;background:#f1f5f9;padding:2px 6px;border-radius:4px}
.path{display:block;margin:10px 0;padding:10px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:.82rem;word-break:break-all}
.badge{display:inline-block;font-size:.72rem;padding:2px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;margin-left:8px}
.hint{font-size:.75rem;color:var(--muted);margin-top:4px}
</style>
</head>
<body>
<div class="wrap">
${body}
</div>
</body>
</html>`;
}

function renderFormPage(req: Request, opts?: { error?: string }): string {
  const ctx = pageContext(req);
  const uploadOptions = getUploadOptions("pharmacy");
  const selectedPack = q(req, "pack") ?? DEFAULT_PACK;
  const selectedImageKey = q(req, "imageKey") ?? DEFAULT_IMAGE_KEY;
  const selectedSlot = q(req, "slot") ?? DEFAULT_SLOT;

  const packOptions = uploadOptions.packs
    .map(
      (p) =>
        `<option value="${esc(p.packKey)}"${p.packKey === selectedPack ? " selected" : ""}>${esc(p.packName)}</option>`,
    )
    .join("\n");

  const imageOptions = uploadOptions.packs
    .flatMap((pack) =>
      pack.images.map((img) => {
        const selected = pack.packKey === selectedPack && img.imageKey === selectedImageKey;
        return `<option value="${esc(img.imageKey)}" data-pack="${esc(pack.packKey)}"${selected ? " selected" : ""}>${esc(pack.packName)} — ${esc(img.imageLabel)}</option>`;
      }),
    )
    .join("\n");

  const slotOptions = uploadOptions.standardSlots
    .map((s) => `<option value="${esc(s.slot)}"${s.slot === selectedSlot ? " selected" : ""}>${esc(s.label)}</option>`)
    .join("\n");

  const targetPath =
    uploadOptions.uploadTargetPaths[`${selectedPack}:${selectedImageKey}`] ??
    `assets/pharmacy-image-library/${selectedPack}/${selectedImageKey}.webp`;

  const dashboardUrl = "/api/admin/master";

  const errorBlock = opts?.error
    ? `<div class="error"><strong>Upload failed</strong><br>${esc(opts.error)}</div>`
    : "";

  const body = `
  <div class="links" style="margin-bottom:12px">
    <a class="btn btn-secondary" href="${esc(dashboardUrl)}">← Dashboard</a>
    <a class="btn btn-secondary" href="/api/image-prompts?slug=${encodeURIComponent(ctx.slug)}&amp;_t=${encodeURIComponent(ctx.token)}">Image Prompts</a>
  </div>
  <h1>Pharmacy Image Upload <span class="badge">Standalone</span></h1>
  <p class="sub">Server-rendered upload form — works without dashboard JavaScript. WebP files only.</p>
  ${errorBlock}
  <div class="panel">
    <form method="POST" action="${esc(buildPageUrl(ctx))}" enctype="multipart/form-data">
      ${ctx.slug ? `<input type="hidden" name="slug" value="${esc(ctx.slug)}"/>` : ""}
      ${ctx.token ? `<input type="hidden" name="_t" value="${esc(ctx.token)}"/>` : ""}
      <label>Industry
        <select name="industry">
          <option value="pharmacy" selected>Pharmacy</option>
        </select>
      </label>
      <label>Pack
        <select name="pack" id="siu-pack">${packOptions}</select>
        <span class="hint">All packs available without JavaScript.</span>
      </label>
      <label>Image
        <select name="imageKey" id="siu-imageKey">${imageOptions}</select>
        <span class="hint">Options grouped by pack label — pick the row matching your pack above.</span>
      </label>
      <label>Slot
        <select name="slot">${slotOptions}</select>
      </label>
      <label>Upload target
        <span class="path" id="siu-target">${esc(targetPath)}</span>
      </label>
      <label>File (.webp only)
        <input type="file" name="file" accept="image/webp,.webp" required/>
      </label>
      <button type="submit" class="btn">Upload Image</button>
    </form>
  </div>
  <script>
  (function(){
    var packSel=document.getElementById('siu-pack');
    var imageSel=document.getElementById('siu-imageKey');
    var targetEl=document.getElementById('siu-target');
    if(!packSel||!imageSel)return;
    var allOpts=Array.prototype.slice.call(imageSel.options);
    function filterImages(){
      var pack=packSel.value;
      var prev=imageSel.value;
      imageSel.innerHTML='';
      var first=null;
      allOpts.forEach(function(opt){
        if(opt.getAttribute('data-pack')===pack){
          imageSel.appendChild(opt.cloneNode(true));
          if(!first)first=opt.value;
        }
      });
      var match=Array.prototype.slice.call(imageSel.options).some(function(o){return o.value===prev;});
      if(match)imageSel.value=prev;
      else if(first)imageSel.value=first;
      updateTarget();
    }
    function updateTarget(){
      if(!targetEl)return;
      var pack=packSel.value;
      var key=imageSel.value;
      targetEl.textContent='assets/pharmacy-image-library/'+pack+'/'+key+'.webp';
    }
    packSel.addEventListener('change',filterImages);
    imageSel.addEventListener('change',updateTarget);
    filterImages();
  })();
  </script>`;

  return renderLayout("Pharmacy Image Upload", body);
}

function renderSuccessPage(req: Request, uploadPath: string): string {
  const ctx = pageContext(req);
  const againUrl = buildPageUrl(ctx);
  const previewUrl = PREVIEW_URL;

  const body = `
  <div class="success">
    <h1 style="margin-bottom:8px;font-size:1.2rem">Upload complete</h1>
    <p><strong>Path:</strong></p>
    <span class="path">${esc(uploadPath)}</span>
    <p style="margin-top:12px"><strong>Next step:</strong> Approve image in the dashboard or preview when ready.</p>
  </div>
  <div class="links">
    <a class="btn" href="${esc(againUrl)}">Upload another image</a>
    <a class="btn btn-secondary" href="${esc(previewUrl)}">Open preview</a>
  </div>`;

  return renderLayout("Upload Complete", body);
}

function renderErrorPage(message: string, req: Request): string {
  return renderFormPage(req, { error: message });
}

router.get("/image-upload", (req: Request, res: Response) => {
  try {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.send(renderFormPage(req));
  } catch (err) {
    res.status(500).send(`<pre>Failed to render upload page: ${esc((err as Error).message)}</pre>`);
  }
});

router.post("/image-upload", uploadMiddleware, (req: Request, res: Response) => {
  try {
    const industry = q(req, "industry") ?? "pharmacy";
    const pack = q(req, "pack") ?? q(req, "packKey") ?? q(req, "imagePack");
    const imageKey = q(req, "imageKey") ?? q(req, "selectedImageKey");
    const slot = q(req, "slot");

    if (!pack || !imageKey || !slot) {
      res.status(400).send(renderErrorPage("pack, imageKey, and slot are required.", req));
      return;
    }
    if (!req.file) {
      res.status(400).send(renderErrorPage("file is required.", req));
      return;
    }

    const record = saveUploadedImage({
      industry,
      pack,
      imageKey,
      slot,
      sourcePath: req.file.path,
      approvalStatus: "uploaded",
    });

    try {
      fs.unlinkSync(req.file.path);
    } catch {
      /* temp cleanup best-effort */
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(renderSuccessPage(req, record.uploadPath));
  } catch (err) {
    res.status(500).send(renderErrorPage((err as Error).message, req));
  }
});

export default router;
