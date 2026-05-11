import fs from "fs";
import path from "path";

export type Placement = "below_h1" | "beside_intro" | "after_section" | "above_cta";

export type MultiImageAsset = {
  scene: string;
  sourceUrl: string;
  altText: string;
  titleText?: string;
  caption?: string;
  placement: Placement;
};

export function buildImageBlock(asset: MultiImageAsset): string {
  const imgTag = `<img src="${asset.sourceUrl}" alt="${asset.altText}"${asset.titleText ? ` title="${asset.titleText}"` : ""} />`;
  const captionTag = asset.caption ? `\n  <figcaption>${asset.caption}</figcaption>` : "";
  return `<figure class="generated-page-image generated-page-image--${asset.scene}">\n  ${imgTag}${captionTag}\n</figure>`;
}

// ─── Position-based insertion (fallback for pages without markers) ────────────

function findNthH2Position(html: string, n: number): number {
  let count = 0;
  let pos = 0;
  while (pos < html.length) {
    const idx = html.indexOf("<h2", pos);
    if (idx === -1) break;
    count++;
    if (count === n) return idx;
    pos = idx + 1;
  }
  return -1;
}

function findLastH2Position(html: string): number {
  let lastPos = -1;
  let pos = 0;
  while (pos < html.length) {
    const idx = html.indexOf("<h2", pos);
    if (idx === -1) break;
    lastPos = idx;
    pos = idx + 1;
  }
  return lastPos;
}

function insertBelowH1(html: string, block: string): string {
  const closeIdx = html.indexOf("</h1>");
  if (closeIdx !== -1) {
    const pos = closeIdx + "</h1>".length;
    return `${html.slice(0, pos)}\n\n${block}\n\n${html.slice(pos)}`;
  }
  return `${block}\n\n${html}`;
}

function insertBeforeNthH2(html: string, n: number, block: string): string {
  const h2Pos = findNthH2Position(html, n);
  if (h2Pos === -1) return `${html}\n\n${block}`;
  return `${html.slice(0, h2Pos)}${block}\n\n${html.slice(h2Pos)}`;
}

function insertAboveCta(html: string, block: string): string {
  const lastH2Pos = findLastH2Position(html);
  if (lastH2Pos === -1) return `${html}\n\n${block}`;
  return `${html.slice(0, lastH2Pos)}${block}\n\n${html.slice(lastH2Pos)}`;
}

function insertByPlacement(html: string, block: string, placement: Placement): string {
  switch (placement) {
    case "below_h1":     return insertBelowH1(html, block);
    case "beside_intro": return insertBeforeNthH2(html, 2, block);
    case "after_section":return insertBeforeNthH2(html, 3, block);
    case "above_cta":    return insertAboveCta(html, block);
    default:             return insertBeforeNthH2(html, 2, block);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function injectAllImages(
  projectRoot: string,
  slug: string,
  assets: MultiImageAsset[]
): void {
  const htmlPath = path.join(projectRoot, "output", slug, "page.html");
  let html = fs.readFileSync(htmlPath, "utf-8");

  // Process in reverse placement order so bottom insertions don't shift earlier positions
  const PLACEMENT_ORDER: Placement[] = ["below_h1", "beside_intro", "after_section", "above_cta"];
  const ordered = [...assets].sort(
    (a, b) => PLACEMENT_ORDER.indexOf(b.placement) - PLACEMENT_ORDER.indexOf(a.placement)
  );

  for (const asset of ordered) {
    const block = buildImageBlock(asset);
    const sceneClass = `generated-page-image--${asset.scene}`;
    const existingBlockRegex = new RegExp(
      `<figure class="generated-page-image ${sceneClass}">[\\s\\S]*?<\\/figure>`
    );
    const marker = `<!-- IMAGE:${asset.scene} -->`;

    if (existingBlockRegex.test(html)) {
      html = html.replace(existingBlockRegex, block);
      console.log(`    [replace] ${asset.scene} → existing figure block`);
    } else if (html.includes(marker)) {
      html = html.replace(marker, block);
      console.log(`    [marker]  ${asset.scene} → ${marker}`);
    } else {
      html = insertByPlacement(html, block, asset.placement);
      console.log(`    [insert]  ${asset.scene} → ${asset.placement} (position-based)`);
    }
  }

  fs.writeFileSync(htmlPath, html, "utf-8");
}
