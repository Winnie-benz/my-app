import Database from 'libsql'
import path from 'path'
import fs from 'fs'

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '../../data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'shop.db')
const RESTORE_REQUEST_PATH = path.join(DATA_DIR, 'restore-request.json')
const FAILED_RESTORE_REQUEST_PATH = path.join(DATA_DIR, `restore-request.failed.json`)

const TURSO_URL   = process.env.TURSO_DATABASE_URL
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN

function applyPendingRestore() {
  // Skip restore when using Turso — copying plain .db file would corrupt sync metadata
  if (TURSO_URL && TURSO_TOKEN) {
    if (fs.existsSync(RESTORE_REQUEST_PATH)) {
      fs.renameSync(RESTORE_REQUEST_PATH, FAILED_RESTORE_REQUEST_PATH)
      console.warn('⚠️  Restore skipped: not supported when using Turso cloud sync')
    }
    return
  }

  if (!fs.existsSync(RESTORE_REQUEST_PATH)) return

  const request = JSON.parse(fs.readFileSync(RESTORE_REQUEST_PATH, 'utf8')) as {
    backupPath?: string
    requestedAt?: string
  }

  if (!request.backupPath || !fs.existsSync(request.backupPath)) {
    fs.renameSync(RESTORE_REQUEST_PATH, FAILED_RESTORE_REQUEST_PATH)
    console.error('Restore request skipped: backup file no longer exists')
    return
  }

  for (const suffix of ['', '-shm', '-wal']) {
    const filePath = `${DB_PATH}${suffix}`
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  }

  fs.copyFileSync(request.backupPath, DB_PATH)
  fs.unlinkSync(RESTORE_REQUEST_PATH)
  console.log(`✅  Restore applied  →  ${path.basename(request.backupPath)}${request.requestedAt ? ` (requested at ${request.requestedAt})` : ''}`)
}

applyPendingRestore()

// Turso present  →  connect DIRECTLY to the cloud primary (reads + writes hit
// the cloud, so every machine sees the same data instantly). The previous
// embedded-replica mode (syncUrl) read from a stale local cache while writes
// went to the cloud, which silently dropped every edit.
const USE_REMOTE = !!(TURSO_URL && TURSO_TOKEN)

const db = USE_REMOTE
  ? new Database(TURSO_URL as string, { authToken: TURSO_TOKEN as string } as any)
  : new Database(DB_PATH)

if (!USE_REMOTE) {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
}

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode      TEXT    NOT NULL UNIQUE,
    sku          TEXT    NOT NULL DEFAULT '',
    name         TEXT    NOT NULL,
    category     TEXT    NOT NULL DEFAULT 'อุปกรณ์อื่นๆ',
    cost_price   REAL    NOT NULL DEFAULT 0,
    sell_price   REAL    NOT NULL DEFAULT 0,
    stock_current INTEGER NOT NULL DEFAULT 0,
    avg_cost     REAL    NOT NULL DEFAULT 0,
    note         TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','+7 hours')),
    deleted_at   TEXT    NOT NULL DEFAULT '',
    deleted_by   TEXT    NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS customers (
    customer_id  TEXT PRIMARY KEY,
    first_name   TEXT NOT NULL,
    last_name    TEXT NOT NULL,
    phone_no     TEXT NOT NULL DEFAULT '',
    email        TEXT NOT NULL DEFAULT '',
    birthday     TEXT NOT NULL DEFAULT '',
    gender       TEXT NOT NULL DEFAULT 'unspecified',
    address      TEXT NOT NULL DEFAULT '',
    note         TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now','+7 hours')),
    deleted_at   TEXT NOT NULL DEFAULT '',
    deleted_by   TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id               TEXT PRIMARY KEY,
    customer_id      TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    date             TEXT NOT NULL,
    lens_data        TEXT NOT NULL DEFAULT '{}',
    frame_data       TEXT NOT NULL DEFAULT '{}',
    other_data       TEXT NOT NULL DEFAULT '{}',
    price_lens       TEXT NOT NULL DEFAULT '{}',
    price_frame      TEXT NOT NULL DEFAULT '{}',
    price_other      TEXT NOT NULL DEFAULT '{}',
    special_discount REAL NOT NULL DEFAULT 0,
    total            REAL NOT NULL DEFAULT 0,
    pickup_date      TEXT NOT NULL DEFAULT '',
    pickup_time      TEXT NOT NULL DEFAULT '',
    voided_at        TEXT NOT NULL DEFAULT '',
    voided_by        TEXT NOT NULL DEFAULT '',
    void_reason      TEXT NOT NULL DEFAULT '',
    created_at       TEXT NOT NULL DEFAULT (datetime('now','+7 hours'))
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS stock_movements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type        TEXT    NOT NULL,
    qty         INTEGER NOT NULL,
    cost        REAL,
    reference   TEXT,
    note        TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','+7 hours'))
  );
