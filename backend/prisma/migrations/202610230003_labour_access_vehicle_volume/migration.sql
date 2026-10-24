ALTER TABLE demenag.settings
  ADD COLUMN IF NOT EXISTS labour_floor_price INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS labour_lift_price INTEGER NOT NULL DEFAULT 500;

UPDATE demenag.vehicles
SET volume = to_char(
  round(
    greatest(
      0,
      (
        replace(regexp_replace(length, '[^0-9,.-]', '', 'g'), ',', '.')::numeric
        * replace(regexp_replace(height, '[^0-9,.-]', '', 'g'), ',', '.')::numeric
        * replace(regexp_replace(width, '[^0-9,.-]', '', 'g'), ',', '.')::numeric
        - greatest(
            0,
            replace(regexp_replace(width, '[^0-9,.-]', '', 'g'), ',', '.')::numeric
              - replace(regexp_replace(wheel_width, '[^0-9,.-]', '', 'g'), ',', '.')::numeric
          ) * 0.30 * least(
            replace(regexp_replace(length, '[^0-9,.-]', '', 'g'), ',', '.')::numeric,
            1.90
          )
      ) * 0.95
    ) * 10
  ) / 10,
  'FM999990D0'
) || ' m³';
