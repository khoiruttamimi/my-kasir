CREATE SEQUENCE "public"."product_code_seq" INCREMENT BY 1 MINVALUE 0 MAXVALUE 9999999999 START WITH 0 CACHE 1;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "code" varchar(100);--> statement-breakpoint
CREATE UNIQUE INDEX "products_code_unique" ON "products" USING btree (lower("code"));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_code_format_check" CHECK ("products"."code" is null or "products"."code" ~ '^[A-Za-z0-9]{1,100}$');