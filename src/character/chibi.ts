/**
 * Nhân vật chibi dựng bằng code (three.js): mặc áo cử nhân, đội mũ có tua, cầm bằng.
 * Các động tác vẫy tay / nói / tung hô / nhảy (co giãn) / nhìn theo con trỏ đều điều khiển
 * bằng code, không cần file 3D.
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import type { ActionName, JumpPhase } from './actor';
import { audio } from '../lib/audio';

/** Chiều cao chuẩn của nhân vật (đơn vị mô hình) — mọi rig đều được chuẩn hoá về số này */
export const MODEL_H = 2.62;

export interface Rig {
  object: THREE.Object3D;
  setAction(a: ActionName): void;
  setSpeaking(on: boolean): void;
  setPhase(p: JumpPhase): void;
  /** hướng nhìn, -1..1 theo mỗi trục (0,0 = nhìn thẳng) */
  setLook(x: number, y: number): void;
  setSkinTone(night: boolean): void;
  update(dt: number, t: number): void;
  /** vươn vai → cầm mũ → nằm nghiêng. true nếu nằm xong, false nếu bị ngắt giữa chừng */
  lieDown(): Promise<boolean>;
  /** ngồi dậy từ bất kỳ tư thế nào của quá trình nằm (đội lại mũ) */
  getUp(): Promise<void>;
  /** 0 = đứng, 1 = nằm hẳn */
  lieAmount(): number;
  /** đang nằm / đang trong quá trình nằm xuống hoặc ngồi dậy */
  isResting(): boolean;
  /** điểm tâm đầu (để đặt bong bóng câu nói) */
  headCenter: THREE.Object3D;
}

const C = {
  skin: 0xffdcc4,
  hair: 0x3b2a22,
  gown: 0x2d3f7c,
  stole: 0xffc93c,
  cap: 0x262a3d,
  gold: 0xffc93c,
  shoe: 0x3a3442,
  pants: 0x30303f,
  eye: 0x2a2233,
  blush: 0xff9fb0,
  mouth: 0xb8405a,
  mouthIn: 0x7a2335,
  diploma: 0xfff4dc,
  ribbon: 0xe8505b,
  shirt: 0xffffff,
  trim: 0x4a63b0,
  outline: 0x2a2440,
};

let gradTex: THREE.DataTexture | null = null;
function gradientMap() {
  if (gradTex) return gradTex;
  gradTex = new THREE.DataTexture(new Uint8Array([155, 215, 255]), 3, 1, THREE.RedFormat);
  gradTex.minFilter = THREE.NearestFilter;
  gradTex.magFilter = THREE.NearestFilter;
  gradTex.generateMipmaps = false;
  gradTex.needsUpdate = true;
  return gradTex;
}

const matCache = new Map<number, THREE.MeshToonMaterial>();
function toon(color: number) {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
    // viền sáng mềm ở rìa khối → nhân vật "nổi" hơn trên nền vườn
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <opaque_fragment>',
        'float rimK = 1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0);\n' +
          'outgoingLight += vec3(1.0, 0.96, 0.88) * pow(rimK, 3.0) * 0.28;\n' +
          '#include <opaque_fragment>',
      );
    };
    matCache.set(color, m);
  }
  return m;
}

let outlineMat: THREE.MeshBasicMaterial | null = null;
function outline() {
  if (outlineMat) return outlineMat;
  outlineMat = new THREE.MeshBasicMaterial({ color: C.outline, side: THREE.BackSide });
  outlineMat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.022;');
  };
  return outlineMat;
}

function part(geo: THREE.BufferGeometry, color: number, withOutline = false) {
  const m = new THREE.Mesh(geo, toon(color));
  if (withOutline) m.add(new THREE.Mesh(geo, outline()));
  return m;
}

const Z = new THREE.Vector3(0, 0, 1);
/** đặt chi tiết lên bề mặt hình cầu đầu, quay theo pháp tuyến */
function onSphere(obj: THREE.Object3D, center: THREE.Vector3, r: number, dir: THREE.Vector3) {
  const n = dir.clone().normalize();
  obj.position.copy(center).addScaledVector(n, r);
  obj.quaternion.setFromUnitVectors(Z, n);
}

