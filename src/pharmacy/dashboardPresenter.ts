import * as fs from "fs/promises";
import * as path from "path";

export interface DashboardReportSummary {
  pharmacyName: string;
  websiteUrl: string;
  brandPrimaryColor: string;
  totalCompetitorsIdentified: number;
  competitorsMatrix: Array<{ name: string; reviewCount: number; rating: number; address: string }>;
  localClusterPagesCount: number;
  publishedPagesSlugs: string[];
}

/**
 * Reads a tenant's profile and generated pages and compiles the dashboard report.
 */
export async function compileTenantDashboardReport(
  tenantSlug: string,
): Promise<DashboardReportSummary | null> {
  const clientDirectory = path.join(process.cwd(), "profiles", tenantSlug);

  try {
    const profileRaw = await fs.readFile(path.join(clientDirectory, "client-profile.json"), "utf-8");
    const profileData = JSON.parse(profileRaw);

    const contentFolder = path.join(clientDirectory, "generated-content");
    let localizedFiles: string[] = [];
    try {
      localizedFiles = await fs.readdir(contentFolder);
    } catch {
      localizedFiles = [];
    }

    const competitors = Array.isArray(profileData.marketIntelligence?.competitors)
      ? profileData.marketIntelligence.competitors
      : [];
    const competitorsList = competitors.map((comp: {
      name?: string;
      reviewCount?: number;
      rating?: number;
      address?: string;
    }) => ({
      name: String(comp.name || ""),
      reviewCount: Number(comp.reviewCount || 0),
      rating: Number(comp.rating || 0),
      address: String(comp.address || ""),
    }));

    return {
      pharmacyName: profileData.meta.companyName,
      websiteUrl: profileData.meta.websiteUrl,
      brandPrimaryColor: profileData.branding.primaryColor,
      totalCompetitorsIdentified: Number(profileData.marketIntelligence?.competitorsFoundCount || competitorsList.length),
      competitorsMatrix: competitorsList,
      localClusterPagesCount: localizedFiles.length,
      publishedPagesSlugs: localizedFiles.map(
        (file) => `services/pharmacy-first-${tenantSlug}/${file.replace(".json", "")}`,
      ),
    };
  } catch (error) {
    console.error(`Could not aggregate reporting summaries for tenant [${tenantSlug}]:`, error);
    return null;
  }
}
