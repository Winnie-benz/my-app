/**
 * One-time migration: push all data from the local shop.db file up to the
 * Turso cloud primary. Safe to re-run (INSERT OR REPLACE).
 *
 * Run:  cd ~/my-app/server && npx ts-node src/db/migrate-to-turso.ts
 */
import 'dotenv/config'
import Database from 'libsql'
import path from 'path'

const TURSO_URL   = process.env.TURSO_DATABASE_URL
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN
if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('❌  TURSO_DATABASE_URL / TURSO_AUTH_TOKEN missing in .env')
  process.exit(1)
}

const LOCAL_PATH = path.resolve(__dirname, '../../data/shop.db')

const local  = new Database(LOCAL_PATH)
const remote = new Database(TURSO_URL, { authToken: TURSO_TOKEN } as any)

function stripMeta<T extends Record<string, any>>(row: T): T {
  if (row && typeof row === 'object' && '_metadata' in row) {
    const { _metadata, ...rest } = row as any
    return rest
  }
  return row
}

// Dependency order so foreign keys resolve
const TABLES = [
  'products',
  'customers',
  'lens_products',
  'lens_variants',
  'purchases',
  'payments',
  'stock_movements',
  'lens_variant_movements',
  'inventory_sessions',
  'inventory_session_items',
  'claims',
  'claim_payments',
  'claim_items',
  'order_status_logs',
]

let totalRows = 0
for (const table of TABLES) {
  let rows: any[]
  try {
    rows = (local.prepare(`SELECT * FROM ${table}`).all() as Record<string, any>[]).map(stripMeta)
  } catch {
    console.log(`⏭  ${table} — not present locally, skipped`)
    continue
  }
  if (rows.length === 0) {
    console.log(`·  ${table} — 0 rows`)
    continue
  }
  const cols = Object.keys(rows[0])
  const placeholders = cols.map(() => '?').join(', ')
  const stmt = remote.prepare(
    `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
  )
  for (const row of rows) stmt.run(cols.map(c => row[c]))
  totalRows += rows.length
  console.log(`✅  ${table} — ${rows.length} rows pushed`)
}

console.log(`\n🎉  Migration complete — ${totalRows} rows pushed to Turso cloud.`)
