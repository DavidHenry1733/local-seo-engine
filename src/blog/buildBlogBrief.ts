import fs from "node:fs";
import path from "node:path";

import * as cheerio from "cheerio";

import { buildWebDesignNarrativePackage } from "../narratives/buildWebDesignNarrativePackage";
import { buildLocalSeoNarrativePackage } from "../narratives/buildLocalSeoNarrativePackage";

export type BlogServiceKey = "web-design" | "local-seo";

export interface BlogLink {
  label: string;
  href: string;
}

export interface BlogNarrativeContext {
  profile: string;
  narrativeKey: string;
  coreMessage: string;
  reason: string;
  audience?: string;
  conversionFocus?: string;
  trustDrivers?: string[];
  painPoints?: string[];
  goals?: string[];
}

export interface BlogSourceSection {
  heading: string;
  body: string;
}

export interface BlogSourceFaq {
  question: string;
  answer: string;
}

export interface BlogImage {
  src: string;
  alt: string;
}

export interface BlogBrief {
  clientSlug: string;
  sourceSlug: string;
  serviceKey: BlogServiceKey;
  serviceName: string;
  city: string;
  parentHub: BlogLink;
  title: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  sourceAiSummary: string;
  sourceCta: string;
  sourceSections?: BlogSourceSection[];
  sourceFaqs?: BlogSourceFaq[];
  localRelevance?: string;
  image?: BlogImage;
  localReferences: string[];
  clusterLinks: BlogLink[];
  relatedServiceLinks: BlogLink[];
  narrative: BlogNarrativeContext;
}

interface PageData {
  service?: string;
  targetKeyword?: string;
  primaryLocation?: string;
  location?: string;
  remotePath?: string;
  liveUrl?: string;
}

const CLIENT_SLUG = "inboxingproweb";
const OUTPUT_ROOT = path.join(process.cwd(), "output", CLIENT_SLUG);

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/\bSeo\b/g, "SEO");
}

function serviceKeyFromSlug(sourceSlug: string): BlogServiceKey {
  if (sourceSlug.startsWith("web-design-")) return "web-design";
  if (sourceSlug.startsWith("local-seo-")) return "local-seo";
  throw new Error(`Unsupported blog source slug "${sourceSlug}". Expected web-design-* or local-seo-*.`);
}

function serviceNameFromKey(serviceKey: BlogServiceKey): string {
  return serviceKey === "web-design" ? "Web Design" : "Local SEO";
}

function cityFromSlug(sourceSlug: string, serviceKey: BlogServiceKey): string {
  return titleCase(sourceSlug.replace(`${serviceKey}-`, "").replace(/-/g, " "));
}

function text($: cheerio.CheerioAPI, selector: string): string {
  return $(selector).first().text().replace(/\s+/g, " ").trim();
}

function linksFromSection($: cheerio.CheerioAPI, selector: string): BlogLink[] {
  return $(`${selector} a[href]`).toArray()
    .map((element) => ({
      label: $(element).text().replace(/\s+/g, " ").trim(),
      href: $(element).attr("href") ?? "",
    }))
    .filter((link) => link.label && link.href);
}

