/**
 * Bong bóng câu nói ngắn khi bấm vào nhân vật ("Hế lô, gì đấy?", "Hurayyy!"...).
 * Đặt theo vị trí đầu thật (kể cả khi nhân vật đang nằm): phía trên đầu,
 * nếu sát mép trên màn hình thì hiện bên trái đầu.
 */
import { gsap } from 'gsap';
import { clamp, el } from '../lib/util';
import type { HeadBox, Reaction } from '../character/actor';

export class Quip {
  private root = el('div', 'quip');
  private box = el('div', 'quip-box');
  private last = '';
  private hideCall: gsap.core.Tween | null = null;

  constructor(
    parent: HTMLElement,
    /** nhóm nào bỏ trống / comment lại thì động tác đó không kèm câu nói */
    private lines: Partial<Record<Reaction, string[]>>,
  ) {
    this.root.append(this.box);
    this.root.setAttribute('aria-live', 'polite');
    parent.append(this.root);
    gsap.set(this.root, { autoAlpha: 0 });
  }

  say(kind: Reaction, head: HeadBox, W: number, safeTop: number) {
    // chọn ngẫu nhiên, không lặp lại câu vừa nói
    const all = this.lines[kind] ?? [];
    if (!all.length) return;
    const pool = all.filter((s) => s !== this.last);
    const text = pool[Math.floor(Math.random() * pool.length)] ?? all[0];
    this.last = text;
    this.show(text, head, W, safeTop, 2);
  }

  /** hiện một câu bất kỳ trong `seconds` giây */
  show(text: string, head: HeadBox, W: number, safeTop: number, seconds = 3) {
    this.box.textContent = text;

    const bw = this.box.offsetWidth;
    const bh = this.box.offsetHeight;
    const headTop = head.y - head.r;
    let x: number;
    let y: number;
    let side: 'above' | 'left';
    if (headTop - bh - 14 > safeTop + 52) {
      side = 'above';
      x = clamp(head.x - bw / 2, 8, W - bw - 8);
      y = headTop - bh - 14;
      this.root.style.setProperty('--tail-x', `${clamp(head.x - x, 22, bw - 22)}px`);
    } else {
      side = 'left';
      x = Math.max(8, head.x - head.r - bw - 12);
      y = head.y - bh / 2;
    }
    this.root.classList.toggle('above', side === 'above');
    this.root.classList.toggle('left', side === 'left');

    this.hideCall?.kill();
    gsap.killTweensOf(this.root);
    gsap.set(this.root, { x, y, transformOrigin: side === 'above' ? '50% 100%' : '100% 50%' });
    gsap.fromTo(this.root, { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2.2)' });
    this.hideCall = gsap.delayedCall(seconds, () => gsap.to(this.root, { autoAlpha: 0, scale: 0.8, duration: 0.3 }));
  }
}
