# Data Model: Point of Sale Cashier — Phase 1

## Product selection

Reuse `Product` and the existing paginated Product list. The cashier consumes the following
fields from each result.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `Product['id']` | Stable product identity and cart line key. |
| `name` | `Product['name']` | Product card and cart line label. |
| `code` | `Product['code']` | Assigned code text or `null` for an uncoded legacy product. |
| `price` | `Product['price']` | Selling price in whole rupiah. |

Catalog reads provide active products. Uncoded products can be browsed and selected by name.
Codes retain leading zeros and display casing. Exact lookup trims outer whitespace and compares
case-insensitively. Stock has no role in cart eligibility.

## Cart line and summary

| Field | Type | Rule |
| --- | --- | --- |
| `productId` | `Product['id']` | Unique within the cart. |
| `name` | `Product['name']` | Snapshot from the first addition of this line. |
| `unitPrice` | `Product['price']` | Snapshot from the first addition of this line. |
| `quantity` | `number` | Positive integer. A new line starts at one. |

- Add creates a line or increments the existing line for that product ID. Subsequent adds keep
  its original price. Removing the line and adding it again takes a new snapshot.
- Increase adds one unit. Decrease subtracts one unit when the quantity exceeds one. Remove
  deletes the line. Confirmed clear replaces the collection with an empty one.
- Derive subtotal as unit price × quantity, grand total as the sum of subtotals, and unit count
  as the sum of quantities. An empty cart has zero units and zero total.

## Workspace state

The mounted cashier owns the cart and current search field. The existing dashboard layout owns
the normal/focus flag for `/dashboard/cashier`. Changing that flag keeps the same cart and input
instances. Leaving the route resets focus mode. Leaving the page or refreshing starts a new
workspace. Product query cache entries represent catalog reads only.

Scan transitions are ready → looking up → ready. Success adds one unit and clears the field.
No match keeps the submitted code and shows the corresponding feedback. Timeout at 10 seconds
or network failure returns the field to ready with the submitted code and a retry action.
While looking up, the pending code remains intact and subsequent scan input is ignored.
A timed-out attempt cannot change the cart after the field returns to ready. See the
[cashier interaction contract](contracts/cashier-ui.md) for focus and retry behavior.
