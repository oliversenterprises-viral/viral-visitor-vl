# ADR-002: Share Analytics Admin Tab Enhancement — Architecture Design

**Status:** Accepted (user-approved plan)  
**Date:** 2026-05-15  
**Deciders:** Atlas (System Architect)  
**Audience:** Codex (implementation), future contributors

## Context & Goals

The current Share Analytics tab (tab index 1 in `switchAdminTab`) lives inside the monolithic `src/main.ts`. It provides:

- Time-range filters (7d / 30d / All)
- Platform bar chart (Chart.js)
- Shares-over-time line chart (last 14 days)
- Top referrers + platform breakdown
- A "Key Insights" heading that currently renders top referrers (misplaced content)

The approved enhancement goal is **"more automatic value"**:
- Richer, automatically computed **Key Insights** (velocity, concentration, peaks, growth deltas, skew, etc.) derived purely on the client from the filtered share array.
- Clean support for a **second line chart** (e.g., cumulative growth or comparative trend) alongside the existing bar + trend pair.
- Improved UX for time filtering + re-renders.
- Better maintainability and alignment with the project's modular architecture (see `docs/project-structure.md` and ADR-001).

This ADR defines the technical architecture, boundaries, data flow, and concrete function signatures so Codex can implement immediately without further design ambiguity.

## Key Architectural Decisions

### 1. Extraction vs. Monolith (switchAdminTab / renderAnalytics)

**Decision: Extract the entire Share Analytics tab to `src/features/admin/share-analytics.ts` (and peer modules for other tabs).**

Keep a **thin dispatcher** in `main.ts`:

```ts
// main.ts (excerpt)
if (tab === 1) {
  const content = document.getElementById('admin-content')!;
  content.innerHTML = '<div class="animate-pulse...">Loading advanced share analytics...</div>';
  const { renderShareAnalytics } = await import('./features/admin/share-analytics');
  await renderShareAnalytics(content);
}
```

**Pros of Extraction:**
- Directly follows the approved project structure (`features/admin/`, `features/*/`) and ADR-001 "no heavy framework, modular feature folders".
- Pure computation functions (`computeKeyInsights`, `computeSummary`) become unit-testable and potentially reusable (future "My Share Stats" for power users or exported reports).
- Each admin tab can be developed, reasoned about, and loaded independently (dynamic import = smaller initial bundle).
- Prevents the 300+ line `switchAdminTab` monster from growing further. Other tabs (referrals, claims, content) should be extracted in parallel for consistency.
- Clear ownership: analytics logic never touches referral/claims concerns.
- Enables future admin dashboard evolution (e.g., export CSV, scheduled reports, multiple chart types) without touching main.ts.

**Cons / Trade-offs:**
- One extra dynamic import on first click of the tab (negligible — Chart.js is already dynamically imported).
- Global `onclick="switchAdminTab(1)"` in `index.html` remains (acceptable for vanilla; we can later migrate tabs to proper event delegation if desired).
- Slightly more files, but this is the intended growth path.

**Rejected Alternative:** Keep everything in `main.ts`. This would violate the architecture we documented and make the Key Insights calculations unmaintainable spaghetti.

### 2. Time Filter + Re-render Logic

**Decision: Closure-scoped state + pure transformation pipeline + explicit chart lifecycle.**

Inside `share-analytics.ts`:

- Fetch `allShares` **once** on tab entry (stored in module closure / let).
- `currentPeriod: TimePeriod` (0 = all, 7, 30) also in closure.
- On filter button click:
  1. Update `currentPeriod`.
  2. `const filtered = filterByPeriod(allShares, currentPeriod)`.
  3. `const summary = computeSummary(filtered, allShares)`.
  4. `destroyAllCharts()`.
  5. Replace only the dynamic sections (or full content for simplicity — data is tiny) and re-create charts.
- Filter buttons live in a **persistent header** rendered once; the insights/charts area is a child container that is updated. (Reduces flicker and listener churn.)
- All listeners are added **after** the relevant DOM is inserted and are scoped to the module (no global pollution).

