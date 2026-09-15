#!/usr/bin/env npx tsx
/**
 * Seed library image assignments for visual benchmark pages (16 slots).
 */
import {
  auditVisualPageImageSlots,
  seedVisualPageImageAssignments,
} from "../src/pharmacy/pharmacyImageOperatingSystem.ts";

const slug = process.argv[2] || "pharmaconnect";
const force = process.argv.includes("--force");

console.log(`\nVisual page image assignment seed — ${slug}\n`);
console.log("Before:");
for (const row of auditVisualPageImageSlots(slug)) {
  console.log(
    `  ${row.serviceId}/${row.slot}: ${row.source} | ${row.assetExists ? "OK" : "MISSING"} | ${row.assetPath || row.libraryRef}`,
  );
}

const seeded = seedVisualPageImageAssignments(slug, force);
console.log(`\nSeeded ${seeded} assignment(s)${force ? " (force)" : ""}.\n`);
console.log("After:");
for (const row of auditVisualPageImageSlots(slug)) {
  console.log(
    `  ${row.serviceId}/${row.slot}: ${row.source} | ${row.assetExists ? "OK" : "MISSING"} | ${row.assetPath}`,
  );
}

const missing = auditVisualPageImageSlots(slug).filter((r) => !r.assetExists);
if (missing.length) {
  console.error(`\n❌ ${missing.length} slot(s) still missing assets\n`);
  process.exit(1);
}
console.log("\n✅ All 16 visual page slots resolved\n");
