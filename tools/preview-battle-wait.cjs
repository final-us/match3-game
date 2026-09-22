'use strict';
// Isolated local UI fixture. No WeChat accounts, cloud writes or persistent saves.
const fs = require('fs');
const path = require('path');
const http = require('http');
const root = path.resolve(__dirname, '../match3-wechat');
const sources = {};
function collect(file) {
    const id = path.relative(root, file).replaceAll('\\', '/');
    if (sources[id]) return;
    sources[id] = fs.readFileSync(file, 'utf8');
    for (const match of sources[id].matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        if (match[1].startsWith('.')) collect(path.resolve(path.dirname(file), match[1] + '.js'));
    }
}
collect(path.join(root, 'js/main.js'));
const html = `<!doctype html><meta charset="utf-8"><title>等待房间 · 本地故障验证</title>
<style>body{margin:12px;background:#e7eafa;color:#182654;font:14px system-ui}canvas{display:block;touch-action:none}nav{margin-bottom:8px}button,select{font:inherit;padding:8px}output{display:block;margin:6px 0}#toast{min-height:22px}</style>
<nav><a href="/?width=320&height=568">320</a> · <a href="/?width=390&height=844">390</a> · <a href="/?width=430&height=932">430</a>
<label>网络 <select id="network"><option value="ok">正常</option><option value="stall">不回调</option><option value="fail">立即失败</option></select></label>
<button id="late">释放迟到回包</button></nav><output id="status"></output><output id="toast"></output><canvas></canvas><script src="/fixture.js"></script>`;
const script = `
const sources=${JSON.stringify(sources)},cache={},params=new URLSearchParams(location.search);
const width=+(params.get('width')||390),height=+(params.get('height')||844);
const canvas=document.querySelector('canvas'),status=document.querySelector('#status'),toast=document.querySelector('#toast');
const memory={match3_music_enabled_v1:false,match3_sfx_enabled_v1:false},events={},pending=[];
let avatarCalls=0,frameCount=0,room={items:{freeze:1,disturb:2},ready:false};
const originalRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>originalRAF(t=>{frameCount++;fn(t);});
window.wx={createCanvas:()=>canvas,createImage:()=>new Image(),
 getStorageSync:key=>memory[key],setStorageSync:(key,value)=>memory[key]=value,removeStorageSync:key=>delete memory[key],
 getSystemInfoSync:()=>({windowWidth:width,windowHeight:height,pixelRatio:2,safeArea:{top:47,bottom:height-34,left:0,right:width}}),
 getMenuButtonBoundingClientRect:()=>({bottom:87,left:width-90}),
 getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),
 onTouchStart:fn=>events.start=fn,onTouchMove:fn=>events.move=fn,onTouchEnd:fn=>events.end=fn,
 onShow:fn=>events.show=fn,onHide:fn=>events.hide=fn,onError:()=>{},onUnhandledRejection:()=>{},
 showToast:o=>toast.textContent=o.title,showModal:o=>toast.textContent=o.content,
 createUserInfoButton:()=>{avatarCalls++;throw Error('synthetic avatar API unavailable');},
 shareAppMessage:()=>{},onShareAppMessage:()=>{},
 cloud:{init:()=>{},callFunction:o=>{
  const action=o.data.action,mode=document.querySelector('#network').value;
  function respond(){
   if(action==='create'){room={items:{freeze:1,disturb:2},ready:false};o.success({result:{ok:true,roomId:'R12345678abcdef0123'}});return;}
   if(action==='configureItems')room.items={...o.data.items};
   if(action==='ready')room.ready=!room.ready;
   o.success({result:action==='query'?{ok:true,status:'waiting',myReady:room.ready,myItems:{...room.items}}:{ok:true,ready:room.ready,items:{...room.items}}});
  }
  if(action!=='create'&&action!=='leave'&&mode==='stall'){pending.push(respond);return;}
  setTimeout(()=>mode==='fail'?o.fail({errMsg:'network offline'}):respond(),350);
 }}};
function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};
 const req=relative=>{const p=id.split('/');p.pop();relative.split('/').forEach(x=>x==='..'?p.pop():x!=='.'&&p.push(x));return load(p.join('/')+'.js');};
 new Function('require','module','exports',sources[id])(req,m,m.exports);return m.exports;}
function point(e){const r=canvas.getBoundingClientRect();return {clientX:(e.clientX-r.left)*width/r.width,clientY:(e.clientY-r.top)*height/r.height};}
canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);events.start({touches:[point(e)]});};
canvas.onpointermove=e=>{if(e.buttons)events.move({touches:[point(e)]});};
canvas.onpointerup=e=>events.end({changedTouches:[point(e)]});
const app=new (load('js/main.js'))();canvas.style.width=width+'px';canvas.style.height=height+'px';
document.querySelector('#late').onclick=()=>pending.splice(0).forEach(fn=>fn());
setInterval(()=>{const b=app.battle;status.textContent='仅本地模拟 | 帧 '+frameCount+' | 头像尝试 '+avatarCalls+' | '+app.state+(b?' | 道具 '+b.items.freeze+'/'+b.items.disturb+' | 同步 '+!!b.actionPending+' | 离线 '+!!b.offline:'');},200);
`;
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
    if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(script); return; }
    const file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep)) { res.statusCode = 404; res.end(); return; }
    fs.readFile(file, (error, data) => { res.statusCode = error ? 404 : 200; res.end(error ? '' : data); });
});
server.listen(0, '127.0.0.1', () => console.log('http://127.0.0.1:' + server.address().port));
