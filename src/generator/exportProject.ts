import fs from "node:fs";
import path from "node:path";

export function exportPage(outputDir: string, slug: string, html: string, payload: unknown): void {
  const pageDir = path.join(outputDir, slug);
  fs.mkdirSync(pageDir, { recursive: true });
  fs.writeFileSync(path.join(pageDir, "index.html"), html, "utf8");
  fs.writeFileSync(path.join(pageDir, "page.json"), JSON.stringify(payload, null, 2), "utf8");
}
