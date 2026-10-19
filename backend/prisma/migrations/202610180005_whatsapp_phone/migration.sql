ALTER TABLE demenag.settings
  ADD COLUMN whatsapp_phone TEXT NOT NULL DEFAULT '+221775105104';

UPDATE demenag.settings
SET whatsapp_phone = business_phone;
