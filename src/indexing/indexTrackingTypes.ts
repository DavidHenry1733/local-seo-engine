/**
 * Index Tracking Engine — type definitions
 *
 * Checks whether each generated page is indexed in Google by performing
 * a `site:URL` search and parsing the result. This is a passive check —
 * it does NOT use the Google Indexing API (which is reserved for
 * JobPosting / BroadcastEvent pages only).
 */

// ─── Core status ──────────────────────────────────────────────────────────────

export type IndexStatus = "indexed" | "not_indexed" | "unknown" | "property_not_found";

// ─── Per-page record ──────────────────────────────────────────────────────────

export interface PageIndexRecord {
  url:                    string;
  status:                 IndexStatus;
  lastCheckedAt:          string | null;
  firstDetectedIndexedAt: string | null;
}

// ─── Run-level report (written to disk) ───────────────────────────────────────

export interface IndexTrackingReport {
  projectSlug:    string;
  runAt:          string;
  totalChecked:   number;
  indexedCount:   number;
  notIndexedCount: number;
  unknownCount:   number;
  records:        PageIndexRecord[];
}

// ─── Engine options ───────────────────────────────────────────────────────────

export interface IndexTrackingOptions {
  /** Maximum pages to check in a single run (default: 10) */
  limit?:       number;
  /** Milliseconds to pause between batches (default: 500) */
  delayMs?:     number;
  /** Number of URLs to check in parallel per batch (default: 5) */
  concurrency?: number;
}
