/**
 * Điều phối toàn bộ kịch bản:
 *   intro (phong thư) → opening (dấu sáp bật, nắp mở, lá thư trượt lên, ảnh bay, vườn nở,
 *   nhân vật nhảy ra) → dialogue (bong bóng thoại) → final (thiệp mời động)
 */
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/vietnamese-600.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/baloo-2/vietnamese-800.css';
import '@fontsource/dancing-script/latin-700.css';
import '@fontsource/dancing-script/vietnamese-700.css';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
// font của lá thư / thiệp mời
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/vietnamese-700.css';
import '@fontsource/playfair-display/latin-600-italic.css';
import '@fontsource/playfair-display/vietnamese-600-italic.css';
import '@fontsource/great-vibes/latin-400.css';
import '@fontsource/great-vibes/vietnamese-400.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/vietnamese-400.css';
import '@fontsource/lora/latin-400-italic.css';
import '@fontsource/lora/vietnamese-400-italic.css';
import '@fontsource/lora/latin-500.css';
import '@fontsource/lora/vietnamese-500.css';
import './styles/main.css';
import './styles/wishes.css';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import photoList from 'virtual:photos';

import { config } from './config';
import { detectDevice, flags, guestName } from './lib/device';
import { computeLayout, inviteWidth, isPortrait, readSafeArea, type Layout } from './lib/layout';
import { audio } from './lib/audio';
import { haptic, sleep } from './lib/util';
import { isReturningVisitor, timeGreeting, type Mood } from './lib/sky';
import { vnParts } from './lib/date';
import { symbolSprite, placeholderPhoto } from './art/svg';
import { Garden } from './scenes/garden';
import { Envelope } from './scenes/envelope';
import { Photos, type PhotoData } from './scenes/photos';
import { Lightbox } from './scenes/lightbox';
import { Dialogue } from './scenes/dialogue';
import { Invite } from './scenes/invite';
import { Hud } from './scenes/hud';
import { Quip } from './scenes/quip';
import { Wishes } from './scenes/wishes';
import { Petals } from './fx/petals';
import { GardenInsects } from './fx/garden-insects';
import type { Actor } from './character/actor';

gsap.registerPlugin(MotionPathPlugin, DrawSVGPlugin);

type State = 'intro' | 'opening' | 'dialogue' | 'final';

