import fs from "fs";
import path from "path";

type FaqItem = {
  question?: string;
  answer?: string;
};

type ContentData = {
  hero_title?: string;
  hero_subtitle?: string;
  intro?: string;
  city_section?: string;
  benefits?: string[];
  why_choose_us?: string;
  faq?: FaqItem[];
  cta_heading?: string;
  cta?: string;
};

type PageData = {
  brand?: {
    name?: string;
  };
  service?: {
    service_name?: string;
  };
  location?: {
    city?: string;
    child_areas?: string[];
  };
  page?: {
    slug?: string;
  };
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatParagraphs(text: string): string {
  const cleaned = String(text || "").trim();
  if (!cleaned) return "";

  return cleaned
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");
}

function buildBenefitsHtml(items: string[] = []): string {
  if (!Array.isArray(items) || items.length === 0) return "";

  const listItems = items
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("\n");

  return `<ul>\n${listItems}\n</ul>`;
}

function buildFaqHtml(faq: FaqItem[] = []): string {
  if (!Array.isArray(faq) || faq.length === 0) return "";

  return faq
    .filter((item) => item?.question && item?.answer)
    .map(
      (item) => `
<h3>${escapeHtml(item.question || "")}</h3>
${formatParagraphs(item.answer || "")}
`.trim()
    )
    .join("\n\n");
}

function slugify(value: string): string {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildChildAreaLinks(serviceName: string, city: string, childAreas: string[]): string {
  if (!Array.isArray(childAreas) || childAreas.length === 0) return "";

  const serviceSlug = slugify(serviceName);
  const serviceText = toTitleCase(serviceName.toLowerCase());

  const links = childAreas
    .map((area) => {
      const areaSlug = slugify(area);
      return `<li><a href="/${serviceSlug}-${areaSlug}/">${serviceText} ${escapeHtml(area)}</a></li>`;
    })
    .join("\n");

  return `
<h2>${serviceText} Services Across ${escapeHtml(city)} Areas</h2>
<ul>
${links}
</ul>
`.trim();
}

export function buildHubHtml(projectRoot: string, slug: string) {
  const contentPath = path.join(projectRoot, "output", slug, "content.json");
  const pageDataPath = path.join(projectRoot, "output", slug, "page-data.json");

  const content = JSON.parse(fs.readFileSync(contentPath, "utf-8")) as ContentData;
  const pageData = JSON.parse(fs.readFileSync(pageDataPath, "utf-8")) as PageData;

  const brandName = pageData.brand?.name || "Our Team";
  const serviceName = pageData.service?.service_name || "Service";
  const city = pageData.location?.city || "";
  const childAreas = pageData.location?.child_areas || [];

  const faqHtml = buildFaqHtml(content.faq || []);
  const benefitsHtml = buildBenefitsHtml(content.benefits || []);
  const childLinksHtml = buildChildAreaLinks(serviceName, city, childAreas);

  const serviceSlug = slugify(serviceName);
  const firstArea = childAreas[0] || "";
  const firstAreaSlug = slugify(firstArea);
  const firstAreaText = toTitleCase(firstArea.toLowerCase());

  const sections: string[] = [];

  if (content.hero_title) {
    sections.push(`<h1>${escapeHtml(content.hero_title)}</h1>`);
  }

  if (content.hero_subtitle) {
    sections.push(`<p>${escapeHtml(content.hero_subtitle)}</p>`);
  }

  if (content.intro) {
    sections.push(`
<h2>${escapeHtml(serviceName)} Services Across ${escapeHtml(city)}</h2>
${formatParagraphs(content.intro)}
`.trim());
  }

  if (content.city_section) {
    const inlineLink = firstArea
      ? `<p>If you're looking for more local detail, you can explore our <a href="/${serviceSlug}-${firstAreaSlug}/">${escapeHtml(serviceName)} ${firstAreaText}</a> services or view our full ${escapeHtml(city)} coverage below.</p>`
      : "";

    sections.push(`
<h2>Supporting Businesses Across the City</h2>
${formatParagraphs(content.city_section)}
${inlineLink}
`.trim());
  }

  if (benefitsHtml) {
    sections.push(`
<h2>How This Helps Your Business</h2>
${benefitsHtml}
`.trim());
  }

  if (content.why_choose_us) {
    sections.push(`
<h2>Why Choose ${escapeHtml(brandName)}</h2>
${formatParagraphs(content.why_choose_us)}
`.trim());
  }

  if (childLinksHtml) {
    sections.push(childLinksHtml);
  }

  if (faqHtml) {
    sections.push(`
<h2>Frequently Asked Questions</h2>
${faqHtml}
`.trim());
  }

  if (content.cta) {
    sections.push(`
<h2>${escapeHtml(content.cta_heading || "Talk to Us About Your Project")}</h2>
${formatParagraphs(content.cta)}
`.trim());
  }

  const html = sections.join("\n\n");
  const outputFile = path.join(projectRoot, "output", slug, "page.html");

  fs.writeFileSync(outputFile, html, "utf-8");
  console.log("Hub HTML created:", outputFile);
}
