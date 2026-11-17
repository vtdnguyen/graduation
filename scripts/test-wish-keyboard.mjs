import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

mkdirSync('shots', { recursive: true });
const iosUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
for (const [engine, label, ua, width, height, guest] of [
  [webkit, 'messenger', `${iosUA} [FBAN/MessengerForiOS;FBAV/500]`, 393, 680, ''],
  [webkit, 'safari-se', iosUA, 375, 560, 'An'],
  [chromium, 'android', undefined, 360, 640, ''],
]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true, userAgent: ua });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ width, height }) => {
      Object.defineProperty(screen, 'width', { value: width });
      Object.defineProperty(screen, 'height', { value: 900 });
      const viewport = new EventTarget();
      Object.assign(viewport, { width, height, offsetTop: 0, offsetLeft: 0, scale: 1 });
      Object.defineProperty(viewport, 'pageTop', { get: () => scrollY + viewport.offsetTop });
      Object.defineProperty(window, 'visualViewport', { value: viewport });
      window.keyboard = (height, offsetTop = 0, scroll = 0, emit = true) => {
        Object.assign(viewport, { height, offsetTop });
        if (scroll) window.scrollTo(0, scroll);
        if (emit) viewport.dispatchEvent(new Event('resize'));
      };
    }, { width, height });
    let sent;
    let attempts = 0;
    await page.route('**/api/wishes', route => {
      if (route.request().method() === 'POST') {
        sent = route.request().postDataJSON();
        if (++attempts === 1) return route.fulfill({ status: 503, json: { error: 'retry' } });
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: { wishes: Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `Khách ${i}`, message: 'Chúc mừng Nguyên!\nThật nhiều niềm vui 💚' })), next: null } });
    });
    await page.goto(`http://127.0.0.1:5173/grad/?skip&no3d&reduced&to=${guest}`);
    await page.locator('.inv-wish').click();
    if (guest) await page.locator('.wish-edit').click();
    await page.locator('.wish-name-input').fill('Minh Anh');
    const hudTop = await page.locator('.hud').evaluate(el => el.style.top || getComputedStyle(el).top);
    const check = async (field, allFields = true) => {
      await page.waitForTimeout(100);
      const state = await page.evaluate(() => {
        const rect = selector => {
          const el = document.querySelector(selector), r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, height: r.height, x: r.x, right: r.right };
        };
        return {
          top: visualViewport.offsetTop, bottom: visualViewport.offsetTop + visualViewport.height,
          panel: rect('.wishes-panel'), header: rect('.wish-header'), area: rect('.wishes-content'),
          name: rect('.wish-name-input'), message: rect('.wish-message'), send: rect('.wish-actions .wish-primary'),
          close: rect('.wish-close'), width: innerWidth,
        };
      });
      assert.ok(state.panel.top >= state.top && state.panel.bottom <= state.bottom + 1, JSON.stringify(state));
      for (const key of ['send', 'close']) {
        assert.ok(state[key].top >= state.top && state[key].bottom <= state.bottom, `${label} ${key} clipped: ${JSON.stringify(state)}`);
        assert.ok(state[key].x >= 0 && state[key].right <= state.width);
      }
      assert.ok(state.header.bottom <= state.area.top + 1);
      assert.ok(state.area.bottom <= state.send.top);
      for (const key of allFields ? ['name', 'message'] : [field]) {
        assert.ok(state[key].top >= state.area.top - 1 && state[key].bottom <= state.area.bottom + 1, `${key} clipped: ${JSON.stringify(state)}`);
      }
      assert.ok(state.name.bottom <= state.message.top, 'Name precedes message');
      assert.equal(await page.locator('.wish-name-input').isVisible(), true, 'Do not hide input on Next/blur');
      assert.equal(await page.locator('.hud').evaluate(el => el.style.top || getComputedStyle(el).top), hudTop, 'HUD does not follow keyboard');
    };
    // Focus name, shrink + pan, then switch using the keyboard Next action.
    await page.evaluate(() => window.keyboard(371, 74, 45));
    await check('name');
    await page.locator('.wish-name-input').press('Enter');
    assert.equal(await page.locator('.wish-message').evaluate(el => el === document.activeElement), true);
    await page.locator('.wish-message').fill('Chúc Nguyên thật nhiều niềm vui!\nLuôn vững bước nhé 💚');
    // Late viewport values without another event: bounded RAF tracking must pick them up.
    await page.evaluate(() => window.keyboard(350, 130, 60, false));
    await check('message');
    for (const [h, top] of [[320, 0], [300, 50], [280, 70], [230, 20], [371, 0]]) {
      await page.locator('.wish-name-input').focus();
      await page.evaluate(([h, top]) => window.keyboard(h, top), [h, top]);
      await check('name', h >= 300);
      await page.locator('.wish-message').focus();
      await check('message', h >= 300);
    }
    await page.screenshot({ path: `shots/keyboard-${label}.png` });
    // Close/reopen keeps draft, defaults/re-edits name, and restores page alignment.
    await page.evaluate(h => window.keyboard(h), height);
    await page.locator('.wish-close').click();
    await page.waitForFunction(() => scrollY === 0);
    await page.locator('.inv-wish').click();
    assert.equal(await page.locator('.wish-name-text').textContent(), 'Minh Anh');
    await page.locator('.wish-edit').click();
    await page.locator('.wish-name-input').fill('Minh Anh sửa');
    await page.locator('.wish-name-input').press('Enter');
    await page.evaluate(() => window.keyboard(320));
    await check('message');
    await page.locator('.wish-actions .wish-primary').click();
    await page.getByText('Thư chưa gửi được.', { exact: false }).waitFor();
    await page.locator('.wish-message').focus();
    await check('message', false);
    const retryId = sent.id;
    await page.locator('.wish-actions .wish-primary').click();
    await page.locator('.wishes-overlay').waitFor({ state: 'hidden' });
    assert.equal(sent.id, retryId);
    assert.equal(sent.name, 'Minh Anh sửa');
    assert.equal(sent.message, 'Chúc Nguyên thật nhiều niềm vui!\nLuôn vững bước nhé 💚');
    await page.evaluate(h => window.keyboard(h), height);
    await page.locator('.hud-wishes').click();
    await page.locator('.wish-card').last().waitFor();
    assert.ok(await page.locator('.wish-list').evaluate(el => el.scrollHeight > el.clientHeight && el.clientHeight > 0));
    assert.ok((await page.locator('.wishes-panel').boundingBox()).height <= height);
    await page.locator('.wishes-content > .wish-primary').click();
    assert.equal(await page.locator('.wish-actions').isVisible(), true);
    await page.locator('.wish-close').click();
    assert.deepEqual(errors, []);
    console.log(`${label}: PASS focus/Next, delayed viewport + pan, 230–371px keyboard area, fixed order/footer, draft/retry/send, long inbox`);
  } finally { await browser.close(); }
}
