/**
 * sectionOptimise.ts — POST /api/section-optimise
 *
 * Applies targeted, section-only AI optimisations to generated pages.
 * Never rewrites the whole page — only the affected section is replaced.
 *
 * Actions:
 *   improve-local-relevance   — rewrites .local-relevance-section via AI
 *   improve-service-relevance — rewrites #split-section-one via AI
 *   increase-variation        — rewrites #ai-summary-section via AI
 *   generate-related-services — rebuilds #related-services-section from session
 *   generate-areas-we-cover   — rebuilds #areas-we-cover-section from session
 */

import { Router }  from "express";
import fs          from "node:fs";
import path        from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI      from "openai";
import { scoreAiReadiness } from "../../../../../src/generator/aiReadinessScore.js";

const __filename     = fileURLToPath(import.meta.url);
const __dirname      = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");

const router = Router();

// ── OpenAI client ──────────────────────────────────────────────────────────────

function getAiClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) throw new Error("Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY");
  return new OpenAI({ baseURL, apiKey });
}

// ── Section extraction helpers ─────────────────────────────────────────────────

interface SectionSlice {
  content: string;
  start:   number;
  end:     number;
}

/**
 * Find a <section...> block by attribute pattern (id="..." or class="...").
 * Uses simple depth tracking to find the matching </section>.
 */
function extractSection(html: string, attrPattern: string): SectionSlice | null {
  const idx = html.indexOf(attrPattern);
  if (idx === -1) return null;

  const tagStart = html.lastIndexOf("<", idx);
  if (tagStart === -1) return null;

  // Track nested <section> depth
  let depth = 0;
  let pos   = tagStart;

  while (pos < html.length) {
    const nextOpen  = html.indexOf("<section", pos + 1);
    const nextClose = html.indexOf("</section>", pos + 1);

    if (nextClose === -1) return null; // malformed

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen;
    } else {
      if (depth === 0) {
        const end = nextClose + "</section>".length;
        return { content: html.slice(tagStart, end), start: tagStart, end };
      }
      depth--;
      pos = nextClose;
    }
  }
  return null;
}

function replaceSlice(html: string, slice: SectionSlice, newContent: string): string {
  return html.slice(0, slice.start) + newContent + html.slice(slice.end);
}

// ── Session helpers ────────────────────────────────────────────────────────────

interface SessionDef {
  area?:       string;
  tier?:       string;
  remotePath?: string;
}

interface SessionData {
  campaign?:        Record<string, unknown>;
  selectedAreaDefs?: SessionDef[];
}

function loadPageData(clientDir: string, areaDir: string): Record<string, unknown> {
  const p = path.join(clientDir, areaDir, "page-data.json");
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>; }
  catch { return {}; }
}

function findSessionForPage(clientDir: string, campaignId: string): SessionData | null {
  const sessionsDir = path.join(clientDir, "sessions");
  if (!fs.existsSync(sessionsDir)) return null;

  for (const file of fs.readdirSync(sessionsDir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const d = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), "utf8")) as Record<string, unknown>;
      if (d.campaignId === campaignId) return d as SessionData;
    } catch { /* skip */ }
  }
  return null;
}

// ── Template builders (mirror renderClusterPage.ts logic) ─────────────────────

const SERVICE_LABELS: Record<string, string> = {
  web_design:       "Web Design",
  local_seo:        "Local SEO",
  website_hosting:  "Web Hosting",
  email_marketing:  "Email Marketing",
};

const SERVICE_DESCRIPTIONS: Record<string, (loc: string) => string> = {
  web_design:      (loc) => `Professional websites built to generate real enquiries for ${loc} businesses. Designed to load fast, rank well, and convert visitors into customers.`,
  local_seo:       (loc) => `Improve your visibility in ${loc} search results with a targeted local SEO strategy that puts your business in front of customers ready to buy.`,
  website_hosting: (loc) => `Reliable, managed hosting for ${loc} businesses. Fast load speeds, daily backups, security monitoring, and full support included.`,
  email_marketing: (loc) => `Targeted email campaigns that keep ${loc} customers engaged, drive repeat business, and complement your wider marketing strategy.`,
};

