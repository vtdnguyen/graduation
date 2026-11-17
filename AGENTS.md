# Thiệp mời tốt nghiệp — vtdnguyen.com/grad

Website 1 trang mời dự lễ tốt nghiệp của **Vũ Trần Duy Nguyên** (tên hiển thị: **Nguyên**; Khoa học Máy tính, ĐH Bách Khoa – ĐHQG-HCM),
**12:00 Thứ Bảy 28/11/2026**. Chủ đề "khu vườn": cây phượng, hoa, bướm, cổng hoa, nhân vật chibi 3D vẫy tay.
Giao tiếp với chủ dự án bằng **tiếng Việt**.

## Kịch bản
1. **Intro** — phong thư lớn (hồng, dấu sáp xanh có mũ cử nhân) giữa màn hình: phát sáng, lắc nhẹ định kỳ, tim bay lên,
   lấp lánh, vệt ánh kim. Chữ: "Thư mời tốt nghiệp" / "Gửi <khách>" / "từ Nguyên · 28.11.2026" + nút "Chạm/Nhấn để mở thư".
2. **Opening** (chạm) — dấu sáp bật → nắp thư lật mở (3D) → lá thư trượt lên phát sáng → bung cánh hoa → vườn nở
   → 6 ảnh polaroid bay lên dây đèn → nhân vật nhảy ra từ phong thư, đáp xuống cổng hoa. Nhạc + gió/cỏ/chim bắt đầu tại lần chạm này.
3. **Dialogue** — bong bóng thoại gõ chữ 4 câu (chạm để qua câu, tự chuyển).
4. **Final** — thiệp mời động (tên khách, "Nguyên", ngành, giờ, đếm ngược, địa điểm). Nút xem lại (icon) ở góc trên phải, cạnh nút âm lượng (hiện ở cảnh cuối, thay chỗ nút "Bỏ qua").
   Màn dọc: nhân vật nhảy lên đứng trên mép thiệp. Nút "Bỏ qua" nhảy thẳng tới đây.

**Tương tác**: chỉ với nhân vật (chạm → nhảy / tung hô + chùm tim; laptop: nhân vật nhìn theo con trỏ). Ở cảnh cuối, chạm nhân vật
còn hiện câu nói ngắn theo động tác (`config.quips`: jump/cheer, không lặp câu liền nhau). Chạm nhân vật chỉ còn 2 phản ứng: nhảy tại chỗ hoặc tung hô + tung mũ (đã bỏ vẫy tay) — [src/scenes/quip.ts](src/scenes/quip.ts).
Nhóm câu nào bị comment/bỏ trống thì động tác đó không kèm câu nói. Gợi ý `config.tapHint`: hiện khi nhân vật nằm xuống lần đầu mà khách chưa bấm nhân vật,
nhớ bằng `sessionStorage` nên không nhắc lại kể cả khi bấm xem lại (tab mới thì hiện lại).
**Nằm nghỉ** (cảnh cuối): ~8 giây không ai bấm (`REST_AFTER` trong main.ts) → vươn vai ngáp → tay trái lấy mũ → nằm nghiêng (mặt vẫn hướng ra, tay phải gối đầu,
tay trái ôm mũ trên bụng, chân đung đưa, mắt lim dim). Bấm vào lúc đang nằm / đang nằm xuống dở → ngồi dậy (đội lại mũ) xong mới
nhảy / tung mũ, rồi đếm lại 6 giây. Gợi ý `config.tapHint` hiện khi nằm xuống lần đầu (1 lần/phiên).
Hoa, cây, bướm chỉ chuyển động, không nhận chạm. Ảnh polaroid bấm để xem lớn **chỉ sau khi đã treo lên dây** (class `.photos.ready`);
nhân vật đứng đè lên ảnh thì ưu tiên nhân vật (chặn click ảnh trong 600ms sau khi chạm nhân vật).

## Lệnh
| Lệnh | Việc |
|---|---|
| `npm run dev` | dev server → http://localhost:5173/grad/ (có `--host` để mở từ điện thoại cùng Wi-Fi) |
| `npm run build` | typecheck + build ra `dist/` (deploy nội dung `dist/` vào đường dẫn `/grad/`) |
| `npm run preview` | chạy thử bản build → http://localhost:4173/grad/ |
| `npm run deploy` | build → chép `dist/` vào `.deploy/grad/` → `wrangler deploy` lên https://vtdnguyen.com/grad/ |
| `npm run shots -- [--only iphone,android,se,landscape,laptop,desktop] [--flow full\|final\|intro] [--browser webkit] [--url ...] [--query no3d]` | chụp màn hình kiểm thử vào `shots/` (Playwright, UA giả lập Messenger iOS / Zalo Android) |
| `npm run og` | tạo `public/og-image.jpg` (ảnh xem trước khi gửi link). Cần dev server đang chạy (hoặc `-- --url http://localhost:4173/grad/`). **Chạy lại mỗi khi đổi nội dung, rồi build lại.** |
| `npm run links` | đọc `guests.txt` (mỗi dòng 1 tên) → `links.txt` chứa link `?to=<tên>` cho từng khách |
| `npm run gen:audio` | tổng hợp lại toàn bộ âm thanh vào `public/audio/` + `src/generated/audio-loops.json` |
| `npx tsc --noEmit` | typecheck |

