/** Chép dist/ → .deploy/grad/ (vì trang chạy ở đường dẫn /grad/) để wrangler upload. */
import fs from 'node:fs';
fs.rmSync('.deploy', { recursive: true, force: true });
fs.mkdirSync('.deploy', { recursive: true });
fs.cpSync('dist', '.deploy/grad', { recursive: true });
// file hash trong /grad/assets/ không bao giờ đổi nội dung → cache lâu
fs.writeFileSync(
  '.deploy/_headers',
  ['/grad/assets/*', '  Cache-Control: public, max-age=31536000, immutable', '/grad/audio/*', '  Cache-Control: public, max-age=604800', ''].join('\n'),
);
console.log('Đã chuẩn bị .deploy/grad');
