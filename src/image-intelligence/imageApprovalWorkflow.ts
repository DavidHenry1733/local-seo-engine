/**
 * Image Approval Workflow — stage definitions and transition rules.
 */
import { loadImageIntelligence } from "./loadImageIntelligence.ts";

export type ApprovalStageId =
  | "pending-generation"
  | "generated"
  | "quality-scored"
  | "compliance-review"
  | "brand-review"
  | "approved"
  | "rejected"
  | "archived";

export interface ApprovalRecord {
  imageId: string;
  stage: ApprovalStageId;
  industryType: string;
  serviceKey: string;
  slot: string;
  qualityScore?: number;
  reviewedBy?: string;
  notes?: string;
  updatedAt: string;
}

interface WorkflowStage {
  stageId: ApprovalStageId;
  name: string;
  description: string;
  requiredRole?: string;
  autoAdvance?: boolean;
  nextStages: ApprovalStageId[];
}

export function getApprovalStages(): WorkflowStage[] {
  const workflow = loadImageIntelligence().imageApprovalWorkflow as { stages: WorkflowStage[] };
  return workflow.stages;
}

export function getStage(stageId: ApprovalStageId): WorkflowStage | undefined {
  return getApprovalStages().find((s) => s.stageId === stageId);
}

export function canTransition(from: ApprovalStageId, to: ApprovalStageId): boolean {
  const stage = getStage(from);
  return stage?.nextStages.includes(to) ?? false;
}

export function nextStageForScore(score: number): ApprovalStageId {
  const framework = loadImageIntelligence().imageQualityScoringFramework as {
    thresholds: { autoApprove: number; manualReview: number; autoReject: number };
  };
  const { autoApprove, manualReview, autoReject } = framework.thresholds;
  if (score >= autoApprove) return "compliance-review";
  if (score >= manualReview) return "quality-scored";
  if (score < autoReject) return "rejected";
  return "quality-scored";
}

export function advanceApproval(record: ApprovalRecord, to: ApprovalStageId, opts?: { reviewedBy?: string; notes?: string }): ApprovalRecord {
  if (!canTransition(record.stage, to)) {
    throw new Error(`Invalid approval transition: ${record.stage} → ${to}`);
  }
  return {
    ...record,
    stage: to,
    reviewedBy: opts?.reviewedBy ?? record.reviewedBy,
    notes: opts?.notes ?? record.notes,
    updatedAt: new Date().toISOString(),
  };
}

export function createApprovalRecord(input: {
  imageId: string;
  industryType: string;
  serviceKey: string;
  slot: string;
}): ApprovalRecord {
  return {
    ...input,
    stage: "generated",
    updatedAt: new Date().toISOString(),
  };
}

export function isApproved(record: ApprovalRecord): boolean {
  return record.stage === "approved";
}

export function isUsableInCampaign(record: ApprovalRecord): boolean {
  return record.stage === "approved" || record.stage === "archived";
}
