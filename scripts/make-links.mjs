/**
 * Tạo link thiệp cá nhân hoá cho từng khách.
 *   1. Ghi danh sách khách vào guests.txt (mỗi dòng một tên).
 *   2. npm run links
 *   3. Mở links.txt, copy từng link gửi qua Messenger/Zalo.
 * Trên thiệp sẽ hiện "Thân mời <tên>" và nhân vật chào đúng tên khách.
 */
import fs from 'node:fs';

const SITE = 'https://vtdnguyen.com/grad/';
const src = 'guests.txt';
if (!fs.existsSync(src)) {
  fs.writeFileSync(src, 'Minh Anh\nAnh Tuấn\nCô Lan\n', 'utf8');
  console.log('Chưa có guests.txt → đã tạo file mẫu, hãy sửa rồi chạy lại.');
}
const names = fs
  .readFileSync(src, 'utf8')
  .split(/\r?\n/)
  .map((s) => s.normalize('NFC').trim())
  .filter(Boolean);

const lines = names.map((n) => `${n}\t${SITE}?to=${encodeURIComponent(n)}`);
fs.writeFileSync('links.txt', lines.join('\n') + '\n', 'utf8');
console.log(lines.join('\n'));
console.log(`\nĐã ghi ${names.length} link vào links.txt`);
