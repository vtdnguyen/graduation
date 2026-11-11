/**
 * Khu vườn nền: trời, mặt trời, mây, đồi, cỏ, lối đi, 2 cây, cổng hoa, luống hoa trước/sau.
 * Tất cả là SVG/CSS. Hiệu ứng "vườn nở" dùng CSS animation (chạy trên compositor, không tốn
 * luồng JS) — kích hoạt bằng class trên gốc: g-dormant → g-bloom → g-done.
 * Hoa, cây, bướm chỉ chuyển động, không nhận tương tác.
 */
import { gsap } from 'gsap';
import type { Layout } from '../lib/layout';
import { clamp, el, seeded } from '../lib/util';
import { FLOWER_COLORS, cloud, flameTree, flowerArch, moon, roundTree, sunDisc, sunRays, type FlowerKind } from '../art/svg';
import type { Mood } from '../lib/sky';

const KINDS_FRONT: FlowerKind[] = ['daisy', 'tulip', 'sun', 'pom', 'rose', 'bell', 'grass', 'tulip', 'daisy', 'grass'];
const KINDS_MID: FlowerKind[] = ['daisy', 'tulip', 'bell', 'pom', 'grass', 'rose', 'grass'];

interface FlowerSpec {
  kind: FlowerKind;
  /** vị trí theo tỉ lệ chiều ngang 0..1 */
  fx: number;
  /** độ cao tương đối */
  size: number;
  color: number;
  dur: number;
  delay: number;
  flip: boolean;
}

function flowerEl(spec: FlowerSpec, cls: string) {
  const outer = el('div', `fl ${cls}`);
  const inner = el('div', 'fl-sway');
  const cols = FLOWER_COLORS[spec.kind];
  const [p, p2, c] = cols[spec.color % cols.length];
  const vars = [p && `--p:${p}`, p2 && `--p2:${p2}`, c && `--c:${c}`].filter(Boolean).join(';');
  inner.style.cssText = `animation-duration:${spec.dur}s;animation-delay:${-spec.delay}s;${vars}`;
  inner.innerHTML = `<svg viewBox="0 0 60 140" preserveAspectRatio="xMidYMax meet"${spec.flip ? ' style="transform:scaleX(-1)"' : ''}><use href="#f-${spec.kind}"/></svg>`;
  outer.appendChild(inner);
  return outer;
}

export class Garden {
  readonly back = el('div', 'layer garden-back g-dormant');
  readonly front = el('div', 'layer garden-front g-dormant');
  private land!: SVGSVGElement;
  private sunEl = el('div', 'sun');
  private clouds = el('div', 'clouds');
  private trees: HTMLElement[] = [];
  private arch = el('div', 'arch');
  private midBed = el('div', 'bed bed-mid');
  private frontBed = el('div', 'bed bed-front');
  private bushes: HTMLElement[] = [];
  private frontSpecs: FlowerSpec[] = [];
  private midSpecs: FlowerSpec[] = [];
  private bedPortrait: boolean | null = null;
  private parallaxOn = false;
  private mood: Mood = 'day';
  private skyEl!: HTMLElement;
  // trời đêm: 2 lớp sao nhấp nháy lệch pha (opacity cả lớp → chạy trên GPU), trăng, sao băng
  private starsA = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private starsB = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private moonEl = el('div', 'moon', moon());
  private shooting = el('div', 'shooting-star');
  // lớp phủ màu theo buổi (chiều tà / đêm) cho nền phía sau; hoa phía trước được làm tối bằng CSS filter
  // (một lớp phủ toàn màn hình ở phía trước sẽ đè cả phong thư, ảnh và nhân vật)
  private shadeBack = el('div', 'shade');
  private qs: Array<{ x: (v: number) => void; y: (v: number) => void; k: number }> | null = null;

