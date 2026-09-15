import { Router, type Request, type Response } from "express";
import {
  findUserByUsername,
  verifyPassword,
  updateLastLogin,
  toSafeUser,
} from "../lib/users.js";
import { logger } from "../lib/logger.js";
import { sanitizeCampaignBuilderLoginNext } from "../../../../src/pharmacy/growthEngineCampaignBuilderRoutingService.ts";

const router = Router();

function defaultDashboardUrl(role?: string): string {
  if (role === "admin") return "/api/admin/master";
  const slug = process.env.DEFAULT_PROJECT_SLUG || "pharmaconnect";
  return `/api/pharmacy-dashboard?slug=${encodeURIComponent(slug)}`;
}

function loginPageHtml(error = "", nextUrl = defaultDashboardUrl()): string {
  const err = error
    ? `<div class="error-msg">${error.replace(/</g, "&lt;")}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sign In — PharmaConnect Growth Engine</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:#f1f5f9;min-height:100vh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;}
.card{background:#fff;border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,.10);
  padding:40px 40px 36px;width:100%;max-width:400px;}
.logo{text-align:center;margin-bottom:28px;}
.logo-mark{display:inline-flex;align-items:center;justify-content:center;
  width:52px;height:52px;border-radius:14px;background:#005EB8;
  font-size:1.6rem;margin-bottom:10px;}
.logo h1{font-size:1.18rem;font-weight:800;color:#1e293b;letter-spacing:-.02em;}
.logo p{font-size:.8rem;color:#64748b;margin-top:2px;}
label{display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:4px;}
input[type=text],input[type=password]{display:block;width:100%;padding:10px 14px;
  border:1.5px solid #e2e8f0;border-radius:8px;font-size:.95rem;
  background:#f8fafc;transition:border-color .15s;}
input:focus{outline:none;border-color:#005EB8;background:#fff;}
.field{margin-bottom:18px;}
button[type=submit]{width:100%;padding:12px;background:#005EB8;color:#fff;
  border:none;border-radius:8px;font-size:.97rem;font-weight:700;
  cursor:pointer;margin-top:4px;transition:background .15s;}
button[type=submit]:hover{background:#004a94;}
.error-msg{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;
  border-radius:8px;padding:10px 14px;font-size:.85rem;margin-bottom:16px;}
.footer{text-align:center;margin-top:20px;font-size:.78rem;color:#94a3b8;}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-mark">🔐</div>
    <h1>PharmaConnect Growth Engine</h1>
    <p>InboxingProWeb — Staff Access</p>
  </div>
  ${err}
  <form method="POST" action="/api/login">
    <input type="hidden" name="next" value="${nextUrl.replace(/"/g, "&quot;")}"/>
    <div class="field">
      <label for="username">Username</label>
      <input type="text" id="username" name="username" autocomplete="username"
        required autofocus placeholder="your username"/>
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input type="password" id="password" name="password"
        autocomplete="current-password" required placeholder="••••••••"/>
    </div>
    <button type="submit">Sign In</button>
  </form>
</div>
<div class="footer">InboxingProWeb &copy; ${new Date().getFullYear()}</div>
</body>
</html>`;
}

router.get("/login", (req: Request, res: Response) => {
  if (req.session?.userId) {
    res.redirect(defaultDashboardUrl(req.session.userRole));
    return;
  }
  const next = sanitizeCampaignBuilderLoginNext((req.query.next as string) || defaultDashboardUrl());
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(loginPageHtml("", next));
});

router.post("/login", async (req: Request, res: Response) => {
  const { username = "", password = "", next = "" } = req.body as Record<string, string>;
  const fallbackNext = sanitizeCampaignBuilderLoginNext(
    next.startsWith("/") ? next : defaultDashboardUrl(),
  );

  if (!username || !password) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(loginPageHtml("Please enter your username and password.", fallbackNext));
    return;
  }

  const user = findUserByUsername(username);
  const { isCustomerLoginBlocked, recordFailedCustomerLogin, clearPendingTemporaryPasswordOnLogin } = await import(
    "../../../../src/pharmacy/masterAdminAccountService.ts"
  );

  if (!user || !(await verifyPassword(user, password))) {
    if (username) recordFailedCustomerLogin(username);
    logger.warn({ username }, "Failed login attempt");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(loginPageHtml("Invalid username or password.", fallbackNext));
    return;
  }

  const block = isCustomerLoginBlocked(username);
  if (block.blocked) {
    logger.warn({ username, reason: block.reason }, "Blocked customer login");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(loginPageHtml(block.reason || "Login disabled.", fallbackNext));
    return;
  }

  const safeNext = sanitizeCampaignBuilderLoginNext(
    next.startsWith("/") ? next : defaultDashboardUrl(user.role),
  );

  if (user.requirePasswordChange) {
    req.session.requirePasswordChange = true;
  }

  req.session.userId   = user.id;
  req.session.username = user.username;
  req.session.userRole = user.role;
  req.session.userName = user.name;

  updateLastLogin(user.id);
  clearPendingTemporaryPasswordOnLogin(user.username);
  logger.info({ username: user.username, role: user.role }, "User logged in");

  // Always embed the internal token in the redirect URL.
  // The Replit preview pane is a cross-site iframe — Chrome drops session cookies
  // on navigation redirects in that context. Passing _t=TOKEN in the URL means
  // requireAuth accepts the request even without a session cookie, and the
  // dashboard JS uses it for all subsequent API calls too.
  const SESSION_SECRET = process.env.SESSION_SECRET;
  let redirectUrl = safeNext;
  if (SESSION_SECRET) {
    const sep = safeNext.includes("?") ? "&" : "?";
    redirectUrl = safeNext + sep + "_t=" + encodeURIComponent(SESSION_SECRET);
  }

  req.session.save((err) => {
    if (err) logger.error({ err }, "Session save failed after login");
    res.redirect(redirectUrl);
  });
});

router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.redirect("/api/login");
  });
});

router.get("/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.redirect("/api/login");
  });
});

router.get("/auth/me", (req: Request, res: Response) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({
    id:       req.session.userId,
    username: req.session.username,
    role:     req.session.userRole,
    name:     req.session.userName,
  });
});

export default router;
