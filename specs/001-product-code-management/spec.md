# Feature Specification: Product Code Management

**Feature Branch**: No new branch; authored on existing `main`.

**Created**: 2026-10-14

**Status**: Clarified — ready for planning

**Input**: Add unique editable Product Codes, manual alphanumeric entry, and a Generate button
for checksum-valid 13-digit internal MyKasir codes, not GS1-assigned GTINs. Preserve existing
products. Clarify generation timing, numbering range, legacy migration, and editing rules.
Exclude scanners, barcode images/printing, and stock changes.

## Clarifications

### Session 2026-10-14

- Q: When should MyKasir generate a Product Code, and what should happen if the input already contains a code? → A: Option A — generate only on click; confirm before replacing populated input. Manual editing remains allowed, assigned codes cannot be cleared, and changes take effect only on Save.

- Q: Which numbering range should MyKasir use for generated internal codes? → A: Option A — prefix `20` + ten digits (`0000000000`–`9999999999`) + one calculated EAN-13 check digit; internal MyKasir use only.

- Q: How should MyKasir handle products that existed before Product Codes were introduced? → A: Option B — leave legacy codes unassigned at rollout, but require a valid, unique code on the next product edit; preserve identities, stock, and history. Once assigned, a code cannot be cleared.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and view a manually coded product (Priority: P1)

As a product manager, I can enter a manufacturer barcode value or my own alphanumeric code
and see the saved identifier in product management.

**Why this priority**: New products need unique identifiers without depending on generation.

**Independent Test**: Create using manual entry, reload the list, and reopen the product.

**Acceptance Scenarios**:

1. **Given** a new-product form, **When** I save unused `AbC001` with valid other fields,
   **Then** it is saved and displayed exactly as `AbC001`.
2. **Given** unused manufacturer value `0012345678905`, **When** I save and reopen it,
   **Then** the leading zeros remain intact in both form and list.
3. **Given** an empty or whitespace-only new code, **When** I save, **Then** the product is
   not created and a clear Product Code required message appears.
4. **Given** punctuation, embedded whitespace, or an over-limit value, **When** I save,
   **Then** a character/length error explains the correction and preserves my other entries.

---

### User Story 2 - Generate an internal code (Priority: P2)

As a product manager without a manufacturer code, I can use Generate beside the single
Product Code input to obtain an internal identifier without another tool.

**Why this priority**: Generation removes the need to invent numeric identifiers manually.

**Independent Test**: Generate, verify length/checksum, save, and reopen the product.

**Acceptance Scenarios**:

1. **Given** a product form, **When** I select Generate, **Then** its single code input receives
   exactly 13 digits: prefix `20`, ten digits in the agreed range, and a valid EAN-13 check digit.
2. **Given** a generated code, **When** I save and reopen, **Then** the chosen value is retained.
3. **Given** generation fails or its range is exhausted, **When** I select Generate, **Then**
   an actionable error appears, previous entries remain, and saved product data is unchanged.
4. **Given** the generation control, **When** I read its guidance, **Then** it explains internal
   MyKasir use only and that generated codes are not GS1-assigned GTINs or globally unique IDs.
5. **Given** an unsaved generated code, **When** I cancel, **Then** no product is created or
   updated. Generation alone does not save a product.
6. **Given** a newly opened create/edit form, **When** I have not clicked Generate, **Then**
   no code is automatically generated and any existing code remains unchanged.
7. **Given** populated Product Code input, **When** I click Generate, **Then** replacement
   requires confirmation; declining retains the current value, while confirming allows generation
   to replace it only in the unsaved form. A generation failure retains the previous input.

---

### User Story 3 - Correct a code without duplicates (Priority: P1)

As a product manager, I can change a code while preserving product identity and sales history.

**Why this priority**: Codes must remain editable and unambiguous throughout their lifecycle.

**Independent Test**: Edit one coded product, attempt a duplicate, and inspect both products.

**Acceptance Scenarios**:

1. **Given** a coded product, **When** I save a valid unused replacement, **Then** its form/list
   show the new value and its identity, stock, and historical transaction snapshots stay unchanged.
2. **Given** its existing unchanged code, **When** I save other fields, **Then** it does not
   conflict with itself.
3. **Given** another product owns the requested code, **When** I create or edit with that value,
   **Then** saving fails with "Product code is already in use" and preserves my form entries.
4. **Given** two different products being saved simultaneously with the same unused code,
   **When** both saves finish,
   **Then** only one acquires it and the other receives the duplicate-code error.
5. **Given** a coded product, **When** I clear its code and save, **Then** a required-code error
   prevents the change. Canceling an edit preserves its saved code.

