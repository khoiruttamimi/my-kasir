# Validation Guide: Product Code Management

This is a guide for the future implementation, not evidence that the feature works today.
Read [HTTP contracts](contracts/product-api.md), [UI contract](contracts/product-ui.md), and
[data model](data-model.md) for expected behavior. Run commands from the repository root.

## Prerequisites and setup

Use the repository's declared pnpm 10.2.1 and installed dependencies. Authenticate through the
existing login flow; use an admin for product-management UI. Use an explicitly selected disposable
Neon development/test branch with existing baseline migrations and credentials. Keep DATABASE_URL
server-side; do not print or commit it. No new dependency installation is planned.

During implementation, after schema edits, generate the additive migration:

```sh
pnpm db:generate
```

Review its nullable column, case-insensitive index covering deleted products, check, sequence
bounds, and metadata. Preserve old migrations. With the target verified as the test branch,
explicitly apply reviewed migrations (this writes to the database):

```sh
pnpm db:migrate
pnpm dev
```

No migrations, generation endpoint calls, or seed/import commands were run by planning.
Do not backfill legacy products. Keep an uncoded legacy fixture, two active products, and one
soft-deleted coded fixture for checks. Use the existing UI/API to create test records after rollout;
prepare legacy fixtures before applying the new application validation. Record IDs and starting
business values without logging credentials. Do not modify production or reset its sequence.

## Automated checks after implementation

Existing commands verified against package.json and test paths:

```sh
pnpm exec tsc --noEmit
pnpm lint
node --test tests/user-service.test.mjs tests/transaction-service.test.mjs
pnpm build
```

Planned Product suite command, runnable only after `tests/product-service.test.mjs` is created:

```sh
node --test tests/product-service.test.mjs tests/user-service.test.mjs tests/transaction-service.test.mjs
```

Product service/helper coverage must include required create, trim/case/zeros, 1/100/101 lengths,
invalid characters/numeric/null values, manual numeric strings without checksum, unchanged self-code,
legacy omitted-code failure, assigned omitted-code preservation, duplicate cause-chain translation,
zero-row guarded-update follow-up outcomes (still-null 400, missing/deleted 404, now-coded 409),
unrelated driver errors, generation known vectors (including check digit zero), collision skipping,
32-attempt failure, and dedicated sequence exhaustion. Mock tests do not prove database/UI behavior.

## End-to-end acceptance scenarios

1. Create with `AbC001`, reopen, and confirm exact list/form value. Repeat with unused leading-zero
   string `0012345678905`. Outer whitespace trims; changing letters' case must not bypass uniqueness.
2. Submit empty code, punctuation, internal spaces, numeric/null values through authenticated
   requests, and 101 characters. Expect documented 400 errors and no partial save.
3. Click Generate on an empty form: exactly 13 digits, prefix 20, valid checksum, no product created
   yet. Check against an independent calculation/reference; initial test-sequence vector is
   `2000000000008`. Save and reopen to verify identical value.
4. Open forms without clicking Generate: nothing generates. With populated input, decline
   confirmation and verify no request/change; confirm and verify only unsaved input changes.
5. Slow a generation request using browser network controls, manually edit, switch products, or
   close before it completes. Late results must not overwrite the newer state. Failure retains input.
6. Save a duplicate manually, including case variant and a soft-deleted owner's code. Expect 409
   and the clear message with entries preserved. Save another field with unchanged self-code: success.
7. View/transact with an uncoded legacy product: permitted, list says "Not assigned". Edit only its
   name without a code: required-code failure and unchanged saved record. Supply an unused code:
   edit succeeds. Clearing that code later fails. Historical snapshots/IDs remain unchanged.
8. Change a code and confirm the old value can be used elsewhere; soft-delete a coded product and
   confirm its current code remains unavailable. Code-only edits must not affect stock/history.
9. Exercise authentication on the existing and new generation endpoints: missing session gives 401;
   authenticated access follows the existing policy. Do not claim a new server admin filter.
10. Inspect create raw Product, update `{ data: Product }`, list pagination, and detail/delete
    envelopes; confirm additive `code` only and name-only search unchanged.

## Live-database race and failure checks

On the disposable test branch, send two authenticated saves concurrently for one unused code
using separate products; exactly one succeeds and the other returns 409. Repeat create/create,
create/edit, and edit/edit including case variants. Verify the entire losing record is unchanged.
Duplicate ownership races must use two different products; same-product unchanged-code edits
are not duplicate ownership. Check multiple null legacy rows coexist and the database index rejects
non-null duplicates.
Verify the no-code partial update preserves a current assigned value instead of restoring a stale
pre-read, and cannot successfully update an uncoded row.

Exercise the guarded legacy race with controlled repository stubs and, separately, isolated database
coordination: guarded update affects zero rows, another request assigns a code, then the follow-up
lookup sees the assigned active product. Expect 409 with
"Product Code was assigned by another request. Refresh and retry manually.", exactly one guarded
update attempt, no automatic server/client save retry, and no further write by the failed request.
Verify concurrent code/other fields survive and the form retains entries with form-level refresh/
manual-retry guidance, not a duplicate-code error. Still-null follow-up remains required-code 400;
missing/deleted remains 404. Record whether the real database race was verified or only mocked.

Generate concurrently: returned sequence candidates are distinct across requests; no Product row
is inserted. Claim a returned candidate via another manual save before the original form saves:
original Save must show the duplicate error rather than silently choose a new code.

On an isolated disposable branch only, use controlled sequence/collision fixtures to validate
occupied candidate skipping, 32-attempt retry message, and max-value exhaustion. Verify no cycle,
no misleading "range exhausted" on retry-limit or connectivity failure, no truncation of ten-digit
positions, and manual entry remains possible. Fixture/sequence manipulation must be separately
scoped and must not reset any shared sequence.

## Evidence and rollout

Record commands and outcomes, browser cases, HTTP statuses, record counts, unchanged legacy fields,
and actual test-database concurrency results. Report any unavailable check explicitly. Deploy
reviewed schema before new application readers and coordinate replacement of old writers; verify
new creates require codes after cutover. Do not infer production readiness from mocked tests alone.
