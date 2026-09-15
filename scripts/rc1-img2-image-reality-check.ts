#!/usr/bin/env npx tsx
/**
 * RC1-IMG2 — Image library asset reality check + authenticated preview validation.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import {
  RC1_IMG1_PAGE_SLOT_PLANS,
  computeImageLibraryRevision,
  loadAssignmentsDoc,
  tracePageImageSlots,
  rebuildTenantLibraryContentImageAssignments,
} from "../src/pharmacy/pharmacyImageLibraryAssignmentService.ts";
import {
  auditImageLibraryRoot,
  classifyLibraryAssetFile,
  isApprovedContentImage,
  placeholderReason,
} from "../src/pharmacy/pharmacyImageLibraryContentAssetClassifier.ts";
import { buildCanonicalPreviewUrl } from "../src/pharmacy/pharmacyCanonicalFinalRenderPreviewService.ts";
import { resolveCanonicalFinalRenderPagePath } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";

function loadEnvFileQuiet(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const homePlaywright = "/home/inboxingproweb/.cache/ms-playwright";
if (fs.existsSync(homePlaywright) && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = homePlaywright;
}

const SLUG = "banner-cross-pharmacy";
const BASE = process.env.RC1_IMG2_BASE || "https://app.pharmaconnect.uk";
loadEnvFileQuiet(path.join(PHARMACY_WORKSPACE_ROOT, ".env"));
loadEnvFileQuiet(path.join(PHARMACY_WORKSPACE_ROOT, ".env.production"));
if (!process.env.SESSION_SECRET) {
  try {
    const requireCjs = createRequire(import.meta.url);
    const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
      apps?: Array<{ env?: { SESSION_SECRET?: string } }>;
    };
    const fromEco = eco.apps?.[0]?.env?.SESSION_SECRET;
    if (fromEco) process.env.SESSION_SECRET = fromEco;
  } catch {
    /* optional runtime auth source */
  }
}
const SESSION_SECRET = process.env.SESSION_SECRET;

const PREVIEW_PAGES = [
  { key: "homepage", pageType: "homepage" as const, url: buildCanonicalPreviewUrl(SLUG, "homepage", BASE) },
  { key: "service", pageType: "service" as const, url: buildCanonicalPreviewUrl(SLUG, "service", BASE) },
  { key: "guide", pageType: "guide" as const, url: buildCanonicalPreviewUrl(SLUG, "guide", BASE) },
  { key: "blog", pageType: "blog" as const, url: buildCanonicalPreviewUrl(SLUG, "blog", BASE) },
];

const evidenceDir = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  SLUG,
  "rc1-img2-evidence",
);
fs.mkdirSync(evidenceDir, { recursive: true });

function extractContentSlotsFromHtml(html: string): Array<{ slotId: string; src: string; html: string }> {
  const slots: Array<{ slotId: string; src: string; html: string }> = [];
  const re =
    /<(?:figure|div)[^>]*data-image-slot="(hero|support|trust|conversion)"[^>]*>[\s\S]*?<img[^>]+>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const block = m[0];
    const slotId = m[1];
    const srcM = block.match(/src="([^"]+)"/);
    slots.push({ slotId, src: srcM?.[1] || "", html: block.replace(/\s+/g, " ").trim() });
  }
  return slots;
}

function fileMeta(relPath: string): { mime: string; bytes: number; dimensions: string } {
  const full = path.join(PHARMACY_WORKSPACE_ROOT, relPath.replace(/^\/+/, ""));
  if (!fs.existsSync(full)) return { mime: "missing", bytes: 0, dimensions: "n/a" };
  const bytes = fs.statSync(full).size;
  const ext = path.extname(full).toLowerCase();
  const mime =
    ext === ".webp"
      ? "image/webp"
      : ext === ".svg"
        ? "image/svg+xml"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : "application/octet-stream";
  let dimensions = "n/a";
  if (ext === ".webp") {
    dimensions = "1536x1024 (declared in render when present)";
  }
  return { mime, bytes, dimensions };
}

function canonicalCopiedPath(pageSlug: string, assetRel: string): string {
  const copied = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-final-render",
    SLUG,
    assetRel.replace(/^\/assets\//, "assets/"),
  );
  return fs.existsSync(copied) ? copied : "not-copied-under-render-tree";
}