---

### User Story 4 - Continue using legacy products (Priority: P1)

As an existing user, I can keep using products created before codes were introduced.

**Why this priority**: Rollout must not disrupt current products or sales history.

**Independent Test**: List, view, edit, and transact with a pre-feature product after rollout.

**Acceptance Scenarios**:

1. **Given** pre-feature products, **When** codes become available, **Then** their identities,
   names, categories, prices, stock, and transaction references remain unchanged.
2. **Given** a legacy product, **When** I use it in a transaction, **Then** its code status does
   not block use or alter historical item names/prices.
3. **Given** an uncoded legacy product, **When** it is listed after rollout, **Then** its
   Product Code reads "Not assigned"; rollout does not automatically generate a code.
4. **Given** an uncoded legacy product, **When** I edit any field and save without a code,
   **Then** saving fails with a Product Code required message and retains my form entries.
5. **Given** an uncoded legacy product, **When** I supply a valid, unique manual or generated
   code and save, **Then** the edit succeeds and future edits retain the required-code rule.
6. **Given** an uncoded legacy product, **When** I supply a duplicate code during an edit,
   **Then** the entire save fails with the duplicate-code error and existing data is unchanged.
7. **Given** my guarded legacy edit changes no record and another request assigns its code before
   the follow-up lookup, **When** that lookup finds the now-coded product, **Then** my edit returns
   HTTP 409 Conflict with "Product Code was assigned by another request. Refresh and retry manually.",
   makes no further save attempt, preserves my form entries, and leaves concurrent changes intact.

### Edge Cases

- Preserve leading zeros and case; numeric-looking codes are strings, not quantities.
- Trim outer whitespace; reject embedded whitespace, punctuation, and non-ASCII letters.
- Accept manual manufacturer values of different lengths without imposing an EAN-13 checksum.
- Handle concurrent creates/edits and generated values colliding with manually entered codes.
- Saving unchanged codes excludes the same product from duplicate detection.
- Failed generation/save preserves form entries and previously saved data.
- A guarded legacy edit with no updated record followed by a now-coded active record returns a
  refresh-and-retry conflict, not a missing-product or required-code error; no automatic retry occurs.
- Repeated generation or a late result must not overwrite a subsequent manual edit or another
  product's form. Switching products must not carry over an unsaved code.
- Soft-deleted products reserve their current codes under the uniqueness rule.
- Legacy products need no code for viewing or transactions, but any successful edit requires one.
  Omitting the code cannot bypass this requirement.
  A failed edit must not modify the product and must preserve any changes committed by concurrent requests, including Product Code assignments.
- Clearing an assigned code is rejected; canceling generation or an edit changes no saved product.
  Exhausted generation allows manual entry of a valid unused code.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every newly saved product MUST have exactly one non-empty unique Product Code.
- **FR-002**: Create/edit forms MUST provide one Product Code input and a Generate button;
  users MUST be able to enter manual values and edit existing codes.
- **FR-003**: Codes MUST be stored and handled as strings with leading zeros and case preserved.
  Validation MUST trim outer whitespace and accept 1–100 ASCII letters/digits only.
- **FR-004**: Uniqueness MUST compare trimmed codes case-insensitively across all products,
  including soft-deleted products, excluding the same product during edits. Changed-away codes
  may be reused; aliases and a code-history registry are outside scope.
- **FR-005**: Duplicates MUST prevent the entire save with "Product code is already in use",
  including simultaneous save conflicts, without losing form entries.
- **FR-006**: Generated codes MUST contain exactly 13 decimal digits and a valid EAN-13 check
  digit: alternating weights 1 and 3 on the first 12 digits from the left, plus the final digit,
  MUST sum to a multiple of 10. Manual codes MUST NOT require that length or checksum.
- **FR-007**: Generation MUST occur only when the user clicks Generate, never automatically
  when opening a form. If Product Code is populated, Generate MUST request confirmation before
  replacing it; declining MUST preserve the current input. Manual replacement remains allowed.
  Coded products MUST NOT be saved with a cleared code. Code changes take effect only on Save.
- **FR-008**: Generated codes MUST use the fixed prefix `20`, followed by a ten-digit value
  from `0000000000` through `9999999999`, followed by the calculated EAN-13 check digit.
  This range is exclusively for internal MyKasir identification and makes no claim of GS1
  assignment, global uniqueness, or external circulation. Manual codes are not restricted to
  this generation range.
