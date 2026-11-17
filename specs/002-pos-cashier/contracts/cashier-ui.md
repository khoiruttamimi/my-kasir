# Cashier Interaction Contract

## Entry and layout

`/dashboard/cashier` is available to signed-in cashiers and administrators from **Kasir**
in the existing dashboard sidebar and by direct navigation. The page inherits the dashboard
layout and authentication. Signed-out visitors follow the dashboard login redirect.
The page opens with the existing header and sidebar. **Layar penuh** switches the same
workspace to a viewport-filling layout and changes the control to **Keluar layar penuh**.
The toggle remains focusable and visible. The hidden shell controls leave the tab order.
Exiting restores the dashboard chrome. Cart contents, search text, and the sidebar collapse
preference survive toggling. Navigating away ends focus mode, so returning opens the normal layout.

## Catalog and barcode input

| Trigger | Visible outcome |
| --- | --- |
| Type a name or code | Eligible matches appear in the grid. Starting a different search resets the grid to page 1. Cards expose name, selling price, and code or **Kode belum diisi**. |
| Click, tap, or activate a product card | Add one unit and announce the selected product in Indonesian. |
| Press Enter with the shared field focused and a nonblank value | Look up that exact code. While pending, keep the field focusable and read-only. Show and announce **Sedang mencari kode. Pindai ulang kode yang dipindai saat pencarian berlangsung.** |
| Press Enter with a blank field, during lookup, or while composing text | Leave the cart unchanged. Typing and Enter outside the field retain their normal behavior. |
| Lookup succeeds with one match | Add exactly one unit, clear the field, and make it ready for the next scan. If focus stayed on the field, it stays there. Respect any deliberate focus move. |
| Lookup succeeds with no match | Keep the code and show **Kode produk tidak ditemukan**. |
| Lookup reaches 10 seconds without completing | End the attempt and unlock the field. Keep the code and cart. Show **Pencarian kode melebihi batas waktu. Coba lagi.** and the **Coba lagi** action. A late result from this attempt cannot add an item. |
| Lookup fails on the network | Unlock the field and keep the code and cart. Show **Gagal mencari kode produk. Periksa koneksi dan coba lagi.** and the **Coba lagi** action. |
| Lookup returns an HTTP 5xx error | Unlock the field and keep the code and cart. Show **Gagal mencari kode produk. Coba lagi.** and the **Coba lagi** action. |
| Use **Coba lagi** | Start one fresh lookup for the retained code without retyping. Apply the same 10-second deadline and pending guard. |

The grid shows separate loading, no-results, and error states, with a retry action for catalog
failures. When the search changes, remove the old cards from the interactive grid immediately,
including during the debounce and while the new results load. If the old response arrives after
the new response, the current cards remain visible and only those cards can be selected. Clear
stale scan feedback when the cashier edits the field or submits a new code. Status feedback is
available as visible text and through a live region.

## Cart and responsive behavior

One line per product ID shows item name, unit price, quantity, and subtotal. Show total units and
the grand total, including zeros when empty. Quantity buttons have item-specific accessible names.
Decrease stops at one and remove deletes a line immediately. **Kosongkan keranjang** opens a
localized confirmation. Cancel preserves the cart. Confirm clears the lines in the cart at confirmation.

At desktop widths place the product grid and cart alongside each other. A narrow layout can stack
them and provide a keyboard-operable shortcut to the cart alongside the unit count and total.
Test both modes at 1440, 768, and 375 px. At 375 px, the product grid, cart controls, and focus
mode exit remain reachable without horizontal overflow or clipping. The same cashier workspace
stays mounted through focus transitions and sidebar changes.
