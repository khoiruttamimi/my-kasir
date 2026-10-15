---
description: "Dependency-ordered implementation tasks for Product Code Management"
---

# Tasks: Product Code Management

**Input**: Design documents from `specs/001-product-code-management/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [HTTP contract](contracts/product-api.md),
[UI contract](contracts/product-ui.md), and [quickstart.md](quickstart.md).

**Tests**: Focused service regression coverage is required by constitution Principle V and the
approved plan. Use the existing node:test/transpilation/mocked-repository pattern; no new framework
or blanket TDD requirement. Test-authoring tasks precede implementation; run them after the
corresponding code exists. Manual/live checks are distinct from automated service coverage.

**Current verification scope**: The maintainer's scope revision below governs T022/T033/T034.
Historical migration replay and unrelated native WebSocket transaction execution are not Product
Code completion gates. Live sequence exhaustion is deferred; its behavior remains specified and
its helper/service regression tests remain required. Earlier dated status reports are historical.

**Organization**: Story numbers match spec.md; phases follow priority: US1, US3, US4 (P1), then
US2 (P2). Foundational work is shared; each story has its own acceptance checkpoint.

## Format: `[ID] [P?] [Story] Description`

- Every task has a completion checkbox, sequential ID, and exact repository-relative file path.
- `[P]` means different-file work can run concurrently once its stated prerequisites are met.
- `[US1]`–`[US4]` appear only on user-story tasks. Parallel markers do not authorize spawning agents.

## Path Conventions

All paths are relative to the existing repository root. Existing application files are extended,
not reorganized. New planned paths: `src/server/utils/product-code.ts`,
`src/app/api/products/generate-code/route.ts`, `tests/product-service.test.mjs`, and
`docs/product-code-management.md`. Migration filenames come from Drizzle generation; do not invent
or overwrite an applied migration name. Evidence stays in this feature's `quickstart.md`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the baseline without new packages, framework configuration, or data writes.

- [X] T001 Inspect `AGENTS.md`, `.specify/memory/constitution.md`, `package.json`, and `specs/001-product-code-management/quickstart.md`; record baseline type/lint/User/Transaction test outcomes and any pre-existing failures in the quickstart evidence section without installing dependencies or exposing environment secrets.
- [X] T002 Review `src/server/services/product.service.ts`, `src/server/repositories/product.repository.ts`, `src/features/dashboard/products/components/modal-product-form.tsx`, and `specs/001-product-code-management/contracts/product-api.md`; confirm unchanged access policy/envelopes and record schema-first rollout plus retirement of old null-code writers in `specs/001-product-code-management/quickstart.md`.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define shared data contracts and database authority before user-story implementation.

- [X] T003 [P] Extend `src/server/db/schema.ts` with Product code constraint "Nullable varchar(100); public `string | null`", `products_code_format_check` allowing null or 1–100 ASCII alphanumerics, and `products_code_unique` on lower(code) with no deleted-at filter; add `product_code_seq` with "min/start 0, max 9,999,999,999, increment 1, no cycle" independent of invoice sequence, without default generation or backfill.
- [X] T004 Generate and review the new additive migration under `drizzle/` and matching `drizzle/meta/` using `pnpm db:generate` after T003; verify multiple legacy nulls remain, no old migrations or Product/Transaction values change, and sequence/index/check bounds match `specs/001-product-code-management/data-model.md`; do not apply migrations automatically.
- [X] T005 [P] Extend `src/models/product.ts` with nullable read code and exported typed create/update business payloads: "Create input requires `code: string`" and "Update input allows omitted `code`, but any supplied code must be a string"; separate form/input types from timestamps and nullable read values without widening validation or changing existing fields.
- [X] T006 Add a parameterized case-insensitive code lookup to `src/server/repositories/product.repository.ts` that includes deleted owners and can exclude a Product ID; preserve current active-only reads, name-only search, ordering, and pagination, and include code through existing row projections.

**Checkpoint**: Reviewed migration and typed contracts exist; repository lookup matches index
semantics. For live testing, the reviewed migration must be explicitly applied to a verified test
branch. Generated schema changes alone do not prove database behavior.

## Phase 3: User Story 1 - Create and view a manually coded product (Priority: P1)

**Goal**: Save a unique manual code and display it without losing zeros or case.

**Independent Test**: Create `AbC001` and an unused leading-zero value, reopen and reload;
required/invalid/duplicate values fail without partial creation or lost form entries.

### Tests for User Story 1

- [X] T007 [P] [US1] Create `tests/product-service.test.mjs` using the existing `tests/user-service.test.mjs` loading/mocking pattern; cover required new codes, "Trim outside whitespace", "Require 1–100 ASCII A–Z/a–z/0–9 characters; preserve original case and leading zeros", boundaries 1/100/101, null/numeric/blank/invalid input, manufacturer strings without EAN checksum, case-insensitive precheck, and wrapped index-conflict versus unrelated-error behavior.

### Implementation for User Story 1

- [X] T008 [US1] Implement required create-code normalization/validation and duplicate handling in `src/server/services/product.service.ts`, and require typed code on insertion in `src/server/repositories/product.repository.ts`; map only SQLSTATE 23505 plus `products_code_unique` through a cycle-safe cause traversal to ApiError 409 "Product code is already in use", leaving unexpected errors untouched (after T006).
- [X] T009 [P] [US1] Type create/read/update request functions in `src/features/dashboard/products/api/product.api.ts` with nullable Product reads and required string-code create payloads and typed partial update business fields plus ID (optional string code, no timestamp requirements); preserve existing list/detail/create envelopes and string serialization (after T005; independent of T007/T008).
- [X] T010 [US1] Verify create/list wiring in `src/app/api/products/route.ts` and detail serialization in `src/app/api/products/[id]/route.ts`; keep `withAuth` with no added roles, `readJsonBody`/`apiResponse`, raw Product 201/create and 200/detail, list pagination, documented validation 400s and duplicate 409, changing route code only where needed.
- [X] T011 [US1] Add the single required Product Code text input to `src/features/dashboard/products/components/modal-product-form.tsx` with typed form values, normalization-compatible validation, reset on open/product switch, leading-zero preservation, and duplicate field feedback retaining all entries; reuse FormItem/Input and existing successful save/reset behavior (after T009; Generate is completed in US2).
- [X] T012 [US1] Add the Product Code column in `src/features/dashboard/products/container.tsx` showing exact string values and null as "Not assigned"; retain current name-only search, pagination, permissions, and other columns, then verify US1 acceptance and record results in `specs/001-product-code-management/quickstart.md`.

**Checkpoint**: Manual create/read/display works without generation. Run the Product service suite
and relevant type/lint checks. This is the development MVP; production release waits for P1 edits
and legacy protection as well.

## Phase 4: User Story 3 - Correct a code without duplicates (Priority: P1)

**Goal**: Replace codes safely, preserve current codes when omitted, and reject competing claims.

**Independent Test**: Change one code, save its unchanged value, attempt another owner's code,
clear it, and verify stable IDs, stock, snapshots, and atomic failure.

### Tests for User Story 3

- [X] T013 [P] [US3] Extend `tests/product-service.test.mjs` with unchanged self-code, trimmed case variants, deleted-code reservation, changed-away reuse, explicit blank/null/numeric rejection, omitted-code preservation, missing/deleted IDs, and simulated nested 23505 save races with no partial mutation; cover zero-row guarded updates whose follow-up finds still-null (400), missing/deleted (404), or concurrently assigned code (409 with refresh/manual-retry message), asserting one update attempt and no further write/retry; test unrelated database faults propagate (after US1).

### Implementation for User Story 3

- [X] T014 [US3] Extend `src/server/repositories/product.repository.ts` for conditional single-statement updates: "When code is omitted, leave it out of SET and condition the update on current `code IS NOT NULL`"; never restore a stale pre-read code, keep active-only predicates, and expose sufficient results for distinguishing still-uncoded required-code 400, missing/deleted 404, and follow-up now-coded 409 after a zero-row guard; never automatically retry the update.
- [X] T015 [US3] Implement effective-code edit rules in `src/server/services/product.service.ts`: validate any provided code, exclude self on duplicate lookup, allow valid replacements, reject clearing and uncoded omitted-code edits, and narrowly translate index races; resolve zero-row guarded updates via follow-up lookup as still-uncoded required-code 400, missing/deleted 404, or now-coded 409 with "Product Code was assigned by another request. Refresh and retry manually."; perform no automatic retry or further write, preserve concurrent changes, and avoid broad error remapping (after T014).
- [X] T016 [P] [US3] Verify partial edit request behavior in `src/features/dashboard/products/api/product.api.ts` and affected Product/detail invalidation in `src/features/dashboard/products/hooks/use-products.ts` using payload typing already completed in T009; retain PUT `{ data: Product }` and DELETE raw Product responses, omit unspecified code from serialized partial edits, and ensure assignment-conflict 409 does not trigger automatic save retry or success invalidation (after US1, independent of T013/T014).
- [X] T017 [US3] Complete edit prefill/typed submission and clear/duplicate feedback and distinct concurrent-assignment 409 form-level refresh/manual-retry guidance retaining entries without auto-submit/retry in `src/features/dashboard/products/components/modal-product-form.tsx`; preserve assigned value on unrelated edits, retain entered data on failure, and verify `src/app/api/products/[id]/route.ts` still delegates validation while retaining response statuses/envelopes (after T015/T016).
- [X] T018 [US3] Execute the US3 manual/API cases in `specs/001-product-code-management/quickstart.md`, including deleted-owner conflicts and changed-away reuse; record exact outcomes and any unavailable live concurrency checks without representing mocks as index proof.

**Checkpoint**: Coded edits pass; empty/duplicate replacements fail atomically. Existing explicit
concurrent edits retain last-write-wins behavior, subject to the unique index.

## Phase 5: User Story 4 - Continue using legacy products (Priority: P1)

**Goal**: Leave legacy products uncoded at rollout, require a code on their next edit, and preserve
viewing, transactions, stock, IDs, and historical snapshots.

**Independent Test**: List/read an uncoded fixture without assigning a code; edit without code
fails; valid unique assignment succeeds; future clearing fails. Verify stable Product identity,
unchanged stock and fields not requested for edit, and nullable-code consumer compatibility (T021).
No pre-migration baseline or historical migration replay is required for this checkpoint.

### Tests for User Story 4

- [X] T019 [P] [US4] Extend `tests/product-service.test.mjs` for legacy null reads, omitted-code edit rejection with unchanged other fields, successful manual assignment, duplicate assignment failure, post-assignment omitted-code preservation, and soft-delete of an uncoded legacy product without forced assignment (after US3).

### Implementation for User Story 4

- [X] T020 [P] [US4] Add explicit legacy assignment guidance in `src/features/dashboard/products/components/modal-product-form.tsx`: map read null to empty input, require a valid code on any submitted edit, explain why unrelated edits need assignment, and retain all form entries on required/duplicate failure (after US3; independent of T019).
- [X] T021 [US4] Inspect code consumers in `src/server/services/transaction.service.ts`, `src/server/repositories/transaction.repository.ts`, and `scripts/seed-transactions.ts` for nullable read compatibility; document preservation of IDs/snapshots and no stock mutation in `specs/001-product-code-management/quickstart.md`, changing only Product-related types if a demonstrated compile error requires it and never changing transaction behavior.
- [X] T022 [US4] Validate current legacy Product scenarios from `specs/001-product-code-management/quickstart.md` on a verified, already migrated development/test branch: multiple nulls coexist; list/detail preserve null and show "Not assigned" without automatic assignment; required/duplicate/clearing edits fail atomically; valid unique assignment succeeds while IDs, stock and business fields not requested for edit remain unchanged. Retain nullable consumer/code-only-edit compatibility evidence from T021 and recorded snapshot checks. Historical migration replay, a pre-0006 baseline, and native WebSocket transaction execution are not prerequisites; do not claim those checks passed.

**Checkpoint**: All P1 behavior works with manually assigned codes. Generation is not needed to
verify legacy compatibility. Any unavailable database operation remains an explicit verification
limit; never mark it proven by service mocks.

## Phase 6: User Story 2 - Generate an internal code (Priority: P2)

**Goal**: Fill the same input on demand with a checksum-valid internal code, without saving or
reserving a Product and without overwriting newer user input.

**Independent Test**: Generate in empty/populated forms, verify prefix/range/checksum, save/reopen;
confirmation/cancel/failure/stale-response cases preserve the intended form and saved state.

### Tests for User Story 2

- [X] T023 [P] [US2] Extend `tests/product-service.test.mjs` for pure-helper known vectors (`2000000000008` and a zero-check-digit case), bounds/13-digit formatting, repository next-value stubs, collision skipping across deleted owners, 32-attempt 503 distinct from real sequence exhaustion, unexpected faults, and no Product insert/update on Generate (after US4).

### Implementation for User Story 2

- [X] T024 [P] [US2] Create `src/server/utils/product-code.ts` with dependency-free formatting/checksum helpers: "prefix `20`, followed by a ten-digit value from `0000000000` through `9999999999`, followed by the calculated EAN-13 check digit"; reject out-of-range values, preserve decimal text padding, and compute alternating 1/3 weights on the first 12 digits (after foundation; independent of T023).
- [X] T025 [US2] Add dedicated sequence access in `src/server/repositories/product.repository.ts` via existing Neon HTTP/Drizzle, returning nextval as decimal text with no Product writes; classify exhaustion narrowly for `product_code_seq`, do not reset/cycle, and reuse all-owner code lookup (after T004).
- [X] T026 [US2] Implement Generate orchestration in `src/server/services/product.service.ts` after T024/T025: skip occupied candidates, "tries at most 32 per request", return an unreserved candidate, use distinct documented 503 messages for attempt limit and exhausted sequence, and propagate unexpected faults without exposing internals.
- [X] T027 [US2] Add POST-only `src/app/api/products/generate-code/route.ts` calling the service through existing `withAuth`/`apiResponse`; no request parameters, 200 `{ code: string }`, documented 401/503 errors, `Cache-Control: no-store`, and static route precedence over `[id]`; no new permission filter (after T026).
- [X] T028 [US2] Add the typed POST generation function in `src/features/dashboard/products/api/product.api.ts` and mutation hook in `src/features/dashboard/products/hooks/use-products.ts` without cache invalidation, auto-fetch/prefetch, or reservation behavior; preserve existing save invalidations (after T027).
- [X] T029 [US2] Add non-submit Generate, populated-input confirmation, pending/error states, internal-only non-GS1 guidance, and request/form/edit-revision guards in `src/features/dashboard/products/components/modal-product-form.tsx`; disable repeated Generate/Save during current generation, preserve input on failure, allow manual edits to supersede pending responses, ignore stale results on edit/close/switch, and apply changes only on Save (after T028).
- [X] T030 [US2] Execute US2 browser/API cases in `specs/001-product-code-management/quickstart.md`: no automatic generation, confirmation decline sends no request, successful replacement stays unsaved, cancellation creates no Product, late responses do not overwrite newer state, generated candidate later claimed manually returns 409 on Save, and exact saved string survives reopen; record verification limits.

**Checkpoint**: Generation fills the same field, guarantees checksum/range only for generated
values, and makes no GS1 or global uniqueness claim. Failed/canceled requests may consume sequence
positions but never change Products.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Finish documentation and verify the full feature against contracts and constitution.

- [X] T031 Create `docs/product-code-management.md` describing validation/errors, internal-only generation, nullable legacy migration, assignment-on-edit, soft-deleted code reservation, envelope compatibility, schema-first deployment/retirement of old writers, and rollback preserving assigned codes and sequence; reference `specs/001-product-code-management/quickstart.md` without duplicating application implementations.
- [X] T032 Run `pnpm exec tsc --noEmit`, `pnpm lint`, `node --test tests/product-service.test.mjs tests/user-service.test.mjs tests/transaction-service.test.mjs`, and `pnpm build` after source completion; record results in `specs/001-product-code-management/quickstart.md`, resolve feature-introduced failures, and distinguish pre-existing/environment failures without disabling rules or changing dependencies.
- [X] T033 Run the required live-database checks in `specs/001-product-code-management/quickstart.md` only against a verified, explicitly authorized development/test branch with disposable fixtures: create/create, create/edit, edit/edit case-insensitive races, full losing-record atomicity, current-code preservation, null legacy guard and coordinated zero-row-then-code-assigned 409 with no retry/further write, concurrent distinct Generate without Product writes, candidate claim-before-save, occupied/deleted sequence candidates, and the exact 32-attempt retry-limit failure. Confirm sequence bounds/NO CYCLE from catalog metadata and never reset/alter shared sequences. Live max-value exhaustion belongs to DV-001 below and is not a completion gate; retain its required helper/service tests and record its unverified live risk separately.
- [X] T034 Run the Product Code UI/HTTP acceptance matrix in `specs/001-product-code-management/quickstart.md`: validation and duplicate errors, labels/keyboard confirmation, nullable list display, Create/Edit reset and prefill, exact string storage/reload, Generate confirmation/cancel/stale/failure/claim behavior, save/cache refresh, distinct assignment-conflict 409 guidance and retained entries with no automatic retry, missing-session 401 and existing authenticated policy, unchanged search/pagination, and code-only-edit ID/stock/snapshot preservation. Use actual browser/API outcomes and recorded compatibility evidence; unrelated transaction creation/history reads through native WebSocket are not a completion gate. Keep that runtime failure recorded as unresolved, not passed.
- [X] T035 Review the final diff and requirement mapping in `specs/001-product-code-management/tasks.md` against `specs/001-product-code-management/spec.md`, `contracts/product-api.md`, `contracts/product-ui.md`, and `.specify/memory/constitution.md`; confirm no scanner/printing/code-search/new-role/stock features or unrelated refactors, report remaining risks and blocked checks, and mark only genuinely completed tasks.

## Dependencies & Execution Order

### Phase Dependencies

Setup T001 → T002 precedes foundation. Foundation completes before story work. T009 includes update payload typing and must complete
before T011; T016 verifies edit behavior/cache handling rather than introducing those types. T003 and T005
can run concurrently after setup; T004 follows T003; T006 follows schema/model definitions.
Applying a migration is not a dependency of writing code, but is required before testing against
a database or deploying new readers.

### User Story Dependencies

```text
Setup → Foundation → US1 (P1 manual create/display)
                         → US3 (P1 coded edits/conflicts)
                            → US4 (P1 legacy compatibility)
                               → US2 (P2 generation) → Polish
