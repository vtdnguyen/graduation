import { webkit } from 'playwright';
import assert from 'node:assert/strict';

const browser = await webkit.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(screen, 'width', { value: 390 });
    Object.defineProperty(screen, 'height', { value: 900 });
    const viewport = new EventTarget();
    Object.assign(viewport, { height: 664, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { value: viewport });
  });
  await page.goto('http://127.0.0.1:5173/grad/?skip&debug&no3d&reduced');
  await page.locator('.inv-wish').waitFor();
  const gestures = await page.evaluate(() => {
    const touch = (target, direction, count = 1) => {
      const dispatch = (type, y) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'touches', { value: Array.from({ length: count }, () => ({ clientY: y })) });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      };
      dispatch('touchstart', 200);
      const prevented = dispatch('touchmove', 200 - direction * 20);
      dispatch('touchend', 180);
      return prevented;
    };
    const app = document.querySelector('#app');
    const result = { up: touch(app, 1), down: touch(app, -1), pinch: touch(app, 1, 2) };
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 });
    app.dispatchEvent(wheel);
    result.wheel = wheel.defaultPrevented;
    // Exercise a long inbox using the same scroll surface as the real list.
    const list = document.createElement('div');
    list.className = 'wish-list';
    list.style.cssText = 'width:200px;height:100px;overflow-y:auto;position:absolute;top:100px';
    const content = document.createElement('div');
    content.style.cssText = 'height:800px;flex-shrink:0';
    list.append(content); app.append(list);
    list.scrollTop = 100;
    result.geometry = { height: list.clientHeight, scroll: list.scrollHeight, top: list.scrollTop, overflow: getComputedStyle(list).overflowY };
    result.middleUp = touch(content, 1);
    result.middleDown = touch(content, -1);
    list.scrollTop = 0;
    result.topOut = touch(content, -1);
    result.topIn = touch(content, 1);
    list.scrollTop = list.scrollHeight;
    result.bottomOut = touch(content, 1);
    result.bottomIn = touch(content, -1);
    list.remove();
    return result;
  });
  assert.ok(gestures.geometry.scroll > gestures.geometry.height, JSON.stringify(gestures.geometry));
  delete gestures.geometry;
  assert.deepEqual(gestures, {
    up: true, down: true, pinch: false, wheel: true,
    middleUp: false, middleDown: false, topOut: true, topIn: false, bottomOut: true, bottomIn: false,
  });
  for (const y of [80, 200, 40]) {
    await page.evaluate(y => window.scrollTo(0, y), y);
    await page.waitForFunction(() => scrollY === 0);
  }
  assert.equal(await page.evaluate(() => history.scrollRestoration), 'manual');
  await page.locator('.inv-wish').click();
  await page.locator('.wish-message').fill('Lời chúc vẫn nhập được');
  await page.evaluate(() => window.scrollTo(0, 60));
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => scrollY), 60, 'Allow Safari to pan to focused input');
  await page.locator('.wish-message').evaluate(el => el.blur());
  await page.waitForFunction(() => scrollY === 0);
  await page.locator('.wish-close').click();
  const scene = await page.locator('#app').evaluate(el => ({
    top: el.getBoundingClientRect().top, height: el.clientHeight, position: getComputedStyle(el).position,
  }));
  assert.equal(scene.top, 0);
  assert.ok(scene.height >= 900);
  assert.equal(scene.position, 'relative');
  assert.deepEqual(errors, []);
  console.log('PASS: root touch/wheel lock, nested list boundary handling, automatic alignment, keyboard pan/restore, full-height background.');
} finally {
  await browser.close();
}
