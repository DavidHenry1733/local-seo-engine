/**
 * Unified token replacement for all content generators.
 */
import { injectOwnerVariables, type MasterOwnerVariables } from "../pharmacyMasterLibraryParser.ts";
import type { ContentGenerationContext } from "./contentGenerationContextTypes.ts";

const UNRESOLVED_TOKEN = /\{\{[a-z0-9_]+\}\}/gi;

export function ownerVariablesForArea(ctx: ContentGenerationContext, areaName?: string): MasterOwnerVariables {
  return {
    ...ctx.masterLibrary.ownerVariables,
    town: areaName || ctx.localArea,
  };
}

export function applyContextTokens(text: string, ctx: ContentGenerationContext): string {
  if (!text) return text;
  let out = injectOwnerVariables(text, ctx.masterLibrary.ownerVariables as MasterOwnerVariables);
  for (const [key, value] of Object.entries(ctx.tokens)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "gi"), value);
    out = out.replace(new RegExp(`\\{${key}\\}`, "gi"), value);
  }
  out = out.replace(/\bBrook Pharmacy\b/gi, ctx.profile.pharmacyName);
  out = out.replace(/\bPharmaconnect Pharmacy\b/gi, ctx.profile.pharmacyName);
  return out;
}

export function findUnresolvedTokens(text: string): string[] {
  const matches = text.match(UNRESOLVED_TOKEN) || [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

export function tokensReplacedReport(before: string, after: string): { replaced: string[]; unresolved: string[] } {
  const beforeTokens = findUnresolvedTokens(before);
  const afterTokens = findUnresolvedTokens(after);
  return {
    replaced: beforeTokens.filter((t) => !afterTokens.includes(t)),
    unresolved: afterTokens,
  };
}
