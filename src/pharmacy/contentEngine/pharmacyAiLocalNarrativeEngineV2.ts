/**
 * ARCHIVED local-copy writer — not active in production.
 * Original implementation: ./_archive-legacy-local-writers/pharmacyAiLocalNarrativeEngineV2.ts
 * Campaign Builder must not import this module.
 */
export const AI_LOCAL_NARRATIVE_ENGINE_ID_V2 = "pharmacy-ai-local-narrative-engine-v2-archived";
export const AI_LOCAL_NARRATIVE_PROVIDER_V2 = "archived-openai";

export async function generateAiLocalCopyPilotV2(): Promise<never> {
  throw new Error("The OpenAI local-copy writer is archived. Gemini is the only active local-copy writer.");
}
