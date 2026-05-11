import fs from "fs";
import path from "path";

type JobInput = {
  brand: string;
  service: string;
  city: string;
  area: string;
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
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function buildPageData(projectRoot: string, jobFilePath = "input/job.json") {
  const fullJobPath = path.join(projectRoot, jobFilePath);
  const inputDir = path.join(projectRoot, "input");

  const job = readJsonFile<JobInput>(fullJobPath);

  const brandPath = path.join(inputDir, `brand.${slugify(job.brand)}.json`);
  const servicePath = path.join(inputDir, `service.${slugify(job.service)}.json`);
  const areaPath = path.join(inputDir, `area.${slugify(job.area)}.json`);

  const brand = readJsonFile<Record<string, unknown>>(brandPath);
  const service = readJsonFile<Record<string, unknown>>(servicePath);
  const location = readJsonFile<Record<string, unknown>>(areaPath);

  const serviceName = String(service.service_name || job.service);
  const areaName = String(location.area || job.area);

  const primaryKeyword = `${serviceName} ${areaName}`;
  const slug = `${slugify(serviceName)}-${slugify(areaName)}`;

  const pageData = {
    job,
    brand,
    service,
    location,
    page: {
      primary_keyword: primaryKeyword,
      slug,
      title_seed: `${primaryKeyword} – Professional Services in ${job.city}`
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
