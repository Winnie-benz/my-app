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

function applyPendingRestore() {
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

const TURSO_URL   = process.env.TURSO_DATABASE_URL
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN

const db = new Database(DB_PATH, {
  ...(TURSO_URL && TURSO_TOKEN ? { syncUrl: TURSO_URL, authToken: TURSO_TOKEN } : {}),
})

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

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
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
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
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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
    created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
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

// Migration: per-product reorder point
try { db.exec(`ALTER TABLE products ADD COLUMN reorder_point INTEGER NOT NULL DEFAULT 1`) } catch {}

// Migration: customer acquisition source
try { db.exec(`ALTER TABLE customers ADD COLUMN source TEXT NOT NULL DEFAULT 'walk_in'`) } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory_sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
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
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
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
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
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
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`)

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

// Migration: default cost per lens product (pre-fills variant cost on creation)
try { db.exec(`ALTER TABLE lens_products ADD COLUMN default_cost REAL NOT NULL DEFAULT 0`) } catch {}

// Migration: sell price per lens product (auto-fills price in purchase form)
try { db.exec(`ALTER TABLE lens_products ADD COLUMN sell_price REAL NOT NULL DEFAULT 0`) } catch {}

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
    created_at     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`)

// Migration: session type on inventory_sessions
try { db.exec(`ALTER TABLE inventory_sessions ADD COLUMN session_type TEXT NOT NULL DEFAULT 'products'`) } catch {}

// Migration: claims pickup date + payment status + paid_amount
try { db.exec(`ALTER TABLE claims ADD COLUMN pickup_date     TEXT NOT NULL DEFAULT ''`) } catch {}
try { db.exec(`ALTER TABLE claims ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'`) } catch {}
try { db.exec(`ALTER TABLE claims ADD COLUMN paid_amount    REAL NOT NULL DEFAULT 0`) } catch {}
try { db.exec(`ALTER TABLE claims ADD COLUMN order_status   TEXT NOT NULL DEFAULT 'waiting'`) } catch {}
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
    created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS claim_payments (
    id         TEXT PRIMARY KEY,
    claim_id   TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    amount     REAL NOT NULL DEFAULT 0,
    method     TEXT NOT NULL DEFAULT 'cash',
    note       TEXT NOT NULL DEFAULT '',
    paid_at    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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
    changed_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
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
`)

if (TURSO_URL && TURSO_TOKEN) {
  db.sync()
  setInterval(() => { try { db.sync() } catch {} }, 30_000)
  console.log(`✅  SQLite (embedded replica)  →  ${DB_PATH}  →  ${TURSO_URL}`)
} else {
  console.log(`✅  SQLite (local only)  →  ${DB_PATH}`)
}

export default db
