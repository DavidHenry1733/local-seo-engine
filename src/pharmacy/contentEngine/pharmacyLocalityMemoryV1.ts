/**
 * Page-level locality memory for the commercial narrative planner.
 * Each named locality entity should appear once across a page unless explicitly re-claimed.
 */

export type LocalityEntityKind =
  | "road"
  | "landmark"
  | "park"
  | "shopping"
  | "school"
  | "neighbour"
  | "gp"
  | "transport";

function normalizeEntity(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export class LocalityMemoryV1 {
  private readonly used = new Set<string>();

  has(value: string): boolean {
    const key = normalizeEntity(value);
    return Boolean(key) && this.used.has(key);
  }

  /** Claim unused entities in order; marks them used. */
  claim(values: Array<string | undefined | null>, limit = values.length): string[] {
    const out: string[] = [];
    for (const raw of values) {
      if (out.length >= limit) break;
      const value = String(raw || "").trim();
      const key = normalizeEntity(value);
      if (!key || this.used.has(key)) continue;
      this.used.add(key);
      out.push(value);
    }
    return out;
  }

  claimOne(values: Array<string | undefined | null>): string {
    return this.claim(values, 1)[0] || "";
  }

  /** Strip previously claimed entity names from prose. */
  scrubUsedEntities(text: string): string {
    let out = String(text || "");
    const keys = [...this.used].sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (key.length < 4) continue;
      const pattern = key
        .split(" ")
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("\\s+");
      out = out.replace(new RegExp(`\\b${pattern}\\b`, "gi"), "");
    }
    return out
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.])/g, "$1")
      .replace(/(?:,\s*){2,}/g, ", ")
      .replace(/\s+and\s+and\s+/gi, " and ")
      .trim();
  }
}
