# Quickstart: Validate Point of Sale Cashier — Phase 1

Use this guide after implementing the [plan](plan.md). The working contracts are
[cashier interactions](contracts/cashier-ui.md) and [Product reads](contracts/products-read.md).

## Prerequisites

- Use the repository's Node environment and pnpm 10.2.1 with the existing dependencies installed.
- For browser checks, use the app's existing local configuration for authentication and a
  development Neon database already set up for the current application. Use test accounts for
  both supported roles and existing development fixtures. This guide analyzes read-only cashier
  behavior and requires no migration, import, or seed command.
- Identify two active items with different known prices, a code with leading zeros, a mixed-case
  code, an uncoded item, a soft-deleted coded item, and an eligible item beyond the first
  24 catalog entries. A zero-stock fixture is useful for the cart check.
- For hardware verification, pair a USB or Bluetooth scanner in keyboard mode and configure
  it to append Enter. Typing the same codes followed by Enter checks the input flow where
  hardware is unavailable.

## Run the checks

From the repository root:

```sh
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

Confirm the focused Jest cases below when reviewing A1, U1, and E1:

- **A1** — In `tests/product-route-contracts.test.ts`, valid `name-or-code` limits 1, 24, and
  100 succeed. Invalid values 0, 1.5, abc, and over-limit 101 return HTTP 400 with
  `limit must be an integer between 1 and 100`. Check that 101 still follows the existing
  behavior on a request without `searchMode`.
- **U1** — In `src/features/dashboard/cashier/container.test.tsx`, use a deferred request and
  controlled time to reach the 10-second timeout. Check timeout and network failure independently.
  Repeat with an HTTP 500 response. All three failures unlock the field, keep the code, and
  expose **Coba lagi**. Verify that repeated Enter
  during the lookup adds nothing extra, a timed-out reply cannot add later, and retry adds
  exactly one unit without retyping.
- **E1** — In `src/features/dashboard/cashier/catalog-search.test.tsx`, start A and then B.
  Resolve B before A. Assert that previous cards are unselectable as soon as the term changes
  and that A's late response cannot displace or restore cards alongside B's results.

Run `pnpm dev` and open `http://localhost:3000/dashboard/cashier`. Use a separate browser context or sign
out to verify the signed-out case.

## Browser acceptance

| Scenario | Run and confirm |
| --- | --- |
| Entry and existing pages (SC-001, SC-008) | Visit `/dashboard/cashier` signed out and verify the existing dashboard login redirect. Sign in as each supported role, open **Kasir** via the dashboard sidebar, and verify the URL and normal header/sidebar. Open existing Product and Transaction views. Confirm the existing Product search still matches names as before and the transaction views render normally. |
| Catalog (SC-002, SC-006) | Search by mixed-case product name and by a partial code. Include a match that was outside page 1 before filtering. Confirm uncoded active products can be selected by name and deleted ones are absent. Check paging and reset when the search changes. Verify no-results separately from failure. |
| Scan (SC-003, SC-007) | Focus the shared field. Submit ten valid codes, including repeated and leading-zero codes, waiting until the field is ready each time. Expect ten added units and one line per product. Try unknown, partial, and deleted codes, confirming they add nothing. Test Enter on another control and verify it performs that control's normal action. |
| Slow or failed catalog access (SC-003, SC-006) | Throttle or block the Product request using browser developer tools. While an exact request is pending, submit a different code. Confirm the original value stays intact and the UI instructs the cashier to rescan. Once ready, rescan and confirm exactly one addition for that code. Test grid failure and exact failure independently, restore access, and retry. Verify the existing cart survives either failure. |
| Barcode timeout and retry (SC-003, SC-006) | Use a fresh known code with the network delayed beyond 10 seconds. At timeout, verify the field is editable with the original code and shows **Pencarian kode melebihi batas waktu. Coba lagi.** Restore the network, select **Coba lagi**, and verify one unit is added. Repeat with a network failure and check for **Gagal mencari kode produk. Periksa koneksi dan coba lagi.** |
| Barcode HTTP 500 (SC-003, SC-006) | Return HTTP 500 for one exact lookup using browser request interception. Verify **Gagal mencari kode produk. Coba lagi.**, an editable field with the original code, and an unchanged cart. Restore the live response, select **Coba lagi** without retyping, and verify exactly one unit is added. |
| Cart (SC-004, SC-008) | Example with items priced Rp12.000 and Rp8.000: add two of the first and one of the second for a total of Rp32.000 and three units. Decrease the first once for Rp20.000 and two units. At quantity one, decrease is unavailable. Remove a line, cancel a clear, then confirm a clear and see zero units, a zero total, and the empty state. A zero-stock product remains selectable. With network monitoring open, confirm that cart actions send no write requests. |
| Layout (SC-005, SC-007) | At 1440, 768, and 375 px, repeat two full focus mode cycles with a populated cart and nonempty search. Confirm that the workspace expands, **Keluar layar penuh** remains reachable, the dashboard header and sidebar return on exit, and lines, totals, and search stay intact. Check tab order and verify the grid and cart controls remain reachable in both modes. Inspect for horizontal overflow or clipping with long names and codes, even if page scrolling is hidden. From Products, open **Kasir**, enter focus mode, and use browser Back and Forward. Verify Products has its normal shell and Kasir reopens in normal mode. |
| Extra-small sidebar (E2, SC-005) | At 375 px in normal mode, open and close the dashboard sidebar with a populated cart and nonempty search. Verify the workspace retains its state. Repeat a focus mode cycle and use the product grid, quantity controls, and exit button without horizontal scrolling or clipped controls. |

