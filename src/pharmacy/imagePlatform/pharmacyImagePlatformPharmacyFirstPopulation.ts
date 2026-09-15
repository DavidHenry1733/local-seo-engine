/**
 * Pharmacy First production asset population (Image Platform V1.1).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
import {
  roleBucketAbs,
  rolePlatformRootAbs,
  assetMetaPathAbs,
  type ImagePlatformRole,
} from "./pharmacyImagePlatformPaths.ts";
import type { ImagePlatformPageType } from "./pharmacyImagePlatformMetadataV11.ts";
import type { ImagePlatformAssetMetadataV11 } from "./pharmacyImagePlatformMetadataV11.ts";
import {
  computePerceptualHash,
  normalizeMasterWebp,
  readImageDimensions,
  scanDuplicates,
  sha256Checksum,
  writeWebpVariants,
} from "./pharmacyImagePlatformDuplicateService.ts";

const SERVICE_ID = "pharmacy-first";
const NEGATIVE =
  "text, words, letters, watermark, logo, brand name, US pharmacy, american flag, distorted hands, extra fingers, deformed face, blur, low quality, cartoon, illustration, svg, gradient placeholder, nhs logo, prescription label readable, private patient data";

export interface PopulationAssetPlan {
  assetId: string;
  role: ImagePlatformRole;
  pageTypes: ImagePlatformPageType[];
  editorialUse?: "guide" | "blog";
  minWidth: number;
  minHeight: number;
  aspectRatio: "16x9" | "4x3" | "1x1";
  subject: string;
  prompt: string;
  defaultAltText: string;
  accessibilityDescription: string;
  sourceType: ImagePlatformAssetMetadataV11["sourceType"];
}

export const PHARMACY_FIRST_ASSET_PLANS: PopulationAssetPlan[] = [
  {
    assetId: "pf-hero-consultation-room",
    role: "hero",
    pageTypes: ["homepage", "service"],
    minWidth: 1200,
    minHeight: 675,
    aspectRatio: "16x9",
    subject: "Private consultation room",
    prompt:
      "Documentary photograph, UK community pharmacy private consultation room, pharmacist and patient seated across a small table, warm neutral lighting, clean clinical environment, modern British pharmacy interior, no visible logos, no readable text, inclusive diverse adults, professional clothing, trustworthy healthcare scene",
    defaultAltText: "Pharmacist consulting a patient in a private UK pharmacy consultation room",
    accessibilityDescription:
      "Pharmacist and patient in conversation inside a private consultation room with neutral pharmacy décor.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-hero-pharmacist-patient",
    role: "hero",
    pageTypes: ["homepage", "service"],
    minWidth: 1200,
    minHeight: 675,
    aspectRatio: "16x9",
    subject: "Pharmacist patient discussion",
    prompt:
      "Wide documentary photo, UK high street pharmacy counter area, qualified pharmacist leaning slightly forward listening to an adult patient, shelves softly blurred background, natural daylight, inclusive representation, no logos, no text, realistic UK clothing",
    defaultAltText: "Pharmacist listening to a patient at a UK community pharmacy",
    accessibilityDescription: "Pharmacist attentively listening to a patient near the pharmacy counter.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-hero-community-environment",
    role: "hero",
    pageTypes: ["homepage", "service"],
    minWidth: 1200,
    minHeight: 675,
    aspectRatio: "16x9",
    subject: "Community pharmacy environment",
    prompt:
      "Documentary wide shot, welcoming UK community pharmacy interior, open dispensary area, bright clean space, pharmacist visible helping a customer in mid-ground, friendly neighbourhood pharmacy feel, no brand logos, no readable signage text",
    defaultAltText: "Welcoming UK community pharmacy interior with staff assisting a customer",
    accessibilityDescription: "Bright pharmacy interior showing staff helping a customer in a community setting.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-hero-confidential-consultation",
    role: "hero",
    pageTypes: ["homepage", "service", "guide"],
    minWidth: 1200,
    minHeight: 675,
    aspectRatio: "16x9",
    subject: "Confidential consultation",
    prompt:
      "Documentary photograph, confidential NHS Pharmacy First style consultation in UK pharmacy side room, pharmacist explaining next steps with open body language, patient nodding, privacy screen door slightly ajar, realistic UK healthcare setting, no logos or readable documents",
    defaultAltText: "Pharmacist explaining next steps during a confidential pharmacy consultation",
    accessibilityDescription: "Side-angle view of pharmacist explaining care options to a patient in a private room.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-support-advice",
    role: "support",
    pageTypes: ["homepage", "service"],
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "4x3",
    subject: "Professional advice",
    prompt:
      "Documentary photo, UK pharmacist gesturing calmly while giving self-care advice to an adult patient, neutral pharmacy backdrop, inclusive demographics, realistic UK fashion, no text or logos",
    defaultAltText: "Pharmacist giving professional self-care advice to a patient",
    accessibilityDescription: "Pharmacist using hand gestures to explain advice while patient listens.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-support-medication-talk",
    role: "support",
    pageTypes: ["homepage", "service"],
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "4x3",
    subject: "Medication discussion",
    prompt:
      "Documentary photograph, UK pharmacy consultation, pharmacist discussing treatment options without showing readable labels, patient engaged, clean clinical tone, diverse representation, no logos",
    defaultAltText: "Pharmacist discussing treatment options with a patient",
    accessibilityDescription: "Close-medium shot of pharmacist and patient discussing medication management.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-support-patient-centred",
    role: "support",
    pageTypes: ["homepage", "service"],
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "4x3",
    subject: "Patient-centred care",
    prompt:
      "Documentary image, patient-centred care in UK community pharmacy, pharmacist at eye level with seated patient, empathetic expression, soft natural light, no readable paperwork, inclusive cast",
    defaultAltText: "Patient-centred pharmacy consultation with pharmacist at eye level with seated patient",
    accessibilityDescription: "Pharmacist seated to maintain eye contact with patient during consultation.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-support-next-steps",
    role: "support",
    pageTypes: ["homepage", "service"],
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "4x3",
    subject: "Explaining next steps",
    prompt:
      "Documentary photo, UK pharmacist explaining follow-up steps to patient near consultation desk, professional attire, calm atmosphere, no logos, no legible screens or leaflets",
    defaultAltText: "Pharmacist explaining follow-up steps to a patient",
    accessibilityDescription: "Pharmacist pointing toward a follow-up plan while patient listens attentively.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-trust-team",
    role: "trust",
    pageTypes: ["homepage", "service"],
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "4x3",
    subject: "Pharmacy team",
    prompt:
      "Documentary group photo, diverse UK pharmacy team standing together in white and navy uniforms, friendly professional smiles, neutral pharmacy interior background, no company logos, no name badges readable",
    defaultAltText: "Diverse UK pharmacy team standing together professionally",
    accessibilityDescription: "Three pharmacy team members standing side by side facing camera with welcoming expressions.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-trust-professional-care",
    role: "trust",
    pageTypes: ["homepage", "service"],
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "4x3",
    subject: "Professional care",
    prompt:
      "Documentary photograph, senior pharmacist supporting junior colleague while assisting patient in UK pharmacy, trustworthy professional atmosphere, inclusive representation, no logos",
    defaultAltText: "Pharmacists working together to support a patient",
    accessibilityDescription: "Two pharmacists collaborating while one engages with a waiting patient.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-trust-welcoming",
    role: "trust",
    pageTypes: ["homepage", "service"],
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "4x3",
    subject: "Welcoming service",
    prompt:
      "Documentary photo, welcoming UK pharmacy reception moment, staff member greeting patient at entrance area, clean modern interior, inclusive demographics, no readable signs",
    defaultAltText: "Pharmacy staff welcoming a patient to the community pharmacy",
    accessibilityDescription: "Staff member greeting patient near pharmacy entrance with open posture.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-trust-diverse-team",
    role: "trust",
    pageTypes: ["homepage", "service"],
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "4x3",
    subject: "Inclusive team",
    prompt:
      "Documentary image, inclusive UK pharmacy team portrait, mixed ages and ethnicities, arms relaxed, confident trustworthy mood, neutral branding pharmacy background, no logos",
    defaultAltText: "Inclusive pharmacy team portrait in a UK community pharmacy",
    accessibilityDescription: "Team portrait showing diverse pharmacists and staff in professional attire.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-conversion-booking",
    role: "conversion",
    pageTypes: ["homepage", "service", "guide", "blog"],
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "16x9",
    subject: "Booking interaction",
    prompt:
      "Documentary photo, patient booking a pharmacy appointment at UK pharmacy reception desk using phone calendar gesture with staff guidance, no readable screen text, friendly service interaction, no logos",
    defaultAltText: "Patient arranging a pharmacy appointment with staff assistance",
    accessibilityDescription: "Reception desk scene where staff helps patient schedule a pharmacy visit.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-conversion-reception",
    role: "conversion",
    pageTypes: ["homepage", "service"],
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "16x9",
    subject: "Reception enquiry",
    prompt:
      "Documentary photograph, service enquiry at UK pharmacy reception, patient asking about Pharmacy First, staff pointing toward consultation area, realistic UK setting, no logos or readable forms",
    defaultAltText: "Patient making a service enquiry at pharmacy reception",
    accessibilityDescription: "Patient speaking with reception staff about pharmacy services.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-conversion-follow-up",
    role: "conversion",
    pageTypes: ["homepage", "service", "blog"],
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "16x9",
    subject: "Follow-up planning",
    prompt:
      "Documentary image, pharmacist confirming follow-up plan with patient at consultation desk, professional reassuring tone, UK pharmacy interior, inclusive subjects, no readable notes",
    defaultAltText: "Pharmacist confirming a follow-up plan with a patient",
    accessibilityDescription: "Pharmacist and patient reviewing follow-up arrangements at a desk.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-conversion-service-enquiry",
    role: "conversion",
    pageTypes: ["homepage", "service"],
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "16x9",
    subject: "Service enquiry",
    prompt:
      "Documentary photo, UK community pharmacy, patient discussing Pharmacy First eligibility with pharmacist in semi-private area, approachable trustworthy scene, no logos, no text",
    defaultAltText: "Patient discussing Pharmacy First eligibility with a pharmacist",
    accessibilityDescription: "Semi-private discussion about pharmacy service eligibility.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-guide-editorial-care",
    role: "support",
    pageTypes: ["guide"],
    editorialUse: "guide",
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "4x3",
    subject: "Guide editorial care",
    prompt:
      "Editorial documentary photograph for patient guide, UK pharmacist demonstrating gentle examination discussion with patient in consultation room, educational calm mood, inclusive, no logos, no readable text",
    defaultAltText: "Pharmacist discussing care options for a patient guide article",
    accessibilityDescription: "Educational consultation scene suitable for a patient guide article.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-guide-editorial-waiting",
    role: "support",
    pageTypes: ["guide"],
    editorialUse: "guide",
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "4x3",
    subject: "Guide waiting area",
    prompt:
      "Documentary editorial image, patient waiting comfortably in UK pharmacy seating area while pharmacist prepares consultation room, calm community healthcare feel, no logos",
    defaultAltText: "Patient waiting in a pharmacy seating area before a consultation",
    accessibilityDescription: "Waiting area scene showing patient seated calmly before consultation.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-blog-editorial-advice",
    role: "support",
    pageTypes: ["blog"],
    editorialUse: "blog",
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "4x3",
    subject: "Blog editorial advice",
    prompt:
      "Editorial documentary photo for health blog, UK pharmacist providing clear advice to young adult patient, conversational posture, realistic UK pharmacy, inclusive, no logos or readable leaflets",
    defaultAltText: "Pharmacist providing clear advice for a health information article",
    accessibilityDescription: "Conversational advice scene suited to blog editorial content.",
    sourceType: "ai_generated",
  },
  {
    assetId: "pf-blog-editorial-pharmacy-first",
    role: "support",
    pageTypes: ["blog"],
    editorialUse: "blog",
    minWidth: 800,
    minHeight: 600,
    aspectRatio: "4x3",
    subject: "Blog Pharmacy First context",
    prompt:
      "Documentary editorial photograph explaining Pharmacy First style community care, pharmacist listening to patient symptoms description in private UK pharmacy booth, trustworthy clinical tone, no NHS logos, no text",
    defaultAltText: "Pharmacist listening during a Pharmacy First information consultation",
    accessibilityDescription: "Private booth consultation illustrating Pharmacy First community care.",
    sourceType: "ai_generated",
  },
];

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function orientationFrom(w: number, h: number): "landscape" | "portrait" | "square" {
  if (Math.abs(w - h) < 20) return "square";
  return w > h ? "landscape" : "portrait";
}

function aspectRatioLabel(w: number, h: number): string {
  const g = gcd(w, h);
  return `${Math.round(w / g)}:${Math.round(h / g)}`;
}

export async function generateIdeogramBuffer(
  apiKey: string,
  prompt: string,
  aspectRatio: "16x9" | "4x3" | "1x1",
): Promise<Buffer> {
  const res = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
    method: "POST",
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: NEGATIVE,
      rendering_speed: "QUALITY",
      aspect_ratio: aspectRatio,
    }),
  });
  if (!res.ok) {
    throw new Error(`Ideogram error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { data?: { url: string }[] };
  const url = data.data?.[0]?.url;
  if (!url) throw new Error("Ideogram returned no image URL");
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error("Failed to download Ideogram image");
  return Buffer.from(await imgRes.arrayBuffer());
}

export function writeMetadataV11(meta: ImagePlatformAssetMetadataV11): void {
  const p = assetMetaPathAbs(meta.serviceId, meta.role, meta.assetId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(meta, null, 2));
}

export function readMetadataV11(
  serviceId: string,
  role: ImagePlatformRole,
  assetId: string,
): ImagePlatformAssetMetadataV11 | null {
  const p = assetMetaPathAbs(serviceId, role, assetId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as ImagePlatformAssetMetadataV11;
}

export function listPharmacyFirstMetadataV11(): ImagePlatformAssetMetadataV11[] {
  const out: ImagePlatformAssetMetadataV11[] = [];
  for (const plan of PHARMACY_FIRST_ASSET_PLANS) {
    const m = readMetadataV11(SERVICE_ID, plan.role, plan.assetId);
    if (m) out.push(m);
  }
  return out;
}

function qualityGate(plan: PopulationAssetPlan, masterPath: string, dim: { width: number; height: number; fileSize: number }): string | null {
  if (dim.width < plan.minWidth || dim.height < plan.minHeight) {
    return `Resolution ${dim.width}x${dim.height} below minimum ${plan.minWidth}x${plan.minHeight}`;
  }
  if (dim.fileSize < 25_000) return "File too small / severe compression";
  if (masterPath.endsWith(".svg")) return "SVG not allowed for photographic slot";
  return null;
}

export interface PopulationRunResult {
  created: number;
  approved: number;
  pending: number;
  rejected: number;
  exactDuplicatesRejected: string[];
  nearDuplicatesRejected: string[];
  lowQualityRejected: string[];
  errors: string[];
}

export async function populatePharmacyFirstAsset(
  apiKey: string,
  plan: PopulationAssetPlan,
  operatorId: string,
): Promise<"approved" | "rejected" | "skipped"> {
  const existing = readMetadataV11(SERVICE_ID, plan.role, plan.assetId);
  if (existing?.approvalStatus === "approved") return "skipped";

  const approvedDir = roleBucketAbs(SERVICE_ID, plan.role, "approved");
  const mastersDir = path.join(rolePlatformRootAbs(SERVICE_ID, plan.role), "masters");
  const variantsDir = path.join(rolePlatformRootAbs(SERVICE_ID, plan.role), "variants");
  fs.mkdirSync(approvedDir, { recursive: true });

  const rawTmp = path.join(mastersDir, `${plan.assetId}-raw.jpg`);
  const masterRel = `assets/pharmacy-image-platform/services/${SERVICE_ID}/roles/${plan.role}/masters/${plan.assetId}-master.webp`;
  const masterAbs = path.join(PHARMACY_WORKSPACE_ROOT, masterRel);
  const deliverRel = `assets/pharmacy-image-platform/services/${SERVICE_ID}/roles/${plan.role}/approved/${plan.assetId}.webp`;
  const deliverAbs = path.join(PHARMACY_WORKSPACE_ROOT, deliverRel);

  fs.mkdirSync(mastersDir, { recursive: true });
  const buf = await generateIdeogramBuffer(apiKey, plan.prompt, plan.aspectRatio);
  fs.writeFileSync(rawTmp, buf);
  await normalizeMasterWebp(rawTmp, masterAbs, plan.minWidth, plan.minHeight);
  await normalizeMasterWebp(masterAbs, deliverAbs, plan.minWidth, plan.minHeight);

  const dim = await readImageDimensions(deliverAbs);
  const fail = qualityGate(plan, deliverAbs, dim);
  if (fail) {
    writeMetadataV11({
      schemaVersion: "1.1",
      assetId: plan.assetId,
      serviceId: SERVICE_ID,
      role: plan.role,
      pageTypes: plan.pageTypes,
      editorialUse: plan.editorialUse ?? null,
      classification: "pending_review",
      approvalStatus: "rejected",
      sourceType: plan.sourceType,
      licenceType: "pharmaconnect_owned",
      licenceReference: `PC-IMG-PF-${plan.assetId}`,
      filePath: deliverRel,
      masterPath: masterRel,
      mimeType: dim.mimeType,
      fileSize: dim.fileSize,
      checksum: sha256Checksum(deliverAbs),
      perceptualHash: await computePerceptualHash(deliverAbs),
      width: dim.width,
      height: dim.height,
      aspectRatio: aspectRatioLabel(dim.width, dim.height),
      orientation: orientationFrom(dim.width, dim.height),
      visualStyle: plan.editorialUse ? "editorial_photography" : "documentary_photography",
      subject: plan.subject,
      patientContext: "Adult patient in UK community pharmacy setting",
      pharmacyContext: "UK community pharmacy — neutral branding",
      demographicRepresentation: "Inclusive diverse UK adults",
      accessibilityDescription: plan.accessibilityDescription,
      defaultAltText: plan.defaultAltText,
      safeForCropping: plan.role === "hero",
      focalPoint: { x: 0.5, y: 0.45 },
      responsiveVariants: [],
      generatedAt: new Date().toISOString(),
      version: 1,
      revision: sha256Checksum(deliverAbs).slice(0, 16),
      licensing: {
        holder: "PharmaConnect",
        licenseType: "pharmaconnect_owned",
        rights: "Platform marketing and pharmacy service pages — UK territory",
        territory: "UK",
      },
      rejectedReason: fail,
    });
    return "rejected";
  }

  const variantWidths = plan.role === "hero" ? [640, 960, 1280] : [480, 800, 1024];
  const rawVariants = await writeWebpVariants(deliverAbs, variantsDir, plan.assetId, variantWidths);
  const responsiveVariants = rawVariants.map((v) => ({
    suffix: v.suffix,
    relativePath: path
      .relative(PHARMACY_WORKSPACE_ROOT, v.path)
      .replace(/\\/g, "/"),
    width: v.width,
    height: v.height,
    mimeType: "image/webp",
    fileSizeBytes: v.bytes,
  }));

  const checksum = sha256Checksum(deliverAbs);
  const perceptualHash = await computePerceptualHash(deliverAbs);
  const now = new Date().toISOString();

  writeMetadataV11({
    schemaVersion: "1.1",
    assetId: plan.assetId,
    serviceId: SERVICE_ID,
    role: plan.role,
    pageTypes: plan.pageTypes,
    editorialUse: plan.editorialUse ?? null,
    classification: "approved_photograph",
    approvalStatus: "approved",
    sourceType: plan.sourceType,
    licenceType: "pharmaconnect_owned",
    licenceReference: `PC-IMG-PF-${plan.assetId}`,
    filePath: deliverRel,
    masterPath: masterRel,
    mimeType: dim.mimeType,
    fileSize: dim.fileSize,
    checksum,
    perceptualHash,
    width: dim.width,
    height: dim.height,
    aspectRatio: aspectRatioLabel(dim.width, dim.height),
    orientation: orientationFrom(dim.width, dim.height),
    visualStyle: plan.editorialUse ? "editorial_photography" : "documentary_photography",
    subject: plan.subject,
    patientContext: "Adult patient in UK community pharmacy setting",
    pharmacyContext: "UK community pharmacy — neutral branding",
    demographicRepresentation: "Inclusive diverse UK adults",
    accessibilityDescription: plan.accessibilityDescription,
    defaultAltText: plan.defaultAltText,
    safeForCropping: plan.role === "hero",
    focalPoint: { x: 0.5, y: 0.45 },
    responsiveVariants,
    generatedAt: now,
    approvedAt: now,
    approvedBy: operatorId,
    version: 1,
    revision: checksum.slice(0, 16),
    licensing: {
      holder: "PharmaConnect",
      licenseType: "pharmaconnect_owned",
      rights: "Platform marketing and pharmacy service pages — UK territory",
      territory: "UK",
    },
  });

  return "approved";
}

export async function runPharmacyFirstPopulation(apiKey: string, operatorId: string): Promise<PopulationRunResult> {
  const result: PopulationRunResult = {
    created: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    exactDuplicatesRejected: [],
    nearDuplicatesRejected: [],
    lowQualityRejected: [],
    errors: [],
  };

  for (const plan of PHARMACY_FIRST_ASSET_PLANS) {
    try {
      const status = await populatePharmacyFirstAsset(apiKey, plan, operatorId);
      if (status === "skipped") continue;
      result.created++;
      if (status === "approved") result.approved++;
      else {
        result.rejected++;
        result.lowQualityRejected.push(plan.assetId);
      }
    } catch (e) {
      result.errors.push(`${plan.assetId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const approvedFiles = listPharmacyFirstMetadataV11()
    .filter((m) => m.approvalStatus === "approved")
    .map((m) => ({
      assetId: m.assetId,
      filePath: path.join(PHARMACY_WORKSPACE_ROOT, m.filePath.replace(/^\/+/, "")),
    }));

  const dup = await scanDuplicates(approvedFiles);
  for (const d of dup.exactDuplicates) {
    result.exactDuplicatesRejected.push(d.assetId);
    const meta = PHARMACY_FIRST_ASSET_PLANS.find((p) => p.assetId === d.assetId);
    if (meta) {
      const m = readMetadataV11(SERVICE_ID, meta.role, d.assetId);
      if (m) {
        m.approvalStatus = "rejected";
        m.rejectedReason = `Exact duplicate of ${d.duplicateOf}`;
        writeMetadataV11(m);
        result.approved--;
        result.rejected++;
      }
    }
  }
  for (const d of dup.nearDuplicates) {
    result.nearDuplicatesRejected.push(`${d.assetId}~${d.similarTo}@${d.distance}`);
  }

  return result;
}
