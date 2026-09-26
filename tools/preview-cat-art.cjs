'use strict';
// Local review gallery; serves only an explicit art allowlist, never a project directory.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const incoming=path.join(root,'assets/_incoming/cat-growth-complete-v1');
const files={atlas:path.join(root,'match3-wechat/res/catalog/portraits-atlas.jpg')};
const stages=['初见','熟悉','信任','依恋','挚友'];
const cats=[
 {id:'naitang',name:'奶糖',breed:'英国短毛猫',crop:[0,0,350,350]},
 {id:'tuanzi',name:'团子',breed:'布偶猫',crop:[350,0,350,350]},
 {id:'zhima',name:'芝麻',breed:'暹罗猫',crop:[0,388,350,388]},
 {id:'buding',name:'布丁',breed:'短毛三花',crop:[350,388,350,388]}
];
const naitang=['familiar','trust','attachment','best-friend'];
for(const cat of cats)for(let s=2;s<=5;s++)files[cat.id+'-'+s]=cat.id==='naitang'
 ?path.join(root,'assets/_incoming/cat-growth-naitang-v1/naitang-stage-'+s+'-'+naitang[s-2]+'-v1.png')
 :path.join(incoming,cat.id+'-stage-'+s+'-v1.png');
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>猫咪原画 · 五段陪伴</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3eef8;color:#39324d;font-family:system-ui,-apple-system,"PingFang SC",sans-serif}header,main{max-width:1440px;margin:auto;padding:26px 32px}header{padding-bottom:8px}h1{font-size:28px;margin:0 0 10px;letter-spacing:2px}p{margin:0;color:#686178;font-size:14px;line-height:1.8}nav{display:flex;gap:12px;margin-top:18px}nav a,.back{color:#654c87;text-decoration:none;background:#e8ddf2;border:1px solid #d9c8e9;border-radius:18px;padding:7px 18px;font-size:14px}section{margin-bottom:32px;scroll-margin:18px}h2{font-size:21px;margin:0 0 14px}h2 small{font-weight:400;color:#796d89;font-size:13px;margin-left:10px}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}button.art{padding:0;overflow:hidden;border:1px solid #dcd2e7;border-radius:14px;background:#fffafc;cursor:zoom-in;color:inherit;text-align:left;box-shadow:0 4px 14px #402d5a08}button.art:hover,button.art:focus-visible{outline:2px solid #ad8ccd;outline-offset:3px}.art img,.art canvas{display:block;width:100%;height:auto;aspect-ratio:1;object-fit:contain;background:#e8def1}.caption{display:flex;justify-content:space-between;align-items:center;padding:11px 12px;font:600 14px system-ui}.caption small{font-size:10px;color:#81728f;font-weight:400}dialog{border:1px solid #d6c4e5;border-radius:18px;padding:16px;background:#fbf7ff;max-width:min(94vw,940px);max-height:96vh}dialog::backdrop{background:#20172cce}dialog figure{margin:8px 0 0}dialog img,dialog canvas{display:block;max-width:100%;max-height:78vh;margin:auto;object-fit:contain}dialog button{border:0;border-radius:10px;background:#e7dbf2;color:#48335e;padding:9px 18px;font:inherit;cursor:pointer}dialog figcaption{padding-top:10px;text-align:center;font-size:14px}footer{font-size:12px;line-height:1.8;color:#7d718a;margin-top:28px}.back{display:inline-block;margin-top:12px}@media(max-width:800px){header,main{padding-left:16px;padding-right:16px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:23px}nav{flex-wrap:wrap}.caption{font-size:13px}}
</style>
<header><h1>五段陪伴，慢慢靠近你</h1><p>四只猫咪 · 二十个成长阶段。点击图片可放大查看。</p><nav>${cats.map(c=>`<a href="#${c.id}">${c.name}</a>`).join('')}</nav></header><main>
${cats.map(cat=>`<section id="${cat.id}"><h2>${cat.name}<small>${cat.breed}</small></h2><div class="grid">${stages.map((stage,i)=>`<button class="art" aria-label="查看${cat.name}·${stage}" data-label="${cat.name} · ${stage}">${i===0?`<canvas width="700" height="700" data-crop="${cat.crop.join(',')}"></canvas>`:`<img src="/image/${cat.id}-${i+1}" alt="${cat.name}·${stage}" width="1254" height="1254">`}<span class="caption">${stage}<small>${cat.id==='naitang'||i===0?'已确认原画':'本轮新增 · 待确认'}</small></span></button>`).join('')}</div></section>`).join('')}
<footer>初见沿用已确认图鉴原画；奶糖五阶段保持原版。团子、芝麻、布丁新增十二张供本轮审阅，尚未接入游戏。动画已延至下一版本。<br><a class="back" href="http://127.0.0.1:61919/">打开静态游戏预览</a></footer></main>
<dialog><button id="close">关闭</button><figure></figure></dialog>
<script>
const atlas=new Image();atlas.src='/image/atlas';atlas.onload=()=>{document.querySelectorAll('canvas[data-crop]').forEach(c=>{const s=c.dataset.crop.split(',').map(Number),ctx=c.getContext('2d'),scale=Math.min(c.width/s[2],c.height/s[3]);ctx.fillStyle='#e8def1';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(atlas,...s,(c.width-s[2]*scale)/2,(c.height-s[3]*scale)/2,s[2]*scale,s[3]*scale);});document.body.dataset.atlasReady='true';};
const dialog=document.querySelector('dialog'),figure=dialog.querySelector('figure');
document.querySelectorAll('.art').forEach(b=>b.onclick=()=>{figure.replaceChildren();const source=b.querySelector('img,canvas'),image=source.cloneNode();if(source.tagName==='CANVAS')image.getContext('2d').drawImage(source,0,0);const caption=document.createElement('figcaption');caption.textContent=b.dataset.label;figure.append(image,caption);dialog.showModal();});
document.querySelector('#close').onclick=()=>dialog.close();dialog.onclick=e=>{if(e.target===dialog)dialog.close();};
</script></html>`;
fs.writeFileSync(path.join(incoming,'review.html'),html);
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
 const file=files[u.pathname.replace(/^\/image\//,'')];
 if(!u.pathname.startsWith('/image/')||!file){res.statusCode=404;res.end();return;}
 fs.readFile(file,(e,data)=>{res.statusCode=e?404:200;res.setHeader('Content-Type',file.endsWith('.jpg')?'image/jpeg':'image/png');res.end(e?'':data);});
});
const port=Number(process.argv.find(s=>s.startsWith('--port='))?.slice(7)||61920);
server.listen(port,'127.0.0.1',()=>console.log('Cat art review: http://127.0.0.1:'+server.address().port));
