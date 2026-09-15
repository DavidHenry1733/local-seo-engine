/**
 * NT-E2E-26A — Product Owner dashboard acceptance generation contract.
 */
export type ProductOwnerAcceptanceGenerationMode = "product_owner_generation_required";

export type AuthorisedGenerationInitiationSource =
  | "product_owner_dashboard"
  | "service_layer"
  | "admin_workflow";

export interface DashboardExternalPackageRecord {
  jobId: string;
  status: string;
  label: string;
  generatedAt: string | null;
  initiationSource: AuthorisedGenerationInitiationSource;
  preservedForAudit: true;
}

export interface ProductOwnerAcceptanceGenerationContract {
  version: 1;
  slug: string;
  mode: ProductOwnerAcceptanceGenerationMode;
  enabled: true;
  enabledAt: string;
  enabledBy: string;
  activeStageLabel: "Product Owner Generation Required";
  preservedHistoricalPackageJobIds: string[];
  dashboardExternalPackages: DashboardExternalPackageRecord[];
}

export interface ProductOwnerAcceptanceGenerationSummary {
  required: boolean;
  stageLabel: string;
  previousDashboardExternalPackage: DashboardExternalPackageRecord | null;
  generateActionLabel: string;
  confirmationMessage: string;
}
