/**
 * generateClusterContent.ts
 *
 * Calls OpenAI (gpt-4.1) with the cluster-page-prompt.txt master prompt
 * and returns typed ClusterPageContent.
 */

import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { buildBusinessIntelligencePrompt } from "./businessIntelligence";
import { buildOutcomeIntelligencePrompt } from "./outcomeIntelligence";
import { buildStructuredIntelligencePrompt } from "./structuredIntelligence";
import type { AreaContentSignals } from "../area/areaTypes";
import { buildLocalAreaContext, buildLocalContextPromptBlock } from "./localContext";
import { getServiceMistakes } from "./serviceMistakeMap";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClusterRelatedResource {
  href:        string;
  text:        string;
  description?: string;
}

export interface ClusterFaqItem {
  question: string;
  answer:   string;
}

export interface ClusterPageSection {
  heading: string;
  body:    string;
}

export interface ClusterAiAnswerBlock {
  question?:    string;
  quickAnswer?: string;
  keyPoints?:   string[];
}

export interface ClusterIntentCluster {
  question?: string;
  answer?:   string;
}

export interface ClusterIntentClusters {
  pricingQuestion?:    ClusterIntentCluster;
  processQuestion?:    ClusterIntentCluster;
  localQuestion?:      ClusterIntentCluster;
  comparisonQuestion?: ClusterIntentCluster;
}

export interface ClusterEntityBlock {
  service?:        string;
  location?:       string;
  provider?:       string;
  primaryKeyword?: string;
  targetAudience?: string;
  nearbyAreas?:    string;
}

// ── New content-depth sections ────────────────────────────────────────────────

export interface ClusterWhatsIncluded {
  items: { title: string; description: string }[];
}

export interface ClusterWhoItsFor {
  intro?:  string;
  groups:  { label: string; description: string }[];
}

export interface ClusterCommonMistakes {
  items: { mistake: string; impact: string }[];
}

export interface ClusterPageContent {
  heroIntro?:             string;
  aiSummaryIntro:         string;
  aiSummaryBullets:       string[];
  split1:                 ClusterPageSection;
  split2:                 ClusterPageSection;
  whatsIncluded?:         ClusterWhatsIncluded;
  whoItsFor?:             ClusterWhoItsFor;
  enquirySection?:        ClusterPageSection;
  competitionSection?:    ClusterPageSection;
  localRelevanceSection?: ClusterPageSection;
  noWebsiteSection?:      ClusterPageSection;
  commonMistakes?:        ClusterCommonMistakes;
  relatedResources:       ClusterRelatedResource[];
  faq:                    ClusterFaqItem[];
  cta:                    { heading: string; body: string };
  trustStrip:             string;
  aiAnswerBlock?:         ClusterAiAnswerBlock;
  intentClusters?:        ClusterIntentClusters;
  entityBlock?:           ClusterEntityBlock;
}

export interface ClusterPageInputs {
  brandName:          string;
  legalName:          string;
  serviceName:        string;
  location:           string;
  primaryKeyword:     string;
  supportingKeywords: string[];
  ctaText:            string;
  ctaUrl:             string;
  hubUrl:             string;
  hubAnchor:          string;
  relatedPages:       string;
  businessAddress:    string;
  /**
   * Optional area content signals from the Area Engine.
   * When supplied, a LOCAL AREA CONTEXT block is appended to the prompt
   * so the model can localise copy to the specific area character and
   * competitive landscape without repeating boilerplate verbatim.
   * Spec ref: Area Engine Integration Spec v1 — Section 4.
   */
  areaSignals?:        AreaContentSignals;
  /** One-sentence brand positioning used in about/trust copy. */
  shortDescription?:   string;
  /** Bullet USP statements woven into enquiry and CTA sections. */
  uspStatements?:      string[];
  /** Factual trust claims (years, accreditations, client numbers). */
  trustStatements?:    string[];
  /** Writing tone guidance (e.g. "premium consultancy — no exclamations"). */
  toneNotes?:          string;
  /** Brand style variant (e.g. "premium-consultancy", "trade", "professional"). */
  brandStyleVariant?:  string;
  /**
   * Industry profile data loaded from config/industryProfiles.json.
   * When supplied, buyer intent, tone, CTA style and content guidance are
   * appended to the generation prompt so copy matches the industry.
   */
  industryProfile?:    Record<string, unknown>;
  /**
   * Locked service blueprint loaded from config/service-blueprints.
   * This overrides generic AI behaviour and hard-locks audience,
   * service intent, forbidden topics and section direction.
   */
  serviceBlueprint?:  Record<string, unknown>;

