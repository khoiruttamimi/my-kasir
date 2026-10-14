# Research: Product Code Management

All design questions are resolved. The approved behavior is defined by `spec.md`; decisions here
choose implementation methods within that scope, not new business policies.

## 1. Nullable codes with database-enforced uniqueness

**Decision**: Add nullable `varchar(100)` Product `code`, no default/backfill, a check allowing null
or 1–100 ASCII letters/digits, and `products_code_unique` on `lower(code)` without a deletion
predicate. Services trim outer whitespace and preserve case. Nulls represent legacy only.

**Rationale**: Legacy records remain usable; concurrent duplicates cannot bypass the unique index.
The User schema already uses a lower-expression index. Unlike its active-email index, Product
codes must include deleted rows. PostgreSQL permits multiple nulls in ordinary unique indexes;
[PostgreSQL unique-index documentation](https://www.postgresql.org/docs/18/indexes-unique.html)
and [Drizzle case-insensitive indexes](https://orm.drizzle.team/docs/guides/unique-case-insensitive-email)
support this design.

**Alternatives considered**: NOT NULL/backfill violates the approved legacy policy; active-only
index violates deleted-code reservation; application-only prechecks race; citext adds an unnecessary
extension. No trigger is introduced to distinguish rollout legacy rows from new writes.

## 2. Required create and conditional legacy updates

**Decision**: Create validates a string code; edit validates provided code and requires an effective
code. When code is omitted, leave it out of SET and condition the update on current `code IS NOT
NULL`. A service pre-read can explain an uncoded legacy failure; after a zero-row guarded update,
an active lookup distinguishes missing/deleted (404), still-uncoded (required-code 400), and a
concurrently assigned code (409 Conflict). The last outcome returns
"Product Code was assigned by another request. Refresh and retry manually.", with no automatic
server/client save retry or subsequent write. The user refreshes and retries manually.
Omitted code must never be replaced by a value copied from a stale pre-read.

**Rationale**: One SQL update is atomic; an unrelated edit preserves the latest stored code and
cannot silently edit an uncoded legacy product. Explicit empty/null/numeric code fails validation.
Database nullability alone cannot enforce the time-dependent legacy rule; the supported service
write path enforces it. Migration-only direct SQL is not a general Product write interface.

**Alternatives considered**: Requiring code in all edit payloads breaks coded-product partial edits;
coalescing stale values can undo concurrent changes; triggers add complexity beyond the current
service/repository convention. Automatic guarded-update retries were rejected because the user
must refresh and review concurrent changes before a manual retry. Other concurrent explicit code
edits retain existing last-write-wins
semantics; uniqueness still applies at each save.

## 3. Internal generation without a new dependency

**Decision**: Define `product_code_seq` with start/min 0, max 9,999,999,999, increment 1, NO CYCLE.
Read nextval through the Product repository using Neon HTTP, return the value as decimal text,
pad to ten digits, prefix 20, and compute the final EAN-13 digit in a pure TypeScript helper.
Known vector: payload `200000000000` yields `2000000000008`.

**Rationale**: The repository already models a PostgreSQL sequence for invoices. A database
sequence gives distinct generation positions across server instances; canceled candidates consume
positions but do not reserve products. PostgreSQL documents atomic nextval and non-rollback gaps
in [sequence functions](https://www.postgresql.org/docs/current/functions-sequence.html).
Drizzle provides bounded sequence definitions in [its sequence guide](https://orm.drizzle.team/docs/sequences).
The checksum follows [GS1's manual calculation](https://www.gs1.org/services/how-calculate-check-digit-manually);
checksum validity does not confer GS1 assignment.

**Alternatives considered**: Random values need collision retry without deterministic progress;
client-only generation cannot check current assignments; a reservation table contradicts the
no-reservation requirement and adds lifecycle work. No GS1 service or barcode library is needed.

## 4. Conflicts and bounded generation failure

**Decision**: Check candidates against all Products, including deleted rows, and skip occupied
values. Limit one Generate request to 32 candidates. Return HTTP 503 with a retry/manual-entry
message if the bound is reached; report actual sequence exhaustion separately, without cycling.
At save, translate SQLSTATE 23505 only for `products_code_unique` into ApiError 409. Traverse
nested cause objects defensively as the User service does. Other database errors remain unexpected.

**Rationale**: A manual save may claim a generated candidate after the lookup, so generation is
never a reservation guarantee. The save index is authoritative. A retry limit bounds work without
falsely claiming that all codes are exhausted. Exhaustion means the non-cycling generator's positions
are spent, possibly including canceled values; manual unused codes remain permitted.

**Alternatives considered**: Prechecking alone does not settle races; silently changing the user's
chosen code at save violates selected-code persistence; unlimited loops can hang requests.

## 5. Existing API and UI boundaries

**Decision**: Add authenticated POST `/api/products/generate-code`, returning `{ code: string }`.
Keep existing create/detail/delete raw Product responses and update `{ data: Product }`. Add nullable
code to Product reads; use separate typed create/update payloads so read nullability does not leak
into create input. Reuse withAuth with no new role list, apiResponse, feature fetcher/mutations,
Ant Design confirmation, and the existing cache invalidation.

**Rationale**: Existing Product APIs are authenticated but not server-admin-filtered; changing that
is expressly outside scope. POST reflects sequence advancement, is not a cacheable read, and does
not alter Product rows. Reset form state on open/switch; ignore stale generation responses by
form identity/request token and edit revision. Disable saving while current generation is pending.

**Alternatives considered**: A second code field, automatic generation, GET generation, code search,
or changing auth policy would diverge from the clarified feature. New UI libraries are unnecessary.

## 6. Verification and rollout

**Decision**: Extend the existing node:test pattern with Product service tests and pure-helper
coverage; validate the actual PostgreSQL index, concurrent writes, and nullable migration in an
explicit test database. Use manual authenticated route/browser checks until there is a configured
browser/integration runner. Add operational documentation during implementation.

**Rationale**: Existing tests transpile TypeScript with mocked repositories; they cannot demonstrate
live uniqueness or UI behavior. Migration preserves all current code values as null, without JSON
import, changed product IDs, or transaction changes. Sequence state must not be reset in ordinary
rollout or rollback. Retiring old application writers is part of deployment coordination.

**Alternatives considered**: Installing another test framework or treating mock checks as database
proof conflicts with the repository's scope and verification conventions.
