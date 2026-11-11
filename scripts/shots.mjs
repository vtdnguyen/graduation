/**
 * Chụp màn hình kiểm thử trên nhiều thiết bị (Playwright).
 *   node scripts/shots.mjs                       # mặc định: http://localhost:5173/grad/
 *   node scripts/shots.mjs --url http://localhost:4173/grad/ --browser webkit --only iphone
 * Kết quả: shots/<thiết bị>-<cảnh>.png
 */
import fs from 'node:fs';
import { chromium, webkit } from 'playwright';

const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const URL = arg('url', 'http://localhost:5173/grad/');
const BROWSER = arg('browser', 'chromium');
const ONLY = arg('only', '');
const FLOW = arg('flow', 'full'); // full | final | intro
const QUERY = arg('query', '');

const UA_MESSENGER_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0.0.40.109;FBBV/650000000;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBSS/3;FBCR/;FBID/phone;FBLC/vi_VN;FBOP/5]';
const UA_ZALO_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 Zalo android/12100668 ZaloTheme/light ZaloLanguage/vi';

const DEVICES = {
  laptop: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  // iPhone 13 trong Messenger: thanh trên + dưới của app chiếm chỗ → còn ~ 390x664
  iphone: { viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_MESSENGER_IOS },
  // Android nhỏ trong Zalo
  android: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_ZALO_ANDROID },
  // iPhone SE trong Messenger (rất thấp)
  se: { viewport: { width: 375, height: 560 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_MESSENGER_IOS },
  // điện thoại xoay ngang
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
};

fs.mkdirSync('shots', { recursive: true });
const engine = BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ args: BROWSER === 'chromium' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] : [] });

const names = ONLY ? ONLY.split(',') : ['laptop', 'iphone', 'android', 'landscape'];
for (const name of names) {
  const dev = DEVICES[name];
  const ctx = await browser.newContext({ ...dev, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
  });
  const tag = `${BROWSER === 'webkit' ? 'wk-' : ''}${name}`;
  const shot = (s) => page.screenshot({ path: `shots/${tag}-${s}.png` });
  const q = QUERY ? (URL.includes('?') ? '&' : '?') + QUERY : '';

  if (FLOW === 'final') {
    await page.goto(URL + (q ? q + '&skip' : '?skip'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(4500);
    await shot('final');
  } else {
    await page.goto(URL + q, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot('1-intro');
    if (FLOW !== 'intro') {
      const box = await page.locator('.env-wrap').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(700);
      await shot('2-spin');
      await page.waitForTimeout(1300);
      await shot('3-burst');
      await page.waitForTimeout(1500);
      await shot('4-landing');
      await page.waitForTimeout(2200);
      await shot('5-dialogue');
      await page.waitForTimeout(4200);
      await shot('6-dialogue2');
      await page.waitForTimeout(14000);
      await shot('7-final');
    }
  }
  console.log(`${tag}: ${errors.length ? errors.join('\n   ') : 'không lỗi'}`);
  await ctx.close();
}
await browser.close();
