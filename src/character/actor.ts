/**
 * Giao diện chung cho nhân vật — bản 3D (three.js) và bản 2D dự phòng đều theo giao diện này,
 * nên phần kịch bản không cần biết đang dùng bản nào.
 */
import { gsap } from 'gsap';
import type { Anchor } from '../lib/layout';
import { audio } from '../lib/audio';
import { lerp } from '../lib/util';

export type ActionName = 'idle' | 'wave' | 'talk' | 'cheer';
export type JumpPhase = 'crouch' | 'air' | 'land';
/** kiểu phản ứng khi bị chạm (để chọn câu thoại phù hợp); 'dizzy' = bấm dồn 5 lần */
export type Reaction = 'jump' | 'cheer' | 'dizzy';
/** ảnh chụp nhân vật (để ghép vào ảnh thiệp): vị trí chân & chiều cao tính theo px của ảnh */
export interface Snapshot {
  img: CanvasImageSource;
  w: number;
  h: number;
  feetX: number;
  feetY: number;
  charH: number;
}
/** vị trí đầu trên màn hình: tâm + bán kính (đã tính cả mũ nếu đang đội) */
export interface HeadBox {
  x: number;
  y: number;
  r: number;
}

export interface Actor {
  readonly kind: '3d' | '2d';
  readonly anchor: Anchor;
  setVisible(v: boolean): void;
  setAction(a: ActionName): void;
  setSpeaking(on: boolean): void;
  place(a: Anchor): void;
  jumpTo(a: Anchor, o?: { duration?: number; height?: number }): Promise<void>;
  hit(x: number, y: number): boolean;
  /** phản ứng khi bị chạm; null nếu đang bận (đang nhảy) */
  react(): Reaction | null;
  /** @param hMax chiều cao lớn nhất của nhân vật (px) */
  resize(W: number, H: number, hMax?: number): void;
  update(dt: number, t: number): void;
  /** nhìn theo điểm trên màn hình (chỉ bản 3D) */
  lookAt?(x: number, y: number): void;
  lookAway?(): void;
  readonly busy: boolean;
  /** nằm nghỉ (true nếu nằm xong, false nếu bị ngắt) */
  lieDown(): Promise<boolean>;
  /** ngồi dậy từ bất kỳ thời điểm nào của quá trình nằm */
  getUp(): Promise<void>;
  /** đang nằm hoặc đang chuyển tư thế nằm/dậy */
  readonly resting: boolean;
  headBox(): HeadBox;
  /** xoay vòng tại chỗ (easter egg chóng mặt) */
  spin(turns?: number, duration?: number): Promise<void>;
  snapshot(): Promise<Snapshot | null>;
  /** ánh sáng theo buổi (chỉ bản 3D) */
  setMood?(m: 'day' | 'sunset' | 'night'): void;
}

export abstract class BaseActor implements Actor {
  abstract readonly kind: '3d' | '2d';
  readonly anchor: Anchor = { x: 0, y: 0, h: 100, face: 0 };
  protected action: ActionName = 'idle';
  private jumping = false;
  private reactTimer = 0;

  protected abstract applyAnchor(): void;
  protected abstract setPhase(p: JumpPhase): void;
  abstract setVisible(v: boolean): void;
  abstract setSpeaking(on: boolean): void;
  abstract resize(W: number, H: number, hMax?: number): void;
  abstract update(dt: number, t: number): void;
  abstract lieDown(): Promise<boolean>;
  abstract getUp(): Promise<void>;
  abstract get resting(): boolean;
  abstract headBox(): HeadBox;
  abstract snapshot(): Promise<Snapshot | null>;
  /** 0 = đứng, 1 = nằm hẳn */
  protected abstract lieAmount(): number;
  /** góc xoay vòng hiện tại (rad), cộng thêm vào hướng mặt */
  protected spinAngle = 0;
  private spinning = false;

  spin(turns = 2, duration = 1.15): Promise<void> {
    if (this.spinning || this.jumping || this.resting) return Promise.resolve();
    this.spinning = true;
    const o = { a: 0 };
    return new Promise<void>((resolve) => {
      gsap.to(o, {
        a: Math.PI * 2 * turns,
        duration,
        ease: 'power2.inOut',
        onUpdate: () => {
          this.spinAngle = o.a;
          this.applyAnchor();
        },
        onComplete: () => {
          this.spinAngle = 0;
          this.spinning = false;
          this.applyAnchor();
          resolve();
        },
      });
    });
  }
  /** độ cao "bay" hiện tại của nhân vật so với mặt đất (px), để bóng mờ thu nhỏ */
  protected lift = 0;

