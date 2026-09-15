/**
 * Image Prompt Dashboard — intelligence-only data layer for dashboard UI.
 * Uses universal image intelligence engine; no hardcoded pharmacy-only logic.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadImageIntelligence, type UniversalImageSlot } from "./loadImageIntelligence.ts";
import { getApprovalStages } from "./imageApprovalWorkflow.ts";
import {
  loadUniversalImageIntelligenceEngine,
  resolveUniversalPageImages,
  type UniversalImageContext,
} from "./universalImageIntelligenceEngine.ts";
import {
  APPROVAL_STATE_PATH,
  applyDashboardAction,
  fileExistsAtUploadPath,
  getApprovalRecord,
  listApprovalRecords,
  loadApprovalState,
  resolveIndustryUploadPath,
  slotStatusFromRecord,
  transitionApprovalStatus,
  upsertApprovalRecord,
  type ImageApprovalStateRecord,
  type ImageApprovalStatus,
  type SlotCoverageStatus,
} from "./imageApprovalState.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SLOTS: UniversalImageSlot[] = ["hero", "support", "trust", "conversion"];

function resolveWorkspaceRoot(): string {
  const candidates = [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../../.."), process.cwd()];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "output/universal-image-intelligence/image-intelligence.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();

export const PATHS = {
  aiPromptLibrary: path.join(WORKSPACE_ROOT, "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json"),
  productionLibrary: path.join(WORKSPACE_ROOT, "output/pharmacy-blueprint/pharmacy-production-image-library.json"),
  templateArchitecture: path.join(WORKSPACE_ROOT, "output/pharmacy-blueprint/template-architecture.json"),
  imageIntelligence: path.join(WORKSPACE_ROOT, "output/universal-image-intelligence/image-intelligence.json"),
};

export interface DashboardWorkflowStage {
  stageId: string;
  label: string;
  description: string;
  source: string;
}

export interface CurrentImageRow {
  imageKey: string;
  pack: string;
  packName: string;
  slot: string;
  status: string;
  uploadDate: string | null;
  approvedStatus: string;
  approvalStatus: ImageApprovalStatus;
  thumbnailUrl: string | null;
  uploadTargetPath: string;
  purpose: string;
  hasFile: boolean;
}

export interface PromptRow {
  imageKey: string;
  slot: string;
  prompt: string;
  negativePrompt: string;
  aspectRatio: string;
  style: string;
  imagePack: string;
  uploadTargetPath: string;
}

export interface UploadQueueBucket {
  key: string;
  label: string;
  count: number;
  images: Array<{ imageKey: string; pack: string; slot: string; uploadTargetPath: string }>;
}

export interface ServiceCoverageRow {
  serviceKey: string;
  serviceName: string;
  templateFamily: string;
  slots: Record<
    UniversalImageSlot,
    {
      status: SlotCoverageStatus;
      imageKey: string;
      imagePack: string;
      uploadPath: string;
      covered: boolean;
      approved: boolean;
      uploaded: boolean;
      fallback: boolean;
    }
  >;
  coveragePercent: number;
  uploadedCoveragePercent: number;
  approvedCoveragePercent: number;
  missingSlots: UniversalImageSlot[];
  fallbackSlots: UniversalImageSlot[];
  uploadedSlots: UniversalImageSlot[];
  approvedSlots: UniversalImageSlot[];
}

export interface FutureIndustryStatus {
  industryKey: string;
  displayName: string;
  readiness: string;
  universalWorkflowLocked: boolean;
  adapterStatus: string;
  workflowReady: boolean;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function assetExists(relativePath: string): boolean {
  return fs.existsSync(path.join(WORKSPACE_ROOT, relativePath));
}

function fileModifiedIso(relativePath: string): string | null {
  const full = path.join(WORKSPACE_ROOT, relativePath);
  if (!fs.existsSync(full)) return null;
  return fs.statSync(full).mtime.toISOString();
}

function loadProductionLibrary(): {
  industry: string;
  imagePacks: Record<
    string,
    {
      packKey: string;
      packName: string;
      templateFamily: string;
      images: Array<{
        imageKey: string;
        pack: string;
        slot: string;
        purpose: string;
        uploadTargetPath: string;
        productionStatus: string;
        fallbackImageKey?: string;
      }>;
    }
  >;
  futureIndustryWorkflow?: {
    industries: Array<{
      industryKey: string;
      displayName: string;
      readiness: string;
      universalWorkflowLocked: boolean;
      adapterStatus: string;
    }>;
  };
} {
  return readJson(PATHS.productionLibrary);
}

function loadAiPromptLibrary(): {
  industry: string;
  imagePromptPacks: Record<
    string,
    {
      packKey: string;
      packName: string;
      templateFamily: string;
      prompts: Array<{
        imageKey: string;
        imagePack: string;
        recommendedSlot: string;
        ideogramPrompt: string;
        negativePrompt: string;
        aspectRatio: string;
        stylePreset: string;
        uploadTargetPath: string;
        compatibleServices?: string[];
      }>;
    }
  >;
} {
  return readJson(PATHS.aiPromptLibrary);
}

function loadTemplateArchitecture(): {
  serviceMappings: Array<{
    serviceKey: string;
    serviceName: string;
    assignedTemplateKey: string;
  }>;
} {
  return readJson(PATHS.templateArchitecture);
}

function deriveImageStatusFromRecord(
  uploadTargetPath: string,
  record?: ImageApprovalStateRecord,
): { status: string; approvedStatus: string; approvalStatus: ImageApprovalStatus } {
  const hasFile = fileExistsAtUploadPath(uploadTargetPath);
  const approvalStatus = record?.status ?? (hasFile ? "uploaded" : "awaiting-upload");

  if (approvalStatus === "rejected") {
    return { status: "rejected", approvedStatus: "rejected", approvalStatus };
  }
  if (approvalStatus === "approved" || approvalStatus === "live-ready") {
    return { status: approvalStatus, approvedStatus: "approved", approvalStatus };
  }
  if (approvalStatus === "awaiting-upload" && !hasFile) {
    return { status: "awaiting-upload", approvedStatus: "not-uploaded", approvalStatus };
  }
  if (["uploaded", "quality-review", "compliance-review"].includes(approvalStatus)) {
    return { status: approvalStatus, approvedStatus: "pending-review", approvalStatus };
  }
  if (hasFile) {
    return { status: "uploaded", approvedStatus: "pending-review", approvalStatus: "uploaded" };
  }
  return { status: "awaiting-upload", approvedStatus: "not-uploaded", approvalStatus: "awaiting-upload" };
}

export function saveUploadedImage(input: {
  industry: string;
  pack: string;
  imageKey: string;
  slot: string;
  sourcePath: string;
  uploadedBy?: string;
  approvalStatus?: ImageApprovalStatus;
}): ImageApprovalStateRecord {
  if (!fs.existsSync(input.sourcePath)) {
    throw new Error("Upload temp file missing — try uploading again");
  }

  const uploadPath = resolveIndustryUploadPath(input.industry, input.pack, input.imageKey);
  const destFull = path.join(WORKSPACE_ROOT, uploadPath);
  fs.mkdirSync(path.dirname(destFull), { recursive: true });
  fs.copyFileSync(input.sourcePath, destFull);

  const status = input.approvalStatus ?? "uploaded";
  return upsertApprovalRecord({
    industry: input.industry,
    pack: input.pack,
    imageKey: input.imageKey,
    slot: input.slot,
    uploadPath,
    status,
    approvalStatus: status,
    uploadedAt: new Date().toISOString(),
    uploadedBy: input.uploadedBy ?? null,
  });
}

export function handleApprovalAction(input: {
  industry: string;
  pack: string;
  imageKey: string;
  slot: string;
  action: "mark-uploaded" | "approve" | "reject" | "reset";
  actor?: string;
  reviewNotes?: string;
}): ImageApprovalStateRecord {
  return applyDashboardAction(input);
}

export { transitionApprovalStatus, APPROVAL_STATE_PATH, loadApprovalState };

/** Dashboard pipeline stages — sourced from image-intelligence.json */
export function getDashboardWorkflowPipeline(): DashboardWorkflowStage[] {
  const intel = loadImageIntelligence() as {
    imagePromptDashboardWorkflow?: { stages: DashboardWorkflowStage[] };
    businessOnboardingWorkflow?: { stages: Array<{ stage: string; name: string; description: string }> };
    imageApprovalWorkflow?: { stages: Array<{ stageId: string; name: string; description: string }> };
  };

  if (intel.imagePromptDashboardWorkflow?.stages?.length) {
    return intel.imagePromptDashboardWorkflow.stages;
  }

  const onboarding = intel.businessOnboardingWorkflow?.stages ?? [];
  const approval = intel.imageApprovalWorkflow?.stages ?? getApprovalStages();

  const findOnboarding = (stage: string) => onboarding.find((s) => s.stage === stage);

  return [
    {
      stageId: "prompt-generated",
      label: "Prompt Generated",
      description: findOnboarding("ai-prompt-generation")?.description ?? "AI prompt library entry resolved for imageKey",
      source: "image-intelligence.json#businessOnboardingWorkflow.ai-prompt-generation",
    },
    {
      stageId: "awaiting-upload",
      label: "Awaiting Upload",
      description:
        approval.find((s) => s.stageId === "pending-generation")?.description ??
        "Prompt ready; file not yet at uploadTargetPath",
      source: "image-intelligence.json#imageApprovalWorkflow.pending-generation",
    },
    {
      stageId: "uploaded",
      label: "Uploaded",
      description:
        approval.find((s) => s.stageId === "generated")?.description ?? "Image file exists at uploadTargetPath",
      source: "image-intelligence.json#imageApprovalWorkflow.generated",
    },
    {
      stageId: "quality-review",
      label: "Quality Review",
      description:
        approval.find((s) => s.stageId === "quality-scored")?.description ??
        "Automated quality scoring and manual review",
      source: "image-intelligence.json#imageApprovalWorkflow.quality-scored",
    },
    {
      stageId: "compliance-review",
      label: "Compliance Review",
      description:
        approval.find((s) => s.stageId === "compliance-review")?.description ??
        "Clinical/regulatory compliance sign-off",
      source: "image-intelligence.json#imageApprovalWorkflow.compliance-review",
    },
    {
      stageId: "approved",
      label: "Approved",
      description: approval.find((s) => s.stageId === "approved")?.description ?? "Approved for campaign use",
      source: "image-intelligence.json#imageApprovalWorkflow.approved",
    },
    {
      stageId: "live-ready",
      label: "Live Ready",
      description:
        findOnboarding("live-campaign")?.description ??
        "Approved images ready for live page generation (deployment separate)",
      source: "image-intelligence.json#businessOnboardingWorkflow.live-campaign",
    },
  ];
}

