import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CreateProjectBody, ProjectConfig } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const PROJECTS_DIR = path.join(WORKSPACE_ROOT, "config", "projects");

const router = Router();

router.get("/projects", (_req, res) => {
  if (!fs.existsSync(PROJECTS_DIR)) {
    res.json({ projects: [] });
    return;
  }

  const files = fs
    .readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith(".json"));

  const projects = files.map((file) => {
    try {
      const raw = fs.readFileSync(path.join(PROJECTS_DIR, file), "utf8");
      const cfg = JSON.parse(raw) as ProjectConfig;
      return {
        clientSlug: cfg.clientSlug,
        businessName: cfg.businessName,
        domain: cfg.domain,
        servicesCount: cfg.services?.length ?? 0,
        file,
      };
    } catch {
      return null;
    }
  });

  res.json({ projects: projects.filter(Boolean) });
});

router.get("/projects/:slug", (req, res) => {
  const { slug } = req.params;
  const filePath = path.join(PROJECTS_DIR, `${slug}.json`);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: `Project not found: ${slug}` });
    return;
  }

  try {
    const cfg = JSON.parse(fs.readFileSync(filePath, "utf8")) as ProjectConfig;
    res.json({ project: cfg });
  } catch (err) {
    res.status(500).json({ error: "Failed to parse project config" });
  }
});

