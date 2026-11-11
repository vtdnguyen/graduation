import { defineConfig, type Plugin } from 'vite';
import photos from './vite-plugins/photos.ts';
import { config } from './src/config.ts';
import { vnParts } from './src/lib/date.ts';

/** Chèn tiêu đề / mô tả / ảnh xem trước (Open Graph) từ src/config.ts vào index.html */
function htmlMeta(): Plugin {
  const g = config.graduate;
  const ev = config.event;
  const d = vnParts(ev.start);
  const vars: Record<string, string> = {
    TITLE: `${g.shortName} mời bạn dự ${ev.title} 🎓`,
    DESC: `${d.time} • ${d.weekday}, ${d.day}/${d.month}/${d.year} • ${ev.venue}. Chạm để mở thiệp nhé!`,
    URL: config.siteUrl,
    OG_IMAGE: `${config.siteUrl}og-image.jpg`,
  };
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return {
    name: 'grad-html-meta',
    transformIndexHtml: (html) => html.replace(/%%(\w+)%%/g, (_, k: string) => esc(vars[k] ?? '')),
  };
}

// Trang sẽ chạy tại https://vtdnguyen.com/grad/ nên base = '/grad/'.
// Khi dev: http://localhost:5173/grad/
export default defineConfig({
  base: '/grad/',
  plugins: [photos(), htmlMeta()],
  build: {
    // Đủ cũ để chạy trong WebView của Messenger/Zalo trên iOS 14+ và Android
    target: ['es2020', 'safari14', 'chrome87'],
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: true,
    port: 5173,
  },
});