function buildRelatedServicesSection(
  hubInternalLinks: { href: string; service: string; location: string }[],
  city: string,
): string {
  if (hubInternalLinks.length === 0) return "";
  const CORE_KEYS = new Set(["web_design", "local_seo", "website_hosting", "email_marketing"]);
  const cards = hubInternalLinks.filter((l) => CORE_KEYS.has(l.service)).map((l) => {
    const label  = SERVICE_LABELS[l.service] ?? l.service;
    const descFn = SERVICE_DESCRIPTIONS[l.service];
    const desc   = descFn ? descFn(l.location) : `${label} services for businesses across ${l.location}.`;
    return `
      <div class="rsl-item">
        <h3 class="rsl-title">${label} ${l.location}</h3>
        <p class="rsl-desc">${desc}</p>
        <a class="rsl-cta" href="${l.href}">View ${label} ${l.location}</a>
      </div>`;
  });
  if (cards.length === 0) return "";
  const intro = `You may also find these related services useful if you want to strengthen your online presence, improve visibility, and generate more enquiries in ${city}.`;
  return `
  <section id="related-services-section" class="section-band section-band--alt">
    <div class="wrap">
      <h2>Related Services</h2>
      <p class="related-services-intro">${intro}</p>
      <div class="rsl-grid">${cards.join("")}
      </div>
    </div>
  </section>`;
}

function buildAreasWeCoverSection(
  areas: { href: string; label: string }[],
  serviceName: string,
  city: string,
): string {
  if (areas.length === 0) return "";
  const svc   = serviceName;
  const intro = `We also provide ${svc.toLowerCase()} support across nearby ${city} areas, helping local businesses create better campaigns and generate more enquiries.`;
  const cards = areas.map((a) =>
    `<a class="resource-card" href="${a.href}">\n          <h3>${a.label}</h3><p>Local ${svc.toLowerCase()} support for businesses in ${a.label.replace(svc + " ", "")}.</p>\n        </a>`,
  ).join("\n        ");
  return `
  <section id="areas-we-cover-section" class="section-band">
    <div class="wrap">
      <h2>${svc} Areas We Cover</h2>
      <p class="related-services-intro">${intro}</p>
      <div class="resource-card-grid">
        ${cards}
      </div>
    </div>
  </section>`;
}

/** Inject section HTML before #cta-section (or at end of body if not found). */
function injectOrReplace(html: string, sectionId: string, newSection: string): string {
  // Try to replace existing section
  const existing = extractSection(html, `id="${sectionId}"`);
  if (existing) return replaceSlice(html, existing, newSection);

  // Inject before cta-section
  const ctaMarker = '<section id="cta-section"';
  if (html.includes(ctaMarker)) return html.replace(ctaMarker, newSection + "\n  " + ctaMarker);

  // Fallback: inject before </body>
  return html.replace("</body>", newSection + "\n</body>");
}

// ── AI section rewrite ─────────────────────────────────────────────────────────

async function aiRewriteSection(
  sectionHtml: string,
  instruction: string,
): Promise<string> {
  const client = getAiClient();

  const systemPrompt = `You are an expert local SEO content writer. You improve specific sections of local service pages.

STRICT RULES:
- Keep ALL HTML tags, CSS classes, and attribute values EXACTLY as they are
- Only improve the TEXT content between HTML tags
- Keep approximately the same length (within 20%)
- Do NOT add new HTML elements or CSS classes not already present
- Return ONLY the complete rewritten HTML section — no preamble, no explanation`;

  const userPrompt = `${instruction}

CURRENT SECTION HTML:
${sectionHtml}

Return ONLY the complete rewritten HTML section.`;

  const response = await client.chat.completions.create({
    model:      "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens:  2000,
  });

  const result = response.choices[0]?.message?.content?.trim() ?? "";
  if (!result || !result.includes("<section")) {
    throw new Error("AI returned invalid section HTML");
  }
  return result;
}

// ── Action handlers ────────────────────────────────────────────────────────────

