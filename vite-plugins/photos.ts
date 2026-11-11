/**
 * Plugin Vite: đọc ảnh gốc trong thư mục `photos/`, tự xoay theo EXIF, thu nhỏ,
 * chuyển sang WebP (2 kích cỡ) vào `public/_photos/`, và xuất danh sách qua
 * module ảo `virtual:photos`.
 *
 * - Thứ tự ảnh: sắp theo tên file (01-..., 02-...).
 * - Chú thích: lấy từ tên file, bỏ số thứ tự đầu. "03 - Bạn bè.jpg" → "Bạn bè".
 * - Khi dev, thêm/xoá ảnh trong `photos/` sẽ tự tải lại trang.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import type { Plugin, ViteDevServer } from 'vite';

export interface PhotoEntry {
  thumb: string;
  full: string;
  caption: string;
  /** width / height */
  ratio: number;
}

const VIRTUAL_ID = 'virtual:photos';
const RESOLVED_ID = '\0' + VIRTUAL_ID;
const SRC_DIR = 'photos';
const OUT_DIR = 'public/_photos';
const ACCEPT = /\.(jpe?g|png|webp|avif|tiff?)$/i;
const MAX_PHOTOS = 8;
const SIZES = { thumb: 520, full: 1400 } as const;

function captionFrom(file: string): string {
  return path
    .parse(file)
    .name.normalize('NFC')
    .replace(/^\d+\s*[-_.)\s]\s*/, '')
    .replace(/[_]+/g, ' ')
    .trim();
}

async function processPhotos(root: string, base: string, log: (m: string) => void): Promise<PhotoEntry[]> {
  const srcDir = path.join(root, SRC_DIR);
  const outDir = path.join(root, OUT_DIR);
  if (!fs.existsSync(srcDir)) return [];
  fs.mkdirSync(outDir, { recursive: true });

  const all = fs.readdirSync(srcDir).filter((f) => !f.startsWith('.'));
  for (const f of all) {
    if (/\.(heic|heif)$/i.test(f)) log(`[photos] Bỏ qua ${f}: hãy đổi HEIC sang JPG.`);
  }
  const files = all
    .filter((f) => ACCEPT.test(f))
    .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }))
    .slice(0, MAX_PHOTOS);

  const keep = new Set<string>();
  const entries: PhotoEntry[] = [];

  for (const [i, file] of files.entries()) {
    const abs = path.join(srcDir, file);
    const hash = crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex').slice(0, 10);
    const stem = `p${i + 1}-${hash}`;
    const metaFile = path.join(outDir, `${stem}.json`);
    let ratio: number;

    if (fs.existsSync(metaFile)) {
      ratio = JSON.parse(fs.readFileSync(metaFile, 'utf8')).ratio;
    } else {
      let w = 1;
      let h = 1;
      for (const [kind, width] of Object.entries(SIZES)) {
        const info = await sharp(abs)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: kind === 'thumb' ? 76 : 82 })
          .toFile(path.join(outDir, `${stem}-${kind}.webp`));
        w = info.width;
        h = info.height;
      }
      ratio = w / h;
      fs.writeFileSync(metaFile, JSON.stringify({ ratio }));
      log(`[photos] Đã tối ưu ${file}`);
    }

    for (const k of ['json', 'thumb.webp', 'full.webp']) keep.add(k === 'json' ? `${stem}.json` : `${stem}-${k}`);
    entries.push({
      thumb: `${base}_photos/${stem}-thumb.webp`,
      full: `${base}_photos/${stem}-full.webp`,
      caption: captionFrom(file),
      ratio,
    });
  }

  // dọn file cũ của ảnh đã bị xoá/đổi
  for (const f of fs.readdirSync(outDir)) {
    if (!keep.has(f)) fs.rmSync(path.join(outDir, f), { force: true });
  }
  return entries;
}

export default function photosPlugin(): Plugin {
  let root = process.cwd();
  let base = '/';
  let pending: Promise<PhotoEntry[]> | null = null;
  const log = (m: string) => console.log(m);

  return {
    name: 'grad-photos',
    configResolved(c) {
      root = c.root;
      base = c.base;
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return;
      pending ??= processPhotos(root, base, log);
      const list = await pending;
      return `export default ${JSON.stringify(list)};`;
    },
    configureServer(server: ViteDevServer) {
      const srcDir = path.join(root, SRC_DIR);
      server.watcher.add(srcDir);
      const onChange = (file: string) => {
        if (!path.resolve(file).startsWith(path.resolve(srcDir))) return;
        pending = null;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
      server.watcher.on('change', onChange);
    },
  };
}
