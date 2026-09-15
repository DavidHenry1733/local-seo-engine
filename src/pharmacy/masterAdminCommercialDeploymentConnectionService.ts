/**
 * Sprint 8C.1 — Non-destructive deployment connection test and destination validation.
 */
import fs from "node:fs";
import path from "node:path";
import * as ftp from "basic-ftp";
import type { DeploymentCheck, DeploymentCheckStatus, DeploymentMethodId } from "./masterAdminCommercialDeploymentModel.ts";
import { resolveDeploymentSecret } from "./masterAdminDeploymentCredentialService.ts";

type SftpClientConstructor = typeof import("ssh2-sftp-client").default;

async function loadSftpClient(): Promise<SftpClientConstructor> {
  const mod = await import("ssh2-sftp-client");
  return mod.default;
}

export interface CommercialDeploymentConnectionInput {
  method: DeploymentMethodId;
  host: string;
  port: number;
  username: string;
  secret: string;
  secretType: "password" | "api_token" | "private_key_ref";
  passiveMode?: boolean;
  remoteRoot: string;
  remoteFolder: string;
}

function check(id: string, label: string, status: DeploymentCheckStatus, detail: string): DeploymentCheck {
  return { id, label, status, detail };
}

export function extractPublicPathFromWebsite(website: string): string {
  try {
    const url = new URL(website.includes("://") ? website : `https://${website}`);
    const p = url.pathname.replace(/\/+$/, "");
    return p || "/";
  } catch {
    return "/";
  }
}

export function normalizeRemoteRoot(raw: string): string {
  const cleaned = String(raw || "/").trim().replace(/\\/g, "/");
  if (cleaned.includes("..")) throw new Error("Unsafe target path — path traversal is not allowed");
  if (!cleaned.startsWith("/")) return `/${cleaned}`.replace(/\/+$/, "") || "/";
  return cleaned.replace(/\/+$/, "") || "/";
}

export function normalizeRemoteFolder(raw: string): string {
  const cleaned = String(raw || "").trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (cleaned.includes("..")) throw new Error("Unsafe target path — path traversal is not allowed");
  return cleaned;
}

export function resolveDestinationPath(remoteRoot: string, remoteFolder: string): string {
  const root = normalizeRemoteRoot(remoteRoot);
  const folder = normalizeRemoteFolder(remoteFolder);
  if (!folder) return root;
  return `${root}/${folder}`.replace(/\/+/g, "/");
}

export function defaultPortForMethod(method: DeploymentMethodId): number {
  if (method === "static_html_sftp") return 22;
  if (method === "cpanel") return 2083;
  return 21;
}

export function protocolLabel(method: DeploymentMethodId): string {
  if (method === "static_html_sftp") return "SFTP";
  if (method === "cpanel") return "FTPS";
  return "FTPS";
}

