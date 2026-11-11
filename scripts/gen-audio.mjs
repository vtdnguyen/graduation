/**
 * Tổng hợp toàn bộ âm thanh của trang bằng code (không dùng file có bản quyền):
 *   public/audio/bgm.mp3        nhạc nền: kalimba + ukulele (Karplus-Strong) + pad + bass, loop liền mạch
 *   public/audio/ambience.mp3   gió nhẹ + lá/cỏ xào xạc + chim xa, loop liền mạch
 *   public/audio/sfx/*.mp3      tiếng chim, cỏ, mở thiệp, pop, nhảy, ...
 *
 * Chạy: npm run gen:audio
 * Muốn đổi nhạc nền: thay public/audio/bgm.mp3 bằng bài khác (giữ tên file).
 */
import fs from 'node:fs';
import path from 'node:path';
import { Mp3Encoder } from '@breezystack/lamejs';

const SR = 44100;
const OUT = path.resolve('public/audio');
const TAU = Math.PI * 2;

// ---------- tiện ích ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midiOf(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  const n = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return n + (Number(m[3]) + 1) * 12;
}
const hz = (name) => 440 * Math.pow(2, (midiOf(name) - 69) / 12);
const stereo = (sec) => [new Float32Array(Math.ceil(sec * SR)), new Float32Array(Math.ceil(sec * SR))];
function panGains(pan) {
  const a = ((pan + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}
function addMono(L, R, t0, mono, gain = 1, pan = 0) {
  const [gl, gr] = panGains(pan);
  const s0 = Math.round(t0 * SR);
  for (let i = 0; i < mono.length; i++) {
    const j = s0 + i;
    if (j < 0 || j >= L.length) continue;
    L[j] += mono[i] * gain * gl;
    R[j] += mono[i] * gain * gr;
  }
}

// ---------- nhạc cụ ----------
function kalimba(freq, dur = 2.6) {
  const out = new Float32Array(Math.ceil(dur * SR));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const att = Math.min(1, t / 0.003);
    const s =
      Math.sin(TAU * freq * t) * Math.exp(-t / 0.85) +
      0.22 * Math.sin(TAU * freq * 2 * t) * Math.exp(-t / 0.22) +
      0.07 * Math.sin(TAU * freq * 5.4 * t) * Math.exp(-t / 0.05) +
      0.04 * Math.sin(TAU * freq * 8.9 * t) * Math.exp(-t / 0.02);
    out[i] = s * att;
  }
  return out;
}

function bell(freq, dur = 2.2) {
  const out = new Float32Array(Math.ceil(dur * SR));
  const parts = [
    [1, 1, 0.9],
    [2.0, 0.45, 0.45],
    [3.01, 0.25, 0.25],
    [4.17, 0.18, 0.15],
    [5.43, 0.1, 0.08],
  ];
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let s = 0;
    for (const [r, a, d] of parts) s += a * Math.sin(TAU * freq * r * t) * Math.exp(-t / d);
    out[i] = s * Math.min(1, t / 0.002);
  }
  return out;
}

// Karplus-Strong: tiếng gảy dây ấm như ukulele/guitar nylon
function pluck(freq, dur = 1.8, seed = 1, bright = 0.5) {
  const r = rng(seed);
  const n = Math.ceil(dur * SR);
  const y = new Float32Array(n);
  const D = SR / freq - 0.5;
  const P = Math.ceil(D) + 2;
  let lp = 0;
  for (let i = 0; i < P && i < n; i++) {
    lp = lp + bright * (r() * 2 - 1 - lp);
    y[i] = lp;
  }
  const read = (pos) => {
    const i0 = Math.floor(pos);
    const f = pos - i0;
    return i0 < 0 ? 0 : y[i0] * (1 - f) + y[i0 + 1] * f;
  };
  for (let i = P; i < n; i++) {
    y[i] = 0.996 * 0.5 * (read(i - D) + read(i - D - 1));
  }
  // vào nốt mềm + tắt dần cuối
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] *= Math.min(1, t / 0.002) * Math.min(1, (dur - t) / 0.3);
  }
  return y;
}

