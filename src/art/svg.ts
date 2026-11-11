/**
 * Thư viện hình vẽ SVG (vẽ bằng code, không cần file ảnh):
 * hoa, cây, cổng hoa, mây, mặt trời, bướm, icon và ảnh minh hoạ tạm.
 */
import { seeded } from '../lib/util';

const f1 = (n: number) => Math.round(n * 10) / 10;

function petalRing(n: number, rx: number, ry: number, dist: number, fill: string, offset = 0) {
  let s = `<g fill="${fill}">`;
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i + offset;
    s += `<ellipse rx="${rx}" ry="${ry}" transform="rotate(${f1(a)}) translate(0 ${-dist})"/>`;
  }
  return s + '</g>';
}

const STEM = '#3f9b4f';
const LEAF_A = '#5cbf60';
const LEAF_B = '#46a956';

function stem(topY: number, bend = 0) {
  return (
    `<path d="M30 140 C${30 + bend} 112 ${30 - bend} ${topY + 40} 30 ${topY}" stroke="${STEM}" stroke-width="3.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M30 112 C18 106 11 96 12 86 C22 88 29 97 30 112Z" fill="${LEAF_A}"/>` +
    `<path d="M30 124 C42 118 49 108 48 98 C38 100 31 109 30 124Z" fill="${LEAF_B}"/>`
  );
}

