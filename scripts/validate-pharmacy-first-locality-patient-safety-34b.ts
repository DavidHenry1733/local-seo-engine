#!/usr/bin/env npx tsx
/**
 * PHARMACY-FIRST-LOCALITY-PATIENT-SAFETY-34B
 * Complete variant scan + eight-locality no-write fixtures. Does not regenerate live output.
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
import { withApprovedBankServicePageContract } from "../src/pharmacy/pharmacyApprovedBankCorePageContract.ts";
import {
  loadServiceVariantPack,
  resolveApprovedServiceBank,
} from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";
import { parseFirstJsonLdScript } from "../src/pharmacy/pharmacyVisualExperienceSchemaEnrichment.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE_ID = "pharmacy-first";
const OLD_HASH = "3e7ee7f5724e48b5e5d6b76ecb14d50008d0f55746d467b3e243713576e3795e";
const NEW_HASH = "46de67243945c2bc572cba35aa9ac0fdd5806fb8813fbf89506bdfabdd517cdb";
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

const PF_SERVICE_PAGE = path.join(ROOT, "output/pharmacy-visual-experience", SLUG, SERVICE_ID, "index.html");
const CONTRACT_FILE = path.join(
  ROOT,
  "data/pharmacy-approved-service-banks/banks/pharmacy-first/service-page-contract-v1.json",
);
const OLD_BANK = path.join(
  ROOT,
  "data/pharmacy-approved-service-banks/banks/pharmacy-first",
  `${OLD_HASH}.json`,
);
const NEW_BANK = path.join(
  ROOT,
  "data/pharmacy-approved-service-banks/banks/pharmacy-first",
  `${NEW_HASH}.json`,
);

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
    .replace(/\s+/g, " ")
    .trim();
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

function snapshotOtherServices(): Map<string, string> {
  const map = new Map<string, string>();
  const roots = [
    path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "flu-vaccinations"),
    path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "travel-vaccinations"),
    path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "blood-pressure-checks"),
    path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, "flu-vaccinations"),
    path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, "travel-vaccinations"),
    path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, "blood-pressure-checks"),
  ];
  for (const root of roots) {
    for (const file of listHtmlFiles(root)) {
      map.set(file, shaFile(file));
    }
  }
  return map;
}

function meaningHits(text: string): string[] {
  const hits: string[] = [];
  const rules: Array<{ id: string; re: RegExp }> = [
    { id: "book-or-walk-in", re: /\bbook or walk[- ]?in\b/i },
    { id: "walk-in", re: /\bwalk-?ins?\b/i },
    { id: "booking-options", re: /\bbooking options\b/i },
    { id: "appointment-tips", re: /\bappointment tips\b/i },
    { id: "invented-duration", re: /\btypically\s+\d+\s*[–-]\s*\d+\s*minutes?\b/i },
    { id: "supply-where-appropriate", re: /\bsupply where appropriate\b/i },
    { id: "treatment-or-referral", re: /\btreatment or referral\b/i },
    { id: "treatment-is-supplied", re: /\btreatment is supplied\b/i },
    { id: "treatment-where-appropriate", re: /\btreatment where appropriate\b/i },
    { id: "photo-id", re: /\bphoto\s*id\b/i },
    { id: "emergency-signposting", re: /\bemergency signposting\b/i },
    { id: "no-antibiotics", re: /\bno antibiotics if inappropriate\b/i },
    { id: "guaranteed", re: /\bguaranteed\b/i },
    { id: "empty-call-placeholder", re: /\bcall\s+\./i },
  ];
  for (const rule of rules) {
    if (rule.re.test(text)) hits.push(rule.id);
  }
  return hits;
}

function hasLocalityJsonLd(html: string, areaName: string): boolean {
  const doc = parseFirstJsonLdScript(html);
  if (!doc) return false;
  const raw = JSON.stringify(doc);
  return (
    /"@type":"Service"/.test(raw) &&
    /"@type":"WebPage"/.test(raw) &&
    new RegExp(areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(raw)
  );
}

function main(): void {
  const servicePageHashBefore = shaFile(PF_SERVICE_PAGE);
  const contractHashBefore = shaFile(CONTRACT_FILE);
  const otherBefore = snapshotOtherServices();
  const pfLocalBefore = new Map(
    listHtmlFiles(path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, SERVICE_ID, "local")).map((f) => [
      f,
      shaFile(f),
    ]),
  );

  const registry = resolveApprovedServiceBank(SERVICE_ID);
  record(
    "bank-hash-pinned",
    Boolean(registry && registry.hash === NEW_HASH && shaFile(NEW_BANK) === NEW_HASH),
    `old=${OLD_HASH} new=${NEW_HASH} registry=${registry?.hash || "missing"}`,
  );

  const pack = loadServiceVariantPack(SERVICE_ID);
  if (!pack) throw new Error("Pharmacy First pack missing");
  const collected = collectLocalitySourceText(pack);
  const sourceGate = evaluateLocalitySourceCopyQualityGate(pack);
  record(
    "complete-variant-scan",
    sourceGate.ok && collected.variantCount === 50,
    `variants=${collected.variantCount} failures=${sourceGate.failures.join("; ") || "none"}`,
  );

  const oldPack = JSON.parse(fs.readFileSync(OLD_BANK, "utf8"));
  const oldGate = evaluateLocalitySourceCopyQualityGate(oldPack);
  record(
    "quality-gate-old-bank-fails",
    !oldGate.ok,
    oldGate.failures.slice(0, 8).join("; ") || "old bank unexpectedly passed",
  );
  record("quality-gate-new-bank-passes", sourceGate.ok, sourceGate.failures.join("; ") || "clean");

  const regressionHtml = `<main>
<section class="hero"><p>Book or walk in, receive assessment, get treatment or referral with safety-netting advice.</p></section>
<section class="faq"><h3 class="faq-q">For Cudworth residents: how long does a Pharmacy First consultation take?</h3>
<p class="faq-a">Typically 15–20 minutes including assessment, advice and supply where appropriate.</p></section>
<ul><li>Emergency signposting</li><li>No antibiotics if inappropriate</li><li>Photo ID if requested</li></ul>
</main>`;
  const regression = evaluateLocalityPatientCopyQualityGate({
    html: regressionHtml,
    areaName: "Cudworth",
    pharmacyName: "Yorkshire Pharmacy & Health Clinic",
  });
  const needed = [
    "book-or-walk-in",
    "invented-duration-range",
    "supply-where-appropriate",
    "emergency-signposting",
    "locality-prefixed-faq",
    "no-antibiotics-if-inappropriate",
    "photo-id",
    "treatment-or-referral",
  ];
  const joined = regression.failures.join(" ");
  const missingNeeded = needed.filter((id) => !joined.includes(id));
  record(
    "quality-gate-regression-html",
    !regression.ok && missingNeeded.length === 0,
    missingNeeded.length ? `missing ${missingNeeded.join(",")}` : regression.failures.join("; "),
  );

  const locked = withApprovedBankServicePageContract(pack).servicePage;
  const contractDoc = JSON.parse(fs.readFileSync(CONTRACT_FILE, "utf8")) as {
    derivedFromBankHash?: string;
    contract?: { heroIntroBody?: string };
  };
  record(
    "service-page-contract-preserved",
    contractDoc.derivedFromBankHash === OLD_HASH &&
      locked.heroIntroBody === contractDoc.contract?.heroIntroBody &&
      shaFile(CONTRACT_FILE) === contractHashBefore,
    `derivedFrom=${contractDoc.derivedFromBankHash}`,
  );

  const ctx = buildContentGenerationContext(SLUG, SERVICE_ID);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pf-locality-patient-safety-34b-"));
  const isolated = {
    ...ctx,
    links: { ...ctx.links, ecosystemRoot: tmp },
  };
  const generated = generateLocalLocationHierarchyPages(isolated);
  record(
    "eight-locality-generate-no-write",
    generated.ok && generated.clusterPaths.length === 8,
    generated.ok ? `wrote ${generated.clusterPaths.length} pages under ${tmp}` : generated.blockedReason || "blocked",
  );

  for (const areaName of AREAS) {
    const slug = areaName.toLowerCase();
    const file = generated.clusterPaths.find((p) => p.includes(`/local/${slug}/`));
    if (!file || !fs.existsSync(file)) {
      record(`render-${slug}`, false, "missing tmp html");
      continue;
    }
    const html = fs.readFileSync(file, "utf8");
    const text = strip(html);
    const hits = meaningHits(text);
    const faqQs = [...html.matchAll(/class="faq-q"[^>]*>([\s\S]*?)<\//gi)].map((m) => strip(m[1] || ""));
    const faqAs = [...html.matchAll(/class="faq-a"[^>]*>([\s\S]*?)<\//gi)].map((m) => strip(m[1] || ""));
    const emptyFaq = faqAs.some((a) => !a) || faqQs.length < 4;
    const prefixed = faqQs.some((q) => /^for\s+.+\s+residents:/i.test(q) || new RegExp(`^${areaName}\\s+[—–-]`, "i").test(q));
    const gate = evaluateLocalityPatientCopyQualityGate({
      html,
      areaName,
      pharmacyName: ctx.profile.pharmacyName,
    });
    const useful =
      /Pharmacy First/i.test(text) &&
      /contact the pharmacy/i.test(text) &&
      /ask appropriate questions|determined individually/i.test(text) &&
      /advised where to seek further help|seek further help/i.test(text);
    const local =
      new RegExp(areaName, "i").test(html) &&
      /Snape Hill|S73/i.test(html) &&
      (/maps\.google|google\.com\/maps|pharmacy-local-map/i.test(html) || /Get directions/i.test(html));
    record(
      `meaning-${slug}`,
      hits.length === 0 && !prefixed && !emptyFaq && gate.ok && useful && local && hasLocalityJsonLd(html, areaName),
      !gate.ok
        ? `copy-gate ${gate.failures.join("; ")}`
        : hits.length || prefixed || emptyFaq
          ? `claims=${hits.join(",") || (emptyFaq ? "empty-faq" : "prefixed-faq")}`
          : useful && local
            ? "safe copy, local context, json-ld"
            : `useful=${useful} local=${local} jsonld=${hasLocalityJsonLd(html, areaName)}`,
    );
  }

  const servicePageHashAfter = shaFile(PF_SERVICE_PAGE);
  record(
    "service-page-byte-integrity",
    servicePageHashBefore === servicePageHashAfter,
    servicePageHashBefore === servicePageHashAfter ? "unchanged" : "CHANGED",
  );
  record(
    "service-page-contract-byte-integrity",
    contractHashBefore === shaFile(CONTRACT_FILE),
    "service-page-contract-v1.json unchanged",
  );

  const liveLocalChanged = [...pfLocalBefore.entries()].filter(([file, hash]) => shaFile(file) !== hash);
  record(
    "live-pf-locality-unwritten",
    liveLocalChanged.length === 0,
    liveLocalChanged.length ? liveLocalChanged.map(([f]) => path.relative(ROOT, f)).join(",") : "live locality html untouched",
  );

  const otherAfter = snapshotOtherServices();
  const otherChanged: string[] = [];
  for (const [file, hash] of otherBefore) {
    if (!otherAfter.has(file) || otherAfter.get(file) !== hash) otherChanged.push(path.relative(ROOT, file));
  }
  for (const file of otherAfter.keys()) {
    if (!otherBefore.has(file)) otherChanged.push(`added:${path.relative(ROOT, file)}`);
  }
  record(
    "other-service-integrity",
    otherChanged.length === 0,
    otherChanged.length ? otherChanged.slice(0, 8).join(",") : `flu/travel/bp ${otherBefore.size} html files unchanged`,
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${tmp}`);
  console.log(`variantCount=${collected.variantCount}`);
  console.log(`${checks.filter((c) => c.pass).length}/${checks.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main();