function padTone(freq, dur) {
  const out = new Float32Array(Math.ceil((dur + 1.2) * SR));
  const det = [0.997, 1.003];
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = t < dur ? Math.min(1, t / 0.6) : Math.max(0, 1 - (t - dur) / 1.2);
    let s = 0;
    for (const d of det) {
      const f = freq * d;
      s += Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 2 * f * t) + 0.08 * Math.sin(TAU * 3 * f * t);
    }
    out[i] = s * 0.5 * env;
  }
  return out;
}

function bassTone(freq, dur) {
  const out = new Float32Array(Math.ceil((dur + 0.15) * SR));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.01) * (0.45 + 0.55 * Math.exp(-t / 0.35)) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.15));
    out[i] = (Math.sin(TAU * freq * t) + 0.18 * Math.sin(TAU * 2 * freq * t)) * env;
  }
  return out;
}

function noiseBurst(dur, seed, { hp = true, decay = 0.05, attack = 0.004 } = {}) {
  const r = rng(seed);
  const out = new Float32Array(Math.ceil(dur * SR));
  let prev = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const w = r() * 2 - 1;
    const v = hp ? w - prev : w;
    prev = w;
    out[i] = v * Math.min(1, t / attack) * Math.exp(-t / decay);
  }
  return out;
}

function kick(dur = 0.3) {
  const out = new Float32Array(Math.ceil(dur * SR));
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = 50 + 60 * Math.exp(-t / 0.04);
    ph += TAU * f / SR;
    out[i] = Math.sin(ph) * Math.exp(-t / 0.12) * Math.min(1, t / 0.003);
  }
  return out;
}

// Một tiếng chíp: quét tần số + rung (FM) + hoà âm bậc 2
function chirp(f0, f1, dur, { vib = 0, vibDepth = 0, curve = 1, h2 = 0.15 } = {}) {
  const out = new Float32Array(Math.ceil(dur * SR));
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const u = t / dur;
    const f = f0 + (f1 - f0) * Math.pow(u, curve) + vibDepth * Math.sin(TAU * vib * t);
    ph += (TAU * f) / SR;
    const env = Math.pow(Math.sin(Math.PI * u), 1.4);
    out[i] = (Math.sin(ph) + h2 * Math.sin(2 * ph)) * env;
  }
  return out;
}
function seq(parts) {
  // parts: [[startSec, Float32Array, gain], ...]
  const len = Math.max(...parts.map(([s, a]) => Math.ceil(s * SR) + a.length));
  const out = new Float32Array(len);
  for (const [s, a, g = 1] of parts) {
    const o = Math.round(s * SR);
    for (let i = 0; i < a.length; i++) out[o + i] += a[i] * g;
  }
  return out;
}

const birdCalls = {
  tweet: () =>
    seq([
      [0, chirp(3300, 4700, 0.075)],
      [0.14, chirp(3300, 4800, 0.075)],
      [0.3, chirp(5000, 3500, 0.11, { curve: 0.6 })],
    ]),
  trill: () => {
    const parts = [];
    for (let k = 0; k < 11; k++) parts.push([k * 0.052, chirp(4300 + k * 30, 5300, 0.03), 1 - k * 0.06]);
    return seq(parts);
  },
  whistle: () =>
    seq([
      [0, chirp(2700, 2100, 0.34, { vib: 28, vibDepth: 110 })],
      [0.4, chirp(2100, 3000, 0.22, { vib: 20, vibDepth: 60 })],
    ]),
  feebee: () =>
    seq([
      [0, chirp(3500, 3400, 0.16, { h2: 0.05 })],
      [0.22, chirp(2900, 2750, 0.24, { h2: 0.05, vib: 6, vibDepth: 30 })],
    ]),
  warble: () => {
    const parts = [];
    const r = rng(77);
    let t = 0;
    for (let k = 0; k < 7; k++) {
      const a = 2600 + r() * 2200;
      const b = 2600 + r() * 2200;
      const d = 0.05 + r() * 0.06;
      parts.push([t, chirp(a, b, d, { vib: 40, vibDepth: 150 }), 0.8 + r() * 0.2]);
      t += d + 0.02 + r() * 0.03;
    }
    return seq(parts);
  },
};

