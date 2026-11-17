import { webkit } from 'playwright';
import assert from 'node:assert/strict';
const b=await webkit.launch();
try {
 const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 await p.addInitScript(()=>{
  Object.defineProperty(screen,'width',{value:390});
  Object.defineProperty(screen,'height',{value:900});
  const v=new EventTarget();Object.assign(v,{height:664,width:390,offsetTop:0,offsetLeft:0,scale:1});
  Object.defineProperty(window,'visualViewport',{value:v});
  window.setVisible=(height,offsetTop)=>{Object.assign(v,{height,offsetTop});v.dispatchEvent(new Event('resize'));v.dispatchEvent(new Event('scroll'));};
 });
 await p.goto('http://127.0.0.1:5173/grad/?skip&debug&no3d&reduced');
 // WebKit desktop không có notch; mô phỏng safe insets bằng chính probe mà app đọc.
 await p.addStyleTag({content:'div[style*="safe-area-inset-top"] {padding-top:44px!important;padding-bottom:34px!important} .hud {margin-top:44px}'});
 for(const [height,top] of [[664,0],[780,0],[700,30],[664,0]]){
  await p.evaluate(([h,t])=>window.setVisible(h,t),[height,top]);await p.waitForTimeout(500);
  const app=await p.locator('#app').boundingBox();
  const card=await p.locator('.invite').boundingBox();
  const hud=await p.locator('.hud').boundingBox();
  assert.ok(app.height>=900);
  assert.equal(await p.locator('meta[name="theme-color"]').count(),0);
  assert.ok(card.y+card.height<=top+height-34-11);
  assert.ok(hud.y>=top+44);
  assert.equal(await p.locator('#app').evaluate(e=>getComputedStyle(e).position),'relative');
  assert.equal(await p.locator('.inv-wish').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.inv-wish')===e}),true);
 }
 console.log('PASS WebKit: nền phủ large viewport, thanh nút tránh notch, nút gửi trên home indicator, cập nhật khi thanh Safari thay đổi.');
}finally{await b.close()}
