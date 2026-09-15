#!/usr/bin/env npx tsx
/**
 * APPROVED-CORE-PAGE-JSONLD-DELIVERY-29H — no-write four-service fixtures.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { deliverApprovedCorePageJsonLd } from "../src/pharmacy/pharmacyApprovedCorePageJsonLdDelivery.ts";
import { renderApprovedLocalityPreviewHtml } from "../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";
import { scrubUnconfirmedServiceClaims } from "../src/pharmacy/pharmacyServicePagePublicationQuality.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const OUT = "/tmp/approved-core-page-jsonld-delivery-29h.json";
const PROFILE_SLUG = "yorkshire-pharmacy-and-health-clinic";
const LOCALITY = "darfield";
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
  const body = String(html || "").match(/<body\b[^>]*>[\s\S]*<\/body>/i)?.[0] || "";
  return body.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
}

function extractJsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) blocks.push(match[1].trim());
  return blocks;
}

function nodeTypes(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x) => typeof x === "string") as string[];
  return [];
}

function graphNodes(doc: Record<string, unknown>): Record<string, unknown>[] {
  const graph = doc["@graph"];
  if (Array.isArray(graph)) return graph.filter((n) => n && typeof n === "object") as Record<string, unknown>[];
  return [doc];
}

function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) collectStrings(child, acc);
  }
  return acc;
}

function malformedServiceHtml(serviceId: string, serviceName: string): string {
  const marker = `VISIBLE-BODY-${serviceId}`;
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<title>${serviceName} Barnsley</title>
<meta name="description" content="Yorkshire Pharmacy in Barnsley — ${serviceName}."/>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":["Pharmacy","MedicalBusiness","LocalBusiness"],"name":"Yorkshire Pharmacy","url":"https://yorkshirepharmacyhealthclinic.co.uk",""amenityFeature":["Private consultation room","NHS pharmacy services"]}]}</script>
</head>
<body>
<main id="main-content">
<p>${marker}</p>
<h1>${serviceName} Barnsley</h1>
<div class="cluster-faq-item faq-card"><h3 class="faq-q">Do I need a consultation for ${serviceName.toLowerCase()}?</h3><p class="faq-a">Contact the pharmacy to confirm how the service is currently arranged.</p></div>
</main>
</body>
</html>`;
}

function localityHtml(serviceId: string, serviceName: string): string {
  const marker = `VISIBLE-LOCAL-${serviceId}`;
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<title>${serviceName} for patients from Darfield</title>
<meta name="description" content="${serviceName} for patients from Darfield."/>
</head>
<body data-publish-source="local-cluster-v1" data-local-page-contract="local-cluster-v1" data-local-cluster="darfield">
<main id="main-content">
<p>${marker}</p>
<h1>${serviceName} for patients from Darfield</h1>
<div class="cluster-faq-item faq-card"><h3 class="faq-q">How are ${serviceName.toLowerCase()} arranged?</h3><p class="faq-a">Contact the pharmacy to ask how the service is currently arranged.</p></div>
</main>
</body>
</html>`;
}

function validateJsonLd(
  html: string,
  serviceId: string,
  opts: { locality?: string; requireFaq: boolean },
): string[] {
  const failures: string[] = [];
  const blocks = extractJsonLdBlocks(html);
  if (!blocks.length) failures.push("no JSON-LD block");
  const docs: Record<string, unknown>[] = [];
  for (const [i, raw] of blocks.entries()) {
    try {
      docs.push(JSON.parse(raw) as Record<string, unknown>);
    } catch (error) {
      failures.push(`JSON-LD[${i}] parse fail: ${String((error as Error).message || error)}`);
    }
  }
  const nodes = docs.flatMap(graphNodes);
  const types = new Set(nodes.flatMap(nodeTypes));
  for (const required of ["WebPage", "Service", "BreadcrumbList"]) {
    if (!types.has(required)) failures.push(`missing ${required}`);
  }
  if (opts.requireFaq && !types.has("FAQPage")) failures.push("missing FAQPage");
  const joined = collectStrings(docs).join("\n");
  if (!joined.includes(`/${serviceId}/`)) failures.push(`missing /${serviceId}/ identity URL`);
  if (opts.locality && !joined.includes(`/${serviceId}/local/${opts.locality}/`)) {
    failures.push(`missing /${serviceId}/local/${opts.locality}/`);
  }
  for (const other of SERVICES) {
    if (other.serviceId === serviceId) continue;
    if (joined.includes(`/${other.serviceId}/`)) {
      failures.push(`cross-service reference /${other.serviceId}/`);
    }
    if (new RegExp(other.serviceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(joined)) {
      failures.push(`cross-service wording ${other.serviceName}`);
    }
  }
  if (/""amenityFeature"/.test(blocks.join(""))) failures.push("malformed amenityFeature property");
  return failures;
}

function validateService(serviceId: string, serviceName: string) {
  const failures: string[] = [];
  const registryEntry = REGISTRY.services[serviceId];
  const bankPath = path.join(ROOT, registryEntry.approvedBankRelativePath);
  const bankHashBefore = shaFile(bankPath);

  const serviceSource = malformedServiceHtml(serviceId, serviceName);
  const serviceDelivered = deliverApprovedCorePageJsonLd(serviceSource, {
    slug: PROFILE_SLUG,
    serviceId,
  });
  failures.push(
    ...validateJsonLd(serviceDelivered, serviceId, { requireFaq: true }).map((f) => `service:${f}`),
  );
  if (visibleBody(serviceSource) !== visibleBody(serviceDelivered)) {
    failures.push("service: visible body changed");
  }

  const amenitySource = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    amenityFeature: ["Private consultation room", "NHS pharmacy services"],
    url: "https://example.test",
  })}</script><p>keep-me</p>`;
  const amenityScrubbed = scrubUnconfirmedServiceClaims(amenitySource, {
    fundingModel: "unknown",
    serviceId,
  });
  const amenityBlock = extractJsonLdBlocks(amenityScrubbed)[0];
  try {
    const parsed = JSON.parse(amenityBlock);
    if (!Array.isArray(parsed.amenityFeature) || parsed.amenityFeature.length !== 0) {
      failures.push("service: amenityFeature not object-cleared");
    }
    if (/""amenityFeature"/.test(amenityBlock)) failures.push("service: scrub emitted malformed amenityFeature");
  } catch (error) {
    failures.push(`service: amenityFeature scrub parse fail: ${String((error as Error).message || error)}`);
  }
  if (!amenityScrubbed.includes("<p>keep-me</p>")) failures.push("service: amenity scrub changed visible html");

  const localitySource = localityHtml(serviceId, serviceName);
  const localityDelivered = renderApprovedLocalityPreviewHtml(localitySource, {
    slug: PROFILE_SLUG,
    serviceId,
    localitySlug: LOCALITY,
  });
  failures.push(
    ...validateJsonLd(localityDelivered, serviceId, { locality: LOCALITY, requireFaq: true }).map(
      (f) => `locality:${f}`,
    ),
  );
  const localityJsonLdOnly = deliverApprovedCorePageJsonLd(localitySource, {
    slug: PROFILE_SLUG,
    serviceId,
    localitySlug: LOCALITY,
  });
  if (visibleBody(localitySource) !== visibleBody(localityJsonLdOnly)) {
    failures.push("locality: visible body changed by JSON-LD delivery");
  }
  if (/application\/ld\+json/i.test(visibleBody(localityDelivered))) {
    failures.push("locality: JSON-LD appeared in body");
  }

  const bankHashAfter = shaFile(bankPath);
  if (bankHashAfter !== bankHashBefore) failures.push("bank file mutated");

  return {
    serviceId,
    bankHashUnchanged: bankHashAfter === bankHashBefore,
    servicePass: failures.every((f) => !f.startsWith("service:")),
    localityPass: failures.every((f) => !f.startsWith("locality:")),
    visibleBodyPass: !failures.some((f) => /visible body/.test(f)),
    failures,
    pass: failures.length === 0,
  };
}

function main() {
  const results = SERVICES.map((s) => validateService(s.serviceId, s.serviceName));
  const result = {
    ok: results.every((r) => r.pass),
    task: "APPROVED-CORE-PAGE-JSONLD-DELIVERY-29H",
    writeMode: "no-write-neutral-fixtures",
    services: results,
    fourServiceJsonLdPass: results.every((r) => r.servicePass && r.localityPass),
    visibleBodyPass: results.every((r) => r.visibleBodyPass),
    failureCount: results.reduce((n, r) => n + r.failures.length, 0),
  };
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main();
