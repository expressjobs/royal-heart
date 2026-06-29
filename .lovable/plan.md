# Phase 4 — Advanced Search & Filters

Builds on what already exists: the PostGIS `discover_profiles` RPC (age, gender pref, distance, country, city, online, verified, bio, interests, languages, religion, education, relationship goal), the `DiscoverFiltersSheet`, `get_visible_profiles` masking, and the admin dashboard tabs.

## What's already done (no rebuild)

Age, gender, country, city, distance, online-now, recently-active, verified-only, relationship goal, languages, interests, education, religion filters all work today through `discover_profiles`. This phase fills the gaps.

## 1. Database — new profile attributes & supporting tables

**Profile lifestyle columns** (added to `public.profiles`, all nullable):
`profession`, `smoking`, `drinking`, `workout`, `family_plans`, `pets` (text), plus privacy toggles `hide_age`, `hide_online_status`, `incognito` (boolean). `location_hidden` already exists.

**`filter_presets`** — saved filters per user: `user_id`, `name`, `filters` (jsonb), `is_quick` (bool). RLS: owner-only.

**`filter_options`** — admin-managed lists: `category` (interest/profession/relationship_goal/language/religion/education), `value`, `label`, `sort_order`, `is_active`. RLS: public read of active rows, admin write. Seeded from current constants.

**`search_events`** — analytics: `user_id`, `filters` (jsonb), `result_count`, `created_at`. RLS: insert by authenticated (self), read by admin only. Drives "most used filters" + engagement.

**Indexes** for fast filtering: btree on `profiles(location_country)`, `(location_state)`, `(membership_tier)`, `(last_active)`, `(profession)`, GIN on `interests`/`languages`, plus existing GIST on `location_geog`.

## 2. `discover_profiles` RPC v2

Add params: `_state`, `_premium_only`, `_recently_active_minutes`, `_profession`, `_smoking`, `_drinking`, `_workout`, `_family_plans`, `_pets`. Respect privacy: exclude `incognito` members from others' decks, honor `hide_online_status` (online filter ignores them), keep `get_visible_profiles` masking. Keep ordering (featured → tier → distance → recent).

New SECURITY DEFINER helpers for discovery sections:

- `discover_section(_kind text, _limit)` → recommended (interest/goal overlap), trending (most-liked last 7d), new_members (created last 14d), nearby (distance asc), verified (is_verified). All reuse the same visibility/block/ban guards.

## 3. Frontend

**`DiscoverFilters` sheet**: add State field, Premium-only + Recently-active toggles, and lifestyle selects (profession, smoking, drinking, workout, family plans, pets). Extend `DiscoverFilters` type + `fetchDiscoverDeck` mapping + `activeFilterCount`.

**Filter presets**: save current filters with a name, list/apply/delete, "pin as quick filter" → quick-filter chips row above the deck. New `presets.functions.ts`/`presets.ts`.

**Advanced Search page** (`/_authenticated/search`): full filter form + paginated/infinite-scroll grid of results (not the swipe deck), using a new `search_profiles` RPC with `_offset`/`_limit`. Logs a `search_event` per query.

**Discovery sections** on a `/_authenticated/explore` route (or tabs): Recommended, Trending, New members, Nearby, Verified — horizontal card rails backed by `discover_section`.

**Privacy controls** in Settings: toggles for Hide age, Hide location, Hide online status, Incognito mode — written to the new profile columns. Lifestyle fields added to profile edit/onboarding so filters have data.

## 4. Admin

**New "Discovery" tab** (admin+): manage `filter_options` lists (interests, professions, relationship goals, languages, religion, education) — add/edit/disable/reorder. **Search analytics**: most-used filters, search volume over time, avg results, discovery engagement — Recharts, backed by an admin-gated `search_analytics()` RPC over `search_events`.

## 5. Security & testing

- Every new table: GRANTs + RLS in the same migration.
- Analytics/admin RPCs self-gate with `has_min_role`/`has_role`.
- Privacy: incognito + hidden fields enforced server-side in the RPC, not just UI.
- Verify: `tsgo --noEmit`, security scan, DB linter, and a Playwright pass over the filter sheet, presets, advanced search pagination, and the explore sections.

## Technical notes

- Lifestyle option lists added to `src/lib/constants.ts` (smoking/drinking/workout/family/pets) and seeded into `filter_options`.
- `search_profiles` returns `(id, distance_m, total_count)` for pagination; client hydrates via `get_visible_profiles` (keeps masking).
- Migrations are split: (1) profile columns + indexes, (2) presets/options/events tables + seed, (3) RPC v2 + section/analytics functions.

## Out of scope (Phase 5)

Deeper location/distance matching (travel mode, location history, map view) is explicitly the next phase.

I'll build it in the order above, running typecheck + security scan + linter before reporting completion. Want me to proceed with all of it, or trim any section (e.g. skip the separate Explore route and fold sections into Discover)?
