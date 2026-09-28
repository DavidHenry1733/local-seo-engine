/**
 * Classification: D SUPERSEDED / DEAD PRODUCTION
 * Checkpoint: 2026-09-28 Commercial Intelligence presentation truthfulness.
 *
 * Removed from the Commercial Intelligence dashboard and renderer.
 * Not imported, routed, bundled, or callable.
 *
 * The live dashboard used imported-website crawl completeness as
 * "online completeness is around N%".
 * It copied visibility-bridge actions such as
 * "Submit Blood Pressure Checks page for indexing"
 * even when canonical coverage said the dedicated page was not found.
 * Traffic lines printed "Pharmacy Visibility Bridge · {serviceId} · {ISO timestamp}".
 * An unregistered indexing file was rendered as "0 pages indexed".
 * "Strongest competitor" named a business without the metric.
 * "No local areas are selected" hid the primary market.
 */
export const REMOVED_PRESENTATION = [
  "online completeness is around",
  "Pharmacy Visibility Bridge",
  "Submit page for indexing from visibility.recommendedActions",
  "0 pages indexed so far",
  "Strongest competitor without a named metric",
] as const;
