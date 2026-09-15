/**
 * Live SFTP destination for locked-campaign staging publish.
 * Overlays only packaged files onto managed current/. Does not hydrate project deploy config,
 * upload sitemaps, or write the production publisher output tree.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isPlatformInfrastructureReady,
  PLATFORM_CREDENTIAL_SLUG,
  readPlatformPublishingInfrastructure,
  resolveTenantPublishDirectory,
} from "./masterAdminPlatformPublishingInfrastructureService.ts";
import { resolveDeploymentSecret } from "./masterAdminDeploymentCredentialService.ts";
import { connectManagedPublishSftpClient } from "./masterAdminCommercialPublishExecutionService.ts";
import type { StagingDestination, StagingPackageFile } from "./pharmacyLockedCampaignStagingPublishService.ts";

function posixJoin(...parts: string[]): string {
  return parts.join("/").replace(/\/+/g, "/");
}

export async function createManagedSftpStagingDestination(
  slug: string,
  stagingBaseUrl: string,
): Promise<StagingDestination> {
  if (!isPlatformInfrastructureReady()) {
    throw new Error("Shared platform infrastructure is not READY");
  }
  const infra = readPlatformPublishingInfrastructure();
  const creds = resolveDeploymentSecret(PLATFORM_CREDENTIAL_SLUG);
  if (!infra.serverHost || !creds?.username || !creds.secret) {
    throw new Error("Staging destination credentials are not configured");
  }
  const tenantRoot = resolveTenantPublishDirectory(slug).replace(/\/+$/, "");
  const currentRemote = `${tenantRoot}/current`;
  const releasesRemote = `${tenantRoot}/releases`;
  const snapshotsRemote = `${tenantRoot}/snapshots`;

  const withClient = async <T>(
    fn: (client: Awaited<ReturnType<typeof connectManagedPublishSftpClient>>) => Promise<T>,
  ): Promise<T> => {
    const client = await connectManagedPublishSftpClient(
      {
        host: infra.serverHost,
        port: infra.port,
        username: creds.username,
        password: creds.secret,
      },
      "locked-campaign-staging-publish",
    );
    try {
      return await fn(client);
    } finally {
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  };

  return {
    kind: "sftp",
    stagingBaseUrl,
    async captureCurrent(snapshotId) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pc-staging-snap-"));
      try {
        await withClient(async (client) => {
          await client.mkdir(currentRemote, true);
          try {
            await client.downloadDir(currentRemote, tmp);
          } catch {
            /* empty current is valid for first publish */
          }
          await client.mkdir(posixJoin(snapshotsRemote, snapshotId), true);
          await client.uploadDir(tmp, posixJoin(snapshotsRemote, snapshotId));
        });
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
      return snapshotId;
    },
    async writeRelease(releaseId, files) {
      await withClient(async (client) => {
        const dest = posixJoin(releasesRemote, releaseId);
        await client.mkdir(dest, true);
        for (const file of files) {
          const remote = posixJoin(dest, file.relativePath);
          await client.mkdir(path.posix.dirname(remote), true);
          await client.put(file.contents, remote);
        }
      });
    },
    async validateRelease(releaseId, files: StagingPackageFile[]) {
      await withClient(async (client) => {
        for (const file of files) {
          const remote = posixJoin(releasesRemote, releaseId, file.relativePath);
          const stat = await client.stat(remote);
          if (!stat || Number(stat.size) !== file.contents.length) {
            throw new Error(`Remote release file invalid: ${file.relativePath}`);
          }
        }
      });
    },
    async switchCurrent(_releaseId, _snapshotId, files) {
      await withClient(async (client) => {
        await client.mkdir(currentRemote, true);
        for (const file of files) {
          const remote = posixJoin(currentRemote, file.relativePath);
          await client.mkdir(path.posix.dirname(remote), true);
          await client.put(file.contents, remote);
        }
      });
    },
    async restoreSnapshot(snapshotId) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pc-staging-restore-"));
      try {
        await withClient(async (client) => {
          const snap = posixJoin(snapshotsRemote, snapshotId);
          try {
            await client.downloadDir(snap, tmp);
          } catch {
            /* empty snapshot */
          }
          const names = await client.list(currentRemote).catch(() => []);
          for (const entry of names) {
            const remote = posixJoin(currentRemote, entry.name);
            if (entry.type === "d") await client.rmdir(remote, true);
            else await client.delete(remote);
          }
          if (fs.readdirSync(tmp).length) {
            await client.uploadDir(tmp, currentRemote);
          }
        });
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    },
    async readCurrent(relativePath) {
      return withClient(async (client) => {
        const remote = posixJoin(currentRemote, relativePath);
        const exists = await client.exists(remote);
        if (!exists) return null;
        const buf = await client.get(remote);
        return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
      });
    },
    async listCurrent() {
      return withClient(async (client) => {
        const names: string[] = [];
        const walk = async (dir: string, prefix: string) => {
          const entries = await client.list(dir).catch(() => []);
          for (const entry of entries) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.type === "d") await walk(posixJoin(dir, entry.name), rel);
            else names.push(rel);
          }
        };
        await walk(currentRemote, "");
        return names.sort();
      });
    },
  };
}
