/** Test hồi quy: bấm "Bỏ qua" giữa lúc nhân vật đang nhảy ra khỏi thư → nhân vật phải đứng đúng vị trí cảnh cuối. Cần dev server. */
import { chromium } from 'playwright';
const b = await chromium.launch();
const results = [];
for (const delay of [2300, 2600, 2900, 3300]) {
  const p = await b.newPage({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto('http://localhost:5173/grad/?debug', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const box = await p.locator('.env-wrap').boundingBox();
  await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await p.waitForTimeout(delay);
  const busy = await p.evaluate(() => window.actor()?.busy ?? null);
  await p.locator('.hud-skip').tap();
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => { const a = window.actor().anchor, f = window.L().charFinal; return { y: Math.round(a.y), finalY: Math.round(f.y), h: Math.round(a.h), finalH: Math.round(f.h) }; });
  results.push({ delay, jumpingWhenSkipped: busy, ok: Math.abs(r.y - r.finalY) < 2 && Math.abs(r.h - r.finalH) < 2, ...r });
  if (delay === 2600) await p.screenshot({ path: 'shots/skip-race.png' });
  await p.close();
}
console.table(results);
await b.close();
