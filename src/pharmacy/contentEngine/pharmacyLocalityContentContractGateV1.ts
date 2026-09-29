/**
 * Locality content contract gate.
 * Proves a page is built from service × locality synthesis.
 * Locality-name swaps, title changes, and evidence-name lists do not pass.
 */
import { visiblePatientFacingText } from "./pharmacyVerifiedLocalEvidenceConsumptionContract.ts";
import {
  localPatientCopyBody,
  type LocalPatientCopyV1,
} from "./pharmacyLocalPatientCopyV1.ts";

export const EVIDENCE_NAME_LIST_PATTERN = /useful stored local context for this journey includes/i;

const FABRICATION_RULES: Array<{ id: string; re: RegExp }> = [
  { id: "invented-parking", re: /\bparking\b/i },
  { id: "invented-journey-minutes", re: /\b\d+\s+minutes?\b/i },
  { id: "invented-journey-time", re: /\bjourney time\b/i },
  { id: "invented-driving-route", re: /\bdriving route\b/i },
  { id: "invented-timetable", re: /\b(?:bus|train) every\b/i },
];

const EVIDENCE_SYSTEM_LANGUAGE =
  /\b(verified healthcare location|verified community location|verified local place|verified transport location|verified evidence|evidence sufficiency|this page does not estimate|provided at the pharmacy, not at)\b/i;

function evidenceSystemFailures(text: string): string[] {
  return EVIDENCE_SYSTEM_LANGUAGE.test(text) ? ["evidence-system-language"] : [];
}

function entityPaddingFailures(text: string, names: readonly string[]): string[] {
  const failures: string[] = [];
  for (const name of names) {
    const cleanName = clean(name);
    if (cleanName.length < 3) continue;
    const count = text.match(new RegExp(escapeRe(cleanName), "gi"))?.length || 0;
    if (count > 2) failures.push(`entity-padding:${cleanName}`);
  }
  return failures;
}

