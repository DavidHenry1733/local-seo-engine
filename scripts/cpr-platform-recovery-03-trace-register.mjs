/**
 * CPR-PLATFORM-RECOVERY-03 — register runtime execution trace loader (validation only).
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./cpr-platform-recovery-03-trace-loader.mjs", import.meta.url);
