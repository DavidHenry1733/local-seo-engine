/**
 * Shared managed-publish SFTP session helper.
 * Connect only — no upload, mkdir, or remote mutation.
 */
export const MANAGED_SFTP_CONNECT_ATTEMPTS = 3;
const MANAGED_SFTP_CONNECT_TIMEOUT_MS = 20_000;
const MANAGED_SFTP_CONNECT_RETRY_DELAY_MS = 750;

type SftpClientConstructor = typeof import("ssh2-sftp-client").default;
export type ManagedSftpClient = InstanceType<SftpClientConstructor>;

export interface ManagedSftpConnectConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

async function loadSftpClient(): Promise<SftpClientConstructor> {
  const mod = await import("ssh2-sftp-client");
  return mod.default;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classify retryable managed SFTP transport failures (handshake/socket/timeout).
 * Authentication and invalid-configuration errors remain hard failures.
 */
export function isRetryableManagedSftpTransportError(message: string): boolean {
  const lower = String(message || "").toLowerCase();
  if (!lower.trim()) return false;
  if (
    lower.includes("authentication") ||
    lower.includes("auth fail") ||
    lower.includes("all configured authentication methods failed") ||
    lower.includes("login incorrect") ||
    lower.includes("permission denied (publickey") ||
    lower.includes("invalid username") ||
    lower.includes("credentials not configured") ||
    lower.includes("not configured") ||
    lower.includes("enotfound") ||
    lower.includes("getaddrinfo") ||
    lower.includes("dns")
  ) {
    return false;
  }
  return (
    lower.includes("connection lost before handshake") ||
    lower.includes("econnreset") ||
    lower.includes("connection reset") ||
    lower.includes("socket hang up") ||
    lower.includes("epipe") ||
    lower.includes("econnrefused") ||
    lower.includes("etimedout") ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    (lower.includes("handshake") && (lower.includes("lost") || lower.includes("fail") || lower.includes("error")))
  );
}

/**
 * Establish a managed-publish SFTP session with bounded retries for transient
 * transport failures. Fresh client per attempt; no release/upload side effects.
 */
export async function connectManagedPublishSftpClient(
  deploy: ManagedSftpConnectConfig,
  sessionName = "commercial-publish",
): Promise<ManagedSftpClient> {
  if (!deploy.host || !deploy.username || !deploy.password) {
    throw new Error("Publishing destination or credentials not configured");
  }

  const SftpClient = await loadSftpClient();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < MANAGED_SFTP_CONNECT_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await delay(MANAGED_SFTP_CONNECT_RETRY_DELAY_MS * attempt);
    const client = new SftpClient(sessionName, {
      error: () => undefined,
      end: () => undefined,
      close: () => undefined,
    });
    try {
      await client.connect({
        host: deploy.host,
        port: deploy.port,
        username: deploy.username,
        password: deploy.password,
        readyTimeout: MANAGED_SFTP_CONNECT_TIMEOUT_MS,
      });
      return client;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      const retryable = isRetryableManagedSftpTransportError(lastError.message);
      if (!retryable || attempt === MANAGED_SFTP_CONNECT_ATTEMPTS - 1) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("SFTP connection failed");
}
