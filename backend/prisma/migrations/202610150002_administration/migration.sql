-- AlterTable
ALTER TABLE "demenag"."users" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "demenag"."vehicles" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "demenag"."settings" ADD COLUMN     "bookings_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cancellation_notice_hours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "client_cancellation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "distance_bounds" INTEGER[] DEFAULT ARRAY[15, 25, 35]::INTEGER[],
ADD COLUMN     "enabled_slots" TEXT[] DEFAULT ARRAY['Matin (8h – 12h)', 'Après-midi (13h – 17h)', 'Soir (17h – 20h)']::TEXT[],
ADD COLUMN     "max_advance_days" INTEGER NOT NULL DEFAULT 366,
ADD COLUMN     "max_options" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "max_trips" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "min_notice_hours" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "demenag"."devis" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "montant_total" INTEGER,
    "remise" INTEGER NOT NULL,
    "nombre_trajets" INTEGER NOT NULL,
    "tranche" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,
    "cree_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demenag"."lignes_devis" (
    "id" UUID NOT NULL,
    "devis_id" UUID NOT NULL,
    "libelle" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prix_unitaire" INTEGER NOT NULL,
    "montant" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "lignes_devis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devis_reference_key" ON "demenag"."devis"("reference");

-- CreateIndex
CREATE INDEX "devis_reservation_id_cree_le_idx" ON "demenag"."devis"("reservation_id", "cree_le");

-- CreateIndex
CREATE UNIQUE INDEX "lignes_devis_devis_id_position_key" ON "demenag"."lignes_devis"("devis_id", "position");

-- AddForeignKey
ALTER TABLE "demenag"."devis" ADD CONSTRAINT "devis_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "demenag"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demenag"."lignes_devis" ADD CONSTRAINT "lignes_devis_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "demenag"."devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Conservation des devis précédemment stockés dans l'instantané JSON.
INSERT INTO "demenag"."devis" (id, reservation_id, reference, nature, montant_total, remise, nombre_trajets, tranche, notes, cree_le)
SELECT (q->>'id')::uuid, b.id, q->>'reference',
  CASE WHEN q->>'kind' = 'final' THEN 'definitif' ELSE 'provisoire' END,
  (q->'price'->>'total')::integer, (q->'price'->>'discount')::integer,
  (q->'price'->>'trips')::integer, (q->'price'->>'tier')::integer,
  q->>'notes', (q->>'createdAt')::timestamptz
FROM "demenag"."bookings" b CROSS JOIN LATERAL jsonb_array_elements(COALESCE(b.data->'quotes', '[]'::jsonb)) q;
INSERT INTO "demenag"."lignes_devis" (id, devis_id, libelle, quantite, prix_unitaire, montant, position)
SELECT gen_random_uuid(), (q->>'id')::uuid, l.value->>'label', (l.value->>'quantity')::integer,
  (l.value->>'unitPrice')::integer, (l.value->>'total')::integer, (l.ordinality - 1)::integer
FROM "demenag"."bookings" b CROSS JOIN LATERAL jsonb_array_elements(COALESCE(b.data->'quotes', '[]'::jsonb)) q
CROSS JOIN LATERAL jsonb_array_elements(q->'price'->'lines') WITH ORDINALITY l;

ALTER TABLE "demenag"."settings" ADD CONSTRAINT "settings_booking_rules_check" CHECK (
  max_advance_days BETWEEN 1 AND 730 AND min_notice_hours BETWEEN 0 AND 720
  AND max_options BETWEEN 0 AND 20 AND max_trips BETWEEN 1 AND 20
  AND cancellation_notice_hours BETWEEN 0 AND 720
  AND cardinality(distance_bounds) = 3 AND distance_bounds[1] > 0
  AND distance_bounds[1] < distance_bounds[2] AND distance_bounds[2] < distance_bounds[3]
  AND distance_bounds[3] <= 1000 AND cardinality(enabled_slots) BETWEEN 1 AND 3
);
ALTER TABLE "demenag"."devis" ADD CONSTRAINT "devis_montants_check" CHECK (
  nature IN ('provisoire', 'definitif') AND (montant_total IS NULL OR montant_total >= 0)
  AND (nature <> 'definitif' OR montant_total IS NOT NULL) AND remise >= 0 AND nombre_trajets > 0 AND tranche BETWEEN 0 AND 3
);
ALTER TABLE "demenag"."lignes_devis" ADD CONSTRAINT "lignes_devis_montants_check" CHECK (
  quantite > 0 AND prix_unitaire >= 0 AND montant = quantite * prix_unitaire AND position >= 0
);
