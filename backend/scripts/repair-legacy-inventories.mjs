import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import pg from 'pg';
import { tsImport } from 'tsx/esm/api';

const file = process.argv.find((arg) => arg.endsWith('.json'));
const apply = process.argv.includes('--apply');
if (!file)
  throw new Error('Usage: node scripts/repair-legacy-inventories.mjs <sauvegarde.json> [--apply]');
const raw = await readFile(file, 'utf8');
const backup = JSON.parse(raw);
if (backup.app !== 'Demenag Express' || backup.version !== 1 || !backup.data)
  throw new Error('Sauvegarde Demenag Express v1 attendue.');
const originals = [
  ...(backup.data.res ?? []),
  ...(backup.data.corbeille ?? [])
    .filter((entry) => entry.col === 'res')
    .map((entry) => entry.item),
];
const byId = new Map(originals.map((entry) => [String(entry.id), entry]));
if (byId.size !== originals.length) throw new Error('Identifiants répétés dans le JSON source.');
const sha = createHash('sha256').update(raw).digest('hex');
const { legacyInventorySnapshot, legacyInventorySource } = await tsImport(
  './legacy-booking-inventory.mjs',
  import.meta.url,
);
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Connexion de base absente.');
const url = new URL(connectionString);
url.searchParams.set('sslmode', 'verify-full');
const db = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15000 });
await db.connect();
try {
  await db.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
  const target = await db.query('SELECT current_database() AS name');
  if (target.rows[0]?.name !== 'demenag_express_pro')
    throw new Error('La base cible ne correspond pas à la base importée attendue.');
  const archive = await db.query('SELECT 1 FROM demenag.legacy_import_archives WHERE id = $1', [
    sha,
  ]);
  if (archive.rowCount !== 1)
    throw new Error('Cette sauvegarde exacte ne figure pas dans les archives importées.');
  const result = await db.query(`SELECT id, reference, version, data FROM demenag.bookings
    WHERE data ? 'legacyDesktopRecord' ${apply ? 'FOR UPDATE' : ''}`);
  if (result.rowCount !== originals.length)
    throw new Error(`Écart de réservations : JSON ${originals.length}, base ${result.rowCount}.`);
  const work = [];
  let noInventoryInSource = 0;
  let alreadyPresent = 0;
  let lineCount = 0;
  let selectedCount = 0;
  for (const row of result.rows) {
    const original = row.data.legacyDesktopRecord;
    const source = byId.get(String(original?.id));
    if (!source || !isDeepStrictEqual(original, source))
      throw new Error(
        `La réservation ${row.reference} diffère du fichier original : réparation arrêtée.`,
      );
    if (row.data.inventorySnapshot) {
      alreadyPresent++;
      continue;
    }
    const inventory = legacyInventorySource(source);
    if (!inventory) {
      noInventoryInSource++;
      continue;
    }
    if (row.version !== 1)
      throw new Error(
        `La réservation ${row.reference} a été modifiée depuis l'import : réparation arrêtée.`,
      );
    const expected = source.inv ?? source.devis?.inv;
    const converted = [
      ...Object.values(inventory.entries),
      ...inventory.variants,
      ...inventory.custom,
    ];
    if (expected.lines.length !== converted.length)
      throw new Error(`Lignes d'inventaire perdues pour ${row.reference}.`);
    lineCount += expected.lines.length;
    selectedCount += expected.lines.filter((line) => Number(line.q) > 0).length;
    const snapshot = legacyInventorySnapshot(source, row.data.vehicle);
    if (
      !snapshot ||
      (snapshot.sourceInventory !== inventory &&
        !isDeepStrictEqual(snapshot.sourceInventory, inventory))
    )
      throw new Error(`Conversion incomplète pour ${row.reference}.`);
    work.push({ row, snapshot: JSON.parse(JSON.stringify(snapshot)) });
  }
  const report = {
    mode: apply ? 'application' : 'simulation',
    sourceSha256: sha,
    reservations: result.rowCount,
    inventoriesToAdd: work.length,
    inventoriesAlreadyPresent: alreadyPresent,
    withoutInventoryInSource: noInventoryInSource,
    sourceLines: lineCount,
    sourceLinesWithQuantity: selectedCount,
  };
  if (apply) {
    const backupPath = `/tmp/demenag-before-inventory-repair-${Date.now()}.json`;
    await writeFile(backupPath, JSON.stringify(result.rows), { mode: 0o600, flag: 'wx' });
    for (const { row, snapshot } of work) {
      const saved = await db.query(
        `UPDATE demenag.bookings
        SET data = jsonb_set(data, '{inventorySnapshot}', $2::jsonb, true)
        WHERE id = $1::uuid AND version = $3
          AND data->'legacyDesktopRecord' = $4::jsonb
          AND NOT (data ? 'inventorySnapshot') RETURNING data`,
        [
          row.id,
          JSON.stringify(snapshot),
          row.version,
          JSON.stringify(row.data.legacyDesktopRecord),
        ],
      );
      if (saved.rowCount !== 1) throw new Error(`Modification concurrente pour ${row.reference}.`);
      const { inventorySnapshot, ...unchanged } = saved.rows[0].data;
      if (
        !isDeepStrictEqual(unchanged, row.data) ||
        !isDeepStrictEqual(inventorySnapshot, snapshot)
      )
        throw new Error(`Une autre donnée a changé pour ${row.reference}.`);
    }
    report.backupPath = backupPath;
    await db.query('COMMIT');
  } else await db.query('ROLLBACK');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await db.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await db.end();
}
