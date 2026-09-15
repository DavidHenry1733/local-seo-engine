/**
 * Local Market intelligence phrases — profile-first, evidence-only, natural language.
 */
import type { ContentGenerationContext } from "./contentGenerationContextTypes.ts";
import {
  areaDiscoveryForName,
  providersForArea,
  type LocalMarketHealthcareProvider,
} from "../pharmacyLocalMarketSnapshot.ts";
import { collectIntelligenceSentences } from "./pharmacyLongFormIntelligencePhrases.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function providerLabel(provider: LocalMarketHealthcareProvider): string {
  const name = provider.businessName;
  if (provider.distanceLabel && provider.distanceKm > 0) {
    return `${name} (${provider.distanceLabel} from the pharmacy)`;
  }
  if (provider.distanceKm === 0) {
    return `${name} (on the same street as the pharmacy)`;
  }
  return name;
}

export function phraseCoLocatedGp(ctx: ContentGenerationContext): string | null {
  const gp = providersForArea(ctx.localMarket, ctx.localArea || ctx.primaryTown, {
    groupKeys: ["gpSurgeries"],
    limit: 1,
  }).find((p) => p.distanceKm === 0);
  if (!gp) return null;
  return `${gp.businessName} is located at the same address as ${ctx.profile.pharmacyName}, which helps patients coordinate GP follow-up and pharmacy care in one visit.`;
}

export function phraseAreaTravelContext(ctx: ContentGenerationContext, areaName: string): string | null {
  const discovery = areaDiscoveryForName(ctx.areaDiscovery, areaName);
  if (!discovery?.distanceLabel) return null;
  const town = ctx.primaryTown || ctx.profile.town;
  if (!town) return null;
  return `${areaName} sits ${discovery.distanceLabel.toLowerCase()} — many patients travel from ${areaName} to ${ctx.profile.pharmacyName} in ${town} for NHS pharmacy appointments.`;
}

export function phraseLocalGpNetwork(ctx: ContentGenerationContext, areaName: string): string | null {
  const gps = providersForArea(ctx.localMarket, areaName, { groupKeys: ["gpSurgeries"], limit: 2 });
  if (!gps.length) return null;
  const labels = gps.map(providerLabel).join(" and ");
  // Inherit ONLY the parent service narrative — never hardcode Pharmacy First onto other services.
  const serviceName = str(ctx.serviceName) || "pharmacy services";
  const serviceId = str(ctx.serviceId);
  const servicePurpose =
    serviceId === "pharmacy-first" || /pharmacy first/i.test(serviceName)
      ? "Pharmacy First assessment"
      : `${serviceName} advice`;
  return `Patients in ${areaName} often use local GP practices such as ${labels} before visiting ${ctx.profile.pharmacyName} for ${servicePurpose}.`;
}

export function phraseLocalHealthcareFacility(ctx: ContentGenerationContext, areaName: string): string | null {
  const urgent = providersForArea(ctx.localMarket, areaName, {
    groupKeys: ["communityClinics", "hospitals", "healthCentres"],
    limit: 1,
  })[0];
  if (!urgent) return null;
  return `When symptoms need escalation beyond pharmacy scope, ${ctx.profile.pharmacyName} can signpost to nearby services such as ${providerLabel(urgent)}.`;
}

export function phraseLocalMarketServicePage(ctx: ContentGenerationContext): string | null {
  const town = ctx.primaryTown || ctx.profile.town;
  const gp = phraseCoLocatedGp(ctx);
  const urgent = providersForArea(ctx.localMarket, ctx.localArea || town, {
    groupKeys: ["communityClinics"],
    limit: 1,
  })[0];
  const parts: string[] = [];
  if (gp) parts.push(gp);
  if (urgent) {
    parts.push(
      `The pharmacy sits close to ${urgent.businessName} (${urgent.distanceLabel}), supporting sensible routing between community pharmacy and urgent care when needed.`,
    );
  }
  if (!parts.length) return null;
  return parts.join(" ");
}

export function phraseLocalMarketClusterIntro(
  ctx: ContentGenerationContext | undefined,
  areaName: string,
  fallbackIntro: string,
): string {
  if (!ctx) return fallbackIntro;
  const travel = phraseAreaTravelContext(ctx, areaName);
  const gp = phraseLocalGpNetwork(ctx, areaName);
  const extras = collectIntelligenceSentences([travel, gp]);
  if (!extras.length) return fallbackIntro;
  return `${fallbackIntro} ${extras.join(" ")}`.replace(/\s{2,}/g, " ").trim();
}

export function phraseLocalMarketGuideContext(ctx: ContentGenerationContext): string | null {
  const gp = phraseCoLocatedGp(ctx);
  const town = ctx.primaryTown || ctx.profile.town;
  if (gp) {
    return `${gp.replace(/\.$/, "")} — a practical local link for patients across ${town}.`;
  }
  return phraseLocalGpNetwork(ctx, ctx.localArea || town);
}

export function collectLocalMarketSentences(
  ctx: ContentGenerationContext,
  areaName?: string,
): string[] {
  const area = areaName || ctx.localArea || ctx.primaryTown;
  return collectIntelligenceSentences([
    area ? phraseAreaTravelContext(ctx, area) : null,
    area ? phraseLocalGpNetwork(ctx, area) : null,
    phraseLocalMarketServicePage(ctx),
    phraseLocalHealthcareFacility(ctx, area || ctx.primaryTown),
  ]);
}
