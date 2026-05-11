import { generateContent } from "./generateContent";

const slug = "web-design-ecclesall";

generateContent(process.cwd(), slug)
  .then(() => console.log("Content generated"))
  .catch(console.error);
