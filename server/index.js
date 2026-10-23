'use strict';
/**
 * index.js — خادم هومينا (API + واجهة الويب)
 * تشغيل:  node server/index.js            (بدون فتح المتصفح)
 *          node server/index.js --open    (يفتح المتصفح تلقائياً)
 * كوحدة:   const homefees = require('./index'); homefees.start({ port, dataDir })
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const net = require('net');

const db = require('./db');
const { applySchema, isoDate, isoMonth, monthAdd } = require('./schema');
const logic = require('./logic');
const auth = require('./auth');

const APP_VERSION = '1.0.0';

/* ---------- صلاحيات وتحقق ---------- */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const uid = token && auth.parseToken(token);
  const user = uid && auth.userById(uid);
  if (!user || !user.active) return res.status(401).json({ error: 'unauthorized' });
  if (user.role === 'resident') {
    const p = req.path;
    const allowed = p.startsWith('/me/') || p.startsWith('/auth/')
      || (req.method === 'GET' && p === '/settings'); // عملة للعرض فقط
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
  } else if (user.role === 'manager' && p.startsWith('/users')) {
    return res.status(403).json({ error: 'forbidden' });
  }
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden_admin' });
  next();
}
function bad(res, key, status = 400) { return res.status(status).json({ error: key }); }

function toInt(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : NaN; }
function numField(v, name) {
  const n = toInt(v);
  if (!Number.isFinite(n) || n <= 0) throw Object.assign(new Error(`bad_field:${name}`), { key: `bad_field/${name}` });
  return n;
}
function strField(v, name, { required = false, max = 200 } = {}) {
  const s = String(v ?? '').trim();
  if (required && !s) throw Object.assign(new Error(`bad_field:${name}`), { key: `bad_field/${name}` });
  return s.slice(0, max);
}

/* ---------- التهيئة ---------- */
function ensureAdmin() {
  const c = Number(db.get('SELECT COUNT(*) AS c FROM users').c);
  if (!c) {
    db.run('INSERT INTO users (username, password_hash, name, role) VALUES (?,?,?,?)',
      ['admin', auth.hashPassword('admin123'), 'Administrator', 'admin']);
    console.log('[homefees] تم إنشاء مستخدم افتراضي: admin / admin123 (غيّر كلمة المرور!)');
  }
}

