/**
 * Phong thư lớn ở giữa màn hình: phát sáng nhịp thở, lắc nhẹ mời gọi, tim bay lên, lấp lánh,
 * vệt ánh kim, dấu sáp niêm phong. Khi chạm: dấu sáp bật ra → nắp thư mở → lá thư trượt lên
 * phát sáng → (main.ts) bung cánh hoa, ảnh bay ra, nhân vật nhảy ra.
 */
import { gsap } from 'gsap';
import type { Layout } from '../lib/layout';
import { el, escapeHtml } from '../lib/util';
import { icons } from '../art/svg';

const HEART = `<svg viewBox="0 0 24 22"><path d="M12 21C5 15.5 1 12 1 7a5.5 5.5 0 0 1 11-1.5A5.5 5.5 0 0 1 23 7c0 5-4 8.5-11 14Z" fill="currentColor"/></svg>`;

/** Dấu sáp có viền gợn sóng */
function waxSeal() {
  let d = '';
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r = 47 * (1 + 0.035 * Math.sin(a * 7) + 0.025 * Math.sin(a * 11 + 1));
    d += `${i ? 'L' : 'M'}${(50 + Math.cos(a) * r).toFixed(2)} ${(50 + Math.sin(a) * r).toFixed(2)}`;
  }
  return (
    `<svg viewBox="0 0 100 100" class="seal-svg">` +
    `<defs><radialGradient id="waxG" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#5fcf80"/><stop offset=".55" stop-color="#2e8b57"/><stop offset="1" stop-color="#1f6a41"/></radialGradient></defs>` +
    `<path d="${d}Z" fill="url(#waxG)"/>` +
    `<circle cx="50" cy="50" r="33" fill="none" stroke="#1d6440" stroke-width="2.5" opacity=".55"/>` +
    `<circle cx="50" cy="50" r="33" fill="none" stroke="#9be3b0" stroke-width="1" opacity=".5" transform="translate(-.8 -.8)"/>` +
    `<ellipse cx="36" cy="30" rx="12" ry="6" fill="#fff" opacity=".22" transform="rotate(-30 36 30)"/>` +
    `</svg>`
  );
}

export class Envelope {
  readonly backdrop = el('div', 'layer intro-backdrop');
  readonly layer = el('div', 'layer intro');
  private wrap = el('div', 'env-wrap');
  private env = el('div', 'env');
  private flap = el('div', 'env-flap');
  private seal = el('div', 'env-seal');
  private letter = el('div', 'env-letter');
  private light = el('div', 'letter-light');
  private glow = el('div', 'env-glow');
  private hint = el('div', 'env-hint');
  private handlers: Array<() => void> = [];
  private opened = false;

