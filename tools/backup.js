'use strict';
/**
 * backup.js — نسخة احتياطية متسقة (تعمل حتى أثناء تشغيل الخادم)
 * الفكرة: VACUUM INTO يقرأ القاعدة عبر اتصال SQLite ثانٍ فلا تعارض مع ملفات wal/shm
 * ولا يُنتج نسخة تالفة نصف مكتوبة.
 * الاستخدام: node tools/backup.js   [يمرر مجلد الهدف عبر HOMINA_BACKUP_DIR]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.HOMINA_DATA || path.join(__dirname, '..', 'data');
const SRC = process.env.HOMINA_DB || path.join(DATA_DIR, 'homina.db');
const DEST_DIR = process.env.HOMINA_BACKUP_DIR || path.join(os.homedir(), 'Desktop', 'هومينا-نسخ-احتياطية');

if (!fs.existsSync(SRC)) {
  console.error('[backup] لمُعثر على قاعدة البيانات: ' + SRC);
  process.exit(1);
}

fs.mkdirSync(DEST_DIR, { recursive: true });
const now = new Date();
const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
const dest = path.join(DEST_DIR, `homina-${stamp}.db`);

const db = new DatabaseSync(SRC);
try {
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
} finally {
  db.close();
}

const size = fs.statSync(dest).size;
console.log('[backup] تم إنشاء نسخة احتياطية متسقة:');
console.log('  ' + dest + '  (' + Math.round(size / 1024) + ' KB)');

/* فتح مجلد النسخ للمستخدم */
try {
  const { spawn } = require('child_process');
  if (process.platform === 'win32') spawn('explorer', [dest.replace(/\//g, '\\')], { detached: true, stdio: 'ignore' }).unref();
} catch { /* ignore */ }
