# Validation Guide: Product Code Management

This guide defines Product Code acceptance; dated evidence below records what was actually checked.
Read [HTTP contracts](contracts/product-api.md), [UI contract](contracts/product-ui.md), and
[data model](data-model.md) for expected behavior. Run commands from the repository root.

## Current verification scope (2026-10-15)

The maintainer narrowed T022/T033/T034 after the real application/API verification. All retained
Product Code checks have recorded evidence; those task checkboxes reflect that evidence, not a new
test run. Earlier dated blockers remain historical records and are superseded by this scope.

| Task | Required gate and current status                                                                                                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T022 | Complete for current legacy Product reads/null display, no automatic assignment, atomic required/duplicate/clearing failures, valid assignment and stable IDs/unrequested business fields/stock. Retain nullable consumer and recorded code-only snapshot compatibility evidence. No pre-0006 baseline or historical migration replay is required.            |
| T033 | Complete for real uniqueness/races/atomicity, current-code preservation, guarded legacy 409/no retry, concurrent Generate, candidate claims, occupied/deleted candidates, exact 32-attempt failure and catalog bounds/NO CYCLE. Live max-value exhaustion is DV-001, deferred and unverified.                                                                 |
| T034 | Complete for actual Product Code UI/API validation, labels/keyboard actions, reset/prefill, strings/save/reload/cache, Generate states/stale/failure/conflicts, 409 retention/manual refresh, auth/permissions, search/pagination and code-only ID/stock/snapshot preservation. Unrelated native WebSocket transaction execution is excluded and still fails. |

**35/35 in-scope tasks complete; deferred verification is not passed.** This revision changes
verification gates only. Required code validation, uniqueness, generation behavior and string
persistence remain unchanged. No source/database changes or new test execution occurred.

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
bounds, and metadata. Preserve old migrations. If schema is not already applied, applying reviewed
migrations is a separate explicitly authorized operation on the verified test branch (database write):

```sh
pnpm db:migrate
pnpm dev
```

No migrations, generation endpoint calls, or seed/import commands were run by planning.
An already migrated development branch is sufficient for T022; do not replay migration 0006 or
reconstruct a pre-migration baseline as a feature verification prerequisite.
Do not backfill legacy products. Keep an uncoded legacy fixture, two active products, and one
soft-deleted coded fixture for checks. Use the existing UI/API to create test records after rollout;
use retained null-coded records or separately scoped disposable legacy fixtures. Record IDs and starting
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
7. List/read an uncoded legacy product without automatic assignment; list says "Not assigned". Edit only its
   name without a code: required-code failure and unchanged saved record. Supply an unused code:
   edit succeeds. Clearing or duplicate assignment fails atomically. IDs, stock and fields not
   requested for edit remain unchanged. Retain T021's nullable transaction-consumer checks and
   recorded code-only snapshot compatibility evidence; native WebSocket execution is not required.
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

Use disposable occupied-candidate fixtures to verify skipping across active/deleted owners, the
exact 32-attempt retry message, retained input, manual entry, and no Product writes on Generate.
Retry-limit/connectivity errors must not be mislabeled exhaustion. Check sequence bounds/NO CYCLE
through catalog metadata and keep checksum/formatting/boundary/error-classification regression
coverage. Never reset or alter shared sequences. Live max-value exhaustion is separate DV-001 below.

## Deferred verification and separate risks

### DV-001 — live sequence exhaustion (deferred, NOT RUN LIVE)

On a dedicated disposable branch with reviewed schema already applied and separately scoped
sequence fixtures, verify the final position 9,999,999,999 produces the full ten-digit/13-digit
format; the next request returns the documented exhaustion 503 without cycling; the error differs
from retry-limit/connectivity failure; entered fields remain and a valid unused manual code can
still be saved. Do not advance/reset the shared development or production sequence to run this check.

Risk: real Neon behavior at the final sequence value and its HTTP/UI error mapping remain unproven.
Existing helper/service exhaustion tests and catalog bounds/NO CYCLE checks passed, but do not
replace this live boundary test. Deferral does not change the required exhaustion behavior in
spec.md/contracts or remove automated boundary/error tests. DV-001 does not block T001–T035.

### Historical migration evidence (removed from the feature gate)