/** <svg> ẩn chứa các <symbol> dùng chung, chèn 1 lần vào trang */
export function symbolSprite(): string {
  const daisy =
    stem(42) +
    `<g transform="translate(30 40)">${petalRing(12, 4.6, 12, 11, 'var(--p,#fff)')}${petalRing(12, 3, 8, 9, 'var(--p2,#ffe9f1)', 15)}` +
    `<circle r="8.5" fill="var(--c,#ffc93c)"/><circle r="8.5" fill="none" stroke="#e8a325" stroke-width="1.6"/><circle cx="-2.5" cy="-2.5" r="2.4" fill="#fff3b0" opacity=".8"/></g>`;

  const tulip =
    stem(46, 3) +
    `<g transform="translate(30 38)">` +
    `<path d="M-14 -8 C-16 8 -9 20 0 20 C9 20 16 8 14 -8 L7 1 L0 -14 L-7 1Z" fill="var(--p,#ff8fb1)"/>` +
    `<path d="M0 -14 L-7 1 C-6 10 -3 17 0 20 C3 17 6 10 7 1Z" fill="var(--p2,#ff6f91)"/>` +
    `<path d="M-10 -2 C-10 6 -7 12 -4 15" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;

  let sunflower =
    `<path d="M30 140 C33 110 27 70 30 34" stroke="${STEM}" stroke-width="4.2" fill="none" stroke-linecap="round"/>` +
    `<path d="M30 100 C14 96 6 82 8 70 C20 72 29 84 30 100Z" fill="${LEAF_A}"/>` +
    `<path d="M30 80 C46 76 54 62 52 50 C40 52 31 64 30 80Z" fill="${LEAF_B}"/>` +
    `<g transform="translate(30 30)">${petalRing(16, 4.4, 11, 15, '#ffc93c')}${petalRing(16, 3.6, 9, 13, '#ffb000', 11)}` +
    `<circle r="11.5" fill="#7a4a22"/><circle r="8" fill="#5e3517"/>`;
  {
    const r = seeded(4);
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 9;
      sunflower += `<circle cx="${f1(Math.cos(a) * d)}" cy="${f1(Math.sin(a) * d)}" r="1.1" fill="#a8723f"/>`;
    }
    sunflower += '</g>';
  }

  let pom = stem(50, -2) + `<g transform="translate(30 38)">`;
  {
    const r = seeded(9);
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 13;
      const col = i % 3 === 0 ? 'var(--p2,#a77fe6)' : 'var(--p,#c9a7f5)';
      pom += `<circle cx="${f1(Math.cos(a) * d)}" cy="${f1(Math.sin(a) * d)}" r="${f1(4 + r() * 2.5)}" fill="${col}"/>`;
    }
    pom += `<circle cx="-5" cy="-6" r="3" fill="#fff" opacity=".45"/></g>`;
  }

  const smallFlower = (x: number, y: number, r: number) =>
    `<g transform="translate(${x} ${y})">${petalRing(5, r * 0.55, r * 0.8, r * 0.7, 'var(--p,#fff)')}<circle r="${f1(r * 0.42)}" fill="var(--c,#ffc93c)"/></g>`;
  const bell =
    `<path d="M30 140 C30 115 28 95 29 70 M29 98 C22 88 18 78 16 66 M29 90 C37 80 42 70 44 58" stroke="${STEM}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M30 124 C20 120 14 112 15 104 C23 106 29 113 30 124Z" fill="${LEAF_A}"/>` +
    smallFlower(29, 68, 8) +
    smallFlower(16, 64, 7) +
    smallFlower(44, 56, 7.5);

  const rose =
    stem(48, 2) +
    `<g transform="translate(30 40)"><circle r="14" fill="var(--p,#ff6f91)"/>` +
    `<path d="M-9 4 C-10 -8 6 -12 9 -2 C11 6 0 10 -3 4 C-5 -1 2 -4 4 0" stroke="var(--p2,#e04f77)" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M-14 0 C-12 10 -4 14 4 13" stroke="var(--p2,#e04f77)" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<circle cx="-5" cy="-7" r="3.5" fill="#fff" opacity=".35"/></g>`;

  const grass =
    `<path d="M30 140 C28 115 22 100 14 88 C26 98 32 112 34 140Z" fill="#4cae55"/>` +
    `<path d="M26 140 C25 118 30 98 38 82 C36 100 34 118 36 140Z" fill="#5cbf60"/>` +
    `<path d="M22 140 C18 124 10 116 2 112 C14 114 24 122 28 140Z" fill="#3f9b4f"/>` +
    `<path d="M32 140 C36 122 46 112 58 108 C48 116 40 126 38 140Z" fill="#6fcf72"/>`;

  const bush =
    `<g><circle cx="60" cy="80" r="46" fill="#3a9a52"/><circle cx="120" cy="66" r="56" fill="#43a85a"/><circle cx="180" cy="82" r="44" fill="#3a9a52"/>` +
    `<circle cx="100" cy="46" r="34" fill="#53b866"/><circle cx="150" cy="40" r="30" fill="#5cc46f"/><rect x="20" y="80" width="200" height="60" fill="#3a9a52"/>` +
    `<circle cx="112" cy="30" r="12" fill="#7ad98a" opacity=".7"/><circle cx="62" cy="58" r="9" fill="#6fcf7d" opacity=".7"/></g>`;

  return (
    `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>` +
    `<symbol id="f-daisy" viewBox="0 0 60 140">${daisy}</symbol>` +
    `<symbol id="f-tulip" viewBox="0 0 60 140">${tulip}</symbol>` +
    `<symbol id="f-sun" viewBox="0 0 60 140">${sunflower}</symbol>` +
    `<symbol id="f-pom" viewBox="0 0 60 140">${pom}</symbol>` +
    `<symbol id="f-bell" viewBox="0 0 60 140">${bell}</symbol>` +
    `<symbol id="f-rose" viewBox="0 0 60 140">${rose}</symbol>` +
    `<symbol id="f-grass" viewBox="0 0 60 140">${grass}</symbol>` +
    `<symbol id="bush" viewBox="0 0 240 140">${bush}</symbol>` +
    `</defs></svg>`
  );
}

export type FlowerKind = 'daisy' | 'tulip' | 'sun' | 'pom' | 'bell' | 'rose' | 'grass';

export const FLOWER_COLORS: Record<FlowerKind, Array<[string, string, string?]>> = {
  daisy: [
    ['#ffffff', '#ffe9f1'],
    ['#ffffff', '#fff6d6'],
    ['#ffd6e5', '#ffb8cf'],
    ['#e6dcff', '#cbb8ff'],
  ],
  tulip: [
    ['#ff8fb1', '#ff6f91'],
    ['#ff8a65', '#f4613a'],
    ['#ffd54f', '#ffb300'],
    ['#c3a4f2', '#a17ee0'],
    ['#ff6f7d', '#e64a5d'],
  ],
  sun: [['', '']],
  pom: [
    ['#c9a7f5', '#a77fe6'],
    ['#9fd0ff', '#6cb2f7'],
    ['#ffb3cf', '#ff8fb1'],
  ],
  bell: [
    ['#ffffff', '', '#ffc93c'],
    ['#ffe066', '', '#ff9f1c'],
    ['#ffb3c8', '', '#fff1a8'],
    ['#a8d8ff', '', '#fff'],
  ],
  rose: [
    ['#ff6f91', '#e04f77'],
    ['#ffb4a2', '#ff8a73'],
    ['#ff8fab', '#f06292'],
  ],
  grass: [['', '']],
};

// ---------- cây ----------
/** Cây phượng: tán xanh điểm chùm hoa đỏ cam (biểu tượng mùa tốt nghiệp) */
export function flameTree(seed = 1): string {
  const r = seeded(seed);
  let blossoms = '';
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const cx = 150 + Math.cos(a) * 120 * d;
    const cy = 135 + Math.sin(a) * 85 * d;
    const col = r() < 0.5 ? '#ff5a36' : r() < 0.5 ? '#ff7a45' : '#ffb347';
    const s = 5 + r() * 6;
    blossoms += `<g transform="translate(${f1(cx)} ${f1(cy)})">${petalRing(5, s * 0.5, s * 0.75, s * 0.65, col, r() * 70)}<circle r="${f1(s * 0.3)}" fill="#ffe08a"/></g>`;
  }
  return (
    `<svg viewBox="0 0 300 400" class="tree-svg" preserveAspectRatio="xMidYMax meet">` +
    `<path d="M136 400 C140 330 132 280 120 240 L136 236 C146 270 152 250 150 220 L160 222 C162 260 170 290 176 250 C178 238 184 230 190 226 L196 234 C184 262 176 320 172 400Z" fill="#8a5a3b"/>` +
    `<path d="M158 400 C160 330 164 290 172 260 L176 268 C170 300 170 340 172 400Z" fill="#6f4529"/>` +
    `<g class="canopy">` +
    `<ellipse cx="150" cy="168" rx="148" ry="70" fill="#2f8a48"/>` +
    `<circle cx="70" cy="150" r="62" fill="#3a9a52"/><circle cx="232" cy="150" r="64" fill="#3a9a52"/>` +
    `<circle cx="120" cy="100" r="74" fill="#43a85a"/><circle cx="196" cy="104" r="70" fill="#43a85a"/>` +
    `<circle cx="150" cy="62" r="58" fill="#53b866"/><circle cx="92" cy="88" r="40" fill="#5cc46f"/>` +
    `<circle cx="128" cy="44" r="24" fill="#7ad98a" opacity=".75"/><circle cx="210" cy="78" r="20" fill="#7ad98a" opacity=".6"/>` +
    blossoms +
    `</g></svg>`
  );
}

