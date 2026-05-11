/**
 * patchOutputIds.ts — One-time script to back-patch existing rendered HTML
 * output files with section IDs, so the QA validator can run against pages
 * generated before IDs were added to the templates.
 *
 * Future deployments will have IDs baked in via the updated templates;
 * this script is only needed for pre-existing output files.
 *
 * Run once with: pnpm exec tsx src/validate/patchOutputIds.ts
 */

import { load }  from "cheerio";
import fs        from "node:fs";
import path      from "node:path";

// IDs to assign to generic section.section-band elements in document order.
// "__skip__" means the element at that position has no QA section ID.

const CLUSTER_BAND_IDS = [
  "split-section-one",
  "split-section-two",
  "about-section",
  "resources-section",
  "faq-section",
];

const HUB_BAND_IDS = [
  "split-section-one",
  "split-section-two",
  "about-section",
  "definition-section",
  "process-section",
  "__skip__",                  // Image 3 split — no QA section ID
  "local-relevance-section",
  "internal-links-section",
  "faq-section",
];

function patchFile(htmlPath: string, bandIds: string[]): void {
  if (!fs.existsSync(htmlPath)) {
    console.warn(`  SKIP (not found): ${htmlPath}`);
    return;
  }

  const html = fs.readFileSync(htmlPath, "utf8");
  const $    = load(html);

  let idIdx = 0;
  $("section.section-band").each((_i, el) => {
    const $el = $(el);
    if ($el.attr("id")) return;             // already has an id — skip
    if (idIdx >= bandIds.length) return;
    const nextId = bandIds[idIdx++];
    if (nextId !== "__skip__") {
      $el.attr("id", nextId);
    } else {
      idIdx;                                // consumed the slot, no id set
    }
  });

  fs.writeFileSync(htmlPath, $.html());
  console.log(`  Patched: ${htmlPath}`);
}

console.log("Patching output HTML files with section IDs…");

patchFile(
  path.resolve("output/inboxingproweb-local/ecclesall/index.html"),
  CLUSTER_BAND_IDS
);

patchFile(
  path.resolve("output/inboxingproweb-local/index.html"),
  HUB_BAND_IDS
);

console.log("Done.");
