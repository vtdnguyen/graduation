import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { mkdirSync } from 'node:fs';
const url = 'http://127.0.0.1:5173/grad/';
mkdirSync('shots', { recursive: true });
async function shot(page, name) {
  if (process.argv.includes('--no-shots')) return;
  await page.evaluate(() => window.gsap?.ticker.sleep());
  try { await page.screenshot({ path: `shots/${name}.png`, animations: 'disabled', timeout: 60000 }); }
  finally { await page.evaluate(() => window.gsap?.ticker.wake()); }
}
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on('pageerror', (e) => { errors.push(e.message); console.error('PAGE ERROR', e.message); });
  await page.goto(url + '?skip&debug&to=Minh%20Anh');
  await page.waitForFunction(() => window.actor?.()?.kind === '3d');
  await page.waitForTimeout(2400);
  await shot(page, 'wishes-laptop-final');
  // Chibi đang nằm → phải ngồi dậy rồi cúi đầu cảm ơn.
  await page.evaluate(() => window.actor().lieDown());
  await page.locator('.inv-wish').click();
  await page.locator('.wish-name-text').waitFor();
  assert.equal(await page.locator('.wish-name-text').textContent(), 'Minh Anh');
  await page.locator('.wish-edit').click();
  await page.locator('.wish-name-input').fill('Minh Anh 💚');
  const message = 'Chúc Nguyên tốt nghiệp thật vui!\nMột chặng đường mới thật nhiều niềm vui và những điều dễ thương nhé 💐';
  await page.locator('.wish-message').fill(message);
  await shot(page, 'wishes-laptop-compose');
  let originalId;
  // Mô phỏng máy chủ đã lưu, nhưng phản hồi bị mất: retry phải giữ ID.
  await page.route('**/api/wishes', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    originalId = route.request().postDataJSON().id;
    const response = await route.fetch();
    assert.equal(response.status(), 201);
    await route.abort('failed');
  }, { times: 1 });
  await page.locator('.wish-form .wish-primary').click();
  await page.getByText('Thư chưa gửi được.', { exact: false }).waitFor();
  assert.equal(await page.locator('.wish-message').inputValue(), message);
  const posted = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/wishes'));
  await page.locator('.wish-form .wish-primary').click();
  assert.equal((await posted).postDataJSON().id, originalId);
  await page.locator('.wish-flight').waitFor();
  await page.locator('.wishes-overlay').waitFor({ state: 'hidden' });
  console.log('Thư đã bay, đợi nhân vật cảm ơn');
  await page.getByText('Cảm ơn Minh Anh 💚 nhé!', { exact: true }).waitFor({ state: 'visible', timeout: 10000 }).catch(async (error) => {
    console.log(await page.evaluate(() => ({ busy: window.actor().busy, resting: window.actor().resting, quip: document.querySelector('.quip').outerHTML })));
    await shot(page, 'wishes-error');
    throw error;
  });
  assert.equal(await page.evaluate(() => window.actor().resting), false);
  await page.waitForFunction(() => window.actor().busy);
  await page.waitForTimeout(350);
  await shot(page, 'wishes-thanks');
  await page.waitForTimeout(1400);
  assert.equal(await page.evaluate(() => window.actor().busy), false);
  await page.close();
  // Khách khác / context mới vẫn đọc được lời chúc.
  const second = await browser.newPage({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });
  second.on('pageerror', (e) => errors.push(e.message));
  await second.goto(url + '?skip&no3d&debug');
  await second.locator('.hud-wishes').click();
  await second.locator('.wish-card').first().waitFor();
  assert.equal(await second.locator('.wish-card').first().locator('p').textContent(), message);
  const saved = await (await second.request.get(url + 'api/wishes')).json();
  assert.equal(saved.wishes.filter((wish) => wish.id === originalId).length, 1);
  await shot(second, 'wishes-iphone-inbox');
  await second.locator('.wishes-content > .wish-primary').click();
  assert.equal(await second.locator('.wish-name-input').isVisible(), true);
  await shot(second, 'wishes-iphone-compose');
  // Đóng panel trả focus đúng về nút đã mở nó.
  await second.locator('.wish-close').click();
  assert.equal(await second.locator('.hud-wishes').evaluate((e) => e === document.activeElement), true);
  for (const [name, width, height] of [['se', 375, 560], ['android', 360, 640], ['landscape', 844, 390]]) {
    await second.setViewportSize({ width, height });
    await second.locator('.inv-wish').click();
    await second.waitForTimeout(400);
    const bounds = await second.locator('.wishes-panel').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= height + 1);
    assert.equal(await second.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await shot(second, `wishes-${name}-compose`);
    await second.locator('.wish-close').click();
  }
  assert.deepEqual(errors, []);
  console.log('Chromium: gửi thật vào D1 local, retry không trùng, đọc từ phiên khác, cúi đầu 3D, 4 kích thước — PASS');
} finally { await browser.close(); }

const safari = await webkit.launch();
try {
  const page = await safari.newPage({ viewport: { width: 375, height: 560 }, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url + '?skip&no3d&reduced&to=An');
  await page.locator('.inv-wish').click();
  await page.locator('.wish-message').fill('Chúc mừng Nguyên!');
  await page.route('**/api/wishes', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.locator('.wish-form .wish-primary').click();
  await page.locator('.wishes-overlay').waitFor({ state: 'hidden' });
  await page.getByText('Cảm ơn An nhé!', { exact: true }).waitFor({ state: 'visible' });
  await shot(page, 'wishes-webkit-thanks');
  assert.deepEqual(errors, []);
  console.log('WebKit: iPhone SE, reduced motion, cúi đầu 2D — PASS (phản hồi gửi mô phỏng)');
} finally { await safari.close(); }
