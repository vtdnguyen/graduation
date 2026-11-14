/**
 * Bướm ban ngày và đom đóm ban đêm bay lượn quanh vườn; chỉ để ngắm, không nhận tương tác.
 * Mỗi hiệu ứng là lớp HTML riêng, chuyển động bằng transform/opacity.
 */
import { gsap } from 'gsap';
import { el } from '../lib/util';
import type { Mood } from '../lib/sky';

const WINGS: Array<[string, string]> = [
  ['#ff8fb1', '#ffc0d4'],
  ['#ffc93c', '#ffe590'],
  ['#8ec5ff', '#c6e2ff'],
  ['#c9a7f5', '#e4d4ff'],
  ['#ff9f6e', '#ffd0b0'],
  ['#7fd99a', '#c4f2cf'],
];

const wing = (a: string, b: string, side: 'l' | 'r') =>
  side === 'l'
    ? `<svg viewBox="0 0 30 50"><path d="M30 25 C22 4 4 0 4 12 C4 22 16 26 30 25Z" fill="${a}"/><path d="M30 26 C18 28 8 38 14 44 C20 48 28 38 30 26Z" fill="${b}"/><circle cx="13" cy="12" r="3" fill="#fff" opacity=".7"/></svg>`
    : `<svg viewBox="30 0 30 50"><path d="M30 25 C38 4 56 0 56 12 C56 22 44 26 30 25Z" fill="${a}"/><path d="M30 26 C42 28 52 38 46 44 C40 48 32 38 30 26Z" fill="${b}"/><circle cx="47" cy="12" r="3" fill="#fff" opacity=".7"/></svg>`;

const BODY =
  `<svg class="bf-body" viewBox="0 0 60 50"><ellipse cx="30" cy="27" rx="2.2" ry="9" fill="#3b2f2f"/>` +
  `<path d="M29 18 C27 12 24 9 22 8 M31 18 C33 12 36 9 38 8" stroke="#3b2f2f" stroke-width="1" fill="none" stroke-linecap="round"/></svg>`;

interface Fly {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  speed: number;
  retarget: number;
  size: number;
}

export class GardenInsects {
  readonly layer = el('div', 'layer garden-insects');
  private flies: Fly[] = [];
  private fireflies: Fly[] = [];
  private W = 1;
  private H = 1;
  private active = false;
  private night = false;

  constructor(parent: HTMLElement, count: number) {
    parent.append(this.layer);
    for (let i = 0; i < count; i++) {
      const [a, b] = WINGS[i % WINGS.length];
      const e = el('div', 'bf', `<div class="bf-w bf-wl">${wing(a, b, 'l')}</div><div class="bf-w bf-wr">${wing(a, b, 'r')}</div>${BODY}`);
      e.style.setProperty('--flap', `${0.16 + Math.random() * 0.12}s`);
      const size = 30 + Math.random() * 18;
      e.style.width = `${size}px`;
      e.style.height = `${size * 0.83}px`;
      this.layer.append(e);
      this.flies.push({ el: e, x: -100, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, speed: 45 + Math.random() * 35, retarget: 0, size });
    }
    const fireflyCount = Math.max(3, Math.round(count * 0.7));
    for (let i = 0; i < fireflyCount; i++) {
      const e = el('div', 'ff', '<i class="ff-light"></i>');
      const size = 9 + Math.random() * 5;
      e.style.width = `${size}px`;
      e.style.height = `${size}px`;
      e.firstElementChild!.setAttribute('style', `animation-delay:${-Math.random() * 2.8}s`);
      this.layer.append(e);
      this.fireflies.push({ el: e, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, speed: 18 + Math.random() * 20, retarget: 0, size });
    }
    gsap.set(this.layer, { autoAlpha: 0 });
  }

  resize(W: number, H: number) {
    this.W = W;
    this.H = H;
  }

  private pickTarget(f: Fly) {
    f.tx = this.W * (0.05 + Math.random() * 0.9);
    f.ty = this.H * (this.night ? 0.4 + Math.random() * 0.55 : 0.12 + Math.random() * 0.7);
    f.retarget = this.night ? 2.5 + Math.random() * 3.5 : 2 + Math.random() * 4;
  }

  private place(flies: Fly[], instant: boolean) {
    flies.forEach((f, i) => {
      f.x = this.night ? this.W * (0.08 + Math.random() * 0.84) : instant ? this.W * Math.random() : i % 2 === 0 ? -40 : this.W + 40;
      f.y = this.H * (this.night ? 0.45 + Math.random() * 0.45 : 0.25 + Math.random() * 0.5);
      f.vx = 0;
      f.vy = 0;
      this.pickTarget(f);
    });
  }

  setMood(mood: Mood) {
    this.night = mood === 'night';
    if (this.active) this.place(this.night ? this.fireflies : this.flies, true);
  }

  /** Bướm bay vào từ hai bên; đom đóm lơ lửng giữa bụi cây và luống hoa. */
  enter(instant = false) {
    this.active = true;
    this.layer.classList.add('active');
    gsap.to(this.layer, { autoAlpha: 1, duration: instant ? 0 : 0.6 });
    this.place(this.night ? this.fireflies : this.flies, instant);
  }

  update(dt: number, t: number) {
    if (!this.active) return;
    dt = Math.min(dt, 0.05);
    for (const f of this.night ? this.fireflies : this.flies) {
      f.retarget -= dt;
      if (f.retarget <= 0 || Math.hypot(f.tx - f.x, f.ty - f.y) < 30) this.pickTarget(f);
      const dx = f.tx - f.x;
      const dy = f.ty - f.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      // lái mềm + chập chờn
      const k = 1 - Math.exp(-dt * (this.night ? 0.9 : 1.8));
      f.vx += ((dx / d) * f.speed - f.vx) * k;
      f.vy += ((dy / d) * f.speed - f.vy) * k + Math.sin(t * (this.night ? 1.7 : 5) + f.speed) * (this.night ? 8 : 40) * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const tilt = this.night ? 0 : Math.max(-35, Math.min(35, f.vx * 0.35));
      f.el.style.transform = `translate3d(${(f.x - f.size / 2).toFixed(1)}px, ${(f.y - f.size / 2).toFixed(1)}px, 0) rotate(${tilt.toFixed(1)}deg)`;
    }
  }
}
