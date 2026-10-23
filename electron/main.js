'use strict';
/**
 * main.js — نافذة سطح المكتب (Electron)
 * يشغّل خادم هومينا محلياً ويفتح النافذة عليه.
 */
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');

// مجلد البيانات: داخل AppData عند الاستخدام المُغلَّف، وإلى جانب المشروع أثناء التطوير
if (app.isPackaged) {
  process.env.HOMINA_DATA = path.join(app.getPath('userData'), 'data');
} else {
  process.env.HOMINA_DATA = process.env.HOMINA_DATA || path.join(__dirname, '..', 'data');
}

const LOGO_PNG = path.join(__dirname, '..', 'build', 'icon.png');

let serverHandle = null;
let win = null;

async function createWindow(port) {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#eef2f7',
    autoHideMenuBar: true,
    title: 'هومينا Homina',
    ...(require('fs').existsSync(LOGO_PNG) ? { icon: LOGO_PNG } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'إعادة التحميل / Reload', accelerator: 'CmdOrCtrl+R', click: () => win.reload() },
        { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' },
        { label: 'أدوات المطور / DevTools', accelerator: 'F12', click: () => win.webContents.openDevTools({ mode: 'detach' }) },
        { type: 'separator' },
        { role: 'quit', label: 'خروج / Quit' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => { win = null; });
  await win.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(async () => {
  try {
    const serverMod = require('../server/index.js');
    serverHandle = await serverMod.start({ port: 4751, silent: false });
    await createWindow(serverHandle.port);
  } catch (e) {
    console.error(e);
    dialog.showErrorBox('هومينا', 'تعذّر تشغيل الخادم الداخلي:\n' + (e && e.message ? e.message : String(e)));
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(serverHandle ? serverHandle.port : 4751);
  });
});

app.on('window-all-closed', () => {
  // على ويندوز: أغلق التطبيق تماماً
  app.quit();
});

app.on('quit', () => {
  // قاعدة البيانات تُحفظ مباشرة (WAL) — لا حاجة لخطوات إضافية
  serverHandle = null;
});
