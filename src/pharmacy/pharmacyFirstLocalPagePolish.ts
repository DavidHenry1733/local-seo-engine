/**
 * LEGACY — quarantined by CPR-PLATFORM-RECOVERY-02.
 * Tenant-hardcoded polish must not run in production generation.
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { assertLegacyContentEngineAllowed } from "./contentEngine/pharmacyLegacyContentEngineQuarantine.ts";
import { PHARMACY_FIRST_ACTIVE_LOCAL_SLUGS } from "./pharmacyFirstLocalCampaignManifest.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { resolvePharmacyMapEmbed } from "./pharmacyMapResolver.ts";
import { mapResolveInputFromProfile } from "./pharmacyMapResolver.ts";
import { resolvePharmacyWorkspaceRoot } from "./pharmacyWorkspacePaths.ts";

const PHARMACY_NAME = "Broom Lane Pharmacy";
const DISPLAY_PHONE = "01709 361398";
const TEL_HREF = "tel:+441709361398";
const CANONICAL_ADDRESS = "70 Broom Ln, Rotherham S60 3EW, UK";
const MAP_EMBED =
  "https://maps.google.com/maps?q=place_id:ChIJHZywRyN3eUgRiFcT_SS0hoQ&hl=en&z=15&output=embed";

const INVALID_PROVIDER =
  /foot\s*centre|foot clinic|podiatr|dental|dentist|chiropod|physio clinic|optician|feet therapy|implant|tooth|𝐅𝐎𝐎𝐓|𝐅𝐎𝐎𝐓/i;

function normalizeProviderText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INTERNAL_METADATA: RegExp[] = [
  /Campaign score for [^.:]+:\s*\d+\.?/gi,
  /Local campaign planning score for [^:]+:\s*\d+\.?/gi,
  /local campaign score of \d+\s*\(rank \d+\) for Pharmacy First access planning\.?/gi,
  /[^\n.]*campaign planning score \d+, rank \d+\.?/gi,
  /\branked (?:first|second|third|fourth|fifth|sixth|seventh|eighth|\d+(?:st|nd|rd|th)?) among selected local areas;?\s*/gi,
  /(?:primary|medium|secondary) priority catchment;?\s*/gi,
  /(?:moderate|steady|high) local search demand profile\.?\s*/gi,
  /Verified local character:\s*[^.]+(?:\.\s*)?/gi,
  /Pharmacy First planning for [^.]+\.\s*/gi,
  /Part of the Rotherham local market\.?\s*/gi,
  /(?:Strong|Moderate|Steady) local search interest\.?\s*/gi,
  /(?:Moderate local competition|Competitive local market|Room to stand out locally)\.?\s*/gi,
  /[^\s]+ tier in campaign planning\.?\s*/gi,
  /Area profile:\s*/gi,
  /[^\n]+ has a local campaign score of \d+[^.]*\.?\s*/gi,
];

export interface LocalPagePolishResult {
  ok: boolean;
  areaSlug: string;
  htmlPath: string;
  fixesApplied: string[];
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeKey(text: string): string {
  return normalizeWhitespace(text).toLowerCase().replace(/[^\w\s]/g, "").slice(0, 160);
}

function stripInternalMetadata(text: string): string {
  let out = text;
  for (const pattern of INTERNAL_METADATA) {
    out = out.replace(pattern, " ");
  }
  return normalizeWhitespace(out.replace(/\s{2,}/g, " ").replace(/\.\s*\./g, "."));
}

function hasLetterSpacedGarble(text: string): boolean {
  return (text.match(/\b[A-Za-z]\s(?=[A-Za-z]\s)/g) || []).length >= 6;
}

function fixGarbledSafetyText(text: string, areaName: string): string {
  if (!hasLetterSpacedGarble(text)) return text;
  const prefix = text.split(/\b[A-Z] [a-z] [a-z]/)[0]?.trim() || "";
  const base =
    prefix ||
    "Severe pain, breathing difficulty, confusion, rash with fever, or rapidly worsening symptoms need urgent medical care.";
  return `${base.replace(/\.\s*$/, "")}. Patients visiting from ${areaName} receive structured NHS pathway assessment with plain-language safety-netting at ${PHARMACY_NAME}, including expected recovery times, return criteria, and red-flag symptoms.`;
}

function fixBrokenProcessBody(text: string, areaName: string): string {
  const t = normalizeWhitespace(text);
  if (/^When to return This step applies/i.test(t)) {
    return `During consultation at ${PHARMACY_NAME}, the pharmacist assesses symptoms, confirms eligibility, and explains when to return if needed — including guidance for patients travelling from ${areaName}.`;
  }
  if (/^GP follow-up triggers/i.test(t)) {
    return `${PHARMACY_NAME} explains supply options and GP follow-up triggers for ${areaName} patients where NHS criteria are met.`;
  }
  if (/^Emergency symptoms Patients/i.test(t)) {
    return `Patients from ${areaName} receive clear signposting to GP or urgent care when pharmacy treatment is not appropriate at ${PHARMACY_NAME}.`;
  }
  return t;
}

function collapseDuplicateSentences(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sentence of sentences) {
    const key = normalizeKey(sentence);
    if (key.length > 35 && seen.has(key)) continue;
    if (key.length > 35) seen.add(key);
    out.push(sentence);
  }
  return out.join(" ");
}

