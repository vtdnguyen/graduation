import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:5173/grad/?to=Minh%20Anh&sky=night', { waitUntil: 'load' });
await p.waitForTimeout(2000);
const box = await p.locator('.env-wrap').boundingBox();
await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await p.waitForTimeout(2350);
await p.screenshot({ path: 'shots/flow-develop.png' });
await p.waitForTimeout(2600);
console.log('câu chào lần 1:', await p.evaluate(() => document.querySelector('.bubble-text').textContent));
// tới cảnh cuối để thấy mưa mũ
await p.waitForFunction(() => getComputedStyle(document.querySelector('.invite')).visibility === 'visible', null, { timeout: 30000 });
await p.waitForTimeout(1900);
await p.screenshot({ path: 'shots/flow-caprain.png' });
// lần mở thứ 2 (phiên mới) → lời chào "quay lại"
const p2 = await ctx.newPage();
await p2.goto('http://localhost:5173/grad/?to=Minh%20Anh', { waitUntil: 'load' });
await p2.waitForTimeout(1800);
const b2 = await p2.locator('.env-wrap').boundingBox();
await p2.evaluate(() => sessionStorage.clear());
await p2.reload({ waitUntil: 'load' });
await p2.waitForTimeout(1800);
await p2.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
await p2.waitForTimeout(5200);
console.log('câu chào khi quay lại:', await p2.evaluate(() => document.querySelector('.bubble-text').textContent));
console.log('lỗi:', errs.length ? errs : 'không');
// bản 2D: lưu thiệp vẫn có nhân vật
const p3 = await b.newPage({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await p3.goto('http://localhost:5173/grad/?skip&no3d&sky=night', { waitUntil: 'load' });
await p3.waitForTimeout(3000);
await p3.locator('.hud-save').tap();
await p3.waitForSelector('.ks-img:not([hidden])', { timeout: 15000 });
await p3.waitForTimeout(700);
await p3.screenshot({ path: 'shots/flow-keepsake-2d-night.png' });
await b.close();
