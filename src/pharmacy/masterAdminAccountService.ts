/**
 * Master Admin Account Service V1 — customer login lifecycle via users.json + meta.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";

const requireFromApi = createRequire(path.join(WORKSPACE_ROOT, "artifacts/api-server/package.json"));

function bcrypt() {
  return requireFromApi("bcryptjs") as typeof import("bcryptjs");
}

const USERS_FILE = path.join(WORKSPACE_ROOT, "config", "users.json");
const META_PATH = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "client-meta.json");

export interface CustomerAccountCredentials {
  userId: string;
  username: string;
  requirePasswordChange: boolean;
  loginDisabled: boolean;
  generatedAt: string;
  welcomeDraftSentAt?: string;
  welcomeEmailDraft?: string;
  pendingTemporaryPassword?: string;
  lastLoginAt?: string;
  failedLoginCount: number;
}

export interface MasterAdminClientMetaExtended {
  slug: string;
  suspended: boolean;
  suspendedAt?: string;
  accountManager: string;
  passwordResetToken?: string;
  passwordResetTokenCreatedAt?: string;
  credentials?: CustomerAccountCredentials & { loginUrl?: string };
}

export type CustomerAccountStatus = "not_created" | "disabled" | "pending_first_login" | "active";

export interface CustomerAccountDetail {
  customerId: string;
  customerLogin: string | null;
  username: string | null;
  email: string | null;
  temporaryPassword: string | null;
  passwordResetToken: string | null;
  role: string | null;
  dashboardUrl: string;
  loginUrl: string;
  accountStatus: CustomerAccountStatus;
  welcomeEmailDraft: string | null;
  hasAccount: boolean;
  lastLoginAt: string | null;
  requirePasswordChange: boolean;
  loginDisabled: boolean;
}

function getMeta(slug: string): MasterAdminClientMetaExtended {
  const safe = safeAdminSlug(slug);
  const store = readMetaStore();
  return store[safe] || { slug: safe, suspended: false, accountManager: "Unassigned" };
}

interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: "admin" | "staff";
  name: string;
  createdAt: string;
  lastLoginAt?: string;
  requirePasswordChange?: boolean;
  tenantSlug?: string;
  loginDisabled?: boolean;
  failedLoginCount?: number;
}

function readUsers(): UserRecord[] {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) as UserRecord[];
  } catch {
    return [];
  }
}

function writeUsers(users: UserRecord[]): void {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function readMetaStore(): Record<string, MasterAdminClientMetaExtended> {
  if (!fs.existsSync(META_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(META_PATH, "utf8")) as Record<string, MasterAdminClientMetaExtended>;
  } catch {
    return {};
  }
}

function writeMetaStore(store: Record<string, MasterAdminClientMetaExtended>): void {
  fs.mkdirSync(path.dirname(META_PATH), { recursive: true });
  fs.writeFileSync(META_PATH, JSON.stringify(store, null, 2));
}

function saveMeta(meta: MasterAdminClientMetaExtended): MasterAdminClientMetaExtended {
  const store = readMetaStore();
  store[meta.slug] = meta;
  writeMetaStore(store);
  return meta;
}

function issuePasswordResetToken(meta: MasterAdminClientMetaExtended): string {
  const token = randomBytes(24).toString("base64url");
  meta.passwordResetToken = token;
  meta.passwordResetTokenCreatedAt = new Date().toISOString();
  return token;
}

export function clearPendingTemporaryPasswordOnLogin(username: string): void {
  const slug = findTenantSlugForUsername(username);
  if (!slug) return;
  const meta = getMeta(slug);
  if (meta.credentials?.pendingTemporaryPassword) {
    delete meta.credentials.pendingTemporaryPassword;
    saveMeta(meta);
  }
}

export function getCustomerAccountDetail(slug: string): CustomerAccountDetail {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const email = String(data.businessEmail || data.email || "").trim() || null;
  const dashboardUrl = `https://app.pharmaconnect.uk/api/pharmacy-dashboard?slug=${encodeURIComponent(safe)}`;
  const loginUrl = "https://app.pharmaconnect.uk/api/login";
  const meta = getMeta(safe);
  const summary = getCustomerAccountSummary(safe);

  if (!summary.hasAccount) {
    return {
      customerId: safe,
      customerLogin: null,
      username: null,
      email,
      temporaryPassword: null,
      passwordResetToken: null,
      role: null,
      dashboardUrl,
      loginUrl,
      accountStatus: "not_created",
      welcomeEmailDraft: null,
      hasAccount: false,
      lastLoginAt: null,
      requirePasswordChange: false,
      loginDisabled: false,
    };
  }

  const user = readUsers().find((u) => u.id === meta.credentials!.userId);
  const loginDisabled = summary.loginDisabled;
  const lastLoginAt = summary.lastLoginAt;
  const requirePasswordChange = summary.requirePasswordChange;
  const showTempPassword =
    Boolean(meta.credentials?.pendingTemporaryPassword) &&
    requirePasswordChange &&
    !lastLoginAt;

  let accountStatus: CustomerAccountStatus = "active";
  if (loginDisabled) accountStatus = "disabled";
  else if (requirePasswordChange && !lastLoginAt) accountStatus = "pending_first_login";

  return {
    customerId: safe,
    customerLogin: summary.username,
    username: summary.username,
    email,
    temporaryPassword: showTempPassword ? meta.credentials!.pendingTemporaryPassword || null : null,
    passwordResetToken: meta.passwordResetToken || null,
    role: user?.role || "staff",
    dashboardUrl,
    loginUrl,
    accountStatus,
    welcomeEmailDraft: meta.credentials?.welcomeEmailDraft || null,
    hasAccount: true,
    lastLoginAt,
    requirePasswordChange,
    loginDisabled,
  };
}

function defaultUsername(slug: string): string {
  return `${slug}@pharmaconnect.uk`;
}

function generateTempPassword(): string {
  return randomBytes(12).toString("base64url");
}

export function findTenantSlugForUsername(username: string): string | null {
  const user = readUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (user?.tenantSlug) return user.tenantSlug;
  const match = username.match(/^(.+)@pharmaconnect\.uk$/i);
  return match ? safeAdminSlug(match[1]!) : null;
}

export function isCustomerLoginBlocked(username: string): { blocked: boolean; reason?: string } {
  const slug = findTenantSlugForUsername(username);
  if (!slug) return { blocked: false };
  const meta = getMeta(slug);
  if (meta.suspended) return { blocked: true, reason: "Customer account suspended" };
  if (meta.credentials?.loginDisabled) return { blocked: true, reason: "Customer login disabled" };
  const user = readUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (user?.loginDisabled) return { blocked: true, reason: "Customer login disabled" };
  return { blocked: false };
}

export function recordFailedCustomerLogin(username: string): void {
  const users = readUsers();
  const idx = users.findIndex((u) => u.username.toLowerCase() === username.toLowerCase());
  if (idx < 0) return;
  users[idx]!.failedLoginCount = (users[idx]!.failedLoginCount || 0) + 1;
  writeUsers(users);
  const slug = findTenantSlugForUsername(username);
  if (slug) {
    const meta = getMeta(slug);
    if (meta.credentials) {
      meta.credentials.failedLoginCount = users[idx]!.failedLoginCount || 0;
      saveMeta(meta);
    }
  }
}

export async function createCustomerAccount(
  slug: string,
  operator: string,
): Promise<{ username: string; temporaryPassword: string; userId: string; requirePasswordChange: true }> {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const username = defaultUsername(safe);
  const temporaryPassword = generateTempPassword();
  const hash = await bcrypt().hash(temporaryPassword, 12);

  let users = readUsers();
  let user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (user) {
    user.passwordHash = hash;
    user.requirePasswordChange = true;
    user.loginDisabled = false;
    user.tenantSlug = safe;
    user.name = data.pharmacyName || safe;
  } else {
    user = {
      id: crypto.randomUUID(),
      username,
      passwordHash: hash,
      role: "staff",
      name: data.pharmacyName || safe,
      createdAt: new Date().toISOString(),
      requirePasswordChange: true,
      tenantSlug: safe,
      loginDisabled: false,
      failedLoginCount: 0,
    };
    users.push(user);
  }
  writeUsers(users);

  const meta = getMeta(safe);
  meta.credentials = {
    userId: user.id,
    username,
    requirePasswordChange: true,
    loginDisabled: false,
    generatedAt: new Date().toISOString(),
    loginUrl: "/api/login",
    failedLoginCount: 0,
    pendingTemporaryPassword: temporaryPassword,
  };
  issuePasswordResetToken(meta);
  saveMeta(meta);

  recordMasterAdminAudit({
    user: operator,
    slug: safe,
    action: "create_customer_account",
    status: "success",
    evidence: `Customer account created for ${username}`,
    meta: { userId: user.id, requirePasswordChange: true },
  });

  return { username, temporaryPassword, userId: user.id, requirePasswordChange: true };
}

export async function resetCustomerPassword(
  slug: string,
  operator: string,
): Promise<{ username: string; temporaryPassword: string }> {
  const safe = safeAdminSlug(slug);
  const meta = getMeta(safe);
  if (!meta.credentials?.userId) throw new Error("No customer account — create account first");
  const temporaryPassword = generateTempPassword();
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === meta.credentials!.userId);
  if (idx < 0) throw new Error("User record not found");
  users[idx]!.passwordHash = await bcrypt().hash(temporaryPassword, 12);
  users[idx]!.requirePasswordChange = true;
  writeUsers(users);
  meta.credentials.requirePasswordChange = true;
  meta.credentials.generatedAt = new Date().toISOString();
  meta.credentials.pendingTemporaryPassword = temporaryPassword;
  issuePasswordResetToken(meta);
  saveMeta(meta);
  recordMasterAdminAudit({
    user: operator,
    slug: safe,
    action: "reset_customer_password",
    status: "success",
    evidence: `Password reset for ${meta.credentials.username}`,
  });
  return { username: meta.credentials.username, temporaryPassword };
}

export function disableCustomerLogin(slug: string, operator: string): void {
  const safe = safeAdminSlug(slug);
  const meta = getMeta(safe);
  if (meta.credentials) meta.credentials.loginDisabled = true;
  saveMeta(meta);
  if (meta.credentials?.userId) {
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === meta.credentials!.userId);
    if (idx >= 0) {
      users[idx]!.loginDisabled = true;
      writeUsers(users);
    }
  }
  recordMasterAdminAudit({
    user: operator,
    slug: safe,
    action: "disable_customer_login",
    status: "success",
    evidence: "Customer login disabled",
  });
}

export function restoreCustomerLogin(slug: string, operator: string): void {
  const safe = safeAdminSlug(slug);
  const meta = getMeta(safe);
  if (meta.credentials) meta.credentials.loginDisabled = false;
  saveMeta(meta);
  if (meta.credentials?.userId) {
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === meta.credentials!.userId);
    if (idx >= 0) {
      users[idx]!.loginDisabled = false;
      writeUsers(users);
    }
  }
  recordMasterAdminAudit({
    user: operator,
    slug: safe,
    action: "restore_customer_login",
    status: "success",
    evidence: "Customer login restored",
  });
}

export function prepareWelcomeCredentialsDraft(slug: string, operator: string): { draft: string; username: string } {
  const safe = safeAdminSlug(slug);
  const meta = getMeta(safe);
  if (!meta.credentials?.username) throw new Error("No customer account");
  const data = readSetupProfile(safe);
  const draft = `Welcome to PharmaConnect\n\nPharmacy: ${data.pharmacyName}\nUsername: ${meta.credentials.username}\nLogin: https://app.pharmaconnect.uk/api/login\nDashboard: https://app.pharmaconnect.uk/api/pharmacy-dashboard?slug=${encodeURIComponent(safe)}\n\nA temporary password was issued separately and must be changed on first login.`;
  meta.credentials.welcomeDraftSentAt = new Date().toISOString();
  meta.credentials.welcomeEmailDraft = draft;
  saveMeta(meta);
  recordMasterAdminAudit({
    user: operator,
    slug: safe,
    action: "welcome_credentials_draft",
    status: "success",
    evidence: "Welcome credentials draft prepared (password not included)",
  });
  return { draft, username: meta.credentials.username };
}

export function getCustomerAccountSummary(slug: string): {
  hasAccount: boolean;
  username: string | null;
  loginDisabled: boolean;
  requirePasswordChange: boolean;
  lastLoginAt: string | null;
  failedLoginCount: number;
} {
  const meta = getMeta(slug);
  if (!meta.credentials) {
    return { hasAccount: false, username: null, loginDisabled: false, requirePasswordChange: false, lastLoginAt: null, failedLoginCount: 0 };
  }
  const user = readUsers().find((u) => u.id === meta.credentials!.userId);
  return {
    hasAccount: true,
    username: meta.credentials.username,
    loginDisabled: Boolean(meta.credentials.loginDisabled || user?.loginDisabled),
    requirePasswordChange: Boolean(meta.credentials.requirePasswordChange || user?.requirePasswordChange),
    lastLoginAt: user?.lastLoginAt || meta.credentials.lastLoginAt || null,
    failedLoginCount: user?.failedLoginCount || meta.credentials.failedLoginCount || 0,
  };
}
