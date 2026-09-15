#!/usr/bin/env npx tsx
/**
 * Campaign Content Quality Fix V1 — validates clean titles, labels, and structure.
 */
import fs from "node:fs";
import path from "node:path";
import { buildReviewCentreView } from "../src/pharmacy/growthEngineReviewCentreService.ts";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const ROOT = process.cwd();
const slug = process.argv[2] || "pharmacy-delivered-4u-test";
const campaignId = process.argv[3] || "pharmacy-first";
const outputRoot = path.join(ROOT, "output/pharmacy-content-ecosystem", slug, campaignId);
const visualPath = path.join(ROOT, "output/pharmacy-visual-experience", slug, campaignId, "index.html");
const packagePath = path.join(ROOT, "data/pharmacy-content-packages", slug, `${campaignId}.json`);
const ecosystemIndexPath = path.join(outputRoot, "_ecosystem-index.json");
const forbiddenDemo = /Brook Pharmacy|Rowlands Pharmacy|DHM Digital|pharmacy\.inboxingproweb\.com|demo pharmacy/i;
const rawLabels =
  /Description:|Typical symptoms:|When Pharmacy First is appropriate:|When GP referral is required:|When urgent care is required:|###|SOCIAL CONTENT LIBRARY|BLOG CONTENT LIBRARY|EMAIL CONTENT LIBRARY|VIDEO CONTENT LIBRARY|Master §|source"\s*:|source:\s/i;

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} - ${detail}`);
}

function read(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || []).length;
}

function titleFromHtml(html: string, fallback: string): string {
  return html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || fallback;
}

function allGeneratedText(): Array<{ file: string; text: string }> {
  const index = JSON.parse(read(ecosystemIndexPath)) as { assets: Array<{ outputPath: string }> };
  const files = new Set<string>([visualPath, packagePath, ecosystemIndexPath]);
  for (const asset of index.assets || []) files.add(asset.outputPath);
  return [...files].filter((file) => fs.existsSync(file)).map((file) => ({ file, text: read(file) }));
}

function socialPosts(): Array<{ id: number; text: string }> {
  const json = JSON.parse(read(path.join(outputRoot, "packs/social-posts.json"))) as { posts: Array<{ id: number; text: string }> };
  return json.posts || [];
}

function gbpPosts(): Array<{ id: number; title: string; body: string }> {
  const json = JSON.parse(read(path.join(outputRoot, "packs/gbp-posts.json"))) as { posts: Array<{ id: number; title: string; body: string }> };
  return json.posts || [];
}

function emails(): Array<{ id: number; subject: string; body: string }> {
  const json = JSON.parse(read(path.join(outputRoot, "packs/email-sequence.json"))) as { emails: Array<{ id: number; subject: string; body: string }> };
  return json.emails || [];
}

function cardBodiesOverLimit(html: string, maxWords: number): string[] {
  return [...html.matchAll(/<p class="card-body">([\s\S]*?)<\/p>/gi)]
    .map((match, index) => ({ index: index + 1, words: wordCount(stripHtml(match[1] || "")) }))
    .filter((item) => item.words > maxWords)
    .map((item) => `card ${item.index}: ${item.words} words`);
}

function sectionsOverLimit(html: string, maxWords: number): string[] {
  return [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)]
    .map((match, index) => {
      const section = match[0];
      const title =
        section.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ||
        section.match(/data-template-block="([^"]+)"/i)?.[1] ||
        `section ${index + 1}`;
      return { title, words: wordCount(stripHtml(section)) };
    })
    .filter((section) => section.words > maxWords)
    .map((section) => `${section.title}: ${section.words} words`);
}

function naturalTitle(title: string): boolean {
  return Boolean(title) && !/pack$|email-sequence|social-pack|gbp-pack|assets|library|Description:|###|Master §/i.test(title);
}

function main(): void {
  if (!fs.existsSync(ecosystemIndexPath)) throw new Error(`Missing ecosystem index: ${ecosystemIndexPath}`);
  const generated = allGeneratedText();

  const rawHits = generated
    .map(({ file, text }) => ({ file, hit: text.match(rawLabels)?.[0] }))
    .filter((item) => item.hit);
  record("no raw labels", rawHits.length === 0, rawHits.length ? rawHits.map((h) => `${h.hit} in ${h.file}`).join("; ") : "clean");

  const demoHits = generated.filter(({ text }) => forbiddenDemo.test(text));
  record("no demo leakage", demoHits.length === 0, demoHits.length ? demoHits.map((h) => h.file).join("; ") : "clean");

  const visualHtml = read(visualPath);
  const serviceTitle = titleFromHtml(visualHtml, "");
  record("service page title customer-facing", naturalTitle(serviceTitle) && /Pharmacy First/i.test(serviceTitle), serviceTitle);

  const longSections = sectionsOverLimit(visualHtml, 900);
  const longCards = cardBodiesOverLimit(visualHtml, 150);
  record("service page sections not excessive", longSections.length === 0 && longCards.length === 0, [...longSections, ...longCards].join("; ") || "balanced");

  const socialLong = socialPosts().filter((post) => post.text.length > 280 || rawLabels.test(post.text));
  record("social posts platform-ready", socialLong.length === 0, socialLong.length ? socialLong.map((p) => `#${p.id}`).join(", ") : `${socialPosts().length} clean posts`);

  const gbpLong = gbpPosts().filter((post) => post.body.length > 250 || !naturalTitle(post.title) || rawLabels.test(`${post.title} ${post.body}`));
  record("GBP posts concise with clean titles", gbpLong.length === 0, gbpLong.length ? gbpLong.map((p) => `#${p.id}`).join(", ") : `${gbpPosts().length} clean posts`);

  const emailLong = emails().filter((email) => wordCount(`${email.subject} ${email.body}`) > 450 || !naturalTitle(email.subject) || rawLabels.test(`${email.subject} ${email.body}`));
  record("emails readable with clean subjects", emailLong.length === 0, emailLong.length ? emailLong.map((e) => `#${e.id}`).join(", ") : `${emails().length} clean emails`);

  const pkg = JSON.parse(read(packagePath)) as { assets: Array<{ title: string }> };
  const badManifestTitles = (pkg.assets || []).filter((asset) => !naturalTitle(asset.title));
  record("manifest titles customer-facing", badManifestTitles.length === 0, badManifestTitles.map((a) => a.title).join(", ") || "clean");

  const view = buildReviewCentreView(slug, campaignId);
  const cardAssets = view?.groups.flatMap((group) => group.assets) || [];
  const badCards = cardAssets.filter((asset) => !naturalTitle(asset.title) || !asset.summary || rawLabels.test(`${asset.title} ${asset.summary} ${asset.typeLabel} ${asset.statusLabel}`));
  record("review cards have clean title summary type status", badCards.length === 0, badCards.map((a) => a.title).join(", ") || `${cardAssets.length} clean cards`);

  const reviewHtml = renderReviewCentrePage(slug, campaignId);
  record(
    "review card HTML exposes summary type status",
    /rc-card-summary/.test(reviewHtml) && /rc-type/.test(reviewHtml) && /rc-status/.test(reviewHtml),
    "summary/type/status markup",
  );

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) process.exit(1);
}

main();
