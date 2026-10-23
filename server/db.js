'use strict';
/**
 * db.js — طبقة قاعدة البيانات SQLite
 * يفضّل الوحدة المدمجة node:sqlite (بدون تبعيات).
 * إذا لم تتوفر (Node قديم) يتم الرجوع تلقائياً إلى sql.js (WASM).
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.HOMINA_DATA || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.HOMINA_DB || path.join(DATA_DIR, 'homina.db');

let driver = null;          // 'native' | 'sqljs'
let native = null;          // DatabaseSync
let sqljsDb = null;         // sql.js Database
let SQLFactory = null;      // sql.js الصف
let saveTimer = null;

/* ---------- أدوات ---------- */
function ensureDir() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function saveSqljs() {
  if (driver !== 'sqljs' || !sqljsDb) return;
  const bytes = Buffer.from(sqljsDb.export());
  atomicWrite(DB_PATH, bytes);
}

function scheduleSave() {
  if (driver !== 'sqljs') return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSqljs, 150);
}

function atomicWrite(target, data) {
  const tmp = target + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, target);
}

function exportDb() {
  if (driver === 'sqljs') return Buffer.from(sqljsDb.export());
  // native: استخدم VACUUM INTO داخل ملف مؤقت
  const tmp = DB_PATH + '.bak-' + Date.now();
  try { native.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`); return fs.readFileSync(tmp); }
  finally { try { fs.unlinkSync(tmp); } catch { /* ignore */ } }
}

/* ---------- تحميل sql.js ---------- */
async function initSqljs(dbFileExists) {
  const initSqlJs = require('sql.js');
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  SQLFactory = SQL;
  if (dbFileExists) {
    sqljsDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    sqljsDb = new SQL.Database();
    saveSqljs();
  }
}

/* ---------- التهيئة ---------- */
function init() {
  ensureDir();
  const exists = fs.existsSync(DB_PATH);
  try {
    const { DatabaseSync } = require('node:sqlite');
    native = new DatabaseSync(DB_PATH);
    try {
      native.exec('PRAGMA journal_mode = WAL;');
      native.exec('PRAGMA foreign_keys = ON;');
    } catch { /* ignore pragma issues */ }
    driver = 'native';
  } catch (e) {
    driver = 'sqljs'; // يهيأ لاحقاً بشكل غير متزامن
  }
  return { driver, exists };
}

/* دوال موحّدة للسؤال والتغيير */
function rowsToObject({ columns, values }) {
  return values.map(v => {
    const o = {};
    columns.forEach((c, i) => { o[c] = v[i]; });
    return o;
  });
}

function all(sql, params = []) {
  if (driver === 'native') {
    const stmt = native.prepare(sql);
    return stmt.all(...params);
  }
  const stmt = sqljsDb.prepare(sql);
  stmt.bind(params);
  const out = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

function get(sql, params = []) {
  const r = all(sql, params);
  return r.length ? r[0] : undefined;
}

function run(sql, params = []) {
  let changes = 0, lastInsertRowid = 0;
  if (driver === 'native') {
    const stmt = native.prepare(sql);
    const info = stmt.run(...params);
    changes = Number(info.changes);
    lastInsertRowid = Number(info.lastInsertRowid);
  } else {
    sqljsDb.run(sql, params);
    changes = sqljsDb.getRowsModified();
    const r = get('SELECT last_insert_rowid() AS id');
    lastInsertRowid = r ? Number(r.id) : 0;
    scheduleSave();
  }
  return { changes, lastInsertRowid };
}

function exec(sql) {
  if (driver === 'native') native.exec(sql);
  else { sqljsDb.exec(sql); scheduleSave(); }
}

function manyStatements(sqlBlock) {
  if (driver === 'native') native.exec(sqlBlock);
  else { sqljsDb.exec(sqlBlock); scheduleSave(); }
}

function withTransaction(fn) {
  exec('BEGIN');
  try {
    const result = fn();
    exec('COMMIT');
    return result;
  } catch (e) {
    try { exec('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

/* نسخة احتياطية إلى ملف مسار */
function backupTo(destPath) {
  const data = exportDb();
  fs.writeFileSync(destPath, data);
  return destPath;
}

/* استرجاع من بايتات قاعدة بيانات */
function restoreFromBuffer(bytes) {
  if (driver === 'native') {
    native.close();
  } else {
    sqljsDb.close();
  }
  // نسخة أمان من القاعدة الحالية
  try { fs.copyFileSync(DB_PATH, DB_PATH + '.' + Date.now() + '.bak'); } catch { /* ignore */ }
  atomicWrite(DB_PATH, bytes);
  if (driver === 'native') {
    const { DatabaseSync } = require('node:sqlite');
    native = new DatabaseSync(DB_PATH);
  } else {
    sqljsDb = new SQLFactory.Database(bytes);
  }
  return Promise.resolve();
}

module.exports = {
  init, initSqljs, all, get, run, exec, manyStatements, withTransaction,
  exportDb, restoreFromBuffer, DATA_DIR, DB_PATH,
  get driver() { return driver; }
};
