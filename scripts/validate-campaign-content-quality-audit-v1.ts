#!/usr/bin/env npx tsx
/**
 * Campaign Content Quality Audit V1.
 *
 * Audits generated campaign assets and writes:
 * docs/platform/CAMPAIGN-CONTENT-QUALITY-AUDIT-V1.md
 */
import fs from "node:fs";
import path from "node:path";

type Severity = "critical" | "high" | "medium" | "low";

interface Issue {
  severity: Severity;
  assetId: string;
  message: string;
}

interface AssetAudit {
  id: string;
  group: string;
  filePath: string;
  title: string;
  wordCount: number;
  missingRequiredSections: string[];
  overlyLongSections: string[];
  wrongTitleIssues: string[];
  imageStatus: string;
  tenantContextCorrect: boolean;
  localReferencesPresent: boolean;
  trustCredentialsPresent: boolean;
  customerReady: boolean;
  issues: Issue[];
}

const ROOT = process.cwd();
const slug = process.argv[2] || "pharmacy-delivered-4u-test";
const campaignId = process.argv[3] || "pharmacy-first";
const outputRoot = path.join(ROOT, "output/pharmacy-content-ecosystem", slug, campaignId);
const visualPath = path.join(ROOT, "output/pharmacy-visual-experience", slug, campaignId, "index.html");
const packagePath = path.join(ROOT, "data/pharmacy-content-packages", slug, `${campaignId}.json`);
const ecosystemIndexPath = path.join(outputRoot, "_ecosystem-index.json");
const imageAssignmentsPath = path.join(ROOT, "data/pharmacy-image-assignments", `${slug}.json`);
const reportPath = path.join(ROOT, "docs/platform/CAMPAIGN-CONTENT-QUALITY-AUDIT-V1.md");
const forbidden = /Brook Pharmacy|Rowlands Pharmacy|DHM Digital|pharmacy\.inboxingproweb\.com|demo pharmacy/i;

function read(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || []).length;
}

function titleFromHtml(html: string, fallback: string): string {
  return (
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+\|.*$/, "").trim() ||
    fallback
  );
}

function sourceHasTenant(raw: string): boolean {
  return /Pharmacy Delivered/i.test(raw) && !forbidden.test(raw);
}

function hasLocal(raw: string): boolean {
  return /Rotherham|S60|Wellgate/i.test(raw);
}

function hasTrust(raw: string): boolean {
  return /GPhC|NHS service|NHS Pharmacy|Private consultation|trust|credentials|pharmacy team/i.test(raw);
}

function issue(assetId: string, severity: Severity, message: string): Issue {
  return { assetId, severity, message };
}

function htmlSectionsOverLimit(html: string, maxWords: number): string[] {
  const matches = [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)];
  return matches
    .map((match, index) => {
      const sectionHtml = match[0];
      const heading =
        sectionHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ||
        sectionHtml.match(/data-template-block="([^"]+)"/i)?.[1] ||
        `section ${index + 1}`;
      return { heading, words: wordCount(stripHtml(sectionHtml)) };
    })
    .filter((section) => section.words > maxWords)
    .map((section) => `${section.heading} (${section.words} words)`);
}

function cardTextOverLimit(html: string, maxWords: number): string[] {
  return [...html.matchAll(/<p class="card-body">([\s\S]*?)<\/p>/gi)]
    .map((match, index) => ({ index: index + 1, words: wordCount(stripHtml(match[1] || "")) }))
    .filter((card) => card.words > maxWords)
    .map((card) => `card ${card.index} (${card.words} words)`);
}

function imageStatusForHtml(html: string): string {
  const imgCount = (html.match(/<img\b/gi) || []).length;
  const missing = (html.match(/data-image-missing="true"/gi) || []).length;
  const visiblePlaceholder = /Image will be added before publishing/i.test(html);
  if (imgCount > 0) return `${imgCount} image(s) rendered`;
  if (missing > 0 && visiblePlaceholder) return `${missing} missing image slot(s), visible placeholders shown`;
  if (missing > 0) return `${missing} empty missing image slot(s)`;
  return "no image slots detected";
}

