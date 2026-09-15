/**
 * Sprint 8C.2 / 8C.3 — Global PharmaConnect shared publishing connection (Master Admin only).
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import {
  deploymentCredentialsConfigured,
  getDeploymentCredentialPublicView,
  resolveDeploymentSecret,
  saveDeploymentCredentials,
} from "./masterAdminDeploymentCredentialService.ts";
import {
  normalizeRemoteRoot,
  runDestinationValidation,
  runNonDestructiveConnectionTest,
  type CommercialDeploymentConnectionInput,
} from "./masterAdminCommercialDeploymentConnectionService.ts";
import type { DeploymentCheck, DeploymentCheckStatus } from "./masterAdminCommercialDeploymentModel.ts";
import type {
  PlatformConnectionStatus,
  PlatformInfrastructureCheck,
  PlatformInfrastructureReviewPayload,
  PlatformInfrastructureSaveInput,
  PlatformPublishRootStatus,
  PlatformPublishingInfrastructureProfile,
  PlatformPublishingMethod,
} from "./masterAdminPlatformPublishingInfrastructureModel.ts";

export const PLATFORM_CREDENTIAL_SLUG = "_platform";
const INFRA_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/platform-publishing");
const INFRA_FILE = path.join(INFRA_DIR, "infrastructure.json");
const INFRA_EVIDENCE_DIR = path.join(INFRA_DIR, "connection-evidence");

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function derivePlatformStatus(profile: PlatformPublishingInfrastructureProfile): PlatformConnectionStatus {
  const configured = Boolean(
    profile.serverHost &&
      profile.username &&
      profile.globalPublishRoot &&
      profile.credentialsConfigured,
  );
  if (!configured) return "NOT CONFIGURED";
  if (profile.platformStatus === "READY" && profile.publishRootStatus === "VALID") return "READY";
  if (profile.platformStatus === "CONNECTED") return "CONNECTED";
  if (profile.platformStatus === "CONNECTION FAILED") return "CONNECTION FAILED";
  if (profile.platformStatus === "NOT TESTED") return "NOT TESTED";
  return "NOT TESTED";
}

function derivePublishRootStatus(profile: PlatformPublishingInfrastructureProfile): PlatformPublishRootStatus {
  if (profile.publishRootStatus === "VALID") return "VALID";
  if (profile.publishRootStatus === "INVALID") return "INVALID";
  return "NOT VALIDATED";
}

function defaultInfrastructureProfile(): PlatformPublishingInfrastructureProfile {
  const now = new Date().toISOString();
  const creds = getDeploymentCredentialPublicView(PLATFORM_CREDENTIAL_SLUG);
  const configured = Boolean(
    (process.env.PLATFORM_PUBLISH_HOST || process.env.DEPLOY_HOST) &&
      creds.configured &&
      (process.env.PLATFORM_PUBLISH_ROOT || process.env.DEPLOY_REMOTE_ROOT),
  );
  return {
    version: 1,
    infrastructureId: "pharmaconnect-global-publishing-v1",
    publishingMethod: (process.env.PLATFORM_PUBLISH_METHOD as PlatformPublishingMethod) || "static_html_ftp",
    serverHost: String(process.env.PLATFORM_PUBLISH_HOST || process.env.DEPLOY_HOST || "").trim(),
    port: Number(process.env.PLATFORM_PUBLISH_PORT || process.env.DEPLOY_PORT || 21),
    username: creds.username || String(process.env.PLATFORM_PUBLISH_USERNAME || process.env.DEPLOY_USERNAME || "").trim(),
    credentialReference: creds.credentialReference || `secure_store:${PLATFORM_CREDENTIAL_SLUG}`,
    credentialsConfigured: creds.configured,
    credentialMasked: creds.maskedSecret,
    globalPublishRoot: String(process.env.PLATFORM_PUBLISH_ROOT || process.env.DEPLOY_REMOTE_ROOT || "/var/www/pharmaconnect-sites").trim(),
    managedSitesDomain: String(process.env.PLATFORM_MANAGED_SITES_DOMAIN || "sites.pharmaconnect.uk").trim(),
    platformStatus: configured ? "NOT TESTED" : "NOT CONFIGURED",
    publishRootStatus: "NOT VALIDATED",
    connectionStatus: "Offline",
    writableStatus: null,
    lastTestedAt: null,
    lastSuccessfulConnectionTestAt: null,
    lastSuccessfulConnectionTestBy: null,
    lastConnectionTestResponseMs: null,
    lastFailureReason: null,
    lastSuccessfulPublishAt: null,
    profileRevision: 0,
    updatedAt: now,
    updatedBy: null,
    createdAt: now,
  };
}

export function readPlatformPublishingInfrastructure(): PlatformPublishingInfrastructureProfile {
  const existing = readJson<Record<string, unknown>>(INFRA_FILE);
  const defaults = defaultInfrastructureProfile();
  if (!existing) return defaults;
  const creds = getDeploymentCredentialPublicView(PLATFORM_CREDENTIAL_SLUG);
  const merged = {
    ...defaults,
    ...existing,
    credentialsConfigured: creds.configured,
    credentialMasked: creds.maskedSecret,
    credentialReference: String(existing.credentialReference || creds.credentialReference || defaults.credentialReference),
    username: String(existing.username || creds.username || defaults.username),
    platformStatus: (existing.platformStatus as PlatformConnectionStatus) || defaults.platformStatus,
    publishRootStatus: (existing.publishRootStatus as PlatformPublishRootStatus) || "NOT VALIDATED",
    lastTestedAt: existing.lastTestedAt ? String(existing.lastTestedAt) : null,
    lastFailureReason: existing.lastFailureReason ? String(existing.lastFailureReason) : null,
    lastConnectionTestResponseMs:
      typeof existing.lastConnectionTestResponseMs === "number" ? existing.lastConnectionTestResponseMs : null,
  } as PlatformPublishingInfrastructureProfile;
  merged.platformStatus = derivePlatformStatus(merged);
  return merged;
}

function validateSaveInput(input: PlatformInfrastructureSaveInput, credentialsConfigured: boolean): string[] {
  const errors: string[] = [];
  const method = input.publishingMethod;
  if (method && method !== "static_html_ftp" && method !== "static_html_sftp") {
    errors.push("Unsupported publishing method");
  }
  if (!String(input.serverHost || "").trim()) errors.push("Host is required");
  const port = Number(input.port);
  if (!Number.isFinite(port) || port < 1 || port > 65535) errors.push("Valid port is required");
  if (!String(input.username || "").trim()) errors.push("Username is required");
  const root = String(input.globalPublishRoot || "").trim();
  if (!root) errors.push("Global publish root is required");
  if (root.includes("..")) errors.push("Unsafe global publish root path");
  try {
    normalizeRemoteRoot(root);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Invalid global publish root");
  }
  if (!credentialsConfigured && !String(input.password || "").trim()) {
    errors.push("Password is required on first save");
  }
  return errors;
}

function connectionFieldsChanged(
  current: PlatformPublishingInfrastructureProfile,
  next: PlatformInfrastructureSaveInput,
): boolean {
  return (
    String(next.serverHost ?? current.serverHost).trim() !== current.serverHost ||
    Number(next.port ?? current.port) !== current.port ||
    String(next.username ?? current.username).trim() !== current.username ||
    (next.publishingMethod || current.publishingMethod) !== current.publishingMethod ||
    String(next.globalPublishRoot ?? current.globalPublishRoot).trim() !== current.globalPublishRoot
  );
}

function invalidateConnectionValidation(profile: PlatformPublishingInfrastructureProfile): PlatformPublishingInfrastructureProfile {
  const configured = Boolean(profile.serverHost && profile.username && profile.globalPublishRoot && profile.credentialsConfigured);
  return {
    ...profile,
    platformStatus: configured ? "NOT TESTED" : "NOT CONFIGURED",
    publishRootStatus: "NOT VALIDATED",
    connectionStatus: "Offline",
    writableStatus: null,
    lastFailureReason: null,
    lastConnectionTestResponseMs: null,
  };
}

export function savePlatformConnection(
  input: PlatformInfrastructureSaveInput,
  operator: string,
): PlatformInfrastructureReviewPayload {
  const current = readPlatformPublishingInfrastructure();
  const errors = validateSaveInput(input, current.credentialsConfigured);
  if (errors.length) throw new Error(errors[0]);

  const username = String(input.username ?? current.username).trim();
  if (String(input.password || "").trim()) {
    saveDeploymentCredentials(
      PLATFORM_CREDENTIAL_SLUG,
      { username, secret: String(input.password).trim(), secretType: "password" },
      operator,
    );
  } else if (String(input.username || "").trim() && current.credentialsConfigured) {
    saveDeploymentCredentials(
      PLATFORM_CREDENTIAL_SLUG,
      { username, secretType: "password" },
      operator,
    );
  }

  let updated: PlatformPublishingInfrastructureProfile = {
    ...readPlatformPublishingInfrastructure(),
    publishingMethod: (input.publishingMethod || current.publishingMethod) as PlatformPublishingMethod,
    serverHost: String(input.serverHost ?? current.serverHost).trim(),
    port: Number(input.port ?? current.port),
    username,
    globalPublishRoot: normalizeRemoteRoot(String(input.globalPublishRoot ?? current.globalPublishRoot)),
    managedSitesDomain: String(input.managedSitesDomain ?? current.managedSitesDomain).trim().replace(/^\.+/, ""),
    profileRevision: current.profileRevision + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: operator,
  };

  if (connectionFieldsChanged(current, input)) {
    updated = invalidateConnectionValidation(updated);
  } else {
    updated.platformStatus = updated.credentialsConfigured ? derivePlatformStatus(updated) : "NOT CONFIGURED";
  }

  writeJsonAtomic(INFRA_FILE, updated);
  recordMasterAdminAudit({
    user: operator,
    slug: PLATFORM_CREDENTIAL_SLUG,
    action: "save_platform_connection",
    status: "success",
    evidence: `Shared publishing connection saved — ${updated.serverHost || "host pending"}`,
  });
  return buildPlatformInfrastructureReview();
}

export function savePlatformPublishingInfrastructure(
  input: PlatformInfrastructureSaveInput,
  operator: string,
): PlatformPublishingInfrastructureProfile {
  return savePlatformConnection(input, operator).profile;
}

export function updatePlatformInfrastructureCredentials(
  input: { username?: string; password?: string },
  operator: string,
): PlatformInfrastructureReviewPayload {
  const current = readPlatformPublishingInfrastructure();
  const username = String(input.username || current.username).trim();
  if (!username) throw new Error("Username is required");

  if (String(input.password || "").trim()) {
    saveDeploymentCredentials(
      PLATFORM_CREDENTIAL_SLUG,
      { username, secret: String(input.password).trim(), secretType: "password" },
      operator,
    );
  } else if (!current.credentialsConfigured) {
    throw new Error("Password is required");
  } else {
    saveDeploymentCredentials(PLATFORM_CREDENTIAL_SLUG, { username, secretType: "password" }, operator);
  }

  let updated = {
    ...readPlatformPublishingInfrastructure(),
    username,
    profileRevision: current.profileRevision + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: operator,
  };
  updated = invalidateConnectionValidation(updated);
  writeJsonAtomic(INFRA_FILE, updated);

  recordMasterAdminAudit({
    user: operator,
    slug: PLATFORM_CREDENTIAL_SLUG,
    action: "update_platform_credentials",
    status: "success",
    evidence: `Platform credentials updated for ${username}`,
  });
  return buildPlatformInfrastructureReview();
}

function buildConnectionInput(profile: PlatformPublishingInfrastructureProfile): CommercialDeploymentConnectionInput | null {
  const secret = resolveDeploymentSecret(PLATFORM_CREDENTIAL_SLUG);
  if (!profile.serverHost || !profile.username || !secret) return null;
  return {
    method: profile.publishingMethod,
    host: profile.serverHost,
    port: profile.port,
    username: profile.username,
    secret: secret.secret,
    secretType: secret.secretType,
    passiveMode: profile.publishingMethod === "static_html_ftp",
    remoteRoot: profile.globalPublishRoot,
    remoteFolder: "",
  };
}

type SftpClientConstructor = typeof import("ssh2-sftp-client").default;

const SFTP_CONNECT_TIMEOUT_MS = 20_000;
const SFTP_OPERATION_TIMEOUT_MS = 15_000;
const SFTP_CLOSE_TIMEOUT_MS = 5_000;
const SFTP_POST_TEST_SETTLE_MS = 2_000;

async function loadSftpClient(): Promise<SftpClientConstructor> {
  const mod = await import("ssh2-sftp-client");
  return mod.default;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withBoundedTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isRetryableSftpConnectError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("connection lost before handshake") ||
    lower.includes("econnreset") ||
    lower.includes("handshake") ||
    lower.includes("connection reset")
  );
}

function platformCheck(
  id: string,
  label: string,
  status: DeploymentCheckStatus,
  detail: string,
): DeploymentCheck {
  return { id, label, status, detail };
}

export function classifyPublishRootValidationError(message: string): string {
  const lower = message.toLowerCase();
  if (!message.trim()) return "Publish root validation failed";
  if (lower.includes("connection lost before handshake") || lower.includes("handshake")) {
    return "SFTP handshake lost — server closed the connection before validation completed";
  }
  if (lower.includes("authentication") || lower.includes("auth fail") || lower.includes("login incorrect")) {
    return "Authentication failed — check username and password";
  }
  if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("etimedout")) {
    return "Operation timed out during publish root validation";
  }
  if (lower.includes("econnrefused") || lower.includes("connection refused")) {
    return "Connection refused — host or port unreachable";
  }
  if (lower.includes("getaddrinfo") || lower.includes("enotfound") || lower.includes("dns")) {
    return "DNS failure — host could not be resolved";
  }
  if (lower.includes("permission denied") || lower.includes("permission denied")) {
    return "Permission denied — account cannot access the publish root";
  }
  if (lower.includes("no such file") || lower.includes("not found") || lower.includes("does not exist")) {
    return "Publish root directory does not exist on the remote server";
  }
  if (lower.includes("marker read") || lower.includes("read-back failed")) {
    return "Marker read failed — publish root is not readable";
  }
  if (lower.includes("marker") && lower.includes("write")) {
    return "Marker write failed — publish root is not writable";
  }
  if (lower.includes("marker") && lower.includes("cleanup")) {
    return "Marker cleanup failed — temporary validation file may remain on server";
  }
  return message.length > 180 ? `${message.slice(0, 177)}…` : message;
}

async function connectPlatformSftpSession(
  config: {
    host: string;
    port: number;
    username: string;
    password: string;
  },
): Promise<InstanceType<SftpClientConstructor>> {
  const SftpClient = await loadSftpClient();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await delay(750 * attempt);
    const client = new SftpClient("platform-publish-root", {
      error: () => undefined,
      end: () => undefined,
      close: () => undefined,
    });
    try {
      await withBoundedTimeout(
        client.connect({
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          readyTimeout: SFTP_CONNECT_TIMEOUT_MS,
        }),
        SFTP_CONNECT_TIMEOUT_MS + 2_000,
        "SFTP connection",
      );
      return client;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      try {
        await withBoundedTimeout(client.end(), SFTP_CLOSE_TIMEOUT_MS, "Session close after failed connect");
      } catch {
        /* ignore */
      }
      if (!isRetryableSftpConnectError(lastError.message) || attempt === 2) throw lastError;
    }
  }

  throw lastError ?? new Error("SFTP connection failed");
}

