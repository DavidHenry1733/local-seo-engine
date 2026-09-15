import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildWebDesignNarrativePackage } from "./buildWebDesignNarrativePackage";

function formatList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function previewWebDesignNarrativePage(area: string, city?: string): string {
  const narrativePackage = buildWebDesignNarrativePackage(area, city);
  const { selected } = narrativePackage;

  return [
    "WEB DESIGN NARRATIVE PREVIEW",
    "",
    `Area: ${narrativePackage.area}`,
    `City: ${narrativePackage.city}`,
    `Profile: ${narrativePackage.profile}`,
    `Narrative Key: ${narrativePackage.narrativeKey}`,
    "",
    "Core Message:",
    narrativePackage.coreMessage,
    "",
    "Why Invest:",
    selected.whyInvest,
    "",
    "Problems:",
    formatList(selected.problems),
    "",
    "Do Nothing:",
    selected.doNothing,
    "",
    "Outcomes:",
    formatList(selected.outcomes),
    "",
    "Mistakes:",
    formatList(selected.mistakes),
    "",
    "FAQs:",
    formatList(selected.faqs),
    "",
    "CTA:",
    selected.cta,
  ].join("\n");
}

function isCliRun(): boolean {
  const invoked = process.argv[1] ? path.basename(process.argv[1]) : "";
  return /^previewWebDesignNarrativePage\.[cm]?[jt]s$/.test(invoked) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isCliRun()) {
  const [, , areaArg, cityArg] = process.argv;

  if (!areaArg) {
    console.error("Usage: pnpm exec tsx src/narratives/previewWebDesignNarrativePage.ts \"Dore\" \"Sheffield\"");
    process.exit(1);
  }

  console.log(previewWebDesignNarrativePage(areaArg, cityArg));
}
