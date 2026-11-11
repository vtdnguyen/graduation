/**
 * Ảnh polaroid bay ra từ thiệp rồi treo lên dây đèn. Chạm vào ảnh → xem lớn.
 */
import { gsap } from 'gsap';
import type { Layout } from '../lib/layout';
import { el, escapeHtml, seeded } from '../lib/util';
import { audio } from '../lib/audio';

export interface PhotoData {
  thumb: string;
  full: string;
  caption: string;
  ratio: number;
}

interface Item {
  root: HTMLElement;
  data: PhotoData;
  /** điểm treo (px) */
  pin: { x: number; y: number };
  rot: number;
  drop: number;
}

const SVGNS = 'http://www.w3.org/2000/svg';

export class Photos {
  readonly layer = el('div', 'layer photos');
  private svg = document.createElementNS(SVGNS, 'svg');
  /** bóng đèn chia 2 lớp, nhấp nháy bằng opacity của cả lớp (chạy trên GPU, không vẽ lại SVG) */
  private bulbsA = document.createElementNS(SVGNS, 'svg');
  private bulbsB = document.createElementNS(SVGNS, 'svg');
  private lights = el('div', 'garland-lights');
  private items: Item[] = [];
  private placed = false;
  private L!: Layout;

  constructor(parent: HTMLElement, list: PhotoData[], onOpen: (i: number, from: HTMLElement) => void) {
    this.svg.classList.add('garland');
    this.bulbsA.classList.add('bulbs', 'bulbs-a');
    this.bulbsB.classList.add('bulbs', 'bulbs-b');
    this.lights.append(this.svg, this.bulbsA, this.bulbsB);
    this.lights.style.opacity = '0';
    this.layer.append(this.lights);
    list.forEach((data, i) => {
      const root = el('div', 'pol');
      root.innerHTML =
        `<div class="pol-swing" style="animation-delay:${-i * 0.7}s;animation-duration:${3.2 + (i % 3) * 0.5}s">` +
        `<span class="pol-clip"></span>` +
        `<button class="pol-card" aria-label="Xem ảnh: ${escapeHtml(data.caption)}">` +
        `<span class="pol-img"><img src="${data.thumb}" alt="${escapeHtml(data.caption)}" decoding="async" draggable="false"></span>` +
        `<span class="pol-cap">${escapeHtml(data.caption)}</span>` +
        `</button></div>`;
      root.querySelector('button')!.addEventListener('click', (e) => {
        e.stopPropagation();
        audio.play('tap');
        onOpen(i, root.querySelector('.pol-img') as HTMLElement);
      });
      this.layer.append(root);
      this.items.push({ root, data, pin: { x: 0, y: 0 }, rot: 0, drop: 0 });
      gsap.set(root, { opacity: 0 });
    });
    parent.append(this.layer);
  }

