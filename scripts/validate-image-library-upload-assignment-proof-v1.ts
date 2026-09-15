#!/usr/bin/env npx tsx
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

type Check = { id: string; pass: boolean; detail: string };
type AssignmentDoc = {
  slug: string;
  assignments?: Record<string, { slot?: string; source?: string; sourceType?: string; uploadId?: string; filePath?: string }>;
  uploads?: Array<{ id: string; filename: string; path: string; mimeType: string; category: string }>;
};

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const slug = "pharmacy-delivered-4u-test";
const serviceId = "pharmacy-first";
const campaignId = "pharmacy-first";
const baseUrl = process.env.IMAGE_PROOF_BASE_URL || "https://app.pharmaconnect.uk";
const localBaseUrl = process.env.IMAGE_PROOF_LOCAL_BASE_URL || "http://127.0.0.1:3001";
const slots = ["hero", "support", "trust", "conversion"];
const checks: Check[] = [];

function ecosystemToken(): string {
  const config = require(path.join(ROOT, "ecosystem.config.cjs"));
  return process.env.SESSION_SECRET || config?.apps?.[0]?.env?.SESSION_SECRET || "";
}

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} - ${detail}`);
}

async function fetchStatus(url: string, init?: RequestInit): Promise<{ status: number; contentType: string; text: string }> {
  const response = await fetch(url, { redirect: "manual", ...init });
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    text: await response.text(),
  };
}

function readAssignments(): AssignmentDoc | null {
  const file = path.join(ROOT, "data/pharmacy-image-assignments", `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as AssignmentDoc;
}

function assignmentForSlot(doc: AssignmentDoc, slot: string) {
  const key = `${campaignId}:${serviceId}:${slot}`;
  return doc.assignments?.[key] || Object.values(doc.assignments || {}).find((item) => item.slot === slot);
}

function uploadForAssignment(doc: AssignmentDoc, uploadId?: string) {
  return doc.uploads?.find((upload) => upload.id === uploadId);
}

function isRealTenantImagePath(imagePath: string): boolean {
  const filename = path.basename(imagePath);
  return imagePath.startsWith(`assets/pharmacy-uploads/${slug}/`) &&
    /\.(png|jpe?g|webp)$/i.test(imagePath) &&
    !/(validate|test|placeholder|mock|seo|trade|brook|dhm)/i.test(filename);
}

function hasNoSourceTenantLeakage(url: string): boolean {
  const pathname = new URL(url).pathname.replace(/^\/+/, "");
  const filename = path.basename(pathname);
  return pathname.startsWith(`assets/pharmacy-uploads/${slug}/`) &&
    !pathname.startsWith("assets/pharmacy-uploads/pharmaconnect/") &&
    !pathname.startsWith("assets/pharmacy-uploads/dhmdigital/") &&
    !/(validate|test|placeholder|mock|seo|trade|brook|dhm)/i.test(filename);
}

async function main(): Promise<void> {
  const token = ecosystemToken();
  const dashboardUrl = `${localBaseUrl}/api/pharmacy-image-library?slug=${slug}&service=${serviceId}&campaignId=${campaignId}&_t=${encodeURIComponent(token)}`;
  const uploadUrl = `${localBaseUrl}/api/pharmacy/image-library/${slug}/upload?_t=${encodeURIComponent(token)}`;
  const storageDir = path.join(ROOT, "assets/pharmacy-uploads", slug);
  const assignmentPath = path.join(ROOT, "data/pharmacy-image-assignments", `${slug}.json`);

  const dashboard = await fetchStatus(dashboardUrl);
  record("image dashboard route exists", dashboard.status === 200 && /Pharmacy Image Library/i.test(dashboard.text), `/api/pharmacy-image-library => ${dashboard.status}`);
  record("dashboard confirms target tenant", dashboard.text.includes(slug), slug);

  const uploadProbe = await fetchStatus(uploadUrl, { method: "POST" });
  record("upload endpoint exists", uploadProbe.status === 400 && /No file uploaded|Multipart|boundary|file/i.test(uploadProbe.text), `/api/pharmacy/image-library/${slug}/upload => ${uploadProbe.status}`);

  record("tenant storage directory is correct", fs.existsSync(storageDir), path.relative(ROOT, storageDir));

  const doc = readAssignments();
  record("tenant assignment record is written", Boolean(doc?.slug === slug), path.relative(ROOT, assignmentPath));

  const urls: string[] = [];
  const uploadMimes: string[] = [];
  if (doc) {
    for (const slot of slots) {
      const assignment = assignmentForSlot(doc, slot);
      const upload = uploadForAssignment(doc, assignment?.uploadId);
      const imagePath = upload?.path || assignment?.filePath || "";
      const ok = Boolean(assignment && upload && (assignment.sourceType || assignment.source) === "upload" && isRealTenantImagePath(imagePath));
      record(`${slot} can be assigned`, ok, imagePath || "missing");
      if (upload?.mimeType) uploadMimes.push(upload.mimeType);
      if (imagePath) urls.push(`${baseUrl.replace(/\/+$/, "")}/${imagePath}`);
    }
  }

  record(
    "upload accepts PNG/JPG/WEBP",
    uploadMimes.length === slots.length && uploadMimes.every((mime) => /^image\/(png|jpe?g|webp)$/i.test(mime)),
    uploadMimes.join(", ") || "no upload MIME records",
  );
  record(
    "dashboard displays uploaded tenant thumbnails",
    urls.every((url) => dashboard.text.includes(new URL(url).pathname)),
    urls.map((url) => new URL(url).pathname).join(", ") || "no image URLs",
  );

  for (const url of urls) {
    const image = await fetchStatus(url);
    record(`direct image URL returns 200 image content-type`, image.status === 200 && /^image\//i.test(image.contentType), `${url} => ${image.status} ${image.contentType}`);
    record(`no SEO/trade/validation/Brook/DHM/pharmaconnect tenant leakage`, hasNoSourceTenantLeakage(url), url);
  }

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