Tham số URL để thử: `?skip` (tới cảnh cuối), `?to=Tên` (cá nhân hoá), `?no3d` (ép nhân vật 2D),
`?tier=low|mid|high`, `?reduced` (giảm chuyển động), `?og`, `?debug`.

## Sửa nội dung
- **Mọi chữ, ngày giờ, địa điểm, lời thoại, chữ trên phong thư**: [src/config.ts](src/config.ts). Thẻ meta OG trong index.html cũng lấy từ đây (plugin `htmlMeta` trong vite.config.ts).
- **Ảnh**: bỏ JPG/PNG/WebP vào [photos/](photos/) — thứ tự & chú thích theo tên file (`01 - Ngày đầu nhập học.jpg`). Plugin [vite-plugins/photos.ts](vite-plugins/photos.ts) tự xoay EXIF, resize, nén WebP vào `public/_photos/` (gitignored). Rỗng → 6 ảnh minh hoạ tạm. HEIC không hỗ trợ.
- **Nhạc nền**: thay `public/audio/bgm.mp3` (giữ tên) và sửa `src/generated/audio-loops.json` → `bgm: { "start": 0, "duration": <độ dài ms> }`.
- Nhân vật: chủ dự án quyết định **dùng chibi dựng bằng code** ([src/character/chibi.ts](src/character/chibi.ts)), không dùng mô hình .glb (đã gỡ code nạp glb).

## Font
- Giao diện (bong bóng thoại, nút, polaroid): Be Vietnam Pro, Baloo 2 (băng rôn), Dancing Script (chú thích ảnh).
- **Lá thư / thiệp mời / phong thư**: Playfair Display (tiêu đề, giờ, số), **Great Vibes** (tên "Nguyên", tên khách), Lora (nội dung). Tất cả qua Fontsource, chỉ subset latin + vietnamese.

## Kiến trúc
- Vite 8 + TypeScript thuần (không framework) · GSAP (MotionPath, DrawSVG) · three.js (tải động, chunk riêng ~138 KB gz). Không dùng thư viện âm thanh/confetti (xem "Hiệu năng").
- [src/main.ts](src/main.ts): điều phối state `intro → opening → dialogue → final`, một vòng `gsap.ticker` duy nhất cho nhân vật/hạt/bướm. `runId` để huỷ kịch bản khi bấm Bỏ qua.
- [src/lib/layout.ts](src/lib/layout.ts): **mọi vị trí tính từ kích thước khung nhìn thật** (dọc `W/H < 0.9` / ngang / ngang-thấp `compact`), có safe-area. Thiệp mời cao vừa nội dung: `invite.measure()` đo DOM → `computeLayout(..., inviteH)`; thiệp cách cạnh dưới 12px. Đừng hard-code vị trí trong CSS.
- Thiệp mời có 2 mức gọn: `.compact` (màn dọc hoặc cao < 700px) và `.tight` (cao < 600px: iPhone SE, điện thoại xoay ngang).
- Thứ tự lớp (dưới→trên): garden-back → intro-backdrop → phong thư → photos → actor (canvas 3D) → garden-front → butterflies → fx canvas (cánh hoa + chùm bung) → bubble → invite → lightbox/HUD (fixed).
- Nhân vật: interface `Actor` ([src/character/actor.ts](src/character/actor.ts)); `Stage3D` + `buildChibi()`; dự phòng `Actor2D` (SVG) khi tạo WebGL lỗi / mất context / quá 6 s.
- Âm thanh ([src/lib/audio.ts](src/lib/audio.ts)): Web Audio tự viết. Nhạc nền & không khí lặp theo vùng `[start, start+duration]` trong `src/generated/audio-loops.json` (file loop có 0,3 s đệm hai đầu nên lặp liền mạch dù MP3 có khoảng đệm). `audio.start()` chỉ gọi trong handler chạm; iPhone phát kèm `silence.mp3` bằng HTML5 + `navigator.audioSession.type='playback'` để vẫn có tiếng khi gạt im lặng. Ẩn tab → `ctx.suspend()`.

