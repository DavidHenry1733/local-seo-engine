/**
 * LEGACY — quarantined by CPR-PLATFORM-RECOVERY-02.
 * Production service sections use Layout V3 (buildPharmacyServicePageMainHtml).
 */
import * as cheerio from "cheerio";
import { assertLegacyContentEngineAllowed } from "./contentEngine/pharmacyLegacyContentEngineQuarantine.ts";
import {
  balanceProcessSteps,
  normalizeBodyText,
  renderBalancedCardGrid,
  type ContentCard,
} from "./pharmacyServicePageBalance.ts";
import {
  resolvePharmacySlotImage,
  type PharmacyImageRenderContext,
  type PharmacyImageSlot,
} from "./templates/pharmacyImageLibrary.ts";
import type { ParsedMasterSection } from "./pharmacyVisualExperienceLayoutV2.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { resolveOpeningHours } from "./pharmacyServicePageProfileContext.ts";
import { renderProfileTrustCardsHtml } from "./pharmacyServicePageTrustInjection.ts";
import { renderPharmacyLocalAccessMap } from "./pharmacyLocalAccessMap.ts";
import { localiseServicePageBodyText } from "./pharmacyServicePageBodyLocalisation.ts";

type BodyLocaliser = (text: string) => string;

function makeBodyLocaliser(profile: PharmacyServicePageProfile, serviceName: string): BodyLocaliser {
  return (text: string) =>
    localiseServicePageBodyText(text, profile, serviceName, profile.privateServicesAvailable);
}

function localiseCards(cards: ContentCard[], loc: BodyLocaliser): ContentCard[] {
  return cards.map((c) => ({
    ...c,
    title: c.title ? loc(c.title) : c.title,
    body: loc(c.body),
  }));
}

const DASH = "\u2013|\u2014|-";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clusterImagePanel(ctx: PharmacyImageRenderContext, slot: PharmacyImageSlot, panelClass: string): string {
  const resolved = resolvePharmacySlotImage(slot, ctx);
  const href = resolved.assetPath.startsWith("assets/")
    ? `/${resolved.assetPath}`.replace(/\/+/g, "/")
    : `${ctx.previewBasePath ?? "/assets"}/${resolved.assetPath}`.replace(/\/+/g, "/");
  if (resolved.assetExists) {
    return `<div class="${panelClass}"><img src="${esc(href)}" alt="${esc(resolved.alt)}" loading="${slot === "hero" ? "eager" : "lazy"}" decoding="async"></div>`;
  }
  return `<div class="${panelClass}"><div class="v3-placeholder" style="width:100%;height:100%;"><div><strong>${esc(resolved.alt)}</strong></div></div></div>`;
}

function renderSectionHead(title: string, intro = "", center = true): string {
  const cls = center ? "section-head center" : "section-head";
  return `<div class="${cls}">${title ? `<h2>${esc(title)}</h2>` : ""}${intro ? `<p>${esc(intro)}</p>` : ""}</div>`;
}

function proseToCards(proseHtml: string): ContentCard[] {
  if (!proseHtml.trim()) return [];
  const $ = cheerio.load(`<div id="root">${proseHtml}</div>`, { decodeEntities: false });
  const cards: ContentCard[] = [];
  $("#root")
    .children()
    .each((_, el) => {
      const tag = el.tagName?.toLowerCase() || "";
      if (tag === "p") {
        const html = $(el).html() || "";
        const text = $(el).text().trim();
        const strongMatch = html.match(/^<strong>([^<]+)<\/strong>/i);
        if (strongMatch) {
          const title = strongMatch[1]!.replace(new RegExp(`\\s*(?:${DASH})\\s*$`), "").trim();
          const body = text.replace(title, "").replace(new RegExp(`^(?:${DASH}|:|\\s)+`), "").trim();
          cards.push({ title, body });
        }
      } else if (tag === "ul") {
        $(el)
          .find("li")
          .each((_, li) => {
            const liHtml = $(li).html() || "";
            const liText = $(li).text().trim();
            const strongMatch = liHtml.match(/<strong>([^<]+)<\/strong>/i);
            const title = strongMatch?.[1]?.trim() || "";
            const body = strongMatch ? liText.replace(title, "").replace(new RegExp(`^(?:${DASH}|:|\\s)+`), "").trim() : liText;
            if (title) cards.push({ title, body });
          });
      }
    });
  return cards;
}

