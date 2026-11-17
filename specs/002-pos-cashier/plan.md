# Implementation Plan: Point of Sale Cashier — Phase 1

**Branch**: `002-pos-cashier` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: `specs/002-pos-cashier/spec.md`

## Summary

Add `/dashboard/cashier` under the existing authenticated dashboard layout, with a responsive
product grid, keyboard scanner input, and a local cart. Add cashier-specific sizing
and focus controls while keeping the workspace mounted. Extend the existing Product list
read with opt-in partial and exact matching. Phase 1 ends at cart preparation.

## Technical Context

**Language/Version**: Strict TypeScript 5.9, React 19, Next.js 15.5.29 App Router.

**Primary Dependencies**: Existing Ant Design 5 theme and App provider, TanStack Query 5,
NextAuth, Sass Modules, and Drizzle.

**Storage**: Cart and field state in the mounted React workspace. Existing Neon Product reads.

**Testing**: Jest with `next/jest`, Node service and route contract tests, jsdom and React
Testing Library for cashier interactions, and manual browser and keyboard-scanner acceptance.

**Target Platform**: Desktop and tablet browsers with narrower viewport support. USB and
Bluetooth scanners configured as keyboard devices with an Enter suffix.

**Project Type**: Existing single Next.js application.

**Performance Goals**: Page the catalog in groups of 24, debounce grid search by about 200 ms,
issue one fresh exact request per accepted submission with a 10-second client deadline, and
update cart totals locally. Use the spec's ten consecutive scan run as the throughput acceptance
scenario. Show pending state so the cashier knows when to rescan.

**Constraints**: Inherit authentication from the existing dashboard layout. Keep other existing
route URLs and Product list defaults. Use dashboard layout state for focus mode and field-local
input events for scans. Phase 1 makes read-only catalog requests. Existing dependencies and
schema suffice.

**Scale/Scope**: One cashier workspace per mounted page. Catalog matching spans the active
catalog through response pages capped at 100 items by the server for `name-or-code` and
a single-row exact lookup.

## Constitution Check

| Principle | Before research | After design |
| --- | --- | --- |
| I. Architecture and maintainability | Pass. Reuse current route, feature, service and repository boundaries. | Pass. The cashier page inherits the existing dashboard layout and client shell. Product matching follows route → service → repository. |
| II. Type safety and contracts | Pass. Keep shared Product and response types and preserve existing callers. | Pass. Type and validate opt-in options in the service, validate cashier response data consumed at the client boundary, and keep existing default parameters, responses and status handling. |
| III. Reuse and consistent UI | Pass. Use existing providers, theme, query conventions and URL pagination. | Pass. Use Product API plumbing, isolated query keys under the Product prefix, existing URL query hook, Ant Design and shared currency formatting. |
| IV. Security and integrity | Pass. Task only requires authenticated catalog reads and local state. | Pass. Keep the sign-in check and `withAuth`. Bind search values and require active products in both modes. Existing write behavior and transaction paths stay outside the change. |
| V. Behavioral verification | Pass. Plan standard tests and manual checks for changed behavior. | Pass. Provide focused service/repository, route and component checks plus a reproducible browser and scanner validation guide. |

No constitution exception required. The declared Next.js version comes from
`package.json`, which is newer than the version recorded in the constitution baseline.

## Project Structure

### Documentation (this feature)

```text
specs/002-pos-cashier/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── cashier-ui.md
    └── products-read.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/products/route.ts
│   └── dashboard/
│       ├── layout.tsx
│       └── cashier/page.tsx
├── components/dashboard-layout/{index.tsx,util.tsx}
├── features/dashboard/
│   ├── cashier/
│   │   ├── container.tsx
│   │   ├── styles.module.scss
│   │   ├── components/{product-grid.tsx,cart-panel.tsx}
│   │   └── hooks/{use-cashier-products.ts,use-cashier-cart.ts}
│   └── products/api/product.api.ts
└── server/
    ├── repositories/product.repository.ts
    └── services/product.service.ts
tests/
└── product-route-contracts.test.ts
```

**Structure Decision** — Nest the cashier page under `src/app/dashboard/layout.tsx`, which
already handles authentication, the sign-in redirect, session context, and shell composition.
The cashier route adds only a page entry. Keep the cashier feature next to the dashboard features
and place pure UI, cart state, and Product reads in their respective components and hooks.
Component tests live beside the cashier source. Extend the existing Product client API module
so both screens use the shared request helper.

## Implementation Design

1. **Route and layout (FR-001–002, FR-014–015).** Add the nested dashboard page and point the
   existing sidebar's **Kasir** entry to `/dashboard/cashier`. Start in the normal dashboard
   layout. In the existing client shell, scope focus state and sizing to the cashier pathname.
   Hide the sidebar and header in focus mode and restore them with their prior collapse
   preference on exit. Clear focus mode when navigating away so re-entry starts in normal
   mode. Keep the content branch and toggle mounted through mode changes so the cart survives
   and keyboard focus stays on the toggle. Use the available viewport in focus mode, a
   responsive SCSS grid, a cart shortcut with summary on stacked layouts, and `lang="id"`
   on the cashier region. Verify 375 px alongside 1440 and 768 px in both modes. Keep the grid,
   cart controls, and focus mode exit reachable without horizontal overflow or clipping.
2. **Catalog reads (FR-003–008, FR-016).** Extend the list read with the two opt-in modes in
   the [Product contract](contracts/products-read.md). Validate a `name-or-code` limit of
   1–100 inclusive in the service and return 400 for invalid values. Requests without a mode
   keep their original behavior. Send query options through the current API module and use
   a cashier hook with keys starting with `['products', 'cashier']`,
   including mode, term, page and limit. Existing Product mutations continue to invalidate the
   Product prefix. Keep the search field in local state and the grid page in URL query params.
   Reset to page 1 when the input changes or a scan succeeds. Render selectable cards only
   for the current normalized term and page. Gate the grid while the current term differs
   from the debounced term and avoid previous-query placeholder data for the cashier grid.
   TanStack Query keys isolate late results. Keep the existing Product list hook behavior.
3. **Scan handling (FR-007–009, FR-015).** Handle Enter on the input, ignoring key repeat and IME
   composition. Use a synchronous in-flight guard and render the field read-only during lookup.
   Use an imperative React Query read with `staleTime: 0`, `retry: false`, and a no-store fetch
   for exact matching. Abort the request and end the attempt at 10 seconds. Only the active,
   unexpired attempt may add a product. Release the guard on completion, timeout, or rejection.
   On timeout or network failure, keep the code and offer one fresh manual retry.
   Handle errors using the existing query provider and localized feedback.
   Complete or retry each scan according to the [cashier contract](contracts/cashier-ui.md).
4. **Cart interactions (FR-009–013).** Apply functional updates to lines keyed by product
   ID. Calculate amounts as described in the [data model](data-model.md). Show feedback for
   adding items and use the current Ant Design confirmation pattern for clearing the cart.
   Reuse `formatRupiah` for prices and totals.
5. **Verification (SC-001–008).** Add focused checks for opt-in versus default matching,
   active filtering, runtime input validation (including the 100-item boundary), and response
   compatibility. Cover quantities, reverse-order grid responses, and timeout, retry, and
   late scan results with observable assertions. Run the repository checks and use the
   [quickstart](quickstart.md) to verify real navigation, responsive layout, and scanner flow.
