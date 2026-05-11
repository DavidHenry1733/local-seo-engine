/**
 * Keyword Tracking Engine — type definitions
 *
 * Tracks Google ranking positions for target keywords mapped to generated pages.
 * Position is detected by scraping Google search results — no API key required.
 *
 * NOTE: Google Indexing API must NOT be used for standard service/location pages.
 */

// ─── Per-keyword input ────────────────────────────────────────────────────────

export interface KeywordTarget {
  keyword:   string;
  targetUrl: string;
}

// ─── Per-keyword result record ────────────────────────────────────────────────

export interface KeywordRecord {
  keyword:          string;
  targetUrl:        string;
  position:         number | null;   // 1–100, or null if not ranked
  previousPosition: number | null;
  /** Positive = improved (moved up), negative = dropped, 0 = unchanged, null = first check */
  change:           number | null;
  lastCheckedAt:    string;
  firstRankedAt:    string | null;   // ISO — set the first time position becomes non-null
}

// ─── Run-level report ─────────────────────────────────────────────────────────

export interface KeywordTrackingReport {
  projectSlug:  string;
  runAt:        string;
  totalKeywords: number;
  ranked:       number;       // position !== null
  improved:     number;       // change > 0
  dropped:      number;       // change < 0
  newRankings:  number;       // previousPosition === null && position !== null
  records:      KeywordRecord[];
}

// ─── Engine options ───────────────────────────────────────────────────────────

export interface KeywordTrackingOptions {
  /** Maximum keywords to check per run (default: 20) */
  limit?:     number;
  /** Milliseconds to pause between requests (default: 2 500) */
  delayMs?:   number;
  /** Absolute path to the output base dir (default: "output") */
  outputDir?: string;
  /** Called after each keyword is checked (done, total, current keyword) */
  onProgress?: (done: number, total: number, current: string) => void;
}
