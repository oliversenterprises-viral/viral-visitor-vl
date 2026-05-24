# Architecture Overview

This document describes the current high-level structure of the ViralRefer Premium codebase (as of the latest refactoring pass).

## Philosophy

- Keep `main.ts` as an **ultra-thin bootstrap** (currently ~26 lines).
- Every meaningful piece of functionality lives in its own focused, well-named module.
- Global exposure for `onclick=""` handlers is centralized through `registerGlobal()`.
- Heavy / infrequently used admin tabs are loaded dynamically for better initial bundle size.
- Prefer small, low-risk extractions over large refactors.

## High-Level Structure

```
src/
├── main.ts                 # Pure bootstrap. Imports side-effect modules + calls init.
├── app.ts                  # Public site initialization (leaderboard, content, referral link, etc.)
│
├── public/                 # Everything the public HTML depends on via onclick / global
│   ├── index.ts
│   ├── modals.ts           # Admin panel, password, claim/referral details, rules modals
│   ├── handlers.ts         # Core user actions: shareTo, claimBanner, joinViaReferral
│   └── debug.ts            # simulateNewReferral, debugReferral, Escape key handler
│
├── admin/                  # All admin dashboard tabs and related logic
│   ├── index.ts            # Barrel for light tabs + shared state
│   ├── switcher.ts         # Central dispatcher (static + dynamic imports)
│   ├── state.ts            # Shared in-memory caches (claims, referrals)
│   ├── referrals-tab.ts    # Extracted: thin render + buildHTML + attachListeners
│   ├── prize-claims-tab.ts # Same extraction pattern
│   ├── share-analytics-tab.ts # Heavy tab (dynamic) — broken into pure helpers
│   ├── edit-content-tab.ts
│   └── text-colors-tab.ts  # Heavy tab (dynamic, live color preview)
│
├── lib/                    # Shared low-level utilities
│   ├── global.ts           # ViralRefer namespace + registerGlobal helper
│   ├── supabase.ts
│   └── types.ts
│
├── ui/                     # Reusable UI pieces
│   ├── toast.ts            # Self-registering toast system
│   └── admin.ts            # setActiveTab helper
│
├── referral.ts             # All referral link generation, QR, sharing logic
├── content.ts              # Public content application (from site_content table)
└── colors.ts               # Text color application logic
```

## Key Design Decisions

- **Global Registration**: All functions that need to be callable from HTML `onclick=""` attributes (or from `ViralRefer.*`) go through `registerGlobal(name, fn)`. This lives in `src/lib/global.ts` and ensures both `window[name]` and `ViralRefer[name]` are set.
- **Dynamic Imports**: The two heaviest admin tabs (`share-analytics-tab` and `text-colors-tab`) are loaded via dynamic `import()` only when the user actually opens them. This keeps the initial bundle smaller.
- **Admin Tab Pattern**: The largest admin tabs have been incrementally refactored into a consistent, readable structure (thin orchestrator + pure HTML builder + listener attachment + small pure helpers). This dramatically improves maintainability without changing any behavior.
- **Public Runtime Globals**: All mutable public-facing configuration (`referralBaseUrl`, `shareMessageTemplate`, `qrModalTitle`, `myReferralCode`) is centralized in `public/globals.ts` with lazy loading from the database or localStorage and dual exposure on `window` + `ViralRefer` for onclick compatibility.
- **Self-Registration**: Modules that expose global functions (toast, referral, public handlers, etc.) register themselves when imported. This removes the need for `main.ts` to know about every single handler.
- **Thin Orchestrator**: `main.ts` is intentionally minimal. It only:
  1. Imports the public layer (via `initPublic()`)
  2. Calls the main app initializer (`initApp()`)

## Current Size (approximate)

- `main.ts`: **~20 lines** (pure bootstrap)
- Admin tabs (referrals, prize-claims, share-analytics) have been refactored from large monolithic render functions (~200-300 LOC) into thin orchestrators + focused helpers using the pattern described above.
- All real application logic lives in small, focused modules.

## How to Add New Global Handlers

1. Create the function in the appropriate file under `src/public/` (or a new file there).
2. Call `registerGlobal('yourFunctionName', yourFunction)` at the bottom of the file.
3. Import the file from `src/public/index.ts` (so the side effects run on app boot).

The main public action functions are also re-exported from the barrel for programmatic use.

## How to Add a New Admin Tab

1. Create the tab renderer in `src/admin/your-tab.ts` as an exported `renderYourTab(content: HTMLElement)` function.
2. If the tab is lightweight, export it from `src/admin/index.ts` and add a case in `src/admin/switcher.ts`.
3. Heavy tabs (Share Analytics, Text Colors) must be loaded via dynamic `import()` inside the switcher for code-splitting.

### Recommended Implementation Pattern (established on Referrals, Prize Claims, Share Analytics)

For maintainability, the three largest tabs now follow this structure:

- `renderXxxTab(content)` — thin orchestrator (initial skeleton or loading state, data fetch + cache update, call the helpers, error handling).
- `buildXxxTableHTML(data)` — pure function that returns the full HTML string for the table/list (no DOM side-effects).
- `attachXxxListeners(content)` — attaches all interactive event listeners after the HTML is inserted (View, Copy, Action buttons, etc.).
- Small pure helpers (`computeHighRiskIPs`, `filterReferralsByDays`, analytics aggregation, etc.) at module scope with JSDoc.

This pattern keeps the main render function small and readable while making the HTML generation and event wiring easy to understand and test in isolation.

Example files that demonstrate the pattern: `referrals-tab.ts`, `prize-claims-tab.ts`, `share-analytics-tab.ts`.

---

This structure was reached through many small, low-risk extractions rather than one large refactor. The goal was to dramatically improve maintainability while keeping behavior 100% identical.