const device = detectDevice();
const guest = guestName();
// Mặc định là ban ngày; ?sky=night|sunset vẫn dùng được để kiểm thử.
const requestedMood = new URLSearchParams(location.search).get('sky');
let mood: Mood = flags.og ? 'day' : requestedMood === 'night' || requestedMood === 'sunset' ? requestedMood : 'day';
const returning = isReturningVisitor();
function updateThemeColor() {
  // Safari có thể dùng theme-color cho cả thanh dưới, tạo dải xanh trời dưới vườn.
  // Để Safari tự lấy màu từ nội dung ở từng mép màn hình.
  if (device.ios) {
    document.querySelector('meta[name="theme-color"]')?.remove();
    return;
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', { day: '#8fd3ff', sunset: '#6d78c4', night: '#1d2457' }[mood]);
}
updateThemeColor();
const app = document.getElementById('app')!;
document.documentElement.classList.toggle('touch', device.touch);
document.documentElement.classList.toggle('reduced', device.reducedMotion);
// iPhone/iPad: cho khu vườn tràn xuống dưới thanh điều khiển & lên vùng trên cùng của Safari (như các trang khác)
document.documentElement.classList.toggle('ios-edge', device.ios);
if (device.inApp) document.documentElement.dataset.inapp = device.inAppName ?? '';
document.body.insertAdjacentHTML('afterbegin', symbolSprite());

const photos: PhotoData[] = photoList.length
  ? photoList
  : config.placeholderCaptions.map((caption, i) => {
      const src = placeholderPhoto(i, caption);
      return { thumb: src, full: src, caption, ratio: 0.8 };
    });

// ---------- dựng các lớp theo thứ tự chồng ----------
const host = () => {
  const h = document.createElement('div');
  h.className = 'host';
  return h;
};
const gardenHost = host();
const introBackHost = host();
const introHost = host();
const photosHost = host();
const frontHost = host();
const insectHost = host();
const actorLayer = document.createElement('div');
actorLayer.className = 'layer actor-layer';
const stageCanvas = document.createElement('canvas');
stageCanvas.className = 'stage3d';
actorLayer.append(stageCanvas);
const fxCanvas = document.createElement('canvas');
fxCanvas.className = 'layer fx';
app.append(gardenHost, introBackHost, introHost, photosHost, actorLayer, frontHost, insectHost, fxCanvas);

const date = vnParts(config.event.start);
const garden = new Garden(gardenHost, frontHost, 'Chúc Mừng Tốt Nghiệp');
garden.setMood(mood);
const envelope = new Envelope(introBackHost, introHost, {
  kicker: config.envelope.kicker,
  toLabel: config.envelope.to,
  to: guest || config.envelope.toFallback,
  fromLabel: config.envelope.from,
  name: config.graduate.shortName,
  date: `${date.day} . ${date.month} . ${date.year}`,
  touch: device.touch,
});
const lightbox = new Lightbox(document.body, photos);
const photoWall = new Photos(photosHost, photos, (i, from) => lightbox.show(i, from));
const gardenInsects = new GardenInsects(insectHost, device.tier === 'high' ? 6 : device.tier === 'mid' ? 4 : 3);
gardenInsects.setMood(mood);
const petals = new Petals(fxCanvas, device.tier, device.reducedMotion);
petals.setMood(mood);
audio.night = mood === 'night';
let gardenInsectsStarted = false;
const dialogue = new Dialogue(app);
const invite = new Invite(app, config, guest, () => wishes.compose());
const quip = new Quip(app, config.quips);
const wishes = new Wishes(guest, device.reducedMotion,
  () => { clearTimeout(restTimer); quip.hide(); },
  () => { onResize(); armRest(); },
  (name) => thankGuest(name),
);
const hud = new Hud(
  document.body,
  () => skipToFinal(),
  () => void saveKeepsake(),
  (night) => setMood(night ? 'night' : 'day'),
  mood === 'night',
  () => wishes.inbox(),
);

// ---------- lưu thiệp về máy (module tải khi bấm) ----------
let keepsakeView: import('./scenes/keepsake').KeepsakeView | null = null;
async function saveKeepsake() {
  audio.play('tap', { volume: 0.5 });
  const mod = await import('./scenes/keepsake');
  keepsakeView ??= new mod.KeepsakeView(device.touch);
  keepsakeView.showLoading();
  const snap = actor ? await actor.snapshot().catch(() => null) : null;
  const canvas = await mod.renderKeepsake({ cfg: config, guest, mood, snap });
  const slug = (guest || 'ban')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase();
  await keepsakeView.showCanvas(canvas, `thiep-tot-nghiep-${slug}.jpg`);
  audio.play('chime', { volume: 0.5 });
}

let L: Layout;
let state: State = 'intro';
let master: gsap.core.Timeline | null = null;
let runId = 0;
let actor: Actor | null = null;

function setMood(next: 'day' | 'night') {
  if (mood === next) return;
  mood = next;
  garden.setMood(next);
  gardenInsects.setMood(next);
  petals.setMood(next);
  audio.night = next === 'night';
  actor?.setMood?.(next);
  updateThemeColor();
  relayout();
  if (state !== 'intro') enterGardenInsects(true);
}

function enterGardenInsects(instant = false) {
  if (gardenInsectsStarted) return;
  gardenInsectsStarted = true;
  gardenInsects.enter(instant);
}

// ---------- nhân vật: 3D nếu được, 2D nếu không ----------
async function make2D(): Promise<Actor> {
  const { Actor2D } = await import('./character/actor2d');
  const a = new Actor2D(actorLayer);
  stageCanvas.style.display = 'none';
  return a;
}

async function make3D(): Promise<Actor> {
  const { Stage3D } = await import('./character/stage3d');
  const s = new Stage3D(stageCanvas, {
    dpr: device.dpr,
    antialias: device.tier !== 'low',
    pixelBudget: device.touch ? 1_500_000 : 3_000_000,
    onContextLost: () => void swapTo2D(),
  });
  await s.init();
  return s;
}

async function swapTo2D() {
  if (!actor || actor.kind === '2d') return;
  const old = actor;
  const a = await make2D();
  a.place({ ...old.anchor });
  a.setVisible(true);
  a.setAction('idle');
  actor = a;
}

function adopt(a: Actor): Actor {
  if (!actor) {
    actor = a;
    a.resize(L.W, L.H, L.char.h);
    a.setMood?.(mood);
  }
  return actor;
}

// tạo nhân vật sau khung hình đầu tiên để phong thư hiện ra ngay
const afterFirstPaint = new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 60)));
const actorReady: Promise<Actor> = afterFirstPaint
  .then(() => (device.webgl ? make3D().catch((e) => (console.warn('[3d]', e), make2D())) : make2D()))
  .then(adopt);

