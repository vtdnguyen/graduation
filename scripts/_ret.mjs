import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
async function firstLine(url) {
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(1800);
  const box = await p.locator('.env-wrap').boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await p.waitForFunction(() => document.querySelector('.bubble-text').textContent.length > 0, null, { timeout: 20000 });
  // ảnh lúc vừa treo lên dây (đang rửa)
  const t = await p.evaluate(() => document.querySelector('.bubble-text').textContent);
  await p.close();
  return t;
}
console.log('lần 1:', await firstLine('http://localhost:5173/grad/?to=Minh%20Anh&sky=day'));
console.log('lần 2:', await firstLine('http://localhost:5173/grad/?to=Minh%20Anh&sky=day'));
// rửa ảnh: chụp lúc ảnh vừa treo xong
const p = await ctx.newPage();
await p.goto('http://localhost:5173/grad/', { waitUntil: 'load' });
await p.waitForTimeout(1800);
const box = await p.locator('.env-wrap').boundingBox();
await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await p.waitForTimeout(3000);
await p.screenshot({ path: 'shots/flow-develop.png', clip: { x: 0, y: 0, width: 900, height: 260 } });
await p.waitForTimeout(2200);
await p.screenshot({ path: 'shots/flow-develop2.png', clip: { x: 0, y: 0, width: 900, height: 260 } });
await b.close();