## Hiệu năng (đã tối ưu — giữ nguyên các nguyên tắc này)
- **Chỉ animate `transform`/`opacity`** (chạy trên compositor). Không `backdrop-filter`, không animate `box-shadow`/`background-position`/`filter`, không animate thuộc tính của phần tử con bên trong SVG (bóng đèn dây ảnh, cánh bướm, tia nắng đều là lớp HTML riêng).
- Vườn nở bằng **CSS animation** qua class `g-dormant → g-bloom → g-done` (không dùng GSAP cho ~50 bông hoa). Lúc "ngủ" các animation đung đưa bị pause.
- Canvas 3D **không phủ cả màn hình**: khung cỡ `1.6h × 1.95h` bám theo nhân vật, `camera.setViewOffset` vẽ đúng phần đó (ít điểm ảnh hơn 4–8 lần). Shader biên dịch + đẩy hình khối lên GPU trước (`init()`), tạo 3D **sau khung hình đầu** để phong thư hiện ngay.
- Một canvas 2D duy nhất ([src/fx/petals.ts](src/fx/petals.ts)) cho cánh hoa rơi, đốm sáng và mọi chùm bung (thay canvas-confetti), vẽ ở 1x.
- Parallax chuột chỉ bật sau khi mở thư.
- Đã gỡ **Howler** (dò codec ~1 s lúc tải trên Windows) và **canvas-confetti** (khởi tạo OffscreenCanvas ~1 s); không tạo WebGL context để "thử".
- Đo trên Chromium headless (render bằng CPU, 1366×768 @1.5x): màn phong thư 60fps ổn định, lúc mở thư 0 long task.

## Hosting
- **Live: https://vtdnguyen.com/grad/** — Cloudflare Workers (static assets), Worker `vtdnguyen-grad`, tài khoản Cloudflare vtdnguyen.work@gmail.com.
- [wrangler.jsonc](wrangler.jsonc): route `vtdnguyen.com/grad*` (zone vtdnguyen.com, DNS ở Cloudflare, proxied) → chỉ /grad do Worker phục vụ, phần còn lại của domain không đổi. `html_handling: auto-trailing-slash` → `/grad` 307 về `/grad/`.
- [scripts/prepare-deploy.mjs](scripts/prepare-deploy.mjs) chép build vào `.deploy/grad/` + `_headers` (assets hash cache 1 năm, audio 7 ngày).
- Trang gốc vtdnguyen.com đang lỗi 522 (máy chủ gốc không phản hồi) — không liên quan tới /grad.
- Sau khi đổi nội dung: `npm run og` (cần dev server) → `npm run deploy` → làm mới ảnh xem trước ở Facebook Sharing Debugger.

## Hoạt cảnh nằm nghỉ (chibi.ts)
- 3 tham số liên tục 0..1 tween bằng GSAP: `R.yawn` (vươn vai), `R.p` (mức nằm), `R.cap` (mũ: đầu → tay → bụng). Mọi tư thế suy ra từ
  3 số này mỗi khung (blend YAWN / tư thế nằm / REACH lên các khớp, rồi làm mượt) → ngắt ở bất kỳ đâu cũng chạy ngược mượt.
- Nằm = `lieGroup` xoay quanh trục nhìn (`LIE_ANGLE`), nâng theo các điểm chạm đất (`CONTACTS`) để không lún, trượt về giữa chỗ đứng.
- Mũ là con của `body`, vị trí tính mỗi khung (`placeCap`): nội suy đầu ↔ bụng, giữa chừng bám bàn tay trái.
- `getUp()` chạy ngược từ trạng thái hiện tại; kết thúc bằng nhún mềm (`settleT`, không ép giá trị tức thời — từng gây khựng).
- Điều phối ở main.ts: `armRest()` (hẹn 6s), `tapActor()` (đang nằm → `getUp()` rồi `react()`; bấm dồn lúc đang dậy chỉ thả tim).
- Vùng bấm (`hit`), bóng đổ, hướng mặt, vị trí bong bóng (`headBox()` chiếu tâm đầu 3D ra màn hình) đều theo mức nằm.
- Test tất định: `node scripts/test-rest.mjs` (dùng `?debug` → `__manualTime()` + `__step(ms)` bước đúng 60fps) — bấm ngắt ở 5 giai đoạn,
  báo "giật" nếu 1 khung dịch > 2.5× lân cận, kiểm tra không nhảy khi còn nằm.

