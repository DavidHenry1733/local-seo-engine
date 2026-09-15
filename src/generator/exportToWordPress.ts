import fs from "node:fs";
import path from "node:path";
import { PagePlanItem, PagePayload, ProjectConfig, ImageAssignment } from "./types";
import { buildPagePayload } from "./buildPagePayload";
import { renderPage } from "./renderPage";
import { uploadImageToWordPress } from "../local-seo/uploadImageToWordPress";

type WpConfig = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  status?: "draft" | "publish" | "private" | "pending";
};

export type WpExportResult = {
  slug: string;
  action: "created" | "updated" | "skipped";
  pageId?: number;
  link?: string;
  reason?: string;
};

type ImageDebugEntry = {
  sourceFile: string;
  mediaId: number;
  sourceUrl: string;
};

function auth(cfg: WpConfig): string {
  return "Basic " + Buffer.from(`${cfg.username}:${cfg.applicationPassword}`).toString("base64");
}

async function findPage(base: string, token: string, slug: string): Promise<number | null> {
  const url = `${base}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&status=any&per_page=1`;
  const res = await fetch(url, { headers: { Authorization: token } });
  if (!res.ok) throw new Error(`WP search failed: ${res.status} ${res.statusText}`);
  const pages = await res.json() as Array<{ id: number }>;
  return pages.length ? pages[0].id : null;
}

async function uploadAndResolveImages(
  projectRoot: string,
  logSlug: string,
  pageSlug: string,
  images: ImageAssignment,
  h1: string
): Promise<{
  resolved: ImageAssignment;
  debug: Record<keyof ImageAssignment, ImageDebugEntry>;
}> {
  const scenes: Array<keyof ImageAssignment> = ["hero", "support", "trust", "conversion"];
  const resolved = { ...images };
  const debug = {} as Record<keyof ImageAssignment, ImageDebugEntry>;

  for (const scene of scenes) {
    const sourceFile = images[scene];
    const absolutePath = path.join(projectRoot, sourceFile);
    const ext = path.extname(sourceFile);
    const uploadFilename = `${pageSlug}-${scene}${ext}`;
    const altText = `${h1} — ${scene}`;

    const uploaded = await uploadImageToWordPress(
      projectRoot,
      logSlug,
      absolutePath,
      altText,
      scene,
      uploadFilename
    );

    resolved[scene] = uploaded.sourceUrl;
    debug[scene] = {
      sourceFile,
      mediaId: uploaded.mediaId,
      sourceUrl: uploaded.sourceUrl,
    };
  }

  return { resolved, debug };
}

export async function exportPageToWordPress(
  projectRoot: string,
  project: ProjectConfig,
  page: PagePlanItem,
  allPages: PagePlanItem[],
  printDebug = false,
  outputSubdir?: string
): Promise<{ result: WpExportResult; html: string; payload: PagePayload }> {
  const cfgPath = path.join(projectRoot, "input", "wordpress.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8")) as WpConfig;

  const base     = cfg.siteUrl.replace(/\/+$/, "");
  const token    = auth(cfg);
  const status   = cfg.status ?? "draft";
  const endpoint = `${base}/wp-json/wp/v2/pages`;

  // STEP 1: Build payload — images hold local file paths at this point
  const payload = buildPagePayload(project, page, allPages);

  // logSlug controls where upload log files are written; use nested path when available
  const logSlug = outputSubdir ?? page.slug;

  // STEP 2: Upload images, store WP media URLs alongside original paths for debug
  const { resolved, debug } = await uploadAndResolveImages(
    projectRoot,
    logSlug,
    page.slug,
    payload.images,
    payload.h1
  );

  // STEP 3: Replace local paths in payload with uploaded WP media URLs
  payload.images = resolved;

  // STEP 4: Debug summary — first page only
  if (printDebug) {
    console.log("\nIMAGE DEBUG SUMMARY");
    console.log(JSON.stringify(debug, null, 2));
  }

  // STEP 5: Render HTML in wordpress mode — no H1, no outer document shell,
  //         reduced hero spacing, schema + scoped styles injected inline
  const html = renderPage(project, page, payload, "wordpress");

  // STEP 6: Publish to WordPress
  const existingId = await findPage(base, token, page.slug);
  const isUpdate   = existingId !== null;
  const url        = isUpdate ? `${endpoint}/${existingId}` : endpoint;

  const res = await fetch(url, {
    method:  "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body:    JSON.stringify({ title: payload.title, slug: page.slug, content: html, status }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WP export failed for "${page.slug}": ${res.status} ${res.statusText}\n${text}`);
  }

  const data = await res.json() as { id: number; link: string };

  return {
    result: {
      slug:   page.slug,
      action: isUpdate ? "updated" : "created",
      pageId: data.id,
      link:   data.link,
    },
    html,
    payload,
  };
}
