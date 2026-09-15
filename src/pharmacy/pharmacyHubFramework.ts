/**
 * Pharmacy Service Hub Publish Framework V1 —
 * Hubs connect service overview to local area pages without duplicating full service content.
 */
import type { GeneratedServicePage, ServicePageFaq, ServicePageSection } from "./pharmacyServicePageGenerator.ts";
import { ensureCompleteSentence, publishMetaDescription, stripBlueprintLabels } from "./pharmacySafeText.ts";

export const HUB_FRAMEWORK_SECTION_TYPES = [
  "serviceOverview",
  "localGuide",
  "coverageAreas",
  "relatedServices",
] as const;

export interface HubFrameworkContext {
  serviceId: string;
  serviceName: string;
  pharmacyName: string;
  town: string;
}

export interface HubFrameworkInput extends HubFrameworkContext {
  servicePage: GeneratedServicePage;
  areaNames: string[];
}

export function usesHubPublishFramework(_serviceId?: string): boolean {
  return true;
}

function toCard(heading: string, body: string): string {
  const h = heading.replace(/[.:]+$/, "").trim();
  let b = stripBlueprintLabels(body).trim();
  if (!b.endsWith(".")) b += ".";
  return `${h}: ${b}`;
}

export function buildHubFrameworkSections(input: HubFrameworkInput): ServicePageSection[] {
  const { servicePage, pharmacyName, town, serviceName, areaNames } = input;
  const masterProblem = servicePage.sections.find((s) => s.type === "problem");
  const overviewBody = ensureCompleteSentence(
    `${stripBlueprintLabels(servicePage.intro).trim()} This hub helps you choose the right local ${serviceName.toLowerCase()} page for your neighbourhood in ${town}.`,
  );

  const areaList =
    areaNames.length >= 3
      ? `${areaNames.slice(0, 3).join(", ")} and surrounding neighbourhoods`
      : areaNames.join(", ") || town;

  const localGuideBullets = [
    toCard(
      "Start with your area",
      areaNames.length
        ? `Select the ${serviceName.toLowerCase()} page for where you live or work — ${areaList} each have dedicated guidance.`
        : `Contact ${pharmacyName} to confirm which local page matches your neighbourhood in ${town}.`,
    ),
    toCard(
      "Same clinical standards",
      `Every local page reflects the same ${serviceName.toLowerCase()} pathway at ${pharmacyName} — area pages add access and booking context, not different clinical rules.`,
    ),
    toCard(
      "Read the main service page",
      `Visit the central ${serviceName.toLowerCase()} page for full eligibility, preparation and FAQs before you book.`,
    ),
    toCard(
      "Need help choosing?",
      `Call ${pharmacyName} if you are unsure which area page fits — the team confirms availability and appointment options for ${town} patients.`,
    ),
  ];

  return [
    {
      type: "serviceOverview",
      heading: masterProblem?.heading || `${serviceName} at ${pharmacyName}`,
      body: overviewBody,
      bullets: (masterProblem?.bullets || []).slice(0, 2),
    },
    {
      type: "localGuide",
      heading: "How To Choose Your Local Page",
      body: `${pharmacyName} publishes area-specific ${serviceName.toLowerCase()} pages so patients in ${town} see guidance relevant to where they are coming from.`,
      bullets: localGuideBullets,
    },
    {
      type: "coverageAreas",
      heading: `Local ${serviceName} Pages`,
      body: ensureCompleteSentence(
        areaNames.length
          ? `Dedicated ${serviceName.toLowerCase()} pages are available for patients in ${areaNames.join(", ")}. Select your area below for locally focused information and booking guidance.`
          : `${pharmacyName} is expanding local ${serviceName.toLowerCase()} pages across ${town}.`,
      ),
      bullets: areaNames.map((a) => `${serviceName} ${a}`),
    },
  ];
}

export function buildHubFrameworkFaqs(input: HubFrameworkInput): ServicePageFaq[] {
  const { servicePage, pharmacyName, town, serviceName, areaNames } = input;
  const hubSpecific: ServicePageFaq[] = [
    {
      question: `Which local ${serviceName.toLowerCase()} page should I use?`,
      answer: areaNames.length
        ? `Choose the page named for your neighbourhood${areaNames.length ? ` — for example ${areaNames.slice(0, 3).join(", ")}` : ""}. Each area page explains access from that location while following the same ${serviceName.toLowerCase()} standards at ${pharmacyName}.`
        : `Contact ${pharmacyName} in ${town} — the team directs you to the correct local page for your address.`,
    },
    {
      question: `Is ${serviceName} the same in every area?`,
      answer: `Yes — clinical eligibility and the consultation pathway are the same at ${pharmacyName}. Area pages focus on local access, travel and booking from your neighbourhood in ${town}.`,
    },
  ];

  const fromMaster = servicePage.faqs.slice(0, 6);
  const seen = new Set<string>();
  const out: ServicePageFaq[] = [];
  for (const f of [...hubSpecific, ...fromMaster]) {
    const k = f.question.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
    if (out.length >= 8) break;
  }
  return out;
}

export function applyHubFramework(input: HubFrameworkInput): {
  intro: string;
  metaDescription: string;
  sections: ServicePageSection[];
  faqs: ServicePageFaq[];
} {
  const { servicePage, pharmacyName, town, serviceName, areaNames } = input;
  const intro = ensureCompleteSentence(
    `${pharmacyName} in ${town} provides ${serviceName.toLowerCase()} for patients across the local community. ` +
      `This hub connects you to area-specific pages${areaNames.length ? ` for ${areaNames.slice(0, 4).join(", ")}${areaNames.length > 4 ? " and more" : ""}` : ""} and central service information.`,
  );
  const metaDescription = publishMetaDescription(
    `${serviceName} hub for ${town} — compare local area pages, eligibility and booking at ${pharmacyName}.`,
  );

  return {
    intro,
    metaDescription,
    sections: buildHubFrameworkSections(input),
    faqs: buildHubFrameworkFaqs(input),
  };
}
