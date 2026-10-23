'use strict';
/**
 * logic.js — قواعد العمل المالية
 * رصيد الوحدة = إجمالي الرسوم المستحقة + حصة المصروفات − إجمالي الدفعات
 * كل المبالغ بالقروش (سنت).
 */
const { isoDate } = require('./schema');

/** return rows: [{unit_id, shares}, ...] لكل وحدات المبنى مع إجمالي الأسهم/المساحات */
function unitShares(db, buildingId, basis) {
  const units = db.all('SELECT id, shares, area FROM units WHERE building_id = ?', [buildingId]);
  const total = basis === 'area' ? units.reduce((s, u) => s + (+u.area || 0), 0)
    : units.reduce((s, u) => s + (+u.shares || 0), 0);
  return { units, total };
}

/** توزيع مبلغ (قروش) على الوحدات حسب الأساس مع معالجة بضعة قروش متبقية */
function distribute(amount, units, total, basis) {
  if (!units.length) return [];
  if (basis === 'equal' || !total) {
    const base = Math.floor(amount / units.length);
    let rem = amount - base * units.length;
    return units.map(u => {
      const extra = rem > 0 ? 1 : 0;
      rem -= extra;
      return { unit_id: u.id, amount: base + extra };
    });
  }
  let remaining = amount;
  const rows = units.map((u, i) => {
    const val = basis === 'area' ? (+u.area || 0) : (+u.shares || 0);
    let amt;
    if (i === units.length - 1) {
      amt = remaining; // آخر وحدة تأخذ الباقي لضمان التطابق التام
    } else {
      amt = Math.floor(amount * val / total);
      remaining -= amt;
    }
    return { unit_id: u.id, amount: amt };
  });
  return rows;
}

/** توليد رسوم فترة لمبنى (مُكرِّر: يخطو الموجود) */
function generateDues(db, buildingId, period, { skipExisting = true } = {}) {
  const rates = db.all('SELECT * FROM rates WHERE building_id = ? AND active = 1', [buildingId]);
  if (!rates.length) return { created: 0, skipped: 0 };

  // الوحدات المأهولة = بها ساكن مفعّل (يستخدم الوحدة فعليًا)
  const occupied = new Set(db.all(
    `SELECT DISTINCT unit_id FROM residents WHERE active = 1
       AND unit_id IN (SELECT id FROM units WHERE building_id = ?)`, [buildingId]).map(r => r.unit_id));

  const cache = {};
  const getUnits = (basis) => {
    const key = basis || 'equal';
    if (!cache[key]) cache[key] = unitShares(db, buildingId, key).units;
    return { units: cache[key], total: unitShares(db, buildingId, key).total };
  };

  let created = 0, skipped = 0;
  db.withTransaction(() => {
    for (const rate of rates) {
      let rows;
      if (rate.dis_amount != null) {
        // وضع المبلغين: المأهولة تدفع amount لكل وحدة، والمتروكة تدفع dis_amount لكل وحدة
        rows = getUnits(rate.distribution || 'equal').units.map(u => ({
          unit_id: u.id,
          amount: occupied.has(u.id) ? rate.amount : rate.dis_amount
        }));
      } else {
        const basis = rate.distribution || 'equal';
        const { units, total } = getUnits(basis);
        rows = distribute(rate.amount, units, total, basis);
      }
      for (const r of rows) {
        if (!r.amount) continue;
        const exists = db.get(
          'SELECT id FROM invoices WHERE unit_id = ? AND rate_id = ? AND period = ?',
          [r.unit_id, rate.id, period]);
        if (exists) { skipped++; continue; }
        db.run(
          `INSERT INTO invoices (building_id, unit_id, rate_id, kind, description, period, amount)
           VALUES (?, ?, ?, 'rate', ?, ?, ?)`,
          [buildingId, r.unit_id, rate.id, rate.name, period, r.amount]);
        created++;
      }
    }
  });
  return { created, skipped };
}

/* ---------- الحسابات المالية ---------- */

