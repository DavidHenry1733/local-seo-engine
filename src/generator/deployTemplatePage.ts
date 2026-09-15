/**
 * deployTemplatePage.ts
 *
 * Step 1: Calls AI generator to produce structured section content.
 * Step 2: Renders templates/index.html by injecting all content.
 * Step 3: Uploads the rendered page as root index.html via FTP.
 *
 * Usage:
 *   pnpm exec tsx src/generator/deployTemplatePage.ts config/projects/<config>.json
 */

import fs from "node:fs";
import path from "node:path";
import * as ftp from "basic-ftp";
import { ProjectConfig, DeployConfig } from "./types";
import { buildAreaPlan } from "./buildAreaPlan";
import { buildPagePayload } from "./buildPagePayload";
import { generatePageContent, PageInputs } from "./generatePageContent";
import { refineHubContent }               from "./refineContent";
import { resolveCTA, buildCTASection, type CTAConfig } from "./ctaBlock.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtendedConfig extends ProjectConfig {
  footerCompanyName?:  string;
  footerCompanyNumber?: string;
  logoUrl?:            string;
  privacyUrl?:         string;
  termsUrl?:           string;
  navItems?:           { label: string; href: string }[];
  ctaConfig?:          CTAConfig;
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
    host:       process.env.DEPLOY_HOST        ?? deploy.host,
    port:       process.env.DEPLOY_PORT        ? Number(process.env.DEPLOY_PORT) : deploy.port,
    remoteRoot: process.env.DEPLOY_REMOTE_ROOT ?? deploy.remoteRoot,
  };
}

function buildMoneyPageSection(url?: string, keyword?: string): string {
  if (!url || !keyword) return "";
  return `<section class="money-page-band"><div class="container"><p>For professional <a href="${url}">${keyword}</a> services tailored to local businesses, visit our dedicated page.</p></div></section>`;
}

function paras(body: string): string {
  if (!body) return "";
  return body
    .split(/\n\n+/)
    .map((p) => `<p>${p.trim()}</p>`)
    .join("\n        ");
}

function renderProcessSteps(steps: { title: string; description: string }[]): string {
  return steps
    .map(
      (step, i) =>
        `<div class="process-step">
          <div class="process-step-num">${i + 1}</div>
          <div class="process-step-content">
            <h3>${step.title}</h3>
            <p>${step.description}</p>
          </div>
        </div>`
    )
    .join("\n        ");
}

function renderInternalLinks(links: { href: string; text: string; description?: string }[]): string {
  return links
    .map((l) => {
      const desc = l.description
        ? `\n          <p>${l.description}</p>`
        : "";
      return `<a class="resource-card" href="${l.href}">\n          <h3>${l.text}</h3>${desc}\n        </a>`;
    })
    .join("\n        ");
}