  relayout(L: Layout) {
    this.L = L;
    const { x0, x1, y0, sag, photoW: w } = L.garland;
    const n = this.items.length;
    const r = seeded(5);
    const B = (t: number) => {
      const cx = (x0 + x1) / 2;
      const cy = y0 + 2 * sag;
      const u = 1 - t;
      return { x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y0 };
    };
    const h = w * 1.4;
    let strings = '';
    this.items.forEach((it, i) => {
      const t = (i + 0.5) / n;
      const p = B(t);
      it.drop = L.portrait && i % 2 === 1 ? w * 0.28 : 0;
      it.pin = { x: p.x, y: p.y + it.drop };
      it.rot = (t - 0.5) * -10 + (r() - 0.5) * 9;
      if (it.drop) strings += `<path d="M${p.x} ${p.y} V${p.y + it.drop}"/>`;
      Object.assign(it.root.style, {
        width: `${w}px`,
        height: `${h}px`,
        left: `${it.pin.x - w / 2}px`,
        top: `${it.pin.y}px`,
      });
      it.root.style.setProperty('--pw', `${w}px`);
      if (this.placed) gsap.set(it.root, { rotation: it.rot, x: 0, y: 0, scale: 1, opacity: 1 });
    });

    // dây + bóng đèn — SVG chỉ cao bằng vùng dây, không phủ cả màn hình
    let bulbsA = '';
    let bulbsB = '';
    const steps = Math.max(8, Math.round((x1 - x0) / 26));
    for (let k = 1; k < steps; k++) {
      const p = B(k / steps);
      const c = ['#fff3a6', '#ffd1e0', '#c9f0ff', '#d9ffc9'][k % 4];
      const b = `<circle cx="${p.x.toFixed(1)}" cy="${(p.y + 4).toFixed(1)}" r="5.5" fill="${c}" opacity=".35"/><circle cx="${p.x.toFixed(1)}" cy="${(p.y + 4).toFixed(1)}" r="3.4" fill="${c}"/>`;
      if (k % 2) bulbsA += b;
      else bulbsB += b;
    }
    const gh = Math.ceil(y0 + 2 * sag + w * 0.3 + 12);
    for (const svg of [this.svg, this.bulbsA, this.bulbsB]) {
      svg.setAttribute('viewBox', `0 0 ${L.W} ${gh}`);
      svg.setAttribute('width', String(L.W));
      svg.setAttribute('height', String(gh));
    }
    this.bulbsA.innerHTML = bulbsA;
    this.bulbsB.innerHTML = bulbsB;
    this.svg.innerHTML =
      `<path d="M${x0} ${y0} Q${(x0 + x1) / 2} ${y0 + 2 * sag} ${x1} ${y0}" stroke="#a07850" stroke-width="2" fill="none"/>` +
      `<g stroke="#a07850" stroke-width="1.5">${strings}</g>` +
      `<circle cx="${x0}" cy="${y0}" r="4" fill="#a07850"/><circle cx="${x1}" cy="${y0}" r="4" fill="#a07850"/>`;
  }

  /** Ảnh bay ra từ tâm thiệp theo đường cong rồi treo lên dây */
  /** @param startAt thời điểm (giây, tính từ bây giờ) timeline này bắt đầu chạy — để căn giờ "rửa ảnh" */
  flyOut(from: { x: number; y: number }, startAt = 0): gsap.core.Timeline {
    const tl = gsap.timeline();
    gsap.set(this.lights, { opacity: 0 });
    tl.to(this.lights, { opacity: 1, duration: 0.8 }, 0.2);
    const r = seeded(17);
    this.items.forEach((it, i) => {
      const dx = from.x - it.pin.x;
      const dy = from.y - it.pin.y - this.L.garland.photoW * 0.7;
      const midX = dx * 0.45 + (r() - 0.5) * 80;
      const midY = Math.min(dy, 0) - this.L.H * 0.12 - r() * 60;
      gsap.set(it.root, { x: dx, y: dy, scale: 0.2, rotation: (r() - 0.5) * 120, opacity: 0, transformOrigin: '50% 0%' });
      // "rửa ảnh" như ảnh chụp lấy liền: trắng lúc bay ra, hiện màu dần sau khi treo lên dây
      it.root.style.setProperty('--dev-delay', `${(startAt + 0.85 + i * 0.11).toFixed(2)}s`);
      it.root.classList.add('developing');
      tl.to(it.root, { opacity: 1, duration: 0.2 }, i * 0.11);
      tl.to(
        it.root,
        {
          motionPath: { path: [{ x: dx, y: dy }, { x: midX, y: midY }, { x: 0, y: 0 }], curviness: 1.25 },
          scale: 1,
          rotation: it.rot,
          duration: 1.05,
          ease: 'power2.out',
          onComplete: () => audio.play('pop', { volume: 0.4, rate: 0.9 + i * 0.05 }),
        },
        i * 0.11,
      );
    });
    tl.call(() => {
      this.placed = true;
      this.layer.classList.add('ready');
    });
    return tl;
  }

  setPlaced() {
    this.placed = true;
    this.layer.classList.add('ready');
    gsap.set(this.lights, { opacity: 1 });
    this.items.forEach((it) => gsap.set(it.root, { x: 0, y: 0, scale: 1, rotation: it.rot, opacity: 1, transformOrigin: '50% 0%' }));
  }

  preload() {
    for (const it of this.items) {
      const im = new Image();
      im.decoding = 'async';
      im.src = it.data.thumb;
    }
  }
}
