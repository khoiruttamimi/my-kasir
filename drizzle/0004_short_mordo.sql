-- Keep counters longer than six digits intact: plain lpad would truncate them.
CREATE FUNCTION "public"."format_transaction_invoice_counter"(counter bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN length(counter::text) <= 6 THEN lpad(counter::text, 6, '0')
    ELSE counter::text
  END
$$;
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "invoice_number" SET DEFAULT 'INV-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD') || '-' || format_transaction_invoice_counter(nextval('transaction_invoice_seq'));