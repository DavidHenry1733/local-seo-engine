#!/usr/bin/env npx tsx
/**
 * Pharmacy Campaign Image Wiring Micro-Fix V1.
 *
 * Fetches actual Review Centre preview routes and checks page-style image wiring.
 */
import fs from "node:fs";
import path from "node:path";

type Check = {
  id: string;
  pass: boolean;
  detail: string;
};

type Preview = {
  asset: string;
  route: string;
  status: number;
  html: string;
  imageUrls: string[];
  imageStatuses: ImageStatus[];
};

type ImageStatus = {
  url: string;
  absoluteUrl: string;
  status: number | "fetch-error";
  contentType: string;
  ok: boolean;
};

const slug = process.argv[2] || "pharmacy-delivered-4u-test";
const campaignId = process.argv[3] || "pharmacy-first";
const baseUrl = process.env.REVIEW_PREVIEW_BASE_URL || "https://app.pharmaconnect.uk";
const internalToken = process.env.SESSION_SECRET || "dev-fallback-secret-change-in-prod";
const assets = ["service-page", "local-area-pages", "guides", "blog", "faq"] as const;
const placeholder = "Campaign image will be added before publishing.";
const forbiddenImagePath = /(?:seo|trade|trades|roofer|plumb|electric|builder|construction|local-seo|master-stock|industry-images)/i;
const fakeImagePath = /(?:validate|test|placeholder|mock|\.svg(?:$|\?))/i;
const checks: Check[] = [];

function collectUploadImages(dir: string, baseDir = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectUploadImages(fullPath, baseDir));
      continue;
    }
    if (!/\.(png|jpe?g|webp|svg)$/i.test(entry.name)) continue;
    results.push(`assets/pharmacy-uploads/${path.relative(baseDir, fullPath).replace(/\\/g, "/")}`);
  }
  return results.sort();
}

function realUploadImages(): string[] {
  return collectUploadImages(path.join(process.cwd(), "assets/pharmacy-uploads"))
    .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
    .filter((file) => !/(validate|test|placeholder|mock|svg)/i.test(file))
    .sort((a, b) => {
      const aPriority = a.includes("/pharmaconnect/") ? 0 : a.includes("/dhmdigital/") ? 1 : 2;
      const bPriority = b.includes("/pharmaconnect/") ? 0 : b.includes("/dhmdigital/") ? 1 : 2;
      return aPriority - bPriority || a.localeCompare(b);
    });
}

