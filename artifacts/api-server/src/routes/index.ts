



;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import previewRouter from "./preview";
import setupRouter from "./setup";
import rankingRouter from "./ranking";
import dashboardRouter from "./dashboard";
import designsRouter from "./designs";
import projectsRouter from "./api/projects";
import areaEngineRouter from "./api/areaEngine";
import selectedAreasRouter from "./api/selectedAreas";
import rolloutRouter from "./api/rollout";
import validateRouter from "./api/validate";
import sessionRouter from "./api/session";
import searchConsoleRouter from "./api/searchConsole";
import indexTrackingRouter from "./api/indexTracking";
import gscIndexRouter from "./api/gscIndex";
import keywordTrackingRouter from "./api/keywordTracking";
import imagesRouter from "./api/images";
import usageRouter from "./api/usage";
import campaignsRouter from "./api/campaigns";
import gscAuthRouter from "./api/gscAuth";
import templatesRouter from "./api/templates";
import generateRouter        from "./api/generate";
import suggestKeywordsRouter from "./api/suggestKeywords";
import prePublishQaRouter    from "./api/prePublishQa";
import liveCrawlRouter       from "./api/liveCrawl";
import systemHealthRouter    from "./api/systemHealth";
import systemDiagnosticsRouter from "./api/systemDiagnostics";
import securityScanRouter   from "./api/securityScan";
import linkAuditRouter      from "./api/linkAudit";
import distributionRouter   from "./api/distribution";
import publishGateRouter    from "./api/publishGate";
import imageLibraryRouter  from "./api/imageLibrary";
import brandImportRouter      from "./api/brandImport";
import providerProfilesRouter from "./api/providerProfiles";
import usersRouter            from "./api/users";
import socialPostsRouter      from "./api/socialPosts";
import sectionOptimiseRouter  from "./api/sectionOptimise";
import adminRouter            from "./admin";


const router: IRouter = Router();

// Root redirect → dashboard
router.get("/", (_req, res) => res.redirect("/api/dashboard"));

// UI routes
router.use(setupRouter);
router.use(rankingRouter);
router.use(dashboardRouter);
router.use(designsRouter);
router.use(healthRouter);

// JSON API routes
router.use(projectsRouter);
router.use(areaEngineRouter);
router.use(selectedAreasRouter);
router.use(rolloutRouter);
router.use(validateRouter);
router.use(sessionRouter);
router.use(searchConsoleRouter);
router.use(indexTrackingRouter);
router.use(gscIndexRouter);
router.use(keywordTrackingRouter);
router.use(imagesRouter);
router.use(usageRouter);
router.use(campaignsRouter);
router.use(gscAuthRouter);
router.use(templatesRouter);
router.use(generateRouter);
router.use(suggestKeywordsRouter);
router.use(prePublishQaRouter);
router.use(liveCrawlRouter);
router.use(systemHealthRouter);
router.use(systemDiagnosticsRouter);
router.use(securityScanRouter);
router.use(linkAuditRouter);
router.use(distributionRouter);
router.use(publishGateRouter);
router.use(imageLibraryRouter);
router.use(brandImportRouter);
router.use(providerProfilesRouter);
router.use(usersRouter);
router.use(socialPostsRouter);
router.use(sectionOptimiseRouter);
router.use(adminRouter);

export default router;
