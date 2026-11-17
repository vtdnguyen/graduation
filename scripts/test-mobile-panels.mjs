import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
for (const engine of [chromium, webkit]) {
 const browser = await engine.launch();
 try {
  const page = await browser.newPage({viewport:{width:390,height:664},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const viewport=new EventTarget();
   Object.assign(viewport,{height:664,width:390,offsetTop:0,offsetLeft:0,scale:1});
   Object.defineProperty(window,'visualViewport',{value:viewport});
   window.keyboard=(height,offsetTop=0)=>{Object.assign(viewport,{height,offsetTop});viewport.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('scroll'));};
  });
  await page.goto('http://127.0.0.1:5173/grad/?skip&no3d&reduced&debug&to=An');
  await page.locator('.inv-wish').click();
  await page.waitForTimeout(400);
  const original=await page.locator('.invite').boundingBox();
  await page.locator('.wish-message').fill('Lời chúc đang viết vẫn được giữ nguyên 💚');
  for(const [height,offset] of [[320,0],[280,70],[350,25]]){
   await page.evaluate(([h,o])=>window.keyboard(h,o),[height,offset]);
   await page.waitForTimeout(100);
   const panel=await page.locator('.wishes-panel').boundingBox();
   const input=await page.locator('.wish-message').boundingBox();
   assert.ok(panel.y>=offset && panel.y+panel.height<=offset+height+1);
   assert.ok(input.y>=offset && input.y+input.height<=offset+height);
   assert.deepEqual(await page.locator('.invite').boundingBox(),original);
  }
  await page.evaluate(()=>window.keyboard(664));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.wish-message').inputValue(),'Lời chúc đang viết vẫn được giữ nguyên 💚');
  await page.locator('.wish-close').click();
  // Kiểm tra cả máy có và không có Web Share, dùng canvas nhỏ tránh phụ thuộc GPU.
  for(const supported of [false,true]) {
   await page.evaluate(async supported=>{
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>supported});
    Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{window.shared=true}});
    const {KeepsakeView}=await import('/grad/src/scenes/keepsake.ts');
    document.querySelectorAll('.keepsake').forEach(e=>e.remove());
    const view=new KeepsakeView(true);view.showLoading();
    const canvas=document.createElement('canvas');canvas.width=200;canvas.height=300;
    await view.showCanvas(canvas,'test.jpg');
   },supported);
   const button=page.locator('.ks-actions .ks-btn');
   assert.equal(await button.count(),1);
   assert.equal(await button.textContent(),'Chia sẻ / Lưu ảnh');
   assert.ok(await button.evaluate(e=>e.classList.contains('ks-primary')));
   const box=await button.boundingBox();
   assert.ok(Math.abs(box.x+box.width/2-195)<2);
   if(supported){await button.click();assert.equal(await page.evaluate(()=>window.shared),true)}
   else assert.equal(await button.getAttribute('download'),'test.jpg');
  }
  assert.deepEqual(errors,[]);
  console.log(`${engine.name()}: PASS keyboard viewport resize/pan/restore, nội dung giữ nguyên, cảnh nền ổn định, một nút lưu/chia sẻ canh giữa`);
 } finally {await browser.close()}
}
