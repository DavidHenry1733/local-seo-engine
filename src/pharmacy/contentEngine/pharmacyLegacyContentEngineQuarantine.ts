/**
 * CPR-PLATFORM-RECOVERY-02 — quarantine guard for legacy content engines.
 * Legacy modules may remain in the repository but must not execute in production generation.
 * Opt-in for offline scripts only: ALLOW_LEGACY_CONTENT_ENGINE=1
 */

export const LEGACY_CONTENT_ENGINE_QUARANTINE_CODE = "LEGACY_CONTENT_ENGINE_QUARANTINED" as const;

export function isLegacyContentEngineAllowed(): boolean {
  return process.env.ALLOW_LEGACY_CONTENT_ENGINE === "1";
}

export function assertLegacyContentEngineAllowed(moduleName: string, entryPoint: string): void {
  if (isLegacyContentEngineAllowed()) return;
  const error = new Error(
    `${LEGACY_CONTENT_ENGINE_QUARANTINE_CODE}: ${moduleName}.${entryPoint} is quarantined. ` +
      `Production generation must use Content Engine V1 only. ` +
      `Set ALLOW_LEGACY_CONTENT_ENGINE=1 only for offline legacy scripts.`,
  );
  (error as Error & { code?: string }).code = LEGACY_CONTENT_ENGINE_QUARANTINE_CODE;
  throw error;
}