A pre-0006 baseline is unavailable, so retrospective migration preservation was not verified and
must not be called passed. T022 instead verifies present-day legacy Product behavior and current
data integrity, alongside the reviewed additive/no-backfill migration. Risk: this evidence cannot
detect past migration damage retrospectively. Future data-changing migrations need their own plan;
this feature does not require reconstructing an unavailable historical baseline.

### Native WebSocket transaction execution (separate unresolved runtime issue)

The default transaction path reproduced `mask is not a function` and timed out; this remains failed,
not passed. Current legacy transaction/snapshot compatibility passed with the documented JavaScript
fallback. Product reads/writes/Generate use Neon HTTP, and this feature did not change the interactive
transaction/WebSocket implementation. Native transport diagnosis and retesting therefore belong to
separate transaction/runtime work. Risk: default native transaction creation can still fail. Product
Code completion does not resolve this issue or establish native-transport production readiness.

## Evidence and rollout

Record commands and outcomes, browser cases, HTTP statuses, record counts, unchanged legacy fields,
and actual test-database concurrency results. Report any unavailable check explicitly. Deploy
reviewed schema before new application readers and coordinate replacement of old writers; verify
new creates require codes after cutover. Do not infer production readiness from mocked tests alone.

## Historical implementation and verification evidence

These dated records preserve actual outcomes and the gates in effect at each run. Their old task
statuses are superseded by the current scope above; deferred/failed checks remain explicitly unproven.

### Implementation evidence (2026-10-14)

- Baseline: `pnpm exec tsc --noEmit` passed; `pnpm lint` passed with eight pre-existing warnings
  (dashboard/login img usage and unused callback parameter names); existing User/Transaction
  suites passed 12/12. No database access was used.
- Existing ignore files cover installed dependencies, Next/build output, environment secrets,
  coverage and relevant logs; no publishing, Docker, Terraform, or Helm setup is present.
- Route review: Product handlers retain session-only withAuth, raw create/detail/delete results,
  PUT data envelope, and existing name-only list search. Schema must be reviewed/applied separately
  before new readers; all old writers must be retired to enforce codes on new creates after cutover.
- User prohibits migration application, live database verification, seeds and destructive commands.
  This run may generate migration files only. Task dependencies will not be satisfied by assumed
  live results.

- Generated/reviewed `drizzle/0006_regular_grim_reaper.sql` plus `0006_snapshot.json`/journal
  metadata: only new Product code/index/check and separate sequence; no DML, backfill, defaults,
  existing table rewrites, or edits to older migrations. Sequence defaults to NO CYCLE. Not applied.
- T007 tests were authored first and confirmed failing for the missing code behavior, then passed
  after implementation. Test loader targets ES2017 consistently with the project for Error classes.
- Final offline checks: TypeScript passed; all 17 tests passed; lint passed with eight unchanged
  baseline warnings; `pnpm build` passed (compiled and generated pages successfully);
  `git diff --check` passed. No package or lockfile changes.
- Product HTTP tests execute existing collection handlers/response helpers with mocked session auth
  and repository persistence; verify 201/raw Product, paginated list, 400/409, and 401. These do not
  prove real login, Neon uniqueness, concurrency, browser behavior, or migrated storage.
- T012 is blocked: column is implemented, but live create/reload/reopen verification requires an
  independently reviewed/applied migration on an isolated test database, prohibited in this run.
  T013–T035 remain pending rather than bypassing the dependency graph. Later live verification
  tasks remain unchecked. No live acceptance or database race was executed.
- Do not deploy this partial change: edit duplicate translation/legacy race guard and Generate
  remain pending, and the live database does not have the new column from this run. Resume after
  T012 is genuinely verified against an authorized isolated migrated database.

### Resume inspection (2026-10-14)

- User reports migration 0006 applied manually and authorizes resuming T012; no automatic
  migration commands are permitted. Read-only catalog inspection confirms Product code is
  nullable varchar(100), products_code_unique covers lower(code) without a deletion predicate,
  products_code_format_check is present, and product_code_seq starts/mins at 0, maxes at
  9,999,999,999, increments by 1, and does not cycle. No sequence value was consumed.
- T012 remains unchecked until create/reload/reopen acceptance is verified. Before test writes,
  clarification is pending that the configured database is an isolated development/test target,
  to preserve the user's instruction not to modify production data. No Product writes occurred.

### Offline implementation continuation

- Latest user instruction: continue implementation without live operations. This supersedes waiting
  for T012 live verification before later code work; T012/T018/T022 and subsequent live acceptance
  tasks remain unchecked. Neither migration application nor any live read/write is performed.
