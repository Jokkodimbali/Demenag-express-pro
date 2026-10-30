ALTER TABLE "demenag"."users"
  ADD COLUMN "email" TEXT;

CREATE UNIQUE INDEX "users_email_key"
  ON "demenag"."users"("email");
