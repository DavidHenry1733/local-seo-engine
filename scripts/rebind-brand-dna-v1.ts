#!/usr/bin/env npx tsx
/**
 * Sprint 5H.5 — single-pass visual service page render (rebind pipeline retired).
 */
import { buildVisualExperiencePage } from "../src/pharmacy/pharmacyVisualExperience.ts";
import type { VisualExperienceServiceId } from "../src/pharmacy/pharmacyVisualExperienceConfig.ts";

const slug = process.argv[2] || "broom-lane-pharmacy";
const serviceId = (process.argv[3] || "pharmacy-first") as VisualExperienceServiceId;

const result = buildVisualExperiencePage(slug, serviceId);
console.log(JSON.stringify({ ok: true, htmlPath: result.outputPath, previewUrl: result.previewUrl }, null, 2));
