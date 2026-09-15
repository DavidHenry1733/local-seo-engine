import fs from "node:fs";
import path from "node:path";

import type {
  AssetEnvelope,
  AssetStatus,
  AssetType,
  CampaignContentManifest,
  StatusCounts,
} from "./types";

const VALID_STATUSES: AssetStatus[] = [
  "draft",
  "generated",
  "reviewed",
  "approved",
  "published",
  "rejected",
];

const EXPORT_DIR_BY_TYPE: Record<AssetType, string> = {
  blog_post: "blog",
  facebook_post: "facebook",
  linkedin_post: "linkedin",
  gbp_post: "gbp",
  reddit_post: "reddit",
  youtube_script: "youtube",
  youtube_metadata: "youtube",
  email_sequence: "email",
};

export interface ContentCampaignSummary {
  campaignId: string;
  projectSlug: string;
  service: string;
  location: string;
  generatedAt: string;
  updatedAt: string;
  summary: CampaignContentManifest["summary"];
}

export interface AssetListItem {
  assetId: string;
  assetType: AssetType;
  status: AssetStatus;
  title: string;
  updatedAt: string;
  revision: number;
}

export interface AssetPreview {
  assetId: string;
  assetType: AssetType;
  status: AssetStatus;
  previewKind: "blog" | "social" | "youtube" | "email";
  title: string;
  html?: string;
  markdown?: string;
  card?: Record<string, unknown>;
  raw: AssetEnvelope;
}

function emptyStatusCounts(): StatusCounts {
  return { draft: 0, generated: 0, reviewed: 0, approved: 0, published: 0, rejected: 0 };
}

function campaignRoot(outputDir: string, projectSlug: string, campaignId: string): string {
  return path.join(process.cwd(), outputDir, projectSlug, "campaign-content", campaignId);
}

function manifestPath(root: string): string {
  return path.join(root, "campaignContent.json");
}

function assetPath(root: string, assetId: string): string {
  return path.join(root, "assets", `${assetId}.json`);
}

function historyDir(root: string): string {
  return path.join(root, "history");
}