function uniqueLinks(links: BlogLink[]): BlogLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = link.href.replace(/\/+$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function localReferencesFromHtml(html: string, city: string): string[] {
  const candidates = [
    city,
    "South Yorkshire",
    "Dore",
    "Crookes",
    "Ecclesall",
    "Fulwood",
    "Hillsborough",
    "Kelham Island",
    "Sheffield City Centre",
  ];
  return candidates.filter((candidate) => html.includes(candidate));
}

function narrativeFor(serviceKey: BlogServiceKey, city: string): BlogNarrativeContext {
  if (serviceKey === "web-design") {
    const narrative = buildWebDesignNarrativePackage(city, city);
    return {
      profile: narrative.profile,
      narrativeKey: narrative.narrativeKey,
      coreMessage: narrative.coreMessage,
      reason: narrative.reason,
      audience: narrative.narrativeProfileData.audience,
      conversionFocus: narrative.narrativeProfileData.conversion_focus,
      trustDrivers: narrative.narrativeProfileData.trust_drivers,
      painPoints: narrative.narrativeProfileData.pain_points,
      goals: narrative.narrativeProfileData.goals,
    };
  }

  const narrative = buildLocalSeoNarrativePackage(city, city);
  return {
    profile: narrative.profile,
    narrativeKey: narrative.narrativeKey,
    coreMessage: narrative.coreMessage,
    reason: narrative.reason,
    audience: narrative.narrativeProfileData.audience,
    conversionFocus: narrative.narrativeProfileData.conversionFocus,
    trustDrivers: narrative.narrativeProfileData.trustDrivers,
  };
}

export function buildBlogBrief(sourceSlug: string): BlogBrief {
  const serviceKey = serviceKeyFromSlug(sourceSlug);
  const serviceName = serviceNameFromKey(serviceKey);
  const sourceDir = path.join(OUTPUT_ROOT, sourceSlug);
  const htmlPath = path.join(sourceDir, "index.html");
  const pageDataPath = path.join(sourceDir, "page-data.json");

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Source hub HTML not found: ${htmlPath}`);
  }
  if (!fs.existsSync(pageDataPath)) {
    throw new Error(`Source hub page-data not found: ${pageDataPath}`);
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  const pageData = JSON.parse(fs.readFileSync(pageDataPath, "utf8")) as PageData;
  const $ = cheerio.load(html);
  const city = pageData.primaryLocation ?? pageData.location ?? cityFromSlug(sourceSlug, serviceKey);
  const parentHubHref = pageData.remotePath ?? `/${sourceSlug}/`;
  const sourceAiSummary = text($, "#ai-summary-section p");
  const sourceCta = text($, "#cta-section");
  const clusterLinks = uniqueLinks(linksFromSection($, "#areas-we-cover-section")).slice(0, 4);
  const relatedServiceLinks = uniqueLinks(linksFromSection($, "#related-services-section")).slice(0, 2);
  const narrative = narrativeFor(serviceKey, city);
  const blogTopic = serviceKey === "web-design"
    ? `How ${city} Businesses Can Turn Their Website Into a Better Enquiry Channel`
    : `How ${city} Businesses Can Build a Stronger Local Customer Pipeline`;

  return {
    clientSlug: CLIENT_SLUG,
    sourceSlug,
    serviceKey,
    serviceName,
    city,
    parentHub: {
      label: `${serviceName} ${city}`,
      href: parentHubHref,
    },
    title: blogTopic,
    h1: blogTopic,
    metaTitle: serviceKey === "web-design"
      ? `${city} Website Enquiry Guide | InboxingProWeb`
      : `${city} Local SEO Pipeline Guide | InboxingProWeb`,
    metaDescription: serviceKey === "web-design"
      ? `Practical ${serviceName} guidance for ${city} businesses that want stronger trust, clearer messaging and more qualified website enquiries.`
      : `Practical ${serviceName} guidance for ${city} businesses that want stronger local visibility, demand and customer acquisition.`,
    sourceAiSummary,
    sourceCta,
    localReferences: localReferencesFromHtml(html, city),
    clusterLinks,
    relatedServiceLinks,
    narrative,
  };
}

function isCliRun(): boolean {
  return process.argv[1] ? path.resolve(process.argv[1]).endsWith("buildBlogBrief.ts") : false;
}

if (isCliRun()) {
  const sourceSlug = process.argv[2];
  if (!sourceSlug) {
    console.error("Usage: pnpm exec tsx src/blog/buildBlogBrief.ts \"web-design-sheffield\"");
    process.exit(1);
  }
  console.log(JSON.stringify(buildBlogBrief(sourceSlug), null, 2));
}