/** Cây tán tròn xanh với hoa trắng hồng nhỏ */
export function roundTree(seed = 2): string {
  const r = seeded(seed);
  let dots = '';
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const cx = 150 + Math.cos(a) * 105 * d;
    const cy = 130 + Math.sin(a) * 95 * d;
    const col = r() < 0.6 ? '#ffffff' : '#ffc4d8';
    dots += `<g transform="translate(${f1(cx)} ${f1(cy)})">${petalRing(5, 2.6, 4, 3.6, col)}<circle r="1.8" fill="#ffd54f"/></g>`;
  }
  return (
    `<svg viewBox="0 0 300 400" class="tree-svg" preserveAspectRatio="xMidYMax meet">` +
    `<path d="M140 400 C144 340 142 290 136 250 L164 250 C158 290 156 340 162 400Z" fill="#8a5a3b"/>` +
    `<path d="M150 260 C140 236 120 222 100 216 M152 262 C164 236 184 226 202 220" stroke="#8a5a3b" stroke-width="9" fill="none" stroke-linecap="round"/>` +
    `<g class="canopy">` +
    `<circle cx="150" cy="140" r="112" fill="#3a9a52"/>` +
    `<circle cx="96" cy="160" r="64" fill="#43a85a"/><circle cx="206" cy="158" r="62" fill="#43a85a"/>` +
    `<circle cx="150" cy="96" r="78" fill="#4cb963"/><circle cx="110" cy="80" r="40" fill="#5cc46f"/>` +
    `<circle cx="120" cy="64" r="22" fill="#86e094" opacity=".7"/><circle cx="196" cy="110" r="18" fill="#86e094" opacity=".5"/>` +
    dots +
    `</g></svg>`
  );
}