`)

// Migration: payment + order status columns on purchases
try { db.exec(`ALTER TABLE purchases ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'`) } catch {}
try { db.exec(`ALTER TABLE purchases ADD COLUMN paid_amount    REAL NOT NULL DEFAULT 0`) } catch {}
try { db.exec(`ALTER TABLE purchases ADD COLUMN order_status   TEXT NOT NULL DEFAULT 'waiting'`) } catch {}

// Migration: cost tracking columns (nullable = pending cost entry)
try { db.exec(`ALTER TABLE purchases ADD COLUMN cost_lens  REAL DEFAULT 0`) } catch {}
try { db.exec(`ALTER TABLE purchases ADD COLUMN cost_frame REAL DEFAULT 0`) } catch {}
try { db.exec(`ALTER TABLE purchases ADD COLUMN cost_other REAL DEFAULT 0`) } catch {}

// Migration: previous RX for comparison
try { db.exec(`ALTER TABLE purchases ADD COLUMN prev_rx_data TEXT DEFAULT NULL`) } catch {}

// Migration: ordered RX (may differ from measured)
try { db.exec(`ALTER TABLE purchases ADD COLUMN order_rx_data TEXT DEFAULT NULL`) } catch {}

// Migration: seller attribution (staff performance analysis) — set at sale creation,
// preserved on edit (the editor is not necessarily the original seller)
try { db.exec(`ALTER TABLE purchases ADD COLUMN sold_by_staff_id TEXT NOT NULL DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE purchases ADD COLUMN sold_by_name     TEXT NOT NULL DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE purchases ADD COLUMN voided_at TEXT NOT NULL DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE purchases ADD COLUMN voided_by TEXT NOT NULL DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE purchases ADD COLUMN void_reason TEXT NOT NULL DEFAULT ''`) } catch {}

// Migration: per-product reorder point
try { db.exec(`ALTER TABLE products ADD COLUMN reorder_point INTEGER NOT NULL DEFAULT 1`) } catch {}

// Migration: soft delete metadata on products
try { db.exec(`ALTER TABLE products ADD COLUMN deleted_at TEXT NOT NULL DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE products ADD COLUMN deleted_by TEXT NOT NULL DEFAULT ''`) } catch {}

// Migration: dismiss a product from the low-stock alert (kept in stock, just not alerted)
try { db.exec(`ALTER TABLE products ADD COLUMN low_stock_ignored INTEGER NOT NULL DEFAULT 0`) } catch {}

// Migration: customer acquisition source
try { db.exec(`ALTER TABLE customers ADD COLUMN source TEXT NOT NULL DEFAULT 'walk_in'`) } catch {}

// Migration: customer occupation (Phase 6 — occupational lens recommendation analysis)
try { db.exec(`ALTER TABLE customers ADD COLUMN occupation TEXT NOT NULL DEFAULT ''`) } catch {}