/** حسابات مجمعة لكل وحدة داخل نطاق (مبنى/كل المباني) */
function unitBalances(db, buildingId) {
  const buildingFilter = buildingId ? 'AND building_id = ?' : '';
  const p = buildingId ? [buildingId] : [];
  const units = db.all(
    `SELECT u.id, u.code, u.type, u.shares, u.area, u.building_id, b.name AS building_name,
            COALESCE((SELECT name FROM residents r WHERE r.unit_id = u.id AND r.active = 1 LIMIT 1), '') AS resident_name,
            COALESCE((SELECT phone FROM residents r WHERE r.unit_id = u.id AND r.active = 1 LIMIT 1), '') AS resident_phone
     FROM units u JOIN buildings b ON b.id = u.building_id
     ${buildingId ? 'WHERE u.building_id = ?' : ''}
     ORDER BY b.name, u.code`, p);

  const invoiced = {};
  for (const r of db.all(
    `SELECT unit_id, SUM(amount) AS s FROM invoices ${buildingId ? 'WHERE building_id = ?' : ''} GROUP BY unit_id`, p))
    invoiced[r.unit_id] = Number(r.s);

  const paid = {};
  for (const r of db.all(
    `SELECT unit_id, SUM(amount) AS s FROM payments ${buildingId ? 'WHERE building_id = ?' : ''} GROUP BY unit_id`, p))
    paid[r.unit_id] = Number(r.s);

  // توزيع المصروفات المفعّل لها التوزيع حسب أسهم الوحدات داخل كل مبنى
  const billed = {};
  for (const bld of db.all('SELECT id FROM buildings' + (buildingId ? ' WHERE id = ?' : ''), p)) {
    const { units: us, total } = unitShares(db, bld.id, 'shares');
    if (!us.length || !total) continue;
    const exp = db.all(
      `SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE building_id = ? AND allocate = 1`, [bld.id]);
    const totalExp = Number(exp[0].s) || 0;
    for (const u of us) {
      billed[u.id] = Math.floor(totalExp * ((+u.shares || 0) / total));
    }
    // الباقي (عدد القروش المفقود) يوزَّع على الوحدات من الأعلى
    const allocated = us.reduce((s, u) => s + (billed[u.id] || 0), 0);
    let rem = totalExp - allocated;
    for (const u of us) { if (rem > 0) { billed[u.id] += 1; rem--; } }
  }

  return units.map(u => {
    const inv = invoiced[u.id] || 0, pay = paid[u.id] || 0, exp = billed[u.id] || 0;
    return { ...u, invoiced: inv, paid: pay, expenses_share: exp, balance: inv + exp - pay };
  });
}

/** ملخص مالي عام للنطاق */
function fundSummary(db, buildingId, from, to) {
  const whereB = buildingId ? 'AND building_id = ?' : '';
  const bp = buildingId ? [buildingId] : [];
  const q1 = db.all(`SELECT paid_on AS date, amount FROM payments WHERE 1=1 ${whereB}`, bp);
  const q2 = db.all(`SELECT gained_on AS date, amount FROM misc_income WHERE 1=1 ${whereB}`, bp);
  const q3 = db.all(`SELECT spent_on AS date, amount FROM expenses WHERE 1=1 ${whereB}`, bp);
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  let income = 0, misc = 0, exp = 0;
  for (const r of q1) if (inRange(r.date)) income += Number(r.amount);
  for (const r of q2) if (inRange(r.date)) misc += Number(r.amount);
  for (const r of q3) if (inRange(r.date)) exp += Number(r.amount);
  return { income, misc, expenses: exp, net: income + misc - exp };
}

