'use strict';
/* pages1.js — لوحة المعلومات، المباني، الوحدات، السكان، بنود الرسوم */
import { S, api, h, esc, t, icon, fmtMoney, fmtNum, fmtDate, fmtMonth, toast, toastErr, confirmDlg, choiceDlg, formModal, table, badge, barChart, scopeQ, LOGO } from './core.js';

export function spin() { return '<div class="boot-splash" style="min-height:200px"><div class="spin"></div></div>'; }
export function refresh() { window.dispatchEvent(new Event('hm_refresh')); }

export async function buildingOptions(placeholder) {
  if (!S.buildingsCache.length || Date.now() - (S.buildingsCacheAt || 0) > 30000) {
    S.buildingsCache = await api.get('/api/buildings');
    S.buildingsCacheAt = Date.now();
  }
  const opts = S.buildingsCache.map(b => ({ value: String(b.id), label: b.name }));
  if (placeholder !== undefined) opts.unshift({ value: '', label: placeholder });
  return opts;
}
export function invalidateBuildings() { S.buildingsCache = []; S.buildingsCacheAt = 0; }
export function currentBuildings() { return S.buildingsCache.length ? S.buildingsCache : []; }
export function buildingName(id) {
  const b = S.buildingsCache.find(x => String(x.id) === String(id));
  return b ? b.name : (id ? String(id) : '');
}