async function closePlatformSftpSession(client: InstanceType<SftpClientConstructor> | null): Promise<void> {
  if (!client) return;
  try {
    await withBoundedTimeout(client.end(), SFTP_CLOSE_TIMEOUT_MS, "Session close");
  } catch {
    /* ignore close errors */
  }
}

async function runPlatformSftpPublishRootValidation(
  input: CommercialDeploymentConnectionInput,
): Promise<{
  ok: boolean;
  checks: DeploymentCheck[];
  writable: boolean;
  markerCleaned: boolean;
  markerCreated: boolean;
  markerVerified: boolean;
  publishRootExists: boolean;
  failureReason: string | null;
}> {
  const checks: DeploymentCheck[] = [];
  const destinationPath = normalizeRemoteRoot(input.remoteRoot);
  const markerName = `_pharmaconnect-platform-root-${Date.now()}.txt`;
  const markerContent = "pharmaconnect platform publish root validation marker";
  const remoteMarker = `${destinationPath}/${markerName}`.replace(/\/+/g, "/");
  const localTmp = path.join("/tmp", markerName);
  const localRead = path.join("/tmp", `${markerName}.read`);

  let client: InstanceType<SftpClientConstructor> | null = null;
  let markerCreated = false;
  let markerVerified = false;
  let markerRemoved = false;
  let publishRootExists = false;

  checks.push(platformCheck("path-safe", "No path traversal", "PASS", "Target path is safe"));

  try {
    client = await connectPlatformSftpSession({
      host: input.host,
      port: input.port || 22,
      username: input.username,
      password: input.secret,
    });
    checks.push(platformCheck("connection", "SFTP session opened", "PASS", "Single validation session connected"));
    checks.push(platformCheck("authentication", "Authentication successful", "PASS", "Credentials accepted"));

    publishRootExists = Boolean(
      await withBoundedTimeout(client.exists(destinationPath), SFTP_OPERATION_TIMEOUT_MS, "Publish root lookup"),
    );
    if (!publishRootExists) {
      checks.push(
        platformCheck(
          "remote-path",
          "Remote path exists",
          "FAIL",
          `Publish root not found at ${destinationPath}`,
        ),
      );
      return {
        ok: false,
        checks,
        writable: false,
        markerCleaned: false,
        markerCreated: false,
        markerVerified: false,
        publishRootExists: false,
        failureReason: "Publish root directory does not exist on the remote server",
      };
    }
    checks.push(platformCheck("remote-path", "Remote path exists", "PASS", destinationPath));

    fs.writeFileSync(localTmp, markerContent, "utf8");
    await withBoundedTimeout(client.put(localTmp, remoteMarker), SFTP_OPERATION_TIMEOUT_MS, "Marker write");
    markerCreated = true;
    checks.push(platformCheck("marker-create", "Validation marker created", "PASS", remoteMarker));

    await withBoundedTimeout(client.fastGet(remoteMarker, localRead), SFTP_OPERATION_TIMEOUT_MS, "Marker read");
    const readBack = fs.readFileSync(localRead, "utf8");
    markerVerified = readBack === markerContent;
    checks.push(
      platformCheck(
        "marker-verify",
        "Validation marker verified",
        markerVerified ? "PASS" : "FAIL",
        markerVerified ? "Marker read-back matched" : "Marker read-back failed",
      ),
    );
    if (!markerVerified) {
      try {
        await withBoundedTimeout(client.delete(remoteMarker), SFTP_OPERATION_TIMEOUT_MS, "Marker cleanup");
        markerRemoved = true;
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        checks,
        writable: false,
        markerCleaned: markerRemoved,
        markerCreated,
        markerVerified: false,
        publishRootExists: true,
        failureReason: "Marker read failed — publish root is not readable",
      };
    }

    await withBoundedTimeout(client.delete(remoteMarker), SFTP_OPERATION_TIMEOUT_MS, "Marker delete");
    markerRemoved = true;
    checks.push(platformCheck("marker-cleanup", "Validation marker cleaned up", "PASS", "Temporary marker removed"));
    checks.push(platformCheck("writable", "Target writable", "PASS", "Validation marker verified"));
    checks.push(platformCheck("resolved-path", "Full resolved destination path", "PASS", destinationPath));

    return {
      ok: true,
      checks,
      writable: true,
      markerCleaned: true,
      markerCreated: true,
      markerVerified: true,
      publishRootExists: true,
      failureReason: null,
    };
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const operatorMessage = classifyPublishRootValidationError(rawMessage);
    if (markerCreated && client && !markerRemoved) {
      try {
        await withBoundedTimeout(client.delete(remoteMarker), SFTP_OPERATION_TIMEOUT_MS, "Marker cleanup");
        markerRemoved = true;
        checks.push(platformCheck("marker-cleanup", "Validation marker cleaned up", "PASS", "Temporary marker removed"));
      } catch (cleanupErr) {
        const cleanupMessage = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
        checks.push(
          platformCheck(
            "marker-cleanup",
            "Validation marker cleaned up",
            "FAIL",
            classifyPublishRootValidationError(cleanupMessage),
          ),
        );
      }
    }
    if (!checks.some((c) => c.id === "connection")) {
      checks.push(platformCheck("connection", "SFTP session opened", "FAIL", operatorMessage));
    }
    if (!checks.some((c) => c.id === "writable")) {
      checks.push(platformCheck("writable", "Target writable", "FAIL", operatorMessage));
    }
    return {
      ok: false,
      checks,
      writable: false,
      markerCleaned: markerRemoved,
      markerCreated,
      markerVerified,
      publishRootExists,
      failureReason: operatorMessage,
    };
  } finally {
    if (fs.existsSync(localTmp)) fs.unlinkSync(localTmp);
    if (fs.existsSync(localRead)) fs.unlinkSync(localRead);
    await closePlatformSftpSession(client);
    client = null;
  }
}

