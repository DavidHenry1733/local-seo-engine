import { generateQaReport } from "./generateQaReport";

const { reportPath, csvPath, count } = generateQaReport(process.cwd());

console.log(`Pages processed: ${count}`);
console.log(`JSON report:     ${reportPath}`);
console.log(`CSV report:      ${csvPath}`);
