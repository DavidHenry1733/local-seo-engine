/**
 * distribution.ts
 *
 * GET  /api/distribution/:slug              — list index (generated pages)
 * GET  /api/distribution/:slug/:pageSlug    — fetch single page content
 * POST /api/distribution/:slug/generate     — generate for one page  { pageSlug }
 * POST /api/distribution/:slug/generate-all — generate for all pages in a campaign { campaignId }
 * PUT  /api/distribution/:slug/:pageSlug/status — update approval status + posted URLs
 *
 * GET  /api/distribution/generate-video     — streaming HTML video pack generation
 * GET  /api/distribution/:slug/video-index  — list video index
 * GET  /api/distribution/:slug/video/:pageSlug — fetch video pack
 * PUT  /api/distribution/:slug/video/:pageSlug/status — update video status
 */

import { Router }        from "express";
import fs                from "node:fs";
import path              from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateDistributionContent,
  type DistributionContent,
  type SuggestedImage,
  type DistributionLink,
  type CopyBlocks,
  POST_ANGLES,
} from "../../../../../src/generator/distributionContent.js";
import {
  generateVideoPack,
  type VideoPackOutput,
} from "../../../../../src/generator/videoGeneration.js";

const __filename     = fileURLToPath(import.meta.url);
const __dirname      = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");
const PROJECTS_DIR   = path.join(WORKSPACE_ROOT, "config", "projects");

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ProjectConfig {
  clientSlug:     string;
  businessName:   string;
  domain:         string;
  primaryCtaUrl?: string;
  toneOfVoice?:   string;
  description?:   string;
  services?:      string[];
  serviceAreas?:  string[];
  brandColour?:   string;
  logoUrl?:       string;
  branding?: { primaryColor?: string; accentColor?: string };
}

interface PageData {
  service:          string;
  primaryLocation?: string;
  location?:        string;
  targetKeyword:    string;
  remotePath:       string;
  liveUrl?:         string;
  campaignId?:      string;
  status?:          string;
  pageTitle?:       string;
  primaryKeyword?:  string;
}

interface DistributionEntry {
  pageSlug:       string;
  pageTitle:      string;
  generatedAt:    string;
  approvalStatus: "draft" | "approved" | "posted";
  postedUrls: {
    facebook?:  string;
    linkedin?:  string;
    reddit?:    string;
    youtube?:   string;
  };
}

interface DistributionIndex {
  entries: DistributionEntry[];
}

// ── Video index types ─────────────────────────────────────────────────────────

interface VideoIndexEntry {
  pageSlug:            string;
  pageTitle:           string;
  generatedAt:         string;
  videoTypesAvailable: string[];
  approvalStatus:      "draft" | "approved" | "produced" | "uploaded";
  uploadedUrl?:        string;
}

interface VideoIndex {
  entries: VideoIndexEntry[];
}

// ── Video storage helpers ─────────────────────────────────────────────────────

function videoDir(slug: string): string {
  return path.join(OUTPUT_DIR, slug, "video");
}

function loadVideoIndex(slug: string): VideoIndex {
  const p = path.join(videoDir(slug), "index.json");
  if (!fs.existsSync(p)) return { entries: [] };
  return JSON.parse(fs.readFileSync(p, "utf8")) as VideoIndex;
}

function saveVideoIndex(slug: string, idx: VideoIndex): void {
  const dir = videoDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(idx, null, 2), "utf8");
}

function upsertVideoIndexEntry(slug: string, entry: VideoIndexEntry): void {
  const idx = loadVideoIndex(slug);
  const i = idx.entries.findIndex((e) => e.pageSlug === entry.pageSlug);
  if (i >= 0) {
    idx.entries[i] = { ...idx.entries[i], ...entry };
  } else {
    idx.entries.push(entry);
  }
  idx.entries.sort((a, b) => a.pageSlug.localeCompare(b.pageSlug));
  saveVideoIndex(slug, idx);
}

function loadProject(slug: string): ProjectConfig | null {
  const p = path.join(PROJECTS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as ProjectConfig;
}

function loadPageData(slug: string, pageSlug: string): PageData | null {
  const p = path.join(OUTPUT_DIR, slug, pageSlug, "page-data.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as PageData;
}

function distributionDir(slug: string): string {
  return path.join(OUTPUT_DIR, slug, "distribution");
}

function loadIndex(slug: string): DistributionIndex {
  const p = path.join(distributionDir(slug), "index.json");
  if (!fs.existsSync(p)) return { entries: [] };
  return JSON.parse(fs.readFileSync(p, "utf8")) as DistributionIndex;
}

function saveIndex(slug: string, idx: DistributionIndex): void {
  const dir = distributionDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "index.json"),
    JSON.stringify(idx, null, 2),
    "utf8",
  );
}