  constructor(
    backdropParent: HTMLElement,
    parent: HTMLElement,
    o: { kicker: string; toLabel: string; to: string; fromLabel: string; name: string; date: string; touch: boolean },
  ) {
    const hintText = o.touch ? 'Chạm để mở thư' : 'Nhấn để mở thư';

    const back = el('div', 'env-back');
    this.letter.innerHTML =
      `<div class="letter-paper">` +
      `<i class="letter-cap">${icons.cap}</i>` +
      `<div class="letter-title">Tốt Nghiệp</div>` +
      `<div class="letter-lines"><span></span><span></span><span></span></div>` +
      `</div>`;
    this.letter.prepend(this.light);

    const pocket = el('div', 'env-pocket');
    pocket.innerHTML =
      `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="pocket-svg">` +
      `<defs>` +
      `<linearGradient id="pkS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe4eb"/><stop offset="1" stop-color="#ffd2dd"/></linearGradient>` +
      `<linearGradient id="pkB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3f6"/><stop offset="1" stop-color="#ffe3ea"/></linearGradient>` +
      `</defs>` +
      `<path d="M0 0 L50 57 L0 100Z" fill="url(#pkS)"/>` +
      `<path d="M100 0 L50 57 L100 100Z" fill="url(#pkS)"/>` +
      `<path d="M0 0 L50 57 L100 0" fill="none" stroke="#f2b9c8" stroke-width="1.2" vector-effect="non-scaling-stroke"/>` +
      `<path d="M0 100 L45.5 47.5 Q50 43 54.5 47.5 L100 100Z" fill="url(#pkB)" stroke="#f2b9c8" stroke-width="1.2" vector-effect="non-scaling-stroke"/>` +
      `</svg>` +
      `<div class="env-to"><span class="env-to-label">${escapeHtml(o.toLabel)}</span><span class="env-to-name">${escapeHtml(o.to)}</span></div>` +
      `<div class="env-from">${escapeHtml(o.fromLabel)} ${escapeHtml(o.name)} · ${escapeHtml(o.date)}</div>` +
      `<div class="shine"></div>`;

    this.flap.innerHTML =
      `<div class="flap-face flap-out">` +
      `<svg viewBox="0 0 100 58" preserveAspectRatio="none"><defs><linearGradient id="flO" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9e2"/><stop offset="1" stop-color="#ffc4d2"/></linearGradient></defs>` +
      `<path d="M0 0 H100 L54.5 52 Q50 57 45.5 52Z" fill="url(#flO)" stroke="#eeaabd" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>` +
      `<span class="flap-kicker">${escapeHtml(o.kicker)}</span>` +
      `</div>` +
      `<div class="flap-face flap-in">` +
      `<svg viewBox="0 0 100 58" preserveAspectRatio="none"><defs><pattern id="liner" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#bfeccc"/><circle cx="3" cy="3" r="1.1" fill="#fff" opacity=".8"/></pattern></defs>` +
      `<path d="M0 0 H100 L54.5 52 Q50 57 45.5 52Z" fill="url(#liner)"/></svg>` +
      `</div>`;

    this.seal.innerHTML = `${waxSeal()}<i class="seal-cap">${icons.cap}</i>`;

    this.env.append(back, this.letter, pocket, this.flap, this.seal);

    const float = el('div', 'env-float');
    const wiggle = el('div', 'env-wiggle');
    wiggle.append(this.env);

    const hearts = el('div', 'env-hearts');
    const hs: Array<[number, number, number, string]> = [
      [18, 0.2, 14, '#ff8fb1'],
      [34, 1.4, 11, '#ffc93c'],
      [52, 0.8, 16, '#ff6f91'],
      [70, 2.0, 12, '#ff8fb1'],
      [84, 1.1, 10, '#c9a7f5'],
    ];
    for (const [x, d, s, c] of hs) {
      const h = el('i', 'eh', HEART);
      h.style.cssText = `left:${x}%;width:${s}px;height:${s}px;color:${c};animation-delay:${d}s`;
      hearts.append(h);
    }

    const sparkles = el('div', 'sparkles');
    const spots: Array<[number, number, number, number]> = [
      [-6, 8, 18, 0],
      [103, 14, 14, 0.6],
      [-9, 70, 12, 1.2],
      [106, 76, 20, 0.3],
      [26, -12, 12, 0.9],
      [92, 108, 14, 1.5],
      [6, 104, 16, 0.45],
      [70, -14, 16, 1.1],
    ];
    for (const [x, y, s, d] of spots) {
      const sp = el('i', 'spk', icons.sparkle);
      sp.style.cssText = `left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-delay:${d}s`;
      sparkles.append(sp);
    }

    this.hint.innerHTML = `<span>${hintText}</span><i>${icons.sparkle}</i>`;
    const hintPos = el('div', 'env-hint-pos');
    hintPos.append(this.hint);

    float.append(el('div', 'env-shadow'), this.glow, hearts, wiggle, sparkles, hintPos);
    this.wrap.append(float);
    this.wrap.setAttribute('role', 'button');
    this.wrap.setAttribute('tabindex', '0');
    this.wrap.setAttribute('aria-label', hintText);
    this.layer.append(this.wrap);
    backdropParent.append(this.backdrop);
    parent.append(this.layer);

    gsap.set(this.seal, { xPercent: -50, yPercent: -50 });
    gsap.set(this.flap, { transformPerspective: 900, transformOrigin: '50% 0%' });

    const fire = (e: Event) => {
      if (this.opened) return;
      e.preventDefault();
      this.opened = true;
      this.handlers.forEach((h) => h());
    };
    this.layer.addEventListener('click', fire);
    this.wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') fire(e);
    });
  }

  onOpen(h: () => void) {
    this.handlers.push(h);
  }

  relayout(L: Layout) {
    const { envelope: e } = L;
    Object.assign(this.wrap.style, {
      width: `${e.w}px`,
      height: `${e.h}px`,
      left: `${e.x - e.w / 2}px`,
      top: `${e.y - e.h / 2}px`,
    });
    this.wrap.style.setProperty('--ew', `${e.w}px`);
  }

  /** miệng phong thư — nơi ảnh và nhân vật bay ra */
  mouth(L: Layout) {
    return { x: L.envelope.x, y: L.envelope.y - L.envelope.h * 0.55 };
  }

  /** dấu sáp bật → nắp mở → lá thư trượt lên. ~1.5s */
  openTimeline(reduced: boolean): gsap.core.Timeline {
    this.wrap.classList.add('opening');
    const tl = gsap.timeline();
    tl.to(this.hint, { autoAlpha: 0, y: 8, duration: 0.25 }, 0);
    tl.to(this.glow, { opacity: 1, scale: 1.3, duration: 0.9, ease: 'power2.out' }, 0);
    tl.to(this.seal, { scale: 1.2, duration: 0.14, ease: 'power2.out' }, 0);
    tl.to(this.seal, { scale: 0, rotation: 120, autoAlpha: 0, duration: 0.32, ease: 'back.in(2)' }, 0.14);
    const t0 = reduced ? 0.2 : 0.32;
    tl.to(this.flap, { rotationX: 180, duration: reduced ? 0.5 : 0.75, ease: 'power2.inOut' }, t0);
    // quá 90° thì nắp nằm sau lá thư
    tl.call(() => this.flap.classList.add('behind'), [], t0 + (reduced ? 0.25 : 0.37));
    tl.to(this.letter, { yPercent: -46, duration: 0.7, ease: 'back.out(1.5)' }, t0 + 0.55);
    tl.fromTo(this.light, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1.4, duration: 0.6, ease: 'power2.out' }, t0 + 0.65);
    return tl;
  }

  fadeBackdrop(): gsap.core.Tween {
    return gsap.to(this.backdrop, { opacity: 0, duration: 1.2, ease: 'power1.inOut', onComplete: () => this.backdrop.remove() });
  }

  hideCard(): gsap.core.Tween {
    return gsap.to(this.wrap, {
      y: 70,
      scale: 0.82,
      opacity: 0,
      duration: 0.75,
      ease: 'power2.in',
      onComplete: () => this.layer.remove(),
    });
  }

  removeNow() {
    this.opened = true;
    this.backdrop.remove();
    this.layer.remove();
  }
}
