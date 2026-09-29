/**
 * Direct approved-bank locality rendering for registered services.
 * Final visible copy may come only from the current approved bank, confirmed
 * tenant profile, stored verified locality intelligence, the current campaign
 * locality, and the shared layout renderer.
 */
import {
  bindCurrentRegisteredApprovedBank,
  selectRegisteredApprovedBank,
} from "./pharmacyApprovedBankRunProvenance.ts";
import { buildApprovedBankLocalityPageContract } from "./pharmacyApprovedBankCorePageContract.ts";
import { bindVerifiedLocalityEvidenceV1 } from "./contentEngine/pharmacyVerifiedLocalityEvidenceV1.ts";
import {
  buildLocalityEvidenceInventory,
  buildUniqueLocalityNarrative,
  siblingFactsFromCampaignContext,
  type LocalitySiblingFact,
} from "./contentEngine/pharmacyLocalityUniqueNarrativeV1.ts";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import { isApprovedBankRegisteredService } from "./pharmacyServiceVariantLibrary.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import type {
  LocalClusterContentInput,
  LocalClusterPageContent,
} from "./pharmacyLocalClusterContentEngine.ts";
import {
  selectVerifiedLocalEvidenceForPatientCopy,
  verifiedLocalEvidencePatientCopySentence,
  type VerifiedLocalEvidenceFact,
} from "./contentEngine/pharmacyVerifiedLocalEvidenceConsumptionContract.ts";

export const APPROVED_BANK_LOCALITY_DIRECT_NARRATIVE = "approved-bank-locality-direct";

export function usesApprovedBankLocalityDirectPath(serviceId: string): boolean {
  return isApprovedBankRegisteredService(serviceId);
}

function namedLocalFacts(
  verified: ReturnType<typeof bindVerifiedLocalityEvidenceV1> | null,
): string[] {
  if (!verified) return [];
  const facts: VerifiedLocalEvidenceFact[] = [
    ...verified.healthcare.map((fact) => ({ name: fact.name, category: "healthcare" as const })),
    ...verified.transport.map((fact) => ({ name: fact.name, category: "transport" as const })),
    ...verified.landmarks.map((fact) => ({ name: fact.name, category: "landmarks" as const })),
    ...verified.community.map((fact) => ({ name: fact.name, category: "community" as const })),
    ...verified.schools.map((fact) => ({ name: fact.name, category: "schools" as const })),
    ...verified.retail.map((fact) => ({ name: fact.name, category: "retail" as const })),
  ];
  return selectVerifiedLocalEvidenceForPatientCopy(facts).selected.map((fact) => fact.name);
}

function composeLocalAccessBody(
  uniqueAccessBody: string,
  areaName: string,
  verified: ReturnType<typeof bindVerifiedLocalityEvidenceV1> | null,
): string {
  const parts: string[] = [];
  const travel = String(uniqueAccessBody || "").trim();
  if (travel) parts.push(travel);
  const relationship = String(verified?.relationship || "").trim();
  if (
    relationship &&
    !/local guidance for/i.test(relationship) &&
    !/\b\d+(?:\.\d+)?\s*km\b/i.test(relationship)
  ) {
    parts.push(relationship.replace(/[.]+$/, "") + ".");
  }
  const direction = String(verified?.cardinalDirection || "").trim();
  if (direction && areaName) {
    parts.push(`The confirmed pharmacy location is ${direction} of ${areaName}.`);
  }
  const evidenceSentence = verifiedLocalEvidencePatientCopySentence(namedLocalFacts(verified));
  if (evidenceSentence) parts.push(evidenceSentence);
  parts.push("The pharmacy address, telephone number and map are shown below.");
  return parts.filter(Boolean).join(" ");
}

