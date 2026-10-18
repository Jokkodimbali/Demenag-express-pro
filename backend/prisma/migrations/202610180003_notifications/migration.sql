CREATE TABLE "demenag"."notifications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "booking_id" UUID,
  "read_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "demenag"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "demenag"."notifications"("user_id", "read_at", "created_at");
