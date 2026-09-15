/**
 * Area Content Diversity — measures uniqueness across service-area pages for the same service.
 */

export interface DiversityInputPage {
  area: string;
  intro?: string;
  sections?: Array<{ type?: string; heading?: string; body?: string }>;
  faqs?: Array<{ question?: string; answer?: string }>;
}

export interface DiversityReport {
  diversityScore: number;
  repeatedSentences: string[];
  repeatedOpenings: string[];
  repeatedFaqAnswers: string[];
  repeatedLocalSections: string[];
  pageCount: number;
  meetsTarget: boolean;
}

const LOCAL_SECTION_TYPES = new Set(["localServiceIntro", "whyThisArea", "localRelevance"]);

function normalizeSentence(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s'-]/g, "")
    .trim();
}

function splitSentences(text: string): string[] {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map(normalizeSentence)
    .filter((s) => s.length > 40);
}

function openingPhrase(text: string, wordCount = 12): string {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .slice(0, wordCount);
  return normalizeSentence(words.join(" "));
}

function findRepeated(values: string[], minLength = 30): string[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (v.length < minLength) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => s);
}

export function scoreAreaContentDiversity(pages: DiversityInputPage[]): DiversityReport {
  if (pages.length < 2) {
    return {
      diversityScore: 100,
      repeatedSentences: [],
      repeatedOpenings: [],
      repeatedFaqAnswers: [],
      repeatedLocalSections: [],
      pageCount: pages.length,
      meetsTarget: true,
    };
  }

  const allSentences: string[] = [];
  const allOpenings: string[] = [];
  const faqAnswers: string[] = [];
  const localBodies: string[] = [];

  for (const page of pages) {
    allSentences.push(...splitSentences(page.intro || ""));
    for (const s of page.sections || []) {
      allSentences.push(...splitSentences(s.body || ""));
      allOpenings.push(openingPhrase(s.body || ""));
      if (s.type && LOCAL_SECTION_TYPES.has(s.type)) {
        localBodies.push(normalizeSentence(s.body || ""));
      }
    }
    for (const f of page.faqs || []) {
      allSentences.push(...splitSentences(f.answer || ""));
      faqAnswers.push(normalizeSentence(f.answer || ""));
    }
    allOpenings.push(openingPhrase(page.intro || ""));
  }

  const repeatedSentences = findRepeated(allSentences, 35);
  const repeatedOpenings = findRepeated(allOpenings, 25);
  const repeatedFaqAnswers = findRepeated(faqAnswers, 40);
  const repeatedLocalSections = findRepeated(localBodies, 50);

  let score = 100;
  score -= repeatedSentences.length * 8;
  score -= repeatedOpenings.length * 10;
  score -= repeatedFaqAnswers.length * 12;
  score -= repeatedLocalSections.length * 15;
  score = Math.max(0, Math.min(100, score));

  return {
    diversityScore: score,
    repeatedSentences: repeatedSentences.slice(0, 8),
    repeatedOpenings: repeatedOpenings.slice(0, 8),
    repeatedFaqAnswers: repeatedFaqAnswers.slice(0, 8),
    repeatedLocalSections: repeatedLocalSections.slice(0, 8),
    pageCount: pages.length,
    meetsTarget: score >= 85,
  };
}

export function groupPagesByService(
  pages: Array<DiversityInputPage & { serviceId?: string }>,
): Map<string, DiversityInputPage[]> {
  const map = new Map<string, DiversityInputPage[]>();
  for (const p of pages) {
    const key = p.serviceId || "unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}
