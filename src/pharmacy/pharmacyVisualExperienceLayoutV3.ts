/**
 * PharmaConnect Approved Service Page Template — lockdown-v1 fixed slots.
 * Content fills predefined layout slots; the template never derives layout from prose shape.
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import {
  resolvePharmacyImageWithAssignments,
  resolvePharmacyLibrarySlotImage,
  type PharmacyImageRenderContext,
  type PharmacyImageSlot,
} from "./pharmacyImageAssignmentResolver.ts";
import { parseMasterSections, type ParsedMasterSection } from "./pharmacyVisualExperienceLayoutV2.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import {
  buildProfileFinalCtaHtml,
  buildProfileLocalSectionHtml,
  type LocalAreaLink,
  renderProfileTrustCardsHtml,
} from "./pharmacyServicePageTrustInjection.ts";
import { renderProfessionalReviewPanelHtml } from "./pharmacyProfessionalReviewPanel.ts";
import { localiseServicePageBodyText } from "./pharmacyServicePageBodyLocalisation.ts";
import {
  balanceProcessSteps,
  normalizeBodyText,
  renderBalancedCardGrid,
  shortenToSentenceCount,
  type ContentCard,
} from "./pharmacyServicePageBalance.ts";
import { PHARMACY_VISUAL_PIPELINE_VERSION } from "./pharmacyThemeEngine.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import {
  appendExtrasToParagraph,
  preferredServicePageCta,
  servicePageDefinitionExtras,
  servicePageFaqEntries,
  servicePageHeroEyebrow,
  servicePageHeroIntro,
  servicePageProcessIntro,
  servicePageSupportExtras,
  servicePageTrustProseExtras,
} from "./contentEngine/pharmacyCommercialNarrativeEngineV1.ts";
import {
  isTravelVaccinationsService,
  resolveContactCtaHref,
  servicePageConditionsIntro,
  servicePageEligibilityIntro,
  servicePageProcessFallbackSteps,
  servicePageTrustFallbackProse,
} from "./pharmacyServicePageIntelligence.ts";
import { resolveCommercialSectionPlanV1 } from "./contentEngine/pharmacyCommercialSectionPlannerV1.ts";
import { resolveServicePageFaqAnswerFromSections } from "./pharmacyFaqAlignment.ts";
import { resolveServicePageFaqContent, lockdownPharmacyFirstFaqsFromReference, projectLockedApprovedBankServicePageFaqs, type ResolvedFaqEntry } from "./pharmacyFaqContentResolver.ts";
import { renderMediaTextSection } from "./pharmacyMediaFloatFlowComponent.ts";
import { filterServiceOverviewParagraphs, stripUnconfirmedConsultationRoomClaims } from "./pharmacyTrustCopyGuards.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { resolveComponentDnaForRender } from "./pharmacyComponentDnaResolver.ts";
import type { ComponentDna } from "./pharmacyComponentDnaTypes.ts";
import { renderBrandHeroComponent } from "./pharmacyBrandDnaComponentRenderers.ts";
import {
  hasActivatedTenantDesignDna,
  recordRenderFallback,
} from "./pharmacyTenantDnaRenderActivation.ts";
import {
  approvedBankContractToParsedSections,
  withApprovedBankServicePageContract,
  type ApprovedBankProcessStep,
} from "./pharmacyApprovedBankCorePageContract.ts";
import { isApprovedBankRegisteredService } from "./pharmacyServiceVariantLibrary.ts";
import {
  resolveDesignIntelligenceSlotImage,
  shouldUseDesignIntelligenceImages,
} from "./pharmacyDesignIntelligenceImageService.ts";
import { renderResolvedImageSlotHtml } from "./pharmacyImageSlotRenderHelpers.ts";

type BodyLocaliser = (text: string) => string;

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

const DASH = "\u2013|\u2014|-";

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

function cleanServiceCardTitle(title: string): string {
  return title.replace(/^\d+(?:\.\d+)?\s+/, "").replace(/\s{2,}/g, " ").trim();
}

function cleanServiceCardBody(body: string, maxSentences = 2): string {
  return shortenToSentenceCount(
    body
      .replace(/\b(?:Description|Typical symptoms|When Pharmacy First is appropriate|When GP referral is required|When urgent care is required|Assessment process|Treatment options|Follow up process)\s*:\s*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim(),
    maxSentences,
  );
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSectionHead(title: string, intro = "", center = true): string {
  const cls = center ? "section-head center" : "section-head";
  return `<div class="${cls}">${title ? `<h2>${esc(title)}</h2>` : ""}${intro ? `<p>${esc(intro)}</p>` : ""}</div>`;
}

function resolvePrimaryCtaHref(
  profile: PharmacyServicePageProfile,
  contentContext?: ContentGenerationContext,
  label?: string,
): string {
  const ctaLabel = label || preferredServicePageCta(contentContext, profile);
  return resolveContactCtaHref(profile, ctaLabel);
}

function resolveTenantSlotImage(
  ctx: PharmacyImageRenderContext,
  slot: PharmacyImageSlot,
  panelClass: string,
): string {
  if (ctx.slug && (shouldUseDesignIntelligenceImages(ctx.slug) || hasActivatedTenantDesignDna(ctx.slug))) {
    const resolved = resolveDesignIntelligenceSlotImage(ctx.slug, slot, ctx);
    if (!resolved.assetExists || !resolved.assetPath) {
      recordRenderFallback(`image-${slot}`, "content-image-slot-blocked", true);
      throw new Error(`Required content image slot blocked for ${ctx.slug}:${slot}`);
    }
    if (resolved.source === "website-import") {
      recordRenderFallback(`image-${slot}`, "website-import-content-image-blocked", true);
      throw new Error(`Website-import content image blocked for ${ctx.slug}:${slot}`);
    }
    return clusterImagePanelFromResolved(resolved, slot, panelClass);
  }
  return clusterImagePanel(ctx, slot, panelClass);
}

function clusterImagePanelFromResolved(
  resolved: ReturnType<typeof resolvePharmacyImageWithAssignments>,
  slot: PharmacyImageSlot,
  panelClass: string,
): string {
  if (!resolved.assetExists || !resolved.assetPath) {
    return `<div class="${panelClass}" data-image-slot="${esc(slot)}" data-image-missing="true" aria-hidden="true"></div>`;
  }
  return renderResolvedImageSlotHtml(resolved, slot, panelClass);
}

function clusterImagePanel(
  ctx: PharmacyImageRenderContext,
  slot: PharmacyImageSlot,
  panelClass: string,
): string {
  const resolved = ctx.slug
    ? resolvePharmacyImageWithAssignments(ctx.slug, slot, ctx)
    : resolvePharmacyLibrarySlotImage(slot, ctx);

  if (!resolved.assetExists || !resolved.assetPath) {
    return `<div class="${panelClass}" data-image-slot="${esc(slot)}" data-image-missing="true" aria-hidden="true"></div>`;
  }

  return renderResolvedImageSlotHtml(resolved, slot, panelClass);
}

/** Extract only explicitly titled list/card items — never one card per paragraph. */
function proseToTitledCards(proseHtml: string): ContentCard[] {
  if (!proseHtml.trim()) return [];
  const $ = cheerio.load(`<div id="root">${proseHtml}</div>`, { decodeEntities: false });
  const cards: ContentCard[] = [];
  const headings = $("#root > h3").toArray();
  if (headings.length) {
    for (const heading of headings) {
      const title = $(heading).text().trim();
      const bodyParts: string[] = [];
      let cursor = $(heading).next();
      while (cursor.length && cursor.get(0)?.tagName?.toLowerCase() !== "h3") {
        const text = cursor.text().replace(/\s+/g, " ").trim();
        if (text) bodyParts.push(text);
        cursor = cursor.next();
      }
      const body = bodyParts.join(" ");
      if (title && body) cards.push({ title, body });
    }
    return uniqueContentCards(cards);
  }
  $("#root")
    .children()
    .each((_, el) => {
      const tag = el.tagName?.toLowerCase() || "";
      if (tag === "p") {
        const html = $(el).html() || "";
        const text = $(el).text().trim();
        const strongMatch = html.match(/^<strong>([^<]+)<\/strong>/i);
        if (strongMatch) {
          const title = strongMatch[1]!.replace(new RegExp(`\\s*(?:${DASH})\\s*`), "").trim();
          const body = text.replace(title, "").replace(new RegExp(`^(?:${DASH}|:|\\s)+`), "").trim();
          if (title && body) cards.push({ title, body });
        }
      } else if (tag === "ul" || tag === "ol") {
        $(el)
          .find("li")
          .each((_, li) => {
            const liHtml = $(li).html() || "";
            const liText = $(li).text().trim();
            const strongMatch = liHtml.match(/<strong>([^<]+)<\/strong>/i);
            const title = strongMatch?.[1]?.trim() || "";
            const body = strongMatch
              ? liText.replace(title, "").replace(new RegExp(`^(?:${DASH}|:|\\s)+`), "").trim()
              : "";
            if (title && body) cards.push({ title, body });
          });
      }
    });
  return uniqueContentCards(cards);
}