/** chờ nhân vật tối đa maxMs, quá hạn thì dùng bản 2D */
async function waitActor(maxMs: number): Promise<Actor> {
  const a = await Promise.race([actorReady, sleep(maxMs).then(() => null)]);
  return a ?? actor ?? adopt(await make2D());
}

// ---------- bố cục ----------
// Cảnh cuối trên màn dọc: khung nhỏ theo nhân vật, cộng 25% cho tay/mũ
// và phối cảnh khi nhân vật đứng lệch sang phải thiệp.
function finalCanvasHeight() {
  return L.charFinal.h * (L.portrait ? 1.25 : 1);
}

function relayout() {
  if (device.ios) {
    // Chỉ mở rộng lớp vẽ, không dùng screen.height để đặt nút/thiệp.
    // Một số Safari báo large viewport vẫn ngắn hơn màn hình phía sau toolbar.
    const landscape = window.innerWidth > window.innerHeight;
    const screenW = landscape ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    const screenH = landscape ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
    const fullWidth = Math.abs(screenW - window.innerWidth) < 4;
    app.style.setProperty('--scene-screen-height', `${fullWidth ? screenH : window.innerHeight}px`);
    document.body.style.setProperty('--scene-screen-height', `${fullWidth ? screenH : window.innerHeight}px`);
  }
  const W = app.clientWidth;
  const H = app.clientHeight;
  const safe = readSafeArea();
  // Khung cảnh có thể cao hơn vùng nhìn thấy (iOS: tràn dưới thanh điều khiển). Phần bị thanh che
  // được tính như safe-area dưới → nhân vật, thiệp, nút luôn nằm trong vùng nhìn thấy.
  const viewport = window.visualViewport;
  const visibleTop = Math.max(0, (viewport?.offsetTop ?? 0) - app.getBoundingClientRect().top);
  const visibleH = Math.min(H - visibleTop, viewport?.height ?? window.innerHeight ?? H);
  safe.top += visibleTop;
  safe.bottom += Math.max(0, H - visibleTop - visibleH);
  document.documentElement.style.setProperty('--visible-top', `${viewport?.offsetTop ?? 0}px`);
  const ih = invite.measure(inviteWidth(W, H), visibleH, isPortrait(W, H));
  L = computeLayout(W, H, safe, photos.length, ih);
  document.documentElement.classList.toggle('portrait', L.portrait);
  garden.relayout(L);
  if (state === 'intro' || state === 'opening') envelope.relayout(L);
  photoWall.relayout(L);
  dialogue.relayout(L);
  invite.relayout(L);
  gardenInsects.resize(W, H);
  petals.resize(W, H);
  if (actor) {
    actor.resize(W, H, state === 'final' && !actor.busy ? finalCanvasHeight() : Math.max(L.char.h, finalCanvasHeight()));
    if (!actor.busy && state !== 'intro') actor.place(state === 'final' ? L.charFinal : L.char);
  }
}
let raf = 0;
const onResize = () => {
  if (wishes.isOpen) return;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(relayout);
};
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(relayout, 250));
window.visualViewport?.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('scroll', onResize);
// font tải xong làm đổi chiều cao chữ → đo lại thiệp mời
void document.fonts?.ready.then(onResize);

