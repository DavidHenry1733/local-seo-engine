/**
 * deployClusterPage.ts
 *
 * Generates and deploys a single cluster page.
 *
 * Usage:
 *   pnpm exec tsx src/generator/deployClusterPage.ts \
 *     config/projects/<project>.json \
 *     config/clusters/<cluster>.json
 *
 * The project config supplies FTP credentials, branding, and footer data.
 * The cluster config defines the page-level inputs (service, location, slug, images).
 */

import fs   from "node:fs";
import path from "node:path";
import * as ftp from "basic-ftp";
import { ProjectConfig, DeployConfig } from "./types";
import { generateClusterContent, ClusterPageInputs } from "./generateClusterContent";
import { refineClusterContent }                      from "./refineContent";
import {
  applyWebDesignNarrativePackage,
  type NarrativeClusterPageContent,
} from "../narratives/applyWebDesignNarrativePackage";
import { applyLocalSeoNarrativePackage } from "../narratives/applyLocalSeoNarrativePackage";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtendedProjectConfig extends ProjectConfig {
  footerCompanyName?:   string;
  footerCompanyNumber?: string;
  logoUrl?:             string;
  privacyUrl?:          string;
  termsUrl?:            string;
  navItems?:            { label: string; href: string }[];
  footerLinks?:         { label: string; href: string }[];
  footerServiceLinks?:  { label: string; href: string }[];
  footerStrapline?:     string;
  shortDescription?:    string;
  companyNumber?:       string;
  whiteLabelPoweredBy?: boolean;
  isHub?:               boolean;
  moneyPageUrl?:        string;
  moneyPageKeyword?:    string;
}

