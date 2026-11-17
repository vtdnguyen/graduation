/**
 * "Lưu thiệp": vẽ một ảnh thiệp mời 1080×1350 (tên khách, ngày giờ, địa điểm, nhân vật, khu vườn theo buổi)
 * rồi hiện trong khung xem: nhấn giữ để lưu (chạy cả trong Messenger/Zalo), Chia sẻ (Web Share) hoặc Tải ảnh.
 * Module này chỉ được tải khi bấm nút → không làm nặng trang.
 */
import { gsap } from 'gsap';
import type { Config } from '../config';
import type { Mood } from '../lib/sky';
import type { Snapshot } from '../character/actor';
import { cornerFloral, icons } from '../art/svg';
import { el } from '../lib/util';
import { vnParts } from '../lib/date';

const W = 1080;
const H = 1350;

const SKY: Record<Mood, [string, string, string]> = {
  day: ['#86cff9', '#bfe8ff', '#fff1d6'],
  sunset: ['#6d78c4', '#f59ac0', '#ffc97e'],
  night: ['#1d2457', '#3a3f86', '#7b6aa8'],
};
const GROUND: Record<Mood, [string, string]> = {
  day: ['#a5e38f', '#5fbb5a'],
  sunset: ['#b9d98a', '#6ea85a'],
  night: ['#4f7a6a', '#2f5446'],
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadSvg(svg: string): Promise<HTMLImageElement> {
  const img = new Image();
  const withNs = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withNs)}`;
  return img.decode().then(() => img);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, petal: string, center: string, stemH: number) {
  ctx.strokeStyle = '#3f9b4f';
  ctx.lineWidth = Math.max(2, s * 0.18);
  ctx.beginPath();
  ctx.moveTo(x, y + stemH);
  ctx.quadraticCurveTo(x + s * 0.4, y + stemH * 0.5, x, y);
  ctx.stroke();
  ctx.fillStyle = '#5cbf60';
  ctx.beginPath();
  ctx.ellipse(x - s * 0.7, y + stemH * 0.6, s * 0.9, s * 0.35, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = petal;
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * s * 0.75, y + Math.sin(a) * s * 0.75, s * 0.55, s * 0.3, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function capIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.45);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + s * 0.45);
  ctx.lineTo(x - s, y);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.55, y + s * 0.2);
  ctx.lineTo(x - s * 0.55, y + s * 0.62);
  ctx.quadraticCurveTo(x, y + s * 0.95, x + s * 0.55, y + s * 0.62);
  ctx.lineTo(x + s * 0.55, y + s * 0.2);
  ctx.lineTo(x, y + s * 0.45);
  ctx.closePath();
  ctx.fill();
}

/** chữ căn giữa nhiều đoạn (mỗi đoạn một kiểu chữ / màu) */
function richLine(ctx: CanvasRenderingContext2D, y: number, runs: Array<{ text: string; font: string; color: string }>) {
  let total = 0;
  for (const r of runs) {
    ctx.font = r.font;
    total += ctx.measureText(r.text).width;
  }
  let x = W / 2 - total / 2;
  ctx.textAlign = 'left';
  for (const r of runs) {
    ctx.font = r.font;
    ctx.fillStyle = r.color;
    ctx.fillText(r.text, x, y);
    x += ctx.measureText(r.text).width;
  }
  ctx.textAlign = 'center';
}

/** thu nhỏ cỡ chữ cho vừa bề rộng */
function fitFont(ctx: CanvasRenderingContext2D, text: string, make: (px: number) => string, px: number, maxW: number) {
  ctx.font = make(px);
  while (px > 12 && ctx.measureText(text).width > maxW) {
    px -= 2;
    ctx.font = make(px);
  }
  return px;
}

export async function renderKeepsake(o: { cfg: Config; guest: string; mood: Mood; snap: Snapshot | null }): Promise<HTMLCanvasElement> {
  const { cfg, guest, mood, snap } = o;
  const g = cfg.graduate;
  const ev = cfg.event;
  const d = vnParts(ev.start);
  const who = guest || cfg.invite.guestFallback;
  const sample = `${cfg.invite.greeting} ${who} ${ev.title} ${g.shortName} Ngành ${g.major} ${ev.venue} ${ev.address} ${d.weekday} 0123456789 . :`;
  await Promise.all(
    ['italic 400 40px Lora', '500 40px Lora', '700 80px "Playfair Display"', '400 160px "Great Vibes"'].map((f) =>
      document.fonts.load(f, sample).catch(() => []),
    ),
  );
  const corner = await loadSvg(cornerFloral()).catch(() => null);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const r = rng(2026);

  // ---- trời ----
  const sky = SKY[mood];
  const horizon = H * 0.66;
  const sg = ctx.createLinearGradient(0, 0, 0, horizon);
  sg.addColorStop(0, sky[0]);
  sg.addColorStop(0.55, sky[1]);
  sg.addColorStop(1, sky[2]);
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, horizon);
  if (mood === 'night') {
    for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = 0.4 + r() * 0.6;
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath();
      ctx.arc(r() * W, Math.pow(r(), 1.5) * horizon * 0.9, 1 + r() * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // đồi + đất
  const hill = (yb: number, amp: number, col: string, ph: number) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, yb - amp * (0.6 + 0.4 * Math.sin(x / 170 + ph)));
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  };
  const night = mood === 'night';
  hill(horizon, 70, night ? '#3d5f5a' : '#bfe8b0', 0.5);
  hill(horizon + 20, 50, night ? '#456c60' : '#9edc8e', 2.1);
  const gg = ctx.createLinearGradient(0, horizon, 0, H);
  gg.addColorStop(0, GROUND[mood][0]);
  gg.addColorStop(1, GROUND[mood][1]);
  ctx.fillStyle = gg;
  ctx.fillRect(0, horizon + 15, W, H - horizon);
  // luống hoa dưới đáy
  const petals = ['#ffffff', '#ff8fb1', '#ffd54f', '#c9a7f5', '#ff8a65', '#9fd0ff'];
  for (let i = 0; i < 26; i++) {
    const x = (i + r() * 0.8) * (W / 26);
    const s = 14 + r() * 12;
    flower(ctx, x, H - 70 - r() * 90, s, petals[Math.floor(r() * petals.length)], '#ffc93c', 120);
  }

  // ---- thẻ thiệp ----
  const cx = 80;
  const cy = 64;
  const cw = W - 160;
  const ch = 890;
  ctx.save();
  ctx.shadowColor = 'rgba(20,50,30,.28)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  roundRect(ctx, cx, cy, cw, ch, 40);
  const pg = ctx.createLinearGradient(0, cy, 0, cy + ch);
  pg.addColorStop(0, '#fff2f6');
  pg.addColorStop(0.45, '#fffaf1');
  pg.addColorStop(1, '#eef9ef');
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(224,169,59,.65)';
  ctx.lineWidth = 3;
  roundRect(ctx, cx + 20, cy + 20, cw - 40, ch - 40, 28);
  ctx.stroke();
  if (corner) {
    const s = 190;
    const put = (x: number, y: number, sx: number, sy: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sx, sy);
      ctx.drawImage(corner, 0, 0, s, s);
      ctx.restore();
    };
    put(cx, cy, 1, 1);
    put(cx + cw, cy, -1, 1);
    put(cx, cy + ch, 1, -1);
    put(cx + cw, cy + ch, -1, -1);
  }

  // ---- chữ ----
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  richLine(ctx, cy + 140, [
    { text: `${cfg.invite.greeting} `, font: 'italic 400 42px Lora, Georgia, serif', color: '#4a5a4a' },
    { text: who, font: `${guest ? '500' : 'italic 400'} 44px Lora, Georgia, serif`, color: guest ? '#e0517a' : '#4a5a4a' },
  ]);
  ctx.fillStyle = '#6b7a6b';
  ctx.font = 'italic 400 32px Lora, Georgia, serif';
  ctx.fillText(cfg.invite.lead, W / 2, cy + 195);
  ctx.fillStyle = '#2e8b57';
  fitFont(ctx, ev.title, (px) => `700 ${px}px "Playfair Display", Georgia, serif`, 84, cw - 160);
  ctx.fillText(ev.title, W / 2, cy + 292);
  // tên (chữ thư pháp, chuyển màu vàng → hồng)
  fitFont(ctx, g.shortName, (px) => `400 ${px}px "Great Vibes", cursive`, 150, cw - 160);
  const tw = ctx.measureText(g.shortName).width;
  const ng = ctx.createLinearGradient(W / 2 - tw / 2, 0, W / 2 + tw / 2, 0);
  ng.addColorStop(0, '#c9831f');
  ng.addColorStop(0.35, '#e9a73c');
  ng.addColorStop(0.7, '#e0517a');
  ng.addColorStop(1, '#c94a8a');
  ctx.fillStyle = ng;
  ctx.fillText(g.shortName, W / 2, cy + 440);
  ctx.fillStyle = '#2f3b2f';
  ctx.font = '500 40px Lora, Georgia, serif';
  ctx.fillText(`Ngành ${g.major}`, W / 2, cy + 562);
  // vạch chia + mũ
  const dy = cy + 622;
  const lg = ctx.createLinearGradient(W / 2 - 300, 0, W / 2 + 300, 0);
  lg.addColorStop(0, 'rgba(224,169,59,0)');
  lg.addColorStop(0.5, 'rgba(224,169,59,.9)');
  lg.addColorStop(1, 'rgba(224,169,59,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(W / 2 - 300, dy, 250, 3);
  ctx.fillRect(W / 2 + 50, dy, 250, 3);
  capIcon(ctx, W / 2, dy - 4, 26, '#e0a93b');
  // giờ · ngày
  const ty = cy + 734;
  ctx.font = '700 84px "Playfair Display", Georgia, serif';
  const timeW = ctx.measureText(d.time).width;
  ctx.font = '700 50px "Playfair Display", Georgia, serif';
  const dateText = `${d.day} . ${d.month} . ${d.year}`;
  const dateW = ctx.measureText(dateText).width;
  const gap = 34;
  const left = W / 2 - (timeW + gap * 2 + dateW) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e0517a';
  ctx.font = '700 84px "Playfair Display", Georgia, serif';
  ctx.fillText(d.time, left, ty);
  ctx.fillStyle = 'rgba(224,169,59,.7)';
  ctx.fillRect(left + timeW + gap - 1, ty - 78, 3, 92);
  ctx.fillStyle = '#2e8b57';
  ctx.font = 'italic 400 34px Lora, Georgia, serif';
  ctx.fillText(d.weekday, left + timeW + gap * 2, ty - 42);
  ctx.fillStyle = '#2f3b2f';
  ctx.font = '700 50px "Playfair Display", Georgia, serif';
  ctx.fillText(dateText, left + timeW + gap * 2, ty + 8);
  ctx.textAlign = 'center';
  // địa điểm
  ctx.fillStyle = '#2f3b2f';
  fitFont(ctx, `📍 ${ev.venue}`, (px) => `500 ${px}px Lora, Georgia, serif`, 38, cw - 200);
  ctx.fillText(`📍 ${ev.venue}`, W / 2, cy + 812);
  ctx.fillStyle = '#5d6b5d';
  fitFont(ctx, ev.address, (px) => `italic 400 ${px}px Lora, Georgia, serif`, 32, cw - 200);
  ctx.fillText(ev.address, W / 2, cy + 858);

  // ---- nhân vật đứng dưới góc phải ----
  if (snap) {
    // đứng dưới mép thiệp, không che chữ
    const k = 350 / snap.charH;
    const fx = W - 230;
    const fy = H - 44;
    ctx.save();
    ctx.fillStyle = 'rgba(20,50,20,.22)';
    ctx.beginPath();
    ctx.ellipse(fx, fy, 150, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(snap.img, fx - snap.feetX * k, fy - snap.feetY * k, snap.w * k, snap.h * k);
  }

  // ---- chân trang ----
  ctx.textAlign = 'left';
  ctx.font = 'italic 400 30px Lora, Georgia, serif';
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = 8;
  ctx.fillText(cfg.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''), 60, H - 40);
  ctx.shadowBlur = 0;
  return c;
}

/** khung xem ảnh thiệp: nhấn giữ để lưu / Chia sẻ / Tải ảnh */
export class KeepsakeView {
  private root = el('div', 'keepsake');
  private img = el('img', 'ks-img');
  private status = el('p', 'ks-status', 'Đang tạo thiệp…');
  private actions = el('div', 'ks-actions');
  private hint = el('p', 'ks-hint');

  constructor(touch: boolean) {
    const panel = el('div', 'ks-panel');
    const close = el('button', 'ks-close', icons.close);
    close.setAttribute('aria-label', 'Đóng');
    this.img.alt = 'Thiệp mời tốt nghiệp';
    this.hint.textContent = touch ? 'Nhấn giữ ảnh để lưu về máy' : 'Lưu thiệp về máy để nhớ ngày vui nha';
    panel.append(this.status, this.img, this.hint, this.actions);
    this.root.append(panel, close);
    document.body.append(this.root);
    close.addEventListener('click', () => this.hide());
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.hide();
    });
  }

  showLoading() {
    this.status.hidden = false;
    this.img.hidden = true;
    this.hint.hidden = true;
    this.actions.replaceChildren();
    this.root.classList.add('on');
    gsap.fromTo(this.root, { opacity: 0 }, { opacity: 1, duration: 0.25 });
  }

  async showCanvas(c: HTMLCanvasElement, fileName: string) {
    const url = c.toDataURL('image/jpeg', 0.92);
    this.img.src = url;
    await this.img.decode().catch(() => {});
    this.status.hidden = true;
    this.img.hidden = false;
    this.hint.hidden = false;
    gsap.fromTo(this.img, { scale: 0.9, rotation: -3, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' });

    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.92));
    const file = blob ? new File([blob], fileName, { type: 'image/jpeg' }) : null;
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (file && nav.canShare?.({ files: [file] })) {
      const share = el('button', 'ks-btn ks-primary', `${icons.share}<span>Chia sẻ / Lưu ảnh</span>`);
      share.addEventListener('click', () => void navigator.share({ files: [file], title: 'Thiệp mời tốt nghiệp' }).catch(() => {}));
      this.actions.append(share);
    }
    else {
      // Máy không hỗ trợ chia sẻ file vẫn lưu được bằng cùng một nút xanh.
      const save = el('a', 'ks-btn ks-primary', `${icons.share}<span>Chia sẻ / Lưu ảnh</span>`) as HTMLAnchorElement;
      save.href = url;
      save.download = fileName;
      this.actions.append(save);
    }
  }

  hide() {
    gsap.to(this.root, { opacity: 0, duration: 0.2, onComplete: () => this.root.classList.remove('on') });
  }
}