  /**
   * Who the service is aimed at. Controls audience framing in the prompt so
   * the model never guesses B2B vs B2C.
   * - household          → homeowners, families, individuals
   * - business           → commercial organisations, B2B
   * - landlord-property  → landlords, letting agents, property managers
   * - mixed              → balanced domestic/professional audience
   */
  buyerType?:          "household" | "business" | "landlord-property" | "mixed";
  /**
   * Industry type from the project config.
   * Used to determine whether non-digital service rules apply to the prompt.
   */
  industryType?:       string;
  /**
   * Service sub-type. Drives context-specific prompt rules.
   * When the value starts with "emergency" (e.g. "emergency-plumbing",
   * "emergency-electrician"), an urgent-callout context block is appended
   * to the prompt: call-now CTAs, urgency tone, no-form enquiry flow.
   */
  serviceType?:        string;
  /**
   * Human-readable description of who is providing the service.
   * Grounds the AI in the correct provider identity before generation.
   * Example: "local plumber", "local boiler repair engineer", "landscape gardener"
   */
  providerType?:       string;
  /**
   * Explicit list of service deliverables for this campaign.
   * The AI uses these to populate whatsIncluded and split2 sections
   * rather than inferring from the keyword.
   * Example: ["burst pipe repairs", "leak detection", "blocked toilet help"]
   */
  serviceDeliverables?: string[];
  /**
   * Explicit list of customer problems this service solves.
   * Grounds heroIntro, split1, FAQ and aiSummaryIntro in real buyer pain points.
   * Example: ["water leak", "burst pipe", "blocked toilet", "no hot water"]
   */
  campaignCustomerProblems?: string[];
  /**
   * The primary conversion action the page should drive.
   * Overrides generic CTA guidance when set.
   * Example: "Call an Emergency Plumber", "Book a Boiler Repair Visit"
   */
  conversionAction?:   string;
}

// ── Digital vs real-world industry classification ─────────────────────────────
// Industry types that are themselves digital/web services — all others are
// real-world service businesses where digital/SEO language must not appear.
const DIGITAL_INDUSTRY_TYPES = new Set([
  "web-design",
  "local-seo",
  "local-business-visibility",
  "seo",
  "web-hosting",
  "email-marketing",
  "digital-marketing",
  "ppc",
  "social-media-marketing",
]);

// ── OpenAI client ──────────────────────────────────────────────────────────────

function getClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error(
      "Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY"
    );
  }
  return new OpenAI({ baseURL, apiKey });
}

/** Shared OpenAI integration client — Replit/VPS AI_INTEGRATIONS_* credentials. */
export function getOpenAiIntegrationClient(): OpenAI {
  return getClient();
}

export const OPENAI_INTEGRATION_CHAT_MODEL = "gpt-4.1";

// ── Prompt loader ──────────────────────────────────────────────────────────────

function findPromptFile(filename: string): string {
  // Try process.cwd() first (workspace-root CLI usage).
  // If that fails, walk up from the compiled file location — works when called from
  // a bundled api-server whose CWD differs from the workspace root.
  const fromCwd = path.join(process.cwd(), "prompts", filename);
  if (fs.existsSync(fromCwd)) return fromCwd;

  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "prompts", filename);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return fromCwd; // fall back so the original error message is preserved
}

