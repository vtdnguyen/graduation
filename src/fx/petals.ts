/**
 * Một canvas 2D duy nhất cho cánh hoa, đốm sáng ban ngày, chùm bung và sao chóng mặt.
 * Đom đóm ban đêm chuyển động trong lớp DOM riêng để không vẽ lại chúng trên canvas toàn màn.
 * Tự viết thay cho thư viện confetti (thư viện đó tốn ~1s khởi tạo lúc tải trang).
 */
import type { Tier } from '../lib/device';
import type { Mood } from '../lib/sky';

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  ph: number;
  vph: number;
  col: string;
}
interface Mote {
  x: number;
  y: number;
  r: number;
  ph: number;
  v: number;
}
type Shape = 'petal' | 'dot' | 'rect' | 'heart' | 'cap' | 'star';
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  ph: number;
  size: number;
  col: string;
  shape: Shape;
  life: number;
  ttl: number;
  g: number;
  drag: number;
  /** quỹ đạo elip quanh 1 điểm (sao chóng mặt) */
  orbit?: { cx: number; cy: number; rx: number; ry: number; w: number; a: number };
}

const COLS = ['#ffc0d4', '#ff9fbd', '#ffffff', '#ffe08a', '#ffd6e5', '#ffb4a2'];
const BURST_COLS = ['#ff8fb1', '#ffc93c', '#ffffff', '#8ec5ff', '#c9a7f5', '#7fd99a', '#ff9f6e'];
const HEART_COLS = ['#ff6f91', '#ff8fb1', '#ffc0d4', '#ffc93c'];

function petalPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.9, -r * 0.6, r * 0.7, r * 0.8, 0, r);
  ctx.bezierCurveTo(-r * 0.7, r * 0.8, -r * 0.9, -r * 0.6, 0, -r);
}
function starPath(ctx: CanvasRenderingContext2D, r: number) {
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}
/** mũ cử nhân nhỏ (vẽ trọn, tự đổ màu) */
function drawCap(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = '#1d2747';
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, s * 0.05);
  ctx.lineTo(s * 0.55, s * 0.05);
  ctx.lineTo(s * 0.5, s * 0.7);
  ctx.quadraticCurveTo(0, s * 0.95, -s * 0.5, s * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2d3f7c';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.55);
  ctx.lineTo(s, 0);
  ctx.lineTo(0, s * 0.5);
  ctx.lineTo(-s, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,190,.75)';
  ctx.lineWidth = Math.max(1, s * 0.09);
  ctx.stroke();
  ctx.strokeStyle = '#ffc93c';
  ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.02);
  ctx.lineTo(s * 0.68, s * 0.12);
  ctx.lineTo(s * 0.72, s * 0.72);
  ctx.stroke();
}
function heartPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.moveTo(0, r * 0.9);
  ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.6, -r * 1.1, 0, -r * 0.35);
  ctx.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.4, -r * 0.1, 0, r * 0.9);
}

export class Petals {
  private ctx: CanvasRenderingContext2D;
  private petals: Petal[] = [];
  private motes: Mote[] = [];
  private sparks: Spark[] = [];
  private W = 1;
  private H = 1;
  private density = 1;
  private burstScale: number;
  private mood: Mood = 'day';

  constructor(
    private canvas: HTMLCanvasElement,
    tier: Tier,
    private reduced: boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.density = (tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35) * (reduced ? 0.4 : 1);
    this.burstScale = (tier === 'high' ? 1 : 0.6) * (reduced ? 0.3 : 1);
  }

  resize(W: number, H: number) {
    this.W = W;
    this.H = H;
    // hạt mềm, không cần độ phân giải cao → luôn vẽ ở 1x cho nhẹ
    this.canvas.width = Math.round(W);
    this.canvas.height = Math.round(H);
    const target = Math.round(Math.min(34, (W * H) / 40000) * this.density) + 4;
    while (this.petals.length < target) this.petals.push(this.spawn(true));
    this.petals.length = target;
    // Ban đêm: giảm cánh hoa; đom đóm chạy ở lớp DOM riêng để tránh vẽ lại trên canvas toàn màn.
    if (this.mood === 'night') this.petals.length = Math.max(3, Math.round(target * 0.3));
    const motes = this.mood === 'night' ? 0 : Math.round(14 * this.density);
    while (this.motes.length < motes) this.motes.push(this.spawnMote(true));
    this.motes.length = motes;
  }

