CREATE TABLE "demenag"."admin_quote_drafts" (
  "user_id" UUID NOT NULL,
  "data" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_quote_drafts_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "admin_quote_drafts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "demenag"."users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
