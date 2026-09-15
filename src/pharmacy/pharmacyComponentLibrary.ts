/**
 * PharmaConnect Growth Engine — Pharmacy Component Library V1
 * + Design Polish + Normalisation & Premium Styling + Design Contrast V1.
 * Reusable visual components for healthcare service page previews.
 */
import type { ServicePageSection, ServicePageFaq } from "./pharmacyServicePageGenerator.ts";
import {
  areaPageSlug,
  dedupeCtaLabels,
  normalizeMythFactBullets,
  normalizePublishedCoverageCount,
  normalizePublishedRelatedCount,
  publishedPageUrl,
  trimToEvenRelatedCount,
  trimToPublishedCoverageCount,
} from "./pharmacyPublishedPagePolish.ts";
import {
  bodyTextForRender,
  ensureCompleteSentence,
  isGenericCardBody,
  preparePublishFeatureCard,
  publishBodyText,
  publishHeroIntro,
  publishHubSectionBody,
  safeCardBody,
  safeCardTitle,
  stripBlueprintLabels,
  type PublishCardContext,
} from "./pharmacySafeText.ts";
import { usesPublishFramework } from "./pharmacyServiceFramework.ts";
import { usesAreaPublishFramework } from "./pharmacyAreaPageFramework.ts";

export interface PreviewChromeInput {
  pharmacyName: string;
  town: string;
  phone: string;
  gphcNumber: string;
  serviceName: string;
}

export type HeroVariant = "a" | "b";
export type CtaVariant = "book-consultation" | "request-advice" | "speak-pharmacist" | "check-eligibility";

export interface TrustMetricsInput {
  yearsServingCommunity: string;
  nhsServicesLabel: string;
  gphcNumber: string;
  deliveryAvailable: string[];
}

export interface HeroInput {
  pharmacyName: string;
  town: string;
  h1: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  variant?: HeroVariant;
  serviceName?: string;
  serviceId?: string;
  localAreas?: string[];
  phone?: string;
  pills?: string[];
  publishMode?: boolean;
}

export interface CoverageInput {
  heading: string;
  body?: string;
  town: string;
  localAreas: string[];
  pharmacyName: string;
  publishMode?: boolean;
  areaUrlForName?: (area: string) => string | null;
}

export interface CtaBlockInput {
  heading: string;
  body: string;
  primary: string;
  secondary?: string;
  variant?: CtaVariant;
  phone?: string;
  email?: string;
  bookingUrl?: string;
  anchor?: string;
  publishMode?: boolean;
  heroCtaLabels?: string[];
}

export interface SectionRenderContext {
  serviceId: string;
  serviceName: string;
  slug: string;
  town: string;
  localAreas: string[];
  pharmacyName: string;
  phone?: string;
  businessEmail?: string;
  bookingUrl?: string;
  publishMode?: boolean;
  currentArea?: string;
  urlForPageSlug?: (pageSlug: string) => string;
  urlForService?: (serviceId: string) => string;
  publishedPageSlugs?: Set<string>;
  siteHomeUrl?: string;
}

function publishCardContext(ctx: SectionRenderContext, sectionType: string): PublishCardContext {
  return {
    serviceName: ctx.serviceName,
    serviceId: ctx.serviceId,
    pharmacyName: ctx.pharmacyName,
    town: ctx.town,
    currentArea: ctx.currentArea,
    sectionType,
    goldStandard: usesPublishFramework(ctx.serviceId) || usesAreaPublishFramework(ctx.serviceId),
  };
}
const ICONS = {
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`,
  faq: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`,
  step: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  nhs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  local: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>`,
};

const BENEFIT_ICONS = [ICONS.shield, ICONS.clock, ICONS.check, ICONS.heart, ICONS.users, ICONS.calendar];

const BENEFIT_SUMMARIES = [
  "Professional support from your registered pharmacy team.",
  "Clear, confidential advice tailored to your needs.",
  "Structured assessment before any supply or treatment.",
  "Transparent fees and eligibility explained upfront.",
  "Convenient local access with clinical governance.",
  "Follow-up guidance and safety-netting where appropriate.",
];

const EDUCATION_ICONS = [ICONS.book, ICONS.info, ICONS.doc, ICONS.shield, ICONS.check, ICONS.heart];

const BENEFIT_FILLER_HEADINGS = [
  "Professional pharmacy care",
  "Confidential consultation",
  "Clear clinical guidance",
  "Local community access",
  "Trusted healthcare support",
  "Patient-centred service",
];

export function normalizeBenefitsCount(count: number): number {
  if (count === 4 || count === 6 || count === 8) return count;
  if (count === 5) return 4;
  if (count === 7) return 6;
  if (count <= 3) return 4;
  if (count > 8) return 8;
  return 6;
}

export function normalizeEducationCount(count: number): number {
  if (count === 3 || count === 6) return count;
  if (count <= 4) return 3;
  return 6;
}

export function normalizeRelatedCount(count: number): number {
  if (count === 3 || count === 4 || count === 6) return count;
  if (count <= 2) return 3;
  if (count === 5) return 6;
  return count >= 7 ? 6 : 4;
}

export function normalizeCoverageCount(count: number): number {
  if ([4, 6, 8, 12].includes(count)) return count;
  if (count <= 3) return 4;
  if (count === 5) return 6;
  if (count === 7 || count === 9) return 8;
  if (count <= 11) return 12;
  return 12;
}

export function normalizeItems<T>(items: T[], target: number, filler: (index: number) => T): T[] {
  const list = items.slice(0, target);
  while (list.length < target) list.push(filler(list.length));
  return list;
}

export function sectionRhythmClass(index: number): string {
  const pattern = ["", "rhythm-blue", "", "rhythm-teal", "", "rhythm-grey"];
  return pattern[index % 6];
}

export function inferServiceTag(serviceId: string): "nhs" | "private" | "mixed" {
  const id = serviceId.toLowerCase();
  if (id.includes("travel") || id.includes("private") || id.includes("weight")) return "private";
  if (
    id.includes("blood") ||
    id.includes("pharmacy-first") ||
    id.includes("repeat") ||
    id.includes("prescription") ||
    id.includes("nms") ||
    id.includes("smoking") ||
    id.includes("flu")
  ) {
    return "nhs";
  }
  return "mixed";
}

export function gridColsClass(count: number, base: string): string {
  if (count === 4) return `${base} ${base}--4`;
  if (count === 6) return `${base} ${base}--6`;
  if (count === 8) return `${base} ${base}--8`;
  if (count === 3) return `${base} ${base}--3`;
  return base;
}

export function esc(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Preview/dashboard display — limits by complete sentences, never mid-word ellipsis. */
export function truncateDisplayText(text: string, max = 300): string {
  return bodyTextForRender(text, max, false);
}

export { publishBodyText, bodyTextForRender };

export function humanizeBenefitHeading(text: string): string {
  const cleaned = String(text || "")
    .replace(
      /^(Mention|Explain|Reference|Be transparent about|Be clear about|Avoid|Describe|Include|Highlight|Clarify)\s+/i,
      "",
    )
    .trim();
  if (!cleaned) return text;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function renderSectionHeader(
  kicker: string,
  title: string,
  intro?: string,
  centered = true,
): string {
  const introHtml = intro ? `<p class="section-lead section-intro">${esc(intro)}</p>` : "";
  const centerClass = centered ? " section-head--center" : "";
  return `<div class="section-head${centerClass}">
<span class="section-kicker">${esc(kicker)}</span>
<h2 class="section-title">${esc(title)}</h2>
${introHtml}
</div>`;
}

export function applySectionBand(html: string, bandClass = ""): string {
  if (!bandClass) return html;
  return html.replace('class="section-block', `class="section-block ${bandClass}`);
}

/** @deprecated use sectionRhythmClass */
export function applySectionRhythm(html: string, index: number): string {
  return applySectionBand(html, sectionRhythmClass(index));
}

export function pickHeroVariant(serviceId: string): HeroVariant {
  const softHero = new Set([
    "repeat-prescriptions",
    "prescription-dispensing",
    "prescription-collection",
    "eps",
    "medicines-delivery",
  ]);
  return softHero.has(serviceId) ? "b" : "a";
}

export function inferCtaVariant(label: string): CtaVariant {
  const lower = label.toLowerCase();
  if (/book|appointment|consultation/.test(lower)) return "book-consultation";
  if (/eligib|check|availab/.test(lower)) return "check-eligibility";
  if (/pharmacist|speak|talk/.test(lower)) return "speak-pharmacist";
  return "request-advice";
}

function splitBenefitItem(text: string): { heading: string; summary: string } {
  const colon = text.indexOf(":");
  if (colon > 0 && colon < 48) {
    return { heading: text.slice(0, colon).trim(), summary: text.slice(colon + 1).trim() || text };
  }
  const words = text.split(/\s+/);
  if (words.length <= 5) return { heading: text, summary: "" };
  return { heading: words.slice(0, 4).join(" "), summary: text };
}

export function parseMythFactBullets(bullets: string[]): Array<{ myth: string; fact: string }> {
  return bullets.map((b) => {
    const match = b.match(/^Myth:\s*(.+?)\s*Fact:\s*(.+)$/i);
    if (match) return { myth: match[1].trim(), fact: match[2].trim() };
    return { myth: b, fact: "" };
  });
}

