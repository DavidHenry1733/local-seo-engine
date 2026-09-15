/**
 * Master → Publish renderer — composes canonical master sections with trust, local, and CTA layers.
 * No blueprint expansion, deep dives, authority insights, or generic card injection.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applySectionBand,
  componentStyles,
  esc,
  inferCtaVariant,
  pickHeroVariant,
  renderCtaBlock,
  renderFaqAccordion,
  renderHeroWithPills,
  renderPreviewSiteHeader,
  renderPreviewTopTrustBar,
  renderSectionHeader,
  sectionRhythmClass,
  type HeroInput,
} from "./pharmacyComponentLibrary.ts";
import {
  countWords,
  injectOwnerVariables,
  loadMasterLibraryFile,
  parseMasterLibraryMarkdown,
  publishSections,
  type MasterLibrarySection,
  type MasterOwnerVariables,
  type ParsedMasterLibrary,
} from "./pharmacyMasterLibraryParser.ts";
import {
  dedupeTrustSectionBody,
  detectBlueprintLeakage,
  detectLocalLayerDuplication,
  detectTrustLayerDuplication,
  getServicePublishMeta,
  type LocalLayerContext,
  type ServicePublishMeta,
} from "./pharmacyMasterPublishConfig.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import { applyContextTokens } from "./contentEngine/contentEngineTokens.ts";
import { resolvePatientFacingServiceHeading } from "./contentEngine/pharmacyCommercialPatientHeadingsV1.ts";
import {
  enhanceTrustSchemaForSlug,
  loadPharmacyTrustProfile,
  pharmacyTrustLayerStyles,
  renderPharmacyTrustLayerForSlug,
  trustProfileFromData,
} from "./pharmacyTrustLayer.ts";
import { isKeywordStuffedPharmacyListingName, resolvePublicationPharmacyIdentity } from "./pharmacyServicePagePublicationQuality.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "docs/pharmacy-master-library"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const MASTER_PUBLISH_ROOT = path.join(resolveWorkspaceRoot(), "output/pharmacy-master-publish");
export const CANONICAL_PUBLISH_ROOT = path.join(resolveWorkspaceRoot(), "output/pharmacy-publish");

export interface MasterPublishInput {
  slug: string;
  serviceId: string;
  serviceName: string;
  masterRelativePath: string;
  localArea: string;
  urlPath: string;
  contentContext?: ContentGenerationContext;
}

export interface MasterPublishValidation {
  sourceMaster: string;
  sections: Array<{ heading: string; source: string }>;
  trustElements: string[];
  localElements: string[];
  wordCountBeforePublish: number;
  wordCountAfterPublish: number;
  qualityAssessment: string;
  qualityDegradation: string[];
  duplicationIntroduced: boolean;
  duplicationNotes: string[];
  publishQuality: "PASS" | "FAIL";
}

export interface MasterPublishResult {
  html: string;
  outputPath: string;
  validation: MasterPublishValidation;
}

function inlineFormat(text: string): string {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return s;
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function renderMarkdownProse(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (!trimmed) {
      closeLists();
      continue;
    }
    if (trimmed.startsWith("<!--")) continue;

    if (trimmed === "---") {
      closeLists();
      continue;
    }

    if (trimmed.startsWith("|")) {
      // Collect contiguous markdown table rows, allowing blank lines between rows.
      const tableLines: string[] = [trimmed];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j]!.trim();
        if (!next) {
          j++;
          continue;
        }
        if (!next.startsWith("|")) break;
        tableLines.push(next);
        j++;
      }
      const separatorIdx = tableLines.findIndex((line) => isTableSeparator(line));
      if (separatorIdx >= 1) {
        closeLists();
        const header = parseTableRow(tableLines[0]!);
        const bodyRows = tableLines
          .slice(separatorIdx + 1)
          .filter((line) => !isTableSeparator(line))
          .map((line) => parseTableRow(line));
        const thead = `<thead><tr>${header.map((c) => `<th>${inlineFormat(c)}</th>`).join("")}</tr></thead>`;
        const tbody =
          bodyRows.length > 0
            ? `<tbody>${bodyRows.map((row) => `<tr>${row.map((c) => `<td>${inlineFormat(c)}</td>`).join("")}</tr>`).join("")}</tbody>`
            : "";
        out.push(`<div class="table-wrap" role="region" aria-label="Data table"><table>${thead}${tbody}</table></div>`);
        i = j - 1;
        continue;
      }
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]!.trim())) {
      closeLists();
      const rows: string[][] = [parseTableRow(trimmed)];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        rows.push(parseTableRow(lines[i]!.trim()));
        i++;
      }
      i--;
      const [header, ...body] = rows;
      const thead = `<thead><tr>${header!.map((c) => `<th>${inlineFormat(c)}</th>`).join("")}</tr></thead>`;
      const tbody =
        body.length > 0
          ? `<tbody>${body.map((row) => `<tr>${row.map((c) => `<td>${inlineFormat(c)}</td>`).join("")}</tr>`).join("")}</tbody>`
          : "";
      out.push(`<div class="table-wrap" role="region" aria-label="Data table"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      closeLists();
      out.push(`<h3>${inlineFormat(trimmed.slice(4).trim())}</h3>`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!inUl) {
        closeLists();
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inlineFormat(bullet[1]!)}</li>`);
      continue;
    }

    const numbered = trimmed.match(/^\d+\.\s+(.*)$/);
    if (numbered) {
      if (!inOl) {
        closeLists();
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inlineFormat(numbered[1]!)}</li>`);
      continue;
    }

    closeLists();
    out.push(`<p>${inlineFormat(trimmed)}</p>`);
  }

  closeLists();
  return out.join("\n");
}

function buildOwnerVariables(slug: string, serviceMeta: ServicePublishMeta): MasterOwnerVariables {
  const profile = loadPharmacyProfile(slug);
  const data = profile?.data || {};
  const phone = String(data.phone || "").trim() || "the pharmacy team";

  const base: MasterOwnerVariables = {
    phone,
    opening_hours: String(data.opening_hours || "Monday to Friday 9am–6pm, Saturday 9am–1pm"),
    booking_link: String(data.bookingUrl || "").trim() || `Call ${phone} to book`,
    consultation_room: data.consultationRoomAvailable
      ? "private consultation room"
      : "confidential consultation space",
    nhs_medication_review:
      "Not currently commissioned as an NHS structured medication review at this pharmacy — call to confirm local options.",
    private_review_fee: "Private structured medication review — fee confirmed when you book",
  };

  return { ...base, ...serviceMeta.ownerVariableDefaults({ phone, data: data as Record<string, unknown> }) };
}

function heroIntroFromSection(section: MasterLibrarySection | undefined): string {
  if (!section) return "";
  const firstPara = section.bodyMarkdown.split(/\n\n+/).find((b) => b.trim() && !b.trim().startsWith("-"));
  return firstPara?.replace(/\*\*/g, "").trim() || "";
}

