/**
 * Bong bóng thoại: chữ hiện dần từng ký tự (giữ nguyên dấu tiếng Việt & emoji),
 * chạm để hiện hết câu / sang câu tiếp, tự chuyển câu sau vài giây.
 */
import { gsap } from 'gsap';
import type { Layout } from '../lib/layout';
import { clamp, el, graphemes } from '../lib/util';
import { audio } from '../lib/audio';
import type { Actor, ActionName } from '../character/actor';

interface Seg {
  text: string;
  bold: boolean;
}

function parse(s: string): Seg[] {
  const out: Seg[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), bold: false });
  return out;
}

export class Dialogue {
  readonly root = el('div', 'bubble');
  private box = el('div', 'bubble-box');
  private text = el('div', 'bubble-text');
  private next = el('div', 'bubble-next', '▸');
  private advance: (() => void) | null = null;
  private cancelled = false;

  constructor(parent: HTMLElement) {
    this.box.append(this.text, this.next);
    this.root.append(this.box);
    this.root.setAttribute('aria-live', 'polite');
    parent.append(this.root);
    gsap.set(this.box, { autoAlpha: 0 });
  }

  relayout(L: Layout) {
    const b = L.bubble;
    this.root.classList.toggle('side', b.mode === 'side');
    this.root.classList.toggle('top', b.mode === 'top');
    if (b.mode === 'side') {
      Object.assign(this.root.style, { left: `${b.x}px`, top: `${b.y}px`, width: '', maxWidth: `${b.maxW}px` });
    } else {
      const w = b.maxW;
      const x = clamp(b.x, w / 2 + 14, L.W - w / 2 - 14);
      Object.assign(this.root.style, { left: `${x - w / 2}px`, top: `${b.y}px`, width: `${w}px`, maxWidth: '' });
      this.root.style.setProperty('--tail-x', `${clamp(L.char.x - (x - w / 2), 30, w - 30)}px`);
    }
  }

  /** Người dùng chạm → hiện hết / sang câu */
  tap() {
    this.advance?.();
  }

  cancel() {
    this.cancelled = true;
    this.advance?.();
  }

  async run(lines: string[], actor: Actor, actions: ActionName[]) {
    this.cancelled = false;
    gsap.fromTo(this.box, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' });
    for (let i = 0; i < lines.length && !this.cancelled; i++) {
      await this.say(lines[i], actor, actions[i] ?? 'talk');
    }
    actor.setSpeaking(false);
    if (!this.cancelled) await this.hide();
  }

  hide() {
    return new Promise<void>((r) => gsap.to(this.box, { autoAlpha: 0, scale: 0.8, duration: 0.3, onComplete: r }));
  }

  private say(line: string, actor: Actor, action: ActionName) {
    return new Promise<void>((resolve) => {
      // dựng sẵn toàn bộ ký tự (ẩn) để bong bóng không đổi kích thước khi gõ chữ
      this.text.replaceChildren();
      const chars: HTMLElement[] = [];
      // không để emoji cuối câu rớt xuống dòng một mình
      line = line.replace(/ (\p{Extended_Pictographic})/gu, '\u00A0$1');
      for (const seg of parse(line)) {
        const host = seg.bold ? el('strong') : this.text;
        for (const g of graphemes(seg.text)) {
          const s = el('span', 'ch');
          s.textContent = g;
          host.append(s);
          chars.push(s);
        }
        if (seg.bold) this.text.append(host);
      }
      this.next.classList.remove('on');
      audio.play('blip', { volume: 0.5 });
      actor.setAction(action);
      actor.setSpeaking(true);

      let i = 0;
      let typing = true;
      let auto = 0;
      const finish = () => {
        typing = false;
        clearInterval(timer);
        chars.forEach((c) => c.classList.add('on'));
        actor.setSpeaking(false);
        this.next.classList.add('on');
        auto = window.setTimeout(done, clamp(1500 + chars.length * 38, 2200, 4200));
      };
      const done = () => {
        clearTimeout(auto);
        this.advance = null;
        resolve();
      };
      const timer = window.setInterval(() => {
        if (i < chars.length) chars[i++].classList.add('on');
        if (i >= chars.length) finish();
      }, 34);
      this.advance = () => {
        if (this.cancelled) {
          clearInterval(timer);
          clearTimeout(auto);
          return done();
        }
        if (typing) finish();
        else done();
      };
    });
  }
}
