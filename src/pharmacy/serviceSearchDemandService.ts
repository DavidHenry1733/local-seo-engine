/**
 * Shared service search-demand collection orchestration.
 * Collects Keywords Data search_volume for confirmed selectedServices only.
 * Batches all services needing collection into one HTTP request where supported.
 * Does not call DataForSEO from content generation paths.
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { resolveTenantLocality } from "./masterAdminPrimaryLocalityService.ts";
import { safePharmacySlug } from "./pharmacyWorkspacePaths.ts";
import {
  isDataForSeoConfigured,
  parseSearchVolumeLiveResponse,
  postGoogleAdsSearchVolumeLive,
} from "./dataForSeoKeywordsDataSearchVolumeAdapter.ts";
import { isDataForSeoTransportTimeout } from "./dataForSeoHttp.ts";
import { buildServiceSearchDemandQueries } from "./serviceSearchDemandQueryBuilder.ts";
import { resolveServiceSearchDemandMeta } from "./serviceSearchDemandMetadata.ts";
import {
  SERVICE_SEARCH_DEMAND_FRESHNESS_DAYS,
  SERVICE_SEARCH_DEMAND_LANGUAGE_CODE,
  SERVICE_SEARCH_DEMAND_LOCATION_CODE,
  SERVICE_SEARCH_DEMAND_SOURCE,
  type ServiceSearchDemandArtifact,
  type ServiceSearchDemandCollectOptions,
  type ServiceSearchDemandEvidenceStatus,
  type ServiceSearchDemandServiceEntry,
} from "./serviceSearchDemandModel.ts";
import {
  emptyServiceSearchDemandArtifact,
  readServiceSearchDemandArtifact,
  serviceSearchDemandArtifactPath,
  writeServiceSearchDemandArtifact,
} from "./serviceSearchDemandStorage.ts";

export type ServiceSearchDemandCollectResult = {
  slug: string;
  artifactPath: string;
  artifact: ServiceSearchDemandArtifact;
  reused: boolean;
  collectedServiceIds: string[];
  skippedServiceIds: string[];
  requestCount: number;
  configured: boolean;
  error: string | null;
};

type ServiceQueryBatch = {
  serviceId: string;
  serviceName: string;
  queries: string[];
};

function clean(value: unknown): string {
  return String(value || "").trim();
}

/** Confirmed services only — profile data.selectedServices. */
export function readConfirmedServiceIds(slug: string): string[] {
  const profile = readSetupProfile(slug);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of profile.selectedServices || []) {
    const id = clean(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function isServiceSearchDemandFresh(
  entry: { capturedAt?: string } | null | undefined,
  now: Date = new Date(),
): boolean {
  const capturedAt = entry?.capturedAt;
  if (!capturedAt) return false;
  const then = Date.parse(capturedAt);
  if (!Number.isFinite(then)) return false;
  const ageMs = now.getTime() - then;
  if (ageMs < 0) return true;
  return ageMs <= SERVICE_SEARCH_DEMAND_FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
}

function evidenceStatusForRows(
  rows: ServiceSearchDemandServiceEntry["queries"],
): ServiceSearchDemandEvidenceStatus {
  if (!rows.length) return "empty";
  const available = rows.filter(
    (r) => r.availability === "available" || r.availability === "zero",
  ).length;
  if (available === 0) return "unavailable";
  if (available === rows.length) return "complete";
  return "partial";
}

function pharmacyIdentity(slug: string): { pharmacyName: string; town: string } {
  const profile = readSetupProfile(slug);
  const locality = resolveTenantLocality(profile);
  return {
    pharmacyName: clean(profile.pharmacyName || profile.tradingName),
    town: clean(locality.value || profile.primaryTown || profile.townCity),
  };
}

function emptyServiceEntry(
  serviceId: string,
  serviceName: string,
  capturedAt: string,
): ServiceSearchDemandServiceEntry {
  return {
    serviceId,
    serviceName,
    queries: [],
    requestCount: 0,
    taskIds: [],
    evidenceStatus: "empty",
    capturedAt,
  };
}

function sanitiseErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]")
    .replace(/(DATAFORSEO_(?:API_)?(?:LOGIN|PASSWORD)\s*[:=]\s*)\S+/gi, "$1[REDACTED]");
}

