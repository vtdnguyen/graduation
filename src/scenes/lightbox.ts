/** Xem ảnh lớn: vuốt trái/phải hoặc bấm mũi tên để chuyển, chạm nền để đóng. */
import { gsap } from 'gsap';
import { el } from '../lib/util';
import { icons } from '../art/svg';
import type { PhotoData } from './photos';

export class Lightbox {
  private root = el('div', 'lightbox');
  private fig = el('figure', 'lb-fig');
  private img = el('img', 'lb-img');
  private cap = el('figcaption', 'lb-cap');
  private idx = 0;
  private open = false;
  private imageRequest = 0;
  private fullImages = new Map<string, HTMLImageElement>();

  constructor(
    parent: HTMLElement,
    private list: PhotoData[],
  ) {
    this.img.alt = '';
    this.img.draggable = false;
    this.img.decoding = 'async';
    const frame = el('div', 'lb-frame');
    frame.append(this.img, this.cap);
    this.fig.append(frame);
    const prev = el('button', 'lb-btn lb-prev', icons.left);
    const next = el('button', 'lb-btn lb-next', icons.right);
    const close = el('button', 'lb-btn lb-close', icons.close);
    prev.setAttribute('aria-label', 'Ảnh trước');
    next.setAttribute('aria-label', 'Ảnh sau');
    close.setAttribute('aria-label', 'Đóng');
    this.root.append(this.fig, prev, next, close);
    if (list.length < 2) {
      prev.hidden = true;
      next.hidden = true;
    }
    parent.append(this.root);

    prev.addEventListener('click', (e) => (e.stopPropagation(), this.go(-1)));
    next.addEventListener('click', (e) => (e.stopPropagation(), this.go(1)));
    close.addEventListener('click', (e) => (e.stopPropagation(), this.hide()));
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root || e.target === this.fig) this.hide();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.key === 'Escape') this.hide();
      if (e.key === 'ArrowLeft') this.go(-1);
      if (e.key === 'ArrowRight') this.go(1);
    });
    let sx = 0;
    let sy = 0;
    this.root.addEventListener('pointerdown', (e) => {
      sx = e.clientX;
      sy = e.clientY;
    });
    this.root.addEventListener('pointerup', (e) => {
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - sy)) this.go(dx < 0 ? 1 : -1);
    });
  }

  get isOpen() {
    return this.open;
  }

  private setPhoto(i: number) {
    this.idx = (i + this.list.length) % this.list.length;
    const p = this.list[this.idx];
    const request = ++this.imageRequest;
    this.showImage(p.thumb, request);
    this.img.style.aspectRatio = String(p.ratio);
    this.cap.textContent = p.caption;

    const full = this.loadFull(p.full, 'high');
    const showFull = () => {
      if (request === this.imageRequest && this.open) this.showImage(p.full, request);
    };
    if (full.complete) {
      if (full.naturalWidth) showFull();
      else console.warn(`[photo] Không tải được ảnh ${p.full}`);
    } else {
      full.addEventListener('load', showFull, { once: true });
      full.addEventListener(
        'error',
        () => {
          if (request === this.imageRequest) console.warn(`[photo] Không tải được ảnh ${p.full}`);
        },
        { once: true },
      );
    }

    this.preloadFull(this.idx + 1);
    this.preloadFull(this.idx - 1);
  }

  private showImage(src: string, request: number) {
    this.img.classList.add('loading');
    this.img.onload = () => {
      if (request === this.imageRequest && this.img.getAttribute('src') === src) this.img.classList.remove('loading');
    };
    this.img.src = src;
    if (this.img.complete && this.img.naturalWidth) this.img.classList.remove('loading');
  }

  private loadFull(src: string, priority: 'high' | 'low') {
    let image = this.fullImages.get(src);
    if (!image) {
      image = new Image();
      image.decoding = 'async';
      image.fetchPriority = priority;
      this.fullImages.set(src, image);
      image.src = src;
    } else if (!image.complete && priority === 'high') {
      image.fetchPriority = 'high';
    }
    return image;
  }

  private preloadFull(i: number) {
    const index = (i + this.list.length) % this.list.length;
    const p = this.list[index];
    if (p) this.loadFull(p.full, 'low');
  }

  show(i: number, from?: HTMLElement) {
    this.open = true;
    this.setPhoto(i);
    this.root.classList.add('on');
    gsap.fromTo(this.root, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    if (from) {
      const a = from.getBoundingClientRect();
      const b = this.img.getBoundingClientRect();
      const s = a.width / Math.max(1, b.width);
      gsap.fromTo(
        this.fig,
        { x: a.left + a.width / 2 - (b.left + b.width / 2), y: a.top + a.height / 2 - (b.top + b.height / 2), scale: s, rotation: -6 },
        { x: 0, y: 0, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(1.2)' },
      );
    }
  }

  private go(d: number) {
    gsap.to(this.fig, {
      x: -d * 40,
      opacity: 0,
      duration: 0.15,
      onComplete: () => {
        this.setPhoto(this.idx + d);
        gsap.fromTo(this.fig, { x: d * 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.25 });
      },
    });
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    this.imageRequest++;
    gsap.to(this.root, {
      opacity: 0,
      duration: 0.25,
      onComplete: () => {
        this.root.classList.remove('on');
      },
    });
  }
}