export function processStepsForService(serviceId: string, serviceName: string): Array<{ title: string; description: string }> {
  const id = serviceId.toLowerCase();
  if (id.includes("pharmacy-first") || id === "pharmacy-first") {
    return [
      { title: "Book or attend", description: "Call or walk in — the team confirms waiting times and whether Pharmacy First is appropriate for your symptoms." },
      { title: "Assessment", description: "Private consultation covering symptoms, history, medicines and pathway eligibility." },
      { title: "Treatment or advice", description: "Supply where clinically appropriate, self-care guidance, or referral to GP or urgent care." },
      { title: "Follow-up", description: "Clear safety-netting on when to return, contact GP, or seek emergency help." },
    ];
  }
  if (id.includes("emergency-contraception") || id.includes("contraception")) {
    return [
      { title: "Urgent contact", description: "Call or attend as soon as possible — timing since unprotected sex affects which options remain effective." },
      { title: "Confidential assessment", description: "Private discussion of timing, medical history, medicines and previous emergency contraception use." },
      { title: "Supply and advice", description: "The most suitable emergency contraceptive option explained and supplied where clinically appropriate." },
      { title: "Follow-up", description: "Ongoing contraception signposting and when to take a pregnancy test if periods do not arrive as expected." },
    ];
  }
  if (id.includes("travel") || id.includes("vaccin")) {
    return [
      { title: "Assessment", description: "Travel risk review, itinerary check and medical history screening." },
      { title: "Consultation", description: "Destination-specific vaccine advice and schedule planning." },
      { title: "Treatment", description: "Vaccination supply where suitable, with documentation as required." },
      { title: "Follow-up", description: "Booster reminders, course completion and pre-travel checks." },
    ];
  }
  if (id.includes("blood") || id.includes("pressure") || id.includes("hypertension")) {
    return [
      { title: "Assessment", description: "Blood pressure reading, history review and risk factor discussion." },
      { title: "Consultation", description: "Results explained in plain language with lifestyle guidance." },
      { title: "Treatment", description: "Referral or monitoring plan agreed where clinically appropriate." },
      { title: "Follow-up", description: "Repeat checks and GP signposting when needed." },
    ];
  }
  if (id.includes("repeat") || id.includes("prescription") || id.includes("dispens")) {
    return [
      { title: "Assessment", description: "Prescription review, EPS status and supply requirements confirmed." },
      { title: "Consultation", description: "Medicines counselling and any queries addressed by the team." },
      { title: "Treatment", description: "Accurate dispensing and safe supply of your medicines." },
      { title: "Follow-up", description: "Repeat ordering support and ongoing medicines management." },
    ];
  }
  return [
    { title: "Assessment", description: `Initial review to confirm suitability for ${serviceName.toLowerCase()}.` },
    { title: "Consultation", description: "Confidential discussion with a trained pharmacy professional." },
    { title: "Treatment", description: "Supply, service delivery or referral based on clinical assessment." },
    { title: "Follow-up", description: "Safety-netting advice and follow-up where appropriate." },
  ];
}

function parseTimelineBullet(text: string): { title: string; description: string } {
  const colon = text.indexOf(":");
  if (colon > 0) {
    return { title: text.slice(0, colon).trim(), description: text.slice(colon + 1).trim() };
  }
  return { title: text, description: "" };
}

