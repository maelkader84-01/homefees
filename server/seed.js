'use strict';
/**
 * seed.js — ضبط بيئة تجريبية / مسح البيانات
 */
const { isoDate, isoMonth, monthAdd } = require('./schema');

/* مولّد عشوائي ثابت لنتائج متكررة */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clearDemo(db) {
  db.withTransaction(() => {
    for (const t of ['users', 'payments', 'invoices', 'misc_income', 'expenses', 'reminders', 'rates', 'residents', 'units', 'buildings'])
      db.run(`DELETE FROM ${t} WHERE 1=1`);
  });
  console.log('[homefees] تم مسح جميع البيانات (المستخدمون والفئات والإعدادات بقيت)');
  return { ok: true };
}

function seedDemo(db, logicRef, { clear = true } = {}) {
  if (clear) clearDemo(db);

  const rnd = mulberry32(20261022);
  const today = new Date();
  const curMonth = isoMonth(today);

  // إعدادات: عتبة منبّه للصندوق لتجربة التنبيهات
  db.run("INSERT INTO settings (key,value) VALUES ('min_fund','15000') ON CONFLICT(key) DO UPDATE SET value='15000'");
  db.run("INSERT INTO settings (key,value) VALUES ('currency','ج.م') ON CONFLICT(key) DO UPDATE SET value='ج.م'");

  // 1) مبنيان
  const b1 = db.run("INSERT INTO buildings (name, address, notes) VALUES (?,?,?)",
    ['برج النخيل', 'شارع الجمهورية', 'بناء سكني 4 أدوار + 2 محل تجاري']).lastInsertRowid;
  const b2 = db.run("INSERT INTO buildings (name, address, notes) VALUES (?,?,?)",
    ['مجمع الورد', 'حي الأشجار', 'مجمع سكني من 3 مبانٍ موحّدة']).lastInsertRowid;

  // 2) وحدات
  const unitIds = [];
  for (let fl = 1; fl <= 4; fl++) {
    for (let i = 1; i <= 2; i++) {
      const r = db.run('INSERT INTO units (building_id, code, floor, area, shares, type) VALUES (?,?,?,?,?,?)',
        [b1, `${fl}0${i}`, fl, 120, 1, 'apartment']);
      unitIds.push(r.lastInsertRowid);
    }
  }
  const shop1 = db.run('INSERT INTO units (building_id, code, floor, area, shares, type) VALUES (?,?,?,?,?,?)',
    [b1, 'SHOP-1', 0, 60, 1, 'shop']).lastInsertRowid;
  const shop2 = db.run('INSERT INTO units (building_id, code, floor, area, shares, type) VALUES (?,?,?,?,?,?)',
    [b1, 'SHOP-2', 0, 80, 1, 'shop']).lastInsertRowid;
  unitIds.push(shop1, shop2);

  for (let i = 1; i <= 8; i++) {
    const r = db.run('INSERT INTO units (building_id, code, floor, area, shares, type) VALUES (?,?,?,?,?,?)',
      [b2, `W-${100 + i}`, Math.ceil(i / 3), 140, 1, 'apartment']);
    unitIds.push(r.lastInsertRowid);
  }

  // 3) سكان
  const namesAr = ['أحمد محمد', 'فاطمة الزهراء', 'محمد السيد', 'سارة أحمد', 'علي حسن', 'نور الدين', 'ليلى إبراهيم',
    'ياسر عبد الله', 'منى سمير', 'خالد كمال', 'ريم فاروق', 'طارق منصور', 'هالة ناصر', 'عمر رشاد',
    'داليا حاتم', 'حسام الدين', 'إيمان فؤاد', 'شريف الوليد', 'غادة المهدي', 'باسم عادل'];
  let idx = 0;
  for (const uid of unitIds) {
    const isTenant = rnd() < 0.3;
    db.run(`INSERT INTO residents (unit_id, name, phone, role, active, start_date) VALUES (?,?,?,?,1,?)`,
      [uid, namesAr[idx % namesAr.length], `010${String(Math.floor(rnd() * 90000000) + 10000000)}`,
        isTenant ? 'tenant' : 'owner', isoMonth(today) + '-01']);
    // ساكن سابق منتهي لبعض الوحدات
    if (rnd() < 0.2) {
      const y = curMonth.slice(0, 4);
      db.run(`INSERT INTO residents (unit_id, name, phone, role, active, start_date, end_date) VALUES (?,?,?,?,0,?,?)`,
        [uid, namesAr[(idx + 7) % namesAr.length], `011${String(Math.floor(rnd() * 90000000) + 10000000)}`,
          'tenant', `${y}-01-15`, `${y}-06-30`]);
    }
    idx++;
  }

  // 4) بنود رسوم
  const r1 = db.run(`INSERT INTO rates (building_id, name, amount, distribution) VALUES (?,?,?,?)`,
    [b1, 'صيانة شهرية', 25000, 'equal']).lastInsertRowid;
  const r2 = db.run(`INSERT INTO rates (building_id, name, amount, distribution) VALUES (?,?,?,?)`,
    [b1, 'مصعد', 8000, 'equal']).lastInsertRowid;
  const r3 = db.run(`INSERT INTO rates (building_id, name, amount, distribution) VALUES (?,?,?,?)`,
    [b1, 'نظافة وأمن', 6000, 'shares']).lastInsertRowid;
  const r4 = db.run(`INSERT INTO rates (building_id, name, amount, distribution) VALUES (?,?,?,?)`,
    [b2, 'صيانة شهرية', 35000, 'shares']).lastInsertRowid;
  const r5 = db.run(`INSERT INTO rates (building_id, name, amount, distribution) VALUES (?,?,?,?)`,
    [b2, 'نظافة وحدائق', 10000, 'equal']).lastInsertRowid;

  // 5) توليد رسوم الأشهر الأخيرة (3 أشهر ماضية + الحالي)
  const periods = [curMonth, monthAdd(curMonth, -1), monthAdd(curMonth, -2), monthAdd(curMonth, -3)];
  for (const p of periods) {
    logicRef.generateDues(db, b1, p);
    logicRef.generateDues(db, b2, p);
  }

  // 6) دفعات: ~87% تم السداد للأشهر الماضية، الحالي ~60%
  const invoices = db.all('SELECT * FROM invoices');
  for (const inv of invoices) {
    const isOld = inv.period < curMonth;
    const chance = isOld ? 0.87 : 0.55;
    if (rnd() < chance) {
      const day = Math.floor(rnd() * 27) + 1;
      const paidOn = `${inv.period}-${String(day).padStart(2, '0')}`;
      const partialChance = rnd() < 0.08;
      const amt = partialChance ? Math.floor(Number(inv.amount) * 0.5) : Number(inv.amount);
      db.run(`INSERT INTO payments (building_id, unit_id, invoice_id, amount, paid_on, method, receipt_no) VALUES (?,?,?,?,?,?,?)`,
        [inv.building_id, inv.unit_id, inv.id, amt, isOld ? paidOn : (today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(Math.min(day, today.getDate())).padStart(2, '0')),
          rnd() < 0.25 ? 'bank' : 'cash', `R-${inv.period.replace('-', '')}-${inv.unit_id}`]);
    }
  }

  // 7) مصروفات (آخر 4 أشهر)
  const cats = db.all('SELECT * FROM expense_categories');
  const vendors = ['شركة النور', 'مؤسسة الأمانة', 'شهرياً', 'متجر الوفاء', 'شركة الكهرباء', 'خدمات فنية'];
  const templates = [
    { desc: 'فاتورة كهرباء المناطق المشتركة', cat: 'كهرباء', base: 45000 },
    { desc: 'فاتورة مياه المناطق المشتركة', cat: 'ماء', base: 18000 },
    { desc: 'رواتب عمالة النظافة', cat: 'نظافة', base: 60000 },
    { desc: 'صناديق النظافة ومستلزماتها', cat: 'نظافة', base: 12000 },
    { desc: 'صيانة المصعد الشهرية', cat: 'مصعد', base: 25000 },
    { desc: 'ترميم رخام المدخل', cat: 'صيانة عامة', base: 14000 },
    { desc: 'أدوات تنظيف ومستلزمات', cat: 'متفرقات', base: 7000 }
  ];
  for (let m = 3; m >= 0; m--) {
    const period = monthAdd(curMonth, -m);
    for (const b of [b1, b2]) {
      for (const t of templates) {
        const cat = cats.find(c => c.name.includes(t.cat)) || cats[0];
        const amount = Math.floor(t.base * (0.7 + rnd() * 0.6));
        const day = Math.floor(rnd() * 27) + 1;
        db.run(`INSERT INTO expenses (building_id, category_id, description, vendor, amount, spent_on, allocate, receipt_no) VALUES (?,?,?,?,?,?,?,?)`,
          [b, cat.id, t.desc, vendors[Math.floor(rnd() * vendors.length)], amount,
          `${period}-${String(day).padStart(2, '0')}`, m % 2 === 1 ? 1 : 0, `E-${period}-${b}-${cat.id}`]);
      }
    }
  }
  // مصروف كبير لمرة (إصلاح مصعد المبنى الأول)
  db.run(`INSERT INTO expenses (building_id, category_id, description, vendor, amount, spent_on, allocate, receipt_no) VALUES (?,?,?,?,?,?,?,?)`,
    [b1, cats.find(c => c.name.includes('مصعد')).id, 'إصلاح محرك المصعد — قطع غيار', 'شركة الكهرباء', 180000, `${monthAdd(curMonth, -1)}-15`, 1, 'E-BIG-1']);

  // 8) إيرادات أخرى
  db.run(`INSERT INTO misc_income (building_id, source, amount, gained_on, note) VALUES (?,?,?,?,?)`,
    [b1, 'إيجار محل تجاري', 40000, `${curMonth}-05`, 'دفعة شهرية']);
  db.run(`INSERT INTO misc_income (building_id, source, amount, gained_on, note) VALUES (?,?,?,?,?)`,
    [b1, 'إيجار محل تجاري', 40000, `${monthAdd(curMonth, -1)}-05`, 'دفعة شهرية']);
  db.run(`INSERT INTO misc_income (building_id, source, amount, gained_on, note) VALUES (?,?,?,?,?)`,
    [b2, 'إيجار لوحة إعلانية', 15000, `${monthAdd(curMonth, -2)}-12`, 'لوحة على السياج الخارجي']);
  db.run(`INSERT INTO misc_income (building_id, source, amount, gained_on, note) VALUES (?,?,?,?,?)`,
    [b1, 'غرامة مخالفة اللوائح', 50000, `${monthAdd(curMonth, -2)}-20`, 'مخالفة عقد البناء مع الإدارة']);

  // 9) تذكيرات
  const d = (off) => {
    const x = new Date(today.getFullYear(), today.getMonth(), today.getDate() + off);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  db.run(`INSERT INTO reminders (building_id, title, due_on, repeat, note) VALUES (?,?,?,?,?)`,
    [b1, 'تحصيل اشتراكات الشهر', d(3), 'monthly', 'متابعة المتأخرات مع السكان']);
  db.run(`INSERT INTO reminders (building_id, title, due_on, repeat, note) VALUES (?,?,?,?,?)`,
    [b2, 'مراجعة عقد صيانة المصعد', d(10), 'yearly', '']);
  db.run(`INSERT INTO reminders (building_id, title, due_on, repeat, note) VALUES (?,?,?,?,?)`,
    [null, 'تجديد تأمين المباني', d(21), 'yearly', 'الاتصال بوكالة التأمين']);
  db.run(`INSERT INTO reminders (building_id, title, due_on, repeat, note) VALUES (?,?,?,?,?)`,
    [b1, 'تحصيل مساهمة إصلاح المصعد', d(-2), 'none', 'متابعة الوحدات التي لم تُسدد']);

  const counts = {
    buildings: Number(db.get('SELECT COUNT(*) AS c FROM buildings').c),
    units: Number(db.get('SELECT COUNT(*) AS c FROM units').c),
    invoices: Number(db.get('SELECT COUNT(*) AS c FROM invoices').c),
    payments: Number(db.get('SELECT COUNT(*) AS c FROM payments').c),
    expenses: Number(db.get('SELECT COUNT(*) AS c FROM expenses').c)
  };
  console.log('[homefees] بيانات تجريبية جاهزة:', JSON.stringify(counts));
  return counts;
}

module.exports = { seedDemo, clearDemo };

if (require.main === module) {
  const db = require('./db');
  const logic = require('./logic');
  const schema = require('./schema');
  db.init();
  schema.applySchema(db);
  const demo = process.argv.includes('--demo');
  if (demo) seedDemo(db, logic, { clear: true });
  else clearDemo(db);
}