function extractAreaFacts(text: string, areaName: string) {
  const body = text.includes(`${areaName}:`) ? text.split(`${areaName}:`).slice(1).join(" ") : text;
  const characterMatch = body.match(new RegExp(`${areaName} is ([^.]+)`, "i"));
  let character = characterMatch?.[1]?.trim() || "a local area near Rotherham";
  character = character.replace(/,\s*known for.+$/i, "").trim();
  const knownForMatch = body.match(/known for ([^.]+)/i);
  let knownFor = knownForMatch?.[1]?.trim() || "";
  knownFor = knownFor.replace(/,\s*known for .+$/i, "").trim();
  const distanceMatch = body.match(/(?:about|approx\.?)\s*([\d.]+\s*km from Rotherham town centre)/i);
  const conditionMatch = body.match(/(?:assessment for|emphasises|include(?:s)?)\s+([^.]+)/i);
  return {
    character,
    knownFor,
    distance: distanceMatch?.[1]?.trim() || "",
    condition: conditionMatch?.[1]?.trim()?.replace(/^common presentations from [^ ]+ include /i, "") || "common Pharmacy First conditions",
  };
}

function formatDistance(distance: string): string {
  const normalized = distance.replace(/^approx\.?\s*/i, "").replace(/rotherham town centre/gi, "Rotherham town centre");
  return normalized.replace(/^(\d)/, (m) => m);
}

function firstSentences(text: string, count = 1): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .slice(0, count)
    .join(" ")
    .replace(/\.\s*$/, "");
}

function rebuildHeroIntro(original: string, areaName: string): string {
  const source = collapseDuplicateSentences(stripInternalMetadata(original));
  const facts = extractAreaFacts(source, areaName);
  const areaColonSplit = source.split(new RegExp(`\\s${areaName}:`))[0]?.trim().replace(/\.\s*$/, "") || "";
  const hookCandidate = areaColonSplit && !new RegExp(`${areaName}\\s+is\\b`, "i").test(areaColonSplit)
    ? areaColonSplit
    : firstSentences(source, 1);
  const hook =
    hookCandidate && hookCandidate.length <= 220 && !new RegExp(`${areaName}\\s+is\\b`, "i").test(hookCandidate)
      ? hookCandidate
      : `${PHARMACY_NAME} provides NHS Pharmacy First for patients in ${areaName}`;
  const knownFor = facts.knownFor ? `, known for ${facts.knownFor}` : "";
  let out = `${hook}. ${areaName} is ${facts.character}${knownFor}. ${PHARMACY_NAME} provides NHS Pharmacy First for people in ${areaName}, with pharmacist assessment for ${facts.condition}.`;
  if (facts.distance) out += ` The pharmacy is about ${formatDistance(facts.distance)}.`;
  out += ` Call ${DISPLAY_PHONE} to check suitability and appointment options at ${PHARMACY_NAME}.`;
  return collapseDuplicateSentences(out);
}

function dedupeKnownForClause(text: string): string {
  return text.replace(/(,\s*known for [^.]+?)(,\s*known for [^.]+?)(?=\.|$)/gi, (match, first, second) => {
    return normalizeKey(first) === normalizeKey(second) ? first : match;
  });
}