// ---------- hiệu ứng ----------
function onePoleLP(x, fc) {
  const a = 1 - Math.exp((-TAU * fc) / SR);
  let y = 0;
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = y += a * (x[i] - y);
  return out;
}

// Freeverb rút gọn (stereo)
function freeverb(L, R, { room = 0.84, damp = 0.25, wet = 0.3 } = {}) {
  const combD = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const apD = [556, 441, 341, 225];
  const proc = (x, spread) => {
    const out = new Float32Array(x.length);
    const combs = combD.map((d) => ({ b: new Float32Array(d + spread), i: 0, f: 0 }));
    const aps = apD.map((d) => ({ b: new Float32Array(d + spread), i: 0 }));
    for (let n = 0; n < x.length; n++) {
      const inp = x[n] * 0.015;
      let s = 0;
      for (const c of combs) {
        const o = c.b[c.i];
        c.f = o * (1 - damp) + c.f * damp;
        c.b[c.i] = inp + c.f * room;
        c.i = (c.i + 1) % c.b.length;
        s += o;
      }
      for (const a of aps) {
        const o = a.b[a.i];
        a.b[a.i] = s + o * 0.5;
        a.i = (a.i + 1) % a.b.length;
        s = o - s;
      }
      out[n] = s;
    }
    return out;
  };
  const wl = proc(L, 0);
  const wr = proc(R, 23);
  const oL = new Float32Array(L.length);
  const oR = new Float32Array(R.length);
  for (let i = 0; i < L.length; i++) {
    oL[i] = L[i] + wl[i] * wet * 3;
    oR[i] = R[i] + wr[i] * wet * 3;
  }
  return [oL, oR];
}

/** Làm loop liền mạch: cộng phần đuôi vượt quá L vào đầu, rồi cho reverb chạy 2 vòng lấy vòng sau. */
function makeLoop(L, R, loopLen, revOpts) {
  const n = Math.round(loopLen * SR);
  const fold = (x) => {
    const y = new Float32Array(n);
    for (let i = 0; i < x.length; i++) y[i % n] += x[i];
    return y;
  };
  const l1 = fold(L);
  const r1 = fold(R);
  if (!revOpts) return [l1, r1];
  const dbl = (x) => {
    const y = new Float32Array(2 * n);
    y.set(x, 0);
    y.set(x, n);
    return y;
  };
  const [wl, wr] = freeverb(dbl(l1), dbl(r1), revOpts);
  return [wl.slice(n), wr.slice(n)];
}

/**
 * File loop = [đuôi M giây] + vòng lặp + [đầu M giây]. Khi phát chỉ lặp đoạn [M, M + L].
 * Vì tín hiệu tuần hoàn, mọi cửa sổ dài đúng L đều nối liền mạch — kể cả khi bộ giải mã MP3
 * lệch vài chục ms do khoảng đệm đầu/cuối của MP3.
 */
const LOOP_MARGIN = 0.3;
const loopInfo = {};
function withMargins(name, chs) {
  const m = Math.round(LOOP_MARGIN * SR);
  const n = chs[0].length;
  loopInfo[name] = { start: (m / SR) * 1000, duration: (n / SR) * 1000 };
  return chs.map((c) => {
    const out = new Float32Array(n + 2 * m);
    out.set(c.subarray(n - m), 0);
    out.set(c, m);
    out.set(c.subarray(0, m), m + n);
    return out;
  });
}

function normalize(chs, peak = 0.89) {
  let m = 0;
  for (const c of chs) for (const v of c) m = Math.max(m, Math.abs(v));
  const g = m > 0 ? peak / m : 1;
  for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= g;
  return chs;
}