- **FR-009**: Generation MUST avoid currently assigned values. If a competing save claims a
  candidate before this product saves, show the duplicate error and allow another Generate.
  Generation failure or range exhaustion MUST leave previous input intact. Gap-free numbering
  and reservation of unsaved values are not required.
- **FR-010**: Generation guidance MUST explain internal-only use and that generated values are
  not GS1-assigned GTINs; no global uniqueness or manufacturer identity claim is permitted.
- **FR-011**: Product management MUST show a Product Code column and prefill saved codes on
  edit. Uncoded legacy products MUST show "Not assigned".
- **FR-012**: Legacy products MUST retain unassigned codes at rollout; no automatic code
  backfill is required. They MUST remain listable, viewable, and usable in transactions without
  code assignment. Their next successful product edit MUST assign a valid, unique code, even
  if the intended edit concerns only another field. Saving an edit without a code MUST fail
  with a Product Code required message and preserve form entries. Existing identities, other
  business fields, and historical references MUST remain compatible; assigning a code alone
  MUST NOT change them.
- **FR-013**: Editing codes MUST NOT change product identity, stock, or historical snapshots.
  Omitting the code from an unrelated edit MUST preserve an already assigned value. An uncoded
  legacy product MUST receive a valid, unique code before any edit can save. A coded product
  MUST NOT be saved with a cleared code.
- **FR-014**: Existing product permissions MUST remain unchanged. The feature MUST NOT add
  scanners, barcode images/printing, stock changes, code search, bulk assignment screens,
  aliases, external GS1 registration, or a new authorization policy.

- **FR-015**: When a guarded legacy update affects zero rows and the follow-up lookup finds an
  active product that has since received a code, the system MUST return HTTP 409 Conflict with
  "Product Code was assigned by another request. Refresh and retry manually.". The server and client
  MUST NOT automatically retry the save or overwrite concurrent changes. The client MUST preserve
  entered values, show refresh-and-manual-retry guidance, and wait for user action. An active
  still-uncoded product remains a required-code 400; a missing/deleted product remains 404.

### Key Entities *(include if feature involves data)*

- **Product**: Existing sellable item with stable identity, name, category, price, stock, and
  lifecycle status; code supplements rather than replaces identity.
- **Product Code**: Current string identifier, entered manually or generated in the same field.
  Each coded product has one value; generation does not add a second identifier.
- **Legacy Product**: Product created before rollout; initially uncoded, with assignment
  mandatory on its next successful edit. Viewing and transactions do not trigger assignment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful new-product saves have non-empty codes unique under the agreed
  comparison rule; competing saves never create duplicate ownership.
- **SC-002**: Every generated value in acceptance testing has 13 digits, passes the checksum,
  and matches prefix `20` plus a ten-digit value and its check digit.
- **SC-003**: All accepted manual samples, including mixed-case and leading-zero values, survive
  save, reload, and display unchanged except for outer trimming.
- **SC-004**: Users can fill an empty code input with one Generate action and save without
  copying from another tool; replacing populated input requires confirmation, and manual entry
  remains available in the same field.
- **SC-005**: Every duplicate acceptance case produces the specified error, preserves form
  entries, and leaves saved data unchanged.
- **SC-006**: All pre-feature products remain usable after rollout with unchanged identities,
  non-code business fields, and historical snapshots. All uncoded-legacy edit acceptance cases
  reject saving until a valid, unique code is supplied.
- **SC-007**: Users can correct a code, save, and see the replacement in the list and edit form
  without changing stock or creating a second product.

## Assumptions

- Existing product users and permissions are reused, consistent with the project constitution.
  Current UI restrictions must not be mistaken for a new server authorization policy.
- Defaults retained from the draft: 1–100 ASCII letters/digits, outer trimming, case-preserving
  storage with case-insensitive uniqueness, soft-deleted current codes reserved, and changed-away
  codes reusable. No alias/history registry is required.
- Manual manufacturer values are identifier text; ownership, symbology, and registration are
  not certified. Only generated values guarantee the EAN-13 checksum.
- Generation does not reserve values until a successful save; unused values and numbering gaps
  are acceptable. Legacy codes remain unassigned at rollout and become required on the next
  edit; viewing and transactions remain available. The internal namespace is fixed by FR-008.
- This specification does not authorize source changes or execution of data migrations.
- Checksum reference: [GS1 check digit calculator](https://www.gs1.org/services/check-digit-calculator).
  Restricted-circulation identifiers differ from GTINs; see the
  [GS1 restricted-circulation summary](https://www.gs1.org/docs/barcodes/SummaryOfGS1MOPrefixes20-29.pdf).
  The selected range is a local business choice, not an assertion of GS1 allocation or approval.
