/**
 * Sân khấu 3D cho nhân vật chibi.
 * - Camera đặt sao cho 1 đơn vị thế giới = 1 px trên mặt phẳng z=0 → đặt nhân vật theo toạ độ màn hình.
 * - Canvas KHÔNG phủ cả màn hình: chỉ là một khung nhỏ bám theo nhân vật, dùng camera.setViewOffset
 *   để vẽ đúng phần khung đó của "màn hình ảo" → GPU vẽ ít điểm ảnh hơn nhiều lần.
 * - Shader được biên dịch + đẩy dữ liệu lên GPU từ trước, nên lúc nhân vật xuất hiện không bị khựng.
 * Module này được tải động (code-split) để phong thư hiện ra trước, three.js tải sau.
 */
import * as THREE from 'three';
import { BaseActor, type ActionName, type HeadBox, type JumpPhase, type Snapshot } from './actor';
import type { Mood } from '../lib/sky';
import { buildChibi, MODEL_H, type Rig } from './chibi';

const FOV = 20;
/** khung canvas so với chiều cao nhân vật lớn nhất (đủ chỗ tay giơ, mũ tung, bóng dưới chân) */
const BOX_W = 1.6;
const BOX_ABOVE = 1.75;
const BOX_BELOW = 0.2;

export interface Stage3DOptions {
  dpr: number;
  antialias: boolean;
  onContextLost?: () => void;
}

