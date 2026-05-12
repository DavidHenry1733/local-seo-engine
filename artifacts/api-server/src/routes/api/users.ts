import { Router, type Request, type Response } from "express";
import {
  getUsers,
  findUserById,
  createUser,
  updateUser,
  updatePassword,
  deleteUser,
  toSafeUser,
  type UserRole,
} from "../../lib/users.js";
import { requireAdmin } from "../../middlewares/requireAuth.js";

const router = Router();

router.get("/users", requireAdmin, (_req: Request, res: Response) => {
  const users = getUsers().map(toSafeUser);
  res.json({ users });
});

router.post("/users", requireAdmin, async (req: Request, res: Response) => {
  const { username, password, name, role = "staff" } = req.body as {
    username?: string; password?: string; name?: string; role?: string;
  };

  if (!username || !password || !name) {
    res.status(400).json({ error: "username, password, and name are required" });
    return;
  }
  if (!["admin", "staff"].includes(role)) {
    res.status(400).json({ error: "role must be admin or staff" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const user = await createUser(username, password, name, role as UserRole);
    res.status(201).json({ user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create user";
    res.status(409).json({ error: msg });
  }
});

router.patch("/users/:id", requireAdmin, async (req: Request, res: Response) => {
  const id= Array.isArray(req.params.id)
  ? req.params.id[0]
  : req.params.id;


if (!id) {
  res.status(400).json({ error: "Invalid user id" });
  return;
}
  const { name, role, password } = req.body as {
    name?: string; role?: string; password?: string;
  };

  const existing = findUserById(id);
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const adminCount = getUsers().filter(u => u.role === "admin").length;
  if (existing.role === "admin" && role === "staff" && adminCount === 1) {
    res.status(400).json({ error: "Cannot demote the last admin account" });
    return;
  }

  try {
    if (password) {
      if (password.length < 8) {
        res.status(400).json({ error: "Password must be at least 8 characters" });
        return;
      }
      await updatePassword(id, password);
    }

    const fields: { name?: string; role?: UserRole } = {};
    if (name) fields.name = name;
    if (role && ["admin", "staff"].includes(role)) fields.role = role as UserRole;

    const user = updateUser(id, fields);
    res.json({ user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update user";
    res.status(400).json({ error: msg });
  }
});

router.delete("/users/:id", requireAdmin, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  if (!id) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }



  const existing = findUserById(id);
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const adminCount = getUsers().filter(u => u.role === "admin").length;
  if (existing.role === "admin" && adminCount === 1) {
    res.status(400).json({ error: "Cannot delete the last admin account" });
    return;
  }

  if (existing.id === req.session?.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  try {
    deleteUser(id);
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete user";
    res.status(400).json({ error: msg });
  }
});

export default router;
