// Local visual fixture only: real render modules/assets, no main loop, storage or cloud calls.
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
['render/onboarding', 'render/ui', 'render/battle-ui', 'render/board-render', 'core/game-core'].forEach(
  name => collect(path.join(root, 'js', name + '.js')));
const html = `<!doctype html><meta charset="utf-8"><title>月光引导 · 本地视觉夹具</title>
<style>body{margin:16px;background:#cbd6ef;color:#303c70;font:16px sans-serif}nav{margin-bottom:12px}a{margin-right:12px}canvas{display:block}</style>
<nav id="keys"></nav><nav id="sizes"></nav><canvas id="game"></canvas>
<script src="/fixture.js"></script>`;
const script = `
const sources=${JSON.stringify(sources)}, cache={};
window.wx={createImage:()=>new Image()};
function load(id) {
  if(cache[id]) return cache[id].exports;
  const m=cache[id]={exports:{}};
  const req=rel=>{
    const parts=id.split('/');parts.pop();
    rel.split('/').forEach(p=>p==='..'?parts.pop():p!=='.'&&parts.push(p));
    return load(parts.join('/')+'.js');
  };
  new Function('require','module','exports',sources[id])(req,m,m.exports);
  return m.exports;
}
const Guide=load('js/render/onboarding.js'), params=new URLSearchParams(location.search);
const key=Object.hasOwn(Guide.CONTENT,params.get('key'))?params.get('key'):'special_piece';
const width=[320,375,430].includes(+params.get('width'))?+params.get('width'):320;
const height={320:568,375:812,430:932}[width];
for(const k of Object.keys(Guide.CONTENT)) {
  const a=document.createElement('a');a.href='?key='+k+'&width='+width;a.textContent=Guide.CONTENT[k].title;keys.append(a);
}
for(const w of [320,375,430]) {
  const a=document.createElement('a');a.href='?key='+key+'&width='+w;a.textContent=w+'px';sizes.append(a);
}
load('js/render/assets.js').preload(()=>{
  const c=document.getElementById('game');c.width=width*2;c.height=height*2;c.style.width=width+'px';c.style.height=height+'px';
  const ctx=c.getContext('2d');ctx.scale(2,2);
  const screen={width,height,safeTop:44,contentTop:88,safeBottom:34,reduceEffects:false};
  if(key==='pvp_wait') load('js/render/battle-ui.js').drawWait(ctx,screen,{myReady:false,oppJoined:false,items:{freeze:1,disturb:2},isHost:true});
  else {
    load('js/core/config.js').GAME_CONFIG.mode='normal';
    const Board=load('js/render/board-render.js'),Core=load('js/core/game-core.js');
    const board=new Board(ctx,screen);
    board.setGame(new Core({id:5,rows:8,columns:8,moveCount:25,goals:[{type:'score',target:3600}]},{}));
    board.draw();
  }
  Guide.draw(ctx,screen,key);
  document.title=Guide.CONTENT[key].title+' · '+width+'px · 本地夹具';
});`;
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/') {res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
  if(url.pathname==='/fixture.js') {res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(script);return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{
    res.statusCode=err?404:200;
    const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[path.extname(file)];
    if(mime) res.setHeader('Content-Type',mime);
    res.end(err?'missing':data);
  });
}).listen(0,'127.0.0.1',function(){console.log('Guide preview: http://127.0.0.1:'+this.address().port);});
