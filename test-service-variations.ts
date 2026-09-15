import { getVariationSet } from "./src/local-seo/getVariationSet";

const tests = [
  ["web-design-ecclesall", "web-design"],
  ["local-seo-ecclesall", "local-seo"]
];

for (const [slug, service] of tests) {
  const v:any = getVariationSet(process.cwd(), slug, service);
  console.log("\\n" + service);
  console.log("template:", v.templateStyle);
  console.log("intro:", v.headingStyle.introHeading);
  console.log("local:", v.headingStyle.localHeading);
  console.log("faq:", v.selectedFaqs.join(" | "));
}
