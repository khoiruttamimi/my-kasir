---
description: "Implementation tasks for Point of Sale Cashier Phase 1"
---

# Tasks: Point of Sale Cashier — Phase 1

**Input**: [Specification](spec.md), [implementation plan](plan.md), [research](research.md),
[data model](data-model.md), [Product read contract](contracts/products-read.md),
[cashier interaction contract](contracts/cashier-ui.md), and [validation guide](quickstart.md).

**Tests**: Use Jest with `next/jest`. Service and mocked route contract tests use Node.
Component tests use React Testing Library and opt in to jsdom. Browser and hardware
acceptance provide separate evidence.

## Format

Each task has a sequential ID and exact repository-relative paths. `[P]` marks work that
can run concurrently once its prerequisites are complete. `[US1]` through `[US4]` map
to the stories in the specification. Phase numbers below describe implementation order.

## Phase 1: Setup

**Purpose**: Establish the baseline with the existing toolchain.

- [X] T001 Confirm the pinned pnpm version and local scripts in `package.json`. Run the existing Product service and route checks in `src/server/services/product.service.test.ts` and `tests/product-route-contracts.test.ts`; record any pre-existing failures with the baseline for later comparison.

## Phase 2: Shared Foundations

**Purpose**: Establish the nested dashboard route and the local add behavior reused across stories.

- [X] T002 [P] Scaffold the page entry at `src/app/dashboard/cashier/page.tsx`. Inherit the shell, session context, and sign-in redirect from `src/app/dashboard/layout.tsx` through route nesting. Leave cashier feature composition to T012.
- [X] T003 [P] Create the shared add operation in `src/features/dashboard/cashier/hooks/use-cashier-cart.ts` using local React state and existing Product types. For `productId`, “Unique within the cart.” For `name` and `unitPrice`, “Snapshot from the first addition of this line.” For `quantity`, “Positive integer. A new line starts at one.” Adding an existing product increments its line by one and retains its snapshot.

**Checkpoint**: The cashier page inherits the dashboard shell and sign-in flow. Both add paths
can use one cart state operation.

## Phase 3: US1 — Find and Select Products (P1)

**Goal**: Open Kasir from the normal application layout, find eligible products by name or
code, and add an item from the product grid.

**Independent test**: Sign in, open **Kasir**, and search for a mixed-case name and a partial
code from beyond the initial catalog page. Add the result and verify visible feedback and one
cart unit. An uncoded product remains selectable by name and deleted products stay hidden.

### Tests

- [X] T004 [P] [US1] In `tests/product-route-contracts.test.ts`, check authenticated `name-or-code` reads with valid `limit` values 1, 24, and 100 and the existing Product envelope. Assert HTTP 400 and the contract message for invalid limits 0, 1.5, and abc and over-limit 101. Keep tests for omitted-mode behavior with limit 101, invalid mode or opt-in page, and the existing 401.
- [X] T005 [P] [US1] Add Node regressions in `src/server/services/product.service.test.ts` and `src/server/repositories/product.repository.test.ts` for inclusive bounds and rejected opt-in values, active-only name/code predicates, literal wildcard characters, stable opt-in ordering, and the existing name-only default with its current pagination and ordering.
- [X] T006 [P] [US1] Test accessible activation, assigned and unassigned codes, and loading, empty, and retry states in `src/features/dashboard/cashier/components/product-grid.test.tsx`. In `src/features/dashboard/cashier/catalog-search.test.tsx`, use React Testing Library and the cashier query hook with controlled responses. Start with visible cards, then start A and switch to B before A resolves. Verify prior cards are unselectable during debounce and loading. Resolve B before A and verify only B's cards are shown and selectable after A arrives.

### Implementation

- [X] T007 [US1] Implement `name-or-code` matching in `src/server/repositories/product.repository.ts`. Bind a case-insensitive literal substring over name or code, require active rows, keep blank search browsable, and use `createdAt DESC, id DESC` for the opt-in mode. Preserve the default list query and code reservation logic.
- [X] T008 [US1] In `src/server/services/product.service.ts`, validate the opt-in mode and positive integer grid page. In `name-or-code` only, require integer limits from 1 to 100 inclusive and reject invalid values through the shared HTTP 400 contract. Forward parameters through the existing `withAuth` and `apiResponse` flow in `src/app/api/products/route.ts`. Preserve the response shape and behavior when mode is omitted.
- [X] T009 [US1] Extend the existing request helper in `src/features/dashboard/products/api/product.api.ts` for the opt-in grid mode. Use it in `src/features/dashboard/cashier/hooks/use-cashier-products.ts` with a query key under the Product prefix containing mode, normalized term, page, and limit. Use the cashier hook without previous-query placeholder data. Validate the consumed Product fields and pagination at the cashier boundary. For `code`, “Assigned code text or `null` for an uncoded legacy product.” For `price`, “Selling price in whole rupiah.”
- [X] T010 [P] [US1] Build selectable product cards and Indonesian grid states in `src/features/dashboard/cashier/components/product-grid.tsx` and `src/features/dashboard/cashier/styles.module.scss`. Use keyboard-operable controls, `formatRupiah` from `src/utils/format-money.ts`, and appropriate Ant Design components for paging, feedback, and retry.
- [X] T011 [P] [US1] Add the primary **Kasir** menu item for cashier and administrator roles in the existing dashboard sidebar via `src/components/dashboard-layout/util.tsx`. Use `/dashboard/cashier` as the menu key and navigation target.
- [X] T012 [US1] Wire `src/app/dashboard/cashier/page.tsx` to `src/features/dashboard/cashier/container.tsx`. Compose the controlled search field and grid with `lang="id"`, 24 items per page, roughly 200 ms debounce, and `src/hooks/use-query-params.ts` for URL page state. Reset to page one when the search changes. Render selectable cards only for the current term and page, without keeping selectable previous results during debounce or loading. Add one unit with feedback and a cart count. Catalog retry preserves the cart.

