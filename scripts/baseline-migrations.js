/* eslint-disable no-console */
/**
 * Baseline the migration history for environments whose schema was originally
 * created by `sequelize.sync()` (e.g. prod) rather than by migrations.
 *
 * For each pre-migrations base table: if the table ALREADY EXISTS but the
 * migration isn't recorded in SequelizeMeta, mark it applied — so migrate-on-
 * startup doesn't try to recreate tables that already exist.
 *
 * SAFE on a fresh DB: a migration is only baselined when its table is present,
 * so on an empty database nothing is baselined and `db:migrate` creates
 * everything normally. Idempotent (ON CONFLICT DO NOTHING).
 */
const { sequelize } = require('../src/config/database');

// Base (pre-CMS) migrations and the table whose existence proves they ran.
const BASELINE = [
  { file: '20250729014000-create-users-table.js', table: 'users' },
  { file: '20250730143839-create-ultrasound-scans-table.js', table: 'ultrasound_scans' },
  { file: '20250813011649-add-cloud-storage-fields-to-ultrasound-scans.js', table: 'ultrasound_scans' },
  { file: '20250813044616-create-chat-conversations-table.js', table: 'chat_conversations' },
  { file: '20250813044745-create-chat-messages-table.js', table: 'chat_messages' }
];

(async () => {
  await sequelize.query(
    'CREATE TABLE IF NOT EXISTS "SequelizeMeta" ("name" VARCHAR(255) NOT NULL, CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY ("name"))'
  );

  let baselined = 0;
  for (const { file, table } of BASELINE) {
    const [rows] = await sequelize.query('SELECT to_regclass(:t) AS reg', { replacements: { t: `public.${table}` } });
    if (!rows[0].reg) continue; // table absent -> fresh DB, let migrate create it
    const [res] = await sequelize.query(
      'INSERT INTO "SequelizeMeta"("name") VALUES (:name) ON CONFLICT ("name") DO NOTHING',
      { replacements: { name: file } }
    );
    if (res && res.rowCount) { baselined += 1; console.log(`baselined: ${file}`); }
  }

  console.log(`baseline-migrations: ${baselined} migration(s) marked applied`);
  await sequelize.close();
})().catch((e) => { console.error('baseline-migrations FAILED:', e.message); process.exit(1); });
