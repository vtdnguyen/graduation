/** Xóa lời nhắn thử: node scripts/clear-wishes.mjs --local|--remote [--name "Tên"]
 * Mặc định chỉ xem trước. Thêm --yes để thực sự xóa những dòng đã chọn.
 * Không có --name: chọn toàn bộ lịch sử trong môi trường chỉ định.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
const nameIndex = args.indexOf('--name');
const name = nameIndex >= 0 ? args[nameIndex + 1] : undefined;
const allowed = new Set(['--local', '--remote', '--yes', '--name']);
if (args.includes('--local') === args.includes('--remote') || (nameIndex >= 0 && (!name || name.startsWith('--'))) || args.some((arg, i) => !allowed.has(arg) && !(nameIndex >= 0 && i === nameIndex + 1))) {
  console.error('Cách dùng: node scripts/clear-wishes.mjs --local|--remote [--name "Tên chính xác"] [--yes]');
  process.exit(1);
}
const where = name === undefined ? '' : ` WHERE name = '${name.replaceAll("'", "''")}'`;
const deleting = args.includes('--yes');
const sql = deleting ? `DELETE FROM wishes${where};` : `SELECT id, name, message, created_at FROM wishes${where} ORDER BY seq DESC;`;
console.log(`${deleting ? 'XÓA' : 'XEM TRƯỚC'}: ${args.includes('--remote') ? 'website thật' : 'máy local'} — ${name === undefined ? 'TOÀN BỘ lời nhắn' : `tên: ${name}`}`);
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const result = spawnSync(process.execPath, [cli, 'd1', 'execute', 'WISHES_DB', args.includes('--remote') ? '--remote' : '--local', '--command', sql], { cwd: root, stdio: 'inherit', shell: false });
if (result.error) console.error(result.error.message);
if (!deleting) console.log('Chưa xóa dữ liệu. Kiểm tra danh sách rồi chạy lại với --yes nếu đúng.');
process.exit(result.status ?? 1);
