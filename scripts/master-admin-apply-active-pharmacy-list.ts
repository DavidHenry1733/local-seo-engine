/**
 * One-shot registry alignment: keep only named pharmacies active; archive the rest (no data deletion).
 */
import { archivePharmacyClient, readMasterAdminRegistry, restoreArchivedPharmacyClient } from "../src/pharmacy/pharmacyMasterAdminService.ts";

const KEEP_ACTIVE = new Set([
  "welfare-pharmacy",
  "reliable-direct-pharmacy",
  "banner-cross-pharmacy",
  "broom-lane-pharmacy",
]);

function main(): void {
  const registry = readMasterAdminRegistry();
  let archived = 0;
  let restored = 0;
  for (const client of registry.clients) {
    const slug = client.slug;
    const shouldBeActive = KEEP_ACTIVE.has(slug);
    try {
      if (shouldBeActive && client.archived) {
        restoreArchivedPharmacyClient(slug);
        restored++;
      } else if (!shouldBeActive && !client.archived) {
        archivePharmacyClient(slug);
        archived++;
      }
    } catch (err) {
      console.error("Failed for", slug, err instanceof Error ? err.message : err);
    }
  }
  const after = readMasterAdminRegistry();
  const active = after.clients.filter((c) => !c.archived).map((c) => c.slug);
  console.log(JSON.stringify({ archived, restored, activeCount: active.length, active }, null, 2));
}

main();