function rebuildLocalRelevanceIntro(original: string, areaName: string): string {
  const source = collapseDuplicateSentences(stripInternalMetadata(original));
  const facts = extractAreaFacts(source, areaName);
  const knownFor = facts.knownFor ? `, known for ${facts.knownFor}` : "";
  let out = `${areaName} is ${facts.character}${knownFor}.`;
  if (facts.distance) {
    out += ` Many patients travel from ${areaName} (${formatDistance(facts.distance)}) to ${PHARMACY_NAME} in Rotherham for NHS Pharmacy First.`;
  } else {
    out += ` ${PHARMACY_NAME} supports patients travelling from ${areaName} for NHS Pharmacy First.`;
  }
  return dedupeKnownForClause(out);
}

function rebuildLocalRelevanceBody(original: string, areaName: string): string {
  const source = collapseDuplicateSentences(stripInternalMetadata(original));
  const facts = extractAreaFacts(source, areaName);
  const knownFor = facts.knownFor ? `, known for ${facts.knownFor}` : "";
  let out = `${areaName} is ${facts.character}${knownFor}. ${PHARMACY_NAME} provides pharmacist-led NHS Pharmacy First with structured assessment, treatment where eligible, and professional safety-netting for patients in ${areaName}.`;
  if (facts.distance) out += ` ${areaName} is about ${formatDistance(facts.distance)}.`;
  if (facts.condition && !/^common pharmacy first conditions$/i.test(facts.condition)) {
    out += ` Common presentations from ${areaName} include ${facts.condition}.`;
  }
  return dedupeKnownForClause(
    out
      .replace(/from Rotherham town centre from Rotherham town centre/gi, "from Rotherham town centre"),
  );
}

function normalizeTelLinks($: cheerio.CheerioAPI): boolean {
  let changed = false;
  $('a[href^="tel:"]').each((_, a) => {
    const el = $(a);
    if (el.attr("href") !== TEL_HREF) {
      el.attr("href", TEL_HREF);
      changed = true;
    }
    const label = normalizeWhitespace(el.text());
    if (el.closest(".hero-phone").length) {
      if (label !== `Call ${DISPLAY_PHONE}`) {
        el.text(`Call ${DISPLAY_PHONE}`);
        changed = true;
      }
    } else if (el.hasClass("btn") && el.closest("#hero-section").length) {
      if (label !== `Call ${PHARMACY_NAME}`) {
        el.text(`Call ${PHARMACY_NAME}`);
        changed = true;
      }
    } else if (el.hasClass("btn-white")) {
      const expected = `Call ${PHARMACY_NAME} — ${DISPLAY_PHONE}`;
      if (label !== expected) {
        el.text(expected);
        changed = true;
      }
    } else if (/^\+44|^4417|^01709/.test(label.replace(/\s/g, ""))) {
      if (label !== DISPLAY_PHONE) {
        el.text(DISPLAY_PHONE);
        changed = true;
      }
    }
  });
  return changed;
}

function cleanListItem(text: string): string | null {
  const providerCheck = normalizeProviderText(text);
  if (INVALID_PROVIDER.test(providerCheck)) return null;
  const cleaned = stripInternalMetadata(text);
  if (!cleaned || cleaned.length < 20) return null;
  if (/campaign score|rank \d|priority catchment|search demand profile/i.test(cleaned)) return null;
  if (/^Commissioning varies$/i.test(cleaned)) return null;
  return cleaned;
}

function rebuildProcessIntro(original: string, areaName: string): string {
  const lead = original.split(new RegExp(`\\s${areaName}:`))[0]?.trim() ||
    "Follow safety-netting advice and return if symptoms worsen or persist beyond the expected timeframe.";
  const facts = extractAreaFacts(original, areaName);
  let out = `${lead.replace(/\.\s*$/, "")}.`;
  if (facts.distance) {
    out += ` From ${areaName} (${facts.distance.toLowerCase()}), call ${DISPLAY_PHONE} to confirm consultation length and booking options at ${PHARMACY_NAME}.`;
  } else {
    out += ` Call ${DISPLAY_PHONE} to confirm consultation length and booking options at ${PHARMACY_NAME}.`;
  }
  return out;
}