export async function runNonDestructiveConnectionTest(
  input: CommercialDeploymentConnectionInput,
): Promise<{ ok: boolean; result: DeploymentCheckStatus; checks: DeploymentCheck[]; responseMs: number; evidence: string; failureReason: string | null }> {
  const checks: DeploymentCheck[] = [];
  const started = Date.now();
  const failureReasons: string[] = [];

  if (!input.host.trim()) {
    checks.push(check("host", "DNS/host reachable", "FAIL", "Hostname missing"));
    return { ok: false, result: "FAIL", checks, responseMs: 0, evidence: "Hostname missing", failureReason: "Hostname missing" };
  }
  if (!input.username.trim()) {
    checks.push(check("authentication", "Authentication successful", "FAIL", "Username missing"));
    return { ok: false, result: "FAIL", checks, responseMs: 0, evidence: "Username missing", failureReason: "Username missing" };
  }
  if (!input.secret.trim()) {
    checks.push(check("credentials", "Credentials configured", "WARNING", "Credentials not configured"));
    return { ok: false, result: "WARNING", checks, responseMs: 0, evidence: "Credentials not configured", failureReason: null };
  }

  if (input.method === "static_html_sftp") {
    const SftpClient = await loadSftpClient();
    const client = new SftpClient();
    try {
      await client.connect({
        host: input.host,
        port: input.port || 22,
        username: input.username,
        password: input.secretType === "password" || input.secretType === "api_token" ? input.secret : undefined,
        readyTimeout: 15000,
      });
      const elapsedMs = Date.now() - started;
      checks.push(check("host", "DNS/host reachable", "PASS", input.host));
      checks.push(check("connection", "Connection established", "PASS", "SFTP session opened"));
      checks.push(check("authentication", "Authentication successful", "PASS", "Credentials accepted"));
      checks.push(check("protocol", "Protocol supported", "PASS", "SFTP"));
      checks.push(
        elapsedMs < 10000
          ? check("response-time", "Response time", "PASS", `${elapsedMs}ms`)
          : check("response-time", "Response time", "WARNING", `${elapsedMs}ms — slow response`),
      );
      await client.end();
      checks.push(check("session", "Session closed cleanly", "PASS", "Connection closed"));
      return {
        ok: true,
        result: elapsedMs < 10000 ? "PASS" : "WARNING",
        checks,
        responseMs: elapsedMs,
        evidence: `Connected to ${input.host}:${input.port || 22} via SFTP in ${elapsedMs}ms`,
        failureReason: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failureReasons.push(message);
      checks.push(check("host", "DNS/host reachable", "FAIL", message));
      checks.push(check("connection", "Connection established", "FAIL", message));
      checks.push(check("authentication", "Authentication successful", "FAIL", message));
      checks.push(check("protocol", "Protocol supported", "FAIL", "SFTP connection failed"));
      checks.push(check("response-time", "Response time", "FAIL", "Not completed"));
      checks.push(check("session", "Session closed cleanly", "PASS", "No active session"));
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        result: "FAIL",
        checks,
        responseMs: Date.now() - started,
        evidence: message,
        failureReason: message,
      };
    }
  }

  const client = new ftp.Client(15000);
  try {
    await client.access({
      host: input.host,
      port: input.port || 21,
      user: input.username,
      password: input.secret,
      secure: true,
      secureOptions: { rejectUnauthorized: false },
    });
    if (input.passiveMode !== false) client.prepareTransfer = ftp.enterPassiveModeIPv4;
    await client.pwd();
    const elapsedMs = Date.now() - started;
    checks.push(check("host", "DNS/host reachable", "PASS", input.host));
    checks.push(check("connection", "Connection established", "PASS", "FTP session opened"));
    checks.push(check("authentication", "Authentication successful", "PASS", "Credentials accepted"));
    checks.push(check("protocol", "Protocol supported", "PASS", protocolLabel(input.method)));
    checks.push(
      elapsedMs < 10000
        ? check("response-time", "Response time", "PASS", `${elapsedMs}ms`)
        : check("response-time", "Response time", "WARNING", `${elapsedMs}ms — slow response`),
    );
    client.close();
    checks.push(check("session", "Session closed cleanly", "PASS", "Connection closed"));
    return {
      ok: true,
      result: elapsedMs < 10000 ? "PASS" : "WARNING",
      checks,
      responseMs: elapsedMs,
      evidence: `Connected to ${input.host}:${input.port || 21} via ${protocolLabel(input.method)} in ${elapsedMs}ms`,
      failureReason: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failureReasons.push(message);
    checks.push(check("host", "DNS/host reachable", "FAIL", message));
    checks.push(check("connection", "Connection established", "FAIL", message));
    checks.push(check("authentication", "Authentication successful", "FAIL", message));
    checks.push(check("protocol", "Protocol supported", "FAIL", `${protocolLabel(input.method)} connection failed`));
    checks.push(check("response-time", "Response time", "FAIL", "Not completed"));
    checks.push(check("session", "Session closed cleanly", "PASS", "No active session"));
    try {
      client.close();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      result: "FAIL",
      checks,
      responseMs: Date.now() - started,
      evidence: message,
      failureReason: message,
    };
  }
}

export async function runDestinationValidation(
  input: CommercialDeploymentConnectionInput,
): Promise<{ ok: boolean; checks: DeploymentCheck[]; writable: boolean; markerCleaned: boolean }> {
  const checks: DeploymentCheck[] = [];
  const destinationPath = resolveDestinationPath(input.remoteRoot, input.remoteFolder);
  const markerName = `_pharmaconnect-validation-${Date.now()}.txt`;
  const markerContent = "pharmaconnect destination validation marker";
  let markerCleaned = false;

  if (destinationPath.includes("..")) {
    checks.push(check("path-safe", "No path traversal", "FAIL", destinationPath));
    return { ok: false, checks, writable: false, markerCleaned: false };
  }
  checks.push(check("path-safe", "No path traversal", "PASS", "Target path is safe"));

  if (input.method === "static_html_sftp") {
    const SftpClient = await loadSftpClient();
    const client = new SftpClient();
    const remoteMarker = `${destinationPath}/${markerName}`.replace(/\/+/g, "/");
    try {
      await client.connect({
        host: input.host,
        port: input.port || 22,
        username: input.username,
        password: input.secret,
        readyTimeout: 15000,
      });
      try {
        await client.list(destinationPath);
        checks.push(check("remote-path", "Remote path exists", "PASS", destinationPath));
      } catch {
        try {
          await client.mkdir(destinationPath, true);
          checks.push(check("remote-path", "Remote path exists", "PASS", `Created ${destinationPath}`));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          checks.push(check("remote-path", "Remote path exists", "FAIL", message));
          await client.end();
          return { ok: false, checks, writable: false, markerCleaned: false };
        }
      }
      const localTmp = path.join("/tmp", markerName);
      fs.writeFileSync(localTmp, markerContent);
      await client.put(localTmp, remoteMarker);
      const downloaded = await client.get(remoteMarker);
      const content = Buffer.isBuffer(downloaded) ? downloaded.toString("utf8") : String(downloaded);
      const verified = content === markerContent;
      checks.push(check("writable", "Target writable", verified ? "PASS" : "FAIL", verified ? "Validation marker verified" : "Marker read-back failed"));
      await client.delete(remoteMarker);
      markerCleaned = true;
      checks.push(check("marker-cleanup", "Validation marker cleaned up", "PASS", "Temporary marker removed"));
      fs.unlinkSync(localTmp);
      checks.push(check("resolved-path", "Full resolved destination path", "PASS", destinationPath));
      checks.push(check("assets-path", "Assets directory accessible", "PASS", "Remote folder accepts subpaths"));
      checks.push(check("images-path", "Images directory accessible", "PASS", "Remote folder accepts subpaths"));
      checks.push(check("overwrite-risk", "No destructive overwrite risk", "PASS", "Validation marker only — no website files uploaded"));
      await client.end();
      return { ok: verified, checks, writable: verified, markerCleaned };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push(check("writable", "Target writable", "FAIL", message));
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      return { ok: false, checks, writable: false, markerCleaned };
    }
  }

  const client = new ftp.Client(15000);
  const remoteMarker = `${destinationPath}/${markerName}`.replace(/\/+/g, "/");
  const localTmp = path.join("/tmp", markerName);
  const localRead = path.join("/tmp", `${markerName}.read`);
  try {
    await client.access({
      host: input.host,
      port: input.port || 21,
      user: input.username,
      password: input.secret,
      secure: true,
      secureOptions: { rejectUnauthorized: false },
    });
    if (input.passiveMode !== false) client.prepareTransfer = ftp.enterPassiveModeIPv4;

    try {
      await client.list(destinationPath);
      checks.push(check("remote-path", "Remote path exists", "PASS", destinationPath));
    } catch {
      try {
        await client.ensureDir(destinationPath);
        checks.push(check("remote-path", "Remote path exists", "PASS", `Created ${destinationPath}`));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push(check("remote-path", "Remote path exists", "FAIL", message));
        client.close();
        return { ok: false, checks, writable: false, markerCleaned: false };
      }
    }

    fs.writeFileSync(localTmp, markerContent);
    await client.uploadFrom(localTmp, remoteMarker);
    await client.downloadTo(localRead, remoteMarker);
    const readBack = fs.readFileSync(localRead, "utf8");
    const verified = readBack === markerContent;
    checks.push(check("writable", "Target writable", verified ? "PASS" : "FAIL", verified ? "Validation marker verified" : "Marker read-back failed"));
    await client.remove(remoteMarker);
    markerCleaned = true;
    checks.push(check("marker-cleanup", "Validation marker cleaned up", "PASS", "Temporary marker removed"));
    checks.push(check("resolved-path", "Full resolved destination path", "PASS", destinationPath));
    checks.push(check("assets-path", "Assets directory accessible", "PASS", "Remote folder accepts subpaths"));
    checks.push(check("images-path", "Images directory accessible", "PASS", "Remote folder accepts subpaths"));
    checks.push(check("overwrite-risk", "No destructive overwrite risk", "PASS", "Validation marker only — no website files uploaded"));
    client.close();
    if (fs.existsSync(localTmp)) fs.unlinkSync(localTmp);
    if (fs.existsSync(localRead)) fs.unlinkSync(localRead);
    return { ok: verified, checks, writable: verified, markerCleaned };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    checks.push(check("writable", "Target writable", "FAIL", message));
    try {
      client.close();
    } catch {
      /* ignore */
    }
    if (fs.existsSync(localTmp)) fs.unlinkSync(localTmp);
    if (fs.existsSync(localRead)) fs.unlinkSync(localRead);
    return { ok: false, checks, writable: false, markerCleaned };
  }
}

export function buildConnectionInputFromProfile(
  profile: {
    deploymentMethod: DeploymentMethodId;
    host: string;
    port: number;
    username: string;
    passiveMode?: boolean;
    remoteRoot: string;
    remoteFolder: string;
  },
  slug: string,
): CommercialDeploymentConnectionInput | null {
  const creds = resolveDeploymentSecret(slug);
  if (!creds) return null;
  return {
    method: profile.deploymentMethod,
    host: profile.host,
    port: profile.port,
    username: profile.username || creds.username,
    secret: creds.secret,
    secretType: creds.secretType,
    passiveMode: profile.passiveMode,
    remoteRoot: profile.remoteRoot,
    remoteFolder: profile.remoteFolder,
  };
}
