import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
mkdirSync('shots',{recursive:true});
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const p=await b.newPage({viewport:{width:390,height:664},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5173/grad/?skip&debug&tier=mid');
 await p.waitForFunction(()=>window.actor?.()?.kind==='3d' && window.actor().anchor.h===window.L().charFinal.h);
 await p.evaluate(()=>{window.__manualTime();window.actor().setAction('idle');for(let i=0;i<30;i++)window.__step(1000/60)});
 const stats=await p.evaluate(()=>{
  const c=document.querySelector('.stage3d'),a=window.actor();
  return {dpr:c.width/parseFloat(c.style.width),pixels:c.width*c.height,cssH:parseFloat(c.style.height),h:a.anchor.h,target:window.device.dpr};
 });
 assert.equal(stats.target,3);assert.equal(stats.dpr,3);
 assert.ok(stats.pixels<=1500000);assert.ok(stats.cssH<stats.h*2.5);
 await p.locator('.stage3d').screenshot({path:'shots/character-mobile-sharp.png'});
 // Thư lưu ảnh phải khôi phục mật độ và khung canvas sau khi chụp.
 const snap=await p.evaluate(async()=>{const a=window.actor(),c=document.querySelector('.stage3d'),before=[c.width,c.height];await a.snapshot();return {before,after:[c.width,c.height]}});
 assert.deepEqual(snap.before,snap.after);
 // Dùng khung canvas nhỏ vẫn chứa nhân vật khi nằm/tung mũ.
 for(const action of ['cheer','rest']){
  const clipped=await p.evaluate(action=>{
   const a=window.actor();if(action==='rest'){a.setAction('idle');void a.lieDown()}else a.setAction('cheer');
   const target=document.createElement('canvas'),src=document.querySelector('.stage3d');
   target.width=src.width;target.height=src.height;const ctx=target.getContext('2d');
   let cropped=false;
   for(let f=0;f<160;f++){
    window.__step(1000/60);
    if(f%16)continue;
    ctx.clearRect(0,0,target.width,target.height);ctx.drawImage(src,0,0);
    const w=target.width,h=target.height,data=ctx.getImageData(0,0,w,h).data;
    for(let x=0;x<w;x++)if(data[x*4+3]>30 || data[((h-1)*w+x)*4+3]>30)cropped=true;
    for(let y=0;y<h;y++)if(data[y*w*4+3]>30 || data[(y*w+w-1)*4+3]>30)cropped=true;
   }
   return cropped;
  },action);
  assert.equal(clipped,false,`canvas clipping: ${action}`);
 }
 await p.locator('.stage3d').screenshot({path:'shots/character-mobile-rest-sharp.png'});
 // Mô phỏng chậm kéo dài: vẫn giữ >=2x trên màn Retina thay vì xuống 1x.
 await p.goto('http://127.0.0.1:5173/grad/?skip&debug&tier=mid');
 await p.waitForFunction(()=>window.actor?.()?.kind==='3d' && window.actor().anchor.h===window.L().charFinal.h);
 await p.evaluate(()=>{window.__manualTime();for(let i=0;i<130;i++)window.__step(40)});
 assert.equal(await p.locator('.stage3d').evaluate(c=>c.width/parseFloat(c.style.width)),2);
 assert.deepEqual(errors,[]);
 console.log('PASS: Retina 3x ở tier mid; giới hạn pixel; snapshot khôi phục; không cắt mũ/tư thế nằm; khi chậm vẫn >=2x.',stats);
}finally{await b.close()}
