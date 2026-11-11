/**
 * Âm thanh bằng Web Audio (tự viết, không dùng thư viện — thư viện Howler tốn ~1s dò codec lúc tải trang
 * trên Windows, làm trang hiện chậm).
 * - Nhạc nền + không khí khu vườn lặp liền mạch theo vùng [start, start+duration] (scripts/gen-audio.mjs).
 * - Hiệu ứng: mỗi lần phát tạo 1 BufferSource (độ trễ thấp), có chỉnh âm lượng / tốc độ / trái-phải.
 * - Chỉ bắt đầu sau lần chạm mở thư (iOS / Messenger / Zalo chặn âm thanh tự phát).
 * - iPhone gạt im lặng: audioSession = 'playback' (iOS 17+) + phát 1 file im lặng bằng HTML5 (iOS cũ).
 * - Ẩn tab / chuyển app → tạm dừng AudioContext cho đỡ tốn pin.
 */
import { config } from '../config';
import loops from '../generated/audio-loops.json';

export type Sfx =
  | 'open'
  | 'whoosh'
  | 'chime'
  | 'sparkle'
  | 'pop'
  | 'boing'
  | 'land'
  | 'cheer'
  | 'tap'
  | 'blip'
  | 'rustle'
  | 'bird-1'
  | 'bird-2'
  | 'bird-3'
  | 'bird-4'
  | 'cricket';

const SFX: Sfx[] = ['open', 'whoosh', 'chime', 'sparkle', 'pop', 'boing', 'land', 'cheer', 'tap', 'blip', 'rustle', 'bird-1', 'bird-2', 'bird-3', 'bird-4', 'cricket'];
const BIRDS: Sfx[] = ['bird-1', 'bird-2', 'bird-3', 'bird-4'];
const MUTE_KEY = 'grad-muted';

class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private started = false;
  private userMuted = false;
  private birdTimer = 0;
  private rustleTimer = 0;
  private base = '/';
  private listeners = new Set<(muted: boolean) => void>();
  /** ban đêm: chim đi ngủ, dế kêu */
  night = false;

  init() {
    this.base = import.meta.env.BASE_URL;
    try {
      this.userMuted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* chế độ riêng tư */
    }
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) {
      try {
        nav.audioSession.type = 'playback';
      } catch {
        /* bỏ qua */
      }
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.userMuted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    // tải trước (giải mã chạy ngoài luồng chính)
    void this.load('audio/bgm.mp3');
    void this.load('audio/ambience.mp3');
    for (const n of SFX) void this.load(`audio/sfx/${n}.mp3`);

    document.addEventListener('visibilitychange', () => this.syncRunning());
    window.addEventListener('pagehide', () => void this.ctx?.suspend().catch(() => {}));
    window.addEventListener('pageshow', () => this.syncRunning());
  }

  private load(path: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(path);
    if (cached) return cached;
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    const p = fetch(this.base + path)
      .then((r) => r.arrayBuffer())
      // dạng callback chạy được cả trên Safari cũ
      .then((ab) => new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .catch(() => null);
    this.buffers.set(path, p);
    return p;
  }

  /** Gọi đồng bộ trong sự kiện chạm (bắt buộc với iOS) */
  start() {
    if (this.started || !this.ctx) return;
    this.started = true;
    void this.ctx.resume().catch(() => {});
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      const s = new Audio(`${this.base}audio/silence.mp3`);
      s.loop = true;
      void s.play().catch(() => {});
    }
    void this.loop('audio/bgm.mp3', loops.bgm, config.audio.bgmVolume, 2.2);
    void this.loop('audio/ambience.mp3', loops.ambience, config.audio.ambienceVolume, 3.5);
    this.scheduleBirds(2500);
    this.scheduleRustle(9000);
  }

  private async loop(path: string, region: { start: number; duration: number }, volume: number, fadeSec: number) {
    const buf = await this.load(path);
    const ctx = this.ctx;
    if (!buf || !ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = region.start / 1000;
    src.loopEnd = (region.start + region.duration) / 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(volume, ctx.currentTime + fadeSec);
    src.connect(g).connect(this.master);
    src.start(0, src.loopStart);
  }

  play(name: Sfx, o: { volume?: number; rate?: number; pan?: number } = {}) {
    const ctx = this.ctx;
    if (!this.started || !ctx || document.hidden) return;
    void this.load(`audio/sfx/${name}.mp3`).then((buf) => {
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (o.rate) src.playbackRate.value = o.rate;
      const g = ctx.createGain();
      g.gain.value = (o.volume ?? 1) * config.audio.sfxVolume;
      let node: AudioNode = src.connect(g);
      if (o.pan != null && typeof ctx.createStereoPanner === 'function') {
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, o.pan));
        node = node.connect(p);
      }
      node.connect(this.master);
      src.start();
    });
  }

  bird() {
    if (this.night) {
      this.play('cricket', { volume: 0.22 + Math.random() * 0.18, rate: 0.94 + Math.random() * 0.14, pan: Math.random() * 1.6 - 0.8 });
      return;
    }
    const n = BIRDS[Math.floor(Math.random() * BIRDS.length)];
    this.play(n, { volume: 0.25 + Math.random() * 0.25, rate: 0.9 + Math.random() * 0.25, pan: Math.random() * 1.6 - 0.8 });
  }

  rustle(volume = 0.5) {
    this.play('rustle', { volume, rate: 0.85 + Math.random() * 0.3, pan: Math.random() * 1.2 - 0.6 });
  }

  private scheduleBirds(delay: number) {
    clearTimeout(this.birdTimer);
    this.birdTimer = window.setTimeout(() => {
      this.bird();
      this.scheduleBirds(4500 + Math.random() * 7000);
    }, delay);
  }

  private scheduleRustle(delay: number) {
    clearTimeout(this.rustleTimer);
    this.rustleTimer = window.setTimeout(() => {
      this.rustle(0.25 + Math.random() * 0.2);
      this.scheduleRustle(10000 + Math.random() * 12000);
    }, delay);
  }

  get muted() {
    return this.userMuted;
  }

  toggle() {
    this.userMuted = !this.userMuted;
    try {
      localStorage.setItem(MUTE_KEY, this.userMuted ? '1' : '0');
    } catch {
      /* bỏ qua */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.userMuted ? 0 : 1, this.ctx.currentTime, 0.08);
    this.listeners.forEach((f) => f(this.userMuted));
  }

  onChange(f: (muted: boolean) => void) {
    this.listeners.add(f);
  }

  private syncRunning() {
    if (!this.ctx || !this.started) return;
    if (document.hidden) void this.ctx.suspend().catch(() => {});
    else void this.ctx.resume().catch(() => {});
  }
}

export const audio = new AudioManager();
