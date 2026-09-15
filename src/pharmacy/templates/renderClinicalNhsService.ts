/**
 * Clinical NHS Services page template renderer (hub + cluster).
 * Blueprint-driven — no LLM content generation.
 */

import {
  renderHeroTrustRow,
  renderPharmacyBrandStyles,
  renderSiteFooter,
  renderSiteHeader,
} from "./pharmacyBrandSystem.ts";
import {
  renderPharmacyImageSlot,
  type PharmacyImageRenderContext,
  type PharmacyImageSlot,
} from "./pharmacyImageLibrary.ts";

export interface ClinicalNhsPreviewConfig {
  pharmacyName: string;
  domain: string;
  phone?: string;
  email?: string;
  address?: string;
  previewBasePath?: string;
}

export interface ContextualLinkCandidate {
  href: string;
  label: string;
  kind: "hub" | "cluster" | "related-service" | "money-page";
}

export interface ClinicalNhsRenderContext {
  pageType: "hub" | "cluster";
  campaignBlueprint: Record<string, unknown>;
  serviceIntelligence: Record<string, unknown>;
  templateFamily?: Record<string, unknown>;
  preview: ClinicalNhsPreviewConfig;
  clusterBlueprint?: Record<string, unknown>;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveTokens(text: string, preview: ClinicalNhsPreviewConfig, location?: string): string {
  return text
    .replace(/\{pharmacyName\}/g, preview.pharmacyName)
    .replace(/\{domain\}/g, preview.domain)
    .replace(/\{location\}/g, location ?? "Rotherham");
}

function resolvePageSlugPattern(pattern: string | undefined, serviceKey: string, locationSlug: string): string {
  if (!pattern) return `${serviceKey}-${locationSlug}`;
  return pattern
    .replace(/\{locationSlug\}/g, locationSlug)
    .replace(/\{([^}]+)\}/g, (_, inner: string) => (inner === "locationSlug" ? locationSlug : inner));
}

function previewHref(slug: string, preview: ClinicalNhsPreviewConfig): string {
  const base = preview.previewBasePath ?? "..";
  if (slug.startsWith("http")) return slug;
  if (slug.startsWith("/")) return `${base}${slug.replace(/\/$/, "")}/index.html`;
  return `${base}/${slug}/index.html`;
}

function getStyles(): string {
  return renderPharmacyBrandStyles("#005eb8", "clinical-nhs-services");
}

