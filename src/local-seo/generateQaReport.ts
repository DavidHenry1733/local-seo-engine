import fs from "fs";
import path from "path";

type PageDataJson = {
  job?: {
    city?: string;
    area?: string;
  };
  location?: {
    city?: string;
    area?: string;
    child_areas?: string[];
  };
  page?: {
    slug?: string;
    title_seed?: string;
  };
};

type ContentJson = {
  hero_title?: string;
  faq?: Array<{ question?: string; answer?: string }>;
  benefits?: string[];
  cta?: string;
};

type WordPressExportJson = {
  action?: string;
  status?: string;
  link?: string;
};

type ImageUploadJson = {
  mediaId?: number;
  sourceUrl?: string;
};

type QaRecord = {
  slug: string;
  title: string;
  pageType: "hub" | "area";
  city: string;
  area: string;
  faqCount: number;
  benefitsCount: number;
  hasCta: boolean;
  hasFaqSection: boolean;
  hasHubLink: boolean;
  hasNearbyLinksSection: boolean;
  hasSchemaJson: boolean;
  hasSchemaInline: boolean;
  wordpressAction: string;
  wordpressStatus: string;
  wordpressLink: string;
  hasGeneratedImage: boolean;
  hasImageUploadLog: boolean;
  hasInjectedImage: boolean;
  imageMediaId: string;
  imageSourceUrl: string;
  readyForReview: boolean;
  issues: string[];
};

function slugify(value: string): string {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function escapeCsvField(value: string | number | boolean): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvRow(record: QaRecord): string {
  const fields: (string | number | boolean)[] = [
    record.slug,
    record.title,
    record.pageType,
    record.city,
    record.area,
    record.faqCount,
    record.benefitsCount,
    record.hasCta,
    record.hasFaqSection,
    record.hasHubLink,
    record.hasNearbyLinksSection,
    record.hasSchemaJson,
    record.hasSchemaInline,
    record.wordpressAction,
    record.wordpressStatus,
    record.wordpressLink,
    record.hasGeneratedImage,
    record.hasImageUploadLog,
    record.hasInjectedImage,
    record.imageMediaId,
    record.imageSourceUrl,
    record.readyForReview,
    record.issues.join("; "),
  ];
  return fields.map(escapeCsvField).join(",");
}

function processSlug(outputDir: string, slug: string): QaRecord {
  const dir = path.join(outputDir, slug);

  const pageData = readJsonSafe<PageDataJson>(path.join(dir, "page-data.json"));
  const content = readJsonSafe<ContentJson>(path.join(dir, "content.json"));
  const wpExport = readJsonSafe<WordPressExportJson>(path.join(dir, "wordpress-export.json"));
  const imageUpload = readJsonSafe<ImageUploadJson>(path.join(dir, "image-upload.json"));
  const pageHtml = readFileSafe(path.join(dir, "page.html"));

  const hasPageHtml = pageHtml !== null;
  const hasSchemaJson = fs.existsSync(path.join(dir, "schema.json"));
  const hasSchemaInline = fs.existsSync(path.join(dir, "schema-inline.html"));

  const hasGeneratedImage = fs.existsSync(path.join(dir, "image-generation.json"));
  const hasImageUploadLog = fs.existsSync(path.join(dir, "image-upload.json"));
  const hasInjectedImage = pageHtml !== null && pageHtml.includes('class="generated-page-image"');
  const imageMediaId = imageUpload?.mediaId != null ? String(imageUpload.mediaId) : "";
  const imageSourceUrl = imageUpload?.sourceUrl || "";

  const city = pageData?.location?.city || pageData?.job?.city || "";
  const area = pageData?.location?.area || pageData?.job?.area || "";

  const isHub = Array.isArray(pageData?.location?.child_areas);
  const pageType: "hub" | "area" = isHub ? "hub" : "area";

  const title = content?.hero_title || pageData?.page?.title_seed || "";

  const faqCount = Array.isArray(content?.faq) ? content.faq.length : 0;
  const benefitsCount = Array.isArray(content?.benefits) ? content.benefits.length : 0;
  const hasCta = typeof content?.cta === "string" && content.cta.trim().length > 0;

  const hasFaqSection = pageHtml !== null && /<h3>/i.test(pageHtml);

  let hasHubLink = false;
  if (pageType === "area" && pageHtml !== null && city) {
    const serviceSlug = slug.split("-").slice(0, -1).join("-");
    const citySlug = slugify(city);
    const hubUrl = `/${serviceSlug}-${citySlug}/`;
    hasHubLink = pageHtml.includes(hubUrl);
  } else if (pageType === "hub") {
    hasHubLink = true;
  }

  const hasNearbyLinksSection =
    pageHtml !== null && pageHtml.includes("Areas We Also Cover");

  const wordpressAction = wpExport?.action || "";
  const wordpressStatus = wpExport?.status || "";
  const wordpressLink = wpExport?.link || "";

  const issues: string[] = [];

  if (!title) issues.push("Missing title");
  if (!hasPageHtml) issues.push("Missing page.html");
  if (faqCount < 3) issues.push(`FAQ count below 3 (got ${faqCount})`);
  if (benefitsCount < 6) issues.push(`Benefits count below 6 (got ${benefitsCount})`);
  if (!hasCta) issues.push("Missing CTA");
  if (!hasSchemaJson) issues.push("Missing schema.json");
  if (pageType === "area" && !hasHubLink) issues.push("Missing hub link");

  const readyForReview =
    !!title &&
    hasPageHtml &&
    faqCount >= 3 &&
    benefitsCount >= 6 &&
    hasCta &&
    hasSchemaJson &&
    (pageType === "hub" || hasHubLink);

  return {
    slug,
    title,
    pageType,
    city,
    area,
    faqCount,
    benefitsCount,
    hasCta,
    hasFaqSection,
    hasHubLink,
    hasNearbyLinksSection,
    hasSchemaJson,
    hasSchemaInline,
    wordpressAction,
    wordpressStatus,
    wordpressLink,
    hasGeneratedImage,
    hasImageUploadLog,
    hasInjectedImage,
    imageMediaId,
    imageSourceUrl,
    readyForReview,
    issues,
  };
}

export function generateQaReport(projectRoot: string): {
  reportPath: string;
  csvPath: string;
  count: number;
} {
  const outputDir = path.join(projectRoot, "output");

  const slugs = fs
    .readdirSync(outputDir)
    .filter((entry) => {
      const full = path.join(outputDir, entry);
      return fs.statSync(full).isDirectory();
    })
    .sort();

  const records: QaRecord[] = slugs.map((slug) => processSlug(outputDir, slug));

  const reportPath = path.join(outputDir, "qa-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(records, null, 2), "utf-8");

  const csvHeader =
    "slug,title,pageType,city,area,faqCount,benefitsCount,hasCta,hasFaqSection,hasHubLink,hasNearbyLinksSection,hasSchemaJson,hasSchemaInline,wordpressAction,wordpressStatus,wordpressLink,hasGeneratedImage,hasImageUploadLog,hasInjectedImage,imageMediaId,imageSourceUrl,readyForReview,issues";
  const csvRows = records.map(buildCsvRow);
  const csvPath = path.join(outputDir, "qa-report.csv");
  fs.writeFileSync(csvPath, [csvHeader, ...csvRows].join("\n"), "utf-8");

  return { reportPath, csvPath, count: records.length };
}