/* ============ لوحة المعلومات ============ */
export async function pageDashboard(el) {
  el.innerHTML = spin();
  try {
    const q = scopeQ();
    const d = await api.get('/api/dashboard' + (q ? '?' + q : ''));
    await buildingOptions();
    const isAdminOrMgr = S.user.role !== 'resident';

    if (d.counts.buildings === 0) {
      el.innerHTML = `
        <div class="card" style="text-align:center;padding:50px 20px">
          <div style="width:70px;margin:0 auto 14px">${LOGO}</div>
          <h2 style="margin:0 0 8px">${esc(t('empty_state_dash'))}</h2>
          <p style="color:var(--muted)">${esc(t('web_share'))}</p>
          <div style="display:flex;gap:10px;justify-content:center;margin-top:18px">
            ${S.user.role === 'admin' ? `<button class="btn" id="btnDemo">${t('btn_load_demo')}</button>` : ''}
            <a class="btn ghost" href="#/buildings" style="text-decoration:none">${t('new_building')}</a>
          </div>
        </div>`;
      const b = el.querySelector('#btnDemo');
      if (b) b.onclick = async () => {
        b.disabled = true;
        try { await api.post('/api/demo/seed'); toast(t('saved')); invalidateBuildings(); refresh(); }
        catch (e) { toastErr(e); b.disabled = false; }
      };
      return;
    }

    // الإجماليات
    const fund = d.fund || { income: 0, misc: 0, expenses: 0, net: 0 };
    const arrearsAlert = (d.alerts || []).find(a => a.type === 'arrears');
    const arrearsTotal = arrearsAlert ? arrearsAlert.total : 0;
    const ratios = d.month.period && d.month.dues ? Math.round(d.month.collected / d.month.dues * 100) : 0;

    el.innerHTML = `
      ${(d.alerts || []).map(a => `
        <div class="alertbox ${a.level === 'danger' ? 'danger' : a.level === 'warning' ? 'warning' : 'info'}">
          ${icon(a.type === 'reminder' ? 'bell' : a.type === 'arrears' ? 'warn' : 'cash')}
          <div>${esc(S.lang === 'ar' ? (a.title_ar || '') : (a.title_en || a.title_ar || ''))}</div>
        </div>`).join('')}
      <div class="grid stat-grid" style="margin-bottom:18px">
        <div class="stat"><div class="lbl">${icon('building')} ${esc(t('stat_buildings'))}</div><div class="val">${fmtNum(d.counts.buildings)}</div></div>
        <div class="stat"><div class="lbl">${icon('door')} ${esc(t('stat_units'))}</div><div class="val">${fmtNum(d.counts.units)}</div></div>
        <div class="stat"><div class="lbl">${icon('users')} ${esc(t('stat_residents'))}</div><div class="val">${fmtNum(d.counts.residents)}</div></div>
        <div class="stat ${fund.net >= 0 ? 'tone-ok' : 'tone-bad'}"><div class="lbl">${icon('cash')} ${esc(t('stat_fund'))}</div><div class="val">${fmtMoney(fund.net)}</div><div class="sub">${esc(t('t_income'))}: ${fmtMoney(fund.income + fund.misc)} · ${esc(t('t_expenses'))}: ${fmtMoney(fund.expenses)}</div></div>
        <div class="stat ${arrearsTotal > 0 ? 'tone-warn' : ''}"><div class="lbl">${icon('warn')} ${esc(t('stat_arrears'))}</div><div class="val">${fmtMoney(arrearsTotal)}</div><a class="sub" href="#/reports" style="color:var(--muted)">${esc(t('see_all'))} →</a></div>
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:18px">
        <div class="card"><h3>${esc(t('last_months'))} — ${esc(t('income_vs_expenses'))}</h3>
          <div class="chart-wrap"><canvas id="dashChart"></canvas></div>
          <div class="legend">
            <span class="li"><span class="sw" style="background:#0d9488"></span>${esc(t('t_income'))}</span>
            <span class="li"><span class="sw" style="background:#f59e0b"></span>${esc(t('t_expenses'))}</span>
          </div></div>
        <div class="card"><h3>${esc(t('month_progress'))} — ${esc(fmtMonth(d.month.period))}</h3>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="font-size:28px;font-weight:800;color:var(--primary)">${fmtNum(ratios)}%</div>
            <div class="progress" style="height:12px"><i style="width:${Math.min(ratios, 100)}%"></i></div>
          </div>
          <div class="kpi-band">
            <div class="kpi"><div class="k">${esc(t('invoiced'))}</div><div class="v">${fmtMoney(d.month.dues)}</div></div>
            <div class="kpi"><div class="k">${esc(t('claim_paid'))}</div><div class="v pos">${fmtMoney(d.month.collected)}</div></div>
            <div class="kpi"><div class="k">${esc(t('claim_remaining'))}</div><div class="v neg">${fmtMoney(Math.max(d.month.dues - d.month.collected, 0))}</div></div>
          </div>
          <div style="margin-top:12px;text-align:end">
            <a class="btn ghost sm" href="#/dues" style="text-decoration:none">${esc(t('nav_dues'))} →</a>
          </div></div>
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr">
        <div class="card"><h3>${esc(t('top_arrears'))}</h3>
          <div id="topArrears">${table({
            rows: d.top_arrears, empty: t('none_yet'), cols: [
              { label: t('unit'), get: r => `<b>${esc(r.code)}</b> · ${esc(r.building_name)}` },
              { label: t('resident'), get: r => esc(r.resident_name) || '—' },
              { label: t('balance'), cls: 'num', get: r => `<b style="color:var(--danger)">${fmtMoney(r.balance)}</b>` }
            ]
          })}</div>
        </div>
        <div class="card"><h3>${esc(t('recent_moves'))}</h3>
          ${table({
            rows: d.recent, empty: t('none_yet'), colKey: 'i', cols: [
              { label: t('date'), get: r => esc(fmtDate(r.date)) },
              { label: t('type'), get: r => badge(r.type === 'payment' ? t('move_payment') : r.type === 'expense' ? t('move_expense') : t('move_misc'), r.type === 'expense' ? 'warn' : r.type === 'payment' ? 'ok' : 'info') },
              { label: t('desc'), get: r => esc(r.label) },
              { label: t('amount'), cls: 'num', get: r => `<b>${r.type === 'expense' ? '-' : '+'} ${fmtMoney(r.amount)}</b>` }
            ]
          })}
        </div>
      </div>`;

    // زر أعلى متأخر التوجيه
    // ارسم المخطط
    const cv = el.querySelector('#dashChart');
    barChart(cv, d.series.map(r => r.month.slice(5) + '/' + r.month.slice(2, 4)), [
      { label: t('t_income'), color: '#0d9488', values: d.series.map(r => r.total_in) },
      { label: t('t_expenses'), color: '#f59e0b', values: d.series.map(r => r.expenses) }
    ]);
  } catch (e) { toastErr(e); el.innerHTML = ''; }
}

