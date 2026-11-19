import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { tsImport } from 'tsx/esm/api';
import { legacyQuotePrice } from './legacy-quote-lines.mjs';

const { Client } = pg;
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const replay = args.includes('--replay');
const replaceTolls = args.includes('--replace-tolls');
const fileArg = args.find((value) => !value.startsWith('--'));
const file = fileArg || process.env.LEGACY_BACKUP_PATH;

if (!file) {
  console.error('Usage: node scripts/import-desktop-backup.mjs <fichier.json> [--apply]');
  process.exit(2);
}

const raw = await readFile(file, 'utf8');
const backup = JSON.parse(raw);
if (backup.app !== 'Demenag Express' || backup.version !== 1 || !backup.data) {
  throw new Error('Le fichier ne correspond pas à une sauvegarde Demenag Express v1.');
}

const data = backup.data;
const activeBookings = Array.isArray(data.res) ? data.res : [];
const trash = Array.isArray(data.corbeille) ? data.corbeille : [];
const removedBookings = trash
  .filter((entry) => entry.col === 'res' && entry.item)
  .map((entry) => ({ ...entry.item, __deletedAt: entry.at }));
const journal = [
  ...(Array.isArray(data.journal) ? data.journal.map((entry) => ({ ...entry })) : []),
  ...trash
    .filter((entry) => entry.col === 'journal' && entry.item)
    .map((entry) => ({ ...entry.item, __voidedAt: entry.at })),
];
const reservations = [...activeBookings, ...removedBookings];
const sha256 = createHash('sha256').update(raw).digest('hex');

const summary = {
  source: path.basename(file),
  sha256,
  activeReservations: activeBookings.length,
  deletedReservations: removedBookings.length,
  clients: Array.isArray(data.clients) ? data.clients.length : 0,
  staff: Array.isArray(data.staff) ? data.staff.length : 0,
  tollPoints: Array.isArray(data.peages) ? data.peages.length : 0,
  accountingEntries: journal.length,
  duplicateReservationIds: reservations.length - new Set(reservations.map((row) => row.id)).size,
  duplicateReservationReferences:
    reservations.length - new Set(reservations.map((row) => row.ref)).size,
  reservationsWithoutGps: reservations.filter(
    (row) => !validPoint(row.fromLL) || !validPoint(row.toLL),
  ).length,
  reservationsWithoutValidPhone: reservations.filter((row) => !phoneDigits(row.phone)).length,
  staffWithRepeatedPhone:
    (data.staff || []).length -
    new Set(
      (data.staff || []).map((row) => phoneDigits(row.phone) || String(row.phone || '').trim()),
    ).size,
};

function validPoint(value) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
}

if (!apply) {
  console.log(JSON.stringify({ mode: 'dry-run', ...summary }, null, 2));
  process.exit(0);
}

const { missingLegacyInventoryPatch } = await tsImport(
  './legacy-booking-inventory.mjs',
  import.meta.url,
);

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED ou DATABASE_URL est requis.');
const db = new Client({ connectionString, connectionTimeoutMillis: 15000 });

