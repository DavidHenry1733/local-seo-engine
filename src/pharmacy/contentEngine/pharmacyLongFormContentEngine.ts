/**
 * Long-form supporting content — tenant-aware guides, blogs, FAQs from ContentGenerationContext.
 * Business Profile Intelligence V2 Phase 3A: profile-first phrasing with legacy fallbacks.
 * Does not modify service page or local cluster generation.
 */
import type { ContentGenerationContext } from "./contentGenerationContextTypes.ts";
import { applyContextTokens, findUnresolvedTokens } from "./contentEngineTokens.ts";
import {
  buildProfileBackedFaqEntries,
  collectIntelligenceSentences,
  phraseBookingCta,
  phraseConsultationLength,
  phraseConsultationRoom,
  phraseGuideIntroduction,
  phraseIndependentPrescriber,
  phraseOnlineBooking,
  phraseParking,
  phraseResultsProcess,
  phraseServiceAftercare,
  phraseServiceEquipment,
  phraseServicePreparation,
  phraseServicePricing,
  phraseWalkIn,
  phraseYearsServing,
  teamSubjectPhrase,
} from "./pharmacyLongFormIntelligencePhrases.ts";
import { phraseLocalMarketGuideContext } from "./pharmacyLocalMarketIntelligencePhrases.ts";

export { intelligenceSupportsClaim } from "./pharmacyLongFormIntelligencePhrases.ts";

export const FORBIDDEN_HEDGING_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /not every pharmacy offers[^.]*\./gi,
    replacement: "",
  },
  {
    pattern: /local participation varies[^.]*\./gi,
    replacement: "",
  },
  {
    pattern: /confirm before you travel\.?/gi,
    replacement: "",
  },
  {
    pattern: /some pharmacies may[^.]*\./gi,
    replacement: "",
  },
  {
    pattern: /where offered[^.]*\./gi,
    replacement: "",
  },
  {
    pattern: /if (?:the service is )?available at your local pharmacy[^.]*\./gi,
    replacement: "",
  },
  {
    pattern: /participating pharmacies[^.]*\./gi,
    replacement: "",
  },
  {
    pattern: /not all pharmacies[^.]*\./gi,
    replacement: "",
  },
  {
    pattern: /availability varies[^.]*\./gi,
    replacement: "",
  },
  {
    pattern: /some pharmacies also offer[^.]*\./gi,
    replacement: "",
  },
  {
    pattern: /ask what is available locally[^.]*\./gi,
    replacement: "",
  },
];

export interface LongFormSection {
  heading: string;
  html: string;
}

export interface LongFormBlogConfig {
  slug: string;
  title: string;
  angle: "what-is" | "who-for" | "need-to-know";
  masterSections: number[];
  lead: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripMd(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\b(?:Description|Typical symptoms|When Pharmacy First is appropriate|When GP referral is required|When urgent care is required)\s*:\s*/gi, "")
    .trim();
}

function sectionBody(ctx: ContentGenerationContext, sectionNumber: number): string {
  const sec = ctx.masterLibrary.sections.find((s) => s.number === sectionNumber);
  return sec?.bodyMarkdown || "";
}

function firstParagraph(md: string): string {
  return md.split(/\n\n+/).find((p) => p.trim() && !p.trim().startsWith("-") && !p.trim().startsWith("*")) || md.split(/\n\n+/)[0] || "";
}

function paragraphBlocks(md: string, limit = 4): string[] {
  return md
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("|") && !/^\*\*Myth:/i.test(p))
    .slice(0, limit);
}

