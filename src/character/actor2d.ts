/**
 * Nhân vật 2D (SVG + CSS) — dự phòng khi máy không có WebGL / quá yếu / mất ngữ cảnh 3D.
 * Cùng giao diện Actor với bản 3D.
 */
import { gsap } from 'gsap';
import { BaseActor, type ActionName, type HeadBox, type JumpPhase, type Snapshot } from './actor';
import { el } from '../lib/util';

const SVG = `<svg viewBox="0 0 200 270" class="a2-svg">
<ellipse class="a2-shadow" cx="100" cy="263" rx="62" ry="9" fill="#2d5a2d" opacity=".22"/>
<g class="a2-body">
  <ellipse cx="82" cy="257" rx="15" ry="8" fill="#3a3442"/><ellipse cx="118" cy="257" rx="15" ry="8" fill="#3a3442"/>
  <path d="M60 148 Q100 134 140 148 L160 248 Q100 262 40 248Z" fill="#2d3f7c" stroke="#2a2440" stroke-width="3"/>
  <path d="M90 146 L80 236 L92 238 L98 150Z M110 146 L120 236 L108 238 L102 150Z" fill="#ffc93c"/>
  <g class="arm-r"><path d="M64 150 L46 206 Q56 214 68 208 L78 156Z" fill="#2d3f7c" stroke="#2a2440" stroke-width="3"/><circle class="a2-skin" cx="56" cy="212" r="10" fill="#ffdcc4" stroke="#2a2440" stroke-width="3"/></g>
  <g class="arm-l"><path d="M136 150 L152 200 Q142 210 130 202 L122 156Z" fill="#2d3f7c" stroke="#2a2440" stroke-width="3"/><circle class="a2-skin" cx="141" cy="205" r="10" fill="#ffdcc4" stroke="#2a2440" stroke-width="3"/>
    <g transform="rotate(-12 141 205)"><rect x="112" y="199" width="58" height="12" rx="6" fill="#fff4dc" stroke="#2a2440" stroke-width="2.5"/><rect x="137" y="197" width="8" height="16" fill="#e8505b"/></g></g>
  <g class="a2-head">
    <circle class="a2-skin" cx="100" cy="92" r="64" fill="#ffdcc4" stroke="#2a2440" stroke-width="3"/>
    <path d="M36 98 Q32 30 100 26 Q168 30 164 98 Q152 72 132 66 Q114 82 98 70 Q82 84 62 70 Q46 80 36 98Z" fill="#3b2a22" stroke="#2a2440" stroke-width="3"/>
    <g class="a2-eyes"><ellipse cx="78" cy="104" rx="7" ry="10" fill="#2a2233"/><ellipse cx="122" cy="104" rx="7" ry="10" fill="#2a2233"/>
    <circle cx="81" cy="99" r="2.6" fill="#fff"/><circle cx="125" cy="99" r="2.6" fill="#fff"/></g>
    <ellipse cx="62" cy="122" rx="10" ry="6" fill="#ff9fb0" opacity=".55"/><ellipse cx="138" cy="122" rx="10" ry="6" fill="#ff9fb0" opacity=".55"/>
    <path class="a2-smile" d="M90 126 Q100 136 110 126" stroke="#b8405a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse class="a2-open" cx="100" cy="129" rx="8" ry="6" fill="#7a2335"/>
    <g class="a2-cap">
      <path d="M58 36 L58 54 Q100 68 142 54 L142 36Z" fill="#262a3d" stroke="#2a2440" stroke-width="3"/>
      <path d="M100 6 L178 28 L100 50 L22 28Z" fill="#262a3d" stroke="#2a2440" stroke-width="3"/>
      <circle cx="100" cy="28" r="4" fill="#ffc93c"/>
      <path class="a2-tassel" d="M100 28 L166 34 L166 64" stroke="#ffc93c" stroke-width="3" fill="none"/><path d="M160 62 h12 l-2 16 h-8Z" fill="#ffc93c"/>
    </g>
  </g>
</g></svg>`;

export class Actor2D extends BaseActor {
  readonly kind = '2d' as const;
  private root = el('div', 'actor2d', `<div class="a2-inner">${SVG}</div>`);
  private inner = this.root.firstElementChild as HTMLElement;