export function classifyConnectionError(message: string): string {
  const lower = message.toLowerCase();
  if (!message.trim()) return "Connection failed";
  if (lower.includes("credentials not configured") || lower.includes("password is required")) return "Missing credentials";
  if (lower.includes("getaddrinfo") || lower.includes("enotfound") || lower.includes("dns")) return "DNS failure — host could not be resolved";
  if (lower.includes("econnrefused") || lower.includes("connection refused")) return "Connection refused — host or port unreachable";
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("etimedout")) return "Connection timed out";
  if (
    lower.includes("authentication") ||
    lower.includes("530") ||
    lower.includes("login incorrect") ||
    lower.includes("auth fail")
  ) {
    return "Authentication failed — check username and password";
  }
  if (lower.includes("unsupported") || lower.includes("protocol")) return "Unsupported protocol — check publishing method";
  return message.length > 180 ? `${message.slice(0, 177)}…` : message;
}

export function isPlatformInfrastructureReady(): boolean {
  const profile = readPlatformPublishingInfrastructure();
  return derivePlatformStatus(profile) === "READY";
}

export function isPlatformInfrastructureHealthy(): boolean {
  return isPlatformInfrastructureReady();
}

export function buildPlatformInfrastructureReview(): PlatformInfrastructureReviewPayload {
  const profile = readPlatformPublishingInfrastructure();
  const platformStatus = derivePlatformStatus(profile);
  const publishRootStatus = derivePublishRootStatus(profile);
  const checks: PlatformInfrastructureCheck[] = [];

  checks.push({
    id: "credentials",
    label: "Shared credentials configured",
    status: profile.credentialsConfigured ? "PASS" : "FAIL",
    detail: profile.credentialsConfigured ? "Stored securely" : "Enter and save credentials",
  });
  checks.push({
    id: "host",
    label: "Host configured",
    status: profile.serverHost ? "PASS" : "FAIL",
    detail: profile.serverHost || "Not set",
  });
  checks.push({
    id: "publish-root",
    label: "Global publish root configured",
    status: profile.globalPublishRoot ? "PASS" : "FAIL",
    detail: profile.globalPublishRoot || "Not set",
  });
  checks.push({
    id: "connection-test",
    label: "Connection test",
    status:
      platformStatus === "CONNECTED" || platformStatus === "READY"
        ? "PASS"
        : platformStatus === "CONNECTION FAILED"
          ? "FAIL"
          : platformStatus === "NOT TESTED"
            ? "WARNING"
            : "FAIL",
    detail: profile.lastSuccessfulConnectionTestAt
      ? `Last successful test ${profile.lastSuccessfulConnectionTestAt}`
      : profile.lastTestedAt
        ? `Last tested ${profile.lastTestedAt}`
        : "Not tested yet",
  });
  checks.push({
    id: "publish-root-validation",
    label: "Publish root validation",
    status: publishRootStatus === "VALID" ? "PASS" : publishRootStatus === "INVALID" ? "FAIL" : "WARNING",
    detail:
      publishRootStatus === "VALID"
        ? "Writable and marker cleanup confirmed"
        : publishRootStatus === "INVALID"
          ? profile.lastFailureReason || "Validation failed"
          : "Not validated yet",
  });

  return {
    version: 1,
    profile,
    summary: {
      platformStatus,
      publishRootStatus,
      connectionStatus:
        platformStatus === "READY"
          ? "Ready"
          : platformStatus === "CONNECTED"
            ? "Connected"
            : platformStatus === "CONNECTION FAILED"
              ? "Connection Failed"
              : platformStatus === "NOT TESTED"
                ? "Not Tested"
                : "Not Configured",
      publishRootStatusLabel:
        publishRootStatus === "VALID"
          ? "Publish Root Valid"
          : publishRootStatus === "INVALID"
            ? "Publish Root Invalid"
            : "Not Validated",
      lastFailureReason: profile.lastFailureReason,
      lastTestedAt: profile.lastTestedAt,
      lastSuccessfulTestAt: profile.lastSuccessfulConnectionTestAt,
      credentialsConfigured: profile.credentialsConfigured,
    },
    checks,
    canTestConnection: Boolean(profile.serverHost && profile.username && profile.credentialsConfigured),
    canValidatePublishRoot: Boolean(
      profile.serverHost &&
        profile.username &&
        profile.credentialsConfigured &&
        profile.globalPublishRoot &&
        (platformStatus === "CONNECTED" || platformStatus === "READY"),
    ),
  };
}

