import type { NarrativeEngineConfig } from "../generator/types";
import type { ClusterPageContent } from "../generator/generateClusterContent";
import { buildWebDesignNarrativePackage } from "./buildWebDesignNarrativePackage";

export interface WebDesignNarrativeOverrides {
  heroHeading?: string;
  heroIntro?: string;
  ctaHeading?: string;
  ctaBody?: string;
  ctaPrimaryText?: string;
  profile?: string;
  narrativeKey?: string;
  audience?: string;
  painPoints?: string[];
  doNothing?: string;
  faqs?: string[];
}

export type NarrativeClusterPageContent = ClusterPageContent & {
  narrativeOverrides?: WebDesignNarrativeOverrides;
};

interface ApplyWebDesignNarrativeOptions {
  content: ClusterPageContent;
  area: string;
  city?: string;
  serviceName: string;
  narrativeEngine?: NarrativeEngineConfig;
}

function normalise(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
}

function shouldApplyNarrative(options: ApplyWebDesignNarrativeOptions): boolean {
  const config = options.narrativeEngine;

  if (!config?.enabled) {
    return false;
  }

  const serviceName = normalise(options.serviceName);
  if (serviceName !== "web-design") {
    return false;
  }

  const serviceEnabled = (config.serviceKeys ?? []).some((serviceKey) => normalise(serviceKey) === serviceName);

  if (!serviceEnabled) {
    return false;
  }

  if (!config.areas?.length) {
    return true;
  }

  const areaName = normalise(options.area);
  return config.areas.some((area) => normalise(area) === areaName);
}

function heroHeadline(area: string, profile: string): string {
  const headlines: Record<string, string> = {
    growth_business: `Web Design in ${area} Built to Generate Better Enquiries`,
    established_company: `Web Design in ${area} for Established Businesses`,
    professional_services: `Professional Web Design in ${area} That Builds Trust`,
    local_trades: `Web Design in ${area} for Local Trades and Service Businesses`,
    premium_brand: `Premium Web Design in ${area} for Brands That Need to Stand Apart`,
  };

  return headlines[profile] ?? `Web Design in ${area} Built Around Your Business Goals`;
}

function paragraphFromList(items: string[]): string {
  return items.map((item) => `${item}.`).join("\n\n");
}

function answerFaq(question: string, area: string, narrativeKey: string): string {
  return `${question.replace(/\?$/, "")} depends on how clearly the website supports the customer's decision. For businesses in ${area}, the ${narrativeKey} narrative focuses the page on the evidence, message and next step visitors need before making contact.`;
}

export function applyWebDesignNarrativePackage(
  options: ApplyWebDesignNarrativeOptions,
): NarrativeClusterPageContent {
  if (!shouldApplyNarrative(options)) {
    return options.content;
  }

  const narrativePackage = buildWebDesignNarrativePackage(options.area, options.city);
  const { selected, narrativeProfileData } = narrativePackage;
  const heroIntro = `${narrativePackage.coreMessage} For businesses in ${narrativePackage.area}, the page should lead with a clear local promise: ${narrativeProfileData.messaging_angle} ${selected.whyInvest}`;

  return {
    ...options.content,
    heroIntro,
    split1: {
      heading: `Why ${narrativePackage.area} Businesses Should Invest in Better Web Design`,
      body: selected.whyInvest,
    },
    split2: {
      heading: `Common Website Problems for ${narrativePackage.area} Businesses`,
      body: paragraphFromList(selected.problems),
    },
    noWebsiteSection: {
      heading: "What Happens If Nothing Changes?",
      body: selected.doNothing,
    },
    cta: {
      heading: selected.cta,
      body: `${narrativePackage.coreMessage} ${narrativeProfileData.conversion_focus}`,
    },
    enquirySection: {
      heading: `Expected Outcomes from Better Web Design in ${narrativePackage.area}`,
      body: paragraphFromList(selected.outcomes),
    },
    commonMistakes: {
      items: selected.mistakes.map((mistake) => ({
        mistake,
        impact: `This weakens the ${narrativePackage.narrativeKey} message and makes it harder for visitors to choose the business with confidence.`,
      })),
    },
    faq: selected.faqs.map((question) => ({
      question,
      answer: answerFaq(question, narrativePackage.area, narrativePackage.narrativeKey),
    })),
    narrativeOverrides: {
      heroHeading: heroHeadline(narrativePackage.area, narrativePackage.profile),
      heroIntro,
      ctaHeading: selected.cta,
      ctaBody: `${narrativePackage.coreMessage} ${narrativeProfileData.conversion_focus}`,
      profile: narrativePackage.profile,
      narrativeKey: narrativePackage.narrativeKey,
      audience: narrativeProfileData.audience,
      painPoints: narrativeProfileData.pain_points,
      doNothing: selected.doNothing,
      faqs: selected.faqs,
    },
  };
}
