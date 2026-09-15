#!/usr/bin/env npx tsx
/**
 * APPROVED-SERVICE-LOCALITY-PAGE-BLUEPRINT-35
 * No-write fixtures for the shared locality blueprint. Does not regenerate live output.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { evaluateLocalityPatientCopyQualityGate } from "../src/pharmacy/contentEngine/pharmacyLocalityPatientCopyQualityGateV1.ts";
import { generateLocalLocationHierarchyPages } from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import { parseFirstJsonLdScript } from "../src/pharmacy/pharmacyVisualExperienceSchemaEnrichment.ts";
import { serviceHubPublicPath } from "../src/pharmacy/pharmacyApprovedBankLocalityDirectRender.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICES = [
  "pharmacy-first",
  "blood-pressure-checks",
  "travel-vaccinations",
  "flu-vaccinations",
] as const;
const PF_AREAS = [
  "Darfield",
  "Wombwell",
  "Thurnscoe",
  "Grimethorpe",
  "Goldthorpe",
  "Worsbrough",
  "Hoyland",
  "Cudworth",
] as const;

type ServiceId = (typeof SERVICES)[number];

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

function shaFile(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function strip(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function listHtmlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listHtmlFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(full);
  }
  return out.sort();
}

function snapshotLiveHtml(): Map<string, string> {
  const map = new Map<string, string>();
  const roots = [
    path.join(ROOT, "output/pharmacy-visual-experience", SLUG),
    path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG),
  ];
  for (const root of roots) {
    for (const file of listHtmlFiles(root)) map.set(file, shaFile(file));
  }
  return map;
}

function snapshotBanksAndContracts(): Map<string, string> {
  const map = new Map<string, string>();
  const bankRoot = path.join(ROOT, "data/pharmacy-approved-service-banks");
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) map.set(full, shaFile(full));
    }
  };
  walk(bankRoot);
  return map;
}

function faqQuestions(html: string): string[] {
  return [...html.matchAll(/class="faq-q"[^>]*>([\s\S]*?)<\//gi)].map((m) => strip(m[1] || ""));
}

function faqAnswers(html: string): string[] {
  return [...html.matchAll(/class="faq-a"[^>]*>([\s\S]*?)<\//gi)].map((m) => strip(m[1] || ""));
}

function hasLocalityJsonLd(html: string, areaName: string, serviceName: string): boolean {
  const doc = parseFirstJsonLdScript(html);
  if (!doc) return false;
  const raw = JSON.stringify(doc);
  try {
    JSON.parse(raw);
  } catch {
    return false;
  }
  return (
    /"@type":"Service"/.test(raw) &&
    /"@type":"WebPage"/.test(raw) &&
    new RegExp(areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(raw) &&
    new RegExp(serviceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(raw)
  );
}

const FORBIDDEN: Array<{ id: string; re: RegExp }> = [
  { id: "appointment-tips", re: /\bappointment tips\b/i },
  { id: "commissioned-nhs", re: /\bcommissioned nhs\b/i },
  { id: "gphc-governance", re: /\bgphc[^.]{0,40}governance|nhs governance|audit-ready\b/i },
  { id: "service-experience-tag", re: /\bservice experience\b/i },
  { id: "book-or-walk-in", re: /\bbook or walk[- ]?in\b/i },
  { id: "walk-in", re: /\bwalk-?ins?\b/i },
  { id: "treatment-or-referral", re: /\btreatment or referral\b/i },
  { id: "supply-where-appropriate", re: /\bsupply where appropriate\b/i },
  { id: "local-guidance-prefix", re: /\blocal guidance for\s+[a-z]/i },
];

const OTHER_SERVICE_IDS: Record<ServiceId, string[]> = {
  "pharmacy-first": ["blood-pressure-checks", "travel-vaccinations", "flu-vaccinations"],
  "blood-pressure-checks": ["pharmacy-first", "travel-vaccinations", "flu-vaccinations"],
  "travel-vaccinations": ["pharmacy-first", "blood-pressure-checks", "flu-vaccinations"],
  "flu-vaccinations": ["pharmacy-first", "blood-pressure-checks", "travel-vaccinations"],
};

const OTHER_SERVICE_NAMES: Record<ServiceId, string[]> = {
  "pharmacy-first": ["Blood Pressure Checks", "Travel Vaccinations", "Flu Vaccinations"],
  "blood-pressure-checks": ["Pharmacy First", "Travel Vaccinations", "Flu Vaccinations"],
  "travel-vaccinations": ["Pharmacy First", "Blood Pressure Checks", "Flu Vaccinations"],
  "flu-vaccinations": ["Pharmacy First", "Blood Pressure Checks", "Travel Vaccinations"],
};

function thinCopySections(html: string): string[] {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const sections = [...main.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)];
  const thin: string[] = [];
  for (const m of sections) {
    const block = m[0];
    if (/data-template-block="(conversion-image|hero|breadcrumbs)"/i.test(block)) continue;
    if (/data-template-block="conversion-image"/i.test(block)) continue;
    const heading = strip(block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || "") || "untitled";
    const text = strip(block);
    const hasCards = /<(article|li|div class="cluster-faq-item)/i.test(block);
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.split(/\s+/).filter(Boolean).length > 3);
    if (!hasCards && sentences.length < 2 && wordCount(text) < 28) {
      thin.push(heading);
    }
  }
  return thin;
}

function largeFixedEmpty(html: string): boolean {
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1] || "").join("\n");
  const clusterRules = /body\[data-local-page-contract="local-cluster-v1"\][^{]*\{[^}]*min-height:\s*0/.test(css);
  const hugeSection = /main section[^}]*min-height:\s*(?:[2-9]\d{2,}|1\d{3,})px/.test(css);
  return !clusterRules || hugeSection;
}

function evaluatePage(input: {
  html: string;
  serviceId: ServiceId;
  serviceName: string;
  areaName: string;
  pharmacyName: string;
  hubWordCount: number;
}): string[] {
  const { html, serviceId, serviceName, areaName, pharmacyName } = input;
  const failures: string[] = [];
  const text = strip(html);
  const hubHref = serviceHubPublicPath(serviceId);
  const qs = faqQuestions(html);
  const as = faqAnswers(html);

  if (!html.includes(`data-approved-bank-locality-contract="approved-bank-locality-page-v1"`)) {
    failures.push("missing-direct-contract");
  }
  if (/name="commercial-narrative-revision"/i.test(html)) failures.push("commercial-polish-meta");
  if (/name="locality-page-strategy"/i.test(html)) failures.push("strategy-meta");
  if (!new RegExp(`${serviceName} for patients from ${areaName}`, "i").test(html)) {
    failures.push("hero-heading");
  }
  if (!/Contact the pharmacy/i.test(html)) failures.push("contact-cta");
  if (!/Get directions/i.test(html)) failures.push("directions-cta");
  if (!new RegExp(`When to contact the pharmacy about ${serviceName}`, "i").test(html)) {
    failures.push("when-to-contact");
  }
  if (!/What happens next/i.test(html)) failures.push("what-happens-next");
  if (!new RegExp(`Preparing and staying safe with ${serviceName}`, "i").test(html)) {
    failures.push("preparing-safety");
  }
  if (!new RegExp(`Find out more about ${serviceName}`, "i").test(html)) failures.push("hub-cta-heading");
  if (!new RegExp(`View full ${serviceName} information`, "i").test(html)) failures.push("hub-cta-button");
  const ctaHref = html.match(
    new RegExp(
      `data-service-hub-cta="${serviceId}"[\\s\\S]*?<a[^>]*href="([^"]+)"[^>]*>\\s*View full ${serviceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} information`,
      "i",
    ),
  );
  if (!ctaHref || ctaHref[1] !== hubHref) failures.push(`hub-cta-href:${ctaHref?.[1] || "missing"}`);
  if (qs.length < 4 || qs.length > 6) failures.push(`faq-count:${qs.length}`);
  if (as.some((a) => !a)) failures.push("empty-faq");
  if (
    qs.some(
      (q) =>
        /^for\s+.+\s+residents:/i.test(q) ||
        new RegExp(`^${areaName}\\s+[—–-]`, "i").test(q) ||
        new RegExp(`^local guidance for\\s+${areaName}:`, "i").test(q),
    )
  ) {
    failures.push("locality-prefixed-faq");
  }
  if (!new RegExp(areaName, "i").test(html)) failures.push("missing-locality");
  if (!/Snape Hill|S73/i.test(html)) failures.push("missing-address");
  if (!(/maps\.google|google\.com\/maps|pharmacy-local-map/i.test(html) || /Get directions/i.test(html))) {
    failures.push("missing-map");
  }
  if (!hasLocalityJsonLd(html, areaName, serviceName)) failures.push("json-ld");
  for (const rule of FORBIDDEN) {
    if (rule.re.test(text) || rule.re.test(html)) failures.push(rule.id);
  }
  for (const other of OTHER_SERVICE_IDS[serviceId]) {
    if (new RegExp(`href="/${other}/"`, "i").test(html)) failures.push(`cross-service-url:${other}`);
  }
  for (const other of OTHER_SERVICE_NAMES[serviceId]) {
    if (new RegExp(other.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) {
      failures.push(`cross-service-copy:${other}`);
    }
  }
  const relatedHrefs = [
    ...html.matchAll(
      /data-template-block="parent-child-links"[\s\S]*?<\/section>/gi,
    ),
  ]
    .join(" ")
    .match(/href="([^"]+)"/gi) || [];
  for (const href of relatedHrefs) {
    const url = href.replace(/^href="|"$/g, "");
    if (url.startsWith("/") && !url.startsWith("/local/")) failures.push(`related-non-local:${url}`);
  }
  const gate = evaluateLocalityPatientCopyQualityGate({
    html,
    areaName,
    pharmacyName,
  });
  if (!gate.ok) failures.push(`copy-gate:${gate.failures.slice(0, 4).join(",")}`);
  const thin = thinCopySections(html);
  if (thin.length) failures.push(`thin-sections:${thin.slice(0, 4).join("|")}`);
  if (largeFixedEmpty(html)) failures.push("fixed-empty-layout");
  const localWords = wordCount(text);
  if (localWords < 180) failures.push(`too-thin:${localWords}`);
  if (input.hubWordCount && localWords >= input.hubWordCount) {
    failures.push(`not-scaled-down:${localWords}>=${input.hubWordCount}`);
  }
  if (!new RegExp(serviceName, "i").test(text.slice(0, 400)) && !new RegExp(serviceName, "i").test(html)) {
    failures.push("service-identity");
  }
  return failures;
}

function main(): void {
  const liveBefore = snapshotLiveHtml();
  const banksBefore = snapshotBanksAndContracts();

  const fourService: Array<{ serviceId: ServiceId; serviceName: string; pass: boolean; detail: string }> = [];
  const pfResults: Array<{ area: string; pass: boolean; detail: string }> = [];

  for (const serviceId of SERVICES) {
    const ctx = buildContentGenerationContext(SLUG, serviceId);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `locality-blueprint-35-${serviceId}-`));
    const isolated = { ...ctx, links: { ...ctx.links, ecosystemRoot: tmp } };
    const hubPath = path.join(ROOT, "output/pharmacy-visual-experience", SLUG, serviceId, "index.html");
    const hubWordCount = fs.existsSync(hubPath) ? wordCount(strip(fs.readFileSync(hubPath, "utf8"))) : 0;
    const generated = generateLocalLocationHierarchyPages(isolated);
    if (!generated.ok || generated.clusterPaths.length < 1) {
      record(
        `generate-${serviceId}`,
        false,
        generated.blockedReason || `clusters=${generated.clusterPaths.length}`,
      );
      fourService.push({
        serviceId,
        serviceName: ctx.serviceName,
        pass: false,
        detail: generated.blockedReason || "generate failed",
      });
      continue;
    }
    record(
      `generate-${serviceId}`,
      true,
      `${generated.clusterPaths.length} tmp pages under ${tmp}`,
    );

    const pageFails: string[] = [];
    const pages =
      serviceId === "pharmacy-first"
        ? PF_AREAS.map((areaName) => ({
            areaName,
            file: generated.clusterPaths.find((p) => p.includes(`/local/${areaName.toLowerCase()}/`)),
          }))
        : generated.localClusterEntries.map((entry) => ({
            areaName: entry.areaName,
            file: generated.clusterPaths.find((p) => p.includes(`/local/${entry.areaSlug}/`)),
          }));

    for (const { areaName, file } of pages) {
      if (!file || !fs.existsSync(file)) {
        pageFails.push(`${areaName}:missing`);
        if (serviceId === "pharmacy-first") pfResults.push({ area: areaName, pass: false, detail: "missing" });
        continue;
      }
      const html = fs.readFileSync(file, "utf8");
      const failures = evaluatePage({
        html,
        serviceId,
        serviceName: ctx.serviceName,
        areaName,
        pharmacyName: ctx.profile.pharmacyName,
        hubWordCount,
      });
      if (serviceId === "pharmacy-first") {
        pfResults.push({
          area: areaName,
          pass: failures.length === 0,
          detail: failures.join("; ") || "ok",
        });
        record(`pf-${areaName.toLowerCase()}`, failures.length === 0, failures.join("; ") || "blueprint ok");
      }
      if (failures.length) pageFails.push(`${areaName}:${failures.slice(0, 3).join(",")}`);
    }

    fourService.push({
      serviceId,
      serviceName: ctx.serviceName,
      pass: pageFails.length === 0,
      detail: pageFails.length ? pageFails.slice(0, 4).join(" | ") : `${generated.clusterPaths.length} pages ok`,
    });
    record(`four-service-${serviceId}`, pageFails.length === 0, pageFails.length ? pageFails[0]! : "ok");
  }

  const liveAfter = snapshotLiveHtml();
  const liveChanged: string[] = [];
  for (const [file, hash] of liveBefore) {
    if (!liveAfter.has(file) || liveAfter.get(file) !== hash) liveChanged.push(path.relative(ROOT, file));
  }
  for (const file of liveAfter.keys()) {
    if (!liveBefore.has(file)) liveChanged.push(`added:${path.relative(ROOT, file)}`);
  }
  record(
    "live-html-unwritten",
    liveChanged.length === 0,
    liveChanged.length ? liveChanged.slice(0, 8).join(",") : `${liveBefore.size} live html files unchanged`,
  );

  const banksAfter = snapshotBanksAndContracts();
  const bankChanged: string[] = [];
  for (const [file, hash] of banksBefore) {
    if (banksAfter.get(file) !== hash) bankChanged.push(path.relative(ROOT, file));
  }
  record(
    "banks-unedited",
    bankChanged.length === 0,
    bankChanged.length ? bankChanged.join(",") : "approved banks and hashes unchanged",
  );

  const pfAll = pfResults.length === 8 && pfResults.every((r) => r.pass);
  const fourAll = fourService.every((r) => r.pass);
  const ctaAll = checks.filter((c) => c.id.startsWith("four-service-") || c.id.startsWith("pf-")).every((c) => c.pass);
  record("shared-locality-blueprint", fourAll && pfAll, fourAll && pfAll ? "all fixtures" : "see table");
  record("eight-pf-localities", pfAll, pfResults.map((r) => `${r.area}:${r.pass ? "PASS" : "FAIL"}`).join(", "));
  record("service-hub-cta-mapping", ctaAll && fourAll, "/{serviceId}/ including /pharmacy-first/");
  record(
    "content-density-layout",
    !checks.some((c) => !c.pass && /thin-sections|fixed-empty|too-thin|not-scaled/.test(c.detail)),
    "content-driven sections",
  );
  record("service-page-integrity", liveChanged.length === 0 && bankChanged.length === 0, "live pages and banks unchanged");

  console.log("\nFOUR-SERVICE FIXTURE TABLE");
  console.log("| serviceId | serviceName | result | detail |");
  console.log("|---|---|---|---|");
  for (const row of fourService) {
    console.log(`| ${row.serviceId} | ${row.serviceName} | ${row.pass ? "PASS" : "FAIL"} | ${row.detail} |`);
  }
  console.log("\nEIGHT PHARMACY FIRST LOCALITIES");
  for (const row of pfResults) {
    console.log(`${row.pass ? "PASS" : "FAIL"} ${row.area} — ${row.detail}`);
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

main();
