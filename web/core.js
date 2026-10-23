'use strict';
/* core.js — الحالة، واجهة API، المكوّنات المشتركة، الرسوم البيانية */
import { t, setLang, setCurrency, fmtMoney, fmtNum, fmtDate, fmtMonth, fmtDayMonth, locale, bindStore, DICTS } from './i18n.js';

/* ================= الحالة ================= */
export const S = {
  token: localStorage.getItem('hm_token') || '',
  user: null,
  settings: {},
  lang: localStorage.getItem('hm_lang') || 'ar',
  scope: localStorage.getItem('hm_scope') || '',   // building_id كسلسلة أو ''
  page: 'dashboard',
  alertsCount: 0,
  buildingsCache: []
};

/* ================= API ================= */
class ApiError extends Error { constructor(key, status) { super(key); this.key = key; this.status = status; } }

async function req(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (S.token) headers['Authorization'] = 'Bearer ' + S.token;
  const raw = body instanceof Blob || body instanceof ArrayBuffer || body instanceof Uint8Array;
  if (raw) delete headers['Content-Type'];
  const res = await fetch(path, { method, headers, body: raw ? body : (body ? JSON.stringify(body) : undefined) });
  if (res.status === 401 && data?.error === 'unauthorized' && !path.startsWith('/api/auth/login')) {
    clearSession();
    location.hash = '#/login';
    throw new ApiError('unauthorized', 401);
  }
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json();
  if (!res.ok) throw new ApiError(data?.error || 'server_error', res.status);
  return data;
}
export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b),
  patch: (p, b) => req('PATCH', p, b),
  put: (p, b) => req('PUT', p, b),
  del: (p) => req('DELETE', p),
  postRaw: (p, bytes) => req('POST', p, bytes)
};

export function clearSession() {
  S.token = ''; S.user = null;
  localStorage.removeItem('hm_token');
}

export function scopeQ() { return S.scope ? `building_id=${S.scope}` : ''; }
export function scopeParam() { return S.scope ? { building_id: S.scope } : {}; }