async function handleImproveLocalRelevance(
  html: string,
  pageData: Record<string, unknown>,
): Promise<string> {
  const slice = extractSection(html, 'class="local-relevance-section"');
  if (!slice) throw new Error("local-relevance-section not found in page HTML");

  const location    = (pageData.location as string) ?? "the local area";
  const service     = (pageData.service  as string) ?? "this service";
  const nearbyAreas = (pageData.nearbyAreas as string[] | undefined) ?? [];

  const instruction = `Improve the LOCAL RELEVANCE of this section for "${service}" in "${location}".

Requirements:
- Mention "${location}" at least 3–4 times naturally throughout the section
- Reference 2–3 nearby areas${nearbyAreas.length > 0 ? ` (use some of: ${nearbyAreas.slice(0, 5).join(", ")})` : ""}
- Include local search behaviour language (e.g. "searching online", "Google", "local businesses")
- Add community or area-specific context that makes this feel genuinely local
- Keep all HTML structure, classes, and section attributes identical`;

  return aiRewriteSection(slice.content, instruction);
}

async function handleImproveServiceRelevance(
  html: string,
  pageData: Record<string, unknown>,
): Promise<string> {
  const slice = extractSection(html, 'id="split-section-one"');
  if (!slice) throw new Error("split-section-one not found in page HTML");

  const location = (pageData.location as string) ?? "the local area";
  const service  = (pageData.service  as string) ?? "this service";
  const keyword  = (pageData.targetKeyword as string) ?? service;

  const instruction = `Improve the SERVICE RELEVANCE of this section for "${service}" in "${location}".

Requirements:
- Mention "${keyword}" naturally in the first 1–2 sentences
- Include 4–6 service-specific technical terms or outcomes (not generic business language)
- Add 2–3 specific pain points that "${location}" businesses face without this service
- Include outcome-driven language: what results does this service deliver?
- Keep all HTML structure, classes, and section attributes identical`;

  return aiRewriteSection(slice.content, instruction);
}

async function handleIncreaseVariation(
  html: string,
  pageData: Record<string, unknown>,
): Promise<string> {
  const slice = extractSection(html, 'id="ai-summary-section"');
  if (!slice) throw new Error("ai-summary-section not found in page HTML");

  const location = (pageData.location as string) ?? "the local area";
  const service  = (pageData.service  as string) ?? "this service";

  const instruction = `Vary the phrasing and structure of this AI summary section for "${service}" in "${location}".

Requirements:
- Keep the same factual content and information
- Vary the sentence openings — avoid starting multiple sentences the same way
- Use different vocabulary for key concepts (avoid repeating the same phrase >2 times)
- Keep the Quick Answer structure: H2 question → "Quick Answer" label → answer paragraph → bullet list
- Make the intro paragraph feel fresh and different from a generic template
- Keep all HTML structure, classes, section IDs, and attributes identical`;

  return aiRewriteSection(slice.content, instruction);
}

function handleGenerateRelatedServices(
  html:       string,
  pageData:   Record<string, unknown>,
  session:    SessionData | null,
  clientDir:  string,
): string {
  const city    = (pageData.location as string) ?? "";
  const service = (pageData.service  as string) ?? "";

  // Build hub internal links by scanning all sessions for the same city
  const hubLinks: { href: string; service: string; location: string }[] = [];
  const sessionsDir = path.join(clientDir, "sessions");
  const campaignId  = (pageData.campaignId as string) ?? "";

  if (fs.existsSync(sessionsDir)) {
    const cityLower = city.toLowerCase();
    for (const file of fs.readdirSync(sessionsDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const d = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), "utf8")) as Record<string, unknown>;
        if (d.campaignId === campaignId) continue; // skip current campaign

        const camp = d.campaign as Record<string, unknown> | undefined;
        if (!camp?.cityName) continue;
        if ((camp.cityName as string).toLowerCase() !== cityLower) continue;

        const defs = (d.selectedAreaDefs as SessionDef[] | undefined) ?? [];
        const hubDef = defs.find((x) => x.tier === "hub");
        if (!hubDef?.remotePath) continue;

        const svcName  = (camp.serviceName as string) ?? "";
        const cityName = camp.cityName as string;
        const citySlug = cityName.toLowerCase().replace(/\s+/g, "-");
        const rawSvc   = svcName.toLowerCase().trim();
        const svcStripped = rawSvc.endsWith(citySlug)
          ? rawSvc.slice(0, rawSvc.length - citySlug.length).trim()
          : rawSvc;
        const svcSlug  = svcStripped.replace(/\s+/g, "-").replace(/-+$/, "");
        const svcKey   = svcSlug.replace(/-/g, "_").replace(/^web_hosting$/, "website_hosting");

        const CORE_KEYS = new Set(["web_design", "local_seo", "website_hosting", "email_marketing"]);
        if (!CORE_KEYS.has(svcKey)) continue;

        hubLinks.push({
          href:     hubDef.remotePath,
          service:  svcKey,
          location: cityName,
        });
      } catch { /* skip */ }
    }
  }

  if (hubLinks.length === 0) {
    throw new Error(`No other hub pages found for city "${city}" — ensure other service campaigns are set up first`);
  }

  const sectionHtml = buildRelatedServicesSection(hubLinks, city);
  if (!sectionHtml) throw new Error("Could not build Related Services section — no matching core services found");

  return injectOrReplace(html, "related-services-section", sectionHtml);
}

