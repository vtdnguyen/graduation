import { webkit } from 'playwright';
import assert from 'node:assert/strict';
const browser=await webkit.launch();
const options={viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'};
try {
 // Cấu hình iOS phải có trước cả module dựng cảnh, không phụ thuộc mở panel.
 const boot=await browser.newPage(options);
 await boot.route('**/src/main.ts',r=>r.fulfill({contentType:'application/javascript',body:''}));
 await boot.goto('http://127.0.0.1:5173/grad/');
 assert.equal(await boot.locator('html').evaluate(e=>e.classList.contains('ios-edge')),true);
 assert.equal(await boot.locator('meta[name="theme-color"]').count(),0);
 await boot.close();
 const p=await browser.newPage(options);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  Object.defineProperty(screen,'width',{value:390});Object.defineProperty(screen,'height',{value:900});
  const v=new EventTarget();Object.assign(v,{height:664,width:390,offsetTop:0,offsetLeft:0,scale:1});
  Object.defineProperty(window,'visualViewport',{value:v});
  window.setVisible=(height,offsetTop)=>{Object.assign(v,{height,offsetTop});v.dispatchEvent(new Event('resize'));v.dispatchEvent(new Event('scroll'));};
 });
 await p.goto('http://127.0.0.1:5173/grad/?debug&no3d&reduced');
 await p.waitForFunction(()=>!!window.L);
 const check=async()=>{
  await p.waitForTimeout(200);
  return p.evaluate(()=>{
   const scene=document.querySelector('#app').getBoundingClientRect();
   const pinned=[...document.querySelectorAll('*')].filter(e=>{
    const s=getComputedStyle(e);
    return ['fixed','sticky'].includes(s.position)&&s.display!=='none'&&s.visibility!=='hidden'&&e.getClientRects().length;
   }).map(e=>e.className);
   return {pinned,sceneTop:scene.top+scrollY,sceneBottom:scene.bottom+scrollY,height:document.documentElement.scrollHeight,visibleBottom:scrollY+visualViewport.offsetTop+visualViewport.height};
  });
 };
 let state=await check();assert.deepEqual(state.pinned,[]);assert.equal(state.sceneTop,0);assert.ok(state.sceneBottom>=900);assert.ok(state.height<=state.sceneBottom+1);
 await p.evaluate(()=>window.skipToFinal());
 await p.locator('.inv-wish').waitFor();
 for(const offset of [0,40,0]) {
  await p.evaluate(offset=>window.scrollTo(0,offset),offset);
  await p.waitForTimeout(250);
  for(let i=0;i<2;i++) {
   await p.locator('.inv-wish').click();
   await p.waitForTimeout(350);
   state=await check();assert.deepEqual(state.pinned,[]);
   const panel=await p.locator('.wishes-panel').boundingBox();
   assert.ok(panel.y>=0 && panel.y+panel.height<=664+1);
   await p.locator('.wish-message').fill('Thử bàn phím và đóng panel');
   await p.evaluate(()=>window.setVisible(320,25));
   await p.waitForTimeout(200);
   assert.deepEqual((await check()).pinned,[]);
   await p.evaluate(()=>window.setVisible(664,0));
   await p.locator('.wish-close').click();
   state=await check();assert.deepEqual(state.pinned,[]);assert.equal(state.sceneTop,0);assert.ok(state.height<=state.sceneBottom+1);
   const hud=await p.locator('.hud').boundingBox();assert.ok(hud.y>=7 && hud.y<12);
  }
 }
 // Panel ảnh cũng không được đổi Safari sang chế độ tô màu fixed.
 await p.evaluate(async()=>{
  const {KeepsakeView}=await import('/grad/src/scenes/keepsake.ts');
  const v=new KeepsakeView(true);v.showLoading();
  const c=document.createElement('canvas');c.width=100;c.height=100;await v.showCanvas(c,'test.jpg');
 });
 assert.deepEqual((await check()).pinned,[]);
 await p.locator('.ks-close').click();
 await p.waitForTimeout(400);
 assert.deepEqual((await check()).pinned,[]);
 assert.deepEqual(errors,[]);
 console.log('PASS: iOS cấu hình trước module, nền trong flow từ đầu, không lớp fixed/sticky, không đuôi trang thừa, mở/đóng panel + cuộn + bàn phím không đổi hệ tọa độ.');
} finally {await browser.close()}
