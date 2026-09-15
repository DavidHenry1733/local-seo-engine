import fs from "node:fs";
import path from "node:path";

import * as cheerio from "cheerio";

import { normaliseServiceKey, serviceDisplayName } from "../generator/imageLibrary";
import type {
  BusinessProfile,
  CampaignContentContext,
  CampaignPaneImageMeta,
  InternalLink,
  SourcePageRef,
} from "./types";

const DEFAULT_OUTPUT_DIR = "output";

interface SessionDef {
  area?: string;
  remotePath?: string;
  tier?: string;
  primaryKeyword?: string;
}

interface PageDataFile {
  service?: string;
  location?: string;
  targetKeyword?: string;
  remotePath?: string;
  liveUrl?: string;
  tier?: string;
  isHubPage?: boolean;
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function areaDirFromRemotePath(remotePath: string): string {
  return remotePath.replace(/^\/+|\/+$/g, "");
}

function absUrl(domain: string, href: string): string {
  const base = domain.replace(/\/+$/, "");
  if (href.startsWith("http")) return href.endsWith("/") ? href : `${href}/`;
  const p = href.startsWith("/") ? href : `/${href}`;
  return `${base}${p.endsWith("/") ? p : `${p}/`}`;
}

function extractFaqsFromHtml(html: string): { question: string; answer: string }[] {
  const $ = cheerio.load(html);
  const faqs: { question: string; answer: string }[] = [];
  $(".faq .faq-q, .faq h3.faq-q, .cluster-faq-item h3").each((_, el) => {
    const question = $(el).text().replace(/\s+/g, " ").trim();
    const answer = $(el).next(".faq-a, p").first().text().replace(/\s+/g, " ").trim();
    if (question && answer) faqs.push({ question, answer });
  });
  if (faqs.length > 0) return faqs.slice(0, 8);

  const ld = $('script[type="application/ld+json"]').toArray();
  for (const node of ld) {
    try {
      const data = JSON.parse($(node).html() ?? "{}") as {
        "@type"?: string;
        mainEntity?: Array<{ name?: string; acceptedAnswer?: { text?: string } }>;
      };
      if (data["@type"] === "FAQPage" && Array.isArray(data.mainEntity)) {
        for (const q of data.mainEntity) {
          const question = q.name?.trim();
          const answer = q.acceptedAnswer?.text?.trim();
          if (question && answer) faqs.push({ question, answer });
        }
      }
    } catch { /* skip */ }
  }
  return faqs.slice(0, 8);
}

function relatedServicesForHosting(domain: string, citySlug: string): InternalLink[] {
  return [
    { label: `Web Design ${citySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`, href: absUrl(domain, `/web-design-${citySlug}/`) },
    { label: `Email Marketing ${citySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`, href: absUrl(domain, `/email-marketing-${citySlug}/`) },
    { label: `Local SEO ${citySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`, href: absUrl(domain, `/local-seo-rotherham/`) },
    { label: "UK Website Hosting (money page)", href: "https://inboxingproweb.com/uk-website-hosting/" },
  ];
}

function loadPaneImages(campaignId: string, outputDir: string): CampaignPaneImageMeta[] {
  const metaPath = path.join(outputDir, campaignId, "assets", "image-meta.json");
  const meta = readJson<Record<string, Record<string, unknown>>>(metaPath);
  if (!meta) return [];
  return Object.entries(meta).map(([slot, entry]) => ({
    slot,
    assignedFrom: entry.assignedFrom as string | undefined,
    altText: entry.altText as string | undefined,
    serviceKey: entry.serviceKey as string | undefined,
  }));
}

function loadBusinessProfile(projectSlug: string): BusinessProfile {
  const projectPath = path.join(process.cwd(), "config", "projects", `${projectSlug}.json`);
  const project = readJson<Record<string, unknown>>(projectPath) ?? {};
  return {
    businessName: (project.businessName as string) ?? projectSlug,
    legalName: project.legalName as string | undefined,
    domain: ((project.domain as string) ?? "https://local.inboxingproweb.com").replace(/\/+$/, ""),
    phone: project.phone as string | undefined,
    email: project.email as string | undefined,
    businessAddress: project.businessAddress as string | undefined,
    primaryCtaText: project.primaryCtaText as string | undefined,
    primaryCtaUrl: project.primaryCtaUrl as string | undefined,
  };
}

export function buildCampaignContentContext(opts: {
  projectSlug: string;
  campaignId: string;
  outputDir?: string;
}): CampaignContentContext {
  const outputDir = opts.outputDir ?? DEFAULT_OUTPUT_DIR;
  const clientDir = path.join(process.cwd(), outputDir, opts.projectSlug);
  const sessionPath = path.join(clientDir, "sessions", `${opts.campaignId}.json`);

  const session = readJson<Record<string, unknown>>(sessionPath);
  if (!session) {
    throw new Error(`Campaign session not found: ${sessionPath}`);
  }

  const campaign = (session.campaign ?? {}) as Record<string, string>;
  const defs = (session.selectedAreaDefs ?? []) as SessionDef[];
  const businessProfile = loadBusinessProfile(opts.projectSlug);
  const domain = businessProfile.domain;

  const rawServiceKey = campaign.serviceKey ?? campaign.serviceName ?? "web-hosting";
  const isHostingKey = /hosting/i.test(rawServiceKey) || rawServiceKey.includes("web-ho");
  const serviceKey = normaliseServiceKey(isHostingKey ? "web-hosting" : rawServiceKey);
  const service = campaign.serviceName ?? serviceDisplayName(serviceKey);
  const location = campaign.cityName ?? "Rotherham";
  const citySlug = location.toLowerCase().replace(/\s+/g, "-");
  const targetKeyword = campaign.focusKeyword ?? `${service} ${location}`.toLowerCase();

  const hubDef = defs.find((d) => d.tier === "hub") ?? defs.find((d) => d.remotePath?.includes(`${serviceKey.split("-")[0]}-${citySlug}`));
  const hubRemote = hubDef?.remotePath ?? `/${serviceKey}-${citySlug}/`;
  const hubAreaDir = areaDirFromRemotePath(hubRemote);
  const hubUrl = absUrl(domain, hubRemote);

  const clusterDefs = defs.filter((d) => d.tier !== "hub" && d.remotePath);
  const clusterPages: SourcePageRef[] = [];
  const clusterUrls: string[] = [];
  const internalLinkTargets: InternalLink[] = [{ label: `${service} ${location}`, href: hubUrl }];

  for (const def of clusterDefs) {
    const remotePath = def.remotePath ?? "/";
    const areaDir = areaDirFromRemotePath(remotePath);
    const pageDataPath = path.join(clientDir, areaDir, "page-data.json");
    const pageData = readJson<PageDataFile>(pageDataPath);
    const liveUrl = pageData?.liveUrl ?? absUrl(domain, remotePath);
    clusterPages.push({
      areaDir,
      remotePath,
      liveUrl,
      tier: def.tier ?? "priority",
      isHub: false,
    });
    clusterUrls.push(liveUrl);
    internalLinkTargets.push({
      label: def.primaryKeyword ?? `${service} ${def.area ?? areaDir}`,
      href: liveUrl,
    });
  }

  const hubHtmlPath = path.join(clientDir, hubAreaDir, "index.html");
  const hubHtml = fs.existsSync(hubHtmlPath) ? fs.readFileSync(hubHtmlPath, "utf8") : "";
  const faqs = hubHtml ? extractFaqsFromHtml(hubHtml) : [];

  const hubPageData = readJson<PageDataFile>(path.join(clientDir, hubAreaDir, "page-data.json"));
  clusterPages.unshift({
    areaDir: hubAreaDir,
    remotePath: hubRemote,
    liveUrl: hubPageData?.liveUrl ?? hubUrl,
    tier: "hub",
    isHub: true,
  });

  const relatedServiceLinks = relatedServicesForHosting(domain, citySlug);
  const contentSignals = (session.engineOutput as Record<string, unknown> | undefined)?.contentSignals as Record<string, unknown> ?? {};

  return {
    schemaVersion: "1.0",
    campaignId: opts.campaignId,
    projectSlug: opts.projectSlug,
    service,
    serviceKey,
    location,
    targetKeyword,
    hubUrl,
    moneyPageUrl: campaign.moneyPageUrl,
    hubAreaDir,
    clusterPages,
    clusterUrls,
    internalLinkTargets,
    relatedServiceLinks,
    faqs,
    businessProfile,
    paneImages: loadPaneImages(opts.campaignId, path.join(process.cwd(), outputDir)),
    contentSignals,
  };
}