// ---------- vòng lặp khung hình duy nhất ----------
let clock = 0;
function frame(dt: number) {
  clock += dt;
  actor?.update(dt, clock);
  petals.update(dt, clock);
  gardenInsects.update(dt, clock);
  fpsWatch(dt);
}
const onTick = (_t: number, deltaMs: number) => frame(deltaMs / 1000);
gsap.ticker.add(onTick);

// tự giảm hiệu ứng nếu máy bị giật
let fpsAcc = 0;
let fpsN = 0;
let fpsArmed = false;
let fpsDone = false;
function fpsWatch(dt: number) {
  if (!fpsArmed || fpsDone) return;
  // Không đánh giá chất lượng từ tải shader, chuyển cảnh, tab ẩn hay bàn phím.
  if (state !== 'final' || document.hidden || wishes.isOpen || !actor || actor.busy || dt > 0.25) {
    fpsAcc = fpsN = 0;
    return;
  }
  fpsAcc += dt;
  fpsN++;
  if (fpsAcc > 4) {
    fpsDone = true;
    const avg = fpsAcc / fpsN;
    if (avg > 1 / 35) {
      petals.setDensity(0.5);
      const s = actor as unknown as { setPixelRatio?: (d: number) => void };
      s?.setPixelRatio?.(Math.min(device.dpr, device.touch ? 2 : 1.5));
      document.documentElement.classList.add('lite');
    }
  }
}

function afterOpen() {
  if (device.reducedMotion) return;
  if (!device.touch) garden.enableParallax();
  else garden.enableTilt();
}

// ---------- kịch bản ----------
async function open() {
  if (state !== 'intro') return;
  state = 'opening';
  const id = ++runId;
  audio.start();
  audio.play('open');
  haptic([12, 60, 18]);
  hud.showSkip(true);

  const c = envelope.mouth(L);
  const tl = gsap.timeline();
  master = tl;
  tl.add(envelope.openTimeline(device.reducedMotion), 0);
  const tb = device.reducedMotion ? 1.0 : 1.45;
  tl.call(() => {
    petals.burst(c.x, c.y);
    audio.play('sparkle', { volume: 0.7 });
  }, [], tb);
  tl.add(envelope.fadeBackdrop(), tb - 0.1);
  tl.call(() => garden.bloom(), [], tb);
  tl.call(() => {
    enterGardenInsects();
    fpsArmed = true;
  }, [], tb + 0.8);
  tl.add(photoWall.flyOut(c, tb + 0.2), tb + 0.2);
  tl.add(envelope.hideCard(), tb + 1.75);

  // nhân vật nhảy ra từ phong thư
  await sleep((tb + 0.9) * 1000);
  if (id !== runId) return;
  const a = await waitActor(6000);
  if (id !== runId) return;
  a.place({ x: c.x, y: c.y + L.envelope.h * 0.1, h: L.char.h * 0.08, face: 0 });
  a.setVisible(true);
  await a.jumpTo(L.char, { duration: 0.95, height: Math.min(L.H * 0.28, L.char.h * 0.9) });
  if (id !== runId) return;
  afterOpen();
  a.setAction('wave');
  await sleep(700);
  if (id !== runId) return;

  // lời thoại
  state = 'dialogue';
  await dialogue.run(config.dialogue(guest, { greeting: timeGreeting(), returning }), a, ['wave', 'cheer', 'talk', 'wave']);
  if (id !== runId) return;
  await showFinal(a, id);
}

async function showFinal(a: Actor, id: number) {
  state = 'final';
  hud.showSkip(false);
  hud.showFinalActions(true, 1.6);
  a.setSpeaking(false);
  audio.play('whoosh', { volume: 0.6 });
  invite.show();
  gsap.delayedCall(0.9, () => audio.play('chime', { volume: 0.7 }));
  if (L.portrait) {
    await sleep(500);
    if (id !== runId) return;
    await a.jumpTo(L.charFinal, { duration: 0.8, height: L.charFinal.h * 0.9 });
  }
  if (id !== runId) return;
  a.resize(L.W, L.H, finalCanvasHeight());
  a.setAction('cheer');
  petals.celebrate();
  petals.capRain();
  audio.play('cheer', { volume: 0.7 });
  await sleep(1800);
  if (id !== runId) return;
  a.setAction('idle');
  armRest();
}