// ---------- cổng hoa ----------
export function flowerArch(label: string): string {
  const r = seeded(21);
  // khung: 2 trụ + vòm elip
  const cx = 130;
  const baseY = 300;
  const topY = 26;
  const postY = 120;
  const rx = 100;
  const ry = postY - topY;
  const pt = (t: number) => ({ x: cx - rx * Math.cos(t), y: postY - ry * Math.sin(t) });
  let deco = '';
  const flowerCols = ['#ff8fb1', '#ffffff', '#ffc93c', '#ff6f91', '#c9a7f5', '#ffb4a2'];
  // lá + hoa dọc vòm
  for (let i = 0; i <= 34; i++) {
    const t = (Math.PI * i) / 34;
    const p = pt(t);
    const ang = (Math.atan2(-ry * Math.cos(t), rx * Math.sin(t)) * 180) / Math.PI;
    for (const side of [-1, 1]) {
      deco += `<ellipse cx="${f1(p.x)}" cy="${f1(p.y)}" rx="9" ry="4.5" fill="${r() < 0.5 ? '#46a956' : '#5cbf60'}" transform="rotate(${f1(ang + side * 35 + (r() - 0.5) * 30)} ${f1(p.x)} ${f1(p.y)}) translate(${side * 7} 0)"/>`;
    }
  }
  for (let i = 0; i <= 15; i++) {
    const t = (Math.PI * (i + r() * 0.4)) / 15.4;
    const p = pt(t);
    const col = flowerCols[Math.floor(r() * flowerCols.length)];
    const s = 6 + r() * 4;
    deco += `<g transform="translate(${f1(p.x + (r() - 0.5) * 6)} ${f1(p.y + (r() - 0.5) * 6)})">${petalRing(5, s * 0.55, s * 0.8, s * 0.7, col, r() * 70)}<circle r="${f1(s * 0.4)}" fill="#ffd54f"/></g>`;
  }
  // dây leo trên trụ
  for (const px of [cx - rx, cx + rx]) {
    for (let y = postY + 10; y < baseY - 6; y += 13) {
      const side = (Math.round(y / 13) % 2) * 2 - 1;
      deco += `<ellipse cx="${px + side * 6}" cy="${y}" rx="8" ry="4" fill="${r() < 0.5 ? '#46a956' : '#5cbf60'}" transform="rotate(${side * 30} ${px + side * 6} ${y})"/>`;
      if (r() < 0.35) {
        const col = flowerCols[Math.floor(r() * flowerCols.length)];
        deco += `<g transform="translate(${px - side * 5} ${y + 4})">${petalRing(5, 3, 4.5, 4, col)}<circle r="2.2" fill="#ffd54f"/></g>`;
      }
    }
  }
  const bw = 196;
  const by = 52;
  const banner =
    `<g class="arch-banner">` +
    `<path d="M${cx - bw / 2 - 16} ${by - 4} l16 13 -16 13 h26 v-26Z" fill="#e85d75"/>` +
    `<path d="M${cx + bw / 2 + 16} ${by - 4} l-16 13 16 13 h-26 v-26Z" fill="#e85d75"/>` +
    `<path d="M${cx - bw / 2} ${by - 10} Q${cx} ${by - 2} ${cx + bw / 2} ${by - 10} V${by + 18} Q${cx} ${by + 26} ${cx - bw / 2} ${by + 18}Z" fill="#ff7a90"/>` +
    `<text x="${cx}" y="${by + 10}" text-anchor="middle" font-family="'Baloo 2', system-ui, sans-serif" font-weight="800" font-size="15" fill="#fff" letter-spacing=".4">${label}</text>` +
    `</g>`;
  return (
    `<svg viewBox="0 0 260 ${baseY}" preserveAspectRatio="xMidYMax meet">` +
    `<path d="M${cx - rx} ${baseY} V${postY} A${rx} ${ry} 0 0 1 ${cx + rx} ${postY} V${baseY}" fill="none" stroke="#fff6ea" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M${cx - rx} ${baseY} V${postY} A${rx} ${ry} 0 0 1 ${cx + rx} ${postY} V${baseY}" fill="none" stroke="#e9d3b8" stroke-width="2" stroke-dasharray="1 12" stroke-linecap="round"/>` +
    deco +
    banner +
    `</svg>`
  );
}