export async function testPlatformInfrastructureConnection(operator: string): Promise<PlatformInfrastructureReviewPayload> {
  const profile = readPlatformPublishingInfrastructure();
  const stamp = new Date().toISOString();

  if (!profile.credentialsConfigured) {
    const updated = {
      ...profile,
      platformStatus: "NOT CONFIGURED" as PlatformConnectionStatus,
      lastTestedAt: stamp,
      lastFailureReason: "Missing credentials",
      updatedAt: stamp,
      updatedBy: operator,
    };
    writeJsonAtomic(INFRA_FILE, updated);
    throw new Error("Missing credentials — save the shared password before testing");
  }

  const input = buildConnectionInput(profile);
  if (!input) {
    const updated = {
      ...profile,
      platformStatus: "NOT CONFIGURED" as PlatformConnectionStatus,
      lastTestedAt: stamp,
      lastFailureReason: "Host, username, or credentials missing",
      updatedAt: stamp,
      updatedBy: operator,
    };
    writeJsonAtomic(INFRA_FILE, updated);
    throw new Error("Host, username, and credentials are required before testing");
  }

  const outcome = await runNonDestructiveConnectionTest(input);
  const failureReason = outcome.failureReason ? classifyConnectionError(outcome.failureReason) : null;

  const updated: PlatformPublishingInfrastructureProfile = {
    ...profile,
    lastTestedAt: stamp,
    lastConnectionTestResponseMs: outcome.responseMs,
    publishRootStatus: "NOT VALIDATED",
    writableStatus: null,
    updatedAt: stamp,
    updatedBy: operator,
  };

  if (outcome.ok) {
    updated.platformStatus = "CONNECTED";
    updated.connectionStatus = "Healthy";
    updated.lastSuccessfulConnectionTestAt = stamp;
    updated.lastSuccessfulConnectionTestBy = operator;
    updated.lastFailureReason = null;
  } else {
    updated.platformStatus = "CONNECTION FAILED";
    updated.connectionStatus = "Offline";
    updated.lastFailureReason = failureReason || classifyConnectionError(outcome.evidence);
  }

  writeJsonAtomic(INFRA_FILE, updated);
  writeJsonAtomic(path.join(INFRA_EVIDENCE_DIR, `${stamp.replace(/[:.]/g, "-")}.json`), {
    checks: outcome.checks,
    evidence: outcome.evidence,
    failureReason: updated.lastFailureReason,
    operator,
    stamp,
    responseMs: outcome.responseMs,
  });

  recordMasterAdminAudit({
    user: operator,
    slug: PLATFORM_CREDENTIAL_SLUG,
    action: "test_platform_infrastructure_connection",
    status: outcome.ok ? "success" : "warning",
    evidence: outcome.ok ? outcome.evidence : updated.lastFailureReason || outcome.evidence,
  });

  return buildPlatformInfrastructureReview();
}