function baseAudit(id: string, group: string, filePath: string, title: string, raw: string): AssetAudit {
  return {
    id,
    group,
    filePath,
    title,
    wordCount: wordCount(filePath.endsWith(".html") ? stripHtml(raw) : raw),
    missingRequiredSections: [],
    overlyLongSections: [],
    wrongTitleIssues: [],
    imageStatus: filePath.endsWith(".html") ? imageStatusForHtml(raw) : "not applicable",
    tenantContextCorrect: sourceHasTenant(raw),
    localReferencesPresent: hasLocal(raw),
    trustCredentialsPresent: hasTrust(raw),
    customerReady: false,
    issues: [],
  };
}

function finalize(audit: AssetAudit): AssetAudit {
  for (const missing of audit.missingRequiredSections) {
    audit.issues.push(issue(audit.id, "high", `Missing required section: ${missing}`));
  }
  for (const long of audit.overlyLongSections) {
    audit.issues.push(issue(audit.id, "medium", `Overly long section/item: ${long}`));
  }
  for (const wrong of audit.wrongTitleIssues) {
    audit.issues.push(issue(audit.id, "medium", wrong));
  }
  if (!audit.tenantContextCorrect) audit.issues.push(issue(audit.id, "critical", "Tenant context missing or forbidden demo content detected"));
  if (!audit.localReferencesPresent) audit.issues.push(issue(audit.id, "medium", "Local Rotherham reference missing or weak"));
  if (!audit.trustCredentialsPresent) audit.issues.push(issue(audit.id, "medium", "Trust/credentials missing or weak"));
  if (/empty missing image|no image slots|0 assigned/i.test(audit.imageStatus)) {
    audit.issues.push(issue(audit.id, "high", `Image issue: ${audit.imageStatus}`));
  } else if (/missing image slot/i.test(audit.imageStatus)) {
    audit.issues.push(issue(audit.id, "medium", `Image issue: ${audit.imageStatus}`));
  }
  audit.customerReady = audit.issues.every((item) => item.severity === "low");
  return audit;
}

function auditHtmlAsset(id: string, group: string, filePath: string, required: string[], maxSectionWords: number): AssetAudit {
  const html = read(filePath);
  const audit = baseAudit(id, group, filePath, titleFromHtml(html, id), html);
  for (const req of required) {
    if (!new RegExp(req, "i").test(html)) audit.missingRequiredSections.push(req);
  }
  audit.overlyLongSections.push(...htmlSectionsOverLimit(html, maxSectionWords), ...cardTextOverLimit(html, 170));
  if (/SOCIAL CONTENT LIBRARY|BLOG CONTENT LIBRARY|EMAIL CONTENT LIBRARY|VIDEO CONTENT LIBRARY/i.test(audit.title)) {
    audit.wrongTitleIssues.push(`Wrong title/library heading used: ${audit.title}`);
  }
  if (/blood pressure|professional reading|numbers mean/i.test(stripHtml(html)) && id.includes("pharmacy-first")) {
    audit.wrongTitleIssues.push("Contains off-service blood-pressure/reading phrasing in Pharmacy First content");
  }
  return finalize(audit);
}

function auditJsonPack(id: string, group: string, filePath: string): AssetAudit {
  const raw = read(filePath);
  const json = raw ? JSON.parse(raw) as Record<string, unknown> : {};
  const audit = baseAudit(id, group, filePath, id, raw);
  const items = (json.posts || json.emails || []) as Array<Record<string, unknown>>;
  if (!items.length) audit.missingRequiredSections.push("pack items");
  items.forEach((item, index) => {
    const title = String(item.title || item.subject || "").trim();
    const body = String(item.body || item.text || "").trim();
    const combined = `${title} ${body}`;
    const words = wordCount(combined);
    if (/Description:|Typical symptoms:|When Pharmacy First is appropriate:|###|APPOINTMENT PROCESS|COMMON PATIENT QUESTIONS/i.test(combined)) {
      audit.wrongTitleIssues.push(`item ${index + 1} exposes raw master heading/label`);
    }
    if (group === "social posts" && body.length > 280) audit.overlyLongSections.push(`social item ${index + 1} (${body.length} chars)`);
    if (group === "GBP posts" && body.length > 250) audit.overlyLongSections.push(`GBP item ${index + 1} (${body.length} chars)`);
    if (group === "email sequence" && words > 450) audit.overlyLongSections.push(`email ${index + 1} (${words} words)`);
  });
  if (group === "email sequence" && items.length < 5) audit.missingRequiredSections.push("5-email sequence");
  if (group === "social posts" && items.length < 8) audit.missingRequiredSections.push("minimum social post set");
  if (group === "GBP posts" && items.length < 5) audit.missingRequiredSections.push("minimum GBP post set");
  audit.imageStatus = "not applicable";
  return finalize(audit);
}

