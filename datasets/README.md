# HeartConnect Demo Datasets

Generate import-ready real-world demo datasets with:

```bash
npm run datasets:generate
```

The generator writes UTF-8 CSV and JSON files into this folder:

- `countries`
- `cities`
- `male_names`
- `female_names`
- `occupations`
- `interests`
- `bio_templates`
- `universities`
- `companies`
- `religions`
- `languages`

To also create reusable demo profiles:

```bash
npm run datasets:generate -- --profiles=100000
```

Useful options:

```bash
npm run datasets:generate -- --refresh
npm run datasets:generate -- --skip-wikidata
npm run datasets:generate -- --max-cities=50000
npm run datasets:generate -- --max-wikidata-rows=5000
```

Raw downloaded sources are cached in `datasets/.cache`, so repeated runs rebuild
CSV and JSON outputs without downloading everything again. Use `--refresh` to
force new downloads.

Use `--skip-wikidata` when Wikidata is slow or unavailable. The generator will
skip every Wikidata request and continue using the other cached/open datasets.

## Data Sources

The script uses openly available public sources and writes detailed attribution
to `sources.json`.

- `mledoze/countries` for ISO country metadata.
- GeoNames `cities5000` for cities, towns, coordinates, population, and time
  zones. GeoNames data requires attribution.
- US Social Security Administration baby-name data for high-volume real male
  and female name libraries.
- `sigpwned/popular-names-by-country-dataset` for CC0 country-specific popular
  male and female forenames.
- Wikidata Query Service for CC0 names, occupations, interests, universities,
  companies, religions, and languages.
- `dariusk/corpora` for CC0 fallback lists of occupations, interests, and
  religions.
- `umpirsky/language-list` for MIT-licensed language names and ISO codes.
- Hipo `university-domains-list` for MIT-licensed global university metadata.
- DataHub S&P 500 and Nasdaq listing mirrors for public company names.
- HeartConnect-authored template grammar for natural bio variations. Templates
  are generated from grammar patterns and combined with real occupations and
  interests by the profile generator.

## Notes

The script avoids placeholder rows such as `John Doe`, `City 1`, or repeated
copy. If a public source is temporarily unavailable, it reuses the last cached
copy when one exists and fails clearly when no valid cache is available.