```

US3 reuses US1's contracts/validation/form; US4 verifies the legacy branch of shared edit rules.
US2 can be verified with new products alone, but is sequenced last to avoid concurrent edits to
shared Product files. Its pure helper T024 can be prepared earlier after foundation if staffed.
Each acceptance checkpoint uses its own scenario/fixtures, without requiring later stories.

### Within Each User Story

Write focused behavioral cases from approved contracts; implement repository/service boundaries
before route integration, then client API/hooks and UI, then run relevant checks. Do not create
redundant contract-test files or install a framework: HTTP/UI checks use the quickstart guide.
Tasks touching the same file must run sequentially even when stories are otherwise independent.

### Parallel Opportunities and Examples

- Foundation: T003 (`schema.ts`) alongside T005 (`models/product.ts`); T004 waits for T003.
- US1: T007 (`tests/product-service.test.mjs`) alongside T009 (`api/product.api.ts`), after foundation.
- US3: T013 (tests) alongside T016 (feature API/hooks), after US1; T014/T015 remain sequential.
- US4: T019 (tests) alongside T020 (form), after US3; verification waits for both.
- US2: T023 (tests) alongside T024 (pure helper), after US4; T026 waits for T024/T025.

These are work-scheduling examples only. Do not edit a file in two tasks at once or treat `[P]`
as permission to bypass a prerequisite, database authorization, or available-agent policy.

## Implementation Strategy

### MVP First

Complete setup/foundation and US1 for a development MVP: manually create and display codes,
including required validation, unique-index authority, and existing envelope preservation. No
Generate is needed for that slice. Finish US3 and US4 before a production rollout so edits and
legacy products follow the approved rules; then add US2 and run cross-cutting verification.

### Incremental Delivery

Keep changes within existing boundaries. Run targeted service/type/lint checks at story
checkpoints and build after route/server-client integration. For deployment, review and explicitly
apply additive schema first, deploy all new validation-aware writers, and verify fresh creates
require codes. Never backfill legacy codes automatically, reset a sequence, or execute seed/import
commands as incidental setup. If live checks cannot run, retain the task/evidence limit rather
than silently marking verification complete.

## Requirement Coverage

| Requirement | Tasks |
| --- | --- |
| FR-001 required unique new code | T003–T011 |
| FR-002 single editable input + Generate | T011, T017, T028–T029 |
| FR-003 string/trim/length/characters | T003, T005, T007–T009, T011 |
| FR-004 case-insensitive all-owner uniqueness/reuse | T003, T006, T013–T018, T033 |
| FR-005 duplicate errors/atomic concurrent saves | T007–T008, T013–T018, T033 |
| FR-006 EAN-13 generation/manual freedom | T007, T023–T026, T030 |
| FR-007 click/confirmation/edit/save lifecycle | T017, T029–T030, T034 |
| FR-008 fixed internal range | T003–T004, T023–T027 |
| FR-009 candidates/conflict/failure/exhaustion | T023–T030, T033; deferred live boundary DV-001 |
| FR-010 internal-only non-GS1 guidance | T029–T031 |
| FR-011 list display/edit prefill | T011–T012, T017, T020 |
| FR-012 legacy preservation/next-edit assignment | T003–T004, T014–T015, T019–T022 |
| FR-013 omitted/cleared code and history | T013–T017, T019–T022, T034 |
| FR-014 preserved permissions and scope | T002, T010, T021, T027, T031, T034–T035 |
| FR-015 guarded legacy assignment conflict/manual retry | T013–T017, T033–T034 |

This task list was originally generated without application or database changes. Current
implementation status and verification limits are recorded below.

## Deferred verification

These checks are outside the T001–T035 completion gate. Deferral does not remove the specified
behavior, its implementation, or required automated regression coverage.

| ID     | Check                                                                                                                                                                                                                                              | Status                                                                                                         | Risk and safe execution conditions                                                                                                                                                                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DV-001 | Live final value of product_code_seq, then exhaustion: full ten-digit/13-digit formatting, no cycling, correct exhaustion 503 distinct from retry-limit/connectivity errors, retained form input, and valid manual entry/save remaining available. | Deferred — NOT RUN LIVE. Helper/service exhaustion tests and catalog bounds/NO CYCLE checks passed separately. | Actual Neon end-of-range error classification and HTTP/UI behavior at the final position are not proven. Requires a dedicated disposable branch with reviewed schema already applied and separately scoped sequence fixtures. Never advance/reset the shared development or production sequence to exercise this boundary. |

Historical migration replay requiring a pre-0006 baseline is removed from this feature's completion
gate, not relabeled as passed. Reviewed additive/no-backfill schema and current legacy Product
preservation remain required. Lack of a historical baseline limits retrospective assurance about
that past migration; any future data-changing migration still needs its own verification plan.

Native WebSocket transaction execution is a separate known runtime failure, not deferred Product
Code acceptance. It remains unresolved (`mask is not a function`); compatibility checks passed
with the documented JavaScript fallback. Risk: default native transaction creation can still fail.
Track its diagnosis/retest separately; completing Product Code tasks does not resolve that issue.

## Implementation status (2026-10-14, latest offline run)

The user's latest instruction is to continue implementation without live operations. Code tasks
continue in their existing order; live acceptance remains deferred and is never treated as passed.
This supersedes the earlier stop-at-T012 note while preserving all verification limits.

**29/35 completed**: all source implementation, focused offline tests, operational documentation,
TypeScript/lint/build checks, and final contract/constitution review are complete. Checked tasks
reflect those completed deliverables, not proof of real database behavior.

| Unchecked task | Completed portion | Blocked verification |
| --- | --- | --- |
| T012 | Product Code column and Not assigned fallback | Actual create/save/reload/reopen against migrated data. |
| T018 | Coded edit rules and offline API/service tests | Real authenticated edit/duplicate/reuse acceptance. |
| T022 | Legacy guards, assignment guidance, offline tests | Actual legacy storage/transaction compatibility after migration. |
| T030 | Generate endpoint/helper/button and offline callback tests | Actual browser/HTTP generation, cancellation, race, and reopen scenarios. |
| T033 | SQL/sequence construction and classification tests with mocks | PostgreSQL uniqueness, concurrent saves, guarded race, and sequence limits. |
| T034 | HTTP envelopes/auth and form callbacks verified with mocks | Full real browser/HTTP/accessibility/cache/history acceptance matrix. |

These six tasks must stay unchecked until separately performed against an authorized isolated test
setup. No live database reads/writes, HTTP requests to the running app, seeds, migration commands,
sequence consumption/reset, or dependency additions occurred in this offline continuation.

Migration 0006 was generated earlier and the user reports applying it manually. No migration was
regenerated or applied here. Existing migration files and metadata remain as previously generated.

**Final checks**: 35/35 tests (23 Product, 7 User, 5 Transaction); TypeScript passed; lint passed
with eight baseline warnings and no new warnings; production build passed with an unreachable
placeholder DATABASE_URL. Type checking was rerun successfully after build because running them
concurrently initially raced over generated .next/types files. git diff --check passed.

Remaining risks are verification limits: real database constraints/concurrency and actual browser
interaction are not proven by stubs or the isolated hook/Form harness. See quickstart.md and
`docs/product-code-management.md` for the deferred acceptance and rollout steps. No other feature
implementation task remains pending.

## Development verification resume (2026-10-15)

The latest user instruction authorizes disposable development verification and supersedes the earlier
offline-only block. `.env.local` was absent; the user selected `.env` and confirmed development endpoint
ep-late-brook-b3zru84v. Before writes, live metadata matched it and branch br-curly-mode-b3w8zmkb.
No production access, migration/seed commands, shared sequence reset, source changes, or dependency
additions occurred.

T018 is now complete from actual authenticated API checks: unchanged/omitted codes, atomic
case-insensitive failures, soft-deleted reservations, changed-away reuse, and live ownership races.
The other five checkboxes stay unchecked:

| Task | Remaining verification / issue                                                                                                                                                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T012 | Browser Create reopen retained Unsaved001 after cancellation; fix lifecycle before full save/reload/reopen acceptance.                                                                                                                                                                               |
| T022 | Current null-code read/edit/transaction checks passed with WebSocket workaround; pre/post-migration preservation lacks historical baseline.                                                                                                                                                          |
| T030 | Generate API passed; dependent confirmation/cancel/stale/save/reopen browser checks stopped after lifecycle failure.                                                                                                                                                                                 |
| T033 | Real constraints, ownership races, concurrent Generate, candidate claim, and coordinated service guard passed. Occupied candidates, retry bound, exhaustion, concurrent current-code preservation, and running-server guard interleaving remain unverified. Do not alter shared sequences to finish. |
| T034 | Initial page passed without hydration/form/circular warnings. Full keyboard/cache/form matrix is incomplete; required generation and legacy guidance is absent. Default transaction WebSocket failed with bufferUtil.mask; JavaScript fallback passed.                                               |

All 36 offline tests, TypeScript, and lint passed (eight existing warnings). Lifecycle failure was
reproduced in isolation after complete close/open animations; mocked tests did not model rc-dialog
hidden-child memoization. No source fixes were made in this verification pass. Cleanup removed
19 Products, two Users, one Transaction and one item, with zero remaining tracked fixture IDs.
See quickstart.md's 2026-10-15 section for detailed evidence and verification boundaries.

## Real application/API verification after UI fixes (2026-10-15)

T012 and T030 are now complete from actual credentials login, application UI, Product APIs and
Neon persistence. Fixture-only results were not used to satisfy these tasks. UI reset/prefill,
guidance, save/cache/reload, duplicate retention, confirmation/keyboard actions, genuine delayed
responses, candidate claim-before-save, and actual 32-occupied-candidate 503 retention passed.
Actual API/browser pagination, cashier permissions, omitted-code/current-code concurrency and
guarded-assignment 409 form guidance/retention/no retry/manual refresh also passed.

The connection was pinned to verified development endpoint ep-late-brook-b3zru84v and branch
br-curly-mode-b3w8zmkb. No production access, migrations, seed/import commands, schema/source changes,
dependency additions, or shared sequence reset/alteration occurred. Existing unrelated work was preserved.

| Unchecked task | Remaining blocker                                                                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T022           | No pre-0006 baseline for retrospective migration preservation/no-backfill proof; default native WebSocket transaction path fails. Current legacy compatibility passed with JavaScript fallback.                                                               |
| T033           | Live max-value sequence exhaustion needs a separate isolated disposable branch. Other remaining race/current-code/occupied-candidate/retry-bound cases were verified against actual APIs/Neon; do not alter the shared development sequence to finish.        |
| T034           | Real Product UI/HTTP checks passed, including actual guarded 409. Full default-environment transaction/history acceptance remains blocked by native WebSocket mask failure, reproduced on a clean isolated build; fallback alone does not complete this task. |

All 37 Node tests, TypeScript, lint and builds passed (eight existing lint warnings). Source was not
changed in this verification pass. Cleanup removed 50 Products, two Users, one Transaction and
one item, with zero remaining fixtures and baseline table counts/ordered-row hashes unchanged.
See quickstart.md's final real-verification section for exact outcomes, coordination and limits.

## Verification scope reconciliation (2026-10-15)

The maintainer explicitly removed historical migration-baseline and unrelated native WebSocket
requirements from this feature's gates and deferred live sequence exhaustion to DV-001.
T022/T033/T034 are checked only for their revised, retained Product Code checks, using the actual
Neon/API/browser evidence already recorded in quickstart.md. No new tests were executed for this
documentation revision; removed, failed, and deferred checks are not newly claimed as passed.

**35/35 in-scope implementation tasks complete; DV-001 remains unverified live.** Validation,
case-insensitive uniqueness across deleted owners, atomic/concurrent failures, guarded legacy 409,
Generate/checksum/confirmation/retry bounds, exact storage/reopen/cache behavior, and legacy
assignment/stock/identity compatibility remain mandatory and retain their evidence. The earlier
unchecked-task tables describe previous verification scopes, not the current acceptance gate.
Native WebSocket failure and historical migration evidence limits remain recorded separately.
