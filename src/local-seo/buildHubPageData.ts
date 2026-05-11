import fs from "fs";
import path from "path";

type HubJobInput = {
  brand: string;
  service: string;
  city: string;
  areas: string[];
};

function slugify(value: string): string {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function buildHubPageData(projectRoot: string, jobFilePath = "input/job.batch.json") {
  const fullJobPath = path.join(projectRoot, jobFilePath);
  const inputDir = path.join(projectRoot, "input");

  const job = readJsonFile<HubJobInput>(fullJobPath);

  const brandPath = path.join(inputDir, `brand.${slugify(job.brand)}.json`);
  const servicePath = path.join(inputDir, `service.${slugify(job.service)}.json`);

  const brand = readJsonFile<Record<string, unknown>>(brandPath);
  const service = readJsonFile<Record<string, unknown>>(servicePath);

  const serviceName = String(service.service_name || job.service);
  const cityName = String(job.city);

  const primaryKeyword = `${serviceName} ${cityName}`;
  const slug = `${slugify(serviceName)}-${slugify(cityName)}`;

  const pageData = {
    job,
    brand,
    service,
    location: {
      city: cityName,
      child_areas: job.areas || []
    },
    page: {
      primary_keyword: primaryKeyword,
      slug,
      title_seed: `${primaryKeyword} – Professional Services in ${cityName}`
    }
  };

  const outputDir = path.join(projectRoot, "output", slug);
  ensureDir(outputDir);

  fs.writeFileSync(
    path.join(outputDir, "page-data.json"),
    JSON.stringify(pageData, null, 2),
    "utf-8"
  );

  return { pageData, outputDir };
}
