import { generateSchema } from "./generateSchema";

const slug = "web-design-ecclesall";

try {
  generateSchema(process.cwd(), slug);
  console.log("Schema generation complete");
} catch (error) {
  console.error("Schema generation failed");
  console.error(error);
}