- T013–T017 implemented and verified through regression tests/type checking: self-code edits,
  replacement/reuse, deleted-owner conflicts, atomic failure stubs, and zero-row guard follow-up
  400/404/409. Concurrent assignment returns the approved message; exactly one write attempt
  occurs, with no automatic retry. Existing update hook explicitly has retry:false and invalidates
  Product/detail only on success. Form distinguishes duplicate field errors from assignment conflicts.
- T019–T021: legacy reads/assignment/deletion tests pass; legacy form explains required assignment.
  Transaction service/repository and seed script consume IDs/name/price only, ignoring nullable code;
  no transaction/stock changes were necessary. Real SQL constraints/concurrency remain unverified.

### Final offline result (supersedes earlier partial-feature status)

- All remaining code is implemented: guarded edits and exact concurrency 409; legacy assignment
  rules; separate sequence candidate generation/checksum; POST generation with no-store on
  200/401/503; typed request/mutation hooks; single code input plus confirmed Generate; loading
  state and late-response protections; operational documentation.
- 35/35 tests pass: 23 Product tests, 7 User tests, 5 Transaction tests. Product coverage includes
  service validation/races via mocks, Drizzle SQL construction without query execution, dedicated
  sequence error handling with mocked execute, collection/item/generation handlers with mocked
  sessions/persistence, and actual form callback code with an isolated hook/Form harness. These
  tests do not mount Ant Design in a browser or prove live storage/constraints/concurrency.
- TypeScript passed after production build completed. An initial simultaneous tsc/build run raced
  over Next-generated type files; sequential rerun passed without changing project configuration.
- Lint passed with the same eight baseline warnings and no feature warnings. A new cleanup-ref
  warning was resolved by capturing the stable context object in the effect, without suppression.
- Production build passed with an unreachable placeholder DATABASE_URL to prevent use of the
  configured live database. Generated routes include /api/products/generate-code as a separate
  dynamic endpoint. git diff --check passed. No dependencies/lockfiles changed.
- No live database inspection, application requests, Product writes, migrations, seeds, destructive
  operations, or sequence consumption/reset occurred in this offline continuation. User-reported
  migration application and earlier read-only inspection are historical evidence, not new live tests.
- T012/T018/T022/T030/T033/T034 remain unchecked: their real-database/browser acceptance is
  blocked by the user's no-live instruction. All source, test, documentation, and offline checks
  are complete. Do not claim end-to-end verification or production readiness from this result.

### Development verification resume (2026-10-15)

This section supersedes the earlier offline-only restriction and task status. The user authorized
live verification, corrected the configuration location from missing `.env.local` to `.env`, and
confirmed that endpoint `ep-late-brook-b3zru84v` belongs to the separate development branch.
Before fixture writes, live metadata matched that endpoint and reported branch
`br-curly-mode-b3w8zmkb`. No production connection was used. Credentials were not logged or committed.

Read-only catalog checks confirmed nullable varchar(100) code, the lower(code) unique index with
no deletion predicate, and sequence start/min 0, max 9,999,999,999, increment 1, NO CYCLE.
Migration 0006 was not reapplied; no migration or seed/import command ran. Disposable fixtures
were tracked by explicit IDs. The local application used `pnpm dev --port 3100` with
`WATCHPACK_POLLING=true` to avoid the local EMFILE watcher limit. Actual credentials login
established separate admin and cashier sessions; authentication was not mocked or bypassed.