const realImages = realUploadImages();
const directImageUrl = process.env.DIRECT_IMAGE_URL || (realImages[0] ? `${baseUrl.replace(/\/+$/, "")}/${realImages[0]}` : `${baseUrl.replace(/\/+$/, "")}/assets/pharmacy-uploads/`);

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} - ${detail}`);
}

function routeFor(asset: string): string {
  return `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(campaignId)}&asset=${encodeURIComponent(asset)}`;
}

function authedUrl(route: string): string {
  return `${baseUrl}${route}${route.includes("?") ? "&" : "?"}_t=${encodeURIComponent(internalToken)}`;
}

function absoluteUrl(url: string): string {
  return new URL(url, baseUrl).toString();
}

async function fetchImageStatus(url: string): Promise<ImageStatus> {
  const absolute = absoluteUrl(url);
  try {
    const response = await fetch(absolute, { redirect: "manual" });
    const contentType = response.headers.get("content-type") || "";
    return {
      url,
      absoluteUrl: absolute,
      status: response.status,
      contentType,
      ok: response.status === 200 && /^image\//i.test(contentType),
    };
  } catch {
    return {
      url,
      absoluteUrl: absolute,
      status: "fetch-error",
      contentType: "",
      ok: false,
    };
  }
}

function extractImageUrls(html: string): string[] {
  return [
    ...new Set(
      [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)]
        .map((match) => match[1] || "")
        .filter(Boolean),
    ),
  ];
}

function hasBlankImagePanel(html: string): boolean {
  const panels = [...html.matchAll(/<(?:div|figure)\b([^>]*(?:data-image-slot=|data-image-missing="true"|review-preview-image)[^>]*)>([\s\S]*?)<\/(?:div|figure)>/gi)];
  return panels.some((match) => {
    const body = String(match[2] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const hasImage = /<img\b/i.test(String(match[2] || ""));
    return !hasImage && !body.includes(placeholder);
  });
}

function hasValidImageState(preview: Preview): boolean {
  const pharmacyUploadImages = preview.imageUrls.filter((url) => /\/assets\/pharmacy-uploads\/(?:pharmaconnect|dhmdigital)\//i.test(url));
  if (!realImages.length) return pharmacyUploadImages.length === 0 && preview.html.includes(placeholder);
  return pharmacyUploadImages.length > 0 && pharmacyUploadImages.every((url) => /\.(png|jpe?g|webp)(?:$|\?)/i.test(url) && !fakeImagePath.test(url));
}

async function fetchPreview(asset: string): Promise<Preview> {
  const route = routeFor(asset);
  const response = await fetch(authedUrl(route), { redirect: "manual" });
  const html = await response.text();
  const imageUrls = extractImageUrls(html);
  return {
    asset,
    route,
    status: response.status,
    html,
    imageUrls,
    imageStatuses: await Promise.all(imageUrls.map(fetchImageStatus)),
  };
}

async function main(): Promise<void> {
  console.log(`\n=== Pharmacy Campaign Image Wiring V1: ${slug}/${campaignId} ===\n`);
  console.log("Real uploaded pharmacy images:");
  (realImages.length ? realImages : ["none"]).forEach((file) => console.log(`- ${file}`));
  console.log("");

  const directImage = await fetchImageStatus(directImageUrl);
  console.log(`Direct image URL: ${directImage.absoluteUrl} => ${directImage.status} ${directImage.contentType || "(no content-type)"}\n`);

  const previews = await Promise.all(assets.map(fetchPreview));

  for (const preview of previews) {
    console.log(`${preview.asset} image URLs: ${preview.imageUrls.length ? preview.imageUrls.join(", ") : "none"}`);
    for (const image of preview.imageStatuses) {
      console.log(`  ${image.url} => ${image.status} ${image.contentType || "(no content-type)"}`);
    }
  }
  console.log("");

  record("direct image URL returns 200 image MIME", directImage.ok, `${directImage.absoluteUrl} => ${directImage.status} ${directImage.contentType}`);
  record("real image list excludes validation/test/mock/svg files", realImages.every((file) => /\.(png|jpe?g|webp)$/i.test(file) && !fakeImagePath.test(file)), realImages.length ? realImages.join(", ") : "no real images");

  for (const preview of previews) {
    record(`${preview.asset} route returns 200`, preview.status === 200, `${preview.route} => ${preview.status}`);
    record(`${preview.asset} has pharmacy upload image or visible placeholder`, hasValidImageState(preview), preview.imageUrls.length ? preview.imageUrls.join(", ") : "placeholder expected");
    record(`${preview.asset} image URLs return 200 image MIME`, preview.imageStatuses.every((image) => image.ok), preview.imageStatuses.length ? preview.imageStatuses.map((image) => `${image.url} => ${image.status} ${image.contentType}`).join("; ") : "no image URLs");
    record(`${preview.asset} preview contains working image URL`, preview.imageStatuses.every((image) => preview.html.includes(image.url)), preview.imageStatuses.length ? preview.imageStatuses.map((image) => image.url).join(", ") : "no image URLs");
    record(`${preview.asset} does not use validation/test/mock/svg image`, preview.imageUrls.every((url) => !fakeImagePath.test(url)), preview.imageUrls.length ? preview.imageUrls.join(", ") : "placeholder only");
    record(`${preview.asset} uses real bitmap only when available`, realImages.length ? preview.imageUrls.some((url) => /\.(png|jpe?g|webp)(?:$|\?)/i.test(url)) : preview.html.includes(placeholder), realImages.length ? "real PNG/JPG/WEBP expected" : "placeholder expected");
    record(`${preview.asset} has no blank image panel`, !hasBlankImagePanel(preview.html), "blank panels absent");
    record(`${preview.asset} has no SEO/trade image path`, preview.imageUrls.every((url) => !forbiddenImagePath.test(url)), preview.imageUrls.length ? preview.imageUrls.join(", ") : "no image URLs");
  }

  const directImagePath = new URL(directImageUrl).pathname;
  const directImagePreview = previews.find((preview) =>
    preview.html.includes(directImageUrl) || preview.html.includes(directImagePath),
  );
  record("browser preview uses exact direct image URL", Boolean(directImagePreview), directImagePreview ? `${directImagePreview.asset} contains ${directImageUrl}` : `${directImageUrl} missing from previews`);

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
