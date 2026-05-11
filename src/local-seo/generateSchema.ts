import fs from "fs";
import path from "path";

type FaqItem = {
  question?: string;
  answer?: string;
};

type ContentData = {
  hero_title?: string;
  hero_subtitle?: string;
  intro?: string;
  local_section?: string;
  benefits?: string[];
  why_choose_us?: string;
  faq?: FaqItem[];
  cta?: string;
};

type PageData = {
  brand?: {
    name?: string;
    website?: string;
  };
  job?: {
    city?: string;
    area?: string;
  };
  service?: {
    service_name?: string;
    service_summary?: string;
  };
  location?: {
    area?: string;
    city?: string;
    county?: string;
    country?: string;
    nearby_areas?: string[];
  };
  page?: {
    slug?: string;
    primary_keyword?: string;
    title_seed?: string;
  };
};

type WordPressConfig = {
  siteUrl: string;
};

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function escapeJsonLd(value: unknown) {
  return value;
}

export function generateSchema(projectRoot: string, slug: string) {
  const contentPath = path.join(projectRoot, "output", slug, "content.json");
  const pageDataPath = path.join(projectRoot, "output", slug, "page-data.json");
  const wpConfigPath = path.join(projectRoot, "input", "wordpress.json");

  const content = readJsonFile<ContentData>(contentPath);
  const pageData = readJsonFile<PageData>(pageDataPath);
  const wpConfig = readJsonFile<WordPressConfig>(wpConfigPath);

  const siteUrl = wpConfig.siteUrl.replace(/\/+$/, "");
  const canonicalUrl = `${siteUrl}/${slug}/`;

  const brandName = pageData.brand?.name || "Our Business";
  const brandWebsite = pageData.brand?.website || siteUrl;
  const serviceName = pageData.service?.service_name || "Service";
  const area = pageData.location?.area || pageData.job?.area || "";
  const city = pageData.location?.city || pageData.job?.city || "";
  const county = pageData.location?.county || "";
  const country = pageData.location?.country || "United Kingdom";

  const title =
    content.hero_title ||
    pageData.page?.title_seed ||
    `${serviceName} in ${area}`;

  const description =
    content.hero_subtitle ||
    pageData.service?.service_summary ||
    `${serviceName} for businesses in ${area}, ${city}.`;

  const faqItems = Array.isArray(content.faq)
    ? content.faq.filter((item) => item?.question && item?.answer)
    : [];

  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: siteUrl
    },
    {
      "@type": "ListItem",
      position: 2,
      name: serviceName,
      item: `${siteUrl}/${serviceName.toLowerCase().replace(/\s+/g, "-")}/`
    },
    {
      "@type": "ListItem",
      position: 3,
      name: `${serviceName} ${area}`,
      item: canonicalUrl
    }
  ];

  const graph: any[] = [
    {
      "@type": "WebPage",
      "@id": `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      isPartOf: {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: brandName
      },
      breadcrumb: {
        "@id": `${canonicalUrl}#breadcrumb`
      }
    },
    {
      "@type": "Service",
      "@id": `${canonicalUrl}#service`,
      name: `${serviceName} in ${area}`,
      serviceType: serviceName,
      description:
        content.intro ||
        pageData.service?.service_summary ||
        description,
      areaServed: [
        {
          "@type": "Place",
          name: area
        },
        {
          "@type": "Place",
          name: city
        }
      ],
      provider: {
        "@type": "Organization",
        name: brandName,
        url: brandWebsite
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${canonicalUrl}#breadcrumb`,
      itemListElement: breadcrumbItems
    }
  ];

  if (faqItems.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${canonicalUrl}#faq`,
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    });
  }

  const schema = {
    "@context": "https://schema.org",
    "@graph": escapeJsonLd(graph)
  };

  const schemaJsonPath = path.join(projectRoot, "output", slug, "schema.json");
  const schemaInlinePath = path.join(projectRoot, "output", slug, "schema-inline.html");

  fs.writeFileSync(schemaJsonPath, JSON.stringify(schema, null, 2), "utf-8");
  fs.writeFileSync(
    schemaInlinePath,
    `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`,
    "utf-8"
  );

  console.log("Schema JSON created:", schemaJsonPath);
  console.log("Schema inline HTML created:", schemaInlinePath);

  return schema;
}
