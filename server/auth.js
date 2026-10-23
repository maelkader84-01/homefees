'use strict';
/**
 * auth.js — المستخدمون، التشفير، الرموز
 */
const crypto = require('crypto');
const db = require('./db');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const calc = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calc, 'hex'));
}

function authSecret() {
  const r = db.get("SELECT value FROM settings WHERE key='auth_secret'");
  return r ? r.value : 'dev-secret';
}

function issueToken(userId) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 يوم
  const payload = `${userId}.${exp}`;
  const sig = crypto.createHmac('sha256', authSecret()).update(payload).digest('base64url');
  return Buffer.from(payload).toString('base64url') + '.' + sig;
}

function parseToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [b64, sig] = token.split('.');
  const payload = Buffer.from(b64, 'base64url').toString();
  const expect = crypto.createHmac('sha256', authSecret()).update(payload).digest('base64url');
  if (sig.length !== expect.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const [uid, exp] = payload.split('.');
  if (Number(exp) * 1000 < Date.now()) return null;
  return Number(uid);
}

function userById(id) {
  return db.get('SELECT id, username, name, role, unit_id, active FROM users WHERE id = ?', [id]);
}

function userByName(username) {
  return db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [username]);
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, name: u.name, role: u.role, unit_id: u.unit_id };
}

/** التحقق من الصلاحيات: admin > manager > resident */
function can(user, ability) {
  if (!user) return false;
  const role = user.role;
  if (role === 'admin') return true;
  if (role === 'manager') return !['users'].includes(ability);
  if (role === 'resident') {
    return ['me', 'settings_read'].includes(ability);
  }
  return false;
}

module.exports = { hashPassword, verifyPassword, issueToken, parseToken, userById, userByName, publicUser, can };
