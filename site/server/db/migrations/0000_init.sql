CREATE TYPE "public"."asset_status" AS ENUM('processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('review', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."recognition_status" AS ENUM('pending', 'running', 'complete', 'unavailable', 'failed');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('new', 'saved', 'dismissed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"operation" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 5) DEFAULT '0' NOT NULL,
	"success" boolean NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"queries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"products_found" integer DEFAULT 0 NOT NULL,
	"recommendations_created" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"original_name" text,
	"display_key" text,
	"thumb_key" text,
	"width" integer,
	"height" integer,
	"byte_size" integer,
	"sha256" text NOT NULL,
	"status" "asset_status" DEFAULT 'processing' NOT NULL,
	"recognition_status" "recognition_status" DEFAULT 'pending' NOT NULL,
	"recognition_attempts" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_status" (
	"integration" text PRIMARY KEY NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outfit_items" (
	"outfit_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"role" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "outfit_items_outfit_id_item_id_pk" PRIMARY KEY("outfit_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "outfit_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"outfit_id" uuid NOT NULL,
	"date" date NOT NULL,
	"occasion" text,
	"note" text,
	"worn" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outfits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"request_id" uuid,
	"title" text NOT NULL,
	"occasion" text,
	"style" text,
	"explanation" text NOT NULL,
	"factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"explanation_source" text NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"saved" boolean DEFAULT false NOT NULL,
	"saved_at" timestamp with time zone,
	"feedback" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"run_id" uuid,
	"score" real NOT NULL,
	"reasons" jsonb NOT NULL,
	"pairs_with" uuid[] DEFAULT '{}' NOT NULL,
	"pair_count" integer DEFAULT 0 NOT NULL,
	"gap_category" text,
	"query" text,
	"status" "recommendation_status" DEFAULT 'new' NOT NULL,
	"saved_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"brand" text,
	"retailer" text,
	"image_url" text,
	"product_url" text NOT NULL,
	"price_amount" numeric(12, 2),
	"currency" text,
	"category" text,
	"subcategory" text,
	"colors" text[] DEFAULT '{}' NOT NULL,
	"styles" text[] DEFAULT '{}' NOT NULL,
	"pattern" text,
	"formality" smallint,
	"sizes" text[] DEFAULT '{}' NOT NULL,
	"condition" text,
	"availability" text DEFAULT 'unknown' NOT NULL,
	"attributes_source" text DEFAULT 'listing' NOT NULL,
	"attribution" text NOT NULL,
	"last_verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"image_consent_at" timestamp with time zone,
	"consent_version" text,
	"department" text DEFAULT 'any' NOT NULL,
	"preferred_styles" text[] DEFAULT '{}' NOT NULL,
	"favorite_colors" text[] DEFAULT '{}' NOT NULL,
	"avoid_colors" text[] DEFAULT '{}' NOT NULL,
	"occasions" text[] DEFAULT '{}' NOT NULL,
	"fits" text[] DEFAULT '{}' NOT NULL,
	"budget_min" integer,
	"budget_max" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"preferred_brands" text[] DEFAULT '{}' NOT NULL,
	"location_name" text,
	"latitude" real,
	"longitude" real,
	"temperature_unit" text DEFAULT 'C' NOT NULL,
	"notify_discoveries_email" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "styling_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"params" jsonb NOT NULL,
	"params_hash" text NOT NULL,
	"weather" jsonb,
	"status" text NOT NULL,
	"message" text,
	"candidate_count" integer DEFAULT 0 NOT NULL,
	"ai_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wardrobe_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"image_asset_id" uuid,
	"crop" jsonb,
	"image_key" text,
	"thumb_key" text,
	"status" "item_status" DEFAULT 'review' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"category" text,
	"subcategory" text,
	"colors" text[] DEFAULT '{}' NOT NULL,
	"color_names" text[] DEFAULT '{}' NOT NULL,
	"pattern" text DEFAULT 'solid' NOT NULL,
	"material_estimate" text,
	"styles" text[] DEFAULT '{}' NOT NULL,
	"occasions" text[] DEFAULT '{}' NOT NULL,
	"seasons" text[] DEFAULT '{}' NOT NULL,
	"formality" smallint DEFAULT 2 NOT NULL,
	"warmth" smallint DEFAULT 2 NOT NULL,
	"details" text[] DEFAULT '{}' NOT NULL,
	"brand" text,
	"notes" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"exclude_from_styling" boolean DEFAULT false NOT NULL,
	"ai_attributes" jsonb,
	"ai_confidence" real,
	"user_edited_fields" text[] DEFAULT '{}' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_runs" ADD CONSTRAINT "discovery_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outfit_items" ADD CONSTRAINT "outfit_items_outfit_id_outfits_id_fk" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outfit_items" ADD CONSTRAINT "outfit_items_item_id_wardrobe_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."wardrobe_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outfit_plans" ADD CONSTRAINT "outfit_plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outfit_plans" ADD CONSTRAINT "outfit_plans_outfit_id_outfits_id_fk" FOREIGN KEY ("outfit_id") REFERENCES "public"."outfits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outfits" ADD CONSTRAINT "outfits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outfits" ADD CONSTRAINT "outfits_request_id_styling_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."styling_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recommendations" ADD CONSTRAINT "product_recommendations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recommendations" ADD CONSTRAINT "product_recommendations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "styling_requests" ADD CONSTRAINT "styling_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wardrobe_items" ADD CONSTRAINT "wardrobe_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wardrobe_items" ADD CONSTRAINT "wardrobe_items_image_asset_id_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_user_idx" ON "ai_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "runs_user_created_idx" ON "discovery_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "assets_user_created_idx" ON "image_assets" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_user_sha_idx" ON "image_assets" USING btree ("user_id","sha256");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notification_deliveries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "outfit_items_item_idx" ON "outfit_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "plans_user_date_idx" ON "outfit_plans" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "outfits_user_saved_idx" ON "outfits" USING btree ("user_id","saved","saved_at");--> statement-breakpoint
CREATE INDEX "outfits_request_idx" ON "outfits" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recs_user_product_idx" ON "product_recommendations" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "recs_user_status_idx" ON "product_recommendations" USING btree ("user_id","status","score");--> statement-breakpoint
CREATE UNIQUE INDEX "products_provider_external_idx" ON "products" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "styling_user_hash_idx" ON "styling_requests" USING btree ("user_id","params_hash","created_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "items_user_status_idx" ON "wardrobe_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "items_user_category_idx" ON "wardrobe_items" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "items_asset_idx" ON "wardrobe_items" USING btree ("image_asset_id");