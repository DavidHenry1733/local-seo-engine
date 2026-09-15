import type { BlogArticle } from "./generateBlogArticle";

export interface BlogAudit {
  passed: boolean;
  wordCount: number;
  schemaValid: boolean;
  checks: Record<string, boolean>;
  issues: string[];
}

function countWords(value: string): number {
  return (value.match(/\b[\w'-]+\b/g) ?? []).length;
}

function allText(article: BlogArticle): string {
  return [
    article.title,
    article.h1,
    article.metaTitle,
    article.metaDescription,
    article.excerpt,
    ...article.intro,
    ...article.sections.flatMap((section) => [section.heading, ...section.body]),
    article.localRelevance.heading,
    ...article.localRelevance.body,
    ...article.faq.flatMap((item) => [item.question, item.answer]),
    article.cta.heading,
    article.cta.body,
    article.aiSummary,
  ].join(" ");
}

function schemaValid(article: BlogArticle): boolean {
  return article.schema["@context"] === "https://schema.org"
    && article.schema["@type"] === "BlogPosting"
    && typeof article.schema.headline === "string"
    && typeof article.schema.description === "string"
    && typeof article.schema.url === "string";
}

export function auditBlogArticle(article: BlogArticle): BlogAudit {
  const wordCount = countWords(allText(article));
  const checks = {
    title: article.title.length > 20,
    slug: /^[a-z0-9-]+$/.test(article.slug),
    h1: article.h1.length > 20,
    metaTitle: article.metaTitle.length > 30 && article.metaTitle.length <= 70,
    metaDescription: article.metaDescription.length > 90 && article.metaDescription.length <= 170,
    excerpt: article.excerpt.length > 50,
    intro: article.intro.length >= 2,
    image: Boolean(article.image?.src && article.image.alt),
    contentSections: article.sections.length >= 4 && article.sections.length <= 6,
    localRelevance: article.localRelevance.body.join(" ").length > 120,
    faq: article.faq.length >= 3,
    cta: Boolean(article.cta.heading && article.cta.body && article.cta.href),
    parentHubLink: Boolean(article.internalLinkPlan.parentHub.href),
    clusterLinks: article.internalLinkPlan.clusterLinks.length >= 2 && article.internalLinkPlan.clusterLinks.length <= 4,
    relatedServiceLinks: article.internalLinkPlan.relatedServiceLinks.length >= 1 && article.internalLinkPlan.relatedServiceLinks.length <= 2,
    schema: schemaValid(article),
    aiSummary: article.aiSummary.length > 80,
    gbpPostDraft: article.gbpPostDraft.length > 120,
    socialPostDrafts: Boolean(article.socialPostDrafts.facebook && article.socialPostDrafts.linkedin && article.socialPostDrafts.x),
    youtubeScriptDraft: article.youtubeScriptDraft.length > 240,
  };
  const issues = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `Failed check: ${name}`);

  return {
    passed: issues.length === 0,
    wordCount,
    schemaValid: checks.schema,
    checks,
    issues,
  };
}