export function componentStyles(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet"/>
<style>
:root {
  --nhs-blue: #005eb8;
  --nhs-dark: #003087;
  --healthcare-teal: #0d9488;
  --pharmacy-green: #007f3b;
  --ink: #1a3347;
  --rhythm-blue: #EAF5FA;
  --rhythm-teal: #DFF5F1;
  --rhythm-grey: #F2F4F7;
  --dark-teal: #0a4f4a;
  --dark-blue: #001a3d;
  --teal-soft: #ecfdf5;
  --soft-blue: #f4f9fd;
  --text: #1e293b;
  --muted: #64748b;
  --border: #e2e8f0;
  --line-soft: #e8f2f8;
  --surface: #f8fafc;
  --card: #ffffff;
  --radius: 16px;
  --radius-lg: 20px;
  --shadow: 0 8px 24px rgba(26, 58, 82, 0.06);
  --shadow-md: 0 12px 32px rgba(26, 58, 82, 0.08);
  --font-heading: "Poppins", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  --section-pad: 44px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--font-body);
  color: var(--text);
  line-height: 1.65;
  background: #fff;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3, h4 { font-family: var(--font-heading); font-weight: 700; line-height: 1.25; }
.wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px 48px; }
.section-block { padding: var(--section-pad) 0; }
.section-block + .section-block { padding-top: var(--section-pad); }
.rhythm-blue {
  background: var(--rhythm-blue);
  border-top: 1px solid #c5e3ef; border-bottom: 1px solid #c5e3ef;
}
.rhythm-teal {
  background: var(--rhythm-teal);
  border-top: 1px solid #b8e6de; border-bottom: 1px solid #b8e6de;
}
.rhythm-grey {
  background: var(--rhythm-grey);
  border-top: 1px solid #dce0e6; border-bottom: 1px solid #dce0e6;
}
.section-head { max-width: 780px; margin-bottom: 22px; }
.section-head--center { text-align: center; margin-left: auto; margin-right: auto; }
.section-kicker {
  display: inline-block; font-size: .74rem; font-weight: 800;
  text-transform: uppercase; letter-spacing: .09em; color: var(--nhs-blue);
  background: rgba(0, 94, 184, 0.09); padding: 6px 14px; border-radius: 999px;
  margin-bottom: 12px; border: 1px solid rgba(0, 94, 184, 0.14);
}
.section-title {
  font-size: clamp(1.55rem, 2.8vw, 2.1rem); color: var(--nhs-dark); margin: 0 0 10px;
  letter-spacing: -.02em; font-weight: 800;
}
.section-lead, .section-intro {
  color: var(--muted); max-width: 640px; margin: 0 0 20px; font-size: 1.02rem; line-height: 1.65;
}
.section-head--center .section-lead, .section-head--center .section-intro { margin-left: auto; margin-right: auto; }
.rhythm-blue .section-kicker { background: rgba(0, 94, 184, 0.12); }
.rhythm-teal .section-kicker { background: rgba(13, 148, 136, 0.12); color: #0f766e; border-color: rgba(13, 148, 136, 0.2); }

.preview-banner {
  background: #fff8e6; color: #92400e; font-size: .75rem; font-weight: 700;
  text-align: center; padding: 9px 16px; border-bottom: 1px solid #fde68a;
}
.preview-banner strong { color: #78350f; }

.top-trust-bar {
  background: var(--soft-blue); border-bottom: 1px solid var(--line-soft);
  padding: 9px 0; font-size: .8rem; color: var(--muted);
}
.top-trust-inner {
  max-width: 1120px; margin: 0 auto; padding: 0 24px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
}
.trust-badges { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.trust-badge {
  display: inline-flex; align-items: center; padding: 5px 12px; border-radius: 999px;
  font-size: .68rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; border: 1px solid transparent;
}
.trust-badge--gphc { background: #fff; border-color: #c7dff5; color: var(--nhs-blue); }
.trust-badge--nhs { background: #e8f4fd; border-color: #b9daf5; color: var(--nhs-blue); }
.trust-badge--local { background: var(--teal-soft); border-color: #bbf7d0; color: var(--pharmacy-green); }
.header-contact { font-weight: 600; color: var(--ink); white-space: nowrap; }

.site-header {
  background: #fff; border-bottom: 1px solid var(--line-soft); position: sticky; top: 0; z-index: 40;
  padding: 14px 0; box-shadow: 0 2px 12px rgba(26, 58, 82, 0.04);
}
.site-header-inner {
  max-width: 1120px; margin: 0 auto; padding: 0 24px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
}
.site-brand { display: flex; flex-direction: column; gap: 2px; text-decoration: none; line-height: 1.2; }
.site-brand-name { font-family: var(--font-heading); font-size: 1.05rem; font-weight: 800; color: var(--ink); }
.site-brand-tagline { font-size: .72rem; font-weight: 600; color: var(--healthcare-teal); letter-spacing: .02em; }
.site-nav-cta {
  display: inline-flex; align-items: center; min-height: 42px; padding: 10px 18px; border-radius: 999px;
  background: var(--nhs-blue); color: #fff !important; text-decoration: none; font-weight: 700; font-size: .88rem;
  box-shadow: var(--shadow);
}
.site-nav-cta:hover { filter: brightness(1.05); text-decoration: none; }

/* Hero A — NHS gradient premium */
.hero-a {
  background: linear-gradient(135deg, var(--nhs-dark) 0%, var(--nhs-blue) 48%, #0e7490 100%);
  color: #fff; padding: 88px 0 104px; position: relative; overflow: hidden; min-height: 420px;
}
.hero-a::after {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(circle at 88% 12%, rgba(255,255,255,.14) 0%, transparent 42%);
  pointer-events: none;
}
.hero-a .wrap { padding-bottom: 0; position: relative; z-index: 1; }
.hero-meta { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; align-items: center; }
.hero-service-badge {
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 999px;
  background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.28);
  font-size: .78rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em;
}
.hero-service-badge svg { width: 16px; height: 16px; }
.hero-tag {
  display: inline-flex; padding: 6px 14px; border-radius: 999px; font-size: .72rem; font-weight: 800;
  text-transform: uppercase; letter-spacing: .05em;
}
.hero-tag--nhs { background: #e8f4fd; color: #003087; border: 1px solid rgba(255,255,255,.4); }
.hero-tag--private { background: rgba(13,148,136,.25); color: #ecfdf5; border: 1px solid rgba(255,255,255,.35); }
.hero-tag--mixed { background: rgba(255,255,255,.2); color: #fff; border: 1px solid rgba(255,255,255,.35); }
.hero-a .hero-eyebrow { font-size: .88rem; opacity: .92; margin-bottom: 12px; letter-spacing: .02em; }
.hero-a h1 { font-size: clamp(2rem, 4.5vw, 2.85rem); margin: 0 0 18px; color: #fff; letter-spacing: -.025em; max-width: 780px; }
.hero-a .hero-intro { font-size: 1.08rem; max-width: 620px; opacity: .95; margin: 0 0 28px; color: #e8f4ff; line-height: 1.75; }
.hero-trust-row { display: flex; flex-wrap: wrap; gap: 18px; margin-bottom: 28px; }
.hero-trust-item { display: inline-flex; align-items: center; gap: 8px; font-size: .85rem; font-weight: 600; opacity: .92; }
.hero-trust-item svg { width: 18px; height: 18px; flex-shrink: 0; }
.hero-local { font-size: .88rem; opacity: .88; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
.hero-local svg { width: 16px; height: 16px; }
.hero-a .hero-pills { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 28px; }
.hero-a .hero-pill {
  background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.26);
  border-radius: 999px; padding: 7px 15px; font-size: .82rem; font-weight: 600;
}

/* Hero B — soft healthcare premium */
.hero-b {
  background: linear-gradient(180deg, var(--soft-blue) 0%, #fff 82%);
  color: var(--text); padding: 88px 0 104px; border-bottom: 1px solid var(--line-soft); min-height: 400px;
}
.hero-b .wrap { position: relative; z-index: 1; }
.hero-b .hero-eyebrow {
  display: inline-block; padding: 7px 15px; border-radius: 999px;
  background: #e8f4fd; color: var(--nhs-blue); font-size: .72rem; font-weight: 800;
  text-transform: uppercase; letter-spacing: .06em; margin-bottom: 16px; border: 1px solid #cce4f8;
}
.hero-b h1 { font-size: clamp(2rem, 4.5vw, 2.85rem); margin: 0 0 18px; color: var(--nhs-dark); letter-spacing: -.025em; max-width: 780px; }
.hero-b .hero-intro { font-size: 1.08rem; max-width: 620px; color: var(--muted); margin: 0 0 28px; line-height: 1.75; }
.hero-b .hero-trust-item { color: var(--muted); }
.hero-b .hero-local { color: var(--muted); }

.hero-ctas { display: flex; flex-wrap: wrap; gap: 14px; }
.hero-ctas--premium { margin-top: 8px; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 15px 28px; border-radius: 999px; font-weight: 700; font-size: .95rem;
  text-decoration: none; border: 2px solid transparent; cursor: pointer; font-family: var(--font-body);
  transition: transform .15s, box-shadow .15s; min-height: 52px;
}
.btn-lg { padding: 16px 32px; font-size: 1rem; min-height: 56px; }
.btn svg { width: 18px; height: 18px; flex-shrink: 0; }
.btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); text-decoration: none; }
.btn-primary { background: #fff; color: var(--nhs-dark); }
.btn-secondary { background: transparent; color: inherit; border-color: rgba(255,255,255,.55); }
.btn-teal { background: var(--healthcare-teal); color: #fff; border-color: var(--healthcare-teal); }
.btn-outline-light { background: transparent; color: #fff; border-color: rgba(255,255,255,.65); }
.hero-b .btn-primary { background: var(--nhs-blue); color: #fff; border-color: var(--nhs-blue); }
.hero-b .btn-secondary { color: var(--nhs-dark); border-color: var(--border); background: #fff; }

/* Trust Metrics — dark band + white cards */
.trust-section {
  background: linear-gradient(180deg, var(--dark-blue) 0%, var(--nhs-dark) 100%);
  padding: 48px 0 56px; position: relative; z-index: 2;
}
.trust-section .wrap { padding-bottom: 0; }
.trust-metrics {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px;
  margin: 0 auto; position: relative; z-index: 2;
}
.trust-metric {
  background: #fff; border: none; border-radius: var(--radius-lg);
  padding: 26px 20px; text-align: center;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.18);
  transition: transform .18s, box-shadow .18s;
}
.trust-metric:hover { transform: translateY(-4px); box-shadow: 0 18px 44px rgba(0, 0, 0, 0.22); }
.trust-metric-icon {
  width: 52px; height: 52px; margin: 0 auto 14px; border-radius: 16px;
  background: linear-gradient(135deg, #e8f4fd, var(--teal-soft));
  display: flex; align-items: center; justify-content: center; color: var(--nhs-blue);
}
.trust-metric-icon svg { width: 24px; height: 24px; }
.trust-metric .label { font-size: .7rem; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); font-weight: 700; }
.trust-metric .value { font-size: .95rem; font-weight: 700; margin-top: 8px; color: var(--ink); line-height: 1.4; }

/* Benefits Grid */
.benefits-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.benefits-grid--4 { grid-template-columns: repeat(2, 1fr); }
.benefits-grid--6 { grid-template-columns: repeat(3, 1fr); }
.benefits-grid--8 { grid-template-columns: repeat(4, 1fr); }
.benefit-card {
  background: var(--card); border: 1px solid var(--line-soft); border-radius: var(--radius-lg);
  padding: 28px 24px; box-shadow: var(--shadow); transition: box-shadow .2s, border-color .2s, transform .2s;
  height: 100%;
}
.benefit-card:hover { box-shadow: var(--shadow-md); border-color: #cce4f8; transform: translateY(-3px); }
.benefit-icon {
  width: 48px; height: 48px; border-radius: 14px;
  background: linear-gradient(135deg, #e8f4fd, #ecfdf5);
  color: var(--nhs-blue); display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
}
.benefit-icon svg { width: 24px; height: 24px; }
.benefit-card h3 { font-size: 1.02rem; margin: 0 0 10px; color: var(--nhs-dark); }
.benefit-card p { margin: 0; font-size: .9rem; color: var(--muted); line-height: 1.6; }

.feature-grid {
  display: grid; gap: 18px; margin-top: 8px;
}
.feature-grid--2 { grid-template-columns: repeat(2, 1fr); }
.feature-grid--3 { grid-template-columns: repeat(3, 1fr); }
.feature-card {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 22px 20px; box-shadow: var(--shadow); transition: transform .15s, box-shadow .15s;
}
.feature-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
.feature-icon {
  width: 44px; height: 44px; border-radius: 12px; margin-bottom: 14px;
  background: linear-gradient(135deg, #e8f4fd, var(--teal-soft));
  display: flex; align-items: center; justify-content: center; color: var(--nhs-blue);
}
.feature-icon svg { width: 22px; height: 22px; }
.feature-card h3 { font-size: 1rem; margin: 0 0 8px; color: var(--nhs-dark); }
.feature-card p { margin: 0; font-size: .9rem; color: var(--muted); line-height: 1.6; }
.coverage-badge--link {
  text-decoration: none; color: inherit; transition: transform .15s, box-shadow .15s;
}
.coverage-badge--link:hover {
  transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--nhs-blue);
}
.nearby-area-grid { display: grid; gap: 14px; margin-top: 12px; }
.nearby-area-grid--2 { grid-template-columns: repeat(2, 1fr); }
.nearby-area-grid--4 { grid-template-columns: repeat(2, 1fr); }
.nearby-area-card {
  display: flex; align-items: center; gap: 10px; padding: 16px 18px;
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  text-decoration: none; color: var(--text); font-weight: 600; box-shadow: var(--shadow);
}
.nearby-area-card:hover { border-color: var(--nhs-blue); background: #f0f9ff; text-decoration: none; }
.nearby-area-card svg { width: 18px; height: 18px; color: var(--nhs-blue); flex-shrink: 0; }
.local-context-panel {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 28px; box-shadow: var(--shadow);
}
.local-context-copy { font-size: 1.02rem; color: var(--text); line-height: 1.75; margin: 0 0 22px; max-width: 820px; }

/* Process Timeline */
.process-timeline { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; position: relative; }
@media (min-width: 901px) {
  .process-timeline::before {
    content: ""; position: absolute; top: 38px; left: 10%; right: 10%; height: 2px;
    background: linear-gradient(90deg, var(--nhs-blue), var(--healthcare-teal)); opacity: .22; z-index: 0;
  }
}
.process-step {
  background: var(--card); border: 1px solid var(--line-soft); border-radius: var(--radius-lg);
  padding: 22px 18px; box-shadow: var(--shadow); position: relative; z-index: 1;
}
.process-step-num {
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, var(--nhs-blue), var(--healthcare-teal));
  color: #fff; font-family: var(--font-heading); font-weight: 800; font-size: .95rem;
  display: flex; align-items: center; justify-content: center; margin-bottom: 14px;
  box-shadow: 0 4px 14px rgba(0,94,184,.25);
}
.process-step-icon { width: 20px; height: 20px; margin-bottom: 10px; color: var(--healthcare-teal); }
.process-step h3 { font-size: .95rem; margin: 0 0 6px; color: var(--nhs-dark); }
.process-step p { margin: 0; font-size: .85rem; color: var(--muted); line-height: 1.5; }

.content-timeline { max-width: 720px; }
.content-timeline-step {
  display: flex; gap: 16px; margin-bottom: 16px; padding: 18px 20px;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
}
.content-timeline-marker {
  flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%;
  background: var(--healthcare-teal); margin-top: 6px; box-shadow: 0 0 0 4px var(--teal-soft);
}
.content-timeline-step h3 { font-size: .95rem; margin: 0 0 4px; color: var(--nhs-dark); }
.content-timeline-step p { margin: 0; font-size: .88rem; color: var(--muted); }

/* Professional Insight — dark feature section */
.section-block--dark-insight {
  background: linear-gradient(135deg, #0a4f4a 0%, #0d5c56 45%, #0f766e 100%);
  padding: 56px 0;
}
.section-block--dark-insight .section-kicker {
  background: rgba(255, 255, 255, 0.14); color: #a7f3d0; border-color: rgba(255, 255, 255, 0.22);
}
.section-block--dark-insight .section-title { color: #fff; }
.section-block--dark-insight .section-lead,
.section-block--dark-insight .section-intro { color: rgba(255, 255, 255, 0.88); }
.section-block--dark-insight.rhythm-blue,
.section-block--dark-insight.rhythm-teal,
.section-block--dark-insight.rhythm-grey {
  background: linear-gradient(135deg, #0a4f4a 0%, #0d5c56 45%, #0f766e 100%);
  border: none;
}
.insight-card {
  background: transparent; border: none; border-radius: 0; padding: 0;
  box-shadow: none; position: relative; overflow: visible;
}
.insight-card::before { display: none; }
.insight-badge {
  display: inline-flex; align-items: center; gap: 6px; font-size: .72rem; font-weight: 800;
  text-transform: uppercase; letter-spacing: .06em; color: #a7f3d0; margin-bottom: 14px;
}
.insight-card h2 { font-size: clamp(1.35rem, 2.5vw, 1.75rem); margin: 0 0 12px; color: #fff; font-weight: 800; }
.insight-card .insight-body { color: rgba(255, 255, 255, 0.92); margin: 0 0 18px; font-size: 1.02rem; line-height: 1.7; }
.insight-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.insight-list li {
  padding: 12px 16px; background: rgba(255, 255, 255, 0.1); border-radius: 12px;
  font-size: .92rem; color: #fff; border: 1px solid rgba(255, 255, 255, 0.16);
}
.insight-list li::before { content: "✓ "; color: #6ee7b7; font-weight: 700; }

/* Patient Education */
.education-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.education-grid--3 { grid-template-columns: repeat(3, 1fr); }
.education-grid--6 { grid-template-columns: repeat(3, 1fr); }
.education-card {
  background: var(--card); border: 1px solid var(--line-soft); border-radius: var(--radius-lg);
  padding: 26px 22px; box-shadow: var(--shadow); transition: transform .15s, box-shadow .15s;
  height: 100%;
}
.education-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.education-card-icon {
  width: 44px; height: 44px; border-radius: 12px; background: var(--teal-soft);
  color: var(--healthcare-teal); display: flex; align-items: center; justify-content: center; margin-bottom: 14px;
}
.education-card-icon svg { width: 22px; height: 22px; }
.education-card h3 { font-size: .94rem; margin: 0; color: var(--nhs-dark); line-height: 1.45; }

/* Myth vs Fact */
.myth-fact-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.myth-fact-card {
  border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow);
  border: 1px solid var(--border); background: var(--card);
}
.myth-fact-card .myth {
  background: #fdf4ff; border-bottom: 1px solid #f3e8ff; padding: 16px 18px;
}
.myth-fact-card .fact {
  background: #ecfdf5; padding: 16px 18px;
}
.myth-fact-card .label {
  font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; display: block; margin-bottom: 6px;
}
.myth-fact-card .myth .label { color: #9333ea; }
.myth-fact-card .fact .label { color: #059669; }
.myth-fact-card p { margin: 0; font-size: .9rem; color: var(--text); line-height: 1.5; }

/* Comparison Table */
.comparison-table-wrap { overflow-x: auto; border-radius: var(--radius-lg); box-shadow: var(--shadow); border: 1px solid var(--border); }
.comparison-table { width: 100%; border-collapse: collapse; font-size: .92rem; background: var(--card); }
.comparison-table th {
  background: linear-gradient(180deg, #f0f9ff, var(--surface)); color: var(--nhs-dark);
  font-family: var(--font-heading); font-weight: 700; text-align: left; padding: 14px 18px;
  border-bottom: 2px solid var(--border);
}
.comparison-table td { padding: 14px 18px; border-bottom: 1px solid var(--border); color: #334155; vertical-align: top; }
.comparison-table tr:last-child td { border-bottom: none; }
.comparison-table tr:nth-child(even) td { background: var(--surface); }

/* Coverage Grid */
.coverage-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 20px; }
.coverage-grid--6 { grid-template-columns: repeat(3, 1fr); }
.coverage-grid--8 { grid-template-columns: repeat(4, 1fr); }
.coverage-grid--12 { grid-template-columns: repeat(4, 1fr); }
.coverage-badge {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 18px;
  background: var(--card); border: 1px solid var(--line-soft); border-radius: 999px;
  font-size: .88rem; font-weight: 600; color: var(--nhs-dark); box-shadow: var(--shadow);
  transition: transform .15s, box-shadow .15s, border-color .15s, background .15s;
  text-align: center;
}
.coverage-badge:hover {
  transform: translateY(-2px); box-shadow: var(--shadow-md);
  border-color: var(--healthcare-teal); background: var(--teal-soft);
}
.coverage-badge svg { width: 15px; height: 15px; color: var(--healthcare-teal); flex-shrink: 0; }
.coverage-panel {
  background: var(--card); border: 1px solid var(--line-soft); border-radius: var(--radius-lg);
  padding: 36px 32px; box-shadow: var(--shadow-md);
}

/* FAQ cards — locked service-page blueprint (cluster-faq-item / faq-card) */
.faq .cluster-faq-item, .faq .faq-card, .cluster-faq-item.faq-card {
  border: 1px solid var(--border); border-radius: 18px; padding: 20px 22px; margin-bottom: 14px;
  background: var(--card); box-shadow: var(--shadow);
}
.faq .faq-q, .cluster-faq-item .faq-q { font-size: 1.05rem; margin: 0 0 10px; color: var(--nhs-dark); font-family: var(--font-heading); }
.faq .faq-a, .cluster-faq-item .faq-a { margin: 0; color: #334155; font-size: .95rem; line-height: 1.65; }

/* CTA Block — dark pharmacy blue, white buttons */
.cta-section {
  padding: 72px 0; background: linear-gradient(180deg, var(--dark-blue) 0%, #001428 100%);
}
.cta-block {
  border-radius: var(--radius-lg); padding: 52px 40px; text-align: center; color: #fff;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.28);
  background: linear-gradient(135deg, #001428 0%, var(--nhs-dark) 42%, var(--nhs-blue) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.cta-block--book, .cta-block--advice, .cta-block--pharmacist, .cta-block--eligibility {
  background: linear-gradient(135deg, #001428 0%, var(--nhs-dark) 42%, var(--nhs-blue) 100%);
}
.cta-block h2 { color: #fff; font-size: clamp(1.55rem, 3vw, 2.15rem); margin: 0 0 12px; letter-spacing: -.02em; font-weight: 800; }
.cta-block p { opacity: .95; margin: 0 auto 28px; max-width: 580px; color: #e8f4ff; font-size: 1.05rem; line-height: 1.65; }
.cta-block .hero-ctas { justify-content: center; gap: 14px; }
.cta-block .btn-primary,
.cta-block .btn-secondary,
.cta-block .btn-teal {
  background: #fff; color: var(--nhs-dark); border-color: #fff;
}
.cta-block .btn-primary:hover,
.cta-block .btn-secondary:hover,
.cta-block .btn-teal:hover {
  background: #f0f9ff; color: var(--nhs-dark);
}
.cta-phone { color: #fff; }
.cta-phone {
  display: inline-flex; align-items: center; gap: 10px; margin-bottom: 28px;
  font-size: 1.25rem; font-weight: 700; color: #fff; text-decoration: none;
}
.cta-phone:hover { text-decoration: underline; }
.cta-phone svg { width: 22px; height: 22px; }

.related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.related-grid--2 { grid-template-columns: repeat(2, 1fr); }
.related-grid--4 { grid-template-columns: repeat(2, 1fr); }
.related-grid--6 { grid-template-columns: repeat(3, 1fr); }

/* Default content cards */
.content-card {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg);
  padding: 28px; box-shadow: var(--shadow); margin-bottom: 0;
}
.content-card--mistakes { border-left: 4px solid #ea580c; background: #fffbf5; }
.content-card--safety { border-left: 4px solid #dc2626; background: #fef2f2; }
.content-card--deepdive { background: var(--surface); }
.content-card h2 { font-size: 1.25rem; margin: 0 0 12px; color: var(--nhs-dark); }
.content-card .card-body { color: #334155; margin: 0 0 14px; line-height: 1.7; }
.card-more { margin: 12px 0 0; font-size: .82rem; color: var(--muted); font-style: italic; }
.check-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.check-list li {
  padding-left: 22px; position: relative; font-size: .92rem; color: #334155;
}
.check-list li::before {
  content: "✓"; position: absolute; left: 0; color: var(--healthcare-teal); font-weight: 700;
}
.avoid-list li::before { content: "✕"; color: #ea580c; }

.related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.related-card {
  border: 1px solid var(--line-soft); border-radius: var(--radius-lg); padding: 22px 22px;
  background: var(--card); text-decoration: none; color: var(--nhs-blue); font-weight: 700;
  box-shadow: var(--shadow); font-size: .92rem; transition: border-color .15s, box-shadow .15s, transform .15s;
  display: flex; align-items: center; min-height: 72px;
}
.related-card:hover { border-color: var(--nhs-blue); box-shadow: var(--shadow-md); background: #f0f9ff; text-decoration: none; transform: translateY(-2px); }
.related-card::after { content: "→"; margin-left: 8px; opacity: .6; }

.preview-footer {
  background: var(--ink); color: #b8cfe0; padding: 40px 0 28px; font-size: .88rem;
}
.preview-footer-inner {
  max-width: 1120px; margin: 0 auto; padding: 0 24px;
  display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px;
}
.preview-footer h3 { color: #fff; font-family: var(--font-heading); font-size: 1rem; margin: 0 0 8px; }
.preview-footer p { margin: 0 0 6px; line-height: 1.6; }
.preview-footer a { color: #fff; font-weight: 600; text-decoration: none; }
.preview-footer a:hover { text-decoration: underline; }
.preview-footer-note { margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.12); font-size: .75rem; color: #8fb4cc; }

.dev-panel {
  margin-top: 48px; padding: 20px 22px; background: #0f172a; color: #94a3b8;
  border-radius: var(--radius); font-family: ui-monospace, monospace; font-size: .78rem;
}
.dev-panel h3 { color: #e2e8f0; font-size: .85rem; margin: 0 0 12px; font-family: inherit; }
.dev-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }
.dev-check { padding: 8px 10px; border-radius: 6px; background: #1e293b; }
.dev-check.pass { border-left: 3px solid #22c55e; }
.dev-check.fail { border-left: 3px solid #ef4444; }
.dev-check .status { font-weight: 700; color: #e2e8f0; }

@media (max-width: 900px) {
  .trust-metrics { grid-template-columns: repeat(2, 1fr); }
  .benefits-grid, .benefits-grid--4, .benefits-grid--6, .benefits-grid--8,
  .education-grid, .education-grid--3, .education-grid--6,
  .myth-fact-grid, .process-timeline, .related-grid, .related-grid--4, .related-grid--6,
  .coverage-grid, .coverage-grid--6, .coverage-grid--8, .coverage-grid--12,
  .preview-footer-inner { grid-template-columns: 1fr; }
  .top-trust-inner { flex-direction: column; align-items: flex-start; }
  .hero-a, .hero-b { padding: 64px 0 80px; min-height: auto; }
  .hero-ctas .btn { flex: 1 1 calc(50% - 8px); min-width: 140px; }
  .cta-section { padding: 56px 0; }
  .cta-block { padding: 40px 24px; }
  .cta-block .hero-ctas .btn { flex: 1 1 100%; width: 100%; }
  .section-block--dark-insight { padding: 44px 0; }
}
@media (max-width: 520px) {
  .trust-metrics { grid-template-columns: 1fr; }
  .wrap { padding-left: 16px; padding-right: 16px; }
  .section-block { padding: 40px 0; }
  .section-block + .section-block { padding-top: 40px; }
  .hero-ctas .btn { flex: 1 1 100%; width: 100%; }
  .comparison-table-wrap { margin: 0 -4px; }
}
</style>`;
}

export function renderPreviewTopTrustBar(input: PreviewChromeInput): string {
  const phone = input.phone ? `Tel: ${esc(input.phone)}` : "";
  return `<div class="top-trust-bar"><div class="top-trust-inner">
<div class="trust-badges">
<span class="trust-badge trust-badge--gphc">GPhC Registered</span>
<span class="trust-badge trust-badge--nhs">NHS Services</span>
<span class="trust-badge trust-badge--local">Independent Community Pharmacy</span>
</div>
${phone ? `<div class="header-contact">${phone}</div>` : ""}
</div></div>`;
}

export function renderPreviewSiteHeader(input: PreviewChromeInput & { homeUrl?: string }): string {
  const gphc = input.gphcNumber ? ` · GPhC ${esc(input.gphcNumber)}` : "";
  const home = input.homeUrl || "#";
  return `<header class="site-header">
<div class="site-header-inner">
<a class="site-brand" href="${esc(home)}">
<span class="site-brand-name">${esc(input.pharmacyName)}</span>
<span class="site-brand-tagline">${esc(input.serviceName)} · ${esc(input.town)}${gphc}</span>
</a>
<a class="site-nav-cta" href="#contact">Book Consultation</a>
</div>
</header>`;
}

export function renderPreviewFooter(input: PreviewChromeInput): string {
  const phoneHtml = input.phone
    ? `<p><a href="tel:${esc(input.phone.replace(/\s/g, ""))}">${esc(input.phone)}</a></p>`
    : "";
  const gphcHtml = input.gphcNumber ? `<p>GPhC Reg. ${esc(input.gphcNumber)}</p>` : "";
  return `<footer class="preview-footer">
<div class="preview-footer-inner">
<div>
<h3>${esc(input.pharmacyName)}</h3>
<p>Your local community pharmacy in ${esc(input.town)}.</p>
<p class="preview-footer-note">Preview only — not for publication or deployment.</p>
</div>
<div>
<h3>Contact</h3>
${phoneHtml}
${gphcHtml}
<p><a href="#contact">Speak to the pharmacy team</a></p>
</div>
</div>
</footer>`;
}

export function renderHero(input: HeroInput): string {
  return input.variant === "b" ? renderHeroB(input) : renderHeroA(input);
}

export function renderHeroA(input: HeroInput): string {
  return `<header class="hero-a">
  <div class="wrap">
    <div class="hero-eyebrow">${esc(input.pharmacyName)} · ${esc(input.town)}</div>
    <h1>${esc(input.h1)}</h1>
    <p class="hero-intro">${esc(input.intro)}</p>
    <div class="hero-ctas">
      <a class="btn btn-primary" href="#contact">${esc(input.primaryCta)}</a>
      <a class="btn btn-secondary" href="#contact">${esc(input.secondaryCta)}</a>
    </div>
  </div>
</header>`;
}

export function renderHeroB(input: HeroInput): string {
  return `<header class="hero-b">
  <div class="wrap">
    <span class="hero-eyebrow">${esc(input.pharmacyName)} · ${esc(input.town)}</span>
    <h1>${esc(input.h1)}</h1>
    <p class="hero-intro">${esc(input.intro)}</p>
    <div class="hero-ctas">
      <a class="btn btn-primary" href="#contact">${esc(input.primaryCta)}</a>
      <a class="btn btn-secondary" href="#contact">${esc(input.secondaryCta)}</a>
    </div>
  </div>
</header>`;
}

export function renderHeroWithPills(input: HeroInput, pills: string[] = input.pills || []): string {
  const variant = input.variant === "b" ? "b" : "a";
  const heroClass = variant === "b" ? "hero-b" : "hero-a";
  const serviceName = input.serviceName || "Pharmacy Service";
  const serviceTag = inferServiceTag(input.serviceId || "");
  const tagLabel = serviceTag === "nhs" ? "NHS Service" : serviceTag === "private" ? "Private Healthcare" : "Pharmacy Service";
  const tagClass = `hero-tag hero-tag--${serviceTag}`;
  const localLabel = input.localAreas?.length
    ? `Serving ${esc(input.town)} — ${esc(input.localAreas.slice(0, 3).join(", "))}`
    : `Serving ${esc(input.town)} and surrounding areas`;

  const pillsHtml = pills.length
    ? `<div class="hero-pills">${pills.slice(0, 4).map((p) => `<span class="hero-pill">${esc(p)}</span>`).join("")}</div>`
    : "";

  const eyebrow =
    variant === "b"
      ? `<span class="hero-eyebrow">${esc(input.pharmacyName)} · ${esc(input.town)}</span>`
      : `<div class="hero-eyebrow">${esc(input.pharmacyName)} · ${esc(input.town)}</div>`;

  const meta = `<div class="hero-meta">
  <span class="hero-service-badge">${ICONS.shield}${esc(serviceName)}</span>
  <span class="${tagClass}">${esc(tagLabel)}</span>
</div>`;

  const trustRow = `<div class="hero-trust-row">
  <span class="hero-trust-item">${ICONS.check} GPhC registered pharmacy</span>
  <span class="hero-trust-item">${ICONS.nhs} NHS &amp; clinical services</span>
  <span class="hero-trust-item">${ICONS.users} Experienced pharmacy team</span>
</div>`;

  const localRow = `<div class="hero-local">${ICONS.pin}${localLabel}</div>`;

  const phoneBtn = input.phone
    ? `<a class="btn btn-outline-light btn-lg" href="tel:${esc(input.phone.replace(/\s/g, ""))}">${ICONS.phone}${esc(input.phone)}</a>`
    : "";

  const ctas = input.publishMode
    ? `<div class="hero-ctas hero-ctas--premium">
  ${dedupeCtaLabels(input.primaryCta, input.secondaryCta)
    .map((label, i) => {
      const cls = i === 0 ? "btn btn-primary btn-lg" : "btn btn-secondary btn-lg";
      const outline = variant === "b" && i > 0 ? " btn-secondary" : "";
      return `<a class="${cls}${outline}" href="#contact">${esc(label)}</a>`;
    })
    .join("\n  ")}
  ${phoneBtn}
</div>`
    : `<div class="hero-ctas hero-ctas--premium">
  <a class="btn btn-primary btn-lg" href="#contact">${esc(input.primaryCta)}</a>
  <a class="btn btn-secondary btn-lg" href="#contact">${esc(input.secondaryCta)}</a>
  <a class="btn btn-teal btn-lg" href="#contact">Speak To A Pharmacist</a>
  <a class="btn btn-outline-light btn-lg" href="#contact">Check Eligibility</a>
  ${phoneBtn}
</div>`;

  return `<header class="${heroClass}">
  <div class="wrap">
    ${eyebrow}
    ${meta}
    <h1>${esc(input.h1)}</h1>
    <p class="hero-intro">${esc(input.intro)}</p>
    ${trustRow}
    ${localRow}
    ${variant === "a" ? pillsHtml : ""}
    ${ctas}
  </div>
</header>`;
}

export function renderTrustMetrics(input: TrustMetricsInput & { town?: string }): string {
  const years = input.yearsServingCommunity || "Established local pharmacy";
  const localSupport = input.town ? `${input.town} & local areas` : "Your local community";
  const items = [
    { icon: ICONS.check, label: "GPhC Registered", value: input.gphcNumber ? `Reg. ${input.gphcNumber}` : "Registered pharmacy" },
    { icon: ICONS.nhs, label: "NHS Services Available", value: input.nhsServicesLabel },
    { icon: ICONS.users, label: "Experienced Pharmacy Team", value: years },
    { icon: ICONS.local, label: "Local Community Support", value: localSupport },
  ];

  return `<section class="trust-section" data-component="trust-metrics">
<div class="wrap"><div class="trust-metrics">
${items
  .map(
    (t) => `<div class="trust-metric">
  <div class="trust-metric-icon">${t.icon}</div>
  <div class="label">${esc(t.label)}</div>
  <div class="value">${esc(t.value)}</div>
</div>`,
  )
  .join("\n")}
</div></div>
</section>`;
}

export function renderBenefitsGrid(section: ServicePageSection, publishMode = false, cardCtx?: PublishCardContext): string {
  const target = normalizeBenefitsCount(section.bullets.length || 4);
  const normalizedBullets = normalizeItems(section.bullets, target, (i) => BENEFIT_FILLER_HEADINGS[i % BENEFIT_FILLER_HEADINGS.length]);

  const items = normalizedBullets
    .map((b, i) => {
      if (publishMode && cardCtx) {
        const prepared = preparePublishFeatureCard(b, { ...cardCtx, sectionType: section.type || "benefits" });
        if (!prepared) return null;
        return `<div class="benefit-card">
  <div class="benefit-icon">${BENEFIT_ICONS[i % BENEFIT_ICONS.length]}</div>
  <h3>${esc(prepared.title)}</h3>
  <p>${esc(prepared.body)}</p>
</div>`;
      }
      const { heading, summary } = splitBenefitItem(b);
      const displayHeading = humanizeBenefitHeading(heading);
      const displaySummary = summary || BENEFIT_SUMMARIES[i % BENEFIT_SUMMARIES.length];
      return `<div class="benefit-card">
  <div class="benefit-icon">${BENEFIT_ICONS[i % BENEFIT_ICONS.length]}</div>
  <h3>${esc(displayHeading)}</h3>
  <p>${esc(displaySummary)}</p>
</div>`;
    })
    .filter(Boolean);

  const gridClass = gridColsClass(Math.max(items.length, 2), "benefits-grid");
  const bodyHtml = section.body ? bodyTextForRender(section.body, 220, publishMode) : undefined;

  return `<section class="section-block" data-component="benefits-grid">
  <div class="wrap">
    ${renderSectionHeader("Why choose us", section.heading, bodyHtml)}
    <div class="${gridClass}">${items.join("\n")}</div>
  </div>
</section>`;
}

export function renderProcessTimeline(
  serviceId: string,
  serviceName: string,
  heading?: string,
  lead?: string,
  publishMode = false,
): string {
  const steps = processStepsForService(serviceId, serviceName);
  const stepsHtml = steps
    .slice(0, 4)
    .map(
      (s, i) => `<div class="process-step">
  <div class="process-step-num">${i + 1}</div>
  <div class="process-step-icon">${ICONS.step}</div>
  <h3>${esc(s.title)}</h3>
  <p>${esc(s.description)}</p>
</div>`,
    )
    .join("\n");

  return `<section class="section-block" data-component="process-timeline">
  <div class="wrap">
    ${renderSectionHeader("How it works", heading || "Your Care Pathway", lead ? bodyTextForRender(lead, 220, publishMode) : undefined)}
    <div class="process-timeline">${stepsHtml}</div>
  </div>
</section>`;
}

export function renderContentTimeline(section: ServicePageSection, publishMode = false): string {
  const bullets = normalizeItems(section.bullets.slice(0, 4), 4, (i) => `Step ${i + 1}: Consultation milestone`);
  const steps = bullets.map(parseTimelineBullet);
  const stepsHtml = steps
    .map(
      (s) => `<div class="content-timeline-step">
  <div class="content-timeline-marker"></div>
  <div>
    <h3>${esc(s.title)}</h3>
    ${s.description ? `<p>${esc(s.description)}</p>` : ""}
  </div>
</div>`,
    )
    .join("\n");

  const intro = section.body
    ? publishMode
      ? publishHubSectionBody(stripBlueprintLabels(section.body), section.type)
      : bodyTextForRender(section.body, 220, publishMode)
    : undefined;

  return `<section class="section-block" data-component="content-timeline">
  <div class="wrap">
    ${renderSectionHeader("Planning timeline", section.heading, intro)}
    <div class="content-timeline">${stepsHtml}</div>
  </div>
</section>`;
}

export function renderProfessionalInsightCard(section: ServicePageSection, publishMode = false): string {
  const listHtml = section.bullets.length
    ? `<ul class="insight-list">${section.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
    : "";

  return `<section class="section-block section-block--dark-insight" data-component="professional-insight">
  <div class="wrap">
    ${renderSectionHeader("Pharmacist insight", section.heading.replace(/^Professional Insight:\s*/i, ""), section.body ? bodyTextForRender(section.body, 260, publishMode) : undefined)}
    <div class="insight-card">
      ${listHtml}
    </div>
  </div>
</section>`;
}

export function renderPatientEducationCards(section: ServicePageSection, publishMode = false): string {
  const target = normalizeEducationCount(section.bullets.length || 3);
  const normalizedBullets = normalizeItems(section.bullets, target, (i) => `Patient education topic ${i + 1}`);

  const cards = normalizedBullets.map((b, i) => {
    const icon = EDUCATION_ICONS[i % EDUCATION_ICONS.length];
    return `<div class="education-card">
  <div class="education-card-icon">${icon}</div>
  <h3>${esc(b)}</h3>
</div>`;
  });

  const gridClass = target === 6 ? "education-grid education-grid--6" : "education-grid education-grid--3";

  const intro = section.body
    ? publishMode
      ? publishHubSectionBody(stripBlueprintLabels(section.body), section.type)
      : bodyTextForRender(section.body, 220, publishMode)
    : undefined;

  return `<section class="section-block" data-component="patient-education">
  <div class="wrap">
    ${renderSectionHeader("Patient education", section.heading, intro)}
    <div class="${gridClass}">${cards.join("\n")}</div>
  </div>
</section>`;
}

export function renderMythVsFactComponent(
  section: ServicePageSection,
  serviceId?: string,
  publishMode?: boolean,
): string {
  const bullets = publishMode && serviceId
    ? normalizeMythFactBullets(section.bullets, serviceId)
    : section.bullets;
  const pairs = parseMythFactBullets(bullets);
  const cards = pairs
    .map(
      (p) => `<div class="myth-fact-card">
  <div class="myth"><span class="label">Myth</span><p>${esc(p.myth)}</p></div>
  ${p.fact ? `<div class="fact"><span class="label">Fact</span><p>${esc(p.fact)}</p></div>` : ""}
</div>`,
    )
    .join("\n");

  return `<section class="section-block" data-component="myth-vs-fact">
  <div class="wrap">
    ${renderSectionHeader(
      "Evidence-based advice",
      section.heading,
      section.body
        ? publishMode
          ? publishHubSectionBody(stripBlueprintLabels(section.body), section.type)
          : bodyTextForRender(section.body, 220, publishMode)
        : undefined,
    )}
    <div class="myth-fact-grid">${cards}</div>
  </div>
</section>`;
}

export function renderServiceComparisonTable(section: ServicePageSection, publishMode = false): string {
  const rows = section.bullets.map((b) => {
    const parts = b.split(/\s*[—–|]\s*/);
    if (parts.length >= 2) {
      return `<tr><td>${esc(parts[0])}</td><td>${esc(parts.slice(1).join(" — "))}</td></tr>`;
    }
    return `<tr><td colspan="2">${esc(b)}</td></tr>`;
  });

  return `<section class="section-block" data-component="comparison-table">
  <div class="wrap">
    ${renderSectionHeader(
      "Compare options",
      section.heading,
      section.body
        ? publishMode
          ? publishHubSectionBody(stripBlueprintLabels(section.body), section.type)
          : bodyTextForRender(section.body, 220, publishMode)
        : undefined,
    )}
    <div class="comparison-table-wrap">
      <table class="comparison-table">
        <thead><tr><th>Option</th><th>Details</th></tr></thead>
        <tbody>${rows.join("\n")}</tbody>
      </table>
    </div>
  </div>
</section>`;
}

export function renderCoverageAreaGrid(input: CoverageInput): string {
  const selectedAreas = input.localAreas.filter(Boolean);
  const rawAreas = input.publishMode
    ? selectedAreas
    : [input.town, ...selectedAreas.filter((a) => a !== input.town)].filter(Boolean);
  const unique = [...new Set(rawAreas)];
  const target = input.publishMode
    ? normalizePublishedCoverageCount(unique.length || 2)
    : normalizeCoverageCount(unique.length || 4);
  const areas = input.publishMode
    ? trimToPublishedCoverageCount(unique).slice(0, target || unique.length)
    : normalizeItems(unique, target, (i) => `${input.town} area ${i + 1}`);

  const gridModifier =
    target === 6 ? "coverage-grid--6" : target === 8 ? "coverage-grid--8" : target === 12 ? "coverage-grid--12" : "";

  const badges = areas
    .map((area) => {
      const url = input.publishMode && input.areaUrlForName ? input.areaUrlForName(area) : null;
      const inner = `${ICONS.pin}${esc(area)}`;
      return url
        ? `<a class="coverage-badge coverage-badge--link" href="${esc(url)}">${inner}</a>`
        : `<span class="coverage-badge">${inner}</span>`;
    })
    .join("\n");

  return `<section class="section-block" data-component="coverage-grid">
  <div class="wrap">
    <div class="coverage-panel">
      ${renderSectionHeader("Local access", input.heading, input.body ? bodyTextForRender(input.body, 240, input.publishMode) : `${input.pharmacyName} provides accessible pharmacy care across ${input.town} and surrounding neighbourhoods.`)}
      <div class="coverage-grid ${gridModifier}">${badges}</div>
    </div>
  </div>
</section>`;
}

/** Locked FAQ blueprint: service-page faq-card components (no giant ? icons / disclosure arrows). */
export function renderFaqAccordion(faqs: ServicePageFaq[], heading = "Frequently Asked Questions", publishMode = false): string {
  if (!faqs.length) return "";
  const items = faqs
    .map((f) => {
      const answer = publishMode ? publishBodyText(f.answer) : bodyTextForRender(f.answer, 320, publishMode);
      return `<div class="cluster-faq-item faq-card"><h3 class="faq-q">${esc(f.question)}</h3><p class="faq-a">${esc(answer)}</p></div>`;
    })
    .join("\n");

  return `<section class="faq section-block" data-component="faq-accordion" data-template-block="faq" id="service-faq">
  <div class="wrap">
    ${renderSectionHeader("Common questions", heading)}
    ${items}
  </div>
</section>`;
}

export function renderCtaBlock(input: CtaBlockInput): string {
  const variant = input.variant || inferCtaVariant(input.primary);
  const modifier =
    variant === "book-consultation"
      ? "cta-block--book"
      : variant === "speak-pharmacist"
        ? "cta-block--pharmacist"
        : variant === "check-eligibility"
          ? "cta-block--eligibility"
          : "cta-block--advice";

  const anchor = input.anchor || "contact";
  const phoneHtml = input.phone
    ? `<a class="cta-phone" href="tel:${esc(input.phone.replace(/\s/g, ""))}">${ICONS.phone}${esc(input.phone)}</a>`
    : "";

  const emailHtml = input.email
    ? `<a class="cta-email" href="mailto:${esc(input.email)}">${esc(input.email)}</a>`
    : "";

  const bookingHtml = input.bookingUrl
    ? `<a class="btn btn-teal btn-lg" href="${esc(input.bookingUrl)}" rel="noopener">Book online</a>`
    : "";

  const heroLabels = (input.heroCtaLabels || []).map((l) => l.toLowerCase());
  const ctaLabels = input.publishMode
    ? dedupeCtaLabels(input.primary, input.secondary).filter((l) => !heroLabels.includes(l.toLowerCase()))
    : ["Book Consultation", input.primary, "Speak To A Pharmacist", "Check Eligibility"].filter(Boolean);

  const ctaButtons = ctaLabels
    .map((label, i) => {
      const cls = i === 0 ? "btn btn-primary btn-lg" : i === 1 ? "btn btn-secondary btn-lg" : "btn btn-teal btn-lg";
      return `<a class="${cls}" href="#${esc(anchor)}">${esc(label)}</a>`;
    })
    .join("\n        ");

  const ctaRow = ctaButtons
    ? `<div class="hero-ctas hero-ctas--premium">
        ${ctaButtons}
      </div>`
    : "";

  return `<section class="section-block cta-section" data-component="cta-block" id="${esc(anchor)}">
  <div class="wrap">
    <div class="cta-block ${modifier}">
      <h2>${esc(input.heading)}</h2>
      <p>${esc(bodyTextForRender(input.body, 260, input.publishMode))}</p>
      ${phoneHtml}
      ${emailHtml}
      ${bookingHtml}
      ${ctaRow}
    </div>
  </div>
</section>`;
}

function featureGridCols(count: number): string {
  if (count <= 2) return "feature-grid feature-grid--2";
  if (count === 3) return "feature-grid feature-grid--3";
  return "feature-grid feature-grid--2";
}

function renderFeatureListCards(
  bullets: string[],
  isAvoid = false,
  publishMode = false,
  cardCtx?: PublishCardContext,
): string {
  const icons = isAvoid ? [ICONS.info, ICONS.info, ICONS.info, ICONS.info] : BENEFIT_ICONS;
  const displayBullets = publishMode ? bullets : bullets.slice(0, isAvoid ? 5 : 4);
  if (!displayBullets.length) return "";

  const seenBodies = new Set<string>();
  const seenTitles = new Set<string>();
  const cards: string[] = [];

  for (let i = 0; i < displayBullets.length; i++) {
    const b = displayBullets[i];
    let heading = "";
    let body = "";

    if (publishMode && cardCtx) {
      const prepared = preparePublishFeatureCard(b, cardCtx);
      if (!prepared) continue;
      heading = prepared.title;
      body = prepared.body;
    } else if (publishMode) {
      continue;
    } else {
      const legacy = splitBenefitItem(b);
      heading = humanizeBenefitHeading(legacy?.heading || b);
      body = legacy?.summary || BENEFIT_SUMMARIES[i % BENEFIT_SUMMARIES.length];
    }

    if (!heading || !body) continue;
    const titleKey = heading.toLowerCase();
    const bodyKey = body.toLowerCase();
    if (seenTitles.has(titleKey) || seenBodies.has(bodyKey)) continue;
    seenTitles.add(titleKey);
    seenBodies.add(bodyKey);

    const icon = icons[i % icons.length];
    cards.push(`<div class="feature-card${isAvoid ? " feature-card--avoid" : ""}">
  <div class="feature-icon">${icon}</div>
  <h3>${esc(heading)}</h3>
  <p>${esc(body)}</p>
</div>`);
  }

  if (!cards.length) return "";
  return `<div class="${featureGridCols(cards.length)}">${cards.join("\n")}</div>`;
}

function isInternalOnlyCardHeading(text: string): boolean {
  return /^(?:Patient intent|Barrier addressed|Authority topic|Myth|Question|Eligibility question|Cost\/value question)\s*\d*\.?$/i.test(
    String(text || "").trim(),
  );
}

export function renderPublishedLocalContextSection(section: ServicePageSection, ctx: SectionRenderContext): string {
  const area = ctx.currentArea || ctx.town;
  const heading = `Healthcare Support for ${area} Patients`;
  const baseBody = section.body ? publishBodyText(section.body) : "";
  const supportCopy =
    `${ctx.pharmacyName} supports patients in ${area} with ${ctx.serviceName.toLowerCase()} advice tailored to local NHS pathways. ` +
    `The team explains eligibility, booking options and follow-up before you attend.`;
  const intro = publishHeroIntro(baseBody ? `${baseBody} ${supportCopy}` : supportCopy);

  const cardCtx: PublishCardContext = {
    serviceName: ctx.serviceName,
    serviceId: ctx.serviceId,
    pharmacyName: ctx.pharmacyName,
    town: ctx.town,
    currentArea: area,
    sectionType: "localContext",
  };

  const bulletCards =
    section.bullets.length > 0
      ? renderFeatureListCards(section.bullets.slice(0, 4), false, true, cardCtx)
      : renderFeatureListCards(
          [
            `Local access from ${area}: Patients in ${area} can reach ${ctx.pharmacyName} for ${ctx.serviceName.toLowerCase()} with the same clinical standards used across ${ctx.town}.`,
            `Booking guidance: The pharmacy confirms whether ${ctx.serviceName.toLowerCase()} is NHS-funded or private for your situation before the appointment is booked.`,
            `Follow-up support: After ${ctx.serviceName.toLowerCase()}, you receive safety-netting advice and clear next steps if symptoms persist or change.`,
            `Area coverage: ${area} sits within ${ctx.pharmacyName}'s ${ctx.town} service area with documented referral routes when GP review is needed.`,
          ],
          false,
          true,
          cardCtx,
        );

  return `<section class="section-block" data-section-type="localContext">
  <div class="wrap">
    ${renderSectionHeader("Your local pharmacy", heading, undefined, false)}
    <div class="local-context-panel">
      <p class="local-context-copy">${esc(publishBodyText(intro))}</p>
      ${bulletCards}
    </div>
  </div>
</section>`;
}

export function renderNearbyAreasSection(section: ServicePageSection, ctx: SectionRenderContext): string {
  const areas = trimToPublishedCoverageCount(section.bullets.filter(Boolean));
  if (!areas.length) return "";

  const gridClass =
    areas.length <= 2
      ? "nearby-area-grid nearby-area-grid--2"
      : areas.length <= 4
        ? "nearby-area-grid nearby-area-grid--4"
        : "nearby-area-grid nearby-area-grid--4";

  const cards = areas
    .map((area) => {
      const pageSlug = areaPageSlug(ctx.serviceId, area);
      const href =
        ctx.urlForPageSlug?.(pageSlug) ||
        (ctx.publishMode ? publishedPageUrl(pageSlug) : `#${slugifyAreaLocal(area)}`);
      return `<a class="nearby-area-card" href="${esc(href)}">${ICONS.pin}<span>${esc(area)}</span></a>`;
    })
    .join("\n");

  return `<section class="section-block" data-section-type="nearbyAreas">
  <div class="wrap">
    ${renderSectionHeader("Nearby areas", section.heading, section.body ? publishBodyText(section.body) : undefined)}
    <div class="${gridClass}">${cards}</div>
  </div>
</section>`;
}

function slugifyAreaLocal(area: string): string {
  return String(area || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function renderDefaultContentCard(
  section: ServicePageSection,
  extraClass = "",
  publishMode = false,
  cardCtx?: PublishCardContext,
): string {
  const isAvoid = section.type === "howItWorks" || section.type === "commonMistakes";
  const cardClass =
    section.type === "commonMistakes"
      ? "content-card content-card--mistakes"
      : section.type === "safetyConsiderations"
        ? "content-card content-card--safety"
        : section.type === "deepDive"
          ? "content-card content-card--deepdive"
          : "content-card";

  const displayBullets = section.bullets.slice(
    0,
    publishMode && section.type === "conditionsCovered" ? 6 : publishMode ? 4 : 5,
  );
  const remaining = section.bullets.length - displayBullets.length;

  const bulletsHtml = displayBullets.length
    ? publishMode
      ? renderFeatureListCards(
          displayBullets,
          section.type === "commonMistakes",
          true,
          cardCtx
            ? { ...cardCtx, sectionType: section.type }
            : undefined,
        )
      : `<ul class="${isAvoid ? "check-list avoid-list" : "check-list"}">${displayBullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
    : "";
  const moreHtml =
    remaining > 0 && !publishMode
      ? `<p class="card-more">+ ${remaining} more points covered at consultation</p>`
      : "";

  const kickerMap: Record<string, string> = {
    problem: "Understanding the need",
    eligibility: "Who this is for",
    preparationGuide: "Before your visit",
    howItWorks: "What to expect",
    treatmentProcess: "Clinical pathway",
    patientOutcomes: "Expected outcomes",
    deepDive: "Clinical detail",
    relatedTopics: "Related services",
    trust: "Why trust us",
    localNarrative: "Local narrative",
    localContext: "Your local pharmacy",
  };
  const kicker = kickerMap[section.type] || "Service information";
  const introRaw = section.body
    ? publishMode
      ? publishHubSectionBody(stripBlueprintLabels(section.body), section.type)
      : bodyTextForRender(section.body, 280, false)
    : undefined;
  const intro = introRaw || undefined;

  return `<section class="section-block ${extraClass}" data-section-type="${esc(section.type)}">
  <div class="wrap">
    ${renderSectionHeader(kicker, section.heading, intro, false)}
    <div class="${cardClass}">
      ${bulletsHtml}
      ${moreHtml}
    </div>
  </div>
</section>`;
}

export function renderRelatedServicesGrid(
  services: Array<{ serviceId: string; serviceName: string }>,
  slug: string,
): string {
  if (!services.length) return "";
  const target = normalizeRelatedCount(Math.min(services.length, 6));
  const normalized = services.slice(0, target);
  const gridClass =
    target === 4 ? "related-grid related-grid--4" : target === 6 ? "related-grid related-grid--6" : "related-grid";

  const cards = normalized
    .map(
      (s) =>
        `<a class="related-card" href="/pharmacy-preview-v2/${esc(slug)}/${esc(s.serviceId)}/">${esc(s.serviceName)}</a>`,
    )
    .join("\n");

  return `<section class="section-block" data-component="related-services">
  <div class="wrap">
    ${renderSectionHeader("More services", "Related Pharmacy Services", "Explore other pharmacy services available at your local branch.")}
    <div class="${gridClass}">${cards}</div>
  </div>
</section>`;
}

export function renderConversionNextStepPanel(section: ServicePageSection, ctx: SectionRenderContext): string {
  const phone = ctx.phone || "";
  const email = ctx.businessEmail || "";
  const bookingUrl = ctx.bookingUrl || "";

  const actions: string[] = [];
  if (phone) {
    actions.push(
      `<a class="btn btn-primary btn-lg conversion-action" href="tel:${esc(phone.replace(/\s/g, ""))}">${ICONS.phone} Call ${esc(phone)}</a>`,
    );
  }
  if (bookingUrl) {
    actions.push(
      `<a class="btn btn-secondary btn-lg conversion-action" href="${esc(bookingUrl)}" rel="noopener">${ICONS.calendar} Book online</a>`,
    );
  }
  if (email) {
    actions.push(
      `<a class="btn btn-teal btn-lg conversion-action" href="mailto:${esc(email)}">${ICONS.doc} Email the team</a>`,
    );
  }

  return `<section class="section-block" data-component="conversion-next-step" data-section-type="conversionNextStep">
  <div class="wrap">
    <div class="conversion-next-step">
      ${renderSectionHeader("Next steps", section.heading, bodyTextForRender(section.body, 280, ctx.publishMode))}
      <div class="conversion-actions">${actions.join("\n")}</div>
    </div>
  </div>
</section>`;
}

export function renderConversionReassuranceCards(
  section: ServicePageSection,
  publishMode = false,
  cardCtx?: PublishCardContext,
): string {
  const cards = (section.bullets || [])
    .map((b) => {
      const sep = b.includes("::") ? "::" : ": ";
      const idx = b.indexOf(sep);
      if (idx <= 0) return null;
      let title = b.slice(0, idx).trim();
      let body = b.slice(idx + sep.length).trim();
      if (publishMode) {
        title = safeCardTitle(stripBlueprintLabels(title));
        body = cardCtx
          ? safeCardBody(stripBlueprintLabels(body), title, {
              ...cardCtx,
              sectionType: section.type,
            })
          : ensureCompleteSentence(stripBlueprintLabels(body));
      }
      if (!title || !body) return null;
      return { title, body };
    })
    .filter(Boolean) as Array<{ title: string; body: string }>;

  if (!cards.length) return "";

  const cardHtml = cards
    .map(
      (c, i) => `<div class="feature-card conversion-reassurance-card">
  <div class="feature-icon">${BENEFIT_ICONS[i % BENEFIT_ICONS.length]}</div>
  <h3>${esc(c.title)}</h3>
  <p>${esc(publishMode ? c.body : bodyTextForRender(c.body, 180, publishMode))}</p>
</div>`,
    )
    .join("\n");

  const intro = section.body
    ? publishMode
      ? publishHubSectionBody(stripBlueprintLabels(section.body), section.type)
      : bodyTextForRender(section.body, 220, publishMode)
    : undefined;

  return `<section class="section-block" data-component="conversion-reassurance" data-section-type="conversionReassurance">
  <div class="wrap">
    ${renderSectionHeader("Before you book", section.heading, intro)}
    <div class="${featureGridCols(cards.length)}">${cardHtml}</div>
  </div>
</section>`;
}

export function renderSectionComponent(section: ServicePageSection, ctx: SectionRenderContext): string {
  const publishMode = !!ctx.publishMode;

  switch (section.type) {
    case "benefits":
      return renderBenefitsGrid(section, publishMode, publishCardContext(ctx, section.type));
    case "professionalInsight":
      return renderProfessionalInsightCard(section, publishMode);
    case "patientEducation":
      return renderPatientEducationCards(section, publishMode);
    case "mythVsFact":
      return renderMythVsFactComponent(section, ctx.serviceId, publishMode);
    case "timeline":
      return renderContentTimeline(section, publishMode);
    case "localRelevance":
    case "localExpansion":
      return renderCoverageAreaGrid({
        heading: section.heading,
        body: section.body,
        town: ctx.town,
        localAreas: section.bullets.length ? section.bullets : ctx.localAreas,
        pharmacyName: ctx.pharmacyName,
        publishMode,
        areaUrlForName: publishMode
          ? (area) => {
              const slug = areaPageSlug(ctx.serviceId, area);
              return ctx.urlForPageSlug?.(slug) || publishedPageUrl(slug);
            }
          : undefined,
      });
    case "comparison":
      return renderServiceComparisonTable(section, publishMode);
    case "howItWorks":
      return renderProcessTimeline(ctx.serviceId, ctx.serviceName, section.heading, section.body, publishMode);
    case "localContext":
      return publishMode ? renderPublishedLocalContextSection(section, ctx) : renderDefaultContentCard(section);
    case "nearbyAreas":
      return publishMode ? renderNearbyAreasSection(section, ctx) : renderDefaultContentCard(section);
    case "localNarrative":
      return renderDefaultContentCard(section, "", publishMode);
    case "conversionNextStep":
      return renderConversionNextStepPanel(section, ctx);
    case "conversionReassurance":
      return renderConversionReassuranceCards(section, publishMode, {
        serviceName: ctx.serviceName,
        serviceId: ctx.serviceId,
        pharmacyName: ctx.pharmacyName,
        town: ctx.town,
        currentArea: ctx.currentArea,
      });
    default:
      return renderDefaultContentCard(section, "", publishMode, publishCardContext(ctx, section.type));
  }
}