function exportsDir(root: string): string {
  return path.join(root, "exports");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function assetTitle(asset: AssetEnvelope): string {
  const p = asset.payload;
  return (
    (p.title as string) ??
    (p.h1 as string) ??
    (p.sequenceName as string) ??
    (p.postText as string)?.slice(0, 60) ??
    asset.assetId
  );
}

function recalcManifestSummary(manifest: CampaignContentManifest, assets: AssetEnvelope[]): void {
  const byStatus = emptyStatusCounts();
  const byType: Partial<Record<AssetType, number>> = {};
  for (const asset of assets) {
    byStatus[asset.status]++;
    byType[asset.assetType] = (byType[asset.assetType] ?? 0) + 1;
  }
  manifest.summary = { total: assets.length, byStatus, byType };
}

function loadAllAssets(root: string, manifest: CampaignContentManifest): AssetEnvelope[] {
  return manifest.assetIndex.map((id) => readJson<AssetEnvelope>(assetPath(root, id)));
}

function saveManifest(root: string, manifest: CampaignContentManifest, assets: AssetEnvelope[]): void {
  recalcManifestSummary(manifest, assets);
  manifest.updatedAt = new Date().toISOString();
  writeJson(manifestPath(root), manifest);
}

function assertTransition(current: AssetStatus, allowedFrom: AssetStatus[]): void {
  if (!allowedFrom.includes(current)) {
    throw new Error(`Invalid status transition from "${current}" (allowed from: ${allowedFrom.join(", ")})`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    const h3 = trimmed.match(/^### (.+)$/);
    const h2 = trimmed.match(/^## (.+)$/);
    const h1 = trimmed.match(/^# (.+)$/);
    const li = trimmed.match(/^- (.+)$/);
    if (h1) {
      closeList();
      out.push(`<h1>${inlineMd(h1[1])}</h1>`);
    } else if (h2) {
      closeList();
      out.push(`<h2>${inlineMd(h2[1])}</h2>`);
    } else if (h3) {
      closeList();
      out.push(`<h3>${inlineMd(h3[1])}</h3>`);
    } else if (li) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inlineMd(li[1])}</li>`);
    } else {
      closeList();
      out.push(`<p>${inlineMd(trimmed)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

function inlineMd(text: string): string {
  return escapeHtml(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export function listContentCampaigns(projectSlug: string, outputDir = "output"): ContentCampaignSummary[] {
  const base = path.join(process.cwd(), outputDir, projectSlug, "campaign-content");
  if (!fs.existsSync(base)) return [];
  const results: ContentCampaignSummary[] = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const mp = path.join(base, entry.name, "campaignContent.json");
    if (!fs.existsSync(mp)) continue;
    const manifest = readJson<CampaignContentManifest>(mp);
    results.push({
      campaignId: manifest.campaignId,
      projectSlug: manifest.projectSlug,
      service: manifest.service,
      location: manifest.location,
      generatedAt: manifest.generatedAt,
      updatedAt: manifest.updatedAt,
      summary: manifest.summary,
    });
  }
  return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadCampaignManifest(
  projectSlug: string,
  campaignId: string,
  outputDir = "output",
): { root: string; manifest: CampaignContentManifest } {
  const root = campaignRoot(outputDir, projectSlug, campaignId);
  const mp = manifestPath(root);
  if (!fs.existsSync(mp)) throw new Error(`Campaign content not found: ${campaignId}`);
  return { root, manifest: readJson<CampaignContentManifest>(mp) };
}

export function listCampaignAssets(
  projectSlug: string,
  campaignId: string,
  outputDir = "output",
): AssetListItem[] {
  const { root, manifest } = loadCampaignManifest(projectSlug, campaignId, outputDir);
  return loadAllAssets(root, manifest).map((asset) => ({
    assetId: asset.assetId,
    assetType: asset.assetType,
    status: asset.status,
    title: assetTitle(asset),
    updatedAt: asset.editedAt ?? asset.sourceGeneration.generatedAt,
    revision: asset.revision ?? 0,
  }));
}

export function loadAsset(
  projectSlug: string,
  campaignId: string,
  assetId: string,
  outputDir = "output",
): { root: string; manifest: CampaignContentManifest; asset: AssetEnvelope } {
  const { root, manifest } = loadCampaignManifest(projectSlug, campaignId, outputDir);
  const ap = assetPath(root, assetId);
  if (!fs.existsSync(ap)) throw new Error(`Asset not found: ${assetId}`);
  if (!manifest.assetIndex.includes(assetId)) {
    throw new Error(`Asset ${assetId} not indexed in campaign manifest`);
  }
  return { root, manifest, asset: readJson<AssetEnvelope>(ap) };
}

export function buildAssetPreview(asset: AssetEnvelope): AssetPreview {
  const p = asset.payload;
  const title = assetTitle(asset);

  if (asset.assetType === "blog_post") {
    const body = (p.bodyMarkdown as string) ?? "";
    return {
      assetId: asset.assetId,
      assetType: asset.assetType,
      status: asset.status,
      previewKind: "blog",
      title,
      markdown: body,
      html: `<article class="ce-blog-preview">${markdownToHtml(body)}</article>`,
      raw: asset,
    };
  }

  if (asset.assetType === "email_sequence") {
    const emails = (p.emails as Array<{ subject: string; body: string; cta: string; linkedUrl: string }>) ?? [];
    const html = emails
      .map(
        (e, i) =>
          `<section class="ce-email"><h3>Email ${i + 1}: ${escapeHtml(e.subject)}</h3><pre>${escapeHtml(e.body)}</pre><p><strong>CTA:</strong> ${escapeHtml(e.cta)} — <a href="${escapeHtml(e.linkedUrl)}">${escapeHtml(e.linkedUrl)}</a></p></section>`,
      )
      .join("\n");
    return {
      assetId: asset.assetId,
      assetType: asset.assetType,
      status: asset.status,
      previewKind: "email",
      title: (p.sequenceName as string) ?? title,
      html,
      raw: asset,
    };
  }

  if (asset.assetType === "youtube_script" || asset.assetType === "youtube_metadata") {
    return {
      assetId: asset.assetId,
      assetType: asset.assetType,
      status: asset.status,
      previewKind: "youtube",
      title,
      markdown: (p.script as string) ?? (p.description as string) ?? "",
      html: `<pre class="ce-yt-script">${escapeHtml((p.script as string) ?? (p.description as string) ?? "")}</pre>`,
      card: {
        hook: p.hook,
        chapters: p.chapters,
        tags: p.tags,
        cta: p.cta,
        linkedUrl: p.linkedUrl,
      },
      raw: asset,
    };
  }

  return {
    assetId: asset.assetId,
    assetType: asset.assetType,
    status: asset.status,
    previewKind: "social",
    title,
    card: {
      postText: p.postText ?? p.body ?? p.title,
      cta: p.cta,
      hashtags: p.hashtags,
      linkedUrl: p.linkedUrl ?? p.linkedUrlOptional,
      postType: p.postType,
      professionalAngle: p.professionalAngle,
    },
    html: `<div class="ce-social-card"><p>${escapeHtml(String(p.postText ?? p.body ?? p.title ?? ""))}</p></div>`,
    raw: asset,
  };
}

export interface SaveAssetInput {
  payload?: Record<string, unknown>;
  editedBy?: string;
}

export function saveAsset(
  projectSlug: string,
  campaignId: string,
  assetId: string,
  input: SaveAssetInput,
  outputDir = "output",
): AssetEnvelope {
  const { root, manifest, asset } = loadAsset(projectSlug, campaignId, assetId, outputDir);

  const histDir = historyDir(root);
  fs.mkdirSync(histDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(assetPath(root, assetId), path.join(histDir, `${assetId}-${stamp}.json`));

  if (input.payload) {
    asset.payload = { ...asset.payload, ...input.payload };
    if (typeof input.payload.status === "string" && VALID_STATUSES.includes(input.payload.status as AssetStatus)) {
      asset.status = input.payload.status as AssetStatus;
    }
  }

  asset.editedAt = new Date().toISOString();
  asset.editedBy = input.editedBy ?? "unknown";
  asset.revision = (asset.revision ?? 0) + 1;

  if (asset.status === "generated") {
    asset.status = "reviewed";
  }
  if (asset.payload.status) {
    asset.payload.status = asset.status;
  }

  writeJson(assetPath(root, assetId), asset);
  const assets = loadAllAssets(root, manifest);
  saveManifest(root, manifest, assets);
  return asset;
}

function updateAssetStatus(
  projectSlug: string,
  campaignId: string,
  assetId: string,
  newStatus: AssetStatus,
  allowedFrom: AssetStatus[],
  outputDir = "output",
): AssetEnvelope {
  const { root, manifest, asset } = loadAsset(projectSlug, campaignId, assetId, outputDir);
  assertTransition(asset.status, allowedFrom);
  asset.status = newStatus;
  if (asset.payload.status !== undefined) asset.payload.status = newStatus;
  writeJson(assetPath(root, assetId), asset);
  const assets = loadAllAssets(root, manifest);
  saveManifest(root, manifest, assets);
  return asset;
}

export function reviewAsset(
  projectSlug: string,
  campaignId: string,
  assetId: string,
  outputDir = "output",
): AssetEnvelope {
  return updateAssetStatus(projectSlug, campaignId, assetId, "reviewed", ["generated"], outputDir);
}

export function approveAsset(
  projectSlug: string,
  campaignId: string,
  assetId: string,
  outputDir = "output",
): AssetEnvelope {
  return updateAssetStatus(projectSlug, campaignId, assetId, "approved", ["reviewed", "generated"], outputDir);
}

export function rejectAsset(
  projectSlug: string,
  campaignId: string,
  assetId: string,
  outputDir = "output",
): AssetEnvelope {
  return updateAssetStatus(projectSlug, campaignId, assetId, "rejected", ["generated", "reviewed", "approved"], outputDir);
}

function exportAssetFiles(root: string, asset: AssetEnvelope): string[] {
  const dirName = EXPORT_DIR_BY_TYPE[asset.assetType];
  const outDir = path.join(exportsDir(root), dirName);
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, asset.assetId);
  const written: string[] = [];

  writeJson(`${base}.json`, asset);
  written.push(`exports/${dirName}/${asset.assetId}.json`);

  const p = asset.payload;

  if (asset.assetType === "blog_post") {
    const md = (p.bodyMarkdown as string) ?? "";
    fs.writeFileSync(`${base}.md`, md + "\n", "utf8");
    written.push(`exports/${dirName}/${asset.assetId}.md`);
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(String(p.metaTitle ?? p.title ?? ""))}</title><meta name="description" content="${escapeHtml(String(p.metaDescription ?? ""))}"></head><body>${markdownToHtml(md)}</body></html>`;
    fs.writeFileSync(`${base}.html`, html, "utf8");
    written.push(`exports/${dirName}/${asset.assetId}.html`);
  } else if (asset.assetType === "facebook_post" || asset.assetType === "linkedin_post" || asset.assetType === "gbp_post") {
    const text = String(p.postText ?? "");
    fs.writeFileSync(`${base}.md`, text + "\n", "utf8");
    written.push(`exports/${dirName}/${asset.assetId}.md`);
  } else if (asset.assetType === "reddit_post") {
    const md = `# ${p.title}\n\n${p.body ?? ""}\n`;
    fs.writeFileSync(`${base}.md`, md, "utf8");
    written.push(`exports/${dirName}/${asset.assetId}.md`);
  } else if (asset.assetType === "youtube_script" || asset.assetType === "youtube_metadata") {
    const md = String(p.script ?? p.description ?? "");
    fs.writeFileSync(`${base}.md`, md + "\n", "utf8");
    written.push(`exports/${dirName}/${asset.assetId}.md`);
  } else if (asset.assetType === "email_sequence") {
    const emails = (p.emails as Array<{ subject: string; body: string }>) ?? [];
    const md = emails.map((e, i) => `## Email ${i + 1}: ${e.subject}\n\n${e.body}`).join("\n\n---\n\n");
    fs.writeFileSync(`${base}.md`, md + "\n", "utf8");
    written.push(`exports/${dirName}/${asset.assetId}.md`);
  }

  return written;
}

export function publishAsset(
  projectSlug: string,
  campaignId: string,
  assetId: string,
  outputDir = "output",
): { asset: AssetEnvelope; exportPaths: string[] } {
  const { root, manifest, asset } = loadAsset(projectSlug, campaignId, assetId, outputDir);
  assertTransition(asset.status, ["approved"]);
  const exportPaths = exportAssetFiles(root, asset);
  asset.status = "published";
  asset.payload.status = "published";
  asset.publishedAt = new Date().toISOString();
  asset.publishedExportPath = exportPaths[0];
  writeJson(assetPath(root, assetId), asset);
  const assets = loadAllAssets(root, manifest);
  saveManifest(root, manifest, assets);
  return { asset, exportPaths };
}

export { EXPORT_DIR_BY_TYPE, VALID_STATUSES };