function fadeEdges(x, inSec = 0.004, outSec = 0.05) {
  const a = Math.round(inSec * SR);
  const b = Math.round(outSec * SR);
  for (let i = 0; i < a && i < x.length; i++) x[i] *= i / a;
  for (let i = 0; i < b && i < x.length; i++) x[x.length - 1 - i] *= i / b;
  return x;
}

function encodeMp3(file, chs, kbps) {
  const enc = new Mp3Encoder(chs.length, SR, kbps);
  const toI16 = (f) => {
    const o = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) o[i] = Math.max(-1, Math.min(1, f[i])) * 32767;
    return o;
  };
  const ints = chs.map(toI16);
  const parts = [];
  const block = 1152;
  for (let i = 0; i < ints[0].length; i += block) {
    const l = ints[0].subarray(i, i + block);
    const r = ints[1] ? ints[1].subarray(i, i + block) : undefined;
    const b = r ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (b.length) parts.push(Buffer.from(b));
  }
  const end = enc.flush();
  if (end.length) parts.push(Buffer.from(end));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat(parts));
  console.log(`  ${path.relative(process.cwd(), file)}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}

// ---------- NHẠC NỀN ----------
function makeBgm() {
  const BPM = 92;
  const beat = 60 / BPM;
  const bar = beat * 4;
  const chords = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G', 'C', 'G'];
  const chordNotes = {
    C: ['C', 'E', 'G'],
    G: ['G', 'B', 'D'],
    Am: ['A', 'C', 'E'],
    F: ['F', 'A', 'C'],
    Em: ['E', 'G', 'B'],
  };
  // giai điệu: [nốt|null, số phách]
  const melody = [
    [['G4', 1], ['C5', 1], ['E5', 1], ['G5', 1]],
    [['F5', 1.5], ['E5', 0.5], ['D5', 2]],
    [['C5', 1], ['E5', 1], ['A5', 1.5], ['G5', 0.5]],
    [['F5', 1], ['E5', 1], ['C5', 2]],
    [['G4', 1], ['C5', 1], ['E5', 1], ['G5', 1]],
    [['B5', 1.5], ['A5', 0.5], ['G5', 2]],
    [['A5', 1], ['G5', 1], ['F5', 1], ['E5', 1]],
    [['D5', 3], [null, 1]],
    [['E5', 1], ['A5', 1], ['C6', 1.5], ['B5', 0.5]],
    [['B5', 1], ['G5', 1], ['E5', 2]],
    [['F5', 1], ['A5', 1], ['C6', 1], ['A5', 1]],
    [['G5', 2], ['E5', 1], ['G5', 1]],
    [['A5', 1.5], ['G5', 0.5], ['F5', 1], ['A5', 1]],
    [['G5', 1.5], ['F5', 0.5], ['E5', 1], ['D5', 1]],
    [['E5', 1], ['G5', 1], ['C6', 2]],
    [[null, 2], ['D5', 1], ['B4', 1]],
  ];
  const loopLen = bar * chords.length;
  const [L, R] = stereo(loopLen + 4);
  const r = rng(2026);

  chords.forEach((ch, b) => {
    const t0 = b * bar;
    const [root, third, fifth] = chordNotes[ch];
    // bass ở quãng 55–98 Hz
    const bassHz = hz(`${root}${['A', 'B'].includes(root) ? 1 : 2}`);
    // pad
    for (const [nn, oct] of [
      [root, 3],
      [third, 4],
      [fifth, 4],
    ]) {
      addMono(L, R, t0, padTone(hz(`${nn}${oct}`), bar), 0.028, 0);
    }
    // bass
    addMono(L, R, t0, bassTone(bassHz, beat * 1.8), 0.12, 0);
    addMono(L, R, t0 + beat * 2, bassTone(bassHz, beat * 1.6), 0.1, 0);
    // ukulele arpeggio (8 nốt móc đơn)
    const arp = [`${root}3`, `${fifth}3`, `${root}4`, `${third}4`, `${fifth}4`, `${third}4`, `${root}4`, `${fifth}3`];
    arp.forEach((nn, k) => {
      const vel = (k % 2 === 0 ? 0.34 : 0.24) * (0.9 + r() * 0.2);
      addMono(L, R, t0 + k * (beat / 2) + (r() - 0.5) * 0.008, pluck(hz(nn), 1.6, b * 16 + k, 0.45), vel, 0.3);
    });
    // shaker + kick nhẹ từ ô nhịp 5
    if (b >= 4) {
      for (let k = 0; k < 8; k++) {
        const vel = k % 2 === 1 ? 0.05 : 0.028;
        addMono(L, R, t0 + k * (beat / 2), noiseBurst(0.12, b * 100 + k, { decay: 0.035 }), vel, 0.45);
      }
      addMono(L, R, t0, kick(), 0.15, 0);
      addMono(L, R, t0 + beat * 2, kick(), 0.1, 0);
    }
    // giai điệu kalimba
    let tb = 0;
    for (const [nn, d] of melody[b]) {
      if (nn) addMono(L, R, t0 + tb * beat, kalimba(hz(nn)), 0.3, -0.2);
      tb += d;
    }
    // chuông lấp lánh cuối mỗi câu
    if (b % 4 === 3) {
      ['C7', 'G6', 'E6'].forEach((nn, k) => addMono(L, R, t0 + beat * 3 + k * 0.11, bell(hz(nn), 1.6), 0.035, 0.5 - k * 0.4));
    }
  });

  const [l, rr] = normalize(makeLoop(L, R, loopLen, { room: 0.82, damp: 0.3, wet: 0.35 }), 0.85);
  encodeMp3(path.join(OUT, 'bgm.mp3'), withMargins('bgm', [l, rr]), 128);
}

// ---------- KHÔNG KHÍ KHU VƯỜN ----------
function makeAmbience() {
  const len = 32;
  const extra = 3;
  const total = len + extra;
  const [L, R] = stereo(total);
  const r = rng(7);
  // cơn gió: tổng các sin chậm có chu kỳ chia hết cho len → không lộ chỗ nối
  const gust = (t) => {
    const v =
      0.5 +
      0.28 * Math.sin((TAU * 2 * t) / len + 0.3) +
      0.15 * Math.sin((TAU * 5 * t) / len + 1.7) +
      0.07 * Math.sin((TAU * 11 * t) / len + 4.1);
    return Math.max(0, Math.min(1, v));
  };
  // gió: nhiễu nâu + lọc thông thấp có tần số cắt thay đổi theo cơn gió
  let brownL = 0,
    brownR = 0,
    lpL = 0,
    lpR = 0;
  for (let i = 0; i < L.length; i++) {
    const t = (i / SR) % len;
    const g = gust(t);
    brownL = brownL * 0.997 + (r() * 2 - 1) * 0.06;
    brownR = brownR * 0.997 + (r() * 2 - 1) * 0.06;
    const fc = 250 + 650 * g;
    const a = 1 - Math.exp((-TAU * fc) / SR);
    lpL += a * (brownL - lpL);
    lpR += a * (brownR - lpR);
    const amp = 0.25 + 0.75 * Math.pow(g, 1.6);
    L[i] += lpL * amp * 1.3;
    R[i] += lpR * amp * 1.3;
  }
  // lá + cỏ xào xạc: hạt nhiễu tần cao, dày hơn khi gió mạnh
  for (let t = 0; t < total; ) {
    const g = gust(t % len);
    const rate = 6 + 90 * Math.pow(g, 2);
    t += -Math.log(1 - r()) / rate;
    const d = 0.004 + r() * 0.02;
    const grain = noiseBurst(d, Math.floor(r() * 1e9), { decay: d / 2.5, attack: 0.001 });
    addMono(L, R, t, grain, 0.03 + 0.08 * g * r(), r() * 1.6 - 0.8);
  }
  // vài tiếng chim xa
  const calls = Object.values(birdCalls);
  for (let t = 1.5; t < len - 1; t += 3 + r() * 5) {
    const c = calls[Math.floor(r() * calls.length)]();
    addMono(L, R, t, onePoleLP(c, 5000), 0.045 + r() * 0.03, r() * 1.4 - 0.7);
  }
  // nối vòng: crossfade đuôi vào đầu
  const n = len * SR;
  const xf = extra * SR;
  const out = [new Float32Array(n), new Float32Array(n)];
  [L, R].forEach((ch, c) => {
    for (let i = 0; i < n; i++) out[c][i] = ch[i];
    for (let i = 0; i < xf; i++) {
      const k = i / xf;
      out[c][i] = ch[i] * Math.sin((k * Math.PI) / 2) + ch[n + i] * Math.cos((k * Math.PI) / 2);
    }
  });
  const [l, rr] = makeLoop(out[0], out[1], len, { room: 0.7, damp: 0.4, wet: 0.15 });
  encodeMp3(path.join(OUT, 'ambience.mp3'), withMargins('ambience', normalize([l, rr], 0.7)), 96);
}

// ---------- SFX ----------
function makeSfx() {
  const dir = path.join(OUT, 'sfx');
  const save = (name, mono, gainPeak = 0.85, reverb = 0) => {
    let chs = [mono, mono.slice()];
    if (reverb) {
      const pad = new Float32Array(mono.length + SR);
      pad.set(mono);
      chs = freeverb(pad, pad.slice(), { room: 0.75, damp: 0.35, wet: reverb });
      // về mono
      const m = new Float32Array(chs[0].length);
      for (let i = 0; i < m.length; i++) m[i] = (chs[0][i] + chs[1][i]) / 2;
      mono = m;
    }
    // cắt đuôi im lặng
    let end = mono.length;
    while (end > 1 && Math.abs(mono[end - 1]) < 1e-4) end--;
    mono = fadeEdges(mono.slice(0, Math.min(mono.length, end + 200)), 0.002, 0.04);
    encodeMp3(path.join(dir, `${name}.mp3`), normalize([mono], gainPeak), 96);
  };

  // chim
  save('bird-1', birdCalls.tweet(), 0.8, 0.15);
  save('bird-2', birdCalls.trill(), 0.8, 0.15);
  save('bird-3', seq([[0, birdCalls.whistle()], [0.75, birdCalls.feebee(), 0.8]]), 0.8, 0.15);
  save('bird-4', birdCalls.warble(), 0.8, 0.15);

  // cỏ xào xạc khi chạm hoa
  {
    const r = rng(11);
    const dur = 0.9;
    const out = new Float32Array(Math.ceil(dur * SR));
    for (let t = 0; t < dur - 0.03; ) {
      const env = Math.sin((Math.PI * t) / dur);
      t += -Math.log(1 - r()) / (20 + 220 * env);
      const d = 0.003 + r() * 0.015;
      const g = noiseBurst(d, Math.floor(r() * 1e9), { decay: d / 2, attack: 0.001 });
      const o = Math.round(t * SR);
      for (let i = 0; i < g.length && o + i < out.length; i++) out[o + i] += g[i] * env * (0.4 + 0.6 * r());
    }
    save('rustle', onePoleLP(out, 7000), 0.6);
  }

  // dế kêu (ban đêm): 2 cụm × 3 nhịp ngắn ở ~4.6 kHz
  {
    const pulse = (f) => {
      const dur = 0.028;
      const o = new Float32Array(Math.ceil(dur * SR));
      for (let i = 0; i < o.length; i++) {
        const t = i / SR;
        o[i] = Math.sin(TAU * f * t) * (0.6 + 0.4 * Math.sin(TAU * 420 * t)) * Math.sin((Math.PI * t) / dur);
      }
      return o;
    };
    const parts = [];
    for (const [t0, f] of [
      [0, 4600],
      [0.42, 4650],
    ]) {
      for (let k = 0; k < 3; k++) parts.push([t0 + k * 0.045, pulse(f), 1 - k * 0.1]);
    }
    save('cricket', seq(parts), 0.5, 0.2);
  }

  // whoosh: nhiễu lọc quét lên rồi xuống
  const whoosh = (dur, seed) => {
    const r = rng(seed);
    const out = new Float32Array(Math.ceil(dur * SR));
    let bp1 = 0,
      bp2 = 0;
    for (let i = 0; i < out.length; i++) {
      const u = i / out.length;
      const fc = 300 + 2600 * Math.sin(Math.PI * u);
      const a = 1 - Math.exp((-TAU * fc) / SR);
      const w = r() * 2 - 1;
      bp1 += a * (w - bp1);
      bp2 += a * (bp1 - bp2);
      out[i] = (bp1 - bp2) * Math.pow(Math.sin(Math.PI * u), 1.5);
    }
    return out;
  };
  const arp = (notes, step, fn = bell, g = 1) => seq(notes.map((nn, k) => [k * step, fn(hz(nn), 1.8), g * (1 - k * 0.06)]));

  save('open', seq([[0, whoosh(0.8, 3), 0.9], [0.32, arp(['C6', 'E6', 'G6', 'C7', 'E7'], 0.075), 0.35]]), 0.85, 0.3);
  save('whoosh', whoosh(0.6, 9), 0.7);
  save('chime', arp(['G5', 'C6', 'E6', 'G6'], 0.09), 0.7, 0.3);
  {
    const r = rng(5);
    const parts = [];
    for (let k = 0; k < 7; k++) parts.push([k * 0.06 + r() * 0.03, bell(2200 + r() * 2600, 0.7), 0.5 + r() * 0.5]);
    save('sparkle', seq(parts), 0.55, 0.35);
  }
  // pop: nốt rơi nhanh
  {
    const dur = 0.12;
    const out = new Float32Array(Math.ceil(dur * SR));
    let ph = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const f = 260 + 700 * Math.exp(-t / 0.025);
      ph += (TAU * f) / SR;
      out[i] = Math.sin(ph) * Math.exp(-t / 0.035) * Math.min(1, t / 0.001);
    }
    save('pop', out, 0.6);
  }
  // boing: cú nhảy
  {
    const dur = 0.42;
    const out = new Float32Array(Math.ceil(dur * SR));
    let ph = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const u = t / dur;
      const f = 190 + 520 * Math.pow(u, 0.6) + 25 * Math.sin(TAU * 16 * t);
      ph += (TAU * f) / SR;
      out[i] = (Math.sin(ph) + 0.3 * Math.sin(2 * ph)) * Math.sin(Math.PI * Math.min(1, u * 1.1)) * Math.exp(-t / 0.3);
    }
    save('boing', out, 0.55);
  }
  // land: tiếng đáp đất nhẹ
  save('land', seq([[0, kick(0.25), 1], [0, onePoleLP(noiseBurst(0.12, 4, { hp: false, decay: 0.03 }), 900), 0.6]]), 0.6);
  // cheer: kalimba đi lên + lấp lánh
  save('cheer', seq([[0, arp(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.07, kalimba)], [0.4, arp(['C7', 'G6', 'E7'], 0.06), 0.25]]), 0.75, 0.25);
  // tap: gảy dây nhỏ
  save('tap', pluck(hz('E5'), 0.4, 3, 0.6), 0.5);
  // blip: khi bong bóng thoại hiện câu mới
  save('blip', seq([[0, kalimba(hz('G5'), 0.5), 0.8], [0.06, kalimba(hz('C6'), 0.6), 0.6]]), 0.45);
}

console.log('Đang tổng hợp âm thanh...');
fs.mkdirSync(OUT, { recursive: true });
makeSfx();
makeAmbience();
makeBgm();
// 1 giây im lặng: phát bằng HTML5 audio để iPhone vẫn có tiếng khi gạt chế độ im lặng
encodeMp3(path.join(OUT, 'silence.mp3'), [new Float32Array(SR)], 32);
const gen = path.resolve('src/generated');
fs.mkdirSync(gen, { recursive: true });
fs.writeFileSync(path.join(gen, 'audio-loops.json'), `${JSON.stringify(loopInfo, null, 2)}\n`);
console.log('  src/generated/audio-loops.json', JSON.stringify(loopInfo));
console.log('Xong.');