/* ---------- بناء التطبيق ---------- */
let _app = null;
function buildApp() {
  if (_app) return _app;
  const app = express();
  app.use(express.json({ limit: '64mb' }));

  const WEB_DIR = path.join(__dirname, '..', 'web');

  /* --- عام --- */
  app.get('/api/meta', (req, res) => res.json({ app: 'homefees', version: APP_VERSION }));

  app.post('/api/auth/login', (req, res) => {
    try {
      const username = strField(req.body?.username, 'username', { required: true, max: 60 });
      const password = String(req.body?.password ?? '');
      const user = auth.userByName(username);
      if (!user || !auth.verifyPassword(password, user.password_hash)) return bad(res, 'bad_credentials', 401);
      if (!user.active) return bad(res, 'user_disabled', 403);
      res.json({ token: auth.issueToken(user.id), user: auth.publicUser(user) });
    } catch (e) { bad(res, 'bad_request'); }
  });

  /* --- بعد المصادقة --- */
  app.use('/api', authMiddleware);

  app.get('/api/auth/me', (req, res) => res.json({ user: auth.publicUser(req.user) }));

  app.post('/api/auth/change-password', (req, res) => {
    const oldP = String(req.body?.old_password ?? '');
    const newP = String(req.body?.new_password ?? '');
    if (newP.length < 6) return bad(res, 'weak_password');
    const full = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!auth.verifyPassword(oldP, full.password_hash)) return bad(res, 'bad_credentials', 401);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [auth.hashPassword(newP), req.user.id]);
    res.json({ ok: true });
  });

  /* --- المستخدمون (admin) --- */
  app.get('/api/users', requireAdmin, (req, res) => {
    res.json(db.all('SELECT id, username, name, role, unit_id, active, created_at FROM users ORDER BY id'));
  });
  app.post('/api/users', requireAdmin, (req, res) => {
    try {
      const username = strField(req.body.username, 'username', { required: true, max: 60 });
      const name = strField(req.body.name, 'name', { required: true, max: 120 });
      const password = String(req.body.password ?? '');
      const role = ['admin', 'manager', 'resident'].includes(req.body.role) ? req.body.role : null;
      if (!role) return bad(res, 'bad_role');
      if (password.length < 6) return bad(res, 'weak_password');
      if (auth.userByName(username)) return bad(res, 'username_taken', 409);
      const unit_id = req.body.unit_id ? toInt(req.body.unit_id) : null;
      if (unit_id && !db.get('SELECT id FROM units WHERE id = ?', [unit_id])) return bad(res, 'bad_unit');
      if (role === 'resident' && !unit_id) return bad(res, 'resident_needs_unit');
      const r = db.run('INSERT INTO users (username, password_hash, name, role, unit_id) VALUES (?,?,?,?,?)',
        [username, auth.hashPassword(password), name, role, unit_id]);
      res.status(201).json({ id: r.lastInsertRowid });
    } catch (e) {
      const m = String(e.message || '');
      if (m.includes('UNIQUE')) return bad(res, 'username_taken', 409);
      if (e.key) return bad(res, e.key);
      bad(res, 'bad_request');
    }
  });
  app.patch('/api/users/:id', requireAdmin, (req, res) => {
    const id = toInt(req.params.id);
    const user = db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return bad(res, 'not_found', 404);
    try {
      const fields = [];
      const vals = [];
      if (req.body.name != null) { fields.push('name = ?'); vals.push(strField(req.body.name, 'name', { required: true, max: 120 })); }
      if (req.body.password) {
        if (String(req.body.password).length < 6) return bad(res, 'weak_password');
        fields.push('password_hash = ?'); vals.push(auth.hashPassword(req.body.password));
      }
      if (req.body.role != null) {
        const role = ['admin', 'manager', 'resident'].includes(req.body.role) ? req.body.role : null;
        if (!role) return bad(res, 'bad_role');
        const admins = Number(db.get("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND active=1").c);
        if (user.role === 'admin' && role !== 'admin' && admins <= 1) return bad(res, 'last_admin', 409);
        fields.push('role = ?'); vals.push(role);
      }
      if (req.body.unit_id !== undefined) {
        const uid = req.body.unit_id ? toInt(req.body.unit_id) : null;
        if (uid && !db.get('SELECT id FROM units WHERE id = ?', [uid])) return bad(res, 'bad_unit');
        fields.push('unit_id = ?'); vals.push(uid);
      }
      if (req.body.active !== undefined) {
        if (user.role === 'admin' && !Number(req.body.active)) {
          const admins = Number(db.get("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND active=1").c);
          if (admins <= 1) return bad(res, 'last_admin', 409);
        }
        fields.push('active = ?'); vals.push(Number(req.body.active) ? 1 : 0);
      }
      if (fields.length) db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...vals, id]);
      res.json({ ok: true });
    } catch (e) { bad(res, 'bad_request'); }
  });
  app.delete('/api/users/:id', requireAdmin, (req, res) => {
    const id = toInt(req.params.id);
    if (id === req.user.id) return bad(res, 'cannot_delete_self', 409);
    const user = db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return bad(res, 'not_found', 404);
    if (user.role === 'admin') {
      const admins = Number(db.get("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND active=1").c);
      if (admins <= 1) return bad(res, 'last_admin', 409);
    }
    db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ ok: true });
  });

  /* --- الإعدادات --- */
  const EDITABLE_SETTINGS = ['currency', 'min_fund', 'org_name'];
  app.get('/api/settings', (req, res) => {
    if (req.user.role === 'resident') {
      const currency = db.get("SELECT value FROM settings WHERE key='currency'")?.value || 'ج.م';
      return res.json({ currency });
    }
    const rows = db.all(`SELECT key, value FROM settings WHERE key IN (${EDITABLE_SETTINGS.map(() => '?').join(',')})`, EDITABLE_SETTINGS);
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  });
  app.put('/api/settings', (req, res) => {
    for (const k of EDITABLE_SETTINGS) {
      if (req.body?.[k] !== undefined) {
        let v = String(req.body[k]).slice(0, 120);
        if (k === 'min_fund') { const n = toInt(v); if (!Number.isFinite(n) || n < 0) return bad(res, 'bad_value'); v = String(n); }
        db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [k, v]);
      }
    }
    const rows = db.all(`SELECT key, value FROM settings WHERE key IN (${EDITABLE_SETTINGS.map(() => '?').join(',')})`, EDITABLE_SETTINGS);
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  });

  /* --- نسخ احتياطي / استرجاع --- */
  app.get('/api/backup', requireAdmin, (req, res) => {
    const buf = db.exportDb();
    res.setHeader('Content-Type', 'application/vnd.sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="homefees-backup-${isoDate()}.db"`);
    res.send(buf);
  });
  app.post('/api/restore',
    express.raw({ type: () => true, limit: '128mb' }),
    requireAdmin, async (req, res) => {
      try {
        if (!req.body || req.body.length < 16 || req.body.slice(0, 16).toString('hex') !== '53514c69746520666f726d61742033000')
          return bad(res, 'invalid_db_file');
        await db.restoreFromBuffer(req.body);
        applySchema(db);
        res.json({ ok: true });
      } catch (e) { bad(res, 'restore_failed', 500); }
    });

  /* --- المباني --- */
  app.get('/api/buildings', (req, res) => {
    const rows = db.all('SELECT * FROM buildings ORDER BY name').map(b => {
      const u = db.get('SELECT COUNT(*) AS units, 0 AS x FROM units WHERE building_id = ?', [b.id]);
      const r = db.get('SELECT COUNT(*) AS residents FROM residents r JOIN units u ON u.id = r.unit_id WHERE u.building_id = ? AND r.active = 1', [b.id]);
      const infl = db.get('SELECT COALESCE(SUM(amount),0) AS s FROM invoices WHERE building_id = ?', [b.id]);
      const payl = db.get('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE building_id = ?', [b.id]);
      const expl = db.get('SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE building_id = ?', [b.id]);
      const bll = db.get('SELECT COALESCE(SUM(amount),0) AS s FROM expenses e JOIN units un ON un.building_id = e.building_id WHERE e.building_id = ? AND e.allocate = 1', [b.id]);
      return {
        ...b,
        units_count: Number(u.units), residents_count: Number(r.residents),
        invoiced: Number(infl.s), collected: Number(payl.s), expenses: Number(expl.s),
        expenses_billed: Number(db.get(`SELECT COALESCE(SUM(am),0) AS s FROM (
            SELECT CAST(e.amount * (un.shares * 1.0) / (SELECT SUM(shares) FROM units WHERE building_id = e.building_id) AS INTEGER) AS am
            FROM expenses e JOIN units un ON un.building_id = e.building_id
            WHERE e.building_id = ? AND e.allocate = 1) t`, [b.id]).s)
      };
    });
    res.json(rows);
  });
  app.post('/api/buildings', (req, res) => {
    try {
      const name = strField(req.body.name, 'name', { required: true, max: 120 });
      const r = db.run('INSERT INTO buildings (name, address, notes) VALUES (?,?,?)',
        [name, strField(req.body.address ?? '', 'address', { max: 300 }), strField(req.body.notes ?? '', 'notes', { max: 500 })]);
      res.status(201).json({ id: r.lastInsertRowid });
    } catch (e) { bad(res, 'bad_request'); }
  });
  app.patch('/api/buildings/:id', (req, res) => {
    const id = toInt(req.params.id);
    const b = db.get('SELECT * FROM buildings WHERE id = ?', [id]);
    if (!b) return bad(res, 'not_found', 404);
    try {
      const name = req.body.name != null ? strField(req.body.name, 'name', { required: true, max: 120 }) : b.name;
      const address = req.body.address != null ? strField(req.body.address, 'address', { max: 300 }) : b.address;
      const notes = req.body.notes != null ? strField(req.body.notes, 'notes', { max: 500 }) : b.notes;
      db.run('UPDATE buildings SET name = ?, address = ?, notes = ? WHERE id = ?', [name, address, notes, id]);
      res.json({ ok: true });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.delete('/api/buildings/:id', (req, res) => {
    const id = toInt(req.params.id);
    const b = db.get('SELECT * FROM buildings WHERE id = ?', [id]);
    if (!b) return bad(res, 'not_found', 404);
    const units = Number(db.get('SELECT COUNT(*) AS c FROM units WHERE building_id = ?', [id]).c);
    if (units > 0 && req.query.force !== '1') return bad(res, 'building_not_empty', 409);
    db.withTransaction(() => {
      const tables = ['payments', 'invoices', 'misc_income', 'expenses', 'reminders', 'rates'];
      for (const t of tables) db.run(`DELETE FROM ${t} WHERE building_id = ?`, [id]);
      for (const u of db.all('SELECT id FROM units WHERE building_id = ?', [id])) {
        db.run('DELETE FROM residents WHERE unit_id = ?', [u.id]);
        db.run('DELETE FROM users WHERE unit_id = ?', [u.id]);
      }
      db.run('DELETE FROM units WHERE building_id = ?', [id]);
      db.run('DELETE FROM buildings WHERE id = ?', [id]);
    });
    res.json({ ok: true });
  });

  /* --- الوحدات --- */
  function unitRowFull(id) {
    const u = db.get(`
      SELECT u.*, b.name AS building_name,
        (SELECT r.name FROM residents r WHERE r.unit_id = u.id AND r.active = 1 ORDER BY r.id DESC LIMIT 1) AS resident_name
      FROM units u JOIN buildings b ON b.id = u.building_id WHERE u.id = ?`, [id]);
    return u;
  }
  app.get('/api/units', (req, res) => {
    const conditions = [], vals = [];
    if (req.query.building_id) { conditions.push('u.building_id = ?'); vals.push(toInt(req.query.building_id)); }
    if (req.query.q) { conditions.push('(u.code LIKE ? OR u.notes LIKE ?)'); const q = `%${req.query.q}%`; vals.push(q, q); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const rows = db.all(`
      SELECT u.*, b.name AS building_name,
        (SELECT r.name FROM residents r WHERE r.unit_id = u.id AND r.active = 1 ORDER BY r.id DESC LIMIT 1) AS resident_name,
        (SELECT r.phone FROM residents r WHERE r.unit_id = u.id AND r.active = 1 ORDER BY r.id DESC LIMIT 1) AS resident_phone
      FROM units u JOIN buildings b ON b.id = u.building_id
      ${where} ORDER BY b.name, u.code`, vals);
    res.json(rows);
  });
  app.post('/api/units', (req, res) => {
    try {
      const building_id = numField(req.body.building_id, 'building_id');
      if (!db.get('SELECT id FROM buildings WHERE id = ?', [building_id])) return bad(res, 'bad_building');
      const code = strField(req.body.code, 'code', { required: true, max: 40 });
      if (db.get('SELECT id FROM units WHERE building_id = ? AND code = ?', [building_id, code])) return bad(res, 'unit_code_taken', 409);
      const r = db.run(`INSERT INTO units (building_id, code, floor, area, shares, type, notes) VALUES (?,?,?,?,?,?,?)`,
        [building_id, code, toInt(req.body.floor) || 0, Number(req.body.area) || 0, toInt(req.body.shares) || 1,
        ['apartment', 'shop', 'office', 'parking', 'other'].includes(req.body.type) ? req.body.type : 'apartment',
          strField(req.body.notes ?? '', 'notes', { max: 300 })]);
      res.status(201).json(unitRowFull(r.lastInsertRowid));
    } catch (e) {
      if (e.key) return bad(res, e.key);
      if (String(e.message).includes('UNIQUE')) return bad(res, 'unit_code_taken', 409);
      bad(res, 'bad_request');
    }
  });
  app.patch('/api/units/:id', (req, res) => {
    const id = toInt(req.params.id);
    const u = db.get('SELECT * FROM units WHERE id = ?', [id]);
    if (!u) return bad(res, 'not_found', 404);
    try {
      const building_id = req.body.building_id !== undefined ? numField(req.body.building_id, 'building_id') : u.building_id;
      const code = req.body.code != null ? strField(req.body.code, 'code', { required: true, max: 40 }) : u.code;
      if (db.get('SELECT id FROM units WHERE building_id = ? AND code = ? AND id != ?', [building_id, code, id])) return bad(res, 'unit_code_taken', 409);
      if (building_id !== u.building_id && (Number(db.get('SELECT COUNT(*) AS c FROM invoices WHERE unit_id = ?', [id]).c) > 0)) return bad(res, 'unit_has_transactions', 409);
      db.run(`UPDATE units SET building_id = ?, code = ?, floor = ?, area = ?, shares = ?, type = ?, notes = ? WHERE id = ?`,
        [building_id, code, req.body.floor !== undefined ? (toInt(req.body.floor) || 0) : u.floor,
        req.body.area !== undefined ? (Number(req.body.area) || 0) : u.area,
        req.body.shares !== undefined ? (toInt(req.body.shares) || 1) : u.shares,
        req.body.type !== undefined && ['apartment', 'shop', 'office', 'parking', 'other'].includes(req.body.type) ? req.body.type : u.type,
        req.body.notes != null ? strField(req.body.notes, 'notes', { max: 300 }) : u.notes, id]);
      res.json(unitRowFull(id));
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.delete('/api/units/:id', (req, res) => {
    const id = toInt(req.params.id);
    const u = db.get('SELECT * FROM units WHERE id = ?', [id]);
    if (!u) return bad(res, 'not_found', 404);
    const hasTx = Number(db.get('SELECT COUNT(*) AS c FROM invoices WHERE unit_id = ?', [id]).c) ||
      Number(db.get('SELECT COUNT(*) AS c FROM payments WHERE unit_id = ?', [id]).c);
    if (hasTx && req.query.force !== '1') return bad(res, 'unit_has_transactions', 409);
    db.withTransaction(() => {
      if (req.query.force === '1') {
        db.run('DELETE FROM payments WHERE unit_id = ?', [id]);
        db.run('DELETE FROM invoices WHERE unit_id = ?', [id]);
      }
      db.run('DELETE FROM residents WHERE unit_id = ?', [id]);
      db.run('UPDATE users SET unit_id = NULL WHERE unit_id = ?', [id]);
      db.run('DELETE FROM units WHERE id = ?', [id]);
    });
    res.json({ ok: true });
  });

  /* --- السكان --- */
  app.get('/api/residents', (req, res) => {
    const conditions = [], vals = [];
    if (req.query.building_id) { conditions.push('u.building_id = ?'); vals.push(toInt(req.query.building_id)); }
    if (req.query.q) { conditions.push('(r.name LIKE ? OR r.phone LIKE ?)'); const q = `%${req.query.q}%`; vals.push(q, q); }
    if (req.query.role) { conditions.push('r.role = ?'); vals.push(req.query.role); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    res.json(db.all(`
      SELECT r.*, u.code AS unit_code, u.building_id, b.name AS building_name
      FROM residents r JOIN units u ON u.id = r.unit_id JOIN buildings b ON b.id = u.building_id
      ${where} ORDER BY b.name, u.code, r.id DESC`, vals));
  });
  app.post('/api/residents', (req, res) => {
    try {
      const unit_id = numField(req.body.unit_id, 'unit_id');
      if (!db.get('SELECT id FROM units WHERE id = ?', [unit_id])) return bad(res, 'bad_unit');
      const name = strField(req.body.name, 'name', { required: true, max: 120 });
      const role = ['owner', 'tenant'].includes(req.body.role) ? req.body.role : 'owner';
      const r = db.run(`INSERT INTO residents (unit_id, name, phone, email, role, active, start_date, end_date, notes)
        VALUES (?,?,?,?,?,?,?,?,?)`,
        [unit_id, name, strField(req.body.phone ?? '', 'phone', { max: 40 }), strField(req.body.email ?? '', 'email', { max: 120 }),
        role, req.body.active === 0 ? 0 : 1,
        strField(req.body.start_date ?? '', 'start_date', { max: 10 }),
        strField(req.body.end_date ?? '', 'end_date', { max: 10 }),
        strField(req.body.notes ?? '', 'notes', { max: 300 })]);
      res.status(201).json({ id: r.lastInsertRowid });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.patch('/api/residents/:id', (req, res) => {
    const id = toInt(req.params.id);
    const r0 = db.get('SELECT * FROM residents WHERE id = ?', [id]);
    if (!r0) return bad(res, 'not_found', 404);
    try {
      const unit_id = req.body.unit_id !== undefined ? numField(req.body.unit_id, 'unit_id') : r0.unit_id;
      if (!db.get('SELECT id FROM units WHERE id = ?', [unit_id])) return bad(res, 'bad_unit');
      db.run(`UPDATE residents SET unit_id = ?, name = ?, phone = ?, email = ?, role = ?, active = ?, start_date = ?, end_date = ?, notes = ? WHERE id = ?`,
        [unit_id,
        req.body.name != null ? strField(req.body.name, 'name', { required: true, max: 120 }) : r0.name,
        req.body.phone != null ? strField(req.body.phone, 'phone', { max: 40 }) : r0.phone,
        req.body.email != null ? strField(req.body.email, 'email', { max: 120 }) : r0.email,
        req.body.role !== undefined && ['owner', 'tenant'].includes(req.body.role) ? req.body.role : r0.role,
        req.body.active !== undefined ? (Number(req.body.active) ? 1 : 0) : r0.active,
        req.body.start_date !== undefined ? strField(req.body.start_date, 'start_date', { max: 10 }) : r0.start_date,
        req.body.end_date !== undefined ? strField(req.body.end_date, 'end_date', { max: 10 }) : r0.end_date,
        req.body.notes != null ? strField(req.body.notes, 'notes', { max: 300 }) : r0.notes, id]);
      res.json({ ok: true });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.delete('/api/residents/:id', (req, res) => {
    const r0 = db.get('SELECT * FROM residents WHERE id = ?', [toInt(req.params.id)]);
    if (!r0) return bad(res, 'not_found', 404);
    db.run('DELETE FROM residents WHERE id = ?', [r0.id]);
    res.json({ ok: true });
  });

  /* --- بنود الرسوم (الاشتراكات) --- */
  app.get('/api/rates', (req, res) => {
    const where = req.query.building_id ? 'WHERE building_id = ?' : '';
    res.json(db.all(`SELECT * FROM rates ${where} ORDER BY building_id, name`, req.query.building_id ? [toInt(req.query.building_id)] : []));
  });
  app.post('/api/rates', (req, res) => {
    try {
      const building_id = numField(req.body.building_id, 'building_id');
      if (!db.get('SELECT id FROM buildings WHERE id = ?', [building_id])) return bad(res, 'bad_building');
      const name = strField(req.body.name, 'name', { required: true, max: 120 });
      if (db.get('SELECT id FROM rates WHERE building_id = ? AND name = ?', [building_id, name])) return bad(res, 'rate_name_taken', 409);
      // مبلغ الوحدة المتروكة: اختياري (null = بدون مبلغين، 0 = المتروكة مجاناً)
      const disRaw = req.body.dis_amount;
      let dis = null;
      if (disRaw != null && disRaw !== '') {
        const n = toInt(disRaw);
        if (!Number.isFinite(n) || n < 0) throw Object.assign(new Error('bad_field:dis_amount'), { key: 'bad_field/dis_amount' });
        dis = n;
      }
      const r = db.run(`INSERT INTO rates (building_id, name, amount, distribution, dis_amount, active) VALUES (?,?,?,?,?,?)`,
        [building_id, name, numField(req.body.amount, 'amount'),
        ['equal', 'shares', 'area'].includes(req.body.distribution) ? req.body.distribution : 'equal',
          dis, req.body.active === 0 ? 0 : 1]);
      res.status(201).json({ id: r.lastInsertRowid });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.patch('/api/rates/:id', (req, res) => {
    const id = toInt(req.params.id);
    const r0 = db.get('SELECT * FROM rates WHERE id = ?', [id]);
    if (!r0) return bad(res, 'not_found', 404);
    try {
      const name = req.body.name != null ? strField(req.body.name, 'name', { required: true, max: 120 }) : r0.name;
      if (db.get('SELECT id FROM rates WHERE building_id = ? AND name = ? AND id != ?', [r0.building_id, name, id])) return bad(res, 'rate_name_taken', 409);
      let dis = r0.dis_amount; // افتراضياً نحافظ على القيمة (مهم لزر تفعيل/تعطيل)
      if (req.body.dis_amount !== undefined) {
        if (req.body.dis_amount == null || req.body.dis_amount === '') dis = null;
        else {
          const n = toInt(req.body.dis_amount);
          if (!Number.isFinite(n) || n < 0) throw Object.assign(new Error('bad_field:dis_amount'), { key: 'bad_field/dis_amount' });
          dis = n;
        }
      }
      db.run('UPDATE rates SET name = ?, amount = ?, distribution = ?, dis_amount = ?, active = ? WHERE id = ?',
        [name, req.body.amount !== undefined ? numField(req.body.amount, 'amount') : r0.amount,
        req.body.distribution !== undefined && ['equal', 'shares', 'area'].includes(req.body.distribution) ? req.body.distribution : r0.distribution,
          dis,
        req.body.active !== undefined ? (Number(req.body.active) ? 1 : 0) : r0.active, id]);
      res.json({ ok: true });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.delete('/api/rates/:id', (req, res) => {
    const id = toInt(req.params.id);
    const r0 = db.get('SELECT * FROM rates WHERE id = ?', [id]);
    if (!r0) return bad(res, 'not_found', 404);
    const used = Number(db.get('SELECT COUNT(*) AS c FROM invoices WHERE rate_id = ?', [id]).c);
    if (used) return bad(res, 'rate_in_use', 409);
    db.run('DELETE FROM rates WHERE id = ?', [id]);
    res.json({ ok: true });
  });

  /* --- الرسوم الشهرية (توليد / الفواتير) --- */
  app.post('/api/dues/generate', (req, res) => {
    try {
      const building_id = numField(req.body.building_id, 'building_id');
      const period = String(req.body.period ?? '');
      if (!/^\d{4}-\d{2}$/.test(period)) return bad(res, 'bad_period');
      if (!db.get('SELECT id FROM buildings WHERE id = ?', [building_id])) return bad(res, 'bad_building');
      if (period > isoMonth()) return bad(res, 'future_period');
      const r = logic.generateDues(db, building_id, period);
      res.json(r);
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.get('/api/dues/status', (req, res) => {
    const building_id = toInt(req.query.building_id);
    const period = String(req.query.period ?? '');
    if (!building_id || !/^\d{4}-\d{2}$/.test(period)) return res.json({ generated: false, invoices: [] });
    const invoices = db.all(`
      SELECT i.*, u.code AS unit_code,
        (SELECT r.name FROM residents r WHERE r.unit_id = i.unit_id AND r.active = 1 ORDER BY r.id DESC LIMIT 1) AS resident_name,
        COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid_amount
      FROM invoices i JOIN units u ON u.id = i.unit_id
      WHERE i.building_id = ? AND i.period = ? ORDER BY u.code`, [building_id, period]);
    res.json({
      generated: invoices.length > 0,
      total: invoices.reduce((s, i) => s + Number(i.amount), 0),
      paid_total: invoices.reduce((s, i) => s + Math.min(Number(i.paid_amount), Number(i.amount)), 0),
      invoices
    });
  });
  app.get('/api/invoices', (req, res) => {
    const conditions = [], vals = [];
    if (req.query.building_id) { conditions.push('i.building_id = ?'); vals.push(toInt(req.query.building_id)); }
    if (req.query.unit_id) { conditions.push('i.unit_id = ?'); vals.push(toInt(req.query.unit_id)); }
    if (req.query.period) { conditions.push('i.period = ?'); vals.push(String(req.query.period)); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    res.json(db.all(`
      SELECT i.*, u.code AS unit_code, r.name AS rate_name,
        COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid_amount
      FROM invoices i JOIN units u ON u.id = i.unit_id LEFT JOIN rates r ON r.id = i.rate_id
      ${where} ORDER BY i.period DESC, u.code LIMIT 2000`, vals));
  });
  app.post('/api/invoices', (req, res) => { // فاتورة مخصصة/غرامة
    try {
      const unit_id = numField(req.body.unit_id, 'unit_id');
      const unit = db.get('SELECT * FROM units WHERE id = ?', [unit_id]);
      if (!unit) return bad(res, 'bad_unit');
      const amount = numField(req.body.amount, 'amount');
      const description = strField(req.body.description, 'description', { required: true, max: 200 });
      const period = /^\d{4}-\d{2}$/.test(String(req.body.period)) ? req.body.period : isoMonth();
      const r = db.run(`INSERT INTO invoices (building_id, unit_id, rate_id, kind, description, period, amount)
        VALUES (?, ?, NULL, 'custom', ?, ?, ?)`, [unit.building_id, unit_id, description, period, amount]);
      res.status(201).json({ id: r.lastInsertRowid });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.patch('/api/invoices/:id', (req, res) => {
    const id = toInt(req.params.id);
    const inv = db.get('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!inv) return bad(res, 'not_found', 404);
    try {
      if (req.body.amount !== undefined) db.run('UPDATE invoices SET amount = ? WHERE id = ?', [numField(req.body.amount, 'amount'), id]);
      if (req.body.description !== undefined) db.run('UPDATE invoices SET description = ? WHERE id = ?', [strField(req.body.description, 'description', { max: 200 }), id]);
      res.json({ ok: true });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.delete('/api/invoices/:id', (req, res) => {
    const id = toInt(req.params.id);
    const inv = db.get('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!inv) return bad(res, 'not_found', 404);
    const linked = Number(db.get('SELECT COUNT(*) AS c FROM payments WHERE invoice_id = ?', [id]).c);
    if (linked && req.query.force !== '1') return bad(res, 'invoice_has_payments', 409);
    db.withTransaction(() => {
      if (req.query.force === '1') db.run('UPDATE payments SET invoice_id = NULL WHERE invoice_id = ?', [id]);
      db.run('DELETE FROM invoices WHERE id = ?', [id]);
    });
    res.json({ ok: true });
  });
  app.delete('/api/dues/period', (req, res) => {
    const building_id = toInt(req.query.building_id);
    const period = String(req.query.period ?? '');
    if (!building_id || !/^\d{4}-\d{2}$/.test(period)) return bad(res, 'bad_request');
    const linked = Number(db.get(
      'SELECT COUNT(*) AS c FROM invoices i JOIN payments p ON p.invoice_id = i.id WHERE i.building_id = ? AND i.period = ?',
      [building_id, period]).c);
    if (linked) return bad(res, 'invoice_has_payments', 409);
    db.run('DELETE FROM invoices WHERE building_id = ? AND period = ?', [building_id, period]);
    res.json({ ok: true });
  });

  /* --- الدفعات --- */
  app.get('/api/payments', (req, res) => {
    const conditions = [], vals = [];
    if (req.query.building_id) { conditions.push('p.building_id = ?'); vals.push(toInt(req.query.building_id)); }
    if (req.query.unit_id) { conditions.push('p.unit_id = ?'); vals.push(toInt(req.query.unit_id)); }
    if (req.query.from) { conditions.push('p.paid_on >= ?'); vals.push(String(req.query.from)); }
    if (req.query.to) { conditions.push('p.paid_on <= ?'); vals.push(String(req.query.to)); }
    if (req.query.q) { conditions.push('(p.note LIKE ? OR p.receipt_no LIKE ? OR u.code LIKE ?)'); const q = `%${req.query.q}%`; vals.push(q, q, q); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    res.json(db.all(`
      SELECT p.*, u.code AS unit_code, b.name AS building_name, i.amount AS invoice_amount,
        (SELECT r.name FROM residents r WHERE r.unit_id = p.unit_id AND r.active = 1 ORDER BY r.id DESC LIMIT 1) AS resident_name
      FROM payments p JOIN units u ON u.id = p.unit_id JOIN buildings b ON b.id = p.building_id
      LEFT JOIN invoices i ON i.id = p.invoice_id
      ${where} ORDER BY p.paid_on DESC, p.id DESC LIMIT 2000`, vals));
  });
  function validPayment(body, res) {
    try {
      const unit_id = numField(body.unit_id, 'unit_id');
      const unit = db.get('SELECT * FROM units WHERE id = ?', [unit_id]);
      if (!unit) { bad(res, 'bad_unit'); return null; }
      const amount = numField(body.amount, 'amount');
      const paid_on = /^\d{4}-\d{2}-\d{2}$/.test(String(body.paid_on)) ? body.paid_on : isoDate();
      let invoice_id = body.invoice_id ? toInt(body.invoice_id) : null;
      if (invoice_id) {
        const inv = db.get('SELECT * FROM invoices WHERE id = ?', [invoice_id]);
        if (!inv || inv.unit_id !== unit_id) { bad(res, 'bad_invoice'); return null; }
      }
      return { unit, amount, paid_on, invoice_id, method: ['cash', 'bank', 'online', 'other'].includes(body.method) ? body.method : 'cash',
        receipt_no: strField(body.receipt_no ?? '', 'receipt_no', { max: 40 }), note: strField(body.note ?? '', 'note', { max: 300 }) };
    } catch (e) { bad(res, e.key || 'bad_request'); return null; }
  }
  app.post('/api/payments', (req, res) => {
    const v = validPayment(req.body, res);
    if (!v) return;
    const r = db.run(`INSERT INTO payments (building_id, unit_id, invoice_id, amount, paid_on, method, receipt_no, note)
      VALUES (?,?,?,?,?,?,?,?)`,
      [v.unit.building_id, v.unit.id, v.invoice_id, v.amount, v.paid_on, v.method, v.receipt_no, v.note]);
    res.status(201).json({ id: r.lastInsertRowid });
  });
  app.patch('/api/payments/:id', (req, res) => {
    const id = toInt(req.params.id);
    const p = db.get('SELECT * FROM payments WHERE id = ?', [id]);
    if (!p) return bad(res, 'not_found', 404);
    const amount = req.body.amount !== undefined ? numField(req.body.amount, 'amount') : p.amount;
    const paid_on = req.body.paid_on !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.paid_on)) ? req.body.paid_on : p.paid_on;
    const method = req.body.method !== undefined && ['cash', 'bank', 'online', 'other'].includes(req.body.method) ? req.body.method : p.method;
    const note = req.body.note !== undefined ? strField(req.body.note, 'note', { max: 300 }) : p.note;
    db.run('UPDATE payments SET amount = ?, paid_on = ?, method = ?, note = ? WHERE id = ?', [amount, paid_on, method, note, id]);
    res.json({ ok: true });
  });
  app.delete('/api/payments/:id', (req, res) => {
    const p = db.get('SELECT * FROM payments WHERE id = ?', [toInt(req.params.id)]);
    if (!p) return bad(res, 'not_found', 404);
    db.run('DELETE FROM payments WHERE id = ?', [p.id]);
    res.json({ ok: true });
  });

  /* --- إيرادات أخرى --- */
  app.get('/api/misc-income', (req, res) => {
    const conditions = [], vals = [];
    if (req.query.building_id) { conditions.push('m.building_id = ?'); vals.push(toInt(req.query.building_id)); }
    if (req.query.from) { conditions.push('m.gained_on >= ?'); vals.push(String(req.query.from)); }
    if (req.query.to) { conditions.push('m.gained_on <= ?'); vals.push(String(req.query.to)); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    res.json(db.all(`
      SELECT m.*, b.name AS building_name FROM misc_income m JOIN buildings b ON b.id = m.building_id
      ${where} ORDER BY m.gained_on DESC, m.id DESC LIMIT 2000`, vals));
  });
  app.post('/api/misc-income', (req, res) => {
    try {
      const building_id = numField(req.body.building_id, 'building_id');
      if (!db.get('SELECT id FROM buildings WHERE id = ?', [building_id])) return bad(res, 'bad_building');
      const r = db.run('INSERT INTO misc_income (building_id, source, amount, gained_on, note) VALUES (?,?,?,?,?)',
        [building_id, strField(req.body.source ?? '', 'source', { max: 120 }), numField(req.body.amount, 'amount'),
        /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.gained_on)) ? req.body.gained_on : isoDate(),
        strField(req.body.note ?? '', 'note', { max: 300 })]);
      res.status(201).json({ id: r.lastInsertRowid });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.patch('/api/misc-income/:id', (req, res) => {
    const m0 = db.get('SELECT * FROM misc_income WHERE id = ?', [toInt(req.params.id)]);
    if (!m0) return bad(res, 'not_found', 404);
    try {
      db.run('UPDATE misc_income SET source = ?, amount = ?, gained_on = ?, note = ? WHERE id = ?',
        [req.body.source !== undefined ? strField(req.body.source, 'source', { max: 120 }) : m0.source,
        req.body.amount !== undefined ? numField(req.body.amount, 'amount') : m0.amount,
        /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.gained_on)) ? req.body.gained_on : m0.gained_on,
        req.body.note !== undefined ? strField(req.body.note, 'note', { max: 300 }) : m0.note, m0.id]);
      res.json({ ok: true });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.delete('/api/misc-income/:id', (req, res) => {
    const m0 = db.get('SELECT * FROM misc_income WHERE id = ?', [toInt(req.params.id)]);
    if (!m0) return bad(res, 'not_found', 404);
    db.run('DELETE FROM misc_income WHERE id = ?', [m0.id]);
    res.json({ ok: true });
  });

  /* --- المصروفات --- */
  app.get('/api/expense-categories', (req, res) => {
    res.json(db.all('SELECT c.*, (SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id) AS usage FROM expense_categories c ORDER BY c.name'));
  });
  app.post('/api/expense-categories', (req, res) => {
    try {
      const name = strField(req.body.name, 'name', { required: true, max: 120 });
      if (db.get('SELECT id FROM expense_categories WHERE name = ?', [name])) return bad(res, 'exists', 409);
      const r = db.run('INSERT INTO expense_categories (name) VALUES (?)', [name]);
      res.status(201).json({ id: r.lastInsertRowid });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.delete('/api/expense-categories/:id', (req, res) => {
    const c = db.get('SELECT * FROM expense_categories WHERE id = ?', [toInt(req.params.id)]);
    if (!c) return bad(res, 'not_found', 404);
    if (Number(c.usage || 0) > 0 || Number(db.get('SELECT COUNT(*) AS n FROM expenses WHERE category_id = ?', [c.id]).n) > 0)
      return bad(res, 'category_in_use', 409);
    db.run('DELETE FROM expense_categories WHERE id = ?', [c.id]);
    res.json({ ok: true });
  });
  app.get('/api/expenses', (req, res) => {
    const conditions = [], vals = [];
    if (req.query.building_id) { conditions.push('e.building_id = ?'); vals.push(toInt(req.query.building_id)); }
    if (req.query.from) { conditions.push('e.spent_on >= ?'); vals.push(String(req.query.from)); }
    if (req.query.to) { conditions.push('e.spent_on <= ?'); vals.push(String(req.query.to)); }
    if (req.query.category_id) { conditions.push('e.category_id = ?'); vals.push(toInt(req.query.category_id)); }
    if (req.query.q) { conditions.push('(e.description LIKE ? OR e.vendor LIKE ? OR e.receipt_no LIKE ?)'); const q = `%${req.query.q}%`; vals.push(q, q, q); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    res.json(db.all(`
      SELECT e.*, b.name AS building_name, c.name AS category_name
      FROM expenses e JOIN buildings b ON b.id = e.building_id LEFT JOIN expense_categories c ON c.id = e.category_id
      ${where} ORDER BY e.spent_on DESC, e.id DESC LIMIT 2000`, vals));
  });
  app.post('/api/expenses', (req, res) => {
    try {
      const building_id = numField(req.body.building_id, 'building_id');
      if (!db.get('SELECT id FROM buildings WHERE id = ?', [building_id])) return bad(res, 'bad_building');
      const r = db.run(`INSERT INTO expenses (building_id, category_id, description, vendor, amount, spent_on, allocate, receipt_no, note)
        VALUES (?,?,?,?,?,?,?,?,?)`,
        [building_id, req.body.category_id ? toInt(req.body.category_id) : null,
        strField(req.body.description ?? '', 'description', { max: 200 }), strField(req.body.vendor ?? '', 'vendor', { max: 120 }),
        numField(req.body.amount, 'amount'),
        /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.spent_on)) ? req.body.spent_on : isoDate(),
        req.body.allocate !== undefined ? (Number(req.body.allocate) ? 1 : 0) : 1,
        strField(req.body.receipt_no ?? '', 'receipt_no', { max: 40 }),
        strField(req.body.note ?? '', 'note', { max: 300 })]);
      res.status(201).json({ id: r.lastInsertRowid });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.patch('/api/expenses/:id', (req, res) => {
    const e0 = db.get('SELECT * FROM expenses WHERE id = ?', [toInt(req.params.id)]);
    if (!e0) return bad(res, 'not_found', 404);
    try {
      db.run(`UPDATE expenses SET category_id = ?, description = ?, vendor = ?, amount = ?, spent_on = ?, allocate = ?, receipt_no = ?, note = ? WHERE id = ?`,
        [req.body.category_id !== undefined ? (req.body.category_id ? toInt(req.body.category_id) : null) : e0.category_id,
        req.body.description !== undefined ? strField(req.body.description, 'description', { max: 200 }) : e0.description,
        req.body.vendor !== undefined ? strField(req.body.vendor, 'vendor', { max: 120 }) : e0.vendor,
        req.body.amount !== undefined ? numField(req.body.amount, 'amount') : e0.amount,
        /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.spent_on)) ? req.body.spent_on : e0.spent_on,
        req.body.allocate !== undefined ? (Number(req.body.allocate) ? 1 : 0) : e0.allocate,
        req.body.receipt_no !== undefined ? strField(req.body.receipt_no, 'receipt_no', { max: 40 }) : e0.receipt_no,
        req.body.note !== undefined ? strField(req.body.note, 'note', { max: 300 }) : e0.note, e0.id]);
      res.json({ ok: true });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.delete('/api/expenses/:id', (req, res) => {
    const e0 = db.get('SELECT * FROM expenses WHERE id = ?', [toInt(req.params.id)]);
    if (!e0) return bad(res, 'not_found', 404);
    db.run('DELETE FROM expenses WHERE id = ?', [e0.id]);
    res.json({ ok: true });
  });

  /* --- التذكيرات --- */
  app.get('/api/reminders', (req, res) => {
    const conditions = [], vals = [];
    if (req.query.building_id) { conditions.push('(r.building_id = ? OR r.building_id IS NULL)'); vals.push(toInt(req.query.building_id)); }
    if (req.query.status === 'open') conditions.push('r.done = 0');
    if (req.query.status === 'done') conditions.push('r.done = 1');
    if (req.query.from) { conditions.push('r.due_on >= ?'); vals.push(String(req.query.from)); }
    if (req.query.to) { conditions.push('r.due_on <= ?'); vals.push(String(req.query.to)); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    res.json(db.all(`
      SELECT r.*, b.name AS building_name FROM reminders r LEFT JOIN buildings b ON b.id = r.building_id
      ${where} ORDER BY r.done ASC, r.due_on ASC LIMIT 1000`, vals));
  });
  app.post('/api/reminders', (req, res) => {
    try {
      const title = strField(req.body.title, 'title', { required: true, max: 200 });
      const due_on = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.due_on)) ? req.body.due_on : isoDate();
      const building_id = req.body.building_id ? toInt(req.body.building_id) : null;
      if (building_id && !db.get('SELECT id FROM buildings WHERE id = ?', [building_id])) return bad(res, 'bad_building');
      const r = db.run(`INSERT INTO reminders (building_id, title, due_on, repeat, note, created_by) VALUES (?,?,?,?,?,?)`,
        [building_id, title, due_on,
        ['none', 'monthly', 'yearly'].includes(req.body.repeat) ? req.body.repeat : 'none',
        strField(req.body.note ?? '', 'note', { max: 500 }), req.user.id]);
      res.status(201).json({ id: r.lastInsertRowid });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.patch('/api/reminders/:id', (req, res) => {
    const r0 = db.get('SELECT * FROM reminders WHERE id = ?', [toInt(req.params.id)]);
    if (!r0) return bad(res, 'not_found', 404);
    try {
      db.run('UPDATE reminders SET title = ?, due_on = ?, repeat = ?, note = ?, done = ? WHERE id = ?',
        [req.body.title !== undefined ? strField(req.body.title, 'title', { required: true, max: 200 }) : r0.title,
        req.body.due_on !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.due_on)) ? req.body.due_on : r0.due_on,
        req.body.repeat !== undefined && ['none', 'monthly', 'yearly'].includes(req.body.repeat) ? req.body.repeat : r0.repeat,
        req.body.note !== undefined ? strField(req.body.note, 'note', { max: 500 }) : r0.note,
        req.body.done !== undefined ? (Number(req.body.done) ? 1 : 0) : r0.done, r0.id]);
      res.json({ ok: true });
    } catch (e) { bad(res, e.key || 'bad_request'); }
  });
  app.delete('/api/reminders/:id', (req, res) => {
    const r0 = db.get('SELECT * FROM reminders WHERE id = ?', [toInt(req.params.id)]);
    if (!r0) return bad(res, 'not_found', 404);
    db.run('DELETE FROM reminders WHERE id = ?', [r0.id]);
    res.json({ ok: true });
  });

  /* --- لوحة المعلومات والأرصدة والتقارير --- */
  app.get('/api/dashboard', (req, res) => {
    const buildingId = req.query.building_id ? toInt(req.query.building_id) : null;
    const bp = buildingId ? [buildingId] : [];
    const counts = {
      buildings: Number(db.get('SELECT COUNT(*) AS c FROM buildings' + (buildingId ? ' WHERE id = ?' : ''), bp).c),
      units: Number(db.get('SELECT COUNT(*) AS c FROM units' + (buildingId ? ' WHERE building_id = ?' : ''), bp).c),
      residents: Number(db.get(`SELECT COUNT(*) AS c FROM residents r JOIN units u ON u.id = r.unit_id WHERE r.active = 1${buildingId ? ' AND u.building_id = ?' : ''}`, bp).c)
    };
    const now = isoMonth();
    const invMonth = Number(db.get(`SELECT COALESCE(SUM(amount),0) AS s FROM invoices WHERE period = ?${buildingId ? ' AND building_id = ?' : ''}`, [now, ...bp]).s);
    const payMonth = Number(db.get(`SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE substr(paid_on,1,7) = ?${buildingId ? ' AND building_id = ?' : ''}`, [now, ...bp]).s);
    const bals = logic.unitBalances(db, buildingId);
    const top = bals.filter(u => u.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 6);
    // آخر الحركات
    const payments = db.all(`SELECT p.*, u.code AS unit_code, b.name AS building_name FROM payments p JOIN units u ON u.id = p.unit_id JOIN buildings b ON b.id = p.building_id ${buildingId ? 'WHERE p.building_id = ?' : ''} ORDER BY p.paid_on DESC, p.id DESC LIMIT 12`, bp);
    const expenses = db.all(`SELECT e.*, b.name AS building_name, c.name AS category_name FROM expenses e JOIN buildings b ON b.id = e.building_id LEFT JOIN expense_categories c ON c.id = e.category_id ${buildingId ? 'WHERE e.building_id = ?' : ''} ORDER BY e.spent_on DESC, e.id DESC LIMIT 12`, bp);
    const misc = db.all(`SELECT m.*, b.name AS building_name FROM misc_income m JOIN buildings b ON b.id = m.building_id ${buildingId ? 'WHERE m.building_id = ?' : ''} ORDER BY m.gained_on DESC, m.id DESC LIMIT 12`, bp);
    const recent = [
      ...payments.map(p => ({ type: 'payment', date: p.paid_on, amount: Number(p.amount), building: p.building_name, label: `${p.unit_code} — ${p.note || p.method || ''} ${p.resident_name ? ('(' + p.resident_name + ')') : ''}` })),
      ...misc.map(m => ({ type: 'misc', date: m.gained_on, amount: Number(m.amount), building: m.building_name, label: m.source || m.note || '' })),
      ...expenses.map(e => ({ type: 'expense', date: e.spent_on, amount: Number(e.amount), building: e.building_name, label: e.description || (e.category_name || '') }))
    ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);

    res.json({
      counts,
      fund: logic.fundSummary(db, buildingId, null, null),
      month: { period: now, dues: invMonth, collected: payMonth, ratio: invMonth ? Math.min(payMonth / invMonth, 9.99) : null },
      series: logic.monthlySeries(db, buildingId, 6),
      top_arrears: top,
      recent,
      alerts: logic.alerts(db, buildingId)
    });
  });

  app.get('/api/balances', (req, res) => {
    res.json(logic.unitBalances(db, req.query.building_id ? toInt(req.query.building_id) : null));
  });

  /* كشف حساب وحدة (أو وحدة المستخدم الحالي إذا كان ساكناً) */
  app.get('/api/me/statement', (req, res) => {
    const unitId = req.user.unit_id;
    if (!unitId) return bad(res, 'no_unit_linked', 403);
    res.json(statementForUnit(db, unitId, logic));
  });

  /* شفافية الساكن: وضع صندوق مبناه + آخر مصروفاته */
  app.get('/api/me/fund', (req, res) => {
    const unitId = req.user.unit_id;
    if (!unitId) return bad(res, 'no_unit_linked', 403);
    const u = db.get('SELECT building_id FROM units WHERE id = ?', [unitId]);
    if (!u) return bad(res, 'no_unit_linked', 403);
    const from = `${new Date().getFullYear()}-01-01`;
    const fund = logic.fundSummary(db, u.building_id, from, null);
    const expenses = db.all(
      `SELECT e.spent_on AS date, COALESCE(c.name, '-') AS category, e.description, e.amount
         FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id
        WHERE e.building_id = ?
        ORDER BY e.spent_on DESC, e.id DESC LIMIT 30`, [u.building_id]);
    res.json({ year: new Date().getFullYear(), fund, expenses });
  });

  app.get('/api/statements/:unitId', (req, res) => {
    res.json(statementForUnit(db, toInt(req.params.unitId), logic));
  });

  app.get('/api/reports/summary', (req, res) => {
    const buildingId = req.query.building_id ? toInt(req.query.building_id) : null;
    const from = String(req.query.from ?? '') || null;
    const to = String(req.query.to ?? '') || null;
    const s = logic.fundSummary(db, buildingId, from, to);
    // صفوف شهرية
    const months = [];
    if (from && to) {
      let m = from.slice(0, 7); const toM = to.slice(0, 7);
      let guard = 0;
      while (m <= toM && guard < 600) { months.push(m); m = monthAdd(m, 1); guard++; }
    }
    const rows = [];
    const fs = buildingId ? 'AND building_id = ?' : '';
    const bp = buildingId ? [buildingId] : [];
    for (const mo of months) {
      const income = Number(db.get(`SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE substr(paid_on,1,7) = ? AND paid_on >= ? AND paid_on <= ? ${fs}`, [mo, from, to, ...bp]).s);
      const misc = Number(db.get(`SELECT COALESCE(SUM(amount),0) AS s FROM misc_income WHERE substr(gained_on,1,7) = ? AND gained_on >= ? AND gained_on <= ? ${fs}`, [mo, from, to, ...bp]).s);
      const exp = Number(db.get(`SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE substr(spent_on,1,7) = ? AND spent_on >= ? AND spent_on <= ? ${fs}`, [mo, from, to, ...bp]).s);
      rows.push({ month: mo, income, misc, expenses: exp, net: income + misc - exp });
    }
    let cum = 0;
    for (const r of rows) { cum += r.net; r.cumulative = cum; }
    res.json({ totals: s, rows });
  });

  app.get('/api/reports/by-category', (req, res) => {
    const buildingId = req.query.building_id ? toInt(req.query.building_id) : null;
    const conditions = [], vals = [];
    if (buildingId) conditions.push('e.building_id = ?');
    if (req.query.from) conditions.push('e.spent_on >= ?');
    if (req.query.to) conditions.push('e.spent_on <= ?');
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    if (buildingId) vals.push(buildingId);
    if (req.query.from) vals.push(String(req.query.from));
    if (req.query.to) vals.push(String(req.query.to));
    res.json(db.all(`
      SELECT COALESCE(c.name, '-') AS category, SUM(e.amount) AS total, COUNT(*) AS cnt
      FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id
      ${where} GROUP BY c.id ORDER BY total DESC`, vals));
  });

  app.get('/api/reports/arrears', (req, res) => {
    const buildingId = req.query.building_id ? toInt(req.query.building_id) : null;
    const rows = logic.unitBalances(db, buildingId).filter(u => u.balance > 0);
    // أقدم شهر غير مسدد لكل وحدة
    for (const u of rows) {
      const unpaid = db.get(`
        SELECT MIN(period) AS p FROM invoices i
        WHERE i.unit_id = ? AND i.amount > COALESCE((SELECT SUM(amount) FROM payments p2 WHERE p2.invoice_id = i.id), 0)`,
        [u.id]);
      u.oldest_unpaid = unpaid ? unpaid.p : null;
    }
    rows.sort((a, b) => b.balance - a.balance);
    res.json(rows);
  });

  app.get('/api/alerts', (req, res) => {
    res.json(logic.alerts(db, req.query.building_id ? toInt(req.query.building_id) : null));
  });

  /* --- بيانات تجريبية / مسح --- */
  const seedCtl = require('./seed');
  app.post('/api/demo/seed', requireAdmin, (req, res) => {
    const r = seedCtl.seedDemo(db, logic, { clear: true });
    res.json(r);
  });
  app.post('/api/demo/clear', requireAdmin, (req, res) => {
    const r = seedCtl.clearDemo(db);
    res.json(r);
  });

  /* --- واجهة الويب --- */
  app.use(express.static(WEB_DIR));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(WEB_DIR, 'index.html'));
    }
    next();
  });

  /* معالج رجوع الأخطاء */
  app.use((err, req, res, next) => {
    console.error('[homefees] error:', err);
    res.status(500).json({ error: 'server_error' });
  });

  return app;
}

/** كشف حساب وحدة موحدة */
function statementForUnit(db, unitId, logicRef) {
  const unit = db.get(`
    SELECT u.*, b.name AS building_name FROM units u JOIN buildings b ON b.id = u.building_id WHERE u.id = ?`, [unitId]);
  if (!unit) throw Object.assign(new Error('not_found'), { key: 'not_found' });
  const buildingId = unit.building_id;

  const invoices = db.all(`
    SELECT i.*, r.name AS rate_name,
      COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid_amount
    FROM invoices i LEFT JOIN rates r ON r.id = i.rate_id
    WHERE i.unit_id = ? ORDER BY i.period, i.id`, [unitId]);
  const payments = db.all('SELECT * FROM payments WHERE unit_id = ? ORDER BY paid_on, id', [unitId]);
  // حصة الوحدة من المصروفات الموزّعة
  const { units, total } = logicRef.unitShares(db, buildingId, 'shares');
  const shareFrac = total ? ((+unit.shares || 0) / total) : 0;
  const expenses = db.all('SELECT e.*, c.name AS category_name FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id WHERE e.building_id = ? AND e.allocate = 1 ORDER BY e.spent_on, e.id', [buildingId])
    .map(e => ({ ...e, share: Math.floor(Number(e.amount) * shareFrac) }));

  const invTotal = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const payTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const expTotal = expenses.reduce((s, e) => s + e.share, 0);

  // سجل زمني
  const ledger = [
    ...invoices.map(i => ({ date: i.period + '-01', type: 'invoice', label: i.kind === 'rate' ? (i.rate_name || '') : (i.description || ''), amount: Number(i.amount), direction: +1, paid: Number(i.paid_amount) })),
    ...expenses.map(e => ({ date: e.spent_on, type: 'expense_share', label: 'مشاركة في: ' + (e.description || e.category_name || ''), amount: e.share, direction: -1 })),
    ...payments.map(p => ({ date: p.paid_on, type: 'payment', label: p.note || p.receipt_no || p.method, amount: Number(p.amount), direction: -1, method: p.method }))
  ].sort((a, b) => (a.date > b.date ? 1 : -1));
  let run = 0;
  for (const row of ledger) { run += row.direction === -1 ? -row.amount : row.amount; row.running = run; }

  return {
    unit, invoices, payments, expenses,
    totals: { invoiced: invTotal, paid: payTotal, expenses_share: expTotal, balance: invTotal + expTotal - payTotal },
    ledger
  };
}

/* ---------- الإقلاع ---------- */
async function start({ port = 4751, dataDir, openBrowser = false, silent = false } = {}) {
  if (dataDir) process.env.HOMINA_DATA = dataDir;
  const info = db.init();
  if (info.driver === 'sqljs') await db.initSqljs(fs.existsSync(db.DB_PATH));
  applySchema(db);
  ensureAdmin();
  const app = buildApp();
  const finalPort = await findFreePort(port);
  await new Promise((resolve, reject) => {
    const server = app.listen(finalPort, '0.0.0.0');
    server.once('listening', resolve);
    server.once('error', reject);
  });
  if (!silent) {
    console.log(`[homefees] v${APP_VERSION} يعمل الآن — القاعدة: ${db.DB_PATH}`);
    console.log(`[homefees] الواجهة: http://localhost:${finalPort}`);
  }
  if (openBrowser) {
    const { exec } = require('child_process');
    const url = `http://localhost:${finalPort}`;
    if (process.platform === 'win32') exec(`start "" "${url}"`);
    else if (process.platform === 'darwin') exec(`open "${url}"`);
    else exec(`xdg-open "${url}"`);
  }
  return { port: finalPort, app, dataPath: db.DB_PATH, driver: info.driver };
}

function findFreePort(startPort) {
  return new Promise((resolve) => {
    const tryPort = (p, attempts) => {
      const srv = net.createServer();
      srv.once('error', () => {
        if (attempts > 20) return resolve(startPort);
        tryPort(p + 1, attempts + 1);
      });
      srv.once('listening', () => srv.close(() => resolve(p)));
      // الفحص بـ 0.0.0.0 مطابق للربط الحقيقي — على ويندوز ربط 127.0.0.1 ينجح خداعياً فوق منفذ محجوز
      srv.listen(p, '0.0.0.0');
    };
    tryPort(startPort, 0);
  });
}

if (require.main === module) {
  const envPort = Number(process.env.PORT) || 4751;
  start({ port: envPort, openBrowser: process.argv.includes('--open') }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { start, buildApp, APP_VERSION };
