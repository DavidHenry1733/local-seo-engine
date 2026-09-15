/**
 * Structured local access section — readable cards/lists without prose-wall binding.
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { normalizeTelHref, resolveOpeningHours } from "./pharmacyServicePageProfileContext.ts";
import {
  providersForArea,
  type LocalMarketHealthcareProvider,
} from "./pharmacyLocalMarketSnapshot.ts";
import { phraseCoLocatedGp } from "./contentEngine/pharmacyLocalMarketIntelligencePhrases.ts";
import { renderPharmacyMapContactComponent } from "./pharmacyMapResolver.ts";
import {
  dedupeMapContactSections,
  stripMapAndLocalAccessSections,
} from "./pharmacyMapContactComponent.ts";
import {
  countWords,
  resolveMediaTextLayout,
  resolveSectionMediaPosition,
  type MediaTextLayoutThresholds,
  type SectionMediaPosition,
} from "./pharmacyMediaTextLayoutResolver.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSectionHead(title: string, intro = ""): string {
  return `<div class="section-head center">${title ? `<h2>${esc(title)}</h2>` : ""}${intro ? `<p class="local-intro-lead">${esc(intro)}</p>` : ""}</div>`;
}

export function stripUnsupportedLocalCopy(text: string, profile: PharmacyServicePageProfile): string {
  let out = String(text || "").trim();
  if (!profile.consultationRoomAvailable) {
    out = out.replace(
      /Ask about walk-in availability or book a private consultation room appointment when you call\.?/gi,
      "Ask about walk-in availability when you call.",
    );
    out = out.replace(/book a private consultation room appointment[^.]*\.?/gi, "");
    out = out.replace(/private consultation room[^.]*\.?/gi, "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

function providerBullet(provider: LocalMarketHealthcareProvider): string {
  if (provider.distanceKm === 0) {
    return `${provider.businessName} — on the same street as the pharmacy`;
  }
  if (provider.distanceLabel) {
    return `${provider.businessName} — ${provider.distanceLabel} from the pharmacy`;
  }
  return provider.businessName;
}

function buildHealthcareContextItems(
  profile: PharmacyServicePageProfile,
  contentContext?: ContentGenerationContext,
  town?: string,
): string[] {
  if (!contentContext) return [];
  const area = town || contentContext.primaryTown || profile.town;
  const items: string[] = [];
  const seen = new Set<string>();

  const coLocated = phraseCoLocatedGp(contentContext);
  if (coLocated) {
    const coLocatedGp = providersForArea(contentContext.localMarket, area, {
      groupKeys: ["gpSurgeries"],
      limit: 1,
    }).find((p) => p.distanceKm === 0);
    if (coLocatedGp) {
      items.push(coLocated.replace(/\.$/, ""));
      seen.add(coLocatedGp.businessName.toLowerCase());
    }
  }

  const gps = providersForArea(contentContext.localMarket, area, {
    groupKeys: ["gpSurgeries"],
    limit: 3,
  });
  for (const gp of gps) {
    const key = gp.businessName.toLowerCase();
    if (seen.has(key)) continue;
    if (gp.distanceKm === 0 && items.some((item) => /same address|same street/i.test(item))) continue;
    items.push(providerBullet(gp));
    seen.add(key);
  }

  const urgent = providersForArea(contentContext.localMarket, area, {
    groupKeys: ["communityClinics", "hospitals", "healthCentres"],
    limit: 1,
  })[0];
  if (urgent) {
    const key = urgent.businessName.toLowerCase();
    if (!seen.has(key)) items.push(providerBullet(urgent));
  }

  return items.slice(0, 3);
}

function buildSafetyStatement(
  profile: PharmacyServicePageProfile,
  serviceName = "Pharmacy First",
  serviceId?: string,
): string {
  const name = profile.pharmacyName;
  const id = String(serviceId || "").toLowerCase();
  const svc = String(serviceName || "").toLowerCase();
  if (id === "travel-vaccinations" || svc.includes("travel vaccination")) {
    return `Travel vaccine needs depend on destination and clinical suitability. ${name} will explain what can be offered locally and advise where to seek further help, including GP or another service when appropriate.`;
  }
  if (id === "pharmacy-first" || svc.includes("pharmacy first") || !serviceId) {
    return `If symptoms fall outside NHS Pharmacy First scope, ${name} will explain the appropriate next steps, including GP or urgent care when appropriate.`;
  }
  if (id === "blood-pressure-checks" || svc.includes("blood pressure")) {
    return "If a blood pressure check is not suitable for you, contact the pharmacy for guidance on what to do next.";
  }
  return "If this service is not suitable for you, contact the pharmacy for guidance on what to do next.";
}

function renderAccessCardMediaBlock(
  cardHtml: string,
  mediaHtml: string,
  thresholds: Partial<MediaTextLayoutThresholds> | undefined,
  mediaPosition: SectionMediaPosition,
): { layout: "balanced-split" | "media-float-flow"; markup: string; mediaPosition: SectionMediaPosition } {
  const plainText = cardHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const layout = resolveMediaTextLayout({
    paragraphCount: 0,
    wordCount: countWords(plainText),
    listCount: 1,
    hasImage: true,
    thresholds,
  });

  if (layout === "balanced-split") {
    const copy = `<div class="definition-split-copy section-opening-copy">${cardHtml}</div>`;
    const media = `<div class="definition-split-media section-media">${mediaHtml}</div>`;
    return {
      layout,
      mediaPosition,
      markup:
        mediaPosition === "left"
          ? `<div class="definition-split-row balanced-split-row">${media}${copy}</div>`
          : `<div class="definition-split-row balanced-split-row">${copy}${media}</div>`,
    };
  }

  return {
    layout: "media-float-flow",
    mediaPosition,
    markup: `<figure class="section-media definition-split-media">${mediaHtml}</figure>
<div class="section-copy definition-split-copy">${cardHtml}</div>`,
  };
}

export { buildHealthcareContextItems, buildSafetyStatement };

export function renderStructuredLocalAccessSection(
  profile: PharmacyServicePageProfile,
  serviceName: string,
  options: {
    title?: string;
    town?: string;
    contentContext?: ContentGenerationContext;
    slug?: string;
    areaName?: string;
    accessMediaHtml?: string;
    healthcareMediaHtml?: string;
    accessMediaPosition?: SectionMediaPosition;
    healthcareMediaPosition?: SectionMediaPosition;
    layoutThresholds?: Partial<MediaTextLayoutThresholds>;
  } = {},
): string {
  const town = options.town || profile.town;
  const title =
    options.title ||
    (town ? `${serviceName} For Patients In ${town}` : `${serviceName} — local access`);
  const nhsPrefix =
    String(serviceName || "").toLowerCase().includes("pharmacy first") ? "NHS " : "";
  const intro = `${profile.pharmacyName} is at ${profile.fullAddress}. Patients in ${town || "the local area"} can access ${nhsPrefix}${serviceName} at the pharmacy.`;
  const telHref = normalizeTelHref(profile.phone);
  const displayPhone = profile.displayPhone || profile.phone;
  const hours = resolveOpeningHours(profile);
  const bookingLine = profile.consultationRoomAvailable
    ? "A private consultation room may be available — call to confirm."
    : "Call the pharmacy to ask how this service is arranged.";

  const accessCard = `<div class="local-access-card card">
<h3>Access ${esc(serviceName)}</h3>
<ul class="clean local-access-list">
<li><strong>Address:</strong> ${esc(profile.fullAddress)}</li>
${profile.phone ? `<li><strong>Phone:</strong> <a href="${esc(telHref)}">${esc(displayPhone)}</a></li>` : ""}
${profile.email ? `<li><strong>Email:</strong> <a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></li>` : ""}
${hours ? `<li><strong>Opening hours:</strong> ${esc(hours)}</li>` : ""}
<li>${esc(stripUnsupportedLocalCopy(bookingLine, profile))}</li>
</ul>
</div>`;

  const healthcareItems = buildHealthcareContextItems(profile, options.contentContext, town);
  const healthcareBlock = healthcareItems.length
    ? `<div class="local-healthcare-card card">
<h3>Local healthcare context</h3>
<ul class="clean local-healthcare-list">${healthcareItems.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
</div>`
    : "";

  const safetyBlock = `<div class="local-safety-note"><p>${esc(buildSafetyStatement(profile, serviceName, options.contentContext?.serviceId))}</p></div>`;

  const accessMediaPosition =
    options.accessMediaPosition ||
    resolveSectionMediaPosition({ sectionIndex: 0, preferredPosition: "right" });
  const healthcareMediaPosition =
    options.healthcareMediaPosition ||
    resolveSectionMediaPosition({
      sectionIndex: 1,
      previousMediaPosition: options.accessMediaHtml ? accessMediaPosition : null,
      preferredPosition: "left",
    });

  const accessBlock = options.accessMediaHtml
    ? renderAccessCardMediaBlock(accessCard, options.accessMediaHtml, options.layoutThresholds, accessMediaPosition)
    : null;
  const healthcareMediaBlock =
    options.healthcareMediaHtml && healthcareBlock
      ? renderAccessCardMediaBlock(
          healthcareBlock,
          options.healthcareMediaHtml,
          options.layoutThresholds,
          healthcareMediaPosition,
        )
      : null;
  const accessLayoutAttr = accessBlock
    ? ` data-layout="${accessBlock.layout}" data-media-position="${accessBlock.mediaPosition}"`
    : "";
  const accessMarkup = accessBlock
    ? accessBlock.markup
    : `<div class="local-access-grid">${accessCard}${healthcareBlock}</div>`;
  const healthcareMarkup = healthcareMediaBlock
    ? `<section class="local-healthcare-context-band" data-template-block="local-healthcare-context" data-layout="${healthcareMediaBlock.layout}" data-media-position="${healthcareMediaBlock.mediaPosition}">${healthcareMediaBlock.markup}</section>`
    : healthcareBlock
      ? `<div class="local-access-grid">${healthcareBlock}</div>`
      : "";
  const trailingBlocks = accessBlock
    ? `${healthcareMarkup}${safetyBlock}`
    : healthcareMediaBlock
      ? `${healthcareMarkup}${safetyBlock}`
      : healthcareBlock
        ? `<div class="local-access-grid">${healthcareBlock}</div>${safetyBlock}`
        : safetyBlock;

  const mapSection = renderPharmacyMapContactComponent(profile, {
    slug: options.slug || profile.slug,
    areaName: options.areaName,
  });

  return `${`<section class="local local-access-structured" id="local-access" data-template-block="local" data-component-variant="structured-local-access"${accessLayoutAttr}>
<div class="wrap">
${renderSectionHead(title, intro)}
${accessMarkup}
${trailingBlocks}
</div>
</section>`}
${mapSection}`;
}

export function replaceLocalAccessSectionInMainHtml(
  mainHtml: string,
  profile: PharmacyServicePageProfile,
  serviceName: string,
  options: {
    town?: string;
    contentContext?: ContentGenerationContext;
    slug?: string;
    areaName?: string;
  } = {},
): string {
  const structured = renderStructuredLocalAccessSection(profile, serviceName, options);
  const cleaned = stripMapAndLocalAccessSections(mainHtml);
  let replaced = false;
  const withoutOld = cleaned.replace(
    /<section[^>]*id="local-access"[\s\S]*?<\/section>/gi,
    () => {
      if (replaced) return "";
      replaced = true;
      return structured;
    },
  );
  const result = replaced ? withoutOld : `${cleaned}\n${structured}`;
  return dedupeMapContactSections(result);
}