function buildPrompt(inputs: ClusterPageInputs): string {
  // Select the correct master prompt based on industry type.
  // Non-digital industries (landscaping, plumbing, roofing, etc.) use the
  // trade prompt which is written from a first-party service-provider perspective.
  // Digital industries use the standard web/SEO-focused prompt.
  const isTradeIndustry =
    inputs.industryType !== undefined &&
    !DIGITAL_INDUSTRY_TYPES.has(inputs.industryType);
  const promptFileName = isTradeIndustry
    ? "cluster-page-prompt-trade.txt"
    : "cluster-page-prompt.txt";
  const promptPath = findPromptFile(promptFileName);
  let prompt = fs.readFileSync(promptPath, "utf8");
  prompt += "\n\n" + buildBusinessIntelligencePrompt();
  prompt += "\n\n" + buildOutcomeIntelligencePrompt();
  prompt += buildStructuredIntelligencePrompt({
    serviceKey: (inputs as any).serviceKey,
    serviceName: inputs.serviceName,
    location: inputs.location,
  });

  const replacements: Record<string, string> = {
    "{{BRAND_NAME}}":          inputs.brandName,
    "{{LEGAL_NAME}}":          inputs.legalName,
    "{{SERVICE_NAME}}":        inputs.serviceName,
    "{{LOCATION}}":            inputs.location,
    "{{PRIMARY_KEYWORD}}":     inputs.primaryKeyword,
    "{{SUPPORTING_KEYWORDS}}": (inputs.supportingKeywords ?? []).join(", "),
    "{{CTA_TEXT}}":            inputs.ctaText,
    "{{CTA_URL}}":             inputs.ctaUrl,
    "{{HUB_URL}}":             inputs.hubUrl,
    "{{HUB_ANCHOR}}":          inputs.hubAnchor,
    "{{RELATED_PAGES}}":       inputs.relatedPages,
    "{{BUSINESS_ADDRESS}}":    inputs.businessAddress,
    "{{SHORT_DESCRIPTION}}":   inputs.shortDescription  ?? "",
    "{{USP_STATEMENTS}}":      (inputs.uspStatements    ?? []).join("; "),
    "{{TRUST_STATEMENTS}}":    (inputs.trustStatements  ?? []).join("; "),
    "{{TONE_NOTES}}":          inputs.toneNotes         ?? "",
    "{{BRAND_STYLE_VARIANT}}": inputs.brandStyleVariant ?? "",
  };

  for (const [token, value] of Object.entries(replacements)) {
    prompt = prompt.split(token).join(value);
  }

  // ── Area context block (spec Section 4.1) ──────────────────────────────────
  // Appended when area signals are supplied. The model uses this to localise
  // copy without repeating the signals verbatim (note in the block header).
  if (inputs.areaSignals) {
    const s = inputs.areaSignals;
    prompt +=
      `\n\nLOCAL AREA CONTEXT (use this to localise copy — do not repeat verbatim):\n\n` +
      `Local context    : ${s.localContext}\n` +
      `Demand note      : ${s.demandNote}\n` +
      `Competition note : ${s.competitionNote}\n` +
      `Competitor angle : ${s.competitorAngle}\n` +
      `Messaging        : ${s.messagingRegister}\n` +
      `Landmarks        : ${(s.landmarks ?? []).join(", ")}\n`;

    // ── Local Context Injection (Section 4.2) ──────────────────────────────
    // Builds a structured LocalAreaContext (nearbyAreas, businessTypes,
    // environment, customerBehaviour) and appends section-specific guidance
    // with varied example phrases and strict variation rules.
    // Instructs the model to use local signals naturally 3–4 times per page
    // without keyword-stuffing, template repetition or forced area mentions.
    const localCtx = buildLocalAreaContext(s);
    prompt += buildLocalContextPromptBlock(localCtx);
  }

  // ── Industry profile context block ─────────────────────────────────────────
  // Appended when an industry profile is supplied. Gives the model buyer-intent,
  // tone, CTA style and content guidance for the specific industry so copy is
  // accurate and commercially relevant — not generic.
  if (inputs.industryProfile) {
    const p = inputs.industryProfile as Record<string, unknown>;
    const arr = (v: unknown): string =>
      Array.isArray(v) ? (v as string[]).join(", ") : String(v ?? "");

    // When buyerType is set, prefer the matching sub-context if the profile has one.
    // e.g. landscaping profile has "household" and "commercial" sub-contexts.
    const bt = inputs.buyerType;
    const sub = bt && typeof p[bt] === "object" && p[bt] !== null
      ? (p[bt] as Record<string, unknown>)
      : null;
    const tone          = arr(sub?.["tone"]             ?? p["tone"]);
    const buyerIntent   = arr(sub?.["buyerIntent"]      ?? p["buyerIntent"]);
    const custProblems  = arr(sub?.["customerProblems"] ?? p["customerProblems"]);
    const whoFor        = arr(sub?.["whoItsFor"]        ?? p["whoItsFor"]);
    const ctaStyle      = arr(sub?.["ctaStyle"]         ?? p["ctaStyle"]);
    const contentStyle  = arr(sub?.["contentStyle"]     ?? p["contentStyle"]);
    const avoidLang     = arr(sub?.["avoidLanguage"]    ?? p["avoidLanguage"]);
    const proofPts      = arr(sub?.["recommendedProofPoints"] ?? p["recommendedProofPoints"]);

    prompt +=
      `\n\nINDUSTRY PROFILE CONTEXT (${p["displayName"] ?? p["industryType"]}):\n\n` +
      `Tone             : ${tone}\n` +
      `Buyer intent     : ${buyerIntent}\n` +
      `Customer problems: ${custProblems}\n` +
      `Urgent triggers  : ${arr(p["urgentTriggers"])}\n` +
      `Trust factors    : ${arr(p["trustFactors"])}\n` +
      `Who it's for     : ${whoFor}\n` +
      `CTA style        : ${ctaStyle}\n` +
      `Content style    : ${contentStyle}\n` +
      `Avoid language   : ${avoidLang}\n` +
      `Proof points     : ${proofPts}\n` +
      `Local SEO angles : ${arr(p["localSeoAngles"])}\n`;
  }


  // ── Service blueprint context block ───────────────────────────────────────
  // Hard-locks service intent, audience and prohibited drift.
  if (inputs.serviceBlueprint) {
    const bp = inputs.serviceBlueprint as Record<string, unknown>;

    const arr = (v: unknown): string =>
      Array.isArray(v) ? (v as string[]).join(", ") : String(v ?? "");

    prompt +=
      `\n\nSERVICE BLUEPRINT — MANDATORY RULES:\n\n` +
      `Service           : ${bp["serviceName"]}\n` +
      `Page purpose      : ${bp["pagePurpose"]}\n` +
      `Target audience   : ${arr(bp["audience"])}\n` +
      `Tone              : ${bp["tone"]}\n` +
      `Mandatory topics  : ${arr(bp["mandatoryTopics"])}\n` +
      `Forbidden topics  : ${arr(bp["forbiddenTopics"])}\n` +
      `Required sections : ${arr(bp["sectionOrder"])}\n` +
      `Primary CTA       : ${String((bp["cta"] as any)?.primary ?? "")}\n` +
      `Secondary CTA     : ${String((bp["cta"] as any)?.secondary ?? "")}\n` +

      `\nSTRICT CONTENT RULES:\n` +
      `You MUST write ONLY about the defined service.\n` +
      `You MUST target ONLY the defined audience.\n` +
      `You MUST naturally include the mandatory topics.\n` +
      `You MUST NEVER mention forbidden topics.\n` +
      `If forbidden topics appear, the output is invalid.\n` +
      `Do NOT improvise industries, property services, household scenarios or unrelated audiences.\n`;
  }


  // ── Buyer-type context block ──────────────────────────────────────────────
  // Tells the model exactly who the service is aimed at so it never guesses
  // whether it is writing for homeowners, businesses, landlords or a mixed audience.
  if (inputs.buyerType) {
    const audienceMap: Record<string, string> = {
      household:           "homeowners, families and individuals (domestic / B2C)",
      business:            "businesses and commercial organisations (B2B)",
      "landlord-property": "landlords, letting agents and property managers",
      mixed:               "a mix of homeowners, landlords and businesses — write for the broadest relevant audience without excluding any group",
    };
    const ctaMap: Record<string, string> = {
      household:           "Use domestic-focused CTAs. Never use 'commercial ROI', 'client engagement', 'footfall', 'business enquiries' or 'commercial premises'.",
      business:            "Use business-focused CTAs. Emphasise efficiency, ROI, compliance and professional outcomes.",
      "landlord-property": "Use landlord/property-focused CTAs. Emphasise reliability, compliance, tenant safety and fast response.",
      mixed:               "Balance domestic and professional CTAs. Avoid exclusively B2B or B2C framing.",
    };
    const audienceDesc  = audienceMap[inputs.buyerType] ?? inputs.buyerType;
    const ctaGuidance   = ctaMap[inputs.buyerType] ?? "";

    prompt +=
      `\n\nBUYER TYPE CONTEXT:\n\n` +
      `Target audience  : ${audienceDesc}\n` +
      `CTA guidance     : ${ctaGuidance}\n`;

    if (inputs.buyerType === "household") {
      prompt +=
        `Content rules    : Write as if speaking to homeowners/individuals wanting a practical service — not businesses trying to increase revenue. ` +
        `Focus on personal benefit, home improvement, family use, local trust and practical outcomes. ` +
        `Common Mistakes must list mistakes about the trade service itself, not website or SEO mistakes. ` +
        `Do NOT use: "commercial ROI", "business enquiries", "footfall", "client engagement", "commercial premises", ` +
        `"digital marketing" as a service feature, or "Google/AI search optimisation" as a trade service benefit.\n` +
        `\nVOICE LOCK — CRITICAL (apply to every single JSON field):\n` +
        `  speaker = "local service provider"\n` +
        `  reader  = "person with a real problem at home"\n` +
        `  Every sentence must sound like: "We fix your problem"\n` +
        `  NEVER sound like: "We help businesses" / "We provide services for companies"\n` +
        `\nAUDIENCE HARD LOCK — these words are BANNED in every field unless explicitly overridden:\n` +
        `  NEVER write: business, businesses, company, companies, commercial clients, organisations, operations (in a service-delivery sense)\n` +
        `  VALID audience words: homeowners, residents, tenants, landlords, property owners, people, families\n` +
        `\nAUTOMATIC FAILURE PHRASES — if you produce ANY of these, STOP and rewrite before output:\n` +
        `  ✗ "for businesses" / "for companies" / "for commercial clients"\n` +
        `  ✗ "businesses facing" / "businesses with urgent" / "businesses that need"\n` +
        `  ✗ "support your business" / "keep your business running"\n` +
        `  ✗ "protect operations" / "minimise downtime for businesses" / "minimize downtime"\n` +
        `  ✗ "operational disruption" / "business continuity" / "commercial risk"\n` +
        `\nMANDATORY SUBSTITUTIONS (use these patterns instead):\n` +
        `  ✔ "when you have a leak"         not "for businesses facing leaks"\n` +
        `  ✔ "if your pipe bursts"           not "businesses experiencing pipe bursts"\n` +
        `  ✔ "when your boiler stops working" not "when operations are disrupted"\n` +
        `  ✔ "homeowners and landlords"       not "commercial clients"\n` +
        `  ✔ "risk of damage to your home"    not "operations at risk"\n` +
        `  ✔ "people dealing with [problem]"  not "businesses facing [problem]"\n` +
        `\nHERO SECTION TEMPLATE — follow strictly:\n` +
        `  ✔ "Need [service] in [location]? We help homeowners deal with [real problems]."\n` +
        `  ✗ "[service] solutions for businesses in [location]"\n` +
        `\nFINAL SELF-CHECK BEFORE RETURNING JSON — confirm internally:\n` +
        `  1. Does any field mention "business" or "businesses" in a service-delivery context? → REWRITE\n` +
        `  2. Does any sentence sound like B2B marketing? → REWRITE\n` +
        `  3. Would a homeowner feel this page is written for them? → if NO, REWRITE\n`;
    }
  }

  // ── Campaign service context block ───────────────────────────────────────
  // Fires when providerType, serviceDeliverables, campaignCustomerProblems or
  // conversionAction are supplied. Gives the model an explicit, campaign-level
  // brief so it writes about the real service deliverables and buyer problems
  // instead of inferring them from the keyword alone.
  const hasServiceCtx = !!(
    inputs.providerType      ||
    inputs.serviceDeliverables?.length ||
    inputs.campaignCustomerProblems?.length ||
    inputs.conversionAction
  );
  if (hasServiceCtx) {
    prompt += `\n\nCAMPAIGN SERVICE CONTEXT (use throughout all JSON fields):\n\n`;
    if (inputs.providerType) {
      prompt += `Provider type    : ${inputs.providerType}\n`;
      prompt += `                   (This is WHO the business IS — write every section from this provider's perspective)\n`;
    }
    if (inputs.conversionAction) {
      prompt += `Conversion action: ${inputs.conversionAction}\n`;
      prompt += `                   (This is the PRIMARY CTA — use this exact phrase as the main button/CTA text)\n`;
    }
    if (inputs.campaignCustomerProblems?.length) {
      prompt += `Customer problems : ${inputs.campaignCustomerProblems.join(", ")}\n`;
      prompt += `                   (Build heroIntro, split1, FAQ and aiSummaryIntro around THESE problems)\n`;
    }
    if (inputs.serviceDeliverables?.length) {
      prompt += `Service delivers : ${inputs.serviceDeliverables.join(", ")}\n`;
      prompt += `                   (Use these as the basis for whatsIncluded and split2 sections)\n`;
    }
    prompt += `\nCRITICAL: The page is written BY this provider FOR the person who needs this service done. `;
    prompt += `Never mention websites, SEO, marketing or digital services as deliverables.\n`;
  }

  // ── Non-digital service rules ─────────────────────────────────────────────
  // When the industry is a real-world trade or service (not a digital/web
  // industry), this block fires as a MANDATORY override to prevent the model
  // from defaulting to web-design / digital-marketing framing.
  if (inputs.industryType && !DIGITAL_INDUSTRY_TYPES.has(inputs.industryType)) {
    prompt +=
      `\n\nNON-DIGITAL SERVICE — MANDATORY RULES (apply to every field in the JSON output):\n\n` +
      `This page is for a real-world service business (${inputs.industryType}). ` +
      `It is NOT a web design, SEO, digital marketing or online-visibility service.\n\n` +
      `FORBIDDEN — never write any of the following phrases anywhere in the output:\n` +
      `  • web design\n` +
      `  • website (unless referring to the business's own contact page — never as a service deliverable)\n` +
      `  • SEO / search engine optimisation\n` +
      `  • AI search / AI overview / AI visibility\n` +
      `  • Google rankings / Google visibility / Google maps pack / map pack\n` +
      `  • local SEO / local search optimisation\n` +
      `  • online visibility / online presence (unless the business provides this service)\n` +
      `  • digital marketing / online marketing\n` +
      `  • enquiries from your website / website enquiries / online enquiries from your site\n` +
      `  • conversion-focused website / high-converting website\n` +
      `  • page speed / mobile layout issues / slow website\n` +
      `  • search engine traffic / organic traffic\n` +
      `  • commercial ROI / business growth through digital\n` +
      `  • lead generation website / website leads\n` +
      `  • customer engagement (in a digital/marketing sense)\n` +
      `  • conversion rate / client acquisition / search traffic / digital presence / marketing strategy\n` +
      `  • business enquiries (as a marketing outcome metric — enquiries in the sense of customer phone calls are fine)\n` +
      `  • "for businesses" / "for companies" / "for commercial clients" — reader is a homeowner, not a business\n` +
      `  • "businesses facing" / "businesses with urgent" / "businesses that need"\n` +
      `  • "support your business" / "keep your business running" / "protect operations"\n` +
      `  • "minimise downtime" / "minimize downtime" / "business continuity" / "operational disruption"\n` +
      `  • "commercial risk" / "client impact" (in a B2B framing sense)\n\n` +
      `AUTOMATIC REWRITE RULE — if B2B phrasing is detected, substitute immediately:\n` +
      `  "businesses facing urgent plumbing issues" → "people dealing with urgent plumbing problems at home"\n` +
      `  "commercial clients"                       → "homeowners and landlords"\n` +
      `  "operations at risk"                       → "risk of damage to your home"\n` +
      `  "keep your business running"               → "keep your home safe and functioning"\n\n` +
      `REQUIRED — every section must describe the real-world service:\n` +
      `  • heroIntro: explain what the business physically does for customers — not what a website does\n` +
      `  • aiSummaryIntro: define the actual trade service being provided\n` +
      `  • split1/split2: discuss real customer problems (e.g. broken patio, poor drainage, leaking roof)\n` +
      `  • whatsIncluded: list real physical deliverables (e.g. site visit, quote, installation, tidy-up) — NOT digital deliverables\n` +
      `  • whoItsFor: write for homeowners, families, landlords, property owners — NOT businesses seeking marketing\n` +
      `  • enquirySection: explain how customers call, book a visit, send photos — NOT how a website generates enquiries\n` +
      `  • commonMistakes: list mistakes made when commissioning or planning THIS trade service ` +
      `(e.g. poor drainage planning, wrong materials, no access plan) — NEVER list website or SEO mistakes\n` +
      `  • faq: write homeowner/service questions only (e.g. "How much does it cost?", "How long does it take?", ` +
      `"Do I need a design first?") — NOT digital marketing questions\n` +
      `  • cta: use a service-request CTA (e.g. "Request a Quote", "Book a Visit", "Get a Free Quote") — ` +
      `NOT "Get More Enquiries" or "Grow Your Business Online"\n` +
      `  • entityBlock.targetAudience: must describe the real buyer (e.g. "Homeowners, tenants and landlords ` +
      `needing ${inputs.serviceName} in ${inputs.location}") — NOT "Small and medium businesses looking for professional ${inputs.serviceName}"\n`;
  }

  // ── Emergency / urgent service context ───────────────────────────────────────
  // When serviceType indicates an emergency or urgent service, append a dedicated
  // context block that overrides the default "request a quote" framing.
  // Emergency pages speak to people mid-crisis, not people planning ahead.
  if (inputs.serviceType?.toLowerCase().startsWith("emergency")) {
    prompt +=
      `\n\nEMERGENCY SERVICE CONTEXT — MANDATORY OVERRIDES:\n\n` +
      `This is an URGENT, ON-DEMAND service (serviceType: ${inputs.serviceType}). ` +
      `The reader is a person with an active problem right now — a burst pipe, a blocked drain, ` +
      `a gas issue, a plumbing emergency — NOT someone planning ahead or requesting a quote form.\n\n` +
      `TONE: Urgent, calm, reassuring. Acknowledge the problem. Provide immediate direction. ` +
      `The reader is stressed. Short sentences. Plain language. No corporate fluff.\n\n` +
      `CTA RULES — OVERRIDE DEFAULT:\n` +
      `  • Primary CTA must be CALL-FOCUSED: "Call Now", "Call an Emergency Plumber", ` +
      `"Call for Immediate Help", "Ring Us Now" — NOT "Request a Quote" or "Get a Free Quote"\n` +
      `  • Secondary CTA may be: "Request an Urgent Callback"\n` +
      `  • Never use: "Request a Quote for Your Business", "Improve Your Online Presence", ` +
      `"Book a Consultation", "Schedule a Survey"\n\n` +
      `SECTION-SPECIFIC OVERRIDES:\n` +
      `  • heroIntro: Must convey urgency and fast local response. ` +
      `Open with the emergency scenario, not a general description. ` +
      `Example: "Emergency plumbing in ${inputs.location}? If you have a burst pipe, ` +
      `leak, blocked drain or overflowing water, call a local emergency plumber for fast help."\n` +
      `  • enquirySection heading: Use "How Our Emergency Callout Works" or similar — ` +
      `NOT "How to Get Started" or "How to Get a Quote"\n` +
      `  • enquirySection body: Describe calling the plumber, describing the problem, receiving ` +
      `initial advice, plumber attending, issue assessed, emergency fix carried out — ` +
      `NOT filling in a form and waiting for a quote\n` +
      `  • split1 (WHY): Focus on urgency of the problem — water damage spreads, ` +
      `blocked toilet becomes unusable, pipe damage worsens — NOT general reasons to hire the service\n` +
      `  • whoItsFor: Must include homeowners, tenants, landlords AND letting agents — ` +
      `emergency services serve all residential property occupants\n` +
      `  • faq: Questions must be urgent/practical: ` +
      `"What should I do if I have a burst pipe?", ` +
      `"How quickly can an emergency plumber reach me in ${inputs.location}?", ` +
      `"How much does an emergency callout cost in ${inputs.location}?"\n` +
      `  • noWebsiteSection heading: Use "What Happens If You Delay Getting Emergency Help" — ` +
      `focus on damage escalation, not digital competition\n` +
      `  • commonMistakes: Must be real emergency-situation mistakes: ` +
      `"Not turning off the water", "Ignoring a small leak", "Attempting unsafe DIY repairs", ` +
      `"Delaying a burst pipe callout" — NEVER digital mistakes\n` +
      `  • cta.heading: Use something like "Need Emergency Help in ${inputs.location}? Call Now"\n`;
  }

  return prompt;
}

