import fs from "fs";
import path from "path";

type WordPressStatus = "draft" | "publish" | "private" | "pending";
type WordPressMode = "update-existing" | "create-only" | "update-only";

type WordPressConfig = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  status?: WordPressStatus;
};

type PageData = {
  page: {
    slug: string;
  };
};

type ContentData = {
  hero_title: string;
};

export type ExportOptions = {
  wordpressStatus?: WordPressStatus;
  wordpressMode?: WordPressMode;
};

export type ExportResult = {
  exportedAt: string;
  action: "created" | "updated" | "skipped";
  reason?: string;
  wordpressMode: WordPressMode;
  wordpressStatus: WordPressStatus;
  endpoint?: string;
  pageId?: number;
  status?: string;
  link?: string;
  slug?: string;
  title?: string;
};

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function buildBasicAuth(username: string, applicationPassword: string): string {
  const token = Buffer.from(`${username}:${applicationPassword}`).toString("base64");
  return `Basic ${token}`;
}

async function findExistingPage(
  baseUrl: string,
  authHeader: string,
  slug: string
): Promise<number | null> {
  const searchUrl = `${baseUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&status=any&per_page=1`;

  const response = await fetch(searchUrl, {
    headers: { Authorization: authHeader }
  });

  if (!response.ok) {
    throw new Error(
      `Failed to search for existing page: ${response.status} ${response.statusText}`
    );
  }

  const pages = await response.json() as Array<{ id: number }>;
  return pages.length > 0 ? pages[0].id : null;
}

function writeExportLog(projectRoot: string, slug: string, log: ExportResult): void {
  fs.writeFileSync(
    path.join(projectRoot, "output", slug, "wordpress-export.json"),
    JSON.stringify(log, null, 2),
    "utf-8"
  );
}

export async function exportToWordPress(
  projectRoot: string,
  slug: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const wpConfigPath = path.join(projectRoot, "input", "wordpress.json");
  const pageDataPath = path.join(projectRoot, "output", slug, "page-data.json");
  const htmlPath = path.join(projectRoot, "output", slug, "page.html");

  const wpConfig = readJsonFile<WordPressConfig>(wpConfigPath);
  const pageData = readJsonFile<PageData>(pageDataPath);
  const pageHtml = fs.readFileSync(htmlPath, "utf-8");

  const contentJsonPath = path.join(projectRoot, "output", slug, "content.json");
  if (!fs.existsSync(contentJsonPath)) {
    throw new Error(`content.json not found for slug "${slug}" — run content generation first`);
  }
  const contentData = readJsonFile<ContentData>(contentJsonPath);
  if (!contentData.hero_title) {
    throw new Error(`hero_title is missing in content.json for slug "${slug}"`);
  }

  const pageTitle = contentData.hero_title;
  console.log(`Title field: content.hero_title → "${pageTitle}"`);

  const mode: WordPressMode = options.wordpressMode || "update-existing";
  const resolvedStatus: WordPressStatus =
    options.wordpressStatus || wpConfig.status || "draft";

  const baseUrl = wpConfig.siteUrl.replace(/\/+$/, "");
  const authHeader = buildBasicAuth(wpConfig.username, wpConfig.applicationPassword);
  const pagesEndpoint = `${baseUrl}/wp-json/wp/v2/pages`;

  const existingPageId = await findExistingPage(baseUrl, authHeader, pageData.page.slug);
  const pageExists = existingPageId !== null;

  if (mode === "create-only" && pageExists) {
    const log: ExportResult = {
      exportedAt: new Date().toISOString(),
      action: "skipped",
      reason: `Page already exists (create-only mode)`,
      wordpressMode: mode,
      wordpressStatus: resolvedStatus,
      slug: pageData.page.slug,
    };
    writeExportLog(projectRoot, slug, log);
    console.log(`  Skipped → ${log.reason}`);
    return log;
  }

  if (mode === "update-only" && !pageExists) {
    const log: ExportResult = {
      exportedAt: new Date().toISOString(),
      action: "skipped",
      reason: `Page not found (update-only mode)`,
      wordpressMode: mode,
      wordpressStatus: resolvedStatus,
      slug: pageData.page.slug,
    };
    writeExportLog(projectRoot, slug, log);
    console.log(`  Skipped → ${log.reason}`);
    return log;
  }

  const isUpdate = pageExists;
  const endpoint = isUpdate
    ? `${pagesEndpoint}/${existingPageId}`
    : pagesEndpoint;

  const payload = {
    title: pageTitle,
    slug: pageData.page.slug,
    content: pageHtml,
    status: resolvedStatus,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `WordPress export failed (${isUpdate ? "update" : "create"}): ${response.status} ${response.statusText}\n${responseText}`
    );
  }

  const result = JSON.parse(responseText);

  const log: ExportResult = {
    exportedAt: new Date().toISOString(),
    action: isUpdate ? "updated" : "created",
    wordpressMode: mode,
    wordpressStatus: resolvedStatus,
    endpoint,
    pageId: result.id,
    status: result.status,
    link: result.link,
    slug: result.slug,
    title: result.title?.rendered || pageTitle,
  };

  writeExportLog(projectRoot, slug, log);
  return log;
}
