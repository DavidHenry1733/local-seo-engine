/**
 * Content Engine V1 — public commercial narrative polish for generated cluster HTML.
 * Planner-output filter only: coherence, locality memory, alignment, section order.
 */
import {
  enrichVisualServicePageSchemaDocument,
  extractRenderedFaqsFromHtml,
  serializeJsonLdScript,
} from "../pharmacyVisualExperienceSchemaEnrichment.ts";

export type CommercialNarrativePolishInput = {
  areaName: string;
  pharmacyName: string;
  serviceName: string;
  nearbyAreaNames: string[];
  generationRevision?: string;
  preserveAuthoredLocalCopy?: boolean;
};

function esc(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Convert leftover planner field labels into natural prose fragments. */
export function scrubPlannerFieldLabels(text: string): string {
  return String(text || "")
    .replace(
      /<li>\s*(?:Landmark orientation|Green space nearby|Local shopping|Schools in the catchment|Primary care nearby|Neighbouring communities):\s*[^<]*<\/li>/gi,
      "",
    )
    .replace(/\bLandmark orientation:\s*/gi, "")
    .replace(/\bGreen space nearby:\s*/gi, "")
    .replace(/\bLocal shopping:\s*/gi, "")
    .replace(/\bSchools in the catchment:\s*/gi, "")
    .replace(/\bPrimary care nearby:\s*/gi, "")
    .replace(/\bNeighbouring communities:\s*/gi, "")
    .replace(/\bLocal healthcare context\b/gi, "Local care nearby")
    .replace(/\bnearby in the local catchment(?:\s+from the pharmacy)?\b/gi, "nearby")
    .replace(/\bwithin a few minutes\b/gi, "by familiar local routes")
    .replace(/\bschool-term peaks\b/gi, "busy local periods")
    .replace(/\bdiaries are full\b/gi, "appointments are hard to book")
    .replace(/\bpresentations we see most often\b/gi, "conditions the service may assess")
    .replace(/<ul class="clean">\s*<\/ul>/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractSection(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match?.[0] || "";
}

function removeSection(html: string, pattern: RegExp): string {
  return html.replace(pattern, "");
}

function ensureSectionHeadCenter(html: string): string {
  return html
    .replace(/<div class="section-head(?! center)([^"]*)">/gi, '<div class="section-head center$1">')
    .replace(/<div class="section-head center center">/gi, '<div class="section-head center">');
}

function centerNarrativeBodyCopy(html: string): string {
  // Use existing .section-head.center alignment contract for narrative paragraphs.
  return html.replace(
    /(<section\b[^>]*(?:data-template-block="(?:service-definition|child-areas|local-introduction|local-relevance|consultation|trust-split)"|id="(?:cluster-context|cluster-local-introduction|child-areas|cluster-relevance|cluster-trust|cluster-consultation)")[^>]*>[\s\S]*?<div class="wrap">)([\s\S]*?)(<\/div>\s*<\/section>)/gi,
    (_full, open: string, inner: string, close: string) => {
      let body = inner;
      // Do not centre maps, lists, grids, or media panels.
      body = body.replace(
        /(<p)(?![^>]*section-lead)([^>]*>)/gi,
        (pOpen: string, tag: string, rest: string) => {
          if (/class="/i.test(pOpen + rest) && /class="[^"]*center/i.test(pOpen + rest)) return pOpen;
          if (/class="/i.test(rest)) {
            return `${tag}${rest.replace(/class="/i, 'class="narrative-center ')}`;
          }
          return `${tag} class="narrative-center"${rest}`;
        },
      );
      return `${open}${body}${close}`;
    },
  );
}

type StrategyPolishMeta = {
  strategyId: string;
  sectionOrder: string[];
  nearbyIntro: string;
  travelBody: string;
  ctaPrimary: string;
  ctaPrompt: string;
  headings: Record<string, string>;
};

function decodeEntities(text: string): string {
  return String(text || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractStrategyMeta(blob: string): StrategyPolishMeta {
  const text = decodeEntities(blob);
  const strategyId = (text.match(/%%STRATEGY%%\s*([a-z-]+)/i) || [])[1] || "patient-journey-led";
  const orderRaw = (text.match(/%%SECTION_ORDER%%\s*([a-z,\s-]+)/i) || [])[1] || "";
  const sectionOrder = orderRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const nearbyIntro = ((text.match(/%%NEARBY_INTRO%%\s*([\s\S]*?)(?:%%TRAVEL%%|%%CTA_FRAME%%|%%HEADINGS%%|$)/i) || [])[1] || "")
    .replace(/\s+/g, " ")
    .trim();
  const travelBody = ((text.match(/%%TRAVEL%%\s*([\s\S]*?)(?:%%CTA_FRAME%%|%%HEADINGS%%|$)/i) || [])[1] || "")
    .replace(/\s+/g, " ")
    .trim();
  const ctaRaw = ((text.match(/%%CTA_FRAME%%\s*([\s\S]*?)(?:%%HEADINGS%%|$)/i) || [])[1] || "")
    .replace(/\s+/g, " ")
    .trim();
  const [ctaPrimary = "", ctaPrompt = ""] = ctaRaw.split("|||").map((s) => s.trim());
  let headings: Record<string, string> = {};
  const headingsRaw = (text.match(/%%HEADINGS%%\s*(\{[\s\S]*\})/i) || [])[1] || "";
  try {
    headings = headingsRaw ? (JSON.parse(headingsRaw) as Record<string, string>) : {};
  } catch {
    headings = {};
  }
  return { strategyId, sectionOrder, nearbyIntro, travelBody, ctaPrimary, ctaPrompt, headings };
}

/**
 * Split how vs consultation markers. Headings must never be merged into paragraph text.
 * If a secondary heading (e.g. Preparing) appears inside the consultation payload,
 * strip it from the paragraph rather than gluing it mid-sentence.
 */
function splitHowAndConsultation(html: string): { html: string; meta: StrategyPolishMeta } {
  const childRe =
    /<section\b[^>]*id="child-areas"[^>]*>[\s\S]*?<\/section>/i;
  const child = extractSection(html, childRe);
  const emptyMeta: StrategyPolishMeta = {
    strategyId: "patient-journey-led",
    sectionOrder: ["why", "how", "conditions", "consultation", "travel", "gp", "faq", "cta", "nearby"],
    nearbyIntro: "",
    travelBody: "",
    ctaPrimary: "",
    ctaPrompt: "",
    headings: {},
  };
  if (!child) return { html, meta: emptyMeta };
  if (!child.includes("%%CONSULTATION%%")) {
    const markerMeta = extractStrategyMeta(child);
    if (markerMeta.travelBody || markerMeta.nearbyIntro || markerMeta.ctaPrompt) {
      return {
        html,
        meta: {
          ...emptyMeta,
          ...markerMeta,
          sectionOrder: markerMeta.sectionOrder.length ? markerMeta.sectionOrder : emptyMeta.sectionOrder,
        },
      };
    }
    return { html, meta: emptyMeta };
  }

  const parts = child.split("%%CONSULTATION%%");
  const before = parts[0] || "";
  const after = parts.slice(1).join("%%CONSULTATION%%");
  const meta = extractStrategyMeta(after);

  const stripMarkers = (raw: string) =>
    raw
      .replace(/%%(?:TRAVEL|CTA_FRAME|NEARBY_INTRO|SECTION_ORDER|STRATEGY|HEADINGS)%%[\s\S]*$/i, " ")
      .replace(/%%[A-Z_]+%%/g, " ");

  const howIntro = stripMarkers(before)
    .replace(/<div class="areas-grid">[\s\S]*?<\/div>/gi, "")
    .replace(/<ol\b[^>]*data-clinical-timeline[\s\S]*?<\/ol>/gi, "")
    .replace(/<h2>[^<]+<\/h2>/i, "")
    .replace(/<div class="section-head[^"]*">/gi, "")
    .replace(/<\/div>/gi, " ")
    .replace(/<p[^>]*>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Never keep a glued preparing/consultation heading inside the how paragraph.
    .replace(/\s*Preparing for (?:a |your )?check\.?\s*/gi, " ")
    .replace(/\s*What happens during the consultation\.?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const consultChunk = stripMarkers(
    after.split(/%%STRATEGY%%/i)[0] || "",
  )
    .replace(/<div class="areas-grid">[\s\S]*?<\/div>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\s+/g, " ")
    .trim();

  const consultHeading = meta.headings.consultation || "What happens during the consultation";
  let consultBody = consultChunk;
  if (meta.headings.consultation && consultBody.startsWith(meta.headings.consultation)) {
    consultBody = consultBody.slice(meta.headings.consultation.length).trim();
  } else {
    consultBody = consultBody.replace(/^What happens during the consultation\s*/i, "").trim();
  }
  // Strip any secondary section heading that was packed into the marker body.
  consultBody = consultBody
    .replace(/\s*Preparing for (?:a |your )?check\.?\s*/gi, " ")
    .replace(/\s*Understanding your reading\.?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const howHeading = meta.headings.how || "How Pharmacy First can help";
  const timeline = extractSection(child, /<ol\b[^>]*data-clinical-timeline[\s\S]*?<\/ol>/i);
  // Headings stay in <h2> only — never concatenate into the <p>.
  const howSection = `<section class="soft py-10" id="child-areas" data-template-block="child-areas">
<div class="wrap px-6">
<div class="clinical-section-head"><h2 class="text-[#1E293B]">${esc(howHeading)}</h2>${howIntro ? `<p class="text-slate-600 leading-relaxed">${esc(howIntro)}</p>` : ""}</div>
${timeline}
</div>
</section>`;

  const consultSection = `<section class="soft" id="cluster-consultation" data-template-block="consultation">
<div class="wrap">
<div class="section-head center"><h2>${esc(consultHeading)}</h2>${consultBody ? `<p class="narrative-center">${esc(consultBody)}</p>` : ""}</div>
</div>
</section>`;

  return {
    html: html.replace(childRe, `${howSection}\n${consultSection}`),
    meta,
  };
}

const APPROVED_CLUSTER_LEADING_SLOTS = ["localIntro", "why", "how", "nextStep"] as const;
const APPROVED_CLUSTER_TRAILING_SLOT = "conditions";

/** Pin visual stack: hero (caller) → localIntroduction → service definition → what happens next → … → hospitals/GP last. */
function pinApprovedClusterVisualSectionOrder(order: string[]): string[] {
  const fallback = ["why", "how", "conditions", "consultation", "travel", "gp", "faq", "cta", "nearby"];
  const source = (order.length ? order : fallback).filter(Boolean);
  const leading = [...APPROVED_CLUSTER_LEADING_SLOTS];
  const middle = source.filter(
    (slot) => slot !== APPROVED_CLUSTER_TRAILING_SLOT && !leading.includes(slot as (typeof leading)[number]),
  );
  const seen = new Set<string>();
  const pinned: string[] = [];
  for (const slot of [...leading, ...middle, APPROVED_CLUSTER_TRAILING_SLOT]) {
    if (seen.has(slot)) continue;
    seen.add(slot);
    pinned.push(slot);
  }
  return pinned;
}

function reorderClusterSections(html: string, order: string[]): string {
  const mainMatch = html.match(/<main id="main-content">([\s\S]*?)<\/main>/i);
  if (!mainMatch) return html;
  const mainInner = mainMatch[1] || "";

  const breadcrumb = extractSection(mainInner, /<nav class="local-breadcrumb[\s\S]*?<\/nav>/i);
  const hero = extractSection(mainInner, /<section\b[^>]*data-template-block="hero"[\s\S]*?<\/section>/i)
    || extractSection(mainInner, /<section\b[^>]*class="[^"]*hero[\s\S]*?<\/section>/i);
  const map: Record<string, string> = {
    localIntro:
      extractSection(mainInner, /<section[^>]*id="cluster-local-introduction"[\s\S]*?<\/section>/i) ||
      extractSection(mainInner, /<section[^>]*data-template-block="local-introduction"[\s\S]*?<\/section>/i),
    why: extractSection(mainInner, /<section[^>]*id="cluster-context"[\s\S]*?<\/section>/i),
    how: extractSection(mainInner, /<section[^>]*id="child-areas"[\s\S]*?<\/section>/i),
    nextStep: extractSection(mainInner, /<section[^>]*id="local-next-step"[\s\S]*?<\/section>/i),
    conditions: extractSection(mainInner, /<section[^>]*id="cluster-relevance"[\s\S]*?<\/section>/i),
    consultation: extractSection(mainInner, /<section[^>]*id="cluster-consultation"[\s\S]*?<\/section>/i),
    travel:
      extractSection(mainInner, /<section[^>]*id="local-access"[\s\S]*?<\/section>/i) ||
      extractSection(mainInner, /<section[^>]*data-template-block="local"[\s\S]*?<\/section>/i),
    gp: extractSection(mainInner, /<section[^>]*id="cluster-trust"[\s\S]*?<\/section>/i),
    faq: extractSection(mainInner, /<section[^>]*id="faq-section"[\s\S]*?<\/section>/i),
    cta:
      extractSection(mainInner, /<section[^>]*data-template-block="conversion-image"[\s\S]*?<\/section>/i) +
      extractSection(mainInner, /<section[^>]*data-template-block="final-cta"[\s\S]*?<\/section>/i),
    nearby: extractSection(mainInner, /<section[^>]*data-template-block="parent-child-links"[\s\S]*?<\/section>/i),
  };

  const sequence = pinApprovedClusterVisualSectionOrder(order)
    .map((slot) => map[slot] || "")
    .filter(Boolean);
  const ordered = [breadcrumb, hero, ...sequence].filter(Boolean).join("\n");

  if (!hero || !map.why || !map.how || !map.conditions) return html;
  return html.replace(mainMatch[0], `<main id="main-content">\n${ordered}\n</main>`);
}

function applyStrategyHeadings(html: string, headings: Record<string, string>): string {
  let out = html;
  const bind = (sectionRe: RegExp, heading?: string) => {
    if (!heading) return;
    out = out.replace(sectionRe, (block) =>
      block.replace(/<h2>[^<]+<\/h2>/i, `<h2>${esc(heading)}</h2>`),
    );
  };
  bind(/<section[^>]*id="cluster-context"[\s\S]*?<\/section>/i, headings.why);
  bind(/<section[^>]*id="child-areas"[\s\S]*?<\/section>/i, headings.how);
  bind(/<section[^>]*id="cluster-consultation"[\s\S]*?<\/section>/i, headings.consultation);
  bind(/<section[^>]*id="local-access"[\s\S]*?<\/section>/i, headings.travel);
  bind(/<section[^>]*id="cluster-trust"[\s\S]*?<\/section>/i, headings.gp);
  bind(/<section[^>]*id="faq-section"[\s\S]*?<\/section>/i, headings.faq);
  bind(/<section[^>]*data-template-block="final-cta"[\s\S]*?<\/section>/i, headings.book);
  bind(/<section[^>]*data-template-block="parent-child-links"[\s\S]*?<\/section>/i, headings.nearby);
  return out;
}

function stripDuplicateAreaInventory(html: string): string {
  let out = html;
  // Nearby-area link grids duplicate sibling inventory. Approved-bank process/prep cards stay.
  out = out.replace(/<div class="areas-grid">[\s\S]*?<\/div>/gi, (grid) => {
    if (/data-locality-evidence="approved-bank-/i.test(grid)) return grid;
    return "";
  });
  // Coverage chips duplicate nearby-area inventory inside travel.
  out = out.replace(
    /<div><strong>Areas served[^<]*<\/strong>\s*<div class="coverage-tags"[^>]*>[\s\S]*?<\/div><\/div>/gi,
    "",
  );
  out = out.replace(/<div class="coverage-tags"[^>]*>[\s\S]*?<\/div>/gi, "");
  // Unverified GP catchment lists.
  out = out.replace(/<div class="local-healthcare-context[\s\S]*?<\/div>/gi, "");
  out = out.replace(/<div class="local-healthcare-card[\s\S]*?<\/div>/gi, "");
  return out;
}

export function polishCommercialClusterPublicHtml(
  html: string,
  input: CommercialNarrativePolishInput,
): string {
  if (/data-approved-bank-locality-contract=/i.test(html)) {
    return attachLocalityPageJsonLd(html, input);
  }
  if (input.preserveAuthoredLocalCopy) {
    const split = splitHowAndConsultation(html);
    let out = split.html;
    const meta = split.meta;
    const travelLead = meta.travelBody.trim();
    if (travelLead) {
      out = out.replace(/(<p class="local-intro-lead">)[\s\S]*?(<\/p>)/i, `$1${esc(travelLead)}$2`);
    }
    out = applyStrategyHeadings(out, meta.headings);
    out = reorderClusterSections(out, meta.sectionOrder);
    out = ensureSectionHeadCenter(out);
    out = out
      .replace(/%%CONSULTATION%%/g, "")
      .replace(/%%STRATEGY%%[\s\S]*?%%HEADINGS%%[\s\S]*?<\/p>/gi, "</p>")
      .replace(/%%(?:TRAVEL|CTA_FRAME|NEARBY_INTRO|SECTION_ORDER|STRATEGY|HEADINGS)%%/gi, "")
      .replace(/%%[A-Z_]+%%/g, "")
      .replace(/<<<CONSULTATION>>>/g, "");
    return attachLocalityPageJsonLd(out, input);
  }
  const area = input.areaName.trim() || "your area";
  const pharmacy = input.pharmacyName.trim() || "our pharmacy";
  const service = input.serviceName.trim() || "Pharmacy First";
  const revision = input.generationRevision || `cpr-content-hotfix-04-${Date.now()}`;

  let out = scrubPlannerFieldLabels(html);
  const split = splitHowAndConsultation(out);
  out = split.html;
  const meta = split.meta;
  out = stripDuplicateAreaInventory(out);

  const nearbyCommercial =
    meta.nearbyIntro ||
    `Patients from communities near ${area} can also use ${service} at the pharmacy. Choose a nearby area below for local guidance.`;

  out = out.replace(
    new RegExp(`>All\\s+${escapeRegExp(service)}\\s+locations near\\s+[^<]+<`, "gi"),
    `>View all ${esc(service)} areas we support<`,
  );
  out = out.replace(
    new RegExp(`>${escapeRegExp(service)}\\s+overview<`, "gi"),
    `>${esc(service)} main page<`,
  );
  out = out.replace(
    /(<section[^>]*data-template-block="parent-child-links"[\s\S]*?<\/section>)/i,
    (block) =>
      block.replace(
        new RegExp(`>${escapeRegExp(service)}\\s+in\\s+([^<]+)<`, "gi"),
        `>Help for patients in $1<`,
      ),
  );

  const travelLead = meta.travelBody.trim();
  if (travelLead) {
    out = out.replace(/(<p class="local-intro-lead">)[\s\S]*?(<\/p>)/i, `$1${esc(travelLead)}$2`);
  }

  out = applyStrategyHeadings(out, meta.headings);
  out = reorderClusterSections(out, meta.sectionOrder);
  out = ensureSectionHeadCenter(out);
  out = centerNarrativeBodyCopy(out);

  const nearbyHeading = meta.headings.nearby || "Nearby areas we also help";
  out = out.replace(
    /(<div class="section-head(?: center)?"><h2>)([^<]+)(<\/h2><\/div>)(?:\s*<p[\s\S]*?<\/p>)?(?=\s*<ul class="clean">)/i,
    `$1${esc(nearbyHeading)}$3\n<p class="narrative-center">${esc(nearbyCommercial)}</p>`,
  );

  // Keep Headingley "Book, call or get directions". Only strip "Book An Appointment …" leftovers.
  const rawBook = String(meta.headings.book || "").trim();
  const bookHeading = /^Book(?:\s+An)?\s+Appointment\b/i.test(rawBook)
    ? rawBook.replace(/^Book(?:\s+An)?\s+Appointment(?:\s+for)?\s*/i, "").trim()
    : rawBook;
  if (bookHeading && !/^book an appointment\b/i.test(bookHeading)) {
    out = out.replace(
      /(<section[^>]*data-template-block="final-cta"[\s\S]*?<h2>)[^<]+(<\/h2>)/i,
      `$1${esc(bookHeading)}$2`,
    );
  }
  // Fail-closed: final CTA must not repeat the full trading name on locality pages.
  if (pharmacy && pharmacy !== "our pharmacy") {
    const phHtmlEsc = escapeRegExp(esc(pharmacy));
    out = out.replace(
      new RegExp(
        `(<section[^>]*data-template-block="final-cta"[\\s\\S]*?<h2>)[^<]*${phHtmlEsc}[^<]*(</h2>)`,
        "i",
      ),
      `$1Ask about ${esc(service)}$2`,
    );
  }
  if (meta.ctaPrompt || meta.ctaPrimary) {
    const ctaBody = meta.ctaPrompt || meta.ctaPrimary;
    out = out.replace(
      /(<section[^>]*data-template-block="final-cta"[\s\S]*?<p class="[^"]*">)[\s\S]*?(<\/p>)/i,
      `$1${esc(ctaBody)}$2`,
    );
  }
  // Prefer website contact wording over phone-primary CTA body when a phone-led default remains.
  out = out.replace(
    /(<section[^>]*data-template-block="final-cta"[\s\S]*?<p class="[^"]*">)Call \d[\d\s]+ to ask how [^<]+(<\/p>)/i,
    `$1Contact the pharmacy to ask how ${esc(service.toLowerCase())} are arranged. Use the website contact option or the phone number shown on this page.$2`,
  );

  const metaBits = [
    `<meta name="commercial-narrative-revision" content="${esc(revision)}"/>`,
    `<meta name="locality-page-strategy" content="${esc(meta.strategyId)}"/>`,
  ].join("\n");
  if (!/name="commercial-narrative-revision"/i.test(out)) {
    out = out.replace(/<meta name="local-page-contract"[^>]*>/i, (m) => `${m}\n${metaBits}`);
  } else {
    out = out.replace(
      /<meta name="commercial-narrative-revision" content="[^"]*"/i,
      `<meta name="commercial-narrative-revision" content="${esc(revision)}"`,
    );
    if (!/name="locality-page-strategy"/i.test(out)) {
      out = out.replace(
        /<meta name="commercial-narrative-revision"[^>]*>/i,
        (m) => `${m}\n<meta name="locality-page-strategy" content="${esc(meta.strategyId)}"/>`,
      );
    } else {
      out = out.replace(
        /<meta name="locality-page-strategy" content="[^"]*"/i,
        `<meta name="locality-page-strategy" content="${esc(meta.strategyId)}"`,
      );
    }
  }

  out = out
    .replace(/%%CONSULTATION%%/g, "")
    .replace(/%%STRATEGY%%[\s\S]*?%%HEADINGS%%[\s\S]*?<\/p>/gi, "</p>")
    .replace(/%%(?:TRAVEL|CTA_FRAME|NEARBY_INTRO|SECTION_ORDER|STRATEGY|HEADINGS)%%/gi, "")
    .replace(/%%[A-Z_]+%%/g, "")
    .replace(/<<<CONSULTATION>>>/g, "");

  out = out.replace(
    /(<h2>)([^<]+?)(?:\s*[—–-]\s*Leeds Pharmacy)(<\/h2>)/gi,
    "$1$2$3",
  );

  return attachLocalityPageJsonLd(out, input);
}

export function attachLocalityPageJsonLd(html: string, input: CommercialNarrativePolishInput): string {
  if (/application\/ld\+json/i.test(html)) return html;
  const localitySlug =
    html.match(/data-local-cluster="([^"]+)"/i)?.[1] || html.match(/data-local-area="([^"]+)"/i)?.[1] || "";
  const serviceId = html.match(/data-pharmacy-service="([^"]+)"/i)?.[1] || "";
  const title = (html.match(/<title>([^<]+)<\/title>/i)?.[1] || `${input.serviceName} ${input.areaName}`).trim();
  const metaDesc = (html.match(/<meta name="description" content="([^"]*)"/i)?.[1] || "").trim();
  const pageUrl = `https://example.local/${serviceId || "service"}/local/${localitySlug || "locality"}/`;
  const faqs = extractRenderedFaqsFromHtml(html);
  const script = serializeJsonLdScript(
    enrichVisualServicePageSchemaDocument(
      {},
      {
        serviceName: input.serviceName,
        pharmacyName: input.pharmacyName,
        town: input.areaName,
        pageUrl,
        metaDescription: metaDesc || title,
        website: pageUrl,
        serviceId: serviceId || undefined,
        localitySlug: localitySlug || undefined,
        localityName: input.areaName,
      },
      faqs,
    ),
  );
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${script}\n</head>`);
  return `${script}\n${html}`;
}

/** Polish public service-page HTML after visual assembly — content planner filter only. */
export function polishCommercialServicePublicHtml(
  html: string,
  input: {
    pharmacyName: string;
    town: string;
    serviceName: string;
    phone?: string;
    nearbyAreaNames?: string[];
  },
): string {
  void input.town;
  let out = scrubPlannerFieldLabels(html);
  const visitHeading = `<h2>Visit ${esc(input.pharmacyName)}</h2>`;
  out = out.replace(
    new RegExp(
      `<h2[^>]*>\\s*${escapeRegExp(input.serviceName || "Pharmacy First")}\\s+For Patients In\\s+[^<]+</h2>`,
      "gi",
    ),
    visitHeading,
  );
  out = out.replace(/<h2>\s*Local access from\s+[^<]+<\/h2>/gi, visitHeading);
  out = out.replace(/<h3>\s*Local healthcare context\s*<\/h3>/gi, "<h3>Local care nearby</h3>");
  return out;
}