function splitParagraphs(proseHtml: string): string[] {
  const $ = cheerio.load(`<div id="root">${proseHtml}</div>`, { decodeEntities: false });
  return $("#root > p")
    .toArray()
    .map((el) => $(el).text().trim())
    .filter(Boolean);
}

export function renderPharmacyFirstHero(
  $: cheerio.CheerioAPI,
  ctx: PharmacyImageRenderContext,
  profile: PharmacyServicePageProfile,
): string {
  assertLegacyContentEngineAllowed("pharmacyFirstPageSections", "renderPharmacyFirstHero");
  const tel = profile.phone.replace(/\s/g, "");
  const name = profile.pharmacyName || "your pharmacy";
  const town = profile.town || "Rotherham";
  const intro = `${name} in ${town} provides NHS Pharmacy First for selected minor illness consultations — pharmacist assessment, advice and treatment where appropriate.`;

  return `<section class="hero" id="hero-section" data-template-block="hero">
<div class="wrap hero-grid">
<div>
<div class="eyebrow">${esc(name)} · ${esc(town)} · NHS Pharmacy First</div>
<h1>Pharmacy First at ${esc(name)}</h1>
<p>${esc(intro)}</p>
<div class="btns">
<a class="btn" href="tel:${esc(tel)}">Call ${esc(name)}</a>
<a class="btn secondary" href="#contact">Book / request consultation</a>
</div>
<p class="hero-phone"><a href="tel:${esc(tel)}">${esc(profile.phone)}</a></p>
</div>
${clusterImagePanel(ctx, "hero", "hero-image-wrap hero-media")}
</div>
</section>`;
}

export function renderPharmacyFirstTrustCards(profile: PharmacyServicePageProfile): string {
  return renderProfileTrustCardsHtml(profile, (cards) =>
    renderBalancedCardGrid(cards, { cols: 4 }),
  );
}

export function renderPharmacyFirstQuickAnswer(
  section: ParsedMasterSection | undefined,
  ctx: PharmacyImageRenderContext,
  profile: PharmacyServicePageProfile,
): string {
  if (!section) return "";
  const loc = makeBodyLocaliser(profile, "Pharmacy First");
  const paragraphs = splitParagraphs(section.proseHtml).map(loc);
  const splitParas = paragraphs.slice(0, 1);
  const continuationParas = paragraphs.slice(1);
  const splitCopy = splitParas.map((p) => `<p>${esc(p)}</p>`).join("\n");
  const continuation =
    continuationParas.length > 0
      ? `<div class="definition-split-continuation">${continuationParas.map((p) => `<p>${esc(p)}</p>`).join("\n")}</div>`
      : "";

  return `<section class="blue-band" id="quick-answer" data-template-block="quick-answer">
<div class="wrap">
${renderSectionHead(section.title, "", true)}
<div class="definition-split-row">
<div class="definition-split-copy">
<span class="tag">${esc(section.kicker || "Service overview")}</span>
${splitCopy}
</div>
<div class="definition-split-media">${clusterImagePanel(ctx, "support", "image-panel support-block-media")}</div>
</div>
${continuation}
</div>
</section>`;
}

