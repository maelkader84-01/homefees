'use strict';
/**
 * stop-server.js — إيقاف خادم هومينا بأمان (يفكّ قفل ملف homina.db)
 * بدون PowerShell: يعتمد على wmic/taskkill المتوفرين في ويندوز.
 */
const { execSync } = require('child_process');

function killByName(name) {
  try {
    execSync(`taskkill /F /IM ${name} /T`, { stdio: 'pipe' });
    console.log(`[stop] أوقفت جميع عمليات ${name}`);
  } catch { /* لم توجد عمليات بهذا الاسم */ }
}

function findNodeServerPids() {
  try {
    const out = execSync('wmic process where "name=\'node.exe\'" get ProcessId,CommandLine /format:csv', { encoding: 'utf8' });
    const pids = [];
    for (const line of out.split(/\r?\n/)) {
      if (!/index\.js/.test(line)) continue;
      const m = line.match(/(\d+)\s*$/);
      if (m) pids.push(Number(m[1]));
    }
    return pids;
  } catch { return []; }
}

const pids = findNodeServerPids();
for (const pid of pids) {
  try { process.kill(pid); console.log('[stop] أوقفت عملية الخادم ' + pid); }
  catch (e) { console.log('[stop] تعذّر إيقاف ' + pid + ': ' + e.message); }
}
killByName('Homina-Portable-1.0.0.exe');
killByName('Homina.exe');
killByName('electron.exe');

console.log('[stop] تم — أصبح ملف القاعدة حراً الآن (يمكن نقله أو ضغطه).');
