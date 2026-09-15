import type { NarrativeEngineConfig } from "../generator/types";
import type { ClusterPageContent } from "../generator/generateClusterContent";
import { buildLocalSeoNarrativePackage } from "./buildLocalSeoNarrativePackage";

export interface LocalSeoNarrativeOverrides {
  heroHeading?: string;
  heroIntro?: string;
  ctaHeading?: string;
  ctaBody?: string;
  profile?: string;
  narrativeKey?: string;
  audience?: string;
  trustDrivers?: string[];
  conversionFocus?: string;
  doNothing?: string;
  faqs?: string[];
}

export type LocalSeoNarrativeClusterPageContent = ClusterPageContent & {
  localSeoNarrativeOverrides?: LocalSeoNarrativeOverrides;
};

interface ApplyLocalSeoNarrativeOptions {
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

function shouldApplyNarrative(options: ApplyLocalSeoNarrativeOptions): boolean {
  const config = options.narrativeEngine;

  if (!config?.enabled) {
    return false;
  }

  const serviceName = normalise(options.serviceName);
  if (serviceName !== "local-seo") {
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

function paragraphFromList(items: string[]): string {
  return items.map((item) => `${item}.`).join("\n\n");
}

function answerFaq(question: string, area: string, narrativeKey: string): string {
  return `${question.replace(/\?$/, "")} depends on what the business needs Local SEO to achieve. For businesses in ${area}, the ${narrativeKey} narrative shapes the page around the search signals, proof and next steps most relevant to that goal.`;
}

export function applyLocalSeoNarrativePackage(
  options: ApplyLocalSeoNarrativeOptions,
): LocalSeoNarrativeClusterPageContent {
  if (!shouldApplyNarrative(options)) {
    return options.content;
  }

  const narrativePackage = buildLocalSeoNarrativePackage(options.area, options.city);
  const { selected, narrativeProfileData } = narrativePackage;
  const heroIntro = `${narrativePackage.coreMessage} For businesses in ${narrativePackage.area}, this page should speak to ${narrativeProfileData.audience} ${selected.whyInvest}`;
  const ctaBody = `${narrativePackage.coreMessage} ${narrativeProfileData.conversionFocus}`;

  return {
    ...options.content,
    heroIntro,
    split1: {
      heading: `Why ${narrativePackage.area} Businesses Should Invest in Local SEO`,
      body: selected.whyInvest,
    },
    split2: {
      heading: `Common Local SEO Problems for ${narrativePackage.area} Businesses`,
      body: paragraphFromList(selected.problems),
    },
    noWebsiteSection: {
      heading: "What Happens If Nothing Changes?",
      body: selected.doNothing,
    },
    enquirySection: {
      heading: `Expected Outcomes from Local SEO in ${narrativePackage.area}`,
      body: paragraphFromList(selected.outcomes),
    },
    commonMistakes: {
      items: selected.mistakes.map((mistake) => ({
        mistake,
        impact: `This weakens the ${narrativePackage.narrativeKey} focus and makes it harder for local searchers to understand why this business is the right fit.`,
      })),
    },
    faq: selected.faqs.map((question) => ({
      question,
      answer: answerFaq(question, narrativePackage.area, narrativePackage.narrativeKey),
    })),
    cta: {
      heading: selected.cta,
      body: ctaBody,
    },
    localSeoNarrativeOverrides: {
      heroHeading: selected.hero,
      heroIntro,
      ctaHeading: selected.cta,
      ctaBody,
      profile: narrativePackage.profile,
      narrativeKey: narrativePackage.narrativeKey,
      audience: narrativeProfileData.audience,
      trustDrivers: narrativeProfileData.trustDrivers,
      conversionFocus: narrativeProfileData.conversionFocus,
      doNothing: selected.doNothing,
      faqs: selected.faqs,
    },
  };
}
