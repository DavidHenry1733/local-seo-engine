/**
 * Sprint 4B — deterministic presentation polish for generated Pharmacy First service pages.
 * Patches existing HTML without regeneration.
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";

const APPROVED_REVIEW_FALLBACK =
  "Content prepared for review and approval by the pharmacy team before publishing.";

export interface PharmacyFirstServicePagePolishResult {
  ok: boolean;
  htmlPath: string;
  fixesApplied: string[];
}

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), ".."),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "output/pharmacy-visual-experience"))) return root;
  }
  return process.cwd();
}

function stripUnverifiedAgeRestrictions($: cheerio.CheerioAPI): boolean {
  let changed = false;
  $('[data-template-block="eligibility"] .master-prose h3').each((_, heading) => {
    const title = $(heading).text().replace(/\s+/g, " ").trim();
    if (!/age restrictions/i.test(title)) return;
    let cursor = $(heading).next();
    while (cursor.length && cursor.get(0)?.tagName?.toLowerCase() !== "h3") {
      const next = cursor.next();
      cursor.remove();
      cursor = next;
    }
    $(heading).remove();
    changed = true;
  });
  return changed;
}

function polishTrustCards($: cheerio.CheerioAPI, gphcNumber: string, consultationRoom: boolean): boolean {
  const section = $("#pharmacy-trust-cards");
  if (!section.length) return false;
  let changed = false;
  section.find(".card.equal-height-card").each((_, card) => {
    const title = $(card).find("h3").first().text().replace(/\s+/g, " ").trim();
    if (!gphcNumber.trim() && /gphc registered pharmacy/i.test(title)) {
      $(card).remove();
      changed = true;
    }
    if (!consultationRoom && /private consultation room/i.test(title)) {
      $(card).remove();
      changed = true;
    }
  });
  const grid = section.find(".card-grid-equal").first();
  if (!grid.length) return changed;
  const pharmacyName =
    $("h1").first().text().split(" at ").pop()?.trim() || "this pharmacy";
  const fillerCards = [
    {
      title: "Pharmacy First pathways",
      body: `${pharmacyName} uses NHS clinical pathways for sore throat, earache, impetigo, infected insect bites, shingles, sinusitis, and uncomplicated UTI where eligible.`,
    },
    {
      title: "Pharmacist-led assessment",
      body: `Trained pharmacists at ${pharmacyName} assess symptoms, apply PGDs where appropriate, and signpost to GP or urgent care when needed.`,
    },
    {
      title: "NHS-funded service",
      body: `${pharmacyName} provides NHS Pharmacy First at no charge for eligible patients where commissioning criteria are met.`,
    },
  ];
  const existingTitles = new Set(
    grid
      .find(".card.equal-height-card h3")
      .toArray()
      .map((el) => $(el).text().replace(/\s+/g, " ").trim()),
  );
  for (const filler of fillerCards) {
    if (grid.find(".card.equal-height-card").length >= 4) break;
    if (existingTitles.has(filler.title)) continue;
    grid.append(
      `<div class="card equal-height-card"><div class="card-title-block"><h3 class="card-title-line-2">${filler.title}</h3></div><p class="card-body">${filler.body}</p></div>`,
    );
    existingTitles.add(filler.title);
    changed = true;
  }
  return changed;
}

function polishTrustSectionBadges($: cheerio.CheerioAPI, gphcNumber: string, consultationRoom: boolean): boolean {
  const grid = $('[data-template-block="trust-split"] .trust-grid');
  if (!grid.length) return false;
  let changed = false;
  grid.find(".trust-item").each((_, item) => {
    const text = $(item).text().replace(/\s+/g, " ").trim();
    if (!gphcNumber.trim() && /gphc registered pharmacy/i.test(text)) {
      $(item).remove();
      changed = true;
    }
    if (!consultationRoom && /private consultation room/i.test(text)) {
      $(item).remove();
      changed = true;
    }
  });
  return changed;
}

function polishMisconceptions($: cheerio.CheerioAPI): boolean {
  const section = $('[data-template-block="safety"]');
  if (!section.length) return false;
  const title = section.find("h2").first().text();
  if (!/misconception/i.test(title)) return false;
  const prose = section.find(".safety-prose");
  if (!prose.length || !section.find(".safety-cards").length) return false;
  prose.remove();
  return true;
}

function polishFaqAnswers($: cheerio.CheerioAPI): boolean {
  const faqSection = $("#faq-section");
  if (!faqSection.length) return false;
  let changed = false;
  const secondQuestion = faqSection
    .find(".faq-q")
    .filter((_, el) => /not english/i.test($(el).text()) && /nhs gp/i.test($(el).text()))
    .first();
  if (secondQuestion.length) {
    const answerEl = secondQuestion.closest(".cluster-faq-item").find(".faq-a");
    const current = answerEl.text().replace(/\s+/g, " ").trim();
    if (/registered with an NHS GP in England \(or otherwise eligible/i.test(current)) {
      answerEl.text("(or otherwise eligible for NHS primary care services)");
      changed = true;
    }
  }
  const seenAnswers = new Set<string>();
  faqSection.find(".cluster-faq-item").each((_, item) => {
    const answer = $(item).find(".faq-a").text().replace(/\s+/g, " ").trim();
    const key = answer.toLowerCase().slice(0, 120);
    if (seenAnswers.has(key)) {
      $(item).remove();
      changed = true;
      return;
    }
    seenAnswers.add(key);
  });
  return changed;
}

function polishProfessionalReview($: cheerio.CheerioAPI): boolean {
  const fallback = $('[data-component="pharmacy-professional-review-panel"] .profile-review-fallback');
  if (!fallback.length) return false;
  const text = fallback.text().replace(/\s+/g, " ").trim();
  if (text === APPROVED_REVIEW_FALLBACK) return false;
  fallback.text(APPROVED_REVIEW_FALLBACK);
  return true;
}

function polishRegulatoryFooter($: cheerio.CheerioAPI): boolean {
  const footer = $("#site-footer");
  if (!footer.length) return false;
  let changed = false;
  footer.find("h3").each((_, heading) => {
    if ($(heading).text().trim() !== "Regulatory") return;
    const column = $(heading).parent();
    const content = column
      .children()
      .not("h3")
      .toArray()
      .map((el) => $(el).text().replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (!content.length) {
      column.remove();
      changed = true;
    }
  });
  return changed;
}

function polishLocalLinks($: cheerio.CheerioAPI, slug: string, serviceKey: string): boolean {
  const root = resolveWorkspaceRoot();
  const mapPath = path.join(
    root,
    "output/pharmacy-content-ecosystem",
    slug,
    serviceKey,
    "_internal-link-map.json",
  );
  if (!fs.existsSync(mapPath)) return false;
  const map = JSON.parse(fs.readFileSync(mapPath, "utf8")) as {
    localClusterPages?: Array<{ areaName?: string; areaSlug?: string; outputPath?: string }>;
  };
  const previewBase = `/api/pharmacy-content-ecosystem-preview/${encodeURIComponent(serviceKey)}/local`;
  const ecosystemRoot = path.join(root, "output/pharmacy-content-ecosystem", slug, serviceKey);
  let changed = false;
  $(".coverage-tags .coverage-tag").each((_, link) => {
    const areaName = $(link).text().replace(/\s+/g, " ").trim();
    const page = (map.localClusterPages || []).find(
      (entry) =>
        entry.areaName === areaName &&
        entry.areaSlug &&
        fs.existsSync(path.join(ecosystemRoot, entry.outputPath || `local/${entry.areaSlug}/index.html`)),
    );
    if (!page?.areaSlug) return;
    const href = `${previewBase}/${encodeURIComponent(page.areaSlug)}/?slug=${encodeURIComponent(slug)}`;
    if ($(link).attr("href") !== href) {
      $(link).attr("href", href);
      changed = true;
    }
  });
  return changed;
}

export function polishPharmacyFirstServicePageHtml(
  html: string,
  slug: string,
  serviceKey = "pharmacy-first",
): { html: string; fixesApplied: string[] } {
  const profile = buildPharmacyServicePageProfile(slug);
  const $ = cheerio.load(html, { decodeEntities: false });
  const fixesApplied: string[] = [];

  if (polishTrustCards($, profile.gphcNumber, profile.consultationRoomAvailable)) {
    fixesApplied.push("trust-cards-unsupported-removed");
  }
  if (stripUnverifiedAgeRestrictions($)) fixesApplied.push("age-restrictions-unverified-hidden");
  if (polishMisconceptions($)) fixesApplied.push("misconceptions-deduped");
  if (polishTrustSectionBadges($, profile.gphcNumber, profile.consultationRoomAvailable)) {
    fixesApplied.push("trust-section-badges-filtered");
  }
  if (polishProfessionalReview($)) fixesApplied.push("professional-review-wording");
  if (polishFaqAnswers($)) fixesApplied.push("faq-answers-deduped");
  if (polishRegulatoryFooter($)) fixesApplied.push("regulatory-empty-hidden");
  if (polishLocalLinks($, slug, serviceKey)) fixesApplied.push("local-links-verified");

  return { html: $.html(), fixesApplied };
}

export function polishPharmacyFirstServicePageFile(
  slug: string,
  serviceKey = "pharmacy-first",
): PharmacyFirstServicePagePolishResult {
  const root = resolveWorkspaceRoot();
  const htmlPath = path.join(root, "output/pharmacy-visual-experience", slug, serviceKey, "index.html");
  if (!fs.existsSync(htmlPath)) {
    return { ok: false, htmlPath, fixesApplied: [] };
  }
  const source = fs.readFileSync(htmlPath, "utf8");
  const { html, fixesApplied } = polishPharmacyFirstServicePageHtml(source, slug, serviceKey);
  fs.writeFileSync(htmlPath, html, "utf8");
  return { ok: true, htmlPath, fixesApplied };
}