| Actual check             | Result                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manual create/read/list  | 201 raw Product and 200 reads retained mixed case, trimming, leading zeros, and a 100-character code. Nine missing/blank/null/numeric/invalid/overlength inputs returned 400 without inserts. A one-character live sample was not exercised.                                                                                                          |
| T018 coded edits         | Self-code and omitted-code edits returned 200 with PUT data envelope. Case-variant duplicate returned 409; blank/null/numeric/punctuation returned 400. Full losing rows, including timestamps, remained unchanged. Replacement released the old code; soft-deleted current codes remained reserved. Stock stayed 7.                                  |
| Ownership races          | Create/create, create/edit, and edit/edit used different products and case variants. Each produced one success and one 409, exactly one owner, and unchanged losing edit records.                                                                                                                                                                     |
| PostgreSQL constraints   | Direct duplicate update raised 23505 for products_code_unique; invalid code raised 23514. Neither changed the losing record.                                                                                                                                                                                                                          |
| Legacy compatibility     | Multiple disposable null rows coexisted; detail returned null. Omitted-code edit returned 400 atomically. A real cashier transaction returned 201; assignment returned 200; clearing returned 400. Product ID/stock and saved transaction detail snapshot remained unchanged.                                                                         |
| Generate API             | Five concurrent calls returned distinct prefix-20 checksum-valid 13-digit strings, no Product count change, and no-store. Cashier generation returned 200. Manual claim of a candidate made later creation return 409; exact saved string survived detail reload.                                                                                     |
| Authentication           | Real admin/cashier Product reads returned 200. Missing-session Product read and Generate returned 401; Generate retained no-store.                                                                                                                                                                                                                    |
| Coordinated guarded race | Actual repository executed a zero-row update on a null fixture. Another real update assigned code/name/stock before actual service lookup. Service raised exact refresh/manual-retry ApiError 409, one failed update attempt, concurrent fields preserved. A repository wrapper coordinated timing; running-server HTTP interleaving was not induced. |
| Initial browser load     | Headless Chrome loaded the authenticated page: Product Code and Not assigned appeared; zero automatic Generate requests, hydration mismatches, disconnected-useForm warnings, or circular-reference warnings were observed.                                                                                                                           |
| Create reopen            | **FAIL**: enter Unsaved001, Cancel, reopen Add product; code remained Unsaved001. Isolated repeat waited 1.5 seconds after close and reopen and reproduced failure. Dependent browser acceptance stopped.                                                                                                                                             |

The first legacy transaction attempt encountered `bufferUtil.mask is not a function` and a terminated
WebSocket connection. Restarting the verification server with `WS_NO_BUFFER_UTIL=1` and
`WS_NO_UTF_8_VALIDATE=1` passed the check using the JavaScript WebSocket path. No source/dependency
change was made; default server-environment transaction behavior still requires investigation.

The reopen failure exposes a gap in the offline Form harness: it simulates hidden children receiving
open=false, whereas installed rc-dialog MemoChildren skips hidden updates
(`shouldUpdate: visible || forceRender`). The initializer can see open=true on mount and reopen,
skipping its reset effect. Passing callback tests did not prove this Modal lifecycle. Source review
also found required internal-only/non-GS1 generation guidance and legacy-edit assignment explanation
absent from the current form. These were reported, not restored in this verification-only pass.

| Task | Current status / remaining work                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T012 | Unchecked: actual Create reset-on-reopen failure prevents full create/save/reload/reopen acceptance.                                                                                                                                                                                                                                                                                                 |
| T018 | Complete: real authenticated edit, duplicate, deletion-reservation, reuse, and ownership-race API checks passed.                                                                                                                                                                                                                                                                                     |
| T022 | Unchecked: current legacy read/edit/transaction compatibility passed with WebSocket workaround; no pre-migration baseline proves historical migration preservation/no backfill on this branch.                                                                                                                                                                                                       |
| T030 | Unchecked: Generate API passed; browser confirmation/cancel/stale-response/save/reopen matrix is incomplete after lifecycle failure.                                                                                                                                                                                                                                                                 |
| T033 | Unchecked: real constraints, three ownership races, concurrent Generate, candidate claim, and coordinated service guard passed. Occupied-candidate skipping, 32-attempt bound, max exhaustion, concurrent current-code preservation, and running-server guard interleaving remain unverified. Sequence-limit fixtures need a separately isolated target; shared sequences were not reset or altered. |
| T034 | Unchecked: initial browser/API subsets passed; keyboard/cache/full form acceptance is incomplete, guidance is absent, and default WebSocket transaction behavior failed.                                                                                                                                                                                                                             |

Offline checks on this resume: 36/36 tests (24 Product, 7 User, 5 Transaction), TypeScript, and lint
passed; lint retained eight baseline warnings. No source changed, so production build was not rerun;
the earlier build result is historical. No framework/dependency was installed; browser checks used
installed Chrome through CDP and ws. Mock results are separate from the actual checks above.

Cleanup reverified branch/endpoint and atomically removed only tracked fixtures: 19 Products, two
Users, one Transaction and one item. Follow-up counts for those fixture IDs were zero. Temporary
session credentials were deleted; local server/browser stopped and disposable browser profile
removed. Generated sequence positions were consumed normally and never reset. Application source,
configuration, migrations, and dependency files were not changed in this resume.

