# Research: Point of Sale Cashier — Phase 1

## 1. Nest the cashier page under the existing dashboard

**Decision.** Add `src/app/dashboard/cashier/page.tsx` so `/dashboard/cashier` inherits the
existing `auth()` check, redirect, session provider, and `DashboardLayout` from
`src/app/dashboard/layout.tsx`. Let the client shell own the focus flag and expose a small
context to the cashier page. Keep the content branch mounted across display changes and retain
the sidebar's collapse preference. Scope focus and sizing to the cashier pathname and reset
focus when leaving it.

**Rationale.** Nesting lets the existing route hierarchy supply authentication and the dashboard
shell. The shell can persist between dashboard pages, so focus mode must be scoped to the
cashier. The existing shell uses content width derived from sidebar constants and conditionally
removes children on extra-small screens. The cashier needs a shrinkable content area and a stable
mount to preserve its cart through layout changes.

**Alternatives considered.** A route group or an extracted auth wrapper would restructure the
existing dashboard. A second shell or portal would add coordination around scrolling and focus.

## 2. Reuse the Product list with opt-in search

**Decision.** Add two explicit search modes to the authenticated `GET /api/products` list.
`searchMode=name-or-code` browses and searches active products by literal case-insensitive
substring with a server limit of 100 items per page. `searchMode=exact-code` resolves a single
current active product by exact normalized code. Preserve the existing response shape and the
default name search and pagination when the option is absent.

**Rationale.** The existing repository filters the list by active status but matches only names.
The code uniqueness helper intentionally includes deleted owners and serves write validation.
The exact mode can use the existing case-insensitive unique index on product code while retaining
the active filter. Paging the grid avoids loading the full catalog. A fresh request per accepted
scan makes a stale grid, a prior lookup, and pagination irrelevant to scan eligibility.

**Alternatives considered.** Filtering the currently loaded page would miss products. Downloading
every page for local filtering increases initial work and makes deletion and code changes stale.
A new endpoint would duplicate authentication and client request plumbing. Changing the existing
default search would alter Product management behavior.

## 3. Keep scanning local to the search input

**Decision.** Use a controlled Ant Design input with a field-local Enter handler. Debounce the
grid query by about 200 ms. Enter uses the current field value immediately for one exact lookup
and does not wait for the grid debounce. Guard synchronously against overlapping submissions and
keep the pending input read-only and focusable. Abort an exact lookup after 10 seconds and release
the guard on completion or failure. Timeout and network failure retain the code for manual retry.

**Rationale.** This supports both scanner and manual entry and honors the clarification to rescan
anything submitted while waiting. Read-only preserves the field and its value. Query keys include
search mode and request parameters so a grid request cannot satisfy a scan. Only render cards
for the current term and page. Debounced or late results for an older term stay out of the
interactive grid. A fresh exact request with automatic retry disabled lets the cashier distinguish
a lookup failure from a missing code and retry without duplicating an addition.

**Alternatives considered.** Global keyboard listeners and scanner-speed heuristics risk capturing
ordinary typing. A queue changes the agreed workflow. Browser fullscreen, camera access, and a
scanner SDK are unnecessary for keyboard-style scanners.

## 4. Use local cart state and existing UI primitives

**Decision.** Store cart lines in the cashier container through a feature-local hook. Deduplicate
by product ID and snapshot name and unit price on first add. Derive line subtotals, unit count,
and grand total from quantities. Reuse Ant Design controls and confirmation, `formatRupiah`, and
SCSS Modules. Keep search text transient and place grid page state in the URL using the existing
query parameter hook.

**Rationale.** Product code can change or be absent. Product ID keeps the line stable across add
methods. Derived totals stay consistent with cart edits. The current dashboard scroll container
must allow the cashier grid and cart to shrink at tablet widths, with a cart summary or jump
control available in the stacked layout.

**Alternatives considered.** A global cart provider or browser persistence expands the cart
lifecycle. A checkout-oriented model introduces fields that have no role in Phase 1. Mirroring
every scanner keystroke into router history adds navigation and risks disrupting rapid entry.