**Checkpoint**: Navigation, catalog search, and click or keyboard selection are ready to demo.

## Phase 4: US2 — Build and Adjust a Cart (P1)

**Goal**: Adjust quantities and review correct amounts, then remove or clear items as needed.

**Independent test**: Add two units priced Rp12.000 and one unit priced Rp8.000. Verify separate
lines, subtotals Rp24.000 and Rp8.000, total Rp32.000, and three units. Check the minimum quantity,
line removal, and cancellation and confirmation of clear.

### Tests

- [X] T013 [P] [US2] Add cart hook checks in `src/features/dashboard/cashier/hooks/use-cashier-cart.test.tsx` for repeat adds by product ID, price snapshots, increment and decrement bounds, removal, and derived amounts including the empty state.
- [X] T014 [P] [US2] Add cart interaction checks in `src/features/dashboard/cashier/components/cart-panel.test.tsx` for item-specific controls, decrease disabled at one, immediate removal, and cancel or confirm of the localized clear dialog.

### Implementation

- [X] T015 [US2] Complete cart updates and derived values in `src/features/dashboard/cashier/hooks/use-cashier-cart.ts`. Keep quantity at least one for retained lines. Derive line subtotal from unit price × quantity, grand total from subtotals, and total units from quantities. Empty cart totals are zero.
- [X] T016 [US2] Implement the panel in `src/features/dashboard/cashier/components/cart-panel.tsx` and compose it in `src/features/dashboard/cashier/container.tsx`. Reuse Ant Design controls, the existing `App.useApp().modal.confirm` pattern, and `formatRupiah`. Display Indonesian amounts and actions, keep individual removal immediate, and show empty state with zeros after confirmed clear.

**Checkpoint**: Test with fixed products independently of scanning. Cart actions stay local,
including for an active product with zero recorded stock.

## Phase 5: US3 — Add Products by Scanning Their Codes (P1)

**Goal**: Resolve one exact active Product Code at a time from keyboard scanner input.

**Independent test**: Focus the shared field and submit the same leading-zero code twice, an
unknown code, and a second valid code during a delayed lookup. Verify repeat scan increments the
same line, unknown retains the code, and a busy scan requires rescan after the field is ready.

### Tests

- [X] T017 [P] [US3] Add exact-mode cases in `tests/product-route-contracts.test.ts`, `src/server/services/product.service.test.ts`, and `src/server/repositories/product.repository.test.ts` for trimmed case-insensitive equality with leading zeros, active-only matching, absent and partial matches, fixed page and limit, and HTTP 200 empty data versus HTTP 400 for blank exact input.
- [X] T018 [P] [US3] In `src/features/dashboard/cashier/container.test.tsx`, verify click then scan merges one line, success clears the focused field, and unknown code differs from failure. Use a deferred lookup and controlled time to cover the 10-second timeout. Assert timeout and network failure unlock input, retain the code, and show the Indonesian error with **Coba lagi**. Verify repeated submissions while pending and late success after timeout add no extra units, retry adds exactly one unit without retyping, and Enter elsewhere is unaffected. Simulate a separate barcode lookup returning HTTP 500. Assert the scan input becomes editable, the scanned code is preserved, an Indonesian error and the **Coba lagi** action are shown, and the cart remains unchanged. Select **Coba lagi** and verify a fresh lookup uses the same barcode without retyping.

### Implementation

- [X] T019 [US3] Implement `exact-code` in `src/server/repositories/product.repository.ts`, `src/server/services/product.service.ts`, and `src/app/api/products/route.ts`. Keep the code as text and trim outer whitespace. Require an active row and use a bound case-insensitive equality with the existing code index. Return the existing list envelope with page 1, limit 1 and zero or one row.
- [X] T020 [US3] Add the fresh exact read in `src/features/dashboard/products/api/product.api.ts` and `src/features/dashboard/cashier/hooks/use-cashier-products.ts`. Use `page=1&limit=1`, no-store, and imperative React Query with an exact-mode key, `staleTime: 0`, and automatic retry off. End the attempt and abort the fetch after 10 seconds. Clear the timer when the attempt ends and distinguish timeout and network failure from a successful empty response.
- [X] T021 [US3] Handle input-local Enter in `src/features/dashboard/cashier/container.tsx`. Skip blank, repeated-key, or IME submissions. Use a synchronous guard and focusable read-only field while pending. Announce the rescan notice and let only the current, unexpired attempt add through the shared cart operation. Release the guard on completion or failure. Clear the field and reset paging on success, preserve deliberate focus moves, and retain the code on miss, timeout, or network failure. On timeout or network failure, show the contract message and wire **Coba lagi** to one fresh lookup for the retained code.

