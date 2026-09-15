#!/usr/bin/env npx tsx
/**
 * CORE-PAGE-SERVICE-OVERVIEW-ALIGNMENT-29J — no-write four-service fixtures.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { deliverApprovedCorePageJsonLd } from "../src/pharmacy/pharmacyApprovedCorePageJsonLdDelivery.ts";
import {
  applyApprovedCorePagePresentationContractCss,
  pharmaconnectDesignSystemV1ServicePagePresentationContractCss,
} from "../src/pharmacy/pharmacyDesignSystemV1.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { buildPharmacyServicePageStyleBlock } from "../src/pharmacy/pharmacyServicePageDesignSystem.ts";
import { sanitizeReviewPreviewHtml } from "../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const OUT = "/tmp/approved-core-page-service-overview-alignment-29j.json";
const PROFILE_SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICES = [
  { serviceId: "pharmacy-first", serviceName: "Pharmacy First" },
  { serviceId: "blood-pressure-checks", serviceName: "Blood Pressure Checks" },
  { serviceId: "travel-vaccinations", serviceName: "Travel Vaccinations" },
  { serviceId: "flu-vaccinations", serviceName: "Flu Vaccinations" },
] as const;

const REGISTRY = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/pharmacy-approved-service-banks/registry.json"), "utf8"),
) as {
  services: Record<string, { approvedBankHash: string; approvedBankRelativePath: string }>;
};

function shaFile(p: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function visibleBody(html: string): string {
  return String(html || "").match(/<body\b[^>]*>[\s\S]*<\/body>/i)?.[0] || "";
}

function extractJsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) blocks.push(match[1].trim());
  return blocks;
}

function serviceDefinitionHtml(html: string): string {
  return (
    String(html || "").match(
      /<section\b[^>]*id=["']service-definition["'][^>]*>[\s\S]*?<\/section>/i,
    )?.[0] || ""
  );
}

function visualPath(serviceId: string): string {
  return path.join(
    ROOT,
    "output/pharmacy-visual-experience",
    PROFILE_SLUG,
    serviceId,
    "index.html",
  );
}

function syntheticOverviewHtml(serviceId: string, serviceName: string): string {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<title>${serviceName}</title>
<style>
/* cpr-design-system-lock-01-service-page-presentation */
:root{--reading-width-narrative:720px}
.section-head.center{text-align:center}
.definition-split-copy p{margin:0 0 18px}
</style>
</head>
<body>
<main id="main-content">
<section id="service-definition" class="blue-band" data-template-block="service-definition" data-layout="media-float-flow">
<div class="wrap">
<div class="section-head center"><h2>What ${serviceName} Are</h2></div>
<div class="section-copy definition-split-copy"><span class="tag">Service overview</span>
<p>${serviceName} overview body copy for alignment fixture.</p>
<p>Second paragraph preserves spacing.</p></div>
</div>
</section>
</main>
</body>
</html>`;
}

function cssAlignmentFailures(css: string): string[] {
  const failures: string[] = [];
  if (!css.includes("approved-core-page-service-overview-align-29j")) {
    failures.push("missing overview-align marker");
  }
  if (
    !css.includes("#service-definition .definition-split-copy") ||
    !/#service-definition \.section-copy,\s*#service-definition \.definition-split-copy,\s*#service-definition \.section-opening-copy\{text-align:center\}/.test(
      css,
    )
  ) {
    failures.push("copy block not centred");
  }
  if (
    !css.includes("#service-definition .definition-split-copy>.tag") ||
    !css.includes("display:inline-block;text-align:center;margin-left:auto;margin-right:auto")
  ) {
    failures.push("label not centred");
  }
  if (
    !css.includes("#service-definition .definition-split-copy>p") ||
    !css.includes("max-width:var(--reading-width-narrative);margin:0 auto 18px")
  ) {
    failures.push("body copy width/spacing/centre missing");
  }
  if (!css.includes("--reading-width-narrative:720px")) failures.push("desktop reading width missing");
  if (!/@media\(max-width:960px\)[\s\S]*--reading-width-narrative:100%/.test(css)) {
    failures.push("mobile reading width missing");
  }
  return failures;
}

function validateService(serviceId: string, serviceName: string) {
  const failures: string[] = [];
  const registryEntry = REGISTRY.services[serviceId];
  const bankPath = path.join(ROOT, registryEntry.approvedBankRelativePath);
  const bankHashBefore = shaFile(bankPath);
  if (bankHashBefore !== registryEntry.approvedBankHash) {
    failures.push("bank hash mismatch vs registry");
  }

  const storedPath = visualPath(serviceId);
  const source = fs.existsSync(storedPath)
    ? fs.readFileSync(storedPath, "utf8")
    : syntheticOverviewHtml(serviceId, serviceName);
  const sourceKind = fs.existsSync(storedPath) ? "stored-visual" : "synthetic-overview";
  const sanitized = sanitizeReviewPreviewHtml(source);
  const beforeBody = visibleBody(sanitized);
  const beforeSection = serviceDefinitionHtml(sanitized);
  const beforeJsonLd = extractJsonLdBlocks(sanitized);

  if (!beforeSection) failures.push("missing #service-definition");
  if (!/<span class="tag">/i.test(beforeSection)) failures.push("missing section label");
  if (!/<p>/i.test(beforeSection)) failures.push("missing overview paragraphs");

  const aligned = applyApprovedCorePagePresentationContractCss(sanitized);
  const delivered = deliverApprovedCorePageJsonLd(aligned, { slug: PROFILE_SLUG, serviceId });

  if (visibleBody(aligned) !== beforeBody) failures.push("apply changed visible body");
  if (serviceDefinitionHtml(aligned) !== beforeSection) failures.push("apply changed overview markup");
  if (extractJsonLdBlocks(aligned).join("\n") !== beforeJsonLd.join("\n")) {
    failures.push("apply changed stored JSON-LD");
  }

  const styleCss = pharmaconnectDesignSystemV1ServicePagePresentationContractCss();
  failures.push(...cssAlignmentFailures(styleCss).map((f) => `contract:${f}`));
  failures.push(...cssAlignmentFailures(aligned).map((f) => `applied:${f}`));

  for (const [i, raw] of extractJsonLdBlocks(delivered).entries()) {
    try {
      JSON.parse(raw);
    } catch (error) {
      failures.push(`JSON-LD[${i}] parse fail: ${String((error as Error).message || error)}`);
    }
  }

  const bankHashAfter = shaFile(bankPath);
  if (bankHashAfter !== bankHashBefore) failures.push("bank file mutated");

  return {
    serviceId,
    sourceKind,
    bankHashUnchanged: bankHashAfter === bankHashBefore,
    failures,
    pass: failures.length === 0,
  };
}

function main() {
  const profile = buildPharmacyServicePageProfile(PROFILE_SLUG);
  const generatedStyle = buildPharmacyServicePageStyleBlock(profile);
  const styleFailures = cssAlignmentFailures(generatedStyle);
  const results = SERVICES.map((s) => validateService(s.serviceId, s.serviceName));
  const result = {
    ok: styleFailures.length === 0 && results.every((r) => r.pass),
    task: "CORE-PAGE-SERVICE-OVERVIEW-ALIGNMENT-29J",
    writeMode: "no-write-neutral-fixtures",
    generatedStylePass: styleFailures.length === 0,
    generatedStyleFailures: styleFailures,
    services: results,
    fourServiceAlignmentPass: results.every((r) => r.pass),
    failureCount: styleFailures.length + results.reduce((n, r) => n + r.failures.length, 0),
  };
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main();
