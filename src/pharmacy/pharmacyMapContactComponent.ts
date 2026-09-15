/**
 * Map/contact section utilities — single canonical component, no duplicates.
 */
export const PHARMACY_MAP_CONTACT_SECTION_ID = "pharmacy-map-contact";

const MAP_SECTION_PATTERN =
  /<section[^>]*(?:id="(?:local-access|local-access-map|pharmacy-map-contact)"|data-component="pharmacy-map-contact")[\s\S]*?<\/section>/gi;

/** Remove all local-access and map/contact sections before idempotent re-insert. */
export function stripMapAndLocalAccessSections(mainHtml: string): string {
  return mainHtml.replace(MAP_SECTION_PATTERN, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Ensure at most one pharmacy-map-contact section remains. */
export function dedupeMapContactSections(mainHtml: string): string {
  let seen = false;
  return mainHtml.replace(MAP_SECTION_PATTERN, (match) => {
    if (/id="pharmacy-map-contact"/i.test(match) || /data-component="pharmacy-map-contact"/i.test(match)) {
      if (seen) return "";
      seen = true;
      return match;
    }
    return "";
  });
}

export function countMapContactSections(mainHtml: string): number {
  const matches = mainHtml.match(/id="pharmacy-map-contact"|data-component="pharmacy-map-contact"/gi);
  return matches?.length || 0;
}