**Why not a full reactive framework?** Overkill. This pattern (state + pure fns + manual DOM sync) is consistent with the rest of the vanilla TS app and keeps bundle size minimal.

**Chart lifecycle rule (critical for no leaks / multiple instances):**
```ts
let chartRegistry: Record<string, Chart> = {};

function destroyAllCharts() {
  Object.values(chartRegistry).forEach(c => c?.destroy?.());
  chartRegistry = {};
}

function registerChart(key: string, chart: Chart) {
  destroyAllCharts(); // or targeted destroy
  chartRegistry[key] = chart;
}
```
Call `destroyAllCharts()` **before** any `innerHTML = ` that removes canvases.

### 3. Key Insights Generation (Pure Client-Side)

**Decision: All insights are pure functions over the filtered `ShareRecord[]` array.**

```ts
export function computeKeyInsights(
  filtered: ShareRecord[],
  allSharesForComparison?: ShareRecord[]
): KeyInsight[];
```

`KeyInsight` shape (see types below) is intentionally rich so the renderer can produce beautiful cards with icons, values, deltas, and optional sparklines later.

**Example automatic insights (Codex should implement at least these + 2–3 more):**
- "Top platform accounts for X% of shares (strong skew)"
- "Peak activity day: Wednesday (avg Y shares)"
- "Velocity: Z shares/day in selected window"
- "Top 5 referrers generate W% of all activity (concentration risk/opportunity)"
- "Growth vs prior equivalent period: +18% (or -12%)"
- "Unique sharers: N (M% of total referrers)"

**Benefits:** Zero latency, works offline after initial fetch, trivial to extend ("add insight X"), easy to A/B test different formulas. Perfectly matches "more automatic value".

All calculations use standard `Array.reduce`, `filter`, `Map`, `Date` — no extra libs.

### 4. Rendering the Second Line Chart (Performance)

**Decision: Treat charts uniformly via a small chart factory + registry. No performance concerns at admin scale.**

Current charts:
- Platform bar (`share-chart`)
- Time trend line (`trend-chart`)

For the enhancement we explicitly support a **second line chart** (recommended: cumulative shares line — shows acceleration and total momentum, which users love for "value").

Implementation:
- Grid remains `grid-cols-1 xl:grid-cols-2` (or expand to 3 if needed).
- New canvas: `id="cumulative-chart"` or make chart config data-driven.
- `createCumulativeLineChart(canvas, data)` re-uses the same `Chart` registration and styling tokens.
- Same `destroyAllCharts()` guard.

**Why no perf issues?**
- Typical admin dataset: hundreds to low thousands of rows.
- Chart.js is highly optimized; even 10k points is instant.
- We only ever have 2–3 live Chart instances.
- Re-renders are user-initiated (button clicks), not on every keystroke.
- `maintainAspectRatio: false` + fixed canvas height keeps layout stable.

If in the future we need many charts or realtime updates, we can introduce a `ChartManager` class or move to a tiny observable, but that is explicitly out of scope for this iteration.

### 5. Data Flow Recommendation (Client Fetch + Aggregation vs. Edge)

**Decision: Fetch the complete raw shares list client-side (via secure admin path). Perform **all** filtering, aggregation, and Key Insights calculations in pure client-side JavaScript. Do NOT move aggregation to an Edge Function at this stage.**

**Rationale & Pros:**
- Admin tab is internal, low-traffic, and read-only. Expected volume remains modest for a long time.
- Having the **full dataset in memory** is what enables the rich, instant, filter-anything experience and the sophisticated Key Insights without round-trips.
- Pure client aggregation is simpler, cheaper (no Edge invocations per filter change), and easier to evolve ("let's add a 90-day rolling average insight").
- Matches the existing pattern used successfully for the leaderboard (`fetchLeaderboard` does client-side counting).

**For RLS / "admin sees everything" problem (current blocker):**
The existing direct `supabase.from('shares').select(...)` only returns the logged-in admin's own shares due to RLS (`shares_select_own` policy).