function uniqueContentCards(cards: ContentCard[]): ContentCard[] {
  const seen = new Set<string>();
  const out: ContentCard[] = [];
  for (const card of cards) {
    const key = `${card.title} ${card.body}`.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}

function splitParagraphs(proseHtml: string): string[] {
  const $ = cheerio.load(`<div id="root">${proseHtml}</div>`, { decodeEntities: false });
  return $("#root > p")
    .toArray()
    .map((el) => $(el).text().trim())
    .filter(Boolean);
}

/** Short card title from an untitled list item (shared Layout V3 presentation). */
function shortTitleFromListItem(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/^(You are|You need|You want|You're|You)\s+/i, "");
  if (!t) t = text.replace(/\s+/g, " ").trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (t.length <= 56) return t;
  const cut = t.slice(0, 56);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 24 ? cut.slice(0, sp) : cut).trim()}…`;
}

/**
 * Untitled ul/ol items → titled cards for conditions-grid.
 * Used when prose lacks strong/h3 titles so services still get the shared card contract
 * instead of a left-aligned master-prose wall.
 */
function cardsFromUntitledListItems(proseHtml: string): ContentCard[] {
  if (!proseHtml.trim()) return [];
  const $ = cheerio.load(`<div id="root">${proseHtml}</div>`, { decodeEntities: false });
  const items: string[] = [];
  $("#root ul li, #root ol li").each((_, li) => {
    const liHtml = $(li).html() || "";
    const liText = $(li).text().replace(/\s+/g, " ").trim();
    if (!liText) return;
    if (/<strong>[^<]+<\/strong>/i.test(liHtml)) return;
    items.push(liText);
  });
  if (items.length < 2) return [];
  return items.slice(0, 7).map((li) => ({
    title: shortTitleFromListItem(li),
    body: li,
  }));
}

/** First framing paragraph before any list — section-head intro for list-derived cards. */
function conditionsFramingIntro(proseHtml: string): string {
  if (!proseHtml.trim()) return "";
  const $ = cheerio.load(`<div id="root">${proseHtml}</div>`, { decodeEntities: false });
  for (const el of $("#root").children().toArray()) {
    const tag = el.tagName?.toLowerCase() || "";
    if (tag === "ul" || tag === "ol") break;
    if (tag !== "p") continue;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (
      text.length > 40 &&
      !/:\s*$/.test(text) &&
      !/benefit from an early consultation if/i.test(text) &&
      !/particularly benefit/i.test(text)
    ) {
      return text;
    }
  }
  return "";
}

/** Caveat / trailing paragraphs after the list → extra conditions cards. */
function cardsFromTrailingConditionParagraphs(proseHtml: string): ContentCard[] {
  if (!proseHtml.trim()) return [];
  const $ = cheerio.load(`<div id="root">${proseHtml}</div>`, { decodeEntities: false });
  let afterList = false;
  const trailing: string[] = [];
  $("#root")
    .children()
    .each((_, el) => {
      const tag = el.tagName?.toLowerCase() || "";
      if (tag === "ul" || tag === "ol") {
        afterList = true;
        return;
      }
      if (!afterList || tag !== "p") return;
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length > 40) trailing.push(text);
    });
  return trailing.slice(0, 3).map((p) => ({
    title: shortTitleFromListItem((p.split(/(?<=[.!?])\s+/)[0] || p).slice(0, 80)),
    body: p,
  }));
}

/** Ordered list items from master prose — used for consultation journey cards. */
function extractOrderedProcessItems(proseHtml: string): string[] {
  if (!proseHtml.trim()) return [];
  const $ = cheerio.load(`<div id="root">${proseHtml}</div>`, { decodeEntities: false });
  return $("#root ol li")
    .toArray()
    .map((el) => $(el).text().replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const TRAVEL_PROCESS_TITLES = [
  "Travel itinerary discussion",
  "Travel health assessment",
  "Destination-specific recommendations",
  "Vaccination planning",
];

function cardsFromOrderedProcessItems(
  items: string[],
  serviceId?: string,
  serviceName?: string,
): ContentCard[] {
  if (!items.length) return [];
  const titles = isTravelVaccinationsService(serviceId, serviceName)
    ? TRAVEL_PROCESS_TITLES
    : items.map((_, i) => `Step ${i + 1}`);
  if (isTravelVaccinationsService(serviceId, serviceName) && items.length >= 4) {
    return [
      { title: titles[0]!, body: items[0]! },
      { title: titles[1]!, body: items[1]! },
      { title: titles[2]!, body: items[2]! },
      {
        title: titles[3]!,
        body: [items[3], items[4], items[5]].filter(Boolean).join(" "),
      },
    ];
  }
  return items.slice(0, 4).map((body, i) => ({
    title: titles[i] || `Step ${i + 1}`,
    body,
  }));
}

function renderHeroSection(
  ctx: PharmacyImageRenderContext,
  profile: PharmacyServicePageProfile,
  componentDna: ComponentDna,
  contentContext?: ContentGenerationContext,
): string {
  const name = profile.pharmacyName;
  const evidenceCta = preferredServicePageCta(contentContext, profile);
  // Evidence-gated CTA wins over Brand DNA / profile header booking labels.
  const ctaLabel =
    evidenceCta === "Contact the pharmacy"
      ? evidenceCta
      : profile.headerCtaText && !/call pharmacy/i.test(profile.headerCtaText)
        ? profile.headerCtaText
        : evidenceCta;
  const ctaHref = resolvePrimaryCtaHref(profile, contentContext, ctaLabel);
  const intro = servicePageHeroIntro(contentContext, profile, ctx.serviceName);
  const eyebrow = servicePageHeroEyebrow(contentContext, profile, ctx.serviceName);
  const secondaryLabel = profile.secondaryCtaText?.trim() || "Get directions";
  const secondaryHref =
    profile.secondaryCtaUrl?.trim() ||
    (profile.googlePlaceId
      ? `https://www.google.com/maps/dir/?api=1&destination_place_id=${encodeURIComponent(profile.googlePlaceId)}`
      : profile.fullAddress || profile.addressLine1
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            profile.customerFacingAddress ||
              profile.fullAddress ||
              [profile.addressLine1, profile.town, profile.postcode].filter(Boolean).join(", "),
          )}`
        : "#local-access");

  return renderBrandHeroComponent(componentDna.variants, {
    profile,
    eyebrow,
    headline: `${ctx.serviceName} at ${name}`,
    intro,
    primaryCtaLabel: ctaLabel,
    primaryCtaHref: ctaHref.startsWith("tel:") || ctaHref.startsWith("http") ? ctaHref : "#contact",
    secondaryCtaLabel: secondaryLabel || undefined,
    secondaryCtaHref: secondaryLabel ? secondaryHref : undefined,
    heroImageHtml: resolveTenantSlotImage(ctx, "hero", "hero-image-wrap hero-media"),
    componentDna,
  });
}

function renderTrustCards(
  profile: PharmacyServicePageProfile,
  componentDna: ComponentDna,
  contentContext?: ContentGenerationContext,
): string {
  const cols = componentDna.trust.cardColumns || 4;
  return renderProfileTrustCardsHtml(
    profile,
    (cards) => renderBalancedCardGrid(cards, { cols, gridClass: "trust-cards-grid" }),
    contentContext,
    { skipGenericFillers: false },
  );
}

/** Slot 4 — Service overview with content-length-driven media/text layout. */
function renderServiceDefinitionSplit(
  section: ParsedMasterSection | undefined,
  ctx: PharmacyImageRenderContext,
  profile: PharmacyServicePageProfile,
  loc: BodyLocaliser,
  contentContext?: ContentGenerationContext,
): string {
  if (!section) return "";
  const rawParagraphs = splitParagraphs(section.proseHtml).map(loc);
  const paragraphs = filterServiceOverviewParagraphs(rawParagraphs, profile);
  if (!paragraphs.length) return "";

  const brand = resolveBrandDnaForRender(profile.slug);
  const componentDna = resolveComponentDnaForRender(profile.slug, brand);
  const definitionExtras = servicePageDefinitionExtras(contentContext);
  if (paragraphs.length) {
    paragraphs[0] = appendExtrasToParagraph(paragraphs[0], definitionExtras);
  }

  return renderMediaTextSection({
    sectionId: "service-definition",
    sectionClass: "blue-band",
    templateBlock: "service-definition",
    kicker: section.kicker || "Service overview",
    headHtml: renderSectionHead(section.title, "", true),
    paragraphs,
    mediaHtml: resolveTenantSlotImage(ctx, "support", "image-panel support-block-media"),
    thresholds: componentDna.splitSection.layoutThresholds,
  });
}

/** Slot 5 — Conditions / key points: titled cards only, max 9, DNA-driven column grid. */
function renderConditionsGrid(
  section: ParsedMasterSection | undefined,
  loc: BodyLocaliser,
  componentDna: ComponentDna,
  serviceId?: string,
  serviceName?: string,
): string {
  if (!section) return "";
  const titled = proseToTitledCards(section.proseHtml);
  const fromList = titled.length
    ? []
    : [...cardsFromUntitledListItems(section.proseHtml), ...cardsFromTrailingConditionParagraphs(section.proseHtml)];
  const cards = localiseCards(titled.length ? titled : fromList, loc)
    .slice(0, 7)
    .map((card) => ({
      title: cleanServiceCardTitle(card.title),
      body: cleanServiceCardBody(card.body, 2),
    }));
  if (!cards.length) {
    const paragraphs = splitParagraphs(section.proseHtml).map(loc).slice(0, 4);
    if (!paragraphs.length) return "";
    const intro = servicePageConditionsIntro(serviceId, serviceName);
    return `<section id="conditions-grid" data-template-block="conditions">
