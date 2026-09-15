/**
 * CPR-CR03-V1 — Commercial Page Contract (mandatory sections for publishable service pages).
 */
export const COMMERCIAL_PAGE_CONTRACT_V1_ID = "commercial-page-contract-v1";
export const COMMERCIAL_PAGE_CONTRACT_V1_REVISION = "2026-07-31-cr03";

export interface CommercialPageContractCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface CommercialPageContractValidation {
  contractId: typeof COMMERCIAL_PAGE_CONTRACT_V1_ID;
  revision: typeof COMMERCIAL_PAGE_CONTRACT_V1_REVISION;
  passed: boolean;
  checks: CommercialPageContractCheck[];
  errors: string[];
}

function countFaqBlocks(html: string): number {
  const byQuestion = (html.match(/class="faq-q"/gi) || []).length;
  const byCard = (html.match(/class="[^"]*cluster-faq-item/gi) || []).length;
  return Math.max(byQuestion, byCard);
}

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
}

function visibleText(html: string): string {
  return stripScriptsAndStyles(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasBlock(html: string, blockId: string): boolean {
  return new RegExp(`data-template-block="${blockId}"`, "i").test(html);
}

function schemaTypesPresent(html: string): Set<string> {
  const types = new Set<string>();
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const tag of scripts) {
    const body = tag.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    try {
      const json = JSON.parse(body) as unknown;
      const visit = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        const rec = node as Record<string, unknown>;
        const t = rec["@type"];
        if (typeof t === "string") types.add(t);
        if (Array.isArray(t)) for (const x of t) if (typeof x === "string") types.add(x);
        if (Array.isArray(rec["@graph"])) for (const g of rec["@graph"]) visit(g);
        for (const v of Object.values(rec)) {
          if (Array.isArray(v)) for (const item of v) visit(item);
          else visit(v);
        }
      };
      visit(json);
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return types;
}

export function validateCommercialPageContractV1(html: string): CommercialPageContractValidation {
  const checks: CommercialPageContractCheck[] = [];
  const add = (id: string, label: string, passed: boolean, detail?: string) =>
    checks.push({ id, label, passed, detail });

  const text = visibleText(html);
  const faqCount = countFaqBlocks(html);
  const types = schemaTypesPresent(html);

  add(
    "header_platform_v1",
    "Platform Header V1",
    /data-pharmaconnect-component="platform-header-v1"/.test(html),
  );
  add("footer_platform_v1", "Platform Footer V1", /data-pharmaconnect-component="platform-footer-v1"/.test(html));

  add(
    "hero_present",
    "Hero section",
    hasBlock(html, "hero") || /id="hero-section"|class="hero"/.test(html),
  );
  add("hero_title", "Service title (H1)", /<h1\b[^>]*>/i.test(html));
  add(
    "hero_intro",
    "Patient-focused introduction",
    text.length > 400 && /patient|pharmacy first|consultation|advice/.test(text),
  );
  add(
    "hero_primary_cta",
    "Primary CTA",
    /class="[^"]*btn[^"]*"/i.test(html) && /book|call|contact|appointment|consultation|tel:/i.test(html),
  );
  add(
    "hero_trust",
    "Trust statement",
    hasBlock(html, "trust-cards") || /gphc|nhs|registered|professional|trust/i.test(text),
  );

  add(
    "overview_service",
    "Service overview — what the service is",
    hasBlock(html, "service-definition") || /what is|pharmacy first is|service offers/i.test(text),
  );
  add(
    "overview_audience",
    "Service overview — who it is for",
    hasBlock(html, "eligibility") || /who can|patients who|eligible|suitable for/i.test(text),
  );
  add(
    "overview_why",
    "Service overview — why patients use it",
    /why patients|benefit|access|without a gp|same day|convenient/i.test(text),
  );

  add("eligibility_section", "Eligibility section", hasBlock(html, "eligibility"));
  add(
    "eligibility_exclusions",
    "Who should not / when to contact pharmacy",
    /should not|seek urgent|gp|111|emergency|exclude|refer/i.test(text),
  );

  add(
    "benefits_section",
    "Benefits (patient / clinical / convenience / NHS)",
    hasBlock(html, "benefits") ||
      hasBlock(html, "conditions") ||
      (/patient benefit|clinical benefit|nhs|commissioned|convenience|same-day/i.test(text) &&
        hasBlock(html, "service-definition")),
  );

  add(
    "booking_process",
    "Booking process (step-by-step)",
    hasBlock(html, "process") || /step|appointment|before appointment|during|follow-up|preparation/i.test(text),
  );

  add(
    "local_relevance",
    "Local relevance",
    hasBlock(html, "local") || /locally|community|patients in|areas served|nearby/i.test(text),
  );

  add(
    "trust_pharmacist",
    "Trust — pharmacist / professional standards",
    hasBlock(html, "trust-split") ||
      hasBlock(html, "professional-review") ||
      /pharmacist|gphc|professional standard|registr/i.test(text),
  );

  add(
    "trust_reviews",
    "Reviews / Google rating / trust indicators",
    /review|rating|google|stars|trusted/i.test(text) || hasBlock(html, "trust-cards"),
  );

  add("faq_min_5", "Minimum five visible FAQs", faqCount >= 5, `count=${faqCount}`);

  add(
    "internal_links",
    "Internal links (anchors / related)",
    (html.match(/href="#[a-z0-9-]+"/gi) || []).length >= 3 ||
      (html.match(/href="\/api\/pharmacy-content-ecosystem-preview\//gi) || []).length >= 2,
  );
  add(
    "contact_links",
    "Contact links",
    /tel:|mailto:|#contact|id="contact"/i.test(html),
  );
  add(
    "booking_links",
    "Booking links",
    /book|appointment|tel:/i.test(html),
  );

  const hasService = types.has("Service") || /"@type"\s*:\s*"Service"/i.test(html);
  const hasFaqSchema = types.has("FAQPage") || /FAQPage/i.test(html);
  const hasBreadcrumb = types.has("BreadcrumbList") || /BreadcrumbList/i.test(html);
  const hasLocal =
    types.has("Pharmacy") ||
    types.has("LocalBusiness") ||
    types.has("MedicalBusiness") ||
    /LocalBusiness|Pharmacy|MedicalBusiness/i.test(html);
  const hasMedicalOrg = types.has("MedicalOrganization") || types.has("MedicalBusiness") || hasLocal;

  add("schema_service", "Structured data — Service", hasService);
  add("schema_faq", "Structured data — FAQ", hasFaqSchema);
  add("schema_breadcrumb", "Structured data — Breadcrumb", hasBreadcrumb);
  add("schema_local_business", "Structured data — Local Business / Pharmacy", hasLocal);
  add("schema_medical_org", "Structured data — Medical Organisation (where applicable)", hasMedicalOrg);

  const primaryCta = /class="[^"]*btn[^"]*"[^>]*>([^<]{3,})/i.test(html);
  const secondaryCta =
    (html.match(/class="[^"]*btn[^"]*"/gi) || []).length >= 2 ||
    /btn-white-outline|secondary|View FAQs/i.test(html);
  add("cta_primary", "Primary CTA", primaryCta);
  add("cta_secondary", "Secondary CTA", secondaryCta);

  const errors = checks.filter((c) => !c.passed).map((c) => `${c.id}: ${c.label}${c.detail ? ` (${c.detail})` : ""}`);
  return {
    contractId: COMMERCIAL_PAGE_CONTRACT_V1_ID,
    revision: COMMERCIAL_PAGE_CONTRACT_V1_REVISION,
    passed: errors.length === 0,
    checks,
    errors,
  };
}

export function assertCommercialPageContractV1ForGeneration(html: string): void {
  const result = validateCommercialPageContractV1(html);
  if (!result.passed) {
    throw new Error(`Generation blocked — Commercial Page Contract V1: ${result.errors.join("; ")}`);
  }
}
