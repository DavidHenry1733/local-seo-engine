/**
 * Master Admin Issue Centre V1 — JSON API.
 */
import { Router } from "express";
import { requireAdmin } from "../../middlewares/requireAuth.js";
import {
  MASTER_ADMIN_ISSUE_CATEGORIES,
  MASTER_ADMIN_ISSUE_SEVERITIES,
  MASTER_ADMIN_ISSUE_STATUSES,
  type MasterAdminIssueCreateInput,
  type MasterAdminIssueStatus,
} from "../../../../../src/pharmacy/masterAdminIssueModel.ts";
import {
  buildDiagnosticReport,
  buildDiagnosticReportPlainText,
  createMasterAdminIssue,
  generateCursorDefectBrief,
  getMasterAdminIssue,
  listMasterAdminIssueSummaries,
  refreshMasterAdminIssueDiagnostics,
  runControlledValidationIssue,
  updateMasterAdminIssueStatus,
} from "../../../../../src/pharmacy/masterAdminIssueService.ts";
import { buildMasterAdminCustomerListLite } from "../../../../../src/pharmacy/masterAdminDashboardLiteService.ts";

const router = Router();
router.use(requireAdmin);

function resolveUser(req: import("express").Request): string {
  const session = req.session as { username?: string; name?: string } | undefined;
  return session?.name || session?.username || "admin";
}

router.get("/master-admin-platform/issues/meta", (_req, res) => {
  res.json({
    ok: true,
    categories: MASTER_ADMIN_ISSUE_CATEGORIES,
    severities: MASTER_ADMIN_ISSUE_SEVERITIES,
    statuses: MASTER_ADMIN_ISSUE_STATUSES,
    customers: buildMasterAdminCustomerListLite().customers.map((c) => ({
      slug: c.slug,
      businessName: c.businessName,
    })),
  });
});

router.get("/master-admin-platform/issues", (_req, res) => {
  res.json({ ok: true, issues: listMasterAdminIssueSummaries() });
});

router.post("/master-admin-platform/issues", (req, res) => {
  try {
    const input = req.body as MasterAdminIssueCreateInput;
    const issue = createMasterAdminIssue(input, resolveUser(req));
    res.status(201).json({ ok: true, issue });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/master-admin-platform/issues/:issueId", (req, res) => {
  const issue = getMasterAdminIssue(String(req.params.issueId));
  if (!issue) return res.status(404).json({ ok: false, error: "Issue not found" });
  res.json({ ok: true, issue });
});

router.post("/master-admin-platform/issues/:issueId/diagnostics/refresh", (req, res) => {
  try {
    const issue = refreshMasterAdminIssueDiagnostics(String(req.params.issueId), resolveUser(req));
    res.json({ ok: true, issue });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/issues/:issueId/cursor-prompt", (req, res) => {
  try {
    const prompt = generateCursorDefectBrief(String(req.params.issueId), resolveUser(req));
    res.json({ ok: true, prompt, issue: getMasterAdminIssue(String(req.params.issueId)) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/master-admin-platform/issues/:issueId/diagnostic-report", (req, res) => {
  try {
    const format = String(req.query.format || "json");
    if (format === "text") {
      res.type("text/plain").send(buildDiagnosticReportPlainText(String(req.params.issueId)));
      return;
    }
    if (format === "download-json") {
      const report = buildDiagnosticReport(String(req.params.issueId));
      res.setHeader("Content-Disposition", `attachment; filename="${req.params.issueId}-diagnostic.json"`);
      res.json(report);
      return;
    }
    res.json({ ok: true, report: buildDiagnosticReport(String(req.params.issueId)) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/issues/:issueId/status", (req, res) => {
  try {
    const status = String(req.body?.status || "") as MasterAdminIssueStatus;
    const notes = String(req.body?.notes || "");
    const issue = updateMasterAdminIssueStatus(String(req.params.issueId), status, resolveUser(req), notes);
    res.json({ ok: true, issue });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/issues/validation/run", (req, res) => {
  try {
    const result = runControlledValidationIssue(resolveUser(req));
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
