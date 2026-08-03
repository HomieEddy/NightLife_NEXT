/**
 * Migration hygiene check.
 *
 * Diffs schema.prisma model names against migration SQLs and reports any model
 * that lacks a CREATE TABLE. Exits non-zero if gaps are found so it can gate CI
 * (plan 36). Run: npx tsx scripts/check-migration-hygiene.ts
 *
 * Per AGENTS.md appendix: five models (SessionNote, BarTab, VipTierBenefit,
 * AttentionItem, AttentionAcknowledgment) shipped without CREATE TABLE during
 * Phase 7 and only failed at runtime. This script prevents that class of bug.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const schemaPath = path.resolve("prisma/schema.prisma");
const migrationsDir = path.resolve("prisma/migrations");

// ── Extract modelName → tableName from schema.prisma ──────────────

function parseModelTableMap(): Map<string, string> {
  const src = fs.readFileSync(schemaPath, "utf-8");
  const map = new Map<string, string>();

  // Match model blocks — handle nested braces by counting depth.
  const modelRe = /^model\s+(\w+)\s*\{/gm;
  let match: RegExpExecArray | null;
  while ((match = modelRe.exec(src)) !== null) {
    const modelName = match[1];
    const blockStart = match.index + match[0].length - 1; // position of opening {
    const block = extractBlock(src, blockStart);

    // @@map("table_name") override
    const mapMatch = block.match(/@@map\("(\w+)"\)/);
    if (mapMatch) {
      map.set(modelName, mapMatch[1]);
    } else {
      // Default: PascalCase → snake_case (simple heuristic — insert _ before
      // uppercase letters that follow lowercase, then lowercase all).
      const snake = modelName
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .toLowerCase();
      map.set(modelName, snake);
    }
  }

  return map;
}

/** Extract balanced { … } block starting at openBrace index. */
function extractBlock(src: string, openBrace: number): string {
  let depth = 1;
  let i = openBrace + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    i++;
  }
  return src.slice(openBrace + 1, i - 1);
}

// ── Collect table names from all migration SQLs ──────────────────

function collectMigrationTables(): Set<string> {
  const tables = new Set<string>();
  const dirs = fs.readdirSync(migrationsDir, { withFileTypes: true });
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const sql = path.join(migrationsDir, d.name, "migration.sql");
    if (!fs.existsSync(sql)) continue;
    const content = fs.readFileSync(sql, "utf-8");

    // Match CREATE TABLE [IF NOT EXISTS] ["table"] (
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?\s*\(/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      tables.add(m[1]);
    }
  }
  return tables;
}

// ── Main ─────────────────────────────────────────────────────────

const modelTable = parseModelTableMap();
const existing = collectMigrationTables();

const missing: string[] = [];
for (const [model, table] of modelTable) {
  if (!existing.has(table)) {
    missing.push(`${model} (mapped to "${table}")`);
  }
}

console.log(`${modelTable.size} models in schema, ${existing.size} tables in migrations.`);

if (missing.length > 0) {
  console.error(`\nMISSING CREATE TABLE for ${missing.length} model(s):`);
  for (const m of missing) console.error(`  - ${m}`);
  console.error(
    "\nAdd a migration with CREATE TABLE for each missing model.",
  );
  process.exit(1);
}

console.log("All models have a CREATE TABLE. Migration hygiene OK.");
