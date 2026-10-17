'use strict';
// Display-only state sheet. Every cell is drawn by the production BoardRenderer;
// separate scenes avoid representing all five families as one playable level.
const fs = require('fs');
const path = require('path');
const http = require('http');
const root = path.resolve(__dirname, '../match3-wechat');
const output = '/Users/Admin/.codex/visualizations/2026/09/22/01a0c8a3-ec80-7822-8c68-0c664131efc0/all-obstacles-20261003.png';
const sources = {};
function collect(file) {
    const id = path.relative(root, file).replaceAll('\\', '/');
    if (sources[id]) return;
    sources[id] = fs.readFileSync(file, 'utf8');
    for (const match of sources[id].matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        if (match[1].startsWith('.')) collect(path.resolve(path.dirname(file), match[1] + '.js'));
    }
}
collect(path.join(root, 'js/core/game-core.js'));
collect(path.join(root, 'js/render/board-render.js'));
const html = `<!doctype html><meta charset="utf-8"><title>五类障碍 · 游戏实际渲染</title>
<style>body{margin:0;background:#e6e5f3}canvas{display:block;width:min(100%,1080px);height:auto;margin:auto}</style>
<canvas id="atlas" width="2160" height="2940"></canvas><a id="download" download="all-obstacles.png">下载完整原图</a><script src="/atlas.js"></script>`;
const script = `
const sources=${JSON.stringify(sources)},cache={};
window.wx={createImage:()=>new Image(),getStorageSync:()=>false};
function load(id){
 if(cache[id])return cache[id].exports;
 const m=cache[id]={exports:{}};
 const req=rel=>{const parts=id.split('/');parts.pop();rel.split('/').forEach(p=>p==='..'?parts.pop():p!=='.'&&parts.push(p));return load(parts.join('/')+'.js');};
 new Function('require','module','exports',sources[id])(req,m,m.exports);return m.exports;
}
const Core=load('js/core/game-core.js'),Board=load('js/render/board-render.js'),assets=load('js/render/assets.js');
const canvas=document.getElementById('atlas'),ctx=canvas.getContext('2d');ctx.scale(2,2);
const font='"PingFang SC","Microsoft YaHei",sans-serif';
function text(s,x,y,size,color,weight='normal',align='left'){
 ctx.font=weight+' '+size+'px '+font;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(s,x,y);
}
function card(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function scene(kind,state){
 const level={rows:8,columns:8,moveCount:24,pieceTypes:[1,2,3,4,5],goals:[{type:'score',target:99999}],underlays:{},obstacles:{},moonbuds:[],parcels:[],parcelExits:[]};
 if(kind==='jelly'&&state)level.underlays={'3:3':state};
 if(kind==='ice'&&state)level.obstacles={'3:3':1};
 if(kind==='yarn')level.yarn={source:'3:3',health:3,spreadEvery:2,maxVines:3};
 if(kind==='bud')level.moonbuds=['3:3'];
 if(kind==='parcel'){level.parcels=[{id:'atlas',row:6,column:3}];level.parcelExits=[3];}
 const core=new Core(level,{});
 if(kind==='jelly'&&core.jellyGrid[3][3]!==state)throw new Error('Jelly display state mismatch');
 core.grid=Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r*2+c)%5+1));core.grid[3][3]=2;
 let row=3,column=3,cropRows=1;
 if(kind==='yarn'){
  if(state==='vine'){core.yarnVines={'3:4':true};core.grid[3][4]=2;column=4;}
  else core.yarnSource.health=state;
 }
 if(kind==='bud'){core.moonbudOpen=state==='open';if(state==='gone')core.moonbudCells={};}
 if(kind==='parcel'){
  row=6;cropRows=2;core.grid[6][3]=201;
  if(state==='ready'){core.grid[7][3]=0;}
  if(state==='delivered'){core.grid[6][3]=0;core.grid[7][3]=0;core.parcels=[];core.parcelDelivered=1;}
 }
 const surface=document.createElement('canvas');surface.width=1440;surface.height=1480;
 const paint=surface.getContext('2d');paint.scale(2,2);
 const board=new Board(paint,{width:704,height:1080,reduceEffects:true});board.setGame(core);
 Object.assign(board,{tileSize:84,boardX:20,boardY:20,boardW:672,boardH:672});board.syncPiecesFromGrid();board.drawBoard();
 return {surface,sx:(20+column*84)*2,sy:(20+row*84)*2,sw:168,sh:168*cropRows,cropRows};
}
function cell(kind,state,label,x,y){
 const s=scene(kind,state),wide=kind==='parcel'?76:98,tall=wide*s.cropRows;
 card(x-6,y-6,wide+12,tall+12,12,'#202540','#50547b');
 ctx.drawImage(s.surface,s.sx,s.sy,s.sw,s.sh,x,y,wide,tall);
 text(label,x+wide/2,y+tall+25,16,'#4c456d','500','center');
}
function render(){
 const bg=ctx.createLinearGradient(0,0,1080,1470);bg.addColorStop(0,'#f5eafa');bg.addColorStop(.5,'#e6edf9');bg.addColorStop(1,'#e4dff3');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1470);
 text('猫猫开心消',48,51,17,'#746886','600');
 text('五类障碍 · 画面表现',48,101,36,'#302849','600');
 text('现有游戏渲染 · 放大状态对照',48,147,19,'#716586');
 const rows=[
  {name:'果冻',sub:'柔软糖衣，固定在格子上',kind:'jelly',states:[2,1,0],labels:['双层 · 2','剩一层','已清除'],rule:['在该格消除猫咪，破除一层。','深紫外缘与“2”角标表示双层。'],y:194},
  {name:'冰块',sub:'冰蓝罩层，锁住格中猫咪',kind:'ice',states:[1,0],labels:['冰封中','破冰后'],rule:['相邻消除或特殊棋子命中可破冰。','冰块消失，原来的猫咪仍保留。'],y:427},
  {name:'蔓延毛线',sub:'源头有耐久，藤蔓没有数字',kind:'yarn',states:[3,1,'vine',0],labels:['源头 · 3','源头 · 1','蔓延格','解开后'],rule:['源头：紫金边框与剩余耐久。','蔓延格：金色边框；解开源头清除藤蔓。'],y:660},
  {name:'月相花苞',sub:'开合轮换，花框与猫咪同格',kind:'bud',states:['open','closed','gone'],labels:['开放 · 可收集','闭合 · 保留','已收集'],rule:['开放时消除该格猫咪，可收走花苞。','闭合时仅猫咪消除，花苞保留。'],y:893},
  {name:'小鱼干包裹',sub:'独立棋子，沿同列送到出口',kind:'parcel',states:['waiting','ready','delivered'],labels:['下方被挡住','清出路径','送达后'],rule:['包裹不可交换，也不会被消除。','清理下方，竖直落到金色出口。'],y:1126}
 ];
 rows.forEach((r,i)=>{
  card(32,r.y,1016,i===4?258:213,24,'rgba(255,255,255,.67)','#ffffff');
  text(String(i+1).padStart(2,'0'),52,r.y+35,15,'#9a7ba3','600');text(r.name,94,r.y+35,24,'#392a50','600');
  text(r.sub,54,r.y+72,16,'#84768e');
  const start=310,gap=r.kind==='yarn'?125:143;
  r.states.forEach((s,j)=>cell(r.kind,s,r.labels[j],start+j*gap,r.y+(r.kind==='parcel'?30:60)));
  const ruleX=r.kind==='yarn'?823:782;
  // Long rule lines are split intentionally; no scaled text or truncation.
  const copy=r.kind==='jelly'?['消除该格猫咪，','破除一层果冻。','深紫外缘与“2”角标','表示双层。']:
   r.kind==='ice'?['相邻消除或特殊命中','可以破冰。','冰块消失后，','原来的猫咪仍保留。']:
   r.kind==='yarn'?['紫金边框：源头','金色边框：蔓延格','解开源头，','藤蔓一起消失。']:
   r.kind==='bud'?['开：消除该格猫咪','可收走花苞。','合：猫照常消除，','花苞继续保留。']:
   ['包裹不可交换、','不会被消除。','清理下方，竖直落到','金色箭头出口。'];
  copy.forEach((line,j)=>text(line,ruleX,r.y+62+j*29,17,'#655472'));
 });
 text('各状态由独立场景展示；此页不代表五类障碍会同时出现在同一关。',48,1427,16,'#7c6c88');
 canvas.toBlob(blob=>fetch('/snapshot',{method:'POST',body:blob}).then(response=>{
  if(!response.ok)throw new Error('PNG export failed');
  document.getElementById('download').href='/all-obstacles.png';window.atlasReady=true;
 }),'image/png');
}
assets.preload(render);
`;
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
 if(url.pathname==='/atlas.js'){res.setHeader('Content-Type','text/javascript');res.end(script);return;}
 if(url.pathname==='/snapshot'&&req.method==='POST'){
  const chunks=[];let bytes=0;
  req.on('data',chunk=>{bytes+=chunk.length;if(bytes>4000000)req.destroy();else chunks.push(chunk);});
  req.on('end',()=>fs.writeFile(output,Buffer.concat(chunks),err=>{res.statusCode=err?500:200;res.end(err?'save failed':'saved');}));return;
 }
 if(url.pathname==='/all-obstacles.png'){fs.readFile(output,(err,data)=>{res.statusCode=err?404:200;res.setHeader('Content-Type','image/png');res.end(err?'missing':data);});return;}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(path.join(root,'res')+path.sep)){res.writeHead(404);res.end();return;}
 fs.readFile(file,(err,data)=>{res.statusCode=err?404:200;res.setHeader('Content-Type','image/png');res.end(err?'missing':data);});
}).listen(0,'127.0.0.1',function(){console.log('Obstacle atlas: http://127.0.0.1:'+this.address().port);});
