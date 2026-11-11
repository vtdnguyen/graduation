/**
 * Tạo ảnh xem trước public/og-image.jpg (1200x630) — ảnh hiện khi gửi link qua Messenger/Zalo/Facebook.
 * Cần dev server đang chạy (npm run dev) hoặc truyền --url.
 *   npm run og
 *   node scripts/og-image.mjs --url http://localhost:4173/grad/
 */
import { chromium } from 'playwright';

const i = process.argv.indexOf('--url');
const URL = i > 0 ? process.argv[i + 1] : 'http://localhost:5173/grad/';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: 'vi-VN' });
await page.goto(`${URL}?og`, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
await page.screenshot({ path: 'public/og-image.jpg', type: 'jpeg', quality: 86 });
await browser.close();
console.log('Đã tạo public/og-image.jpg');
