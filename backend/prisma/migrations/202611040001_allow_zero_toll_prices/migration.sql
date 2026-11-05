ALTER TABLE "demenag"."toll_points"
  DROP CONSTRAINT "toll_points_heavy_price_check",
  ADD CONSTRAINT "toll_points_heavy_price_check" CHECK ("heavy_price" >= 0);
