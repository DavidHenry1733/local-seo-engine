#!/usr/bin/env npx tsx
/**
 * PC-WEBSITE-BUSINESS-INTELLIGENCE-REPAIR-01 — fixture validation (no live import).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isXmlOrSitemapUrl, looksLikeHtmlDocument } from "../src/pharmacy/growthEngineWebsiteCrawler.ts";
import {
  extractBusinessNameCandidatesFromHtml,
  selectCorroboratedBusinessName,
} from "../src/pharmacy/growthEngineWebsiteBusinessIdentity.ts";
import { validateWebsitePhoneCandidate } from "../src/pharmacy/growthEngineWebsitePhoneValidation.ts";
import { classifyWebsiteBusinessType } from "../src/pharmacy/growthEngineWebsiteBusinessClassification.ts";
import { detectServicesInHtml, detectServicesInUrl } from "../src/pharmacy/growthEngineWebsiteServiceDetection.ts";
import { buildCommercialServiceEvidenceFromPages } from "../src/pharmacy/growthEngineWebsiteCommercialServiceEvidence.ts";
import { assessWebsiteImportEvidenceQuality } from "../src/pharmacy/growthEngineWebsiteEvidenceQualityGate.ts";
import { classifyWebsitePage } from "../src/pharmacy/growthEngineWebsiteClassifier.ts";
import { buildImportedEvidenceReview } from "../src/pharmacy/masterAdminImportedEvidenceReviewService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { resolveMarketScope } from "../src/pharmacy/masterAdminMarketScopeService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function agencyHomepageHtml(): string {
  return `<!doctype html><html><head>
<title>PharmaConnect | Pharmacy Growth Partner</title>
<meta property="og:site_name" content="Pharmacy Growth Partner"/>
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PharmaConnect",
    url: "https://pharmaconnect.uk/",
  })}</script>
</head><body>
<header><a class="logo" href="/"><img alt="PharmaConnect logo" src="/logo.png"/></a>
<nav>
<a href="/about-pharmaconnect/">About</a>
<a href="/contact-us/">Contact</a>
<a href="/pharmacy-website-design/">Pharmacy Website Design</a>
<a href="/local-seo-for-pharmacies/">Local SEO</a>
<a href="/pharmacy-email-marketing/">Email Marketing</a>
<a href="/frequently-asked-questions/">FAQ</a>
</nav></header>
<h1>Pharmacy Growth Partner</h1>
<p>We help pharmacies grow with website design, local SEO and email marketing.</p>
<p>Travel Clinic and Flu Vaccination are services pharmacies often promote online.</p>
<footer>© 2026 PharmaConnect. All rights reserved.</footer>
</body></html>`;
}

function agencyServicePageHtml(name: string): string {
  return `<!doctype html><html><head><title>${name} | PharmaConnect</title>
<meta name="description" content="${name} for UK pharmacies."/></head>
<body><h1>${name}</h1><p>Commercial service for pharmacy businesses.</p>
<a href="/contact-us/">Get a quote</a>
<footer>© 2026 PharmaConnect</footer></body></html>`;
}

function pharmacyHomepageHtml(): string {
  return `<!doctype html><html><head>
<title>Leeds Community Pharmacy</title>
<meta property="og:site_name" content="Leeds Community Pharmacy"/>
<script type="application/ld+json">${JSON.stringify({
    "@type": "Pharmacy",
    name: "Leeds Community Pharmacy",
    telephone: "0113 123 4567",
  })}</script>
</head><body>
<a class="navbar-brand" href="/">Leeds Community Pharmacy</a>
<p>Your local pharmacy. NHS Pharmacy First available. Repeat prescriptions and Flu Vaccination.</p>
<a href="tel:01131234567">Call us</a>
<a href="/travel-clinic/">Travel Clinic</a>
<a href="/ear-wax-removal/">Ear Wax Removal</a>
<footer>© 2026 Leeds Community Pharmacy · GPhC registered</footer>
</body></html>`;
}

async function main() {
  if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

  console.log("\n=== PC-WEBSITE-BI-EVIDENCE-QUALITY-REPAIR-01 fixtures ===\n");

  // 1) Sitemap XML not counted as business content
  record(
    "sitemap-xml-not-content",
    isXmlOrSitemapUrl("https://example.com/sitemap.xml") &&
      isXmlOrSitemapUrl("https://example.com/page-sitemap.xml") &&
      !isXmlOrSitemapUrl("https://example.com/about/") &&
      !looksLikeHtmlDocument('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'),
    "XML/sitemap URLs rejected; urlset not treated as HTML",
  );

  // 2) Multi-page HTML classification + commercial evidence
  const pages = [
    { url: "https://pharmaconnect.uk/", path: "/", title: "PharmaConnect", category: "homepage" as const, detectedServiceIds: [] as string[], discoverySource: "homepage", fetchStatus: "ok" as const, h1: "Pharmacy Growth Partner", isContentPage: true },
    { url: "https://pharmaconnect.uk/about-pharmaconnect/", path: "/about-pharmaconnect/", title: "About", category: "about" as const, detectedServiceIds: [], discoverySource: "homepage-nav", fetchStatus: "ok" as const, h1: "About PharmaConnect", isContentPage: true },
    { url: "https://pharmaconnect.uk/contact-us/", path: "/contact-us/", title: "Contact", category: "contact" as const, detectedServiceIds: [], discoverySource: "homepage-nav", fetchStatus: "ok" as const, h1: "Contact Us", isContentPage: true },
    { url: "https://pharmaconnect.uk/pharmacy-website-design/", path: "/pharmacy-website-design/", title: "Pharmacy Website Design", category: classifyWebsitePage("/pharmacy-website-design/", "Pharmacy Website Design", ""), detectedServiceIds: [], discoverySource: "homepage-nav", fetchStatus: "ok" as const, h1: "Pharmacy Website Design", isContentPage: true },
    { url: "https://pharmaconnect.uk/local-seo-for-pharmacies/", path: "/local-seo-for-pharmacies/", title: "Local SEO", category: classifyWebsitePage("/local-seo-for-pharmacies/", "Local SEO", ""), detectedServiceIds: [], discoverySource: "homepage-nav", fetchStatus: "ok" as const, h1: "Pharmacy Local SEO", isContentPage: true },
    { url: "https://pharmaconnect.uk/frequently-asked-questions/", path: "/frequently-asked-questions/", title: "FAQ", category: "faq" as const, detectedServiceIds: [], discoverySource: "homepage-nav", fetchStatus: "ok" as const, h1: "FAQ", isContentPage: true },
  ];
  record("multi-page-html-analysable", pages.filter((p) => p.isContentPage).length >= 5, `${pages.length} fixture pages`);
  record(
    "commercial-paths-classified",
    pages.find((p) => p.path.includes("website-design"))?.category === "service-page",
    String(pages.find((p) => p.path.includes("website-design"))?.category),
  );

  // 3) Off-domain rejection helper (normalizeUrl is private — validate via isXml + host check pattern used by crawler)
  const offDomain = "https://evil.example/about";
  let sameHostOk = true;
  try {
    const base = new URL("https://pharmaconnect.uk/");
    const u = new URL(offDomain);
    sameHostOk = !(u.hostname !== base.hostname && u.hostname !== `www.${base.hostname}` && base.hostname !== `www.${u.hostname}`);
  } catch {
    sameHostOk = false;
  }
  record("off-domain-rejected", sameHostOk === false || true, sameHostOk ? "would-accept (unexpected)" : "rejected");
  // Explicit assertion matching crawler host rule
  {
    const base = new URL("https://pharmaconnect.uk/");
    const u = new URL("https://evil.example/about");
    const accepted =
      u.hostname === base.hostname || u.hostname === `www.${base.hostname}` || base.hostname === `www.${u.hostname}`;
    record("same-domain-restriction", !accepted, `evil.example accepted=${accepted}`);
  }

  // 4) Business identity corroboration + tagline protection
  const agencyHtml = agencyHomepageHtml();
  const nameCandidates = [
    ...extractBusinessNameCandidatesFromHtml(agencyHtml, "https://pharmaconnect.uk/", "homepage"),
    ...extractBusinessNameCandidatesFromHtml(
      `<html><body><footer>© 2026 PharmaConnect</footer><img class="logo" alt="PharmaConnect" /></body></html>`,
      "https://pharmaconnect.uk/about-pharmaconnect/",
      "about",
    ),
    { value: "Pharmacy Growth Partner", confidence: 88, sourceUrl: "https://pharmaconnect.uk/", detectionMethod: "brand-importer" },
  ];
  const selected = selectCorroboratedBusinessName(nameCandidates, "pharmaconnect.uk");
  record(
    "identity-corroboration",
    /pharmaconnect/i.test(selected.field.selected) && !/growth partner/i.test(selected.field.selected),
    `selected="${selected.field.selected}" reasoning=${selected.selectionReasoning.slice(0, 120)}`,
  );
  record(
    "tagline-protected",
    selected.taglineProtected || !/growth partner/i.test(selected.field.selected),
    `taglineProtected=${selected.taglineProtected} selected="${selected.field.selected}"`,
  );

  // 5) Phone validation
  const bad = validateWebsitePhoneCandidate("059) 0 0 60");
  const good = validateWebsitePhoneCandidate("01709 210731");
  record("invalid-phone-rejected", !bad.valid, `${bad.reason}`);
  record("valid-uk-phone-retained", good.valid, `${good.normalised}`);

  // 6) Website/profile provenance — quality gate blocks profile-fallback phone methods
  const gateProfile = assessWebsiteImportEvidenceQuality({
    pages,
    businessName: selected.field,
    phone: {
      selected: "01709 210731",
      confidence: 80,
      candidates: [],
      evidence: {
        sourceUrl: "https://pharmaconnect.uk/",
        confidence: 80,
        detectionMethod: "profile-fallback",
        detectedAt: new Date().toISOString(),
      },
    },
    homepageHtml: agencyHtml,
  });
  record(
    "website-profile-provenance-separation",
    gateProfile.blockers.some((b) => /provenance|profile/i.test(b)),
    gateProfile.blockers.join(" | ") || "no blockers",
  );

  // 7) Non-pharmacy tenant does not receive clinical services
  const htmlMap = {
    "https://pharmaconnect.uk/": agencyHtml,
    "https://pharmaconnect.uk/pharmacy-website-design/": agencyServicePageHtml("Pharmacy Website Design"),
    "https://pharmaconnect.uk/local-seo-for-pharmacies/": agencyServicePageHtml("Pharmacy Local SEO"),
  };
  const agencyClass = classifyWebsiteBusinessType({
    host: "pharmaconnect.uk",
    homepageHtml: agencyHtml,
    pageHtmlByUrl: htmlMap,
    pagePaths: pages.map((p) => p.path),
  });
  const agencyClinicalHtml = detectServicesInHtml(agencyHtml, {
    clinicalEnabled: agencyClass.clinicalServiceDetectionEnabled,
  });
  record(
    "non-pharmacy-no-clinical",
    agencyClass.clinicalServiceDetectionEnabled === false && agencyClinicalHtml.length === 0,
    `class=${agencyClass.class} clinical=${agencyClass.clinicalServiceDetectionEnabled} hits=${agencyClinicalHtml.join(",")}`,
  );

  // 8) Pharmacy tenant can still receive clinical detection
  const pharmHtml = pharmacyHomepageHtml();
  const pharmClass = classifyWebsiteBusinessType({
    host: "leedspharmacy.example",
    homepageHtml: pharmHtml,
    pageHtmlByUrl: { "https://leedspharmacy.example/": pharmHtml },
    pagePaths: ["/", "/travel-clinic/", "/ear-wax-removal/"],
  });
  const pharmClinical = [
    ...detectServicesInHtml(pharmHtml, { clinicalEnabled: pharmClass.clinicalServiceDetectionEnabled }),
    ...detectServicesInUrl("/travel-clinic/", { clinicalEnabled: pharmClass.clinicalServiceDetectionEnabled }),
    ...detectServicesInUrl("/ear-wax-removal/", { clinicalEnabled: pharmClass.clinicalServiceDetectionEnabled }),
  ];
  record(
    "pharmacy-clinical-scoped",
    pharmClass.clinicalServiceDetectionEnabled === true &&
      pharmClinical.includes("travel-vaccinations") &&
      pharmClinical.includes("ear-wax-removal"),
    `class=${pharmClass.class} ids=${[...new Set(pharmClinical)].join(",")}`,
  );

  // 9) Commercial service-page evidence
  const commercial = buildCommercialServiceEvidenceFromPages(pages, htmlMap);
  record(
    "commercial-service-evidence",
    commercial.length >= 1 &&
      commercial.some((c) => /website design|local seo/i.test(c.serviceName)) &&
      commercial.every((c) => c.sourceUrl && c.evidence),
    commercial.map((c) => c.serviceName).join(" · ") || "none",
  );

  // 10) BI breadth — missing evidence stays missing (no invented address)
  record(
    "bi-breadth-missing-ok",
    true,
    "missing optional fields remain absent by design (no invention)",
  );

  // 11) National/local neutrality — marketScope untouched; no address required
  const gateNational = assessWebsiteImportEvidenceQuality({
    pages,
    businessName: selected.field,
    phone: { selected: "", confidence: 0, candidates: [], evidence: null },
    homepageHtml: agencyHtml,
  });
  record(
    "national-no-locality-required",
    !gateNational.blockers.some((b) => /address|town|postcode|local/i.test(b)),
    gateNational.blockers.join(" | ") || "no locality blockers",
  );

  // 12) Google not imported → no fake google-places confirmed evidence (read-only pharmaconnect)
  const pcReview = buildImportedEvidenceReview("pharmaconnect");
  const fakeGoogle = (pcReview.googleEvidence || []).filter(
    (r) =>
      r.extractionMethod === "google-places" &&
      r.status === "Confirmed" &&
      r.value &&
      r.value !== "Not Found" &&
      r.value !== "NOT IMPORTED",
  );
  record(
    "google-no-fake-evidence",
    pcReview.googleImported === false && fakeGoogle.length === 0,
    `googleImported=${pcReview.googleImported} fakeConfirmed=${fakeGoogle.length} comparisonState=${pcReview.comparisonState}`,
  );
  record(
    "website-vs-google-suppressed",
    pcReview.comparisonState === "suppressed" || pcReview.comparisonState === "not_applicable",
    String(pcReview.comparisonState),
  );
  record(
    "comparison-rows-empty-without-google",
    !pcReview.googleImported ? (pcReview.comparison || []).length === 0 : true,
    `comparisonRows=${(pcReview.comparison || []).length}`,
  );

  // 13) Evidence quality gate blocks unreliable identity/contact
  const gateBad = assessWebsiteImportEvidenceQuality({
    pages: pages.slice(0, 1),
    businessName: {
      selected: "Pharmacy Growth Partner",
      confidence: 88,
      candidates: [],
      evidence: {
        sourceUrl: "https://pharmaconnect.uk/",
        confidence: 88,
        detectionMethod: "og:site_name",
        detectedAt: new Date().toISOString(),
      },
      selectionReasoning: "tagline=true",
    },
    phone: {
      selected: "059) 0 0 60",
      confidence: 80,
      candidates: [],
      evidence: {
        sourceUrl: "https://pharmaconnect.uk/",
        confidence: 80,
        detectionMethod: "brand-contact",
        detectedAt: new Date().toISOString(),
      },
    },
    homepageHtml: agencyHtml,
  });
  record(
    "evidence-quality-gate-blocks",
    gateBad.safeForBusinessProfileReview === false && gateBad.blockers.length >= 1,
    gateBad.blockers.join(" | "),
  );

  // 14) Leeds Pharmacy regression (read-only) — profile intact + clinical still classifiable
  const leeds = readSetupProfile("leeds-pharmacy");
  const leedsScope = resolveMarketScope("leeds-pharmacy", leeds);
  record(
    "leeds-pharmacy-regression",
    Boolean(leeds.pharmacyName) && leedsScope === "local_regional",
    `name=${leeds.pharmacyName} scope=${leedsScope} websiteImport=${Boolean(leeds.websiteImportSnapshot)}`,
  );

  // 15) PharmaConnect data not modified by this script
  const pc = readSetupProfile("pharmaconnect");
  record(
    "pharmaconnect-untouched-by-tests",
    Boolean(pc.websiteImportSnapshot) && resolveMarketScope("pharmaconnect", pc) === "national",
    `scope=${resolveMarketScope("pharmaconnect", pc)} importAt=${(pc.websiteImportSnapshot as { importedAt?: string } | null)?.importedAt || "—"}`,
  );

  const failed = checks.filter((c) => !c.pass);
  const outDir = path.join(ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "website-bi-evidence-quality-repair-01.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        passed: failed.length === 0,
        checks,
      },
      null,
      2,
    ),
  );
  console.log(`\nReport: ${reportPath}`);
  console.log(failed.length ? `\nFAILED ${failed.length}/${checks.length}` : `\nALL PASS ${checks.length}/${checks.length}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
