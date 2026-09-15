#!/usr/bin/env npx tsx
/**
 * BLOOD-PRESSURE-LOCALITY-CONTENT-COMPLETENESS-38
 * No-write fixtures. Does not regenerate live pages, restart, publish, index, or commit.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import {
  collectLocalitySourceText,
  evaluateLocalityPatientCopyQualityGate,
  evaluateLocalitySourceCopyQualityGate,
} from "../src/pharmacy/contentEngine/pharmacyLocalityPatientCopyQualityGateV1.ts";
import { generateLocalLocationHierarchyPages } from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import { buildApprovedBankLocalityPageContract } from "../src/pharmacy/pharmacyApprovedBankCorePageContract.ts";
import { parseFirstJsonLdScript } from "../src/pharmacy/pharmacyVisualExperienceSchemaEnrichment.ts";
import {
  loadServiceVariantPack,
  resolveApprovedServiceBank,
  type SectionVariant,
} from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";
import { serviceHubPublicPath } from "../src/pharmacy/pharmacyApprovedBankLocalityDirectRender.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE_ID = "blood-pressure-checks";
const OLD_BANK_HASH = "eb2d7891fb119c9985a4221085a329d0995733c15b92fbb42dd310825f831059";
const AREAS = [
  "Darfield",
  "Wombwell",
  "Thurnscoe",
  "Grimethorpe",
  "Goldthorpe",
  "Worsbrough",
  "Hoyland",
  "Cudworth",
] as const;
const OTHER_SERVICES = ["pharmacy-first", "travel-vaccinations", "flu-vaccinations"] as const;

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

function snapshotPaths(paths: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of paths) {
    if (fs.existsSync(file)) map.set(file, shaFile(file));
  }
  return map;
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

function faqQuestions(html: string): string[] {
  return [...html.matchAll(/class="faq-q"[^>]*>([\s\S]*?)<\//gi)].map((m) => strip(m[1] || ""));
}

function faqAnswers(html: string): string[] {
  return [...html.matchAll(/class="faq-a"[^>]*>([\s\S]*?)<\//gi)].map((m) => strip(m[1] || ""));
}

function hasLocalityJsonLd(html: string, areaName: string): boolean {
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
    /Blood Pressure Checks/i.test(raw) &&
    new RegExp(areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(raw)
  );
}

const FORBIDDEN: Array<{ id: string; re: RegExp }> = [
  { id: "nhs-free", re: /\bfree NHS\b/i },
  { id: "commissioned", re: /\bcommissioned\b/i },
  { id: "guaranteed", re: /\bguaranteed\b/i },
  { id: "walk-in", re: /\bwalk-?ins?\b/i },
  { id: "book-an-appointment", re: /\bbook an appointment\b/i },
  { id: "appointments-available", re: /\bappointments available\b/i },
  { id: "in-stock", re: /\bin stock\b/i },
  { id: "invented-duration", re: /\b\d+\s*[–-]\s*\d+\s*minutes?\b/i },
  { id: "pf-leak", re: /\bpharmacy first\b/i },
  { id: "flu-leak", re: /\bflu vaccination/i },
  { id: "travel-leak", re: /\btravel vaccination/i },
];

function thinCopySections(html: string): string[] {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const sections = [...main.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)];
  const thin: string[] = [];
  for (const m of sections) {
    const block = m[0];
    if (/data-template-block="(conversion-image|hero|breadcrumbs)"/i.test(block)) continue;
    const heading = strip(block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || "") || "untitled";
    const text = strip(block);
    const hasCards = /<(article|li|div class="cluster-faq-item)/i.test(block);
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.split(/\s+/).filter(Boolean).length > 3);
    if (!hasCards && sentences.length < 2 && wordCount(text) < 28) thin.push(heading);
  }
  return thin;
}

function largeFixedEmpty(html: string): boolean {
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1] || "").join("\n");
  const clusterRules = /body\[data-local-page-contract="local-cluster-v1"\][^{]*\{[^}]*min-height:\s*0/.test(css);
  const hugeSection = /main section[^}]*min-height:\s*(?:[2-9]\d{2,}|1\d{3,})px/.test(css);
  return !clusterRules || hugeSection;
}

function evaluatePage(html: string, areaName: string, hubWordCount: number, pharmacyName: string): string[] {
  const failures: string[] = [];
  const mainHtml = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] || html;
  const text = strip(mainHtml);
  const qs = faqQuestions(html);
  const as = faqAnswers(html);

  if (!html.includes(`data-approved-bank-locality-contract="approved-bank-locality-page-v1"`)) {
    failures.push("missing-direct-contract");
  }
  if (!new RegExp(`Blood Pressure Checks for patients from ${areaName}`, "i").test(html)) {
    failures.push("hero-heading");
  }
  if (!/Contact the pharmacy/i.test(html)) failures.push("contact-cta");
  if (!/Get directions/i.test(html)) failures.push("directions-cta");
  if (!/What Blood Pressure Checks are/i.test(html)) failures.push("overview-heading");
  if (!/measures your reading|systolic over diastolic/i.test(text)) failures.push("overview-measures");
  if (!/no symptoms|difficult to notice|warning signs/i.test(text)) failures.push("overview-silent");
  if (!/contact the pharmacy/i.test(text)) failures.push("overview-contact");
  if (!/screen for raised readings|do not diagnose/i.test(text)) failures.push("overview-screening");
  if (!/What happens next/i.test(html)) failures.push("what-happens");
  if (!/Contacting the pharmacy/i.test(html)) failures.push("journey-contact");
  if (!/Preparation before measurement/i.test(html)) failures.push("journey-prep");
  if (!/Measurement and explanation/i.test(html)) failures.push("journey-measure");
  if (!/Individually determined next steps/i.test(html)) failures.push("journey-next");
  if (!/Getting an accurate reading/i.test(html)) failures.push("accurate-reading");
  if (!html.includes('data-locality-evidence="approved-bank-preparation"')) failures.push("prep-evidence");
  if (!/Results and safety/i.test(html)) failures.push("results-safety");
  if (!/one reading does not diagnose hypertension/i.test(text)) failures.push("one-reading");
  if (!/Find out more about Blood Pressure Checks/i.test(html)) failures.push("hub-cta-heading");
  if (!/View full Blood Pressure Checks information/i.test(html)) failures.push("hub-cta-button");
  const ctaHref = html.match(
    /data-service-hub-cta="blood-pressure-checks"[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>\s*View full Blood Pressure Checks information/i,
  );
  if (!ctaHref || ctaHref[1] !== serviceHubPublicPath(SERVICE_ID)) {
    failures.push(`hub-cta-href:${ctaHref?.[1] || "missing"}`);
  }
  if (qs.length < 4 || qs.length > 6) failures.push(`faq-count:${qs.length}`);
  if (as.some((a) => !a || wordCount(a) < 8)) failures.push("thin-faq-answer");
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
  if (!(/\b0\d{3,4}\s?\d{3}\s?\d{3,4}\b/.test(html) || /Phone:/i.test(html))) failures.push("missing-phone");
  if (!(/maps\.google|google\.com\/maps|pharmacy-local-map/i.test(html) || /Get directions/i.test(html))) {
    failures.push("missing-map");
  }
  if (!/\b\d+(?:\.\d+)?\s*km\b|approximately/i.test(text)) failures.push("missing-distance");
  if (!/data-template-block="parent-child-links"/i.test(html)) failures.push("related-links");
  if (!hasLocalityJsonLd(html, areaName)) failures.push("json-ld");
  for (const rule of FORBIDDEN) {
    if (rule.re.test(text)) failures.push(rule.id);
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
  if (localWords < 280) failures.push(`too-thin:${localWords}`);
  if (hubWordCount && localWords >= hubWordCount) failures.push(`not-scaled-down:${localWords}>=${hubWordCount}`);
  return failures;
}

function scanForbidden(text: string): string[] {
  return FORBIDDEN.filter((rule) => rule.re.test(text)).map((rule) => rule.id);
}

function contractText(contract: ReturnType<typeof buildApprovedBankLocalityPageContract>): string {
  return [
    contract.explanationHeading,
    contract.explanationBody,
    ...(contract.explanationBullets || []),
    contract.considerHeading,
    contract.considerBody,
    ...contract.considerBullets,
    contract.scopeHeading,
    contract.scopeBody,
    ...contract.scopeBullets,
    contract.processHeading,
    contract.processBody,
    ...contract.processSteps.map((s) => `${s.title} ${s.body} ${(s.bullets || []).join(" ")}`),
    contract.preparationHeading,
    contract.preparationBody,
    ...contract.preparationBullets,
    contract.safetyHeading,
    contract.safetyBody,
    ...contract.safetyBullets,
    ...contract.faqs.map((f) => `${f.question} ${f.answer}`),
  ].join("\n");
}

function main(): void {
  const liveBefore = snapshotLiveHtml();
  const bpServicePage = path.join(ROOT, "output/pharmacy-visual-experience", SLUG, SERVICE_ID, "index.html");
  const bpServiceHashBefore = shaFile(bpServicePage);
  const otherBefore = snapshotPaths([
    path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "pharmacy-first/index.html"),
    path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "travel-vaccinations/index.html"),
    path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "flu-vaccinations/index.html"),
    path.join(ROOT, "data/pharmacy-approved-service-banks/banks/pharmacy-first/46de67243945c2bc572cba35aa9ac0fdd5806fb8813fbf89506bdfabdd517cdb.json"),
    path.join(ROOT, "data/pharmacy-approved-service-banks/banks/travel-vaccinations/7915eefeae0bf49c75b5a21474f70fbd7aada178198427275040fe830171c41a.json"),
    path.join(ROOT, "data/pharmacy-approved-service-banks/banks/flu-vaccinations/eb79f51391b6b6e5cd0b4ac02d6cbe235306159a8847aa704eb5d64f7f4d1ce3.json"),
    path.join(ROOT, "data/pharmacy-approved-service-banks/banks/blood-pressure-checks/service-page-contract-v1.json"),
    ...OTHER_SERVICES.flatMap((id) =>
      listHtmlFiles(path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, id)),
    ),
  ]);

  const approved = resolveApprovedServiceBank(SERVICE_ID);
  if (!approved) throw new Error("Blood Pressure approved bank missing");
  const pack = loadServiceVariantPack(SERVICE_ID);
  if (!pack) throw new Error("Blood Pressure pack missing");
  record(
    "bank-hash-matches-registry",
    approved.hash === approved.entry.approvedBankHash,
    `old=${OLD_BANK_HASH} new=${approved.hash}`,
  );
  record("bank-hash-changed", approved.hash !== OLD_BANK_HASH, "locality overlay added");
  record(
    "service-page-contract-unedited",
    otherBefore.has(path.join(ROOT, "data/pharmacy-approved-service-banks/banks/blood-pressure-checks/service-page-contract-v1.json")),
    "locked contract file present",
  );

  const sourceGate = evaluateLocalitySourceCopyQualityGate(pack);
  record("source-copy-gate", sourceGate.ok, sourceGate.ok ? "clean" : sourceGate.failures.slice(0, 6).join("; "));

  const collected = collectLocalitySourceText(pack);
  const slots = [
    "problem",
    "benefits",
    "eligibility",
    "howItWorks",
    "preparationGuide",
    "trustSafety",
    "patientEducation",
    "mythVsFact",
  ] as const;
  let variantRendered = 0;
  let variantFailed = 0;
  const variantFails: string[] = [];
  for (const slot of slots) {
    const pool = ((pack as unknown as Record<string, SectionVariant[]>)[slot] || []) as SectionVariant[];
    for (let i = 0; i < pool.length; i++) {
      variantRendered += 1;
      const hits = scanForbidden(JSON.stringify(pool[i]));
      if (hits.length) {
        variantFailed += 1;
        variantFails.push(`${slot}[${i}]:${hits.join("+")}`);
      }
    }
  }
  for (const [i, step] of (pack.localityPage?.processSteps || []).entries()) {
    variantRendered += 1;
    const hits = scanForbidden(JSON.stringify(step));
    if (hits.length) {
      variantFailed += 1;
      variantFails.push(`locality-process[${i}]:${hits.join("+")}`);
    }
  }
  for (const [i, faq] of (pack.localityPage?.faqs || pack.faqs || []).entries()) {
    variantRendered += 1;
    const hits = scanForbidden(`${faq.question} ${faq.answer}`);
    if (hits.length) {
      variantFailed += 1;
      variantFails.push(`faq[${i}]:${hits.join("+")}`);
    }
  }
  for (const area of AREAS) {
    const areaContract = buildApprovedBankLocalityPageContract(
      pack,
      area.toLowerCase(),
      AREAS.map((name) => name.toLowerCase()),
    );
    variantRendered += 1;
    const hits = scanForbidden(contractText(areaContract));
    if (hits.length) {
      variantFailed += 1;
      variantFails.push(`contract-${area.toLowerCase()}:${hits.join("+")}`);
    }
  }
  record(
    "complete-variants",
    variantFailed === 0 && variantRendered > 0,
    `rendered=${variantRendered} sourceVariants=${collected.variantCount} failed=${variantFailed} ${variantFails.slice(0, 4).join("; ")}`,
  );

  const slugs = AREAS.map((name) => name.toLowerCase());
  const contract = buildApprovedBankLocalityPageContract(pack, "darfield", slugs);
  record(
    "locality-contract-complete",
    Boolean(
      contract.explanationBody &&
        contract.considerBody &&
        contract.processBody &&
        contract.processSteps.length >= 4 &&
        contract.preparationBody &&
        contract.safetyBody &&
        contract.faqs.length >= 4 &&
        /Getting an accurate reading/i.test(contract.preparationHeading) &&
        /Results and safety/i.test(contract.safetyHeading),
    ),
    `steps=${contract.processSteps.length} faqs=${contract.faqs.length} prep=${contract.preparationHeading} safety=${contract.safetyHeading}`,
  );

  const ctx = buildContentGenerationContext(SLUG, SERVICE_ID);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bp-locality-completeness-38-"));
  const isolated = { ...ctx, links: { ...ctx.links, ecosystemRoot: tmp } };
  const hubWordCount = wordCount(strip(fs.readFileSync(bpServicePage, "utf8")));
  const generated = generateLocalLocationHierarchyPages(isolated);
  record(
    "generate-tmp",
    Boolean(generated.ok && generated.clusterPaths.length === 8),
    generated.ok ? `${generated.clusterPaths.length} tmp pages` : generated.blockedReason || "generate failed",
  );

  const areaResults: Array<{ area: string; pass: boolean; detail: string }> = [];
  let coveragePass = true;
  let localContextPass = true;
  let densityPass = true;
  for (const areaName of AREAS) {
    const file = generated.clusterPaths.find((p) => p.includes(`/local/${areaName.toLowerCase()}/`));
    if (!file || !fs.existsSync(file)) {
      record(`page-${areaName.toLowerCase()}`, false, "missing fixture");
      areaResults.push({ area: areaName, pass: false, detail: "missing" });
      coveragePass = false;
      localContextPass = false;
      densityPass = false;
      continue;
    }
    const html = fs.readFileSync(file, "utf8");
    const failures = evaluatePage(html, areaName, hubWordCount, ctx.profile.pharmacyName);
    const pass = failures.length === 0;
    record(`page-${areaName.toLowerCase()}`, pass, pass ? "complete fixture" : failures.slice(0, 6).join("; "));
    areaResults.push({ area: areaName, pass, detail: failures.join("; ") || "ok" });
    if (failures.some((f) => /overview|what-happens|accurate|results|faq|hub-cta|journey/i.test(f))) coveragePass = false;
    if (failures.some((f) => /locality|address|phone|map|distance|related/i.test(f))) localContextPass = false;
    if (failures.some((f) => /thin|fixed-empty|too-thin|not-scaled/i.test(f))) densityPass = false;
    if (!pass && coveragePass && localContextPass && densityPass) coveragePass = false;
  }

  const liveAfter = snapshotLiveHtml();
  const liveChanged: string[] = [];
  for (const [file, hash] of liveBefore) {
    if (liveAfter.get(file) !== hash) liveChanged.push(path.relative(ROOT, file));
  }
  for (const file of liveAfter.keys()) {
    if (!liveBefore.has(file)) liveChanged.push(`added:${path.relative(ROOT, file)}`);
  }
  record(
    "live-html-unwritten",
    liveChanged.length === 0,
    liveChanged.length ? liveChanged.slice(0, 8).join(",") : `${liveBefore.size} live html files unchanged`,
  );
  record(
    "service-page-byte-integrity",
    shaFile(bpServicePage) === bpServiceHashBefore,
    shaFile(bpServicePage) === bpServiceHashBefore ? "unchanged" : "CHANGED",
  );

  const otherAfter = snapshotPaths([...otherBefore.keys()]);
  const otherChanged: string[] = [];
  for (const [file, hash] of otherBefore) {
    if (otherAfter.get(file) !== hash) otherChanged.push(path.relative(ROOT, file));
  }
  record(
    "other-service-integrity",
    otherChanged.length === 0,
    otherChanged.length ? otherChanged.slice(0, 8).join(",") : "Flu, Travel, Pharmacy First and locked BP contract unchanged",
  );

  const eightPass = areaResults.length === 8 && areaResults.every((r) => r.pass);
  record("eight-locality", eightPass, areaResults.map((r) => `${r.area}:${r.pass ? "PASS" : "FAIL"}`).join(", "));
  record("service-content-coverage", coveragePass && eightPass, coveragePass ? "scaled-down hub coverage" : "coverage gaps");
  record("verified-local-context", localContextPass && eightPass, localContextPass ? "distance/address/map/links" : "local gaps");
  record("density-layout", densityPass && eightPass, densityPass ? "content-driven" : "thin or empty layout");

  console.log("\nBLOOD-PRESSURE-LOCALITY-CONTENT-COMPLETENESS-38");
  console.log(`old bank hash: ${OLD_BANK_HASH}`);
  console.log(`new bank hash: ${approved.hash}`);
  console.log(`complete variant count: ${collected.variantCount} source / ${variantRendered} rendered`);
  console.log(`tmp fixtures: ${tmp}`);
  console.log(`eight-locality: ${eightPass ? "PASS" : "FAIL"}`);
  console.log(`service-content coverage: ${coveragePass && eightPass ? "PASS" : "FAIL"}`);
  console.log(`verified local-context: ${localContextPass && eightPass ? "PASS" : "FAIL"}`);
  console.log(`density/layout: ${densityPass && eightPass ? "PASS" : "FAIL"}`);
  console.log(`service-page byte integrity: ${shaFile(bpServicePage) === bpServiceHashBefore ? "PASS" : "FAIL"}`);
  console.log(`other-service integrity: ${otherChanged.length === 0 ? "PASS" : "FAIL"}`);

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

main();