function handleGenerateAreasWeCover(
  html:     string,
  pageData: Record<string, unknown>,
  session:  SessionData | null,
): string {
  const service = (pageData.service  as string) ?? "This Service";
  const city    = (pageData.location as string) ?? "";
  const selfPath = (pageData.remotePath as string) ?? "";

  const defs     = session?.selectedAreaDefs ?? [];
  const selfNorm = selfPath.replace(/\/+$/, "");

  const areas = defs
    .filter((d) => d.tier !== "hub" && d.remotePath)
    .filter((d) => {
      const hrefPath = (d.remotePath ?? "").replace(/\/+$/, "");
      return hrefPath !== selfNorm;
    })
    .map((d) => ({
      href:  d.remotePath as string,
      label: `${service} ${d.area ?? ""}`,
    }));

  if (areas.length === 0) {
    throw new Error("No cluster area pages found in this campaign session — ensure cluster areas have been generated first");
  }

  const sectionHtml = buildAreasWeCoverSection(areas, service, city);
  return injectOrReplace(html, "areas-we-cover-section", sectionHtml);
}

// ── Main endpoint ─────────────────────────────────────────────────────────────

type OptimiseAction =
  | "improve-local-relevance"
  | "improve-service-relevance"
  | "improve-intent-coverage"
  | "increase-variation"
  | "generate-related-services"
  | "generate-areas-we-cover";

const VALID_ACTIONS: Set<string> = new Set([
  "improve-local-relevance",
  "improve-service-relevance",
  "improve-intent-coverage",
  "increase-variation",
  "generate-related-services",
  "generate-areas-we-cover",
]);

const ACTION_LABELS: Record<OptimiseAction, string> = {
  "improve-local-relevance":   "Local Relevance Improved",
  "improve-service-relevance": "Service Relevance Improved",
  "improve-intent-coverage": "Intent Coverage Improved",
  "increase-variation":        "Content Variation Increased",
  "generate-related-services": "Related Services Section Generated",
  "generate-areas-we-cover":   "Areas We Cover Section Generated",
};

function soText(v: unknown, fallback = ""): string {
  return String(v ?? fallback).trim();
}

