'use strict';
/* app.js — الهيكل العام، التنقّل، شاشة الدخول */
import { S, api, h, esc, t, icon, fmtMoney, toast, toastErr, formModal, clearSession, applyLangUI, LOGO } from './core.js';
import { setLang, setCurrency, bindStore } from './i18n.js';
import { pageDashboard, pageBuildings, pageUnits, pageResidents, pageRates, refresh, spin, buildingOptions, invalidateBuildings } from './pages1.js';
import { pageDues, pagePayments, pageMisc, pageExpenses, pageReminders } from './pages2.js';
import { pageReports, pageUsers, pageSettings, pageMyStatement } from './pages3.js';

const $app = document.getElementById('app');

/* تعريف الصفحات */
const PAGES = {
  dashboard: { fn: pageDashboard, icon: 'home', sec: 'nav_sec_main', roles: ['admin', 'manager'] },
  buildings: { fn: pageBuildings, icon: 'building', sec: 'nav_sec_main', roles: ['admin', 'manager'] },
  units: { fn: pageUnits, icon: 'door', sec: 'nav_sec_people', roles: ['admin', 'manager'] },
  residents: { fn: pageResidents, icon: 'users', sec: 'nav_sec_people', roles: ['admin', 'manager'] },
  rates: { fn: pageRates, icon: 'list', sec: 'nav_sec_money', roles: ['admin', 'manager'] },
  dues: { fn: pageDues, icon: 'calendar', sec: 'nav_sec_money', roles: ['admin', 'manager'] },
  payments: { fn: pagePayments, icon: 'cash', sec: 'nav_sec_money', roles: ['admin', 'manager'] },
  misc: { fn: pageMisc, icon: 'plus', sec: 'nav_sec_money', roles: ['admin', 'manager'] },
  expenses: { fn: pageExpenses, icon: 'money', sec: 'nav_sec_money', roles: ['admin', 'manager'] },
  reminders: { fn: pageReminders, icon: 'bell', sec: 'nav_sec_main', roles: ['admin', 'manager'] },
  reports: { fn: pageReports, icon: 'chart', sec: 'nav_sec_admin', roles: ['admin', 'manager'] },
  users: { fn: pageUsers, icon: 'user', sec: 'nav_sec_admin', roles: ['admin'] },
  settings: { fn: pageSettings, icon: 'gear', sec: 'nav_sec_admin', roles: ['admin', 'manager', 'resident'] },
  myaccount: { fn: pageMyStatement, icon: 'cash', sec: 'nav_sec_main', roles: ['resident'] }
};

/* ============ شاشة الدخول ============ */
function renderLogin() {
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  $app.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="brand-center">
          <div class="logo">${LOGO.replace('width="38" height="38"', 'width="56" height="56"')}</div>
          <h1>${esc(t('app_name'))}</h1>
          <div class="sub">${esc(t('tagline'))}</div>
        </div>
        <form id="loginForm" class="form">
          <div class="field"><label>${esc(t('login_user'))}</label>
            <input class="input" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="latin" required></div>
          <div class="field"><label>${esc(t('login_pass'))}</label>
            <input class="input" type="password" name="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required></div>
          <button class="btn" style="width:100%;justify-content:center;margin-top:6px" type="submit">${esc(t('login_btn'))}</button>
        </form>
        <div style="display:flex;justify-content:center;margin-top:14px">
          <button class="langbtn" id="langBtn">${esc(t('switch_lang'))}</button>
        </div>
        <div class="login-hint">${esc(t('login_hint'))}</div>
      </div>
    </div>`;
  $app.querySelector('#langBtn').onclick = () => {
    S.lang = S.lang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('hm_lang', S.lang);
    setLang(S.lang);
    renderLogin();
  };
  $app.querySelector('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const username = f.username.value.trim(), password = f.password.value;
    const btn = f.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const r = await api.post('/api/auth/login', { username, password });
      S.token = r.token; S.user = r.user;
      localStorage.setItem('hm_token', r.token);
      S.settings = await api.get('/api/settings');
      if (S.settings.currency) setCurrency(S.settings.currency);
      boot();
    } catch (err) {
      toast(t('login_failed'), 'err');
      btn.disabled = false;
    }
  };
}

/* ============ الهيكل ============ */
function renderShell() {
  $app.innerHTML = `
    <div class="layout">
      <div class="sidebar" id="sidebar">
        <div class="brand">
          <div class="logo">${LOGO}</div>
          <div><div class="bname" style="direction:ltr">${S.lang === 'ar' ? 'هوم فيز HomeFees' : 'HomeFees'}</div><div class="btag">${esc(t('tagline'))}</div></div>
        </div>
        <div class="nav" id="nav"></div>
      </div>
      <div class="main">
        <div class="topbar">
          <button class="burger" id="burgerBtn">${icon('menu')}</button>
          <div class="title" id="pageTitle"></div>
          <div class="grow"></div>
          ${S.user.role !== 'resident' ? `
          <div class="scope">${icon('building')}<select class="input" id="scopeSel" style="padding:7px 10px">
            <option value="">${esc(t('scope_all'))}</option>
          </select></div>` : ''}
          <button class="iconbtn" id="alertsBtn" title="${esc(t('nav_reminders'))}">${icon('bell')}<span class="dot" id="alertsDot" style="display:none"></span></button>
          <button class="langbtn" id="langBtn2">${esc(t('switch_lang'))}</button>
          <div class="userchip">
            <div class="avatar">${esc((S.user.name || 'U').trim()[0] || 'U')}</div>
            <span style="font-size:12.5px">${esc(S.user.name)}</span>
            <button class="btn ghost sm" id="logoutBtn" style="padding:4px 8px">${icon('logout')}</button>
          </div>
        </div>
        <div class="content" id="content"></div>
      </div>
    </div>`;
  bindNav();
  // عناصر بعد الربط
  const langBtn = $app.querySelector('#langBtn2');
  if (langBtn) langBtn.onclick = async () => {
    S.lang = S.lang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('hm_lang', S.lang);
    applyLangUI();
    try { S.settings = await api.get('/api/settings'); if (S.settings.currency) setCurrency(S.settings.currency); } catch { }
    renderShell();
    route(true);
  };
  const burger = $app.querySelector('#burgerBtn');
  if (burger) burger.onclick = () => $app.querySelector('#sidebar').classList.toggle('open');
  const logout = $app.querySelector('#logoutBtn');
  if (logout) logout.onclick = () => { clearSession(); location.hash = '#/login'; };
  const scopeSel = $app.querySelector('#scopeSel');
  if (scopeSel) scopeSel.onchange = e => { S.scope = e.target.value; localStorage.setItem('hm_scope', S.scope); route(true); };
  const alertsBtn = $app.querySelector('#alertsBtn');
  if (alertsBtn) alertsBtn.onclick = () => { location.hash = '#/reminders'; };
}

async function bindNav() {
  const nav = $app.querySelector('#nav');
  const allowed = Object.entries(PAGES).filter(([k, p]) => p.roles.includes(S.user.role));
  let html = '';
  let lastSec = '';
  for (const [key, p] of allowed) {
    if (p.sec !== lastSec) {
      html += `<div class="sec">${esc(t(p.sec))}</div>`;
      lastSec = p.sec;
    }
    const active = location.hash === '#/' + key || (key === 'dashboard' && (!location.hash || location.hash === '#'));
    html += `<a href="#/${key}" data-tab="${key}" class="${active ? 'active' : ''}">${icon(p.icon)}<span>${esc(t('nav_' + key))}</span>${key === 'reminders' ? '<span class="badge" id="navBadge" style="display:none">0</span>' : ''}</a>`;
  }
  nav.innerHTML = html;
  // نطاق المباني
  const scopeSel = $app.querySelector('#scopeSel');
  if (scopeSel) {
    try {
      const buildings = await api.get('/api/buildings');
      S.buildingsCache = buildings;
      scopeSel.innerHTML = `<option value="">${esc(t('scope_all'))}</option>` +
        buildings.map(b => `<option value="${b.id}" ${String(b.id) === S.scope ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
    } catch { }
  }
  updateAlertsBadge();
}

