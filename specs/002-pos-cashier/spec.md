# Feature Specification: Point of Sale Cashier — Phase 1

**Feature Branch**: No new branch; authored on `main`.

**Created**: 2026-11-17

**Status**: Clarified — ready for planning

**Input**: Give My Kasir users a cashier workspace for finding products, adding them by
selection or barcode, and managing a temporary cart before future checkout phases.

## Clarifications

### Session 2026-11-17

- Q: How should Kasir handle a second barcode scan while the first code is still being looked up?
  → A: Process one scan at a time. Show lookup status and tell the cashier to rescan any code
  scanned while the lookup was pending.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find and select products (Priority: P1)

As a cashier, I can open Kasir, find a product by name or code, and add it with one action.

**Why this priority**: Cashiers must be able to build a cart even without a scanner.

**Independent Test**: Sign in, open Kasir from the sidebar, search a catalog containing
coded, uncoded, and soft-deleted products, and add a matching product card.

**Acceptance Scenarios**:

1. **Given** a signed-in cashier or administrator, **When** they choose **Kasir** from the
   dashboard sidebar or open `/dashboard/cashier` directly, **Then** the cashier page opens
   with the existing dashboard header and sidebar. A signed-out visit follows the existing
   dashboard sign-in flow.
2. **Given** an active product named “Kopi Susu” with code `00123`, **When** a cashier types
   `kOPi` or `0012`, **Then** the grid shows the product's name, selling price, and full code.
3. **Given** an active legacy product without a code and a soft-deleted product,
   **When** the cashier browses or searches, **Then** the legacy product remains selectable
   and its card indicates no code is assigned; the deleted product cannot be selected.
4. **Given** a visible product card, **When** the cashier clicks, taps, or activates it by
   keyboard, **Then** one unit is added and the cashier receives visible feedback.
5. **Given** a catalog request that is pending, succeeds with no results, or fails,
   **When** the cashier views the grid, **Then** they see the corresponding loading,
   empty, or error state. After a failure they can retry without losing the cart.
6. **Given** an eligible product outside the first visible set of cards, **When** the
   cashier searches by its name or code, **Then** they can find and select it without
   browsing through earlier cards.
7. **Given** search A is pending, **When** the cashier enters search B and B returns before
   A, **Then** A's cards cannot be selected after the query changes, and A's late response
   cannot replace B's results.

---

### User Story 2 - Build and adjust a cart (Priority: P1)

As a cashier, I can adjust a cart and see the correct amounts and unit count at every step.

**Why this priority**: Cashiers need to correct selections before they can hand off a sale.

**Independent Test**: Add two products at different prices, repeat one selection, then adjust,
remove, and clear lines while checking amounts and counts.

**Acceptance Scenarios**:

1. **Given** an empty cart, **When** the cashier adds two units at Rp12.000 and one unit
   of another product at Rp8.000, **Then** the cart shows two lines, subtotals of Rp24.000
   and Rp8.000, a grand total of Rp32.000, and three units.
2. **Given** that same cart, **When** the cashier decreases the two-unit line once,
   **Then** the cart shows two units and Rp20.000. Decrease is unavailable for a line with
   one unit; explicit removal deletes that line and updates the totals.
3. **Given** a populated cart, **When** the cashier requests to clear it, **Then** canceling
   leaves it intact and confirming removes all lines, shows zero units and a zero total,
   and displays the cart empty state. Removing one line does not require confirmation.
4. **Given** an eligible product with zero recorded stock, **When** the cashier adds
   or adjusts it, **Then** the cart updates without a stock warning or any change to the
   saved product, stock, or transaction records.

---

### User Story 3 - Add products by scanning their codes (Priority: P1)

As a cashier, I can scan successive products without reaching for the mouse or choosing
among search results.

**Why this priority**: Repeated scans are a primary cashier workflow.

**Independent Test**: With the search field focused, send keyboard-style scanner input followed
by Enter for a known code twice, an unknown code, and a different known code.

**Acceptance Scenarios**:

1. **Given** a focused search field and an active product with code `00123`, **When** a USB or
   Bluetooth keyboard-style scanner sends `00123` and Enter, **Then** exactly one unit is
   added, feedback appears, and the field clears and stays focused for the next scan.
2. **Given** a product already in the cart from card selection or scanning, **When** its code
   is submitted again, **Then** the existing line increases by one unit.
3. **Given** a blank, partial, unknown, or soft-deleted code, **When** Enter is pressed,
   **Then** nothing is added. For a nonblank code with no exact available match, show
   “Kode produk tidak ditemukan” and retain the entry for correction.
4. **Given** a product with code `AbC001`, **When** the cashier types ` abc001 ` and presses
   Enter, **Then** the same product is added once.
5. **Given** keyboard focus outside the search field, **When** the user types a code or
   presses Enter, **Then** the cashier scan workflow does not capture the input or override
   the focused control's normal behavior.
