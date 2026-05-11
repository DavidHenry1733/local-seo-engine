import fs from "fs";
import path from "path";

type HeadingStyle = {
  introHeading: string;
  localHeading: string;
  benefitsHeading: string;
  whyChooseHeading: string;
  faqHeading: string;
  ctaHeading: string;
};

type VariationConfig = {
  introStyles: string[];
  ctaStyles: string[];
  headingStyles: HeadingStyle[];
  faqPools: Record<string, string[]>;
};

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickByHash<T>(items: T[], seed: string): T {
  const index = hashString(seed) % items.length;
  return items[index];
}

export function getVariationSet(projectRoot: string, slug: string, serviceSlug: string) {
  const configPath = path.join(projectRoot, "input", "variation.json");
  const config = readJsonFile<VariationConfig>(configPath);

  const introStyle = pickByHash(config.introStyles, `${slug}-intro`);
  const ctaStyle = pickByHash(config.ctaStyles, `${slug}-cta`);
  const headingStyle = pickByHash(config.headingStyles, `${slug}-heading`);

  const faqPool = config.faqPools[serviceSlug] || [];
  const faqSeed = hashString(`${slug}-faq`);

  const selectedFaqs = faqPool
    .map((question, index) => ({
      question,
      score: hashString(`${slug}-${question}-${index + faqSeed}`)
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((item) => item.question);

  return {
    introStyle,
    ctaStyle,
    headingStyle,
    selectedFaqs
  };
}