// ---------- trời ----------
export function cloud(): string {
  return (
    `<svg viewBox="0 0 220 100" preserveAspectRatio="xMidYMid meet">` +
    `<g fill="#ffffff"><circle cx="60" cy="62" r="30"/><circle cx="100" cy="44" r="38"/><circle cx="148" cy="54" r="32"/><circle cx="180" cy="70" r="22"/><rect x="40" y="62" width="150" height="30" rx="15"/></g>` +
    `<g fill="#e7f4ff"><rect x="44" y="80" width="140" height="12" rx="6"/></g></svg>`
  );
}

/** tia nắng (xoay bằng CSS trên một lớp riêng) */
export function sunRays(): string {
  let rays = '';
  for (let i = 0; i < 12; i++) rays += `<rect x="-5" y="-92" width="10" height="26" rx="5" transform="rotate(${i * 30})"/>`;
  return `<svg viewBox="-100 -100 200 200"><g class="ray-fill" opacity=".85">${rays}</g></svg>`;
}

/** đĩa mặt trời: bản ban ngày + bản hoàng hôn (CSS chọn bản nào hiện) */
export function sunDisc(): string {
  return (
    `<svg viewBox="-100 -100 200 200">` +
    `<defs><radialGradient id="sunG"><stop offset="0" stop-color="#fff5b8"/><stop offset="1" stop-color="#ffc93c"/></radialGradient>` +
    `<radialGradient id="sunS"><stop offset="0" stop-color="#fff0c2"/><stop offset=".55" stop-color="#ffb35c"/><stop offset="1" stop-color="#ff7a59"/></radialGradient></defs>` +
    `<g class="sun-day"><circle r="78" fill="#ffe680" opacity=".25"/><circle r="50" fill="url(#sunG)"/></g>` +
    `<g class="sun-set"><circle r="96" fill="#ffb37a" opacity=".22"/><circle r="74" fill="#ffc48a" opacity=".3"/><circle r="52" fill="url(#sunS)"/></g>` +
    `</svg>`
  );
}

/** trăng khuyết có quầng sáng */
export function moon(): string {
  return (
    `<svg viewBox="-100 -100 200 200">` +
    `<defs><radialGradient id="moonGlow"><stop offset="0" stop-color="#fff7d6" stop-opacity=".55"/><stop offset="1" stop-color="#fff7d6" stop-opacity="0"/></radialGradient></defs>` +
    `<circle r="96" fill="url(#moonGlow)"/>` +
    `<path d="M10 -46 A48 48 0 1 0 46 22 A38 38 0 1 1 10 -46Z" fill="#fff4c9"/>` +
    `<circle cx="-14" cy="10" r="6" fill="#f1e2ad" opacity=".8"/><circle cx="-2" cy="30" r="4" fill="#f1e2ad" opacity=".7"/><circle cx="-26" cy="-12" r="3.5" fill="#f1e2ad" opacity=".7"/>` +
    `</svg>`
  );
}

