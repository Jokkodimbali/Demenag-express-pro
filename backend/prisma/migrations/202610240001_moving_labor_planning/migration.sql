ALTER TABLE demenag.settings
  ADD COLUMN IF NOT EXISTS moving_labor_planning JSONB NOT NULL DEFAULT
    '{"maxHandlingHours":3,"maxDayHours":8,"defaultStartHour":8,"maxMoversPerVehicle":6,"cubicMetersPerHourPerMover":2.5,"pauseMinutes":30}'::jsonb;