// Migration: soft delete metadata on customers
try { db.exec(`ALTER TABLE customers ADD COLUMN deleted_at TEXT NOT NULL DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE customers ADD COLUMN deleted_by TEXT NOT NULL DEFAULT ''`) } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory_sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now','+7 hours')),
    created_by    TEXT    NOT NULL DEFAULT '',
    total_items   INTEGER NOT NULL DEFAULT 0,
    total_missing INTEGER NOT NULL DEFAULT 0,
    total_over    INTEGER NOT NULL DEFAULT 0,
    total_ok      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inventory_session_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   INTEGER NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
    product_id   INTEGER NOT NULL DEFAULT 0,
    barcode      TEXT    NOT NULL DEFAULT '',
    sku          TEXT    NOT NULL DEFAULT '',
    product_name TEXT    NOT NULL DEFAULT '',
    expected_qty INTEGER NOT NULL DEFAULT 0,
    counted_qty  INTEGER NOT NULL DEFAULT 0,
    difference   INTEGER NOT NULL DEFAULT 0,
    status       TEXT    NOT NULL DEFAULT 'unchecked'
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS lens_products (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    brand        TEXT    NOT NULL DEFAULT '',
    series       TEXT    NOT NULL DEFAULT '',
    lens_type    TEXT    NOT NULL DEFAULT '',
    lens_index   TEXT    NOT NULL DEFAULT '',
    coating      TEXT    NOT NULL DEFAULT '',
    note         TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','+7 hours'))
  );

  CREATE TABLE IF NOT EXISTS lens_variants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES lens_products(id) ON DELETE CASCADE,
    sku         TEXT    NOT NULL DEFAULT '',
    barcode     TEXT    NOT NULL DEFAULT '',
    sph         TEXT    NOT NULL DEFAULT '',
    cyl         TEXT    NOT NULL DEFAULT '',
    axis        TEXT    NOT NULL DEFAULT '',
    add_power   TEXT    NOT NULL DEFAULT '',
    stock_qty   INTEGER NOT NULL DEFAULT 0,
    cost        REAL    NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','+7 hours'))
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id          TEXT PRIMARY KEY,
    purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    amount      REAL NOT NULL DEFAULT 0,
    method      TEXT NOT NULL DEFAULT 'cash',
    note        TEXT NOT NULL DEFAULT '',
    paid_at     TEXT NOT NULL,
    voided_at   TEXT NOT NULL DEFAULT '',
    voided_by   TEXT NOT NULL DEFAULT '',
    void_reason TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now','+7 hours'))
  );