/* ============ المباني ============ */
export async function pageBuildings(el) {
  el.innerHTML = spin();
  try {
    const rows = await api.get('/api/buildings');
    invalidateBuildings();
    await buildingOptions();
    const isAdmin = S.user.role !== 'resident';
    el.innerHTML = `
      <div class="card"><div class="h-row">
        <h3 style="margin:0;flex:1">${esc(t('buildings_c'))} (${fmtNum(rows.length)})</h3>
        ${isAdmin ? `<button class="btn" id="addB">${icon('plus')} ${esc(t('new_building'))}</button>` : ''}
      </div>
      ${rows.length === 0 ? `<div class="empty-note"><div class="big">🏢</div>${esc(t('no_buildings'))}</div>` : `
      <div class="grid stat-grid">
        ${rows.map(b => `
        <div class="stat" style="display:block">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="width:34px;height:34px;border-radius:9px;background:var(--primary-soft);color:var(--primary-2);display:flex;align-items:center;justify-content:center">${icon('building')}</div>
            <div><div style="font-weight:800;font-size:16px">${esc(b.name)}</div>
              <div style="font-size:11.5px;color:var(--muted)">${esc(b.address || '')}</div></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:12px;margin-bottom:10px">
            <div><div style="color:var(--muted)">${esc(t('units_count'))}</div><b>${fmtNum(b.units_count)}</b></div>
            <div><div style="color:var(--muted)">${esc(t('invoiced'))}</div><b>${fmtMoney(b.invoiced)}</b></div>
            <div><div style="color:var(--muted)">${esc(t('collected'))}</div><b style="color:var(--ok)">${fmtMoney(b.collected)}</b></div>
            <div><div style="color:var(--muted)">${esc(t('t_expenses'))}</div><b style="color:var(--warning)">${fmtMoney(b.expenses)}</b></div>
            <div><div style="color:var(--muted)">${esc(t('residents'))}</div><b>${fmtNum(b.residents_count)}</b></div>
          </div>
          ${isAdmin ? `<div style="display:flex;gap:6px;justify-content:flex-end;border-top:1px solid var(--line);padding-top:9px">
            <button class="btn ghost sm" data-edit="${b.id}">${icon('edit')} ${esc(t('edit'))}</button>
            <button class="btn danger sm" data-del="${b.id}" data-name="${esc(b.name)}">${icon('trash')}</button>
          </div>` : ''}
        </div>`).join('')}
      </div>`}
      </div>`;
    const addBtn = el.querySelector('#addB');
    if (addBtn) addBtn.onclick = () => buildingForm(null);
    el.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => buildingForm(rows.find(b => String(b.id) === btn.dataset.edit));
    });
    el.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = async () => {
        const item = rows.find(b => String(b.id) === btn.dataset.del);
        const hasUnits = item.units_count > 0;
        const ok = await confirmDlg(hasUnits ? t('confirm_building_force') : t('confirm_delete'), { okLabel: t('del') });
        if (!ok) return;
        try { await api.del('/api/buildings/' + item.id + (hasUnits ? '?force=1' : '')); toast(t('saved')); invalidateBuildings(); refresh(); }
        catch (e) { toastErr(e); }
      };
    });
  } catch (e) { toastErr(e); }
}
async function buildingForm(b) {
  const values = await formModal({
    title: b ? t('edit') + ' — ' + b.name : t('new_building'),
    fields: [
      { name: 'name', label: t('name'), required: true, value: b?.name, placeholder: 'برج النخيل' },
      { name: 'address', label: t('address'), value: b?.address },
      { name: 'notes', label: t('notes'), type: 'textarea', value: b?.notes }
    ]
  });
  if (!values) return;
  try {
    if (b) await api.patch('/api/buildings/' + b.id, values);
    else await api.post('/api/buildings', values);
    toast(t('saved'));
    invalidateBuildings();
    refresh();
  } catch (e) { toastErr(e); }
}