<div class="wrap">
${renderSectionHead(section.title, intro, true)}
<div class="content-card master-prose narrative-prose">${paragraphs.map((p) => `<p>${esc(p)}</p>`).join("\n")}</div>
</div>
</section>`;
  }

  // Shared centred section-head for all services; card bodies stay left-aligned.
  const headIntro = fromList.length ? loc(conditionsFramingIntro(section.proseHtml)) : "";

  return `<section id="conditions-grid" data-template-block="conditions">
<div class="wrap">
${renderSectionHead(section.title, headIntro, true)}
${renderBalancedCardGrid(cards, { cols: componentDna.card.columns || 3, gridClass: "conditions-grid", maxSentences: 2 })}
</div>
</section>`;
}

/** Slot 6 — 4-step appointment / process grid from section paragraphs. */
function renderProcessGrid(
  section: ParsedMasterSection | undefined,
  profile: PharmacyServicePageProfile,
  serviceName: string,
  loc: BodyLocaliser,
  contentContext: ContentGenerationContext | undefined,
  componentDna: ComponentDna,
  serviceId?: string,
  lockedSteps?: ApprovedBankProcessStep[],
): string {
  if (lockedSteps?.length) {
    const cards: ContentCard[] = lockedSteps
      .filter((step) => step.title.trim() || step.body.trim() || (step.bullets || []).some((bullet) => bullet.trim()))
      .map((step, index) => ({
        title: loc(step.title || `Step ${index + 1}`),
        body: loc([step.body, ...(step.bullets || [])].filter((part) => part.trim()).join(" ")),
      }));
    return `<section class="blue-band" data-template-block="process">
