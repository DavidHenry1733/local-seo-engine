import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const USERS_FILE = path.join(WORKSPACE_ROOT, "config", "users.json");

export type UserRole = "admin" | "staff";

export interface User {
  id:           string;
  username:     string;
  passwordHash: string;
  role:         UserRole;
  name:         string;
  createdAt:    string;
  lastLoginAt?: string;
}

export interface SafeUser {
  id:           string;
  username:     string;
  role:         UserRole;
  name:         string;
  createdAt:    string;
  lastLoginAt?: string;
}

function readUsers(): User[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) as User[];
  } catch {
    logger.error("Failed to read users.json");
    return [];
  }
}

function writeUsers(users: User[]): void {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

export function toSafeUser(u: User): SafeUser {
  const { passwordHash: _ph, ...safe } = u;
  return safe;
}

export function getUsers(): User[] {
  return readUsers();
}

export function findUserByUsername(username: string): User | undefined {
  return readUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
}

export function findUserById(id: string): User | undefined {
  return readUsers().find(u => u.id === id);
}

export async function createUser(
  username: string,
  password: string,
  name: string,
  role: UserRole = "staff",
): Promise<SafeUser> {
  const users = readUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error(`Username "${username}" already exists`);
  }
  const hash = await bcrypt.hash(password, 12);
  const user: User = {
    id:           crypto.randomUUID(),
    username:     username.trim().toLowerCase(),
    passwordHash: hash,
    role,
    name:         name.trim(),
    createdAt:    new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);
  logger.info({ username: user.username, role: user.role }, "User created");
  return toSafeUser(user);
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) throw new Error("User not found");
  users[idx].passwordHash = await bcrypt.hash(newPassword, 12);
  writeUsers(users);
}

export function updateLastLogin(userId: string): void {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return;
  users[idx].lastLoginAt = new Date().toISOString();
  writeUsers(users);
}

export function deleteUser(userId: string): void {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) throw new Error("User not found");
  const deleted = users[idx];
  users.splice(idx, 1);
  writeUsers(users);
  logger.info({ username: deleted.username }, "User deleted");
}

export function updateUser(userId: string, fields: { name?: string; role?: UserRole }): SafeUser {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) throw new Error("User not found");
  if (fields.name) users[idx].name = fields.name.trim();
  if (fields.role) users[idx].role = fields.role;
  writeUsers(users);
  return toSafeUser(users[idx]);
}

export async function ensureAdminExists(): Promise<void> {
  const users = readUsers();
  if (users.length > 0) return;
  logger.info("No users found — seeding default admin account");
  await createUser("admin", "changeme123", "Administrator", "admin");
  logger.warn("Default admin created: username=admin password=changeme123 — change this immediately!");
}
