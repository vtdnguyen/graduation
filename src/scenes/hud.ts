/** Nút góc trên phải: bỏ qua (trước cảnh cuối) · lưu thiệp + xem lại (cảnh cuối) · bật/tắt nhạc. */
import { gsap } from 'gsap';
import { el } from '../lib/util';
import { icons } from '../art/svg';
import { audio } from '../lib/audio';

export class Hud {
  readonly root = el('div', 'hud');
  private sound = el('button', 'hud-btn hud-sound');
  private skip = el('button', 'hud-btn hud-skip', `<span>Bỏ qua</span>${icons.skip}`);
  private reset = el('button', 'hud-btn hud-reset', icons.replay);
  private save = el('button', 'hud-btn hud-save', icons.photo);

  constructor(parent: HTMLElement, onSkip: () => void, onReset: () => void, onSave: () => void) {
    for (const b of [this.sound, this.skip, this.reset, this.save]) b.type = 'button';
    this.save.setAttribute('aria-label', 'Lưu thiệp về máy');
    this.save.title = 'Lưu thiệp về máy';
    this.save.addEventListener('click', (e) => {
      e.stopPropagation();
      onSave();
    });
    this.skip.setAttribute('aria-label', 'Bỏ qua phần mở đầu');
    this.reset.setAttribute('aria-label', 'Xem lại từ đầu');
    this.reset.title = 'Xem lại từ đầu';
    const paint = (m: boolean) => {
      this.sound.innerHTML = m ? icons.soundOff : icons.soundOn;
      this.sound.setAttribute('aria-label', m ? 'Bật âm thanh' : 'Tắt âm thanh');
      this.sound.classList.toggle('off', m);
    };
    paint(audio.muted);
    audio.onChange(paint);
    this.sound.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.toggle();
    });
    this.skip.addEventListener('click', (e) => {
      e.stopPropagation();
      onSkip();
    });
    this.reset.addEventListener('click', (e) => {
      e.stopPropagation();
      gsap.to(this.reset.firstElementChild, { rotation: -360, duration: 0.5, ease: 'power2.inOut', onComplete: onReset });
    });
    this.root.append(this.skip, this.save, this.reset, this.sound);
    parent.append(this.root);
    gsap.set(this.skip, { autoAlpha: 0 });
    // ẩn hẳn (không chiếm chỗ) để nút nhạc luôn sát góc
    this.reset.style.display = 'none';
    this.save.style.display = 'none';
  }

  showSkip(on: boolean) {
    gsap.to(this.skip, { autoAlpha: on ? 1 : 0, duration: 0.4 });
  }

  showReset(on: boolean, delay = 0) {
    gsap.delayedCall(delay, () => {
      for (const b of [this.save, this.reset]) b.style.display = on ? '' : 'none';
      if (on) gsap.fromTo([this.save, this.reset], { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.08 });
    });
  }
}
