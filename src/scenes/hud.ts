/** Nút góc trên phải: bỏ qua, đổi ngày/đêm, lưu thiệp, hộp lời chúc và bật/tắt nhạc. */
import { gsap } from 'gsap';
import { el } from '../lib/util';
import { icons } from '../art/svg';
import { audio } from '../lib/audio';
import { wishIcons } from '../art/wish-icons';
import { config } from '../config';

export class Hud {
  readonly root = el('div', 'hud');
  private sound = el('button', 'hud-btn hud-sound');
  private skip = el('button', 'hud-btn hud-skip', `<span>Bỏ qua</span>${icons.skip}`);
  private save = el('button', 'hud-btn hud-save', icons.photo);
  private theme = el('button', 'hud-btn hud-theme');
  private wishes = el('button', 'hud-btn hud-wishes', wishIcons.mail);

  constructor(
    parent: HTMLElement,
    onSkip: () => void,
    onSave: () => void,
    onMoodChange: (night: boolean) => void,
    initialNight: boolean,
    onWishes: () => void,
  ) {
    for (const b of [this.sound, this.skip, this.save, this.theme, this.wishes]) b.type = 'button';
    this.wishes.setAttribute('aria-label', config.wishes.inbox);
    this.wishes.title = config.wishes.inbox;
    this.wishes.addEventListener('click', onWishes);
    this.save.setAttribute('aria-label', 'Lưu thiệp về máy');
    this.save.title = 'Lưu thiệp về máy';
    this.save.addEventListener('click', (e) => {
      e.stopPropagation();
      onSave();
    });
    this.skip.setAttribute('aria-label', 'Bỏ qua phần mở đầu');
    const paint = (m: boolean) => {
      this.sound.innerHTML = m ? icons.soundOff : icons.soundOn;
      this.sound.setAttribute('aria-label', m ? 'Bật âm thanh' : 'Tắt âm thanh');
      this.sound.classList.toggle('off', m);
    };
    paint(audio.muted);
    audio.onChange(paint);
    const paintTheme = (night: boolean) => {
      this.theme.innerHTML = night ? icons.sun : icons.moon;
      this.theme.setAttribute('aria-label', night ? 'Chuyển sang ban ngày' : 'Chuyển sang ban đêm');
      this.theme.title = night ? 'Chuyển sang ban ngày' : 'Chuyển sang ban đêm';
      this.theme.dataset.night = String(night);
    };
    paintTheme(initialNight);
    this.theme.addEventListener('click', (e) => {
      e.stopPropagation();
      const night = this.theme.dataset.night !== 'true';
      paintTheme(night);
      onMoodChange(night);
    });
    this.sound.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.toggle();
    });
    this.skip.addEventListener('click', (e) => {
      e.stopPropagation();
      onSkip();
    });
    this.root.append(this.skip, this.wishes, this.save, this.theme, this.sound);
    parent.append(this.root);
    gsap.set(this.skip, { autoAlpha: 0 });
    this.skip.style.display = 'none';
    // ẩn hẳn (không chiếm chỗ) để nút nhạc luôn sát góc
    this.save.style.display = 'none';
    this.wishes.style.display = 'none';
  }

  showSkip(on: boolean) {
    if (on) this.skip.style.display = '';
    gsap.to(this.skip, { autoAlpha: on ? 1 : 0, duration: 0.4, overwrite: true, onComplete: () => { if (!on) this.skip.style.display = 'none'; } });
  }

  showFinalActions(on: boolean, delay = 0) {
    gsap.delayedCall(delay, () => {
      for (const b of [this.wishes, this.save]) b.style.display = on ? '' : 'none';
      if (on) gsap.fromTo([this.wishes, this.save], { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.08 });
    });
  }
}