### UI corrections and browser regression verification (2026-10-15)

The user authorized fixing the reopen lifecycle and missing guidance. Reset/prefill now run in
the parent component's open/product effect, gated by a mount signal from inside Form. This avoids
rc-dialog's hidden-child memoization while preventing disconnected form access. No forceRender is
used. Product Code extra text explains internal-only/non-GS1 generation and, only for null-coded
legacy edits, required assignment before saving any changes.

The Node Form harness now skips hidden-child updates and settles mount-signal state changes.
The revised regression reproduced retained unsaved values before the fix and passed afterward;
it also checks restored Edit name/code, cleared field errors, empty Create reopen, lazy mounting,
and product switching. Conditional guidance has its own regression test.

All 37 Node tests (25 Product, 7 User, 5 Transaction), TypeScript, lint, production build,
changed-source/test formatting, and git diff --check passed. Lint retained eight existing warnings.
Build and the browser verification server used an unreachable placeholder DATABASE_URL. No live
database was accessed; no schema, migration, dependency, or application configuration changed.

Seven actual Chrome/Ant Design check groups passed against the production build with local API
fixtures and an isolated session fixture: initial hydration/no automatic Generate; empty Create
reopen; exact Edit reopen and Create-after-Edit reset; visible generation/legacy guidance and
legacy required validation; explicit Generate/confirmation decline/keyboard confirmation; stale
generation after manual edit or close/reopen with Save disabled while pending; failure retention
and generated Edit save/cache/prefill through fixture responses. No hydration, disconnected-form,
or circular-reference warnings were observed. Browser automation waited for confirmation exit
animations before targeting underlying Modal buttons.

These results resolve the reproduced lifecycle and guidance defects, but fixture API responses
do not prove live save/cache persistence or the full T012/T030/T034 acceptance matrix. Their task
checkboxes remain unchecked until the remaining live scenarios are completed. Prior database and
WebSocket verification limits are unchanged. Local browser/server processes, session token, and
disposable browser profile were cleaned up.

### Real application/API verification after UI fixes (2026-10-15)

This run supersedes the fixture-only UI verification and prior T012/T030 status. Before any writes,
`.env` matched the previously user-confirmed development endpoint ep-late-brook-b3zru84v; live
metadata matched that endpoint and branch br-curly-mode-b3w8zmkb. No production access, migrations,
seed/import commands, schema changes, source changes, or dependency installation occurred.

Two disposable admin/cashier accounts logged in through the actual credentials/CSRF flow. Chrome
used their real sessions and the actual application/Product APIs backed by Neon. No HTTP response
fixtures or forged sessions were used. Response-delay checks paused and released genuine Generate
responses. The guarded legacy UI case deliberately omitted code from a real PUT and timed a
separate actual assignment request to exercise the supported partial-update contract.

| Verified live case           | Actual outcome                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T012 Create/Edit lifecycle   | Unsaved code/name cleared on Create reopen; Edit restored saved code/name; Create after Edit was empty. Required/invalid input prevented insertion. Real 201 saves, list invalidation, reload and Edit preserved mixed case and leading zeros. Examples: AbCVerify17c04a67ac001 and 009893853209.                                                                                                         |
| UI guidance                  | Internal-only/non-GS1 guidance appeared; null-coded legacy Edit showed required-assignment guidance and kept entered fields on required failure.                                                                                                                                                                                                                                                          |
| Duplicate UI Save            | Real 409 preserved all form entries and the entire saved row; reopen restored original values and cleared previous errors.                                                                                                                                                                                                                                                                                |
| T030 Generate                | Generated prefix-20, checksum-valid 13-digit strings only on click. Declined confirmation sent no request; keyboard confirmation worked. Generate/cancel did not insert a Product.                                                                                                                                                                                                                        |
| Stale Generate               | Three genuine delayed responses did not overwrite manual input, reopened Create, or another Product's Edit. Save remained disabled during pending generation.                                                                                                                                                                                                                                             |
| Real business failure        | Disposable manual assignments occupied the next 32 candidates, including a soft-deleted owner. Generate consumed exactly 32 positions, returned the documented 503 retry-limit message, preserved populated input, and wrote no Product. Sequence values/bounds were never reset or altered.                                                                                                              |
| Candidate claim              | Another actual manual save claimed the candidate. UI Save returned 409 once without retry; another Generate then saved successfully. Exact string survived real list refresh/reload/reopen (2000000000589).                                                                                                                                                                                               |
| Auth/access                  | Missing-session API returned 401; the existing QueryProvider signed out and redirected the browser to login. Cashier APIs retained authenticated access, while actual Add/Edit/Delete UI controls stayed disabled. No auth policy changed.                                                                                                                                                                |
| API boundaries               | Eight invalid creates returned 400 without insertion. Unused 1-character and 100-character codes succeeded. Raw create/detail/delete and PUT data envelopes, deleted 404, name-only search and distinct page-1/page-2 results passed. Actual browser URL pagination also passed.                                                                                                                          |
| Current-code race            | Concurrent explicit replacement and omitted-code update both returned 200; the latest code remained assigned and stock stayed 7.                                                                                                                                                                                                                                                                          |
| Legacy race                  | Actual HTTP guarded update returned the exact refresh/manual-retry 409 and preserved concurrent code/name/stock. The actual Form displayed distinct form-level guidance, retained user code/name/stock, sent one Save request without retry, and loaded concurrent values after manual refresh. Target UI interleaving occurred at 100 ms after 70/40 ms attempts observed valid still-null 400 outcomes. |
| Current legacy compatibility | Multiple nulls coexisted. Uncoded omitted-code edit failed atomically, duplicate assignment failed atomically, valid assignment passed, clearing failed, and uncoded soft delete worked. Real transaction/assignment preserved IDs, stock and historical snapshots using the documented JavaScript WebSocket fallback.                                                                                    |

