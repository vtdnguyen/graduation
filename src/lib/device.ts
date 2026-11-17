export type Tier = 'high' | 'mid' | 'low';

export interface DeviceInfo {
  ua: string;
  ios: boolean;
  android: boolean;
  /** Trình duyệt nhúng trong app (Messenger, Facebook, Zalo, Instagram, TikTok...) */
  inApp: boolean;
  inAppName: string | null;
  touch: boolean;
  reducedMotion: boolean;
  webgl: boolean;
  tier: Tier;
  dpr: number;
}

const params = new URLSearchParams(location.search);

function detectInApp(ua: string): string | null {
  if (/Zalo/i.test(ua)) return 'Zalo';
  if (/Messenger|FB_IAB\/MESSENGER|MessengerForiOS|MessengerLite/i.test(ua)) return 'Messenger';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) return 'TikTok';
  if (/Line\//i.test(ua)) return 'Line';
  return null;
}

export function detectDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const inAppName = detectInApp(ua);
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('reduced');
  // Không tạo WebGL context để "thử" (tốn thời gian lúc tải) — nếu 3D lỗi thì main.ts tự chuyển sang bản 2D
  const webgl = !params.has('no3d');

  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  let tier: Tier = mem <= 1 ? 'low' : mem <= 2 || cores <= 4 ? 'mid' : 'high';
  const forced = params.get('tier');
  if (forced === 'high' || forced === 'mid' || forced === 'low') tier = forced;

  return {
    ua,
    ios,
    android,
    inApp: !!inAppName,
    inAppName,
    touch,
    reducedMotion,
    webgl: webgl && tier !== 'low',
    tier,
    // Canvas nhân vật có giới hạn điểm ảnh riêng; màn Retina cần đủ mật độ
    // kể cả khi thiếu thông tin RAM/CPU và bị xếp tier mid.
    dpr: Math.min(window.devicePixelRatio || 1, touch && tier !== 'low' ? 3 : tier === 'high' ? 2 : 1.5),
  };
}

/** Tên khách mời từ link: ?to=Minh%20Anh */
export function guestName(): string {
  const raw = params.get('to') ?? params.get('guest') ?? '';
  return raw.normalize('NFC').replace(/[<>]/g, '').trim().slice(0, 40);
}

export const flags = {
  skip: params.has('skip'),
  debug: params.has('debug'),
  og: params.has('og'),
};