6. **Given** a scan lookup that fails on the network or reaches 10 seconds without completing,
   **When** it fails or times out, **Then** the field unlocks, the original code and cart remain
   intact, and an Indonesian error offers a retry without retyping. A late reply from a timed-out
   lookup cannot add an item. Retrying a valid code adds exactly one unit on success.
7. **Given** the lookup for the first code is still pending, **When** a second code and Enter
   reach the shared field, **Then** the second scan neither edits the first code nor adds a
   unit. The lookup status tells the cashier to rescan any code scanned while waiting.
   After the first lookup succeeds, rescanning the second valid code adds exactly one unit.

---

### User Story 4 - Use normal and focus modes on desktop and tablet (Priority: P2)

As a cashier, I can use the whole available page when needed and return to the normal layout
without rebuilding the cart.

**Why this priority**: More working space is useful on smaller screens and during repeated scanning.

**Independent Test**: Populate the cart, enter and exit focus mode at 1440, 768, and 375 px,
and check the workspace and totals in both modes.

**Acceptance Scenarios**:

1. **Given** a cart with items in the normal layout, **When** the cashier selects **Layar penuh**,
   **Then** the existing sidebar and header are hidden, the cashier workspace expands within
   the browser window, and **Keluar layar penuh** is visible.
2. **Given** focus mode, **When** the cashier exits it, **Then** the header and sidebar return
   to their usual responsive layout and all cart lines, quantities, subtotals, and totals
   are unchanged by the switch.
3. **Given** desktop, portrait tablet, and 375 px viewport widths, **When** the cashier browses
   products and changes the cart in both modes, **Then** the desktop view places both sections
   side by side. At narrower widths the product grid, cart controls, totals, and focus mode exit
   remain reachable without horizontal overflow or clipped controls.
4. **Given** keyboard-only use, **When** the cashier moves through controls in either mode,
   **Then** focus is visible, product and cart actions have clear Indonesian labels, and controls
   in the hidden header and sidebar are skipped.

### Edge Cases

- A blank search shows the catalog. Blank or whitespace-only submission does not add a product.
- Codes are text: `00123` and `123` are distinct. A partial code or a product name is never
  enough to add an item through Enter; an exact code match takes precedence over name results.
- Search and scans work for eligible products outside the first visible set of cards.
- Products without codes can be found by name and selected manually.
- After the query changes, older cards cannot be selected while current results load.
  A late response for the old query cannot replace current results. A catalog failure does
  not empty the cart.
- Products are never duplicated as separate lines when added through different input methods;
  quantity one is the minimum for a line that remains in the cart.
- Refreshing or leaving the cashier page may discard the cart; switching display modes may not.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Signed-in cashiers and administrators MUST be able to open `/dashboard/cashier`
  directly or through **Kasir** in the existing dashboard sidebar. The page MUST inherit
  the dashboard layout and authentication and open in normal dashboard mode by default.
- **FR-002**: The cashier MUST be able to enter and leave an in-app focus mode. It MUST hide
  the existing sidebar and header, use the available browser viewport without entering browser
  fullscreen, keep a visible exit control, and preserve the cart through both transitions.
- **FR-003**: The page MUST show selectable cards in a grid that adapts to available width.
  Cards MUST show product name, selling price, and assigned code or an unassigned indicator.
- **FR-004**: The page MUST use the existing product catalog and its active-product rules for
  cards, search, and scan results. The page MUST NOT change catalog data or use stock levels
  to restrict selection or cart quantity in this phase.
- **FR-005**: A shared search and scan field MUST support case-insensitive partial matches
  by product name or code across the eligible catalog, with outer whitespace ignored.
  The opt-in cashier catalog search MUST accept integer page sizes from 1 to 100 inclusive
  and return a validation error for invalid sizes. Default Product list behavior is unchanged.
- **FR-006**: Product selection MUST show distinct loading, no-results, and failure states.
  The cashier MUST be able to retry after a failure without losing cart contents.
  The grid MUST only allow selection from the current query. Older cards MUST be
  unselectable as soon as the search changes, and late results MUST NOT replace current results.
- **FR-007**: Pressing Enter in the shared field MUST add one unit for an exact match to an
  available Product Code, ignoring case and outer whitespace while preserving leading zeros.
  The field MUST support manual typing and USB or Bluetooth scanners that act as keyboards,
  without requiring a camera, scanner SDK, or other hardware integration.
- **FR-008**: Successful code submission MUST clear the field and leave it ready for the next
  scan. An unmatched nonblank submission MUST show a clear message and leave the cart
  unchanged, preserving the entered value for correction. A load failure MUST be
  distinguishable from an unknown code. While a submitted code is being looked up, the
  shared field MUST preserve that code, accept no further entry or submission, and display
  an Indonesian lookup status instructing the cashier to rescan any code scanned while
  waiting. Repeated submissions while a lookup is pending MUST NOT add duplicate units.
  An exact lookup MUST time out after 10 seconds. On timeout or network failure, the field
  MUST unlock, preserve the submitted code, and show an Indonesian error with a retry action
  that reuses the code. A timed-out lookup MUST NOT add an item later. Keystrokes outside the
  shared field MUST retain their normal behavior.