function soEsc(v: unknown): string {
  return soText(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function deriveServiceArea(pageData: Record<string, unknown>) {
  const raw = soText(pageData.areaDir || pageData.slug || pageData.pageSlug || "");
  const parts = raw.split("-").filter(Boolean);

  const towns = ["doncaster", "barnsley", "sheffield", "rotherham"];
  const town = parts.find(p => towns.includes(p.toLowerCase())) || soText(pageData.area || pageData.location || "your area");

  const serviceParts = parts.filter(p => p.toLowerCase() !== town.toLowerCase());
  const title = (words: string[]) => words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return {
    area: soText(pageData.area || pageData.location || title([town]) || "your area"),
    service: soText(pageData.serviceName || pageData.mainService || pageData.primaryKeyword || title(serviceParts) || "this service"),
  };
}

function buildIntentCoverageSection(pageData: Record<string, unknown>): string {
  const derived = deriveServiceArea(pageData);
  const area = soEsc(derived.area);
  const service = soEsc(derived.service);

  return `
<section class="cluster-intent-clusters" id="cluster-intent-clusters">
  <div class="cluster-container">
    <h2>Common Questions About ${service} in ${area}</h2>
    <p class="cluster-intent-intro">These answers are designed to help local customers quickly understand pricing, process, suitability, and comparison points before choosing a provider. They also give search engines and AI answer systems a clearer picture of what the page covers, who it helps, and why the service is relevant locally.</p>

    <div class="cluster-intent-item">
      <h3>How much does ${service} cost in ${area}?</h3>
      <div class="cluster-intent-answer">
        <p>The cost of ${service} in ${area} depends on the type of work required, the size of the project, the level of preparation involved, and whether the customer needs a simple setup or a more complete service. A basic requirement will usually be quicker and more affordable, while a larger or more detailed project may need extra planning, content, design, technical checks, or follow-up support. The most useful approach is to start with a clear review of what is needed, then provide a practical recommendation based on the customer’s goals, budget, and timescale. This helps avoid unnecessary extras while making sure the final result is suitable, reliable, and ready to support local enquiries.</p>
      </div>
    </div>

    <div class="cluster-intent-item">
      <h3>What is the process for getting ${service} in ${area}?</h3>
      <div class="cluster-intent-answer">
        <p>The usual process starts with understanding the customer’s current situation, what they want to improve, and what outcome they need from the service. After that, the main requirements are reviewed so the right solution can be planned properly. This may include checking existing content, technical setup, local competition, branding, customer journey, or the way enquiries are currently handled. Once the plan is agreed, the work is completed in clear stages so the customer can see progress and understand what has been changed. The final stage is normally a review, testing, and any practical recommendations for next steps, so the service continues to support the business after the initial work is finished.</p>
      </div>
    </div>

    <div class="cluster-intent-item">
      <h3>Why choose a local provider for ${service} in ${area}?</h3>
      <div class="cluster-intent-answer">
        <p>Choosing a provider with local knowledge can make the service more relevant because the work can be shaped around the area, the audience, and the way customers actually search before making contact. Local understanding helps with clearer messaging, better service positioning, more realistic expectations, and stronger relevance for nearby customers. It also makes it easier to reflect the towns, neighbourhoods, and practical buying signals that matter in the local market. For businesses that rely on calls, enquiries, bookings, or visits from nearby customers, this local focus can make the final result more useful than a generic approach that could apply to any business in any location.</p>
      </div>
    </div>

    <div class="cluster-intent-item">
      <h3>How does ${service} compare with doing it yourself?</h3>
      <div class="cluster-intent-answer">
        <p>Doing the work yourself can seem attractive at first, especially when trying to keep costs low, but it can also take more time than expected and may lead to gaps that affect performance later. A professional service gives the customer a more structured approach, clearer technical checks, stronger local relevance, and a finished result that is easier to trust. It can also help avoid common issues such as thin content, weak calls to action, poor structure, missing search signals, broken links, unclear service messaging, or pages that do not properly answer customer questions. For many local businesses, the biggest benefit is speed and confidence: the work is completed properly while the business owner stays focused on running the business.</p>
      </div>
    </div>
  </div>
</section>`;
}

function handleImproveIntentCoverage(html: string, pageData: Record<string, unknown>): string {
  const newSection = buildIntentCoverageSection(pageData);

  const existing = html.match(/<section[^>]*class="[^"]*cluster-intent-clusters[^"]*"[\s\S]*?<\/section>/i)?.[0];
  if (existing) return html.replace(existing, newSection);

  const aiSummary = html.match(/<section[^>]*id="ai-summary-section"[\s\S]*?<\/section>/i)?.[0];
  if (aiSummary) return html.replace(aiSummary, aiSummary + "\n" + newSection);

  const splitOne = html.match(/<section[^>]*id="split-section-one"[\s\S]*?<\/section>/i)?.[0];
  if (splitOne) return html.replace(splitOne, splitOne + "\n" + newSection);

  if (/<\/main>/i.test(html)) {
    return html.replace(/<\/main>/i, newSection + "\n</main>");
  }

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, newSection + "\n</body>");
  }

  return html + "\n" + newSection;
}