No hydration, disconnected-useForm, or circular-reference warning was observed in the successful
real-browser runs. Nine main browser check groups and two additional browser groups passed.
The initial attempted retention test using 401 was corrected: 401 intentionally invokes existing
global sign-out; business-failure retention was verified with the actual bounded-retry 503 instead.

Environment limits were verified rather than assumed away. The default transaction runtime raised
native WebSocket `mask is not a function` and timed out. A restart also encountered inconsistent
shared `.next` artifacts (missing vendor-chunks). An exact source copy with existing installed
dependencies was built in a temporary directory and served on port 3101 to isolate build output.
There, transactions passed with WS_NO_BUFFER_UTIL=1 / WS_NO_UTF_8_VALIDATE=1; a final clean-build
probe without fallback reproduced the native mask failure and timeout. No source fix or persistent
configuration change was made. T022 and the full default-environment T034 gate were left unchecked
under the previous scope; the maintainer later removed the unrelated native-transport requirement.

| Task | Status / blocker under the previous scope                                                                                                                                                                                                                                                                                                                       |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T012 | Complete: actual app/API create/read/display/reopen acceptance passed after lifecycle fix.                                                                                                                                                                                                                                                                      |
| T030 | Complete: actual Generate/confirmation/cancel/stale/failure/claim/save/reopen cases passed.                                                                                                                                                                                                                                                                     |
| T022 | Unchecked: current compatibility passed with JavaScript WebSocket fallback; default native transport fails, and no pre-0006 baseline proves migration preservation/no backfill retrospectively. Requires native-runtime resolution and pre/post-migration evidence on an authorized disposable target.                                                          |
| T033 | Unchecked: prior ownership/index checks remain valid; this run proved actual HTTP guard, concurrent current-code preservation, occupied/deleted candidates and exact 32-attempt failure. Max-value exhaustion remains unverified and requires a separately isolated disposable branch; the shared development sequence must not be reset/advanced to its limit. |
| T034 | Unchecked: real Product UI/HTTP matrix, including actual guarded 409 form retention/no retry, passed; transaction/history checks passed only with fallback. Full default-environment acceptance is blocked by the reproduced native WebSocket failure.                                                                                                          |

All 37 Node tests, TypeScript, lint and production build passed; lint retained eight existing warnings.
Both repository and isolated builds used unreachable placeholder DATABASE_URL values during build;
actual running-app verification used the verified development connection. Ignore files were verified;
no extension hooks file was present before or after execution.

Cleanup reverified branch/endpoint and atomically deleted only tracked disposable data: 50 Products,
two Users, one Transaction and one item. Remaining fixture counts were zero. Counts and ordered-row
hashes of all four tables matched the pre-run baseline after cleanup, proving existing development
rows were unchanged by this run (not retrospective proof of migration 0006). Owned servers/browser,
temporary sessions, browser profile and isolated application copy were cleaned up. Sequence gaps
from genuine Generate/transaction calls were retained.
