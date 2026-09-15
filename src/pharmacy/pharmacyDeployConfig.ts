/**
 * Shared FTP deploy config for pharmacy live publishing.
 * Credentials come from environment variables only — never hard-coded.
 */
import fs from "node:fs";
import path from "node:path";
import type { DeployConfig } from "../generator/types.ts";
import { PHARMACY_WORKSPACE_ROOT, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { deploymentCredentialsConfigured } from "./masterAdminDeploymentCredentialService.ts";
import { PLATFORM_CREDENTIAL_SLUG } from "./masterAdminPlatformPublishingInfrastructureService.ts";

export interface ResolvedPharmacyDeploy {
  enabled: boolean;
  protocol: "ftp" | "sftp";
  host: string;
  port: number;
  remoteRoot: string;
  username: string;
  password: string;
  domain: string;
  configured: boolean;
  credentialsPresent: boolean;
}

function readProject(slug: string): { domain?: string; deploy?: DeployConfig } {
  const key = resolveTenantProfileSlug(slug) || safePharmacySlug(slug);
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", `${key}.json`);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

export function loadPharmacyDeployConfig(slug: string): ResolvedPharmacyDeploy {
  const project = readProject(slug);
  const deploy = project.deploy;
  const username = deploy?.username || process.env.DEPLOY_USERNAME || "";
  const password = deploy?.password || process.env.DEPLOY_PASSWORD || "";
  const host = (process.env.DEPLOY_HOST || deploy?.host || "").trim();
  const enabled = Boolean(deploy?.enabled && host);
  const domain = String(project.domain || "").trim();

  const protocol: "ftp" | "sftp" =
    String(deploy?.protocol || "").trim().toLowerCase() === "sftp" ? "sftp" : "ftp";
  const managedSftpCredentialsPresent =
    protocol === "sftp" && deploymentCredentialsConfigured(PLATFORM_CREDENTIAL_SLUG);

  return {
    enabled,
    protocol,
    host,
    port: process.env.DEPLOY_PORT ? Number(process.env.DEPLOY_PORT) : deploy?.port ?? 21,
    remoteRoot: (process.env.DEPLOY_REMOTE_ROOT || deploy?.remoteRoot || "/").replace(/\/+$/, "") || "/",
    username,
    password,
    domain,
    configured: enabled,
    credentialsPresent: Boolean(username && password) || managedSftpCredentialsPresent,
  };
}

export function resolvePharmacyWebsiteBase(slug: string): string {
  const key = resolveTenantProfileSlug(slug) || safePharmacySlug(slug);
  const profileFile = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${key}.json`);
  if (fs.existsSync(profileFile)) {
    try {
      const profile = JSON.parse(fs.readFileSync(profileFile, "utf8")) as { data?: { website?: string } };
      const website = String(profile.data?.website || "").trim();
      if (website) return website.replace(/\/$/, "");
    } catch {
      /* fall through */
    }
  }
  const project = readProject(slug);
  const domain = String(project.domain || "").trim();
  if (domain) return domain.replace(/\/$/, "");
  return `https://${slug}.example.com`;
}