function uuidFor(value) {
  const bytes = createHash('sha256').update(`demenag-legacy:${value}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function phoneDigits(value) {
  let compact = String(value ?? '')
    .trim()
    .replace(/[\s().-]/g, '');
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;
  if (!compact.startsWith('+') && /^(70|71|75|76|77|78)\d{7}$/.test(compact))
    compact = `+221${compact}`;
  if (!compact.startsWith('+') && /^221\d{9}$/.test(compact)) compact = `+${compact}`;
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

function point(value) {
  return validPoint(value) ? value.map(Number) : [0, 0];
}

function dateValue(value, fallback = null) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function bookingCreatedAt(row) {
  const match = /^r(\d{13})$/u.exec(String(row.id ?? ''));
  if (match) {
    const date = new Date(Number(match[1]));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return dateValue(row.devis?.sentAt, backup.savedAt || new Date().toISOString());
}

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function distanceFrom(value) {
  const distance = Number(
    String(value ?? '')
      .replace(/[^\d,.-]/gu, '')
      .replace(',', '.'),
  );
  return Number.isFinite(distance) ? Math.max(0, distance) : 0;
}

function price(total, trips, tier, discount, label) {
  const amount = total == null ? null : integer(total);
  return {
    lines: amount == null ? [] : [{ label, quantity: 1, unitPrice: amount, total: amount }],
    total: amount,
    discount: Math.max(0, integer(discount)),
    trips: Math.max(0, integer(trips)),
    tier: Math.max(0, integer(tier)),
    currency: 'XOF',
  };
}

function dateOnly(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})/u.exec(value.trim());
  return match?.[1] ?? null;
}

function statusOf(value) {
  if (value === 'termine') return 'completed';
  if (value === 'annule') return 'cancelled';
  if (value === 'confirme') return 'confirmed';
  return 'pending';
}

function vehicleIdOf(value) {
  const key = String(value ?? '').toLowerCase();
  if (key.includes('trafic')) return 'trafic';
  if (key.includes('master')) return 'master';
  return 'sprinter';
}

function json(value) {
  return JSON.stringify(value ?? null);
}

async function ensureUser(client, value, existingByPhone) {
  const normalized = phoneDigits(value.phone);
  const mapKey = normalized || `invalid:${String(value.phone ?? '').trim()}`;
  const existing = existingByPhone.get(mapKey);
  if (existing) return existing.id;
  const stableId = uuidFor(`user:${mapKey}`);
  const stableUser = await client.query('SELECT id, phone FROM demenag.users WHERE id = $1::uuid', [
    stableId,
  ]);
  if (stableUser.rows[0]) {
    existingByPhone.set(mapKey, stableUser.rows[0]);
    return stableUser.rows[0].id;
  }

  let phone = normalized;
  if (!phone) {
    const seed = parseInt(
      createHash('sha256')
        .update(mapKey || value.id)
        .digest('hex')
        .slice(0, 7),
      16,
    );
    for (let offset = 0; offset < 1000; offset += 1) {
      const candidate = `+22170${String((seed + offset) % 10_000_000).padStart(7, '0')}`;
      const result = await client.query('SELECT 1 FROM demenag.users WHERE phone = $1', [
        candidate,
      ]);
      if (!result.rowCount) {
        phone = candidate;
        break;
      }
    }
    if (!phone)
      throw new Error('Impossible de réserver un téléphone technique pour un client historique.');
  }

  const id = stableId;
  const result = await client.query(
    `INSERT INTO demenag.users (id, name, phone, password_hash, role, active, created_at)
     VALUES ($1::uuid, $2, $3, $4, 'client', true, now())
     ON CONFLICT (phone) DO NOTHING
     RETURNING id, phone`,
    [id, value.name || 'Client historique', phone, 'legacy-imported-client-no-password'],
  );
  const created = result.rows[0];
  if (created) {
    existingByPhone.set(mapKey, { id: created.id, phone: created.phone });
    return created.id;
  }
  const conflict = await client.query('SELECT id, phone FROM demenag.users WHERE phone = $1', [
    phone,
  ]);
  if (!conflict.rows[0])
    throw new Error('Conflit inattendu lors de la création du client historique.');
  existingByPhone.set(mapKey, conflict.rows[0]);
  return conflict.rows[0].id;
}

await db.connect();
try {
  await db.query('BEGIN');
  if (replaceTolls) {
    const target = await db.query('SELECT current_database() AS name');
    if (target.rows[0]?.name !== 'demenag_import_20261118')
      throw new Error(
        'Remplacement des péages autorisé uniquement dans la nouvelle base importée.',
      );
  }
  const already = await db.query('SELECT 1 FROM demenag.legacy_import_archives WHERE id = $1', [
    sha256,
  ]);
  if (already.rowCount && !replay)
    throw new Error(
      'Cette sauvegarde est déjà importée. Utilisez --replay pour compléter les tables dérivées.',
    );

  const vehicleRows = await db.query(
    'SELECT id, name, short_name, volume, length, height, width, wheel_width, image, interior, prices, active FROM demenag.vehicles',
  );
  const vehicles = new Map(vehicleRows.rows.map((row) => [row.id, row]));
  const existingUsers = await db.query('SELECT id, phone FROM demenag.users');
  const usersByPhone = new Map();
  for (const user of existingUsers.rows) {
    const normalized = phoneDigits(user.phone);
    if (normalized) usersByPhone.set(normalized, user);
  }
  const takenBookingRefs = new Map(
    (await db.query('SELECT id, reference FROM demenag.bookings')).rows.map((row) => [
      row.reference,
      row.id,
    ]),
  );
  const takenQuoteRefs = new Map(
    (await db.query('SELECT id, reference FROM demenag.devis')).rows.map((row) => [
      row.reference,
      row.id,
    ]),
  );
  const seenBookingRefs = new Set();

  for (let index = 0; index < reservations.length; index += 1) {
    const legacy = reservations[index];
    const { __deletedAt: deletedAt, ...originalLegacy } = legacy;
    const id = uuidFor(`booking:${legacy.id}`);
    const selectedVehicleId = vehicleIdOf(legacy.vehicle);
    const vehicle = vehicles.get(selectedVehicleId);
    if (!vehicle)
      throw new Error(
        `Le véhicule historique ${selectedVehicleId} n’existe pas dans le catalogue.`,
      );
    const userId = await ensureUser(db, legacy, usersByPhone);
    const originalReference = String(legacy.ref || `IMPORT-${legacy.id}`);
    let reference = originalReference;
    if (
      seenBookingRefs.has(reference) ||
      (takenBookingRefs.has(reference) && takenBookingRefs.get(reference) !== id)
    )
      reference = `${originalReference}-HIST-${String(legacy.id)
        .replace(/[^a-z\d]/giu, '')
        .slice(-8)}`;
    seenBookingRefs.add(reference);
    takenBookingRefs.set(reference, id);
    const quoteLegacy = legacy.devis || {};
    const quoteId = uuidFor(`quote:${legacy.id}:${quoteLegacy.num || originalReference}`);
    let quoteReference = String(quoteLegacy.num || originalReference);
    const originalQuoteReference = quoteReference;
    if (takenQuoteRefs.has(quoteReference) && takenQuoteRefs.get(quoteReference) !== quoteId)
      quoteReference = `${quoteReference}-HIST-${String(legacy.id)
        .replace(/[^a-z\d]/giu, '')
        .slice(-8)}`;
    takenQuoteRefs.set(quoteReference, quoteId);

    const total = Number.isFinite(Number(quoteLegacy.total)) ? integer(quoteLegacy.total) : null;
    const tripCount = Math.max(0, integer(quoteLegacy.trips ?? legacy.trips));
    const tier = Math.max(0, integer(quoteLegacy.tier ?? legacy.tier));
    const quotePrice = legacyQuotePrice(legacy);
    const discount = quotePrice.discount;
    const estimateTotal = Number.isFinite(Number(legacy.estimate))
      ? integer(legacy.estimate)
      : null;
    const estimate = price(estimateTotal, tripCount, tier, 0, 'Estimation historique importée');
    const fromOk = validPoint(legacy.fromLL);
    const toOk = validPoint(legacy.toLL);
    const createdAt = bookingCreatedAt(legacy);
    const date = dateOnly(legacy.date || quoteLegacy.date);
    const row = {
      id,
      reference: originalReference,
      userId,
      driverId: null,
      customerName: String(legacy.name || 'Client historique'),
      phone: String(legacy.phone || ''),
      source: String(legacy.source || ''),
      vehicle: {
        id: vehicle.id,
        name: vehicle.name,
        shortName: vehicle.short_name || vehicle.name,
        volume: vehicle.volume,
        length: vehicle.length,
        height: vehicle.height,
        width: vehicle.width,
        wheelWidth: vehicle.wheel_width,
        image: vehicle.image,
        interior: vehicle.interior,
        prices: vehicle.prices,
        active: vehicle.active,
      },
      vehicleId: selectedVehicleId,
      fromAddress: String(legacy.from || ''),
      toAddress: String(legacy.to || ''),
      from: point(legacy.fromLL),
      to: point(legacy.toLL),
      distanceKm: distanceFrom(legacy.km),
      date,
      month: String(legacy.month || date?.slice(0, 7) || ''),
      timeSlot: String(legacy.time || '08:00'),
      options: {
        labour: Math.max(0, integer(legacy.man)),
        desk: Math.max(0, integer(legacy.bureau)),
        wardrobe: Math.max(0, integer(legacy.armoire)),
        bed: Math.max(0, integer(legacy.lit)),
      },
      notes: String(legacy.notes || ''),
      status: statusOf(legacy.status),
      estimate,
      quotes: [
        {
          id: quoteId,
          reference: originalQuoteReference,
          kind: quoteLegacy.final ? 'final' : 'provisional',
          createdAt: dateValue(quoteLegacy.sentAt, createdAt),
          price: quotePrice,
          notes: String(quoteLegacy.notes || legacy.notes || ''),
          options: {
            labour: Math.max(0, integer(quoteLegacy.man ?? legacy.man)),
            desk: Math.max(0, integer(quoteLegacy.bureau ?? legacy.bureau)),
            wardrobe: Math.max(0, integer(quoteLegacy.armoire ?? legacy.armoire)),
            bed: Math.max(0, integer(quoteLegacy.lit ?? legacy.lit)),
          },
          billingMode: quoteLegacy.bill === 'loc' ? 'driver-rental' : 'complete',
          menuIncluded:
            quoteLegacy.bill === 'loc' ? Boolean(quoteLegacy.locMenu) : !quoteLegacy.noMenu,
          importedFromDesktop: true,
        },
      ],
      trips: [],
      version: 1,
      createdAt,
      ...(fromOk && toOk ? {} : { legacyCoordinatesMissing: true }),
      legacyDesktopRecord: originalLegacy,
      ...(data.plan?.[legacy.id] ? { legacyDesktopPlan: data.plan[legacy.id] } : {}),
      ...(reference !== originalReference ? { legacyOriginalReference: originalReference } : {}),
    };
    Object.assign(row, missingLegacyInventoryPatch(row));

    await db.query(
      `INSERT INTO demenag.bookings
       (id, user_id, request_id, reference, vehicle_id, date, time_slot, status, data, version, created_at, deleted_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::date, $7, $8::demenag."BookingStatus", $9::jsonb, 1, $10::timestamptz, $11::timestamptz)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, status = EXCLUDED.status,
         date = EXCLUDED.date, time_slot = EXCLUDED.time_slot, deleted_at = EXCLUDED.deleted_at`,
      [
        id,
        userId,
        uuidFor(`request:${legacy.id}`),
        reference,
        selectedVehicleId,
        date,
        row.timeSlot,
        row.status,
        json(row),
        createdAt,
        dateValue(deletedAt),
      ],
    );
    await db.query(
      `INSERT INTO demenag.devis (id, reservation_id, reference, nature, montant_total, remise, nombre_trajets, tranche, notes, cree_le)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
       ON CONFLICT (id) DO UPDATE SET montant_total = EXCLUDED.montant_total, notes = EXCLUDED.notes`,
      [
        quoteId,
        id,
        quoteReference,
        quoteLegacy.final ? 'definitif' : 'provisoire',
        total,
        discount,
        tripCount,
        tier,
        String(quoteLegacy.notes || legacy.notes || ''),
        dateValue(quoteLegacy.sentAt, createdAt),
      ],
    );
    for (const [position, line] of quotePrice.lines.entries()) {
      await db.query(
        `INSERT INTO demenag.lignes_devis (id, devis_id, libelle, quantite, prix_unitaire, montant, position)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
         ON CONFLICT (devis_id, position) DO UPDATE SET libelle = EXCLUDED.libelle,
           quantite = EXCLUDED.quantite, prix_unitaire = EXCLUDED.prix_unitaire, montant = EXCLUDED.montant`,
        [
          uuidFor(`quote-line:${quoteId}:${position}`),
          quoteId,
          line.label,
          line.quantity,
          line.unitPrice,
          line.total,
          position,
        ],
      );
    }
  }

  for (const client of data.clients || []) {
    const phone =
      phoneDigits(client.phone) ||
      `legacy-invalid-${createHash('sha256').update(String(client.id)).digest('hex').slice(0, 24)}`;
    await db.query(
      `INSERT INTO demenag.client_profiles (normalized_phone, name, phone, address, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (normalized_phone) DO UPDATE SET name = EXCLUDED.name,
         phone = EXCLUDED.phone, address = EXCLUDED.address, updated_at = now()`,
      [
        phone,
        String(client.name || 'Client historique'),
        String(client.phone),
        String(client.addr || ''),
      ],
    );
  }

  for (const staff of data.staff || []) {
    const phone = phoneDigits(staff.phone);
    if (!phone) continue;
    const vehicleId = vehicles.has(String(staff.veh)) ? String(staff.veh) : null;
    const pointValue = validPoint(staff.ll) ? staff.ll : null;
    const role = ['chauffeur', 'menuisier', 'manoeuvre'].includes(staff.role)
      ? staff.role
      : 'chauffeur';
    await db.query(
      `INSERT INTO demenag.drivers
       (id, name, phone, active, role, vehicle_id, availability, authorized_vehicles, address, latitude, longitude, geocoded_address, tags, notes, mission_refusals, cleared_refusals)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, '[]'::jsonb, '', '[]'::jsonb, 0)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone,
         active = EXCLUDED.active, role = EXCLUDED.role, vehicle_id = EXCLUDED.vehicle_id,
         availability = EXCLUDED.availability, address = EXCLUDED.address,
         latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
         geocoded_address = EXCLUDED.geocoded_address`,
      [
        uuidFor(`driver:${staff.id}`),
        String(staff.name || 'Employé historique'),
        phone,
        Boolean(staff.active),
        role,
        vehicleId,
        json(Array.isArray(staff.hours) ? staff.hours : []),
        json(vehicleId ? [vehicleId] : []),
        String(staff.addr || ''),
        pointValue?.[0] ?? null,
        pointValue?.[1] ?? null,
        String(staff.geoAddr || '') || null,
      ],
    );
  }

  for (const [vehicleId, dims] of Object.entries(data.dims || {})) {
    if (!vehicles.has(vehicleId) || !dims) continue;
    const prices = data.tarifs?.[vehicleId];
    await db.query(
      `UPDATE demenag.vehicles SET volume = $2, length = $3, height = $4,
       width = $5, wheel_width = $6, prices = COALESCE($7::integer[], prices) WHERE id = $1`,
      [
        vehicleId,
        String(dims.vol ?? vehicles.get(vehicleId).volume),
        String(dims.L ?? vehicles.get(vehicleId).length),
        String(dims.H ?? vehicles.get(vehicleId).height),
        String(dims.W ?? vehicles.get(vehicleId).width),
        String(dims.P ?? vehicles.get(vehicleId).wheel_width),
        Array.isArray(prices) ? prices.map((value) => integer(value)) : null,
      ],
    );
  }

  for (const toll of data.peages || []) {
    const coordinates = validPoint(toll.ll) ? toll.ll : [null, null];
    await db.query(
      `INSERT INTO demenag.toll_points (id, name, region, axis, heavy_price, vehicle_prices, latitude, longitude)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7, $8)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, region = EXCLUDED.region,
         axis = EXCLUDED.axis, heavy_price = EXCLUDED.heavy_price, vehicle_prices = EXCLUDED.vehicle_prices,
         latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude`,
      [
        uuidFor(`toll:${toll.id}`),
        String(toll.name || 'Péage historique'),
        String(toll.region || ''),
        String(toll.axe || ''),
        integer(toll.price),
        json(toll.prices || {}),
        coordinates[0],
        coordinates[1],
      ],
    );
  }
  let removedCopiedTolls = 0;
  if (replaceTolls) {
    const sourceTollIds = (data.peages || []).map((toll) => uuidFor(`toll:${toll.id}`));
    if (new Set(sourceTollIds).size !== sourceTollIds.length)
      throw new Error('Identifiants de péages du fichier en doublon.');
    const removed = await db.query(
      'DELETE FROM demenag.toll_points WHERE NOT (id = ANY($1::uuid[]))',
      [sourceTollIds],
    );
    removedCopiedTolls = removed.rowCount;
  }

  for (const entry of journal) {
    const entryDate = dateOnly(entry.date);
    if (!entryDate) throw new Error('Une écriture comptable du fichier a une date invalide.');
    await db.query(
      `INSERT INTO demenag.accounting_entries
       (id, type, category, label, amount, date, created_at, voided_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::date, $7::timestamptz, $8::timestamptz)
       ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, category = EXCLUDED.category,
         label = EXCLUDED.label, amount = EXCLUDED.amount, date = EXCLUDED.date, voided_at = EXCLUDED.voided_at`,
      [
        uuidFor(`journal:${entry.id}`),
        entry.type,
        String(entry.cat || 'Historique'),
        String(entry.label || 'Écriture historique'),
        integer(entry.amount),
        entryDate,
        `${entryDate}T12:00:00.000Z`,
        dateValue(entry.__voidedAt),
      ],
    );
  }

  const settings = data.tarifs || {};
  const company = data.company || {};
  const wa = data.wa || {};
  const payment = data.pay || {};
  const kit = (data.kitCfg || []).map((item) => ({
    id: String(item.id),
    label: String(item.l || item.id),
    rule: [
      'vehicle',
      'one',
      'blankets',
      'liftingStraps',
      'gloves',
      'tieDownStraps',
      'fixed',
    ].includes(item.rule)
      ? item.rule
      : 'fixed',
  }));
  await db.query(
    `UPDATE demenag.settings SET labour_price = COALESCE($1, labour_price),
      labour_floor_price = COALESCE($2, labour_floor_price), labour_lift_price = COALESCE($3, labour_lift_price),
      assembly_price = COALESCE($4, assembly_price), assembly_price_matrix = COALESCE($5::jsonb, assembly_price_matrix),
      business_phone = COALESCE(NULLIF($6, ''), business_phone), business_address = COALESCE(NULLIF($7, ''), business_address),
      business_email = COALESCE(NULLIF($8, ''), business_email), business_ninea = COALESCE(NULLIF($9, ''), business_ninea),
      business_rccm = COALESCE(NULLIF($10, ''), business_rccm), booking_deposit_percent = COALESCE($11, booking_deposit_percent),
      whatsapp_phone = COALESCE(NULLIF($12, ''), whatsapp_phone), whatsapp_country_code = COALESCE(NULLIF($13, ''), whatsapp_country_code),
      whatsapp_mode = COALESCE(NULLIF($14, ''), whatsapp_mode), whatsapp_quote_template = COALESCE(NULLIF($15, ''), whatsapp_quote_template),
      payment_cash = COALESCE($16, payment_cash), payment_qr = COALESCE(NULLIF($17, ''), payment_qr),
      rental_kit_configuration = COALESCE($18::jsonb, rental_kit_configuration),
      moving_labor_planning = COALESCE(moving_labor_planning, '{}'::jsonb) || $19::jsonb,
      rental_overtime_hourly_rate = COALESCE($20, rental_overtime_hourly_rate)
      WHERE id = 'main'`,
    [
      Number.isFinite(Number(settings.manoeuvre)) ? integer(settings.manoeuvre) : null,
      Number.isFinite(Number(settings.manEtage)) ? integer(settings.manEtage) : null,
      Number.isFinite(Number(settings.manAsc)) ? integer(settings.manAsc) : null,
      Number.isFinite(Number(settings.montage)) ? integer(settings.montage) : null,
      settings.montageP ? json(settings.montageP) : null,
      String(company.tel || ''),
      String(company.addr || ''),
      String(company.email || ''),
      String(company.ninea || ''),
      String(company.rccm || ''),
      Number.isFinite(Number(company.acompte)) ? integer(company.acompte) : null,
      String(wa.biz || ''),
      String(wa.cc || ''),
      String(wa.mode || ''),
      String(wa.tpl || ''),
      typeof payment.cash === 'boolean' ? payment.cash : null,
      String(payment.qr || ''),
      json(kit),
      json({
        followingTripDiscountPercent: Number(settings.tripDeg) || 100,
        lowDemandDiscountPercent: Math.max(0, integer(settings.creux)),
        manoeuvreOvertimeThresholdHours: Math.max(1, integer(settings.manOverH, 8)),
        manoeuvreOvertimeHourlyRate: Math.max(0, integer(settings.manOverPx)),
      }),
      Number.isFinite(Number(settings.otH)) ? integer(settings.otH) : null,
    ],
  );

  const oldFinance = data.fin || {};
  const financeRow = await db.query(
    'SELECT data FROM demenag.accounting_configuration WHERE id = $1 FOR UPDATE',
    ['main'],
  );
  const finance = financeRow.rows[0]?.data || {};
  const financeMap = {
    regime: ['auto', 'informel', 'suarl'].includes(oldFinance.regime)
      ? oldFinance.regime
      : finance.regime,
    isRate: integer(oldFinance.isRate, finance.isRate),
    debt: integer(oldFinance.dette, finance.debt),
    debtMonths: integer(oldFinance.detteMois, finance.debtMonths),
    fleetValue: integer(oldFinance.fleet, finance.fleetValue),
    fleetYears: integer(oldFinance.fleetYears, finance.fleetYears),
    newVehicleTarget: integer(oldFinance.newVeh, finance.newVehicleTarget),
    profitCapPercent: integer(oldFinance.seuil, finance.profitCapPercent),
    moverCostPerMove: integer(oldFinance.manPay, finance.moverCostPerMove),
    monthlyProfitTarget: integer(oldFinance.objectif, finance.monthlyProfitTarget),
    averageMovingPrice: integer(oldFinance.avgTicket, finance.averageMovingPrice),
    vehicleCount: integer(oldFinance.nVeh, finance.vehicleCount),
    oilChangeCost: integer(oldFinance.vidange, finance.oilChangeCost),
    oilChangeIntervalMonths: integer(oldFinance.vidangeMois, finance.oilChangeIntervalMonths),
    vehicleInsuranceAnnual: integer(oldFinance.assur, finance.vehicleInsuranceAnnual),
    legalReservePercent: integer(oldFinance.legPct, finance.legalReservePercent),
    legalReserveCapitalPercent: integer(oldFinance.legCap, finance.legalReserveCapitalPercent),
    ...(oldFinance.menuPrices ? { menuPrices: oldFinance.menuPrices } : {}),
    ...(Array.isArray(oldFinance.salaries)
      ? {
          salaries: oldFinance.salaries.map((item, index) => ({
            id: `legacy-${index + 1}`,
            name: String(item.n || ''),
            amount: integer(item.a),
          })),
        }
      : {}),
    ...(oldFinance.pub ? { advertising: oldFinance.pub } : {}),
  };
  await db.query(
    'UPDATE demenag.accounting_configuration SET data = $1::jsonb, updated_at = now() WHERE id = $2',
    [json({ ...finance, ...financeMap }), 'main'],
  );

  await db.query(
    `INSERT INTO demenag.legacy_import_archives (id, source, payload) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (id) DO UPDATE SET source = EXCLUDED.source, payload = EXCLUDED.payload`,
    [sha256, path.basename(file), raw],
  );
  await db.query('COMMIT');
  console.log(JSON.stringify({ mode: 'applied', ...summary, removedCopiedTolls }, null, 2));
} catch (error) {
  await db.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await db.end();
}
