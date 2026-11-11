const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const VN_OFFSET_MS = 7 * 3600 * 1000;

/** Các thành phần ngày giờ theo giờ Việt Nam, không phụ thuộc múi giờ máy khách */
export function vnParts(iso: string) {
  const d = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    weekday: WEEKDAYS[d.getUTCDay()],
    day: pad(d.getUTCDate()),
    month: pad(d.getUTCMonth() + 1),
    year: String(d.getUTCFullYear()),
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

export function countdown(iso: string, now = Date.now()) {
  let ms = Math.max(0, new Date(iso).getTime() - now);
  const days = Math.floor(ms / 86400000);
  ms -= days * 86400000;
  const hours = Math.floor(ms / 3600000);
  ms -= hours * 3600000;
  const minutes = Math.floor(ms / 60000);
  ms -= minutes * 60000;
  const seconds = Math.floor(ms / 1000);
  return { days, hours, minutes, seconds, done: new Date(iso).getTime() <= now };
}