/**
 * Batch all service keyword lists into one search_volume/live HTTP request.
 * DataForSEO supports up to 1000 keywords per task at the same location.
 */
async function collectBatchedServiceDemand(input: {
  batches: ServiceQueryBatch[];
  capturedAt: string;
  postSearchVolume?: ServiceSearchDemandCollectOptions["postSearchVolume"];
}): Promise<{
  entries: Record<string, ServiceSearchDemandServiceEntry>;
  requestCount: number;
  taskIds: string[];
  providerCost: number | null;
}> {
  const withQueries = input.batches.filter((batch) => batch.queries.length > 0);
  const entries: Record<string, ServiceSearchDemandServiceEntry> = {};

  for (const batch of input.batches) {
    if (!batch.queries.length) {
      entries[batch.serviceId] = emptyServiceEntry(
        batch.serviceId,
        batch.serviceName,
        input.capturedAt,
      );
    }
  }

  if (!withQueries.length) {
    return { entries, requestCount: 0, taskIds: [], providerCost: null };
  }

  const allKeywords = withQueries.flatMap((batch) => batch.queries);
  let payload: unknown;
  if (input.postSearchVolume) {
    payload = await input.postSearchVolume([
      {
        keywords: allKeywords,
        location_code: SERVICE_SEARCH_DEMAND_LOCATION_CODE,
        language_code: SERVICE_SEARCH_DEMAND_LANGUAGE_CODE,
      },
    ]);
  } else {
    const live = await postGoogleAdsSearchVolumeLive(allKeywords);
    payload = live.payload;
  }

  const envelope = parseSearchVolumeLiveResponse({
    serviceId: "",
    requestedKeywords: allKeywords,
    payload,
    capturedAt: input.capturedAt,
  });

  for (const batch of withQueries) {
    const parsed = parseSearchVolumeLiveResponse({
      serviceId: batch.serviceId,
      requestedKeywords: batch.queries,
      payload,
      capturedAt: input.capturedAt,
    });
    entries[batch.serviceId] = {
      serviceId: batch.serviceId,
      serviceName: batch.serviceName,
      queries: parsed.rows,
      requestCount: 1,
      taskIds: envelope.taskId ? [envelope.taskId] : [],
      evidenceStatus: evidenceStatusForRows(parsed.rows),
      capturedAt: input.capturedAt,
    };
  }

  return {
    entries,
    requestCount: 1,
    taskIds: envelope.taskId ? [envelope.taskId] : [],
    providerCost: envelope.cost > 0 ? envelope.cost : null,
  };
}

/**
 * Collect (or reuse) service search-demand for confirmed selectedServices.
 * One batched Keywords Data HTTP request for all services needing collection.
 * Never collects services absent from selectedServices.
 * Does not retry after uncertain transport timeouts.
 */
