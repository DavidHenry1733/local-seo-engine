/**
 * Area-scoped ContentGenerationContext for local cluster pages.
 */
import type { ContentGenerationContext } from "./contentGenerationContextTypes.ts";
import { ownerVariablesForArea } from "./contentEngineTokens.ts";

export function scopeContentGenerationContextForArea(
  ctx: ContentGenerationContext,
  areaName: string,
): ContentGenerationContext {
  const ownerVariables = ownerVariablesForArea(ctx, areaName);
  return {
    ...ctx,
    localArea: areaName,
    tokens: {
      ...ctx.tokens,
      town: areaName,
      area: areaName,
      phone: ctx.profile.displayPhone || ctx.profile.phone,
    },
    masterLibrary: {
      ...ctx.masterLibrary,
      ownerVariables,
    },
  };
}
