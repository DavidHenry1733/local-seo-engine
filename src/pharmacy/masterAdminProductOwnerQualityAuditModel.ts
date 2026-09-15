/**
 * NT-E2E-25 — Product Owner Quality Audit model (mandatory pre-approval page review).
 */
export type ProductOwnerAuditVerdict = "PASS" | "WARNING" | "FAIL";

export type ProductOwnerAuditCategory =
  | "brand"
  | "commercial"
  | "clinical"
  | "seo"
  | "localisation"
  | "ux"
  | "technical";

export interface ProductOwnerPageCategoryScore {
  category: ProductOwnerAuditCategory;
  score: number;
  verdict: ProductOwnerAuditVerdict;
  evidence: string;
}

export interface ProductOwnerPageAuditResult {
  pageLabel: string;
  pageSlug: string;
  pageType: string;
  outputPath: string;
  previewUrl: string;
  overallVerdict: ProductOwnerAuditVerdict;
  overallScore: number;
  categories: ProductOwnerPageCategoryScore[];
  findings: string[];
}

export interface ProductOwnerQualityIssue {
  severity: "critical" | "major" | "minor";
  code: string;
  pageSlug: string;
  pageLabel: string;
  category: ProductOwnerAuditCategory;
  message: string;
  evidence: string;
  recommendedFix: string;
}

export interface ProductOwnerQualityAuditPayload {
  version: 1;
  slug: string;
  serviceId: string;
  auditedAt: string;
  pagesAudited: number;
  overallQualityScore: number;
  categoryScores: Record<ProductOwnerAuditCategory, number>;
  criticalIssueCount: number;
  majorIssueCount: number;
  minorIssueCount: number;
  criticalIssues: ProductOwnerQualityIssue[];
  majorIssues: ProductOwnerQualityIssue[];
  minorImprovements: ProductOwnerQualityIssue[];
  recommendedFixes: string[];
  pages: ProductOwnerPageAuditResult[];
  readyForQualityReviewApproval: boolean;
  status: "READY FOR PRODUCT OWNER PAGE REVIEW" | "BLOCKED";
}