// ── B2B content sanitiser ─────────────────────────────────────────────────────
// Runs deterministically on the parsed AI output BEFORE the renderer sees it.
// The model routinely ignores prompt-level audience bans ("for businesses",
// "local businesses", "affecting local businesses" etc.) on trade/household pages.
// This sanitiser enforces the spec programmatically — no model compliance needed.
//
// Rules are ordered longest-first so specific multi-word phrases are caught before
// their component words. Case-insensitive throughout.

function sanitiseB2bContent(
  content: ClusterPageContent,
  inputs: Pick<ClusterPageInputs, "buyerType" | "industryType">
): ClusterPageContent {
  const isHousehold  = inputs.buyerType === "household";
  const isNonDigital = !!(inputs.industryType && !DIGITAL_INDUSTRY_TYPES.has(inputs.industryType));
  if (!isHousehold && !isNonDigital) return content;

  const rules: [RegExp, string][] = [
    // ── Compound "for businesses …" phrases ───────────────────────────────────
    [/\bfor businesses\s+facing\b/gi,                    "for people dealing with"],
    [/\bfor businesses\s+experiencing\b/gi,               "for people experiencing"],
    [/\bfor businesses\s+with\s+urgent\b/gi,              "for people with urgent"],
    [/\bfor businesses\s+that\s+need\b/gi,                "for people who need"],
    [/\bfor businesses\s+needing\b/gi,                    "for people needing"],
    [/\bfor businesses\s+in\b/gi,                         "for homeowners in"],
    [/\bfor businesses\b/gi,                              "for homeowners"],
    [/\bfor companies\b/gi,                               "for homeowners"],
    [/\bfor commercial clients\b/gi,                      "for homeowners and landlords"],
    // ── "affecting / serving local businesses" ────────────────────────────────
    [/\baffecting local businesses\b/gi,                  "affecting local residents"],
    [/\bserving local businesses\b/gi,                    "serving local residents"],
    [/\blocal businesses and\b/gi,                        "local residents and"],
    [/\blocal businesses\b/gi,                            "local residents"],
    // ── "businesses facing / experiencing / that need" ────────────────────────
    [/\bbusinesses facing\b/gi,                           "people dealing with"],
    [/\bbusinesses experiencing\b/gi,                     "people experiencing"],
    [/\bbusinesses with urgent\b/gi,                      "people with urgent"],
    [/\bbusinesses that need\b/gi,                        "people who need"],
    [/\bbusinesses in ([A-Za-z\s]+)\b/gi,                 "residents in $1"],
    // ── "your business" constructs ────────────────────────────────────────────
    [/\bsupport your business\b/gi,                       "help you at home"],
    [/\bkeep your business running\b/gi,                  "get your home back to normal"],
    [/\byour business\b/gi,                               "your home"],
    // ── Operations / continuity / risk ───────────────────────────────────────
    [/\bprotect(?:\s+your)?\s+operations\b/gi,            "protect your property"],
    [/\bminimis[ez]\s+downtime\s+for businesses\b/gi,     "minimise disruption to your home"],
    [/\bminimis[ez]\s+downtime\b/gi,                      "minimise disruption"],
    [/\bminimiz[ez]\s+downtime\b/gi,                      "minimise disruption"],
    [/\boperational disruption\b/gi,                      "disruption at home"],
    [/\bbusiness continuity\b/gi,                         "keeping your home running"],
    [/\bcommercial risk\b/gi,                             "risk of damage to your home"],
    [/\bcommercial clients\b/gi,                          "homeowners and landlords"],
    // ── Residual bare "businesses" in service-delivery contexts ───────────────
    // Only catches the standalone noun — not "web design businesses" etc.
    [/\burgent plumbing problems affecting businesses\b/gi, "urgent plumbing problems affecting residents"],
    [/\bproblems affecting businesses\b/gi,               "problems affecting residents"],
    [/\bissues affecting businesses\b/gi,                 "issues affecting residents"],
    [/\bbusinesses\b(?=\s+(?:with|in|facing|that|needing|experiencing))/gi, "homeowners"],
  ];

  function sanitise(val: unknown): unknown {
    if (typeof val === "string") {
      let s = val;
      for (const [re, rep] of rules) {
        s = s.replace(re, rep);
      }
      return s;
    }
    if (Array.isArray(val)) return val.map(sanitise);
    if (val !== null && typeof val === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(val as object)) {
        out[k] = sanitise((val as Record<string, unknown>)[k]);
      }
      return out;
    }
    return val;
  }

  return sanitise(content) as ClusterPageContent;
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function generateClusterContent(
  inputs: ClusterPageInputs
): Promise<ClusterPageContent> {
  const client = getClient();
  const prompt = buildPrompt(inputs);

  // Use a trade-specific system role for non-digital service industries so the
  // model never drifts back into agency/SEO framing at the system level.
  const isTradeIndustry =
    inputs.industryType !== undefined &&
    !DIGITAL_INDUSTRY_TYPES.has(inputs.industryType);

  const isGBP =
    inputs.industryType === "google-business-profile";

  const systemMessage = isTradeIndustry
    ? "You are NOT a copywriter for agencies. You are NOT a marketing assistant. You are NOT writing about services FOR trades. You are generating a REAL SERVICE PAGE for a REAL LOCAL BUSINESS. The business OWNS the service — it sells that service directly to homeowners and householders.\n\nVOICE LOCK (MANDATORY): speaker = \"local service provider\" | reader = \"person with a real problem at home\". Every sentence must sound like: \"We fix your problem\" — NEVER \"We help businesses\" or \"We provide services for companies\". The reader is a homeowner, resident, tenant or landlord — NEVER a business, company, or organisation. If you detect B2B framing anywhere in your output, STOP and rewrite it for homeowners before returning.\n\nReturn only valid JSON — no prose, no markdown, no explanation."
    : isGBP
      ? "You are a senior Google Business Profile optimisation consultant writing for LOCAL BUSINESSES. The audience is businesses, trades, clinics, restaurants and service companies wanting more visibility in Google Maps and local search. NEVER mention homeowners, landlords, tenants, rentals, properties, property details or domestic household scenarios. NEVER drift into property services. Focus ONLY on local visibility, Google Maps rankings, customer reviews, calls, direction requests and local business growth. Return only valid JSON — no prose, no markdown, no explanation."
      : "You are a commercial copywriter producing structured JSON content for local SEO pages. Return only valid JSON — no prose, no markdown, no explanation.";

  fs.writeFileSync("/tmp/last-cluster-prompt.txt", prompt, "utf8");
  console.log("  [debug] Final cluster prompt written to /tmp/last-cluster-prompt.txt");
  console.log(`  Generating cluster AI content for: ${inputs.primaryKeyword}…`);

  const response = await client.chat.completions.create({
    model:           "gpt-4.1",
    temperature:     0.6,
    max_tokens:      16000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemMessage },
      { role: "user",   content: prompt },
    ],
  });

  const finishReason = response.choices[0]?.finish_reason;
  const raw = response.choices[0]?.message?.content ?? "";

  // If truncated, retry once with a higher token ceiling before failing
  if (finishReason === "length") {
    console.warn(`  [generateClusterContent] Response truncated (finish_reason=length) for "${inputs.primaryKeyword}" — retrying with higher token limit…`);
    const retry = await client.chat.completions.create({
      model:           "gpt-4.1",
      temperature:     0.6,
      max_tokens:      32768,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemMessage },
        { role: "user",   content: prompt },
      ],
    });
    const retryRaw = retry.choices[0]?.message?.content ?? "";
    let retryParsed: ClusterPageContent;
    try {
      retryParsed = JSON.parse(retryRaw) as ClusterPageContent;
    } catch {
      const m = retryRaw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error(`Retry AI response still not valid JSON for "${inputs.primaryKeyword}":\n${retryRaw.slice(0, 400)}`);
      retryParsed = JSON.parse(m[0]) as ClusterPageContent;
    }
    retryParsed = await expandShortIntentAnswers(retryParsed, inputs, isTradeIndustry, client);
    retryParsed = sanitiseB2bContent(retryParsed, inputs);
    retryParsed.commonMistakes = getServiceMistakes(inputs.industryType, inputs.serviceName, inputs.location);
    console.log("  Cluster AI content generated successfully (retry).");
    return retryParsed;
  }

  let parsed: ClusterPageContent;
  try {
    parsed = JSON.parse(raw) as ClusterPageContent;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`AI response is not valid JSON for "${inputs.primaryKeyword}":\n${raw.slice(0, 400)}`);
    try {
      parsed = JSON.parse(match[0]) as ClusterPageContent;
    } catch {
      throw new Error(`AI JSON extract still invalid for "${inputs.primaryKeyword}". Response length: ${raw.length}. Last 100 chars: ${raw.slice(-100)}`);
    }
  }

  parsed = await expandShortIntentAnswers(parsed, inputs, isTradeIndustry, client);
  parsed = sanitiseB2bContent(parsed, inputs);
  parsed.commonMistakes = getServiceMistakes(inputs.industryType, inputs.serviceName, inputs.location);
  console.log("  Cluster AI content generated successfully.");
  return parsed;
}