export async function collectServiceSearchDemand(
  slugInput: string,
  options: ServiceSearchDemandCollectOptions = {},
): Promise<ServiceSearchDemandCollectResult> {
  const slug = safePharmacySlug(slugInput);
  const now = options.now || new Date();
  const force = options.force === true;
  const confirmedServiceIds = readConfirmedServiceIds(slug);
  const existing = readServiceSearchDemandArtifact(slug);
  const { pharmacyName, town } = pharmacyIdentity(slug);
  const capturedAt = now.toISOString();

  if (!confirmedServiceIds.length) {
    const artifact = emptyServiceSearchDemandArtifact(slug, [], capturedAt);
    const artifactPath = writeServiceSearchDemandArtifact(artifact);
    return {
      slug,
      artifactPath,
      artifact,
      reused: false,
      collectedServiceIds: [],
      skippedServiceIds: [],
      requestCount: 0,
      configured: isDataForSeoConfigured() || Boolean(options.postSearchVolume),
      error: null,
    };
  }

  const configured = Boolean(options.postSearchVolume) || isDataForSeoConfigured();

  const allFresh =
    !force &&
    Boolean(existing) &&
    confirmedServiceIds.every((serviceId) => {
      const prior = existing?.demandByService?.[serviceId];
      return Boolean(prior && isServiceSearchDemandFresh(prior, now));
    }) &&
    Object.keys(existing?.demandByService || {}).every((id) =>
      confirmedServiceIds.includes(id),
    );

  if (allFresh && existing) {
    const reusedArtifact: ServiceSearchDemandArtifact = {
      ...existing,
      requestCount: 0,
      providerCost: null,
      demandByService: Object.fromEntries(
        Object.entries(existing.demandByService || {}).map(([serviceId, entry]) => [
          serviceId,
          {
            ...entry,
            requestCount: 0,
            evidenceStatus: entry.evidenceStatus === "empty" ? "empty" : "reused",
          },
        ]),
      ),
    };
    return {
      slug,
      artifactPath: serviceSearchDemandArtifactPath(slug),
      artifact: reusedArtifact,
      reused: true,
      collectedServiceIds: [],
      skippedServiceIds: [...confirmedServiceIds],
      requestCount: 0,
      configured,
      error: null,
    };
  }

  const demandByService: Record<string, ServiceSearchDemandServiceEntry> = {};
  const collectedServiceIds: string[] = [];
  const skippedServiceIds: string[] = [];
  const batchesToCollect: ServiceQueryBatch[] = [];
  const priorByService = new Map<string, ServiceSearchDemandServiceEntry | null>();
  let requestCount = 0;
  const taskIds: string[] = [];
  let providerCost: number | null = null;
  let error: string | null = null;

  for (const serviceId of confirmedServiceIds) {
    const prior = existing?.demandByService?.[serviceId] || null;
    if (!force && prior && isServiceSearchDemandFresh(prior, now)) {
      demandByService[serviceId] = {
        ...prior,
        requestCount: 0,
        evidenceStatus: prior.evidenceStatus === "empty" ? "empty" : "reused",
      };
      skippedServiceIds.push(serviceId);
      continue;
    }

    priorByService.set(serviceId, prior);

    if (!configured) {
      error = "DataForSEO credentials unavailable";
      if (prior) {
        demandByService[serviceId] = prior;
        skippedServiceIds.push(serviceId);
      }
      continue;
    }

    const meta = resolveServiceSearchDemandMeta(serviceId);
    batchesToCollect.push({
      serviceId,
      serviceName: meta.serviceName,
      queries: buildServiceSearchDemandQueries({
        serviceId,
        slug,
        pharmacyName,
        town,
        serviceName: meta.serviceName,
      }),
    });
  }

  if (batchesToCollect.length && configured) {
    try {
      const batchResult = await collectBatchedServiceDemand({
        batches: batchesToCollect,
        capturedAt,
        postSearchVolume: options.postSearchVolume,
      });
      for (const serviceId of batchesToCollect.map((batch) => batch.serviceId)) {
        if (batchResult.entries[serviceId]) {
          demandByService[serviceId] = batchResult.entries[serviceId];
          collectedServiceIds.push(serviceId);
        }
      }
      requestCount = batchResult.requestCount;
      for (const id of batchResult.taskIds) {
        if (id && !taskIds.includes(id)) taskIds.push(id);
      }
      providerCost = batchResult.providerCost;
    } catch (err) {
      if (isDataForSeoTransportTimeout(err)) {
        error =
          "DataForSEO transport timeout; not retrying (request may already have been charged).";
      } else {
        error = sanitiseErrorMessage(err);
      }
      for (const batch of batchesToCollect) {
        const prior = priorByService.get(batch.serviceId);
        if (prior) {
          demandByService[batch.serviceId] = prior;
          skippedServiceIds.push(batch.serviceId);
        }
      }
    }
  }

  const artifact: ServiceSearchDemandArtifact = {
    ...emptyServiceSearchDemandArtifact(slug, confirmedServiceIds, capturedAt),
    demandByService,
    requestCount,
    taskIds,
    providerCost,
    source: SERVICE_SEARCH_DEMAND_SOURCE,
  };

  const artifactPath = writeServiceSearchDemandArtifact(artifact);
  return {
    slug,
    artifactPath,
    artifact,
    reused: collectedServiceIds.length === 0 && skippedServiceIds.length > 0,
    collectedServiceIds,
    skippedServiceIds,
    requestCount,
    configured,
    error,
  };
}

export function getServiceSearchDemandArtifactPath(slug: string): string {
  return serviceSearchDemandArtifactPath(slug);
}