router.post("/projects", (req, res) => {
  const body = req.body as CreateProjectBody;

  if (!body.clientSlug || !/^[a-z0-9-]+$/.test(body.clientSlug)) {
    res.status(400).json({
      error: "clientSlug must be lowercase alphanumeric with hyphens only",
    });
    return;
  }

  if (!body.domain?.startsWith("https://")) {
    res.status(400).json({ error: "domain must start with https://" });
    return;
  }

  if (!body.businessName || !body.phone || !body.email) {
    res.status(400).json({
      error: "businessName, phone and email are required",
    });
    return;
  }

  // Preserve existing project data (don't overwrite fields not in the form)
  let existing: Partial<ProjectConfig> = {};
  const existingPath = path.join(PROJECTS_DIR, `${body.clientSlug}.json`);
  if (fs.existsSync(existingPath)) {
    try { existing = JSON.parse(fs.readFileSync(existingPath, "utf8")); } catch { /* ignore */ }
  }

  const project: ProjectConfig = {
    ...existing,
    clientSlug: body.clientSlug,
    businessName: body.businessName,
    legalName: body.legalName,
    companyNumber: body.companyNumber,
    domain: body.domain,
    phone: body.phone,
    email: body.email,
    primaryCtaText: body.primaryCtaText || "Request a Quote",
    primaryCtaUrl: body.primaryCtaUrl || `${body.domain}/contact/`,
    businessAddress: body.businessAddress || "",
    logoUrl: body.logoUrl,
    skipLogo: body.skipLogo ?? false,
    strapline: body.strapline ?? existing.strapline,
    brandColour: body.brandColour ?? existing.brandColour ?? "#000000",
    privacyUrl: body.privacyUrl || undefined,
    termsUrl: body.termsUrl || undefined,
    footerCompanyName: body.footerCompanyName,
    footerCompanyNumber: body.footerCompanyNumber,
    footerStrapline: body.footerStrapline ?? existing.footerStrapline,
    footerLinks: body.footerLinks ?? existing.footerLinks ?? [],
    footerServiceLinks: body.footerServiceLinks ?? existing.footerServiceLinks ?? [],
    navItems: body.navItems ?? existing.navItems ?? [],
    branding: body.branding ?? existing.branding ?? { primaryColor: "#005EB8", accentColor: "#1CA9C9" },
    services: existing.services ?? [],
    locations: existing.locations ?? [],
    deploy: {
      enabled: !!body.deploy?.host,
      protocol: "ftp",
      host: body.deploy?.host ?? "",
      port: body.deploy?.port ?? 21,
      remoteRoot: body.deploy?.remoteRoot ?? "/",
      username: body.deploy?.username || undefined,
      password: body.deploy?.password || undefined,
    },
    // Extended profile fields
    templateId:         body.templateId         ?? existing.templateId ?? "inboxingproweb_default",
    businessType:       body.businessType       ?? existing.businessType,
    mainService:        body.mainService        ?? existing.mainService,
    additionalServices: body.additionalServices ?? existing.additionalServices ?? [],
    primaryLocation:    body.primaryLocation    ?? existing.primaryLocation,
    serviceAreas:       body.serviceAreas       ?? existing.serviceAreas ?? [],
    toneOfVoice:        body.toneOfVoice        ?? existing.toneOfVoice,
    description:        body.description        ?? existing.description,
    brandStyle:         body.brandStyle         ?? existing.brandStyle,
    fontPreference:     body.fontPreference      ?? existing.fontPreference,
    brandNotes:         body.brandNotes         ?? existing.brandNotes,
    imageMode:          (body.imageMode as ProjectConfig["imageMode"]) ?? existing.imageMode,
    integrations: {
      ...(existing.integrations ?? {}),
      ...(body.integrations ?? {}),
    },
  };

  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }

  const filePath = path.join(PROJECTS_DIR, `${project.clientSlug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(project, null, 2));

  req.log.info(
    {
      clientSlug:       project.clientSlug,
      businessName:     project.businessName,
      domain:           project.domain,
      logoUrl:          project.logoUrl,
      navItemsCount:    project.navItems?.length    ?? 0,
      footerLinksCount: project.footerLinks?.length ?? 0,
      footerSvcCount:   project.footerServiceLinks?.length ?? 0,
      savedAt:          new Date().toISOString(),
    },
    "Business profile saved"
  );

  res.status(201).json({ project, path: filePath });
});

// ── Quick-create stub for a new client (minimal data, wizard completes the rest)
router.post("/projects/stub", (req, res) => {
  const { businessName, domain, primaryLocation } = req.body as {
    businessName?: string; domain?: string; primaryLocation?: string;
  };

  if (!businessName?.trim()) {
    res.status(400).json({ error: "businessName is required" });
    return;
  }

  const slug = businessName.trim().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    res.status(400).json({ error: "Could not generate a valid project ID from that name" });
    return;
  }

  const filePath = path.join(PROJECTS_DIR, `${slug}.json`);
  if (fs.existsSync(filePath)) {
    res.status(409).json({ error: `A project with ID "${slug}" already exists. Choose a different name.` });
    return;
  }

  const rawDomain = (domain ?? "").trim();
  const safeDomain = rawDomain.startsWith("http") ? rawDomain : rawDomain ? `https://${rawDomain}` : `https://placeholder-${slug}.co.uk`;

  const stub = {
    clientSlug:      slug,
    businessName:    businessName.trim(),
    domain:          safeDomain,
    primaryLocation: (primaryLocation ?? "").trim() || "",
    phone:           "",
    email:           "",
    businessAddress: "",
    brandColour:     "#000000",
    services:        [],
    locations:       [],
    deploy:          { enabled: false, protocol: "ftp", host: "", port: 21, remoteRoot: "/" },
    templateId:      "inboxingproweb_default",
    _stub:           true,
  };

  if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(stub, null, 2));
  req.log.info({ clientSlug: slug, businessName: stub.businessName }, "Stub client project created");
  res.status(201).json({ clientSlug: slug, businessName: stub.businessName });
});

router.patch("/projects/:slug/services", (req, res) => {
  const { slug } = req.params;
  const { serviceKey, serviceName } = req.body as { serviceKey: string; serviceName: string };
  const filePath = path.join(PROJECTS_DIR, `${slug}.json`);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: `Project not found: ${slug}` });
    return;
  }

  const cfg = JSON.parse(fs.readFileSync(filePath, "utf8")) as ProjectConfig;
  const existing = cfg.services.find((s) => s.key === serviceKey);

  if (!existing) {
    cfg.services.push({ key: serviceKey, name: serviceName });
    fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2));
  }

  res.json({ project: cfg });
});

export default router;
