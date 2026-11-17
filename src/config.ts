/**
 * ★ TOÀN BỘ NỘI DUNG CỦA THIỆP NẰM Ở ĐÂY ★
 * Sửa file này để đổi tên, thời gian, địa điểm, lời thoại... không cần đụng code khác.
 */

export const config = {
  /** URL công khai của trang (dùng cho link cá nhân hoá, ảnh xem trước khi gửi link) */
  siteUrl: 'https://vtdnguyen.com/grad/',

  graduate: {
    fullName: 'Vũ Trần Duy Nguyên',
    /** Tên hiển thị trên phong thư, thiệp mời và lời thoại */
    shortName: 'Duy Nguyên',
    major: 'Khoa học Máy tính',
    school: 'Trường Đại học Bách Khoa',
    schoolShort: 'Bách Khoa',
  },

  event: {
    title: 'Lễ Tốt Nghiệp',
    /** Giờ Việt Nam (+07:00) */
    start: '2026-11-28T12:00:00+07:00',
    /** TODO: xác nhận địa điểm & địa chỉ chính xác */
    venue: 'Trường Đại học Bách Khoa',
    address: '268 Lý Thường Kiệt, TP. Hồ Chí Minh',
  },

  /** Chữ trên phong thư ở màn hình đầu */
  envelope: {
    kicker: 'Thư mời tốt nghiệp',
    to: 'Gửi',
    toFallback: 'bạn thân mến',
    from: 'từ',
  },

  /**
   * Lời thoại của nhân vật. `guest` là tên khách lấy từ link (?to=...), có thể rỗng.
   * `ctx.greeting` = lời chào theo giờ của người xem ("Chào buổi sáng", "Chào buổi tối"...),
   * `ctx.returning` = khách đã từng mở thiệp trước đây. Dùng **chữ đậm** để làm nổi bật.
   */
  dialogue(guest: string, ctx: { greeting: string; returning: boolean }): string[] {
    return [
      ctx.returning
        ? `Ơ, ${guest ? `**${guest}**` : 'bạn'} quay lại nè! Vui ghê 🥰`
        : `${ctx.greeting}${guest ? ` **${guest}**` : ''}! Mình là **Nguyên** đây 👋`,
      'Sau bao năm miệt mài ở **Bách Khoa**, cuối cùng mình đã **tốt nghiệp** rồi! 🎓',
      `Mình rất mong được chia sẻ niềm vui này cùng ${guest ? `**${guest}**` : 'bạn'}…`,
      'Đến dự lễ tốt nghiệp của mình nhé! 💐',
    ];
  },

  /** Câu nói khi bấm vào nhân vật (sau khi thiệp mời đã hiện), theo động tác */
  /** Gợi ý chỉ hiện 1 lần nếu 3 giây sau khi thiệp mời hiện mà khách chưa bấm vào nhân vật */
  tapHint: 'Bấm vào mình thử nè 🤭',
  quips: {
    jump: ['Hế lô, gì đấy? 😆', 'Ui nhột 🤭'],
    cheer: ['Hurayyy! 🎓', 'Tốt nghiệp nè! 🎉', 'Yeahhh! 🥳'],
    /** bấm dồn 5 lần → nhân vật xoay vòng chóng mặt */
    dizzy: ['Chóng mặt quá 😵‍💫', 'Bấm gì mà bấm dữ vậy 😵', 'Xoay mòng mòng luôn 🌀'],
  },

  invite: {
    greeting: 'Thân mời',
    guestFallback: 'bạn',
    lead: 'đến chung vui trong ngày',
  },

  wishes: {
    send: 'Gửi lời nhắn',
    inbox: 'Hộp lời chúc',
    title: 'Một lời chúc nhỏ',
    from: 'Từ',
    name: 'Tên của bạn',
    editName: 'Sửa tên',
    message: 'Lời chúc của bạn',
    placeholder: 'Nguyên ơi, chúc bạn…',
    privacy: 'Lời chúc sẽ xuất hiện trong hộp lời chúc chung 💌',
    submit: 'Gửi đến Nguyên',
    sending: 'Đang gửi lời chúc…',
    packing: 'Gói lại',
    sent: 'Bay đii',
    close: 'Đóng',
    loading: 'Đang mở những lá thư…',
    empty: 'Hộp thư đang chờ lời chúc đầu tiên. Bạn mở hàng nhé?',
    more: 'Xem thêm lời chúc',
    retry: 'Thử lại',
    loadError: 'Chưa mở được hộp thư. Bạn thử lại nhé!',
    sendError: 'Thư chưa gửi được. Lời chúc vẫn ở đây, bạn thử lại nhé!',
    slowDown: 'Thư trước vừa bay đi rồi. Bạn đợi một chút rồi gửi tiếp nhé!',
    nameRequired: 'Bạn cho Nguyên biết tên nhé!',
    messageRequired: 'Bạn viết một lời chúc nhỏ nhé!',
    thanks: (name: string) => `Cảm ơn ${name} nhé!`,
  },

  /** Ảnh minh hoạ tạm dùng khi thư mục photos/ còn trống */
  placeholderCaptions: [
    'Ngày đầu nhập học',
    'Những đêm chạy deadline',
    'Bạn bè thân thương',
    'Hoạt động & CLB',
    'Bảo vệ luận văn',
    'Ngày tốt nghiệp',
  ],

  audio: {
    bgmVolume: 0.42,
    ambienceVolume: 0.5,
    sfxVolume: 0.7,
  },
};

export type Config = typeof config;