## Verification evidence

Record pass/fail results with the test browser, viewport widths, and whether each scanner case
used manual typing or physical hardware. Capture the lookup-ready state during the throttled
case and the totals before and after a focus-mode cycle. Jest covers mocked contracts and
component behavior. Browser and hardware checks provide separate evidence for real authentication,
layout, catalog reads, and scanner input. Record any check that the available environment could
not support.

### Final verification — 2026-11-17

Verified implementation commit `3340452` on `002-pos-cashier`, using pnpm 10.2.1.

| Automated check | Result |
| --- | --- |
| `pnpm lint` | Passed with zero errors and one pre-existing unused ESLint directive warning in the generated `coverage/lcov-report/block-navigation.js`. |
| `pnpm exec tsc --noEmit` | Passed. |
| `pnpm test` | 73 tests passed across 17 suites. |
| `pnpm build` | Production build passed, including the dynamic `/dashboard/cashier` route. |
| T001 baseline comparison | The same Product service and route suites increased from 15 passing tests to 19 passing tests. No regression was found in those suites. |

The scope review compared `31a36db` with `3340452`. The Product list still uses its prior
name-only filtering, paging, and response shape when `searchMode` is omitted. The upper
limit of 100 applies only to the opt-in catalog mode. Product write handlers, Transaction
code, the database schema, migrations, and dependencies stayed unchanged.

#### Browser and development database

Chrome 157 headless ran the production build on localhost against the configured development
Neon database. The browser accepted locally signed QA sessions for existing active accounts
with the `admin` and `cashier` roles. Those checks exercised authenticated route access and
role behavior. Credential form sign-in was not exercised because dedicated test passwords were
unavailable. The signed-out redirect was verified in a fresh browser profile.

| Scenario | Result | Data source |
| --- | --- | --- |
| Auth and existing pages | Signed-out Kasir redirected to login. Both authenticated roles opened Kasir from the sidebar. The existing Product page searched by name and retained its role controls. Transaction list and detail loaded with actual line items. | Neon reads and signed QA sessions |
| Product API | The omitted-mode request accepted `limit=101` and retained name-only matching. The opt-in catalog accepted 100 and rejected 101. Exact matching normalized case and whitespace, returned the expected envelope with fixed pagination, and excluded a soft-deleted code. | Neon reads |
| Catalog and cart | Mixed-case name and partial-code searches returned the expected cards. Verified selection, subtotals from two different prices, grand total, quantity floor, individual removal, cancel and confirm clear, empty totals, and no-results feedback. | Neon reads and local cart |
| Barcode keyboard input | Valid and repeat scans added to one line. An unknown code, a partial code, and a deleted code added nothing. Enter on a cart control operated that control and sent no exact lookup. | Neon reads and browser keyboard events |
| Recovery | A second scan during an outstanding lookup was ignored and succeeded after a rescan. Injected network failure and HTTP 500 left the code editable and the cart unchanged. The 10-second deadline canceled the held request. Retry without retyping added one unit, with no later duplicate. Grid failure and retry preserved the cart. The Jest deferred-response test separately verified that a late success cannot update the cart when the transport still resolves. | Controlled browser faults with live retries, plus Jest for late resolution |
| Focus mode and keyboard | At 1440, 768, and 375 px, two enter/exit cycles preserved the mounted search input, cart quantities and totals. The layout stacked on smaller widths, and grid, cart controls, shortcut, and exit remained reachable without horizontal overflow. Tab reached search from the focus toggle while header and sidebar were absent. Opening and closing the sidebar at 375 px preserved state. Browser Back/Forward restored normal mode. | Chrome with live Neon catalog |
| Unavailable catalog fixtures | Verified a 25-entry catalog, navigation to page two and reset on search, a match beyond page one, an uncoded item, a zero-stock item, leading-zero and mixed-case codes, 10 consecutive Enter scans, reverse-order search responses, and long labels at 375 px. | Controlled browser responses only |

The development database had five active products and lacked fixtures for leading-zero
and mixed-case codes, uncoded and zero-stock products, and a catalog beyond 24 items.
Those browser fixture results verify the UI behavior for those inputs. Contract tests and
mocked repository checks cover the related query paths. Those inputs were not tested against
Neon, and no database fixture was created.
The full browser matrix recorded zero write requests, and Product and Transaction row
counts stayed unchanged. No migration, seed, or import ran.

A physical barcode scanner was unavailable for this verification. Chrome received keyboard
input with an Enter suffix. Pairing, hardware timing, and credential form sign-in remain
outside the evidence above.