function renderNavItems(items: { label: string; href: string }[]): string {
  return items
    .map((n) => `<a href="${n.href}">${n.label}</a>`)
    .join("\n        ");
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    throw new Error(
      "Usage: pnpm exec tsx src/generator/deployTemplatePage.ts config/projects/<config>.json"
    );
  }

  const project = loadJson<ExtendedConfig>(configPath);
  if (!project.deploy) throw new Error("No deploy config found.");

  // ── Build Sheffield hub payload (for SEO meta, schema, images, FAQ) ────────
  const firstCluster = (project.areaConfigs?.[0] ?? (project as any).areaConfig) as string;
  if (!firstCluster) throw new Error("No areaConfig(s) found in project config.");

  const plan    = buildAreaPlan(project, firstCluster);
  const hubPage = plan.find((p) => p.pageRole === "hub");
  if (!hubPage) throw new Error("No hub page found in cluster plan.");

  const payload = buildPagePayload(project, hubPage, plan);

  // ── Build AI content generation inputs ────────────────────────────────────
  const clusterPages = plan
    .filter((p) => p.pageRole !== "hub")
    .slice(0, 4)
    .map((p) => ({ href: `/${p.slug}/`, label: `${p.serviceLabel} ${p.location}` }));

  const pageInputs: PageInputs = {
    brandName:          project.businessName,
    legalName:          project.footerCompanyName ?? project.businessName,
    serviceName:        hubPage.serviceLabel,
    location:           hubPage.location,
    primaryKeyword:     `${hubPage.serviceLabel} ${hubPage.location}`,
    supportingKeywords: ["website design", "local SEO", "mobile-friendly website", "web agency"],
    ctaText:            project.primaryCtaText,
    ctaUrl:             project.primaryCtaUrl,
    hubUrl:             `${project.domain}/`,
    hubAnchor:          `${hubPage.serviceLabel} ${hubPage.location} — hub`,
    clusterPages,
    businessAddress:    project.businessAddress,
  };

  // ── Generate AI content ───────────────────────────────────────────────────
  const rawAi = await generatePageContent(pageInputs);
  // TEMP TEST: refinement disabled
  const ai = rawAi;

  // ── Read master template ──────────────────────────────────────────────────
  const templatePath = path.join(process.cwd(), "templates", "index.html");
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Master template not found at ${templatePath}`);
  }
  let html = fs.readFileSync(templatePath, "utf8");

  // ── Build all rendered values ─────────────────────────────────────────────
  const aiBullets = ai.aiSummaryBullets
    .map((b) => `<li>${b}</li>`)
    .join("\n        ");

  const faqHtml = ai.faq
    .map(
      (item) =>
        `<div class="faq-card">
          <h3 class="faq-q">${item.question}</h3>
          <p class="faq-a">${item.answer}</p>
        </div>`
    )
    .join("\n        ");

  const processStepsHtml = renderProcessSteps(ai.process.steps);
  const internalLinksHtml = renderInternalLinks(ai.internalLinks);

  const _navDomBase = (project.domain ?? "").replace(/\/+$/, "");
  const navItemsHtml = renderNavItems(
    project.navItems ?? [
      { label: "Home",       href: _navDomBase ? `${_navDomBase}/`          : "/" },
      { label: "Services",   href: _navDomBase ? `${_navDomBase}/services/` : "/services/" },
      { label: "About",      href: _navDomBase ? `${_navDomBase}/about/`    : "/about/" },
      { label: "Contact Us", href: project.primaryCtaUrl },
    ]
  );

  const footerAddress  = project.businessAddress.replace(/, /g, "<br>");
  const footerCompany  = project.footerCompanyName  ?? project.businessName;
  const footerNumber   = project.footerCompanyNumber ?? "";
  const footerYear     = String(new Date().getFullYear());
  const schemaWebpage  = JSON.stringify(payload.schema[0] ?? {});
  const schemaService  = JSON.stringify(payload.schema[1] ?? {});

  // ── Replace all placeholders ──────────────────────────────────────────────
  const replacements: Record<string, string> = {
    // SEO + Schema
    "{{META_TITLE}}":              payload.metaTitle,
    "{{META_DESCRIPTION}}":        payload.metaDescription,
    "{{CANONICAL_URL}}":           `${project.domain}/`,
    "{{SCHEMA_WEBPAGE}}":          schemaWebpage,
    "{{SCHEMA_SERVICE}}":          schemaService,

    // Header
    "{{LOGO_URL}}":                project.logoUrl ?? "",
    "{{BUSINESS_NAME}}":           project.businessName,
    "{{NAV_ITEMS}}":               navItemsHtml,

    // Hero
    "{{H1}}":                      payload.h1,
    "{{INTRO}}":                   payload.intro,
    "{{CTA_URL}}":                 project.primaryCtaUrl,
    "{{CTA_TEXT}}":                project.primaryCtaText,
    "{{HERO_IMAGE}}":              `/${payload.images.hero}`,

    // Image 2 — full-width block
    "{{IMAGE_2}}":                 `/${payload.images.support}`,

    // Image 3 — split image + text
    "{{IMAGE_3}}":                 `/${payload.images.conversion}`,
    "{{IMAGE_3_HEADING}}":         ai.image3?.heading ?? "",
    "{{IMAGE_3_BODY}}":            paras(ai.image3?.body ?? ""),

    // AI Summary (section 3)
    "{{AI_SUMMARY_HEADING}}":      `What Does ${hubPage.serviceLabel} ${hubPage.location} Do?`,
    "{{AI_SUMMARY_INTRO}}":        ai.aiSummaryIntro,
    "{{AI_SUMMARY_BULLETS}}":      aiBullets,

    // Split sections 1 & 2
    "{{SECTION_1_HEADING}}":       ai.split1.heading,
    "{{SECTION_1_BODY}}":          paras(ai.split1.body),
    "{{SECTION_2_HEADING}}":       ai.split2.heading,
    "{{SECTION_2_BODY}}":          paras(ai.split2.body),

    // About (section 6) — uses BUSINESS_NAME + FOOTER_COMPANY_NAME, no extra placeholders

    // Definition (section 7)
    "{{DEFINITION_HEADING}}":      ai.definition.heading,
    "{{DEFINITION_BODY}}":         paras(ai.definition.body),

    // Process (section 8)
    "{{PROCESS_HEADING}}":         ai.process.heading,
    "{{PROCESS_STEPS}}":           processStepsHtml,

    // Local Relevance (section 9)
    "{{LOCAL_RELEVANCE_HEADING}}": ai.localRelevance.heading,
    "{{LOCAL_RELEVANCE_BODY}}":    paras(ai.localRelevance.body),

    // Internal Links (section 10)
    "{{INTERNAL_LINKS}}":          internalLinksHtml,

    // FAQ (section 11)
    "{{FAQ_ITEMS}}":               faqHtml,

    // CTA (section 12) — dynamic, service-type-aware
    "{{CTA_SECTION}}": (() => {
      const resolved = resolveCTA({
        service:       hubPage.serviceLabel,
        location:      hubPage.location,
        industryType:  (project as any).industryType,
        config:        project.ctaConfig ?? {},
        primaryCtaUrl: project.primaryCtaUrl,
        phone:         project.phone,
      });
      return buildCTASection(resolved);
    })(),

    "{{MONEY_PAGE_LINK_SECTION}}":     buildMoneyPageSection(project.moneyPageUrl, project.moneyPageKeyword),
    // Map embed — prefer explicit mapEmbedUrl; fallback to OSM (never Google Maps)
    "{{MAP_EMBED_URL}}":           project.mapEmbedUrl || `https://www.openstreetmap.org/export/embed.html?bbox=-1.3693%2C53.4115%2C-1.3393%2C53.4415&layer=mapnik`,

    // Trust Strip (section 13)
    "{{TRUST_STRIP}}":             ai.trustStrip,

    // Footer
    "{{FOOTER_ADDRESS}}":          footerAddress,
    "{{FOOTER_EMAIL}}":            project.email,
    "{{FOOTER_COMPANY_NAME}}":     footerCompany,
    "{{FOOTER_COMPANY_NUMBER}}":   footerNumber,
    "{{FOOTER_YEAR}}":             footerYear,
    "{{PRIVACY_URL}}":             (project as any).privacyUrl ?? "/privacy-policy/",
    "{{TERMS_URL}}":               (project as any).termsUrl   ?? "/terms/",
  };

  for (const [token, value] of Object.entries(replacements)) {
    html = html.split(token).join(value);
  }

  // ── Write rendered file ───────────────────────────────────────────────────
  const outDir  = path.join("output", project.clientSlug);
  const outFile = path.join(outDir, "index.html");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, html, "utf8");
  console.log(`\nRendered → ${outFile}  (${fs.statSync(outFile).size.toLocaleString()} bytes)`);

  // ── FTP upload ────────────────────────────────────────────────────────────
  const { user, password, host, port, remoteRoot } = resolveDeploySettings(project.deploy);
  const client = new ftp.Client();
  client.ftp.verbose = false;

  console.log(`Uploading to ${host}:${port}…`);
  await client.access({ host, port, user, password, secure: false });

  const remoteDest = [remoteRoot, "index.html"].join("/").replace(/\/+/g, "/");
  await client.uploadFrom(outFile, remoteDest);
  client.close();

  console.log(`\n  ✅  Uploaded: ${remoteDest}`);
  console.log(`  Live at:   ${project.domain}/`);
  console.log(`\n  ── Masked credentials ───────────────────`);
  console.log(`  User: ${maskUser(user)}`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
