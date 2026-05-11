import type { Request, Response, NextFunction } from "express";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-fallback-secret-change-in-prod";

export function hasValidInternalToken(req: Request): boolean {
  const authHeader = req.headers["authorization"] as string | undefined;
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const headerToken = (req.headers["x-internal-token"] as string | undefined) ?? bearer;
  // Also accept token via query param — the Replit proxy strips custom headers
  // but does not modify URL query parameters, so this is the reliable channel
  // for dashboard JavaScript fetch() calls inside a cross-site iframe context.
  const queryToken = req.query._t as string | undefined;
  const token = headerToken ?? queryToken;
  return !!token && token === SESSION_SECRET;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId || hasValidInternalToken(req)) {
    next();
    return;
  }

  // Fetch/XHR calls must get a JSON 401 — not an HTML redirect — so the
  // dashboard can detect session expiry and show a human-readable message.
  const wantsJson = req.headers["accept"]?.includes("application/json")
    || req.headers["x-requested-with"] === "XMLHttpRequest"
    || req.headers["content-type"]?.includes("application/json");

  if (!wantsJson && req.accepts("html") && !req.path.startsWith("/api/auth")) {
    res.redirect(`/api/login?next=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  res.status(401).json({ error: "Session expired. Please refresh the page and log in again." });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const hasToken = hasValidInternalToken(req);
  if (!req.session?.userId && !hasToken) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!hasToken && req.session?.userRole !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