export async function validatePlatformPublishRoot(operator: string): Promise<PlatformInfrastructureReviewPayload> {
  const profile = readPlatformPublishingInfrastructure();
  const input = buildConnectionInput(profile);
  if (!input) throw new Error("Shared publishing connection is not configured");

  const platformStatus = derivePlatformStatus(profile);
  if (platformStatus !== "CONNECTED" && platformStatus !== "READY") {
    throw new Error("Test the connection successfully before validating the publish root");
  }

  if (input.method === "static_html_sftp" && profile.lastSuccessfulConnectionTestAt) {
    const elapsedMs = Date.now() - new Date(profile.lastSuccessfulConnectionTestAt).getTime();
    if (elapsedMs >= 0 && elapsedMs < SFTP_POST_TEST_SETTLE_MS) {
      await delay(SFTP_POST_TEST_SETTLE_MS - elapsedMs);
    }
  }

  const validation =
    input.method === "static_html_sftp"
      ? await runPlatformSftpPublishRootValidation(input)
      : await runDestinationValidation({ ...input, remoteFolder: "" });
  const stamp = new Date().toISOString();
  const markerRemoved = validation.markerCleaned;
  const updated: PlatformPublishingInfrastructureProfile = {
    ...profile,
    writableStatus: validation.writable,
    publishRootStatus: validation.ok ? "VALID" : "INVALID",
    platformStatus: validation.ok ? "READY" : "CONNECTED",
    connectionStatus: validation.ok ? "Healthy" : profile.connectionStatus,
    lastTestedAt: stamp,
    lastFailureReason: validation.ok
      ? null
      : ("failureReason" in validation && validation.failureReason
          ? validation.failureReason
          : validation.checks.find((c) => c.status === "FAIL")?.detail) || "Publish root validation failed",
    updatedAt: stamp,
    updatedBy: operator,
  };

  if (validation.ok && !markerRemoved) {
    updated.publishRootStatus = "INVALID";
    updated.platformStatus = "CONNECTED";
    updated.lastFailureReason = "Validation marker was not removed cleanly";
  }

  writeJsonAtomic(INFRA_FILE, updated);

  recordMasterAdminAudit({
    user: operator,
    slug: PLATFORM_CREDENTIAL_SLUG,
    action: "validate_platform_publish_root",
    status: updated.platformStatus === "READY" ? "success" : "warning",
    evidence: updated.lastFailureReason || "Publish root validated",
  });

  return buildPlatformInfrastructureReview();
}