// ---------- trang trí thiệp ----------
/** Hoa góc cho thiệp mời — nét dây (vẽ dần bằng DrawSVG) + lá + hoa */
export function cornerFloral(): string {
  const r = seeded(41);
  let leaves = '';
  const pts: Array<[number, number, number]> = [
    [14, 70, -60],
    [22, 46, -40],
    [36, 28, -20],
    [56, 16, 10],
    [80, 10, 20],
    [104, 8, 30],
  ];
  for (const [x, y, a] of pts) {
    leaves += `<ellipse class="cf-leaf" cx="${x}" cy="${y}" rx="9" ry="4" fill="${r() < 0.5 ? '#5cbf60' : '#46a956'}" transform="rotate(${a + 40} ${x} ${y})"/>`;
    leaves += `<ellipse class="cf-leaf" cx="${x + 4}" cy="${y + 6}" rx="8" ry="3.6" fill="#7ccf7f" transform="rotate(${a - 30} ${x + 4} ${y + 6})"/>`;
  }
  const flower = (x: number, y: number, s: number, c: string) =>
    `<g class="cf-flower" transform="translate(${x} ${y})">${petalRing(5, s * 0.55, s * 0.85, s * 0.72, c)}<circle r="${f1(s * 0.42)}" fill="#ffd54f"/></g>`;
  return (
    `<svg viewBox="0 0 120 120">` +
    `<path class="cf-vine" d="M6 118 C6 70 30 30 60 18 C80 10 100 8 118 8" stroke="#3f9b4f" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    leaves +
    flower(22, 22, 14, '#ff8fb1') +
    flower(46, 40, 9, '#ffffff') +
    flower(10, 48, 8, '#ffc93c') +
    flower(64, 8, 8, '#c9a7f5') +
    `</svg>`
  );
}

// ---------- icon ----------
export const icons = {
  cap: `<svg viewBox="0 0 64 64"><path d="M32 10 2 24l30 14 30-14Z" fill="currentColor"/><path d="M14 31v13c0 5 8 9 18 9s18-4 18-9V31l-18 8.5Z" fill="currentColor" opacity=".85"/><path d="M56 26v16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="56" cy="45" r="3.5" fill="currentColor"/></svg>`,
  pin: `<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2Z" fill="currentColor"/></svg>`,
  clock: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`,
  soundOn: `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  soundOff: `<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor"/><path d="m16.5 9.5 5 5m0-5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  skip: `<svg viewBox="0 0 24 24"><path d="M5 6l8 6-8 6Zm8 0 8 6-8 6Z" fill="currentColor"/></svg>`,
  replay: `<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M4 3v5h5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  close: `<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  left: `<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  right: `<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  photo: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="11" r="2" fill="currentColor"/><path d="m4 18 5-5 3.5 3.5L15 14l5 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M15 2.5v5m0 0-2-2m2 2 2-2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  download: `<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  share: `<svg viewBox="0 0 24 24"><path d="M12 15V4m0 0L8 8m4-4 4 4M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24"><path d="M12 1c.8 5.6 4.4 9.2 10 10-5.6.8-9.2 4.4-10 10-.8-5.6-4.4-9.2-10-10 5.6-.8 9.2-4.4 10-10Z" fill="currentColor"/></svg>`,
};

// ---------- ảnh minh hoạ tạm ----------
const PH_SCENES: Array<{ bg: [string, string]; art: string }> = [
  {
    // ngày đầu nhập học: toà nhà trường
    bg: ['#bde7ff', '#e9f8ff'],
    art:
      `<circle cx="320" cy="90" r="34" fill="#ffd95a"/>` +
      `<rect x="0" y="380" width="400" height="120" fill="#7fd08a"/>` +
      `<rect x="80" y="200" width="240" height="180" fill="#fff6ea"/><path d="M60 205 200 130 340 205Z" fill="#4a6fd1"/>` +
      `<g fill="#9cc3f5">${[0, 1, 2, 3].map((i) => `<rect x="${102 + i * 52}" y="230" width="34" height="44" rx="4"/><rect x="${102 + i * 52}" y="292" width="34" height="44" rx="4"/>`).join('')}</g>` +
      `<rect x="178" y="320" width="44" height="60" rx="6" fill="#4a6fd1"/>` +
      `<circle cx="40" cy="350" r="40" fill="#43a85a"/><circle cx="370" cy="345" r="44" fill="#43a85a"/>`,
  },
  {
    // đêm chạy deadline: laptop, trăng
    bg: ['#24305e', '#3d4c8a'],
    art:
      `<circle cx="320" cy="90" r="36" fill="#fff1b8"/><circle cx="336" cy="80" r="32" fill="#2c3a70"/>` +
      `${[...Array(14)].map((_, i) => `<circle cx="${(i * 97) % 380 + 10}" cy="${(i * 53) % 180 + 20}" r="${1.5 + (i % 3)}" fill="#fff" opacity=".8"/>`).join('')}` +
      `<rect x="70" y="230" width="260" height="160" rx="12" fill="#cfd8f5"/><rect x="84" y="244" width="232" height="132" rx="6" fill="#1b2347"/>` +
      `<text x="200" y="326" text-anchor="middle" font-family="monospace" font-size="54" font-weight="700" fill="#7ee0a1">&lt;/&gt;</text>` +
      `<path d="M40 390h320l-24 26H64Z" fill="#aeb9e0"/>` +
      `<rect x="300" y="330" width="40" height="50" rx="6" fill="#ff9f7a"/><path d="M340 342c14 0 14 26 0 26" stroke="#ff9f7a" stroke-width="6" fill="none"/>` +
      `<path d="M312 320c-4-10 6-14 2-24M326 320c-4-10 6-14 2-24" stroke="#fff" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>`,
  },
  {
    // bạn bè: 3 khuôn mặt cười
    bg: ['#ffd9c7', '#fff1e8'],
    art:
      [
        [110, 270, '#ffcfa8', '#3b2a22'],
        [200, 240, '#ffd9b8', '#5a3a2a'],
        [290, 270, '#f7c59f', '#2a2a2a'],
      ]
        .map(
          ([x, y, skin, hair]) =>
            `<circle cx="${x}" cy="${y}" r="62" fill="${skin}"/><path d="M${Number(x) - 62} ${y} a62 62 0 0 1 124 0 c-30-22-80-26-124 0Z" fill="${hair}"/>` +
            `<circle cx="${Number(x) - 20}" cy="${Number(y) + 6}" r="7" fill="#2b2b3a"/><circle cx="${Number(x) + 20}" cy="${Number(y) + 6}" r="7" fill="#2b2b3a"/>` +
            `<path d="M${Number(x) - 18} ${Number(y) + 28} q18 16 36 0" stroke="#c0485a" stroke-width="5" fill="none" stroke-linecap="round"/>` +
            `<circle cx="${Number(x) - 36}" cy="${Number(y) + 24}" r="9" fill="#ff9fb0" opacity=".6"/><circle cx="${Number(x) + 36}" cy="${Number(y) + 24}" r="9" fill="#ff9fb0" opacity=".6"/>`,
        )
        .join('') +
      `<rect x="40" y="340" width="320" height="160" rx="60" fill="#ff8fb1"/>` +
      `<path d="M200 120c-14-26-56-14-40 18l40 34 40-34c16-32-26-44-40-18Z" fill="#ff6f91"/>`,
  },
  {
    // CLB: cúp + sao
    bg: ['#c8f2d0', '#effcf2'],
    art:
      `<path d="M140 150h120v60a60 60 0 0 1-120 0Z" fill="#ffc93c"/>` +
      `<path d="M140 170h-34a30 30 0 0 0 34 44M260 170h34a30 30 0 0 1-34 44" stroke="#ffc93c" stroke-width="12" fill="none"/>` +
      `<rect x="188" y="268" width="24" height="50" fill="#f0a500"/><rect x="146" y="318" width="108" height="30" rx="6" fill="#7a4a22"/>` +
      `<path d="M200 170l9 18 20 3-14 14 3 20-18-9-18 9 3-20-14-14 20-3Z" fill="#fff6c8"/>` +
      `${[
        [70, 120],
        [330, 110],
        [80, 300],
        [320, 290],
        [200, 90],
      ]
        .map(([x, y]) => `<path d="M${x} ${y - 16}c2 10 6 14 16 16-10 2-14 6-16 16-2-10-6-14-16-16 10-2 14-6 16-16Z" fill="#43a85a"/>`)
        .join('')}` +
      `<rect x="0" y="400" width="400" height="100" fill="#7fd08a"/>`,
  },
  {
    // bảo vệ luận văn: bảng trình chiếu
    bg: ['#e3d9ff', '#f5f1ff'],
    art:
      `<rect x="60" y="100" width="280" height="190" rx="10" fill="#fff"/><rect x="60" y="100" width="280" height="190" rx="10" fill="none" stroke="#7d6bd6" stroke-width="6"/>` +
      `<rect x="96" y="220" width="34" height="46" fill="#ff8fb1"/><rect x="146" y="190" width="34" height="76" fill="#ffc93c"/><rect x="196" y="160" width="34" height="106" fill="#6cb2f7"/><rect x="246" y="130" width="34" height="136" fill="#43a85a"/>` +
      `<path d="M96 200 160 170 210 140 290 112" stroke="#e85d75" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<rect x="194" y="290" width="12" height="70" fill="#7d6bd6"/><path d="M150 380 200 352 250 380" stroke="#7d6bd6" stroke-width="10" fill="none" stroke-linecap="round"/>` +
      `<text x="200" y="440" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="34" fill="#7d6bd6">10 / 10 ✨</text>`,
  },
  {
    // ngày tốt nghiệp: mũ + bằng + confetti
    bg: ['#fff1b8', '#fffbe6'],
    art:
      `${[...Array(26)].map((_, i) => `<rect x="${(i * 61) % 380 + 6}" y="${(i * 37) % 440 + 10}" width="10" height="16" rx="3" fill="${['#ff8fb1', '#6cb2f7', '#43a85a', '#c9a7f5', '#ff8a65'][i % 5]}" transform="rotate(${i * 33} ${(i * 61) % 380 + 11} ${(i * 37) % 440 + 18})"/>`).join('')}` +
      `<path d="M200 140 60 200l140 60 140-60Z" fill="#26335f"/><path d="M110 226v50c0 20 40 36 90 36s90-16 90-36v-50l-90 38Z" fill="#344680"/>` +
      `<path d="M320 206v70" stroke="#ffc93c" stroke-width="6" stroke-linecap="round"/><path d="M312 276h16l-4 30h-8Z" fill="#ffc93c"/>` +
      `<rect x="120" y="350" width="200" height="44" rx="22" fill="#fff6e0" stroke="#e8c98a" stroke-width="4"/><rect x="204" y="346" width="16" height="52" fill="#e85d75"/>`,
  },
];

export function placeholderPhoto(i: number, caption: string): string {
  const sc = PH_SCENES[i % PH_SCENES.length];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc.bg[0]}"/><stop offset="1" stop-color="${sc.bg[1]}"/></linearGradient></defs>` +
    `<rect width="400" height="500" fill="url(#g)"/>${sc.art}` +
    `<rect x="12" y="12" width="96" height="28" rx="14" fill="#000" opacity=".28"/>` +
    `<text x="60" y="31" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#fff">ẢNH TẠM</text>` +
    `<title>${caption.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
