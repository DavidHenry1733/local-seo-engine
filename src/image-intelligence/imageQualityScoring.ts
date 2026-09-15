/**
 * Image Quality Scoring Framework — weighted dimension scoring for generated/uploaded images.
 */
import { loadImageIntelligence } from "./loadImageIntelligence.ts";

export interface QualityDimensionScore {
  dimensionId: string;
  score: number;
  maxScore: number;
  notes?: string;
}

export interface QualityScoreInput {
  industryType: string;
  slot: string;
  dimensionScores: QualityDimensionScore[];
  autoChecks?: Record<string, boolean>;
}

export interface QualityScoreResult {
  totalScore: number;
  maxScore: number;
  normalisedScore: number;
  verdict: "approve" | "review" | "reject";
  dimensionBreakdown: Array<QualityDimensionScore & { weight: number; weightedScore: number }>;
  autoRejectTriggered: boolean;
  autoRejectReasons: string[];
}

interface ScoringDimension {
  dimensionId: string;
  label: string;
  weight: number;
  maxScore: number;
  criteria: string[];
  industryModifiers?: Record<string, number>;
}

export function getScoringDimensions(industryType?: string): ScoringDimension[] {
  const framework = loadImageIntelligence().imageQualityScoringFramework as {
    dimensions: ScoringDimension[];
  };
  return framework.dimensions.map((d) => {
    const modifier = industryType ? d.industryModifiers?.[industryType] : undefined;
    return modifier ? { ...d, weight: d.weight * modifier } : d;
  });
}

export function scoreImage(input: QualityScoreInput): QualityScoreResult {
  const framework = loadImageIntelligence().imageQualityScoringFramework as {
    dimensions: ScoringDimension[];
    thresholds: { autoApprove: number; manualReview: number; autoReject: number };
    autoRejectRules: Array<{ ruleId: string; check: string; message: string }>;
  };

  const dimensions = getScoringDimensions(input.industryType);
  const weightSum = dimensions.reduce((s, d) => s + d.weight, 0);

  const autoRejectReasons: string[] = [];
  for (const rule of framework.autoRejectRules) {
    if (input.autoChecks?.[rule.check] === true) {
      autoRejectReasons.push(rule.message);
    }
  }

  const dimensionBreakdown = dimensions.map((dim) => {
    const submitted = input.dimensionScores.find((s) => s.dimensionId === dim.dimensionId);
    const score = submitted?.score ?? 0;
    const maxScore = submitted?.maxScore ?? dim.maxScore;
    const normalised = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const weightedScore = (normalised * dim.weight) / weightSum;
    return {
      dimensionId: dim.dimensionId,
      score,
      maxScore,
      notes: submitted?.notes,
      weight: dim.weight,
      weightedScore,
    };
  });

  const normalisedScore = Math.round(dimensionBreakdown.reduce((s, d) => s + d.weightedScore, 0));
  const { autoApprove, manualReview, autoReject } = framework.thresholds;

  let verdict: QualityScoreResult["verdict"] = "review";
  if (autoRejectReasons.length > 0 || normalisedScore < autoReject) verdict = "reject";
  else if (normalisedScore >= autoApprove) verdict = "approve";
  else if (normalisedScore >= manualReview) verdict = "review";
  else verdict = "reject";

  return {
    totalScore: dimensionBreakdown.reduce((s, d) => s + d.score, 0),
    maxScore: dimensionBreakdown.reduce((s, d) => s + d.maxScore, 0),
    normalisedScore,
    verdict,
    dimensionBreakdown,
    autoRejectTriggered: autoRejectReasons.length > 0,
    autoRejectReasons,
  };
}

export function defaultDimensionScores(industryType: string): QualityDimensionScore[] {
  return getScoringDimensions(industryType).map((d) => ({
    dimensionId: d.dimensionId,
    score: 0,
    maxScore: d.maxScore,
  }));
}
