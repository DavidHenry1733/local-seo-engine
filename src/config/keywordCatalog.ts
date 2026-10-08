/**
 * Broad high-intent keyword clusters per clinical service.
 * Variations (brands, treatments, symptoms) aggregate into one parent-service search pool.
 */
export const SERVICE_KEYWORD_CLUSTERS: Record<string, readonly string[]> = {
  "travel-vaccinations": [
    "travel clinic",
    "travel vaccines",
    "travel vaccinations near me",
    "yellow fever vaccine",
    "rabies vaccine",
    "malaria clinic",
    "travel vaccinations",
    "hepatitis a vaccine",
  ],
  "weight-loss": [
    "weight loss clinic",
    "weight loss injections",
    "mounjaro pharmacy",
    "wegovy",
    "mounjaro near me",
    "slimming clinic",
    "weight loss jab",
    "wegovy pharmacy",
    "saxenda",
  ],
  "ear-wax-removal": [
    "ear wax removal",
    "ear syringing",
    "microsuction",
    "ear cleaning",
    "blocked ear removal",
    "ear wax removal near me",
    "microsuction near me",
    "ear wax microsuction",
  ],
  "blood-testing": [
    "blood test near me",
    "private blood test",
    "phlebotomy clinic",
    "full blood count private",
    "hormone blood test",
    "blood testing near me",
    "cholesterol blood test",
    "vitamin d blood test",
  ],
  "pharmacy-first": [
    "walk in pharmacy",
    "pharmacy first",
    "pharmacy first near me",
    "sore throat pharmacy",
    "ear infection pharmacy",
    "cystitis pharmacy",
    "sinusitis pharmacy",
    "pharmacy first nhs",
  ],
  "blood-pressure-checks": [
    "blood pressure check near me",
    "blood pressure clinic",
    "nhs blood pressure check",
    "hypertension clinic",
    "24 hour blood pressure monitor",
    "abpm test",
    "blood pressure test pharmacy",
  ],
  "mens-health-ed": [
    "erectile dysfunction treatment",
    "viagra near me",
    "sildenafil private",
    "ed clinic",
    "tadalafil private",
    "cialis near me",
    "mens health clinic",
  ],
  "womens-health-hrt": [
    "hrt clinic",
    "private menopause clinic",
    "hrt consultation",
    "menopause blood test",
    "menopause clinic",
    "hrt near me",
    "hormone replacement therapy",
    "hrt patches",
  ],
  "period-delay": [
    "period delay tablets",
    "norethisterone",
    "delay period pill",
    "period delay clinic",
    "period delay tablets near me",
    "norethisterone pharmacy",
  ],
  "flu-vaccination": [
    "flu jab",
    "flu jab near me",
    "flu vaccination",
    "private flu vaccine",
    "flu jab walk in",
    "nhs flu jab",
    "flu vaccine pharmacy",
  ],
};

function cleanKeyword(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function dedupeKeywordCluster(keywords: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keywords) {
    const keyword = cleanKeyword(raw);
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) continue;
    seen.add(key);
    out.push(keyword);
  }
  return out;
}

export function expandKeywordCluster(seeds: readonly string[], locationName: string): string[] {
  const location = cleanKeyword(locationName);
  return dedupeKeywordCluster(
    seeds.map((seed) => (location ? seed.replace(/\[location\]/gi, location) : seed)),
  );
}

export function keywordClusterFor(serviceId: string): readonly string[] {
  return SERVICE_KEYWORD_CLUSTERS[String(serviceId || "").trim()] || [];
}

export function bundleCitySearchKeywords(locationName: string, serviceIds?: readonly string[]): string[] {
  const ids = serviceIds?.length ? serviceIds : Object.keys(SERVICE_KEYWORD_CLUSTERS);
  const expanded: string[] = [];
  for (const id of ids) {
    expanded.push(...expandKeywordCluster(keywordClusterFor(id), locationName));
  }
  return dedupeKeywordCluster(expanded);
}