**Checkpoint**: Scans work with typed input and Enter. Verify ten accepted scans and the
delayed rescan case in the browser during final acceptance.

## Phase 6: US4 — Use Normal and Focus Modes on Desktop and Tablet (P2)

**Goal**: Toggle the existing shell chrome while preserving a mounted cashier workspace.

**Independent test**: Populate the cart, enter and exit focus mode twice at 1440, 768, and
375 px, and compare quantities and totals before and after. Verify the grid, cart controls,
and exit button at each width, with keyboard access and no horizontal overflow.

### Tests

- [X] T022 [P] [US4] Add a shell and cashier interaction test in `src/features/dashboard/cashier/focus-mode.test.tsx`. Use the real dashboard shell with mocked session, pathname, catalog inputs, and extra-small breakpoint. Verify the normal default, chrome hidden and exit available in focus mode, and chrome restored on exit. Verify the workspace stays mounted and preserves the cart and search across focus and sidebar changes. Check that leaving Kasir restores the other pages' shell and re-entry starts in normal mode.

### Implementation

- [X] T023 [US4] Implement focus state and stable child rendering in `src/components/dashboard-layout/index.tsx` for the `/dashboard/cashier` pathname. Start in normal mode, hide the existing header and sidebar from visual and keyboard navigation while focused, and restore them with the prior sidebar collapse preference on exit. Reset focus state when leaving the cashier route. Expose the toggle through a small shell context and keep the cashier mounted through display and narrow-screen sidebar changes.
- [X] T024 [US4] Add the stable **Layar penuh** / **Keluar layar penuh** control in `src/features/dashboard/cashier/container.tsx`. Apply cashier-specific width and viewport sizing in `src/components/dashboard-layout/index.tsx` and `src/features/dashboard/cashier/styles.module.scss`. Place catalog and cart side by side on desktop and provide a keyboard-operable cart shortcut with totals when stacked. Keep the grid, cart controls, and exit reachable at 375 px without horizontal overflow.

**Checkpoint**: A browser check confirms width, scroll, and tab order. The component check
confirms state preservation through the real shell and toggle.

## Phase 7: Cross-Cutting Verification

- [ ] T025 Run `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build` from the repository root using `package.json`. Compare Product results with T001 and document any existing failures.
- [ ] T026 Run the browser acceptance matrix in `specs/002-pos-cashier/quickstart.md` against a configured development environment. Cover both roles and signed-out navigation, existing Product and Transaction views, lookup timeout and grid failure recovery, cart totals, and keyboard navigation. At 1440, 768, and 375 px verify focus toggling preserves the workspace. Confirm the grid, cart controls, and exit stay reachable without horizontal overflow. Record whether physical scanner hardware was available.
- [ ] T027 Record verification results and limits in `specs/002-pos-cashier/quickstart.md`. Review the final diff against `specs/002-pos-cashier/plan.md` for compliance with the agreed Phase 1 scope and unchanged default Product contracts.

## Dependencies & Execution Order

| Stage | Depends on | Integration order |
| --- | --- | --- |
| Setup and foundations (T001–T003) | Existing repository | T001 → T002 and T003 in parallel. |
| US1 (T004–T012) | T002, T003 | Repository → service/route → client query → page composition. T012 also needs the grid and menu. |
| US2 (T013–T016) | T003 for hook work, T012 for page integration | Complete cart state in T015 before connecting the panel in T016. |
| US3 (T017–T021) | T008–T009 for Product read support, T012 for the shared input, T016 for integrated cart assertions | Exact server read → exact client query → scan interaction. |
| US4 (T022–T024) | T002 for the nested route, T016 for the cart and totals | Add focus state to the existing shell in T023 before wiring the toggle in T024. Finish T021 before editing the same container in T024. |
| Verification (T025–T027) | All story integrations | Run T025 before starting the local server in T026. Record results after both. |

### Parallel Examples

| Story | Work that can run concurrently |
| --- | --- |
| US1 | T004, T005, and T006 use separate files. T010 and T011 can proceed alongside server work in T007–T008. |
| US2 | T013 and T014 cover separate files and can be prepared after the local state and page foundations. |
| US3 | T017 and T018 cover server and UI test files separately once their shared catalog and cart prerequisites are available. |
| US4 | T022 can be prepared while US3 integration proceeds. Schedule T024 after T021 because both touch the cashier container. |

## Implementation Strategy

1. Deliver the shared foundations and US1 as the first demoable slice. Confirm signed-in entry,
   catalog search, selection, and a local cart count.
2. Add the cart controls and totals in US2. Then route scan additions through the same cart state
   in US3. Validate each story at its checkpoint.
3. Integrate US4 and complete the verification phase. All four stories are required to finish
   POS Phase 1.