function weaveLocalityOnce(text: string, areaName: string): string {
  const body = String(text || "").trim();
  const area = String(areaName || "").trim();
  if (!body || !area) return body;
  const areaRe = new RegExp(`\\b${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (areaRe.test(body)) return body;
  return body.replace(/\byour area\b/gi, area);
}

function wordCount(content: LocalClusterPageContent): number {
  return [
    content.heroIntro,
    content.whyChecksBody,
    content.localRelevanceIntro,
    content.localRelevanceBody,
    content.processIntro,
    ...content.processSteps.map((s) => `${s.title} ${s.body} ${(s.bullets || []).join(" ")}`),
    content.clinicalEnvironmentBody,
    content.trustBody,
    ...content.faqs.map((f) => `${f.question} ${f.answer}`),
    content.accessBody,
  ]
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function serviceHubPublicPath(serviceId: string): string {
  const id = String(serviceId || "").trim();
  return id ? `/${id}/` : "/";
}

function escHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared full-service hub CTA for registered approved-service locality pages. */
export function renderApprovedBankServiceHubCtaHtml(
  serviceName: string,
  serviceId: string,
  conversionImageHtml: string,
): string {
  const service = escHtml(serviceName);
  const href = escHtml(serviceHubPublicPath(serviceId));
  return `<section class="section-band conversion-image-section" data-template-block="conversion-image">
<div class="wrap">${conversionImageHtml}</div>
</section>
<section id="contact" class="cta-band" data-template-block="final-cta" data-service-hub-cta="${escHtml(serviceId)}">
<div class="wrap">
<h2>Find out more about ${service}</h2>
<p class="cta-close">The full ${service} page contains more detailed information about this service. Open it if you want a fuller explanation before you get in touch.</p>
<div class="cta-actions">
<a class="btn-white" href="${href}">View full ${service} information</a>
</div>
</div>
</section>`;
}

/** Distinct preparation / accurate-reading section for approved-bank locality pages. */
export function renderApprovedBankLocalityPreparationHtml(input: {
  heading: string;
  body: string;
  bullets?: string[];
}): string {
  const heading = escHtml(String(input.heading || "").trim() || "Getting an accurate reading");
  const paragraphs = String(input.body || "")
    .trim()
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  const sentences = paragraphs.length
    ? paragraphs
    : String(input.body || "")
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
  const chunks: string[] = [];
  if (paragraphs.length > 1) {
    chunks.push(...paragraphs);
  } else {
    for (let i = 0; i < sentences.length; i += 2) {
      chunks.push(sentences.slice(i, i + 2).join(" "));
    }
  }
  const prose = chunks.map((p) => `<p>${escHtml(p)}</p>`).join("\n");
  const bullets = (input.bullets || []).map((b) => String(b).trim()).filter(Boolean);
  const list = bullets.length
    ? `<ul class="clean">${bullets.map((b) => `<li>${escHtml(b)}</li>`).join("")}</ul>`
    : "";
  if (!prose && !list) return "";
  return `<section class="soft" id="cluster-consultation" data-template-block="consultation" data-locality-evidence="approved-bank-preparation">
<div class="wrap">
<div class="section-head center"><h2>${heading}</h2></div>
${prose}
${list}
</div>
</section>`;
}

export function composeApprovedBankLocalityDirectDraft(
  input: LocalClusterContentInput,
  ctxInput?: ContentGenerationContext,
): LocalClusterPageContent {
  if (!isApprovedBankRegisteredService(input.serviceId)) {
    throw new Error(`Direct approved-bank locality compose requires a registered service: ${input.serviceId}`);
  }
  const ctx = ctxInput ? bindCurrentRegisteredApprovedBank(ctxInput) : undefined;
  const selected = selectRegisteredApprovedBank(input.serviceId);
  const pack = selected.pack;
  if (!pack || pack.serviceId !== input.serviceId || !selected.hash) {
    throw new Error(`Current registered approved bank missing for locality compose: ${input.serviceId}`);
  }

  const key = resolveTenantProfileSlug(input.slug) || input.slug;
  const profile = ctx?.profile ?? buildPharmacyServicePageProfile(key);
  const pharmacyName = profile.pharmacyName;
  const contract = buildApprovedBankLocalityPageContract(pack, input.areaSlug, input.areaSlugsInCluster);

  const verified = ctx
    ? bindVerifiedLocalityEvidenceV1({
        ctx,
        areaName: input.areaName,
        areaSlug: input.areaSlug,
        siblingLocalities: (input.siblingLocalities?.length
          ? input.siblingLocalities
          : input.nearbyAreaNames.map((name, i) => ({
              areaName: name,
              areaSlug: input.areaSlugsInCluster[i] || name.toLowerCase(),
            }))
        ).concat(
          input.siblingLocalities?.some((s) => s.areaSlug === input.areaSlug)
            ? []
            : [{ areaName: input.areaName, areaSlug: input.areaSlug, ...input.localityRecord }],
        ),
        localityRecord: input.localityRecord,
      })
    : null;

  const selectedSiblings: LocalitySiblingFact[] = siblingFactsFromCampaignContext(ctx);
  const selfArea = selectedSiblings.find((s) => s.areaSlug === input.areaSlug);
  const uniqueInventory = buildLocalityEvidenceInventory({
    areaName: input.areaName,
    areaSlug: input.areaSlug,
    pharmacyName,
    pharmacyAddress: profile.fullAddress || profile.customerFacingAddress || "",
    serviceName: input.serviceName,
    displayPhone: profile.displayPhone || profile.phone,
    verified,
    selectedSiblings: selectedSiblings.length
      ? selectedSiblings
      : [
          {
            areaName: input.areaName,
            areaSlug: input.areaSlug,
            distanceKm: verified?.distanceKm ?? null,
            distanceLabel: verified?.distanceLabel || "",
          },
          ...(verified?.nearbyLocalities || []).map((n) => ({
            areaName: n.areaName,
            areaSlug: n.areaSlug,
            distanceKm: n.distanceKm,
            distanceLabel: "",
          })),
        ],
    areaType: selfArea?.areaType,
    order: selfArea?.order,
  });
  const uniqueNarrative = buildUniqueLocalityNarrative(uniqueInventory);

  const whyChecksBody = weaveLocalityOnce(contract.explanationBody, input.areaName);
  const considerBody = weaveLocalityOnce(contract.considerBody, input.areaName);
  const scopeBody = weaveLocalityOnce(contract.scopeBody, input.areaName);
  const processIntro = weaveLocalityOnce(contract.processBody, input.areaName);
  const processSteps = contract.processSteps.map((step) => ({
    title: step.title,
    body: weaveLocalityOnce(step.body, input.areaName),
    bullets: (step.bullets || []).map((b) => String(b).trim()).filter(Boolean),
  }));
  const preparationBody = weaveLocalityOnce(contract.preparationBody, input.areaName);
  const safetyBody = weaveLocalityOnce(contract.safetyBody, input.areaName);
  const faqs = contract.faqs.slice(0, 6).map((faq) => ({
    question: String(faq.question || "").trim(),
    answer: weaveLocalityOnce(faq.answer, input.areaName),
  }));

  const supportingItems = processSteps.map((step) => ({
    title: step.title,
    body: step.body,
    evidence: "approved-bank-process",
    bullets: step.bullets,
  }));

  const splitPrepAndSafety = Boolean(preparationBody && safetyBody);
  const trustHeading = splitPrepAndSafety
    ? input.serviceId === "blood-pressure-checks"
      ? contract.safetyHeading || "Results and safety"
      : `Preparing and staying safe with ${input.serviceName}`
    : contract.safetyHeading || `Preparing and staying safe with ${input.serviceName}`;

  const content: LocalClusterPageContent = {
    heroIntro: uniqueNarrative.heroIntro,
    localRelevanceHeading: contract.considerHeading,
    localRelevanceIntro: "",
    localRelevanceBody: [considerBody, scopeBody].filter(Boolean).join("\n\n"),
    localRelevanceBullets: [...contract.considerBullets, ...contract.scopeBullets]
      .map((b) => String(b).trim())
      .filter(Boolean)
      .filter((b, i, arr) => arr.indexOf(b) === i)
      .slice(0, 8),
    whyChecksHeading: contract.explanationHeading,
    whyChecksBody,
    whyChecksBullets: (contract.explanationBullets || []).map((b) => String(b).trim()).filter(Boolean),
    processHeading: contract.processHeading,
    processIntro,
    processSteps,
    accessHeading: uniqueNarrative.accessHeading,
    accessBody: composeLocalAccessBody(uniqueNarrative.accessBody, input.areaName, verified),
    clinicalEnvironmentHeading: contract.preparationHeading,
    clinicalEnvironmentBody: preparationBody,
    preparationBullets: contract.preparationBullets.map((b) => String(b).trim()).filter(Boolean),
    eligibilityHeading: contract.scopeHeading,
    eligibilityBody: scopeBody,
    eligibilityBullets: contract.scopeBullets.map((b) => String(b).trim()).filter(Boolean),
    trustHeading,
    trustBullets: contract.safetyBullets.map((b) => String(b).trim()).filter(Boolean),
    trustBody: safetyBody,
    faqs,
    ctaPrimary: "Contact the pharmacy",
    ctaSecondary: "Get directions",
    ctaPhonePrompt: uniqueNarrative.confirmBody,
    contentFingerprint: `${input.areaSlug}::${input.serviceId}::${APPROVED_BANK_LOCALITY_DIRECT_NARRATIVE}::${selected.hash}`,
    localIntelligenceUsed: true,
    narrativeType: `${APPROVED_BANK_LOCALITY_DIRECT_NARRATIVE}:${input.serviceId}`,
    wordCountEstimate: 0,
    seoTitle: uniqueNarrative.seoTitle,
    metaDescription: uniqueNarrative.metaDescription,
    supportingHeading: contract.processHeading,
    supportingIntro: processIntro,
    supportingItems,
    nearbyLocalityLinks: verified?.nearbyLocalities || [],
    sectionEvidence: verified?.sectionEvidence,
    evidenceLimited: verified?.evidenceLimited,
  };
  content.wordCountEstimate = wordCount(content);
  return content;
}