<div class="wrap">
${renderSectionHead(section?.title || "How the service works", "", true)}
${renderBalancedCardGrid(cards, { cols: componentDna.process.columns || 4, stepNumbers: true, gridClass: "process-grid" })}
</div>
</section>`;
  }
  if (!section) return "";
  const titledCards = localiseCards(proseToTitledCards(section.proseHtml), loc).slice(0, 4);
  const orderedCards = localiseCards(
    cardsFromOrderedProcessItems(
      extractOrderedProcessItems(section.proseHtml),
      serviceId || contentContext?.serviceId,
      serviceName,
    ),
    loc,
  );
  const fallbackCards = servicePageProcessFallbackSteps(
    profile,
    serviceName,
    serviceId || contentContext?.serviceId,
  );
  const sectionCards = titledCards.length ? titledCards : orderedCards.length ? orderedCards : fallbackCards;
  const stepTitles = sectionCards.map((card) => card.title);
  const balancedBodies = balanceProcessSteps(sectionCards.map((card) => card.body));
  const supportExtras = servicePageSupportExtras(contentContext);
  const cards: ContentCard[] = balancedBodies.map((body, i) => ({
    title: stepTitles[i] || `Step ${i + 1}`,
    body: cleanServiceCardBody(
      stripUnconfirmedConsultationRoomClaims(
        i === 1 ? appendExtrasToParagraph(body, supportExtras) : body,
        profile,
      ),
      2,
    ),
  }));

  return `<section class="blue-band" data-template-block="process">