interface ClusterConfig {
  service:             string;
  location:            string;
  parentCity?:         string;
  primaryKeyword:      string;
  supportingKeywords:  string[];
  hubUrl:              string;
  hubAnchor:           string;
  relatedPages?:       string;
  remotePath:          string;
  imageGroup:          string;
  heroImage?:          string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function maskUser(u: string): string {
  if (u.length <= 3) return "***";
  return u.slice(0, 3) + "*".repeat(Math.min(u.length - 3, 6));
}

function resolveDeploySettings(deploy: DeployConfig) {
  const user     = process.env.DEPLOY_USERNAME;
  const password = process.env.DEPLOY_PASSWORD;
  if (!user || !password) {
    throw new Error("Missing FTP credentials. Set DEPLOY_USERNAME and DEPLOY_PASSWORD.");
  }
  return {
    user,
    password,
    host:       deploy.host,
    port:       deploy.port ?? 21,
    remoteRoot: deploy.remoteRoot ?? "/",
  };
}

function buildMoneyPageSection(url?: string, keyword?: string): string {
  if (!url || !keyword) return "";
  return `<section class="money-page-band"><div class="container"><p>For professional <a href="${url}">${keyword}</a> services tailored to local businesses, visit our dedicated page.</p></div></section>`;
}

function paras(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.trim()}</p>`)
    .join("\n        ");
}

/** Split multi-paragraph text into a lead (first `n` paragraphs) and detail (remainder). */
function splitParas(text: string, leadCount = 1): { lead: string; detail: string } {
  const parts = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return {
    lead:   paras(parts.slice(0, leadCount).join("\n\n")),
    detail: parts.length > leadCount ? paras(parts.slice(leadCount).join("\n\n")) : "",
  };
}

function renderCards(items: { href: string; text: string; description?: string }[]): string {
  return items
    .map((item) => {
      const desc = item.description
        ? `\n          <p>${item.description}</p>`
        : "";
      return `<a class="resource-card" href="${item.href}">\n          <h3>${item.text}</h3>${desc}\n        </a>`;
    })
    .join("\n        ");
}

function renderNavItems(items: { label: string; href: string }[]): string {
  return items
    .map((n) => `<a href="${n.href}">${n.label}</a>`)
    .join("\n        ");
}

function resolveHeroImage(cluster: ClusterConfig): string {
  if (cluster.heroImage) return `/${cluster.imageGroup}/${cluster.heroImage}`;
  const candidates = [
    path.join("assets", cluster.imageGroup, "hero-v1.png"),
    path.join("assets", cluster.imageGroup, "hero-v1.jpg"),
    path.join("assets", cluster.imageGroup, "hero.png"),
    path.join("assets", cluster.imageGroup, "hero.jpg"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  return found ? `/${found.replace(/\\/g, "/")}` : `/assets/${cluster.imageGroup}/hero-v1.png`;
}

function resolveMidPageImage(cluster: ClusterConfig): string {
  const candidates = [
    path.join("assets", cluster.imageGroup, "conversion-v1.png"),
    path.join("assets", cluster.imageGroup, "conversion-v1.jpg"),
    path.join("assets", cluster.imageGroup, "hero-v1.png"),
    path.join("assets", cluster.imageGroup, "hero-v1.jpg"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  return found ? `/${found.replace(/\\/g, "/")}` : `/assets/${cluster.imageGroup}/conversion-v1.png`;
}

function resolveSplitImage(cluster: ClusterConfig): string {
  const candidates = [
    path.join("assets", cluster.imageGroup, "trust-v1.png"),
    path.join("assets", cluster.imageGroup, "trust-v1.jpg"),
    path.join("assets", cluster.imageGroup, "support-v1.png"),
    path.join("assets", cluster.imageGroup, "support-v1.jpg"),
    path.join("assets", cluster.imageGroup, "conversion-v1.png"),
    path.join("assets", cluster.imageGroup, "hero-v1.png"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  return found ? `/${found.replace(/\\/g, "/")}` : `/assets/${cluster.imageGroup}/trust-v1.png`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [,, projectConfigPath, clusterConfigPath] = process.argv;

  if (!projectConfigPath || !clusterConfigPath) {
    console.error(
      "Usage: pnpm exec tsx src/generator/deployClusterPage.ts " +
      "<project-config.json> <cluster-config.json>"
    );
    process.exit(1);
  }

  const project = loadJson<ExtendedProjectConfig>(projectConfigPath);
  const cluster = loadJson<ClusterConfig>(clusterConfigPath);

  // ── Build AI inputs ──────────────────────────────────────────────────────
  const inputs: ClusterPageInputs = {
    brandName:          project.businessName,
    legalName:          project.footerCompanyName ?? project.businessName,
    serviceName:        cluster.service,
    location:           cluster.location,
    primaryKeyword:     cluster.primaryKeyword,
    supportingKeywords: cluster.supportingKeywords ?? [],
    ctaText:            project.primaryCtaText,
    ctaUrl:             project.primaryCtaUrl,
    hubUrl:             cluster.hubUrl,
    hubAnchor:          cluster.hubAnchor,
    relatedPages:       cluster.relatedPages ?? "",
    businessAddress:    project.businessAddress,
  };

  // ── Generate AI content ──────────────────────────────────────────────────
  const rawAi = await generateClusterContent(inputs);
  // TEMP TEST: refinement disabled
  let ai: NarrativeClusterPageContent = applyWebDesignNarrativePackage({
    content: rawAi,
    area: cluster.location,
    city: cluster.parentCity,
    serviceName: cluster.service,
    narrativeEngine: project.narrativeEngine,
  });
  ai = applyLocalSeoNarrativePackage({
    content: ai,
    area: cluster.location,
    city: cluster.parentCity,
    serviceName: cluster.service,
    narrativeEngine: project.narrativeEngine,
  });

  // ── Read cluster template ────────────────────────────────────────────────
  const templatePath = path.join(process.cwd(), "templates", "cluster.html");
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Cluster template not found at ${templatePath}`);
  }
  let html = fs.readFileSync(templatePath, "utf8");

  // ── Render helpers ───────────────────────────────────────────────────────
  const aiBullets  = ai.aiSummaryBullets.map((b) => `<li>${b}</li>`).join("\n        ");

  const faqHtml = ai.faq
    .slice(0, 4)
    .map(
      (item) =>
        `<div class="faq-card">\n          <h3 class="faq-q">${item.question}</h3>\n          <p class="faq-a">${item.answer}</p>\n        </div>`
    )
    .join("\n        ");

  const relatedResourcesHtml = renderCards(ai.relatedResources);

  const _navDomBase = (project.domain ?? "").replace(/\/+$/, "");
  const navItemsHtml = renderNavItems(
    project.navItems ?? [
      { label: "Home",     href: _navDomBase ? `${_navDomBase}/`          : "/" },
      { label: "Services", href: _navDomBase ? `${_navDomBase}/services/` : "/services/" },
      { label: "About",    href: _navDomBase ? `${_navDomBase}/about/`    : "/about/" },
      { label: "Contact",  href: project.primaryCtaUrl },
    ]
  );

  const footerAddress = project.businessAddress.replace(/, /g, "<br>");
  const footerCompany = project.footerCompanyName  ?? project.businessName;
  const footerNumber  = project.footerCompanyNumber ?? project.companyNumber ?? "";
  const footerYear    = String(new Date().getFullYear());

  const footerPhone = project.phone
    ? `<p><a href="tel:${project.phone.replace(/\s/g, "")}">${project.phone}</a></p>`
    : "";

  const footerLinksHtml = (project.footerLinks && project.footerLinks.length > 0)
    ? project.footerLinks.map((l) => `<p><a href="${l.href}">${l.label}</a></p>`).join("\n          ")
    : [
        `<p><a href="${project.privacyUrl ?? "/privacy-policy/"}">Privacy Policy</a></p>`,
        `<p><a href="${project.termsUrl   ?? "/terms/"}">Terms of Service</a></p>`,
        `<p><a href="${project.primaryCtaUrl}">Contact</a></p>`,
      ].join("\n          ");

  const footerServiceLinksHtml = (project.footerServiceLinks && project.footerServiceLinks.length > 0)
    ? project.footerServiceLinks.map((l) => `<p><a href="${l.href}">${l.label}</a></p>`).join("\n          ")
    : "";

  const footerAboutText = project.footerStrapline
    ?? project.strapline
    ?? `Professional digital services helping local businesses build a strong online presence.`;

  // ── Schema ───────────────────────────────────────────────────────────────────
  const pageUrl = `${project.domain.replace(/\/+$/, "")}${cluster.remotePath}`;

  const schemaLocalBusiness = JSON.stringify({
    "@context": "https://schema.org",
    "@type":    "LocalBusiness",
    "name":     project.businessName,
    "url":      project.domain,
    "telephone": project.phone || "",
    "email":    project.email || "",
    "address": {
      "@type":          "PostalAddress",
      "streetAddress":  project.businessAddress,
      "addressCountry": "GB",
    },
  });

  const schemaBreadcrumb = JSON.stringify({
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home",            "item": project.domain.replace(/\/+$/, "") + "/" },
      { "@type": "ListItem", "position": 2, "name": cluster.service,   "item": cluster.hubUrl },
      { "@type": "ListItem", "position": 3, "name": cluster.primaryKeyword, "item": pageUrl },
    ],
  });

  const schemaFaqScript = ai.faq?.length
    ? `<script type="application/ld+json">${JSON.stringify({
        "@context":   "https://schema.org",
        "@type":      "FAQPage",
        "mainEntity": ai.faq.slice(0, 4).map((item) => ({
          "@type":          "Question",
          "name":           item.question,
          "acceptedAnswer": { "@type": "Answer", "text": item.answer },
        })),
      })}</script>`
    : "";

  const heroImage       = resolveHeroImage(cluster);
  const trustImage      = resolveSplitImage(cluster);
  const supportImage    = resolveSplitImage(cluster);
  const conversionImage = resolveMidPageImage(cluster);
  // pageUrl already declared above with domain normalisation
  const schemaWebpage = JSON.stringify({
    "@context":    "https://schema.org",
    "@type":       "WebPage",
    "name":        cluster.primaryKeyword,
    "url":         pageUrl,
    "description": ai.aiSummaryIntro.slice(0, 155),
  });
  const schemaService = JSON.stringify({
    "@context":    "https://schema.org",
    "@type":       "Service",
    "name":        cluster.primaryKeyword,
    "serviceArea": { "@type": "Place", "name": cluster.location },
    "provider":    { "@type": "Organization", "name": project.businessName, "url": project.domain },
  });

  const metaTitle       = `${cluster.primaryKeyword} | ${project.businessName}`;
  const metaDescription = ai.aiSummaryIntro.slice(0, 155);
  const narrativeOverrides = (ai as NarrativeClusterPageContent).narrativeOverrides;
  const effectiveHeroHeading = narrativeOverrides?.heroHeading ?? cluster.primaryKeyword;
  const effectiveHeroIntro = narrativeOverrides?.heroIntro ?? ai.aiSummaryIntro;

  // ── Replace all placeholders ─────────────────────────────────────────────
  const replacements: Record<string, string> = {
    // SEO + Schema
    "{{META_TITLE}}":              metaTitle,
    "{{META_DESCRIPTION}}":        metaDescription,
    "{{CANONICAL_URL}}":           pageUrl,
    "{{SCHEMA_WEBPAGE}}":          schemaWebpage,
    "{{SCHEMA_SERVICE}}":          schemaService,
    "{{SCHEMA_LOCAL_BUSINESS}}":   schemaLocalBusiness,
    "{{SCHEMA_BREADCRUMB}}":       schemaBreadcrumb,
    "{{SCHEMA_FAQ}}":              schemaFaqScript,

    // Header / branding
    "{{BRAND_CSS}}":               "",
    "{{LOGO_URL}}":                project.logoUrl ?? "",
    "{{BUSINESS_NAME}}":           project.businessName,
    "{{NAV_ITEMS}}":               navItemsHtml,

    // Hero
    "{{H1}}":                      effectiveHeroHeading,
    "{{INTRO}}":                   effectiveHeroIntro,
    "{{CTA_URL}}":                 project.primaryCtaUrl,
    "{{CTA_TEXT}}":                project.primaryCtaText,
    "{{HERO_IMAGE}}":        heroImage,
    "{{TRUST_IMAGE}}":       trustImage,
    "{{SUPPORT_IMAGE}}":     supportImage,
    "{{CONVERSION_IMAGE}}":  conversionImage,

    // AI Summary
    "{{AI_SUMMARY_HEADING}}":      `What Does ${cluster.primaryKeyword} Do?`,
    "{{AI_SUMMARY_INTRO}}":        ai.aiSummaryIntro,
    "{{AI_SUMMARY_BULLETS}}":      aiBullets,

    // Fix #5: suppress duplicate AI answer block — ai-summary-section is the sole AI block
    "{{AI_ANSWER_BLOCK}}":         "",
    "{{AI_DEFINITION_BLOCKS}}":    "",
    "{{AI_CITABLE_BLOCKS}}":       "",
    "{{INTENT_CLUSTERS}}":         "",
    "{{ENTITY_BLOCK}}":            "",

    // Content-depth sections (optional — empty if AI doesn't supply them)
    "{{WHATS_INCLUDED}}":          "",
    "{{WHO_ITS_FOR}}":             "",
    "{{LOCAL_RELEVANCE}}":         "",
    "{{COMMON_MISTAKES}}":         "",

    // Section 1 — WHY
    "{{SECTION_1_HEADING}}":       ai.split1.heading,
    "{{SECTION_1_BODY}}":          paras(ai.split1.body),

    // Section 2 — WHAT YOU GET
    "{{SECTION_2_HEADING}}":       ai.split2.heading,
    "{{SECTION_2_BODY}}":          paras(ai.split2.body),

    // Enquiry section
    "{{ENQUIRY_SECTION_HEADING}}": ai.enquirySection?.heading
      ?? `How a website generates real enquiries for ${cluster.location} businesses`,
    ...(() => {
      const _enqBody = ai.enquirySection?.body
        ?? `A professional website works around the clock to generate enquiries for your business. Contact forms, click-to-call buttons, and clear calls-to-action reduce friction and make it easy for potential customers to reach you.\n\nTrust signals — including your local address, company registration details, client testimonials, and professional design — increase visitor confidence and conversion rates.\n\nFast page load speed keeps visitors engaged. A site that loads in under two seconds retains far more visitors than one that loads in four or five. Mobile responsiveness ensures that searchers on their phones — often the most ready to act — can navigate and contact you without frustration.`;
      const _enqSplit = splitParas(_enqBody, 1);
      return {
        "{{ENQUIRY_SECTION_BODY}}":   paras(_enqBody),
        "{{ENQUIRY_SECTION_LEAD}}":   _enqSplit.lead,
        "{{ENQUIRY_SECTION_DETAIL}}": _enqSplit.detail,
      };
    })(),

    // Competition section
    "{{COMPETITION_SECTION_HEADING}}": ai.competitionSection?.heading
      ?? `Local competition in ${cluster.location}: who is winning online and why`,
    "{{COMPETITION_SECTION_BODY}}":    paras(ai.competitionSection?.body
      ?? `Businesses across ${cluster.location} and surrounding areas are investing in professional websites to capture local search traffic. Trades, professional services, and retail businesses that appear at the top of search results for their service area are winning a disproportionate share of enquiries.\n\nThe opportunity gap is significant. Many local businesses still rely on word of mouth or outdated directory listings, leaving them invisible to the majority of potential customers who search online first.\n\nBusinesses that move early build domain authority, accumulate reviews, and establish visibility that takes competitors considerable time and investment to match.`),

    // No-website section
    "{{NO_WEBSITE_SECTION_HEADING}}":  ai.noWebsiteSection?.heading
      ?? `What happens to ${cluster.location} businesses without a proper website`,
    "{{NO_WEBSITE_SECTION_BODY}}":     paras(ai.noWebsiteSection?.body
      ?? `Most people searching for a ${cluster.service} in ${cluster.location} will click one of the top results and never look further. A business without a visible web presence is simply not in the conversation.\n\nFirst impressions matter enormously. Visitors form a credibility judgement within seconds of landing on a page. A slow, outdated, or mobile-unfriendly site actively pushes potential customers away before they read a single word.\n\nDelaying a proper web presence compounds the problem. Competitors gain more visibility, more reviews, and more trust every month. The cost of catching up increases every day.`),

    // About section
    "{{ABOUT_HEADING}}":           project.businessName,
    "{{ABOUT_BODY_1}}":            project.strapline
                                     ?? `${project.businessName} is a professional digital agency helping local businesses build a strong online presence.`,
    "{{ABOUT_BODY_2}}":            project.shortDescription
                                     ?? `Every solution we deliver is designed to perform, generate enquiries, and support long-term business growth.`,

    // Related Resources
    "{{RELATED_RESOURCES}}":       relatedResourcesHtml,

    // FAQ
    "{{FAQ_ITEMS}}":               faqHtml,

    // CTA
    "{{CTA_HEADING}}":             narrativeOverrides?.ctaHeading ?? ai.cta.heading,
    "{{CTA_BODY}}":                narrativeOverrides?.ctaBody ?? ai.cta.body,

    "{{MONEY_PAGE_LINK_SECTION}}": project.isHub
      ? buildMoneyPageSection(project.moneyPageUrl, project.moneyPageKeyword)
      : "",
    "{{MAP_EMBED_URL}}":           project.mapEmbedUrl
      || `https://www.openstreetmap.org/export/embed.html?bbox=-1.3693%2C53.4115%2C-1.3393%2C53.4415&layer=mapnik`,
    "{{MAP_IFRAME_TITLE}}":        `${project.businessName} — ${project.businessAddress}`,

    // Trust Strip
    "{{TRUST_STRIP}}":             ai.trustStrip,

    // Footer
    "{{FOOTER_COMPANY_NAME}}":     footerCompany,
    "{{FOOTER_ADDRESS}}":          footerAddress,
    "{{FOOTER_PHONE}}":            footerPhone,
    "{{FOOTER_EMAIL}}":            project.email,
    "{{FOOTER_COMPANY_NUMBER}}":   footerNumber,
    "{{FOOTER_YEAR}}":             footerYear,
    "{{FOOTER_LINKS_HTML}}":       footerLinksHtml,
    "{{FOOTER_SERVICE_LINKS_HTML}}": footerServiceLinksHtml,
    "{{FOOTER_ABOUT_TEXT}}":       footerAboutText,
    "{{WHITE_LABEL_FOOTER_LINE}}": project.whiteLabelPoweredBy === true
      ? " &ndash; Powered by InboxingProWeb"
      : "",

    // Legacy tokens still present in some template variants
    "{{PRIVACY_URL}}":             project.privacyUrl  ?? "/privacy-policy/",
    "{{TERMS_URL}}":               project.termsUrl    ?? "/terms/",
  };

  for (const [token, value] of Object.entries(replacements)) {
    html = html.split(token).join(value);
  }

  // ── Write rendered file ──────────────────────────────────────────────────
  const slug    = cluster.remotePath.replace(/\//g, "").trim() || "cluster";
  const outDir  = path.join("output", project.clientSlug, slug);
  const outFile = path.join(outDir, "index.html");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, html, "utf8");
  console.log(`\nRendered → ${outFile}  (${fs.statSync(outFile).size.toLocaleString()} bytes)`);

  // ── FTP upload ───────────────────────────────────────────────────────────
  const { user, password, host, port, remoteRoot } = resolveDeploySettings(project.deploy);
  const ftpClient = new ftp.Client();
  ftpClient.ftp.verbose = false;

  const remoteDest = [remoteRoot, cluster.remotePath, "index.html"]
    .join("/")
    .replace(/\/+/g, "/");

  console.log(`Uploading to ${host}:${port}…`);
  await ftpClient.access({ host, port, user, password, secure: true, secureOptions: { rejectUnauthorized: false } });
  await ftpClient.ensureDir(path.dirname(remoteDest));
  await ftpClient.uploadFrom(outFile, remoteDest);
  ftpClient.close();

  console.log(`\n  ✅  Uploaded: ${remoteDest}`);
  console.log(`  Live at:   ${pageUrl}`);
  console.log(`\n  ── Masked credentials ───────────────────`);
  console.log(`  User: ${maskUser(user)}`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