export function stripForbiddenHedging(text: string): string {
  let out = text;
  for (const { pattern, replacement } of FORBIDDEN_HEDGING_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function tenantizeProse(text: string, ctx: ContentGenerationContext): string {
  let out = applyContextTokens(text, ctx);
  out = stripForbiddenHedging(out);
  const { pharmacyName } = ctx.profile;
  const teamPhrase = teamSubjectPhrase(ctx);

  if (teamPhrase) {
    out = out.replace(/\byour pharmacy team\b/gi, teamPhrase);
    out = out.replace(/\bthe pharmacy team\b/gi, teamPhrase);
  } else {
    out = out.replace(/\byour pharmacy team\b/gi, `the ${pharmacyName} team`);
    out = out.replace(/\bthe pharmacy team\b/gi, `the ${pharmacyName} team`);
  }
  out = out.replace(/\bat the pharmacy\b/gi, `at ${pharmacyName}`);
  out = out.replace(/\bfrom the pharmacy\b/gi, `from ${pharmacyName}`);
  out = out.replace(/\bthe pharmacy\b/gi, pharmacyName);
  out = out.replace(/\ba pharmacy check\b/gi, `${pharmacyName}'s ${ctx.serviceName.toLowerCase()} service`);
  out = out.replace(/\bpharmacy screening\b/gi, `${ctx.serviceName.toLowerCase()} at ${pharmacyName}`);
  out = out.replace(/\bpatients choose pharmacy\b/gi, `Patients choose ${pharmacyName}`);
  out = out.replace(/\bpharmacy blood pressure checks\b/gi, `${ctx.serviceName.toLowerCase()} at ${pharmacyName}`);
  if (ctx.serviceId !== "blood-pressure-checks") {
    out = out.replace(/\s*\(New Medicine Service, contraception, blood pressure checks, etc\.\)/gi, " alongside other NHS community pharmacy services");
    out = out.replace(/\bblood pressure checks?\b/gi, `${ctx.serviceName.toLowerCase()} consultations`);
  }
  out = out.replace(/\bthese are separate from the nhs service\s*—\s*/gi, "");
  out = out.replace(/\s+—\s*\./g, ".");

  return out.replace(/\s{2,}/g, " ").trim();
}

function renderProseHtml(md: string, ctx: ContentGenerationContext): string {
  const parts: string[] = [];
  for (const block of paragraphBlocks(md, 6)) {
    if (block.match(/^[-*]\s/m)) {
      const items = block.split(/\n/).filter((l) => /^[-*]\s/.test(l.trim()));
      parts.push(`<ul>${items.map((i) => `<li>${esc(tenantizeProse(stripMd(i.replace(/^[-*]\s+/, "")), ctx))}</li>`).join("")}</ul>`);
    } else {
      parts.push(`<p>${esc(tenantizeProse(stripMd(block), ctx))}</p>`);
    }
  }
  return parts.join("\n");
}

function bridgeSentence(ctx: ContentGenerationContext, slot: number): string {
  const { pharmacyName } = ctx.profile;
  const { serviceName, serviceId } = ctx;
  const phone = ctx.cta.phone;
  const town = ctx.localArea || ctx.primaryTown;
  const bridges = [
    `At ${pharmacyName}, ${serviceName.toLowerCase()} is provided by the pharmacy team — call ${phone} to check appointment times.`,
    `Patients in ${town} contact ${pharmacyName} on ${phone} when they want clear guidance about ${serviceName.toLowerCase()}.`,
    `The ${pharmacyName} team explains each step in plain language so you know what the assessment means and what to do next.`,
    `${pharmacyName} offers ${serviceName.toLowerCase()} as part of its pharmacy services for patients in ${town} and surrounding areas.`,
    `When you visit ${pharmacyName}, the pharmacist confirms suitability before any Pharmacy First treatment is supplied.`,
    `If you are travelling to ${pharmacyName} from ${town}, call ${phone} first to confirm the best time for your appointment.`,
    `Clinical advice from ${pharmacyName} is provided by ${ctx.reviewer.name || ctx.profile.superintendentPharmacistName}${ctx.reviewer.role ? `, ${ctx.reviewer.role}` : ""}.`,
    `You can read the full ${serviceName} service page for more detail about what ${pharmacyName} includes in each consultation.`,
  ];
  return bridges[slot % bridges.length]!;
}

function mainServiceLinkHtml(ctx: ContentGenerationContext): string {
  const href = ctx.links.mainServicePreviewUrl;
  return `<p class="long-form-service-link"><a href="${esc(href)}">${esc(ctx.serviceName)} at ${esc(ctx.profile.pharmacyName)} — main service page</a></p>`;
}

function localAreaLinksHtml(ctx: ContentGenerationContext): string {
  const areas = ctx.selectedAreas.slice(0, 6);
  if (!areas.length) return "";
  const items = areas
    .map(
      (a) =>
        `<li><a href="/api/pharmacy-content-ecosystem-preview/${esc(ctx.serviceId)}/local/${esc(a.areaSlug)}/?slug=${esc(ctx.resolvedSlug)}">${esc(ctx.serviceName)} in ${esc(a.areaName)}</a></li>`,
    )
    .join("\n");
  return `<p>Local area pages for ${esc(ctx.profile.pharmacyName)}:</p><ul>${items}</ul>`;
}

function ctaBlockHtml(ctx: ContentGenerationContext): string {
  const phone = ctx.cta.phone;
  const booking = ctx.cta.bookingUrl;
  const bookingIntel = phraseBookingCta(ctx);
  const parts = [`<p><strong>Arrange ${esc(ctx.serviceName.toLowerCase())} at ${esc(ctx.profile.pharmacyName)}</strong></p>`];
  if (bookingIntel) {
    parts.push(`<p>${esc(tenantizeProse(bookingIntel, ctx))}</p>`);
  } else {
    parts.push(`<p>Call <a href="tel:${esc(phone.replace(/\s/g, ""))}">${esc(phone)}</a> to book or ask about appointment availability.</p>`);
  }
  if (booking) parts.push(`<p>Or book online: <a href="${esc(booking)}">${esc(booking)}</a></p>`);
  else if (phraseOnlineBooking(ctx)) {
    parts.push(`<p>${esc(tenantizeProse(phraseOnlineBooking(ctx)!, ctx))}</p>`);
  }
  parts.push(mainServiceLinkHtml(ctx));
  return parts.join("\n");
}

function intelligenceParagraphs(ctx: ContentGenerationContext, phrases: Array<string | null>): string {
  return collectIntelligenceSentences(phrases)
    .map((p) => `<p>${esc(tenantizeProse(p, ctx))}</p>`)
    .join("\n");
}

export function buildPatientGuideSections(ctx: ContentGenerationContext): LongFormSection[] {
  const p = ctx.profile.pharmacyName;
  const svc = ctx.serviceName;
  const town = ctx.localArea || ctx.primaryTown;
  const introIntel = phraseGuideIntroduction(ctx);
  const introFallback = tenantizeProse(
    `This guide explains how ${svc.toLowerCase()} works at ${p} for patients in ${town} and nearby communities. ${p} provides pharmacist-led assessment with time to discuss symptoms and practical next steps.`,
    ctx,
  );
  const duringVisitExtras = [
    phraseConsultationRoom(ctx),
    phraseConsultationLength(ctx),
    phraseServiceEquipment(ctx),
  ];
  const prepareExtras = [phraseServicePreparation(ctx), phraseParking(ctx)];
  const resultsIntel = phraseResultsProcess(ctx);
  const resultsFallback = tenantizeProse(
    `${p} explains the outcome in plain language and tells you whether pharmacy treatment, GP care, self-care, or urgent help is the right next step.`,
    ctx,
  );
  const trustExtras = [phraseYearsServing(ctx), phraseIndependentPrescriber(ctx)];
  const arrangeExtras = [phraseParking(ctx), phraseWalkIn(ctx)];

  return [
    {
      heading: `Introduction — ${svc} at ${p}`,
      html: `<p>${esc(introIntel ? tenantizeProse(introIntel, ctx) : introFallback)}</p>
<p>${esc(bridgeSentence(ctx, 0))}</p>${phraseLocalMarketGuideContext(ctx) ? `<p>${esc(tenantizeProse(phraseLocalMarketGuideContext(ctx)!, ctx))}</p>` : ""}`,
    },
    {
      heading: "What the service helps with",
      html: renderProseHtml(sectionBody(ctx, 1), ctx) + `<p>${esc(bridgeSentence(ctx, 1))}</p>`,
    },
    {
      heading: "Who should consider this service",
      html: renderProseHtml(sectionBody(ctx, 2), ctx) + `<p>${esc(bridgeSentence(ctx, 2))}</p>`,
    },
    {
      heading: "What happens during your check",
      html:
        renderProseHtml(sectionBody(ctx, 4), ctx) +
        `<p>${esc(tenantizeProse(`At ${p}, the consultation follows a structured process — not rushed counter advice. The pharmacist explains each step before the assessment begins.`, ctx))}</p>` +
        intelligenceParagraphs(ctx, duringVisitExtras),
    },
    {
      heading: "What to bring and how to prepare",
      html:
        renderProseHtml(sectionBody(ctx, 5), ctx) +
        `<p>${esc(tenantizeProse(`Call ${ctx.cta.phone} if you are unsure what to bring — the ${p} team can advise before you travel from ${town}.`, ctx))}</p>` +
        intelligenceParagraphs(ctx, prepareExtras),
    },
    {
      heading: `How ${p} explains your results`,
      html:
        renderProseHtml(firstParagraph(sectionBody(ctx, 10)) + "\n\n" + firstParagraph(sectionBody(ctx, 7)), ctx) +
        `<p>${esc(resultsIntel ? tenantizeProse(resultsIntel, ctx) : resultsFallback)}</p>` +
        intelligenceParagraphs(ctx, [phraseServiceAftercare(ctx), phraseServicePricing(ctx)]),
    },
    {
      heading: "When urgent medical help may be needed",
      html: renderProseHtml(sectionBody(ctx, 6), ctx) + `<p>${esc(tenantizeProse(`If symptoms or red flags cause concern during your visit to ${p}, the pharmacist will advise GP, NHS 111, urgent care or emergency care rather than pharmacy treatment.`, ctx))}</p>`,
    },
    {
      heading: `How to arrange a check at ${p}`,
      html:
        ctaBlockHtml(ctx) +
        `<p>${esc(tenantizeProse(`Opening hours: ${ctx.cta.openingHours}. The pharmacy is at ${ctx.profile.fullAddress}.`, ctx))}</p>` +
        intelligenceParagraphs(ctx, arrangeExtras),
    },
    {
      heading: "Professional review and accountability",
      html:
        `<p>${esc(tenantizeProse(`This guide is reviewed by ${ctx.reviewer.name || ctx.profile.superintendentPharmacistName}${ctx.reviewer.role ? `, ${ctx.reviewer.role}` : ""}. ${p} is registered with the GPhC${ctx.profile.gphcNumber ? ` (premises ${ctx.profile.gphcNumber})` : ""}.`, ctx))}</p>
<p>${esc(tenantizeProse(ctx.reviewer.bio || `The pharmacy team provides structured assessment and clear safety-netting — not treatment without checking NHS pathway criteria.`, ctx))}</p>` +
        intelligenceParagraphs(ctx, trustExtras),
    },
    {
      heading: "Related pages",
      html: mainServiceLinkHtml(ctx) + localAreaLinksHtml(ctx),
    },
  ];
}

export function buildPatientGuideBodyHtml(ctx: ContentGenerationContext): string {
  return buildPatientGuideSections(ctx)
    .map((s) => `<h2>${esc(s.heading)}</h2>\n${s.html}`)
    .join("\n");
}

export function buildSupportingServiceOverviewBodyHtml(ctx: ContentGenerationContext): string {
  const p = ctx.profile.pharmacyName;
  const svc = ctx.serviceName;
  const town = ctx.localArea || ctx.primaryTown;
  const { serviceId } = ctx;
  const sections: string[] = [];

  sections.push(
    `<p>${esc(tenantizeProse(`${p} offers ${svc.toLowerCase()} for patients in ${town} and nearby areas. This page explains what the service includes, who it suits, and how to arrange an appointment at the pharmacy.`, ctx))}</p>`,
  );

  sections.push(`<h2>What ${svc} help with</h2>`);
  sections.push(renderProseHtml(sectionBody(ctx, 1), ctx));
  sections.push(`<p>${esc(bridgeSentence(ctx, 0))}</p>`);

  sections.push(`<h2>Who should consider ${svc.toLowerCase()}</h2>`);
  sections.push(renderProseHtml(sectionBody(ctx, 2), ctx));
  sections.push(`<p>${esc(bridgeSentence(ctx, 2))}</p>`);

  sections.push(`<h2>What happens during your visit</h2>`);
  sections.push(renderProseHtml(firstParagraph(sectionBody(ctx, 4)), ctx));
  sections.push(
    `<p>${esc(tenantizeProse(`At ${p}, the pharmacist explains each step before assessment and discusses the outcome in plain language.`, ctx))}</p>`,
  );

  sections.push(`<h2>Why patients choose ${p}</h2>`);
  sections.push(renderProseHtml(firstParagraph(sectionBody(ctx, 10)), ctx));
  sections.push(`<p>${esc(bridgeSentence(ctx, 4))}</p>`);

  sections.push(`<h2>How to arrange ${svc.toLowerCase()} at ${p}</h2>`);
  sections.push(ctaBlockHtml(ctx));

  sections.push(`<h2>More information from ${p}</h2>`);
  sections.push(`<ul>
<li><a href="/api/pharmacy-content-ecosystem-preview/${esc(serviceId)}/pages/${esc(serviceId)}-guide/?slug=${esc(ctx.resolvedSlug)}">Patient guide — ${esc(svc)}</a></li>
<li><a href="/api/pharmacy-content-ecosystem-preview/${esc(serviceId)}/pages/what-is-${esc(serviceId)}/?slug=${esc(ctx.resolvedSlug)}">What is ${esc(svc)}?</a></li>
<li><a href="/api/pharmacy-content-ecosystem-preview/${esc(serviceId)}/pages/who-should-consider-${esc(serviceId)}/?slug=${esc(ctx.resolvedSlug)}">Who should consider ${esc(svc)}?</a></li>
<li><a href="/api/pharmacy-content-ecosystem-preview/${esc(serviceId)}/pages/${esc(serviceId)}-what-you-need-to-know/?slug=${esc(ctx.resolvedSlug)}">${esc(svc)} — what you need to know</a></li>
<li><a href="/api/pharmacy-content-ecosystem-preview/${esc(serviceId)}/pages/${esc(serviceId)}-faqs/?slug=${esc(ctx.resolvedSlug)}">${esc(svc)} FAQs</a></li>
</ul>`);
  sections.push(mainServiceLinkHtml(ctx));
  sections.push(localAreaLinksHtml(ctx));

  sections.push(
    `<p><em>Reviewed by ${esc(ctx.reviewer.name || ctx.profile.superintendentPharmacistName)}${ctx.reviewer.role ? `, ${esc(ctx.reviewer.role)}` : ""}.</em></p>`,
  );

  return sections.join("\n");
}

export function validateSupportingPageTemplate(html: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const bodyHtml = html.replace(/<style[\s\S]*?<\/style>/gi, "");

  if (/<(?:header|section|div)[^>]*class="[^"]*\bhero-a\b/i.test(bodyHtml)) {
    issues.push("old blue hero-a template in body");
  }
  if (bodyHtml.includes('class="preview-banner"')) {
    issues.push("old preview-banner template");
  }
  if (!html.includes("demo-banner")) {
    issues.push("missing PharmaConnect demo-banner shell");
  }
  if (!html.includes("site-header")) {
    issues.push("missing site-header");
  }
  if (!html.includes("top-trust-bar")) {
    issues.push("missing top-trust-bar");
  }
  if (!html.includes("data-content-engine-context")) {
    issues.push("missing content engine context marker");
  }

  const isFaq = html.includes('data-ecosystem-type="faq-page"');
  if (!isFaq && !bodyHtml.includes('class="eco-article"')) {
    issues.push("missing eco-article long-form shell");
  }

  return { ok: issues.length === 0, issues };
}

export const SUPPORTING_PAGE_SLUGS = (serviceId: string) =>
  [
    serviceId,
    `what-is-${serviceId}`,
    `${serviceId}-guide`,
    `${serviceId}-faqs`,
    `who-should-consider-${serviceId}`,
    `${serviceId}-what-you-need-to-know`,
  ] as const;

export function buildBlogConfigs(ctx: ContentGenerationContext): LongFormBlogConfig[] {
  const { serviceId, serviceName } = ctx;
  const p = ctx.profile.pharmacyName;
  const town = ctx.localArea || ctx.primaryTown;
  const team = teamSubjectPhrase(ctx);
  const prep = phraseServicePreparation(ctx);
  const walkIn = phraseWalkIn(ctx);

  const whatIsLead = team
    ? `${team} provides ${serviceName.toLowerCase()} with pharmacist assessment and clear next steps — here is what the service involves and why people book at ${p}.`
    : `${p} offers ${serviceName.toLowerCase()} for patients who want pharmacist assessment and clear next steps — here is what the service involves and why people book.`;

  const whoForLead = team
    ? `Many patients in ${town} contact ${team.toLowerCase()} at ${p} about ${serviceName.toLowerCase()} — this article explains who the service suits and how the team can help.`
    : `Many patients in ${town} contact ${p} about ${serviceName.toLowerCase()} — this article explains who the service suits and how the team can help.`;

  const needToKnowParts = [
    prep ? stripMd(prep) : "",
    walkIn ? stripMd(walkIn) : "",
    phraseResultsProcess(ctx) || "",
  ].filter(Boolean);
  const needToKnowLead =
    needToKnowParts.length > 0
      ? `Before you book ${serviceName.toLowerCase()} at ${p}, ${needToKnowParts.join(" ")}`
      : `Before you book ${serviceName.toLowerCase()} at ${p}, here is practical information about preparation, results and when other care routes apply.`;

  return [
    {
      slug: `what-is-${serviceId}`,
      title: `What Is ${serviceName}?`,
      angle: "what-is",
      masterSections: [1, 10],
      lead: whatIsLead,
    },
    {
      slug: `who-should-consider-${serviceId}`,
      title: `Who Should Consider ${serviceName}?`,
      angle: "who-for",
      masterSections: [2],
      lead: whoForLead,
    },
    {
      slug: `${serviceId}-what-you-need-to-know`,
      title: `${serviceName} — What You Need To Know`,
      angle: "need-to-know",
      masterSections: [3, 6, 9],
      lead: needToKnowLead,
    },
  ];
}

export function normalizeComparableText(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export function stripDuplicateLeadParagraph(lead: string | undefined, bodyHtml: string): string {
  if (!lead?.trim()) return bodyHtml;
  const leadNorm = normalizeComparableText(lead);
  return bodyHtml.replace(/^\s*<p>([\s\S]*?)<\/p>\s*/i, (full, inner: string) =>
    normalizeComparableText(inner) === leadNorm ? "" : full,
  );
}

export function detectDuplicateLeadAfterH1(html: string): boolean {
  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (!article) return false;
  const leadMatch = article.match(/<p class="eco-lead">([\s\S]*?)<\/p>/i);
  if (!leadMatch) return false;
  const leadNorm = normalizeComparableText(leadMatch[1]);
  const proseMatch = article.match(/<div class="eco-prose">\s*(?:\n\s*)*<p>([\s\S]*?)<\/p>/i);
  if (!proseMatch) return false;
  return leadNorm.length > 20 && normalizeComparableText(proseMatch[1]) === leadNorm;
}

export function buildBlogPostBodyHtml(ctx: ContentGenerationContext, blog: LongFormBlogConfig): string {
  const sections: string[] = [];

  for (let i = 0; i < blog.masterSections.length; i++) {
    const n = blog.masterSections[i]!;
    const sec = ctx.masterLibrary.sections.find((s) => s.number === n);
    if (!sec) continue;
    sections.push(`<h2>${esc(sec.heading.replace(/^\d+\.\s*/, ""))}</h2>`);
    sections.push(renderProseHtml(sec.bodyMarkdown, ctx));
    sections.push(`<p>${esc(bridgeSentence(ctx, n + i))}</p>`);
  }

  if (blog.angle === "need-to-know") {
    sections.push(`<h2>Booking at ${esc(ctx.profile.pharmacyName)}</h2>`);
    sections.push(ctaBlockHtml(ctx));
    sections.push(
      intelligenceParagraphs(ctx, [
        phraseParking(ctx),
        phraseConsultationLength(ctx),
        phraseWalkIn(ctx),
        phraseServicePreparation(ctx),
        phraseServiceAftercare(ctx),
      ]),
    );
  } else {
    sections.push(`<h2>Next steps at ${esc(ctx.profile.pharmacyName)}</h2>`);
    sections.push(`<p>${esc(tenantizeProse(`Call ${ctx.cta.phone} to arrange ${ctx.serviceName.toLowerCase()} or ask what to expect at your appointment.`, ctx))}</p>`);
    sections.push(mainServiceLinkHtml(ctx));
  }

  sections.push(
    `<p><em>Reviewed by ${esc(ctx.reviewer.name || ctx.profile.superintendentPharmacistName)}${ctx.reviewer.role ? `, ${esc(ctx.reviewer.role)}` : ""}.</em></p>`,
  );

  return sections.join("\n");
}

/**
 * Evidence-safe standalone FAQ entries for ecosystem FAQ pages.
 * Does not invent appointments, walk-ins, NHS funding, ABPM, prices or diagnosis.
 * Avoids repeating the full pharmacy name in every question.
 */
export function buildEvidenceSafeStandaloneFaqEntries(input: {
  serviceId: string;
  serviceName: string;
  pharmacyName: string;
  phone: string;
  website?: string;
}): Array<{ question: string; answer: string }> {
  const phone = String(input.phone || "").trim();
  const phoneClause = phone ? ` Call ${phone}.` : "";
  const arrange =
    input.serviceId === "blood-pressure-checks"
      ? "Contact the pharmacy to ask how blood pressure checks are arranged."
      : `Contact the pharmacy to ask how ${input.serviceName.toLowerCase()} are arranged.`;

  if (input.serviceId === "blood-pressure-checks") {
    return [
      {
        question: "What is a blood pressure check?",
        answer:
          "A blood pressure check measures the pressure of blood in your arteries. It records two numbers and helps identify raised readings early. It is a screening check, not a diagnosis of high blood pressure.",
      },
      {
        question: "How do I arrange a check?",
        answer: `${arrange}${phoneClause}`,
      },
      {
        question: "What should I bring?",
        answer:
          "Bring a list of medicines you take and any recent home readings if you have them. A short sleeve helps the cuff sit on your upper arm. Ask the pharmacy if you are unsure what to bring.",
      },
      {
        question: "What happens during the check?",
        answer:
          "You rest briefly, then a cuff is placed on your upper arm to take readings. The team explains what the numbers mean and discusses sensible next steps. Ask the pharmacy what to expect when you contact them.",
      },
      {
        question: "What do the two numbers mean?",
        answer:
          "The top number (systolic) is the pressure when your heart beats. The bottom number (diastolic) is the pressure when your heart rests between beats. The pharmacy team can explain your readings in plain language.",
      },
      {
        question: "What happens if my reading is high?",
        answer:
          "One raised reading is not a diagnosis. The pharmacy may advise repeating the check, lifestyle advice, or contacting your GP. Follow the advice given on the day.",
      },
      {
        question: "Can a pharmacy diagnose high blood pressure?",
        answer:
          "No — pharmacy checks screen for raised readings. Diagnosis and long-term treatment remain with your GP.",
      },
      {
        question: "When should I seek urgent medical help?",
        answer:
          "Call 999 if you have severe chest pain, sudden weakness, difficulty speaking, or feel severely unwell. For urgent but non-emergency advice, contact NHS 111 or your GP.",
      },
      {
        question: "How do I contact the pharmacy?",
        answer: phone
          ? `Call ${input.pharmacyName} on ${phone}${input.website ? `, or visit the pharmacy website` : ""}.`
          : `Contact ${input.pharmacyName} to ask about blood pressure checks.`,
      },
    ];
  }

  return [
    {
      question: `What is ${input.serviceName}?`,
      answer: `${input.serviceName} is a pharmacist-led service. The team explains what happens during the consultation and what happens next. ${arrange}`,
    },
    {
      question: "How do I arrange this service?",
      answer: `${arrange}${phoneClause}`,
    },
    {
      question: "What should I bring?",
      answer:
        "Bring a list of medicines you take, allergies, and notes about your symptoms. Ask the pharmacy if you are unsure what to bring.",
    },
    {
      question: "Can the pharmacy diagnose my condition?",
      answer:
        "Pharmacy consultations provide assessment and advice within the service scope. Diagnosis and long-term treatment decisions may remain with your GP where appropriate.",
    },
    {
      question: "When should I seek urgent medical help?",
      answer:
        "Call 999 if you feel severely unwell or have sudden serious symptoms. For urgent but non-emergency advice, contact NHS 111 or your GP.",
    },
    {
      question: "How do I contact the pharmacy?",
      answer: phone
        ? `Call ${input.pharmacyName} on ${phone}${input.website ? `, or visit the pharmacy website` : ""}.`
        : `Contact ${input.pharmacyName} for more information.`,
    },
  ];
}

export function buildTenantFaqEntries(ctx: ContentGenerationContext): Array<{ question: string; answer: string }> {
  // Prefer evidence-safe standalone FAQ inventory for customer-facing FAQ pages.
  const phone = ctx.cta.phone || "";
  const website = ctx.cta.website || "";
  if (ctx.serviceId === "blood-pressure-checks") {
    return buildEvidenceSafeStandaloneFaqEntries({
      serviceId: ctx.serviceId,
      serviceName: ctx.serviceName,
      pharmacyName: ctx.profile.pharmacyName,
      phone,
      website,
    });
  }

  const p = ctx.profile.pharmacyName;
  const svc = ctx.serviceName;
  const town = ctx.localArea || ctx.primaryTown;
  const maxFaqs = ctx.businessProfileIntelligence.content.faqPreferences.maxFaqs || 10;

  const masterFaqs = ctx.masterLibrary.faqs.slice(0, 4);
  const profileFaqs = buildProfileBackedFaqEntries(ctx).map((f) => ({
    question: f.question,
    answer: tenantizeProse(f.answer, ctx),
  }));
  const profileQuestionKeys = new Set(profileFaqs.map((f) => f.question.toLowerCase()));

  const prep = phraseServicePreparation(ctx);
  const consultLength = phraseConsultationLength(ctx);
  const appointmentRequired = (ctx as { serviceDelivery?: { appointmentRequired?: boolean | null } }).serviceDelivery
    ?.appointmentRequired;
  const arrangeLine =
    appointmentRequired === true
      ? `Call ${phone} to arrange ${svc.toLowerCase()}. The ${p} team can explain what to bring.`
      : `Contact the pharmacy to ask how ${svc.toLowerCase()} are arranged.${phone ? ` Call ${phone}.` : ""}`;

  const customFaqs: Array<{ question: string; answer: string }> = [
    {
      question: `How do I arrange ${svc}?`,
      answer: tenantizeProse(
        consultLength ? `${consultLength} ${arrangeLine}` : arrangeLine,
        ctx,
      ),
    },
    {
      question: `What should I bring to my ${svc.toLowerCase()}?`,
      answer: tenantizeProse(
        prep
          ? `${prep} Call ${phone} if you are unsure about anything else.`
          : `Mention any medicines you take, allergies, symptoms and when they started. Call ${phone} if you are unsure about preparation.`,
        ctx,
      ),
    },
    {
      question: `Can I ask the pharmacist to explain my ${svc.toLowerCase()} options?`,
      answer: tenantizeProse(
        phraseResultsProcess(ctx)
          ? `${phraseResultsProcess(ctx)!} The pharmacist discusses what the assessment means and sensible next steps.`
          : `Yes — explaining your options in plain language is a core part of ${svc.toLowerCase()}. The pharmacist discusses what the assessment means and sensible next steps.`,
        ctx,
      ),
    },
    {
      question: `What happens if I need GP or urgent care after speaking to the pharmacy?`,
      answer: tenantizeProse(
        `The pharmacist explains whether your symptoms need GP follow-up, NHS 111, urgent care or emergency care. You leave with clear guidance.`,
        ctx,
      ),
    },
    {
      question: `Can patients from areas near ${town} use this service?`,
      answer: tenantizeProse(
        `${p} welcomes patients from ${town} and surrounding areas. Call ${phone} for directions from your area.`,
        ctx,
      ),
    },
  ].filter((f) => !profileQuestionKeys.has(f.question.toLowerCase()));

  const fromMaster = masterFaqs.map((f) => ({
    question: f.question.replace(new RegExp(`\\s+at\\s+${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\??$`, "i"), "").replace(/\?$/, "") + "?",
    answer: tenantizeProse(stripMd(f.answer), ctx),
  }));

  return [...profileFaqs, ...customFaqs, ...fromMaster].slice(0, maxFaqs);
}

export function detectForbiddenHedging(text: string): string[] {
  const hits: string[] = [];
  for (const { pattern } of FORBIDDEN_HEDGING_PATTERNS) {
    const m = text.match(pattern);
    if (m) hits.push(...m.map((s) => s.trim().slice(0, 80)));
  }
  return hits;
}

export function longFormPlainText(html: string): string {
  let scoped = html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ");
  const article = scoped.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  const main = scoped.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  const body = article || main || scoped;
  return body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function countTenantMentions(text: string, pharmacyName: string): number {
  if (!pharmacyName) return 0;
  const re = new RegExp(pharmacyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (text.match(re) || []).length;
}

export function tenantDepthScore(text: string, pharmacyName: string): { first20: boolean; middle: boolean; last20: boolean } {
  const len = text.length;
  if (!len) return { first20: false, middle: false, last20: false };
  const first = text.slice(0, Math.floor(len * 0.2));
  const mid = text.slice(Math.floor(len * 0.35), Math.floor(len * 0.75));
  const last = text.slice(Math.floor(len * 0.8));
  const has = (s: string) => s.toLowerCase().includes(pharmacyName.toLowerCase());
  return { first20: has(first), middle: has(mid), last20: has(last) };
}

export function validateLongFormHtml(
  html: string,
  ctx: ContentGenerationContext,
  assetId: string,
): { ok: boolean; warnings: string[] } {
  const text = longFormPlainText(html);
  const articleHtml = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[0] || html;
  const warnings: string[] = [];
  const pharmacyName = ctx.profile.pharmacyName;

  const hedging = detectForbiddenHedging(text);
  if (hedging.length) warnings.push(`forbidden hedging: ${hedging.join("; ")}`);

  const depth = tenantDepthScore(text, pharmacyName);
  if (!depth.middle) warnings.push("tenant name missing from middle body");

  if (detectDuplicateLeadAfterH1(html)) {
    warnings.push("duplicate lead paragraph after H1");
  }

  if (countTenantMentions(text, pharmacyName) < 3) {
    warnings.push(`tenant mentions ${countTenantMentions(text, pharmacyName)} < 3`);
  }

  if (!text.toLowerCase().includes(ctx.serviceName.toLowerCase())) {
    warnings.push("service name missing");
  }

  const lastQuarter = text.slice(Math.floor(text.length * 0.75));
  if (
    !lastQuarter.includes(ctx.cta.phone) &&
    !articleHtml.includes("tel:") &&
    !articleHtml.includes(ctx.cta.bookingUrl)
  ) {
    warnings.push("CTA missing near end");
  }

  if (!/reviewed by/i.test(text) && assetId !== "faq-page") {
    warnings.push("reviewer/trust missing");
  }

  const tokens = findUnresolvedTokens(html);
  if (tokens.length) warnings.push(`unresolved tokens: ${tokens.join(", ")}`);

  if (/brook pharmacy/i.test(text) && ctx.resolvedSlug !== "pharmaconnect") {
    warnings.push("Brook bleed");
  }

  if (/pharmacy-content-ecosystem\/pharmaconnect/i.test(html) && ctx.resolvedSlug !== "pharmaconnect") {
    warnings.push("pharmaconnect link bleed");
  }

  if (text.split(/\s+/).length < 200 && assetId !== "faq-page") {
    warnings.push("insufficient body depth");
  }

  return { ok: warnings.length === 0, warnings };
}
