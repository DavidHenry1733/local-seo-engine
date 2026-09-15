#!/usr/bin/env npx tsx
/**
 * Professional Review Block Micro-Fix V1.
 *
 * Fetches the actual browser preview routes and checks only the review blocks.
 */

type Check = {
  id: string;
  pass: boolean;
  detail: string;
};

const slug = process.argv[2] || "pharmacy-delivered-4u-test";
const campaignId = process.argv[3] || "pharmacy-first";
const baseUrl = process.env.REVIEW_PREVIEW_BASE_URL || "http://127.0.0.1:3001";
const internalToken = process.env.SESSION_SECRET || "dev-fallback-secret-change-in-prod";

const pageAssets = ["service-page", "local-area-pages", "guides", "blog", "faq"] as const;
const packAssets = ["social", "gbp", "email"] as const;
const allAssets = [...pageAssets, ...packAssets];

const forbidden = /Professional review details available from the pharmacy|holds\s*\[\]|raw placeholder text|empty credentials/i;
const checks: Check[] = [];

function routeFor(asset: string): string {
  return `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(campaignId)}&asset=${encodeURIComponent(asset)}`;
}

function authedUrl(route: string): string {
  return `${baseUrl}${route}${route.includes("?") ? "&" : "?"}_t=${encodeURIComponent(internalToken)}`;
}

function textOnly(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} - ${detail}`);
}

async function fetchPreview(asset: string): Promise<{ asset: string; route: string; status: number; html: string; text: string }> {
  const route = routeFor(asset);
  const response = await fetch(authedUrl(route), { redirect: "manual" });
  const html = await response.text();
  return { asset, route, status: response.status, html, text: textOnly(html) };
}

async function main(): Promise<void> {
  console.log(`\n=== Professional Review Block Micro-Fix V1: ${slug}/${campaignId} ===\n`);

  const previews = await Promise.all(allAssets.map(fetchPreview));

  for (const preview of previews) {
    record(`${preview.asset} route returns 200`, preview.status === 200, `${preview.route} => ${preview.status}`);
  }

  for (const asset of pageAssets) {
    const preview = previews.find((item) => item.asset === asset)!;
    const hasLeak =
      preview.text.includes("registration details can be added") ||
      preview.text.includes("Reviewed by the pharmacy team") ||
      /Professionally reviewed by/i.test(preview.text);
    record(`${asset} omits unfinished professional-review fallback`, !hasLeak, "no missing-data professional-review copy");
  }

  for (const asset of packAssets) {
    const preview = previews.find((item) => item.asset === asset)!;
    record(`${asset} has pack review note`, preview.text.includes("Content prepared for pharmacy team review"), "pack review note");
  }

  for (const preview of previews) {
    record(`${preview.asset} has no forbidden review placeholder`, !forbidden.test(preview.text), "old placeholder credentials absent");
  }

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