<div class="wrap">
${renderSectionHead(section.title, servicePageProcessIntro(contentContext, profile, serviceName), true)}
${renderBalancedCardGrid(cards, { cols: componentDna.process.columns || 4, stepNumbers: true, gridClass: "process-grid", maxSentences: 2 })}
</div>
</section>`;
}

function stripUnverifiedAgeRestrictions(proseHtml: string, verifiedAgeRestrictions: string): string {
  if (verifiedAgeRestrictions.trim()) return proseHtml;
  const $ = cheerio.load(`<div id="root">${proseHtml}</div>`, { decodeEntities: false });
  $("#root > h3").each((_, heading) => {
    const title = $(heading).text().replace(/\s+/g, " ").trim();
    if (!/age restrictions/i.test(title)) return;
    let cursor = $(heading).next();
    while (cursor.length && cursor.get(0)?.tagName?.toLowerCase() !== "h3") {
      const next = cursor.next();
      cursor.remove();
      cursor = next;
    }
    $(heading).remove();
  });
  return $("#root").html() || proseHtml;
}

function resolveVerifiedAgeRestrictions(
  _profile: PharmacyServicePageProfile,
  contentContext?: ContentGenerationContext,
): string {
  const serviceId = contentContext?.serviceId || "";
  const fromIntel = contentContext?.businessProfileIntelligence?.services?.byServiceId?.[serviceId]
    ?.ageRestrictions;
  if (fromIntel?.trim()) return fromIntel.trim();
  return "";
}

function renderEligibilitySection(
  section: ParsedMasterSection | undefined,
  profile: PharmacyServicePageProfile,
  contentContext?: ContentGenerationContext,
): string {
  if (!section) return "";
  const proseHtml = stripUnverifiedAgeRestrictions(
    section.proseHtml,
    resolveVerifiedAgeRestrictions(profile, contentContext),
  );
  const intro = servicePageEligibilityIntro(contentContext?.serviceId, contentContext?.serviceName);
  const uniqueProse = uniqueHtmlHeadingBlocksForRender(proseHtml);
  const $prose = cheerio.load(`<div id="elig">${uniqueProse}</div>`, { decodeEntities: false });
  $prose("#elig")
    .find("*")
    .contents()
    .each((_, node) => {
      if (node.type === "text" && "data" in node && typeof node.data === "string") {
        node.data = localiseServicePageBodyText(node.data, profile, contentContext?.serviceName || "Pharmacy First");
      }
    });
  const title = section.title || "Eligibility and conditions";
  return `<section class="blue-band eligibility-section" id="eligibility-section" data-template-block="eligibility">
<div class="wrap">
${renderSectionHead(title, intro, true)}
<div class="content-card master-prose narrative-prose">${$prose("#elig").html() || uniqueProse}</div>
</div>
</section>`;
}

function uniqueHtmlHeadingBlocksForRender(html: string): string {
  const h3Blocks = String(html || "").match(/<h3\b[\s\S]*?(?=<h3\b|$)/gi);
  if (!h3Blocks || h3Blocks.length < 2) return html;
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const block of h3Blocks) {
    const title = (block.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (title && seen.has(title)) continue;
    if (title) seen.add(title);
    kept.push(block.trim());
  }
  return kept.join("\n");
}

/** Slot 7 — Full-width support image band with short intro. */
function renderSupportImageBand(
  section: ParsedMasterSection | undefined,
  ctx: PharmacyImageRenderContext,
  loc: BodyLocaliser,
  contentContext?: ContentGenerationContext,
): string {
  if (section && /common patient questions|frequently asked/i.test(section.title)) return "";
  const introRaw = section ? loc(splitParagraphs(section.proseHtml)[0] || "") : "";
  const intro = introRaw ? appendExtrasToParagraph(introRaw, servicePageSupportExtras(contentContext)) : "";
  return `<section class="support-image-band soft" data-template-block="support-image">
<div class="wrap">
<div class="section-head center">
<span class="tag">Clinical environment</span>
${section ? `<h2>${esc(section.title)}</h2>` : "<h2>Professional pharmacy care</h2>"}
${intro ? `<p>${esc(intro)}</p>` : ""}
</div>
</div>
</section>`;
}

/** Slot 8 — Safety panel: prose left, titled safety cards right (max 4). */
function renderSafetyPanel(
  section: ParsedMasterSection | undefined,
  profile: PharmacyServicePageProfile,
  serviceName: string,
  loc: BodyLocaliser,
): string {
  if (!section) return "";
  const isMisconceptions = /misconception/i.test(section.title);
  const cards = localiseCards(proseToTitledCards(section.proseHtml), loc);
  const titled = cards.slice(0, 4);
  const $p = cheerio.load(`<div>${section.proseHtml}</div>`);
  const intro = $p("p")
    .slice(0, 2)
    .map((_, el) => `<p>${esc(loc($p(el).text().trim()))}</p>`)
    .get()
    .join("");
  const cardGrid =
    titled.length > 0
      ? renderBalancedCardGrid(titled, { cols: 2, gridClass: "safety-grid" })
      : "";
  const introHtml =
    isMisconceptions && cardGrid ? "" : `<div class="safety-prose">${intro}</div>`;

  return `<section class="impact" data-template-block="safety">