`)
try { db.exec(`ALTER TABLE payments ADD COLUMN voided_at TEXT NOT NULL DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE payments ADD COLUMN voided_by TEXT NOT NULL DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE payments ADD COLUMN void_reason TEXT NOT NULL DEFAULT ''`) } catch {}

// Migrations: SPH/CYL range config on lens_products
try { db.exec(`ALTER TABLE lens_products ADD COLUMN sph_min  REAL NOT NULL DEFAULT -6.0`) } catch {}
try { db.exec(`ALTER TABLE lens_products ADD COLUMN sph_max  REAL NOT NULL DEFAULT  0.0`) } catch {}
try { db.exec(`ALTER TABLE lens_products ADD COLUMN cyl_min  REAL NOT NULL DEFAULT -2.0`) } catch {}
try { db.exec(`ALTER TABLE lens_products ADD COLUMN cyl_max  REAL NOT NULL DEFAULT  0.0`) } catch {}
try { db.exec(`ALTER TABLE lens_products ADD COLUMN sph_step REAL NOT NULL DEFAULT  0.25`) } catch {}
try { db.exec(`ALTER TABLE lens_products ADD COLUMN cyl_step REAL NOT NULL DEFAULT  0.25`) } catch {}

// Migration: link purchase to specific lens variants per eye (early deduction)
try { db.exec(`ALTER TABLE purchases ADD COLUMN lens_variant_id   INTEGER DEFAULT NULL`) } catch {}
try { db.exec(`ALTER TABLE purchases ADD COLUMN lens_variant_id_r INTEGER DEFAULT NULL`) } catch {}
try { db.exec(`ALTER TABLE purchases ADD COLUMN lens_variant_id_l INTEGER DEFAULT NULL`) } catch {}

// Migration: stock override audit trail
try { db.exec(`ALTER TABLE purchases ADD COLUMN stock_override_data TEXT DEFAULT NULL`) } catch {}
try { db.exec(`ALTER TABLE purchases ADD COLUMN stock_override_by   TEXT NOT NULL DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE purchases ADD COLUMN stock_override_at   TEXT NOT NULL DEFAULT ''`) } catch {}

// Migration: lens_type on purchases (was in CREATE TABLE but missing on older Turso instances)
try { db.exec(`ALTER TABLE purchases ADD COLUMN lens_type TEXT NOT NULL DEFAULT ''`) } catch {}

// Migration: default cost per lens product (pre-fills variant cost on creation)
try { db.exec(`ALTER TABLE lens_products ADD COLUMN default_cost REAL NOT NULL DEFAULT 0`) } catch {}

// Migration: sell price per lens product (auto-fills price in purchase form)
try { db.exec(`ALTER TABLE lens_products ADD COLUMN sell_price REAL NOT NULL DEFAULT 0`) } catch {}

// Migration: dismiss a lens variant from the low-stock alert
try { db.exec(`ALTER TABLE lens_variants ADD COLUMN low_stock_ignored INTEGER NOT NULL DEFAULT 0`) } catch {}

// Migration: lens variant stock movement history (avg cost tracking)
db.exec(`
  CREATE TABLE IF NOT EXISTS lens_variant_movements (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    variant_id     INTEGER NOT NULL REFERENCES lens_variants(id) ON DELETE CASCADE,
    product_id     INTEGER NOT NULL DEFAULT 0,
    type           TEXT    NOT NULL DEFAULT 'stock_in',
    qty            INTEGER NOT NULL DEFAULT 0,
    cost           REAL    NOT NULL DEFAULT 0,
    avg_cost_after REAL    NOT NULL DEFAULT 0,
    note           TEXT    NOT NULL DEFAULT '',
    created_at     TEXT    NOT NULL DEFAULT (datetime('now','+7 hours'))
  );
