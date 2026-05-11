import { exportToWordPress } from "./exportToWordPress";
import type { ExportOptions } from "./exportToWordPress";

const slug = process.argv[2];

if (!slug) {
  console.error("Usage: pnpm exec tsx src/local-seo/testExportToWordPress.ts <slug> [status] [mode]");
  console.error("Example: pnpm exec tsx src/local-seo/testExportToWordPress.ts web-design-ecclesall draft update-existing");
  process.exit(1);
}

const options: ExportOptions = {
  wordpressStatus: (process.argv[3] as ExportOptions["wordpressStatus"]) || "draft",
  wordpressMode: (process.argv[4] as ExportOptions["wordpressMode"]) || "update-existing",
};

console.log(`Slug:   ${slug}`);
console.log(`Mode:   ${options.wordpressMode}`);
console.log(`Status: ${options.wordpressStatus}`);
console.log("─".repeat(50));

exportToWordPress(process.cwd(), slug, options)
  .then((result) => {
    if (result.action === "skipped") {
      console.log(`Result: SKIPPED`);
      console.log(`Reason: ${result.reason}`);
    } else {
      console.log(`Result: ${result.action.toUpperCase()}`);
      console.log(`Page ID: ${result.pageId}`);
      console.log(`Status:  ${result.status}`);
      console.log(`Link:    ${result.link}`);
    }
  })
  .catch((err) => {
    console.error("Export failed:", err.message);
    process.exit(1);
  });
