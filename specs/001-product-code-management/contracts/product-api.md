# Product HTTP Contracts

Planned additive contracts; new generation behavior and code fields are not implemented yet.
Existing endpoints are in `src/app/api/products/`; keep their current envelope/status behavior.

## Authentication

All Product endpoints, including generation, use existing withAuth session authentication. Missing
session returns 401 `{ "message": "Unauthorized" }`. No new role restriction is added: current
Product handlers do not pass a roles list. Keep existing admin-only management UI controls.

## Product reads

Product JSON gains `code: string | null`, alongside existing fields. Non-null strings retain
letter case/leading zeros; legacy absence is represented by explicit null, not an invented value.

| Endpoint | Success | Behavior |
| --- | --- | --- |
| GET `/api/products` | 200 `{ data: Product[], pagination: ... }` | Existing page/limit/search and name-only search unchanged. |
| GET `/api/products/{id}` | 200 raw Product | Active product only; existing 404 message if missing. |
| DELETE `/api/products/{id}` | 200 raw Product | Existing soft delete; includes code, which remains reserved. |

## Create: POST `/api/products`

Input retains existing required name/category/price/stock and adds required `code: string`.
Example: `{ "name": "Tea", "category": "Minuman", "price": 10000, "stock": 5, "code": "AbC001" }`.

Success: 201 raw Product with the normalized string code. Missing/null/numeric/blank code returns
400; invalid characters or more than 100 characters returns 400. Manual numeric strings need not
be 13 digits or have a valid checksum. No auto-generation fallback on create.

## Edit: PUT `/api/products/{id}`

Input retains existing partial field behavior and accepts optional `code: string`. Success remains
200 `{ data: Product }`; existing missing/deleted Product behavior remains 404.

- Assigned product + omitted code: preserve current value, including a concurrent replacement;
  never SET a code copied from a stale pre-read.
- Legacy null + omitted code: 400 required-code message, even when only another field is changed,
  if it remains uncoded at the follow-up lookup.
- Guarded update returns zero rows + follow-up finds a now-coded active product: 409 Conflict
  `{ "message": "Product Code was assigned by another request. Refresh and retry manually." }`.
  Do not retry automatically on the server or client, or perform a further write. Preserve the
  concurrent code/other field changes. Show the conflict as refresh/manual-retry guidance, not
  as the duplicate-code field error, and retain entered values until the user acts.
- Guarded update returns zero rows + follow-up finds no active product: existing 404 response.
- Provided valid code: apply with other changes atomically; unchanged self-code is allowed.
- Provided blank/null/numeric code: 400; it never means omission or clearing.
- Duplicate on create/edit: 409 `{ "message": "Product code is already in use" }`.
  Both case variants and soft-deleted code owners conflict. No partial product save occurs.

## Generate: POST `/api/products/generate-code` (new)

No body parameters. Each call advances the independent generator; do not expose as a GET or
prefetch/cache it. Response: 200 `{ "code": "2000000000008" }` for the initial available position.
Always set `Cache-Control: no-store` on generation responses.

Returned value is exactly 13 digits: `20`, ten digits, then valid EAN-13 checksum. It is an
unreserved candidate, checked against all current Products including deleted records. It is not a
GS1-assigned GTIN; generation writes no Product row and never changes a saved code. The static
route must take precedence over the dynamic `{id}` route.

| Failure | Status | Message |
| --- | --- | --- |
| 32 occupied candidates encountered | 503 | "Unable to generate an unused product code. Try again or enter a code manually." |
| Non-cycling sequence exhausted | 503 | "Internal product code generation range is exhausted. Enter a code manually." |
| No session | 401 | Existing Unauthorized response. |

Unexpected database faults follow existing server error handling; do not expose SQL, connection
strings, or driver details. Translate sequence exhaustion narrowly for the dedicated sequence;
permission/connectivity failures must not be mislabeled exhaustion.

## Validation errors

Use 400 `{ message: string }` with "Product Code is required" for missing/empty required code,
"Product Code must be a string" for supplied non-string values, and
"Product Code must contain 1–100 letters or digits" for length/character failures.
Malformed JSON continues through readJsonBody's existing 400 error.

## Compatibility and races

Adding nullable code to reads preserves all existing fields/envelopes. New creates without code
are intentionally rejected; update omission remains supported only for assigned products. Update
failure is atomic. Duplicate ownership races concern two different products; simultaneous edits
assigning the same code to the same product do not conflict with that product itself. The guarded
legacy race above is a separate 409 condition, with no automatic retry. Other concurrent explicit
edits retain existing last-write-wins behavior on the same
product, subject to uniqueness. Candidate generation does not guarantee later save succeeds; a
competing manual claim produces the normal 409 and the user may Generate again.