  constructor(parent: HTMLElement) {
    super();
    parent.append(this.root);
    this.setVisible(false);
    this.setAction('idle');
  }

  setVisible(v: boolean) {
    this.root.style.visibility = v ? 'visible' : 'hidden';
  }

  setAction(a: ActionName) {
    super.setAction(a);
    this.root.dataset.action = a;
  }

  setSpeaking(on: boolean) {
    this.root.classList.toggle('speaking', on);
  }

  protected applyBow(amount: number) {
    gsap.set(this.inner, { scaleY: 1 - 0.18 * amount, rotation: 8 * amount, transformOrigin: '50% 95%' });
  }

  protected setPhase(p: JumpPhase) {
    if (p === 'crouch') gsap.to(this.inner, { scaleY: 0.82, scaleX: 1.1, duration: 0.15, transformOrigin: '50% 100%' });
    else if (p === 'air') gsap.to(this.inner, { scaleY: 1.08, scaleX: 0.94, duration: 0.15 });
    else gsap.fromTo(this.inner, { scaleY: 0.8, scaleX: 1.12 }, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' });
  }

  protected applyAnchor() {
    const { x, y, h, face } = this.anchor;
    const w = (h * 200) / 270;
    Object.assign(this.root.style, {
      width: `${w}px`,
      height: `${h}px`,
      // xoay vòng (chóng mặt) mô phỏng bằng co giãn ngang theo cos góc xoay
      transform: `translate(${x - w / 2}px, ${y - h * (262 / 270)}px) scaleX(${(face < -0.05 ? -1 : 1) * Math.cos(this.spinAngle)})`,
    });
  }

  resize() {
    this.applyAnchor();
  }

  // ---- nằm nghỉ (bản 2D: xoay cả hình nằm nghiêng sang trái) ----
  private rest = { p: 0 };
  private restTw: gsap.core.Tween | null = null;
  private pendingLie: ((ok: boolean) => void) | null = null;

  private applyRest() {
    const { h } = this.anchor;
    const p = this.rest.p;
    gsap.set(this.root.querySelector('.a2-svg'), { rotation: -82 * p, x: h * 0.42 * p, y: -h * 0.17 * p, transformOrigin: '50% 97%' });
  }

  private stopRest() {
    this.restTw?.kill();
    this.restTw = null;
    const r = this.pendingLie;
    this.pendingLie = null;
    r?.(false);
  }

  lieDown() {
    this.stopRest();
    return new Promise<boolean>((resolve) => {
      this.pendingLie = resolve;
      this.restTw = gsap.to(this.rest, {
        p: 1,
        duration: 1.4 * (1 - this.rest.p) + 0.1,
        delay: this.rest.p < 0.05 ? 0.4 : 0,
        ease: 'sine.inOut',
        onUpdate: () => this.applyRest(),
        onComplete: () => {
          this.restTw = null;
          this.pendingLie = null;
          resolve(true);
        },
      });
    });
  }

  getUp() {
    this.stopRest();
    return new Promise<void>((resolve) => {
      this.restTw = gsap.to(this.rest, {
        p: 0,
        duration: 0.15 + 0.6 * this.rest.p,
        ease: 'power2.inOut',
        onUpdate: () => this.applyRest(),
        onComplete: () => {
          this.restTw = null;
          resolve();
        },
      });
    });
  }

  get resting() {
    return !!this.restTw || this.rest.p > 0.001;
  }

  protected lieAmount() {
    return this.rest.p;
  }

  /** chuyển SVG thành ảnh (để ghép vào ảnh thiệp) */
  async snapshot(): Promise<Snapshot | null> {
    const svg = this.root.querySelector('svg');
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '400');
    clone.setAttribute('height', '540');
    clone.querySelector('.a2-open')?.remove();
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
    try {
      await img.decode();
    } catch {
      return null;
    }
    return { img, w: 400, h: 540, feetX: 200, feetY: 524, charH: 524 };
  }

  headBox(): HeadBox {
    const { x, y, h } = this.anchor;
    const p = this.rest.p;
    return { x: x - h * 0.3 * p, y: y - h * (0.66 - 0.42 * p), r: h * (0.3 - 0.06 * p) };
  }

  update() {
    /* CSS lo phần chuyển động */
  }
}
