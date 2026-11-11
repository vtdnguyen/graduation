import { chromium } from 'playwright';
import fs from 'node:fs';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:5173/grad/?skip&debug&to=Minh%20Anh&sky=sunset', { waitUntil: 'load' });
await p.waitForFunction(() => !!window.actor?.()?.headBox, null, { timeout: 30000 });
await p.waitForTimeout(2500);
// 1) chóng mặt: chạm 5 lần nhanh
const hb = await p.evaluate(() => window.actor().headBox());
for (let i = 0; i < 5; i++) {
  await p.touchscreen.tap(hb.x, hb.y);
  await p.waitForTimeout(260);
}
await p.waitForFunction(() => /Chóng|Bấm gì|Xoay/.test(document.querySelector('.quip-box').textContent), null, { timeout: 4000 }).catch(() => {});
await p.waitForTimeout(500);
await p.screenshot({ path: 'shots/feat-dizzy.png' });
console.log('chóng mặt → câu nói:', await p.evaluate(() => document.querySelector('.quip-box').textContent));
await p.waitForTimeout(1500);
// 2) lưu thiệp
await p.locator('.hud-save').tap();
await p.waitForSelector('.ks-img:not([hidden])', { timeout: 15000 });
await p.waitForTimeout(800);
await p.screenshot({ path: 'shots/feat-keepsake-view.png' });
const dataUrl = await p.evaluate(() => document.querySelector('.ks-img').src);
fs.writeFileSync('shots/feat-keepsake.jpg', Buffer.from(dataUrl.split(',')[1], 'base64'));
const btns = await p.evaluate(() => [...document.querySelectorAll('.ks-btn')].map((b) => b.textContent));
console.log('nút trong khung lưu thiệp:', btns, '| kích thước ảnh:', await p.evaluate(() => [document.querySelector('.ks-img').naturalWidth, document.querySelector('.ks-img').naturalHeight]));
console.log('lỗi:', errs.length ? errs : 'không');
await b.close();