function polishProcessAndSections($: cheerio.CheerioAPI, areaName: string): void {
  $('[data-template-block="process"] .section-head p').each((_, p) => {
    $(p).text(rebuildProcessIntro($(p).text(), areaName));
  });
  $('[data-template-block="service-definition"] ul.clean li').each((_, li) => {
    const text = normalizeWhitespace($(li).text());
    if (/^Commissioning varies$/i.test(text) || text.length < 12) $(li).remove();
  });
  $('[data-template-block="local-area-access"] .section-head p').each((_, p) => {
    let text = stripInternalMetadata($(p).text());
    text = text.replace(/[^\s]+ campaign planning score[^.]*\.?/gi, "");
    text = normalizeWhitespace(text);
    if (text) $(p).text(text);
  });
  $('[data-template-block="local-area-access"] > .wrap > p').each((_, p) => {
    const text = normalizeWhitespace($(p).text());
    if (/Write down questions beforehand/i.test(text)) {
      $(p).text(
        `Write down questions beforehand and follow self-care advice between reviews. Free NHS Pharmacy First care applies where commissioned and criteria are met — confirm locally with ${PHARMACY_NAME} on ${DISPLAY_PHONE}.`,
      );
    }
  });
}

function dedupeParagraphs($: cheerio.CheerioAPI, selector: string): boolean {
  const seen = new Set<string>();
  let changed = false;
  $(selector).each((_, el) => {
    const text = normalizeWhitespace($(el).text());
    const key = normalizeKey(text);
    if (!key || key.length < 40) return;
    if (seen.has(key)) {
      $(el).remove();
      changed = true;
      return;
    }
    seen.add(key);
  });
  return changed;
}

function polishTextNodes($: cheerio.CheerioAPI, areaName: string): string[] {
  const fixes: string[] = [];
  $("main p, main li, main .card-body, main .faq-a, main .section-head p").each((_, el) => {
    const raw = $(el).html() || "";
    if (!raw.trim()) return;
    let text = $(el).text();
    const before = text;

    if ($(el).is(".card-body") && $(el).closest(".process-grid").length) {
      text = fixBrokenProcessBody(text, areaName);
    }
    if ($(el).closest('[data-template-block="safety"]').length) {
      text = fixGarbledSafetyText(text, areaName);
    }
    text = stripInternalMetadata(text);
    text = text.replace(/Commissioning varies Private options exist/gi, "");
    text = text.replace(/\bknown for\b/g, (m) => m);
    text = text.replace(/\.\s+known for/gi, ", known for");
    text = text.replace(/rotherham town centre/gi, "Rotherham town centre");
    text = normalizeWhitespace(text);

    if (text !== normalizeWhitespace(before) && text.length > 10) {
      $(el).text(text);
      fixes.push("text-cleaned");
    }
  });
  return fixes;
}

function polishHero($: cheerio.CheerioAPI, areaName: string): boolean {
  const heroP = $("#hero-section .hero-grid p").not(".hero-phone").first();
  if (!heroP.length) return false;
  const rebuilt = rebuildHeroIntro(heroP.text(), areaName);
  heroP.text(rebuilt);
  return true;
}

function polishLocalRelevance($: cheerio.CheerioAPI, areaName: string): boolean {
  const section = $('[data-template-block="local-relevance"]');
  if (!section.length) return false;
  const heroText = $("#hero-section .hero-grid p").not(".hero-phone").first().text();
  let bodyP = section.find(".definition-split-copy > p").first();
  const factSource = collapseDuplicateSentences(bodyP.text() || heroText);
  const headP = section.find(".section-head p").first();
  if (headP.length) headP.text(rebuildLocalRelevanceIntro(factSource, areaName));
  const bodyText = rebuildLocalRelevanceBody(factSource, areaName);
  if (bodyP.length) {
    bodyP.text(bodyText);
  } else {
    section.find(".definition-split-copy ul.clean").first().before(`<p>${bodyText}</p>`);
    bodyP = section.find(".definition-split-copy > p").first();
  }
  section.find(".definition-split-copy ul.clean li").each((_, li) => {
    const cleaned = cleanListItem($(li).text());
    if (!cleaned) $(li).remove();
    else $(li).text(cleaned);
  });
  return true;
}

function polishBusinessDetails($: cheerio.CheerioAPI, profile: ReturnType<typeof buildPharmacyServicePageProfile>): boolean {
  let changed = false;
  $("main, footer").each((_, block) => {
    const html = $(block).html() || "";
    const updated = html
      .replace(/\+441709361398/g, DISPLAY_PHONE)
      .replace(/441709361398/g, DISPLAY_PHONE)
      .replace(/70 Broom Ln, Rotherham S60 3EW, UK, S603EW/gi, CANONICAL_ADDRESS);
    if (updated !== html) {
      $(block).html(updated);
      changed = true;
    }
  });
  if (normalizeTelLinks($)) changed = true;
  $('p:contains("Address:")').each((_, p) => {
    if (/Address:/i.test($(p).text())) {
      $(p).html(`<strong>Address:</strong> ${CANONICAL_ADDRESS}`);
      changed = true;
    }
  });
  const mapResolved = resolvePharmacyMapEmbed(mapResolveInputFromProfile(profile, profile.slug));
  const mapUrl = mapResolved.embedUrl || MAP_EMBED;
  $("iframe[src*='maps.google.com']").each((_, iframe) => {
    if ($(iframe).attr("src") !== mapUrl) {
      $(iframe).attr("src", mapUrl);
      changed = true;
    }
  });
  return changed;
}

