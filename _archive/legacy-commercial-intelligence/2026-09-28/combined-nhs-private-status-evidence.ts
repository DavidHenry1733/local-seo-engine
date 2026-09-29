/**
 * Classification: D SUPERSEDED / DEAD PRODUCTION
 * Checkpoint: 2026-09-29 Evidence Review hotfix.
 *
 * Removed from active Evidence Review, approval requirements,
 * and the service-page generation evidence contract.
 * Not imported, routed, bundled, or callable.
 *
 * The live field id was nhsPrivateStatus, labelled "NHS/private status".
 * When the profile schema defaulted privateServicesAvailable to false
 * and nhsServicesAvailable to true, it rendered
 * "NHS services available; private services not offered".
 * That sentence is not a Product Owner Yes/No decision.
 * NHS availability is not an Evidence Review question.
 * Pharmacy-level private-services evidence is now privateServicesOffered.
 */
export const REMOVED_EVIDENCE_FIELD = {
  id: "nhsPrivateStatus",
  label: "NHS/private status",
  combinedSentence: "NHS services available; private services not offered",
} as const;