/* ================= عناصر واجهة ================= */
export function h(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* أيقونات SVG */
const P = {
  home: 'M3 10.5 12 3l9 7.5V21H3z <rect x="9.5" y="13" width="5" height="8"/>',
};
export function icon(name, cls = '') {
  const dict = {
    home: 'M3 11.2 12 3.4l9 7.8V20.4H3z',
    door: 'M6 21V4h12v17M9.5 21v-6h5v6',
    building: 'M4 21V5l8-2v18M12 21V9l8 2v10M7 8h2M7 12h2M7 16h2M15 14h2M15 17h2',
    users: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3 2.7-5 6-5s6 2 6 5M16 13a3 3 0 1 0 0-6M17 20h5c0-2.4-1.8-4-4.3-4.3',
    list: 'M4 6h16M4 12h16M4 18h10',
    money: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M6 9v6M18 9v6',
    cash: 'M2 8h20v8H2zM6 12h3M15 12h3',
    chart: 'M4 20V4M4 20h16M8 16v-6M12 16V8M16 16v-4',
    gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5',
    logout: 'M15 12H3M5 9l-3 3 3 3M9 4h12v16H9M0 0',
    x: 'M6 6l12 12M18 6 6 18',
    edit: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
    check: 'M4 12.5 10 18 20 6',
    warn: 'M12 3 2 21h20L12 3zM12 10v5M12 18v.5',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v.5M12 11v6',
    bell: 'M6 9a6 6 0 0 1 12 0v5l2 4H4l2-4zM9.5 18a2.5 2.5 0 0 0 5 0',
    plus: 'M12 5v14M5 12h14',
    refresh: 'M20 12a8 8 0 1 1-2.3-5.6M20 3v5h-5',
    download: 'M12 3v12M7 11l5 5 5-5M4 21h16',
    upload: 'M12 21V9M7 13l5-5 5 5M4 3h16',
    print: 'M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7z',
    phone: 'M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
    file: 'M7 3h7l5 5v13H7zM13 3v6h6',
    chart_pie: 'M12 3a9 9 0 1 0 9 9h-9zM14 2.5A8.5 8.5 0 0 1 21.5 10H14z',
    menu: 'M4 6h16M4 12h16M4 18h16',
    filter: 'M4 5h16M7 12h10M10 19h4',
    calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
    send: 'M3 12 21 3l-4 18-6-7z M21 3 11 14',
    eye_off: ''
  };
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${dict[name] || ''}"/></svg>`;
}

export const LOGO = `<svg viewBox="0 0 64 64" width="38" height="38"><defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs><rect x="4" y="4" width="56" height="56" rx="15" fill="url(#lg1)"/><path d="M14 32 32 17l18 15" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M19 30v16h26V30" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M27 46v-9h10v9" fill="#fff" opacity=".9"/></svg>`;

/* toast */
export function toast(msg, type = 'ok', ms = 3200) {
  const box = document.getElementById('toasts');
  const el = h(`<div class="toast ${type === 'err' ? 'err' : 'ok'}">${icon(type === 'err' ? 'warn' : 'check')}<span>${esc(msg)}</span></div>`);
  box.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
export function toastErr(e) { toast(errorText(e), 'err'); }
export function errorText(e) {
  const key = e?.key || String(e);
  return t(key) === key ? (t('err') + ': ' + key) : t(key);
}

/* confirm */
export function confirmDlg(msg, { okLabel, danger = true } = {}) {
  return new Promise(resolve => {
    const ov = h(`<div class="overlay" style="z-index:200"><div class="dialog" style="max-width:420px">
      <div class="d-body" style="padding-top:20px;display:flex;gap:12px">
        <div style="color:${danger ? 'var(--danger)' : 'var(--primary)'};flex-shrink:0">${icon('warn', '')}</div>
        <div style="font-size:14px">${esc(msg)}</div>
      </div>
      <div class="d-foot">
        <button class="btn ghost" data-a="no">${t('cancel')}</button>
        <button class="btn ${danger ? 'danger' : ''}" data-a="yes">${okLabel || t('del')}</button>
      </div></div></div>`);
    document.getElementById('modal-root').appendChild(ov);
    ov.addEventListener('click', e => {
      if (e.target === ov) { ov.remove(); resolve(false); }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a) { ov.remove(); resolve(a === 'yes'); }
    });
  });
}

/* نافذة اختيار (زرين أو أكثر) — ترجع مفتاح الزر أو null */
export function choiceDlg(msg, options, { title, okClass = 'danger' } = {}) {
  return new Promise(resolve => {
    const buttons = options.map(o =>
      `<button class="btn ${o.cls || okClass}" data-a="${o.key}">${esc(o.label)}</button>`).join('');
    const ov = h(`<div class="overlay" style="z-index:200"><div class="dialog" style="max-width:480px">
      ${title ? `<div class="d-head"><h3>${esc(title)}</h3></div>` : ''}
      <div class="d-body" style="padding-top:18px;font-size:14px">${esc(msg)}</div>
      <div class="d-foot" style="flex-wrap:wrap;justify-content:flex-start">
        ${buttons}
        <button class="btn ghost" data-a="__cancel">${t('cancel')}</button>
      </div></div></div>`);
    document.getElementById('modal-root').appendChild(ov);
    ov.addEventListener('click', e => {
      if (e.target === ov) { ov.remove(); resolve(null); }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a) { ov.remove(); resolve(a === '__cancel' ? null : a); }
    });
  });
}

