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
  Both unlock the field, keep the code, and expose **Coba lagi**. Verify that repeated Enter
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