  setMood(m: Mood) {
    this.mood = m;
    this.motes.length = 0;
    this.resize(this.W, this.H);
  }

  setDensity(k: number) {
    this.density *= k;
    this.burstScale *= k;
    this.resize(this.W, this.H);
  }

  private spawn(anywhere: boolean): Petal {
    const r = 4 + Math.random() * 5;
    return {
      x: Math.random() * this.W,
      y: anywhere ? Math.random() * this.H : -20,
      vx: 8 + Math.random() * 18,
      vy: 18 + Math.random() * 26,
      r,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 2,
      ph: Math.random() * Math.PI * 2,
      vph: 1.5 + Math.random() * 2.5,
      col: COLS[Math.floor(Math.random() * COLS.length)],
    };
  }

  private spawnMote(anywhere: boolean): Mote {
    return { x: Math.random() * this.W, y: anywhere ? Math.random() * this.H : this.H + 10, r: 1.5 + Math.random() * 2.5, ph: Math.random() * 6, v: 8 + Math.random() * 14 };
  }

  private emit(n: number, x: number, y: number, o: { angle: number; spread: number; speed: number; g: number; ttl: number; size: number; cols: string[]; shapes: Shape[]; drag?: number }) {
    for (let i = 0; i < n; i++) {
      const a = ((o.angle + (Math.random() - 0.5) * o.spread) * Math.PI) / 180;
      const sp = o.speed * (0.45 + Math.random() * 0.75);
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: -Math.sin(a) * sp,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 10,
        ph: Math.random() * Math.PI * 2,
        size: o.size * (0.7 + Math.random() * 0.6),
        col: o.cols[Math.floor(Math.random() * o.cols.length)],
        shape: o.shapes[Math.floor(Math.random() * o.shapes.length)],
        life: 0,
        ttl: o.ttl * (0.75 + Math.random() * 0.5),
        g: o.g,
        drag: o.drag ?? 1.6,
      });
    }
  }

  /** bung tròn từ một điểm (mở thư) */
  burst(x: number, y: number) {
    const n = Math.round(110 * this.burstScale);
    this.emit(n, x, y, { angle: 90, spread: 360, speed: 620, g: 520, ttl: 2.6, size: 7, cols: BURST_COLS, shapes: ['petal', 'petal', 'dot', 'rect'] });
    this.emit(Math.round(n * 0.4), x, y, { angle: 90, spread: 110, speed: 820, g: 700, ttl: 2.2, size: 6, cols: BURST_COLS, shapes: ['petal', 'rect'] });
  }

  /** hai góc dưới bắn lên chúc mừng (kèm vài chiếc mũ cử nhân) */
  celebrate() {
    const n = Math.round(60 * this.burstScale);
    const shapes: Shape[] = ['petal', 'rect', 'dot', 'petal', 'rect', 'cap'];
    this.emit(n, 0, this.H * 0.92, { angle: 62, spread: 50, speed: 1150, g: 900, ttl: 2.8, size: 7, cols: BURST_COLS, shapes });
    this.emit(n, this.W, this.H * 0.92, { angle: 118, spread: 50, speed: 1150, g: 900, ttl: 2.8, size: 7, cols: BURST_COLS, shapes });
  }

  /** mưa mũ cử nhân từ trên trời rơi xuống, lật lật nhẹ */
  capRain() {
    const n = Math.round(Math.min(34, this.W / 40) * this.burstScale) + 4;
    for (let i = 0; i < n; i++) {
      this.sparks.push({
        x: Math.random() * this.W,
        y: -30 - Math.random() * this.H * 0.6,
        vx: (Math.random() - 0.5) * 50,
        vy: 90 + Math.random() * 110,
        rot: (Math.random() - 0.5) * 1.2,
        vr: (Math.random() - 0.5) * 2.5,
        ph: Math.random() * Math.PI * 2,
        size: 9 + Math.random() * 8,
        col: '',
        shape: 'cap',
        life: 0,
        ttl: 7,
        g: 60,
        drag: 0.5,
      });
    }
  }

  /** sao vàng bay vòng quanh đầu (chóng mặt) */
  dizzy(cx: number, cy: number, r: number) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      this.sparks.push({
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        rot: 0,
        vr: 4,
        ph: 0,
        size: Math.max(6, r * 0.16),
        col: i % 2 ? '#ffe066' : '#ffc93c',
        shape: 'star',
        life: 0,
        ttl: 2.2,
        g: 0,
        drag: 0,
        orbit: { cx, cy, rx: r * 1.15, ry: r * 0.32, w: 5.5, a: (Math.PI * 2 * i) / n },
      });
    }
  }

  /** chùm tim nhỏ khi chạm vào nhân vật */
  hearts(x: number, y: number) {
    this.emit(this.reduced ? 5 : 14, x, y, { angle: 90, spread: 80, speed: 360, g: 260, ttl: 1.5, size: 8, cols: HEART_COLS, shapes: ['heart'], drag: 2.2 });
  }

  update(dt: number, t: number) {
    const { ctx } = this;
    dt = Math.min(dt, 0.05);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    const wind = 10 * Math.sin(t * 0.3) + 6;
    for (const p of this.petals) {
      p.ph += p.vph * dt;
      p.x += (p.vx + wind + Math.sin(p.ph) * 20) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > this.H + 20 || p.x > this.W + 30) Object.assign(p, this.spawn(false), { x: Math.random() * this.W * 1.2 - this.W * 0.2 });
      const flip = Math.cos(p.ph);
      ctx.setTransform(1, 0, 0, 1, p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(Math.max(0.15, Math.abs(flip)), 1);
      ctx.fillStyle = p.col;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      petalPath(ctx, p.r);
      ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const m of this.motes) {
      m.y -= m.v * dt;
      m.ph += dt * 2;
      m.x += Math.sin(m.ph) * 6 * dt;
      if (m.y < -10) Object.assign(m, this.spawnMote(false));
      const a = 0.35 + 0.35 * Math.sin(m.ph * 1.7);
      ctx.globalAlpha = a;
      ctx.fillStyle = this.mood === 'sunset' ? '#ffd9a0' : '#fff8c8';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = Math.min(1, a + 0.3);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // chùm bung
    if (this.sparks.length) {
      let w = 0;
      for (const s of this.sparks) {
        s.life += dt;
        if (s.life >= s.ttl || s.y > this.H + 40) continue;
        const u = s.life / s.ttl;
        if (s.orbit) {
          const o = s.orbit;
          o.a += o.w * dt;
          s.x = o.cx + Math.cos(o.a) * o.rx;
          s.y = o.cy + Math.sin(o.a) * o.ry;
          s.rot += s.vr * dt;
          // mờ dần vào / ra
          ctx.globalAlpha = Math.max(0, Math.min(1, s.life / 0.25, (s.ttl - s.life) / 0.4));
        } else {
          const k = Math.exp(-s.drag * dt);
          s.vx *= k;
          s.vy = s.vy * k + s.g * dt;
          s.x += s.vx * dt + Math.sin(s.ph + s.life * 6) * 18 * dt;
          s.y += s.vy * dt;
          s.rot += s.vr * dt;
          ctx.globalAlpha = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
        }
        ctx.fillStyle = s.col;
        ctx.setTransform(1, 0, 0, 1, s.x, s.y);
        ctx.rotate(s.rot);
        if (s.shape === 'cap') {
          // mũ lật lật: co giãn theo chiều dọc như đang xoay trong không khí
          ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(s.ph + s.life * 2.2)));
          drawCap(ctx, s.size);
          this.sparks[w++] = s;
          continue;
        }
        if (s.shape !== 'heart' && s.shape !== 'dot' && s.shape !== 'star') ctx.scale(Math.max(0.2, Math.abs(Math.cos(s.ph + s.life * 7))), 1);
        ctx.beginPath();
        if (s.shape === 'petal') petalPath(ctx, s.size);
        else if (s.shape === 'heart') heartPath(ctx, s.size);
        else if (s.shape === 'star') starPath(ctx, s.size);
        else if (s.shape === 'dot') ctx.arc(0, 0, s.size * 0.55, 0, Math.PI * 2);
        else ctx.rect(-s.size * 0.5, -s.size * 0.8, s.size, s.size * 1.6);
        ctx.fill();
        this.sparks[w++] = s;
      }
      this.sparks.length = w;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.globalAlpha = 1;
  }
}