export class Stage3D extends BaseActor {
  readonly kind = '3d' as const;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);
  private root = new THREE.Group();
  private shadow: THREE.Mesh;
  private key = new THREE.DirectionalLight(0xfff6e8, 2.1);
  private fill = new THREE.DirectionalLight(0xe8f0ff, 0.7);
  private hemi = new THREE.HemisphereLight(0xffffff, 0xb6e3a6, 1.5);
  private rig!: Rig;
  private shown = false;
  private W = 1;
  private H = 1;
  private hMax = 100;
  private boxW = 1;
  private boxH = 1;
  private boxX = 0;
  private boxY = 0;
  private tmpV = new THREE.Vector3();
  private needsClear = false;

  constructor(
    private canvas: HTMLCanvasElement,
    o: Stage3DOptions,
  ) {
    super();
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: o.antialias, powerPreference: 'default', premultipliedAlpha: true });
    this.renderer.setPixelRatio(o.dpr);
    this.renderer.setClearColor(0x000000, 0);
    this.scene.add(this.hemi);
    this.scene.add(this.key, this.key.target, this.fill, this.fill.target);

    // bóng mờ dưới chân
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, 'rgba(30,60,30,0.55)');
    grd.addColorStop(1, 'rgba(30,60,30,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
    );
    this.shadow.renderOrder = -1;
    this.scene.add(this.shadow, this.root);
    this.root.visible = false;
    this.shadow.visible = false;

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      o.onContextLost?.();
    });
  }

  async init() {
    this.rig = buildChibi();
    this.root.add(this.rig.object);
    // "làm nóng": biên dịch shader (song song nếu trình duyệt hỗ trợ) và đẩy hình khối lên GPU
    const warm = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    warm.position.set(0, 1.3, 7);
    warm.lookAt(0, 1.3, 0);
    this.root.visible = true;
    this.shadow.visible = true;
    try {
      await this.renderer.compileAsync(this.scene, warm);
    } catch {
      this.renderer.compile(this.scene, warm);
    }
    this.renderer.render(this.scene, warm);
    this.renderer.clear();
    this.root.visible = false;
    this.shadow.visible = false;
  }

  /** @param hMax chiều cao lớn nhất nhân vật có thể có (px) — quyết định kích thước khung canvas */
  resize(W: number, H: number, hMax = this.hMax) {
    this.W = W;
    this.H = H;
    this.hMax = hMax;
    this.boxW = Math.ceil(hMax * BOX_W);
    this.boxH = Math.ceil(hMax * (BOX_ABOVE + BOX_BELOW));
    this.renderer.setSize(this.boxW, this.boxH, false);
    this.canvas.style.width = `${this.boxW}px`;
    this.canvas.style.height = `${this.boxH}px`;
    const d = H / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.camera.aspect = W / H;
    this.camera.near = d * 0.2;
    this.camera.far = d * 3;
    this.camera.position.set(W / 2, -H / 2, d);
    this.camera.lookAt(W / 2, -H / 2, 0);
    this.key.position.set(W / 2 + d * 0.6, -H / 2 + d * 0.7, d);
    this.key.target.position.set(W / 2, -H / 2, 0);
    this.fill.position.set(W / 2 - d, -H / 2 + d * 0.2, d * 0.5);
    this.fill.target.position.set(W / 2, -H / 2, 0);
    this.applyAnchor();
  }

  /** ánh sáng theo buổi: ngày (trắng), chiều tà (nắng cam), đêm (trời xanh + ánh đèn ấm) */
  setMood(m: Mood) {
    const L = {
      day: { sky: 0xffffff, ground: 0xb6e3a6, hemi: 1.5, key: 0xfff6e8, keyI: 2.1, fill: 0xe8f0ff, fillI: 0.7 },
      sunset: { sky: 0xffd6c0, ground: 0xc9b98f, hemi: 1.3, key: 0xffb27a, keyI: 2.3, fill: 0xd8c8ff, fillI: 0.6 },
      night: { sky: 0x9fb0ff, ground: 0x4c5a8a, hemi: 1.05, key: 0xffd59a, keyI: 1.9, fill: 0x8fa2ff, fillI: 0.55 },
    }[m];
    this.hemi.color.setHex(L.sky);
    this.hemi.groundColor.setHex(L.ground);
    this.hemi.intensity = L.hemi;
    this.key.color.setHex(L.key);
    this.key.intensity = L.keyI;
    this.fill.color.setHex(L.fill);
    this.fill.intensity = L.fillI;
    this.rig?.setSkinTone(m === 'night');
  }

  /** vẽ 1 khung rồi chép ngay ra canvas 2D (đọc WebGL ngay sau khi vẽ, trong cùng 1 tác vụ) */
  async snapshot(): Promise<Snapshot | null> {
    if (!this.rig) return null;
    const wasShown = this.shown;
    const oldDpr = this.renderer.getPixelRatio();
    const dpr = Math.min(4, Math.max(oldDpr, 420 / Math.max(1, this.anchor.h)));
    this.root.visible = true;
    this.shadow.visible = false;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.boxW, this.boxH, false);
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const copy = document.createElement('canvas');
    copy.width = src.width;
    copy.height = src.height;
    copy.getContext('2d')!.drawImage(src, 0, 0);
    this.renderer.setPixelRatio(oldDpr);
    this.renderer.setSize(this.boxW, this.boxH, false);
    this.root.visible = wasShown;
    this.shadow.visible = wasShown;
    if (wasShown) this.renderer.render(this.scene, this.camera);
    const k = copy.width / this.boxW;
    return { img: copy, w: copy.width, h: copy.height, feetX: (this.anchor.x - this.boxX) * k, feetY: (this.anchor.y - this.boxY) * k, charH: this.anchor.h * k };
  }

  setPixelRatio(dpr: number) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.boxW, this.boxH, false);
  }

  setVisible(v: boolean) {
    this.shown = v;
    this.root.visible = v;
    this.shadow.visible = v;
    if (!v) this.needsClear = true;
  }

  setAction(a: ActionName) {
    super.setAction(a);
    this.rig?.setAction(a);
  }

  setSpeaking(on: boolean) {
    this.rig?.setSpeaking(on);
  }

  /** nhìn về phía điểm (px) trên màn hình */
  lookAt(px: number, py: number) {
    const { x, y, h } = this.anchor;
    this.rig?.setLook((px - x) / (h * 2.2), (py - (y - h * 0.72)) / (h * 2.2));
  }

  lookAway() {
    this.rig?.setLook(0, 0);
  }

  protected setPhase(p: JumpPhase) {
    this.rig?.setPhase(p);
  }

  lieDown() {
    return this.rig ? this.rig.lieDown() : Promise.resolve(false);
  }

  getUp() {
    return this.rig ? this.rig.getUp() : Promise.resolve();
  }

  get resting() {
    return !!this.rig && this.rig.isResting();
  }

  protected lieAmount() {
    return this.rig ? this.rig.lieAmount() : 0;
  }

  /** chiếu tâm đầu 3D ra toạ độ màn hình */
  headBox(): HeadBox {
    const { h } = this.anchor;
    if (!this.rig) return { x: this.anchor.x, y: this.anchor.y - h * 0.72, r: h * 0.33 };
    this.root.updateMatrixWorld(true);
    const v = this.rig.headCenter.getWorldPosition(this.tmpV).project(this.camera);
    return {
      x: this.boxX + ((v.x + 1) / 2) * this.boxW,
      y: this.boxY + ((1 - v.y) / 2) * this.boxH,
      r: h * (0.24 + 0.1 * (1 - this.lieAmount())),
    };
  }

  protected applyAnchor() {
    const { x, y, h, face } = this.anchor;
    const s = h / MODEL_H;
    this.root.position.set(x, -y, 0);
    this.root.scale.setScalar(s);
    this.root.rotation.y = face;
    this.placeShadow();

    // khung canvas bám theo nhân vật (chỉ đổi vị trí, không đổi kích thước)
    const bx = Math.round(x - this.boxW / 2);
    const by = Math.round(y - this.hMax * BOX_ABOVE);
    this.boxX = bx;
    this.boxY = by;
    this.canvas.style.transform = `translate3d(${bx}px, ${by}px, 0)`;
    this.camera.setViewOffset(this.W, this.H, bx, by, this.boxW, this.boxH);
  }

  /** bóng dưới chân: nhỏ lại khi bay lên, dài ra khi nằm */
  private placeShadow() {
    const { x, y, h } = this.anchor;
    const ground = y + this.lift;
    const k = Math.min(0.7, this.lift / (h * 1.4));
    const l = this.lieAmount();
    this.shadow.position.set(x, -ground - h * 0.005, -h * 0.25);
    this.shadow.scale.set(h * (0.62 + 0.55 * l) * (1 - k), h * (0.13 + 0.03 * l) * (1 - k), 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 1 - k;
  }

  update(dt: number, t: number) {
    if (!this.rig) return;
    if (!this.shown) {
      if (this.needsClear) {
        this.renderer.clear();
        this.needsClear = false;
      }
      return;
    }
    this.rig.update(dt, t);
    // khi nằm, mặt quay thẳng ra màn hình
    const l = this.rig.lieAmount();
    this.root.rotation.y = this.anchor.face * (1 - l) + this.spinAngle;
    if (l > 0) this.placeShadow();
    this.renderer.render(this.scene, this.camera);
  }
}
