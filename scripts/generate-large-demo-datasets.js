#!/usr/bin/env node
/**
 * HeartConnect real-world demo dataset generator.
 *
 * This script downloads openly licensed public datasets, caches the raw
 * responses, normalizes them, and writes import-ready CSV and JSON files.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATASET_DIR = path.join(ROOT_DIR, "datasets");
const CACHE_DIR = path.join(DATASET_DIR, ".cache");

const GEO_NAMES_CITIES_URL = "https://download.geonames.org/export/dump/cities5000.zip";
const SSA_NAMES_URL = "https://www.ssa.gov/oact/babynames/names.zip";
const POPULAR_NAMES_BY_COUNTRY_URL =
  "https://raw.githubusercontent.com/sigpwned/popular-names-by-country-dataset/main/common-forenames-by-country.csv";
const COUNTRIES_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";
const CORPORA_OCCUPATIONS_URL =
  "https://raw.githubusercontent.com/dariusk/corpora/master/data/humans/occupations.json";
const CORPORA_RELIGIONS_URL =
  "https://raw.githubusercontent.com/dariusk/corpora/master/data/religion/religions.json";
const LANGUAGE_LIST_URL =
  "https://raw.githubusercontent.com/umpirsky/language-list/master/data/en/language.json";
const HIPO_UNIVERSITIES_URL =
  "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json";
const DATAHUB_SP500_URL =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv";
const DATAHUB_NASDAQ_URL =
  "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed-symbols.csv";
const CORPORA_INTEREST_URLS = [
  ["sports", "https://raw.githubusercontent.com/dariusk/corpora/master/data/sports/sports.json"],
  ["food", "https://raw.githubusercontent.com/dariusk/corpora/master/data/foods/menuItems.json"],
  ["music", "https://raw.githubusercontent.com/dariusk/corpora/master/data/music/genres.json"],
  ["games", "https://raw.githubusercontent.com/dariusk/corpora/master/data/games/board_games.json"],
  ["art", "https://raw.githubusercontent.com/dariusk/corpora/master/data/art/isms.json"],
  [
    "film",
    "https://raw.githubusercontent.com/dariusk/corpora/master/data/film-tv/popular-movies.json",
  ],
  ["travel", "https://raw.githubusercontent.com/dariusk/corpora/master/data/travel/lcc.json"],
];
const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "HeartConnectDemoDatasetGenerator/1.0 (open-data normalization)";

const DEFAULT_OPTIONS = {
  profiles: 0,
  maxCities: 250000,
  maxWikidataRows: 12000,
  skipWikidata: false,
  refresh: false,
};

const COUNTRY_PRIORITY = new Set([
  "KE",
  "UG",
  "TZ",
  "RW",
  "ET",
  "NG",
  "GH",
  "ZA",
  "EG",
  "MA",
  "US",
  "CA",
  "MX",
  "BR",
  "AR",
  "GB",
  "IE",
  "FR",
  "DE",
  "IT",
  "ES",
  "NL",
  "SE",
  "NO",
  "FI",
  "PL",
  "RU",
  "IN",
  "PK",
  "BD",
  "CN",
  "JP",
  "KR",
  "PH",
  "ID",
  "AU",
  "NZ",
  "AE",
  "SA",
  "QA",
  "TR",
]);

const WIKIDATA_QUERIES = {
  names: `
SELECT ?item ?itemLabel ?genderLabel ?country ?countryLabel ?iso2 WHERE {
  VALUES ?class { wd:Q202444 wd:Q11879590 }
  ?item wdt:P31/wdt:P279* ?class.
  OPTIONAL { ?item wdt:P495 ?country. ?country wdt:P297 ?iso2. }
  OPTIONAL { ?item wdt:P21 ?gender. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  FILTER(STRSTARTS(STR(?item), "http://www.wikidata.org/entity/Q"))
  FILTER(LANG(?itemLabel) = "en")
}
ORDER BY ?itemLabel
LIMIT {{LIMIT}}`,
  occupations: `
SELECT DISTINCT ?item ?itemLabel WHERE {
  { ?item wdt:P279* wd:Q28640. } UNION { ?item wdt:P31/wdt:P279* wd:Q28640. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  FILTER(STRSTARTS(STR(?item), "http://www.wikidata.org/entity/Q"))
  FILTER(LANG(?itemLabel) = "en")
}
ORDER BY ?itemLabel
LIMIT {{LIMIT}}`,
  interests: `
SELECT DISTINCT ?item ?itemLabel ?typeLabel WHERE {
  VALUES ?type { wd:Q47728 wd:Q349 wd:Q735 wd:Q11410 wd:Q31629 wd:Q1914636 wd:Q173873 }
  { ?item wdt:P279* ?type. } UNION { ?item wdt:P31/wdt:P279* ?type. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  FILTER(STRSTARTS(STR(?item), "http://www.wikidata.org/entity/Q"))
  FILTER(LANG(?itemLabel) = "en")
}
ORDER BY ?itemLabel
LIMIT {{LIMIT}}`,
  universities: `
SELECT DISTINCT ?item ?itemLabel ?countryLabel ?iso2 WHERE {
  { ?item wdt:P279* wd:Q3918. } UNION { ?item wdt:P31/wdt:P279* wd:Q3918. }
  OPTIONAL { ?item wdt:P17 ?country. ?country wdt:P297 ?iso2. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  FILTER(STRSTARTS(STR(?item), "http://www.wikidata.org/entity/Q"))
  FILTER(LANG(?itemLabel) = "en")
}
ORDER BY ?itemLabel
LIMIT {{LIMIT}}`,
  companies: `
SELECT DISTINCT ?item ?itemLabel ?countryLabel ?iso2 WHERE {
  { ?item wdt:P279* wd:Q4830453. } UNION { ?item wdt:P31/wdt:P279* wd:Q4830453. }
  OPTIONAL { ?item wdt:P17 ?country. ?country wdt:P297 ?iso2. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  FILTER(STRSTARTS(STR(?item), "http://www.wikidata.org/entity/Q"))
  FILTER(LANG(?itemLabel) = "en")
}
ORDER BY ?itemLabel
LIMIT {{LIMIT}}`,
  religions: `
SELECT DISTINCT ?item ?itemLabel WHERE {
  { ?item wdt:P279* wd:Q9174. } UNION { ?item wdt:P31/wdt:P279* wd:Q9174. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  FILTER(STRSTARTS(STR(?item), "http://www.wikidata.org/entity/Q"))
  FILTER(LANG(?itemLabel) = "en")
}
ORDER BY ?itemLabel
LIMIT {{LIMIT}}`,
  languages: `
SELECT DISTINCT ?item ?itemLabel ?iso6391 ?iso6392 WHERE {
  { ?item wdt:P279* wd:Q34770. } UNION { ?item wdt:P31/wdt:P279* wd:Q34770. }
  OPTIONAL { ?item wdt:P218 ?iso6391. }
  OPTIONAL { ?item wdt:P219 ?iso6392. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  FILTER(STRSTARTS(STR(?item), "http://www.wikidata.org/entity/Q"))
  FILTER(LANG(?itemLabel) = "en")
}
ORDER BY ?itemLabel
LIMIT {{LIMIT}}`,
};

const BIO_PARTS = {
  openings: [
    "Coffee lover",
    "Weekend explorer",
    "Grounded optimist",
    "Curious traveler",
    "Family-oriented professional",
    "Quietly ambitious",
    "Kind-hearted creative",
    "Active and easygoing",
  ],
  values: [
    "honesty",
    "faithfulness",
    "laughter",
    "meaningful conversations",
    "emotional maturity",
    "kindness",
    "shared purpose",
    "steady communication",
  ],
  goals: [
    "a serious relationship",
    "a lasting partnership",
    "a thoughtful connection",
    "someone ready to build intentionally",
    "a relationship rooted in trust",
    "a calm, loyal kind of love",
  ],
  travel: [
    "city breaks",
    "coastal weekends",
    "road trips",
    "new restaurants",
    "national parks",
    "quiet staycations",
    "cultural festivals",
  ],
};

const PROFILE_INTEREST_ALLOWLIST = new Set(
  [
    "Hiking",
    "Football",
    "Soccer",
    "Basketball",
    "Tennis",
    "Running",
    "Cycling",
    "Swimming",
    "Dancing",
    "Yoga",
    "Pilates",
    "Boxing",
    "Martial Arts",
    "Aikido",
    "Karate",
    "Taekwondo",
    "Judo",
    "Lacrosse",
    "Volleyball",
    "Baseball",
    "Rugby",
    "Golf",
    "Skiing",
    "Snowboarding",
    "Climbing",
    "Canoeing",
    "Kayaking",
    "Sailing",
    "Surfing",
    "Chess",
    "Board Games",
    "Scrabble",
    "Music",
    "Jazz",
    "Blues",
    "Soul",
    "Reggae",
    "Hip Hop",
    "Classical",
    "Rock",
    "Pop",
    "Folk",
    "Country",
    "Photography",
    "Art",
    "Drawing",
    "Painting",
    "Theatre",
    "Ballet",
    "Opera",
    "Gardening",
    "Camping",
    "Meditation",
    "Volunteering",
  ].map((value) => value.toLowerCase()),
);

function parseArgs() {
  const options = { ...DEFAULT_OPTIONS };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--refresh") options.refresh = true;
    if (arg === "--skip-wikidata") options.skipWikidata = true;
    if (arg === "--help" || arg === "-h") options.help = true;
    if (arg.startsWith("--profiles=")) options.profiles = Number(arg.split("=")[1]) || 0;
    if (arg.startsWith("--max-cities="))
      options.maxCities = Number(arg.split("=")[1]) || options.maxCities;
    if (arg.startsWith("--max-wikidata-rows=")) {
      options.maxWikidataRows = Number(arg.split("=")[1]) || options.maxWikidataRows;
    }
  }
  return options;
}

function printHelp() {
  console.log(`
HeartConnect dataset generator

Usage:
  node scripts/generate-large-demo-datasets.js [options]

Options:
  --profiles=100000          Also generate demo_profiles.csv/json
  --max-cities=250000        Maximum GeoNames city rows to normalize
  --max-wikidata-rows=12000  Per-query Wikidata row limit
  --skip-wikidata            Do not query Wikidata; use local/cached sources only
  --refresh                  Re-download cached public sources
  --help                     Show this help
`);
}

async function ensureDirs() {
  await mkdir(DATASET_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });
}

function logStep(message) {
  console.log(`\n== ${message}`);
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

function titleCase(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\b[\p{L}'-]/gu, (char) => char.toUpperCase());
}

function slug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cachePath(name) {
  return path.join(CACHE_DIR, name);
}

async function fetchWithCache(name, url, options = {}) {
  const target = cachePath(name);
  if (!options.refresh && existsSync(target)) {
    console.log(`cache hit: ${name}`);
    return readFile(target);
  }

  console.log(`downloading: ${url}`);
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: options.accept ?? "*/*",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength < 100)
    throw new Error(`Downloaded ${url} but response was unexpectedly small`);
  await writeFile(target, bytes);
  return bytes;
}