async function updateAlertsBadge() {
  if (S.user.role === 'resident') return;
  try {
    const alerts = await api.get('/api/alerts' + (S.scope ? '?' + scopeQ() : ''));
    const n = alerts.length;
    const dot = $app.querySelector('#alertsDot');
    const badge = $app.querySelector('#navBadge');
    if (dot) dot.style.display = n ? '' : 'none';
    if (badge) { badge.textContent = n; badge.style.display = n ? '' : 'none'; }
    S.alertsCount = n;
  } catch { }
}
function scopeQ() { return S.scope ? 'building_id=' + S.scope : ''; }

/* ============ التوجّه ============ */
async function route(force = false) {
  if (!S.token || !S.user) { renderLogin(); return; }
  const hash = location.hash.replace(/^#\//, '') || 'dashboard';
  const [pageRaw] = hash.split('?');
  const isLogin = pageRaw === 'login';
  if (isLogin) { renderLogin(); return; }
  if (!location.hash.replace(/^#\//, '') && S.user.role === 'resident') {
    location.hash = '#/myaccount';
    return;
  }

  if (!renderShellDone || force) {
    renderShell();
    renderShellDone = true;
  }
  const page = PAGES[pageRaw] ? pageRaw : 'dashboard';
  if (page !== pageRaw) { location.hash = '#/' + page; return; }
  const def = PAGES[page];
  if (!def.roles.includes(S.user.role)) {
    toast(t('forbidden_admin'), 'err');
    // الساكن يذهب لكشف حسابه — غيره إلى أول صفحة مسموحة لصلاحيته
    const fallback = S.user.role === 'resident'
      ? 'myaccount'
      : (Object.entries(PAGES).find(([k, p]) => p.roles.includes(S.user.role))?.[0] || 'dashboard');
    location.hash = '#/' + fallback;
    return;
  }
  // تحديث حالة التنقّل
  $app.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.tab === page));
  const title = $app.querySelector('#pageTitle');
  if (title) title.textContent = t('nav_' + page);
  // إغلاق الشريط على الجوال
  const sb = $app.querySelector('#sidebar');
  if (sb) sb.classList.remove('open');
  const content = $app.querySelector('#content');
  if (!content) return;
  content.innerHTML = spin();
  try {
    await def.fn(content);
  } catch (e) { toastErr(e); content.innerHTML = ''; }
  updateAlertsBadge();
}

let renderShellDone = false;

window.addEventListener('hashchange', () => route());
window.addEventListener('hm_refresh', () => route(true));

/* ============ الإقلاع ============ */
async function boot() {
  applyLangUI();
  if (!S.token) { renderLogin(); return; }
  try {
    const me = await api.get('/api/auth/me');
    S.user = me.user;
    S.settings = await api.get('/api/settings');
    if (S.settings.currency) setCurrency(S.settings.currency);
  } catch (e) {
    clearSession();
    renderLogin();
    return;
  }
  renderShellDone = false;
  // بعد الدخول: لا نبقى على صفحة الدخول — نوجه حسب الصلاحية (ساكن → كشف حسابي)
  const cur = location.hash.replace(/^#\//, '');
  if (!cur || cur === 'login') {
    location.hash = S.user.role === 'resident' ? '#/myaccount' : '#/dashboard';
    return;
  }
  route(true);
}

boot();