**Recommended path (choose one; document the choice in code):**
- **Preferred short-term (recommended):** Extend the existing `admin-action` Edge Function with a read action:
  ```ts
  if (action === 'get_shares') {
    const { data } = await supabaseAdmin
      .from('shares')
      .select('platform, created_at, referral_link, user_id') // or join profiles.referral_code
      .order('created_at', { ascending: false });
    return { success: true, data };
  }
  ```
  Client calls via the existing `callEdgeFunction('admin-action', { action: 'get_shares' })` after the Supabase session is established. Edge uses `service_role` → full visibility. This is consistent with all other privileged operations.
- **Alternative:** Add a dedicated `admin-read` Edge Function or a SECURITY DEFINER `is_admin()` helper + broad admin SELECT policies on `shares`, `referrals`, `claims`. Slightly simpler client code but more policy surface.

**When to move aggregation to Edge later (future ADR):**
- When total shares > ~20–50k and filter latency becomes noticeable, or
- When we want non-admin users to see personal aggregate stats (privacy + scale), or
- When we introduce scheduled rollups (`daily_share_stats` table populated by trigger or pg_cron + Edge).

**Explicit non-goal for v1:** Server-side aggregation or pre-computed summaries. Keep the power in the client for maximum flexibility and "automatic value".

**Referrer code source note:** The `shares` table currently stores `referral_link` (not `referrer_code`). The implementation must either:
- Parse `referrer_code` from the link client-side (robust `?ref=` or path segment extractor), or
- Perform a profiles join in the admin fetch, or
- (Recommended) Denormalize `referrer_code` onto the `shares` row at insert time (small migration + update to `record-referral` Edge Function). This makes analytics queries trivial and fast.

### 6. Component Boundaries & Reusability for Future Admin Tabs

- **Feature modules** (`features/admin/*.ts`) own everything about their tab: data fetching (via admin service), state, pure computations, HTML templating, chart creation, and event handling.
- **Pure functions live at the top of the module** (or extracted to `src/utils/analytics.ts` if we later need them for user-facing features). This is the primary reusability win.
- **No premature UI component extraction.** Keep using template literals + Tailwind for now (consistent with current admin tabs and the porting strategy). Only when 2+ tabs share identical stat cards, insight rows, or filter UI should we create `ui/components/AdminStat.tsx` (or `.ts`).
- **Admin service layer** (`admin-service.ts`): central place for `submitAdminAction({action, payload})`, `fetchAdminShares()`, `fetchAdminClaims()` etc. This hides the Edge vs direct decision and makes mocking easy.
- **Types first:** All domain shapes in `lib/types.ts`. The analytics module never uses `any`.
- **Future-proofing:** The pattern makes adding tab 4 (e.g. "Abuse Detection"), tab 5 ("Revenue"), or even a "Reports" section trivial. Each new tab follows the exact same `renderXXX(container)` contract.

**Global window exposure:** Keep `switchAdminTab`, `openAdminPanel` etc. on `window` for the HTML `onclick` attributes (pragmatic). The real logic moves to modules.

## Proposed File Structure (Delta from Current)

```
src/
├── main.ts                          # ← only thin dispatcher + wiring remains for admin
├── lib/
│   ├── types.ts                     # + ShareRecord, TimePeriod, KeyInsight, AnalyticsSummary
│   └── supabase.ts                  # (optional) thin adminFetch* wrappers
├── features/
│   └── admin/
│       ├── index.ts                 # barrel (optional)
│       ├── share-analytics.ts       # ★ PRIMARY FILE FOR THIS TASK
│       │   (renderShareAnalytics, all pure compute*, chart factories, state)
│       ├── referrals-tab.ts         # extract tab 0 (future, recommended)
│       ├── content-editor.ts        # extract tab 2
│       ├── prize-claims.ts          # extract tab 3 (already complex)
│       └── admin-service.ts         # shared Edge calls + auth helpers
├── ui/
│   └── components/                  # (future only) AdminFilterGroup.ts, InsightCard.ts
└── utils/
    └── analytics.ts                 # (optional) move pure fns here if cross-feature need arises
```

`index.html` and `style.css` are untouched (Tailwind classes only).

## Concrete Function Signatures (Codex-Ready)