router.post("/section-optimise", async (req, res) => {
  const { clientSlug, areaDir, action } = req.body as {
    clientSlug?: string;
    areaDir?:    string;
    action?:     string;
  };

  if (!clientSlug || !areaDir || !action) {
    res.status(400).json({ error: "clientSlug, areaDir, and action are required" });
    return;
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(clientSlug)) { res.status(400).json({ error: "Invalid clientSlug" }); return; }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(areaDir))    { res.status(400).json({ error: "Invalid areaDir" });    return; }
  if (!VALID_ACTIONS.has(action)) {
    res.status(400).json({ error: `Unknown action "${action}". Valid: ${[...VALID_ACTIONS].join(", ")}` });
    return;
  }

  const clientDir = path.join(OUTPUT_DIR, clientSlug);
  const htmlPath  = path.join(clientDir, areaDir, "index.html");

  if (!fs.existsSync(htmlPath)) {
    res.status(404).json({ error: `Page not found: ${areaDir}` });
    return;
  }

  try {
    const html     = fs.readFileSync(htmlPath, "utf8");
    const pageData = loadPageData(clientDir, areaDir);

    // Load session for template-driven actions
    const campaignId = (pageData.campaignId as string) ?? "";
    const session    = campaignId ? findSessionForPage(clientDir, campaignId) : null;

    // Derive nearby areas from session defs
    if (session?.selectedAreaDefs && !(pageData.nearbyAreas)) {
      const siblings = (session.selectedAreaDefs as SessionDef[])
        .filter((d) => d.tier !== "hub" && d.area && d.remotePath !== pageData.remotePath)
        .map((d) => d.area ?? "")
        .filter(Boolean)
        .slice(0, 6);
      if (siblings.length > 0) pageData.nearbyAreas = siblings;
    }

    let newHtml: string;

    const act = action as OptimiseAction;
    switch (act) {
      case "improve-local-relevance": {
        const slice = extractSection(html, 'class="local-relevance-section"');
        if (!slice) throw new Error("local-relevance-section not found in page HTML");
        const newSection = await handleImproveLocalRelevance(html, pageData);
        newHtml = replaceSlice(html, slice, newSection);
        break;
      }
      case "improve-service-relevance": {
        const slice = extractSection(html, 'id="split-section-one"');
        if (!slice) throw new Error("split-section-one not found in page HTML");
        const newSection = await handleImproveServiceRelevance(html, pageData);
        newHtml = replaceSlice(html, slice, newSection);
        break;
      }
      case "improve-intent-coverage": {
        newHtml = handleImproveIntentCoverage(html, pageData);
        break;
      }
      case "increase-variation": {
        const slice = extractSection(html, 'id="ai-summary-section"');
        if (!slice) throw new Error("ai-summary-section not found in page HTML");
        const newSection = await handleIncreaseVariation(html, pageData);
        newHtml = replaceSlice(html, slice, newSection);
        break;
      }
      case "generate-related-services":
        newHtml = handleGenerateRelatedServices(html, pageData, session, clientDir);
        break;
      case "generate-areas-we-cover":
        newHtml = handleGenerateAreasWeCover(html, pageData, session);
        break;
      default:
        res.status(400).json({ error: "Unknown action" });
        return;
    }

    if (act === "improve-intent-coverage" && !/<section[^>]*class="[^"]*cluster-intent-clusters/i.test(newHtml)) {
      throw new Error("Intent Coverage fix failed: cluster-intent-clusters section was not inserted into HTML");
    }

    // Re-score the updated page
    const beforeScore = (pageData.aiReadiness as { score?: number } | undefined)?.score ?? null;
    let afterScore: number | null = null;
    let afterBreakdown: unknown[] = [];
    try {
      const scored = scoreAiReadiness(newHtml);
      afterScore    = scored.score;
      afterBreakdown = scored.breakdown;
    } catch { /* non-fatal */ }

    // Write updated HTML
    fs.writeFileSync(htmlPath, newHtml, "utf8");

    // Update page-data.json with new score
    if (afterScore !== null) {
      try {
        const pdPath = path.join(clientDir, areaDir, "page-data.json");
        const pd = fs.existsSync(pdPath)
          ? JSON.parse(fs.readFileSync(pdPath, "utf8")) as Record<string, unknown>
          : {};
        pd.aiReadiness = { ...(pd.aiReadiness as Record<string, unknown> ?? {}), score: afterScore, breakdown: afterBreakdown };
        pd.lastOptimisedAt = new Date().toISOString();
        pd.lastOptimisedAction = action;
        fs.writeFileSync(pdPath, JSON.stringify(pd, null, 2), "utf8");
      } catch { /* non-fatal */ }
    }

    res.json({
      success:         true,
      action,
      label:           ACTION_LABELS[act],
      beforeScore,
      afterScore,
      scoreDelta:      afterScore !== null && beforeScore !== null ? afterScore - beforeScore : null,
      sectionsUpdated: [action.replace("improve-", "").replace("generate-", "").replace(/-/g, "_")],
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
