import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  SelectedAreasBody,
  SelectedAreaKeywords,
} from "./types";
import { buildAllSelectedAreaDefs } from "../../../../../src/generator/buildClusterConfigs";
import type { AreaEngineOutput } from "../../../../../src/area/areaTypes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR = path.join(WORKSPACE_ROOT, "output");

const router = Router();

router.post("/selected-areas", (req, res) => {
  const body = req.body as SelectedAreasBody;

  const {
    cityName,
    serviceName,
    selectedAreaNames,
    projectDomain,
    clientSlug,
    maxPriorityAreas,
    maxSecondaryAreas,
  } = body;

  if (!cityName || !serviceName || !selectedAreaNames?.length) {
    res.status(400).json({
      error: "cityName, serviceName and selectedAreaNames[] are required",
    });
    return;
  }

  // Load engine output — check per-campaign session first, then legacy session.json
  const campaignId = (body as unknown as Record<string, unknown>).campaignId as string | undefined;
  let engineOutput: AreaEngineOutput | null = null;

  const sessionPaths: string[] = [];
  if (campaignId) {
    sessionPaths.push(path.join(OUTPUT_DIR, clientSlug, "sessions", `${campaignId}.json`));
  }
  sessionPaths.push(path.join(OUTPUT_DIR, clientSlug, "session.json"));

  for (const sessionPath of sessionPaths) {
    if (fs.existsSync(sessionPath)) {
      try {
        const session = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as Record<string, unknown>;
        const eo = (session.engineOutput as AreaEngineOutput) ?? null;
        if (eo) { engineOutput = eo; break; }
      } catch {
        // try next
      }
    }
  }

  if (!engineOutput) {
    res.status(400).json({
      error: "No engine output found in session. Complete Stage 3 (area engine) first.",
    });
    return;
  }

  // Use the real builder — gives us hubUrl, hubAnchor, relatedPages, signals
  let fullDefs;
  try {
    fullDefs = buildAllSelectedAreaDefs(
      selectedAreaNames,
      engineOutput,
      projectDomain,
      clientSlug
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: `Failed to build area defs: ${msg}` });
    return;
  }

  // Map SelectedAreaPageDef → SelectedAreaKeywords (add score/rank/postcode from engine)
  // ranked is typed via `any` because the workspace AreaScore shape may differ from
  // the api-server's AreaScore (e.g. postcode field) — runtime data is correct.
  const defs: SelectedAreaKeywords[] = fullDefs.map((def, idx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ranked = (engineOutput!.rankedAreas as any[]).find((r) => r.area === def.area);
    const tierOrder: Record<string, number> = { priority: 0, secondary: 1, tertiary: 2 };
    const tierIdx = tierOrder[def.tier] ?? 2;
    const isOverride = !ranked;
    return {
      area: def.area,
      tier: def.tier,
      score: (ranked?.score as number) ?? 0,
      rank:
        (ranked?.rank as number) ??
        (tierIdx === 0
          ? idx + 1
          : tierIdx === 1
          ? maxPriorityAreas + idx + 1
          : maxPriorityAreas + maxSecondaryAreas + idx + 1),
      postcode: (ranked?.postcode as string) ?? "",
      primaryKeyword: def.primaryKeyword,
      supportingKeywords: def.supportingKeywords,
      remotePath: def.remotePath,
      configPath: def.configPath,
      // Workspace AreaContentSignals structurally compatible; cast to satisfy api-server type
      signals: def.signals as unknown as SelectedAreaKeywords["signals"],
      keywordsCustomised: isOverride,
    };
  });

  // Persist SelectedAreaKeywords[] for wizard UI
  const clientOutputDir = path.join(OUTPUT_DIR, clientSlug);
  if (!fs.existsSync(clientOutputDir)) {
    fs.mkdirSync(clientOutputDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(clientOutputDir, "selected-areas.json"),
    JSON.stringify(defs, null, 2)
  );

  // Also persist the full SelectedAreaPageDef[] for the rollout route
  fs.writeFileSync(
    path.join(clientOutputDir, "selected-area-defs.json"),
    JSON.stringify(fullDefs, null, 2)
  );

  res.status(201).json({ defs, savedTo: path.join(clientOutputDir, "selected-areas.json") });
});

export default router;