function upsertIndexEntry(slug: string, entry: DistributionEntry): void {
  const idx = loadIndex(slug);
  const existing = idx.entries.findIndex((e) => e.pageSlug === entry.pageSlug);
  if (existing >= 0) {
    idx.entries[existing] = { ...idx.entries[existing], ...entry };
  } else {
    idx.entries.push(entry);
  }
  idx.entries.sort((a, b) => a.pageSlug.localeCompare(b.pageSlug));
  saveIndex(slug, idx);
}

function titleCase(str: string): string {
  return str
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildPageTitle(pd: PageData): string {
  // "web design barnsley" → "Web Design in Barnsley"
  const loc = titleCase(pd.primaryLocation ?? pd.location ?? "");
  const svc = titleCase(pd.service ?? "");
  return `${svc} in ${loc}`;
}

function nearbyAreas(slug: string, campaignId: string | undefined): string[] {
  if (!campaignId) return [];
  const sessionDir = path.join(OUTPUT_DIR, slug, "sessions");
  if (!fs.existsSync(sessionDir)) return [];
  // Find session file for this campaign
  const sessionFile = path.join(sessionDir, `${campaignId}.json`);
  if (!fs.existsSync(sessionFile)) return [];
  try {
    const session = JSON.parse(fs.readFileSync(sessionFile, "utf8")) as {
      selectedAreaDefs?: Array<{ area?: string; tier?: string }>;
    };
    return (session.selectedAreaDefs ?? [])
      .filter((d) => d.tier !== "hub" && d.area)
      .map((d) => d.area!)
      .slice(0, 8);
  } catch {
    return [];
  }
}

// ── Content enrichment ────────────────────────────────────────────────────────

interface PageImageEntry {
  libraryId?: string;
  src?:       string;
  alt?:       string;
}

interface PageImagesData {
  hero?:       PageImageEntry;
  support?:    PageImageEntry;
  conversion?: PageImageEntry;
}

const MANUAL_INSTRUCTIONS: Record<string, string> = {
  facebook: [
    "1. Click \"Download image\" above to save the image to your device.",
    "2. Open your Facebook Page and click \"Create post\".",
    "3. Click the photo icon and upload the downloaded image.",
    "4. Paste the post text (use \"Copy post only\" — do not include the URL in a photo post).",
    "5. Add hashtags at the end of the post text.",
    "6. Review the preview, then publish or schedule.",
    "Tip: If posting a link instead of a photo, use \"Copy post + URL\" and let Facebook generate the link preview card automatically — do not also attach an image or it will suppress the preview.",
  ].join("\n"),
  linkedin: [
    "1. Go to your LinkedIn Company Page and click \"Create a post\".",
    "2. Paste the post text. The URL will auto-generate a link preview card.",
    "3. Upload the suggested image (or let the link preview image show instead).",
    "4. Add hashtags at the end of the post.",
    "5. Review carefully — LinkedIn does not allow editing after posting.",
    "6. Publish or schedule.",
  ].join("\n"),
  reddit: [
    "1. Choose a subreddit from the list below. Read its rules before posting — many prohibit self-promotion.",
    "2. Create a Text post. Paste the title, then the body. Do NOT include the link in the body.",
    "3. Submit the post, then wait for some engagement (upvotes, comments).",
    "4. Once the post has traction, add the Suggested Follow-up Comment (the one containing the link and disclosure).",
    "5. Never post identical content to multiple subreddits at the same time.",
    "6. Engage genuinely with any comments — do not just drop the link and leave.",
    "Tip: High-moderation subreddits will ban accounts that self-promote. Use the moderation risk rating as a guide.",
  ].join("\n"),
  youtube: [
    "1. Go to YouTube Studio → Create → Upload video.",
    "2. Paste the video title and description. Add the page URL in the description.",
    "3. Paste tags from the tags list.",
    "4. Generate a thumbnail using the thumbnail prompt with an AI image tool.",
    "5. Add video chapters by pasting the chapter timestamps in the description.",
    "6. Set visibility (Public or Scheduled) and publish.",
  ].join("\n"),
};

function buildImageServeUrl(src: string, domain: string): string {
  const base = domain.replace(/\/+$/, "");
  try {
    const url   = new URL(src);
    const parts = url.pathname.split("/").filter(Boolean);
    const len   = parts.length;
    if (len >= 3) {
      return `${base}/api/image-library/serve/${parts[len - 3]}/${parts[len - 2]}/${parts[len - 1]}`;
    }
  } catch { /* fallthrough */ }
  // src may already be a relative path like /path/to/file.jpg
  if (src.startsWith("/")) return `${base}${src}`;
  return src;
}

function buildSuggestedImage(img: PageImageEntry | undefined, domain: string): SuggestedImage | undefined {
  if (!img?.libraryId || !img?.src) return undefined;
  const idParts = img.libraryId.split("-");
  const slot    = idParts.length >= 3 ? idParts[idParts.length - 2] : "hero";
  return {
    src:        img.src,
    alt:        img.alt ?? "",
    libraryId:  img.libraryId,
    slot,
    previewUrl: buildImageServeUrl(img.src, domain),
  };
}

function buildLink(
  aiLink: { suggestedAnchorText?: string } | undefined,
  pageUrl: string,
): DistributionLink {
  const displayText = pageUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return {
    url:                 pageUrl,
    suggestedAnchorText: aiLink?.suggestedAnchorText ?? "",
    displayText,
  };
}

function buildCopyBlocks(
  postText: string,
  url: string,
  image: SuggestedImage | undefined,
  platform: string,
): CopyBlocks {
  return {
    postOnly:                  postText,
    postWithUrl:               postText + "\n\n" + url,
    imageCaption:              image?.alt ?? "",
    manualPostingInstructions: MANUAL_INSTRUCTIONS[platform] ?? "",
  };
}

function enrichContent(
  content: DistributionContent,
  pageImages: PageImagesData | undefined,
  pageUrl: string,
  domain: string,
): DistributionContent {
  const heroImg = buildSuggestedImage(pageImages?.hero, domain);
  const convImg = buildSuggestedImage(pageImages?.conversion, domain);
  const fbImg   = convImg ?? heroImg;
  const liImg   = heroImg;

  type AiLink = { suggestedAnchorText?: string };
  const fb = content.facebook;
  const li = content.linkedin;
  const rd = content.reddit;
  const yt = content.youtube;

  return {
    facebook: {
      ...fb,
      suggestedImage: fbImg,
      link:       buildLink((fb as unknown as { link?: AiLink }).link, pageUrl),
      copyBlocks: buildCopyBlocks(fb.postText, pageUrl, fbImg, "facebook"),
    },
    linkedin: {
      ...li,
      suggestedImage: liImg,
      link:       buildLink((li as unknown as { link?: AiLink }).link, pageUrl),
      copyBlocks: buildCopyBlocks(li.postText, pageUrl, liImg, "linkedin"),
    },
    reddit: {
      ...rd,
      link:       buildLink((rd as unknown as { link?: AiLink }).link, pageUrl),
      // Reddit body never gets the URL — link goes only in suggestedFollowUpComment
      copyBlocks: buildCopyBlocks(rd.body, "", undefined, "reddit"),
    },
    youtube: {
      ...yt,
      link:       buildLink((yt as unknown as { link?: AiLink }).link, pageUrl),
      copyBlocks: buildCopyBlocks(yt.description, pageUrl, undefined, "youtube"),
    },
    postAngle: content.postAngle,
  };
}

// ── Generate for one page ─────────────────────────────────────────────────────

async function generateForPage(
  slug: string,
  pageSlug: string,
  project: ProjectConfig,
): Promise<DistributionContent> {
  const pd = loadPageData(slug, pageSlug);
  if (!pd) throw new Error(`No page-data.json found for ${pageSlug}`);

  const pageTitle  = buildPageTitle(pd);
  const pageUrl    = pd.liveUrl
    ?? `${project.domain.replace(/\/+$/, "")}${pd.remotePath}`;

  const ctx = {
    clientSlug:     slug,
    campaignId:     pd.campaignId ?? "",
    pageSlug,
    pageTitle,
    primaryKeyword: pd.targetKeyword,
    service:        pd.service,
    location:       pd.primaryLocation ?? pd.location ?? "",
    businessName:   project.businessName,
    pageUrl,
    moneyPageUrl:   project.primaryCtaUrl,
    toneOfVoice:    project.toneOfVoice,
    nearbyAreas:    nearbyAreas(slug, pd.campaignId),
  };

  const content    = await generateDistributionContent(ctx);
  const pageImages = (pd as unknown as { images?: PageImagesData }).images;
  return enrichContent(content, pageImages, pageUrl, project.domain);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/distribution/generate-page?slug=rotherham-proof&pageSlug=local-seo-barnsley
// Pure HTML streaming response — works without any client-side JavaScript
router.get("/distribution/generate-page", async (req, res) => {
  const slug     = (req.query.slug     as string | undefined) ?? "";
  const pageSlug = (req.query.pageSlug as string | undefined) ?? "";

  const dashboardUrl = "/api/dashboard";

  const sendHtml = (chunk: string) => res.write(chunk);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");

  sendHtml(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Generating…</title>
<style>
  body{font-family:system-ui,sans-serif;background:#1e40af;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;flex-direction:column;gap:20px}
  .spinner{width:48px;height:48px;border:5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  h2{margin:0;font-size:1.3rem;font-weight:700}
  p{margin:0;font-size:.9rem;color:#bfdbfe}
  .status{font-size:.85rem;color:#93c5fd;min-height:1.2em}
</style></head><body>
<div class="spinner"></div>
<h2>Generating distribution content…</h2>
<p>AI is writing posts for Facebook, LinkedIn, Reddit &amp; YouTube</p>
<p class="status" id="s">Connecting to AI…</p>
`);

  if (!slug || !pageSlug) {
    sendHtml(`<p style="color:#fca5a5">Error: missing slug or pageSlug</p>
<script>setTimeout(()=>location.href='${dashboardUrl}',3000)</script></body></html>`);
    res.end(); return;
  }

  const project = loadProject(slug);
  if (!project) {
    sendHtml(`<p style="color:#fca5a5">Error: project "${slug}" not found</p>
<script>setTimeout(()=>location.href='${dashboardUrl}',3000)</script></body></html>`);
    res.end(); return;
  }

  const pd = loadPageData(slug, pageSlug);
  if (!pd) {
    sendHtml(`<p style="color:#fca5a5">Error: no page data for "${pageSlug}"</p>
<script>setTimeout(()=>location.href='${dashboardUrl}',3000)</script></body></html>`);
    res.end(); return;
  }

  sendHtml(`<script>document.getElementById('s').textContent='Generating content across 4 platforms…'</script>\n`);

  try {
    const content   = await generateForPage(slug, pageSlug, project);
    sendHtml(`<script>document.getElementById('s').textContent='Saving…'</script>\n`);

    const pageTitle = buildPageTitle(pd);
    const dir       = distributionDir(slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${pageSlug}.json`), JSON.stringify(content, null, 2), "utf8");

    const existing = loadIndex(slug).entries.find((e) => e.pageSlug === pageSlug);
    upsertIndexEntry(slug, {
      pageSlug, pageTitle,
      generatedAt:    new Date().toISOString(),
      approvalStatus: existing?.approvalStatus ?? "draft",
      postedUrls:     existing?.postedUrls ?? {},
    });

    sendHtml(`<p style="color:#86efac;font-size:1.1rem">&#10003; Done! "${pageTitle}" content generated.</p>
<p class="status">Returning to dashboard in 2 seconds…</p>
<script>setTimeout(()=>location.href='${dashboardUrl}',2000)</script></body></html>`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sendHtml(`<p style="color:#fca5a5">Error: ${msg}</p>
<script>setTimeout(()=>location.href='${dashboardUrl}',4000)</script></body></html>`);
  }

  res.end();
});

// GET /api/distribution/generate-video?slug=X&pageSlug=Y
// Pure HTML streaming response — triggers video pack generation, then redirects
router.get("/distribution/generate-video", async (req, res) => {
  const slug     = (req.query.slug     as string | undefined) ?? "";
  const pageSlug = (req.query.pageSlug as string | undefined) ?? "";

  const dashboardUrl = "/api/dashboard";

  const sendHtml = (chunk: string) => res.write(chunk);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Cache-Control", "no-store");

  sendHtml(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Generating Video Pack…</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .box{background:#1e293b;border-radius:12px;padding:40px 48px;max-width:480px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.4)}
  h2{margin:0 0 12px;font-size:1.4rem;font-weight:700}
  p{margin:8px 0;color:#94a3b8;font-size:.95rem}
  .spinner{width:40px;height:40px;border:4px solid #334155;border-top-color:#38bdf8;border-radius:50%;animation:spin 1s linear infinite;margin:24px auto}
  .status{color:#38bdf8;font-weight:600;margin-top:16px}
  @keyframes spin{to{transform:rotate(360deg)}}
</style></head><body><div class="box">
<div class="spinner"></div>
<h2>Generating Video Pack</h2>
<p><strong>${slug}</strong> &mdash; <code>${pageSlug}</code></p>
<p class="status">Creating YouTube Short, Standard and Social Clip&hellip;</p>`);

  if (!slug || !pageSlug) {
    sendHtml(`<p style="color:#fca5a5">Error: slug and pageSlug are required.</p>
<script>setTimeout(()=>location.href='${dashboardUrl}',4000)</script></body></html>`);
    res.end(); return;
  }

  try {
    const project = loadProject(slug);
    if (!project) {
      sendHtml(`<p style="color:#fca5a5">Error: Project not found.</p>
<script>setTimeout(()=>location.href='${dashboardUrl}',4000)</script></body></html>`);
      res.end(); return;
    }

    const pd = loadPageData(slug, pageSlug);
    if (!pd) {
      sendHtml(`<p style="color:#fca5a5">Error: No page data found for "${pageSlug}". Generate the SEO page first.</p>
<script>setTimeout(()=>location.href='${dashboardUrl}',4000)</script></body></html>`);
      res.end(); return;
    }

    const brandColours = [
      project.brandColour,
      project.branding?.primaryColor,
      project.branding?.accentColor,
    ].filter(Boolean).join(", ");

    const ctx = {
      clientSlug:     slug,
      campaignId:     pd.campaignId   ?? "",
      pageSlug,
      pageTitle:      pd.pageTitle    ?? buildPageTitle(pd),
      primaryKeyword: pd.primaryKeyword ?? pd.targetKeyword,
      service:        pd.service,
      location:       pd.primaryLocation ?? pd.location ?? "",
      businessName:   project.businessName,
      pageUrl:        `${project.domain}/${pageSlug}`,
      moneyPageUrl:   project.primaryCtaUrl,
      aiSummary:      (pd as unknown as Record<string, unknown>).aiSummary as string | undefined,
      keyBenefits:    (pd as unknown as Record<string, unknown>).keyBenefits as string[] | undefined,
      targetAudience: (pd as unknown as Record<string, unknown>).targetAudience as string | undefined,
      nearbyAreas:    nearbyAreas(slug, pd.campaignId),
      brandColours:   brandColours || undefined,
      logoUrl:        project.logoUrl,
      toneOfVoice:    project.toneOfVoice,
    };

    const pack: VideoPackOutput = await generateVideoPack(ctx);

    const dir = videoDir(slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${pageSlug}.json`),
      JSON.stringify(pack, null, 2),
      "utf8",
    );

    upsertVideoIndexEntry(slug, {
      pageSlug,
      pageTitle:           pd.pageTitle ?? buildPageTitle(pd),
      generatedAt:         new Date().toISOString(),
      videoTypesAvailable: ["youtube_short", "youtube_standard", "social_clip"],
      approvalStatus:      "draft",
    });

    sendHtml(`<p style="color:#86efac">&#10003; Video pack generated for <strong>${pd.pageTitle}</strong>.</p>
<p class="status">Returning to dashboard in 2 seconds…</p>
<script>setTimeout(()=>location.href='${dashboardUrl}',2000)</script></body></html>`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sendHtml(`<p style="color:#fca5a5">Error: ${msg}</p>
<script>setTimeout(()=>location.href='${dashboardUrl}',4000)</script></body></html>`);
  }

  res.end();
});

// GET /api/distribution/:slug/pages — fast page list (reads output dir, no QA processing)
router.get("/distribution/:slug/pages", (req, res) => {
  const { slug } = req.params;
  const outputDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(outputDir)) { res.json({ pages: [] }); return; }
  const entries = fs.readdirSync(outputDir, { withFileTypes: true });
  const pages: Array<{ slug: string; title: string; service: string; location: string; campaignId?: string }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pdPath = path.join(outputDir, entry.name, "page-data.json");
    if (!fs.existsSync(pdPath)) continue;
    try {
      const pd = JSON.parse(fs.readFileSync(pdPath, "utf8")) as PageData & { location?: string; isHubPage?: boolean; pageType?: string };
      // Only include hub pages
      if (!pd.isHubPage && pd.pageType !== "hub") continue;
      const loc = pd.primaryLocation ?? pd.location ?? "";
      const svc = pd.service ?? "";
      pages.push({
        slug: entry.name,
        title: loc && svc ? `${titleCase(svc)} in ${titleCase(loc)}` : entry.name,
        service: svc,
        location: loc,
        campaignId: pd.campaignId,
      });
    } catch { /* skip malformed */ }
  }
  pages.sort((a, b) => a.slug.localeCompare(b.slug));
  res.json({ pages });
});

// GET /api/distribution/:slug  (router is mounted at /api, so path here is /distribution/:slug)
router.get("/distribution/:slug", (req, res) => {
  const { slug } = req.params;
  const idx = loadIndex(slug);
  res.json(idx);
});

// GET /api/distribution/:slug/generate-stream?pageSlug=xxx  ← MUST be before /:slug/:pageSlug catch-all
// Server-Sent Events stream — browser keeps connection open, server pushes progress
router.get("/distribution/:slug/generate-stream", async (req, res) => {
  const { slug }     = req.params;
  const pageSlug     = (req.query.pageSlug as string | undefined) ?? "";

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: string, data: Record<string, unknown>) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  if (!pageSlug) {
    send("error", { message: "pageSlug query param required" });
    res.end(); return;
  }

  const project = loadProject(slug);
  if (!project) {
    send("error", { message: "Project not found" });
    res.end(); return;
  }

  const pd = loadPageData(slug, pageSlug);
  if (!pd) {
    send("error", { message: `No page data found for "${pageSlug}". Make sure this page has been generated first.` });
    res.end(); return;
  }

  send("progress", { message: "Connecting to AI…", pct: 5 });

  try {
    send("progress", { message: "Generating content across 4 platforms…", pct: 20 });
    const content   = await generateForPage(slug, pageSlug, project);
    send("progress", { message: "Saving content…", pct: 90 });

    const pageTitle = buildPageTitle(pd);
    const dir       = distributionDir(slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${pageSlug}.json`), JSON.stringify(content, null, 2), "utf8");

    const existing  = loadIndex(slug).entries.find((e) => e.pageSlug === pageSlug);
    upsertIndexEntry(slug, {
      pageSlug, pageTitle,
      generatedAt:    new Date().toISOString(),
      approvalStatus: existing?.approvalStatus ?? "draft",
      postedUrls:     existing?.postedUrls ?? {},
    });

    send("done", { pageSlug, pageTitle, message: "Content generated successfully" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send("error", { message });
  }

  res.end();
});

// GET /api/distribution/:slug/video-index
router.get("/distribution/:slug/video-index", (req, res) => {
  const { slug } = req.params;
  res.json(loadVideoIndex(slug));
});

// GET /api/distribution/:slug/video/:pageSlug
router.get("/distribution/:slug/video/:pageSlug", (req, res) => {
  const { slug, pageSlug } = req.params;
  const file = path.join(videoDir(slug), `${pageSlug}.json`);
  if (!fs.existsSync(file)) {
    res.status(404).json({ error: "Video pack not found for this page" });
    return;
  }
  res.json(JSON.parse(fs.readFileSync(file, "utf8")));
});

// PUT /api/distribution/:slug/video/:pageSlug/status
// Body: { approvalStatus: "draft"|"approved"|"produced"|"uploaded", uploadedUrl?: string }
router.put("/distribution/:slug/video/:pageSlug/status", (req, res) => {
  const { slug, pageSlug } = req.params;
  const { approvalStatus, uploadedUrl } = req.body as {
    approvalStatus?: string;
    uploadedUrl?:    string;
  };

  const allowed = ["draft", "approved", "produced", "uploaded"];
  if (!approvalStatus || !allowed.includes(approvalStatus)) {
    res.status(400).json({ error: `approvalStatus must be one of: ${allowed.join(", ")}` });
    return;
  }

  const idx = loadVideoIndex(slug);
  const entry = idx.entries.find((e) => e.pageSlug === pageSlug);
  if (!entry) {
    res.status(404).json({ error: "No video index entry for this page" });
    return;
  }

  entry.approvalStatus = approvalStatus as VideoIndexEntry["approvalStatus"];
  if (uploadedUrl !== undefined) entry.uploadedUrl = uploadedUrl;
  saveVideoIndex(slug, idx);

  res.json({ ok: true, pageSlug, approvalStatus: entry.approvalStatus });
});

// ── Content Calendar ─────────────────────────────────────────────────────────

interface CalendarEntry {
  day:       number;
  date:      string;
  platform:  string;
  angle:     string;
  pageSlug:  string;
  pageTitle: string;
  status:    "draft" | "approved" | "posted";
  notes:     string;
}

interface ContentCalendar {
  slug:        string;
  days:        number;
  generatedAt: string;
  startDate:   string;
  entries:     CalendarEntry[];
}

const CALENDAR_PLATFORMS = ["facebook", "linkedin", "reddit", "youtube"];

function buildCalendar(
  slug: string,
  days: number,
  pages: Array<{ slug: string; title: string }>,
): ContentCalendar {
  const startDate = new Date();
  const entries: CalendarEntry[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    entries.push({
      day:       i + 1,
      date:      d.toISOString().split("T")[0],
      platform:  CALENDAR_PLATFORMS[i % CALENDAR_PLATFORMS.length],
      angle:     POST_ANGLES[i % POST_ANGLES.length],
      pageSlug:  pages[i % pages.length].slug,
      pageTitle: pages[i % pages.length].title,
      status:    "draft",
      notes:     "",
    });
  }
  return {
    slug,
    days,
    generatedAt: new Date().toISOString(),
    startDate:   startDate.toISOString().split("T")[0],
    entries,
  };
}

function calendarFile(slug: string): string {
  return path.join(distributionDir(slug), "calendar.json");
}

// GET /api/distribution/:slug/calendar
router.get("/distribution/:slug/calendar", (req, res) => {
  const { slug } = req.params;
  const file = calendarFile(slug);
  if (!fs.existsSync(file)) {
    res.json({ slug, days: 0, generatedAt: null, entries: [] });
    return;
  }
  res.json(JSON.parse(fs.readFileSync(file, "utf8")));
});

// POST /api/distribution/:slug/calendar/generate  { days: 7|14|30, campaignId? }
router.post("/distribution/:slug/calendar/generate", (req, res) => {
  const { slug } = req.params;
  const { days = 7, campaignId } = req.body as { days?: number; campaignId?: string };
  const daysNum = [7, 14, 30].includes(Number(days)) ? Number(days) : 7;

  const clientDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: "Client output not found" });
    return;
  }

  const pages: Array<{ slug: string; title: string }> = [];
  for (const entry of fs.readdirSync(clientDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pdPath = path.join(clientDir, entry.name, "page-data.json");
    if (!fs.existsSync(pdPath)) continue;
    try {
      const pd = JSON.parse(fs.readFileSync(pdPath, "utf8")) as PageData & { isHubPage?: boolean; pageType?: string; location?: string };
      if (!pd.isHubPage && pd.pageType !== "hub") continue;
      if (campaignId && pd.campaignId !== campaignId) continue;
      const loc = pd.primaryLocation ?? (pd as { location?: string }).location ?? "";
      const svc = pd.service ?? "";
      pages.push({ slug: entry.name, title: loc && svc ? `${titleCase(svc)} in ${titleCase(loc)}` : entry.name });
    } catch { /* skip */ }
  }

  if (pages.length === 0) {
    res.status(404).json({ error: "No hub pages found. Generate SEO pages first." });
    return;
  }

  pages.sort((a, b) => a.slug.localeCompare(b.slug));
  const calendar = buildCalendar(slug, daysNum, pages);
  const dir = distributionDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(calendarFile(slug), JSON.stringify(calendar, null, 2), "utf8");
  res.json(calendar);
});

// PUT /api/distribution/:slug/calendar/:day/status  { status, notes? }
router.put("/distribution/:slug/calendar/:day/status", (req, res) => {
  const { slug, day } = req.params;
  const { status, notes } = req.body as { status?: string; notes?: string };
  const file = calendarFile(slug);
  if (!fs.existsSync(file)) { res.status(404).json({ error: "No calendar found" }); return; }
  const cal = JSON.parse(fs.readFileSync(file, "utf8")) as ContentCalendar;
  const entry = cal.entries.find((e) => e.day === parseInt(day, 10));
  if (!entry) { res.status(404).json({ error: `Day ${day} not found` }); return; }
  if (status && ["draft", "approved", "posted"].includes(status)) {
    entry.status = status as CalendarEntry["status"];
  }
  if (notes !== undefined) entry.notes = notes;
  fs.writeFileSync(file, JSON.stringify(cal, null, 2), "utf8");
  res.json({ ok: true, entry });
});

// GET /api/distribution/:slug/:pageSlug  ← catch-all must stay AFTER generate-stream
router.get("/distribution/:slug/:pageSlug", (req, res) => {
  const { slug, pageSlug } = req.params;
  const file = path.join(distributionDir(slug), `${pageSlug}.json`);
  if (!fs.existsSync(file)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(JSON.parse(fs.readFileSync(file, "utf8")));
});

// POST /api/distribution/:slug/generate  { pageSlug } — kept for backward compat, delegates to stream logic
router.post("/distribution/:slug/generate", async (req, res) => {
  const { slug }     = req.params;
  const { pageSlug } = req.body as { pageSlug?: string };
  if (!pageSlug) { res.status(400).json({ error: "pageSlug required" }); return; }
  const project = loadProject(slug);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  const pd = loadPageData(slug, pageSlug);
  if (!pd) { res.status(404).json({ error: `No page data found for "${pageSlug}"` }); return; }
  try {
    const content   = await generateForPage(slug, pageSlug, project);
    const pageTitle = buildPageTitle(pd);
    const dir       = distributionDir(slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${pageSlug}.json`), JSON.stringify(content, null, 2), "utf8");
    const existing  = loadIndex(slug).entries.find((e) => e.pageSlug === pageSlug);
    upsertIndexEntry(slug, { pageSlug, pageTitle, generatedAt: new Date().toISOString(), approvalStatus: existing?.approvalStatus ?? "draft", postedUrls: existing?.postedUrls ?? {} });
    res.json({ ok: true, pageSlug });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// POST /api/distribution/:slug/generate-all  { campaignId }
router.post("/distribution/:slug/generate-all", async (req, res) => {
  const { slug }       = req.params;
  const { campaignId } = req.body as { campaignId?: string };

  const project = loadProject(slug);
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  // Find all page directories that match the campaign
  const clientDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: "Client output not found" });
    return;
  }

  const pageSlugs: string[] = [];
  for (const entry of fs.readdirSync(clientDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pdFile = path.join(clientDir, entry.name, "page-data.json");
    if (!fs.existsSync(pdFile)) continue;
    try {
      const pd = JSON.parse(fs.readFileSync(pdFile, "utf8")) as PageData;
      if (campaignId && pd.campaignId !== campaignId) continue;
      pageSlugs.push(entry.name);
    } catch { /* skip */ }
  }

  if (pageSlugs.length === 0) {
    res.status(404).json({ error: "No matching pages found" });
    return;
  }

  // Run generation in series to avoid hammering the API
  const results: Array<{ pageSlug: string; ok: boolean; error?: string }> = [];
  const dir = distributionDir(slug);
  fs.mkdirSync(dir, { recursive: true });

  for (const pageSlug of pageSlugs) {
    try {
      const content   = await generateForPage(slug, pageSlug, project);
      const pd        = loadPageData(slug, pageSlug)!;
      const pageTitle = buildPageTitle(pd);

      fs.writeFileSync(
        path.join(dir, `${pageSlug}.json`),
        JSON.stringify(content, null, 2),
        "utf8",
      );

      const existing = loadIndex(slug).entries.find((e) => e.pageSlug === pageSlug);
      upsertIndexEntry(slug, {
        pageSlug,
        pageTitle,
        generatedAt:    new Date().toISOString(),
        approvalStatus: existing?.approvalStatus ?? "draft",
        postedUrls:     existing?.postedUrls ?? {},
      });

      results.push({ pageSlug, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      req.log.error({ err, pageSlug }, "distribution generate-all failed for page");
      results.push({ pageSlug, ok: false, error: msg });
    }
  }

  res.json({ ok: true, results });
});

// PUT /api/distribution/:slug/:pageSlug/status  { approvalStatus, postedUrls }
router.put("/distribution/:slug/:pageSlug/status", (req, res) => {
  const { slug, pageSlug } = req.params;
  const { approvalStatus, postedUrls } = req.body as {
    approvalStatus?: "draft" | "approved" | "posted";
    postedUrls?: { facebook?: string; linkedin?: string; reddit?: string; youtube?: string };
  };

  const idx = loadIndex(slug);
  const entry = idx.entries.find((e) => e.pageSlug === pageSlug);
  if (!entry) { res.status(404).json({ error: "Entry not found in index" }); return; }

  if (approvalStatus) entry.approvalStatus = approvalStatus;
  if (postedUrls)     entry.postedUrls = { ...entry.postedUrls, ...postedUrls };

  saveIndex(slug, idx);

  // Also persist publishedUrls into the individual pageSlug.json
  if (postedUrls) {
    const dir  = distributionDir(slug);
    const file = path.join(dir, `${pageSlug}.json`);
    if (fs.existsSync(file)) {
      try {
        const existing   = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
        const merged     = { ...existing, publishedUrls: { ...(existing.publishedUrls as Record<string, unknown> ?? {}), ...postedUrls } };
        fs.writeFileSync(file, JSON.stringify(merged, null, 2), "utf8");
      } catch { /* non-fatal — index is the source of truth */ }
    }
  }

  res.json({ ok: true, entry });
});

export default router;
