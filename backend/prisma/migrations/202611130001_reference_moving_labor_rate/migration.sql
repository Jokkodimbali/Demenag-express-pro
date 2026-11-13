ALTER TABLE demenag.settings
  ALTER COLUMN moving_labor_planning SET DEFAULT
    '{"maxHandlingHours":3,"maxDayHours":8,"defaultStartHour":8,"maxMoversPerVehicle":6,"cubicMetersPerHourPerMover":2.7,"pauseMinutes":30}'::jsonb;

UPDATE demenag.settings
SET moving_labor_planning = jsonb_set(
  moving_labor_planning,
  '{cubicMetersPerHourPerMover}',
  '2.7'::jsonb
)
WHERE moving_labor_planning =
  '{"maxHandlingHours":3,"maxDayHours":8,"defaultStartHour":8,"maxMoversPerVehicle":6,"cubicMetersPerHourPerMover":2.5,"pauseMinutes":30}'::jsonb;