export function refreshPlatformInfrastructureHealth(operator: string): PlatformInfrastructureReviewPayload {
  const profile = readPlatformPublishingInfrastructure();
  writeJsonAtomic(INFRA_FILE, {
    ...profile,
    updatedAt: new Date().toISOString(),
    updatedBy: operator,
  });
  return buildPlatformInfrastructureReview();
}

export function resolveManagedHostname(slug: string): string {
  const infra = readPlatformPublishingInfrastructure();
  return `${slug}.${infra.managedSitesDomain}`;
}

export function resolveTenantPublishDirectory(slug: string): string {
  const infra = readPlatformPublishingInfrastructure();
  const root = infra.globalPublishRoot.replace(/\/+$/, "");
  return `${root}/${slug}`.replace(/\/+/g, "/");
}

export function hydratePlatformPublishingForTenant(slug: string, projectConfigPath: string): () => void {
  const infra = readPlatformPublishingInfrastructure();
  const tenantDir = resolveTenantPublishDirectory(slug);
  const remoteRoot = `${tenantDir}/current`.replace(/\/+/g, "/");
  const creds = resolveDeploymentSecret(PLATFORM_CREDENTIAL_SLUG);

  if (!fs.existsSync(projectConfigPath)) return () => undefined;
  const project = JSON.parse(fs.readFileSync(projectConfigPath, "utf8")) as { deploy?: Record<string, unknown> };
  const previous = project.deploy ? { ...project.deploy } : undefined;

  project.deploy = {
    enabled: Boolean(infra.serverHost && creds),
    protocol: infra.publishingMethod === "static_html_sftp" ? "sftp" : "ftp",
    host: infra.serverHost,
    port: infra.port,
    remoteRoot,
    username: creds?.username || infra.username,
    password: creds?.secret,
  };
  writeJsonAtomic(projectConfigPath, project);

  return () => {
    const restored = JSON.parse(fs.readFileSync(projectConfigPath, "utf8")) as { deploy?: Record<string, unknown> };
    if (previous) {
      restored.deploy = { ...previous };
      if (!("password" in (previous || {}))) delete restored.deploy?.password;
    } else if (restored.deploy) {
      delete restored.deploy.password;
    }
    writeJsonAtomic(projectConfigPath, restored);
  };
}
