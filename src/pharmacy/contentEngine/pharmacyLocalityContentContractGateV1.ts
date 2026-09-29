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

export function extractVisibleLocalPatientSections(html: string): string {
  const hero = sectionHtml(html, /<section\b[^>]*data-template-block=["']hero["'][^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  const relevance = sectionHtml(html, /<section\b[^>]*data-template-block=["']local-relevance["'][^>]*>([\s\S]*?)<\/section>/i);
  const access = sectionHtml(html, /<p class=["']local-intro-lead["']>([\s\S]*?)<\/p>/i);
  const nextStep = sectionHtml(html, /<p\b[^>]*data-locality-cta[^>]*>([\s\S]*?)<\/p>/i);
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
  if (!/\bnot at\b/i.test(input.copy.serviceContext) && !/\bnot at\b/i.test(input.copy.healthcareCommunityContext)) {
    failures.push("missing-service-locality-synthesis");
  }
  if (!new RegExp(escapeRe(input.serviceName), "i").test(`${input.copy.serviceContext} ${input.copy.whyUseful}`)) {
    failures.push("missing-service-context");
  }
  if (/\bhow many people\b/i.test(input.copy.whyUseful) === false) {
    failures.push("missing-no-demand-limit");
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
  const intro = visiblePatientFacingText(
    sectionHtml(input.html, /<section\b[^>]*data-template-block=["']hero["'][^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i),
  );
  const introRemainder = normaliseLocalityTokenText(intro, [input.areaName, input.pharmacyName, input.serviceName], input.entityNames || []);
  if (introRemainder.split(/\s+/).filter(Boolean).length < 8) failures.push("introduction-is-name-substitution");
  if (!/\bnot at\b/i.test(local)) failures.push("missing-service-locality-synthesis");
  if (!/\bcontact\b/i.test(local)) failures.push("missing-local-next-step");
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
