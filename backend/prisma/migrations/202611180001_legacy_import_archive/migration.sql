CREATE TABLE "demenag"."legacy_import_archives" (
  "id" VARCHAR(64) NOT NULL,
  "source" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_import_archives_pkey" PRIMARY KEY ("id")
);
