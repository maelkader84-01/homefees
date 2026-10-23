'use strict';
/**
 * schema.js — إنشاء الجداول والفهارس والبيانات الافتراضية
 * المبالغ المالية تُخزَّن كأرقام صحيحة (قروش/سنت) لتفادي أخطاء الفاصلة العائمة.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','manager','resident')),
  unit_id       INTEGER REFERENCES units(id) ON DELETE SET NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS buildings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  address    TEXT DEFAULT '',
  notes      TEXT DEFAULT '',
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS units (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  floor       INTEGER DEFAULT 0,
  area        REAL DEFAULT 0,
  shares      INTEGER DEFAULT 1,
  type        TEXT DEFAULT 'apartment',
  notes       TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (building_id, code)
);

CREATE TABLE IF NOT EXISTS residents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id    INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT DEFAULT '',
  email      TEXT DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','tenant')),
  active     INTEGER NOT NULL DEFAULT 1,
  start_date TEXT DEFAULT '',
  end_date   TEXT DEFAULT '',
  notes      TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id  INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount       INTEGER NOT NULL,            -- لكل وحدة (توزيع متساوي)
  distribution TEXT NOT NULL DEFAULT 'equal' CHECK (distribution IN ('equal','shares','area')),
  dis_amount   INTEGER DEFAULT NULL,        -- مبلغ الوحدة المتروكة (اختياري): وحدة مأهولة=amount، متروكة=dis_amount
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (building_id, name)
);

CREATE TABLE IF NOT EXISTS invoices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  unit_id     INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  rate_id     INTEGER REFERENCES rates(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL DEFAULT 'rate' CHECK (kind IN ('rate','custom')),
  description TEXT DEFAULT '',
  period      TEXT NOT NULL,                -- YYYY-MM
  amount      INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_unit_period ON invoices(unit_id, period);
CREATE INDEX IF NOT EXISTS idx_invoices_building_period ON invoices(building_id, period);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_rate_unit_period ON invoices(unit_id, rate_id, period) WHERE rate_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  unit_id     INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  invoice_id  INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  amount      INTEGER NOT NULL,
  paid_on     TEXT NOT NULL,                -- YYYY-MM-DD
  method      TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','bank','online','other')),
  receipt_no  TEXT DEFAULT '',
  note        TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_unit ON payments(unit_id);
CREATE INDEX IF NOT EXISTS idx_payments_building ON payments(building_id, paid_on);

CREATE TABLE IF NOT EXISTS misc_income (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  source      TEXT NOT NULL DEFAULT '',
  amount      INTEGER NOT NULL,
  gained_on   TEXT NOT NULL,
  note        TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_misc_building ON misc_income(building_id, gained_on);

CREATE TABLE IF NOT EXISTS expense_categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
  description TEXT DEFAULT '',
  vendor      TEXT DEFAULT '',
  amount      INTEGER NOT NULL,
  spent_on    TEXT NOT NULL,
  allocate    INTEGER NOT NULL DEFAULT 1,   -- يُوزَّع على السكان كنسبة أسهم؟
  receipt_no  TEXT DEFAULT '',
  note        TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_building ON expenses(building_id, spent_on);

CREATE TABLE IF NOT EXISTS reminders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  due_on      TEXT NOT NULL,
  repeat      TEXT NOT NULL DEFAULT 'none' CHECK (repeat IN ('none','monthly','yearly')),
  done        INTEGER NOT NULL DEFAULT 0,
  note        TEXT DEFAULT '',
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_on, done);
`;

/** أدوات مساعدة عامة داخل الشرائح */
function isoDate(d = new Date()) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
function isoMonth(d = new Date()) { return isoDate(d).slice(0, 7); }
function monthAdd(period, n) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function applySchema(db) {
  db.manyStatements(SCHEMA);
  // ترقية قواعد بيانات أقدم: عمود مبلغ الوحدة المتروكة في rates
  const rateCols = db.all("PRAGMA table_info(rates)").map(c => c.name);
  if (!rateCols.includes('dis_amount')) {
    db.run('ALTER TABLE rates ADD COLUMN dis_amount INTEGER DEFAULT NULL');
  }
  // فئات مصروفات افتراضية
  const catCount = db.get('SELECT COUNT(*) AS c FROM expense_categories').c;
  if (!catCount) {
    for (const [ar, en] of [
      ['كهرباء | Electricity', 1], ['ماء | Water', 1], ['نظافة | Cleaning', 1],
      ['مصعد | Elevator', 1], ['أمن وحراسة | Security', 1], ['صيانة عامة | Maintenance', 1],
      ['متفرقات | Misc', 1]
    ]) {
      db.run('INSERT INTO expense_categories (name) VALUES (?)', [ar]);
    }
  }
  // إعدادات افتراضية
  const defaults = {
    currency: 'ج.م',
    min_fund: '0',
    org_name: 'هوم فيز',
    lang_default: 'ar'
  };
  for (const [k, v] of Object.entries(defaults)) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [k, v]);
  }
  // سر التوكن
  const secret = db.get("SELECT value FROM settings WHERE key='auth_secret'");
  if (!secret) {
    const crypto = require('crypto');
    db.run("INSERT INTO settings (key, value) VALUES ('auth_secret', ?)", [crypto.randomBytes(32).toString('hex')]);
  }
}

module.exports = { applySchema, isoDate, isoMonth, monthAdd };