- **FR-009**: Selecting a product card or submitting a matching code MUST give visible
  feedback and add one unit to the cart. The same product MUST occupy one line regardless
  of the method used to add it.
- **FR-010**: Cart controls MUST support increasing and decreasing whole-unit quantity and
  removing a line. Decrease MUST stop at one; removal MUST be a separate action.
- **FR-011**: Clearing a populated cart MUST require confirmation. Canceling MUST retain
  all items; confirming MUST remove all items. Adding, changing quantity, and removing
  individual lines MUST operate without a confirmation dialog.
- **FR-012**: The cart MUST show each line's selling price, quantity, and subtotal
  (price × quantity). It MUST show the grand total (sum of subtotals), total unit count
  (sum of quantities), and an empty state with a zero total and count when empty.
- **FR-013**: The cart MUST be held only on the client for the cashier workspace. Cart
  actions MUST NOT create or update any saved product, sale, or other business record.
- **FR-014**: Desktop MUST show product selection and cart side by side. Tablet and smaller
  views MUST adapt the grid and layout while keeping cart controls and totals reachable.
  At 375 px, the grid, cart controls, and focus mode exit MUST stay accessible with no
  unintended horizontal overflow. The cashier interface MUST follow the existing My Kasir visual style.
- **FR-015**: Cashier labels, messages, and notifications MUST be in Indonesian. Interactive
  controls MUST be keyboard operable, have clear accessible names and visible focus, and
  communicate feedback in text.
- **FR-016**: The existing product management and transaction flows MUST retain their current
  behavior. Phase 1 MUST require no new product fields, persistent data structures, or
  changes to saved records.

### Key Entities *(include if feature involves data)*

- **Product**: Existing catalog item with a stable identity, name, selling price, and
  optional Product Code. Only eligible, active products can be added.
- **Product Code**: The product's existing identifier used for searching and exact scan matching.
- **Cart Line**: A selected product with its selling price, whole-unit quantity, and calculated
  subtotal. Each product occupies at most one line.
- **Cashier Cart**: The temporary collection of lines for the current workspace, with a total
  unit count and grand total.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Both supported roles reach the normal cashier layout in one selection from the
  sidebar; direct access without a session follows the existing sign-in flow.
- **SC-002**: All search acceptance cases return the expected eligible products, including
  mixed-case names, partial codes, and matches beyond the first visible set. Each selection
  adds exactly one unit with visible confirmation. A reverse-order response test confirms
  that only the current result set can be selected.
- **SC-003**: Ten consecutive valid scans, including repeated codes and a leading-zero code,
  add exactly ten units when each scan is made after the field is ready. No separate field
  reset, focus change, or modal dismissal is needed between successful scans. An unknown code
  or a code scanned during an unresolved lookup adds zero units. Rescanning a valid code
  once the field is ready adds one unit. After 10 seconds without a result or on network
  failure, the field unlocks with the original code. A successful retry adds exactly one unit,
  even if the timed-out attempt later returns a match.
- **SC-004**: The displayed line subtotals, grand total, and unit count match the expected
  amounts after each step of the cart acceptance scenario. Canceling clear changes no line;
  confirming clear leaves zero lines, zero units, and a zero total.
- **SC-005**: At 1440, 768, and 375 px, the cashier can complete search, add, quantity adjustment,
  removal, and clear without horizontal overflow or clipped controls. Two complete enter/exit
  cycles at each width preserve the mounted workspace, including the exact cart and search text.
  The exit control remains reachable in focus mode.
- **SC-006**: All tested loading, no-results, and failure cases present distinct Indonesian
  feedback. A cashier can retry a failed catalog load while keeping their current cart.
- **SC-007**: A cashier can complete the core flow using only a keyboard: open Kasir, find and
  add an item, adjust quantity, remove or clear a cart, and enter and exit focus mode.
- **SC-008**: Existing product management and transaction acceptance flows continue to pass.
  Exercising the cashier workspace creates no persisted cart, transaction, or inventory change.

## Assumptions

- Existing access for cashier and administrator roles applies. No new role or permission is needed.
- Keyboard-style scanners are configured to send Enter after the code. The cashier puts focus
  in the shared field before scanning; manually typing a code and pressing Enter behaves the same.
- The existing product catalog is the source of product names, codes, prices, and active status.
  Cart prices are taken when a line is first added; Phase 1 does not reprice existing lines.
- The workspace is temporary. Recovery after a refresh, navigation away, sign-out, or closing
  the page is not required. A display mode switch keeps the same workspace open.
- **Scope boundary**: Phase 1 ends at cart preparation. Stock management, stock validation or
  deduction, checkout, cash or QRIS payments, transaction creation, invoices, receipt generation
  or printing, migrations, discounts, promotions, refunds, returns, and advanced reporting are
  outside scope. Later phases will define how the cart is validated and handed off to checkout.
