/**
 * Sprint 8C.1 — Encrypted deployment credentials (single secrets store for commercial deployment).
 */
import fs from "node:fs";
import path from "node:path";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";

const CREDENTIAL_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/deployment-credentials");
const KEY_FILE = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/.deployment-secrets-key");
const ALGO = "aes-256-gcm";

export type DeploymentSecretType = "password" | "api_token" | "private_key_ref";

export interface DeploymentCredentialRecord {
  version: 1;
  slug: string;
  username: string;
  secretType: DeploymentSecretType;
  secret: {
    iv: string;
    tag: string;
    ciphertext: string;
  };
  updatedAt: string;
  updatedBy: string;
}

export interface DeploymentCredentialPublicView {
  configured: boolean;
  username: string;
  secretType: DeploymentSecretType;
  maskedSecret: string;
  credentialReference: string;
  updatedAt: string | null;
}

function credentialPath(slug: string): string {
  return path.join(CREDENTIAL_DIR, `${slug}.secrets.json`);
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    /* non-fatal */
  }
}

function resolveSecretsKey(): Buffer {
  const envKey = process.env.MASTER_ADMIN_SECRETS_KEY?.trim();
  if (envKey) return scryptSync(envKey, "pharmaconnect-deployment", 32);
  if (fs.existsSync(KEY_FILE)) {
    const raw = fs.readFileSync(KEY_FILE, "utf8").trim();
    return scryptSync(raw, "pharmaconnect-deployment", 32);
  }
  const generated = randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, generated, { mode: 0o600 });
  return scryptSync(generated, "pharmaconnect-deployment", 32);
}

function encryptSecret(plaintext: string): DeploymentCredentialRecord["secret"] {
  const key = resolveSecretsKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
}

function decryptSecret(payload: DeploymentCredentialRecord["secret"]): string {
  const key = resolveSecretsKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}${"•".repeat(Math.min(8, value.length - 2))}`;
}

export function readDeploymentCredentialRecord(slug: string): DeploymentCredentialRecord | null {
  const file = credentialPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as DeploymentCredentialRecord;
  } catch {
    return null;
  }
}

export function getDeploymentCredentialPublicView(slug: string): DeploymentCredentialPublicView {
  const record = readDeploymentCredentialRecord(slug);
  if (!record) {
    return {
      configured: false,
      username: "",
      secretType: "password",
      maskedSecret: "",
      credentialReference: "",
      updatedAt: null,
    };
  }
  return {
    configured: true,
    username: record.username,
    secretType: record.secretType,
    maskedSecret: "••••••••",
    credentialReference: `secure_store:${slug}`,
    updatedAt: record.updatedAt,
  };
}

export function deploymentCredentialsConfigured(slug: string): boolean {
  const record = readDeploymentCredentialRecord(slug);
  return Boolean(record?.username && record?.secret?.ciphertext);
}

export function resolveDeploymentSecret(slug: string): { username: string; secret: string; secretType: DeploymentSecretType } | null {
  const record = readDeploymentCredentialRecord(slug);
  if (!record?.secret?.ciphertext) return null;
  try {
    return {
      username: record.username,
      secret: decryptSecret(record.secret),
      secretType: record.secretType,
    };
  } catch {
    return null;
  }
}

export function saveDeploymentCredentials(
  slug: string,
  input: {
    username: string;
    secret?: string;
    secretType?: DeploymentSecretType;
  },
  operator: string,
): DeploymentCredentialPublicView {
  const username = String(input.username || "").trim();
  if (!username) throw new Error("Username is required");

  const existing = readDeploymentCredentialRecord(slug);
  const secretType = input.secretType || existing?.secretType || "password";
  let secretPayload = existing?.secret;

  if (input.secret && input.secret.trim()) {
    secretPayload = encryptSecret(input.secret.trim());
  }
  if (!secretPayload) throw new Error("Credentials are required");

  const record: DeploymentCredentialRecord = {
    version: 1,
    slug,
    username,
    secretType,
    secret: secretPayload,
    updatedAt: new Date().toISOString(),
    updatedBy: operator,
  };
  writeJsonAtomic(credentialPath(slug), record);

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: input.secret ? "update_deployment_credentials" : "save_deployment_credentials",
    status: "success",
    evidence: `Deployment credentials stored for ${username}`,
  });

  return getDeploymentCredentialPublicView(slug);
}

export function hydrateProjectDeployCredentials(slug: string, projectConfigPath: string): () => void {
  const creds = resolveDeploymentSecret(slug);
  if (!creds) return () => undefined;
  if (!fs.existsSync(projectConfigPath)) return () => undefined;

  const project = JSON.parse(fs.readFileSync(projectConfigPath, "utf8")) as {
    deploy?: Record<string, unknown>;
  };
  const previous = project.deploy ? { ...project.deploy } : undefined;
  project.deploy = {
    ...(project.deploy || {}),
    username: creds.username,
    password: creds.secret,
  };
  writeJsonAtomic(projectConfigPath, project);

  return () => {
    const restored = JSON.parse(fs.readFileSync(projectConfigPath, "utf8")) as {
      deploy?: Record<string, unknown>;
    };
    if (previous) {
      restored.deploy = { ...previous };
      if (!("password" in (previous || {}))) delete restored.deploy?.password;
    } else if (restored.deploy) {
      delete restored.deploy.password;
    }
    writeJsonAtomic(projectConfigPath, restored);
  };
}
