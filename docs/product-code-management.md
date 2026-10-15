# Product Code management

Products have one editable Product Code string. Manual codes accept 1–100 ASCII letters/digits;
outer whitespace is trimmed, while letter case and leading zeros are retained. Manual manufacturer
values are not restricted to EAN-13 length/checksum and are not certified for ownership or GS1
registration. Product identity remains its UUID, independent of code.

## Generation and editing

Generate runs only on click; replacing populated input requires confirmation. Generated values
use prefix `20`, ten digits, and an EAN-13 check digit. They are for internal MyKasir use only,
not GS1-assigned GTINs or globally unique identifiers. The existing database issues successive
positions; gaps are allowed when requests fail or users cancel. Generate never saves a Product
or reserves the candidate. A competing manual claim can still make a later Save fail.

The generator skips current assignments, including deleted owners, with at most 32 attempts per
request. Retry-limit failure and non-cycling sequence exhaustion return distinct 503 messages;
manual entry of unused codes remains available. The sequence must never be reset or cycled as
routine rollout/rollback work.

Codes compare case-insensitively across all Products. Deleted Products reserve their current code.
An unchanged self-code is allowed; after replacement, the changed-away code can be reused.
New creates require a code; assigned codes cannot be cleared. An unrelated partial edit omitting
code preserves its latest value, without restoring a stale read.

## Legacy products

Migration 0006 adds a nullable code without a default or backfill. Existing uncoded products remain
viewable and usable in transactions; the management list displays "Not assigned". Their next
successful edit must assign a valid, unique code, even if editing only another field. Soft deletion
does not require assignment. Product IDs, price/stock behavior, and historical snapshots are unchanged.

A guarded edit with no affected row has three outcomes after lookup: still uncoded → required-code
400; missing/deleted → 404; concurrently assigned → 409 with refresh/manual-retry guidance. A failed
edit never changes the Product or overwrites changes committed by another request. Neither the
server nor client automatically retries that save.

## HTTP and error behavior

Existing Product routes retain session authentication and envelopes: create/detail/delete return
raw Product, update returns `{ data: Product }`, and list retains its pagination envelope. Read
Products include `code: string | null`. Current management UI permissions are unchanged; no new
server role policy or code search was added.

POST `/api/products/generate-code` has no parameters and returns `{ code: string }` with no-store.
Authentication and handled failures also carry no-store. Generation mutation does not invalidate
Product caches; successful create/edit does. Missing sessions return the existing 401 response.

| Status | Message / action |
| --- | --- |
| 400 | Product Code is required / must be a string / must contain 1–100 letters or digits. |
| 409 duplicate | "Product code is already in use"; correct the code, keeping entered fields. |
| 409 concurrent assignment | "Product Code was assigned by another request. Refresh and retry manually."; inspect the latest record before manually retrying. |
| 503 retry bound | "Unable to generate an unused product code. Try again or enter a code manually." |
| 503 sequence limit | "Internal product code generation range is exhausted. Enter a code manually." |

The form distinguishes duplicate field errors from form-level concurrency guidance. Confirmation
cancel, generation failure, and stale responses after code edits/closing/switching cannot replace
current input. Saving and repeated Generate are disabled during the current generation request;
manual code editing remains available. Only Save persists changes.

## Schema rollout and rollback

`drizzle/0006_regular_grim_reaper.sql` and its metadata were generated; the user reports applying
it manually. This implementation does not apply migrations, execute seeds, or perform live checks.
For any deployment target, review and apply schema through a separately authorized operation
before deploying readers that select code. Retire old writers, which can still insert null while
the schema remains nullable. After cutover, verify all new creates require codes.

Preserve assigned codes and sequence state during rollback; do not drop fields or reset/cycle the
sequence. A database rollback or future NOT NULL migration requires a separate reviewed data plan.
No automatic legacy assignment or JSON import is included.

## Validation

See [the feature validation guide](../specs/001-product-code-management/quickstart.md). Existing
Node tests cover service rules, mocked route responses/auth, Drizzle SQL construction, sequence
error classification with mocked execution, and form callbacks with an isolated hook/Form harness.
They do not prove actual database uniqueness/concurrency, real login/session behavior, browser DOM
interactions, or end-to-end storage. Those live/browser acceptance tasks remain unchecked under the
user's offline-only instruction. No dependency or stock-management changes are required.
