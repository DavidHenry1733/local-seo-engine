import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

interface Business {
  name: string;
  phone: string;
  email: string;
  website: string;
  services: string[];
  description: string;
}

interface Location {
  slug: string;
  city: string;
  state: string;
  stateAbbr: string;
  zip: string;
  county: string;
  headline: string;
  intro: string;
  neighborhoods: string[];
}

interface GeneratedPage {
  slug: string;
  title: string;
  metaDescription: string;
  city: string;
  state: string;
  generatedAt: string;
  outputHtml: string;
  outputJson: string;
}

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function buildHtml(business: Business, location: Location): string {
  const title = `${business.name} — ${location.city}, ${location.stateAbbr}`;
  const metaDescription = `${business.name} offers professional ${business.services.slice(0, 2).join(" and ")} in ${location.city}, ${location.stateAbbr}. Call us at ${business.phone}.`;

  const serviceListItems = business.services
    .map((s) => `      <li>${s}</li>`)
    .join("\n");

  const neighborhoodItems = location.neighborhoods
    .map((n) => `      <li>${n}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${metaDescription}" />
</head>
<body>
  <header>
    <h1>${location.headline}</h1>
    <p><strong>${business.name}</strong> | <a href="tel:${business.phone}">${business.phone}</a> | <a href="${business.website}">${business.website}</a></p>
  </header>

  <main>
    <section>
      <p>${location.intro}</p>
    </section>

    <section>
      <h2>About ${business.name}</h2>
      <p>${business.description}</p>
    </section>

    <section>
      <h2>Our Services in ${location.city}, ${location.stateAbbr}</h2>
      <ul>
${serviceListItems}
      </ul>
    </section>

    <section>
      <h2>Areas We Serve in ${location.county}</h2>
      <p>We proudly serve the following neighborhoods in and around ${location.city}:</p>
      <ul>
${neighborhoodItems}
      </ul>
    </section>

    <section>
      <h2>Contact Us</h2>
      <p>Ready to schedule service? Reach us at <a href="tel:${business.phone}">${business.phone}</a> or email <a href="mailto:${business.email}">${business.email}</a>.</p>
    </section>
  </main>

  <footer>
    <p>&copy; ${new Date().getFullYear()} ${business.name}. Serving ${location.city}, ${location.stateAbbr} ${location.zip}.</p>
  </footer>
</body>
</html>`;
}

function generate(locationFile: string): GeneratedPage {
  const business = readJson<Business>(path.join(ROOT, "input", "business.json"));
  const location = readJson<Location>(locationFile);

  const html = buildHtml(business, location);

  const title = `${business.name} — ${location.city}, ${location.stateAbbr}`;
  const metaDescription = `${business.name} offers professional ${business.services.slice(0, 2).join(" and ")} in ${location.city}, ${location.stateAbbr}. Call us at ${business.phone}.`;

  const outputDir = path.join(ROOT, "output", location.slug);
  fs.mkdirSync(outputDir, { recursive: true });

  const htmlPath = path.join(outputDir, "index.html");
  const jsonPath = path.join(outputDir, "page.json");

  const pageData: GeneratedPage = {
    slug: location.slug,
    title,
    metaDescription,
    city: location.city,
    state: location.state,
    generatedAt: new Date().toISOString(),
    outputHtml: htmlPath,
    outputJson: jsonPath,
  };

  fs.writeFileSync(htmlPath, html, "utf-8");
  fs.writeFileSync(jsonPath, JSON.stringify(pageData, null, 2), "utf-8");

  return pageData;
}

function main(): void {
  const locationsDir = path.join(ROOT, "input", "locations");
  const locationFiles = fs
    .readdirSync(locationsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(locationsDir, f));

  if (locationFiles.length === 0) {
    console.error("No location JSON files found in scripts/input/locations/");
    process.exit(1);
  }

  console.log(`Generating pages for ${locationFiles.length} location(s)...\n`);

  for (const file of locationFiles) {
    const page = generate(file);
    console.log(`✓ ${page.city}, ${page.state}`);
    console.log(`  HTML → ${page.outputHtml}`);
    console.log(`  JSON → ${page.outputJson}\n`);
  }

  console.log("Done.");
}

main();