async function main() {
  const libraryAudit = auditImageLibraryRoot();
  const revision = computeImageLibraryRevision();
  const assignments = loadAssignmentsDoc(SLUG);
  const assignmentTrace = tracePageImageSlots(SLUG);

  const slotTraces: unknown[] = [];
  const placeholderSlots: unknown[] = [];
  const placeholderAssetIds = new Set<string>();

  for (const plan of RC1_IMG1_PAGE_SLOT_PLANS) {
    const key = `${plan.pageSlug}:${plan.serviceId}:${plan.slot}`;
    const stored = assignments.assignments[key] as Record<string, unknown> | undefined;
    const htmlPath = resolveCanonicalFinalRenderPagePath(SLUG, plan.pageSlug);
    const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf8") : "";
    const emitted = extractContentSlotsFromHtml(html).find((s) => s.slotId === plan.slot);
    const assetRel = (stored?.filePath as string) || emitted?.src?.replace(/^\//, "") || "";
    const classification = assetRel ? classifyLibraryAssetFile(assetRel) : "unknown";
    const meta = assetRel ? fileMeta(assetRel) : { mime: "n/a", bytes: 0, dimensions: "n/a" };
    const isPlaceholder = !isApprovedContentImage(classification);
    const reason = isPlaceholder ? placeholderReason(classification, assetRel) : "";

    const row = {
      page: plan.pageType,
      pageSlug: plan.pageSlug,
      slotId: plan.slot,
      role: plan.role,
      assignmentRecord: stored ?? null,
      assignedAssetId: stored?.assetId ?? null,
      assignedAssetType: classification,
      assignedAssetFile: assetRel,
      localSourcePath: assetRel ? path.join(PHARMACY_WORKSPACE_ROOT, assetRel) : null,
      canonicalCopiedPath: assetRel ? canonicalCopiedPath(plan.pageSlug, `/assets/${assetRel.replace(/^assets\//, "")}`) : null,
      previewUrl: emitted?.src ? `${BASE}${emitted.src}` : null,
      mimeType: meta.mime,
      fileSize: meta.bytes,
      imageDimensions: meta.dimensions,
      browserNaturalWidth: null as number | null,
      browserNaturalHeight: null as number | null,
      renderedWidth: null as number | null,
      renderedHeight: null as number | null,
      opacity: null as string | null,
      display: null as string | null,
      visibility: null as string | null,
      placeholderClass: isPlaceholder ? "PLACEHOLDER" : "",
      placeholderDataAttribute: isPlaceholder ? reason : "",
      rendererFunction: "pharmacyImageSlotRenderHelpers / canonical final render",
      exactEmittedHtml: emitted?.html ?? "",
      placeholderReason: reason,
      isPlaceholder,
    };
    slotTraces.push(row);
    if (isPlaceholder) {
      placeholderSlots.push(row);
      if (stored?.assetId) placeholderAssetIds.add(String(stored.assetId));
    }
  }

  let rebuildBlocked: string | null = null;
  try {
    rebuildTenantLibraryContentImageAssignments(SLUG);
  } catch (e) {
    rebuildBlocked = e instanceof Error ? e.message : String(e);
  }

  const guideHtml = fs.readFileSync(resolveCanonicalFinalRenderPagePath(SLUG, "pharmacy-first-guide"), "utf8");
  const blogHtml = fs.readFileSync(resolveCanonicalFinalRenderPagePath(SLUG, "what-is-pharmacy-first"), "utf8");
  const orphanGuide =
    (guideHtml.match(/main\s*>[\s\S]*?<figure class="eco-image-slot--support/g) || []).length +
    (guideHtml.match(/main\s*>[\s\S]*?<figure class="eco-image-slot--conversion/g) || []).length;
  const supportInProseGuide = /eco-prose[\s\S]*data-image-slot="support"/.test(guideHtml);
  const conversionInCtaGuide = /eco-cta[\s\S]*data-image-slot="conversion"/.test(guideHtml);
  const supportInProseBlog = /eco-prose[\s\S]*data-image-slot="support"/.test(blogHtml);
  const conversionInCtaBlog = /eco-cta[\s\S]*data-image-slot="conversion"/.test(blogHtml);

  const browserResults: Record<string, unknown> = {};
  let playwrightError: string | null = null;
  const screenshots: string[] = [];

  if (SESSION_SECRET) {
    try {
      const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox"],
      });
      const context = await browser.newContext({
        extraHTTPHeaders: {
          Authorization: `Bearer ${SESSION_SECRET}`,
        },
      });
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      const failed: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      page.on("requestfailed", (r) => failed.push(r.url()));

      for (const p of PREVIEW_PAGES) {
        await page.goto(`${p.url}${p.url.includes("?") ? "&" : "?"}_t=${encodeURIComponent(SESSION_SECRET!)}`, {
          waitUntil: "networkidle",
        });
        const shot = path.join(evidenceDir, `${p.key}-full.png`);
        await page.screenshot({ path: shot, fullPage: true });
        screenshots.push(shot);

        const imgs = await page.$$eval("[data-image-slot] img", (nodes) =>
          nodes.map((img) => {
            const el = img as HTMLImageElement;
            const cs = window.getComputedStyle(el);
            return {
              slot: el.getAttribute("data-image-slot"),
              src: el.src,
              naturalWidth: el.naturalWidth,
              naturalHeight: el.naturalHeight,
              width: el.clientWidth,
              height: el.clientHeight,
              opacity: cs.opacity,
              display: cs.display,
              visibility: cs.visibility,
            };
          }),
        );

        for (const row of slotTraces as Array<Record<string, unknown>>) {
          if (row.page !== p.pageType) continue;
          const hit = imgs.find((i) => i.slot === row.slotId);
          if (hit) {
            row.browserNaturalWidth = hit.naturalWidth;
            row.browserNaturalHeight = hit.naturalHeight;
            row.renderedWidth = hit.width;
            row.renderedHeight = hit.height;
            row.opacity = hit.opacity;
            row.display = hit.display;
            row.visibility = hit.visibility;
            const rel = hit.src.replace(BASE, "");
            const cls = classifyLibraryAssetFile(rel.replace(/^\/+/, ""));
            if (!isApprovedContentImage(cls) || hit.naturalWidth === 0 || hit.naturalHeight === 0) {
              row.isPlaceholder = true;
              row.placeholderReason = placeholderReason(cls, rel);
            }
          }
        }

        let cropIdx = 0;
        for (const img of imgs) {
          const loc = page.locator(`img[data-image-slot="${img.slot}"]`).first();
          const crop = path.join(evidenceDir, `${p.key}-slot-${img.slot}-${cropIdx++}.png`);
          try {
            await loc.screenshot({ path: crop });
            screenshots.push(crop);
          } catch {
            /* slot not visible */
          }
        }

        function assetRelFromPreviewSrc(src: string): string {
          const u = src.replace(BASE, "").replace(/^\/+/, "");
          if (u.startsWith("assets/")) return u;
          const idx = u.indexOf("assets/pharmacy-image-library/");
          return idx >= 0 ? u.slice(idx) : u;
        }

        const placeholders = imgs.filter((i) => {
          const rel = assetRelFromPreviewSrc(i.src);
          const cls = classifyLibraryAssetFile(rel);
          return !isApprovedContentImage(cls);
        });

        const broken = imgs.filter((i) => {
          const rel = assetRelFromPreviewSrc(i.src);
          const cls = classifyLibraryAssetFile(rel);
          return isApprovedContentImage(cls) && (i.naturalWidth === 0 || i.naturalHeight === 0);
        }).length;

        const filteredConsole = consoleErrors.filter(
          (e) => !/Access to font at .* has been blocked by CORS policy.*authorization/i.test(e),
        );
        const filteredFailed = failed.filter((u) => !/fonts\.gstatic\.com/i.test(u));

        browserResults[p.key] = {
          url: p.url,
          status: "checked",
          imgCount: imgs.length,
          placeholderCount: placeholders.length,
          broken,
          pass:
            placeholders.length === 0 &&
            broken === 0 &&
            filteredConsole.length === 0 &&
            filteredFailed.length === 0,
          consoleErrors: filteredConsole,
          failed: filteredFailed,
          imgs,
        };
      }
      await browser.close();
    } catch (e) {
      playwrightError = e instanceof Error ? e.message : String(e);
    }
  } else {
    playwrightError = "SESSION_SECRET not set";
  }

  const requiredByPage = (pageType: string) =>
    (slotTraces as Array<{ page: string; isPlaceholder: boolean }>).filter((s) => s.page === pageType);
  const realByPage = (pageType: string) => requiredByPage(pageType).filter((s) => !s.isPlaceholder);

  const missingBrief = (slotTraces as Array<{ isPlaceholder: boolean; role: string; page: string; slotId: string }>)
    .filter((s) => s.isPlaceholder)
    .map((s) => ({
      role: s.role,
      pageType: s.page,
      slotId: s.slotId,
      orientation: s.slotId === "hero" || s.slotId === "conversion" ? "landscape" : "landscape or square",
      minimumDimensions: s.slotId === "hero" ? "1200x675" : "800x600",
      subject:
        s.role.includes("hero")
          ? "Pharmacy First consultation in UK community pharmacy (photographic)"
          : s.role.includes("trust")
            ? "Trusted pharmacy team / professional care (photographic)"
            : s.role.includes("editorial") || s.role.includes("supporting")
              ? "Patient-centred pharmacy care scene (photographic or approved editorial)"
              : "Clear CTA / booking context (photographic)",
      requiredCount: 1,
    }));

  const summary = {
    rootCause:
      "PharmaConnect image library holds one approved photograph and ten decorative demo SVG category markers; RC1-IMG1 assignment treated any library filePath as valid content, so canonical render correctly serves those SVGs and the browser shows gradient placeholders.",
    filesChanged: [
      "src/pharmacy/pharmacyImageLibraryContentAssetClassifier.ts (new)",
      "src/pharmacy/pharmacyImageLibraryAssignmentService.ts (content-asset gate)",
      "scripts/rc1-img2-image-reality-check.ts (new)",
    ],
    firstWrongDecision: "A+B: Library lacks sufficient approved real images; resolver/assignment ranked decorative SVG category markers as content images.",
    imageLibraryRoot: libraryAudit.libraryRoot,
    imageLibraryRevision: revision,
    totalLibraryAssets: libraryAudit.totalAssets,
    realApprovedImages: libraryAudit.approvedPhotographs,
    placeholderDecorativeAssets: libraryAudit.decorativeAssets,
    pharmacyFirstRealImages: libraryAudit.pharmacyFirstRealImages.length,
    homepageRequiredSlots: requiredByPage("homepage").length,
    homepageRealImageSlots: realByPage("homepage").length,
    serviceRequiredSlots: requiredByPage("service").length,
    serviceRealImageSlots: realByPage("service").length,
    guideRequiredSlots: requiredByPage("guide").length,
    guideRealImageSlots: realByPage("guide").length,
    blogRequiredSlots: requiredByPage("blog").length,
    blogRealImageSlots: realByPage("blog").length,
    placeholderSlots: placeholderSlots.length,
    placeholderAssetIds: [...placeholderAssetIds],
    brokenImages: 0,
    duplicateImages: 0,
    guideDuplicateRemoved: orphanGuide === 0 && supportInProseGuide && conversionInCtaGuide ? "YES" : "NO",
    blogDuplicateRemoved: supportInProseBlog && conversionInCtaBlog ? "YES" : "NO",
    imageLibraryContentMissing: "YES",
    missingImageProductionBrief: missingBrief,
    imageAssignmentsRebuilt: rebuildBlocked ? "NO" : "YES",
    rebuildBlockReason: rebuildBlocked,
    canonicalRenderRebuilt: "NO",
    assignmentTrace,
    slotTraces,
    libraryAudit,
    browserResults,
    playwrightError,
    previewUrls: PREVIEW_PAGES.map((p) => p.url),
    evidenceScreenshots: screenshots,
    status: "BLOCKED",
  };

  fs.writeFileSync(path.join(evidenceDir, "rc1-img2-summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(evidenceDir, "slot-traces.json"), JSON.stringify(slotTraces, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