async function skipToFinal() {
  if (state === 'final') return;
  const id = ++runId;
  master?.kill();
  dialogue.cancel();
  void dialogue.hide();
  if (!flags.og) audio.start();
  envelope.removeNow();
  garden.setBloomed();
  photoWall.setPlaced();
  enterGardenInsects(true);
  fpsArmed = true;
  state = 'final';
  hud.showSkip(false);
  if (!flags.og) hud.showFinalActions(true, 0.4);
  invite.setShown();
  afterOpen();
  const a = await waitActor(6000);
  if (id !== runId) return;
  a.setVisible(true);
  a.setSpeaking(false);
  a.place(L.charFinal);
  a.resize(L.W, L.H, finalCanvasHeight());
  a.setAction('wave');
  await sleep(2000);
  if (id !== runId) return;
  a.setAction('idle');
  armRest();
}

// ---------- tương tác: chỉ với nhân vật (+ chạm để qua câu thoại) ----------
const canTouchActor = () => (state === 'dialogue' || state === 'final') && !!actor && !wishes.isOpen && !thanking;
let actorTapAt = -Infinity;
let actorTapped = false;

// ---------- cảnh cuối: ~6 giây không ai bấm → nhân vật vươn vai, cầm mũ, nằm nghỉ ----------
const REST_AFTER = 8000;
let restTimer = 0;
/** đang ngồi dậy → các lần bấm dồn chỉ thả tim, không chồng động tác */
let waking = false;
let thanking = false;

async function thankGuest(name: string) {
  thanking = true;
  clearTimeout(restTimer);
  tapTimes.length = 0;
  try {
    const a = actor ?? await waitActor(6000);
    while (a.busy || waking) await sleep(50);
    if (a.resting) await a.getUp();
    a.lookAway?.();
    audio.play('chime', { volume: 0.65 });
    quip.show(config.wishes.thanks(name), a.headBox(), L.W, L.safe.top, 4.5);
    const head = a.headBox();
    petals.hearts(head.x, head.y - head.r);
    await a.bow();
  } finally { thanking = false; armRest(); }
}

function armRest(delay = REST_AFTER) {
  clearTimeout(restTimer);
  if (state !== 'final' || !actor || flags.og) return;
  const id = runId;
  restTimer = window.setTimeout(async () => {
    const a = actor;
    if (!a || id !== runId || state !== 'final') return;
    // đang bận (nhảy / ngồi dậy / đang xem ảnh) → đợi thêm chút
    if (waking || a.busy || lightbox.isOpen || wishes.isOpen || thanking) return armRest(1200);
    a.setAction('idle');
    const done = await a.lieDown();
    if (done && id === runId) showTapHintOnce(a);
  }, delay);
}

// gợi ý "Bấm vào mình thử nè" — hiện khi nhân vật nằm xuống lần đầu, chỉ 1 lần trong cả phiên
const TAP_HINT_KEY = 'grad-tap-hint-shown';
function hintShown() {
  try {
    return sessionStorage.getItem(TAP_HINT_KEY) === '1';
  } catch {
    return false;
  }
}
function showTapHintOnce(a: Actor) {
  if (actorTapped || hintShown() || wishes.isOpen || thanking) return;
  try {
    sessionStorage.setItem(TAP_HINT_KEY, '1');
  } catch {
    /* bỏ qua */
  }
  audio.play('blip', { volume: 0.5 });
  quip.show(config.tapHint, a.headBox(), L.W, L.safe.top, 3.5);
}