/* form modal */
export function formModal({ title, fields, submitLabel, wide = false }) {
  return new Promise(resolve => {
    const ov = h(`<div class="overlay" style="z-index:200"><div class="dialog" style="max-width:${wide ? 680 : 540}px">
      <div class="d-head"><h3>${esc(title)}</h3><button class="x" data-x>${icon('x')}</button></div>
      <div class="d-body"><form class="form" novalidate>
        ${fields.map(f => fieldHtml(f)).join('')}
        <div class="form-actions">
          <button type="button" class="btn ghost" data-x>${t('cancel')}</button>
          <button type="submit" class="btn">${submitLabel || t('save')}</button>
        </div></form></div></div></div>`);
    document.getElementById('modal-root').appendChild(ov);
    const form = ov.querySelector('form');
    const firstField = ov.querySelector('input,select,textarea'); firstField && firstField.focus();
    const close = (val) => { ov.remove(); resolve(val); };
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.closest('[data-x]')) close(null);
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const values = {};
      let ok = true;
      for (const f of fields) {
        const input = form.querySelector(`[name="${f.name}"]`);
        if (!input) continue;
        let v;
        if (f.type === 'checkbox') v = input.checked ? 1 : 0;
        else if (f.type === 'money') {
          v = input.value.trim() === '' ? null : Math.round(parseFloat(String(input.value).replace(',', '.')) * 100);
          if (!Number.isFinite(v)) v = null;
        }
        else if (f.type === 'number') { v = input.value === '' ? null : Number(input.value); }
        else v = input.value.trim();
        if (f.required && (v == null || v === '')) {
          input.style.borderColor = 'var(--danger)'; ok = false; continue;
        }
        input.style.borderColor = '';
        values[f.name] = v;
      }
      if (!ok) return;
      close(values);
    });
  });
}
function fieldHtml(f) {
  const labelHtml = f.label ? `<label for="fm_${f.name}">${esc(f.label)}${f.required ? ' *' : ''}</label>` : '<label></label>';
  const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
  let input = '';
  const val = f.value != null ? f.value : '';
  if (f.type === 'select') {
    input = `<select class="input" name="${f.name}" id="fm_${f.name}">
      ${(f.options || []).map(o => `<option value="${esc(String(o.value))}" ${String(o.value) === String(val) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea class="input" name="${f.name}" id="fm_${f.name}" rows="2">${esc(val)}</textarea>`;
  } else if (f.type === 'checkbox') {
    return `<div class="field" style="flex-direction:row;align-items:center;gap:9px">
      <input type="checkbox" name="${f.name}" id="fm_${f.name}" ${val ? 'checked' : ''} style="width:16px;height:16px">
      <label for="fm_${f.name}" style="margin:0">${esc(f.label)}</label></div>`;
  } else if (f.type === 'money') {
    input = `<input class="input" type="number" step="0.01" min="0" inputmode="decimal" name="${f.name}" id="fm_${f.name}" value="${(val === 0 || val) ? (Math.round(val) / 100) : ''}" placeholder="${esc(f.placeholder || '0.00')}">`;
  } else if (f.type === 'number') {
    input = `<input class="input" type="number" step="any" name="${f.name}" id="fm_${f.name}" value="${esc(val)}">`;
  } else if (f.type === 'date') {
    input = `<input class="input" type="date" name="${f.name}" id="fm_${f.name}" value="${esc(val)}">`;
  } else if (f.type === 'month') {
    input = `<input class="input" type="month" name="${f.name}" id="fm_${f.name}" value="${esc(val)}">`;
  } else if (f.type === 'password') {
    input = `<input class="input" type="password" name="${f.name}" id="fm_${f.name}" value="" autocomplete="new-password">`;
  } else {
    input = `<input class="input" type="text" name="${f.name}" id="fm_${f.name}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}">`;
  }
  return `<div class="field">${labelHtml}${input}${hint}</div>`;
}

/* جدول */
export function table({ cols, rows, empty, rowKey = 'id' }) {
  if (!rows.length) return `<div class="empty-note"><div class="big">🗂️</div>${esc(empty || t('none_yet'))}</div>`;
  const head = cols.map(c => `<th>${esc(c.label)}</th>`).join('');
  const body = rows.map(r => '<tr>' + cols.map(c => `<td class="${c.cls || ''}">${c.get ? c.get(r) : esc(r[c.key])}</td>`).join('') + '</tr>').join('');
  return `<div class="tbl-wrap" style="overflow-x:auto"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/* badges */
export function badge(text, kind) { return `<span class="badge ${kind}">${esc(text)}</span>`; }

/* ================= CSV ================= */
export function downloadCSV(filename, headers, rows) {
  const escCsv = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const sep = S.lang === 'ar' ? '\uFEFF' : '';
  const lines = [headers.map(escCsv).join(','), ...rows.map(r => r.map(escCsv).join(','))];
  const blob = new Blob([sep + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ================= الرسوم البيانية ================= */
function prepCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 600, ht = canvas.clientHeight || 240;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(ht * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h: ht };
}

export function barChart(canvas, labels, series) {
  if (!canvas) return;
  const rtl = S.lang === 'ar';
  const { ctx, w, h } = prepCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const pad = { t: 10, b: 26, l: 8, r: 8 };
  const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
  const n = labels.length;
  const maxV = Math.max(1, ...series.flatMap(s => s.values));
  const groupW = plotW / Math.max(n, 1);
  const barW = Math.max(0, Math.min(26, (groupW - 12) / Math.max(series.length, 1)));
  const canBars = barW > 0.5 && plotH > 0;
  const labelsArr = rtl ? [...labels].reverse() : labels;
  const seriesVals = rtl ? series.map(s => ({ ...s, values: [...s.values].reverse() })) : series;
  // lines
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = pad.t + plotH * i / 3;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    const val = maxV * (1 - i / 3) / 100;
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px Segoe UI';
    ctx.textAlign = 'start';
    if (val > 0.01) ctx.fillText(val.toFixed(0) + '', pad.l + 2, y - 3);
  }
  labelsArr.forEach((lab, gi) => {
    if (canBars) seriesVals.forEach((s, si) => {
      const x = pad.l + groupW * gi + groupW / 2 - (series.length * barW) / 2 + si * barW + 2;
      const bh = (s.values[gi] / maxV) * plotH;
      ctx.fillStyle = s.color;
      const r = Math.max(0, Math.min(4, barW / 2, bh / 2));
      const y = pad.t + plotH - bh;
      ctx.beginPath();
      ctx.moveTo(x, pad.t + plotH);
      ctx.lineTo(x, y + r);
      if (r > 0) ctx.arc(x + r, y + r, r, Math.PI, 0);
      ctx.lineTo(x + barW, pad.t + plotH); ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = '#64748b'; ctx.font = '11px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText(lab, pad.l + groupW * gi + groupW / 2, h - 8);
  });
}

export function donut(canvas, items) {
  if (!canvas) return;
  const { ctx, w, h } = prepCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) / 2 - 6;
  // على الشاشات الضيقة جداً لا ترسم دائرة — خانة نصية بدل الانهيار
  if (R < 4 || (w && w < 14) || (h && h < 14)) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '12px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('—', Math.max(cx, 12), Math.max(cy, 14));
    return;
  }
  const r = R * 0.58;
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) { ctx.fillStyle = '#94a3b8'; ctx.font = '12px Segoe UI'; ctx.textAlign = 'center'; ctx.fillText('—', cx, cy); return; }
  let a0 = -Math.PI / 2;
  for (const it of items) {
    const a1 = a0 + (it.value / total) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.arc(cx, cy, r, a1, a0, true); ctx.closePath();
    ctx.fillStyle = it.color; ctx.fill();
    a0 = a1;
  }
}

/* ================= الجلسة ================= */
export async function bootSession() {
  if (!S.token) return false;
  try {
    const me = await api.get('/api/auth/me');
    S.user = me.user;
    S.settings = await api.get('/api/settings');
    setLang(S.lang);
    setCurrency(S.settings.currency);
    return true;
  } catch { return false; }
}

export function applyLangUI() {
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  setLang(S.lang);
}

export { t, fmtMoney, fmtNum, fmtDate, fmtMonth, fmtDayMonth, locale, setCurrency };
