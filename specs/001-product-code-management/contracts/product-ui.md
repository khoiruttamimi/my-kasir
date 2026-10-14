# Product Management UI Contract

Extend `modal-product-form.tsx` and the Product list using the existing Ant Design/React Query
patterns. One input, labeled Product Code, supports both manual and generated values.

## Form behavior

- Opening Create initializes empty code; opening Edit loads the selected value (legacy null
  becomes empty). Never generate automatically. Reset previous unsaved fields/errors/request
  identity on open, close, or switching products; title correctly distinguishes Add/Edit.
- Product Code is required in both forms, including edits of uncoded legacy products. Explain
  the legacy requirement when editing an uncoded product. Preserve case/leading zeros.
- Generate is a non-submit button. If trimmed input is nonempty, use existing App modal
  confirmation before requesting replacement. Decline leaves input intact and makes no request.
- On confirmation/click with empty input, invoke the generation mutation. Show pending state,
  disable repeat Generate and form submission while it is in progress. Existing input stays
  visible until a successful result. Avoid changing Product query caches for generation alone.
- Manual entry can supersede an outstanding generation request: record edit revision, request
  identity, and form/product identity; apply the response only if all still match. Ignore a late
  result after manual edit, cancellation, another request, or switching products. Close/unmount
  invalidates the request identity. Do not let an earlier promise clear a newer pending state.
- Generation failure leaves prior entries intact and shows the documented message. Save is the
  only operation that creates/updates Product. Cancellation makes no Product save.
- Required/character/length errors appear on Product Code. The duplicate-code 409 message
  identifies that field and preserves all entries. The distinct concurrent-assignment 409 message
  "Product Code was assigned by another request. Refresh and retry manually." is form-level guidance:
  retain entries and require explicit user refresh/manual retry; do not auto-retry, auto-submit,
  or label every 409 as a duplicate. On success follow existing close/reset/cache invalidation.
- Keep internal-only guidance adjacent to Generate: "Generated codes are for internal MyKasir
  use only and are not GS1-assigned GTINs." Do not present a second barcode value or global claim.
- Preserve existing form layout, theme, field labels, management permissions, and price/stock
  behavior. Input/button are keyboard accessible with visible labels and confirmation actions.

## List

Add a Product Code column using exact saved string values; null displays "Not assigned". Reuse
current pagination and query keys. Keep existing name-only search; code search is outside scope.
Reopening after create/edit must show the saved value; ordinary transaction history is unchanged.

## Type boundaries

Read model: `code: string | null`. Form/create payload: required string. Update payload: typed
partial business fields plus ID, with code optional only for non-form partial edits of coded
products. Do not pass timestamps or read-null codes as create/update form values.