<div class="wrap grid-2 safety-split">
<div>
<span class="tag">When to seek GP or urgent care</span>
<h2>${esc(section.title)}</h2>
${introHtml}
</div>
${cardGrid ? `<div class="safety-cards">${cardGrid}</div>` : ""}
</div>
</section>`;
}

function extractTrustBadges($: cheerio.CheerioAPI): string[] {
  return $('[data-component="pharmacy-trust-panel"] .trust-panel-badge')
    .toArray()
    .map((el) => $(el).text().replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Slot 9 — Trust: prose left, credentials + trust image right. No card grid on left. */
function renderTrustSection(
  section: ParsedMasterSection | undefined,
  $: cheerio.CheerioAPI,
  ctx: PharmacyImageRenderContext,
  profile: PharmacyServicePageProfile,
  loc: BodyLocaliser,
  contentContext?: ContentGenerationContext,
): string {
  const funding = (() => {
    try {
      const data = (loadPharmacyProfile(profile.slug)?.data || {}) as {
        serviceDeliveryProfiles?: Record<string, { fundingModel?: string }>;
      };
      return String(data.serviceDeliveryProfiles?.[ctx.serviceKey]?.fundingModel || "unknown").toLowerCase();
    } catch {
      return "unknown";
    }
  })();
  const nhsFundingConfirmed = funding === "nhs" || funding === "mixed";
  const badges = extractTrustBadges($).filter((badge) => {
    const lower = badge.toLowerCase();
    if (!profile.gphcNumber?.trim() && /gphc registered pharmacy/i.test(lower)) return false;
    if (!profile.consultationRoomAvailable && /private consultation room/i.test(lower)) return false;
    // Unknown/private funding must never surface NHS trust badges on the service page.
    if (!nhsFundingConfirmed && /\bnhs\b/i.test(lower)) return false;
    return true;
  });
  const fallbackBadges: string[] = [];
  if (profile.gphcNumber?.trim()) fallbackBadges.push("GPhC registered pharmacy");
  if (profile.consultationRoomAvailable) fallbackBadges.push("Private consultation room");
  if (nhsFundingConfirmed) fallbackBadges.push("NHS service standards");
  if (!fallbackBadges.length) fallbackBadges.push("Community pharmacy team");
  const trustGrid =
    badges.length > 0
      ? `<div class="trust-grid">${badges.map((b) => `<div class="trust-item">${esc(b)}</div>`).join("")}</div>`
      : `<div class="trust-grid">${fallbackBadges.map((b) => `<div class="trust-item">${esc(b)}</div>`).join("")}</div>`;
  let proseHtml = "";
  if (section) {
    const $p = cheerio.load(`<div>${section.proseHtml}</div>`);
    const paras = $p("p")
      .slice(0, 3)
      .toArray()
      .map((el) => loc($p(el).text().trim()))
      .filter(Boolean);
    const trustExtras = servicePageTrustProseExtras(contentContext);
    proseHtml = paras
      .map((p, i) => `<p>${esc(i === paras.length - 1 ? appendExtrasToParagraph(p, trustExtras) : p)}</p>`)
      .join("");
  }
  const name = profile.pharmacyName;
  if (!proseHtml) {
    proseHtml = `<p>${esc(servicePageTrustFallbackProse(profile, ctx.serviceName, ctx.serviceKey))}</p><p>${esc("Reviewed by the pharmacy team.")}</p>`;
  }
  const title = section?.title || `Trust and credentials at ${name}`;

  return `<section class="about" id="about-section" data-template-block="trust-split">
<div class="wrap">
<div class="about-card">
<div class="grid-2 trust-split-row">
<div class="trust-prose">
<span class="tag">Trust &amp; credentials</span>
<h2>${esc(title)}</h2>
${proseHtml}
</div>
<div class="trust-media">
<h3>Pharmacy credentials</h3>
${trustGrid}
${resolveTenantSlotImage(ctx, "trust", "image-panel trust-block-media")}
</div>
</div>
</div>
</div>
</section>`;
}

function renderFaqFromMasterSection(
  section: ParsedMasterSection | undefined,
  loc: BodyLocaliser,
  sections?: Map<string, ParsedMasterSection>,
  contentContext?: ContentGenerationContext,
): string {
  if (!section || !/common patient questions|frequently asked/i.test(section.title)) return "";
  const $ = cheerio.load(`<div>${section.proseHtml}</div>`);
  const items: string[] = [];
  const seen = new Set<string>();
  const seenAnswers = new Set<string>();
  const faqBinding = {
    eligibilityHtml: sections?.get("3")?.proseHtml,
    conditionsHtml: sections?.get("2")?.proseHtml,
    serviceDefinitionHtml: sections?.get("1")?.proseHtml,
    masterFaqs: contentContext?.masterLibrary.faqs,
  };
  $("ol li").each((_, el) => {
    const q = loc($(el).text().trim());
    const key = q.toLowerCase().slice(0, 80);
    if (!q || seen.has(key) || items.length >= 7) return;
    seen.add(key);
    const answer =
      resolveServicePageFaqAnswerFromSections(q, faqBinding) ||
      "Our pharmacist can answer this during your consultation — call to book or walk in where available.";
    const answerKey = answer.toLowerCase().replace(/\s+/g, " ").slice(0, 120);
    if (seenAnswers.has(answerKey)) return;
    seenAnswers.add(answerKey);
    items.push(
      `<div class="cluster-faq-item faq-card"><h3 class="faq-q">${esc(q)}</h3><p class="faq-a">${esc(answer)}</p></div>`,
    );
  });
  if (!items.length) return "";
  return `<section class="faq" id="faq-section" data-template-block="faq">
<div class="wrap">${renderSectionHead(section.title, "", true)}${items.join("\n")}</div>
</section>`;
}

function renderFaqCards(title: string, entries: ResolvedFaqEntry[]): string {
  if (!entries.length) return "";
  const faqItems = entries.map(
    (f) => `<div class="cluster-faq-item faq-card"><h3 class="faq-q">${esc(f.question)}</h3><p class="faq-a">${esc(f.answer)}</p></div>`,
  );
  return `<section class="faq" id="faq-section" data-template-block="faq">
