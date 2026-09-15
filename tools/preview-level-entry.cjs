// Isolated local fixture: actual Main/UI/Core/Board, in-memory storage; no cloud or user save.
const fs = require('fs');
const path = require('path');
const http = require('http');
const root = path.resolve(__dirname, '../match3-wechat');
const sources = {};
function collect(file) {
    const id = path.relative(root, file).replaceAll('\\', '/');
    if (sources[id]) return;
    sources[id] = fs.readFileSync(file, 'utf8');
    for (const m of sources[id].matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        if (m[1].startsWith('.')) collect(path.resolve(path.dirname(file), m[1] + '.js'));
    }
}
collect(path.join(root, 'js/main.js'));
const html = `<!doctype html><meta charset="utf-8"><title>第一关入口隔离验证</title>
<style>body{font:16px sans-serif;background:#dbe3f2;margin:12px}canvas{display:block;touch-action:none}pre{white-space:pre-wrap}</style>
<a href="?width=320">320×568</a> · <a href="?width=390">390×844</a> · <a href="?width=430">430×932</a>
<p>点击地图第一关。仅使用内存测试存档，不访问微信账号或云端。</p>
<section id="motion" hidden><p>换位失败预览：真实棋盘与音效，本地内存状态。</p>
<button data-case="plain">普通换位失败</button><button data-case="ice">碰到冰块</button><button data-case="jelly">碰到果冻</button>
<label><input id="muted" type="checkbox">关闭音效</label><label><input id="reduced" type="checkbox">减弱动效</label>
<button id="sequence">连续演示三种反馈</button></section>
<pre id="status">加载中</pre><canvas id="game"></canvas><script src="/fixture.js"></script>`;
const script = `
const sources=${JSON.stringify(sources)},cache={},storage={match3_music_enabled_v1:false,match3_sfx_enabled_v1:false};
window.wx={createImage:()=>new Image(),getStorageSync:k=>storage[k],setStorageSync:(k,v)=>{storage[k]=v;}};
wx.getFileSystemManager=()=>({readFile:request=>fetch('/'+request.filePath).then(r=>{
 if(!r.ok)throw new Error('missing audio');return r.arrayBuffer();
}).then(data=>request.success({data})).catch(request.fail)});
function load(id){
 if(cache[id])return cache[id].exports;
 const m=cache[id]={exports:{}};
 const req=rel=>{const parts=id.split('/');parts.pop();rel.split('/').forEach(p=>p==='..'?parts.pop():p!=='.'&&parts.push(p));return load(parts.join('/')+'.js');};
 new Function('require','module','exports',sources[id])(req,m,m.exports);return m.exports;
}
const widths={320:568,390:844,430:932},params=new URLSearchParams(location.search);
const width=widths[params.get('width')]?+params.get('width'):390,height=widths[width];
const motionPreview=params.get('preview')==='invalid';
const canvas=document.getElementById('game'),status=document.getElementById('status');
canvas.width=width*2;canvas.height=height*2;canvas.style.width=width+'px';canvas.style.height=height+'px';
const ctx=canvas.getContext('2d');ctx.scale(2,2);
const Main=load('js/main.js'),UI=load('js/render/ui.js');
const app=Object.create(Main.prototype);
Object.assign(app,{ctx,screen:{width,height,safeTop:47,contentTop:91,safeBottom:34},state:'levelselect',progress:{unlockedLevel:1,failures:{},stars:{}},guide:null,guideQueue:[],levelMapOffset:0});
let previewCase='plain',previewError='',feedbackCount=0;
const audio=load('js/audio.js');
if(motionPreview){
 document.getElementById('motion').hidden=false;
 document.querySelectorAll('a').forEach(a=>a.href+='&preview=invalid');
 app.startGame(1);app.guide=null;
 app.core.level={...app.core.level,goals:[{type:'score',target:99999}]};
 app.core.grid=app.core.grid.map((row,r)=>row.map((_,c)=>(r*2+c)%5+1));
 app.core.jellyGrid=app.core.grid.map(row=>row.map(()=>0));
 app.core.iceGrid=app.core.grid.map(row=>row.map(()=>0));
 app.core.jellyTotal=0;app.board.syncPiecesFromGrid();
 const feedback=app.core.callbacks.onInvalidSwap;
 app.core.callbacks.onInvalidSwap=(a,b)=>{feedbackCount++;return feedback(a,b);};
 audio.init();audio.setSfxEnabled(true);
 document.getElementById('muted').onchange=e=>audio.setSfxEnabled(!e.target.checked);
 document.getElementById('reduced').onchange=e=>{app.screen.reduceEffects=e.target.checked;};
 window.addEventListener('unhandledrejection',e=>{previewError=String(e.reason);});
 function attempt(kind){
  if(!app.core.isPlaying())return;
  previewCase=kind;
  app.core.iceGrid[2][3]=kind==='ice'?1:0;
  app.core.jellyGrid[3][2]=kind==='jelly'?2:0;
  const a=app.board.pieceCenter(2,2),b=kind==='jelly'?app.board.pieceCenter(3,2):app.board.pieceCenter(2,3);
  audio.unlock();app.board.onTouchStart(a.x,a.y);app.board.onTouchMove(b.x,b.y);app.board.onTouchEnd();
 }
 document.querySelectorAll('[data-case]').forEach(button=>button.onclick=()=>attempt(button.dataset.case));
 document.getElementById('sequence').onclick=async()=>{
  for(const kind of ['plain','ice','jelly']){attempt(kind);await new Promise(r=>setTimeout(r,850));}
 };
 let last=performance.now();
 function frame(now){const dt=now-last;last=now;app.board.update(dt);draw();requestAnimationFrame(frame);}
 requestAnimationFrame(frame);
}
function draw(){
 ctx.clearRect(0,0,width,height);
 if(app.state==='levelselect'){
  app.levelSelectButtons=UI.drawLevelSelect(ctx,app.screen,1,0,{},{});
  const hit=app.levelSelectButtons.level_1;
  status.textContent=JSON.stringify({viewport:[width,height],state:app.state,firstLevelHit:hit||null});
 }else if(app.state==='playing'){
  app.board.draw();
  if(app.guide)load('js/render/onboarding.js').draw(ctx,app.screen,app.guide.key);
  status.textContent=motionPreview?JSON.stringify({case:previewCase,feedbackCount,moves:app.core.movesLeft,
   pending:app.core.swapFeedbackPending,offset:app.board.invalidSwapOffset(2,2),error:previewError})
   :JSON.stringify({result:'PASS',state:app.state,level:app.core.level.id,pieces:app.board.pieces.length,testHearts:storage.match3_heart_v1.count,guide:app.guide&&app.guide.key});
 }
}
canvas.addEventListener('click',e=>{
 if(motionPreview)return;
 const r=canvas.getBoundingClientRect(),point={clientX:(e.clientX-r.left)*width/r.width,clientY:(e.clientY-r.top)*height/r.height};
 try{app.handleTouchStart({touches:[point]});app.handleTouchEnd({changedTouches:[point]});draw();}
 catch(error){status.textContent='FAIL '+error.stack;}
});
load('js/render/assets.js').preload(draw);
`;
http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
    if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(script); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(path.join(root, 'res') + path.sep)) { res.writeHead(404); res.end(); return; }
    fs.readFile(file, (err, data) => {
        res.statusCode = err ? 404 : 200;
        const mime = { '.png': 'image/png', '.jpg': 'image/jpeg' }[path.extname(file)];
        if (mime) res.setHeader('Content-Type', mime);
        res.end(err ? 'missing' : data);
    });
}).listen(0, '127.0.0.1', function () { console.log('Entry fixture: http://127.0.0.1:' + this.address().port); });
