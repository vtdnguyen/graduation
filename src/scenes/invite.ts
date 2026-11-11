/**
 * Thiệp mời động: tên khách, tên & ngành, giờ/ngày, đếm ngược, địa điểm.
 * Chiều cao thiệp vừa khít nội dung (đo bằng measure()), nội dung dài hơn khung thì cuộn.
 */
import { gsap } from 'gsap';
import type { Layout } from '../lib/layout';
import type { Config } from '../config';
import { el, escapeHtml } from '../lib/util';
import { countdown, vnParts } from '../lib/date';
import { cornerFloral, icons } from '../art/svg';

export class Invite {
  readonly root = el('div', 'invite');
  private paper = el('div', 'inv-paper');
  private scroll = el('div', 'inv-scroll');
  private countEl!: HTMLElement;
  private timer = 0;

  constructor(
    parent: HTMLElement,
    private cfg: Config,
    guest: string,
  ) {
    const g = cfg.graduate;
    const ev = cfg.event;
    const d = vnParts(ev.start);
    const who = guest ? `<strong>${escapeHtml(guest)}</strong>` : escapeHtml(cfg.invite.guestFallback);

    const corners = ['tl', 'tr', 'bl', 'br'].map((c) => `<div class="inv-corner ${c}">${cornerFloral()}</div>`).join('');
    this.scroll.innerHTML =
      `<div class="inv-body">` +
      `<p class="inv-greet inv-item">${escapeHtml(cfg.invite.greeting)} ${who}</p>` +
      `<p class="inv-lead inv-item">${escapeHtml(cfg.invite.lead)}</p>` +
      `<h2 class="inv-title inv-item">${escapeHtml(ev.title)}</h2>` +
      `<h1 class="inv-name inv-item">${escapeHtml(g.shortName)}</h1>` +
      `<p class="inv-major inv-item">Ngành ${escapeHtml(g.major)}</p>` +
      `<div class="inv-divider inv-item"><span></span><i>${icons.cap}</i><span></span></div>` +
      `<div class="inv-when inv-item">` +
      `<div class="inv-time">${d.time}</div>` +
      `<div class="inv-sep"></div>` +
      `<div class="inv-date"><span>${d.weekday}</span><strong>${d.day} . ${d.month} . ${d.year}</strong></div>` +
      `</div>` +
      `<div class="inv-count inv-item" aria-label="Đếm ngược"></div>` +
      `<div class="inv-where inv-item"><i>${icons.pin}</i><div><strong>${escapeHtml(ev.venue)}</strong><span>${escapeHtml(ev.address)}</span></div></div>` +
      `<p class="inv-closing inv-item">${escapeHtml(cfg.invite.closing)}</p>` +
      `</div>`;

    this.paper.innerHTML = corners;
    this.paper.append(this.scroll);
    this.root.append(this.paper);
    parent.append(this.root);
    this.countEl = this.scroll.querySelector('.inv-count')!;
    gsap.set(this.root, { autoAlpha: 0 });
    this.tick();
  }

  /** compact: màn dọc hoặc thấp (gọn chữ); tight: rất thấp (iPhone SE, điện thoại xoay ngang) */
  private setWidth(w: number, availH: number, portrait: boolean) {
    this.root.style.width = `${w}px`;
    this.root.style.setProperty('--u', `${Math.min(w / 100, 4.2).toFixed(3)}px`);
    this.root.classList.toggle('compact', portrait || availH < 700);
    this.root.classList.toggle('tight', availH < 600);
  }

  /** chiều cao tự nhiên của nội dung ở chiều rộng w */
  measure(w: number, availH: number, portrait: boolean): number {
    this.setWidth(w, availH, portrait);
    const body = this.scroll.firstElementChild as HTMLElement;
    const cs = getComputedStyle(this.scroll);
    return Math.ceil(body.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom));
  }

  relayout(L: Layout) {
    const r = L.invite;
    this.setWidth(r.w, L.H, L.portrait);
    Object.assign(this.root.style, { left: `${r.x}px`, top: `${r.y}px`, height: `${r.h}px` });
  }

  private tick() {
    const c = countdown(this.cfg.event.start);
    if (c.done) {
      // trong ngày diễn ra lễ (giờ VN) → "Hôm nay là ngày vui"; sau đó → lời cảm ơn
      const vnDay = (t: number) => new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10);
      const sameDay = vnDay(Date.now()) === vnDay(new Date(this.cfg.event.start).getTime());
      this.countEl.innerHTML = sameDay
        ? `<div class="inv-today">Hôm nay là ngày vui! 🎉</div>`
        : `<div class="inv-today">Cảm ơn bạn đã chung vui cùng mình 💚</div>`;
      clearInterval(this.timer);
      return;
    }
    const box = (n: number, label: string) => `<div class="cd"><b>${String(n).padStart(2, '0')}</b><span>${label}</span></div>`;
    this.countEl.innerHTML = box(c.days, 'ngày') + box(c.hours, 'giờ') + box(c.minutes, 'phút') + box(c.seconds, 'giây');
  }

  private startTimer() {
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 1000);
  }

  show(): gsap.core.Timeline {
    this.startTimer();
    const tl = gsap.timeline();
    const items = this.scroll.querySelectorAll('.inv-item');
    const vines = this.paper.querySelectorAll('.cf-vine');
    const pops = this.paper.querySelectorAll('.cf-leaf, .cf-flower');
    tl.set(this.root, { autoAlpha: 1 });
    tl.fromTo(this.paper, { y: '70vh', rotation: -8, scale: 0.85 }, { y: 0, rotation: 0, scale: 1, duration: 1.1, ease: 'back.out(1.2)' }, 0);
    tl.fromTo(vines, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.2, ease: 'power2.inOut' }, 0.6);
    tl.fromTo(pops, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, ease: 'back.out(3)', stagger: 0.02 }, 0.9);
    tl.fromTo(items, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out' }, 0.55);
    tl.set(this.paper, { clearProps: 'transform' });
    return tl;
  }

  setShown() {
    this.startTimer();
    gsap.set(this.root, { autoAlpha: 1 });
    gsap.set(this.paper, { clearProps: 'transform' });
    gsap.set(this.scroll.querySelectorAll('.inv-item'), { autoAlpha: 1, y: 0 });
  }
}