  constructor(parent: HTMLElement, frontParent: HTMLElement, archLabel: string) {
    const sky = el('div', 'sky');
    this.skyEl = sky;
    this.sunEl.innerHTML = `<div class="sun-rays">${sunRays()}</div><div class="sun-disc">${sunDisc()}</div>`;
    const cl: Array<[number, number, number, number]> = [
      // top%, width, duration, delay
      [6, 190, 95, 20],
      [15, 130, 120, 75],
      [3, 110, 140, 110],
      [22, 160, 105, 50],
    ];
    for (const [top, w, dur, delay] of cl) {
      const c = el('div', 'cloud', cloud());
      c.style.cssText = `top:${top}%;width:${w}px;animation-duration:${dur}s;animation-delay:${-delay}s`;
      this.clouds.appendChild(c);
    }
    this.land = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.land.classList.add('land');

    // .tree (vị trí + parallax) > .tree-in (hiệu ứng mọc) > .tree-sway (đung đưa)
    const tl = el('div', 'tree tree-l', `<div class="tree-in"><div class="tree-sway">${flameTree(3)}</div></div>`);
    const tr = el('div', 'tree tree-r', `<div class="tree-in"><div class="tree-sway" style="animation-delay:-2.5s">${roundTree(5)}</div></div>`);
    this.trees = [tl, tr];

    this.arch.innerHTML = `<div class="arch-in">${flowerArch(archLabel)}</div>`;

    this.starsA.classList.add('stars', 'stars-a');
    this.starsB.classList.add('stars', 'stars-b');
    this.back.append(sky, this.starsA, this.starsB, this.shooting, this.moonEl, this.sunEl, this.clouds, this.land, tl, tr, this.midBed, this.arch, this.shadeBack);

    for (const side of ['l', 'r']) {
      const b = el('div', `bush bush-${side}`, `<div class="bush-in"><svg viewBox="0 0 240 140" preserveAspectRatio="xMidYMax meet"><use href="#bush"/></svg></div>`);
      this.bushes.push(b);
    }
    this.front.append(this.frontBed, ...this.bushes);
    parent.appendChild(this.back);
    frontParent.appendChild(this.front);
  }

  private makeSpecs(portrait: boolean) {
    const r = seeded(portrait ? 11 : 12);
    const nFront = portrait ? 16 : 30;
    const nMid = portrait ? 12 : 22;
    const mk = (n: number, kinds: FlowerKind[]): FlowerSpec[] =>
      Array.from({ length: n }, (_, i) => ({
        kind: kinds[Math.floor(r() * kinds.length)],
        fx: (i + 0.15 + r() * 0.7) / n,
        size: 0.65 + r() * 0.5,
        color: Math.floor(r() * 10),
        dur: 2.6 + r() * 2,
        delay: r() * 4,
        flip: r() < 0.5,
      }));
    this.frontSpecs = mk(nFront, KINDS_FRONT);
    this.midSpecs = mk(nMid, KINDS_MID);
    const front = this.frontSpecs.map((s) => flowerEl(s, 'fl-front'));
    const mid = this.midSpecs.map((s) => flowerEl(s, 'fl-mid'));
    // độ trễ nở: từ giữa lan ra hai bên
    const stagger = (els: HTMLElement[], specs: FlowerSpec[], base: number, step: number) =>
      els
        .map((e, i) => ({ e, d: Math.abs(specs[i].fx - 0.5) }))
        .sort((a, b) => a.d - b.d)
        .forEach(({ e }, k) => e.style.setProperty('--d', `${(base + k * step).toFixed(3)}s`));
    stagger(front, this.frontSpecs, 0.15, 0.035);
    stagger(mid, this.midSpecs, 0.3, 0.04);
    this.frontBed.replaceChildren(...front);
    this.midBed.replaceChildren(...mid);
  }

