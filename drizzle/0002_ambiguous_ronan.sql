CREATE TABLE "transaction_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"price" integer NOT NULL,
	"quantity" integer NOT NULL,
	"subtotal" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "transaction_items_transaction_position_unique" UNIQUE("transaction_id","position"),
	CONSTRAINT "transaction_items_amounts_check" CHECK ("transaction_items"."price" >= 0 and "transaction_items"."quantity" > 0 and "transaction_items"."subtotal" = "transaction_items"."price"::bigint * "transaction_items"."quantity" and "transaction_items"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(100) NOT NULL,
	"subtotal" integer NOT NULL,
	"total" integer NOT NULL,
	"payment_method" varchar(10) NOT NULL,
	"paid_amount" integer NOT NULL,
	"change_amount" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"user_name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "transactions_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "transactions_payment_method_check" CHECK ("transactions"."payment_method" in ('cash', 'qris')),
	CONSTRAINT "transactions_amounts_check" CHECK ("transactions"."subtotal" >= 0 and "transactions"."total" = "transactions"."subtotal" and "transactions"."paid_amount" >= "transactions"."total" and "transactions"."change_amount" = "transactions"."paid_amount" - "transactions"."total")
);
--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaction_items_product_id_idx" ON "transaction_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");