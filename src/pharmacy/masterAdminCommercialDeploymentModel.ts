/**
 * Sprint 8C / 8C.1 — Commercial Deployment Configuration model.
 */
export type DeploymentMethodId =
  | "static_html_ftp"
  | "static_html_sftp"
  | "cpanel"
  | "git"
  | "cloudflare"
  | "s3";

export type DeploymentCheckStatus = "PASS" | "WARNING" | "FAIL";

export type DeploymentOverallStatus =
  | "CONFIGURATION REQUIRED"
  | "READY FOR VALIDATION"
  | "READY TO PUBLISH"
  | "BLOCKED";

export type DeploymentAuthMethod = "password" | "private_key" | "api_token";

export interface DeploymentCheck {
  id: string;
  label: string;
  status: DeploymentCheckStatus;
  detail: string;
}

export interface DeploymentMethodOption {
  id: DeploymentMethodId;
  label: string;
  available: boolean;
  description: string;
}

export const DEPLOYMENT_METHOD_OPTIONS: DeploymentMethodOption[] = [
  { id: "static_html_ftp", label: "Static HTML via FTP", available: true, description: "Upload generated HTML to your web hosting" },
  { id: "static_html_sftp", label: "Static HTML via SFTP", available: true, description: "Secure file transfer to your server" },
  { id: "cpanel", label: "cPanel", available: true, description: "Publish through cPanel hosting destination" },
  { id: "git", label: "Git", available: false, description: "Coming soon" },
  { id: "cloudflare", label: "Cloudflare Pages", available: false, description: "Coming soon" },
  { id: "s3", label: "Amazon S3", available: false, description: "Coming soon" },
];

export interface CommercialDeploymentProfile {
  version: 2;
  slug: string;
  productionWebsite: string;
  publicPath: string;
  deploymentMethod: DeploymentMethodId;
  host: string;
  port: number;
  username: string;
  authMethod: DeploymentAuthMethod;
  passiveMode: boolean;
  credentialSource: "secure_store";
  credentialReference: string;
  credentialsConfigured: boolean;
  credentialMasked: string;
  remoteRoot: string;
  remoteFolder: string;
  resolvedDestinationPath: string;
  connectionStatus: "Healthy" | "Warning" | "Offline";
  destinationStatus: "Valid" | "Invalid" | "Not validated";
  writableStatus: boolean | null;
  sslAvailable: boolean | null;
  lastConnectionTestAt: string | null;
  lastConnectionTestBy: string | null;
  lastConnectionTestOk: boolean;
  lastConnectionTestResult: DeploymentCheckStatus | null;
  lastConnectionTestEvidence: string | null;
  lastConnectionTestFailureReason: string | null;
  lastConnectionTestResponseMs: number | null;
  lastConnectionChecks: DeploymentCheck[];
  lastDestinationValidationAt: string | null;
  lastDestinationValidationBy: string | null;
  lastDestinationValidationOk: boolean;
  lastDestinationValidationChecks: DeploymentCheck[];
  lastSuccessfulPublish: string | null;
  deploymentVersion: number;
  publishingEnabled: boolean;
  approvalStatus: "pending" | "approved";
  approvedAt: string | null;
  approvedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface CommercialDeploymentSummary {
  productionWebsite: string;
  publishingMethod: string;
  connectionDetails: string;
  remoteDestination: string;
  connectionStatus: "Healthy" | "Warning" | "Offline";
  destinationStatus: "Valid" | "Invalid" | "Not validated";
  writable: string;
  publishingEnabled: boolean;
  overallStatus: DeploymentOverallStatus;
}

export interface CommercialDeploymentReviewPayload {
  version: 2;
  slug: string;
  profile: CommercialDeploymentProfile;
  summary: CommercialDeploymentSummary;
  methods: DeploymentMethodOption[];
  connectionChecks: DeploymentCheck[];
  destinationChecks: DeploymentCheck[];
  warnings: string[];
  blockers: string[];
  canApprove: boolean;
  canValidateDestination: boolean;
  credentialsConfigured: boolean;
  credentialMasked: string;
  publishHistory: Array<{ version: number; approvedAt: string; operator: string }>;
}

export interface CommercialDeploymentApprovalSnapshot {
  version: 2;
  slug: string;
  deploymentVersion: number;
  approvedAt: string;
  approvedBy: string;
  profile: CommercialDeploymentProfile;
  connectionChecks: DeploymentCheck[];
  destinationChecks: DeploymentCheck[];
  warnings: string[];
}

export interface CommercialDeploymentSaveInput {
  productionWebsite?: string;
  publicPath?: string;
  deploymentMethod?: DeploymentMethodId;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  authMethod?: DeploymentAuthMethod;
  passiveMode?: boolean;
  remoteRoot?: string;
  remoteFolder?: string;
}

export interface DeploymentMethodFieldSpec {
  id: string;
  label: string;
  inputType: "text" | "number" | "password" | "checkbox";
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
}

export const DEPLOYMENT_METHOD_FIELDS: Record<DeploymentMethodId, DeploymentMethodFieldSpec[]> = {
  static_html_ftp: [
    { id: "host", label: "Host", inputType: "text", required: true, placeholder: "ftp.your-host.com" },
    { id: "port", label: "Port", inputType: "number", defaultValue: 21 },
    { id: "username", label: "Username", inputType: "text", required: true },
    { id: "password", label: "Password", inputType: "password", required: true },
    { id: "remoteRoot", label: "Remote root", inputType: "text", placeholder: "/public_html" },
    { id: "remoteFolder", label: "Remote folder", inputType: "text", required: true, placeholder: "bannercross-pharmacy-sheffield" },
    { id: "passiveMode", label: "Passive mode", inputType: "checkbox", defaultValue: true },
  ],
  static_html_sftp: [
    { id: "host", label: "Host", inputType: "text", required: true, placeholder: "sftp.your-host.com" },
    { id: "port", label: "Port", inputType: "number", defaultValue: 22 },
    { id: "username", label: "Username", inputType: "text", required: true },
    { id: "password", label: "Password", inputType: "password", required: true },
    { id: "remoteRoot", label: "Remote root", inputType: "text", placeholder: "/home/account" },
    { id: "remoteFolder", label: "Remote folder", inputType: "text", required: true },
  ],
  cpanel: [
    { id: "host", label: "cPanel host", inputType: "text", required: true, placeholder: "cpanel.your-host.com" },
    { id: "port", label: "Port", inputType: "number", defaultValue: 2083 },
    { id: "username", label: "Username", inputType: "text", required: true },
    { id: "password", label: "API token or password", inputType: "password", required: true },
    { id: "remoteRoot", label: "Document root", inputType: "text", placeholder: "/public_html" },
    { id: "remoteFolder", label: "Target folder", inputType: "text", required: true },
  ],
  git: [],
  cloudflare: [],
  s3: [],
};
