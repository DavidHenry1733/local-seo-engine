/**
 * Load canonical image intelligence manifest.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type UniversalImageSlot = "hero" | "support" | "trust" | "conversion";

export interface PromptComponent {
  componentKey: string;
  category: string;
  label: string;
  text: string;
  appliesTo: string[];
  slots?: UniversalImageSlot[];
  polarity: "positive" | "negative";
}

export interface ImagePackAssignment {
  preferredImagePack: string;
  secondaryImagePack: string;
  fallbackImagePack: string;
  slotResolution?: Partial<Record<UniversalImageSlot, string>>;
  reason: string;
}

export interface ImageIntelligenceManifest {
  schemaVersion: string;
  phase: string;
  standardSlots: UniversalImageSlot[];
  universalSlotMapping: Record<string, unknown>;
  promptComponentLibrary: {
    version: string;
    categories: string[];
    components: Record<string, PromptComponent>;
    assemblyRules: Record<string, string[]>;
    industryPresets: Record<string, { positive: string[]; negative: string[] }>;
  };
  imagePackAssignmentEngine: Record<string, unknown>;
  businessOnboardingWorkflow: Record<string, unknown>;
  imageApprovalWorkflow: Record<string, unknown>;
  imageQualityScoringFramework: Record<string, unknown>;
  industryAdapters?: Record<string, unknown>;
  references?: Record<string, string>;
}

function resolveWorkspaceRoot(): string {
  const candidates = [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../../.."), process.cwd()];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "output/universal-image-intelligence/image-intelligence.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

const WORKSPACE_ROOT = resolveWorkspaceRoot();
export const IMAGE_INTELLIGENCE_PATH = path.join(
  WORKSPACE_ROOT,
  "output/universal-image-intelligence/image-intelligence.json",
);

let cached: ImageIntelligenceManifest | null = null;

export function loadImageIntelligence(): ImageIntelligenceManifest {
  if (cached) return cached;
  if (!fs.existsSync(IMAGE_INTELLIGENCE_PATH)) {
    throw new Error(`Image intelligence manifest not found: ${IMAGE_INTELLIGENCE_PATH}`);
  }
  cached = JSON.parse(fs.readFileSync(IMAGE_INTELLIGENCE_PATH, "utf8")) as ImageIntelligenceManifest;
  return cached;
}

export function clearImageIntelligenceCache(): void {
  cached = null;
}
