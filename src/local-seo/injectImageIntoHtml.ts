import fs from "fs";
import path from "path";

export type Placement = "below_h1" | "beside_intro" | "after_section" | "above_cta";

const IMAGE_BLOCK_OPEN = `<figure class="generated-page-image">`;
const IMAGE_BLOCK_REGEX = /<figure class="generated-page-image">[\s\S]*?<\/figure>/;

function buildImageBlock(sourceUrl: string, altText: string, titleText?: string, caption?: string): string {
  const imgTag = `<img src="${sourceUrl}" alt="${altText}"${titleText ? ` title="${titleText}"` : ""} />`;
  const captionTag = caption ? `\n<figcaption>${caption}</figcaption>` : "";
  return `${IMAGE_BLOCK_OPEN}\n${imgTag}${captionTag}\n</figure>`;
}

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

function insertAt(html: string, pos: number, block: string): string {
  return `${html.slice(0, pos)}${block}\n\n${html.slice(pos)}`;
}

function insertAfterSection(html: string, sectionIndex: number, block: string): string {
  const nextH2Pos = findNthH2Position(html, sectionIndex + 1);
  if (nextH2Pos === -1) return `${html}\n\n${block}`;
  return insertAt(html, nextH2Pos, block);
}

function insertBelowH1(html: string, block: string): string {
  const h1CloseIdx = html.indexOf("</h1>");
  if (h1CloseIdx !== -1) {
    const insertPos = h1CloseIdx + "</h1>".length;
    return `${html.slice(0, insertPos)}\n\n${block}\n\n${html.slice(insertPos)}`;
  }
  return `${block}\n\n${html}`;
}

function insertAboveCta(html: string, block: string): string {
  const lastH2Pos = findLastH2Position(html);
  if (lastH2Pos === -1) return `${html}\n\n${block}`;
  return insertAt(html, lastH2Pos, block);
}

export function injectImageIntoHtml(
  projectRoot: string,
  slug: string,
  sourceUrl: string,
  altText: string,
  placement: Placement = "beside_intro",
  titleText?: string,
  caption?: string
): void {
  const htmlPath = path.join(projectRoot, "output", slug, "page.html");
  let html = fs.readFileSync(htmlPath, "utf-8");

  const imageBlock = buildImageBlock(sourceUrl, altText, titleText, caption);

  if (IMAGE_BLOCK_REGEX.test(html)) {
    html = html.replace(IMAGE_BLOCK_REGEX, imageBlock);
    console.log(`    Image block replaced in page.html`);
  } else {
    switch (placement) {
      case "below_h1":
        html = insertBelowH1(html, imageBlock);
        break;
      case "beside_intro":
        html = insertAfterSection(html, 1, imageBlock);
        break;
      case "after_section":
        html = insertAfterSection(html, 2, imageBlock);
        break;
      case "above_cta":
        html = insertAboveCta(html, imageBlock);
        break;
      default:
        html = insertAfterSection(html, 1, imageBlock);
    }
    console.log(`    Image block injected into page.html (${placement})`);
  }

  fs.writeFileSync(htmlPath, html, "utf-8");
}
