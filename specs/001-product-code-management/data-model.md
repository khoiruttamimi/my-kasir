# Data Model: Product Code Management

## Product extension

Retain the existing Product ID, name, category, price, stock, timestamps, and soft-delete behavior.
Only the `code` field is added; transaction relationships and snapshots remain unchanged.

| Attribute | Representation | Rules |
| --- | --- | --- |
| id | Existing UUID/string | Stable identity; never replaced by code. |
| code | Nullable varchar(100); public `string | null` | Null only for retained uncoded legacy records; no numeric conversion. |
| code comparison | Derived lowercase value | Unique across all products, including deleted rows; not another public field. |

Create input requires `code: string`. Update input allows omitted `code`, but any supplied code
must be a string; neither null nor empty means "leave unchanged". Product form values use strings
and map read null to an empty input. Do not derive a required create payload solely by omitting
fields from the nullable read model.

### Validation and constraints

- Trim outside whitespace using the same service normalization on every supported write.
- Require 1–100 ASCII A–Z/a–z/0–9 characters; preserve original case and leading zeros.
- Database check `products_code_format_check` permits null or an ASCII-alphanumeric value of
  valid length. Because stored values contain no whitespace, lower(code) matches normalized lookup.
- Unique expression index `products_code_unique` covers lower(code), with ordinary NULL semantics
  and no deleted-at filter. Multiple legacy nulls coexist; two non-null case variants cannot.
- Create always requires code. Edit with a provided code validates then writes it. Edit without
  code preserves an assigned value and fails for an uncoded legacy product.
- A no-code update must omit the field from SET and guard on current non-null code. If nothing
  updates, inspect the active row: still uncoded means required-code 400; missing/deleted means
  404; a code assigned between the guarded update and lookup means 409 Conflict with
  "Product Code was assigned by another request. Refresh and retry manually.". This failed request
  performs no automatic retry or subsequent write; preserve the other request's code and fields.
- Application checks improve error feedback; the database index authoritatively handles races.
  Translate only its SQLSTATE 23505 conflict to the documented 409 response.
- No alias table or immutable code ownership history: a changed-away value can be reused; a
  soft-deleted product's current code remains reserved. Deleting an uncoded legacy product does
  not require assignment, since it is a soft-delete operation rather than editing its business fields.

## Generation sequence

`product_code_seq`: PostgreSQL sequence, min/start 0, max 9,999,999,999, increment 1, no cycle.
It is independent of the transaction invoice sequence. Repository nextval returns decimal text;
helper pads to ten digits, prepends `20`, and appends the check digit. Generation never writes
Product rows and consumes a position even if a form is canceled.

Service skips candidates already assigned to any product and tries at most 32 per request.
Exhaustion stops generation without wrapping or resetting. Retry-limit failure differs from
exhaustion; neither blocks valid manual entry. A returned candidate is unreserved and may conflict
at later save; the unique index then rejects the save without partial changes.

## State transitions

| Before | Action | After |
| --- | --- | --- |
| Legacy null | View/list/transact | Null unchanged; display "Not assigned". |
| Legacy null | Edit without valid code | Entire edit rejected; null and other saved values unchanged. |
| Legacy null | Edit with valid unused code | Assigned string, with requested other edits applied atomically. |
| Guarded legacy edit updates zero rows | Follow-up finds concurrently assigned code | 409 refresh/manual-retry guidance; no retry or write by the failed request. |
| Assigned code | Edit omitting code | Current assigned code preserved. |
| Assigned code | Edit with empty/null code | Entire edit rejected. |
| Assigned code | Save a valid replacement | Same product ID; replacement current code, old value reusable. |
| Any active product | Soft delete | Existing deletion behavior; any current code still reserved. |
| Unsaved form | Generate | Candidate fills form only; Product remains unchanged. |

## Additive migration and rollout

During implementation, append a new Drizzle-generated migration and matching metadata that adds
the nullable field, format check, expression index, and independent sequence. Existing rows stay
null; no backfill, default generation, transaction schema change, or JSON import is included.
Review locking/index-build impact against the actual catalog before applying to a target.

Deploy reviewed migration before application code selects the new field. Coordinate all active
writers onto the new required-create service; the nullable schema permits older writers to insert
null until retired. Confirm all new writes are coded after cutover. Roll back application behavior
without dropping codes or resetting the sequence; database rollback needs a separately reviewed
plan preserving assigned identifiers. Do not add NOT NULL until a separate legacy policy change.
