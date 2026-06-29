#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const vite = await import(
  pathToFileURL(path.join(root, "node_modules/vite/dist/node/index.js")).href
);

const files = [
  "countries",
  "cities",
  "male_names",
  "female_names",
  "occupations",
  "interests",
  "bio_templates",
  "languages",
  "religions",
  "universities",
  "companies",
];

const server = await vite.createServer({
  root,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const mod = await server.ssrLoadModule("/src/lib/demo-users.functions.ts");
  let failed = false;

  for (const name of files) {
    const fileName = `${name}.csv`;
    const text = await readFile(path.join(root, "datasets", fileName), "utf8");
    const result = mod.parseDemoDatasetForImport(fileName, text, "auto");
    const invalidRows = result.errors.length;

    console.log(`\n${fileName}`);
    console.log(`  dataset type: ${result.datasetType}`);
    console.log(`  headers found: ${result.headers.join(", ")}`);
    console.log(`  parsed valid rows: ${result.items.length}`);
    console.log(`  invalid rows: ${invalidRows}`);
    console.log(`  rows not processed due import limit: ${result.truncatedRows}`);
    console.log(
      `  first 5 validation errors: ${result.errors.slice(0, 5).join(" | ") || "(none)"}`,
    );

    if (result.items.length === 0 || result.errors.length > 0) failed = true;
  }

  if (failed) process.exitCode = 1;
} finally {
  await server.close();
}
