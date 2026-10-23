'use strict';
/**
 * make-icon.js — توليد أيقونة هومينا (PNG + ICO) بدون أي تبعيات
 * الاستخدام: node tools/make-icon.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;      // حجم الأيقونة النهائية
const SS = 2;          // مضاعف دقة العينات (لتنعيم الحواف)

function crc32(buf) {
  return zlib.crc32(buf) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(pixels, w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter none
    pixels.copy(raw, o, y * w * 4, (y + 1) * w * 4);
    o += w * 4;
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* هندسة الأيقونة: مربع مستدير + شكل بيت */
const R = 56 * SS;           // نصف قطر الزوايا
const W = SIZE * SS;
const lerp = (a, b, t) => a + (b - a) * t;

function inRoundedRect(x, y, r) {
  // مستطيل بحواف مستديرة عبر كامل اللوحة (فراغ داخلي 8)
  const pad = 14 * SS, sz = W - 2 * pad;
  const cx = Math.min(Math.max(x, pad + r), pad + sz - r);
  const cy = Math.min(Math.max(y, pad + r), pad + sz - r);
  const dx = x - cx, dy = y - cy;
  return (x >= pad && x <= pad + sz && y >= pad && y <= pad + sz) && (dx * dx + dy * dy) <= r * r;
}
function inHouse(x, y) {
  // السقف: مثلث من (W*0.20,W*0.53) إلى قمة (W/2,W*0.26) إلى (W*0.80,W*0.53)
  const x1 = W * 0.20, y1 = W * 0.53, x2 = W * 0.80, y2 = W * 0.53, apex = W * 0.245;
  if (y >= apex && y <= y1) {
    const t = (y - apex) / (y1 - apex);
    const xl = lerp(W / 2, x1, t), xr = lerp(W / 2, x2, t);
    if (x >= xl && x <= xr) return true;
  }
  // الجسم: مستطيل من y1 إلى y2=W*0.79 بفواصل
  const yb = W * 0.79;
  if (y > y1 && y <= yb) {
    if (x >= W * 0.295 && x <= W * 0.705) return true;
  }
  // الباب (فراغ)
  const doorW1 = W * 0.43, doorW2 = W * 0.57, doorTop = W * 0.585;
  if (x >= doorW1 && x <= doorW2 && y >= doorTop && y <= yb) return 'door';
  return false;
}

function render() {
  const px = Buffer.alloc(SIZE * SIZE * 4);
  const cs = SS * SS;
  for (let Y = 0; Y < SIZE; Y++) {
    for (let X = 0; X < SIZE; X++) {
      let r = 0, g = 0, b = 0, a = 0, doors = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = X * SS + sx + 0.5, y = Y * SS + sy + 0.5;
          if (!inRoundedRect(x, y, R)) continue;
          const tGrad = y / W;
          let cr = Math.round(lerp(0x16, 0x0d, tGrad));
          let cg = Math.round(lerp(0xb2, 0x72, tGrad));
          let cb = Math.round(lerp(0xa4, 0x6e, tGrad));
          const house = inHouse(x, y);
          if (house === 'door') { doors++; continue; }
          if (house) { cr = 255; cg = 255; cb = 255; }
          r += cr; g += cg; b += cb; a++;
        }
      }
      const o = (Y * SIZE + X) * 4;
      if (a === 0) { px[o + 3] = 0; continue; }
      px[o] = Math.round(r / a);
      px[o + 1] = Math.round(g / a);
      px[o + 2] = Math.round(b / a);
      px[o + 3] = 255;
    }
  }
  return px;
}

/* نسخة maskable: خلفية كاملة (مربعة) + البيت مصغَّراً في المنطقة الآمنة 80% */
function renderMaskable() {
  const px = Buffer.alloc(SIZE * SIZE * 4);
  const lerpF = (a, b, t) => a + (b - a) * t;
  for (let Y = 0; Y < SIZE; Y++) {
    for (let X = 0; X < SIZE; X++) {
      let r = 0, g = 0, b = 0, a = 0, doors = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = X * SS + sx + 0.5, y = Y * SS + sy + 0.5;
          // خلفية ممتدة كاملة (بدون زوايا شفافة)
          const tGrad = y / W;
          let cr = Math.round(lerpF(0x16, 0x0d, tGrad));
          let cg = Math.round(lerpF(0xb2, 0x72, tGrad));
          let cb = Math.round(lerpF(0xa4, 0x6e, tGrad));
          // البيت مصغَّراً 80% ومتوسَّطاً في المنطقة الآمنة
          const u = W * 0.5 + (x - W * 0.5) / 0.8;
          const v = W * 0.5 + (y - W * 0.5) / 0.8;
          const house = inHouse(u, v);
          if (house === 'door') { doors++; continue; }
          if (house) { cr = 255; cg = 255; cb = 255; }
          r += cr; g += cg; b += cb; a++;
        }
      }
      const o = (Y * SIZE + X) * 4;
      if (a === 0) { px[o + 3] = 0; continue; }
      px[o] = Math.round(r / a);
      px[o + 1] = Math.round(g / a);
      px[o + 2] = Math.round(b / a);
      px[o + 3] = 255;
    }
  }
  return px;
}

function main() {
  const px = render();
  const png = encodePNG(px, SIZE, SIZE);
  const buildDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(buildDir, { recursive: true });
  // PNG للأيقونة العامة و WebView
  fs.writeFileSync(path.join(buildDir, 'icon.png'), png);
  // نسخة إلى مجلد الويب لأجل favicon
  fs.mkdirSync(path.join(__dirname, '..', 'web', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'web', 'assets', 'icon.png'), png);
  // أيقونة maskable لتطبيق PWA على الموبايل
  fs.writeFileSync(path.join(__dirname, '..', 'web', 'assets', 'icon-maskable.png'),
    encodePNG(renderMaskable(), SIZE, SIZE));
  // ICO: حاوية تحوي سجل 256x256 مضغوطاً بـ PNG
  const hdr = Buffer.alloc(6);
  hdr.writeUInt16LE(0, 0); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = 0; entry[1] = 0;          // 256 => 0
  entry[2] = 0; entry[3] = 0;
  entry[4] = 0; entry[5] = 0;          // colors/reserved
  entry.writeUInt16LE(1, 4);           // planes
  entry.writeUInt16LE(32, 6);          // bpp
  entry.writeUInt32LE(png.length, 8);  // dwBytesInRes
  entry.writeUInt32LE(22, 12);         // dwImageOffset (6 + 16)
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), Buffer.concat([hdr, entry, png]));
  console.log('[icon] build/icon.ico + build/icon.png + web/assets/icon.png — OK (' + png.length + ' bytes png)');
}

main();