/** سلسلة الأشهر الأخيرة (دخل/مصروف) */
function monthlySeries(db, buildingId, months = 6) {
  const out = [];
  const d = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    out.push({ month: ym });
  }
  const buildingFilter = buildingId ? 'AND building_id = ?' : '';
  const bp = buildingId ? [buildingId] : [];
  const payPeriods = db.all(
    `SELECT substr(paid_on, 1, 7) AS m, SUM(amount) AS s FROM payments WHERE 1=1 ${buildingFilter} GROUP BY m`, bp);
  const miscPeriods = db.all(
    `SELECT substr(gained_on, 1, 7) AS m, SUM(amount) AS s FROM misc_income WHERE 1=1 ${buildingFilter} GROUP BY m`, bp);
  const expPeriods = db.all(
    `SELECT substr(spent_on, 1, 7) AS m, SUM(amount) AS s FROM expenses WHERE 1=1 ${buildingFilter} GROUP BY m`, bp);
  const map = {};
  for (const r of payPeriods) map[r.m] = map[r.m] || { income: 0, misc: 0, expenses: 0 };
  for (const r of miscPeriods) (map[r.m] = map[r.m] || { income: 0, misc: 0, expenses: 0 }).misc += Number(r.s);
  for (const r of payPeriods) map[r.m].income += Number(r.s);
  for (const r of expPeriods) (map[r.m] = map[r.m] || { income: 0, misc: 0, expenses: 0 }).expenses = Number(r.s);
  return out.map(({ month }) => {
    const row = map[month] || { income: 0, misc: 0, expenses: 0 };
    return { month, ...row, total_in: row.income + row.misc, net: row.income + row.misc - row.expenses };
  });
}

/** تنبيهات ذكية */
function alerts(db, buildingId) {
  const list = [];
  const bp = buildingId ? [buildingId] : [];
  const whereB = buildingId ? 'AND building_id = ?' : '';

  // رصيد الصندوق
  const fund = Number(db.get(
    `SELECT COALESCE((SELECT SUM(amount) FROM payments WHERE 1=1 ${whereB}),0)
          + COALESCE((SELECT SUM(amount) FROM misc_income WHERE 1=1 ${whereB}),0)
          - COALESCE((SELECT SUM(amount) FROM expenses WHERE 1=1 ${whereB}),0) AS bal`,
    bp).bal) || 0;

  let minFund = Number(db.get("SELECT value FROM settings WHERE key='min_fund'")?.value) || 0;
  if (buildingId) { // لا نقارن عتبة المبنى إلا إذا حدّدها الإعدادات العامّة
    // نطبّق العتبة على كل المباني مجتمعة — للمبنى منفرداً نُخفِّضها بالنسبة عبر المقياس الإجمالي
    const totalUnits = Number(db.get('SELECT COUNT(*) AS c FROM units').c) || 1;
    const bUnits = Number(db.get('SELECT COUNT(*) AS c FROM units WHERE building_id = ?', [buildingId]).c) || 1;
    minFund = Math.round(minFund * (bUnits / totalUnits));
  }
  if (minFund > 0 && fund < minFund) {
    list.push({
      type: 'fund_low', level: 'danger',
      title_ar: `تنبيه: رصيد الصندوق منخفض (${fund / 100} < ${minFund / 100})`,
      title_en: `Alert: Fund balance is low (${(fund / 100).toFixed(2)} < ${(minFund / 100).toFixed(2)})`
    });
  }

  // متأخرات
  try {
    const units = unitBalances(db, buildingId);
    const owing = units.filter(u => u.balance > 0);
    if (owing.length) {
      list.push({
        type: 'arrears', level: 'warning',
        count: owing.length,
        total: owing.reduce((s, u) => s + u.balance, 0),
        title_ar: `وحدات عليها متأخرات: ${owing.length} بإجمالي ${(owing.reduce((s, u) => s + u.balance, 0)) / 100}`,
        title_en: `Units with outstanding balance: ${owing.length}, total ${(owing.reduce((s, u) => s + u.balance, 0) / 100).toFixed(2)}`
      });
    }
  } catch { /* ignore */ }

  // تذكيرات خلال 7 أيام
  const soon = db.all(
    `SELECT * FROM reminders WHERE done = 0 AND due_on <= date('now', '+7 days') ${whereB} ORDER BY due_on LIMIT 5`, bp);
  for (const r of soon) {
    list.push({
      type: 'reminder', level: 'info', reminder_id: r.id,
      title_ar: `تذكير: ${r.title} — ${r.due_on}`,
      title_en: `Reminder: ${r.title} — ${r.due_on}`
    });
  }
  return list;
}

module.exports = {
  distribute, generateDues, unitBalances, fundSummary, monthlySeries, alerts, unitShares, isoDate
};