export function renderPharmacyFirstServiceBreakdown(
  section: ParsedMasterSection | undefined,
  profile: PharmacyServicePageProfile,
): string {
  if (!section) return "";
  const loc = makeBodyLocaliser(profile, "Pharmacy First");
  const cards = localiseCards(proseToCards(section.proseHtml).filter((c) => c.title), loc);
  const trailing = localiseCards(proseToCards(section.proseHtml).filter((c) => !c.title), loc);
  const trailingHtml = trailing.length
    ? `<div class="section-head" style="margin-top:28px"><p>${trailing.map((c) => esc(c.body.replace(/<[^>]+>/g, ""))).join(" ")}</p></div>`
    : "";
  return `<section id="split-section-one" data-template-block="service-breakdown">
<div class="wrap">
${renderSectionHead(section.title, "", false)}
${renderBalancedCardGrid(cards.slice(0, 9), { cols: 3, gridClass: "conditions-grid" })}
${trailingHtml}
</div>
</section>`;
}

export function renderPharmacyFirstProcess(
  section: ParsedMasterSection | undefined,
  profile: PharmacyServicePageProfile,
): string {
  if (!section) return "";
  const loc = makeBodyLocaliser(profile, "Pharmacy First");
  const name = profile.pharmacyName || "your pharmacy";
  const $ = cheerio.load(`<div>${section.proseHtml}</div>`);
  const paras = $("p").toArray();
  const stepTitles = [`Contact ${name}`, "Private consultation", "Your outcome", "Follow-up care"];
  const balancedBodies = balanceProcessSteps(paras.slice(0, 4).map((el) => loc($(el).text().trim())));
  const cards: ContentCard[] = balancedBodies.map((body, i) => ({
    title: stepTitles[i] || `Step ${i + 1}`,
    body,
  }));

  return `<section class="blue-band" data-template-block="process">
<div class="wrap">
${renderSectionHead(section.title, `How your Pharmacy First consultation works at ${name}.`, true)}
${renderBalancedCardGrid(cards, { cols: 4, stepNumbers: true, gridClass: "process-grid" })}
</div>
</section>`;
}

export function renderPharmacyFirstSafety(
  section: ParsedMasterSection | undefined,
  profile: PharmacyServicePageProfile,
  consultImageHtml = "",
): string {
  if (!section) return "";
  const loc = makeBodyLocaliser(profile, "Pharmacy First");
  const $p = cheerio.load(`<div>${section.proseHtml}</div>`);
  const intro = $p("p")
    .slice(0, 2)
    .map((_, el) => `<p>${esc(loc($p(el).text().trim()))}</p>`)
    .get()
    .join("");
  return `<section class="impact" data-template-block="safety">
<div class="wrap grid-2 safety-split">
<div class="safety-prose-col">
<span class="tag">When to seek GP or urgent care</span>
<h2>${esc(section.title)}</h2>
<div class="safety-prose">${intro}</div>
</div>
<div class="safety-media">${consultImageHtml}</div>
</div>
</section>`;
}

export function renderPharmacyFirstFaq($: cheerio.CheerioAPI, profile: PharmacyServicePageProfile): string {
  const loc = makeBodyLocaliser(profile, "Pharmacy First");
  const faq = $('section[data-component="faq-accordion"]').first();
  if (!faq.length) return "";
  const title = faq.find(".section-title").first().text().trim() || "Frequently Asked Questions";
  const items: string[] = [];
  faq.find(".faq-item").each((_, el) => {
    const q = loc($(el).find(".faq-q").first().text().trim());
    const a = normalizeBodyText(loc($(el).find(".faq-answer").first().text().trim()));
    if (q && a) items.push(`<div class="cluster-faq-item faq-card"><h3 class="faq-q">${esc(q)}</h3><p class="faq-a">${esc(a)}</p></div>`);
  });
  return `<section class="faq" id="faq-section" data-template-block="faq">
<div class="wrap">${renderSectionHead(title, "", false)}${items.join("\n")}</div>
</section>`;
}

function extractOpeningHours(section: ParsedMasterSection | undefined): string {
  if (!section) return "";
  const match = section.proseHtml.match(/Monday to Friday[^<]+/i);
  return match?.[0]?.trim() || "";
}