/** bấm vào nhân vật: nếu đang nằm (hoặc đang nằm xuống dở) thì ngồi dậy trước, rồi mới nhảy / tung mũ */
// bấm dồn 5 lần trong 2,5 giây → nhân vật xoay vòng chóng mặt (easter egg)
const tapTimes: number[] = [];
async function dizzy(a: Actor) {
  clearTimeout(restTimer);
  haptic([20, 40, 20, 40, 60]);
  audio.play('boing', { volume: 0.5, rate: 1.35 });
  const hb = a.headBox();
  quip.say('dizzy', hb, L.W, L.safe.top);
  a.setAction('idle');
  const spinning = a.spin(2, 1.15);
  petals.dizzy(hb.x, hb.y - hb.r * 0.75, hb.r);
  await spinning;
  audio.play('sparkle', { volume: 0.5 });
  armRest(REST_AFTER + 1500);
}

async function tapActor(a: Actor) {
  clearTimeout(restTimer);
  actorTapped = true;
  haptic(8);
  const hb = a.headBox();
  petals.hearts(hb.x, hb.y - hb.r);
  if (state !== 'final') {
    a.react();
    return;
  }
  if (waking) return;
  if (a.resting) {
    waking = true;
    audio.play('pop', { volume: 0.45 });
    await a.getUp();
    waking = false;
    if (state !== 'final' || actor !== a) return;
  }
  const now = performance.now();
  tapTimes.push(now);
  while (tapTimes.length && now - tapTimes[0] > 2500) tapTimes.shift();
  if (tapTimes.length >= 5) {
    tapTimes.length = 0;
    // đang nhảy / đang xoay dở → đợi xong (tối đa ~1,5s) rồi mới xoay chóng mặt
    for (let i = 0; i < 30 && a.busy; i++) await sleep(50);
    if (state === 'final' && actor === a && !a.resting) void dizzy(a);
    return;
  }
  const kind = a.react();
  if (kind) quip.say(kind, a.headBox(), L.W, L.safe.top);
  armRest(REST_AFTER + (kind === 'cheer' ? 1800 : 700));
}

app.addEventListener('pointerdown', (e) => {
  if (!canTouchActor()) return;
  const t = e.target as HTMLElement;
  if (t.closest('.invite') || (t.closest('button, a') && !t.closest('.pol'))) return;
  // nhân vật đứng trước dây ảnh → ưu tiên nhân vật
  if (actor!.hit(e.clientX, e.clientY)) {
    actorTapAt = performance.now();
    void tapActor(actor!);
    return;
  }
  if (t.closest('.pol')) return;
  if (state === 'dialogue') dialogue.tap();
});
// lượt chạm đã dành cho nhân vật thì không mở ảnh nằm phía sau
app.addEventListener(
  'click',
  (e) => {
    if (performance.now() - actorTapAt < 600) {
      e.stopPropagation();
      e.preventDefault();
    }
  },
  true,
);
// máy tính: nhân vật nhìn theo con trỏ, con trỏ thành bàn tay khi rê lên nhân vật
if (!device.touch) {
  let idleT = 0;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !canTouchActor()) return;
    actor!.lookAt?.(e.clientX, e.clientY);
    app.classList.toggle('over-actor', actor!.hit(e.clientX, e.clientY));
    clearTimeout(idleT);
    idleT = window.setTimeout(() => actor?.lookAway?.(), 2500);
  });
  document.addEventListener('pointerleave', () => actor?.lookAway?.());
}

// ---------- khởi động ----------
audio.init();
relayout();
photoWall.preload();
envelope.onOpen(() => void open());
// ?og: dựng khung hình tĩnh để chụp ảnh xem trước (scripts/og-image.mjs)
if (flags.og) document.documentElement.classList.add('og');
if (flags.skip || flags.og) void skipToFinal();
document.documentElement.classList.add('ready');

if (flags.debug) {
  // __manualTime(): dừng đồng hồ thật; __step(ms): tiến đúng ms cho cả GSAP lẫn nhân vật (test hoạt cảnh tất định)
  let vt = 0;
  const manualTime = () => {
    gsap.ticker.remove(gsap.updateRoot);
    gsap.ticker.remove(onTick);
    vt = gsap.ticker.time;
  };
  const step = (ms: number) => {
    vt += ms / 1000;
    gsap.updateRoot(vt);
    frame(ms / 1000);
  };
  Object.assign(window, { gsap, L: () => L, actor: () => actor, device, skipToFinal, __manualTime: manualTime, __step: step });
  console.log('[debug]', device);
}
