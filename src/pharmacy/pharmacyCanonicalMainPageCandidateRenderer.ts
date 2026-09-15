/**
 * Isolated Pharmacy First main-page candidate assembly.
 * Does not call the live service-page renderer, local/cluster renderers,
 * profile local-access HTML, maps, directions, selectedAreas, or contract repair.
 */
import fs from "node:fs";
import path from "node:path";

import { buildPharmacyThemeWithBrandDna, buildGoogleFontsLink } from "./pharmacyBrandDnaResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { loadCampaignImagePlan } from "./growthEngineCampaignBuilderImagePlanService.ts";
import { publicAssetHref } from "./pharmacyImageSlotRenderHelpers.ts";
import {
  buildPharmacyServicePageStyleBlock,
  PHARMACY_SERVICE_PAGE_TEMPLATE_ID,
} from "./pharmacyServicePageDesignSystem.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { normalizeTelHref } from "./pharmacyServicePageProfileContext.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { resolveCommercialLogoUrl } from "./pharmacyBusinessFieldSanitizer.ts";
import { loadServiceVariantPack, type SectionVariant, type FaqVariant } from "./pharmacyServiceVariantLibrary.ts";
import { WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const CANONICAL_MAIN_PAGE_CANDIDATE_ASSET = "canonical-main-page-candidate";
export const PRIOR_NAMED_CONDITION_BANK_HASH =
  "3e7ee7f5724e48b5e5d6b76ecb14d50008d0f55746d467b3e243713576e3795e";
export const CURRENT_APPROVED_BANK_HASH =
  "46de67243945c2bc572cba35aa9ac0fdd5806fb8813fbf89506bdfabdd517cdb";

const REQUIRED_CONDITION_NAMES = [
  "sore throat",
  "earache",
  "impetigo",
  "infected insect bites",
  "shingles",
  "sinusitis",
] as const;

const TARGET_AREA_BLOCKLIST = [
  "darfield",
  "wombwell",
  "worsbrough",
  "thurnscoe",
  "grimethorpe",
  "goldthorpe",
  "hoyland",
  "cudworth",
  "royston",
  "chapeltown",
  "barnsley",
];

const PHOTOGRAPHIC_SLOTS = ["hero", "support", "trust", "conversion"] as const;
const ALL_PLAN_SLOTS = [...PHOTOGRAPHIC_SLOTS, "local"] as const;

function isPhotographicAssetPath(filePath: string): boolean {
  return /\.(webp|jpe?g|png)$/i.test(filePath);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function hasLocalityPlaceholder(value: string): boolean {
  return /\byour area\b/i.test(value) || /\bfrom your area\b/i.test(value) || /\bin your area\b/i.test(value);
}

function stripLocalityPlaceholders(value: string): string {
  return value
    .replace(/\bafter symptoms start in your area,?\s*/gi, "after symptoms start, ")
    .replace(/\s+in your area\b/gi, "")
    .replace(/\s+from your area\b/gi, "")
    .replace(/\bbefore travelling from your area\b/gi, "")
    .replace(/\byour area\b/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function storedAuthoritativeLogoUrl(data: { headerLogoUrl?: string; logoUrl?: string } | undefined): string {
  for (const candidate of [data?.headerLogoUrl, data?.logoUrl]) {
    const url = String(candidate || "").trim();
    if (/^https?:\/\//i.test(url) && /\.(png|jpe?g|webp|svg|gif)(\?|#|$)/i.test(url)) return url;
  }
  return "";
}

function uniqueItems(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const text = item.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const key = normalizeText(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function firstLocalityFreeVariant(pool: SectionVariant[] | undefined): SectionVariant {
  const variants = (pool || []).filter((row) => {
    const blob = `${row.heading || ""} ${row.body || ""} ${(row.bullets || []).join(" ")}`;
    return !hasLocalityPlaceholder(blob);
  });
  const chosen = variants[0] || pool?.[0];
  if (!chosen?.body?.trim()) {
    throw new Error("currentBank.sectionVariant.missing");
  }
  return chosen;
}

function loadPriorNamedConditionSource(): { intro: string; names: string[] } {
  const relative = `data/pharmacy-approved-service-banks/banks/pharmacy-first/${PRIOR_NAMED_CONDITION_BANK_HASH}.json`;
  const absolute = path.join(WORKSPACE_ROOT, relative);
  if (!fs.existsSync(absolute)) {
    throw new Error("priorBank.eligibility.namedConditionSet");
  }
  const prior = JSON.parse(fs.readFileSync(absolute, "utf8")) as { eligibility?: SectionVariant[] };
  const variant = (prior.eligibility || []).find((row) =>
    /sore throat/i.test(row.body || "") && /uncomplicated UTI/i.test(row.body || ""),
  );
  if (!variant?.body?.trim()) {
    throw new Error("priorBank.eligibility.namedConditionSet");
  }
  const intro = variant.body.trim();
  if (!REQUIRED_CONDITION_NAMES.every((name) => intro.toLowerCase().includes(name))) {
    throw new Error("priorBank.eligibility.namedConditionSet");
  }
  if (!/in eligible women/i.test(intro) || !/pharmacist confirms what can be assessed/i.test(intro)) {
    throw new Error("priorBank.eligibility.namedConditionQualifications");
  }
  return {
    intro,
    names: [
      "Sore throat",
      "Earache",
      "Impetigo",
      "Infected insect bites",
      "Shingles",
      "Sinusitis",
      "Uncomplicated urinary tract infection",
    ],
  };
}

function visibleText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTagTexts(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const text = match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  }
  return out;
}

function renderContentCardGrid(
  cards: Array<{ title: string; body: string }>,
  options: { gridClass?: string; process?: boolean } = {},
): string {
  if (!cards.length) throw new Error("candidate.grid.cards.missing");
  if (cards.some((card) => !card.title.trim() || !card.body.trim())) {
    throw new Error("candidate.grid.headingOnlyCard");
  }
  const cols = cards.length;
  const items = cards
    .map((card, index) => {
      const processAttrs = options.process
        ? ` data-process-step="${index + 1}" aria-label="Step ${index + 1}. ${esc(card.title)}"`
        : "";
      const stepIcon = options.process
        ? `<div class="icon step-icon" aria-hidden="true"><span class="step-number">${index + 1}</span></div>`
        : "";
      return `<article class="card candidate-content-card"${processAttrs}><div class="card-title-block">${stepIcon}<h3>${esc(card.title)}</h3></div><p class="card-body">${esc(card.body)}</p></article>`;
    })
    .join("");
  return `<div class="${options.gridClass || "candidate-card-grid"}" data-candidate-grid="true" data-grid-mode="exact" data-grid-cards="${cols}" data-grid-cols="${cols}">${items}</div>`;
}

function renderCompactConditionList(names: string[]): string {
  if (names.length !== 7) throw new Error("priorBank.eligibility.namedConditionSet.count");
  const items = names
    .map((name) => `<li class="condition-chip"><span>${esc(name)}</span></li>`)
    .join("");
  return `<ul class="condition-list" data-condition-layout="four-plus-three">${items}</ul>`;
}

function renderSlotImage(
  href: string,
  alt: string,
  slot: string,
  panelClass: string,
  eager = false,
): string {
  const loading = eager ? "eager" : "lazy";
  const fetchPriority = eager ? ' fetchpriority="high"' : "";
  return `<div class="${panelClass}" data-image-slot="${esc(slot)}"><img src="${esc(href)}" alt="${esc(alt)}" loading="${loading}" decoding="async"${fetchPriority}/></div>`;
}

export function canonicalMainPageCandidateOutputPath(slug: string, campaignId: string): string {
  return path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-canonical-main-page-candidate",
    slug,
    campaignId,
    "index.html",
  );
}

export function validateCanonicalMainPageCandidateHtml(html: string): void {
  const visible = visibleText(html);
  const fail = (field: string): never => {
    throw new Error(field);
  };

  if (/Local access from/i.test(html)) fail("candidate.localAccessFrom");
  if (/master-local-relevance/i.test(html)) fail("candidate.masterLocalRelevance");
  if (/<iframe\b/i.test(html) || /maps\.google/i.test(html) || /google\.com\/maps/i.test(html)) {
    fail("candidate.mapOrIframe");
  }
  if (/Get directions/i.test(visible) || /#local-access/i.test(html)) fail("candidate.directions");
  if (/\bparking\b/i.test(visible)) fail("candidate.parking");
  if (/Opening hours/i.test(visible)) fail("candidate.openingHours");
  if (/\byour area\b/i.test(visible)) fail("candidate.unresolvedPlaceholder.yourArea");
  if (/contact the pharmacy on\s*\./i.test(visible) || /\bon\s+\.(?:\s|$)/.test(visible)) {
    fail("candidate.emptyContactField");
  }
  if (/data-image-missing/i.test(html) || /\{\{[A-Za-z0-9._-]+\}\}/.test(html) || /\[\s*your area\s*\]/i.test(html)) {
    fail("candidate.unresolvedPlaceholder");
  }

  const visibleLower = visible.toLowerCase();
  for (const area of TARGET_AREA_BLOCKLIST) {
    if (visibleLower.includes(area)) fail(`candidate.targetArea.${area}`);
  }

  for (const name of REQUIRED_CONDITION_NAMES) {
    if (!visibleLower.includes(name)) fail(`priorBank.eligibility.namedConditionSet.${name}`);
  }
  if (!/uncomplicated (uti|urinary tract infection)/i.test(visible)) {
    fail("priorBank.eligibility.namedConditionSet.uncomplicatedUTI");
  }
  if (!/in eligible women/i.test(visible)) fail("priorBank.eligibility.namedConditionQualifications");

  const processCards = html.match(/data-process-step="/g) || [];
  if (processCards.length !== 4) fail("candidate.processSteps.count");
  for (let step = 1; step <= 4; step += 1) {
    const block = html.match(new RegExp(`data-process-step="${step}"[\\s\\S]*?</article>`));
    if (!block) fail(`candidate.processSteps.${step}.missing`);
    if (!/<h3\b[\s\S]*?<\/h3>/i.test(block[0]) || !/<p class="card-body">[\s\S]{40,}?<\/p>/i.test(block[0])) {
      fail(`candidate.processSteps.${step}.body`);
    }
  }

  if (!/data-condition-layout="four-plus-three"/.test(html)) fail("candidate.conditions.layout");
  if ((html.match(/class="condition-chip"/g) || []).length !== 7) fail("candidate.conditions.count");
  if (/id="conditions-pharmacy-first-may-cover"[\s\S]*?equal-height-card/.test(html)) {
    fail("candidate.conditions.emptyCards");
  }

  const suitabilityBlock = html.match(/id="who-pharmacy-first-may-be-suitable-for"[\s\S]*?(?=<section id="how-the-service-works")/);
  if (!suitabilityBlock) fail("candidate.suitability.missing");
  if (/equal-height-card|data-process-step|Contact the pharmacy first/i.test(suitabilityBlock[0])) {
    fail("candidate.suitability.processCards");
  }
  if (!/may be suitable|intended for some common minor illnesses|not a general replacement/i.test(suitabilityBlock[0])) {
    fail("candidate.suitability.eligibilityCopy");
  }

  const benefitCards = (html.match(/id="why-patients-use-their-community-pharmacy"[\s\S]*?<\/section>/) || [""])[0];
  if ((benefitCards.match(/<article class="card candidate-content-card"/g) || []).length < 3) {
    fail("candidate.benefits.cards");
  }
  if (/<article class="card candidate-content-card">[\s\S]*?<h3>[\s\S]*?<\/h3>\s*<\/article>/.test(benefitCards)) {
    fail("candidate.benefits.headingOnly");
  }

  if (/Final contact call to action/i.test(visible)) fail("candidate.cta.implementationHeading");
  if (!/Speak to Yorkshire Pharmacy & Health Clinic about Pharmacy First/i.test(visible)) {
    fail("candidate.cta.customerHeading");
  }
  if (!/Contact the pharmacy 01226 210477/.test(visible)) fail("candidate.cta.telephoneButton");

  const imageSources = [...html.matchAll(/<img\b[^>]*src="([^"]+)"/gi)].map((match) => match[1]);
  if (imageSources.some((src) => /\.svg(\?|#|$)/i.test(src) || /community-pharmacy/i.test(src))) {
    fail("candidate.image.nonPhotographic");
  }
  const campaignPhotos = imageSources.filter((src) => /\/assets\/pharmacy-image-platform\//.test(src));
  if (campaignPhotos.length < 4) fail("candidate.image.photographicCount");

  const faqBlock = html.match(/id="frequently-asked-questions"[\s\S]*?(?=<section id="final-contact-cta")/);
  if (!faqBlock) fail("candidate.faq.order");
  const faqCount = (faqBlock[0].match(/class="faq-q"/g) || []).length;
  if (faqCount < 10) fail("candidate.faq.incomplete");

  const headings = [...extractTagTexts(html, "h1"), ...extractTagTexts(html, "h2"), ...extractTagTexts(html, "h3")];
  const headingKeys = headings.map(normalizeText);
  if (new Set(headingKeys).size !== headingKeys.length) fail("candidate.duplicateHeading");

  const paragraphs = extractTagTexts(html, "p").map(normalizeText).filter(Boolean);
  if (new Set(paragraphs).size !== paragraphs.length) fail("candidate.duplicateParagraph");

  const gridRe = /data-candidate-grid="true"[^>]*data-grid-cards="(\d+)"[^>]*data-grid-cols="(\d+)"/g;
  let gridMatch: RegExpExecArray | null;
  while ((gridMatch = gridRe.exec(html))) {
    const cards = Number(gridMatch[1]);
    const cols = Number(gridMatch[2]);
    if (!cards || cols > cards) fail("candidate.incompleteGrid");
  }

  if (!/noindex,\s*nofollow/i.test(html)) fail("candidate.robots");
  if (!/01226\s*210477/.test(visible)) fail("identity.phone");
  if (!/Yorkshire Pharmacy & Health Clinic/i.test(visible)) fail("identity.pharmacyName");

  const requiredIds = [
    "pharmacy-header",
    "pharmacy-first-hero",
    "what-pharmacy-first-is",
    "conditions-pharmacy-first-may-cover",
    "who-pharmacy-first-may-be-suitable-for",
    "how-the-service-works",
    "why-patients-use-their-community-pharmacy",
    "when-to-contact-gp-nhs111-emergency",
    "pharmacy-trust-and-consultation",
    "frequently-asked-questions",
    "final-contact-cta",
    "pharmacy-footer",
  ];
  let lastIndex = -1;
  for (const id of requiredIds) {
    const idx = html.indexOf(`id="${id}"`);
    if (idx < 0) fail(`candidate.section.${id}`);
    if (idx < lastIndex) fail(`candidate.sectionOrder.${id}`);
    lastIndex = idx;
  }
}

function candidateChromeCss(): string {
  return `<style data-candidate-layout="canonical-main-page">
:root{--candidate-sticky-offset:128px}
html{scroll-padding-top:var(--candidate-sticky-offset)}
section[id],#pharmacy-header{scroll-margin-top:var(--candidate-sticky-offset)}
.candidate-preview-toolbar{position:sticky;top:0;z-index:10000;background:#eff6ff;border-bottom:1px solid #bfdbfe;color:#1e40af;font:800 13px/1.4 Inter,system-ui,sans-serif;text-align:center;padding:10px 16px}
.pc-candidate-header.site-header{position:sticky;top:42px;z-index:50}
.pc-candidate-header .header-row,.pc-candidate-footer .footer-row{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.pc-candidate-header img,.pc-candidate-footer img{max-height:48px;width:auto}
.pc-candidate-nav{display:flex;flex-wrap:wrap;gap:14px;align-items:center}
body[data-canonical-main-page-candidate="true"] section{padding:48px 0}
body[data-canonical-main-page-candidate="true"] .hero{padding:40px 0 36px}
body[data-canonical-main-page-candidate="true"] .card,
body[data-canonical-main-page-candidate="true"] .candidate-content-card{height:auto;min-height:0;display:flex;flex-direction:column;gap:10px}
body[data-canonical-main-page-candidate="true"] .card p,
body[data-canonical-main-page-candidate="true"] .candidate-content-card p{flex:none;margin:0}
body[data-canonical-main-page-candidate="true"] .card-title-block h3,
body[data-canonical-main-page-candidate="true"] .card-title-line-2{min-height:0!important}
.candidate-card-grid{display:grid;gap:18px;align-items:stretch;width:100%;grid-template-columns:repeat(var(--candidate-cols,4),minmax(0,1fr))}
.candidate-card-grid[data-grid-cols="4"]{--candidate-cols:4}
.candidate-card-grid[data-grid-cols="3"]{--candidate-cols:3}
@media(max-width:1100px){.candidate-card-grid[data-grid-cols="4"]{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:960px){.candidate-card-grid[data-grid-cols="3"]{grid-template-columns:1fr}}
@media(max-width:640px){.candidate-card-grid{grid-template-columns:1fr!important}}
.condition-list{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;list-style:none;margin:0 auto;padding:0;max-width:920px}
.condition-chip{flex:0 1 calc(25% - 10px);box-sizing:border-box;margin:0;padding:12px 14px;border:1px solid var(--line,#e2e8f0);border-radius:12px;background:#fff;text-align:center;font-weight:700;color:var(--brand-heading);font-size:15px;line-height:1.3}
@media(max-width:960px){.condition-chip{flex:0 1 calc(50% - 10px)}}
@media(max-width:640px){.condition-chip{flex:1 1 100%}}
.suitability-panel{max-width:72ch;margin:0 auto;text-align:left}
.suitability-panel p{margin:0 0 16px}
.hero-image-wrap,.image-panel{aspect-ratio:4/3;max-height:360px;background:transparent}
.hero-image-wrap img,.image-panel img{width:100%;height:100%;object-fit:cover;display:block}
.cta-band .image-panel{max-width:640px;margin:0 auto 20px;aspect-ratio:16/9;max-height:280px}
.faq .faq-card{margin-bottom:12px}
main{overflow-x:hidden}
img{max-width:100%}
</style>`;
}

export function assembleCanonicalMainPageCandidateHtml(slug: string, campaignId: string): string {
  if (campaignId !== "pharmacy-first") {
    throw new Error("candidate.campaign.unsupported");
  }

  const pack = loadServiceVariantPack("pharmacy-first");
  if (!pack) throw new Error("currentBank.missing");

  const profile = buildPharmacyServicePageProfile(slug);
  const phoneDigits = String(profile.phone || "").replace(/\D/g, "");
  if (phoneDigits !== "01226210477") throw new Error("identity.phone");
  const pharmacyName = profile.pharmacyName.trim();
  if (pharmacyName !== "Yorkshire Pharmacy & Health Clinic") throw new Error("identity.pharmacyName");
  const displayPhone = profile.displayPhone || "01226 210477";
  const telHref = normalizeTelHref(profile.phone);
  const website = profile.website || "";
  const storedProfile = loadPharmacyProfile(slug);
  const logoSrc =
    storedAuthoritativeLogoUrl(storedProfile.data) ||
    resolveCommercialLogoUrl(
      storedProfile.data?.headerLogoUrl,
      storedProfile.data?.logoUrl,
      profile.headerLogoUrl,
      profile.logoUrl,
    );
  const brandMark = logoSrc
    ? `<img src="${esc(logoSrc)}" alt="${esc(pharmacyName)} logo"/>`
    : `<span class="brand-text">${esc(pharmacyName)}</span>`;

  const plan = loadCampaignImagePlan(slug, campaignId);
  if (!plan?.slots?.length) throw new Error("images.plan.missing");
  const omittedPhotographicPlacements: string[] = [];
  const images: Record<string, { href: string; alt: string }> = {};
  for (const slot of ALL_PLAN_SLOTS) {
    const row = plan.slots.find((item) => item.slot === slot);
    const filePath = String(row?.filePath || "").replace(/^\/+/, "");
    if (!filePath || !fs.existsSync(path.join(WORKSPACE_ROOT, filePath)) || !isPhotographicAssetPath(filePath)) {
      omittedPhotographicPlacements.push(`images.${slot}.notPhotographic`);
      continue;
    }
    images[slot] = {
      href: publicAssetHref(filePath),
      alt: `Pharmacy First at ${pharmacyName}`,
    };
  }
  for (const slot of PHOTOGRAPHIC_SLOTS) {
    if (!images[slot]) throw new Error(`images.${slot}.notPhotographic`);
  }

  const conditions = loadPriorNamedConditionSource();
  const overview = pack.intro.find((row) => row.body && !hasLocalityPlaceholder(row.body));
  const heroIntro = pack.intro.find(
    (row) => row.body && !hasLocalityPlaceholder(row.body) && normalizeText(row.body) !== normalizeText(overview?.body || ""),
  );
  if (!overview?.body) throw new Error("currentBank.intro.overview");
  if (!heroIntro?.body) throw new Error("currentBank.intro.hero");

  const eligibilityLocalityFree = (pack.eligibility || []).filter(
    (row) => row.body && !hasLocalityPlaceholder(`${row.body} ${(row.bullets || []).join(" ")}`),
  );
  const suitabilityIntro = eligibilityLocalityFree[0];
  if (!suitabilityIntro?.body) throw new Error("currentBank.eligibility.suitabilityCopy");
  const suitabilityWhen = (pack.problem || []).find(
    (row) =>
      row.body &&
      !hasLocalityPlaceholder(row.body) &&
      /may be worth asking about when symptoms are recent/i.test(row.body),
  );

  const processSource = (pack.howItWorks || []).slice(0, 4);
  if (processSource.length !== 4) throw new Error("currentBank.howItWorks.processSteps");
  const processCards = processSource.map((step, index) => {
    const title = uniqueItems(step.bullets || [])[0];
    const body = stripLocalityPlaceholders(step.body || "");
    if (!title) throw new Error(`currentBank.howItWorks[${index}].title`);
    if (!body) throw new Error(`currentBank.howItWorks[${index}].body`);
    return { title, body };
  });
  if (new Set(processCards.map((card) => normalizeText(card.title))).size !== 4) {
    throw new Error("currentBank.howItWorks.distinctHeadings");
  }
  if (processCards.some((card) => hasLocalityPlaceholder(card.body))) {
    throw new Error("currentBank.howItWorks.body");
  }

  const benefitVariants = (pack.benefits || []).filter(
    (row) => row.body && !hasLocalityPlaceholder(row.body) && (row.bullets || []).length,
  );
  const usedBenefitTitles = new Set<string>();
  const benefitCards: Array<{ title: string; body: string }> = [];
  for (const variant of benefitVariants) {
    const title = (variant.bullets || []).find((bullet) => {
      const key = normalizeText(bullet);
      return key && !usedBenefitTitles.has(key) && !processCards.some((step) => normalizeText(step.title) === key);
    });
    const body = stripLocalityPlaceholders(variant.body);
    if (!title || !body) continue;
    if (benefitCards.some((card) => normalizeText(card.body) === normalizeText(body))) continue;
    usedBenefitTitles.add(normalizeText(title));
    benefitCards.push({ title, body });
  }
  if (benefitCards.length < 3) throw new Error("currentBank.benefits.completeItems");

  const safety = firstLocalityFreeVariant(pack.trustSafety);
  const safetyBody = stripLocalityPlaceholders(safety.body || "");
  if (!safetyBody) throw new Error("currentBank.trustSafety.body");

  const trust = (pack.patientEducation || []).find((row) => row.body && !hasLocalityPlaceholder(row.body) && /complements GP care/i.test(row.body))
    || firstLocalityFreeVariant(pack.patientEducation);
  const trustBody = stripLocalityPlaceholders(trust.body || "");
  if (!trustBody) throw new Error("currentBank.patientEducation.body");

  const faqs: FaqVariant[] = uniqueItems((pack.faqs || []).map((faq) => faq.question)).map((question) => {
    const match = (pack.faqs || []).find((faq) => faq.question === question)!;
    return { question: match.question, answer: match.answer };
  }).filter((faq) => !hasLocalityPlaceholder(`${faq.question} ${faq.answer}`));
  if (!faqs.length) throw new Error("currentBank.faqs.missing");
  if (faqs.some((faq) => /contact the pharmacy on\s*\./i.test(`${faq.question} ${faq.answer}`) || /\bon\s+\.(?:\s|$)/.test(faq.answer))) {
    throw new Error("currentBank.faqs.emptyContact");
  }

  const cta = pack.cta?.[0];
  if (!cta?.primary || !cta.phonePrompt) throw new Error("currentBank.cta.missing");
  void omittedPhotographicPlacements;

  const theme = buildPharmacyThemeWithBrandDna(profile, resolveBrandDnaForRender(slug));
  const year = new Date().getFullYear();

  const header = `<header id="pharmacy-header" class="site-header pc-v1-header pc-candidate-header">
<div class="wrap"><div class="header-row">
<a class="brand" href="${website ? esc(website) : "#what-pharmacy-first-is"}">${brandMark}</a>
<nav class="pc-candidate-nav" aria-label="Primary">
<a href="#what-pharmacy-first-is">Pharmacy First</a>
<a href="#conditions-pharmacy-first-may-cover">Conditions</a>
<a href="#frequently-asked-questions">FAQs</a>
<a class="header-phone nav-phone" href="${esc(telHref)}">${esc(displayPhone)}</a>
<a class="nav-cta btn" href="${esc(telHref)}">${esc(cta.primary)}</a>
</nav>
</div></div>
</header>`;

  const footer = `<footer id="pharmacy-footer" class="site-footer pc-v1-footer pc-candidate-footer">
<div class="wrap footer-row">
<div>
${logoSrc ? `<img src="${esc(profile.footerLogoUrl || logoSrc)}" alt="${esc(pharmacyName)}"/>` : `<strong>${esc(pharmacyName)}</strong>`}
<p><a href="${esc(telHref)}">${esc(displayPhone)}</a></p>
${website ? `<p><a href="${esc(website)}">${esc(website.replace(/^https?:\/\//, ""))}</a></p>` : ""}
</div>
<p>© ${year} ${esc(pharmacyName)}. All rights reserved.</p>
</div>
</footer>`;

  const hero = `<section id="pharmacy-first-hero" class="hero" data-template-block="hero">
<div class="wrap hero-grid">
<div class="hero-copy">
<span class="eyebrow tag nhs">Pharmacy First</span>
<h1>Pharmacy First at ${esc(pharmacyName)}</h1>
<p>${esc(heroIntro.body)}</p>
<div class="btns"><a class="btn" href="${esc(telHref)}">${esc(cta.primary)} ${esc(displayPhone)}</a></div>
</div>
${renderSlotImage(images.hero.href, images.hero.alt, "hero", "hero-image-wrap hero-media", true)}
</div>
</section>`;

  const whatItIs = `<section id="what-pharmacy-first-is" class="about" data-template-block="service-definition">
<div class="wrap definition-split-row">
<div class="definition-split-copy">
<div class="section-head"><h2>What Pharmacy First is</h2></div>
<p>${esc(overview.body)}</p>
</div>
${renderSlotImage(images.support.href, images.support.alt, "support", "image-panel")}
</div>
</section>`;

  const conditionsSection = `<section id="conditions-pharmacy-first-may-cover" data-template-block="conditions">
<div class="wrap">
<div class="section-head center"><h2>Conditions Pharmacy First may cover</h2>
<p>${esc(conditions.intro)}</p></div>
${renderCompactConditionList(conditions.names)}
</div>
</section>`;

  const suitabilityParagraphs = uniqueItems(
    [suitabilityIntro.body, suitabilityWhen?.body || ""].map((text) => stripLocalityPlaceholders(text)),
  );
  const suitabilitySection = `<section id="who-pharmacy-first-may-be-suitable-for">
<div class="wrap">
<div class="section-head center"><h2>Who Pharmacy First may be suitable for</h2></div>
<div class="suitability-panel">${suitabilityParagraphs.map((text) => `<p>${esc(text)}</p>`).join("")}</div>
</div>
</section>`;

  const processSection = `<section id="how-the-service-works" data-template-block="process">
<div class="wrap">
<div class="section-head center"><h2>How the service works</h2></div>
${renderContentCardGrid(processCards, { process: true })}
</div>
</section>`;

  const benefitsSection = `<section id="why-patients-use-their-community-pharmacy">
<div class="wrap">
<div class="section-head center"><h2>Why patients use their community pharmacy</h2></div>
${renderContentCardGrid(benefitCards)}
</div>
</section>`;

  const safetySection = `<section id="when-to-contact-gp-nhs111-emergency" data-template-block="safety">
<div class="wrap">
<div class="section-head"><h2>When to contact a GP, NHS 111 or emergency services</h2></div>
<div class="candidate-safety safety-prose"><p>${esc(safetyBody)}</p></div>
</div>
</section>`;

  const trustSection = `<section id="pharmacy-trust-and-consultation" class="about" data-template-block="trust-split">
<div class="wrap grid-2 trust-split-row">
<div class="trust-prose">
<div class="section-head"><h2>Pharmacy trust and consultation information</h2></div>
<p>${esc(trustBody)}</p>
</div>
${renderSlotImage(images.trust.href, images.trust.alt, "trust", "image-panel")}
</div>
</section>`;

  const faqSection = `<section id="frequently-asked-questions" class="faq">
<div class="wrap">
<div class="section-head center"><h2>Frequently asked questions</h2></div>
${faqs
  .map(
    (faq) => `<div class="cluster-faq-item faq-card"><h3 class="faq-q">${esc(faq.question)}</h3><p class="faq-a">${esc(faq.answer)}</p></div>`,
  )
  .join("")}
</div>
</section>`;

  const ctaHeading = `Speak to ${pharmacyName} about ${pack.serviceName}`;
  const telephoneButtonLabel = `${cta.primary} ${displayPhone}`;
  const ctaSection = `<section id="final-contact-cta" class="cta-band">
<div class="wrap">
<div class="section-head center"><h2>${esc(ctaHeading)}</h2>
<p class="cta-close">${esc(cta.phonePrompt)}</p></div>
${renderSlotImage(images.conversion.href, images.conversion.alt, "conversion", "image-panel")}
<div class="cta-actions"><a class="btn-white" href="${esc(telHref)}">${esc(telephoneButtonLabel)}</a></div>
</div>
</section>`;

  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Pharmacy First | ${esc(pharmacyName)} | Review candidate</title>
${buildGoogleFontsLink(theme)}
${buildPharmacyServicePageStyleBlock(theme)}
${candidateChromeCss()}
</head>
<body data-pharmacy-template="${PHARMACY_SERVICE_PAGE_TEMPLATE_ID}" data-canonical-main-page-candidate="true">
<div class="candidate-preview-toolbar" data-component="review-preview-toolbar">Review preview — not published. Isolated canonical main-page candidate.</div>
${header}
<main>
${hero}
${whatItIs}
${conditionsSection}
${suitabilitySection}
${processSection}
${benefitsSection}
${safetySection}
${trustSection}
${faqSection}
${ctaSection}
</main>
${footer}
</body>
</html>`;

  validateCanonicalMainPageCandidateHtml(html);
  return html;
}

export function writeCanonicalMainPageCandidate(slug: string, campaignId: string): { html: string; outputPath: string } {
  const html = assembleCanonicalMainPageCandidateHtml(slug, campaignId);
  const outputPath = canonicalMainPageCandidateOutputPath(slug, campaignId);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html);
  return { html, outputPath };
}