export function renderPharmacyFirstLocal(
  $: cheerio.CheerioAPI,
  section13: ParsedMasterSection | undefined,
  profile: PharmacyServicePageProfile,
): string {
  const local = $('section[data-component="master-local-relevance"], section[data-section-type="localRelevance"]').first();
  const name = profile.pharmacyName || "Your pharmacy";
  const town = profile.town || "";
  const title =
    local.find(".section-title").first().text().trim() ||
    (town ? `${name} — Pharmacy First in ${town}` : `${name} — Pharmacy First`);
  const intro =
    local.find(".section-intro, .section-lead").first().text().trim() ||
    (profile.phone
      ? `${name} is your local pharmacy for NHS Pharmacy First. Call ${profile.phone} to check availability.`
      : `${name} is your local pharmacy for NHS Pharmacy First.`);
  const hours = resolveOpeningHours(profile, extractOpeningHours(section13));
  const tel = profile.phone.replace(/\s/g, "");
  const ctaHref = profile.bookingUrl || "#contact";
  const ctaLabel = profile.primaryCta || "Book Consultation";
  const coverageLabel = town ? `Areas served around ${town}` : "Areas served";
  const coverageHtml =
    profile.coverageAreas.length > 0
      ? `<div><strong>${esc(coverageLabel)}</strong><div class="coverage-tags">${profile.coverageAreas.slice(0, 10).map((a) => `<span class="coverage-tag">${esc(a)}</span>`).join("")}</div></div>`
      : "";

  return `<section class="local" id="local-access" data-template-block="local">
<div class="wrap">
${renderSectionHead(title, intro, true)}
<div class="pharmacy-local-grid">
<div class="pharmacy-local-details">
<h3>${esc(name)}</h3>
<p><strong>Address:</strong> ${esc(profile.fullAddress || `${profile.town}, ${profile.postcode}`.trim())}</p>
${profile.phone ? `<p><strong>Phone:</strong> <a href="tel:${esc(tel)}">${esc(profile.phone)}</a></p>` : ""}
${hours ? `<p><strong>Opening hours:</strong> ${esc(hours)}</p>` : ""}
${profile.coverageRadius && town ? `<p><strong>Coverage:</strong> ${esc(profile.coverageRadius)} from ${esc(town)}</p>` : profile.coverageRadius ? `<p><strong>Coverage:</strong> ${esc(profile.coverageRadius)}</p>` : ""}
${coverageHtml}
<div class="local-access-cta"><a class="btn" href="${esc(ctaHref)}">${esc(ctaLabel)}</a></div>
</div>
${renderPharmacyLocalAccessMap(profile)}
</div>
</div>
</section>`;
}

export function renderPharmacyFirstConversionCta(
  $: cheerio.CheerioAPI,
  ctx: PharmacyImageRenderContext,
  profile: PharmacyServicePageProfile,
): string {
  const cta = $('section[data-component="cta-block"]').first();
  const name = profile.pharmacyName || "your pharmacy";
  const heading = cta.find("h2").first().text().trim() || `Book Pharmacy First at ${name}`;
  const body =
    cta.find("p").first().text().trim() ||
    `Call ${profile.phone} to ask about Pharmacy First at ${name}. Describe your symptoms so the team can allow enough consultation time.`;
  const tel = profile.phone.replace(/\s/g, "");
  return `<section class="section-band conversion-image-section" data-template-block="conversion-image">
<div class="wrap">${clusterImagePanel(ctx, "conversion", "image-panel conversion-feature-image")}</div>
</section>
<section id="contact" class="cta-band" data-template-block="final-cta">
<div class="wrap">
<h2>${esc(heading)}</h2>
<p class="cta-close">${esc(body)}</p>
<div class="cta-actions">
<a class="btn-white" href="tel:${esc(tel)}">Call ${esc(name)} — ${esc(profile.phone)}</a>
<a class="btn-white-outline" href="#faq-section">View FAQs</a>
</div>
</div>
</section>`;
}