<div class="wrap">${renderSectionHead(title, "", true)}${faqItems.join("\n")}</div>
</section>`;
}

function rebindLockdownReferenceCopy(text: string, profile: PharmacyServicePageProfile): string {
  const phone = profile.displayPhone || profile.phone;
  return text
    .replace(/Leeds Pharmacy/g, profile.pharmacyName)
    .replace(/0113\s*275\s*2103/g, phone)
    .replace(/01132\s*752103/g, phone);
}

function renderFaqSection(
  $: cheerio.CheerioAPI,
  loc: BodyLocaliser,
  sections?: Map<string, ParsedMasterSection>,
  contentContext?: ContentGenerationContext,
  sourceHtml?: string,
  profile?: PharmacyServicePageProfile,
): string {
  const slug = contentContext?.slug || "";
  const serviceId = contentContext?.serviceId || "pharmacy-first";
  if (contentContext?.variantPack && isApprovedBankRegisteredService(serviceId)) {
    return renderFaqCards(
      "Frequently Asked Questions",
      projectLockedApprovedBankServicePageFaqs(contentContext.variantPack),
    );
  }
  const lockdownFaqs =
    serviceId === "pharmacy-first" ? lockdownPharmacyFirstFaqsFromReference() : [];
  const resolvedFaqs = lockdownFaqs.length >= 5
    ? lockdownFaqs.map((f) => ({
        question: profile ? rebindLockdownReferenceCopy(f.question, profile) : f.question,
        answer: profile ? rebindLockdownReferenceCopy(f.answer, profile) : f.answer,
      }))
    : resolveServicePageFaqContent(
        contentContext ? { ...contentContext, variantPack: null } : contentContext,
        slug,
        serviceId,
        sourceHtml,
      );
  if (resolvedFaqs.length >= 3) {
    return renderFaqCards("Frequently Asked Questions", resolvedFaqs.map((f) => ({
      question: loc(f.question),
      answer: normalizeBodyText(loc(f.answer)),
    })));
  }

  const profileFaqs = servicePageFaqEntries(contentContext);
  const faq = $('section[data-component="faq-accordion"]').first();
  if (faq.length) {
  const title = faq.find(".section-title").first().text().trim() || "Frequently Asked Questions";
  const items: string[] = [];
  const seenAnswers = new Set<string>();
  faq.find(".faq-item").each((_, el) => {
    const q = loc($(el).find(".faq-q").first().text().trim());
    const a = normalizeBodyText(loc($(el).find(".faq-answer, .faq-a").first().text().trim()));
    const answerKey = a.toLowerCase().replace(/\s+/g, " ").slice(0, 100);
    if (q && a && !seenAnswers.has(answerKey)) {
      seenAnswers.add(answerKey);
      items.push(`<div class="cluster-faq-item faq-card"><h3 class="faq-q">${esc(q)}</h3><p class="faq-a">${esc(a)}</p></div>`);
    }
  });
  if (items.length) {
    const merged = [...profileFaqs.map((f) => ({ q: f.question, a: f.answer })), ...items.map((html) => {
      const qMatch = html.match(/class="faq-q">([^<]+)/);
      const aMatch = html.match(/class="faq-a">([^<]+)/);
      return { q: qMatch?.[1] || "", a: aMatch?.[1] || "" };
    })].filter((f) => f.q && f.a);
    const seen = new Set<string>();
    const deduped = merged.filter((f) => {
      const key = f.q.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
    if (deduped.length) {
      return renderFaqCards(title, deduped.map((f) => ({ question: f.q, answer: f.a })));
    }
  }
  }
  if (resolvedFaqs.length) {
    return renderFaqCards("Frequently Asked Questions", resolvedFaqs.map((f) => ({
      question: loc(f.question),
      answer: normalizeBodyText(loc(f.answer)),
    })));
  }
  if (profileFaqs.length) {
    return renderFaqCards("Frequently Asked Questions", profileFaqs);
  }
  for (const section of sections?.values() || []) {
    const fromMaster = renderFaqFromMasterSection(section, loc, sections, contentContext);
    if (fromMaster) return fromMaster;
  }
  return "";
}

function renderConversionAndCta(
  ctx: PharmacyImageRenderContext,
  profile: PharmacyServicePageProfile,
  contentContext?: ContentGenerationContext,
): string {
  return buildProfileFinalCtaHtml(
    ctx.serviceName,
    profile,
    resolveTenantSlotImage(ctx, "conversion", "image-panel conversion-feature-image"),
    "",
    "",
    contentContext,
  );
}

function buildLocalAreaLinks(
  ctx: PharmacyImageRenderContext,
  contentContext?: ContentGenerationContext,
): LocalAreaLink[] {
  const key = resolveTenantProfileSlug(ctx.slug) || ctx.slug || "";
  const previewBase = `/api/pharmacy-content-ecosystem-preview/${encodeURIComponent(ctx.serviceKey)}/local`;
  const toLink = (areaName: string, areaSlug: string): LocalAreaLink => ({
    areaName,
    href: `${previewBase}/${encodeURIComponent(areaSlug)}/?slug=${encodeURIComponent(key)}`,
  });

  const campaignAreas = (contentContext?.selectedAreas || [])
    .filter((area) => area.selected !== false && area.areaName.trim())
    .map((area) => toLink(area.areaName, area.areaSlug || slugifyArea(area.areaName)));
  if (campaignAreas.length > 1) return campaignAreas;

  const mapPath = path.join(
    resolveWorkspaceRoot(),
    "output/pharmacy-content-ecosystem",
    key,
    ctx.serviceKey,
    "_internal-link-map.json",
  );
  if (fs.existsSync(mapPath)) {
    try {
      const map = JSON.parse(fs.readFileSync(mapPath, "utf8")) as {
        localClusterPages?: Array<{ areaName?: string; areaSlug?: string }>;
      };
      const ecosystemRoot = path.join(
        resolveWorkspaceRoot(),
        "output/pharmacy-content-ecosystem",
        key,
        ctx.serviceKey,
      );
      const fromMap = (map.localClusterPages || [])
        .filter((page) => {
          if (!page.areaName || !page.areaSlug) return false;
          const relPath = page.outputPath || `local/${page.areaSlug}/index.html`;
          return fs.existsSync(path.join(ecosystemRoot, relPath));
        })
        .map((page) => toLink(page.areaName!, page.areaSlug!));
      if (fromMap.length) return fromMap;
    } catch {
      /* ignore malformed link map */
    }
  }

  const profileDoc = loadPharmacyProfile(key);
  const areas = (profileDoc?.data?.selectedAreas || [])
    .filter((a) => a.selected !== false)
    .map((a) => a.areaName);
  return areas.map((areaName) => toLink(areaName, slugifyArea(areaName)));
}

/** Tenant DNA–driven service page body — slot order from Component DNA variants. */
export function buildPharmacyServicePageMainHtml(
  sourceHtml: string,
  ctx: PharmacyImageRenderContext,
  profile: PharmacyServicePageProfile,
  contentContext?: ContentGenerationContext,
): string {
  // Content Engine V1 — bind service pages to the shared commercial section planner.
  void resolveCommercialSectionPlanV1("service");

  const $ = cheerio.load(sourceHtml);
  const serviceId = contentContext?.serviceId || ctx.serviceKey;
  const lockedContract =
    contentContext?.variantPack && isApprovedBankRegisteredService(serviceId)
      ? withApprovedBankServicePageContract(contentContext.variantPack).servicePage
      : null;
  const sections = lockedContract
    ? approvedBankContractToParsedSections(lockedContract)
    : parseMasterSections($);

  const loc = makeBodyLocaliser(profile, ctx.serviceName);
  const localAreaLinks = buildLocalAreaLinks(ctx, contentContext);
  const brand = resolveBrandDnaForRender(profile.slug);
  const componentDna = resolveComponentDnaForRender(profile.slug, brand);

  return [
    renderHeroSection(ctx, profile, componentDna, contentContext),
    renderTrustCards(profile, componentDna, contentContext),
    renderServiceDefinitionSplit(sections.get("1"), ctx, profile, loc, contentContext),
    renderConditionsGrid(sections.get("2"), loc, componentDna, ctx.serviceKey, ctx.serviceName),
    renderEligibilitySection(sections.get("3"), profile, contentContext),
    renderProcessGrid(
      sections.get("4"),
      profile,
      ctx.serviceName,
      loc,
      contentContext,
      componentDna,
      ctx.serviceKey,
      lockedContract?.processSteps,
    ),
    renderSupportImageBand(sections.get("5"), ctx, loc, contentContext),
    renderSafetyPanel(sections.get("6"), profile, ctx.serviceName, loc),
    renderTrustSection(sections.get("9"), $, ctx, profile, loc, contentContext),
    renderProfessionalReviewPanelHtml(profile),
    renderFaqSection($, loc, sections, contentContext, sourceHtml, profile),
    buildProfileLocalSectionHtml(ctx.serviceName, $, sections.get("13"), profile, localAreaLinks, contentContext),
    renderConversionAndCta(ctx, profile, contentContext),
  ]
    .filter(Boolean)
    .join("\n");
}

/** @deprecated use buildPharmacyServicePageMainHtml */
export const buildClusterPharmacyMainHtml = buildPharmacyServicePageMainHtml;

export interface PharmacyServicePageValidation {
  pass: boolean;
  checks: Record<string, boolean>;
  failures: string[];
}

export function validatePharmacyServicePageHtml(html: string): PharmacyServicePageValidation {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch?.[1] ?? html;
  const mainMatch = body.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const main = mainMatch?.[1] ?? body;
  const cardCount = (main.match(/class="card equal-height-card"/g) || []).length;

  const checks: Record<string, boolean> = {
    pipelineVersion: html.includes(`data-pipeline-version="${PHARMACY_VISUAL_PIPELINE_VERSION}"`),
    hero5050: /hero-grid/.test(body) && /hero-image-wrap|hero-media/.test(body),
    trustCardsBelowHero: /id="pharmacy-trust-cards"/.test(body),
    serviceDefinitionSplit: /data-template-block="service-definition"/.test(main) && /definition-split-row/.test(main),
    conditionsGrid: /data-template-block="conditions"/.test(main),
    processGrid: /data-template-block="process"/.test(main) && /process-grid/.test(main),
    supportImageBand: /data-template-block="support-image"/.test(main),
    safetyPanel: /data-template-block="safety"/.test(main),
    trustSection: /data-template-block="trust-split"/.test(main),
    professionalReviewPanel: /data-component="pharmacy-professional-review-panel"/.test(main),
    noBenefitsDump: !/data-template-block="benefits"/.test(main),
    noCompareDump: !/data-template-block="quick-answer"/.test(main) || !/<div class="compare">/.test(main),
    reasonableCardCount: cardCount >= 8 && cardCount <= 22,
    mapIframe:
      (/data-component="pharmacy-local-map"[\s\S]*<iframe/.test(body) ||
        (/id="local-access"/.test(body) && /map-unavailable|map-placeholder|pharmacy-local-details/.test(body))),
    ctaBand: /cta-band/.test(body),
    profileFooter: /data-component="pharmacy-page-footer"/.test(body),
  };

  const failures = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

  return { pass: failures.length === 0, checks, failures };
}

/** @deprecated use validatePharmacyServicePageHtml */
export const validateLayoutV3Html = validatePharmacyServicePageHtml;
