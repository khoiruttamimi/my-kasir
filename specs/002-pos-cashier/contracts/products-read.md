# Product List Read Contract

**Interface** — Existing authenticated `GET /api/products`. Keep the existing session gate and
paginated `{ data, pagination }` envelope with the current Product record and pagination fields.

| `searchMode` | `search` | Paging and matching |
| --- | --- | --- |
| Omitted | Existing optional term | Current Product management behavior and defaults. |
| `name-or-code` | Optional term, outer whitespace trimmed | Active products only. Blank returns the active catalog. Match a literal case-insensitive substring of name or code. A null code can still match by name. Use a positive integer `page` and an integer `limit` from 1 to 100 inclusive, with existing defaults when omitted. Use stable `createdAt DESC, id DESC` ordering in this mode. |
| `exact-code` | Required nonblank code after trimming | Exact case-insensitive code, with leading zeros preserved and active status required. Fixed page 1 and limit 1. Match returns one Product with total and totalPages of 1. Miss returns HTTP 200 with empty data and total and totalPages of 0. |

The grid requests 24 items per page. The exact client request sends `page=1&limit=1` explicitly,
and the server fixes those values in exact mode. Repeated exact reads use current catalog data.
Product list callers that omit the option keep their current paging values and ordering.
Product writes, code generation, and the reservation lookup used for uniqueness keep their
existing contracts.

- `GET /api/products?searchMode=name-or-code&search=0012&page=1&limit=24` can include
  `00123` and any active product whose name contains `0012`.
- `GET /api/products?searchMode=exact-code&search=00123&page=1&limit=1` matches code
  `00123`. A product named `00123`, a product coded `123`, and a soft-deleted code owner
  cannot satisfy it.
- Treat `%`, `_`, and the SQL escape character as literal input in the new substring mode.
  Bind query values through Drizzle. Use an exact normalized equality predicate for code.
- Keep the existing unauthorized response (HTTP 401). Reject an unsupported explicit mode,
  a blank exact term, or invalid explicit grid pagination with HTTP 400 through the shared
  `ApiError` path. In `name-or-code` mode, reject an invalid `limit` such as `0`, `1.5`,
  `abc`, or `101` with HTTP 400 and `{ "message": "limit must be an integer between 1 and 100" }`.
  Values `1`, `24`, and `100` are valid. This validation applies only to `name-or-code`.
- Kasir applies a client-side 10-second deadline to each exact lookup. A timeout or network
  failure is a lookup error in Kasir. Only a successful empty exact response means the code
  was not found. See the [interaction contract](cashier-ui.md) for retry behavior.
