import { orchestrateLocalContentGeneration } from './contentOrchestrator.js';
import { injectAssetsIntoClusterPage, type ClusterGalleryImage } from './assetInjectionEngine.js';
import { convertMarkdownToHtml } from './markdownParser.js';
import { DashboardPagePayload } from './layoutCompiler.js';
import { saveGeneratedPageToProfile, ProfileSaverConfig } from './profileSaver.js';
import { LinkingEngine, LinkingPageTarget } from './linkingEngine.js';
import { LocalLocationHierarchy } from '../pharmacyLocalAreaResolver.js';
import { ExtractedBrandStyle } from '../pharmacyProfileSchema.js';

export interface PipelineExecutionSummary {
  totalEligibleSuburbs: number;
  successfullyPublishedCount: number;
  failedCount: number;
  processedSlugs: string[];
}

export interface PipelineExecutionOptions {
  serviceId?: string;
  layoutImages?: ClusterGalleryImage[];
}

/**
 * MASTER SYSTEM RUNNER: Executes the entire hyper-local SEO programmatic workflow.
 * Links Generation, Rate-Limiting, Asset Injection, Cross-Linking, and File Storage.
 */
export async function runEndToEndContentPipeline(
  hierarchyData: LocalLocationHierarchy,
  brandStyle: ExtractedBrandStyle,
  saverConfig: ProfileSaverConfig,
  mapEmbedUrlBase: string,
  options: PipelineExecutionOptions = {},
): Promise<PipelineExecutionSummary> {
  
  const summary: PipelineExecutionSummary = {
    totalEligibleSuburbs: 0,
    successfullyPublishedCount: 0,
    failedCount: 0,
    processedSlugs: []
  };

  const targetsQueue = hierarchyData.generationAreas.filter(a => a.generationEligible && a.approved);
  summary.totalEligibleSuburbs = targetsQueue.length;

  if (summary.totalEligibleSuburbs === 0) {
    console.log("ℹ️ Pipeline Runner: Zero eligible and approved suburb records found. Aborting run.");
    return summary;
  }

  // Build out a map of slugs for our internal linking engine targets
  const suburbLinkingTargets: LinkingPageTarget[] = targetsQueue.map(t => ({
    name: t.name,
    slug: t.slug
  }));

  console.log(`⚡ Core Pipeline Triggered: Processing ${summary.totalEligibleSuburbs} areas for ${hierarchyData.primaryLocality}...`);

  // 1. Fire the throttled batch loop engine to build the compliant texts safely
  const generatedTextBatch = await orchestrateLocalContentGeneration(targetsQueue, {
    concurrencyLimit: 2,
    batchDelayMs: 4000
  });

  // 2. Loop through generated texts to run template stitching and disk writing
  for (const pageItem of generatedTextBatch) {
    if (pageItem.status !== "SUCCESS") {
      summary.failedCount++;
      continue;
    }

    try {
      const contextualMapUrl = `${mapEmbedUrlBase}&q=${encodeURIComponent(pageItem.name + " " + hierarchyData.primaryLocality)}`;

      const layoutImages: ClusterGalleryImage[] = (options.layoutImages && options.layoutImages.length
        ? options.layoutImages
        : [{ url: "/assets/images/pharmacy-clinic-interior.jpg", altText: `NHS clinical treatment facility serving ${pageItem.name} residents.` }]
      ).map((image) => ({
        url: image.url,
        altText: image.altText.replace(/\{area\}/g, pageItem.name) || `Pharmacy service serving ${pageItem.name}`,
      }));

      // A. Inject Map wrappers and pre-assigned layout slot images
      let enrichedMarkdown = injectAssetsIntoClusterPage(pageItem.contentMarkdown, {
        mapEmbedUrl: contextualMapUrl,
        imageGallery: layoutImages,
      });

      // B. Parse raw markdown configurations into clean paragraph text HTML tokens
      let semanticHtmlBody = convertMarkdownToHtml(enrichedMarkdown);

      // C. INTERLINKING INJECTION: Add the Spoke-to-Hub link directly at the bottom of the body text
      const mainHubSlug = `services/pharmacy-first-${hierarchyData.primaryLocalitySlug}`;
      const spokeToHubHtml = LinkingEngine.generateSpokeToHubLink(hierarchyData.primaryLocality, mainHubSlug);
      semanticHtmlBody += spokeToHubHtml;

      // D. Build the unified payload structure your dashboard layout templates expect
      const payloadAssembly: DashboardPagePayload = {
        title: `NHS Pharmacy First Service Clinic - ${pageItem.name} Pharmacy Hub`,
        slug: pageItem.slug,
        suburbName: pageItem.name,
        bodyHtml: semanticHtmlBody,
        styleConfig: brandStyle
      };

      // E. Save page directly into the filesystem profile records
      const writeOutcome = await saveGeneratedPageToProfile(payloadAssembly, saverConfig);

      if (writeOutcome) {
        summary.successfullyPublishedCount++;
        summary.processedSlugs.push(pageItem.slug);
      } else {
        summary.failedCount++;
      }

    } catch (innerPipelineError) {
      console.error(`❌ Process breakdown during compilation layers for [${pageItem.name}]:`, innerPipelineError);
      summary.failedCount++;
    }
  }

  // F. UPDATE THE HUB PAGE: Inject the Hub-to-Spoke links matrix into the main city landing file
  console.log(`🔗 Injecting Hub-to-Spoke navigation list into the main ${hierarchyData.primaryLocality} hub module...`);
  const hubNavigationBlockHtml = LinkingEngine.generateHubToSpokeNav(suburbLinkingTargets);
  
  // Here, your app would write 'hubNavigationBlockHtml' directly to your main Hub page configuration file.

  console.log(`🏁 Master Automation Complete. Processed: ${summary.successfullyPublishedCount}/${summary.totalEligibleSuburbs} profiles correctly.`);
  return summary;
}
