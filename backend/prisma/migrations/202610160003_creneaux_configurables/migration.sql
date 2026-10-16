ALTER TABLE "demenag"."settings" ADD COLUMN "enabled_slots_json" jsonb;

UPDATE "demenag"."settings"
SET "enabled_slots_json" = (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'label', slot,
        'startHour', CASE slot
          WHEN 'Matin (8h – 12h)' THEN 8
          WHEN 'Après-midi (13h – 17h)' THEN 13
          WHEN 'Soir (17h – 20h)' THEN 17
          ELSE 0
        END
      )
    ),
    '[]'::jsonb
  )
  FROM unnest("enabled_slots") AS slot
);

ALTER TABLE "demenag"."settings" DROP COLUMN "enabled_slots";
ALTER TABLE "demenag"."settings" RENAME COLUMN "enabled_slots_json" TO "enabled_slots";
ALTER TABLE "demenag"."settings" ALTER COLUMN "enabled_slots" SET NOT NULL;
