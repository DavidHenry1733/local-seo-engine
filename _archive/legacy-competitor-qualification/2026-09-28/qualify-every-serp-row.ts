/**
 * SUPERSEDED / DEAD PRODUCTION — 2026-09-28
 *
 * persistOrganicRun previously copied every DataForSEO row into
 * qualifiedCompetitors with qualification "qualified", including rows
 * whose own evidence said they were not a nearby physical pharmacy.
 * That is no longer called. Raw organic rows stay on organicSearch.
 * Only ORGANIC_COMMERCIAL_COMPETITOR rows are qualified competitors.
 */
export const REMOVED_QUALIFICATION = "qualified" as const;
