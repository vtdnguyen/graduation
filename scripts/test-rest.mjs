/**
 * Test hoạt cảnh nằm nghỉ — TẤT ĐỊNH (cần dev server):   node scripts/test-rest.mjs [url]
 * Dùng ?debug: dừng đồng hồ thật, tự bước đúng 60 khung/giây (__step), nên kết quả không phụ thuộc máy chạy test.
 * Trên một trang, lặp qua các vòng nghỉ tự nhiên (6s không bấm → nằm), mỗi vòng bấm ngắt ở một giai đoạn:
 * đang ngáp, đang cầm mũ, đang nghiêng, gần nằm hẳn, đã nằm hẳn. Ghi vị trí đầu + mũ từng khung, tìm "giật cục"
 * trong lúc nằm xuống / ngồi dậy, và kiểm tra nhân vật luôn ngồi dậy xong rồi mới nhảy / tung mũ.
 */
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:5173/grad/?skip&debug';
const FRAME = 1000 / 60;
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
await p.waitForFunction(() => !!window.actor?.()?.headBox, null, { timeout: 30000, polling: 100 });
console.log('nhân vật:', await p.evaluate(() => window.actor().kind));

await p.evaluate((FRAME) => {
  window.__manualTime();
  const a = window.actor();
  let cap = null;
  if (a.kind === '3d') {
    a.root.traverse((o) => {
      if (!cap && o.children.length === 5 && o.children[1]?.geometry?.parameters?.width === 1.3) cap = o;
    });
  }
  const V = a.kind === '3d' ? new a.root.position.constructor() : null;
  const sample = () => {
    const hb = a.headBox();
    let cx = 0;
    let cy = 0;
    if (cap) {
      cap.getWorldPosition(V);
      cx = V.x;
      cy = -V.y;
    }
    return { hx: hb.x, hy: hb.y, cx, cy, lie: a.lieAmount(), resting: a.resting, busy: a.busy };
  };
  /** bước n khung (dừng sớm nếu điều kiện đúng); nhường microtask mỗi khung để các await trong code chạy tiếp */
  window.__run = async (n, stopSrc) => {
    const stop = stopSrc ? new Function('a', `return (${stopSrc})`) : null;
    const out = [];
    for (let i = 0; i < n; i++) {
      window.__step(FRAME);
      out.push(sample());
      await 0;
      await 0;
      if (stop && stop(a)) break;
    }
    return out;
  };
}, FRAME);
const h = await p.evaluate(() => window.actor().anchor.h);

/** giật = quãng dịch 1 khung > 2.5× trung bình 4 khung lân cận và > 2.5% chiều cao nhân vật */
function jerksIn(rec) {
  const out = [];
  let maxStep = 0;
  let sinceRest = 99;
  for (let i = 3; i < rec.length - 2; i++) {
    sinceRest = rec[i].resting ? 0 : sinceRest + 1;
    if (rec[i].busy || sinceRest > 25) continue; // bỏ qua cú nhảy (cố ý) và phần sau khi đã đứng hẳn
    const parts = rec[i].resting ? ['head', 'cap'] : ['head']; // tung mũ sau khi đứng dậy là cố ý
    for (const k of parts) {
      const [x, y] = k === 'head' ? ['hx', 'hy'] : ['cx', 'cy'];
      const d = (j) => Math.hypot(rec[j][x] - rec[j - 1][x], rec[j][y] - rec[j - 1][y]);
      const di = d(i);
      const around = (d(i - 2) + d(i - 1) + d(i + 1) + d(i + 2)) / 4;
      maxStep = Math.max(maxStep, di / h);
      if (di > h * 0.025 && di > around * 2.5) out.push({ part: k, frame: i, step: +(di / h).toFixed(3) });
    }
  }
  return { jerks: out, maxStep: +maxStep.toFixed(3) };
}

// [tên, mức nằm cần đạt trước khi bấm, số khung chờ thêm]
const cases = [
  ['bấm khi đang ngáp', 0, 18],
  ['bấm khi đang cầm mũ', 0, 70],
  ['bấm khi đang nghiêng', 0.35, 0],
  ['bấm khi gần nằm hẳn', 0.8, 0],
  ['bấm khi đã nằm hẳn', 0.999, 40],
];
let ok = true;
for (const [name, lieMin, extra] of cases) {
  // chờ (thời gian thật) tới lúc hẹn giờ 3s kích hoạt nằm nghỉ
  await p.waitForFunction(() => window.actor().resting && !window.actor().busy, null, { timeout: 20000, polling: 20 });
  let rec = [];
  if (lieMin > 0) rec = rec.concat(await p.evaluate((m) => window.__run(600, `a.lieAmount() >= ${m}`), lieMin));
  if (extra) rec = rec.concat(await p.evaluate((n) => window.__run(n), extra));
  const hit = await p.evaluate(() => {
    const hb = window.actor().headBox();
    return { x: hb.x, y: hb.y, lie: window.actor().lieAmount() };
  });
  const tapAt = rec.length;
  await p.mouse.click(hit.x, hit.y);
  rec = rec.concat(await p.evaluate(() => window.__run(150)));
  const after = rec.slice(tapAt);
  const stoodUp = after.some((r) => !r.resting);
  const jumpedWhileLying = after.some((r) => r.busy && r.lie > 0.02);
  const getUpFrames = after.findIndex((r) => !r.resting);
  const { jerks, maxStep } = jerksIn(rec);
  const quip = await p.evaluate(() => document.querySelector('.quip-box').textContent);
  const pass = jerks.length === 0 && stoodUp && !jumpedWhileLying;
  ok &&= pass;
  console.log(
    `${pass ? '✔' : '✘'} ${name.padEnd(22)} nằm=${hit.lie.toFixed(2)}  dậy sau ${(getUpFrames / 60).toFixed(2)}s  bước lớn nhất=${maxStep}h/khung  giật=${jerks.length}${jerks.length ? ' ' + JSON.stringify(jerks) : ''}  nhảy-khi-còn-nằm=${jumpedWhileLying}  "${quip}"`,
  );
}
// để yên cho nằm trọn vẹn 1 lần
await p.waitForFunction(() => window.actor().resting, null, { timeout: 20000, polling: 20 });
const full = await p.evaluate(() => window.__run(240));
const fj = jerksIn(full);
const lieEnd = full[full.length - 1].lie;
const fullOk = fj.jerks.length === 0 && lieEnd > 0.99;
ok &&= fullOk;
console.log(
  `${fullOk ? '✔' : '✘'} nằm xuống trọn vẹn       nằm hẳn sau ${(full.findIndex((r) => r.lie > 0.99) / 60).toFixed(2)}s  bước lớn nhất=${fj.maxStep}h/khung  giật=${fj.jerks.length}${fj.jerks.length ? ' ' + JSON.stringify(fj.jerks) : ''}`,
);
await b.close();
console.log(ok ? 'KẾT QUẢ: mượt, không giật, luôn dậy xong mới làm động tác' : 'KẾT QUẢ: còn lỗi');
process.exit(ok ? 0 : 1);