  get busy() {
    return this.jumping || this.spinning;
  }

  setAction(a: ActionName) {
    this.action = a;
  }

  place(a: Anchor) {
    // đặt vị trí mới thì huỷ cú nhảy đang chạy (vd. bấm "Bỏ qua" giữa lúc nhân vật nhảy ra khỏi thư),
    // nếu không cú nhảy cũ sẽ kéo nhân vật về đích cũ (sau thiệp mời)
    this.cancelJump();
    Object.assign(this.anchor, a);
    this.lift = 0;
    this.applyAnchor();
  }

  private jumpId = 0;
  private jumpAnim: gsap.core.Animation | null = null;
  private jumpWake: (() => void) | null = null;

  private cancelJump() {
    if (!this.jumping) return;
    this.jumpId++;
    this.jumpAnim?.kill();
    this.jumpAnim = null;
    this.jumping = false;
    this.lift = 0;
    this.setPhase('land');
    const wake = this.jumpWake;
    this.jumpWake = null;
    wake?.();
  }

  /** chạy 1 bước của cú nhảy; trả về false nếu cú nhảy đã bị huỷ */
  private jumpStep(id: number, make: (done: () => void) => gsap.core.Animation) {
    return new Promise<boolean>((resolve) => {
      this.jumpWake = () => resolve(false);
      this.jumpAnim = make(() => {
        this.jumpWake = null;
        resolve(id === this.jumpId);
      });
    });
  }

  async jumpTo(to: Anchor, o: { duration?: number; height?: number } = {}) {
    this.cancelJump();
    const id = ++this.jumpId;
    const duration = o.duration ?? 0.85;
    const height = o.height ?? to.h * 0.6;
    this.jumping = true;
    this.setPhase('crouch');
    if (!(await this.jumpStep(id, (done) => gsap.delayedCall(0.16, done)))) return;
    this.setPhase('air');
    audio.play('boing', { volume: 0.55 });
    const from = { ...this.anchor };
    const p = { t: 0 };
    const finished = await this.jumpStep(id, (done) =>
      gsap.to(p, {
        t: 1,
        duration,
        ease: 'none',
        onUpdate: () => {
          const t = p.t;
          const arc = height * 4 * t * (1 - t);
          const e = gsap.parseEase('sine.inOut')(t);
          this.anchor.x = lerp(from.x, to.x, e);
          this.anchor.y = lerp(from.y, to.y, t) - arc;
          this.anchor.h = lerp(from.h, to.h, gsap.parseEase('power2.out')(t));
          this.anchor.face = lerp(from.face, to.face, t);
          this.lift = arc;
          this.applyAnchor();
        },
        onComplete: done,
      }),
    );
    if (!finished) return;
    this.jumping = false;
    this.jumpAnim = null;
    this.place(to);
    this.setPhase('land');
    audio.play('land', { volume: 0.5 });
  }

  /** vùng bấm: đứng thì cao-hẹp, nằm thì thấp-rộng (nội suy theo mức nằm) */
  hit(x: number, y: number) {
    const { x: ax, y: ay, h } = this.anchor;
    const l = this.lieAmount();
    const half = h * (0.32 + 0.26 * l);
    const top = ay - h * (1 - 0.5 * l);
    return x > ax - half && x < ax + half && y > top && y < ay + 6;
  }

  /** Khi bị chạm: ngẫu nhiên nhảy tại chỗ hoặc tung hô (tung mũ) */
  react(): Reaction | null {
    if (this.jumping || this.resting) return null;
    if (Math.random() < 0.5) {
      void this.jumpTo({ ...this.anchor }, { duration: 0.55, height: this.anchor.h * 0.35 });
      return 'jump';
    }
    const prev: ActionName = this.action === 'cheer' || this.action === 'wave' ? 'idle' : this.action;
    this.setAction('cheer');
    audio.play('cheer', { volume: 0.6 });
    clearTimeout(this.reactTimer);
    this.reactTimer = window.setTimeout(() => this.setAction(prev), 1800);
    return 'cheer';
  }
}
