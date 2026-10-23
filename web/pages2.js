'use strict';
/* pages2.js — الرسوم الشهرية، الدفعات، إيرادات أخرى، المصروفات، التذكيرات */
import { S, api, h, esc, t, icon, fmtMoney, fmtNum, fmtDate, fmtMonth, toast, toastErr, confirmDlg, formModal, table, badge, scopeQ } from './core.js';
import { spin, refresh, buildingOptions, invalidateBuildings, currentBuildings, buildingName } from './pages1.js';

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const thisMonth = () => todayISO().slice(0, 7);

/* ============ الرسوم الشهرية ============ */
export async function pageDues(el) {
  el.innerHTML = spin();
  try {
    await buildingOptions();
    let bId = S.duesBuilding || (S.buildingsCache[0] ? String(S.buildingsCache[0].id) : '');
    const period = S.duesPeriod || thisMonth();
    let status = null;
    if (bId) status = await api.get(`/api/dues/status?building_id=${bId}&period=${period}`);
    el.innerHTML = `
      <div class="card"><div class="h-row">
        <h3 style="margin:0">${esc(t('dues_c'))} — ${esc(fmtMonth(period))}</h3><div class="grow"></div>
        <div class="filters">
          <select class="input" id="db" style="max-width:200px">${S.buildingsCache.map(b => `<option value="${b.id}" ${String(b.id) === bId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
          <input type="month" class="input" id="dper" value="${period}">
          <button class="btn" id="gen">${icon('refresh')} ${esc(t('generate'))}</button>
          ${status?.generated ? `<button class="btn ghost" id="delPeriod" style="color:var(--danger)">${icon('trash')} ${esc(t('regen_period'))}</button>` : ''}
        </div>
      </div>
      ${status?.generated ? `
        <div class="kpi-band" style="margin-bottom:14px">
          <div class="kpi"><div class="k">${esc(t('dues_total'))}</div><div class="v">${fmtMoney(status.total)}</div></div>
          <div class="kpi"><div class="k">${esc(t('claim_paid'))}</div><div class="v pos">${fmtMoney(status.paid_total)}</div></div>
          <div class="kpi"><div class="k">${esc(t('claim_remaining'))}</div><div class="v neg">${fmtMoney(Math.max(status.total - status.paid_total, 0))}</div></div>
          <div class="kpi"><div class="k">${esc(t('units'))}</div><div class="v">${fmtNum(status.invoices.length)}</div></div>
        </div>
      ` : `<div class="empty-note" style="margin-bottom:6px">${bId ? esc(t('not_generated')) : esc(t('no_buildings'))}</div>`}
      ${status?.generated ? table({
        rows: status.invoices, empty: t('none_yet'), cols: [
          { label: t('unit'), get: r => `<b>${esc(r.unit_code)}</b>` },
          { label: t('resident'), get: r => esc(r.resident_name) || '—' },
          { label: t('desc'), get: r => esc(r.description || r.rate_name || '') },
          { label: t('amount'), cls: 'num', get: r => fmtMoney(r.amount) },
          { label: t('paid'), cls: 'num', get: r => fmtMoney(r.paid_amount) },
          { label: t('status'), get: r => {
            const a = Number(r.amount), p = Number(r.paid_amount);
            return badge(p >= a ? t('inv_paid') : p > 0 ? t('inv_part') : t('inv_open'), p >= a ? 'ok' : p > 0 ? 'warn' : 'danger');
          } },
          { label: t('actions'), get: r => {
            const a = Number(r.amount), p = Number(r.paid_amount);
            const rest = Math.max(a - p, 0);
            return `<div class="actions">${rest > 0 && a > 0 ? `<button class="btn sm" data-pay="${r.id}" data-rest="${rest}" data-unit="${r.unit_id}" data-desc="${esc(r.description || r.rate_name || '')}">${icon('cash')} ${esc(t('pay_now'))}</button>` : ''}</div>`;
          } }
        ]
      }) : ''}
      </div>`;

    el.querySelector('#db').onchange = e => { S.duesBuilding = e.target.value; refresh(); };
    el.querySelector('#dper').onchange = e => { S.duesPeriod = e.target.value; refresh(); };
    el.querySelector('#gen').onclick = async () => {
      const btn = el.querySelector('#gen'); btn.disabled = true;
      try {
        const r = await api.post('/api/dues/generate', { building_id: Number(bId), period });
        toast(`${t('relaunched_ok')} (${r.created})`);
        refresh();
      } catch (e) { toastErr(e); btn.disabled = false; }
    };
    const delP = el.querySelector('#delPeriod');
    if (delP) delP.onclick = async () => {
      if (!(await confirmDlg(t('delete_period_warn')))) return;
      try { await api.del(`/api/dues/period?building_id=${bId}&period=${period}`); toast(t('saved')); refresh(); }
      catch (e) { if (e.key === 'invoice_has_payments') toast(t('period_has_payments'), 'err'); else toastErr(e); }
    };
    el.querySelectorAll('[data-pay]').forEach(btn => btn.onclick = () => {
      const unitId = Number(btn.dataset.unit), rest = Number(btn.dataset.rest);
      const label = buildingName(bId) + ' / ' + (status.invoices.find(i => String(i.id) === btn.dataset.pay)?.unit_code || '');
      quickPayDialog(label, unitId, rest, btn.dataset.desc);
    });
  } catch (e) { toastErr(e); }
}

/* دفعة سريعة مستقلة عن الصفحة (تُستعمل أيضاً من صفحة الدفعات) */
async function quickPayDialog(unitLabel, unitId, suggest, linkedDesc) {
  const values = await formModal({
    title: `${t('new_payment')} — ${unitLabel}`,
    fields: [
      { name: 'amount', label: t('amount'), type: 'money', required: true, value: suggest, hint: linkedDesc ? (t('pay_to_invoice') + ': ' + linkedDesc) : '' },
      { name: 'paid_on', label: t('date'), type: 'date', required: true, value: todayISO() },
      { name: 'method', label: t('method'), type: 'select', options: [{ value: 'cash', label: t('cash') }, { value: 'bank', label: t('bank') }, { value: 'online', label: t('online') }, { value: 'other', label: t('other') }], value: 'cash' },
      { name: 'receipt_no', label: t('receipt_no'), value: '' },
      { name: 'note', label: t('notes'), value: '' }
    ]
  });
  if (!values) return;
  try {
    await api.post('/api/payments', { unit_id: unitId, invoice_id: null, ...values, amount: values.amount });
    toast(t('saved')); refresh();
  } catch (e) { toastErr(e); }
}

/* ============ الدفعات ============ */
export async function pagePayments(el) {
  el.innerHTML = spin();
  try {
    await buildingOptions(t('all'));
    const [buildings, units, payments] = await Promise.all([
      api.get('/api/buildings'),
      api.get('/api/units'),
      api.get('/api/payments' + (scopeQ() ? '?' + scopeQ() + '&' : '?') + `to=${todayISO()}`)
    ]);
    const isAdmin = S.user.role !== 'resident';
    const total = payments.reduce((s, p) => s + Number(p.amount), 0);
    el.innerHTML = `
      <div class="card"><div class="h-row">
        <h3 style="margin:0">${esc(t('payments_c'))}</h3><div class="grow"></div>
        <div class="kpi" style="padding:8px 14px"><span class="k">${esc(t('total'))}</span> <b style="color:var(--ok)">${fmtMoney(total)}</b></div>
        ${isAdmin ? `<button class="btn" id="addP">${icon('plus')} ${esc(t('new_payment'))}</button>` : ''}
      </div>
      ${table({
        rows: payments, empty: t('no_payments'), cols: [
          { label: t('date'), get: r => esc(fmtDate(r.paid_on)) },
          { label: t('unit'), get: r => `<b>${esc(r.unit_code)}</b> · ${esc(r.building_name)}` },
          { label: t('resident'), get: r => esc(r.resident_name) || '—' },
          { label: t('method'), get: r => badge(t(r.method), 'soft') },
          { label: t('receipt_no'), get: r => esc(r.receipt_no) || '—' },
          { label: t('notes'), get: r => esc(r.note) || '—' },
          { label: t('amount'), cls: 'num', get: r => `<b style="color:var(--ok)">+ ${fmtMoney(r.amount)}</b>` },
          { label: t('actions'), get: r => isAdmin ? `<div class="actions">
            <button class="btn ghost sm" data-edit="${r.id}">${icon('edit')}</button>
            <button class="btn ghost sm" data-del="${r.id}" style="color:var(--danger)">${icon('trash')}</button></div>` : '' }
        ]
      })}
      </div>`;
    el.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
      const p = payments.find(x => String(x.id) === btn.dataset.del);
      if (!(await confirmDlg(t('confirm_delete')))) return;
      try { await api.del('/api/payments/' + p.id); toast(t('saved')); refresh(); } catch (e) { toastErr(e); }
    });
    el.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = async () => {
      const p = payments.find(x => String(x.id) === btn.dataset.edit);
      const v = await formModal({
        title: t('edit'),
        fields: [
          { name: 'amount', label: t('amount'), type: 'money', required: true, value: p.amount },
          { name: 'paid_on', label: t('date'), type: 'date', value: p.paid_on, required: true },
          { name: 'method', label: t('method'), type: 'select', options: [{ value: 'cash', label: t('cash') }, { value: 'bank', label: t('bank') }, { value: 'online', label: t('online') }, { value: 'other', label: t('other') }], value: p.method },
          { name: 'note', label: t('notes'), value: p.note }
        ]
      });
      if (!v) return;
      try { await api.patch('/api/payments/' + p.id, v); toast(t('saved')); refresh(); } catch (e) { toastErr(e); }
    });
    const addP = el.querySelector('#addP');
    if (addP) addP.onclick = async () => {
      const unitOptions = units.map(u => ({ value: String(u.id), label: u.building_name + ' / ' + u.code }));
      const v = await formModal({
        title: t('new_payment'), wide: true,
        fields: [
          { name: 'unit_id', label: t('pay_unit'), type: 'select', options: unitOptions, required: true },
          { name: 'amount', label: t('amount'), type: 'money', required: true },
          { name: 'paid_on', label: t('date'), type: 'date', value: todayISO(), required: true },
          { name: 'method', label: t('method'), type: 'select', options: [{ value: 'cash', label: t('cash') }, { value: 'bank', label: t('bank') }, { value: 'online', label: t('online') }, { value: 'other', label: t('other') }], value: 'cash' },
          { name: 'receipt_no', label: t('receipt_no'), value: '' },
          { name: 'note', label: t('notes'), value: '' }
        ]
      });
      if (!v) return;
      v.unit_id = Number(v.unit_id);
      try { await api.post('/api/payments', v); toast(t('saved')); refresh(); } catch (e) { toastErr(e); }
    };
  } catch (e) { toastErr(e); }
}

/* ============ إيرادات أخرى ============ */
export async function pageMisc(el) {
  el.innerHTML = spin();
  try {
    await buildingOptions(t('all'));
    const rows = await api.get('/api/misc-income' + (scopeQ() ? '?' + scopeQ() : ''));
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    el.innerHTML = `
      <div class="card"><div class="h-row">
        <h3 style="margin:0">${esc(t('misc_c'))}</h3><div class="grow"></div>
        <div class="kpi" style="padding:8px 14px"><span class="k">${esc(t('total'))}</span> <b style="color:var(--info)">${fmtMoney(total)}</b></div>
        <button class="btn" id="addM">${icon('plus')} ${esc(t('new_misc'))}</button>
      </div>
      ${table({
        rows, empty: t('no_misc'), cols: [
          { label: t('date'), get: r => esc(fmtDate(r.gained_on)) },
          { label: t('building'), get: r => esc(r.building_name) },
          { label: t('misc_source'), get: r => `<b>${esc(r.source) || esc(t('none_f'))}</b>` },
          { label: t('notes'), get: r => esc(r.note) || '—' },
          { label: t('amount'), cls: 'num', get: r => `<b style="color:var(--info)">+ ${fmtMoney(r.amount)}</b>` },
          { label: t('actions'), get: r => `<div class="actions">
            <button class="btn ghost sm" data-edit="${r.id}">${icon('edit')}</button>
            <button class="btn ghost sm" data-del="${r.id}" style="color:var(--danger)">${icon('trash')}</button></div>` }
        ]
      })}
      </div>`;
    el.querySelector('#addM').onclick = () => miscForm(null);
    el.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => miscForm(rows.find(r => String(r.id) === btn.dataset.edit)));
    el.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
      const r = rows.find(x => String(x.id) === btn.dataset.del);
      if (!(await confirmDlg(t('confirm_delete')))) return;
      try { await api.del('/api/misc-income/' + r.id); toast(t('saved')); refresh(); } catch (e) { toastErr(e); }
    });
  } catch (e) { toastErr(e); }
}
async function miscForm(r) {
  await buildingOptions();
  const v = await formModal({
    title: r ? t('edit') : t('new_misc'),
    wide: true,
    fields: [
      ...(S.buildingsCache.length > 1 ? [{ name: 'building_id', label: t('building'), type: 'select', options: S.buildingsCache.map(b => ({ value: String(b.id), label: b.name })), value: r?.building_id || S.scope, required: true }] : []),
      { name: 'source', label: t('misc_source'), required: true, value: r?.source },
      { name: 'amount', label: t('amount'), type: 'money', required: true, value: r?.amount },
      { name: 'gained_on', label: t('date'), type: 'date', value: r?.gained_on || todayISO(), required: true },
      { name: 'note', label: t('notes'), value: r?.note }
    ]
  });
  if (!v) return;
  v.building_id = Number(v.building_id || S.scope || S.buildingsCache[0]?.id);
  try {
    if (r) await api.patch('/api/misc-income/' + r.id, v); else await api.post('/api/misc-income', v);
    toast(t('saved')); refresh();
  } catch (e) { toastErr(e); }
}

/* ============ المصروفات ============ */
export async function pageExpenses(el) {
  el.innerHTML = spin();
  try {
    await buildingOptions(t('all'));
    const [deps, expenses] = await Promise.all([
      api.get('/api/expense-categories'),
      api.get('/api/expenses' + (scopeQ() ? '?' + scopeQ() : ''))
    ]);
    const total = expenses.reduce((s, r) => s + Number(r.amount), 0);
    el.innerHTML = `
      <div class="card"><div class="h-row">
        <h3 style="margin:0">${esc(t('expenses_c'))}</h3><div class="grow"></div>
        <div class="kpi" style="padding:8px 14px"><span class="k">${esc(t('total'))}</span> <b style="color:var(--warning)">${fmtMoney(total)}</b></div>
        <button class="btn ghost" id="addCat">${icon('plus')} ${esc(t('manage_categories'))}</button>
        <button class="btn" id="addE">${icon('plus')} ${esc(t('new_expense'))}</button>
      </div>
      ${table({
        rows: expenses, empty: t('no_expenses'), cols: [
          { label: t('date'), get: r => esc(fmtDate(r.spent_on)) },
          { label: t('building'), get: r => esc(r.building_name) },
          { label: t('category'), get: r => badge(esc(r.category_name) || t('none_f'), 'info') },
          { label: t('desc'), get: r => `<b>${esc(r.description)}</b>` },
          { label: t('vendor'), get: r => esc(r.vendor) || '—' },
          { label: t('allocate'), get: r => badge(Number(r.allocate) ? t('do_allocate') : t('no_allocate'), Number(r.allocate) ? 'soft' : 'ok') },
          { label: t('amount'), cls: 'num', get: r => `<b style="color:var(--danger)">− ${fmtMoney(r.amount)}</b>` },
          { label: t('actions'), get: r => `<div class="actions">
            <button class="btn ghost sm" data-edit="${r.id}">${icon('edit')}</button>
            <button class="btn ghost sm" data-del="${r.id}" style="color:var(--danger)">${icon('trash')}</button></div>` }
        ]
      })}
      </div>`;
    el.querySelector('#addE').onclick = () => expenseForm(null, deps);
    el.querySelector('#addCat').onclick = async () => {
      const v = await formModal({ title: t('new_category'), fields: [{ name: 'name', label: t('name'), required: true }] });
      if (!v) return;
      try { await api.post('/api/expense-categories', v); toast(t('saved')); refresh(); } catch (e) { toastErr(e); }
    };
    el.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => expenseForm(expenses.find(r => String(r.id) === btn.dataset.edit), deps));
    el.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
      const r = expenses.find(x => String(x.id) === btn.dataset.del);
      if (!(await confirmDlg(t('confirm_delete')))) return;
      try { await api.del('/api/expenses/' + r.id); toast(t('saved')); refresh(); } catch (e) { toastErr(e); }
    });
  } catch (e) { toastErr(e); }
}
async function expenseForm(r, depos) {
  await buildingOptions();
  const v = await formModal({
    title: r ? t('edit') : t('new_expense'), wide: true,
    fields: [
      ...(S.buildingsCache.length > 1 ? [{ name: 'building_id', label: t('building'), type: 'select', options: S.buildingsCache.map(b => ({ value: String(b.id), label: b.name })), value: r?.building_id || S.scope, required: true }] : []),
      { name: 'category_id', label: t('category'), type: 'select', options: [{ value: '', label: t('none') }, ...depos.map(c => ({ value: String(c.id), label: c.name }))], value: r?.category_id || '' },
      { name: 'description', label: t('desc'), required: true, value: r?.description },
      { name: 'vendor', label: t('vendor'), value: r?.vendor },
      { name: 'amount', label: t('amount'), type: 'money', required: true, value: r?.amount },
      { name: 'spent_on', label: t('date'), type: 'date', value: r?.spent_on || todayISO(), required: true },
      { name: 'allocate', label: t('allocate'), type: 'checkbox', value: r ? r.allocate : 1 },
      { name: 'receipt_no', label: t('receipt_no'), value: r?.receipt_no },
      { name: 'note', label: t('notes'), value: r?.note }
    ]
  });
  if (!v) return;
  v.building_id = Number(v.building_id || S.scope || S.buildingsCache[0]?.id);
  v.category_id = v.category_id ? Number(v.category_id) : null;
  try {
    if (r) await api.patch('/api/expenses/' + r.id, v); else await api.post('/api/expenses', v);
    toast(t('saved')); refresh();
  } catch (e) { toastErr(e); }
}

/* ============ التذكيرات ============ */
export async function pageReminders(el) {
  el.innerHTML = spin();
  try {
    await buildingOptions(t('all'));
    const rows = await api.get('/api/reminders' + (scopeQ() ? '?' + scopeQ() : ''));
    const open = rows.filter(r => !r.done).length;
    const today = todayISO();
    el.innerHTML = `
      <div class="card"><div class="h-row">
        <h3 style="margin:0">${esc(t('reminders_c'))} ${open ? badge(open, 'danger') : ''}</h3><div class="grow"></div>
        <button class="btn" id="addR">${icon('plus')} ${esc(t('new_reminder'))}</button>
      </div>
      ${table({
        rows, empty: t('no_reminders'), cols: [
          { label: t('due_on'), get: r => {
            const late = !r.done && r.due_on < today;
            return `<b style="color:${late ? 'var(--danger)' : 'inherit'}">${esc(fmtDate(r.due_on))}</b> ${late ? badge(t('overdue'), 'danger') : r.due_on === today ? badge(t('today'), 'warn') : ''}`;
          } },
          { label: t('name'), get: r => `<b>${esc(r.title)}</b>` },
          { label: t('building'), get: r => esc(r.building_name) || badge(t('all_buildings'), 'soft') },
          { label: t('repeat'), get: r => esc(t('repeat_' + r.repeat)) },
          { label: t('notes'), get: r => esc(r.note) || '—' },
          { label: t('status'), get: r => badge(r.done ? t('done') : t('upcoming'), r.done ? 'ok' : 'info') },
          { label: t('actions'), get: r => `<div class="actions">
            <button class="btn ghost sm" data-tog="${r.id}">${r.done ? t('mark_open') : t('mark_done')}</button>
            <button class="btn ghost sm" data-edit="${r.id}">${icon('edit')}</button>
            <button class="btn ghost sm" data-del="${r.id}" style="color:var(--danger)">${icon('trash')}</button></div>` }
        ]
      })}
      </div>`;
    el.querySelector('#addR').onclick = () => reminderForm(null);
    el.querySelectorAll('[data-tog]').forEach(btn => btn.onclick = async () => {
      const r = rows.find(x => String(x.id) === btn.dataset.tog);
      try { await api.patch('/api/reminders/' + r.id, { done: r.done ? 0 : 1 }); refresh(); } catch (e) { toastErr(e); }
    });
    el.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => reminderForm(rows.find(r => String(r.id) === btn.dataset.edit)));
    el.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
      const r = rows.find(x => String(x.id) === btn.dataset.del);
      if (!(await confirmDlg(t('confirm_delete')))) return;
      try { await api.del('/api/reminders/' + r.id); toast(t('saved')); refresh(); } catch (e) { toastErr(e); }
    });
  } catch (e) { toastErr(e); }
}
async function reminderForm(r) {
  await buildingOptions();
  const v = await formModal({
    title: r ? t('edit') : t('new_reminder'), wide: true,
    fields: [
      { name: 'title', label: t('reminder_title'), required: true, value: r?.title },
      { name: 'due_on', label: t('due_on'), type: 'date', value: r?.due_on || todayISO(), required: true },
      { name: 'building_id', label: t('building_general'), type: 'select', options: [{ value: '', label: t('all_buildings') }, ...S.buildingsCache.map(b => ({ value: String(b.id), label: b.name }))], value: r?.building_id || '' },
      { name: 'repeat', label: t('repeat'), type: 'select', options: [{ value: 'none', label: t('repeat_none') }, { value: 'monthly', label: t('repeat_monthly') }, { value: 'yearly', label: t('repeat_yearly') }], value: r?.repeat || 'none' },
      { name: 'note', label: t('notes'), type: 'textarea', value: r?.note }
    ]
  });
  if (!v) return;
  v.building_id = v.building_id ? Number(v.building_id) : null;
  try {
    if (r) await api.patch('/api/reminders/' + r.id, v); else await api.post('/api/reminders', v);
    toast(t('saved')); refresh();
  } catch (e) { toastErr(e); }
}

export { quickPayDialog };
