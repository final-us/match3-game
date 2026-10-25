'use strict';
// Real UI/Core + Main's result-goal adapter, illustrative states, memory-only platform.
const fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../match3-wechat'),out=path.resolve(__dirname,'../assets/_incoming/result-card-c-fidelity-20261018/runtime');
const sources={};
function collect(file) {
    const id=path.relative(root,file).replaceAll('\\','/');
    if(sources[id])return;
    sources[id]=fs.readFileSync(file,'utf8');
    for(const m of sources[id].matchAll(/require\(['"]([^'"]+)['"]\)/g))if(m[1].startsWith('.'))collect(path.resolve(path.dirname(file),m[1]+'.js'));
}
['js/render/ui.js','js/core/game-core.js','js/main.js'].forEach(id=>collect(path.join(root,id)));
const states=['win','fail','timeout','unavailable','repeat','pending','revive-pending','dense','collect-score','single','triple'];
const html=`<!doctype html><meta charset="utf-8"><title>C · 猫咪剧场 · 原生运行预览</title>
<style>body{margin:16px;background:#e9edf5;color:#303b62;font:15px system-ui}nav{display:flex;gap:12px;flex-wrap:wrap;align-items:center}button,select{font:inherit;padding:8px;min-height:44px}canvas{display:block;margin-top:16px}output{display:block;padding:10px;white-space:pre-line}p{max-width:800px;line-height:1.6}</style>
<nav><a href="?width=320">320</a><a href="?width=390">390</a><a href="?width=430">430</a>
<select id="state" aria-label="结算状态"><option value="win">成功</option><option value="fail">失败·双目标</option><option value="timeout">超时·双目标</option><option value="unavailable">广告不可用</option><option value="repeat">重复通关·1星</option><option value="pending">结算待保存</option><option value="revive-pending">复活待保存</option><option value="dense">四目标压力状态</option><option value="collect-score">收集与分数</option><option value="single">单目标</option><option value="triple">三目标</option></select>
<button id="save">保存当前实际画面</button><button id="batch">保存本尺寸全部状态</button><a href="?width=390&fallback=1">装饰未就绪回退</a><a href="http://127.0.0.1:50811/">概念对照</a></nav>
<p>真实原生UI与Core；分数、奖励、剩余目标为内存示例，不代表自然战局。仅查看排版，画中按钮不发奖、不请求广告或云端，不写设备存档。</p>
<canvas id="screen" aria-label="C方案实际渲染"></canvas><output>正在加载活动素材…</output><script src="/fixture.js"></script>`;
const script=`
const sources=${JSON.stringify(sources)},cache={},params=new URLSearchParams(location.search),disk={match3_music_enabled_v1:false,match3_sfx_enabled_v1:false};
window.wx={createImage:()=>new Image(),createCanvas:()=>document.createElement('canvas'),loadSubpackage:o=>o.success(),getStorageSync:k=>disk[k]??'',setStorageSync:(k,v)=>{disk[k]=v;}};
function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};const req=relative=>{const p=id.split('/');p.pop();relative.split('/').forEach(x=>x==='..'?p.pop():x!=='.'&&p.push(x));return load(p.join('/')+'.js');};new Function('require','module','exports',sources[id])(req,m,m.exports);return m.exports;}
const UI=load('js/render/ui.js'),Core=load('js/core/game-core.js'),Main=load('js/main.js'),assets=load('js/render/assets.js');
const width=+(params.get('width')||390),height=width===320?568:width===430?932:844;
const screen={width,height,contentTop:91,safeTop:47,safeBottom:34,reduceEffects:params.get('reduce')==='1'};
const canvas=document.querySelector('#screen'),ctx=canvas.getContext('2d');canvas.width=width*2;canvas.height=height*2;canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.scale(2,2);
let selected=params.get('state')||'win';if(!${JSON.stringify(states)}.includes(selected))selected='win';document.querySelector('#state').value=selected;
function render(state) {
 const level={id:16,rows:8,columns:8,moveCount:24,timeLimitSec:180,
 goals:[{type:'jelly',target:2},{type:'yarn',target:3}],underlays:{'2:2':1,'2:3':1},yarn:{source:'3:3',health:3,spreadEvery:2,maxVines:3}};
 if(state==='dense'||state==='triple'){level.goals=[{type:'jelly',target:2},{type:'ice',target:1},{type:'moonbud',target:1},{type:'parcel',target:1}];if(state==='triple')level.goals.pop();level.obstacles={'3:4':1};level.moonbuds=['4:3'];level.parcels=[{id:'preview',row:5,column:4}];level.parcelExits=[4];}
 if(state==='single')level.goals=[{type:'jelly',target:2}];
 if(state==='collect-score'){level.goals=[{type:'collect',pieceType:2,target:10},{type:'score',target:10000}];level.underlays={};}
 const core=new Core(level,{});core.yarnSource.health=1;core.score=8640;core.collectedCounts[2]=4;
 const win=['win','repeat','pending'].includes(state);
 const data={win,score:win?12480:8640,star:state==='pending'?0:state==='repeat'?1:3,coinReward:state==='repeat'||state==='pending'?0:180,
  levelId:16,hasNext:true,canRevive:!win&&state!=='unavailable',reason:state==='timeout'?'timeout':'moves',timed:state!=='unavailable',
  rewardPending:state==='pending',revivePending:state==='revive-pending',maxCascade:state==='pending'?undefined:6,specialComboCount:state==='pending'?undefined:2,
  retentionMessage:state==='dense'?'每日任务待同步':null,remainingGoals:win?[]:Main.prototype.remainingSoloGoals.call({core})};
 ctx.clearRect(0,0,width,height);const buttons=UI.drawResult(ctx,screen,data);
 for(const hit of Object.values(buttons))if(hit.w<44||hit.h<44||hit.x<0||hit.y<91||hit.x+hit.w>width||hit.y+hit.h>height-34)throw Error('命中区越界');
 document.querySelector('output').textContent=width+'×'+height+' · '+state+' · '+(screen.reduceEffects?'降低效果':'正常效果')+' · 装饰 '+assets.getResultArtState().status+' · 实际Canvas';
}
async function save(state){const response=await fetch('/capture?name='+state+'-'+width+(params.has('fallback')?'-fallback':screen.reduceEffects?'-reduce':''),{method:'POST',body:canvas.toDataURL('image/png')});if(!response.ok)throw Error('保存失败 '+response.status);return response.text();}
document.querySelector('#state').onchange=e=>{selected=e.target.value;render(selected);};
document.querySelector('#save').onclick=async()=>{document.querySelector('output').textContent=await save(selected);};
document.querySelector('#batch').onclick=async()=>{const saved=[];for(const state of ${JSON.stringify(states)}){render(state);saved.push(await save(state));}render(selected);document.querySelector('output').textContent=saved.join('\\n');};
assets.preload(()=>{if(params.has('fallback'))return render(selected);assets.loadResultArt().then(state=>{if(state.status==='ready')render(selected);else document.querySelector('output').textContent='装饰加载失败：'+state.status;});});
`;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(req.method==='POST'&&url.pathname==='/capture'){
  const name=url.searchParams.get('name');
  if(!new RegExp('^('+states.join('|')+')-(320|390|430)(-reduce|-fallback)?$').test(name||'')){res.writeHead(400);res.end();return;}
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>8*1024*1024){res.writeHead(413);res.end();return;}chunks.push(chunk);}
  const data=Buffer.concat(chunks).toString();if(!data.startsWith('data:image/png;base64,')){res.writeHead(400);res.end();return;}
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.slice(22),'base64'));res.end(name+'.png');return;
 }
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
 if(url.pathname==='/fixture.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(script);return;}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!(url.pathname.startsWith('/res/')||url.pathname.startsWith('/result-art/'))||!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
 fs.readFile(file,(error,data)=>{res.statusCode=error?404:200;res.end(error?'':data);});
});
server.listen(Number(process.argv[2])||0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