type PoseKey = 'bodyY' | 'sx' | 'sy' | 'bodyRz' | 'hx' | 'hy' | 'hz' | 'rSx' | 'rSz' | 'rEx' | 'rEz' | 'lSx' | 'lSz' | 'lEx' | 'lEz';
type Pose = Record<PoseKey, number>;
const SQUASH: PoseKey[] = ['bodyY', 'sx', 'sy'];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
function blend(T: Pose, to: Partial<Pose>, w: number) {
  if (w <= 0) return;
  for (const k of Object.keys(to) as PoseKey[]) T[k] += (to[k]! - T[k]) * w;
}

/** Góc nằm nghiêng (rad) — gần 90°, đầu hơi ngẩng cho dễ thương */
const LIE_ANGLE = 1.5;
/** Các điểm "chạm đất" của thân (toạ độ trong thân: x, y, bán kính) để khi nghiêng không lún xuống đất */
const CONTACTS: Array<[number, number, number]> = [
  [0, 1.88, 0.6], // đầu
  [-0.56, 0.24, 0.04], // gấu áo trái/phải
  [0.56, 0.24, 0.04],
  [-0.2, 0.06, 0.08], // giày
  [0.2, 0.06, 0.08],
  [-0.36, 1.12, 0.15], // vai
  [0.36, 1.12, 0.15],
];
function liftAndCenter(theta: number) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  let minY = Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const [x, y, r] of CONTACTS) {
    const ry = x * s + y * c - r;
    const rx = x * c - y * s;
    if (ry < minY) minY = ry;
    if (rx - r < minX) minX = rx - r;
    if (rx + r > maxX) maxX = rx + r;
  }
  return { lift: Math.max(0, -minY), center: (minX + maxX) / 2 };
}

/** Tư thế vươn vai ngáp */
const YAWN: Partial<Pose> = { rSz: -2.95, rSx: -0.1, rEx: 0, rEz: -0.25, lSz: 2.95, lSx: -0.1, lEx: 0, lEz: 0.25, hx: -0.24, hy: 0, hz: 0.04, sy: 1.06, sx: 0.97, bodyY: 0.02 };
/** Tay trái với lên đầu lấy / đội mũ */
const REACH: Partial<Pose> = { lSz: 2.55, lSx: -0.35, lEx: -0.25, lEz: -0.55, hx: 0.08 };

