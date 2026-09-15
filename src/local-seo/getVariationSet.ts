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
  templateStyles: string[];
  faqPools: Record<string, string[]>;
};

type PartialVariationConfig = {
  introStyles?: string[];
  ctaStyles?: string[];
  headingStyles?: HeadingStyle[];
  templateStyles?: string[];
  faqPools?: Record<string, string[]>;
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
  const globalConfig = readJsonFile<VariationConfig>(configPath);

  const serviceConfigPath = path.join(projectRoot, "input", "service-variations", `${serviceSlug}.json`);
  const serviceConfig = fs.existsSync(serviceConfigPath)
    ? readJsonFile<PartialVariationConfig>(serviceConfigPath)
    : {};

  const config: VariationConfig = {
    introStyles: serviceConfig.introStyles?.length ? serviceConfig.introStyles : globalConfig.introStyles,
    ctaStyles: serviceConfig.ctaStyles?.length ? serviceConfig.ctaStyles : globalConfig.ctaStyles,
    headingStyles: serviceConfig.headingStyles?.length ? serviceConfig.headingStyles : globalConfig.headingStyles,
    templateStyles: serviceConfig.templateStyles?.length ? serviceConfig.templateStyles : globalConfig.templateStyles,
    faqPools: { ...globalConfig.faqPools, ...(serviceConfig.faqPools || {}) }
  };

  const introStyle = pickByHash(config.introStyles, `${slug}-intro`);
  const ctaStyle = pickByHash(config.ctaStyles, `${slug}-cta`);
  const headingStyle = pickByHash(config.headingStyles, `${slug}-heading`);

  const areaPart = slug.split("-").slice(2).join("-") || slug;
  const areaOrder = [
    "ecclesall",
    "fulwood",
    "hillsborough",
    "crookes",
    "rotherham",
    "bramley",
    "aston",
    "dinnington",
    "parkgate",
    "rawmarsh",
    "swallownest",
    "thurcroft",
    "wickersley",
    "maltby",
    "kiveton-park"
  ];
  const areaIndex = areaOrder.indexOf(areaPart);
  const templateSeed = areaIndex >= 0 ? areaIndex : hashString(`${slug}-template`);
  const templateStyle = config.templateStyles[
    templateSeed % config.templateStyles.length
  ];

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
    templateStyle,
    selectedFaqs
  };
}