function polishCtas($: cheerio.CheerioAPI): boolean {
  let changed = false;
  $("#hero-section .btn").first().each((_, btn) => {
    $(btn).attr("href", TEL_HREF);
    if ($(btn).text() !== `Call ${PHARMACY_NAME}`) {
      $(btn).text(`Call ${PHARMACY_NAME}`);
      changed = true;
    }
  });
  $(".cta-band h2").text(`Book Pharmacy First at ${PHARMACY_NAME}`);
  $('.cta-band .btn-white[href^="tel:"]').text(`Call ${PHARMACY_NAME} — ${DISPLAY_PHONE}`);
  $('.money-page-band a[href^="tel:"]').each((_, a) => {
    $(a).attr("href", TEL_HREF);
  });
  return changed;
}

export function polishPharmacyFirstLocalPageHtml(html: string, areaSlug: string): {
  html: string;
  fixesApplied: string[];
} {
  assertLegacyContentEngineAllowed("pharmacyFirstLocalPagePolish", "polishPharmacyFirstLocalPageHtml");
  const areaName = areaSlug.charAt(0).toUpperCase() + areaSlug.slice(1);
  const profile = buildPharmacyServicePageProfile("broom-lane-pharmacy");
  const $ = cheerio.load(html, { decodeEntities: false });
  const fixesApplied: string[] = [];

  if (polishHero($, areaName)) fixesApplied.push("hero-intro");
  polishProcessAndSections($, areaName);
  fixesApplied.push(...new Set(polishTextNodes($, areaName)));
  if (dedupeParagraphs($, "main p")) fixesApplied.push("dedupe-paragraphs");
  if (dedupeParagraphs($, "main .section-head p")) fixesApplied.push("dedupe-section-intros");
  if (polishLocalRelevance($, areaName)) fixesApplied.push("local-relevance");
  if (polishBusinessDetails($, profile)) fixesApplied.push("business-details");
  if (polishCtas($)) fixesApplied.push("cta-consistency");
  if (normalizeTelLinks($)) fixesApplied.push("tel-links");

  $("main ul.clean li").each((_, li) => {
    const raw = $(li).text();
    if (INVALID_PROVIDER.test(normalizeProviderText(raw))) {
      $(li).remove();
      fixesApplied.push("healthcare-invalid-removed");
      return;
    }
    const cleaned = cleanListItem(raw);
    if (!cleaned) {
      $(li).remove();
      fixesApplied.push("healthcare-invalid-removed");
    } else if (cleaned !== normalizeWhitespace(raw)) {
      $(li).text(cleaned);
    }
  });

  return { html: $.html(), fixesApplied: [...new Set(fixesApplied)] };
}

export function polishPharmacyFirstLocalPageFile(
  slug: string,
  areaSlug: string,
  serviceKey = "pharmacy-first",
): LocalPagePolishResult {
  const root = resolvePharmacyWorkspaceRoot();
  const htmlPath = path.join(
    root,
    "output/pharmacy-content-ecosystem",
    slug,
    serviceKey,
    "local",
    areaSlug,
    "index.html",
  );
  if (!fs.existsSync(htmlPath)) {
    return { ok: false, areaSlug, htmlPath, fixesApplied: [] };
  }
  const source = fs.readFileSync(htmlPath, "utf8");
  const { html, fixesApplied } = polishPharmacyFirstLocalPageHtml(source, areaSlug);
  fs.writeFileSync(htmlPath, html, "utf8");
  return { ok: true, areaSlug, htmlPath, fixesApplied };
}

export function polishAllPharmacyFirstLocalPages(slug: string, serviceKey = "pharmacy-first") {
  return PHARMACY_FIRST_ACTIVE_LOCAL_SLUGS.map((areaSlug) =>
    polishPharmacyFirstLocalPageFile(slug, areaSlug, serviceKey),
  );
}