// ── Intent answer expansion ────────────────────────────────────────────────────
// If the model still produces intent answers under 130 words despite the prompt,
// this makes one targeted follow-up call to expand only the short ones.

function wc(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function expandShortIntentAnswers(
  content: ClusterPageContent,
  inputs: ClusterPageInputs,
  isTradeIndustry: boolean,
  client: OpenAI
): Promise<ClusterPageContent> {
  const ic = content.intentClusters;
  if (!ic) return content;

  const MINIMUM = 130;
  const slots: { key: keyof typeof ic; label: string; answer: string }[] = [
    { key: "pricingQuestion",    label: "pricing",    answer: ic.pricingQuestion?.answer    ?? "" },
    { key: "processQuestion",    label: "process",    answer: ic.processQuestion?.answer    ?? "" },
    { key: "localQuestion",      label: "local",      answer: ic.localQuestion?.answer      ?? "" },
    { key: "comparisonQuestion", label: "comparison", answer: ic.comparisonQuestion?.answer ?? "" },
  ];

  const shortSlots = slots.filter(s => wc(s.answer) < MINIMUM);
  if (shortSlots.length === 0) return content;

  console.log(`  [intentExpand] ${shortSlots.length} answer(s) under ${MINIMUM} words — requesting expansion for: ${shortSlots.map(s => s.label).join(", ")}`);

  const expandIntro = isTradeIndustry
    ? `You are writing content for a real local ${inputs.serviceName} business that sells its services directly to homeowners in ${inputs.location}. The reader is a homeowner — NOT a business owner. Do NOT mention websites, SEO, digital marketing, Google rankings or business enquiries. The following intent cluster answers are too short.`
    : `You are a local SEO copywriter. The following intent cluster answers for "${inputs.primaryKeyword}" in ${inputs.location} are too short.`;

  const expandSystemMessage = isTradeIndustry
    ? "You are writing service page content for a real local trade business. The reader is a homeowner. Do NOT mention websites, SEO, digital marketing or business enquiries. Return only valid JSON."
    : "You are a local SEO copywriter. Return only valid JSON.";

  const expandPrompt =
    `${expandIntro}\n` +
    `Each answer MUST be at least 160 words. Expand ONLY these answers — do not change questions or other fields.\n\n` +
    shortSlots.map(s =>
      `Key: ${s.key}\nCurrent answer (${wc(s.answer)} words):\n${s.answer}\n\nExpand this to at least 160 words. Keep the same factual content and tone — add more specific detail, examples, and local context.`
    ).join("\n\n---\n\n") +
    `\n\nReturn ONLY a JSON object with these keys and their expanded answers:\n` +
    `${JSON.stringify(Object.fromEntries(shortSlots.map(s => [s.key, { answer: "expanded answer here" }])))}\n` +
    `No other keys. No explanation. Valid JSON only.`;

  try {
    const resp = await client.chat.completions.create({
      model:           "gpt-4.1",
      temperature:     0.5,
      max_tokens:      4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: expandSystemMessage },
        { role: "user",   content: expandPrompt },
      ],
    });
    const raw = resp.choices[0]?.message?.content ?? "";
    const expanded = JSON.parse(raw) as Record<string, { answer?: string } | undefined>;
    const updated = { ...ic };
    for (const slot of shortSlots) {
      const exp = expanded[slot.key];
      const newAnswer = exp?.answer ?? "";
      if (newAnswer && wc(newAnswer) >= MINIMUM) {
        const existing = updated[slot.key];
        if (existing) {
          (updated[slot.key] as typeof existing) = { ...existing, answer: newAnswer };
        }
        console.log(`  [intentExpand] ${slot.label}: ${wc(slot.answer)} → ${wc(newAnswer)} words ✓`);
      } else {
        console.warn(`  [intentExpand] ${slot.label}: expansion still short (${wc(newAnswer)} words) — keeping original`);
      }
    }
    return { ...content, intentClusters: updated };
  } catch (err) {
    console.warn(`  [intentExpand] Expansion call failed — using original answers: ${String(err)}`);
    return content;
  }
}
