/**
 * Growth Engine — Local Healthcare Intelligence V1 reusable map model.
 * Data structure only — no routing or UI redesign.
 */
import type { GrowthEngineCompetitor, GrowthEngineYourPharmacy } from "./growthEngineCompetitorModel.ts";
import { classifyCompetitors } from "./growthEngineCompetitorOwnership.ts";
import { realGoogleCompetitors } from "./growthEngineLocalMarketAnalysis.ts";
import { realHealthcareProviders } from "./growthEngineHealthcareDiscovery.ts";
import type {
  HealthcareDisplayGroupKey,
  HealthcareMapMarker,
  HealthcareMapModel,
  HealthcareProviderEntity,
} from "./growthEngineHealthcareModel.ts";

function providerDisplayGroup(p: HealthcareProviderEntity): HealthcareDisplayGroupKey {
  if (p.groupKey === "gpSurgeries") return "gpSurgeries";
  if (p.groupKey === "healthCentres" || p.groupKey === "walkInCentres") return "healthCentres";
  if (p.groupKey === "hospitals") return "hospitals";
  if (p.groupKey === "careHomes") return "careHomes";
  return "healthcareServices";
}

export function buildHealthcareMapModel(
  yours: GrowthEngineYourPharmacy | null,
  providers: HealthcareProviderEntity[],
  competitors: GrowthEngineCompetitor[],
): HealthcareMapModel {
  const markers: HealthcareMapMarker[] = [];
  const liveProviders = realHealthcareProviders(providers);
  const liveCompetitors = realGoogleCompetitors(competitors);
  const classified = classifyCompetitors(liveCompetitors);

  if (yours?.latitude != null && yours.longitude != null) {
    markers.push({
      id: `pharmacy-${yours.placeId || "yours"}`,
      label: yours.businessName,
      latitude: yours.latitude,
      longitude: yours.longitude,
      layer: "your-pharmacy",
      placeId: yours.placeId,
    });
  }

  for (const p of liveProviders) {
    if (p.latitude == null || p.longitude == null) continue;
    markers.push({
      id: `provider-${p.placeId}`,
      label: p.businessName,
      latitude: p.latitude,
      longitude: p.longitude,
      layer: "healthcare-provider",
      groupKey: providerDisplayGroup(p),
      placeId: p.placeId,
    });
  }

  for (const c of classified) {
    if (c.latitude == null || c.longitude == null) continue;
    markers.push({
      id: `competitor-${c.placeId}`,
      label: c.businessName,
      latitude: c.latitude,
      longitude: c.longitude,
      layer: "competitor",
      groupKey: "otherPharmacies",
      ownershipType: c.ownershipType,
      placeId: c.placeId,
    });
  }

  const center =
    yours?.latitude != null && yours.longitude != null
      ? { latitude: yours.latitude, longitude: yours.longitude }
      : markers[0]
        ? { latitude: markers[0].latitude, longitude: markers[0].longitude }
        : null;

  return {
    center,
    zoom: 14,
    markers,
    futureLayers: {
      catchmentOverlay: null,
      driveTimeAnalysis: null,
      referralRoutes: null,
      demographicLayers: null,
    },
  };
}

export function mapModelMarkerCount(model: HealthcareMapModel | null): number {
  return model?.markers?.length || 0;
}

export function mapModelLayerCounts(model: HealthcareMapModel | null): Record<string, number> {
  if (!model) return {};
  return model.markers.reduce<Record<string, number>>((acc, m) => {
    acc[m.layer] = (acc[m.layer] || 0) + 1;
    return acc;
  }, {});
}
