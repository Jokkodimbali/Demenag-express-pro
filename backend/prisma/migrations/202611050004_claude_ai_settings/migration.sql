CREATE TABLE "demenag"."claude_configuration" (
  "id" TEXT NOT NULL DEFAULT 'main',
  "encrypted_key" TEXT NOT NULL,
  "iv" TEXT NOT NULL,
  "auth_tag" TEXT NOT NULL,
  "model" TEXT NOT NULL DEFAULT '',
  "models" JSONB NOT NULL DEFAULT '[]',
  CONSTRAINT "claude_configuration_pkey" PRIMARY KEY ("id")
);