async function fetchJsonWithCache(name, url, options) {
  const bytes = await fetchWithCache(name, url, { ...options, accept: "application/json" });
  const json = JSON.parse(bytes.toString("utf8"));
  if (options?.validate && !options.validate(json)) {
    throw new Error(
      `Cached or downloaded JSON for ${name} did not match the expected source shape`,
    );
  }
  return json;
}

async function fetchWikidataRows(key, query, limit, refresh) {
  const cacheName = `wikidata-${key}-${limit}.json`;
  const cached = cachePath(cacheName);
  if (!refresh && existsSync(cached)) {
    console.log(`cache hit: ${cacheName}`);
    return JSON.parse(await readFile(cached, "utf8"));
  }

  console.log(`querying Wikidata: ${key}`);
  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(
    query.replace("{{LIMIT}}", String(limit)),
  )}&format=json`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/sparql-results+json, application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Wikidata ${key} query failed: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  const rows = payload.results.bindings.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([column, cell]) => [column, cleanText(cell.value)]),
    ),
  );
  await writeFile(cached, JSON.stringify(rows, null, 2), "utf8");
  return rows;
}

function dedupeBy(rows, keyFn) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = keyFn(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function sortPriorityCountries(rows) {
  return rows.sort((a, b) => {
    const ap = COUNTRY_PRIORITY.has(a.iso2) ? 0 : 1;
    const bp = COUNTRY_PRIORITY.has(b.iso2) ? 0 : 1;
    return ap - bp || a.name.localeCompare(b.name);
  });
}

function toCsvValue(value) {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.map(cleanText);
}

function extractStrings(value, strings = []) {
  if (typeof value === "string") strings.push(value);
  if (Array.isArray(value)) value.forEach((item) => extractStrings(item, strings));
  if (value && typeof value === "object") {
    Object.entries(value)
      .filter(([key]) => !["description", "source", "license"].includes(key))
      .forEach(([, item]) => extractStrings(item, strings));
  }
  return strings;
}

async function writeDataset(name, rows) {
  if (!rows.length) throw new Error(`${name} normalized to zero rows`);
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => toCsvValue(row[h])).join(",")),
  ].join("\n");
  await writeFile(path.join(DATASET_DIR, `${name}.csv`), `${csv}\n`, "utf8");
  await writeFile(path.join(DATASET_DIR, `${name}.json`), JSON.stringify(rows, null, 2), "utf8");
  console.log(`wrote ${name}: ${rows.length.toLocaleString()} rows`);
}

function normalizeCountries(rawCountries) {
  const rows = rawCountries
    .map((country) => ({
      iso2: cleanText(country.cca2).toUpperCase(),
      iso3: cleanText(country.cca3).toUpperCase(),
      name: cleanText(country.name?.common),
      official_name: cleanText(country.name?.official),
      region: cleanText(country.region),
      subregion: cleanText(country.subregion),
      capital: cleanText(country.capital?.[0]),
      latitude: country.latlng?.[0] ?? "",
      longitude: country.latlng?.[1] ?? "",
      population: country.population ?? "",
      languages: Object.values(country.languages ?? {})
        .map(cleanText)
        .sort()
        .join("|"),
      priority_market: COUNTRY_PRIORITY.has(cleanText(country.cca2).toUpperCase()) ? "yes" : "no",
      source: "mledoze/countries",
    }))
    .filter((row) => row.iso2 && row.name);
  return sortPriorityCountries(dedupeBy(rows, (row) => row.iso2));
}

async function normalizeCities(refresh, maxRows) {
  const zipBytes = await fetchWithCache("geonames-cities5000.zip", GEO_NAMES_CITIES_URL, {
    refresh,
  });
  const zip = await JSZip.loadAsync(zipBytes);
  const txt = await zip.file("cities5000.txt").async("string");
  const rows = [];

  for (const line of txt.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const population = Number(parts[14]) || 0;
    const country = cleanText(parts[8]).toUpperCase();
    const name = cleanText(parts[1]);
    if (!country || !name) continue;
    rows.push({
      geoname_id: cleanText(parts[0]),
      name,
      ascii_name: cleanText(parts[2]),
      country_iso2: country,
      state_province: cleanText(parts[10]),
      latitude: cleanText(parts[4]),
      longitude: cleanText(parts[5]),
      population,
      timezone: cleanText(parts[17]),
      source: "GeoNames cities5000",
    });
  }

  rows.sort((a, b) => {
    const ap = COUNTRY_PRIORITY.has(a.country_iso2) ? 0 : 1;
    const bp = COUNTRY_PRIORITY.has(b.country_iso2) ? 0 : 1;
    return ap - bp || b.population - a.population || a.name.localeCompare(b.name);
  });
  return dedupeBy(
    rows.slice(0, maxRows),
    (row) => `${row.country_iso2}:${row.state_province}:${row.name}`,
  );
}

function normalizeNames(rows) {
  const male = [];
  const female = [];
  for (const row of rows) {
    const name = titleCase(row.itemLabel);
    if (!/^[\p{L}' -]{2,}$/u.test(name)) continue;
    const country = cleanText(row.iso2).toUpperCase();
    const gender = row.genderLabel.toLowerCase();
    const normalized = {
      name,
      country_iso2: country || "GLOBAL",
      popularity_count: "",
      source_item: row.item,
      source: "Wikidata",
    };
    if (gender.includes("male")) male.push(normalized);
    if (gender.includes("female")) female.push(normalized);
    if (!gender) {
      male.push({ ...normalized, country_iso2: country || "GLOBAL" });
      female.push({ ...normalized, country_iso2: country || "GLOBAL" });
    }
  }
  return {
    male: dedupeBy(male, (row) => `${row.country_iso2}:${row.name}`),
    female: dedupeBy(female, (row) => `${row.country_iso2}:${row.name}`),
  };
}

async function normalizeSsaNames(refresh) {
  const zipBytes = await fetchWithCache("ssa-baby-names.zip", SSA_NAMES_URL, { refresh });
  const zip = await JSZip.loadAsync(zipBytes);
  const totals = new Map();

  for (const [filename, file] of Object.entries(zip.files)) {
    if (!/^yob\d{4}\.txt$/.test(filename)) continue;
    const year = Number(filename.match(/\d{4}/)?.[0]);
    if (year < 1960) continue;
    const text = await file.async("string");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const [rawName, gender, rawCount] = line.split(",");
      const name = titleCase(rawName);
      const count = Number(rawCount) || 0;
      if (!name || count < 25) continue;
      const key = `${gender}:${name}`;
      totals.set(key, (totals.get(key) ?? 0) + count);
    }
  }

  const rows = [...totals.entries()]
    .map(([key, count]) => {
      const [gender, name] = key.split(":");
      return {
        name,
        country_iso2: "US",
        popularity_count: count,
        source_item: "",
        source: "US Social Security Administration baby names",
        gender,
      };
    })
    .sort((a, b) => b.popularity_count - a.popularity_count);

  return {
    male: rows.filter((row) => row.gender === "M").map(({ gender, ...row }) => row),
    female: rows.filter((row) => row.gender === "F").map(({ gender, ...row }) => row),
  };
}

async function normalizePopularNamesByCountry(refresh) {
  const text = (
    await fetchWithCache("popular-names-by-country.csv", POPULAR_NAMES_BY_COUNTRY_URL, {
      refresh,
      accept: "text/csv,text/plain",
    })
  ).toString("utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift() ?? "");
  const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  const male = [];
  const female = [];

  for (const line of lines) {
    const cells = parseCsvLine(line);
    const gender = cleanText(cells[index.Gender]).toUpperCase();
    const localizedName = cleanText(cells[index["Localized Name"]]);
    const romanizedName = cleanText(cells[index["Romanized Name"]]);
    const name = romanizedName || localizedName;
    const countryIso2 = cleanText(cells[index.Country]).toUpperCase();
    if (!countryIso2 || !name || !/^[\p{L}\p{M}' .-]{2,}$/u.test(name)) continue;
    const row = {
      name: titleCase(name),
      country_iso2: countryIso2,
      popularity_count: cleanText(cells[index.Index]),
      source_item: cleanText(cells[index["Name Group"]]),
      source: "sigpwned popular-names-by-country-dataset",
    };
    if (gender === "M") male.push(row);
    if (gender === "F") female.push(row);
  }

  return {
    male: dedupeBy(male, (row) => `${row.country_iso2}:${row.name}`),
    female: dedupeBy(female, (row) => `${row.country_iso2}:${row.name}`),
  };
}

function normalizeSimple(rows, nameField, extra = () => ({})) {
  return dedupeBy(
    rows
      .map((row) => ({
        name: titleCase(row[nameField]),
        ...extra(row),
        source_item: row.item,
        source: "Wikidata",
      }))
      .filter((row) => row.name && row.name.length > 1 && !/^Q\d+$/.test(row.name)),
    (row) => slug(`${row.name}:${row.country_iso2 ?? ""}:${row.iso6391 ?? ""}`),
  );
}

async function normalizeCorporaOccupations(refresh) {
  const json = await fetchJsonWithCache("corpora-occupations.json", CORPORA_OCCUPATIONS_URL, {
    refresh,
  });
  return dedupeBy(
    extractStrings(json)
      .map((name) => ({
        name: titleCase(name),
        source_item: "",
        source: "dariusk/corpora occupations",
      }))
      .filter(
        (row) =>
          row.name && !["A List Of Occupations Jobs That People Might Have"].includes(row.name),
      ),
    (row) => slug(row.name),
  );
}

async function normalizeCorporaInterests(refresh) {
  const rows = [];
  for (const [category, url] of CORPORA_INTEREST_URLS) {
    try {
      const json = await fetchJsonWithCache(`corpora-interests-${category}.json`, url, { refresh });
      for (const value of extractStrings(json)) {
        const name = titleCase(value);
        if (!name || name.length < 3 || name.length > 80) continue;
        rows.push({
          name,
          category,
          source_item: "",
          source: `dariusk/corpora ${category}`,
        });
      }
    } catch (error) {
      console.warn(`warning: interest source ${category} skipped: ${error.message}`);
    }
  }
  return dedupeBy(rows, (row) => slug(`${row.category}:${row.name}`));
}

async function normalizeCorporaReligions(refresh) {
  const json = await fetchJsonWithCache("corpora-religions.json", CORPORA_RELIGIONS_URL, {
    refresh,
  });
  return dedupeBy(
    extractStrings(json)
      .map((name) => ({
        name: titleCase(name),
        source_item: "",
        source: "dariusk/corpora religions",
      }))
      .filter((row) => row.name && row.name.length > 1),
    (row) => slug(row.name),
  );
}

async function normalizeLanguageList(refresh) {
  const json = await fetchJsonWithCache("language-list-en.json", LANGUAGE_LIST_URL, { refresh });
  return Object.entries(json).map(([code, name]) => ({
    name: titleCase(name),
    iso6391: code.length === 2 ? code : "",
    iso6392: code.length === 3 ? code : "",
    source_item: "",
    source: "umpirsky/language-list",
  }));
}

async function normalizeHipoUniversities(refresh, countries) {
  const countryByName = new Map(
    countries.map((country) => [country.name.toLowerCase(), country.iso2]),
  );
  const json = await fetchJsonWithCache("hipo-universities.json", HIPO_UNIVERSITIES_URL, {
    refresh,
    validate: (rows) => Array.isArray(rows),
  });
  return dedupeBy(
    json
      .map((row) => ({
        name: cleanText(row.name),
        country_iso2:
          cleanText(row["alpha_two_code"]).toUpperCase() ||
          countryByName.get(cleanText(row.country).toLowerCase()) ||
          "GLOBAL",
        domains: (row.domains ?? []).map(cleanText).join("|"),
        web_pages: (row.web_pages ?? []).map(cleanText).join("|"),
        source_item: "",
        source: "Hipo university-domains-list",
      }))
      .filter((row) => row.name),
    (row) => slug(`${row.country_iso2}:${row.name}`),
  );
}

function cleanCompanyName(value) {
  return cleanText(value)
    .replace(
      /\s+-\s+(Common Stock|Class [A-Z] .*|Ordinary Shares|American Depositary Shares|Units|Warrants?).*$/i,
      "",
    )
    .replace(/\s+(Inc\.?|Corporation|Corp\.?|Company|Co\.?|Ltd\.?|Limited|plc|N\.V\.)$/i, (match) =>
      match.trim(),
    )
    .trim();
}

async function normalizeCompanyCsv(refresh) {
  const sources = [
    ["datahub-s-and-p-500.csv", DATAHUB_SP500_URL, "DataHub S&P 500 companies", "Security"],
    ["datahub-nasdaq-listed.csv", DATAHUB_NASDAQ_URL, "DataHub Nasdaq listings", "Company Name"],
  ];
  const rows = [];
  for (const [cacheName, url, source, preferredColumn] of sources) {
    const text = (
      await fetchWithCache(cacheName, url, { refresh, accept: "text/csv,text/plain" })
    ).toString("utf8");
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(lines.shift() ?? "");
    const columnIndex = headers.indexOf(preferredColumn);
    for (const line of lines) {
      const cells = parseCsvLine(line);
      const name = cleanCompanyName(cells[columnIndex] ?? cells[1]);
      if (!name || /ETF|ETN|Fund|Notes|Warrant|Acquisition/i.test(name)) continue;
      rows.push({
        name,
        country_iso2: "US",
        ticker: cells[headers.indexOf("Symbol")] ?? "",
        source_item: "",
        source,
      });
    }
  }
  return dedupeBy(rows, (row) => slug(row.name));
}

function mergeRows(primary, fallback, keyFn) {
  return dedupeBy([...primary, ...fallback], keyFn);
}

function buildBioTemplates(occupations, interests) {
  const popularOccupations = occupations.slice(0, 80).map((row) => row.name.toLowerCase());
  const popularInterests = interests.slice(0, 120).map((row) => row.name.toLowerCase());
  const templates = [];
  let id = 1;

  for (const opening of BIO_PARTS.openings) {
    for (const goal of BIO_PARTS.goals) {
      templates.push({
        template_id: `bio_${String(id++).padStart(4, "0")}`,
        template:
          `${opening}, {occupation}, and happiest around {interest_one}, {interest_two}, and {travel}. ` +
          `Looking for ${goal} with someone who values {value_one} and {value_two}.`,
        variables: "occupation|interest_one|interest_two|travel|value_one|value_two",
        tone: "warm",
        source: "HeartConnect generated template grammar",
      });
    }
  }

  for (let i = 0; i < Math.min(40, popularOccupations.length); i += 1) {
    templates.push({
      template_id: `bio_${String(id++).padStart(4, "0")}`,
      template:
        `I work in {occupation} and make time for {interest_one}, {interest_two}, and good conversation. ` +
        `Here to meet someone intentional, kind, and ready for {goal}.`,
      variables: "interest_one|interest_two|goal",
      tone: "direct",
      source: "HeartConnect generated template grammar",
    });
  }

  for (let i = 0; i < Math.min(40, popularInterests.length); i += 1) {
    templates.push({
      template_id: `bio_${String(id++).padStart(4, "0")}`,
      template:
        `Usually planning my week around {interest_one}, {travel}, and time with people I care about. ` +
        `I appreciate {value_one}, {value_two}, and relationships that grow with patience.`,
      variables: "travel|value_one|value_two",
      tone: "reflective",
      source: "HeartConnect generated template grammar",
    });
  }

  return templates;
}

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function pickMany(random, list, count) {
  const copy = [...list];
  const out = [];
  while (out.length < count && copy.length) {
    out.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  }
  return out;
}

function generateBio(random, template, occupation, interests) {
  const values = pickMany(random, BIO_PARTS.values, 2);
  return template.template
    .replaceAll("{occupation}", occupation.name.toLowerCase())
    .replaceAll("{interest_one}", interests[0]?.name.toLowerCase() ?? "reading")
    .replaceAll("{interest_two}", interests[1]?.name.toLowerCase() ?? "traveling")
    .replaceAll("{travel}", pick(random, BIO_PARTS.travel))
    .replaceAll("{value_one}", values[0])
    .replaceAll("{value_two}", values[1])
    .replaceAll("{goal}", pick(random, BIO_PARTS.goals));
}

function namesForCountry(names, countryIso2) {
  const countryRows = names.filter((row) => row.country_iso2 === countryIso2);
  return countryRows.length >= 20
    ? countryRows
    : names.filter((row) => row.country_iso2 === "GLOBAL").concat(countryRows);
}

export function createProfileGenerator(datasets, seed = 20260626) {
  const random = mulberry32(seed);
  const usedBios = new Set();
  const usedInterestKeys = new Set();
  const profileInterestPool = datasets.interests.filter(
    (row) =>
      !["film", "food", "travel"].includes(row.category) &&
      row.name.length <= 42 &&
      !/[(),]/.test(row.name) &&
      !/\b(unknown|lcc|iata)\b/i.test(row.name),
  );
  const commonInterestPool = profileInterestPool.filter((row) =>
    PROFILE_INTEREST_ALLOWLIST.has(row.name.toLowerCase()),
  );
  const activeInterestPool =
    commonInterestPool.length >= 20 ? commonInterestPool : profileInterestPool;
  const languagePool = datasets.languages.filter((row) => !/\bunknown\b/i.test(row.name));

  return function generateProfile() {
    const country = pick(random, datasets.countries);
    const countryCities = datasets.cities.filter((city) => city.country_iso2 === country.iso2);
    const city = countryCities.length
      ? pick(random, countryCities.slice(0, Math.min(countryCities.length, 200)))
      : pick(random, datasets.cities);
    const gender = random() > 0.5 ? "female" : "male";
    const names = namesForCountry(
      gender === "female" ? datasets.femaleNames : datasets.maleNames,
      country.iso2,
    );
    const name = pick(
      random,
      names.length ? names : gender === "female" ? datasets.femaleNames : datasets.maleNames,
    );
    const occupation = pick(random, datasets.occupations);
    const education = pick(random, datasets.universities);
    const religion = pick(random, datasets.religions);
    const languages = pickMany(random, languagePool, 1 + Math.floor(random() * 3)).map(
      (row) => row.name,
    );

    let interests = pickMany(random, activeInterestPool, 4 + Math.floor(random() * 3));
    let interestKey = interests
      .map((row) => row.name)
      .sort()
      .join("|");
    let guard = 0;
    while (usedInterestKeys.has(interestKey) && guard++ < 10) {
      interests = pickMany(random, activeInterestPool, 4 + Math.floor(random() * 3));
      interestKey = interests
        .map((row) => row.name)
        .sort()
        .join("|");
    }
    usedInterestKeys.add(interestKey);

    let bio = "";
    guard = 0;
    while ((!bio || usedBios.has(bio)) && guard++ < 20) {
      bio = generateBio(random, pick(random, datasets.bioTemplates), occupation, interests);
    }
    usedBios.add(bio);

    const now = Date.now();
    const lastActive = new Date(
      now - Math.floor(random() * 1000 * 60 * 60 * 24 * 45),
    ).toISOString();
    const idSource = `${name.name}:${gender}:${country.iso2}:${city.geoname_id}:${bio}`;
    return {
      profile_id: createHash("sha1").update(idSource).digest("hex").slice(0, 16),
      name: name.name,
      gender,
      age: 21 + Math.floor(random() * 34),
      country_iso2: country.iso2,
      country: country.name,
      city: city.name,
      state_province: city.state_province,
      latitude: city.latitude,
      longitude: city.longitude,
      occupation: occupation.name,
      education: education.name,
      height_cm:
        gender === "female" ? 152 + Math.floor(random() * 32) : 162 + Math.floor(random() * 36),
      religion: religion.name,
      languages: languages.join("|"),
      interests: interests.map((row) => row.name).join("|"),
      bio,
      verification_status: random() > 0.22 ? "verified" : "pending",
      premium_status: random() > 0.82 ? "premium" : "standard",
      last_active_at: lastActive,
    };
  };
}

async function writeAttribution() {
  const sources = [
    {
      name: "mledoze/countries",
      url: COUNTRIES_URL,
      license: "Open Database License",
      files: ["countries.csv", "countries.json"],
    },
    {
      name: "GeoNames cities5000",
      url: GEO_NAMES_CITIES_URL,
      license: "Creative Commons Attribution 4.0",
      attribution: "Contains geographical data from GeoNames.org.",
      files: ["cities.csv", "cities.json"],
    },
    {
      name: "sigpwned popular-names-by-country-dataset",
      url: POPULAR_NAMES_BY_COUNTRY_URL,
      license: "Creative Commons CC0 public domain dedication",
      files: ["male_names.csv", "female_names.csv"],
    },
    {
      name: "US Social Security Administration baby names",
      url: SSA_NAMES_URL,
      license: "Public government data",
      files: ["male_names.csv", "female_names.csv"],
    },
    {
      name: "Wikidata Query Service",
      url: WIKIDATA_ENDPOINT,
      license: "Creative Commons CC0 public domain dedication",
      files: [
        "male_names.csv",
        "female_names.csv",
        "occupations.csv",
        "interests.csv",
        "universities.csv",
        "companies.csv",
        "religions.csv",
        "languages.csv",
      ],
    },
    {
      name: "dariusk/corpora",
      url: "https://github.com/dariusk/corpora",
      license: "Creative Commons CC0 public domain dedication",
      files: ["occupations.csv", "interests.csv", "religions.csv"],
    },
    {
      name: "umpirsky/language-list",
      url: LANGUAGE_LIST_URL,
      license: "MIT",
      files: ["languages.csv"],
    },
    {
      name: "Hipo university-domains-list",
      url: HIPO_UNIVERSITIES_URL,
      license: "MIT",
      files: ["universities.csv"],
    },
    {
      name: "DataHub S&P 500 and Nasdaq listings",
      url: "https://datahub.io/core/nasdaq-listings",
      license: "Open Data Commons Public Domain Dedication and License",
      files: ["companies.csv"],
    },
    {
      name: "HeartConnect template grammar",
      license: "Project-authored generator grammar; not a third-party dataset",
      files: ["bio_templates.csv", "demo_profiles.csv when requested"],
    },
  ];
  await writeFile(path.join(DATASET_DIR, "sources.json"), JSON.stringify(sources, null, 2), "utf8");
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    printHelp();
    return;
  }

  await ensureDirs();

  logStep("Downloading and normalizing countries");
  const countries = normalizeCountries(
    await fetchJsonWithCache("mledoze-countries.json", COUNTRIES_URL, {
      refresh: options.refresh,
      validate: (json) => Array.isArray(json) && json.every((row) => row.cca2 && row.name?.common),
    }),
  );
  await writeDataset("countries", countries);

  logStep("Downloading and normalizing cities");
  const cities = await normalizeCities(options.refresh, options.maxCities);
  await writeDataset("cities", cities);

  const wikidata = Object.fromEntries(Object.keys(WIKIDATA_QUERIES).map((key) => [key, []]));
  if (options.skipWikidata) {
    logStep("Skipping Wikidata source libraries");
    console.log("--skip-wikidata supplied; using local and cached non-Wikidata sources only");
  } else {
    logStep("Querying Wikidata source libraries");
    for (const [key, query] of Object.entries(WIKIDATA_QUERIES)) {
      try {
        wikidata[key] = await fetchWikidataRows(
          key,
          query,
          options.maxWikidataRows,
          options.refresh,
        );
      } catch (error) {
        console.warn(`warning: ${error.message}`);
        const fallback = cachePath(`wikidata-${key}-${options.maxWikidataRows}.json`);
        if (existsSync(fallback)) {
          console.warn(`warning: using cached Wikidata fallback for ${key}`);
          wikidata[key] = JSON.parse(await readFile(fallback, "utf8"));
        } else {
          console.warn(`warning: no cached Wikidata fallback for ${key}; continuing without it`);
          wikidata[key] = [];
        }
      }
    }
  }

  const names = normalizeNames(wikidata.names);
  const popularNames = await normalizePopularNamesByCountry(options.refresh);
  const ssaNames = await normalizeSsaNames(options.refresh);
  names.male = dedupeBy(
    [...popularNames.male, ...ssaNames.male, ...names.male],
    (row) => `${row.country_iso2}:${row.name}`,
  );
  names.female = dedupeBy(
    [...popularNames.female, ...ssaNames.female, ...names.female],
    (row) => `${row.country_iso2}:${row.name}`,
  );
  const occupations = mergeRows(
    await normalizeCorporaOccupations(options.refresh),
    normalizeSimple(wikidata.occupations, "itemLabel"),
    (row) => slug(row.name),
  );
  const interests = mergeRows(
    await normalizeCorporaInterests(options.refresh),
    normalizeSimple(wikidata.interests, "itemLabel", (row) => ({
      category: cleanText(row.typeLabel),
    })),
    (row) => slug(`${row.category}:${row.name}`),
  );
  const universities = mergeRows(
    await normalizeHipoUniversities(options.refresh, countries),
    normalizeSimple(wikidata.universities, "itemLabel", (row) => ({
      country_iso2: cleanText(row.iso2).toUpperCase() || "GLOBAL",
      domains: "",
      web_pages: "",
    })),
    (row) => slug(`${row.country_iso2}:${row.name}`),
  );
  const companies = mergeRows(
    await normalizeCompanyCsv(options.refresh),
    normalizeSimple(wikidata.companies, "itemLabel", (row) => ({
      country_iso2: cleanText(row.iso2).toUpperCase() || "GLOBAL",
      ticker: "",
    })),
    (row) => slug(row.name),
  );
  const religions = mergeRows(
    await normalizeCorporaReligions(options.refresh),
    normalizeSimple(wikidata.religions, "itemLabel"),
    (row) => slug(row.name),
  );
  const languages = mergeRows(
    await normalizeLanguageList(options.refresh),
    normalizeSimple(wikidata.languages, "itemLabel", (row) => ({
      iso6391: cleanText(row.iso6391),
      iso6392: cleanText(row.iso6392),
    })),
    (row) => slug(`${row.iso6391 || row.iso6392}:${row.name}`),
  );
  const bioTemplates = buildBioTemplates(occupations, interests);

  await writeDataset("male_names", names.male);
  await writeDataset("female_names", names.female);
  await writeDataset("occupations", occupations);
  await writeDataset("interests", interests);
  await writeDataset("bio_templates", bioTemplates);
  await writeDataset("universities", universities);
  await writeDataset("companies", companies);
  await writeDataset("religions", religions);
  await writeDataset("languages", languages);
  await writeAttribution();

  if (options.profiles > 0) {
    logStep(`Generating ${options.profiles.toLocaleString()} demo profiles`);
    const generateProfile = createProfileGenerator({
      countries,
      cities,
      maleNames: names.male,
      femaleNames: names.female,
      occupations,
      interests,
      bioTemplates,
      universities,
      religions,
      languages,
    });
    const profiles = Array.from({ length: options.profiles }, generateProfile);
    await writeDataset("demo_profiles", profiles);
  }

  console.log("\nDone. Import-ready CSV and JSON datasets are in datasets/.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\nDataset generation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