function auditMarkdown(id: string, group: string, filePath: string): AssetAudit {
  const raw = read(filePath);
  const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() || id;
  const audit = baseAudit(id, group, filePath, title, raw);
  if (/^## Opening/m.test(raw) && !/Pharmacy First is an NHS/i.test(raw)) {
    audit.missingRequiredSections.push("opening explanation");
  }
  if (/###|Master §|Reviewer:\s*$/i.test(raw)) {
    audit.wrongTitleIssues.push("script contains raw markdown/source metadata or blank reviewer field");
  }
  audit.imageStatus = "not applicable";
  return finalize(audit);
}

function auditImages(): AssetAudit {
  const raw = read(imageAssignmentsPath);
  const json = raw ? JSON.parse(raw) as { assignments?: Record<string, unknown>; uploads?: unknown[]; aiRequests?: unknown[] } : {};
  const assignments = Object.keys(json.assignments || {}).filter((key) => key.startsWith(`${campaignId}:`) || key.startsWith(`${campaignId}:`));
  const audit = baseAudit("images", "images", imageAssignmentsPath, "Image assignments", raw || "{}");
  audit.wordCount = 0;
  audit.imageStatus = `${assignments.length} assigned campaign image slot(s)`;
  audit.trustCredentialsPresent = true;
  audit.localReferencesPresent = true;
  audit.tenantContextCorrect = true;
  if (assignments.length === 0) audit.missingRequiredSections.push("hero/support/trust/conversion image assignments");
  return finalize(audit);
}

function collectAudits(): AssetAudit[] {
  const ecosystem = JSON.parse(read(ecosystemIndexPath)) as { assets: Array<{ id: string; type: string; outputPath: string }> };
  const audits: AssetAudit[] = [];
  audits.push(
    auditHtmlAsset("service-page", "service page", visualPath, [
      'data-template-block="hero"',
      'data-template-block="service-definition"',
      'data-template-block="conditions"',
      'data-template-block="eligibility"',
      'data-template-block="process"',
      'data-template-block="faq"',
      'id="local-access"',
      'data-template-block="final-cta"',
      'data-component="pharmacy-page-header"',
      'data-component="pharmacy-page-footer"',
    ], 900),
  );
  for (const asset of ecosystem.assets) {
    if (asset.id === "root-service-page" || asset.id === "ecosystem-summary") continue;
    if (asset.outputPath.endsWith(".html")) {
      const required = asset.type === "Local cluster page"
        ? ["<header", "<footer", "Rotherham", "Pharmacy Delivered", "Book Pharmacy First|Call Pharmacy"]
        : ["<header", "Pharmacy Delivered", "Pharmacy First"];
      audits.push(auditHtmlAsset(asset.id, asset.type, asset.outputPath, required, asset.type === "Local cluster page" ? 1600 : 900));
    } else if (asset.outputPath.endsWith(".json")) {
      const group = asset.id === "social-pack" ? "social posts" : asset.id === "gbp-pack" ? "GBP posts" : "email sequence";
      audits.push(auditJsonPack(asset.id, group, asset.outputPath));
    } else if (asset.outputPath.endsWith(".md")) {
      audits.push(auditMarkdown(asset.id, asset.type, asset.outputPath));
    }
  }
  audits.push(auditImages());
  return audits;
}

