/**
 * SAME-HOST-STAGING-PUBLISH-TRANSPORT-41D
 *
 * Local-filesystem adapter for locked-campaign staging when the application
 * host and managed staging host are the same machine. Does not replace SFTP
 * for genuinely remote destinations.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readPlatformPublishingInfrastructure } from "./masterAdminPlatformPublishingInfrastructureService.ts";
import {
  createFilesystemStagingDestination,
  type StagingDestination,
} from "./pharmacyLockedCampaignStagingPublishService.ts";

export const APPROVED_STAGING_PUBLISH_ROOT = "/var/www/pharmaconnect-sites";
export const LOCAL_STAGING_TRANSPORT = "static_html_local";
export const REMOTE_STAGING_TRANSPORT = "static_html_sftp";
export const STAGING_TRANSPORT_FIXTURE_PREFIX = "_pc-41d-";

export type LockedCampaignStagingTransportKind = typeof LOCAL_STAGING_TRANSPORT | typeof REMOTE_STAGING_TRANSPORT;

export interface LockedCampaignStagingTransportResolution {
  ok: boolean;
  transport: LockedCampaignStagingTransportKind;
  blockers: string[];
  explicitlyLocal: boolean;
  sameHost: boolean;
  destinationHost: string;
  applicationHosts: string[];
  approvedRoot: string;
  tenantRoot: string | null;
}

function tenantKey(slug: string): string {
  return String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isLiveTenantSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function isFixtureSegment(slug: string): boolean {
  return new RegExp(`^${STAGING_TRANSPORT_FIXTURE_PREFIX}[a-z0-9-]+$`).test(slug);
}

export function collectApplicationHostAddresses(): string[] {
  const hosts = new Set<string>(["127.0.0.1", "::1"]);
  const nics = os.networkInterfaces();
  for (const entries of Object.values(nics)) {
    for (const entry of entries || []) {
      const addr = String(entry.address || "").trim();
      if (addr) hosts.add(addr);
    }
  }
  return [...hosts];
}

export function isSameHostAsApplication(destinationHost: string): boolean {
  const host = String(destinationHost || "").trim().toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const local = collectApplicationHostAddresses().map((addr) => addr.toLowerCase());
  return local.includes(host);
}

function realExistingPrefix(target: string): string {
  let current = path.resolve(target);
  while (current !== path.dirname(current)) {
    if (fs.existsSync(current)) return fs.realpathSync(current);
    current = path.dirname(current);
  }
  return path.resolve(current);
}

export function assertPathInsideApprovedRoot(candidate: string, approvedRoot = APPROVED_STAGING_PUBLISH_ROOT): string {
  const approved = path.resolve(approvedRoot);
  if (approved !== APPROVED_STAGING_PUBLISH_ROOT) {
    throw new Error("Publish root is not the exact approved root");
  }
  if (!fs.existsSync(approved) || !fs.statSync(approved).isDirectory()) {
    throw new Error("Approved publish root does not exist");
  }
  const approvedReal = fs.realpathSync(approved);
  const resolved = path.resolve(candidate);
  const prefix = approvedReal.endsWith(path.sep) ? approvedReal : `${approvedReal}${path.sep}`;
  if (resolved !== approvedReal && !resolved.startsWith(prefix)) {
    throw new Error("Destination escapes the approved root");
  }

  let walk = resolved;
  while (walk.startsWith(prefix) || walk === approvedReal) {
    if (fs.existsSync(walk)) {
      const stat = fs.lstatSync(walk);
      if (stat.isSymbolicLink()) {
        const target = fs.realpathSync(walk);
        if (target !== approvedReal && !target.startsWith(prefix)) {
          throw new Error("Target is a symlink outside the approved root");
        }
      }
    }
    if (walk === approvedReal) break;
    const parent = path.dirname(walk);
    if (parent === walk) break;
    walk = parent;
  }

  const existingPrefix = realExistingPrefix(resolved);
  if (existingPrefix !== approvedReal && !existingPrefix.startsWith(prefix)) {
    throw new Error("Destination escapes the approved root");
  }
  return resolved;
}

export function resolveLockedCampaignStagingTransport(
  tenantSlug: string,
  options: { fixture?: boolean } = {},
): LockedCampaignStagingTransportResolution {
  const infra = readPlatformPublishingInfrastructure();
  const destinationHost = String(infra.serverHost || "").trim();
  const applicationHosts = collectApplicationHostAddresses();
  const explicitlyLocal = infra.lockedCampaignStagingTransport === LOCAL_STAGING_TRANSPORT;
  const sameHost = isSameHostAsApplication(destinationHost);
  const approvedRoot = String(infra.globalPublishRoot || "").replace(/\/+$/, "") || APPROVED_STAGING_PUBLISH_ROOT;
  const raw = String(tenantSlug || "").trim();
  const blockers: string[] = [];
  const slug = options.fixture ? raw : tenantKey(raw);

  if (options.fixture) {
    if (!isFixtureSegment(slug)) blockers.push("Fixture segment is unsafe");
  } else if (raw !== slug || !isLiveTenantSlug(slug)) {
    blockers.push("Tenant slug is unsafe");
  }

  if (approvedRoot !== APPROVED_STAGING_PUBLISH_ROOT) {
    blockers.push("Publish root is not the exact approved root");
  }

  let tenantRoot: string | null = null;
  if (!blockers.length) {
    try {
      tenantRoot = assertPathInsideApprovedRoot(path.join(APPROVED_STAGING_PUBLISH_ROOT, slug));
    } catch (err) {
      blockers.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (!explicitlyLocal) {
    return {
      ok: true,
      transport: REMOTE_STAGING_TRANSPORT,
      blockers: [],
      explicitlyLocal,
      sameHost,
      destinationHost,
      applicationHosts,
      approvedRoot,
      tenantRoot,
    };
  }

  if (!sameHost) blockers.push("Destination host is not confirmed as local");
  if (!fs.existsSync(APPROVED_STAGING_PUBLISH_ROOT)) {
    blockers.push("Approved publish root does not exist");
  } else {
    try {
      fs.accessSync(APPROVED_STAGING_PUBLISH_ROOT, fs.constants.W_OK);
    } catch {
      blockers.push("Approved publish root is not writable");
    }
  }

  const transport: LockedCampaignStagingTransportKind = LOCAL_STAGING_TRANSPORT;
  return {
    ok: blockers.length === 0,
    transport,
    blockers,
    explicitlyLocal,
    sameHost,
    destinationHost,
    applicationHosts,
    approvedRoot,
    tenantRoot,
  };
}

export function createLocalFilesystemStagingDestination(input: {
  tenantSlug: string;
  stagingBaseUrl: string;
  fixture?: boolean;
}): StagingDestination {
  const resolved = resolveLockedCampaignStagingTransport(input.tenantSlug, { fixture: input.fixture });
  if (!resolved.ok || resolved.transport !== LOCAL_STAGING_TRANSPORT || !resolved.tenantRoot) {
    throw new Error(resolved.blockers[0] || "Local staging transport is not available");
  }
  fs.mkdirSync(resolved.tenantRoot, { recursive: true });
  assertPathInsideApprovedRoot(resolved.tenantRoot);
  const inner = createFilesystemStagingDestination(resolved.tenantRoot, input.stagingBaseUrl);
  const guardFile = (relativePath: string) => {
    if (relativePath.includes("..") || path.isAbsolute(relativePath)) {
      throw new Error("Destination escapes the approved root");
    }
    assertPathInsideApprovedRoot(path.join(resolved.tenantRoot!, relativePath));
  };
  return {
    ...inner,
    kind: "local",
    async writeRelease(releaseId, files) {
      guardFile(path.join("releases", releaseId));
      for (const file of files) guardFile(path.join("releases", releaseId, file.relativePath));
      return inner.writeRelease(releaseId, files);
    },
    async validateRelease(releaseId, files) {
      guardFile(path.join("releases", releaseId));
      return inner.validateRelease(releaseId, files);
    },
    async switchCurrent(releaseId, snapshotId, files) {
      guardFile("current");
      for (const file of files) guardFile(path.join("current", file.relativePath));
      return inner.switchCurrent(releaseId, snapshotId, files);
    },
    async restoreSnapshot(snapshotId) {
      guardFile(path.join("snapshots", snapshotId));
      return inner.restoreSnapshot(snapshotId);
    },
    async captureCurrent(snapshotId) {
      guardFile(path.join("snapshots", snapshotId));
      return inner.captureCurrent(snapshotId);
    },
  };
}
