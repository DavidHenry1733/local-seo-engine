#!/usr/bin/env npx tsx
/**
 * PC-WEBSITE-BUSINESS-INTELLIGENCE-V2-01 — fixture + stored-inventory validation (no live import).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyWebsitePage } from "../src/pharmacy/growthEngineWebsiteClassifier.ts";
import {
  buildCommercialServiceEvidenceFromPages,
  resolveCommercialServiceLabel,
} from "../src/pharmacy/growthEngineWebsiteCommercialServiceEvidence.ts";
import {
  buildAudienceEvidenceFromPages,
  buildCtaEvidenceFromPages,
  buildOfferEvidenceFromPages,
  buildPricingEvidenceFromPages,
  buildTrustEvidenceFromPages,
  extractAudienceEvidenceFromText,
  extractCommercialCtasFromHtml,
  extractEmailCandidatesFromHtml,
  extractPricingEvidenceFromHtml,
  extractSocialProfileEvidenceFromHtml,
  isRejectedSocialUrl,
} from "../src/pharmacy/growthEngineWebsiteBusinessIntelligenceEvidence.ts";
import { validateWebsitePhoneCandidate } from "../src/pharmacy/growthEngineWebsitePhoneValidation.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { resolveMarketScope, resolvePrimaryMarket } from "../src/pharmacy/masterAdminMarketScopeService.ts";
import type { WebsitePageInventoryItem } from "../src/pharmacy/growthEngineWebsiteIntelligenceModel.ts";

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

function page(
  partial: Partial<WebsitePageInventoryItem> & Pick<WebsitePageInventoryItem, "url" | "path" | "title" | "category">,
): WebsitePageInventoryItem {
  return {
    detectedServiceIds: [],
    isContentPage: true,
    fetchStatus: "ok",
    discoverySource: "fixture",
    h1: partial.h1 || "",
    ...partial,
  };
}

function main() {
  console.log("\n=== PC-WEBSITE-BUSINESS-INTELLIGENCE-V2-01 ===\n");

  // --- SERVICE CLASSIFICATION ---
  record(
    "svc-genuine-service",
    classifyWebsitePage("/pharmacy-website-design/", "Pharmacy Website Design", "") === "service-page",
    classifyWebsitePage("/pharmacy-website-design/", "Pharmacy Website Design", ""),
  );
  record(
    "svc-article-not-service",
    classifyWebsitePage(
      "/2026/03/02/how-a-pharmacy-website-helps-patients-find-your-services-online/",
      "How a Pharmacy Website Helps Patients Find Your Services Online",
      "",
    ) === "blog",
    classifyWebsitePage(
      "/2026/03/02/how-a-pharmacy-website-helps-patients-find-your-services-online/",
      "How a Pharmacy Website Helps Patients Find Your Services Online",
      "",
    ),
  );
  record(
    "svc-pricing-not-service",
    classifyWebsitePage("/prices-2/", "Prices - Pharmacy Growth Partner", "") === "pricing",
    classifyWebsitePage("/prices-2/", "Prices - Pharmacy Growth Partner", ""),
  );
  record(
    "svc-offer-not-service",
    classifyWebsitePage("/founder-partner/", "Digital Services for Community Pharmacies", "") === "offer",
    classifyWebsitePage("/founder-partner/", "Digital Services for Community Pharmacies", ""),
  );
  record(
    "svc-landing-not-service",
    classifyWebsitePage("/web-design-landing/", "web design landing", "<h1>Affordable Website Solutions for Pharmacies</h1>") === "landing",
    classifyWebsitePage("/web-design-landing/", "web design landing", ""),
  );
  record(
    "svc-utility-not-service",
    classifyWebsitePage("/hero-3/", "Hero 3 - Pharmacy Growth Partner", "") === "utility"
      && classifyWebsitePage("/audit-thank-you/", "audit thank you", "") === "utility"
      && classifyWebsitePage("/form/", "form", "") === "utility",
    "hero/form/thank-you -> utility",
  );

  const pages: WebsitePageInventoryItem[] = [
    page({
      url: "https://example.com/pharmacy-website-design/",
      path: "/pharmacy-website-design/",
      title: "Pharmacy Website Design | Professional Websites for UK Pharmacies",
      category: "service-page",
      h1: "Web Design Built for Real Pharmacies",
    }),
    page({
      url: "https://example.com/local-seo-for-pharmacies/",
      path: "/local-seo-for-pharmacies/",
      title: "Local SEO for Pharmacies | Improve Google Visibility",
      category: "service-page",
      h1: "Be the First Choice for Local Patients",
    }),
    page({
      url: "https://example.com/pharmacy-website-hosting/",
      path: "/pharmacy-website-hosting/",
      title: "Pharmacy Website Hosting | Secure WordPress Hosting",
      category: "service-page",
      h1: "Hosting Built for Pharmacy Stability",
    }),
    page({
      url: "https://example.com/pharmacy-email-marketing/",
      path: "/pharmacy-email-marketing/",
      title: "Pharmacy Email Communication | Patient Engagement Systems",
      category: "service-page",
      h1: "Protect Your Pharmacy’s Patient Loyalty",
    }),
    page({
      url: "https://example.com/prices-2/",
      path: "/prices-2/",
      title: "Prices",
      category: "pricing",
      h1: "Pharmacy Pricing & Packages",
    }),
    page({
      url: "https://example.com/founder-partner/",
      path: "/founder-partner/",
      title: "Founder Partner",
      category: "offer",
      h1: "Growth Engine Founder Partner Programme",
    }),
    page({
      url: "https://example.com/2026/03/02/how-a-pharmacy-website-helps-patients-find-your-services-online/",
      path: "/2026/03/02/how-a-pharmacy-website-helps-patients-find-your-services-online/",
      title: "How a Pharmacy Website Helps Patients Find Your Services Online",
      category: "blog",
      h1: "How a Pharmacy Website Helps Patients Find Your Services Online",
    }),
    page({
      url: "https://example.com/web-design-landing/",
      path: "/web-design-landing/",
      title: "web design landing",
      category: "landing",
      h1: "Affordable Website Solutions for Pharmacies",
    }),
    page({
      url: "https://example.com/hero-1/",
      path: "/hero-1/",
      title: "Hero 1",
      category: "utility",
      h1: "Your Health, Delivered",
    }),
    page({
      url: "https://example.com/about/",
      path: "/about/",
      title: "About PharmaConnect | Digital Services for Community Pharmacies",
      category: "about",
      h1: "Expertise Rooted in the Pharmacy Sector",
    }),
    page({
      url: "https://example.com/",
      path: "/",
      title: "Home",
      category: "homepage",
      h1: "Digital Services Built Specifically for Pharmacies",
    }),
  ];

  const htmlMap: Record<string, string> = {
    "https://example.com/": `<html><head><meta name="description" content="Professional pharmacy websites designed to help UK community pharmacies increase visibility and bookings."/></head>
<body><h1>Digital Services</h1><a href="/contact-us/">Request a Free Audit</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>
<a href="https://www.linkedin.com/company/example-agency">LinkedIn</a>
<a href="mailto:hello@example.com">Email</a>
<a href="tel:+441709210731">Call</a>
<footer>Built for community pharmacies</footer></body></html>`,
    "https://example.com/pharmacy-website-design/": `<html><head><meta name="description" content="Website design for UK pharmacies."/></head>
<body><h1>Web Design Built for Real Pharmacies</h1><a class="btn" href="/contact">Contact Us</a><a href="/contact">Get Started</a></body></html>`,
    "https://example.com/prices-2/": `<html><body><h1>Pharmacy Pricing & Packages</h1><h2>Growth Package</h2><p>From £299/year for website hosting packages.</p><p>25% discount for annual plans.</p><p>Call us on room 12</p></body></html>`,
    "https://example.com/founder-partner/": `<html><head><meta name="description" content="Founder Partner programme for community pharmacies."/></head>
<body><h1>Growth Engine Founder Partner Programme</h1><a href="/contact">Join Founder Partner</a></body></html>`,
    "https://example.com/about/": `<html><head><meta name="description" content="About our digital consultancy for community pharmacies."/></head>
<body><h1>About</h1><p>Founded by Alex Example with over 15 years of experience in the pharmacy sector.</p>
<blockquote class="testimonial">They transformed our patient bookings.</blockquote></body></html>`,
  };

  const commercial = buildCommercialServiceEvidenceFromPages(pages, htmlMap);
  const commercialNames = commercial.map((c) => c.serviceName).join(" · ");
  record(
    "commercial-only-core-services",
    commercial.length === 4
      && commercial.every((c) => /website design|local seo|hosting|email/i.test(c.serviceName))
      && !commercial.some((c) => /pricing|founder|how a pharmacy|affordable website/i.test(c.serviceName)),
    commercialNames || "none",
  );
  record(
    "service-label-not-slogan",
    /pharmacy website design/i.test(resolveCommercialServiceLabel(pages[0]!))
      && !/built for real pharmacies/i.test(resolveCommercialServiceLabel(pages[0]!)),
    resolveCommercialServiceLabel(pages[0]!),
  );

  // --- AUDIENCE ---
  const audience = buildAudienceEvidenceFromPages(pages, htmlMap, htmlMap["https://example.com/"]!.match(/content="([^"]+)"/)![1], "https://example.com/");
  record(
    "audience-explicit",
    audience.some((a) => /community pharmacies|uk community pharmacies/i.test(a.value)) && audience.every((a) => a.sourceUrl && a.evidence),
    audience.map((a) => a.value).join(" · ") || "none",
  );
  record(
    "audience-incidental-noun-rejected",
    extractAudienceEvidenceFromText("Patients often ask about bookings online.", "https://example.com/blog").length === 0,
    "incidental patients/bookings not extracted",
  );

  // --- PRICING / OFFER ---
  const pricing = extractPricingEvidenceFromHtml(htmlMap["https://example.com/prices-2/"]!, "https://example.com/prices-2/");
  record(
    "pricing-commercial-context",
    pricing.some((p) => p.kind === "price" && /£299/.test(p.value)) && pricing.some((p) => /25%/.test(p.value)),
    pricing.map((p) => `${p.kind}:${p.value}`).join(" · "),
  );
  record(
    "pricing-unrelated-number-rejected",
    !extractPricingEvidenceFromHtml("<p>See room 12 and aisle 25 today.</p>", "https://example.com/x/").some((p) => p.kind === "price"),
    "no invented prices from unrelated numbers",
  );
  const offers = buildOfferEvidenceFromPages(pages, htmlMap);
  record(
    "offer-founder-partner",
    offers.some((o) => /founder partner/i.test(o.offerName) && o.offerType === "programme"),
    offers.map((o) => `${o.offerName}:${o.offerType}`).join(" · "),
  );

  // --- CTA ---
  const ctas = buildCtaEvidenceFromPages(pages, htmlMap);
  record(
    "cta-meaningful",
    ctas.some((c) => /request a free audit/i.test(c.ctaText)) && ctas.some((c) => /get started|contact us|join founder partner/i.test(c.ctaText)),
    [...new Set(ctas.map((c) => c.ctaText))].join(" · "),
  );
  record(
    "cta-nav-label-rejected",
    extractCommercialCtasFromHtml('<nav><a href="/">Home</a><a href="/about">About Us</a><a href="/blog">Blog</a></nav>', "https://example.com/").length === 0,
    "nav-only labels excluded",
  );

  // --- CONTACT ---
  const emails = extractEmailCandidatesFromHtml(htmlMap["https://example.com/"]!, "https://example.com/", "example.com");
  record("contact-mailto", emails.some((e) => e.value === "hello@example.com" && e.detectionMethod === "mailto-link"), emails.map((e) => e.value).join(","));
  const phoneOk = validateWebsitePhoneCandidate("01709 210731");
  const phoneBad = validateWebsitePhoneCandidate("12");
  record("contact-tel-valid", phoneOk.valid && !phoneBad.valid, `${phoneOk.normalised} / reject=${phoneBad.reason}`);

  // --- TRUST ---
  const trust = buildTrustEvidenceFromPages(pages, htmlMap);
  record(
    "trust-about-founder-experience",
    trust.some((t) => t.kind === "about_description")
      && trust.some((t) => t.kind === "founder")
      && trust.some((t) => t.kind === "experience"),
    trust.map((t) => t.kind).join(","),
  );
  record(
    "trust-generic-adjective-rejected",
    buildTrustEvidenceFromPages(
      [page({ url: "https://example.com/about-x", path: "/about-x", title: "About", category: "about", h1: "We are amazing" })],
      { "https://example.com/about-x": "<p>We are amazing, innovative and passionate.</p>" },
    ).every((t) => t.kind !== "proof_point" && t.kind !== "credential"),
    "generic adjectives not treated as proof",
  );

  // --- SOCIAL ---
  const social = extractSocialProfileEvidenceFromHtml(htmlMap["https://example.com/"]!, "https://example.com/");
  record(
    "social-canonical-accepted",
    social.some((s) => s.platform === "linkedin" && /company\/example-agency/i.test(s.url)),
    social.map((s) => `${s.platform}:${s.url}`).join(" · ") || "none",
  );
  record(
    "social-share-rejected",
    isRejectedSocialUrl("https://www.facebook.com/sharer/sharer.php?u=x")
      && isRejectedSocialUrl("https://facebook.com/")
      && !isRejectedSocialUrl("https://www.facebook.com/MyBusinessPage"),
    "share/login/generic rejected; profile accepted",
  );

  // --- IDENTITY / NATIONAL SAFETY via stored PharmaConnect snapshot (read-only) ---
  const pcPath = path.join(ROOT, "data/pharmacy-profiles/pharmaconnect.json");
  const beforeHash = fs.readFileSync(pcPath);
  const pc = JSON.parse(beforeHash.toString("utf8"));
  const data = pc.data || pc;
  const snap = data.websiteImportSnapshot || {};
  const intel = snap.intelligence || {};
  const pagesStored = (intel.structure?.pages || []) as WebsitePageInventoryItem[];
  record("snapshot-timestamp", snap.importedAt === "2026-08-10T09:46:16.566Z", String(snap.importedAt));
  record("snapshot-pages-28", pagesStored.length === 28, String(pagesStored.length));

  const reclass = pagesStored.map((p) => ({
    ...p,
    category: classifyWebsitePage(p.path, p.title || "", ""),
  }));
  const recoveredCommercial = buildCommercialServiceEvidenceFromPages(reclass, {});
  const recoveredOffers = buildOfferEvidenceFromPages(reclass, {});
  const recoveredPricing = buildPricingEvidenceFromPages(reclass, {});
  const recoveredAudience = buildAudienceEvidenceFromPages(
    reclass,
    {},
    String(intel.identity?.metaDescription || snap.description || ""),
    String(intel.identity?.resolvedUrl || snap.websiteUrl || "https://pharmaconnect.uk/"),
  );
  const recoveredTrust = buildTrustEvidenceFromPages(reclass, {});
  const utilityInfluence = recoveredCommercial.some((c) => /hero|form|thank-you|import-test/i.test(c.sourceUrl));

  record(
    "pc-core-services-semantic",
    recoveredCommercial.length === 4
      && recoveredCommercial.every((c) =>
        /website design|local seo|hosting|email communication|email marketing/i.test(c.serviceName),
      ),
    recoveredCommercial.map((c) => c.serviceName).join(" · "),
  );
  record(
    "pc-article-excluded",
    !recoveredCommercial.some((c) => /2026\/03\//.test(c.sourceUrl)),
    "no dated article in commercial services",
  );
  record(
    "pc-pricing-as-commercial",
    recoveredPricing.some((p) => /prices-2/i.test(p.sourceUrl)) && !recoveredCommercial.some((c) => /prices-2/i.test(c.sourceUrl)),
    recoveredPricing.map((p) => p.value).join(" · "),
  );
  record(
    "pc-founder-as-offer",
    recoveredOffers.some((o) => /founder partner/i.test(o.offerName) && o.offerType === "programme")
      && !recoveredCommercial.some((c) => /founder/i.test(c.serviceName)),
    recoveredOffers.map((o) => `${o.offerName}:${o.offerType}`).join(" · "),
  );
  record(
    "pc-landing-excluded",
    !recoveredCommercial.some((c) => /web-design-landing/i.test(c.sourceUrl)),
    "landing not in services",
  );
  record("pc-utility-no-bi", !utilityInfluence, utilityInfluence ? "utility leaked" : "utility excluded from services");
  record(
    "pc-audience-from-stored-meta",
    recoveredAudience.some((a) => /pharmac/i.test(a.value)),
    recoveredAudience.map((a) => a.value).join(" · ") || "none",
  );
  record(
    "pc-trust-inventory-about",
    recoveredTrust.some((t) => t.kind === "about_description" && /about-pharmaconnect/i.test(t.sourceUrl)),
    recoveredTrust.map((t) => `${t.kind}:${t.value.slice(0, 40)}`).join(" · ") || "none",
  );

  const scope = resolveMarketScope("pharmaconnect", data);
  const primaryMarket = resolvePrimaryMarket("pharmaconnect", data);
  record(
    "national-identity",
    /pharmaconnect/i.test(String(intel.business?.businessName?.selected || data.pharmacyName || ""))
      && scope === "national"
      && /united kingdom/i.test(String(primaryMarket || "")),
    `name=${intel.business?.businessName?.selected} scope=${scope} market=${primaryMarket}`,
  );
  record(
    "branch-selection-inactive",
    !(snap.branchSelection && snap.branchSelection.requiresSelection === true),
    JSON.stringify(snap.branchSelection?.requiresSelection ?? false),
  );

  // Leeds untouched marker
  const leedsPath = path.join(ROOT, "data/pharmacy-profiles/leeds-pharmacy.json");
  const leedsMtimeBefore = fs.existsSync(leedsPath) ? fs.statSync(leedsPath).mtimeMs : 0;
  record("leeds-present", fs.existsSync(leedsPath), leedsPath);

  // Snapshot must remain byte-identical after this validation (read-only).
  const afterHash = fs.readFileSync(pcPath);
  record("snapshot-unchanged", Buffer.compare(beforeHash, afterHash) === 0, "pharmaconnect.json bytes unchanged");
  record(
    "leeds-mtime-unchanged",
    !fs.existsSync(leedsPath) || fs.statSync(leedsPath).mtimeMs === leedsMtimeBefore,
    "leeds profile not modified",
  );

  // Provenance on recovered facts
  record(
    "provenance-source-url",
    recoveredCommercial.every((c) => c.sourceUrl && c.evidence?.sourceUrl) && recoveredAudience.every((a) => a.sourceUrl),
    "commercial+audience retain sourceUrl",
  );

  const failed = checks.filter((c) => !c.pass);
  const report = {
    ticket: "PC-WEBSITE-BUSINESS-INTELLIGENCE-V2-01",
    generatedAt: new Date().toISOString(),
    pass: failed.length === 0,
    checks,
    pharmaconnectRecovered: {
      commercialServices: recoveredCommercial.map((c) => ({ name: c.serviceName, url: c.sourceUrl })),
      offers: recoveredOffers.map((o) => ({ name: o.offerName, type: o.offerType, url: o.sourceUrl })),
      pricing: recoveredPricing.map((p) => ({ kind: p.kind, value: p.value, url: p.sourceUrl })),
      audience: recoveredAudience.map((a) => ({ value: a.value, url: a.sourceUrl, method: a.extractionMethod })),
      trust: recoveredTrust.map((t) => ({ kind: t.kind, value: t.value.slice(0, 80), url: t.sourceUrl })),
      note: "Contact phone/email and rich CTA/social/pricing amounts require fresh import HTML — not present in stored snapshot page bodies.",
    },
  };
  const outDir = path.join(ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "website-business-intelligence-v2-01.json"), JSON.stringify(report, null, 2));

  console.log(`\n${failed.length ? "FAIL" : "PASS"} — ${checks.length - failed.length}/${checks.length} checks\n`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.id}: ${f.detail}`);
    process.exit(1);
  }
}

main();