function clean(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function maskLocalityContractNames(text: string, names: readonly string[]): string {
  let out = String(text || "");
  const ordered = [...names].map((name) => clean(name)).filter((name) => name.length >= 3);
  ordered.sort((a, b) => b.length - a.length);
  for (const name of ordered) {
    out = out.replace(new RegExp(escapeRe(name), "gi"), " ");
  }
  return out;
}

/** Body copy after locality names and entity names are removed. Addresses stay. */
export function normaliseLocalityTokenText(
  text: string,
  areaNames: readonly string[],
  entityNames: readonly string[],
): string {
  let out = visiblePatientFacingText(maskLocalityContractNames(text, [...areaNames, ...entityNames]));
  out = out.replace(/\b\d+(?:\.\d+)?\s*km\b/g, " ");
  return out.replace(/\s+/g, " ").trim();
}

export function isTokenOnlyDifferentiation(
  a: string,
  b: string,
  names: { areaNames: readonly string[]; entityNames: readonly string[] },
): boolean {
  const left = normaliseLocalityTokenText(a, names.areaNames, names.entityNames);
  const right = normaliseLocalityTokenText(b, names.areaNames, names.entityNames);
  return Boolean(left && right && left === right);
}

function sectionHtml(html: string, pattern: RegExp): string {
  return html.match(pattern)?.[1] || html.match(pattern)?.[0] || "";
}

/** Hidden, script, and style regions are removed. Remaining markup stays so section markers can be read. */
function htmlWithoutHiddenRegions(html: string): string {
  let source = String(html || "");
  source = source.replace(/<!--[\s\S]*?-->/g, " ");
  source = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  source = source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  source = source.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  const hidden =
    /<([a-zA-Z0-9]+)\b[^>]*\b(?:hidden(?=[\s=/>])|aria-hidden\s*=\s*(["'])true\2|style\s*=\s*(["'])[^"']*display\s*:\s*none[^"']*\3|class\s*=\s*(["'])[^"']*\b(?:visually-hidden|sr-only)\b[^"']*\4)[^>]*>[\s\S]*?<\/\1>/gi;
  let previous = "";
  while (source !== previous) {
    previous = source;
    source = source.replace(hidden, " ");
  }
  return source;
}

export function extractVisibleLocalNextStep(html: string): string {
  return visiblePatientFacingText(
    sectionHtml(htmlWithoutHiddenRegions(html), /<p\b[^>]*data-locality-cta[^>]*>([\s\S]*?)<\/p>/i),
  );
}

export function extractVisibleLocalPatientSections(html: string): string {
  const visible = htmlWithoutHiddenRegions(html);
  const hero = sectionHtml(visible, /<section\b[^>]*data-template-block=["']hero["'][^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  const relevance = sectionHtml(visible, /<section\b[^>]*data-template-block=["']local-relevance["'][^>]*>([\s\S]*?)<\/section>/i);
  const access = sectionHtml(visible, /<p class=["']local-intro-lead["']>([\s\S]*?)<\/p>/i);
  const nextStep = extractVisibleLocalNextStep(visible);
  return visiblePatientFacingText([hero, relevance, access, nextStep].join(" "));
}

export function evaluateLocalPatientCopyContract(input: {
  copy: LocalPatientCopyV1;
  areaName: string;
  serviceName: string;
  pharmacyName: string;
  requiredAddresses?: readonly string[];
}): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const body = localPatientCopyBody(input.copy);
  const visible = visiblePatientFacingText(body);
  if (EVIDENCE_NAME_LIST_PATTERN.test(visible)) {
    failures.push("evidence-name-list");
  }
  failures.push(...evidenceSystemFailures(visible));
  if (!new RegExp(escapeRe(input.areaName), "i").test(input.copy.introduction)) {
    failures.push("introduction-missing-locality");
  }
  if (!new RegExp(escapeRe(input.pharmacyName), "i").test(input.copy.introduction)) {
    failures.push("introduction-missing-pharmacy");
  }
  const introWithoutNames = normaliseLocalityTokenText(input.copy.introduction, [input.areaName], input.copy.consumedFactNames);
  if (introWithoutNames.split(/\s+/).filter(Boolean).length < 12) {
    failures.push("introduction-is-name-substitution");
  }
  if (!new RegExp(escapeRe(input.serviceName), "i").test(`${input.copy.serviceContext} ${input.copy.whyUseful}`)) {
    failures.push("missing-service-context");
  }
  if (!/\bcontact\b/i.test(input.copy.nextStep)) {
    failures.push("missing-local-next-step");
  }
  if (/no verified transport location is included/i.test(input.copy.accessContext) && /\b(?:bus|train) every\b/i.test(input.copy.accessContext)) {
    failures.push("transport-invented-without-evidence");
  }
  for (const address of input.requiredAddresses || []) {
    if (address && !visiblePatientFacingText(body).includes(visiblePatientFacingText(address))) {
      failures.push(`missing-verified-address:${address}`);
    }
  }
  const masked = maskLocalityContractNames(body, input.copy.consumedFactNames);
  for (const rule of FABRICATION_RULES) {
    if (rule.re.test(masked)) failures.push(`unsupported-local-claim:${rule.id}`);
  }
  return { ok: failures.length === 0, failures };
}

export function evaluateLocalityHtmlContentContract(input: {
  html: string;
  areaName: string;
  serviceName: string;
  pharmacyName: string;
  requiredAddresses?: readonly string[];
  entityNames?: readonly string[];
}): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const local = extractVisibleLocalPatientSections(input.html);
  if (!local) failures.push("missing-visible-local-sections");
  if (EVIDENCE_NAME_LIST_PATTERN.test(local)) failures.push("evidence-name-list");
  failures.push(...evidenceSystemFailures(local));
  failures.push(...entityPaddingFailures(local, input.entityNames || []));
  const intro = visiblePatientFacingText(
    sectionHtml(input.html, /<section\b[^>]*data-template-block=["']hero["'][^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i),
  );
  const introRemainder = normaliseLocalityTokenText(intro, [input.areaName, input.pharmacyName, input.serviceName], input.entityNames || []);
  if (introRemainder.split(/\s+/).filter(Boolean).length < 8) failures.push("introduction-is-name-substitution");
  if (!new RegExp(escapeRe(input.serviceName), "i").test(local)) failures.push("missing-service-context");
  if (!new RegExp(escapeRe(input.areaName), "i").test(local)) failures.push("introduction-missing-locality");
  if (!/\bcontact\b/i.test(extractVisibleLocalNextStep(input.html))) failures.push("missing-local-next-step");
  for (const address of input.requiredAddresses || []) {
    const needle = visiblePatientFacingText(address);
    if (needle && !local.includes(needle)) failures.push(`missing-verified-address:${address}`);
  }
  const masked = maskLocalityContractNames(local, input.entityNames || []);
  for (const rule of FABRICATION_RULES) {
    if (rule.re.test(masked)) failures.push(`unsupported-local-claim:${rule.id}`);
  }
  return { ok: failures.length === 0, failures };
}

export function localityPagesAreTokenOnlyCopies(
  pages: ReadonlyArray<{ areaName: string; localBody: string; entityNames: readonly string[] }>,
): string[] {
  const failures: string[] = [];
  const areaNames = pages.map((page) => page.areaName);
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const a = pages[i]!;
      const b = pages[j]!;
      if (
        isTokenOnlyDifferentiation(a.localBody, b.localBody, {
          areaNames,
          entityNames: [...a.entityNames, ...b.entityNames],
        })
      ) {
        failures.push(`${a.areaName}/${b.areaName}: token-only locality differentiation`);
      }
    }
  }
  return failures;
}