`)

// Migration: session type on inventory_sessions
try { db.exec(`ALTER TABLE inventory_sessions ADD COLUMN session_type TEXT NOT NULL DEFAULT 'products'`) } catch {}

// Migration: claims pickup date + payment status + paid_amount
try { db.exec(`ALTER TABLE claims ADD COLUMN pickup_date     TEXT NOT NULL DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE claims ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'`) } catch {}
try { db.exec(`ALTER TABLE claims ADD COLUMN paid_amount    REAL NOT NULL DEFAULT 0`) } catch {}
try { db.exec(`ALTER TABLE claims ADD COLUMN order_status   TEXT NOT NULL DEFAULT 'waiting'`) } catch {}
try { db.exec(`ALTER TABLE claims ADD COLUMN deleted_at     TEXT NOT NULL DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE claims ADD COLUMN deleted_by     TEXT NOT NULL DEFAULT ''`) } catch {}
try {
  db.exec(`
    UPDATE claims
    SET order_status = CASE
      WHEN status = 'resolved' THEN 'completed'
      WHEN status = 'in_progress' THEN 'cutting'
      ELSE order_status
    END
    WHERE order_status = 'waiting'
  `)
} catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS claims (
    id             TEXT PRIMARY KEY,
    purchase_id    TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    customer_id    TEXT NOT NULL,
    claim_type     TEXT NOT NULL DEFAULT '',
    description    TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'pending',
    order_status   TEXT NOT NULL DEFAULT 'waiting',
    fee            REAL NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    paid_amount    REAL NOT NULL DEFAULT 0,
    pickup_date    TEXT NOT NULL DEFAULT '',
    resolved_at    TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL DEFAULT (datetime('now','+7 hours')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now','+7 hours')),
    deleted_at     TEXT NOT NULL DEFAULT '',
    deleted_by     TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS claim_payments (
    id         TEXT PRIMARY KEY,
    claim_id   TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    amount     REAL NOT NULL DEFAULT 0,
    method     TEXT NOT NULL DEFAULT 'cash',
    note       TEXT NOT NULL DEFAULT '',
    paid_at    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','+7 hours'))
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS order_status_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_kind   TEXT NOT NULL,
    order_id     TEXT NOT NULL,
    from_status  TEXT NOT NULL DEFAULT '',
    to_status    TEXT NOT NULL,
    changed_by   TEXT NOT NULL DEFAULT '',
    changed_at   TEXT NOT NULL DEFAULT (datetime('now','+7 hours'))
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    action      TEXT NOT NULL,
    before_data TEXT NOT NULL DEFAULT '',
    after_data  TEXT NOT NULL DEFAULT '',
    changed_by  TEXT NOT NULL DEFAULT '',
    changed_at  TEXT NOT NULL DEFAULT (datetime('now','+7 hours'))
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS claim_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id     TEXT    NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    product_id   INTEGER NOT NULL,
    product_name TEXT    NOT NULL DEFAULT '',
    barcode      TEXT    NOT NULL DEFAULT '',
    qty          INTEGER NOT NULL DEFAULT 1,
    cost         REAL    NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','+7 hours'))
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'staff',
    first_name    TEXT    NOT NULL DEFAULT '',
    last_name     TEXT    NOT NULL DEFAULT '',
    nickname      TEXT    NOT NULL DEFAULT '',
    phone_no      TEXT    NOT NULL DEFAULT '',
    status        TEXT    NOT NULL DEFAULT 'active',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS daily_closes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    close_date     TEXT NOT NULL UNIQUE,
    status         TEXT NOT NULL DEFAULT 'open',
    opening_float  REAL NOT NULL DEFAULT 0,
    opened_by      TEXT NOT NULL DEFAULT '',
    opened_at      TEXT NOT NULL DEFAULT '',
    total_cash     REAL NOT NULL DEFAULT 0,
    total_transfer REAL NOT NULL DEFAULT 0,
    total_card     REAL NOT NULL DEFAULT 0,
    total_qr       REAL NOT NULL DEFAULT 0,
    total_sales    REAL NOT NULL DEFAULT 0,
    expected_cash  REAL NOT NULL DEFAULT 0,
    counted_cash   REAL NOT NULL DEFAULT 0,
    difference     REAL NOT NULL DEFAULT 0,
    note           TEXT NOT NULL DEFAULT '',
    closed_by      TEXT NOT NULL DEFAULT '',
    closed_at      TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL DEFAULT (datetime('now','+7 hours'))
  );
`)

// ── Performance indexes ──────────────────────────────────────────────────────
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_purchases_customer   ON purchases(customer_id);
  CREATE INDEX IF NOT EXISTS idx_purchases_date       ON purchases(date);
  CREATE INDEX IF NOT EXISTS idx_purchases_pay_status ON purchases(payment_status);
  CREATE INDEX IF NOT EXISTS idx_purchases_ord_status ON purchases(order_status);

  CREATE INDEX IF NOT EXISTS idx_payments_purchase    ON payments(purchase_id);
  CREATE INDEX IF NOT EXISTS idx_payments_paid_at     ON payments(paid_at);

  CREATE INDEX IF NOT EXISTS idx_stock_mov_product    ON stock_movements(product_id, type);
  CREATE INDEX IF NOT EXISTS idx_stock_mov_reference  ON stock_movements(reference);

  CREATE INDEX IF NOT EXISTS idx_lens_variants_product ON lens_variants(product_id);
  CREATE INDEX IF NOT EXISTS idx_lens_var_mov_variant  ON lens_variant_movements(variant_id);

  CREATE INDEX IF NOT EXISTS idx_claims_purchase      ON claims(purchase_id);
  CREATE INDEX IF NOT EXISTS idx_claims_customer      ON claims(customer_id);
  CREATE INDEX IF NOT EXISTS idx_claims_pay_status    ON claims(payment_status);

  CREATE INDEX IF NOT EXISTS idx_claim_payments_claim ON claim_payments(claim_id);
  CREATE INDEX IF NOT EXISTS idx_claim_items_claim    ON claim_items(claim_id);

  CREATE INDEX IF NOT EXISTS idx_status_logs_order    ON order_status_logs(order_kind, order_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_entity    ON audit_logs(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_changed   ON audit_logs(changed_at);
`)

// libsql shim. Two incompatibilities with better-sqlite3 are patched here so the
// rest of the codebase needs no changes:
//   1. On the remote (Hrana) connection, @named bind parameters are silently
//      bound to NULL — only positional '?' works. We rewrite @name → ? at
//      prepare time and remap the existing { name: value } call objects to a
//      positional array, preserving parameter order (and repeats).
//   2. libsql adds a `_metadata` field to .get() rows that better-sqlite3 never
//      had; we strip it.
//   3. Turso closes idle WebSocket streams after inactivity. We catch "stream not
//      found" errors and transparently reconnect + retry once so callers never see
//      the error.
let _rawPrepare = db.prepare.bind(db)

function reconnectTurso() {
  console.log('↻  Turso: stream expired — reconnecting...')
  try { (db as any).close?.() } catch {}
  const fresh = new Database(TURSO_URL as string, { authToken: TURSO_TOKEN as string } as any)
  _rawPrepare = fresh.prepare.bind(fresh)
}

;(db as any).prepare = (sql: string) => {
  const names: string[] = []
  // Turso servers run in UTC, so SQLite's 'localtime' modifier yields UTC, not
  // Thai time. Rewrite it to a fixed +7h offset (Thailand has no DST) so all
  // query-time date math (report ranges, age calc) stays in Thai local time.
  const tzSql = USE_REMOTE ? sql.replace(/'localtime'/g, "'+7 hours'") : sql
  const positionalSql = tzSql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_m, n) => {
    names.push(n)
    return '?'
  })

  let stmt: any
  try {
    stmt = _rawPrepare(positionalSql)
  } catch (err) {
    if (USE_REMOTE && err instanceof Error && err.message.includes('stream not found')) {
      reconnectTurso()
      stmt = _rawPrepare(positionalSql)
    } else {
      throw err
    }
  }

  const toArgs = (args: any[]) => {
    if (
      names.length > 0 &&
      args.length === 1 &&
      args[0] &&
      typeof args[0] === 'object' &&
      !Array.isArray(args[0])
    ) {
      const obj = args[0] as Record<string, any>
      return [names.map(n => obj[n])]
    }
    return args
  }
  const stripMeta = (row: any) => {
    if (row && typeof row === 'object' && '_metadata' in row) {
      const { _metadata: _, ...rest } = row
      return rest
    }
    return row
  }

  const _run = stmt.run.bind(stmt)
  const _get = stmt.get.bind(stmt)
  const _all = stmt.all.bind(stmt)
  stmt.run = (...args: any[]) => _run(...toArgs(args))
  stmt.get = (...args: any[]) => stripMeta(_get(...toArgs(args)))
  stmt.all = (...args: any[]) => _all(...toArgs(args))
  return stmt
}

if (USE_REMOTE) {
  console.log(`✅  Turso (direct cloud)  →  ${TURSO_URL}`)
} else {
  console.log(`✅  SQLite (local)  →  ${DB_PATH}`)
}

export default db
