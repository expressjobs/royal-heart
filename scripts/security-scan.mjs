#!/usr/bin/env node
/**
 * Targeted security re-scan.
 *
 * Runs the same focused database checks we hardened against, so every migration
 * can be re-verified in CI. Each check queries the live database for the
 * *offending* state — any returned rows are reported as findings and the
 * process exits non-zero so CI fails the build.
 *
 * Connection:
 *   - CI:    set SUPABASE_DB_URL (a Postgres connection string).
 *   - Local: relies on the standard PG* env vars / psql defaults.
 *
 * Requires the `psql` client to be on PATH (preinstalled on GitHub-hosted
 * ubuntu runners and in the Lovable sandbox).
 */
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const DB_URL = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? "";

/**
 * Each check returns rows that represent a problem. `format` turns a row
 * (tab-separated columns) into a human-readable finding line.
 */
const CHECKS = [
  {
    id: "definer_function_api_executable",
    title: "SECURITY DEFINER function in an API-exposed schema is executable by anon/authenticated",
    sql: `
      SELECT n.nspname AS schema,
             p.proname AS function,
             CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'anon ' ELSE '' END ||
             CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'authenticated' ELSE '' END AS roles
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.prosecdef
        AND n.nspname = 'public'
        AND (
          has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
        );
    `,
    format: (cols) =>
      `public.${cols[1]}() is SECURITY DEFINER and executable by: ${cols[2].trim()}`,
  },
  {
    id: "profile_photos_storage_block_bypass",
    title: "profile-photos storage SELECT policy does not enforce the block relationship",
    sql: `
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND cmd = 'SELECT'
        AND qual ILIKE '%profile-photos%'
        AND qual NOT ILIKE '%is_blocked%';
    `,
    format: (cols) =>
      `storage.objects SELECT policy "${cols[0]}" allows profile-photos reads without an is_blocked() check`,
  },
  {
    id: "public_table_without_rls",
    title: "Public table has Row Level Security disabled",
    sql: `
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity;
    `,
    format: (cols) => `public.${cols[0]} does not have RLS enabled`,
  },
];

function runSql(sql) {
  const args = ["-X", "-A", "-t", "-F", "\t", "-v", "ON_ERROR_STOP=1"];
  if (DB_URL) args.push(DB_URL);
  args.push("-c", sql);
  const res = spawnSync("psql", args, { encoding: "utf8" });
  if (res.error) {
    throw new Error(`Failed to run psql: ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(`psql exited with code ${res.status}:\n${res.stderr.trim()}`);
  }
  return res.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split("\t"));
}

function main() {
  console.log("🔒 Running targeted security re-scan...\n");
  const findings = [];

  for (const check of CHECKS) {
    process.stdout.write(`• ${check.id} ... `);
    let rows;
    try {
      rows = runSql(check.sql);
    } catch (err) {
      console.log("ERROR");
      console.error(`\n${err.message}\n`);
      process.exit(2);
    }
    if (rows.length === 0) {
      console.log("ok");
    } else {
      console.log(`${rows.length} finding(s)`);
      for (const row of rows) {
        findings.push({ check: check.id, title: check.title, detail: check.format(row) });
      }
    }
  }

  console.log("");
  if (findings.length === 0) {
    console.log("✅ No security findings. All targeted checks passed.");
    process.exit(0);
  }

  console.log(`❌ ${findings.length} security finding(s) detected:\n`);
  for (const f of findings) {
    console.log(`  [${f.check}] ${f.title}`);
    console.log(`      ↳ ${f.detail}`);
  }

  // Emit a GitHub Actions step summary when running in CI.
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = [
      "## 🔒 Security re-scan: findings detected",
      "",
      "| Check | Detail |",
      "| --- | --- |",
      ...findings.map((f) => `| \`${f.check}\` | ${f.detail} |`),
      "",
    ].join("\n");
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
    } catch {
      /* ignore summary write errors */
    }
  }

  process.exit(1);
}

main();
