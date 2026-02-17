# Session Summary — 2026-02-16

## Migration: PostgreSQL to localStorage

Replaced all database-backed storage with client-side localStorage. The server is now a stateless research service (web search + LLM only).

### New file: `lib/store.ts`
Client-side localStorage module with three keys:
- `careers_persons` — `Record<normalizedName, StoredPerson>`
- `careers_companies` — `Record<normalizedName, StoredCompany>`
- `careers_settings` — `{ activeProvider: string }`

Key exports: `mergePersonData`, `mergeCompanyData`, `buildGraph`, `hasPerson`, `hasCompany`, `getActiveProvider`, `setActiveProvider`, `clearGraph`, `normFromNodeId`, `getCompanyPeopleNames`.

Edges stored inline in both person and company records. `buildGraph()` merges both sides, deduplicates edges by `(personId, companyId, position)`, and re-normalizes all names to prevent duplicate nodes.

### Modified API routes
- `/api/person/route.ts` — returns full person data with photo URLs and company logos. No DB writes.
- `/api/company/route.ts` — returns full company data with notable people photos. Accepts `excludeNames` to find different people on repeat clicks. No DB writes.
- `/api/settings/route.ts` — GET only, returns available LLM providers. Removed PUT handler.
- `/api/person-company/route.ts` — returns connections, no DB writes.

### Deleted routes
- `/api/graph/route.ts` — graph built client-side now.
- `/api/reset/route.ts` — replaced by `store.clearGraph()`.

### Modified: `lib/llm/registry.ts`
Removed `getActiveProvider()`, `getActiveProviderName()`, and DB import. Kept `getProvider(name)` and `getAvailableProviders()` (pure lookups).

### Modified: `components/SettingsPanel.tsx`
Uses `store.getActiveProvider()` on mount, `store.setActiveProvider()` on change. Fetches available list from `GET /api/settings`. Removed `onProviderChange` prop.

### Modified: `app/page.tsx`
- Uses `store.buildGraph()` instead of `fetch('/api/graph')`
- Search results merged via `store.mergePersonData/mergeCompanyData`
- Provider sent from `store.getActiveProvider()` in request body
- Added Clear button
- All API calls go through `fetchJSON()` helper (resilient to non-JSON responses)

---

## Image Fixes

### Problem: Company logos not displaying
Clearbit Logo API (`logo.clearbit.com`) is dead (DNS failure).

### Fix: `lib/images.ts` rewritten
- Company logos: DuckDuckGo Instant Answer -> Google Favicon V2 (`t2.gstatic.com/faviconV2`) -> Wikipedia page image
- Person photos: Wikipedia Page Image -> DuckDuckGo Instant Answer -> DuckDuckGo Image Search (new)

### DuckDuckGo Image Search (from Constellations project)
Two-step approach for finding photos of non-notable people:
1. Fetch DDG search page to extract `vqd` token
2. Call `duckduckgo.com/i.js` API with the token to get actual image search results
3. Filter out logos/icons/clipart

This successfully finds photos for people like John Dimm who don't have Wikipedia articles.

---

## UX: Quiet Node Expansion

### Problem
Clicking an unexpanded node showed a loading overlay that dimmed the entire graph.

### Fix
- Node clicks fire API fetches quietly (fire-and-forget pattern)
- Rotating dashed spinner appears around the node being fetched (SVG `animateTransform`)
- Spinner color: amber for people, blue for companies
- Loading state tracked via `loadingNodesRef` (Set of node IDs)

---

## UX: Click Company to Get People

### Change
- Single-clicking a company always fetches people for it
- First click: normal fetch
- Subsequent clicks: sends `excludeNames` (people already in graph) so the LLM returns different people
- Removed right-click context menu ("Find more people") — single click replaces it

---

## Graph Physics Tuning

### Problem
Graph started very wide, then compressed. Too much animation.

### Fixes
- New nodes placed near a connected neighbor instead of random positions
- Lower initial alpha: 0.5 (first load), 0.3 (incremental updates) — default was 1.0
- Faster decay: `alphaDecay: 0.05` (default 0.0228) — settles ~2x faster
- Higher velocity damping: `velocityDecay: 0.4`
- Link distance: 80 (was 150)
- Charge strength: -150 (was -400)

---

## Label Improvements

### Problem
Long names overflowed and overlapped neighboring nodes.

### Fix
- Names split across two lines at the word boundary closest to the middle
- Each line capped at 16 characters
- Short names (<=12 chars) stay on one line
- Collide radius set to 50 to give labels breathing room

---

## Entity Deduplication

### Problem
LLM returns name variants ("Blue Titan Software" vs "Blue Titan Software, Inc.") creating duplicate nodes.

### Fixes

#### Stronger normalization (`lib/parsers.ts`)
- People: strips periods, middle initials, suffixes (Jr, Sr, PhD, etc.)
- Companies: strips business words (Technologies, Security, Networks, Systems, Labs, Software, etc.) in addition to legal suffixes (Inc, LLC, Ltd, Corp, etc.)

#### Fuzzy key matching (`lib/store.ts`)
- `findMatchingKey()`: exact match first, then substring containment
- Used in all merge, lookup, and has-check functions

#### Re-normalization in `buildGraph()`
- All names re-normalized using current functions when building the graph
- Two localStorage entries with stale keys ("blue titan software" and "blue titan") both resolve to the same canonical node ID
- Keeps the most-expanded version when merging duplicates

#### Company people accumulate
- `mergeCompanyData` appends new people to existing list instead of replacing
- Deduplicates by normalized person name

---

## Error Handling

### Problem
API sometimes returns non-JSON (HTML error page from Next.js), causing "Unexpected token" crash.

### Fix
- Extracted `fetchJSON()` helper used by all API calls
- Reads response as text first, then tries `JSON.parse`
- Returns `null` instead of crashing on invalid responses
