/**
 * Growth Engine — Launch Manager V1.
 * Adaptive launch plans created ONLY after generation, review, and quality approval.
 */
import { randomUUID } from "node:crypto";
import {
  estimateCampaignOutputs,
} from "./growthEngineCampaignRecommendationEngine.ts";
import type { GrowthCycle, GrowthCycleLaunchPlan, LaunchPlanSchedule } from "./growthEngineCycleModel.ts";
import { findLaunchPlanForCycle, saveLaunchPlan } from "./growthEngineCycleMemoryService.ts";
import { loadWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import {
  contentPackageApproved,
  contentPackageGenerated,
  contentPackageReviewed,
} from "./pharmacyContentPackageService.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";

function loadProfile(slug: string) {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

export interface LaunchPlanEligibility {
  eligible: boolean;
  reasons: string[];
}

export function checkLaunchPlanEligibility(slug: string, serviceId: string): LaunchPlanEligibility {
  const reasons: string[] = [];
  const generated = contentPackageGenerated(slug, serviceId);
  const reviewed = contentPackageReviewed(slug, serviceId);
  const approved = contentPackageApproved(slug, serviceId);

  if (!generated) reasons.push("Generation must be complete before a launch plan is created.");
  if (!reviewed) reasons.push("Content must pass quality review before launch planning.");
  if (!approved) reasons.push("Content must be approved for launch before a launch plan is created.");

  return { eligible: generated && reviewed && approved, reasons };
}

export interface AdaptiveLaunchRecommendation {
  recommendedWeeks: number;
  rationale: string;
  websiteProfile: "small" | "established" | "mature";
}

export function buildAdaptiveLaunchRecommendation(slug: string, serviceId: string): AdaptiveLaunchRecommendation {
  const website = loadWebsiteIntelligenceSnapshot(slug);
  const profile = loadProfile(slug);
  const outputs = estimateCampaignOutputs(profile);
  const totalNewPages =
    outputs.servicePage + outputs.clusterPages + outputs.patientGuides + outputs.blogs + outputs.faqs;
  const existingPages = website?.analysis?.inventory.totalPages || 0;
  const websiteComplete = website?.analysis?.understandingComplete === true;

  if (!websiteComplete || existingPages <= 8) {
    return {
      recommendedWeeks: 4,
      websiteProfile: "small",
      rationale: `Your website currently has ${existingPages || "few"} analysed pages and this Growth Cycle adds approximately ${totalNewPages} new pages. A four-week structured publishing and monitoring schedule gives Google time to discover new URLs, lets you review indexing weekly, and avoids overwhelming a smaller site with a large first ecosystem in one batch. This is a PharmaConnect publishing strategy — not a Google requirement.`,
    };
  }

  if (existingPages <= 25) {
    return {
      recommendedWeeks: 3,
      websiteProfile: "established",
      rationale: `Your website has ${existingPages} pages — an established presence. A three-week launch staggers publishing of your ${serviceLabel(serviceId)} ecosystem while maintaining weekly Search Console checks and GBP activity. Shorter than a first ecosystem because your site already has crawl history; still structured so you can monitor indexing and patient engagement week by week.`,
    };
  }

  return {
    recommendedWeeks: 2,
    websiteProfile: "mature",
    rationale: `Your website has ${existingPages} pages — a mature site with existing authority signals. A two-week launch window is appropriate for adding a ${serviceLabel(serviceId)} ecosystem: publish priority URLs first, submit to Search Console, then layer GBP and social support. This is a structured monitoring approach suited to long-established sites, not a claim about Google's indexing rules.`,
  };
}

function serviceLabel(serviceId: string): string {
  return getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildWeekMilestones(
  weeks: number,
  serviceName: string,
  outputs: ReturnType<typeof estimateCampaignOutputs>,
): LaunchPlanSchedule["publishing"] {
  const milestones: LaunchPlanSchedule["publishing"] = [];

  for (let w = 1; w <= weeks; w++) {
    if (w === 1) {
      milestones.push({
        week: w,
        title: "Priority pages live",
        tasks: [
          `Publish ${serviceName} service page and patient guide`,
          "Update sitemap with new service URLs",
          "Submit priority URLs via Search Console",
          `Schedule first ${Math.min(3, outputs.gbpPosts)} GBP posts`,
        ],
      });
    } else if (w === 2) {
      milestones.push({
        week: w,
        title: "Local and supporting content",
        tasks: [
          `Publish up to ${Math.min(4, outputs.clusterPages)} local cluster pages`,
          `Release ${Math.min(1, outputs.blogs)} blog article`,
          `Publish ${Math.min(5, outputs.socialPosts)} social posts`,
          "Review indexing status for week 1 URLs",
        ],
      });
    } else if (w === weeks) {
      milestones.push({
        week: w,
        title: "Complete ecosystem and review",
        tasks: [
          "Publish remaining cluster pages and FAQs",
          `Complete email sequence (${outputs.emails} emails scheduled)`,
          "Full Search Console review of all cycle URLs",
          "Performance review — indexing, visibility, and next recommendation",
        ],
      });
    } else {
      milestones.push({
        week: w,
        title: `Steady publishing — week ${w}`,
        tasks: [
          "Continue cluster page publishing",
          "GBP and social posts on schedule",
          "Weekly indexing check",
          "Progress review with Growth Dashboard",
        ],
      });
    }
  }

  return milestones;
}

export function buildLaunchPlanSchedule(
  slug: string,
  serviceId: string,
): LaunchPlanSchedule {
  const adaptive = buildAdaptiveLaunchRecommendation(slug, serviceId);
  const profile = loadProfile(slug);
  const outputs = estimateCampaignOutputs(profile);
  const serviceName = serviceLabel(serviceId);
  const weeks = adaptive.recommendedWeeks;

  return {
    recommendedWeeks: weeks,
    rationale: adaptive.rationale,
    publishing: buildWeekMilestones(weeks, serviceName, outputs),
    sitemapUpdates: [
      "Add new service page URL to XML sitemap after publishing",
      "Include cluster page URLs as each local page goes live",
      "Regenerate sitemap when blog and FAQ pages are published",
      "Verify sitemap is referenced in robots.txt",
    ],
    searchConsolePlan: [
      "Submit service page URL immediately after publish",
      "Submit cluster pages in weekly batches (max 10 URLs per review)",
      "Monitor Coverage report weekly during launch window",
      "Re-submit any URLs showing 'Discovered — not indexed' after 14 days",
    ],
    priorityUrlReview: [
      `${serviceName} service page (highest priority)`,
      "Patient guide and FAQ page",
      "Top 3 local cluster pages by target area priority",
      "Primary blog article supporting the service",
    ],
    gbpSchedule: [
      `Week 1: ${Math.min(3, outputs.gbpPosts)} posts introducing ${serviceName}`,
      `Week 2–${weeks}: ${Math.max(1, outputs.gbpPosts - 3)} posts on patient education and booking prompts`,
      "Align GBP posts with published page URLs where possible",
    ],
    socialSchedule: [
      `Week 1: ${Math.min(5, outputs.socialPosts)} posts — service announcement`,
      `Weeks 2–${weeks}: remaining ${Math.max(0, outputs.socialPosts - 5)} posts on FAQs and local areas`,
    ],
    emailSchedule: [
      `${outputs.emails} emails in sequence — schedule from week 2 onwards`,
      "Email 1: service introduction after service page is live",
      "Emails 2–4: patient education aligned to published guides",
      "Email 5: booking prompt after core pages indexed",
    ],
    progressReviews: [
      "End of week 1: indexing check on priority URLs",
      `Mid-launch (week ${Math.ceil(weeks / 2)}): published vs planned page count`,
      `End of week ${weeks}: full cycle performance review and next recommendation`,
    ],
  };
}

export function createLaunchPlanIfEligible(
  slug: string,
  cycle: GrowthCycle,
): GrowthCycleLaunchPlan | null {
  const existing = findLaunchPlanForCycle(slug, cycle.cycleNumber);
  if (existing) return existing;

  const eligibility = checkLaunchPlanEligibility(slug, cycle.serviceId);
  if (!eligibility.eligible) return null;

  const schedule = buildLaunchPlanSchedule(slug, cycle.serviceId);
  const plan: GrowthCycleLaunchPlan = {
    id: randomUUID(),
    cycleNumber: cycle.cycleNumber,
    serviceId: cycle.serviceId,
    serviceName: cycle.recommendedService,
    createdAt: new Date().toISOString(),
    schedule,
  };
  saveLaunchPlan(slug, plan);
  return plan;
}

export function getLaunchPlanForCycle(slug: string, cycle: GrowthCycle): GrowthCycleLaunchPlan | null {
  return findLaunchPlanForCycle(slug, cycle.cycleNumber) || createLaunchPlanIfEligible(slug, cycle);
}

export function computeLaunchWeek(cycle: GrowthCycle, launchPlan: GrowthCycleLaunchPlan | null): number | null {
  if (!launchPlan || !cycle.launchDate) return null;
  const start = new Date(cycle.launchDate).getTime();
  const now = Date.now();
  if (now < start) return 1;
  const week = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.min(week, launchPlan.schedule.recommendedWeeks);
}
