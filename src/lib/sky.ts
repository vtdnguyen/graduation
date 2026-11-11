/**
 * Bầu trời theo giờ thực của người xem: ngày / chiều tà / đêm, và lời chào theo buổi.
 * Thử nhanh bằng ?sky=day|sunset|night
 */
export type Mood = 'day' | 'sunset' | 'night';

const params = new URLSearchParams(location.search);
const forced = params.get('sky');

/** giờ dùng để tính (giờ máy người xem; nếu ép ?sky thì lấy giờ đại diện) */
function hourNow(): number {
  if (forced === 'day') return 10;
  if (forced === 'sunset') return 17;
  if (forced === 'night') return 21;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

export function currentMood(): Mood {
  const h = hourNow();
  if (h >= 16 && h < 18.5) return 'sunset';
  if (h >= 18.5 || h < 5) return 'night';
  return 'day';
}

/** "Chào buổi sáng" / "Chào buổi trưa" / ... — dùng trong câu thoại đầu tiên */
export function timeGreeting(): string {
  const h = hourNow();
  if (h >= 4 && h < 11) return 'Chào buổi sáng';
  if (h >= 11 && h < 13) return 'Chào buổi trưa';
  if (h >= 13 && h < 18) return 'Chào buổi chiều';
  if (h >= 18 && h < 23) return 'Chào buổi tối';
  return 'Khuya rồi nè, chào';
}

/** Đếm số lần ghé thăm (mỗi phiên tính 1 lần) → true nếu khách đã từng mở thiệp trước đây */
export function isReturningVisitor(): boolean {
  try {
    if (!sessionStorage.getItem('grad-counted')) {
      sessionStorage.setItem('grad-counted', '1');
      localStorage.setItem('grad-visits', String(Number(localStorage.getItem('grad-visits') || '0') + 1));
    }
    return Number(localStorage.getItem('grad-visits') || '0') >= 2;
  } catch {
    return false;
  }
}