```ts
// === lib/types.ts (additions) ===
export type TimePeriod = 7 | 30 | 0;

export interface ShareRecord {
  platform: string;
  referrer_code: string;   // populated by parsing referral_link or join
  created_at: string;
  // user_id?: string;     // if needed for future
}

export interface KeyInsight {
  id: string;
  icon: string;                    // e.g. "fa-solid fa-tachometer-alt"
  title: string;
  value: string | number;
  detail?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  percentage?: number;             // for deltas
}

export interface AnalyticsSummary {
  total: number;
  uniqueReferrers: number;
  platformCounts: Record<string, number>;
  topReferrers: Array<[string, number]>;
  dailyTrend: { labels: string[]; values: number[] };
  keyInsights: KeyInsight[];
  // Second-chart data example
  cumulativeTrend?: { labels: string[]; values: number[] };
  bestDayOfWeek?: string;
  avgPerDay?: number;
}

// === features/admin/share-analytics.ts ===
export async function renderShareAnalytics(container: HTMLElement): Promise<void>;

export function filterByPeriod(shares: ShareRecord[], period: TimePeriod): ShareRecord[];

export function computePlatformCounts(shares: ShareRecord[]): Record<string, number>;

export function computeTopReferrers(shares: ShareRecord[], limit?: number): Array<[string, number]>;

export function computeDailyTrend(shares: ShareRecord[], maxDays?: number): { labels: string[]; values: number[] };

export function computeCumulativeTrend(shares: ShareRecord[]): { labels: string[]; values: number[] };

export function computeKeyInsights(
  filtered: ShareRecord[],
  allShares?: ShareRecord[]
): KeyInsight[];

export function computeSummary(
  filtered: ShareRecord[],
  allShares?: ShareRecord[]
): AnalyticsSummary;

// Internal but exported for tests if desired
export function parseReferrerCodeFromLink(link: string): string;
```

Inside the module, also expose (or keep private):
- `setupFilterListeners(headerEl, onChange: (p: TimePeriod) => void)`
- Chart creators: `createPlatformBarChart(el, data)`, `createTrendLineChart(el, data)`, `createCumulativeLineChart(el, data)`

## Implementation Order Recommendation for Codex

1. Add the new types to `lib/types.ts`.
2. Create `features/admin/share-analytics.ts` with pure compute functions first (test them in browser console or with a quick script).
3. Implement `renderShareAnalytics` using the existing HTML skeleton as starting point, but fix the grid/closing tags and properly place Key Insights vs Top Referrers.
4. Wire the time filters with the clean re-render + destroy pattern.
5. Add the second line chart (cumulative is suggested — very high "automatic value").
6. Enhance `computeKeyInsights` with 5–7 meaningful automatic metrics.
7. Update `main.ts` to use dynamic import + thin dispatcher.
8. (Parallel or follow-up) Extend `admin-action` Edge Function with `get_shares` (or implement the chosen RLS solution) and switch the fetch.
9. (Nice-to-have) Extract the other three tabs using the same pattern for full consistency.

## Risks & Mitigations

- **RLS visibility:** Addressed by explicit Edge or policy recommendation above.
- **referrer_code missing:** Call out the parsing/denorm decision; implement one.
- **Chart memory leaks on rapid filter clicks:** Strict `destroyAllCharts()` + registry.
- **Over-extraction too early:** We only extract the analytics tab now; other tabs noted as follow-ups.
- **Bundle size:** Dynamic import of the analytics module + Chart.js already lazy → no regression.

## References

- `docs/project-structure.md` (feature folder discipline)
- ADR-001 (Vite + Supabase + no heavy framework)
- Current implementation: `src/main.ts:762` (switchAdminTab) and `842` (renderAnalytics)
- Admin auth flow: `submitAdminPassword` + `admin-action` Edge Function
- RLS policies: `supabase/migrations/0001_init_rls.sql` (shares_select_own) and `0002_add_rls...`

This architecture maximizes "automatic value" for the admin while staying true to the lightweight, maintainable, high-performance philosophy of the project.

Ready for implementation by Codex. All ambiguities resolved.