function severityRank(severity: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[severity];
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function renderReport(audits: AssetAudit[]): string {
  const issues = audits.flatMap((audit) => audit.issues).sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const bySeverity = (severity: Severity) => issues.filter((item) => item.severity === severity);
  const ready = audits.filter((audit) => audit.customerReady).length;
  const lines: string[] = [];
  lines.push("# Campaign Content Quality Audit V1");
  lines.push("");
  lines.push(`Target: \`${slug}/${campaignId}\``);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(`- Assets audited: ${audits.length}`);
  lines.push(`- Customer-ready assets: ${ready}/${audits.length}`);
  lines.push(`- Critical issues: ${bySeverity("critical").length}`);
  lines.push(`- High issues: ${bySeverity("high").length}`);
  lines.push(`- Medium issues: ${bySeverity("medium").length}`);
  lines.push("");
  lines.push("Primary remaining quality risks:");
  if (issues.some((item) => /Image issue|image assignments/i.test(item.message))) {
    lines.push("- Campaign images are not assigned yet; visual pages still rely on placeholders or missing image slots.");
  }
  if (issues.some((item) => /raw master|raw markdown|Wrong title/i.test(item.message))) {
    lines.push("- Some assets still expose raw labels or title issues.");
  }
  if (issues.some((item) => /Overly long/i.test(item.message))) {
    lines.push("- Some generated sections or pack items are still too long for customer review.");
  }
  if (issues.some((item) => /Local Rotherham reference/i.test(item.message))) {
    lines.push("- Some assets need stronger Rotherham/local context.");
  }
  if (!issues.length) {
    lines.push("- No quality risks detected by this audit.");
  }
  lines.push("");
  for (const severity of ["critical", "high", "medium", "low"] as Severity[]) {
    const items = bySeverity(severity);
    lines.push(`## ${severity.charAt(0).toUpperCase() + severity.slice(1)} Issues`);
    lines.push("");
    if (!items.length) {
      lines.push("- None found.");
    } else {
      for (const item of items) lines.push(`- \`${item.assetId}\`: ${item.message}`);
    }
    lines.push("");
  }
  lines.push("## Asset Audit");
  lines.push("");
  for (const audit of audits) {
    lines.push(`### ${audit.id}`);
    lines.push("");
    lines.push(`- Group: ${audit.group}`);
    lines.push(`- File path: \`${audit.filePath}\``);
    lines.push(`- Title: ${audit.title}`);
    lines.push(`- Word count: ${audit.wordCount}`);
    lines.push(`- Missing required sections: ${audit.missingRequiredSections.length ? audit.missingRequiredSections.join("; ") : "none detected"}`);
    lines.push(`- Overly long sections: ${audit.overlyLongSections.length ? audit.overlyLongSections.join("; ") : "none detected"}`);
    lines.push(`- Wrong title issues: ${audit.wrongTitleIssues.length ? audit.wrongTitleIssues.join("; ") : "none detected"}`);
    lines.push(`- Image status: ${audit.imageStatus}`);
    lines.push(`- Tenant context correct: ${yesNo(audit.tenantContextCorrect)}`);
    lines.push(`- Local references present: ${yesNo(audit.localReferencesPresent)}`);
    lines.push(`- Trust/credentials present: ${yesNo(audit.trustCredentialsPresent)}`);
    lines.push(`- Customer-ready: ${yesNo(audit.customerReady)}`);
    if (audit.issues.length) {
      lines.push("- Issues:");
      for (const item of audit.issues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity))) {
        lines.push(`  - ${item.severity}: ${item.message}`);
      }
    }
    lines.push("");
  }
  lines.push("## Recommended Fix Order");
  lines.push("");
  lines.push("1. Add or assign hero/support/trust/conversion images for the campaign.");
  lines.push("2. Clean social and GBP generation so posts use human titles instead of master labels.");
  lines.push("3. Split or summarise overlong email and service-page card content.");
  lines.push("4. Remove raw markdown markers and source metadata from video/email/social outputs.");
  lines.push("5. Re-run this audit before changing publishing or approval rules.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main(): void {
  if (!fs.existsSync(packagePath)) throw new Error(`Content package missing: ${packagePath}`);
  if (!fs.existsSync(ecosystemIndexPath)) throw new Error(`Ecosystem index missing: ${ecosystemIndexPath}`);
  const audits = collectAudits();
  fs.writeFileSync(reportPath, renderReport(audits), "utf8");
  const report = read(reportPath);
  const requiredSections = ["Executive Summary", "Critical Issues", "High Issues", "Asset Audit", "Recommended Fix Order"];
  const missing = requiredSections.filter((section) => !report.includes(section));
  if (missing.length) throw new Error(`Audit report missing sections: ${missing.join(", ")}`);
  console.log(`PASS campaign content quality audit written - ${reportPath}`);
  console.log(`PASS assets audited - ${audits.length}`);
  console.log(`PASS issues found - ${audits.flatMap((audit) => audit.issues).length}`);
  console.log(`PASS report includes required sections - ${requiredSections.join(", ")}`);
}

main();
