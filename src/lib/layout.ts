/**
 * Tính bố cục cho từng màn hình. Toàn bộ vị trí (nhân vật, dây ảnh, phong thư, thiệp mời,
 * bong bóng thoại) đều suy ra từ kích thước khung nhìn thật, nên chạy đúng trên laptop,
 * điện thoại dọc/ngang và trình duyệt nhúng của Messenger/Zalo (vốn có thanh công cụ chiếm chỗ).
 */
import { clamp } from './util';

export interface Anchor {
  /** toạ độ px của chân nhân vật */
  x: number;
  y: number;
  /** chiều cao nhân vật (px) */
  h: number;
  /** góc xoay mặt (rad) */
  face: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Safe {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Layout {
  W: number;
  H: number;
  portrait: boolean;
  compact: boolean;
  safe: Safe;
  horizon: number;
  char: Anchor;
  charFinal: Anchor;
  /** x = tâm, y = chân cổng */
  arch: Rect;
  garland: { x0: number; x1: number; y0: number; sag: number; photoW: number };
  /** phong thư mở đầu: x,y = tâm */
  envelope: Rect;
  /** thiệp mời cuối: x,y = góc trên trái */
  invite: Rect;
  /** chiều cao tối đa của thiệp mời (nội dung dài hơn thì cuộn) */
  inviteMaxH: number;
  bubble: { mode: 'side' | 'top'; x: number; y: number; maxW: number };
}

const HUD_H = 50;
/** khoảng cách thiệp mời tới cạnh dưới màn hình */
const BOTTOM_GAP = 12;

let probe: HTMLDivElement | null = null;
export function readSafeArea(): Safe {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

export const isPortrait = (W: number, H: number) => W / H < 0.9;

/** chiều rộng thiệp mời — cần biết trước để đo chiều cao nội dung */
export function inviteWidth(W: number, H: number) {
  return isPortrait(W, H) ? Math.min(W - 24, 420) : clamp(W * 0.32, 290, 420);
}

/**
 * @param inviteH chiều cao tự nhiên của nội dung thiệp mời (đo từ DOM)
 */
export function computeLayout(W: number, H: number, safe: Safe, photoCount: number, inviteH: number): Layout {
  const portrait = isPortrait(W, H);
  const compact = !portrait && H < 500;
  const top = safe.top;
  const bottom = H - safe.bottom;
  const uh = bottom - top;
  const N = Math.max(1, photoCount);
  const iw = inviteWidth(W, H);

  if (portrait) {
    const ch = clamp(Math.min(uh * 0.36, W * 0.8), 120, 340);
    const char: Anchor = { x: W / 2, y: bottom - uh * 0.11, h: ch, face: 0 };
    const photoW = clamp(Math.min(((W * 0.96) / N) * 1.3, (uh * 0.15) / 1.38), 54, 130);

    const inviteMaxH = uh - BOTTOM_GAP - HUD_H - 90;
    const ih = Math.min(Math.max(inviteH, uh * 0.59), inviteMaxH);
    const invite: Rect = { x: (W - iw) / 2, y: bottom - BOTTOM_GAP - ih, w: iw, h: ih };
    // nhân vật đứng trên mép thiệp: thu nhỏ nếu thiếu chỗ để không bị cắt đầu
    const fh = clamp(Math.min(uh * 0.19, invite.y - top - 10), 72, 170);
    const charFinal: Anchor = { x: Math.min(invite.x + iw * 0.8, W - fh * 0.4), y: invite.y + 4, h: fh, face: -0.15 };

    let ew = Math.min(W * 0.88, 420);
    let eh = ew * 0.72;
    if (eh > uh * 0.42) {
      eh = uh * 0.42;
      ew = eh / 0.72;
    }

    return {
      W,
      H,
      portrait,
      compact,
      safe,
      horizon: top + uh * 0.5,
      char,
      charFinal,
      arch: { x: char.x, y: char.y + ch * 0.02, w: ch * 1.3, h: ch * 1.42 },
      garland: { x0: W * 0.02, x1: W * 0.98, y0: top + HUD_H - 4, sag: uh * 0.035, photoW },
      envelope: { x: W / 2, y: top + uh * 0.46, w: ew, h: eh },
      invite,
      inviteMaxH,
      bubble: { mode: 'top', x: W / 2, y: char.y - ch * 1.07 - 10, maxW: Math.min(W - 28, 360) },
    };
  }

  // ---- màn hình ngang (laptop, tablet ngang, điện thoại xoay ngang) ----
  const inviteMaxH = Math.min(uh - 16 - BOTTOM_GAP, 640);
  const ih = Math.min(Math.max(inviteH, uh * (compact ? 0.86 : 0.69)), inviteMaxH);
  const iy = Math.min(top + (uh - ih) / 2, bottom - BOTTOM_GAP - ih);
  const invite: Rect = { x: W - iw - Math.max(W * 0.04, 16 + safe.right), y: iy, w: iw, h: ih };
  const leftW = invite.x - W * 0.02;

  const ch = compact ? uh * 0.48 : clamp(uh * 0.45, 140, 460);
  const char: Anchor = { x: safe.left * 0.5 + leftW * 0.5, y: bottom - uh * (compact ? 0.05 : 0.09), h: ch, face: 0.32 };

  const x0 = Math.max(W * 0.025, safe.left + 8);
  const x1 = leftW - W * 0.01;
  const y0 = top + 10;
  const sag = uh * 0.05;
  // ảnh không được che băng rôn trên cổng hoa
  const bannerTop = char.y - ch * 1.2;
  const photoW = clamp(Math.min(((x1 - x0) / N) * 0.92, (bannerTop - 12 - y0 - sag) / 1.45), 50, 200);

  let eh = Math.min(uh * 0.52, 380);
  let ew = eh / 0.68;
  if (ew > W * 0.55) {
    ew = W * 0.55;
    eh = ew * 0.68;
  }
  return {
    W,
    H,
    portrait,
    compact,
    safe,
    horizon: top + uh * 0.6,
    char,
    charFinal: { ...char },
    arch: { x: char.x, y: char.y + ch * 0.02, w: ch * 1.25, h: ch * 1.4 },
    garland: { x0, x1, y0, sag, photoW },
    envelope: { x: W / 2, y: top + uh * 0.46, w: ew, h: eh },
    invite,
    inviteMaxH,
    bubble: {
      mode: 'side',
      x: char.x + ch * 0.26,
      y: char.y - ch * 0.7,
      maxW: Math.max(200, Math.min(380, W - (char.x + ch * 0.26) - 24)),
    },
  };
}
