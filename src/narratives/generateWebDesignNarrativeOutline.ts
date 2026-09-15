import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildWebDesignNarrativePackage } from "./buildWebDesignNarrativePackage";

function formatList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildHeroHeadline(area: string, profile: string): string {
  const profileHeadlines: Record<string, string> = {
    growth_business: `Web Design in ${area} Built to Generate Better Enquiries`,
    established_company: `Web Design in ${area} for Established Businesses`,
    professional_services: `Professional Web Design in ${area} That Builds Trust`,
    local_trades: `Web Design in ${area} for Local Trades and Service Businesses`,
    premium_brand: `Premium Web Design in ${area} for Brands That Need to Stand Apart`,
  };

  return profileHeadlines[profile] ?? `Web Design in ${area} Built Around Your Business Goals`;
}

function buildHeroParagraph(
  area: string,
  coreMessage: string,
  messagingAngle: string,
  whyInvest: string,
): string {
  return `${coreMessage} For businesses in ${area}, the page should lead with a clear local promise: ${messagingAngle} ${whyInvest}`;
}

export function generateWebDesignNarrativeOutline(area: string, city?: string): string {
  const narrativePackage = buildWebDesignNarrativePackage(area, city);
  const { selected, narrativeProfileData } = narrativePackage;

  return [
    "# PAGE OUTLINE",
    "",
    `Area: ${narrativePackage.area}`,
    `City: ${narrativePackage.city}`,
    `Profile: ${narrativePackage.profile}`,
    `Narrative Key: ${narrativePackage.narrativeKey}`,
    "",
    "# HERO MESSAGE",
    "",
    `Headline: ${buildHeroHeadline(narrativePackage.area, narrativePackage.profile)}`,
    "",
    "Supporting Paragraph:",
    buildHeroParagraph(
      narrativePackage.area,
      narrativePackage.coreMessage,
      narrativeProfileData.messaging_angle,
      selected.whyInvest,
    ),
    "",
    `CTA Text: ${selected.cta}`,
    "",
    "# WHY INVEST",
    "",
    selected.whyInvest,
    "",
    "# COMMON PROBLEMS",
    "",
    formatList(selected.problems),
    "",
    "# WHAT HAPPENS IF NOTHING CHANGES",
    "",
    selected.doNothing,
    "",
    "# EXPECTED OUTCOMES",
    "",
    formatList(selected.outcomes),
    "",
    "# COMMON MISTAKES",
    "",
    formatList(selected.mistakes),
    "",
    "# FAQS",
    "",
    formatList(selected.faqs),
    "",
    "# CTA",
    "",
    selected.cta,
  ].join("\n");
}

function isCliRun(): boolean {
  const invoked = process.argv[1] ? path.basename(process.argv[1]) : "";
  return /^generateWebDesignNarrativeOutline\.[cm]?[jt]s$/.test(invoked) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isCliRun()) {
  const [, , areaArg, cityArg] = process.argv;

  if (!areaArg) {
    console.error("Usage: pnpm exec tsx src/narratives/generateWebDesignNarrativeOutline.ts \"Dore\" \"Sheffield\"");
    process.exit(1);
  }

  console.log(generateWebDesignNarrativeOutline(areaArg, cityArg));
}