function heroPillsFromSection(section: MasterLibrarySection | undefined): string[] {
  if (!section) return [];
  const bullets = section.bodyMarkdown.match(/^[-*]\s+(.+)$/gm) || [];
  return bullets
    .slice(0, 3)
    .map((b) => b.replace(/^[-*]\s+/, "").replace(/\*\*/g, "").trim());
}

function renderMasterBodySection(
  section: MasterLibrarySection,
  htmlBody: string,
  patientHeading: string,
): string {
  return `<section class="section-block" data-section-type="masterSection" data-master-section="${section.number}">
  <div class="wrap">
    ${renderSectionHeader("Service information", patientHeading || section.heading)}
    <div class="content-card master-prose">${htmlBody}</div>
  </div>
</section>`;
}

function renderLocalRelevanceLayer(serviceMeta: ServicePublishMeta, ctx: LocalLayerContext): string {
  const body = serviceMeta.localBody(ctx);
  return `<section class="section-block rhythm-teal" data-section-type="localRelevance" data-component="master-local-relevance">
  <div class="wrap">
    ${renderSectionHeader("Local access", serviceMeta.localHeading(ctx.town), body)}
  </div>
</section>`;
}

function buildFaqSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

function renderSchemaBlock(schema: Record<string, unknown>): string {
  const json = JSON.stringify(schema).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function renderPublishedFooter(input: { pharmacyName: string; town: string; phone: string; gphcNumber: string }): string {
  const phoneHtml = input.phone
    ? `<p><a href="tel:${esc(input.phone.replace(/\s/g, ""))}">${esc(input.phone)}</a></p>`
    : "";
  const gphcHtml = input.gphcNumber ? `<p>GPhC Reg. ${esc(input.gphcNumber)}</p>` : "";
  return `<footer class="preview-footer">
<div class="preview-footer-inner">
<div>
<h3>${esc(input.pharmacyName)}</h3>
<p>Your local community pharmacy in ${esc(input.town)}.</p>
</div>
<div>
<h3>Contact</h3>
${phoneHtml}
${gphcHtml}
<p><a href="#contact">Speak to the pharmacy team</a></p>
</div>
</div>
</footer>`;
}

function commercialTrustBodyForPublish(pharmacyName: string, town: string): string {
  return [
    `${pharmacyName} is a community pharmacy team serving patients in ${town} with clear advice, private consultation space where available, and practical next steps when pharmacy care is not enough.`,
    `Patients trust the team for approachable conversations, careful checking of medicines and allergies, and honest guidance about when self-care, pharmacy treatment, or a GP review is the safer choice.`,
    `Professional registration, clinical governance and local accountability sit behind every consultation — so you leave knowing what to do next, not just what medicine might help today.`,
  ].join("\n\n");
}

function prepareSectionsForPublish(
  sections: MasterLibrarySection[],
  ownerVars: MasterOwnerVariables,
  contentContext?: ContentGenerationContext,
  pharmacyName = "",
  town = "",
): MasterLibrarySection[] {
  return sections.map((s) => {
    let body = injectOwnerVariables(s.bodyMarkdown, ownerVars);
    if (contentContext) body = applyContextTokens(body, contentContext);
    // Section 9 master trust asset is regulator documentation — replace with patient-facing trust narrative.
    if (s.number === 9) {
      body = commercialTrustBodyForPublish(
        pharmacyName || contentContext?.profile.pharmacyName || "Our pharmacy",
        town || contentContext?.localArea || "your area",
      );
    }
    if (s.number === 12) body = dedupeTrustSectionBody(body);
    return { ...s, bodyMarkdown: body };
  });
}

export function renderMasterPublishedPage(input: MasterPublishInput): MasterPublishResult {
  const serviceMeta = getServicePublishMeta(input.serviceId);
  if (!serviceMeta) {
    throw new Error(`No master publish config for service: ${input.serviceId}`);
  }

  const ctx = input.contentContext;
  const md = ctx ? fs.readFileSync(ctx.masterLibrary.absolutePath, "utf8") : loadMasterLibraryFile(input.masterRelativePath);
  const parsed = ctx?.masterLibrary.parsed ?? parseMasterLibraryMarkdown(md, input.serviceId, input.serviceName);
  const ownerVars = ctx?.masterLibrary.ownerVariables ?? buildOwnerVariables(input.slug, serviceMeta);
  const trustProfile = ctx
    ? trustProfileFromData({ ...ctx.rawProfile, demoMode: ctx.demoMode, trustDataStatus: ctx.profile.trustDataStatus })
    : loadPharmacyTrustProfile(input.slug);
  const data = ctx?.rawProfile ?? (loadPharmacyProfile(input.slug)?.data || {});
  const fromContext = String(ctx?.profile.pharmacyName || "").trim();
  const pharmacyName =
    (fromContext && !isKeywordStuffedPharmacyListingName(fromContext) && fromContext) ||
    resolvePublicationPharmacyIdentity(data as PharmacyProfileData).pharmacyName ||
    String(data.tradingName || "").trim();
  if (!pharmacyName) throw new Error(`Master publish: pharmacyName required for ${input.slug}`);
  const town = String(ctx?.localArea || data.townCity || input.localArea);
  const phone = ownerVars.phone;
  const gphcNumber = String(data.gphcNumber || "");
  const website = String(data.website || "").replace(/\/$/, "");
  const canonicalUrl = `${website}${input.urlPath}`.replace(/([^:]\/)\/+/g, "$1");

  const bodySections = publishSections(parsed).sort((a, b) => a.number - b.number);
  const sectionOne = parsed.sections.find((s) => s.number === 1);

  const beforeText = [
    ...parsed.sections.filter((s) => s.publishDefault).map((s) => s.bodyMarkdown),
    ...parsed.faqs.map((f) => `${f.question} ${f.answer}`),
  ].join("\n");
  const wordCountBeforePublish = countWords(beforeText);

  const injectedSections = prepareSectionsForPublish(bodySections, ownerVars, ctx, pharmacyName, town);

  const stripInlineMarkdown = (text: string) =>
    text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");

  const injectedFaqs = parsed.faqs.map((f) => {
    let answer = stripInlineMarkdown(injectOwnerVariables(f.answer, ownerVars));
    if (ctx) answer = applyContextTokens(answer, ctx);
    let question = f.question;
    if (ctx) question = applyContextTokens(question, ctx);
    return { question, answer };
  });

  const localCtx: LocalLayerContext = {
    pharmacyName,
    town,
    phone,
    addressLine1: String(data.addressLine1 || ""),
    addressLine2: String(data.addressLine2 || ""),
    postcode: String(data.postcode || ""),
    coverageRadius: String(data.coverageRadius || ""),
    rankingAreas: (data.rankingAreas as string[]) || [town],
  };
  const localBodyText = serviceMeta.localBody(localCtx);

  const heroInput: HeroInput = {
    pharmacyName,
    town,
    h1: input.serviceName,
    intro: heroIntroFromSection(sectionOne),
    primaryCta: `Call ${phone}`,
    secondaryCta: "Check eligibility",
    variant: pickHeroVariant(input.serviceId),
    serviceName: input.serviceName,
    serviceId: input.serviceId,
    localAreas: localCtx.rankingAreas,
    phone,
    pills: heroPillsFromSection(sectionOne),
    publishMode: true,
  };

  const headingCtx = { pharmacyName, town, serviceName: input.serviceName };
  const heroHtml = renderHeroWithPills(heroInput, heroInput.pills);
  const earlySections = injectedSections.filter((s) => s.number <= 6);
  const lateSections = injectedSections.filter((s) => s.number >= 9);
  const bodyBlocksEarly = earlySections.map((s) =>
    renderMasterBodySection(
      s,
      renderMarkdownProse(s.bodyMarkdown),
      resolvePatientFacingServiceHeading(s.heading, headingCtx),
    ),
  );
  const bodyBlocksLate = lateSections.map((s) =>
    renderMasterBodySection(
      s,
      renderMarkdownProse(s.bodyMarkdown),
      resolvePatientFacingServiceHeading(s.heading, headingCtx),
    ),
  );
  const faqHtml = renderFaqAccordion(
    injectedFaqs,
    resolvePatientFacingServiceHeading("Frequently Asked Questions", headingCtx),
    true,
  );
  const trustHtml = renderPharmacyTrustLayerForSlug(input.slug);
  const localHtml = renderLocalRelevanceLayer(serviceMeta, localCtx);

  const bookingSection = injectedSections.find((s) => s.number === 13);
  const ctaHtml = renderCtaBlock({
    heading: resolvePatientFacingServiceHeading(
      serviceMeta.ctaHeading(pharmacyName),
      headingCtx,
    ),
    body: bookingSection
      ? bookingSection.bodyMarkdown.split("\n\n")[0]?.replace(/\*\*/g, "") || ""
      : `Call ${phone} to book.`,
    primary: `Call ${phone}`,
    secondary: "Speak To A Pharmacist",
    phone,
    email: String(data.businessEmail || data.email || ""),
    bookingUrl: String(data.bookingUrl || ""),
    publishMode: true,
    anchor: "contact",
    variant: inferCtaVariant("Speak To A Pharmacist"),
  });

  const mainBlocks = [heroHtml, ...bodyBlocksEarly, faqHtml, ...bodyBlocksLate, trustHtml, localHtml];
  const sectionsHtml = mainBlocks
    .map((html, i) => applySectionBand(html, sectionRhythmClass(i)))
    .join("\n");

  const pharmacySchema = enhanceTrustSchemaForSlug(input.slug, {});
  const schema = {
    "@context": "https://schema.org",
    "@graph": [pharmacySchema, buildFaqSchema(injectedFaqs)],
  };

  const metaDescription = serviceMeta.metaDescription(pharmacyName, town);

  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(input.serviceName)} ${esc(town)} | ${esc(pharmacyName)}</title>
<meta name="description" content="${esc(metaDescription)}"/>
<link rel="canonical" href="${esc(canonicalUrl)}"/>
${renderSchemaBlock(schema)}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet"/>
${componentStyles()}
${pharmacyTrustLayerStyles()}
<style>
.master-prose { font-size: 1.02rem; line-height: 1.75; color: var(--text); }
.master-prose p { margin: 0 0 1rem; }
.master-prose ul, .master-prose ol { margin: 0 0 1rem; padding-left: 1.35rem; }
.master-prose li { margin-bottom: .45rem; }
.master-prose h3 { font-size: 1.05rem; margin: 1.25rem 0 .5rem; color: var(--nhs-dark); }
.master-prose .table-wrap { overflow-x: auto; margin: 0 0 1rem; }
.master-prose table { width: 100%; border-collapse: collapse; font-size: .92rem; }
.master-prose th, .master-prose td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
.master-prose th { background: var(--soft-blue); }
</style>
</head>
<body data-publish-source="master-library">
${renderPreviewTopTrustBar({ pharmacyName, town, phone, gphcNumber, serviceName: input.serviceName })}
${renderPreviewSiteHeader({ pharmacyName, town, phone, gphcNumber, serviceName: input.serviceName, homeUrl: website || "/" })}
<main id="main-content">
${sectionsHtml}
${ctaHtml}
</main>
${renderPublishedFooter({ pharmacyName, town, phone, gphcNumber })}
</body>
</html>`;

  const afterText = [
    heroInput.intro,
    ...injectedSections.map((s) => s.bodyMarkdown),
    ...injectedFaqs.map((f) => `${f.question} ${f.answer}`),
    localBodyText,
    bookingSection?.bodyMarkdown || "",
  ].join("\n");
  const wordCountAfterPublish = countWords(afterText);

  const validation = buildValidation({
    parsed,
    injectedSections,
    injectedFaqs,
    trustProfile,
    localTown: town,
    localBodyText,
    masterFile: serviceMeta.masterFile,
    html,
    sectionOneBody: sectionOne?.bodyMarkdown || "",
    wordCountBeforePublish,
    wordCountAfterPublish,
  });

  return { html, outputPath: "", validation };
}

function buildValidation(input: {
  parsed: ParsedMasterLibrary;
  injectedSections: MasterLibrarySection[];
  injectedFaqs: Array<{ question: string; answer: string }>;
  trustProfile: ReturnType<typeof loadPharmacyTrustProfile>;
  localTown: string;
  localBodyText: string;
  masterFile: string;
  html: string;
  sectionOneBody: string;
  wordCountBeforePublish: number;
  wordCountAfterPublish: number;
}): MasterPublishValidation {
  const sections: MasterPublishValidation["sections"] = [
    { heading: "Hero", source: "Publish chrome — intro derived from master §1 opening paragraph" },
    ...input.injectedSections
      .filter((s) => s.number <= 6)
      .map((s) => ({
        heading: s.heading,
        source: `Master §${s.number} — ${input.masterFile}`,
      })),
    {
      heading: "Common Questions (FAQs)",
      source: `Master §7 — ${input.masterFile} (accordion)`,
    },
    ...input.injectedSections
      .filter((s) => s.number >= 9)
      .map((s) => ({
        heading: s.heading,
        source: `Master §${s.number} — ${input.masterFile}`,
      })),
    { heading: "Trust Layer", source: "pharmacyTrustLayer.ts — Brook Pharmacy profile (pharmaconnect.json)" },
    {
      heading: `Local Relevance — ${input.localTown}`,
      source: "Publish local layer — profile address, coverage areas, access copy only",
    },
    { heading: "Booking CTA", source: `Master §13 + owner variables — ${input.masterFile}` },
  ];

  const trustElements: string[] = [];
  const tp = input.trustProfile;
  if (tp) {
    if (tp.pharmacyName) trustElements.push(`Pharmacy name: ${tp.pharmacyName}`);
    if (tp.gphcNumber) trustElements.push(`GPhC premises: ${tp.gphcNumber}`);
    if (tp.superintendentPharmacistName) trustElements.push(`Superintendent: ${tp.superintendentPharmacistName}`);
    if (tp.phone) trustElements.push(`Contact: ${tp.phone}`);
    if (tp.consultationRoomAvailable) trustElements.push("Private consultation room");
    if (tp.rankingAreas?.length) trustElements.push(`Local coverage: ${tp.rankingAreas.slice(0, 4).join(", ")}`);
    if (tp.companyName) trustElements.push(`Company: ${tp.companyName}`);
  }

  const localElements = [
    `Town anchor: ${input.localTown}`,
    "Access-only copy — address, phone booking, coverage areas",
    "No service definition repeated from master §1",
  ];

  const qualityDegradation: string[] = [];
  const duplicationNotes: string[] = [];

  if (input.injectedSections.some((s) => /\{\{[a-z_]+\}\}/.test(s.bodyMarkdown))) {
    qualityDegradation.push("Unresolved owner variable placeholders remain in body copy.");
  }

  const wordDelta = input.wordCountAfterPublish - input.wordCountBeforePublish;
  if (wordDelta > 450) {
    qualityDegradation.push(
      `Published prose exceeds master by ${wordDelta} words — review local layer length.`,
    );
  }

  const trustSection = input.injectedSections.find((s) => s.number === 12);
  const trustDuplication = trustSection ? detectTrustLayerDuplication(trustSection.bodyMarkdown) : false;
  if (trustDuplication) {
    duplicationNotes.push("§12 Trust And Safety still mentions GPhC after publish dedupe.");
  }

  const localDuplication = detectLocalLayerDuplication(input.sectionOneBody, input.localBodyText);
  if (localDuplication) {
    duplicationNotes.push("Local layer repeats opening service definition from master §1.");
  }

  if (detectBlueprintLeakage(input.html)) {
    qualityDegradation.push("Blueprint generator markers detected in published HTML.");
    duplicationNotes.push("Legacy blueprint component markers found in HTML.");
  }

  const duplicationIntroduced = trustDuplication || localDuplication || detectBlueprintLeakage(input.html);

  const publishQuality: "PASS" | "FAIL" =
    qualityDegradation.length === 0 && !duplicationIntroduced ? "PASS" : "FAIL";

  const qualityAssessment =
    publishQuality === "PASS"
      ? "PASS — Master clinical prose preserved with profile injection only. Trust and local layers add accountability and access context without duplicating master content."
      : duplicationIntroduced && qualityDegradation.length === 0
        ? "FAIL — Duplication detected; see duplication notes."
        : "FAIL — See degradation and duplication notes before publishing.";

  return {
    sourceMaster: input.masterFile,
    sections,
    trustElements,
    localElements,
    wordCountBeforePublish: input.wordCountBeforePublish,
    wordCountAfterPublish: input.wordCountAfterPublish,
    qualityAssessment,
    qualityDegradation,
    duplicationIntroduced,
    duplicationNotes,
    publishQuality,
  };
}

export function writeMasterPublishPage(input: MasterPublishInput, outputRelativeDir: string): MasterPublishResult {
  const result = renderMasterPublishedPage(input);
  const outDir = path.join(MASTER_PUBLISH_ROOT, input.slug, outputRelativeDir);
  fs.mkdirSync(outDir, { recursive: true });
  const outputPath = path.join(outDir, "index.html");
  fs.writeFileSync(outputPath, result.html, "utf8");
  return { ...result, outputPath };
}

export function writeCanonicalMasterPublishPage(input: MasterPublishInput): MasterPublishResult {
  const result = writeMasterPublishPage(input, input.serviceId);
  const canonicalDir = path.join(CANONICAL_PUBLISH_ROOT, input.slug, input.serviceId);
  fs.mkdirSync(canonicalDir, { recursive: true });
  fs.copyFileSync(result.outputPath, path.join(canonicalDir, "index.html"));
  return result;
}
