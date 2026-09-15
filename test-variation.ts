import { getVariationSet } from "./src/local-seo/getVariationSet";

const slugs = [
  "web-design-ecclesall",
  "web-design-fulwood",
  "web-design-hillsborough"
];

for (const slug of slugs) {
  const v:any = getVariationSet(process.cwd(), slug, "web-design");
  console.log(slug, "=>", v.templateStyle);
}