function buildContextualCandidates(ctx: ClinicalNhsRenderContext): ContextualLinkCandidate[] {
  const blueprint = ctx.campaignBlueprint;
  const identity = blueprint.campaignIdentity as Record<string, unknown>;
  const hubSlug = String(identity.campaignSlug ?? "pharmacy-first-rotherham");
  const location = String(identity.location ?? "Rotherham");
  const preview = ctx.preview;
  const candidates: ContextualLinkCandidate[] = [];
  const seen = new Set<string>();

  const add = (c: ContextualLinkCandidate) => {
    const key = `${c.kind}:${c.href}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(c);
  };

  if (ctx.pageType === "hub") {
    const clusters = (blueprint.clusterBlueprints as Record<string, unknown>[]) ?? [];
    for (const cl of clusters.slice(0, 6)) {
      add({
        href: previewHref(String(cl.pageSlug), preview),
        label: `Pharmacy First in ${cl.area}`,
        kind: "cluster",
      });
    }
  } else if (ctx.clusterBlueprint) {
    add({
      href: previewHref(hubSlug, preview),
      label: `Pharmacy First ${location}`,
      kind: "hub",
    });
    for (const n of (ctx.clusterBlueprint.internalLinks as Record<string, unknown>)?.nearbyAreas as Record<string, unknown>[] ?? []) {
      add({
        href: previewHref(String(n.pageSlug), preview),
        label: String(n.anchorText ?? n.area),
        kind: "cluster",
      });
    }
  }

  const si = ctx.serviceIntelligence;
  const related = (si.internalLinkingOpportunities as Record<string, unknown>)?.relatedServices as Record<string, unknown>[] ?? [];
  for (const r of related.slice(0, 4)) {
    const sk = String(r.serviceKey ?? "");
    add({
      href: previewHref(`${sk}-${String(identity.locationSlug ?? "rotherham")}`, preview),
      label: String(r.label ?? sk),
      kind: "related-service",
    });
  }

  const upsell = (si.internalLinkingOpportunities as Record<string, unknown>)?.upsellServices as Record<string, unknown>[] ?? [];
  for (const u of upsell.slice(0, 2)) {
    add({
      href: previewHref(`${String(u.serviceKey)}-${String(identity.locationSlug ?? "rotherham")}`, preview),
      label: String(u.label ?? u.serviceKey),
      kind: "related-service",
    });
  }

  const parents = (si.internalLinkingOpportunities as Record<string, unknown>)?.parentServices as Record<string, unknown>[] ?? [];
  for (const p of parents.slice(0, 1)) {
    add({
      href: previewHref(`${String(p.serviceKey)}-${String(identity.locationSlug ?? "rotherham")}`, preview),
      label: String(p.label ?? p.serviceKey),
      kind: "money-page",
    });
  }

  return candidates;
}

function buildContextualLinkSentence(c: ContextualLinkCandidate, patternIndex: number, areaLabel?: string): string {
  const anchor = `<a class="contextual-link contextual-link--${c.kind}" href="${esc(c.href)}">${esc(c.label)}</a>`;
  const area = areaLabel ?? c.label.replace(/^Pharmacy First (in )?/i, "");

  if (c.kind === "hub") {
    const patterns = [
      ` For the wider service overview, see ${anchor}.`,
      ` To compare the full ${area} service, visit ${anchor}.`,
    ];
    return patterns[patternIndex % patterns.length]!;
  }
  if (c.kind === "cluster") {
    const patterns = [
      ` Patients in ${area} may also find our ${anchor} information useful.`,
      ` If you are comparing nearby options, read about ${anchor}.`,
      ` You may also want to explore ${anchor} for related local access.`,
    ];
    return patterns[patternIndex % patterns.length]!;
  }
  if (c.kind === "related-service") {
    const patterns = [
      ` You may also want to explore ${anchor} for related pharmacy support.`,
      ` For complementary NHS services, see ${anchor}.`,
      ` Many patients also find ${anchor} helpful alongside this service.`,
    ];
    return patterns[patternIndex % patterns.length]!;
  }
  const patterns = [
    ` Learn more about ${anchor}.`,
    ` For additional pharmacy support, see ${anchor}.`,
  ];
  return patterns[patternIndex % patterns.length]!;
}

export function applyContextualPharmacyLinks(html: string, ctx: ClinicalNhsRenderContext): string {
  const candidates = buildContextualCandidates(ctx);
  if (!candidates.length) return html;

  const sectionIds = ["clinical-service-overview", "clinical-how-it-works", "clinical-benefits", "clinical-local-service"];
  const MAX_PER_SECTION = 2;
  const MAX_PAGE = 8;
  let pageLinks = 0;
  let idx = 0;
  let patternIndex = 0;
  const usedPage = new Set<string>();
  const areaLabel = ctx.pageType === "cluster" ? String(ctx.clusterBlueprint?.area ?? "") : String((ctx.campaignBlueprint.campaignIdentity as Record<string, unknown>)?.location ?? "Rotherham");

  const take = (usedSection: Set<string>): ContextualLinkCandidate | null => {
    while (idx < candidates.length) {
      const c = candidates[idx++]!;
      const uk = c.href;
      if (usedSection.has(uk) || usedPage.has(uk)) continue;
      usedSection.add(uk);
      usedPage.add(uk);
      return c;
    }
    return null;
  };

  const injectLinks = (blockHtml: string, usedSection: Set<string>, sectionLimit: number): string => {
    let sectionLinks = 0;
    return blockHtml.replace(/<p>([\s\S]*?)<\/p>/gi, (full, body: string) => {
      if (sectionLinks >= sectionLimit || pageLinks >= MAX_PAGE) return full;
      if (/<a\b/i.test(body) || /contextual-link/.test(body)) return full;
      const c = take(usedSection);
      if (!c) return full;
      sectionLinks += 1;
      pageLinks += 1;
      const sentence = buildContextualLinkSentence(c, patternIndex++, areaLabel);
      return `<p>${body}${sentence}</p>`;
    });
  };

  let output = html;
  for (const sid of sectionIds) {
    if (pageLinks >= MAX_PAGE) break;
    const re = new RegExp(`<section[^>]*id="${sid}"[^>]*>[\\s\\S]*?<\\/section>`, "i");
    output = output.replace(re, (sectionHtml) => {
      if (pageLinks >= MAX_PAGE) return sectionHtml;
      const usedSection = new Set<string>();
      let updated = sectionHtml.replace(/<div class="section-head"[^>]*>[\s\S]*?<\/div>/gi, (block) => injectLinks(block, usedSection, 1));
      if (sid === "clinical-how-it-works") {
        updated = updated.replace(/<div class="step"[^>]*>[\s\S]*?<\/div>/gi, (block) => injectLinks(block, usedSection, 1));
      }
      if (sid === "clinical-local-service") {
        updated = updated.replace(/<div class="section-head"[^>]*>[\s\S]*?<\/div>/gi, (block) => injectLinks(block, usedSection, 1));
      }
      return updated;
    });
  }
  return output;
}

function isBlueprintHint(text: string): boolean {
  return /^(Answer using|Confirm service|Explain NHS|List core|Walk-in and booked|Do not guarantee)/i.test(text.trim());
}

/** Expands blueprint FAQ hints into patient-facing, compliance-safe answers. */
export function expandPatientFacingFaqAnswer(
  question: string,
  hint: string,
  preview: ClinicalNhsPreviewConfig,
  location: string,
  serviceName = "Pharmacy First",
): string {
  const q = question.toLowerCase();
  const pharmacy = preview.pharmacyName;
  const resolvedHint = resolveTokens(hint, preview, location);

  if (resolvedHint.length > 80 && !isBlueprintHint(resolvedHint)) {
    return resolvedHint;
  }

  if (/available in|available near|near me|where can i access/i.test(q)) {
    return `${serviceName} is available at ${pharmacy}, serving ${location} and nearby communities. Contact the pharmacy team or visit during opening hours to check current availability.`;
  }

  if (/gp appointment|gp referral|before pharmacy first|require a gp/i.test(q)) {
    return `For eligible minor illnesses under the NHS Pharmacy First pathway, you do not usually need a GP appointment first. A pharmacist assesses your symptoms and refers you to your GP, NHS 111, or emergency care where appropriate.`;
  }

  if (/walk in|without appointment|need an appointment/i.test(q)) {
    return `Many patients can walk in for ${serviceName} at ${pharmacy}, subject to pharmacist availability. Call ahead to check waiting times or ask about booking options serving ${location}.`;
  }

  if (/what conditions|can pharmacy first treat|help with.*sore throat|help with.*uti/i.test(q)) {
    return `${serviceName} covers selected common conditions such as sore throat, earache, urinary tract infections (UTI), shingles, impetigo, and insect bites or stings, where you meet NHS eligibility criteria. Any supply of medicines is pathway-dependent — your pharmacist advises what is suitable for you.`;
  }

  if (/free|cost|how much|nhs\?/i.test(q)) {
    return `${serviceName} is an NHS Advanced Service. Where you are eligible, there is no charge at the point of care for qualifying consultations. Eligibility and any treatment supplied depend on your individual assessment.`;
  }

  if (/what is/i.test(q)) {
    return `${serviceName} is an NHS community pharmacy service offering pharmacist-led consultations for selected minor illnesses without always needing a GP appointment. Your pharmacist assesses your symptoms, provides advice or treatment where clinically appropriate and eligible, and signposts you safely when needed.`;
  }

  if (/how do i access|how to access|book/i.test(q)) {
    return `Visit ${pharmacy} during opening hours, call the team, or ask in store about ${serviceName} for ${location}. The pharmacist explains what to expect and whether your symptoms fit the service scope.`;
  }

  if (/eligible|who is/i.test(q)) {
    return `Eligibility depends on your symptoms, age, and the current NHS Pharmacy First clinical pathways. A pharmacist assesses each patient individually — not everyone qualifies for every treatment option.`;
  }

  if (/how long|take/i.test(q)) {
    return `Most ${serviceName} consultations take around 10–20 minutes, depending on your symptoms and whether treatment is supplied. Your pharmacist explains what to expect at the start of the appointment.`;
  }

  if (/specification|which nhs/i.test(q)) {
    return `${serviceName} is delivered under the NHS Community Pharmacy Contractual Framework as an NHS Advanced Service. Specific pathways and eligibility may vary — your pharmacist explains what applies to your situation.`;
  }

  if (/confidential|private/i.test(q)) {
    return `Consultations take place in a private consultation area where possible. Your pharmacist handles your enquiry confidentially and only shares information with other healthcare professionals when clinically necessary.`;
  }

  if (/replace.*gp|instead of.*gp/i.test(q)) {
    return `${serviceName} supports NHS primary care for eligible minor illnesses but does not replace your GP for ongoing or complex conditions. Your pharmacist refers you onward when symptoms fall outside the service scope.`;
  }

  return `Contact ${pharmacy} to ask about ${serviceName} in ${location}. This information is general guidance only — a qualified pharmacist assesses your individual case and advises on the most appropriate next steps.`;
}

function benefitToHeading(benefit: string): string {
  const words = benefit.replace(/\.$/, "").trim().split(/\s+/).slice(0, 5);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "Pharmacy Support";
}

function buildWhyChoosePoints(hub: Record<string, unknown>): string[] {
  const trust = ((hub.trustSignals as string[]) ?? []).filter(
    (t) => !/reviews|pricing|logo|transparent pricing/i.test(t),
  );
  const defaults = [
    "Qualified GPhC-registered pharmacy team",
    "NHS Pharmacy First service pathway",
    "Convenient local high-street access",
    "Clear signposting to GP or emergency care when needed",
    "Private consultation room for confidential support",
    "Friendly, patient-centred pharmacist guidance",
  ];
  return (trust.length >= 4 ? trust : defaults).slice(0, 6);
}

function telHref(phone?: string): string {
  if (!phone) return "#";
  return `tel:${phone.replace(/\s+/g, "")}`;
}

function buildSchemas(opts: {
  pageUrl: string;
  serviceName: string;
  schemaServiceName: string;
  areaServed: string;
  description: string;
  preview: ClinicalNhsPreviewConfig;
  faqs: { question: string; answer: string }[];
}): string {
  const { pageUrl, serviceName, schemaServiceName, areaServed, description, preview, faqs } = opts;
  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: preview.pharmacyName,
    url: pageUrl,
    telephone: preview.phone ?? "",
    email: preview.email ?? "",
    address: preview.address
      ? { "@type": "PostalAddress", streetAddress: preview.address, addressLocality: areaServed, addressCountry: "GB" }
      : { "@type": "PostalAddress", addressLocality: areaServed, addressCountry: "GB" },
  };
  const medicalBusiness = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: preview.pharmacyName,
    url: pageUrl,
    medicalSpecialty: "Pharmacy",
    areaServed: areaServed,
  };
  const service = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: schemaServiceName,
    serviceType: serviceName,
    description,
    areaServed: { "@type": "Place", name: areaServed },
    provider: { "@type": "MedicalBusiness", name: preview.pharmacyName, url: pageUrl },
  };
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  return [localBusiness, medicalBusiness, service, faqPage]
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join("\n ");
}

function buildImageRenderContext(ctx: ClinicalNhsRenderContext, location: string): PharmacyImageRenderContext {
  const identity = ctx.campaignBlueprint.campaignIdentity as Record<string, unknown>;
  const profile = ctx.serviceIntelligence.serviceProfile as Record<string, unknown>;
  return {
    templateFamilyKey: "clinical-nhs-services",
    serviceKey: String(profile.serviceKey ?? identity.serviceKey ?? "pharmacy-first"),
    serviceName: String(identity.serviceName ?? profile.serviceName ?? "Pharmacy First"),
    pharmacyName: ctx.preview.pharmacyName,
    location,
    previewBasePath: ctx.preview.previewBasePath,
  };
}

function imageSlot(ctx: ClinicalNhsRenderContext, slot: PharmacyImageSlot, location: string): string {
  return renderPharmacyImageSlot(slot, buildImageRenderContext(ctx, location));
}

function buildConditions(hubBlueprint: Record<string, unknown>): string[] {
  const sections = (hubBlueprint.serviceSections as Record<string, unknown>[]) ?? [];
  const cond = sections.find((s) => s.id === "conditions-covered");
  return (cond?.items as string[]) ?? [
    "Earache", "Sore throat", "Urinary tract infection (UTI)", "Shingles", "Impetigo", "Insect bites and stings",
  ];
}

function buildSteps(serviceName: string): { title: string; text: string }[] {
  return [
    { title: "Visit or book", text: `Walk into ${serviceName} or book an appointment if you prefer.` },
    { title: "Private consultation", text: "A qualified pharmacist assesses your symptoms in a confidential consultation room." },
    { title: "Treatment or advice", text: "Where clinically appropriate and eligible under NHS pathways, treatment or self-care advice is provided." },
    { title: "Safety-netting", text: "You receive clear guidance on what to do next, including GP or emergency referral if needed." },
  ];
}

export function renderClinicalNhsHubPage(ctx: ClinicalNhsRenderContext): string {
  const blueprint = ctx.campaignBlueprint;
  const hub = blueprint.hubBlueprint as Record<string, unknown>;
  const identity = blueprint.campaignIdentity as Record<string, unknown>;
  const compliance = blueprint.complianceGuardrails as Record<string, unknown>;
  const si = ctx.serviceIntelligence;
  const profile = si.serviceProfile as Record<string, unknown>;
  const preview = ctx.preview;
  const location = String(identity.location ?? "Rotherham");
  const serviceName = String(identity.serviceName ?? "Pharmacy First");
  const slug = String(hub.pageSlug ?? identity.campaignSlug);
  const pageUrl = `https://${preview.domain}/${slug}/`;

  const h1 = resolveTokens(String(hub.h1 ?? `${serviceName} in ${location}`), preview, location);
  const metaTitle = resolveTokens(String(hub.metaTitle ?? h1), preview, location);
  const metaDesc = resolveTokens(String(hub.metaDescription ?? profile.shortDescription ?? ""), preview, location);
  const heroText = resolveTokens(String(hub.heroPositioning ?? ""), preview, location);

  const benefits = ((hub.keyBenefits as string[]) ?? (si.serviceBenefits as string[])).slice(0, 8);
  const whyChoosePoints = buildWhyChoosePoints(hub);
  const trust = (hub.trustSignals as string[]) ?? [];
  const conditions = buildConditions(hub);
  const steps = buildSteps(serviceName);

  const faqSource = (hub.faqSet as Record<string, unknown>[]) ?? (si.customerQuestions as Record<string, unknown>[]).slice(0, 8);
  const faqs = faqSource.map((f) => ({
    question: String(f.question),
    answer: expandPatientFacingFaqAnswer(String(f.question), String(f.answerHint ?? ""), preview, location, serviceName),
  }));

  const clusters = (blueprint.clusterBlueprints as Record<string, unknown>[]) ?? [];
  const related = (hub.internalLinkTargets as Record<string, unknown>)?.relatedServices as Record<string, unknown>[]
    ?? (si.internalLinkingOpportunities as Record<string, unknown>)?.relatedServices as Record<string, unknown>[]
    ?? [];

  const cta = hub.ctaStrategy as Record<string, unknown>;
  const primaryCta = String((cta?.primary as Record<string, unknown>)?.label ?? "Book appointment");
  const secondaryCta = String((cta?.secondary as Record<string, unknown>)?.label ?? "Call the pharmacy");

  const disclaimers = (compliance?.medicalAdviceDisclaimers as string[]) ?? [];
  const pfConstraints = (compliance?.pharmacyFirstWordingConstraints as string[]) ?? [];

  let html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${esc(metaTitle)}</title>
<meta name="description" content="${esc(metaDesc)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${esc(pageUrl)}">
${buildSchemas({ pageUrl, serviceName, schemaServiceName: `${serviceName} ${location}`, areaServed: location, description: metaDesc, preview, faqs })}
<style>${getStyles()}</style>
</head>
<body>
<div class="preview-banner">Local preview only — not deployed · not indexed</div>
${renderSiteHeader(preview, previewHref(slug, preview), primaryCta, "#clinical-cta", "#clinical-faq")}

<section class="hero" id="hero-section">
<div class="wrap hero-grid">
<div>
<div class="eyebrow">NHS Clinical Service</div>
<h1>${esc(h1)}</h1>
<p>${esc(heroText)}</p>
<div class="btns">
<a class="btn" href="#clinical-cta">${esc(primaryCta)}</a>
<a class="btn secondary btn-green" href="${esc(telHref(preview.phone))}">${esc(secondaryCta)}</a>
</div>
${renderHeroTrustRow(trust.slice(0, 4))}
</div>
<div class="hero-media">${imageSlot(ctx, "hero", location)}</div>
</div>
</section>

<section class="blue-band" id="clinical-service-overview">
<div class="wrap">
<div class="section-head center">
<h2>What is ${esc(serviceName)}?</h2>
<p>${esc(resolveTokens(String(profile.shortDescription ?? ""), preview, location))}</p>
</div>
<div class="grid-2">
<div class="card"><h3>Who it helps</h3><p>${esc(String(profile.primaryAudience ?? ""))}</p><p>${esc(((profile.secondaryAudience as string[]) ?? []).join("; "))}</p></div>
<div class="card"><h3>When to use this service</h3><p>Use ${esc(serviceName)} for eligible minor illnesses when you need same-day pharmacist access without waiting for a GP appointment — where clinically appropriate.</p></div>
</div>
</div>
</section>

<section id="clinical-conditions">
<div class="wrap">
<div class="section-head"><h2>Conditions We Can Help With</h2><p>NHS Pharmacy First pathways may include assessment and treatment for common conditions such as:</p></div>
<div class="grid-3">${conditions.map((c) => `<div class="card"><h3>${esc(c)}</h3><p>Pharmacist assessment and NHS pathway care where eligible.</p></div>`).join("")}</div>
</div>
</section>

<section class="green-band soft" id="clinical-how-it-works">
<div class="wrap">
<div class="section-head"><h2>How ${esc(serviceName)} Works</h2></div>
<div class="steps">${steps.map((s) => `<div class="step"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join("")}</div>
</div>
</section>

<section id="clinical-benefits">
<div class="wrap">
<div class="section-head"><h2>Benefits of ${esc(serviceName)}</h2></div>
<div class="grid-3">${benefits.map((b) => `<div class="card"><h3>${esc(benefitToHeading(b))}</h3><p>${esc(b)}</p></div>`).join("")}</div>
</div>
</section>

<section class="blue-band" id="clinical-why-choose">
<div class="wrap">
<div class="section-head"><span class="section-kicker">Trusted local care</span><h2>Why Choose ${esc(preview.pharmacyName)}</h2><p>Local NHS pharmacy care with pharmacist-led consultations and clear referral pathways.</p></div>
<div class="grid-2">
<div class="check-list">${whyChoosePoints.slice(0, 6).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
<div>${imageSlot(ctx, "trust", location)}</div>
</div>
</div>
</section>

<section id="clinical-local-service">
<div class="wrap">
<div class="section-head"><h2>${esc(serviceName)} in ${esc(location)}</h2><p>Serving ${esc(location)} and surrounding communities with walk-in and booked Pharmacy First consultations where eligible.</p></div>
${imageSlot(ctx, "support", location)}
</div>
</section>

<section class="soft areas-we-cover" id="clinical-nearby-areas">
<div class="wrap">
<div class="section-head"><h2>Nearby Areas We Serve</h2><p>Pharmacy First access for Rotherham neighbourhoods:</p></div>
<div class="areas-grid">${clusters.map((c) => `<a class="area-card" href="${esc(previewHref(String(c.pageSlug), preview))}"><h3>${esc(String(c.area))}</h3><p>${esc(String(c.localAngle ?? "").slice(0, 120))}…</p></a>`).join("")}</div>
</div>
</section>

<section id="clinical-related-services">
<div class="wrap">
<div class="section-head"><h2>Related Pharmacy Services</h2></div>
<div class="related-grid">${related.map((r) => `<a class="related-card" href="${esc(previewHref(`${String(r.serviceKey)}-${String(identity.locationSlug)}`, preview))}"><h3>${esc(String(r.label))}</h3><p>NHS and pharmacy services that complement ${esc(serviceName)}.</p></a>`).join("")}</div>
</div>
</section>

<section class="soft" id="clinical-faq">
<div class="wrap">
<div class="section-head center"><h2>Frequently Asked Questions</h2></div>
${faqs.map((f) => `<div class="faq"><h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p></div>`).join("")}
</div>
</section>

<section id="clinical-compliance">
<div class="wrap compliance">
<h3>Important information</h3>
<ul>${[...disclaimers, ...pfConstraints.slice(0, 3)].map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
</div>
</section>

<section class="cta-band" id="clinical-cta">
<div class="wrap">
<h2>Book or Visit ${esc(preview.pharmacyName)} Today</h2>
<p>Walk in for ${esc(serviceName)} in ${esc(location)} or call to check availability. Our pharmacists provide assessment, treatment where appropriate, and safe referral when needed.</p>
<div class="btns" style="justify-content:center">${imageSlot(ctx, "conversion", location)}</div>
<div class="btns" style="justify-content:center;margin-top:16px"><a class="btn" href="#clinical-cta">${esc(primaryCta)}</a><a class="btn secondary" href="${esc(telHref(preview.phone))}">${esc(secondaryCta)}</a></div>
</div>
</section>

${renderSiteFooter(preview, `${serviceName} — ${location}`)}
</body></html>`;

  html = applyContextualPharmacyLinks(html, ctx);
  return html;
}

export function renderClinicalNhsClusterPage(ctx: ClinicalNhsRenderContext): string {
  const cluster = ctx.clusterBlueprint!;
  const blueprint = ctx.campaignBlueprint;
  const identity = blueprint.campaignIdentity as Record<string, unknown>;
  const hub = blueprint.hubBlueprint as Record<string, unknown>;
  const compliance = blueprint.complianceGuardrails as Record<string, unknown>;
  const si = ctx.serviceIntelligence;
  const profile = si.serviceProfile as Record<string, unknown>;
  const preview = ctx.preview;
  const location = String(identity.location ?? "Rotherham");
  const area = String(cluster.area ?? "");
  const serviceName = String(identity.serviceName ?? "Pharmacy First");
  const slug = String(cluster.pageSlug);
  const hubSlug = String(hub.pageSlug ?? identity.campaignSlug);
  const pageUrl = `https://${preview.domain}/${slug}/`;

  const h1 = resolveTokens(String(cluster.h1 ?? `Pharmacy First ${area}`), preview, area);
  const metaTitle = resolveTokens(String(cluster.metaTitle ?? h1), preview, area);
  const metaDesc = resolveTokens(String(cluster.metaDescription ?? ""), preview, area);
  const localAngle = resolveTokens(String(cluster.localAngle ?? ""), preview, area);
  const relevance = resolveTokens(String(cluster.serviceRelevance ?? ""), preview, area);

  const benefits = ((hub.keyBenefits as string[]) ?? (si.serviceBenefits as string[])).slice(0, 8);
  const conditions = buildConditions(hub);
  const steps = buildSteps(serviceName);
  const faqVariants = (cluster.faqVariants as Record<string, unknown>[]) ?? [];
  const faqs = faqVariants.map((f) => ({
    question: resolveTokens(String(f.question), preview, area),
    answer: expandPatientFacingFaqAnswer(String(f.question), String(f.answerHint ?? ""), preview, area, serviceName),
  }));

  const nearby = (cluster.internalLinks as Record<string, unknown>)?.nearbyAreas as Record<string, unknown>[] ?? [];
  const related = (cluster.internalLinks as Record<string, unknown>)?.relatedServices as Record<string, unknown>[] ?? [];
  const localCta = cluster.localCta as Record<string, unknown>;
  const primaryCta = String(localCta?.primary ?? "Book appointment");
  const secondaryCta = String(localCta?.secondary ?? "Call us");

  const disclaimers = (compliance?.medicalAdviceDisclaimers as string[]) ?? [];

  let html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${esc(metaTitle)}</title>
<meta name="description" content="${esc(metaDesc)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${esc(pageUrl)}">
${buildSchemas({ pageUrl, serviceName, schemaServiceName: `${serviceName} ${area}`, areaServed: area, description: metaDesc, preview, faqs })}
<style>${getStyles()}</style>
</head>
<body>
<div class="preview-banner">Local preview only — not deployed · not indexed</div>
${renderSiteHeader(preview, previewHref(hubSlug, preview), primaryCta, "#clinical-cta", "#clinical-faq")}

<section class="hero" id="hero-section">
<div class="wrap hero-grid">
<div>
<div class="eyebrow">NHS Clinical Service · ${esc(area)}</div>
<h1>${esc(h1)}</h1>
<p>${esc(localAngle)}</p>
<p>${esc(relevance)}</p>
<div class="btns">
<a class="btn" href="#clinical-cta">${esc(primaryCta)}</a>
<a class="btn secondary btn-green" href="${esc(telHref(preview.phone))}">${esc(secondaryCta)}</a>
</div>
</div>
<div class="hero-media">${imageSlot(ctx, "hero", area)}</div>
</div>
</section>

<section class="blue-band" id="clinical-service-overview">
<div class="wrap section-head"><h2>${esc(serviceName)} for ${esc(area)}</h2><p>${esc(resolveTokens(String(profile.shortDescription ?? ""), preview, area))}</p></div>
</section>

<section id="clinical-conditions">
<div class="wrap"><div class="section-head"><h2>Conditions We Can Help With</h2></div>
<div class="grid-3">${conditions.slice(0, 6).map((c) => `<div class="card"><h3>${esc(c)}</h3><p>Pharmacist-led NHS pathway where eligible.</p></div>`).join("")}</div></div>
</section>

<section class="green-band soft" id="clinical-how-it-works">
<div class="wrap"><div class="section-head"><h2>How It Works</h2></div>
<div class="steps">${steps.map((s) => `<div class="step"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join("")}</div></div>
</section>

<section id="clinical-benefits">
<div class="wrap"><div class="section-head"><h2>Benefits for ${esc(area)} Residents</h2></div>
<div class="grid-3">${benefits.slice(0, 8).map((b) => `<div class="card"><h3>${esc(benefitToHeading(b))}</h3><p>${esc(b)}</p></div>`).join("")}</div></div>
</section>

<section id="clinical-local-service">
<div class="wrap"><div class="section-head"><h2>Local Service for ${esc(area)}</h2><p>Serving patients travelling from ${esc(area)} to our ${esc(location)} pharmacy.</p></div>
${imageSlot(ctx, "support", area)}</div>
</section>

<section class="soft" id="clinical-nearby-areas">
<div class="wrap"><div class="section-head"><h2>Nearby Areas</h2></div>
<div class="areas-grid">
<a class="area-card" href="${esc(previewHref(hubSlug, preview))}"><h3>${esc(serviceName)} ${esc(location)}</h3><p>Main hub page</p></a>
${nearby.map((n) => `<a class="area-card" href="${esc(previewHref(String(n.pageSlug), preview))}"><h3>${esc(String(n.anchorText))}</h3><p>Nearby neighbourhood</p></a>`).join("")}
</div></div>
</section>

<section id="clinical-related-services">
<div class="wrap"><div class="section-head"><h2>Related Services</h2></div>
<div class="related-grid">${related.map((r) => {
  const sk = String(r.serviceKey ?? "");
  const slug = resolvePageSlugPattern(r.pageSlugPattern as string | undefined, sk, String(identity.locationSlug));
  return `<a class="related-card" href="${esc(previewHref(slug, preview))}"><h3>${esc(String(r.anchorText ?? r.label))}</h3></a>`;
}).join("")}</div></div>
</section>

<section class="soft" id="clinical-faq">
<div class="wrap">${faqs.map((f) => `<div class="faq"><h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p></div>`).join("")}</div>
</section>

<section id="clinical-compliance"><div class="wrap compliance"><h3>Important information</h3><ul>${disclaimers.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div></section>

<section class="cta-band" id="clinical-cta">
<div class="wrap"><h2>${esc(primaryCta)}</h2><p>Contact ${esc(preview.pharmacyName)} for ${esc(serviceName)} serving ${esc(area)}. Speak to the pharmacy team to check availability.</p>
<div class="btns" style="justify-content:center">${imageSlot(ctx, "conversion", area)}</div>
<div class="btns" style="justify-content:center;margin-top:16px">
<a class="btn" href="${esc(telHref(preview.phone))}">Call the pharmacy</a>
<a class="btn secondary" href="#clinical-faq">Ask about Pharmacy First</a>
<a class="btn secondary" href="${esc(telHref(preview.phone))}">Check availability</a>
</div></div>
</section>

${renderSiteFooter(preview, `${serviceName} — ${area}`)}
</body></html>`;

  html = applyContextualPharmacyLinks(html, { ...ctx, pageType: "cluster", clusterBlueprint: cluster });
  return html;
}

export function renderClinicalNhsPage(ctx: ClinicalNhsRenderContext): string {
  return ctx.pageType === "hub" ? renderClinicalNhsHubPage(ctx) : renderClinicalNhsClusterPage(ctx);
}
