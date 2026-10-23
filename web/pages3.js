'use strict';
/* pages3.js — التقارير + كشوف + المستخدمون + الإعدادات + الدخول + كشف الساكن */
import { S, api, h, esc, t, icon, fmtMoney, fmtNum, fmtDate, fmtMonth, toast, toastErr, confirmDlg, formModal, table, badge, barChart, donut, scopeQ, clearSession, downloadCSV, applyLangUI } from './core.js';
import { spin, refresh, buildingOptions, invalidateBuildings } from './pages1.js';
import { quickPayDialog } from './pages2.js';

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const thisMonth = () => todayISO().slice(0, 7);
const monthStart = (ym) => ym + '-01';
const monthEnd = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ============ التقارير ============ */
export async function pageReports(el, tab = 'summary') {
  el.innerHTML = spin();
  try {
    await buildingOptions();
    const now = new Date();
    const st = S.repState = S.repState || {
      tab: 'summary',
      ym: thisMonth(),
      range: 'month',
      unitId: ''
    };
    let from, to;
    if (st.range === 'month') { from = monthStart(st.ym); to = monthEnd(st.ym); }
    else if (st.range === 'year') { from = st.ym.slice(0, 4) + '-01-01'; to = st.ym.slice(0, 4) + '-12-31'; }
    else { from = st.customFrom || (st.ym.slice(0, 4) + '-01-01'); to = st.customTo || todayISO(); }
    const q = (scopeQ() ? scopeQ() + '&' : '') + (from ? `from=${from}&to=${to}` : '');

    el.innerHTML = `
      <div class="card">
        <div class="h-row">
          <h3 style="margin:0">${esc(t('reports_c'))}</h3><div class="grow"></div>
          <div class="filters">
            <select class="input" id="repRange">
              <option value="month" ${st.range === 'month' ? 'selected' : ''}>${esc(t('month'))}</option>
              <option value="year" ${st.range === 'year' ? 'selected' : ''}>${esc(t('year'))}</option>
              <option value="custom" ${st.range === 'custom' ? 'selected' : ''}>${esc(t('period'))}</option>
            </select>
            <input type="month" class="input" id="repYm" value="${esc(st.ym)}">
            <input type="date" class="input" id="repFrom" value="${esc(st.customFrom || from)}" style="display:${st.range === 'custom' ? '' : 'none'}">
            <input type="date" class="input" id="repTo" value="${esc(st.customTo || to)}" style="display:${st.range === 'custom' ? '' : 'none'}">
            <button class="btn ghost sm" id="repPrint">${icon('print')} ${esc(t('print'))}</button>
          </div>
        </div>
        <div class="pill-nav">
          ${['summary', 'categories', 'arrears', 'statement'].map(k => `<button data-tab="${k}" class="${st.tab === k ? 'active' : ''}">${esc(t('tab_' + k))}</button>`).join('')}
        </div>
        <div id="repBody">${spin()}</div>
      </div>`;

    el.querySelector('#repRange').onchange = e => { st.range = e.target.value; renderBody(); };
    el.querySelector('#repYm').onchange = e => { st.ym = e.target.value; renderBody(); };
    el.querySelector('#repFrom').onchange = e => { st.customFrom = e.target.value; renderBody(); };
    el.querySelector('#repTo').onchange = e => { st.customTo = e.target.value; renderBody(); };
    el.querySelector('#repPrint').onclick = () => window.print();
    el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { st.tab = b.dataset.tab; renderBody(); });

    renderBody();

    async function renderBody() {
      el.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === st.tab));
      const body = el.querySelector('#repBody');
      body.innerHTML = spin();
      if (st.tab === 'summary') return body.innerHTML = await tabSummary();
      if (st.tab === 'categories') return body.innerHTML = await tabCategories();
      if (st.tab === 'arrears') return body.innerHTML = await tabArrears();
      if (st.tab === 'statement') return body.innerHTML = await tabStatement();
    }

    async function tabSummary() {
      const rep = await api.get('/api/reports/summary?' + q + (scopeQ() ? (scopeQ() + '&' + `from=${from}&to=${to}`) : `from=${from}&to=${to}`));
      return `<div class="kpi-band" style="margin-bottom:16px">
          <div class="kpi"><div class="k">${esc(t('t_income'))}</div><div class="v pos">${fmtMoney(rep.totals.income + rep.totals.misc)}</div>
            <div class="k" style="margin-top:3px">${esc(t('move_payment'))}: ${fmtMoney(rep.totals.income)} · ${esc(t('move_misc'))}: ${fmtMoney(rep.totals.misc)}</div></div>
          <div class="kpi"><div class="k">${esc(t('t_expenses'))}</div><div class="v neg">${fmtMoney(rep.totals.expenses)}</div></div>
          <div class="kpi"><div class="k">${esc(t('t_net'))}</div><div class="v ${rep.totals.net >= 0 ? 'pos' : 'neg'}">${fmtMoney(rep.totals.net)}</div></div>
        </div>
        ${rep.rows.length === 0 ? `<div class="empty-note">${esc(t('no_reports_data'))}</div>` : `
        <div style="margin-bottom:14px"><div class="chart-wrap"><canvas id="repChart" style="height:220px"></canvas></div>
          <div class="legend"><span class="li"><span class="sw" style="background:#0d9488"></span>${esc(t('month_income'))}</span>
          <span class="li"><span class="sw" style="background:#f59e0b"></span>${esc(t('month_net'))}</span></div></div>
        ${table({
          rows: rep.rows, cols: [
            { label: t('month'), get: r => `<b>${esc(fmtMonth(r.month))}</b>` },
            { label: t('move_payment'), cls: 'num', get: r => fmtMoney(r.income) },
            { label: t('move_misc'), cls: 'num', get: r => fmtMoney(r.misc) },
            { label: t('t_expenses'), cls: 'num', get: r => fmtMoney(r.expenses) },
            { label: t('month_net'), cls: 'num', get: r => `<b style="color:${r.net >= 0 ? 'var(--ok)' : 'var(--danger)'}">${fmtMoney(r.net)}</b>` },
            { label: t('cumulative'), cls: 'num', get: r => fmtMoney(r.cumulative) }
          ]
        })}
        <div style="margin-top:10px;text-align:end"><button class="btn ghost sm" id="repCsv">${icon('download')} ${esc(t('export_csv'))}</button></div>`}`;
      const cv = el.querySelector('#repChart');
      if (cv) barChart(cv, rep.rows.map(r => r.month.slice(5) + '/' + r.month.slice(2, 4)), [
        { label: t('month_income'), color: '#0d9488', values: rep.rows.map(r => r.income + r.misc) },
        { label: t('month_net'), color: '#f59e0b', values: rep.rows.map(r => r.net) }
      ]);
      const csv = el.querySelector('#repCsv');
      if (csv) csv.onclick = () => downloadCSV(`homefees-report-${from}_${to}.csv`,
        ['month', 'income', 'misc', 'expenses', 'net', 'cumulative'],
        rep.rows.map(r => [fmtMonth(r.month), r.income / 100, r.misc / 100, r.expenses / 100, r.net / 100, r.cumulative / 100]));
    }

    async function tabCategories() {
      const rows = await api.get('/api/reports/by-category?' + (scopeQ() ? scopeQ() + '&' : '') + `from=${from}&to=${to}`);
      if (!rows.length) return `<div class="empty-note">${esc(t('no_reports_data'))}</div>`;
      const total = rows.reduce((s, r) => s + Number(r.total), 0);
      const colors = ['#0d9488', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#10b981', '#64748b'];
      const html = `<div class="cat-grid">
        <div><canvas id="catDonut" class="cat-canvas"></canvas></div>
        <div style="width:100%">
          ${table({
          rows, cols: [
            { label: t('category'), get: r => {
              const c = colors[rows.indexOf(r) % colors.length];
              return `<span class="badge" style="background:${c}1f;color:${c}">${esc(r.category)}</span>`;
            } },
            { label: t('count_units'), cls: 'num', get: r => fmtNum(r.cnt) },
            { label: '%', cls: 'num', get: r => fmtNum(Number(r.total) / total * 100, 1) + '%' },
            { label: t('amount'), cls: 'num', get: r => `<b>${fmtMoney(r.total)}</b>` }
          ]
        })}
        </div></div>`;
      setTimeout(() => {
        const cv = el.querySelector('#catDonut');
        if (cv) donut(cv, rows.slice(0, 8).map((r, i) => ({ value: Number(r.total), color: colors[i] || '#64748b' })));
      }, 30);
      return html;
    }

    async function tabArrears() {
      const rows = await api.get('/api/reports/arrears' + (scopeQ() ? '?' + scopeQ() : ''));
      const total = rows.reduce((s, r) => s + Number(r.balance), 0);
      return `<div class="kpi-band" style="margin-bottom:14px">
          <div class="kpi"><div class="k">${esc(t('arrears_total'))}</div><div class="v neg">${fmtMoney(total)}</div></div>
          <div class="kpi"><div class="k">${esc(t('count_units'))}</div><div class="v">${fmtNum(rows.filter(r => Number(r.balance) > 0).length)}</div></div>
        </div>
        ${rows.filter(r => Number(r.balance) > 0).length === 0 ? `<div class="empty-note">🎉 ${esc(t('none_yet'))}</div>` : table({
        rows: rows.filter(r => Number(r.balance) > 0), empty: t('none_yet'), cols: [
          { label: t('unit'), get: r => `<b>${esc(r.code)}</b> · ${esc(r.building_name)}` },
          { label: t('resident'), get: r => esc(r.resident_name) || '—' },
          { label: t('phone'), get: r => esc(r.resident_phone) || '—' },
          { label: t('oldest_unpaid'), get: r => r.oldest_unpaid ? badge(esc(fmtMonth(r.oldest_unpaid)), 'warn') : '—' },
          { label: t('invoiced'), cls: 'num', get: r => fmtMoney(r.invoiced) },
          { label: t('expenses_billed'), cls: 'num', get: r => fmtMoney(r.expenses_share) },
          { label: t('paid'), cls: 'num', get: r => fmtMoney(r.paid) },
          { label: t('balance'), cls: 'num', get: r => `<b style="color:var(--danger)">${fmtMoney(r.balance)}</b>` }
        ]
      })}
        <div style="margin-top:10px;text-align:end"><button class="btn ghost sm" id="arrCsv">${icon('download')} ${esc(t('export_csv'))}</button></div>`;
      const csv = el.querySelector('#arrCsv');
      if (csv) csv.onclick = () => downloadCSV(`homefees-arrears-${todayISO()}.csv`,
        ['unit', 'building', 'resident', 'phone', 'oldest_unpaid', 'invoiced', 'expenses_share', 'paid', 'balance'],
        rows.filter(r => Number(r.balance) > 0).map(r => [r.code, r.building_name, r.resident_name, r.resident_phone, r.oldest_unpaid, r.invoiced / 100, r.expenses_share / 100, r.paid / 100, r.balance / 100]));
    }

    async function tabStatement() {
      const units = await api.get('/api/units' + (scopeQ() ? '?' + scopeQ() : ''));
      if (!st.unitId && units.length) st.unitId = String(units[0].id);
      const html = `
        <div class="h-row">
          <select class="input" id="stUnit" style="max-width:280px">
            ${units.map(u => `<option value="${u.id}" ${String(u.id) === st.unitId ? 'selected' : ''}>${esc(u.building_name + ' / ' + u.code)}</option>`).join('')}
          </select>
        </div>
        <div id="stmtArea">${st.unitId ? '<div class="boot-splash" style="min-height:120px"><div class="spin"></div></div>' : `<div class="empty-note">${esc(t('no_units'))}</div>`}</div>`;
      const sel = el.querySelector('#stUnit');
      if (sel) sel.onchange = e => { st.unitId = e.target.value; loadStmt(); };
      if (st.unitId) loadStmt();
      return html;
      async function loadStmt() {
        const area = el.querySelector('#stmtArea');
        if (!area || !st.unitId) return;
        area.innerHTML = spin();
        try {
          const st2 = await api.get('/api/statements/' + st.unitId);
          area.innerHTML = statementHtml(st2, { printable: false });
          area.querySelector('[data-payopen]')?.addEventListener('click', async () => {
            const unpaid = st2.totals.balance;
            await quickPayDialog(st2.unit.building_name + ' / ' + st2.unit.code, Number(st2.unit.id), Math.max(unpaid, 0), '');
          });
        } catch (e) { toastErr(e); area.innerHTML = ''; }
      }
    }
  } catch (e) { toastErr(e); }
}