/* ============ الوحدات ============ */
export async function pageUnits(el) {
  el.innerHTML = spin();
  try {
    await buildingOptions(t('all'));
    const qsort = scopeQ();
    const [buildings, units] = await Promise.all([
      api.get('/api/buildings'),
      api.get('/api/units' + (qsort ? '?' + qsort : ''))
    ]);
    S.buildingsCache = buildings;
    el.innerHTML = `
      <div class="card"><div class="h-row">
        <h3 style="margin:0">${esc(t('units_c'))}</h3>
        <div class="grow"></div>
        <div class="filters">
          <select class="input" id="bfilter"><option value="">${esc(t('all'))}</option>
            ${buildings.map(b => `<option value="${b.id}" ${String(b.id) === S.scope ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
          </select>
          <button class="btn" id="addU">${icon('plus')} ${esc(t('new_unit'))}</button>
        </div>
      </div>
      ${table({
        rows: units, empty: t('no_units'), cols: [
          { label: t('building'), get: r => esc(r.building_name) },
          { label: t('unit_code'), get: r => `<b>${esc(r.code)}</b>` },
          { label: t('floor'), get: r => r.floor ? fmtNum(r.floor) : '—' },
          { label: t('type'), get: r => esc(t(r.type === 'other' ? 'other' : r.type)) },
          { label: t('area'), cls: 'num', get: r => r.area ? fmtNum(r.area, 1) : '—' },
          { label: t('shares'), cls: 'num', get: r => fmtNum(r.shares) },
          { label: t('curr_resident'), get: r => esc(r.resident_name) || '—' },
          { label: t('occ_col'), get: r => r.resident_name
              ? `<button class="badge-btn" data-occ="${r.id}" title="${esc(t('occ_to_vac_hint'))}">${badge(t('occ_occ'), 'ok')}</button>`
              : `<button class="badge-btn" data-occ="${r.id}" title="${esc(t('occ_to_occ_hint'))}">${badge(t('occ_vac'), 'soft')}</button>` },
          { label: t('actions'), get: r => `<div class="actions">
            <button class="btn ghost sm" data-edit="${r.id}">${icon('edit')}</button>
            <button class="btn ghost sm" data-del="${r.id}" style="color:var(--danger)">${icon('trash')}</button></div>` }
        ]
      })}
      </div>`;
    el.querySelector('#bfilter').onchange = e => { S.scope = e.target.value; localStorage.setItem('hm_scope', S.scope); refresh(); };
    el.querySelector('#addU').onclick = () => unitForm(null, buildings);
    // لمسة واحدة لتغيير الإشغال: مأهولة → متروكة (إيقاف السكان) / متروكة → نموذج ساكن بالوحدة محددة
    el.querySelectorAll('[data-occ]').forEach(b => b.onclick = async () => {
      const u = units.find(x => String(x.id) === b.dataset.occ);
      if (!u) return;
      if (u.resident_name) {
        if (!(await confirmDlg(t('occ_vacate_confirm') + ' — ' + u.building_name + ' / ' + u.code))) return;
        try {
          const res = await api.get('/api/residents' + (scopeQ() ? '?' + scopeQ() : ''));
          const act = res.filter(r => r.unit_id === u.id && r.active);
          for (const r of act) await api.patch('/api/residents/' + r.id, { active: 0 });
          toast(t('saved')); refresh();
        } catch (e) { toastErr(e); }
      } else {
        residentForm(null, units, u);
      }
    });
    el.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => unitForm(units.find(u => String(u.id) === btn.dataset.edit), buildings));
    el.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
      const u = units.find(x => String(x.id) === btn.dataset.del);
      if (!(await confirmDlg(t('confirm_delete')))) return;
      try { await api.del('/api/units/' + u.id); toast(t('saved')); refresh(); }
      catch (e) {
        if (e.key === 'unit_has_transactions') {
          const yes = await confirmDlg(t('confirm_unit_force'));
          if (yes) { try { await api.del('/api/units/' + u.id + '?force=1'); toast(t('saved')); refresh(); } catch (e2) { toastErr(e2); } }
        } else toastErr(e);
      }
    });
  } catch (e) { toastErr(e); }
}
async function unitForm(u, buildings) {
  // fermeas من الوحدات قائمة المباني
  const options = [...buildings.map(b => ({ value: String(b.id), label: b.name }))];
  const values = await formModal({
    title: u ? (t('edit') + ' — ' + u.code) : t('new_unit'),
    wide: true,
    fields: [
      { name: 'building_id', label: t('unit_of'), type: 'select', options, value: u?.building_id, required: true },
      { name: 'code', label: t('unit_code'), required: true, value: u?.code, hint: 'A101 / 2B / SHOP-1' },
      { name: 'floor', label: t('floor'), type: 'number', value: u?.floor ?? 0 },
      { name: 'type', label: t('type'), type: 'select', options: [
        { value: 'apartment', label: t('apartment') }, { value: 'shop', label: t('shop') },
        { value: 'office', label: t('office') }, { value: 'parking', label: t('parking') },
        { value: 'other', label: t('other') }], value: u?.type || 'apartment' },
      { name: 'area', label: t('area'), type: 'number', value: u?.area ?? 60 },
      { name: 'shares', label: t('perm'), type: 'number', value: u?.shares ?? 1, hint: t('dist_hint') },
      { name: 'notes', label: t('notes'), value: u?.notes }
    ]
  });
  if (!values) return;
  values.floor = Number(values.floor) || 0;
  values.area = Number(values.area) || 0;
  values.shares = Number(values.shares) || 1;
  try {
    if (u) await api.patch('/api/units/' + u.id, values);
    else await api.post('/api/units', values);
    toast(t('saved')); refresh();
  } catch (e) { toastErr(e); }
}

/* ============ السكان ============ */
export async function pageResidents(el) {
  el.innerHTML = spin();
  try {
    const [buildings, residents] = await Promise.all([
      buildingOptions(t('all')),
      api.get('/api/residents' + (scopeQ() ? '?' + scopeQ() : ''))
    ]);
    const units = await api.get('/api/units');
    el.innerHTML = `
      <div class="card"><div class="h-row">
        <h3 style="margin:0">${esc(t('residents_c'))}</h3><div class="grow"></div>
        <input class="input search" id="rq" placeholder="${esc(t('search'))}" style="max-width:180px">
        <button class="btn" id="addR">${icon('plus')} ${esc(t('new_resident'))}</button>
      </div>
      ${table({
        rows: residents, empty: t('no_residents'), cols: [
          { label: t('name'), get: r => `<b>${esc(r.name)}</b>` },
          { label: t('phone'), get: r => esc(r.phone) || '—' },
          { label: t('rel'), get: r => badge(r.role === 'owner' ? t('role_owner') : t('role_tenant'), r.role === 'owner' ? 'info' : 'soft') },
          { label: t('unit'), get: r => `<b>${esc(r.unit_code)}</b> · ${esc(r.building_name)}` },
          { label: t('join_date'), get: r => esc(fmtDate(r.start_date)) || '—' },
          { label: t('status'), get: r => badge(r.active ? t('active') : t('inactive'), r.active ? 'ok' : 'soft') },
          { label: t('actions'), get: r => `<div class="actions">
              <button class="btn ghost sm" data-edit="${r.id}">${icon('edit')}</button>
              <button class="btn ghost sm" data-del="${r.id}" style="color:var(--danger)">${icon('trash')}</button>
            </div>` }
        ]
      })}
      </div>`;
    el.querySelector('#rq').oninput = e => {
      const q = e.target.value.toLowerCase();
      el.querySelectorAll('tbody tr').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    };
    el.querySelector('#addR').onclick = () => residentForm(null, units);
    el.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => residentForm(residents.find(r => String(r.id) === btn.dataset.edit), units));
    el.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
      const r = residents.find(x => String(x.id) === btn.dataset.del);
      if (!(await confirmDlg(t('confirm_delete')))) return;
      try { await api.del('/api/residents/' + r.id); toast(t('saved')); refresh(); } catch (e) { toastErr(e); }
    });
  } catch (e) { toastErr(e); }
}
async function residentForm(r, units, preUnit) {
  const unitOptions = units.map(u => ({ value: String(u.id), label: u.building_name + ' / ' + u.code }));
  const values = await formModal({
    title: r ? (t('edit') + ' — ' + r.name) : (preUnit ? t('occ_add_resident') + ' — ' + preUnit.building_name + ' / ' + preUnit.code : t('new_resident')),
    wide: true,
    fields: [
      { name: 'unit_id', label: t('unit'), type: 'select', options: unitOptions, value: r?.unit_id ?? preUnit?.id, required: true },
      { name: 'name', label: t('name'), required: true, value: r?.name },
      { name: 'phone', label: t('phone'), value: r?.phone, placeholder: '05xxxxxxxx' },
      { name: 'role', label: t('rel'), type: 'select', options: [{ value: 'owner', label: t('role_owner') }, { value: 'tenant', label: t('role_tenant') }], value: r?.role || 'owner' },
      { name: 'active', label: t('active_res'), type: 'checkbox', value: r ? r.active : 1 },
      { name: 'start_date', label: t('join_date'), type: 'date', value: r?.start_date },
      { name: 'end_date', label: t('leave_date'), type: 'date', value: r?.end_date },
      { name: 'notes', label: t('notes'), value: r?.notes }
    ]
  });
  if (!values) return;
  values.unit_id = Number(values.unit_id);
  values.start_date = values.start_date || '';
  values.end_date = values.end_date || '';
  values.email = r?.email || '';
  try {
    if (r) await api.patch('/api/residents/' + r.id, values);
    else await api.post('/api/residents', values);
    toast(t('saved')); refresh();
  } catch (e) { toastErr(e); }
}

/* ============ بنود الرسوم ============ */
export async function pageRates(el) {
  el.innerHTML = spin();
  try {
    await buildingOptions(t('all'));
    const sel = S.rateBuilding || (S.buildingsCache[0] ? String(S.buildingsCache[0].id) : '');
    S.rateBuilding = sel;
    const rates = sel ? await api.get('/api/rates?building_id=' + sel) : [];
    el.innerHTML = `
      <div class="card"><div class="h-row">
        <h3 style="margin:0">${esc(t('rates_c'))}</h3><div class="grow"></div>
        <select class="input" id="bsel" style="max-width:200px">
          ${S.buildingsCache.map(b => `<option value="${b.id}" ${String(b.id) === sel ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
        </select>
        <button class="btn" id="addRate" ${sel ? '' : 'disabled'}>${icon('plus')} ${esc(t('new_rate'))}</button>
      </div>
      ${table({
        rows: rates, empty: t('no_rates'), cols: [
          { label: t('name'), get: r => `<b>${esc(r.name)}</b>` },
          { label: t('rate_amount'), cls: 'num', get: r => fmtMoney(r.amount) },
          { label: t('vacant_col'), cls: 'num', get: r => r.dis_amount != null ? badge(fmtMoney(r.dis_amount), 'warn') : '<span style="color:var(--muted)">—</span>' },
          { label: t('dist'), get: r => badge(t('dist_' + r.distribution), 'info') },
          { label: t('status'), get: r => badge(r.active ? t('active') : t('inactive'), r.active ? 'ok' : 'soft') },
          { label: t('actions'), get: r => `<div class="actions">
            <button class="btn ghost sm" data-edit="${r.id}">${icon('edit')}</button>
            <button class="btn ghost sm" data-tog="${r.id}">${r.active ? t('no') : t('yes')}</button>
            <button class="btn ghost sm" data-del="${r.id}" style="color:var(--danger)">${icon('trash')}</button>
          </div>` }
        ]
      })}
      <p class="hint" style="color:var(--muted);font-size:12px;margin:10px 2px 0">${esc(t('dist_hint'))}</p>
      </div>`;
    el.querySelector('#bsel').onchange = e => { S.rateBuilding = e.target.value; refresh(); };
    const add = el.querySelector('#addRate');
    if (add && sel) add.onclick = () => rateForm(null, sel);
    el.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => rateForm(rates.find(r => String(r.id) === btn.dataset.edit), sel));
    el.querySelectorAll('[data-tog]').forEach(btn => btn.onclick = async () => {
      const r = rates.find(x => String(x.id) === btn.dataset.tog);
      try { await api.patch('/api/rates/' + r.id, { active: r.active ? 0 : 1 }); toast(t('saved')); refresh(); } catch (e) { toastErr(e); }
    });
    el.querySelectorAll('[data-del]').forEach(btn => btn.onclick = async () => {
      const r = rates.find(x => String(x.id) === btn.dataset.del);
      if (!(await confirmDlg(t('confirm_delete')))) return;
      try {
        await api.del('/api/rates/' + r.id);
        toast(t('saved')); refresh();
      } catch (e) {
        if (e.key === 'rate_in_use') {
          // البند له فواتير مُنشأة — عرض خيارات محاسبية آمنة
          const choice = await choiceDlg(t('rate_in_use_choice'), [
            { key: 'stop', label: t('rate_stop_only'), cls: 'ghost' },
            { key: 'force', label: t('rate_force_delete'), cls: 'danger' }
          ], { title: t('rate_used_title') });
          if (choice === 'stop') {
            try { await api.patch('/api/rates/' + r.id, { active: 0 }); toast(t('rate_stopped')); refresh(); } catch (e2) { toastErr(e2); }
          } else if (choice === 'force') {
            if (!(await confirmDlg(t('rate_force_confirm')))) return;
            try {
              const rr = await api.post('/api/rates/' + r.id + '/force-delete');
              toast(t('rate_force_done') + (rr?.deleted_unpaid_invoices ? ' ' + rr.deleted_unpaid_invoices : ''));
              refresh();
            } catch (e2) { toastErr(e2); }
          }
        }
        else toastErr(e);
      }
    });
  } catch (e) { toastErr(e); }
}
async function rateForm(r, buildingId) {
  const values = await formModal({
    title: r ? (t('edit') + ' — ' + r.name) : t('new_rate'),
    wide: true,
    fields: [
      { name: 'name', label: t('name'), required: true, value: r?.name, placeholder: 'اشتراك الصيانة الشهرية' },
      { name: 'amount', label: t('rate_amount'), type: 'money', required: true, value: r?.amount, hint: t('dist_hint') },
      { name: 'dis_amount', label: t('rate_vacant'), type: 'money', value: r?.dis_amount, hint: t('rate_vacant_hint') },
      { name: 'distribution', label: t('dist'), type: 'select', options: [
        { value: 'equal', label: t('dist_equal') }, { value: 'shares', label: t('dist_shares') },
        { value: 'area', label: t('dist_area') }], value: r?.distribution || 'equal' },
      { name: 'active', label: t('active'), type: 'checkbox', value: r ? r.active : 1 }
    ]
  });
  if (!values) return;
  values.building_id = Number(buildingId);
  try {
    if (r) await api.patch('/api/rates/' + r.id, values);
    else await api.post('/api/rates', values);
    toast(t('saved')); refresh();
  } catch (e) { toastErr(e); }
}
