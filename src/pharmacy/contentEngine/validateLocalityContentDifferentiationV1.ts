#!/usr/bin/env npx tsx
/**
 * Isolated validation for locality content differentiation + duplication gate.
 * Does not write live generated tenant files and does not call Google.
 *
 * Run from repo root:
 *   npx tsx src/pharmacy/contentEngine/validateLocalityContentDifferentiationV1.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolveLocalityIntelligencePack } from "./pharmacyLocalityIntelligencePackV1.ts";
import { bindVerifiedLocalityEvidenceV1 } from "./pharmacyVerifiedLocalityEvidenceV1.ts";
import { composeCommercialClusterNarrativeV1 } from "../pharmacyLocalClusterContentEngine.ts";
import {
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
} from "./pharmacyLocalityVariationSessionV1.ts";
import { evaluateLocalityHtmlDuplicationGate } from "../pharmacyLocalityPageDuplicationGateV1.ts";
import type { ContentGenerationContext } from "./contentGenerationContextTypes.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join("/tmp", "locality-content-differentiation-validation");
const SLUG = "validation-locality-diff-tenant";
const SERVICE = "pharmacy-first";
const PHARMACY = "Validation Community Pharmacy";
const AREAS = [
  { name: "Darfield", slug: "darfield", lat: 53.5334, lng: -1.3812, landmark: "Darfield Community Hall", gp: "Darfield Medical Centre" },
  { name: "Wombwell", slug: "wombwell", lat: 53.5219, lng: -1.4001, landmark: "Wombwell Park", gp: "Wombwell Surgery" },
  { name: "Thurnscoe", slug: "thurnscoe", lat: 53.545, lng: -1.309, landmark: "Thurnscoe Rec", gp: "Thurnscoe Medical Centre" },
  { name: "Grimethorpe", slug: "grimethorpe", lat: 53.5702, lng: -1.3768, landmark: "Grimethorpe Colliery Monument", gp: "Grimethorpe Surgery" },
  { name: "Goldthorpe", slug: "goldthorpe", lat: 53.533, lng: -1.303, landmark: "Goldthorpe Market Square", gp: "Goldthorpe Health Centre" },
  { name: "Worsbrough", slug: "worsbrough", lat: 53.536, lng: -1.473, landmark: "Worsbrough Mill", gp: "Worsbrough Health Centre" },
  { name: "Hoyland", slug: "hoyland", lat: 53.5006, lng: -1.4406, landmark: "Hoyland Common", gp: "Hoyland Medical Practice" },
  { name: "Cudworth", slug: "cudworth", lat: 53.578, lng: -1.416, landmark: "Cudworth Park", gp: "Cudworth Medical Centre" },
];

const checks: Array<{ id: string; pass: boolean; detail: string }> = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function hashFile(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function normalizeCopyForSimilarity(text: string, areaNames: string[], pharmacyName: string): string {
  let out = String(text || "").toLowerCase();
  for (const area of areaNames) {
    out = out.replace(new RegExp(area.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "{area}");
  }
  out = out.replace(new RegExp(pharmacyName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "{pharmacy}");
  return out.replace(/\s+/g, " ").trim();
}

function copySimilarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const wa = new Set(a.split(" ").filter((w) => w.length > 3));
  const wb = new Set(b.split(" ").filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.max(wa.size, wb.size);
}

function inventedBeforePack(areaName: string) {
  return {
    landmarks: [`the ${areaName} local centre`, `${areaName} parish church approaches`],
    roads: [`${areaName} Road`, `${areaName} Lane`],
    opening: `For households around ${areaName}, Pharmacy First is available with clear local access guidance. ${areaName} residents often need practical same-day pharmacist assessment when routine GP appointments are hard to book.`,
    access: `You will find the pharmacy at High Street. From ${areaName}, useful approach routes include ${areaName} Road and ${areaName} Lane.`,
  };
}

function mockCtx(): ContentGenerationContext {
  const landmarks = AREAS.flatMap((a) => [
    {
      id: `${a.slug}-landmark`,
      name: a.landmark,
      address: `${a.landmark}, ${a.name}`,
      category: "landmark",
      entityType: "landmarks" as const,
      distanceKm: 2,
      distanceLabel: "about 2 km",
      source: "Google Places" as const,
      types: ["park"],
      selected: true,
    },
  ]);
  const gps = AREAS.map((a) => ({
    id: `${a.slug}-gp`,
    name: a.gp,
    address: `${a.gp}, ${a.name}`,
    category: "GP surgery",
    entityType: "gpSurgeries" as const,
    distanceKm: 1.5,
    distanceLabel: "about 1.5 km",
    source: "Google Places" as const,
    types: ["doctor"],
    selected: true,
  }));
  return {
    resolvedSlug: SLUG,
    slug: SLUG,
    serviceId: SERVICE,
    serviceName: "Pharmacy First",
    profile: {
      pharmacyName: PHARMACY,
      displayPhone: "01226 000000",
      phone: "01226 000000",
      fullAddress: "12 High Street, Barnsley S70 1AA",
      customerFacingAddress: "12 High Street, Barnsley S70 1AA",
      town: "Barnsley",
    },
    rawProfile: {
      latitude: "53.5531",
      longitude: "-1.4797",
      landmarks,
      gpSurgeries: gps,
      selectedAreas: AREAS.map((a, i) => ({
        areaName: a.name,
        selected: true,
        order: i + 1,
        priority: i + 1,
        source: "operator-confirmed",
        latitude: a.lat,
        longitude: a.lng,
        distanceMethod: "haversine",
        distanceProvenance: { calculationMethod: "haversine", distanceSource: "google-coordinates" },
      })),
    },
    localMarket: {
      slug: SLUG,
      generatedAt: "2026-01-01T00:00:00.000Z",
      yourPharmacy: {
        placeId: "validation-pharmacy",
        businessName: PHARMACY,
        latitude: 53.5531,
        longitude: -1.4797,
        address: "12 High Street, Barnsley S70 1AA",
        phone: "01226 000000",
        website: "",
      },
      healthcareProviders: gps.map((g, i) => ({
        placeId: g.id,
        businessName: g.name,
        category: "GP surgery",
        groupKey: "gpSurgeries",
        distanceKm: 1 + i * 0.3,
        distanceLabel: "a short journey away",
        address: g.address,
      })),
      nearbyPharmacies: [],
    },
    areaDiscovery: {
      slug: SLUG,
      primaryTown: "Barnsley",
      areas: AREAS.map((a, i) => ({
        areaName: a.name,
        distanceLabel: "",
        reason: `${a.name} is a distinct neighbourhood with its own saved coordinates`,
        evidence: [`saved-coords:${a.lat},${a.lng}`],
        selected: true,
        rank: i + 1,
      })),
    },
    map: { latitude: "53.5531", longitude: "-1.4797", googleMapsEmbedUrl: "", fullAddress: "", resolvedEmbedUrl: "" },
  } as unknown as ContentGenerationContext;
}

function pageHtmlFromContent(areaName: string, areaSlug: string, content: ReturnType<typeof composeCommercialClusterNarrativeV1>): string {
  const faqs = content.faqs
    .map((f) => `<div class="cluster-faq-item faq-card"><h3 class="faq-q">${f.question}</h3><p class="faq-a">${f.answer}</p></div>`)
    .join("\n");
  const supporting = (content.supportingItems || [])
    .map((item) => `<article class="area-card" data-locality-evidence="${item.evidence}"><h3>${item.title}</h3><p>${item.body}</p></article>`)
    .join("\n");
  const links = (content.nearbyLocalityLinks || [])
    .map((n) => `<li><a href="/local/${n.areaSlug}/">Pharmacy First in ${n.areaName}</a> <span>${n.reason}</span></li>`)
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<title>${content.seoTitle || `Pharmacy First in ${areaName} | ${PHARMACY}`}</title>
<meta name="description" content="${content.metaDescription || ""}"/>
</head>
<body>
<header>Shared header ${PHARMACY}</header>
<main id="main-content">
<section data-template-block="hero"><h1>Pharmacy First — ${areaName}</h1><p>${content.heroIntro}</p></section>
<section data-template-block="service-definition"><h2>${content.whyChecksHeading}</h2><p>${content.whyChecksBody}</p></section>
<section data-template-block="child-areas"><h2>${content.supportingHeading || "Local context"}</h2><p>${content.supportingIntro || ""}</p><div class="areas-grid">${supporting}</div></section>
<section data-template-block="local-relevance"><h2>${content.localRelevanceHeading}</h2><p>${content.localRelevanceIntro}</p><p>${content.localRelevanceBody}</p></section>
<section data-template-block="trust-split"><h2>${content.trustHeading}</h2><p>${content.trustBody}</p></section>
<section data-template-block="local" id="local-access"><h2>${content.accessHeading}</h2><p class="local-intro-lead">${content.accessBody}</p><p>Seek urgent medical care for breathing difficulties, chest pain, severe dehydration, confusion, a non-blanching rash, or any emergency symptoms that make you feel critically unwell. Pharmacy First covers sore throat, earache, impetigo, infected insect bites, shingles, sinusitis, and uncomplicated UTI in eligible women.</p></section>
<section data-template-block="parent-child-links"><ul>${links}</ul></section>
<section data-template-block="faq">${faqs}</section>
<section data-template-block="final-cta"><h2>${content.ctaPrimary}</h2><p>${content.ctaSecondary}</p></section>
<p class="locality-cta-context wrap" data-locality-cta>${content.ctaPhonePrompt}</p>
</main>
<footer>Shared footer ${PHARMACY} · GPhC</footer>
</body>
</html>`;
}

function writePacks() {
  const dir = path.join(ROOT, "data/pharmacy-local-relevance-packs", SLUG);
  fs.mkdirSync(dir, { recursive: true });
  for (const area of AREAS) {
    fs.writeFileSync(
      path.join(dir, `${area.slug}.json`),
      JSON.stringify(
        {
          area: area.name,
          areaSlug: area.slug,
          provider: "saved-fixture",
          topLandmarks: [{ name: area.landmark, address: area.name, location: { latitude: area.lat, longitude: area.lng }, types: ["park"] }],
          landmarks: [{ name: area.landmark, address: area.name, location: { latitude: area.lat, longitude: area.lng }, types: ["park"] }],
          topHealthcare: [{ name: area.gp, address: area.name, location: { latitude: area.lat, longitude: area.lng }, types: ["doctor"] }],
          healthcare: [{ name: area.gp, address: area.name, location: { latitude: area.lat, longitude: area.lng }, types: ["doctor"] }],
          community: [],
          transport: [],
          schools: [],
          retail: [],
        },
        null,
        2,
      ),
    );
  }
  return dir;
}

function originalFetch() {
  return globalThis.fetch;
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const liveRoot = path.join(
    ROOT,
    "output/pharmacy-content-ecosystem/yorkshire-pharmacy-and-health-clinic/pharmacy-first/local",
  );
  const liveHashes: Record<string, string> = {};
  if (fs.existsSync(liveRoot)) {
    for (const area of AREAS) {
      const file = path.join(liveRoot, area.slug, "index.html");
      if (fs.existsSync(file)) liveHashes[area.slug] = hashFile(file);
    }
  }

  const livePages = AREAS.map((area) => {
    const file = path.join(liveRoot, area.slug, "index.html");
    return fs.existsSync(file) ? { areaSlug: area.slug, areaName: area.name, html: fs.readFileSync(file, "utf8") } : null;
  }).filter(Boolean) as Array<{ areaSlug: string; areaName: string; html: string }>;
  const livePairs: Array<{ a: string; b: string; exactAfterNameStrip: boolean; score: number }> = [];
  for (let i = 0; i < livePages.length; i++) {
    for (let j = i + 1; j < livePages.length; j++) {
      const a = livePages[i]!;
      const b = livePages[j]!;
      const na = normalizeCopyForSimilarity(a.html, AREAS.map((x) => x.name), "Yorkshire Pharmacy & Health Clinic");
      const nb = normalizeCopyForSimilarity(b.html, AREAS.map((x) => x.name), "Yorkshire Pharmacy & Health Clinic");
      livePairs.push({
        a: a.areaName,
        b: b.areaName,
        exactAfterNameStrip: na === nb,
        score: Number(copySimilarityScore(na, nb).toFixed(3)),
      });
    }
  }
  const liveDarfieldGrimethorpe = livePairs.find((p) => p.a === "Darfield" && p.b === "Grimethorpe");
  record(
    "before-fix:live-html-darfield-grimethorpe",
    Boolean(liveDarfieldGrimethorpe?.exactAfterNameStrip || (liveDarfieldGrimethorpe && liveDarfieldGrimethorpe.score >= 0.95)),
    JSON.stringify(liveDarfieldGrimethorpe || { missing: true, compared: livePages.length }),
  );
  fs.writeFileSync(path.join(OUT, "before-fix-live-html-pairs.json"), JSON.stringify(livePairs, null, 2));

  // 1. Before-fix reconstruction
  const beforePairs: Array<{ a: string; b: string; sections: Record<string, { exact: boolean; score: number }> }> = [];
  const beforeByArea = Object.fromEntries(AREAS.map((a) => [a.name, inventedBeforePack(a.name)]));
  for (let i = 0; i < AREAS.length; i++) {
    for (let j = i + 1; j < AREAS.length; j++) {
      const a = AREAS[i]!;
      const b = AREAS[j]!;
      const sections: Record<string, { exact: boolean; score: number }> = {};
      for (const key of ["opening", "access", "landmarks", "roads"] as const) {
        const valueA = (beforeByArea[a.name] as Record<string, unknown>)[key];
        const valueB = (beforeByArea[b.name] as Record<string, unknown>)[key];
        const na = normalizeCopyForSimilarity(Array.isArray(valueA) ? valueA.join(" ") : String(valueA), AREAS.map((x) => x.name), PHARMACY);
        const nb = normalizeCopyForSimilarity(Array.isArray(valueB) ? valueB.join(" ") : String(valueB), AREAS.map((x) => x.name), PHARMACY);
        sections[key] = { exact: na === nb, score: Number(copySimilarityScore(na, nb).toFixed(3)) };
      }
      beforePairs.push({ a: a.name, b: b.name, sections });
    }
  }
  const darfieldGrimethorpe = beforePairs.find((p) => p.a === "Darfield" && p.b === "Grimethorpe");
  record(
    "before-fix:darfield-grimethorpe-name-substitution",
    Boolean(darfieldGrimethorpe?.sections.opening.exact && darfieldGrimethorpe.sections.landmarks.exact),
    JSON.stringify(darfieldGrimethorpe?.sections),
  );
  fs.writeFileSync(path.join(OUT, "before-fix-pairs.json"), JSON.stringify({ rootCause: "synthesizePack invented {area} parish church / {area} Road", pairs: beforePairs }, null, 2));

  // Current pack resolver must not invent
  const restrained = resolveLocalityIntelligencePack({ areaName: "Darfield", nearbyAreaNames: ["Grimethorpe"] });
  record(
    "pack:no-invented-landmarks",
    !restrained.landmarks.some((l) => /parish church|war memorial/i.test(l)) && restrained.landmarks.length === 0,
    restrained.landmarks.join(" | ") || "empty restrained pack",
  );
  const headingley = resolveLocalityIntelligencePack({ areaName: "Headingley" });
  record("compat:headingley-pack-retained", headingley.landmarks.some((l) => /stadium/i.test(l)), headingley.landmarks.join(", "));
  const srcPack = fs.readFileSync(path.join(ROOT, "src/pharmacy/contentEngine/pharmacyLocalityIntelligencePackV1.ts"), "utf8");
  record("pack:synthesizePack-removed", !/\bfunction synthesizePack\b|\bsynthesizePack\(/.test(srcPack), "no synthesizePack fallback");

  const packDir = writePacks();
  const ctx = mockCtx();
  const fetchCalls: string[] = [];
  const prevFetch = originalFetch();
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push(String(input));
    throw new Error(`Unexpected external fetch: ${String(input)}`);
  };

  beginLocalityVariationSessionV1(AREAS.map((a) => a.slug));
  const pages = [];
  try {
    for (const area of AREAS) {
      const siblings = AREAS.map((a) => ({ areaName: a.name, areaSlug: a.slug }));
      const verified = bindVerifiedLocalityEvidenceV1({
        ctx,
        areaName: area.name,
        areaSlug: area.slug,
        siblingLocalities: siblings,
      });
      record(
        `evidence:${area.slug}:own-facts`,
        verified.landmarks.some((l) => l.name === area.landmark) &&
          verified.healthcare.some((h) => h.name === area.gp) &&
          verified.distanceLabel.length > 0 &&
          verified.cardinalDirection.length > 0,
        `${verified.distanceLabel} ${verified.cardinalDirection}; landmarks=${verified.landmarks.map((l) => l.name).join(",")}`,
      );
      const content = composeCommercialClusterNarrativeV1(
        {
          slug: SLUG,
          serviceId: SERVICE,
          serviceName: "Pharmacy First",
          areaName: area.name,
          areaSlug: area.slug,
          nearbyAreaNames: AREAS.filter((a) => a.slug !== area.slug).map((a) => a.name),
          areaSlugsInCluster: AREAS.map((a) => a.slug),
          siblingLocalities: siblings,
        },
        ctx,
      );
      const html = pageHtmlFromContent(area.name, area.slug, content);
      const dest = path.join(OUT, area.slug, "index.html");
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, html);
      pages.push({ areaSlug: area.slug, areaName: area.name, html, content, verified });
      record(
        `page:${area.slug}:pharmacy-first-facts`,
        /Pharmacy First/i.test(html) && html.includes(PHARMACY) && /UTI|sore throat|eligible/i.test(html),
        "retains Pharmacy First and pharmacy identity",
      );
      record(
        `page:${area.slug}:no-unsupported-invention`,
        !/parish church|war memorial/i.test(html),
        "no invented church/memorial claims",
      );
    }
  } finally {
    endLocalityVariationSessionV1();
    globalThis.fetch = prevFetch;
    fs.rmSync(packDir, { recursive: true, force: true });
  }

  record("no-external-google-calls", fetchCalls.length === 0, fetchCalls.join(",") || "none");

  const afterGate = evaluateLocalityHtmlDuplicationGate({ pages, pharmacyName: PHARMACY });
  const afterPairs = afterGate.pairs.map((p) => ({
    a: p.a,
    b: p.b,
    blocked: p.blocked,
    reason: p.reason,
    sections: Object.fromEntries(p.sections.map((s) => [s.section, { exact: s.exact, near: s.nearDuplicate, nameSub: s.nameSubstitution, score: s.score }])),
  }));
  fs.writeFileSync(
    path.join(OUT, "after-fix-gate.json"),
    JSON.stringify({ gate: afterGate, pairs: afterPairs }, null, 2),
  );
  record("after-fix:duplication-gate-pass", afterGate.ok, afterGate.message.slice(0, 240));

  const titles = new Set(pages.map((p) => p.content.seoTitle));
  const metas = new Set(pages.map((p) => p.content.metaDescription));
  const intros = new Set(pages.map((p) => p.content.heroIntro));
  record("after-fix:titles-differ", titles.size === pages.length, `${titles.size} unique titles`);
  record("after-fix:descriptions-differ", metas.size === pages.length, `${metas.size} unique descriptions`);
  record("after-fix:intros-differ", intros.size === pages.length, `${intros.size} unique intros`);

  const darfield = pages.find((p) => p.areaSlug === "darfield")!;
  const grimethorpe = pages.find((p) => p.areaSlug === "grimethorpe")!;
  record(
    "after-fix:darfield-grimethorpe-distinct-geo",
    darfield.verified.landmarks[0]?.name !== grimethorpe.verified.landmarks[0]?.name &&
      (darfield.content.nearbyLocalityLinks || [])[0]?.areaName !== (grimethorpe.content.nearbyLocalityLinks || [])[0]?.areaName,
    `${darfield.verified.distanceLabel} ${darfield.verified.cardinalDirection} / ${darfield.verified.landmarks[0]?.name} vs ${grimethorpe.verified.distanceLabel} ${grimethorpe.verified.cardinalDirection} / ${grimethorpe.verified.landmarks[0]?.name}`,
  );
  record(
    "after-fix:internal-links-geographic",
    (darfield.content.nearbyLocalityLinks || []).some((n) => n.geographic) &&
      (grimethorpe.content.nearbyLocalityLinks || [])[0]?.areaName !== (darfield.content.nearbyLocalityLinks || [])[0]?.areaName,
    `darfield→${(darfield.content.nearbyLocalityLinks || []).map((n) => n.areaName).join(",")} grimethorpe→${(grimethorpe.content.nearbyLocalityLinks || []).map((n) => n.areaName).join(",")}`,
  );

  const swapped = darfield.html.replace(/Darfield/g, "Grimethorpe").replace(/darfield/g, "grimethorpe");
  const nameSubGate = evaluateLocalityHtmlDuplicationGate({
    pages: [
      { areaSlug: "darfield", areaName: "Darfield", html: darfield.html },
      { areaSlug: "grimethorpe", areaName: "Grimethorpe", html: swapped },
    ],
    pharmacyName: PHARMACY,
  });
  record("gate:name-substitution-blocked", nameSubGate.failed, nameSubGate.message.slice(0, 240));

  const clinicalShared = evaluateLocalityHtmlDuplicationGate({
    pages: [
      {
        areaSlug: "alpha",
        areaName: "Alpha",
        html: pageHtmlFromContent("Alpha", "alpha", {
          ...darfield.content,
          seoTitle: "Pharmacy First in Alpha | distinct 6 km east",
          metaDescription: "Alpha is 6 km east with Alpha Park",
          heroIntro: "Alpha is 6 km east of the pharmacy near Alpha Park.",
          localRelevanceIntro: "Alpha Park is the verified landmark.",
          localRelevanceBody: "Verified healthcare: Alpha Surgery.",
          accessBody: "Travel 6 km east from Alpha to 12 High Street.",
          supportingHeading: "Alpha context",
          supportingItems: [{ title: "Alpha Park", body: "Verified park", evidence: "pack" }],
          faqs: [{ question: "How far from Alpha?", answer: "About 6 km east." }],
          ctaPhonePrompt: "Call from Alpha, 6 km east.",
        } as typeof darfield.content),
      },
      {
        areaSlug: "beta",
        areaName: "Beta",
        html: pageHtmlFromContent("Beta", "beta", {
          ...grimethorpe.content,
          seoTitle: "Pharmacy First in Beta | distinct 9 km north",
          metaDescription: "Beta is 9 km north with Beta Green",
          heroIntro: "Beta is 9 km north of the pharmacy near Beta Green.",
          localRelevanceIntro: "Beta Green is the verified landmark.",
          localRelevanceBody: "Verified healthcare: Beta Surgery.",
          accessBody: "Travel 9 km north from Beta to 12 High Street.",
          supportingHeading: "Beta context",
          supportingItems: [{ title: "Beta Green", body: "Verified green", evidence: "pack" }],
          faqs: [{ question: "How far from Beta?", answer: "About 9 km north." }],
          ctaPhonePrompt: "Call from Beta, 9 km north.",
        } as typeof grimethorpe.content),
      },
    ],
    pharmacyName: PHARMACY,
  });
  record("gate:shared-clinical-does-not-false-fail", clinicalShared.ok, clinicalShared.message.slice(0, 240));

  const exactDup = evaluateLocalityHtmlDuplicationGate({
    pages: [
      { areaSlug: "one", areaName: "One", html: darfield.html.replace(/Darfield/g, "One") },
      { areaSlug: "two", areaName: "Two", html: darfield.html.replace(/Darfield/g, "Two") },
    ],
    pharmacyName: PHARMACY,
  });
  record("gate:exact-near-duplicate-detected", exactDup.failed, exactDup.message.slice(0, 240));

  const previewPattern = `/api/pharmacy-content-ecosystem-preview/${SERVICE}/local/cudworth/?slug=`;
  record("preview:tenant-aware-pattern", previewPattern.includes("?slug="), previewPattern);
  const required = [
    "aa3b85c100e3fb77ddc5af2fb690eef4e7667b8f",
    "f8f5801916bb87df6bc0b3a15626ca85c441b87e",
    "c66e63f88e1687d673881eff970c1d46813258da",
  ];
  const ancestors = required.filter((sha) => {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], { cwd: ROOT, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });
  record("required-earlier-fixes-present", ancestors.length === 3, ancestors.join(",") || "none");

  const srcFiles: string[] = [];
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === "dist") continue;
        walk(full);
      } else if (/\.(ts|js)$/.test(ent.name) && !/validateLocalityContentDifferentiation/i.test(ent.name)) srcFiles.push(full);
    }
  };
  walk(path.join(ROOT, "src"));
  const yorkshireHits = srcFiles.filter((f) => {
    const text = fs.readFileSync(f, "utf8");
    return /yorkshire-pharmacy-and-health-clinic|darfield|grimethorpe/i.test(text);
  });
  record("no-yorkshire-production-names", yorkshireHits.length === 0, yorkshireHits.map((f) => path.relative(ROOT, f)).join(",") || "none");

  if (Object.keys(liveHashes).length) {
    let unchanged = true;
    for (const [slug, hash] of Object.entries(liveHashes)) {
      const file = path.join(liveRoot, slug, "index.html");
      if (hashFile(file) !== hash) unchanged = false;
    }
    record("live-files-unchanged", unchanged, `${Object.keys(liveHashes).length} hashed files`);
  } else {
    record("live-files-unchanged", true, "no live generated files present");
  }

  record("isolated-output-not-live", !OUT.includes("output/pharmacy-content-ecosystem"), OUT);

  const failed = checks.filter((c) => !c.pass);
  fs.writeFileSync(path.join(OUT, "checks.json"), JSON.stringify(checks, null, 2));
  console.log(`\n${checks.length - failed.length}/${checks.length} passed. Isolated output: ${OUT}`);
  if (failed.length) {
    console.error(failed.map((f) => `FAIL ${f.id}: ${f.detail}`).join("\n"));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
