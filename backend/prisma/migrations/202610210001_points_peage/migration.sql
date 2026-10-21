CREATE TABLE "demenag"."toll_points" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "operator" TEXT NOT NULL,
  "heavy_price" INTEGER NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "toll_points_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "toll_points_heavy_price_check" CHECK ("heavy_price" > 0),
  CONSTRAINT "toll_points_coordinates_check" CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" BETWEEN 12 AND 17 AND "longitude" BETWEEN -18.5 AND -11))
);

CREATE UNIQUE INDEX "toll_points_operator_name_key" ON "demenag"."toll_points"("operator", "name");

INSERT INTO "demenag"."toll_points" ("id", "name", "operator", "heavy_price") VALUES
  (gen_random_uuid(), 'Bretelles de Pikine (Nord et Sud)', 'SECAA', 1000),
  (gen_random_uuid(), 'Bretelles de Thiaroye (Nord et Sud)', 'SECAA', 1000),
  (gen_random_uuid(), 'Péage de Thiaroye', 'SECAA', 2000),
  (gen_random_uuid(), 'Bretelles de Keur Massar (Nord et Sud)', 'SECAA', 400),
  (gen_random_uuid(), 'Péage de Rufisque', 'SECAA', 700),
  (gen_random_uuid(), 'Bretelles de Rufisque (Nord et Sud)', 'SECAA', 400),
  (gen_random_uuid(), 'Bretelles de Sébikotane (Nord et Sud)', 'SECAA', 1000),
  (gen_random_uuid(), 'Péage de Toglou', 'SECAA', 1200),
  (gen_random_uuid(), 'Pont à péage Nelson Mandela · Foundiougne', 'AGEROUTE', 15000),
  (gen_random_uuid(), 'Pont de Marsassoum', 'AGEROUTE', 15000);
