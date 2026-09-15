/**
 * Business Profile Wizard V1 — guided onboarding route.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { renderProfileWizardHtml } from "../../../../src/pharmacy/pharmacyProfileWizardPage.ts";
import {
  normalizeProfileData,
  normalizeProfileDoc,
  type PharmacyProfileData,
} from "../../../../src/pharmacy/pharmacyProfileSchema.ts";
import { tenantSlugOrRespond } from "../../../../src/pharmacy/pharmacyTenantSlug.ts";

const router = Router();
const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const PROFILE_DIR = path.join(ROOT, "data", "pharmacy-profiles");

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function loadInitialProfile(slug: string): PharmacyProfileData {
  const file = path.join(PROFILE_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileDoc(slug, raw).data;
}

router.get("/pharmacy-profile-wizard", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  try {
    const data = loadInitialProfile(slug);
    const stepRaw = req.query.step;
    const stepNum = Number(Array.isArray(stepRaw) ? stepRaw[0] : stepRaw);
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(
      renderProfileWizardHtml(slug, data, Number.isFinite(stepNum) ? { initialStep: stepNum } : undefined),
    );
  } catch (err) {
    res.status(500).type("html").send(`<pre>Profile wizard error: ${esc(String(err))}</pre>`);
  }
});

export default router;