export function listIndustries(): Array<{ industryKey: string; displayName: string; hasPromptLibrary: boolean }> {
  loadUniversalImageIntelligenceEngine();
  const intel = loadImageIntelligence();
  const adapters = (intel.industryAdapters ?? {}) as Record<string, { industryType: string; displayName: string }>;
  const production = fs.existsSync(PATHS.productionLibrary) ? loadProductionLibrary() : null;

  const industries = new Map<string, { industryKey: string; displayName: string; hasPromptLibrary: boolean }>();

  for (const adapter of Object.values(adapters)) {
    industries.set(adapter.industryType, {
      industryKey: adapter.industryType,
      displayName: adapter.displayName ?? adapter.industryType,
      hasPromptLibrary: adapter.industryType === "pharmacy" && fs.existsSync(PATHS.aiPromptLibrary),
    });
  }

  if (production?.futureIndustryWorkflow?.industries) {
    for (const ind of production.futureIndustryWorkflow.industries) {
      if (!industries.has(ind.industryKey)) {
        industries.set(ind.industryKey, {
          industryKey: ind.industryKey,
          displayName: ind.displayName,
          hasPromptLibrary: false,
        });
      }
    }
  }

  return [...industries.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function listTemplateFamilies(industry: string): Array<{ familyKey: string; familyName: string }> {
  if (industry !== "pharmacy" || !fs.existsSync(PATHS.productionLibrary)) {
    const engine = loadUniversalImageIntelligenceEngine();
    const adapter = engine.industryAdapters[industry] ?? engine.industryAdapters[Object.keys(engine.industryAdapters)[0]!];
    return (adapter?.templateFamilies ?? []).map((f) => ({ familyKey: f, familyName: f.replace(/-/g, " ") }));
  }

  const lib = loadProductionLibrary();
  return Object.values(lib.imagePacks)
    .filter((p) => p.templateFamily && p.templateFamily !== "*")
    .map((p) => ({
      familyKey: p.templateFamily,
      familyName: p.packName,
    }))
    .sort((a, b) => a.familyName.localeCompare(b.familyName));
}

export const FEATURED_HUB_SERVICE_KEYS = [
  "pharmacy-first",
  "nhs-flu-vaccination",
  "private-ear-wax-removal",
  "travel-vaccinations",
  "pharmacy-weight-loss-programme",
] as const;

export type PromptGeneratorService = {
  serviceKey: string;
  serviceName: string;
  templateFamily: string;
  featured?: boolean;
};

export function listAllServices(industry: string): PromptGeneratorService[] {
  if (industry !== "pharmacy" || !fs.existsSync(PATHS.templateArchitecture)) {
    const engine = loadUniversalImageIntelligenceEngine();
    const adapter = engine.industryAdapters[industry];
    return (adapter?.services ?? []).map((sk) => ({
      serviceKey: sk,
      serviceName: sk.replace(/-/g, " "),
      templateFamily: "",
    }));
  }

  const arch = loadTemplateArchitecture();
  return arch.serviceMappings.map((s) => ({
    serviceKey: s.serviceKey,
    serviceName: s.serviceName,
    templateFamily: s.assignedTemplateKey,
  }));
}

export function listFeaturedHubServices(industry: string): PromptGeneratorService[] {
  const all = listAllServices(industry);
  const byKey = new Map(all.map((s) => [s.serviceKey, s]));
  return FEATURED_HUB_SERVICE_KEYS.map((serviceKey) => {
    const match = byKey.get(serviceKey);
    return match ? { ...match, featured: true } : null;
  }).filter((s): s is PromptGeneratorService => s !== null);
}

export function listPromptGeneratorServices(industry: string, templateFamily?: string): PromptGeneratorService[] {
  const all = listAllServices(industry);
  const featured = listFeaturedHubServices(industry);
  const featuredKeys = new Set(featured.map((s) => s.serviceKey));

  if (!templateFamily) {
    const rest = all
      .filter((s) => !featuredKeys.has(s.serviceKey))
      .sort((a, b) => a.serviceName.localeCompare(b.serviceName));
    return [...featured, ...rest];
  }

  const familyServices = all
    .filter((s) => s.templateFamily === templateFamily && !featuredKeys.has(s.serviceKey))
    .sort((a, b) => a.serviceName.localeCompare(b.serviceName));
  return [...featured, ...familyServices];
}

export function listServices(industry: string, templateFamily?: string): PromptGeneratorService[] {
  return listPromptGeneratorServices(industry, templateFamily);
}

export function listPacks(industry: string, templateFamily?: string): Array<{ packKey: string; packName: string; templateFamily: string }> {
  if (industry !== "pharmacy" || !fs.existsSync(PATHS.productionLibrary)) {
    return [{ packKey: "default", packName: "Default Pack", templateFamily: templateFamily ?? "*" }];
  }

  const lib = loadProductionLibrary();
  let packs = Object.values(lib.imagePacks).map((p) => ({
    packKey: p.packKey,
    packName: p.packName,
    templateFamily: p.templateFamily,
  }));
  if (templateFamily) {
    packs = packs.filter((p) => p.templateFamily === templateFamily || p.templateFamily === "*");
  }
  return packs.sort((a, b) => a.packName.localeCompare(b.packName));
}

export function getCurrentImages(industry = "pharmacy"): CurrentImageRow[] {
  if (industry !== "pharmacy" || !fs.existsSync(PATHS.productionLibrary)) {
    return listApprovalRecords(industry).map((record) => ({
      imageKey: record.imageKey,
      pack: record.pack,
      packName: record.pack,
      slot: record.slot,
      status: record.status,
      uploadDate: record.uploadedAt ?? null,
      approvedStatus: record.status === "approved" || record.status === "live-ready" ? "approved" : record.status,
      approvalStatus: record.status,
      thumbnailUrl: fileExistsAtUploadPath(record.uploadPath) ? `/${record.uploadPath}` : null,
      uploadTargetPath: record.uploadPath,
      purpose: "",
      hasFile: fileExistsAtUploadPath(record.uploadPath),
    }));
  }

  const lib = loadProductionLibrary();
  const rows: CurrentImageRow[] = [];

  for (const pack of Object.values(lib.imagePacks)) {
    for (const img of pack.images) {
      const uploadTargetPath =
        img.uploadTargetPath ?? resolveIndustryUploadPath(industry, pack.packKey, img.imageKey);
      const record = getApprovalRecord(industry, pack.packKey, img.imageKey);
      const { status, approvedStatus, approvalStatus } = deriveImageStatusFromRecord(uploadTargetPath, record);
      const hasFile = fileExistsAtUploadPath(uploadTargetPath);
      rows.push({
        imageKey: img.imageKey,
        pack: pack.packKey,
        packName: pack.packName,
        slot: img.slot,
        status,
        uploadDate: record?.uploadedAt ?? (hasFile ? fileModifiedIso(uploadTargetPath) : null),
        approvedStatus,
        approvalStatus,
        thumbnailUrl: hasFile ? `/${uploadTargetPath}` : null,
        uploadTargetPath,
        purpose: img.purpose,
        hasFile,
      });
    }
  }

  return rows.sort((a, b) => a.pack.localeCompare(b.pack) || a.slot.localeCompare(b.slot));
}

export function getPrompts(filters: {
  industry?: string;
  templateFamily?: string;
  serviceKey?: string;
  packKey?: string;
}): PromptRow[] {
  const industry = filters.industry ?? "pharmacy";
  if (industry !== "pharmacy" || !fs.existsSync(PATHS.aiPromptLibrary)) return [];

  const lib = loadAiPromptLibrary();
  let packKeys = Object.keys(lib.imagePromptPacks);

  if (filters.packKey) {
    packKeys = packKeys.filter((k) => k === filters.packKey);
  } else if (filters.templateFamily) {
    packKeys = packKeys.filter((k) => {
      const tf = lib.imagePromptPacks[k]?.templateFamily;
      return tf === filters.templateFamily || tf === "*";
    });
  }

  const rows: PromptRow[] = [];
  for (const pk of packKeys) {
    const pack = lib.imagePromptPacks[pk];
    if (!pack) continue;

    for (const prompt of pack.prompts) {
      if (filters.serviceKey) {
        const compat = prompt.compatibleServices ?? ["*"];
        if (!compat.includes("*") && !compat.includes(filters.serviceKey)) continue;
      }
      rows.push({
        imageKey: prompt.imageKey,
        slot: prompt.recommendedSlot,
        prompt: prompt.ideogramPrompt,
        negativePrompt: prompt.negativePrompt,
        aspectRatio: prompt.aspectRatio,
        style: prompt.stylePreset,
        imagePack: prompt.imagePack,
        uploadTargetPath: prompt.uploadTargetPath,
      });
    }
  }

  return rows.sort((a, b) => a.imagePack.localeCompare(b.imagePack) || a.slot.localeCompare(b.slot));
}

export function exportPromptPack(filters: {
  industry?: string;
  serviceKey?: string;
  templateFamily?: string;
  packKey?: string;
}): Record<string, unknown> {
  const industry = filters.industry ?? "pharmacy";
  let packKey = filters.packKey;

  if (!packKey && filters.serviceKey && industry === "pharmacy") {
    const arch = loadTemplateArchitecture();
    const svc = arch.serviceMappings.find((s) => s.serviceKey === filters.serviceKey);
    const family = filters.templateFamily ?? svc?.assignedTemplateKey;
    if (family) {
      const lib = loadProductionLibrary();
      const match = Object.values(lib.imagePacks).find((p) => p.templateFamily === family);
      packKey = match?.packKey ?? family;
    }
  }

  const prompts = getPrompts({ ...filters, packKey });
  const lib = industry === "pharmacy" && fs.existsSync(PATHS.aiPromptLibrary) ? loadAiPromptLibrary() : null;
  const packMeta = packKey && lib ? lib.imagePromptPacks[packKey] : null;

  return {
    exportedAt: new Date().toISOString(),
    industry,
    serviceKey: filters.serviceKey ?? null,
    templateFamily: filters.templateFamily ?? packMeta?.templateFamily ?? null,
    packKey: packKey ?? null,
    packName: packMeta?.packName ?? null,
    promptCount: prompts.length,
    prompts,
  };
}

export function exportSinglePrompt(filters: {
  industry?: string;
  packKey?: string;
  serviceKey?: string;
  templateFamily?: string;
  imageKey?: string;
}): Record<string, unknown> | null {
  if (!filters.imageKey) return null;

  const industry = filters.industry ?? "pharmacy";
  let packKey = filters.packKey;

  if (!packKey && filters.serviceKey && industry === "pharmacy") {
    const arch = loadTemplateArchitecture();
    const svc = arch.serviceMappings.find((s) => s.serviceKey === filters.serviceKey);
    const family = filters.templateFamily ?? svc?.assignedTemplateKey;
    if (family) {
      const lib = loadProductionLibrary();
      const match = Object.values(lib.imagePacks).find((p) => p.templateFamily === family);
      packKey = match?.packKey ?? family;
    }
  }

  const prompts = getPrompts({
    industry,
    packKey,
    serviceKey: filters.serviceKey,
    templateFamily: filters.templateFamily,
  }).filter((p) => p.imageKey === filters.imageKey);
  if (!prompts.length) return null;
  return {
    exportedAt: new Date().toISOString(),
    industry,
    serviceKey: filters.serviceKey ?? null,
    templateFamily: filters.templateFamily ?? null,
    packKey: packKey ?? prompts[0]!.imagePack,
    imageKey: filters.imageKey,
    prompt: prompts[0],
  };
}

export function getUploadQueue(industry = "pharmacy"): {
  buckets: UploadQueueBucket[];
  workflowPipeline: DashboardWorkflowStage[];
  totals: Record<string, number>;
} {
  const images = getCurrentImages(industry);
  const workflowPipeline = getDashboardWorkflowPipeline();

  const buckets: UploadQueueBucket[] = [
    { key: "awaiting-upload", label: "Awaiting Upload", count: 0, images: [] },
    { key: "uploaded", label: "Uploaded", count: 0, images: [] },
    { key: "approved", label: "Approved", count: 0, images: [] },
    { key: "rejected", label: "Rejected", count: 0, images: [] },
    { key: "fallback-used", label: "Fallback Image Used", count: 0, images: [] },
  ];

  const bucketMap = Object.fromEntries(buckets.map((b) => [b.key, b]));

  for (const img of images) {
    const entry = {
      imageKey: img.imageKey,
      pack: img.pack,
      slot: img.slot,
      uploadTargetPath: img.uploadTargetPath,
      approvalStatus: img.approvalStatus,
    };
    if (img.approvalStatus === "awaiting-upload" || img.status === "awaiting-upload") {
      bucketMap["awaiting-upload"]!.images.push(entry);
    } else if (img.approvalStatus === "rejected" || img.status === "rejected") {
      bucketMap["rejected"]!.images.push(entry);
    } else if (img.approvalStatus === "approved" || img.approvalStatus === "live-ready") {
      bucketMap["approved"]!.images.push(entry);
    } else {
      bucketMap["uploaded"]!.images.push(entry);
    }
  }

  if (industry === "pharmacy" && fs.existsSync(PATHS.templateArchitecture)) {
    const coverage = getCoverageReport("pharmacy");
    for (const svc of coverage.services) {
      for (const slot of svc.fallbackSlots) {
        const resolved = svc.slots[slot];
        if (resolved.status !== "missing") continue;
        bucketMap["fallback-used"]!.images.push({
          imageKey: resolved.imageKey,
          pack: svc.serviceKey,
          slot,
          uploadTargetPath: `(fallback for ${svc.serviceName} / ${slot})`,
        });
      }
    }
  }

  for (const b of buckets) b.count = b.images.length;

  const totals = Object.fromEntries(buckets.map((b) => [b.key, b.count]));
  return { buckets, workflowPipeline, totals };
}

export function getCoverageReport(industry = "pharmacy"): {
  services: ServiceCoverageRow[];
  summary: {
    totalServices: number;
    averageCoveragePercent: number;
    averageUploadedCoveragePercent: number;
    averageApprovedCoveragePercent: number;
    totalMissingSlots: number;
    totalFallbackSlots: number;
    totalUploadedSlots: number;
    totalApprovedSlots: number;
  };
} {
  const ctxBase: Omit<UniversalImageContext, "slot"> = {
    industryType: industry,
    serviceKey: "",
    businessName: "Demo Business",
    location: "Local Area",
  };

  let serviceList: Array<{ serviceKey: string; serviceName: string; templateFamily: string }> = [];

  if (industry === "pharmacy" && fs.existsSync(PATHS.templateArchitecture)) {
    serviceList = loadTemplateArchitecture().serviceMappings.map((s) => ({
      serviceKey: s.serviceKey,
      serviceName: s.serviceName,
      templateFamily: s.assignedTemplateKey,
    }));
  } else {
    const engine = loadUniversalImageIntelligenceEngine();
    const adapter = engine.industryAdapters[industry];
    serviceList = (adapter?.services ?? []).slice(0, 10).map((sk) => ({
      serviceKey: sk,
      serviceName: sk.replace(/-/g, " "),
      templateFamily: adapter?.templateFamilies?.[0] ?? "",
    }));
  }

  const services: ServiceCoverageRow[] = [];

  for (const svc of serviceList) {
    const pageImages = resolveUniversalPageImages({
      ...ctxBase,
      serviceKey: svc.serviceKey,
      serviceName: svc.serviceName,
      templateFamilyKey: svc.templateFamily,
    });

    const slots = {} as ServiceCoverageRow["slots"];
    const missingSlots: UniversalImageSlot[] = [];
    const fallbackSlots: UniversalImageSlot[] = [];
    const uploadedSlots: UniversalImageSlot[] = [];
    const approvedSlots: UniversalImageSlot[] = [];
    let uploadedCount = 0;
    let approvedCount = 0;

    for (const slot of SLOTS) {
      const resolved = pageImages[slot];
      const uploadPath = resolveIndustryUploadPath(industry, resolved.imagePack, resolved.imageKey);
      const record = getApprovalRecord(industry, resolved.imagePack, resolved.imageKey);
      let status = slotStatusFromRecord(record, uploadPath);

      if (status === "missing" && record?.status === "rejected") {
        status = "rejected";
      }
      if (status === "missing") {
        missingSlots.push(slot);
        fallbackSlots.push(slot);
      } else if (status === "uploaded") {
        uploadedSlots.push(slot);
        uploadedCount++;
      } else if (status === "approved") {
        approvedSlots.push(slot);
        approvedCount++;
        uploadedCount++;
      } else if (status === "rejected") {
        fallbackSlots.push(slot);
      }

      slots[slot] = {
        status,
        imageKey: resolved.imageKey,
        imagePack: resolved.imagePack,
        uploadPath,
        covered: status === "approved" || status === "uploaded",
        approved: status === "approved",
        uploaded: status === "uploaded" || status === "approved",
        fallback: status === "missing" || status === "rejected",
      };
    }

    services.push({
      serviceKey: svc.serviceKey,
      serviceName: svc.serviceName,
      templateFamily: svc.templateFamily,
      slots,
      coveragePercent: Math.round(((uploadedCount + approvedCount) / SLOTS.length) * 100),
      uploadedCoveragePercent: Math.round((uploadedCount / SLOTS.length) * 100),
      approvedCoveragePercent: Math.round((approvedCount / SLOTS.length) * 100),
      missingSlots,
      fallbackSlots,
      uploadedSlots,
      approvedSlots,
    });
  }

  const averageCoveragePercent =
    services.length > 0
      ? Math.round(services.reduce((sum, s) => sum + s.approvedCoveragePercent, 0) / services.length)
      : 0;
  const averageUploadedCoveragePercent =
    services.length > 0
      ? Math.round(services.reduce((sum, s) => sum + s.uploadedCoveragePercent, 0) / services.length)
      : 0;
  const averageApprovedCoveragePercent = averageCoveragePercent;

  return {
    services,
    summary: {
      totalServices: services.length,
      averageCoveragePercent,
      averageUploadedCoveragePercent,
      averageApprovedCoveragePercent,
      totalMissingSlots: services.reduce((sum, s) => sum + s.missingSlots.length, 0),
      totalFallbackSlots: services.reduce((sum, s) => sum + s.fallbackSlots.length, 0),
      totalUploadedSlots: services.reduce((sum, s) => sum + s.uploadedSlots.length, 0),
      totalApprovedSlots: services.reduce((sum, s) => sum + s.approvedSlots.length, 0),
    },
  };
}

export function getFutureIndustryReadiness(): FutureIndustryStatus[] {
  const required = ["dentist", "accountant", "builder", "electrician", "hairdresser"];
  const production = fs.existsSync(PATHS.productionLibrary) ? loadProductionLibrary() : null;
  const future = production?.futureIndustryWorkflow?.industries ?? [];

  loadUniversalImageIntelligenceEngine();
  loadImageIntelligence();

  return required.map((key) => {
    const entry = future.find((i) => i.industryKey === key);
    return {
      industryKey: key,
      displayName: entry?.displayName ?? key,
      readiness: entry?.readiness ?? "unknown",
      universalWorkflowLocked: entry?.universalWorkflowLocked ?? true,
      adapterStatus: entry?.adapterStatus ?? "planned",
      workflowReady: !!entry?.universalWorkflowLocked,
    };
  });
}

export const PHARMACY_UPLOAD_PACK_ORDER = [
  "core-pharmacy",
  "clinical-nhs-services",
  "vaccination-services",
  "private-healthcare-services",
  "travel-health-services",
  "weight-management-services",
] as const;

const SLOT_LABELS: Record<string, string> = {
  hero: "Hero",
  support: "Support",
  trust: "Trust",
  conversion: "Conversion",
};

const IMAGE_KEY_LABEL_OVERRIDES: Record<string, string> = {
  "pharmacy-first-consultation": "Pharmacy First Consultation",
  "minor-illness-advice": "Minor Illness Advice",
  "blood-pressure-check": "Blood Pressure Check",
  "nhs-service-support": "NHS Service Support",
  "flu-vaccination": "Flu Vaccination",
  "ear-wax-removal": "Ear Wax Removal",
  "travel-vaccination": "Travel Vaccination",
  "weight-consultation": "Weight Consultation",
  "bmi-review": "BMI Review",
  "progress-monitoring": "Progress Monitoring",
  "private-weight-support": "Private Weight Support",
};

export function friendlyImageKeyLabel(imageKey: string): string {
  return IMAGE_KEY_LABEL_OVERRIDES[imageKey] ?? imageKey.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export type UploadOptionImage = {
  imageKey: string;
  imageLabel: string;
  defaultSlot: string;
  slotLabel: string;
  uploadTargetPath: string;
  purpose?: string;
};

export type UploadOptionPack = {
  packKey: string;
  packName: string;
  templateFamily: string;
  images: UploadOptionImage[];
};

export function getUploadOptions(industry = "pharmacy"): {
  industry: string;
  assetRoot: string;
  packs: UploadOptionPack[];
  imageKeysByPack: Record<string, UploadOptionImage[]>;
  slotsByImage: Record<string, { defaultSlot: string; options: Array<{ slot: string; label: string }> }>;
  uploadTargetPaths: Record<string, string>;
  standardSlots: Array<{ slot: string; label: string }>;
} {
  const standardSlots = SLOTS.map((slot) => ({ slot, label: SLOT_LABELS[slot] ?? slot }));

  if (industry !== "pharmacy" || !fs.existsSync(PATHS.productionLibrary)) {
    return {
      industry,
      assetRoot: `assets/${industry}-image-library`,
      packs: [],
      imageKeysByPack: {},
      slotsByImage: {},
      uploadTargetPaths: {},
      standardSlots,
    };
  }

  const lib = loadProductionLibrary();
  const packs: UploadOptionPack[] = [];
  const imageKeysByPack: Record<string, UploadOptionImage[]> = {};
  const slotsByImage: Record<string, { defaultSlot: string; options: Array<{ slot: string; label: string }> }> = {};
  const uploadTargetPaths: Record<string, string> = {};

  for (const packKey of PHARMACY_UPLOAD_PACK_ORDER) {
    const pack = lib.imagePacks[packKey];
    if (!pack) continue;

    const images: UploadOptionImage[] = pack.images.map((img) => {
      const uploadTargetPath =
        img.uploadTargetPath ?? resolveIndustryUploadPath(industry, packKey, img.imageKey);
      const mapKey = `${packKey}:${img.imageKey}`;
      uploadTargetPaths[mapKey] = uploadTargetPath;
      slotsByImage[mapKey] = {
        defaultSlot: img.slot,
        options: standardSlots,
      };
      return {
        imageKey: img.imageKey,
        imageLabel: friendlyImageKeyLabel(img.imageKey),
        defaultSlot: img.slot,
        slotLabel: SLOT_LABELS[img.slot] ?? img.slot,
        uploadTargetPath,
        purpose: img.purpose,
      };
    });

    imageKeysByPack[packKey] = images;
    packs.push({
      packKey: pack.packKey,
      packName: pack.packName,
      templateFamily: pack.templateFamily,
      images,
    });
  }

  return {
    industry,
    assetRoot: "assets/pharmacy-image-library",
    packs,
    imageKeysByPack,
    slotsByImage,
    uploadTargetPaths,
    standardSlots,
  };
}

export const DEFAULT_PROMPT_SELECTION = {
  industry: "pharmacy",
  templateFamily: "clinical-nhs-services",
  serviceKey: "pharmacy-first",
  packKey: "clinical-nhs-services",
} as const;

function buildServicesByTemplateFamily(industry: string): Record<string, PromptGeneratorService[]> {
  const families = listTemplateFamilies(industry);
  const out: Record<string, PromptGeneratorService[]> = {};
  for (const family of families) {
    out[family.familyKey] = listPromptGeneratorServices(industry, family.familyKey);
  }
  return out;
}

export function getDashboardMeta() {
  const pharmacyFamilies = listTemplateFamilies("pharmacy");
  const servicesByTemplateFamily = buildServicesByTemplateFamily("pharmacy");

  return {
    industries: listIndustries(),
    templateFamilies: pharmacyFamilies,
    standardSlots: SLOTS,
    workflowPipeline: getDashboardWorkflowPipeline(),
    defaultPromptSelection: DEFAULT_PROMPT_SELECTION,
    featuredHubServices: listFeaturedHubServices("pharmacy"),
    servicesByIndustry: {
      pharmacy: listPromptGeneratorServices("pharmacy"),
    },
    servicesByTemplateFamily,
    approvalStatePath: APPROVAL_STATE_PATH.replace(WORKSPACE_ROOT + path.sep, ""),
    sourceFiles: {
      aiPromptLibrary: PATHS.aiPromptLibrary.replace(WORKSPACE_ROOT + path.sep, ""),
      productionLibrary: PATHS.productionLibrary.replace(WORKSPACE_ROOT + path.sep, ""),
      imageIntelligence: PATHS.imageIntelligence.replace(WORKSPACE_ROOT + path.sep, ""),
      approvalState: APPROVAL_STATE_PATH.replace(WORKSPACE_ROOT + path.sep, ""),
    },
  };
}
