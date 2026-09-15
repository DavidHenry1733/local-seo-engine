import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

import { buildWebDesignNarrativePackage } from "./buildWebDesignNarrativePackage";
import { generateWebDesignNarrativeOutline } from "./generateWebDesignNarrativeOutline";

interface CurrentPageSummary {
  title: string;
  hero: string;
  sections: string[];
  cta: string;
}

interface NarrativeOutlineSummary {
  profile: string;
  narrativeKey: string;
  hero: string;
  whyInvest: string;
  problems: string[];
  outcomes: string[];
  cta: string;
}

const OUTPUT_ROOT = path.join("output", "inboxingproweb");

function findProjectRoot(): string {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));

  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, OUTPUT_ROOT))) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  return process.cwd();
}

function areaToSlug(area: string): string {
  return area
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function locateCurrentPage(area: string): string {
  return path.join(findProjectRoot(), OUTPUT_ROOT, `web-design-${areaToSlug(area)}`, "index.html");
}

function firstParagraph($section: cheerio.Cheerio<cheerio.Element>): string {
  return cleanText($section.find("p").first().text());
}

function extractCurrentPage(area: string): CurrentPageSummary {
  const pagePath = locateCurrentPage(area);

  if (!fs.existsSync(pagePath)) {
    throw new Error(`Current generated page not found: ${pagePath}`);
  }

  const $ = cheerio.load(fs.readFileSync(pagePath, "utf8"));
  const sections: string[] = [];

  $("section").each((_, element) => {
    const $section = $(element);

    if ($section.hasClass("hero") || $section.hasClass("final")) {
      return;
    }

    const heading = cleanText($section.find("h2").first().text());

    if (!heading) {
      return;
    }

    const intro = firstParagraph($section);
    sections.push(intro ? `${heading}: ${intro}` : heading);
  });

  return {
    title: cleanText($("title").first().text()),
    hero: cleanText($("h1").first().text()),
    sections: sections.slice(0, 3),
    cta: cleanText($("section.final h2").first().text()) || cleanText($("section").last().find("h2").first().text()),
  };
}

function readOutlineValue(outline: string, label: string): string {
  const match = outline.match(new RegExp(`^${label}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function readOutlineBlock(outline: string, heading: string, nextHeading: string): string {
  const pattern = new RegExp(`# ${heading}\\n\\n([\\s\\S]*?)\\n\\n# ${nextHeading}`);
  return pattern.exec(outline)?.[1]?.trim() ?? "";
}

function readOutlineList(outline: string, heading: string, nextHeading: string): string[] {
  return readOutlineBlock(outline, heading, nextHeading)
    .split("\n")
    .map((line) => line.replace(/^- /, "").trim())
    .filter(Boolean);
}

function extractNarrativeOutline(area: string, city?: string): NarrativeOutlineSummary {
  const outline = generateWebDesignNarrativeOutline(area, city);

  return {
    profile: readOutlineValue(outline, "Profile"),
    narrativeKey: readOutlineValue(outline, "Narrative Key"),
    hero: readOutlineValue(outline, "Headline"),
    whyInvest: readOutlineBlock(outline, "WHY INVEST", "COMMON PROBLEMS"),
    problems: readOutlineList(outline, "COMMON PROBLEMS", "WHAT HAPPENS IF NOTHING CHANGES"),
    outcomes: readOutlineList(outline, "EXPECTED OUTCOMES", "COMMON MISTAKES"),
    cta: readOutlineBlock(outline, "CTA", "$").trim() || readOutlineValue(outline, "CTA Text"),
  };
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- None found";
}

function describePositioningDifference(current: CurrentPageSummary, narrative: NarrativeOutlineSummary): string {
  return `Current positioning is led by the generic page topic "${current.hero}", while the narrative version leads with "${narrative.hero}".`;
}

function describeCtaDifference(current: CurrentPageSummary, narrative: NarrativeOutlineSummary): string {
  return `Current CTA heading focuses on "${current.cta}", while the narrative CTA asks visitors to "${narrative.cta}".`;
}

export function compareCurrentVsNarrative(area: string, city?: string): string {
  const current = extractCurrentPage(area);
  const narrative = extractNarrativeOutline(area, city);
  const narrativePackage = buildWebDesignNarrativePackage(area, city);

  return [
    "==================================================",
    "CURRENT PAGE",
    "============",
    "",
    "Title:",
    current.title,
    "",
    "Hero:",
    current.hero,
    "",
    "Sections:",
    formatList(current.sections),
    "",
    "CTA:",
    current.cta,
    "",
    "==================================================",
    "NARRATIVE VERSION",
    "=================",
    "",
    "Profile:",
    narrative.profile,
    "",
    "Narrative Key:",
    narrative.narrativeKey,
    "",
    "Hero:",
    narrative.hero,
    "",
    "Why Invest:",
    narrative.whyInvest,
    "",
    "Problems:",
    formatList(narrative.problems),
    "",
    "Outcomes:",
    formatList(narrative.outcomes),
    "",
    "CTA:",
    narrative.cta,
    "",
    "==================================================",
    "DIFFERENCE SUMMARY",
    "==================",
    "",
    `Narrative profile used: ${narrative.profile}`,
    `Main positioning difference: ${describePositioningDifference(current, narrative)}`,
    `Main CTA difference: ${describeCtaDifference(current, narrative)}`,
    `Main audience difference: Current page addresses local businesses broadly; narrative version targets ${narrativePackage.narrativeProfileData.audience}`,
  ].join("\n");
}

function isCliRun(): boolean {
  const invoked = process.argv[1] ? path.basename(process.argv[1]) : "";
  return /^compareCurrentVsNarrative\.[cm]?[jt]s$/.test(invoked) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isCliRun()) {
  const [, , areaArg, cityArg] = process.argv;

  if (!areaArg) {
    console.error("Usage: pnpm exec tsx src/narratives/compareCurrentVsNarrative.ts \"Dore\" \"Sheffield\"");
    process.exit(1);
  }

  console.log(compareCurrentVsNarrative(areaArg, cityArg));
}
