import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildLocalSeoNarrativePackage } from "./buildLocalSeoNarrativePackage";

function formatList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildHeroParagraph(
  area: string,
  coreMessage: string,
  whyInvest: string,
): string {
  return `${coreMessage} For businesses in ${area}, the page should connect local visibility with a clear commercial outcome: ${whyInvest}`;
}

export function generateLocalSeoNarrativeOutline(area: string, city?: string): string {
  const narrativePackage = buildLocalSeoNarrativePackage(area, city);
  const { selected } = narrativePackage;

  return [
    "# LOCAL SEO PAGE OUTLINE",
    "",
    `Area: ${narrativePackage.area}`,
    `City: ${narrativePackage.city}`,
    `Profile: ${narrativePackage.profile}`,
    `Narrative Key: ${narrativePackage.narrativeKey}`,
    "",
    "# HERO MESSAGE",
    "",
    `Headline: ${selected.hero}`,
    "",
    "Supporting Paragraph:",
    buildHeroParagraph(
      narrativePackage.area,
      narrativePackage.coreMessage,
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
  return /^generateLocalSeoNarrativeOutline\.[cm]?[jt]s$/.test(invoked) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isCliRun()) {
  const [, , areaArg, cityArg] = process.argv;

  if (!areaArg) {
    console.error("Usage: pnpm exec tsx src/narratives/generateLocalSeoNarrativeOutline.ts \"Rotherham\" \"Rotherham\"");
    process.exit(1);
  }

  console.log(generateLocalSeoNarrativeOutline(areaArg, cityArg));
}