  relayout(L: Layout) {
    const { W, H, horizon, arch } = L;
    if (this.bedPortrait !== L.portrait) {
      this.bedPortrait = L.portrait;
      this.makeSpecs(L.portrait);
    }

    // ---- đất, đồi, lối đi (vẽ theo px thật) ----
    const hz = horizon;
    const hillA = `M0 ${hz} C${W * 0.15} ${hz - H * 0.1} ${W * 0.3} ${hz - H * 0.12} ${W * 0.45} ${hz - H * 0.05} C${W * 0.6} ${hz - H * 0.13} ${W * 0.8} ${hz - H * 0.14} ${W} ${hz - H * 0.06} V${hz + 2} H0Z`;
    const hillB = `M0 ${hz - H * 0.02} C${W * 0.2} ${hz - H * 0.06} ${W * 0.35} ${hz + H * 0.01} ${W * 0.55} ${hz - H * 0.04} C${W * 0.75} ${hz - H * 0.08} ${W * 0.9} ${hz - H * 0.02} ${W} ${hz - H * 0.03} V${hz + 4} H0Z`;
    const pTopW = arch.w * 0.5;
    const pBotW = Math.max(arch.w * 1.5, W * 0.3);
    const pTop = arch.y - arch.h * 0.03;
    const px = arch.x;
    const bx = clamp(px + (W / 2 - px) * 0.25, 0, W);
    const path = `M${px - pTopW / 2} ${pTop} Q${px - pTopW * 0.7} ${(pTop + H) / 2} ${bx - pBotW / 2} ${H + 2} H${bx + pBotW / 2} Q${px + pTopW * 0.7} ${(pTop + H) / 2} ${px + pTopW / 2} ${pTop} Q${px} ${pTop - 8} ${px - pTopW / 2} ${pTop}Z`;
    const r = seeded(7);
    let far = '';
    for (let i = 0; i < 9; i++) {
      const x = (i + r()) * (W / 9);
      const y = hz - H * (0.015 + r() * 0.03);
      const s = Math.min(W, H) * (0.025 + r() * 0.02);
      far += `<circle cx="${x}" cy="${y}" r="${s}" fill="#6fbf72"/><circle cx="${x + s * 0.8}" cy="${y + s * 0.3}" r="${s * 0.75}" fill="#62b468"/>`;
    }
    let tufts = '';
    for (let i = 0; i < (L.portrait ? 26 : 50); i++) {
      const x = r() * W;
      const y = hz + (H - hz) * (0.1 + r() * 0.85);
      const s = 4 + r() * 6;
      tufts += `<path d="M${x - s} ${y} q${s * 0.6} ${-s * 1.2} ${s} ${-s * 1.6} M${x} ${y} q${s * 0.2} ${-s * 1.4} ${s * 0.6} ${-s * 1.9} M${x + s * 0.4} ${y} q${s * 0.5} ${-s} ${s * 1.3} ${-s * 1.3}"/>`;
    }
    let stones = '';
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.5) / 5;
      const y = pTop + (H - pTop) * t;
      const x = px + (bx - px) * t + (i % 2 ? -1 : 1) * pTopW * 0.12 * (1 + t);
      const s = (arch.w * 0.08 + W * 0.02) * (0.6 + t);
      stones += `<ellipse cx="${x}" cy="${y}" rx="${s}" ry="${s * 0.38}" fill="#e7d3ad"/>`;
    }
    this.land.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.land.setAttribute('width', String(W));
    this.land.setAttribute('height', String(H));
    this.land.innerHTML =
      `<defs><linearGradient id="groundG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a5e38f"/><stop offset=".55" stop-color="#7fd06e"/><stop offset="1" stop-color="#5fbb5a"/></linearGradient></defs>` +
      `<path d="${hillA}" fill="#bfe8b0"/>` +
      far +
      `<path d="${hillB}" fill="#9edc8e"/>` +
      `<rect x="0" y="${hz}" width="${W}" height="${H - hz}" fill="url(#groundG)"/>` +
      `<g stroke="#5aaa52" stroke-width="2" fill="none" stroke-linecap="round" opacity=".55">${tufts}</g>` +
      `<path d="${path}" fill="#f6e7c8"/>` +
      stones;

    // ---- mặt trời / trăng / sao ----
    if (this.mood === 'sunset') {
      // mặt trời lặn sau đồi, ở khoảng trống giữa cổng hoa và thiệp mời (màn ngang) / bên trái (màn dọc)
      const sunS = Math.min(W, H) * 0.4;
      const cx = L.portrait ? W * 0.2 : (L.char.x + L.invite.x) / 2;
      Object.assign(this.sunEl.style, { width: `${sunS}px`, height: `${sunS}px`, left: `${cx - sunS / 2}px`, top: `${hz - H * 0.07 - sunS / 2}px` });
      // quầng nắng chiều trên bầu trời đặt đúng sau mặt trời
      this.skyEl.style.setProperty('--sun-x', `${((cx / W) * 100).toFixed(1)}%`);
    } else {
      const sunS = Math.min(W, H) * 0.42;
      Object.assign(this.sunEl.style, { width: `${sunS}px`, height: `${sunS}px`, left: `${W - sunS * 0.62}px`, top: `${-sunS * 0.38 + L.safe.top}px` });
    }
    const moonS = Math.min(W, H) * 0.3;
    Object.assign(this.moonEl.style, { width: `${moonS}px`, height: `${moonS}px`, left: `${W - moonS * 0.78}px`, top: `${-moonS * 0.2 + L.safe.top}px` });
    if (this.mood === 'night') this.drawStars(W, hz);

    // ---- cây ----
    const th = clamp(H * (L.portrait ? 0.46 : 0.64), 220, 760);
    const tw = th * 0.75;
    const tBase = hz + H * (L.portrait ? 0.07 : 0.09);
    const [tl, tr] = this.trees;
    Object.assign(tl.style, { width: `${tw}px`, height: `${th}px`, left: `${(L.portrait ? -0.42 : -0.18) * tw}px`, top: `${tBase - th}px` });
    const trX = L.portrait ? W - tw * 0.58 : L.invite.x - tw * 0.2;
    Object.assign(tr.style, { width: `${tw * 0.9}px`, height: `${th * 0.9}px`, left: `${trX}px`, top: `${tBase - th * 0.9 - H * 0.02}px` });

    // ---- cổng hoa ----
    Object.assign(this.arch.style, { width: `${arch.w}px`, height: `${arch.h}px`, left: `${arch.x - arch.w / 2}px`, top: `${arch.y - arch.h}px` });

    // ---- luống hoa ----
    const base = clamp(Math.min(W, H) * (L.portrait ? 0.2 : 0.17), 70, 190);
    const charL = L.char.x - L.char.h * 0.32;
    const charR = L.char.x + L.char.h * 0.32;
    const underChar = H - L.char.y;
    this.frontSpecs.forEach((s, i) => {
      const e = this.frontBed.children[i] as HTMLElement;
      let h = base * s.size * (s.kind === 'sun' ? 1.35 : s.kind === 'grass' ? 0.7 : 1);
      const x = s.fx * W;
      if (x > charL - h * 0.2 && x < charR + h * 0.2) h = Math.min(h, underChar * 1.15);
      const w = (h * 60) / 140;
      Object.assign(e.style, { width: `${w}px`, height: `${h}px`, left: `${x - w / 2}px`, top: `${H - h + h * 0.06}px` });
    });
    const midBase = base * 0.5;
    const midTop = hz + (L.char.y - hz) * 0.15;
    const midBot = L.char.y - L.char.h * 0.02;
    const rr = seeded(99);
    this.midSpecs.forEach((s, i) => {
      const e = this.midBed.children[i] as HTMLElement;
      const h = midBase * s.size * (s.kind === 'grass' ? 0.7 : 1);
      const w = (h * 60) / 140;
      const y = midTop + (midBot - midTop) * rr();
      const x = s.fx * W;
      // tránh đặt hoa đè lên lối đi trước cổng
      const onPath = Math.abs(x - arch.x) < arch.w * 0.35 && y > arch.y - arch.h * 0.1;
      Object.assign(e.style, { width: `${w}px`, height: `${h}px`, left: `${x - w / 2}px`, top: `${y - h}px`, display: onPath ? 'none' : '' });
    });

    // ---- bụi cây góc ----
    const bw = clamp(W * (L.portrait ? 0.48 : 0.24), 160, 420);
    const bh = (bw * 140) / 240;
    Object.assign(this.bushes[0].style, { width: `${bw}px`, height: `${bh}px`, left: `${-bw * 0.32}px`, top: `${H - bh * 0.72}px` });
    Object.assign(this.bushes[1].style, { width: `${bw}px`, height: `${bh}px`, left: `${W - bw * 0.68}px`, top: `${H - bh * 0.72}px` });
  }

  /** đổi bầu trời theo buổi (gọi trước relayout) */
  setMood(m: Mood) {
    this.mood = m;
    document.documentElement.dataset.sky = m;
  }

  private drawStars(W: number, horizon: number) {
    const r = seeded(31);
    let a = '';
    let b = '';
    const n = Math.round(Math.min(70, (W * horizon) / 9000));
    for (let i = 0; i < n; i++) {
      const x = r() * W;
      // dày ở trên, thưa dần về phía chân trời
      const y = Math.pow(r(), 1.6) * horizon * 0.85;
      const rad = 0.8 + r() * 1.6;
      const star = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(2)}" fill="#fffbe8"/>`;
      if (i % 2) a += star;
      else b += star;
    }
    // vài ngôi sao 4 cánh lớn
    for (let i = 0; i < 5; i++) {
      const x = r() * W;
      const y = r() * horizon * 0.6;
      const s = 4 + r() * 4;
      a += `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z" fill="#fff6c8"/>`;
    }
    for (const [svg, html] of [
      [this.starsA, a],
      [this.starsB, b],
    ] as const) {
      svg.setAttribute('viewBox', `0 0 ${W} ${horizon}`);
      svg.setAttribute('width', String(W));
      svg.setAttribute('height', String(horizon));
      svg.innerHTML = html;
    }
  }

  private setState(s: 'g-dormant' | 'g-bloom' | 'g-done') {
    for (const root of [this.back, this.front]) {
      root.classList.remove('g-dormant', 'g-bloom', 'g-done');
      root.classList.add(s);
    }
  }

  /** vườn nở (CSS animation, ~2.8s) rồi chuyển sang trạng thái tĩnh để trình duyệt nhả bớt lớp GPU */
  bloom() {
    this.setState('g-bloom');
    const maxDelay = 0.15 + this.frontSpecs.length * 0.035 + 0.9;
    gsap.delayedCall(Math.max(2.8, maxDelay), () => this.setState('g-done'));
  }

  setBloomed() {
    this.setState('g-done');
  }

  private parallaxTargets() {
    if (this.qs) return this.qs;
    this.qs = [
      { els: this.clouds, k: 8 },
      { els: this.sunEl, k: 5 },
      { els: this.trees[0], k: 12 },
      { els: this.trees[1], k: 12 },
      { els: this.frontBed, k: 16 },
      { els: this.bushes[0], k: 20 },
      { els: this.bushes[1], k: 20 },
    ].map(({ els, k }) => {
      els.classList.add('px');
      return { x: gsap.quickTo(els, 'x', { duration: 1.4, ease: 'power3' }), y: gsap.quickTo(els, 'y', { duration: 1.4, ease: 'power3' }), k };
    });
    return this.qs;
  }

  /** nx, ny trong khoảng -0.5..0.5 */
  private applyParallax(nx: number, ny: number) {
    for (const q of this.parallaxTargets()) {
      q.x(-nx * q.k);
      q.y(-ny * q.k * 0.4);
    }
  }

  /** Hiệu ứng chiều sâu khi rê chuột (chỉ máy tính, bật sau khi mở thư) */
  enableParallax() {
    if (this.parallaxOn) return;
    this.parallaxOn = true;
    let pending = false;
    let nx = 0;
    let ny = 0;
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      nx = e.clientX / window.innerWidth - 0.5;
      ny = e.clientY / window.innerHeight - 0.5;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        this.applyParallax(nx, ny);
      });
    });
  }

  /**
   * Nghiêng điện thoại → khu vườn có chiều sâu. Chỉ bật trên máy không cần xin quyền cảm biến
   * (Android); iOS bắt hiện hộp thoại xin quyền nên bỏ qua.
   */
  enableTilt() {
    if (this.parallaxOn) return;
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: unknown } }).DeviceOrientationEvent;
    if (!DOE || typeof DOE.requestPermission === 'function') return;
    this.parallaxOn = true;
    let base: { b: number; g: number } | null = null;
    let pending = false;
    let nx = 0;
    let ny = 0;
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta == null || e.gamma == null) return;
      // lấy tư thế cầm máy lúc đầu làm gốc, trôi dần theo tư thế mới để không bị lệch mãi
      if (!base) base = { b: e.beta, g: e.gamma };
      base.b += (e.beta - base.b) * 0.01;
      base.g += (e.gamma - base.g) * 0.01;
      nx = Math.max(-0.5, Math.min(0.5, (e.gamma - base.g) / 40));
      ny = Math.max(-0.5, Math.min(0.5, (e.beta - base.b) / 40));
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        this.applyParallax(nx * 1.3, ny * 1.3);
      });
    });
  }
}