## Lưu ý đã gặp
- Bấm "Bỏ qua" giữa lúc nhân vật đang nhảy → cú nhảy cũ chạy tiếp, kéo nhân vật về đích cũ (sau thiệp mời, bị che).
  Sửa: `BaseActor.place()` / `jumpTo()` huỷ cú nhảy đang chạy (`cancelJump`, `jumpId`). Test: `node scripts/test-skip.mjs`.
- iOS Safari: `#app` (fixed, inset 0) chỉ cao bằng vùng nhìn thấy → không tràn dưới thanh điều khiển / vùng trên như trang thường.
  Sửa: class `html.ios-edge` cho `#app` cao `100lvh`; main.ts đo `.svh-probe` (100svh), phần chênh lệch được cộng vào `safe.bottom`
  → khu vườn phủ cả màn hình, còn nhân vật/thiệp/nút vẫn trong vùng nhìn thấy. Nền `html` là trời/cỏ phòng khi còn hở.
- Phần tử ẩn bằng `opacity: 0` vẫn nhận click → ảnh polaroid (lớp trên phong thư) từng mở được lightbox khi thư chưa mở; nay `.pol` mặc định `pointer-events: none`.
- Phần tử ẩn bằng `autoAlpha` trên con nhưng cha có `pointer-events: auto` vẫn chặn chạm → `.bubble` để `pointer-events: none`, chỉ `.bubble-box` nhận chạm.
- CSS animation thắng inline style của GSAP → dùng wrapper riêng (vd. `.tree` parallax / `.tree-in` mọc / `.tree-sway` đung đưa), hoặc pause bằng `.opening`.
- Nắp thư: `.env-flap` có preserve-3d + 2 mặt backface-hidden; quá 90° thì thêm class `.behind` (z-index dưới lá thư).
- Ký tự `&` trong SVG data-URI phải escape. Emoji cuối câu thoại được nối bằng NBSP để không rớt dòng.
- `og:image` phải là URL tuyệt đối https; Messenger cache ảnh xem trước → dùng Facebook Sharing Debugger để làm mới sau khi deploy.

## Trạng thái
- **Hộp lời chúc**: `src/scenes/wishes.ts` + `src/styles/wishes.css`; nội dung tại `config.wishes`. Nút gửi thay câu cuối thiệp, nút xem ở HUD. Tên mặc định từ `?to=`, sửa bằng icon bút. Gửi thành công mới gói thư → xoay/bay → `Actor.bow()` và cảm ơn. Lời chúc công khai với khách xem thiệp.
- **Lưu lời chúc**: `server/worker.ts`, API `/grad/api/wishes` (GET phân trang, POST chống trùng khi retry), D1 binding `WISHES_DB`, migration `migrations/0001_wishes.sql`. Dev: `npm run db:local`, `npm run dev:api` (8787) cùng `npm run dev` (Vite proxy API). `npm run db:remote` áp dụng migration trên Cloudflare. Test: `npm run test:wishes` (cần hai dev server; chỉ ghi D1 cục bộ). `node scripts/test-wishes.mjs` thêm ảnh kiểm thử vào `shots/`.
- [x] Khu vườn, phong thư mở đầu, ảnh polaroid + lightbox, nhân vật chibi 3D (+ bản 2D), thoại, thiệp mời, đếm ngược, HUD + nút xem lại
- [x] Âm thanh tổng hợp (nhạc kalimba/ukulele, gió, cỏ, chim, SFX)
- [x] Tối ưu hiệu năng (xem mục trên); tinh chỉnh chibi (mắt, viền sáng, cổ áo, viền tay áo, nhìn theo chuột)
- [x] Bố cục kiểm thử: laptop 1366×768, iPhone/Messenger 390×664, iPhone SE/Messenger 375×560, Android/Zalo 360×640, ngang 844×390; Chromium + WebKit
- [x] OG image, script link cá nhân hoá, build production
- [ ] **Xác nhận địa điểm, địa chỉ** (đang tạm: ĐH Bách Khoa, 268 Lý Thường Kiệt) → `config.event`
- [x] Ảnh thật vào `photos/`
- [x] Deploy lên https://vtdnguyen.com/grad/ (Cloudflare Workers)
- [ ] Thử trên máy thật: Messenger iOS/Android, Zalo, Facebook in-app; kiểm tra ảnh xem trước link

Xóa lời nhắn thử: `node scripts/clear-wishes.mjs --remote --name "Tên"` xem trước; thêm `--yes` để xóa theo tên chính xác. Bỏ `--name` chọn toàn bộ; dùng `--local` cho dữ liệu dev. Nút xem lại đã được gỡ.
