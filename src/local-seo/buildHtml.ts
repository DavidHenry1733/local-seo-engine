import fs from "fs";
import path from "path";
import { getVariationSet } from "./getVariationSet";

type FaqItem = {
  question?: string;
  answer?: string;
};

type ContentData = {
  hero_title?: string;
  hero_subtitle?: string;
  intro?: string;
  local_section?: string;
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
  };
};

function formatCta(text: string): string {
  const cleaned = String(text || "").trim();
  if (!cleaned) return "";

  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return "";

  const [heading, ...body] = paragraphs;
  const headingHtml = `<h2>${escapeHtml(heading)}</h2>`;
  const bodyHtml = body.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");

  return bodyHtml ? `${headingHtml}\n${bodyHtml}` : headingHtml;
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function slugify(value: string): string {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  const listItems = items
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("\n");

  return `<ul>\n${listItems}\n</ul>`;
}

function buildFaqHtml(faq: FaqItem[] = []): string {
  if (!Array.isArray(faq) || faq.length === 0) {
    return "";
  }

  const items = faq
    .filter((item) => item?.question && item?.answer)
    .map(
      (item) => `
<h3>${escapeHtml(item.question || "")}</h3>
${formatParagraphs(item.answer || "")}
`.trim()
    )
    .join("\n\n");

  return items;
}

function buildAreaLinksHtml(
  currentSlug: string,
  nearbyAreas: string[],
  serviceSlug: string
): string {
  if (!Array.isArray(nearbyAreas) || nearbyAreas.length === 0) {
    return "";
  }

  const currentArea = currentSlug.split("-").pop();

  const links = nearbyAreas
    .filter((area) => area.toLowerCase() !== currentArea)
    .slice(0, 3) // limit to 3 links max
    .map((area) => {
      const areaSlug = area.toLowerCase().replace(/\s+/g, "-");
      const url = `/${serviceSlug}-${areaSlug}/`;
      const serviceText = toTitleCase(serviceSlug.replace(/-/g, " "));
      const text = `${serviceText} ${area}`;

      return `<li><a href="${url}">${text}</a></li>`;
    })
    .join("\n");

  return `
<h2>Areas We Also Cover</h2>
<ul>
${links}
</ul>
`.trim();
}

function buildHubLinkHtml(
  serviceSlug: string,
  serviceName: string,
  city: string,
  areaName: string
): string {
  const citySlug = slugify(city);
  const hubUrl = `/${serviceSlug}-${citySlug}/`;
  const hubAnchorText = `${serviceName} ${city}`;
  const hubAnchorFull = `main ${hubAnchorText} page`;

  return `
<h2>${escapeHtml(serviceName)} Across ${escapeHtml(city)}</h2>
<p>We also provide ${escapeHtml(serviceName.toLowerCase())} services across ${escapeHtml(city)}, including ${escapeHtml(areaName)} and nearby areas. For a broader overview of our service, visit our <a href="${hubUrl}">${escapeHtml(hubAnchorFull)}</a>.</p>
<p><a href="${hubUrl}">View ${escapeHtml(hubAnchorText)}</a></p>
`.trim();
}

export function buildHtml(projectRoot: string, slug: string) {
  const contentPath = path.join(projectRoot, "output", slug, "content.json");
  const pageDataPath = path.join(projectRoot, "output", slug, "page-data.json");

  const content = JSON.parse(
    fs.readFileSync(contentPath, "utf-8")
  ) as ContentData;

  const pageData = JSON.parse(
    fs.readFileSync(pageDataPath, "utf-8")
  ) as PageData;

  const areaDataPath = path.join(projectRoot, "input", `area.${slug.split("-").pop()}.json`);
  const areaData = JSON.parse(fs.readFileSync(areaDataPath, "utf-8"));
  const nearbyAreas = areaData.nearby_areas || [];

  const serviceSlug = slug.split("-").slice(0, -1).join("-");
  const areaLinksHtml = buildAreaLinksHtml(slug, nearbyAreas, serviceSlug);

  const city = pageData.location?.city || "";
  const serviceName = pageData.service?.service_name
    ? toTitleCase(pageData.service.service_name.toLowerCase())
    : toTitleCase(serviceSlug.replace(/-/g, " "));
  const areaName = toTitleCase(slug.split("-").pop()?.replace(/-/g, " ") || "");
  const hubLinkHtml = city ? buildHubLinkHtml(serviceSlug, serviceName, city, areaName) : "";

  const brandName = pageData.brand?.name || "Our Team";
  const faqHtml = buildFaqHtml(content.faq || []);
  const benefitsHtml = buildBenefitsHtml(content.benefits || []);

  const variation = getVariationSet(projectRoot, slug, serviceSlug);
  const headings = variation.headingStyle;

  const whyChooseHeading = headings.whyChooseHeading.replace("{{brand_name}}", brandName);
  const ctaHeading = content.cta_heading || headings.ctaHeading;

  const sections: string[] = [];

  // No H1 here — WordPress page title should handle that.

  if (content.hero_subtitle) {
    sections.push(`<p>${escapeHtml(content.hero_subtitle)}</p>`);
  }

  const coreSections = {
    intro: content.intro ? `
<h2>${escapeHtml(headings.introHeading)}</h2>
${formatParagraphs(content.intro)}
`.trim() : "",

    local: content.local_section ? `
<h2>${escapeHtml(headings.localHeading)}</h2>
${formatParagraphs(content.local_section)}
`.trim() : "",

    benefits: benefitsHtml ? `
<h2>${escapeHtml(headings.benefitsHeading)}</h2>
${benefitsHtml}
`.trim() : "",

    why: content.why_choose_us ? `
<h2>${escapeHtml(whyChooseHeading)}</h2>
${formatParagraphs(content.why_choose_us)}
`.trim() : "",
  };

  const templateStyle = (variation as any).templateStyle || "classic";

  const templateOrder =
    templateStyle === "problem_solution"
      ? ["local", "intro", "benefits", "why"]
      : templateStyle === "authority"
        ? ["benefits", "why", "local", "intro"]
        : ["intro", "local", "benefits", "why"];

  for (const key of templateOrder) {
    const sectionHtml = (coreSections as any)[key];
    if (sectionHtml) sections.push(sectionHtml);
  }

  if (hubLinkHtml) {
    sections.push(hubLinkHtml);
  }

  if (faqHtml) {
    sections.push(`
<h2>${escapeHtml(headings.faqHeading)}</h2>
${faqHtml}
`.trim());
  }

  if (areaLinksHtml) {
    sections.push(areaLinksHtml);
  }

  if (ctaHeading || content.cta) {
    const ctaBody = content.cta ? formatParagraphs(content.cta) : "";
    sections.push(`<h2>${escapeHtml(ctaHeading)}</h2>\n${ctaBody}`.trim());
  }

  const html = sections.join("\n\n");

  const outputFile = path.join(projectRoot, "output", slug, "page.html");
  fs.writeFileSync(outputFile, html, "utf-8");

  console.log("WordPress-ready HTML created:", outputFile);
}
