#!/usr/bin/env npx tsx
/**
 * NT-E2E-27A — Master Admin embedded script parse validation.
 * Browser-equivalent: TS parse + VM compile + block-scoped lexical duplicate scan.
 */
import ts from "typescript";
import { renderMasterAdminPlatformShell } from "../artifacts/api-server/src/routes/masterAdminPlatformPage.ts";

interface ScriptBlock {
  index: number;
  htmlLine: number;
  chars: number;
  js: string;
}

function extractScriptBlocks(html: string): ScriptBlock[] {
  const blocks: ScriptBlock[] = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const htmlLine = html.slice(0, m.index).split("\n").length;
    blocks.push({
      index: blocks.length + 1,
      htmlLine,
      chars: m[1].length,
      js: m[1],
    });
  }
  if (!blocks.length) throw new Error("Embedded script not found");
  return blocks;
}

function validateRuntimeCompile(js: string): void {
  // eslint-disable-next-line no-new-func
  new Function(js);
}

/** Scan each block/catch/function body independently — not whole-function scope. */
function findDuplicateLexicalDeclarations(js: string): string[] {
  const sf = ts.createSourceFile("master.js", js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const issues: string[] = [];

  function scanBlock(block: ts.Node) {
    const decls = new Map<string, number>();

    function walk(n: ts.Node) {
      if (n !== block && (ts.isBlock(n) || ts.isCatchClause(n) || ts.isFunctionLike(n))) return;
      if (ts.isVariableStatement(n)) {
        const list = n.declarationList;
        const isLexical = (list.flags & ts.NodeFlags.Let) !== 0 || (list.flags & ts.NodeFlags.Const) !== 0;
        if (isLexical) {
          for (const d of list.declarations) {
            if (ts.isIdentifier(d.name)) {
              const name = d.name.text;
              decls.set(name, (decls.get(name) || 0) + 1);
            }
          }
        }
      }
      ts.forEachChild(n, walk);
    }

    walk(block);
    for (const [name, count] of decls) {
      if (count > 1) {
        const pos = sf.getLineAndCharacterOfPosition(block.getStart());
        issues.push(`Duplicate lexical declaration '${name}' (${count}x) in block scope near line ${pos.line + 1}`);
      }
    }
  }

  function visit(n: ts.Node) {
    if (ts.isBlock(n)) scanBlock(n);
    else if (ts.isCatchClause(n) && n.block) scanBlock(n.block);
    else if (ts.isFunctionLike(n) && n.body && ts.isBlock(n.body)) scanBlock(n.body);
    ts.forEachChild(n, visit);
  }

  visit(sf);
  return issues;
}

function findStaleCprReferences(js: string): string[] {
  const issues: string[] = [];
  if (/\batCpr\b(?!Journey|Mode)/.test(js)) issues.push("Stale bare atCpr reference");
  if (/\batCprMode\b/.test(js)) issues.push("Stale atCprMode reference (use customerInCprMode)");
  if (!js.includes("customerInCprMode")) issues.push("Missing customerInCprMode declaration in rendered script");
  return issues;
}

const html = renderMasterAdminPlatformShell();
const blocks = extractScriptBlocks(html);
const blockReports: Array<Record<string, unknown>> = [];
let tsOk = true;
let runtimeOk = true;
let runtimeError = "";
let dupes: string[] = [];
let staleCpr: string[] = [];

for (const block of blocks) {
  const sf = ts.createSourceFile(`master-${block.index}.js`, block.js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const diags = sf.parseDiagnostics || [];
  const blockTsOk = diags.length === 0;
  let blockRuntimeOk = true;
  let blockRuntimeError = "";
  try {
    validateRuntimeCompile(block.js);
  } catch (e) {
    blockRuntimeOk = false;
    blockRuntimeError = e instanceof Error ? e.message : String(e);
  }
  const blockDupes = findDuplicateLexicalDeclarations(block.js);
  const blockStale = findStaleCprReferences(block.js);
  tsOk = tsOk && blockTsOk;
  runtimeOk = runtimeOk && blockRuntimeOk;
  if (!blockRuntimeOk && !runtimeError) runtimeError = blockRuntimeError;
  dupes = dupes.concat(blockDupes);
  staleCpr = staleCpr.concat(blockStale);
  blockReports.push({
    scriptBlock: block.index,
    startingHtmlLine: block.htmlLine,
    characterCount: block.chars,
    parseResult: blockTsOk ? "PASS" : "FAIL",
    compileResult: blockRuntimeOk ? "PASS" : "FAIL",
    firstFailingLine: diags[0]
      ? sf.getLineAndCharacterOfPosition(diags[0].start ?? 0).line + 1
      : blockRuntimeOk
        ? null
        : blockRuntimeError,
    duplicateLexicalDeclarations: blockDupes,
    staleCprReferences: blockStale,
  });
}

const ok = tsOk && runtimeOk && dupes.length === 0 && staleCpr.length === 0;
console.log(
  JSON.stringify(
    {
      ok,
      embeddedJavaScriptParse: ok ? "PASS" : "FAIL",
      browserEquivalentCompile: runtimeOk ? "PASS" : "FAIL",
      undeclaredIdentifierValidation: staleCpr.length === 0 ? "PASS" : "FAIL",
      tsParseOk: tsOk,
      runtimeCompileOk: runtimeOk,
      runtimeError: runtimeError || null,
      duplicateLexicalDeclarations: dupes,
      staleCprReferences: staleCpr,
      scriptBlocks: blockReports,
      scriptLines: blocks.reduce((n, b) => n + b.js.split("\n").length, 0),
    },
    null,
    2,
  ),
);
process.exit(ok ? 0 : 1);