/* ============ كشف وحدة (HTML) ============ */
export function statementHtml(st, { printable = true } = {}) {
  const T = st.totals;
  const ledgerRows = st.ledger.map(row => {
    const kind = row.type;
    const color = kind === 'invoice' ? 'var(--warning)' : (kind === 'payment' ? 'var(--ok)' : 'var(--danger)');
    const label = kind === 'invoice' ? t('statement_leb_invoice') : kind === 'payment' ? t('statement_leb_pay') : t('statement_leb_share');
    return `<tr>
      <td style="white-space:nowrap">${esc(fmtDate(row.date))}</td>
      <td>${label}</td>
      <td>${esc(row.label)}</td>
      <td class="num" style="color:${kind === 'invoice' ? 'inherit' : color};font-weight:${kind === 'invoice' ? 700 : 600}">${fmtMoney(row.amount)}</td>
      <td class="num" style="font-weight:800;${row.running > 0 ? 'color:var(--danger)' : row.running < 0 ? 'color:var(--ok)' : ''}">${fmtMoney(row.running)}</td>
    </tr>`;
  }).join('');
  return `<div>
    <div class="statement-head" style="margin-bottom:14px">
      <div>
        <div style="font-size:12px;color:var(--muted)">${esc(S.settings.org_name || '')}</div>
        <h3 style="margin:0">${esc(t('statement_for'))}: <span style="color:var(--primary)">${esc(st.unit.building_name + ' / ' + st.unit.code)}</span></h3>
      </div>
      ${printable ? '' : `<div style="display:flex;gap:8px">
        ${st.totals.balance > 0 ? `<button class="btn sm" data-payopen>${icon('cash')} ${esc(t('pay_now'))}</button>` : ''}
        <button class="btn ghost sm" onclick="window.print()">${icon('print')} ${esc(t('print'))}</button>
      </div>`}
    </div>
    <div class="kpi-band" style="margin-bottom:14px">
      <div class="kpi"><div class="k">${esc(t('invoiced'))}</div><div class="v">${fmtMoney(T.invoiced)}</div></div>
      <div class="kpi"><div class="k">${esc(t('expenses_billed'))}</div><div class="v">${fmtMoney(T.expenses_share)}</div></div>
      <div class="kpi"><div class="k">${esc(t('paid'))}</div><div class="v pos">${fmtMoney(T.paid)}</div></div>
      <div class="kpi"><div class="k">${esc(t('balance'))}</div><div class="v ${T.balance > 0 ? 'neg' : T.balance < 0 ? 'pos' : ''}">${fmtMoney(T.balance)}</div></div>
    </div>
    <div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>${esc(t('date'))}</th><th>${esc(t('type'))}</th><th>${esc(t('desc'))}</th><th>${esc(t('amount'))}</th><th>${esc(t('running'))}</th></tr></thead>
      <tbody>${ledgerRows || `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">${esc(t('none_yet'))}</td></tr>`}</tbody>
    </table></div>
    <p style="font-size:11px;color:var(--muted)">${esc(t('share_note'))}</p>
  </div>`;
}

/* ============ المستخدمون ============ */
export async function pageUsers(el) {
  el.innerHTML = spin();
  try {
    const [users, units] = await Promise.all([api.get('/api/users'), api.get('/api/units')]);
    const roleBadge = (r) => badge(t('role_' + r), r === 'admin' ? 'danger' : r === 'manager' ? 'info' : 'soft');
    el.innerHTML = `
      <div class="card"><div class="h-row">
        <h3 style="margin:0">${esc(t('users_c'))}</h3><div class="grow"></div>
        <button class="btn" id="addUser">${icon('plus')} ${esc(t('new_user'))}</button>
      </div>
      ${table({
      rows: users, empty: t('none_yet'), cols: [
        { label: t('username'), get: r => `<b>${esc(r.username)}</b>` },
        { label: t('name'), get: r => esc(r.name) },
        { label: t('role'), get: r => roleBadge(r.role) },
        { label: t('linked_unit'), get: r => { if (!r.unit_id) return '—'; const u = units.find(x => String(x.id) === String(r.unit_id)); return u ? esc(u.code) : '—'; } },
        { label: t('status'), get: r => badge(r.active ? t('active') : t('inactive'), r.active ? 'ok' : 'soft') },
        { label: t('actions'), get: r => `<div class="actions">
          <button class="btn ghost sm" data-edit="${r.id}">${icon('edit')}</button>
          <button class="btn ghost sm" data-pass="${r.id}">${icon('user')} ${esc(t('reset_password'))}</button>
          <button class="btn ghost sm" data-del="${r.id}" style="color:var(--danger)">${icon('trash')}</button></div>` }
      ]
    })}
      </div>`;
    el.querySelector('#addUser').onclick = () => userForm(null, units);
    el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => userForm(users.find(u => String(u.id) === b.dataset.edit), units));
    el.querySelectorAll('[data-pass]').forEach(b => b.onclick = async () => {
      const u = users.find(x => String(x.id) === b.dataset.pass);
      const v = await formModal({ title: `${t('reset_password')} — ${u.username}`, fields: [{ name: 'password', label: t('new_pass'), type: 'password', required: true }] });
      if (!v) return;
      try { await api.patch('/api/users/' + u.id, { password: v.password }); toast(t('saved')); } catch (e) { toastErr(e); }
    });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const u = users.find(x => String(x.id) === b.dataset.del);
      if (!(await confirmDlg(t('confirm_delete')))) return;
      try { await api.del('/api/users/' + u.id); toast(t('saved')); refresh(); }
      catch (e) { if (e.key === 'last_admin') toast(t('last_admin'), 'err'); else toastErr(e); }
    });
  } catch (e) { toastErr(e); }
}
async function userForm(u, units) {
  await buildingOptions();
  const unitOptions = [{ value: '', label: '—' }, ...units.map(x => ({ value: String(x.id), label: x.code })) || [],]
    .filter(Boolean);
  const v = await formModal({
    title: u ? (t('edit') + ' — ' + u.username) : t('new_user'), wide: true,
    fields: [
      { name: 'username', label: t('username'), required: true, value: u?.username, hint: '' },
      { name: 'name', label: t('name'), required: true, value: u?.name },
      ...(u ? [] : [{ name: 'password', label: t('password'), type: 'password', required: true }]),
      { name: 'role', label: t('role'), type: 'select', options: [
        { value: 'admin', label: t('role_admin') }, { value: 'manager', label: t('role_manager') },
        { value: 'resident', label: t('role_resident') }], value: u?.role || 'manager' },
      { name: 'unit_id', label: t('linked_unit'), type: 'select', options: unitOptions, value: u?.unit_id || '' },
      { name: 'active', label: t('active'), type: 'checkbox', value: u ? u.active : 1 }
    ]
  });
  if (!v) return;
  v.unit_id = v.unit_id ? Number(v.unit_id) : null;
  try {
    if (u) await api.patch('/api/users/' + u.id, v); else await api.post('/api/users', v);
    toast(t('saved')); refresh();
  } catch (e) { toastErr(e); }
}

/* ============ الإعدادات ============ */
export async function pageSettings(el) {
  el.innerHTML = spin();
  try {
    const st = await api.get('/api/settings');
    const port = location.port || '4751';
    el.innerHTML = `
      <div class="grid" style="grid-template-columns:1fr 1fr">
        <div class="card no-print"><h3>${esc(t('pref_general'))}</h3>
          <div class="field"><label>${esc(t('org_name'))}</label><input class="input" id="sOrg" value="${esc(st.org_name || '')}"></div>
          <div class="field"><label>${esc(t('currency'))}</label><input class="input" id="sCur" value="${esc(st.currency || '')}" placeholder="ج.م / EGP / ₪ / €"></div>
          <div class="field"><label>${esc(t('min_fund'))}</label><input class="input" id="sMin" type="number" min="0" step="0.01" value="${Number(st.min_fund || 0) / 100}">
            <span class="hint">${esc(t('min_fund_hint'))}</span></div>
          <div class="form-actions" style="justify-content:start"><button class="btn" id="saveSet">${esc(t('save'))}</button></div>
        </div>
        <div class="card no-print"><h3>${esc(t('pref_data'))}</h3>
          <div style="display:flex;flex-direction:column;gap:10px">
            <a class="btn ghost" href="/api/backup" style="text-decoration:none">${icon('download')} ${esc(t('download_backup'))}</a>
            <button class="btn ghost" id="restoreBtn">${icon('upload')} ${esc(t('restore_db'))}</button>
            ${S.user.role === 'admin' ? `
            <button class="btn" id="demoBtn">${icon('refresh')} ${esc(t('btn_load_demo'))}</button>
            <button class="btn danger" id="wipeBtn">${icon('trash')} ${esc(t('demo_clear'))}</button>` : ''}
          </div>
          <input type="file" id="restoreFile" accept=".db,.sqlite,.sqlite3" style="display:none">
          <div style="margin-top:14px;padding:12px;background:var(--info-soft);border-radius:10px;font-size:12.5px;color:#0c4a6e">
            <b>${esc(t('share_note_web'))} ${esc(port)}</b><br>${esc(t('web_share'))}
          </div>
        </div>
        <div class="card no-print"><h3>${esc(t('pref_account'))}</h3>
          <p style="color:var(--muted);font-size:13px">${esc(S.user.name)} · ${esc(S.user.username)} · ${esc(t('role_' + S.user.role))}</p>
          <button class="btn ghost" id="passBtn">${icon('user')} ${esc(t('change_pass'))}</button>
        </div>
      </div>`;
    el.querySelector('#saveSet').onclick = async () => {
      try {
        await api.put('/api/settings', {
          org_name: el.querySelector('#sOrg').value,
          currency: el.querySelector('#sCur').value,
          min_fund: Math.round(Number(el.querySelector('#sMin').value || 0) * 100)
        });
        S.settings = await api.get('/api/settings');
        toast(t('saved')); refresh();
      } catch (e) { toastErr(e); }
    };
    const restoreBtn = el.querySelector('#restoreBtn');
    const fileIn = el.querySelector('#restoreFile');
    restoreBtn.onclick = () => fileIn.click();
    fileIn.onchange = async () => {
      const file = fileIn.files[0];
      if (!file) return;
      if (!(await confirmDlg(t('restore_warn'), { okLabel: t('restore') }))) { fileIn.value = ''; return; }
      try {
        const bytes = await file.arrayBuffer();
        await api.postRaw('/api/restore', Buffer_toSend(bytes));
        toast(t('db_restored'));
        // إعادة تحميل البيانات
        S.settings = await api.get('/api/settings');
        invalidateBuildings();
        location.hash = '#/dashboard';
        refresh();
      } catch (e) { toastErr(e); }
      fileIn.value = '';
    };
    const demoBtn = el.querySelector('#demoBtn');
    if (demoBtn) demoBtn.onclick = async () => {
      if (!(await confirmDlg(t('demo_clear_warn')))) return;
      try { await api.post('/api/demo/seed'); toast(t('saved')); invalidateBuildings(); location.hash = '#/dashboard'; refresh(); } catch (e) { toastErr(e); }
    };
    const wipeBtn = el.querySelector('#wipeBtn');
    if (wipeBtn) wipeBtn.onclick = async () => {
      // تأكيد مزدوج: تحذير + كتابة كلمة «مسح» يدوياً
      if (!(await confirmDlg(t('demo_clear_warn')))) return;
      const v = await formModal({
        title: t('demo_clear'),
        fields: [{ name: 'confirm_txt', label: t('type_wipe'), required: true, placeholder: 'مسح' }],
        submitLabel: t('wipe_now')
      });
      const txt = String(v?.confirm_txt || '').trim().toLowerCase();
      if (!v || (txt !== 'مسح' && txt !== 'delete')) { toast(t('wipe_cancelled'), 'warn'); return; }
      try {
        const r = await api.post('/api/demo/clear');
        toast(t('wipe_done_backup'), 'warn');
        invalidateBuildings(); refresh();
      } catch (e) { toastErr(e); }
    };
    el.querySelector('#passBtn').onclick = async () => {
      const v = await formModal({
        title: t('change_pass'),
        fields: [
          { name: 'old_password', label: t('old_pass'), type: 'password', required: true },
          { name: 'new_password', label: t('new_pass'), type: 'password', required: true }
        ]
      });
      if (!v) return;
      try { await api.post('/api/auth/change-password', v); toast(t('saved')); } catch (e) { toastErr(e); }
    };
  } catch (e) { toastErr(e); }
}
/* إرسال بايتات عبر fetch مع نوع المحتوى المناسب */
function Buffer_toSend(arrayBuffer) { return new Uint8Array(arrayBuffer); }

/* ============ كشف حساب الساكن ============ */
export async function pageMyStatement(el) {
  el.innerHTML = spin();
  try {
    const [st, fund] = await Promise.all([api.get('/api/me/statement'), api.get('/api/me/fund')]);
    const f = fund.fund || {};
    el.innerHTML = `
      <div class="card no-print">
        <h3 style="margin:0 0 10px">${esc(t('fund_status'))}</h3>
        <div style="display:flex;gap:18px;flex-wrap:wrap">
          <div><div class="hint">${esc(t('fund_collected'))}</div><b style="font-size:18px">${esc(fmtMoney(f.income + f.misc))}</b></div>
          <div><div class="hint">${esc(t('fund_spent'))}</div><b style="font-size:18px;color:var(--danger)">${esc(fmtMoney(f.expenses))}</b></div>
          <div><div class="hint">${esc(t('fund_balance'))}</div><b style="font-size:18px;color:${f.net >= 0 ? 'var(--ok)' : 'var(--danger)'}">${esc(fmtMoney(f.net))}</b></div>
        </div>
      </div>
      ${statementHtml(st, { printable: false }).replace(/<button[^>]*data-payopen[\s\S]*?<\/button>/, '')}
      <div class="card no-print">
        <h3>${esc(t('recent_expenses'))}</h3>
        ${table({
        rows: fund.expenses || [], empty: t('no_expenses'), cols: [
          { label: t('date'), get: r => esc(fmtDate(r.date)) },
          { label: t('category'), get: r => esc(r.category || '-') },
          { label: t('details'), get: r => esc(r.description || '-') },
          { label: t('amount'), cls: 'num', get: r => esc(fmtMoney(r.amount)) }
        ]
      })}
      </div>
      <div class="card no-print"><h3>${esc(t('details'))}</h3>
      ${table({
      rows: st.ledger.filter(r => r.type !== 'expense_share'), cols: [
        { label: t('date'), get: r => esc(fmtDate(r.date)) },
        { label: t('type'), get: r => esc(r.type === 'invoice' ? t('statement_leb_invoice') : r.type === 'payment' ? t('statement_leb_pay') : t('statement_leb_share')) },
        { label: t('details'), get: r => esc(r.label) },
        { label: t('amount'), cls: 'num', get: r => esc(fmtMoney(r.amount)) },
        { label: t('paid'), cls: 'num', get: r => r.type === 'invoice' ? esc(fmtMoney(Number(r.paid))) : '—' }
      ]
    })}</div>`;
  } catch (e) { toastErr(e); }
}