export function buildChibi(): Rig {
  const root = new THREE.Group();
  const skinMaterial = toon(C.skin);
  // root > lieGroup (nằm nghiêng) > body (co giãn, nghiêng nhẹ)
  const lieGroup = new THREE.Group();
  const body = new THREE.Group();
  root.add(lieGroup);
  lieGroup.add(body);

  // ---- chân + giày (xoay quanh hông để đung đưa khi nằm) ----
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.15, 0.36, 0);
    const leg = part(new THREE.CylinderGeometry(0.085, 0.08, 0.3, 12), C.pants);
    leg.position.set(0, -0.12, 0);
    const shoe = part(new THREE.SphereGeometry(0.12, 16, 12), C.shoe, true);
    shoe.scale.set(1, 0.62, 1.45);
    shoe.position.set(0, -0.29, 0.05);
    hip.add(leg, shoe);
    body.add(hip);
    legs.push(hip);
  }

  // ---- áo choàng ----
  const prof = [
    [0.001, 0.2],
    [0.5, 0.2],
    [0.56, 0.24],
    [0.54, 0.34],
    [0.47, 0.62],
    [0.42, 0.9],
    [0.4, 1.08],
    [0.34, 1.2],
    [0.2, 1.28],
    [0.001, 1.3],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const gown = part(new THREE.LatheGeometry(prof, 48), C.gown, true);
  body.add(gown);
  // viền gấu áo
  const hem = part(new THREE.TorusGeometry(0.535, 0.03, 10, 48), C.trim);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.26;
  body.add(hem);
  // cổ áo sơ mi trắng chữ V
  const collar = part(new THREE.ConeGeometry(0.17, 0.2, 24, 1, true), C.shirt);
  collar.rotation.x = Math.PI;
  collar.position.set(0, 1.2, 0.17);
  collar.scale.set(1, 1, 0.6);
  body.add(collar);
  // khăn vàng hình chữ V
  for (const s of [-1, 1]) {
    const st = part(new THREE.BoxGeometry(0.13, 0.8, 0.03), C.stole);
    st.position.set(s * 0.13, 0.84, 0.405);
    st.rotation.set(-0.27, 0, s * 0.13);
    body.add(st);
  }
  const neck = part(new THREE.CylinderGeometry(0.1, 0.11, 0.14, 12), C.skin);
  neck.position.y = 1.3;
  body.add(neck);

  // ---- đầu ----
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.32, 0);
  body.add(headPivot);
  const hc = new THREE.Vector3(0, 0.56, 0);
  const head = part(new THREE.SphereGeometry(0.6, 48, 36), C.skin, true);
  head.position.copy(hc);
  headPivot.add(head);
  const headCenter = new THREE.Object3D();
  headCenter.position.copy(hc);
  headPivot.add(headCenter);

  const hair = part(new THREE.SphereGeometry(0.635, 48, 28, 0, Math.PI * 2, 0, Math.PI * 0.56), C.hair, true);
  hair.position.copy(hc);
  hair.rotation.x = -0.42;
  headPivot.add(hair);
  // mái tóc
  const bangs: Array<[number, number, number]> = [
    [-0.74, 1.34, 0.15],
    [-0.37, 1.36, 0.17],
    [0, 1.38, 0.16],
    [0.37, 1.36, 0.17],
    [0.74, 1.34, 0.15],
  ];
  for (const [phi, polar, r] of bangs) {
    const b = part(new THREE.SphereGeometry(r, 16, 12), C.hair);
    const dir = new THREE.Vector3(Math.sin(polar) * Math.sin(phi), Math.cos(polar), Math.sin(polar) * Math.cos(phi));
    onSphere(b, hc, 0.58, dir);
    b.scale.set(1, 0.8, 0.45);
    headPivot.add(b);
  }
  for (const s of [-1, 1]) {
    const side = part(new THREE.SphereGeometry(0.16, 16, 12), C.hair);
    onSphere(side, hc, 0.55, new THREE.Vector3(s * 0.95, -0.05, 0.25));
    side.scale.set(0.55, 1.1, 0.5);
    const ear = part(new THREE.SphereGeometry(0.1, 12, 10), C.skin);
    ear.position.set(s * 0.59, 0.42, 0.02);
    headPivot.add(side, ear);
  }

  // mắt
  const EYE_H = 0.112;
  const eyes: THREE.Mesh[] = [];
  const eyeHls: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: C.eye }));
    onSphere(eye, hc, 0.585, new THREE.Vector3(s * 0.2, -0.1, 0.56));
    eye.scale.set(0.082, EYE_H, 0.04);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.copy(eye.position).add(new THREE.Vector3(0.026, 0.04, 0.035));
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl2.position.copy(eye.position).add(new THREE.Vector3(-0.022, -0.04, 0.035));
    eyeHls.push(hl, hl2);
    const blush = new THREE.Mesh(
      new THREE.CircleGeometry(0.075, 20),
      new THREE.MeshBasicMaterial({ color: C.blush, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    onSphere(blush, hc, 0.603, new THREE.Vector3(s * 0.33, -0.25, 0.45));
    eyes.push(eye);
    headPivot.add(eye, hl, hl2, blush);
  }
  // miệng: cười + mở khi nói
  const mouth = new THREE.Group();
  onSphere(mouth, hc, 0.6, new THREE.Vector3(0, -0.29, 0.53));
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.017, 10, 24, Math.PI), new THREE.MeshBasicMaterial({ color: C.mouth }));
  smile.rotation.z = Math.PI;
  smile.position.y = 0.02;
  const open = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: C.mouthIn }));
  open.scale.set(0.07, 0.05, 0.02);
  mouth.add(smile, open);
  headPivot.add(mouth);

  // ---- mũ cử nhân ----
  // mũ là con của thân; vị trí tính mỗi khung hình: trên đầu ↔ theo tay trái ↔ trên bụng
  const capRest = new THREE.Vector3(0, 1.08, -0.03);
  const capRestEuler = new THREE.Euler(-0.18, 0, 0.06);
  const cap = new THREE.Group();
  body.add(cap);
  // tư thế mũ khi ôm trên bụng (toạ độ trong thân)
  const capBelly = new THREE.Matrix4().compose(
    new THREE.Vector3(0.1, 0.62, 0.6),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.95, 0.2, 0.45)),
    new THREE.Vector3(0.58, 0.58, 0.58),
  );
  const skull = part(new THREE.CylinderGeometry(0.5, 0.53, 0.2, 28), C.cap, true);
  const board = part(new THREE.BoxGeometry(1.3, 0.05, 1.3), C.cap, true);
  board.position.y = 0.12;
  board.rotation.y = Math.PI / 4;
  const button = part(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), C.gold);
  button.position.y = 0.16;
  const cord = part(new THREE.BoxGeometry(0.025, 0.02, 0.65), C.gold);
  cord.position.set(0.23, 0.155, 0.23);
  cord.rotation.y = Math.PI / 4;
  const tassel = new THREE.Group();
  tassel.position.set(0.46, 0.14, 0.46);
  const tCord = part(new THREE.CylinderGeometry(0.014, 0.014, 0.32, 6).translate(0, -0.16, 0), C.gold);
  const tEnd = part(new THREE.ConeGeometry(0.065, 0.2, 10), C.gold);
  tEnd.position.y = -0.38;
  tassel.add(tCord, tEnd);
  cap.add(skull, board, button, cord, tassel);

  // ---- tay ----
  const makeArm = (s: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.36, 1.12, 0);
    const joint = part(new THREE.SphereGeometry(0.12, 14, 10), C.gown);
    const upper = part(new THREE.CylinderGeometry(0.1, 0.14, 0.42, 20).translate(0, -0.21, 0), C.gown, true);
    const elbow = new THREE.Group();
    elbow.position.y = -0.4;
    const fore = part(new THREE.CylinderGeometry(0.13, 0.17, 0.24, 20).translate(0, -0.12, 0), C.gown, true);
    const cuff = part(new THREE.TorusGeometry(0.165, 0.022, 8, 24), C.stole);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.23;
    const hand = part(new THREE.SphereGeometry(0.1, 20, 14), C.skin, true);
    hand.position.y = -0.31;
    elbow.add(fore, cuff, hand);
    shoulder.add(joint, upper, elbow);
    body.add(shoulder);
    return { shoulder, elbow, hand };
  };
  const armR = makeArm(-1);
  const armL = makeArm(1);
  // bằng tốt nghiệp ở tay trái
  const diploma = new THREE.Group();
  const scroll = part(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 14), C.diploma, true);
  scroll.rotation.z = Math.PI / 2;
  const ribbon = part(new THREE.TorusGeometry(0.062, 0.016, 8, 16), C.ribbon);
  ribbon.rotation.y = Math.PI / 2;
  diploma.add(scroll, ribbon);
  diploma.position.set(0, -0.02, 0.07);
  armL.hand.add(diploma);

  // ---- điều khiển tư thế ----
  const P: Pose = { bodyY: 0, sx: 1, sy: 1, bodyRz: 0, hx: 0, hy: 0, hz: 0, rSx: 0, rSz: -0.2, rEx: 0, rEz: 0.15, lSx: -0.15, lSz: 0.2, lEx: -1.25, lEz: -0.25 };
  const T: Pose = { ...P };
  let action: ActionName = 'idle';
  let phase: JumpPhase | null = null;
  let phaseT = 0;
  let speaking = false;
  let mouthOpen = 0;
  let blinkIn = 2;
  let blinkT = -1;
  let tasselA = 0;
  let tasselV = 0;
  let capT = -1;
  let lastCapToss = -10;
  let clock = 0;
  const look = { x: 0, y: 0 };
  const lookNow = { x: 0, y: 0 };
  // trạng thái nghỉ: yawn = vươn vai, p = mức nằm, cap = mức chuyển mũ đầu → bụng (đều 0..1, tween bằng GSAP)
  const R = { yawn: 0, p: 0, cap: 0 };
  let restTl: gsap.core.Timeline | null = null;
  let pendingLie: ((ok: boolean) => void) | null = null;
  let thudPlayed = false;
  /** nhún nhẹ khi vừa đứng dậy (giây kể từ lúc đứng; -1 = không) — dạng đường cong, không giật */
  let settleT = -1;
  // biến tạm cho phép tính ma trận
  const mA = new THREE.Matrix4();
  const mB = new THREE.Matrix4();
  const mTmp = new THREE.Matrix4();
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pH = new THREE.Vector3();
  const qA = new THREE.Quaternion();
  const qB = new THREE.Quaternion();
  const sA = new THREE.Vector3();
  const sB = new THREE.Vector3();
  const capEuler = new THREE.Euler();
  const capOff = new THREE.Vector3();

  const stopRest = () => {
    restTl?.kill();
    restTl = null;
    const r = pendingLie;
    pendingLie = null;
    r?.(false);
  };

  const targets = (t: number) => {
    const breath = Math.sin(t * 2.4);
    Object.assign(T, {
      bodyY: 0.012 * breath,
      sx: 1 - 0.006 * breath,
      sy: 1 + 0.012 * breath,
      // dồn trọng tâm nhẹ + nhìn theo con trỏ
      bodyRz: 0.018 * Math.sin(t * 0.8),
      hx: 0.03 * Math.sin(t * 1.3) + lookNow.y * 0.28,
      hy: 0.08 * Math.sin(t * 0.5) * (1 - Math.abs(lookNow.x)) + lookNow.x * 0.5,
      hz: 0.05 * Math.sin(t * 0.9) - lookNow.x * 0.06,
      rSx: 0.05,
      rSz: -0.2 - 0.03 * breath,
      rEx: 0,
      rEz: 0.15,
      lSx: -0.15,
      lSz: 0.2 + 0.03 * breath,
      lEx: -1.25,
      lEz: -0.25,
    });
    if (action === 'wave') {
      Object.assign(T, {
        rSz: -2.55,
        rSx: -0.15,
        rEz: 0.45 + 0.42 * Math.sin(t * 9),
        bodyRz: 0.04 * Math.sin(t * 4.5),
        hz: 0.1 + 0.04 * Math.sin(t * 4.5),
        hx: -0.05,
      });
    } else if (action === 'talk') {
      Object.assign(T, {
        rSz: -0.5,
        rSx: -0.65 + 0.12 * Math.sin(t * 3),
        rEx: -0.9 + 0.22 * Math.sin(t * 5.5),
        rEz: 0.25,
        hx: 0.06 * Math.sin(t * 5),
        hz: 0.06 * Math.sin(t * 2),
      });
    } else if (action === 'cheer') {
      const b = Math.abs(Math.sin(t * 7));
      Object.assign(T, {
        bodyY: 0.12 * b,
        sy: 1 + 0.05 * b,
        sx: 1 - 0.03 * b,
        rSz: -2.75 + 0.12 * Math.sin(t * 8),
        rSx: -0.1,
        rEz: 0.15,
        lSz: 2.75 - 0.12 * Math.sin(t * 8),
        lSx: -0.1,
        lEx: 0,
        lEz: -0.15,
        hx: -0.14,
      });
    }
    if (phase === 'crouch') {
      Object.assign(T, { sy: 0.8, sx: 1.12, bodyY: 0, rSz: -0.45, rSx: 0.5, lSz: 0.45, lSx: 0.5, lEx: -0.5, hx: 0.12 });
    } else if (phase === 'air') {
      Object.assign(T, { sy: 1.1, sx: 0.93, rSz: -2.4, rSx: 0, rEz: 0.2, lSz: 2.4, lSx: 0, lEx: -0.2, lEz: -0.2, hx: -0.1 });
    }

    if (settleT >= 0) {
      const k = Math.sin(Math.PI * Math.min(1, settleT / 0.4));
      T.sy -= 0.08 * k;
      T.sx += 0.045 * k;
    }

    // ---- nghỉ: vươn vai → nằm nghiêng (tay phải gối đầu, tay trái ôm mũ trên bụng) ----
    blend(T, YAWN, smooth(R.yawn));
    const arm = smooth(R.p * 1.4);
    if (arm > 0) {
      const b = Math.sin(t * 1.6);
      blend(
        T,
        {
          bodyY: 0,
          sx: 1 + 0.012 * b,
          sy: 1,
          bodyRz: 0,
          hx: 0.04 + lookNow.y * 0.12,
          hy: lookNow.x * 0.25,
          hz: -0.28 + 0.035 * Math.sin(t * 0.9),
          rSx: 0.25,
          rSz: -2.85,
          rEx: 0,
          rEz: -0.95,
          lSx: -1.2 + 0.03 * b,
          lSz: -0.32,
          lEx: -0.45,
          lEz: -1.05,
        },
        arm,
      );
    }
    // tay trái với lên đầu khi đang lấy / đội mũ
    blend(T, REACH, Math.sin(Math.PI * clamp01(R.cap)) * (1 - smooth(R.yawn)));
  };

  /** đặt mũ: trên đầu (cap=0) → bám tay trái → trên bụng (cap=1) */
  const placeCap = () => {
    // mũ trên đầu (kèm hiệu ứng tung mũ), quy về toạ độ thân
    headPivot.updateMatrix();
    const toss = capT >= 0 ? Math.min(1, capT / 1.0) : -1;
    capOff.copy(capRest);
    capEuler.copy(capRestEuler);
    if (toss >= 0) {
      capOff.y += 1.5 * 4 * toss * (1 - toss);
      capEuler.y = Math.PI * 2 * gsapEase(toss);
    }
    mTmp.compose(capOff, qA.setFromEuler(capEuler), sA.set(1, 1, 1));
    mA.multiplyMatrices(headPivot.matrix, mTmp);
    const u = clamp01(R.cap);
    if (u <= 0.0005) {
      mA.decompose(cap.position, cap.quaternion, cap.scale);
      return;
    }
    // vị trí bàn tay trái trong thân
    armL.shoulder.updateMatrix();
    armL.elbow.updateMatrix();
    armL.hand.updateMatrix();
    mB.multiplyMatrices(armL.shoulder.matrix, armL.elbow.matrix).multiply(armL.hand.matrix);
    pH.setFromMatrixPosition(mB);
    mA.decompose(pA, qA, sA);
    capBelly.decompose(pB, qB, sB);
    const e = smooth(u);
    cap.position.lerpVectors(pA, pB, e);
    // giữa chừng mũ bám theo bàn tay (như đang cầm)
    const w = Math.pow(Math.sin(Math.PI * u), 1.3) * 0.9;
    pH.y += 0.1;
    pH.z += 0.12;
    cap.position.lerp(pH, w);
    cap.quaternion.slerpQuaternions(qA, qB, e);
    cap.scale.lerpVectors(sA, sB, e);
  };

  return {
    object: root,
    setSkinTone(night) {
      skinMaterial.color.setHex(night ? 0xffe9db : C.skin);
    },
    setAction(a) {
      if (a === 'cheer' && action !== 'cheer' && clock - lastCapToss > 3) {
        capT = 0;
        lastCapToss = clock;
      }
      action = a;
    },
    setSpeaking(on) {
      speaking = on;
    },
    setLook(x, y) {
      look.x = Math.max(-1, Math.min(1, x));
      look.y = Math.max(-1, Math.min(1, y));
    },
    setPhase(p) {
      phase = p;
      phaseT = 0;
      if (p === 'land') {
        P.sy = 0.78;
        P.sx = 1.14;
      }
    },
    headCenter,
    lieAmount: () => R.p,
    isResting: () => !!restTl || R.yawn > 0.001 || R.p > 0.001 || R.cap > 0.001,
    lieDown() {
      if (R.p >= 0.999 && !restTl) return Promise.resolve(true);
      stopRest();
      return new Promise<boolean>((resolve) => {
        pendingLie = resolve;
        thudPlayed = false;
        const tl = gsap.timeline({
          onComplete: () => {
            restTl = null;
            pendingLie = null;
            resolve(true);
          },
        });
        // chỉ vươn vai nếu đang đứng hẳn
        let t0 = 0;
        if (R.p < 0.05 && R.cap < 0.05) {
          tl.to(R, { yawn: 1, duration: 0.55, ease: 'sine.out' }, 0);
          t0 = 0.95;
        }
        tl.to(R, { yawn: 0, duration: 0.55, ease: 'sine.inOut' }, t0);
        tl.to(R, { cap: 1, duration: 1.0 * (1 - R.cap) + 0.05, ease: 'none' }, t0 - 0.15);
        tl.to(R, { p: 1, duration: 1.25 * (1 - R.p) + 0.15, ease: 'sine.inOut' }, t0 + 0.1);
        restTl = tl;
      });
    },
    getUp() {
      stopRest();
      return new Promise<void>((resolve) => {
        const fromP = R.p;
        const fromCap = R.cap;
        const tl = gsap.timeline({
          onComplete: () => {
            restTl = null;
            // nhún nhẹ khi đứng vững
            if (fromP > 0.2) settleT = 0;
            resolve();
          },
        });
        tl.to(R, { yawn: 0, duration: 0.2, ease: 'sine.out' }, 0);
        tl.to(R, { p: 0, duration: 0.15 + 0.65 * fromP, ease: 'power2.inOut' }, 0);
        tl.to(R, { cap: 0, duration: 0.1 + 0.6 * fromCap, ease: 'none' }, fromP > 0.3 ? 0.15 : 0);
        restTl = tl;
      });
    },
    update(dt, t) {
      clock = t;
      dt = Math.min(dt, 0.05);
      if (phase) {
        phaseT += dt;
        if (phase === 'land' && phaseT > 0.12) phase = null;
      }
      if (settleT >= 0) {
        settleT += dt;
        if (settleT > 0.4) settleT = -1;
      }
      const kl = 1 - Math.exp(-dt * 4);
      lookNow.x += (look.x - lookNow.x) * kl;
      lookNow.y += (look.y - lookNow.y) * kl;
      targets(t);
      const kLimb = 1 - Math.exp(-dt * (phase === 'air' || phase === 'crouch' ? 20 : 11));
      const kSq = 1 - Math.exp(-dt * (phase ? 26 : 9));
      for (const k of Object.keys(T) as PoseKey[]) P[k] += (T[k] - P[k]) * (SQUASH.includes(k) ? kSq : kLimb);

      body.position.y = P.bodyY;
      body.scale.set(P.sx, P.sy, P.sx);
      body.rotation.z = P.bodyRz;
      headPivot.rotation.set(P.hx, P.hy, P.hz);
      armR.shoulder.rotation.set(P.rSx, 0, P.rSz);
      armR.elbow.rotation.set(P.rEx, 0, P.rEz);
      armL.shoulder.rotation.set(P.lSx, 0, P.lSz);
      armL.elbow.rotation.set(P.lEx, 0, P.lEz);

      // nằm nghiêng: xoay quanh trục nhìn (mặt vẫn hướng ra ngoài), nâng thân để không lún đất,
      // trượt dần về giữa để lúc nằm hẳn thân nằm đúng chỗ đứng
      const theta = LIE_ANGLE * R.p;
      const lc = liftAndCenter(theta);
      lieGroup.rotation.z = theta;
      lieGroup.position.set(-lc.center * smooth(R.p), lc.lift, 0);
      if (R.p > 0.85 && !thudPlayed && restTl) {
        thudPlayed = true;
        audio.rustle(0.55);
      }
      // đung đưa chân khi nằm
      const kick = smooth(R.p);
      legs[0].rotation.z = kick * (0.12 + 0.16 * Math.sin(t * 2.3));
      legs[1].rotation.z = kick * (0.06 + 0.16 * Math.sin(t * 2.3 + 1.6));

      // miệng (nói / ngáp)
      const yw = smooth(R.yawn);
      const mo = Math.max(speaking ? 0.35 + 0.65 * Math.abs(Math.sin(t * 13) * Math.sin(t * 5.3 + 1)) : 0, yw * 1.6);
      mouthOpen += (mo - mouthOpen) * (1 - Math.exp(-dt * 25));
      open.visible = mouthOpen > 0.1;
      smile.visible = !open.visible;
      open.scale.y = 0.02 + 0.05 * mouthOpen;
      open.scale.x = 0.07 + 0.012 * Math.max(0, mouthOpen - 1);

      // chớp mắt
      blinkIn -= dt;
      if (blinkIn <= 0 && blinkT < 0) {
        blinkT = 0;
        blinkIn = 2.2 + Math.random() * 3;
      }
      let lid = 1;
      if (blinkT >= 0) {
        blinkT += dt;
        lid = blinkT < 0.07 ? 1 - blinkT / 0.07 : blinkT < 0.14 ? (blinkT - 0.07) / 0.07 : 1;
        lid = Math.max(0.08, lid);
        if (blinkT >= 0.14) blinkT = -1;
      }
      // ngáp nhắm mắt, nằm thì lim dim thư giãn
      lid *= 1 - 0.9 * yw;
      lid *= 1 - 0.28 * smooth(R.p);
      lid = Math.max(0.08, lid);
      for (const e of eyes) e.scale.y = EYE_H * lid;
      for (const h of eyeHls) h.visible = lid > 0.5;

      // tua mũ đung đưa theo quán tính
      const target = -P.hz * 1.6 - P.bodyRz * 1.5 + 0.08 * Math.sin(t * 1.7) + (phase === 'air' ? 0.5 : 0);
      tasselV += (target - tasselA) * 70 * dt - tasselV * 5 * dt;
      tasselA += tasselV * dt;
      tassel.rotation.z = tasselA;
      tassel.rotation.x = -tasselA * 0.5;

      // tung mũ khi tung hô
      if (capT >= 0) {
        capT += dt;
        if (capT >= 1) capT = -1;
      }
      placeCap();
    },
  };
}

function gsapEase(u: number) {
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}
