'use strict';
// Local-only synthetic material comparison. No Main, persistence, cloud or gameplay input.
const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../match3-wechat');
const out = path.resolve(__dirname, '../assets/_incoming/obstacle-materials-20261020');
const sources = {};
function collect(file) {
    const id = path.relative(root, file).replaceAll('\\', '/');
    if (sources[id]) return;
    sources[id] = fs.readFileSync(file, 'utf8');
    for (const match of sources[id].matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        if (match[1].startsWith('.')) collect(path.resolve(path.dirname(file), match[1] + '.js'));
    }
}
['render/board-render', 'core/game-core'].forEach(id => collect(path.join(root, 'js', id + '.js')));
const states = ['open-3', 'closed-3', 'open-2', 'closed-2', 'open-1', 'closed-1'];
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>局内障碍 · 现状 / 细节材质候选</title>
<style>body{margin:20px;background:#e9ebf5;color:#353d69;font:14px system-ui}nav{display:flex;gap:14px;flex-wrap:wrap;align-items:center}button,select{font:inherit;padding:8px}main{display:flex;gap:24px;align-items:start;flex-wrap:wrap}h2{font-size:17px}canvas{display:block;box-shadow:0 8px 24px #353d6922}output{display:block;white-space:pre-line;padding:14px 0}.note{max-width:940px;line-height:1.8}button:disabled{opacity:.5}@media(max-width:900px){main section.candidate{order:-1}}</style>
<nav><label>屏幕 <select id="width"><option value="320">320 × 568</option><option value="390" selected>390 × 844</option><option value="430">430 × 932</option></select></label>
<label>花苞 / 毛线源头 <select id="state">${states.map(s => `<option value="${s}">${s.startsWith('open') ? '展开' : '闭合'} · 耐久 ${s.slice(-1)}</option>`).join('')}</select></label>
<button id="save" disabled>保存当前两张</button><button id="batch" disabled>保存全部屏幕与状态（36张）</button></nav>
<p class="note">内存示例，非真实关卡或受击验证。两种材质使用同一固定 8×8 棋盘；窄窗口优先显示新材质。第1行：单层果冻五色；第2行：双层果冻五色；第3行：冰块五色；第4行：花苞五色；第5行：毛线源头＋藤蔓五色；底行：配送包裹与真实出口。其余为普通猫咪对照。</p>
<main><section><h2>对照 · 当前实际 Board</h2><canvas id="current"></canvas></section><section class="candidate"><h2>新材质 · 局内障碍预览</h2><canvas id="candidate"></canvas></section></main><output>正在加载本地实际资源…</output><script src="/fixture.js"></script></html>`;
const script = `
'use strict';
const sources=${JSON.stringify(sources)},states=${JSON.stringify(states)};
window.wx={createImage:()=>new Image(),createCanvas:()=>document.createElement('canvas')};
function moduleSet(){const cache={};return function load(id){if(cache[id])return cache[id].exports;
 const m=cache[id]={exports:{}};const req=relative=>{const p=id.split('/');p.pop();relative.split('/').forEach(x=>x==='..'?p.pop():x!=='.'&&p.push(x));return load(p.join('/')+'.js');};
 if(!sources[id])throw Error('Missing module '+id);new Function('require','module','exports',sources[id])(req,m,m.exports);return m.exports;};}
const loaders={current:moduleSet(),candidate:moduleSet()},canvases={},boards={},images={};
const CurrentBoard=loaders.current('js/render/board-render.js');
const CandidateBoard=loaders.candidate('js/render/board-render.js');
const Game=loaders.current('js/core/game-core.js');
const type=loaders.candidate('js/render/typography.js');
const assetModule=loaders.current('js/render/assets.js');
for(const side of Object.keys(loaders))loaders[side]('js/render/assets.js').get=key=>images[key];
let width=390,height=844,selectedState='open-3',ready=false;
const status=document.querySelector('output');
// Jelly and flower centres stay clear; ice uses the complete crystal artwork.
function rounded(ctx,x,y,w,h,r){ctx.roundRect(x,y,w,h,r);}
function cell(ctx,x,y,s,draw){ctx.save();ctx.beginPath();ctx.rect(x-s/2+1,y-s/2+1,s-2,s-2);ctx.clip();draw();ctx.restore();}
function art(ctx,index,x,y,s,alpha=1){ctx.save();ctx.globalAlpha*=alpha;ctx.drawImage(images.atlas,index%3*160,Math.floor(index/3)*160,160,160,x-s/2,y-s/2,s,s);ctx.restore();}
function artRim(ctx,index,x,y,s,inner,alpha=1){ctx.save();ctx.beginPath();ctx.rect(x-s/2,y-s/2,s,s);rounded(ctx,x-inner*s/2,y-inner*s/2,inner*s,inner*s,s*.13);ctx.clip('evenodd');art(ctx,index,x,y,s,alpha);ctx.restore();}
function glassRim(ctx,x,y,s,colors,inner=.66){
 const grad=ctx.createLinearGradient(x-s*.4,y-s*.45,x+s*.4,y+s*.45);colors.forEach((c,i)=>grad.addColorStop(i/(colors.length-1),c));
 ctx.beginPath();rounded(ctx,x-s*.435,y-s*.435,s*.87,s*.87,s*.19);rounded(ctx,x-s*inner/2,y-s*inner/2,s*inner,s*inner,s*.13);ctx.fillStyle=grad;ctx.fill('evenodd');
 ctx.beginPath();rounded(ctx,x-s*.425,y-s*.425,s*.85,s*.85,s*.18);ctx.strokeStyle=colors[0];ctx.lineWidth=s*.018;ctx.stroke();
 ctx.beginPath();ctx.moveTo(x-s*.29,y-s*.39);ctx.lineTo(x+s*.16,y-s*.39);ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=s*.026;ctx.lineCap='round';ctx.stroke();
}
function badge(ctx,x,y,s,text,color){ctx.save();ctx.beginPath();ctx.arc(x,y,s*.132,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#fff0eb';ctx.lineWidth=s*.024;ctx.stroke();ctx.fillStyle='#fff8ef';type.drawFit(ctx,String(text),x,y+s*.008,s*.22,{size:s*.22,minSize:8,weight:'bold',numbers:/^[0-9]+$/.test(String(text)),align:'center'});ctx.restore();}
function jelly(ctx,x,y,s,layers,underlay){cell(ctx,x,y,s,()=>{
 if(underlay){art(ctx,0,x,y,s*.96,.22);return;}
 glassRim(ctx,x,y,s,layers>1?['#fff0ff','#d8a0df','#794187','#cc85c2']:['#fff4fa','#ffc3db','#ce689a','#faabd0']);
 artRim(ctx,0,x,y,s*.98,.67,.94);
 if(layers>1){ctx.beginPath();rounded(ctx,x-s*.34,y-s*.34,s*.68,s*.68,s*.13);ctx.strokeStyle='#7e448d';ctx.lineWidth=s*.035;ctx.stroke();ctx.strokeStyle='#f5c9f8';ctx.lineWidth=s*.014;ctx.stroke();badge(ctx,x-s*.30,y-s*.30,s,2,'#743a87');}
 });}
function ice(ctx,x,y,s){cell(ctx,x,y,s,()=>{
 art(ctx,2,x,y,s*.98);
 });}
function yarn(ctx,x,y,s,root,health){cell(ctx,x,y,s,()=>{
 for(let i=0;i<4;i++){ctx.beginPath();rounded(ctx,x-s*(.43-i*.013),y-s*(.43-i*.013),s*(.86-i*.026),s*(.86-i*.026),s*(.18+i*.01));ctx.strokeStyle=['#61416f','#e0b7f3','#9e73ba','#f8e2ff'][i];ctx.lineWidth=s*.024;ctx.stroke();}
 ctx.strokeStyle='#edcf9b';ctx.lineWidth=s*.023;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-s*.36,y+s*.04);ctx.bezierCurveTo(x-s*.28,y+s*.32,x+s*.03,y+s*.38,x+s*.30,y+s*.33);ctx.stroke();
 if(root){art(ctx,1,x-s*.24,y+s*.23,s*.46);badge(ctx,x+s*.29,y-s*.29,s,health,'#63417e');}
 else {ctx.strokeStyle='#fff0c2';ctx.lineWidth=s*.024;ctx.beginPath();ctx.moveTo(x-s*.39,y-s*.22);ctx.bezierCurveTo(x-s*.43,y-s*.42,x-s*.08,y-s*.40,x-s*.12,y-s*.30);ctx.stroke();}
 });}
function moonbudStateLabel(ctx,x,y,s,open){
 // Fixed native size; the outer stroke stays 1.4px inside the cell edge.
 const w=10,h=10,cx=x+s/2-1.75-w/2,cy=y+s/2-1.75-h/2;
 ctx.save();ctx.beginPath();rounded(ctx,cx-w/2,cy-h/2,w,h,2.5);ctx.fillStyle=open?'#fff0c7':'#4f467d';ctx.fill();ctx.strokeStyle=open?'#ae6386':'#e5d9fa';ctx.lineWidth=.7;ctx.stroke();
 ctx.fillStyle=open?'#95476e':'#fff8ff';type.drawFit(ctx,open?'开':'合',cx,cy,w-2,{size:8,minSize:8,weight:'bold',align:'center'});ctx.restore();
}
function moonbud(ctx,x,y,s,open,openness,showLabel){cell(ctx,x,y,s,()=>{
 glassRim(ctx,x,y,s,open?['#fff5dd','#ffc4dc','#b96b9b','#ffe9ae']:['#ece9ff','#c3b4ee','#70578d','#d8c9f5'],.70);
 artRim(ctx,3,x,y,s*.99,open?.69:.66,open?1:.72);
 // Open petals are broad and face outward; closed petals form narrow upright tips.
 for(let i=0;i<8;i++){ctx.save();ctx.translate(x,y);ctx.rotate(i*Math.PI/4);ctx.translate(0,-s*(open?.395:.385));ctx.rotate(open?Math.PI/2:(i%2?.22:-.22));
 const g=ctx.createLinearGradient(-s*.07,-s*.08,s*.06,s*.09);g.addColorStop(0,open?'#fff8e0':'#f4e9ff');g.addColorStop(.45,open?'#f8c2de':'#c7b1e6');g.addColorStop(1,open?'#d480b0':'#8371b4');ctx.fillStyle=g;ctx.strokeStyle=open?'#f9dfaa':'#e8d7ff';ctx.lineWidth=s*.015;ctx.beginPath();ctx.ellipse(0,0,s*(open?.066:.041),s*(open?.11:.095),0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
 if(showLabel!==false)moonbudStateLabel(ctx,x,y,s,open);
 });}
const newObstacles=loaders.candidate('js/render/new-obstacles-render.js');
newObstacles.moonbud=moonbud;
newObstacles.parcel=(ctx,x,y,s)=>cell(ctx,x,y,s,()=>art(ctx,4,x,y,s*.93));
function skin(board){
 // Keep original HUD icons as well as HUD/control layout; only actual in-cell materials change.
 board.drawGoalIcon=CurrentBoard.prototype.drawGoalIcon;
 board.drawPiece=function(piece,opacity){
  if(this.trackingObstacle(piece.row,piece.col,'targetIce',this.core.iceGrid[piece.row][piece.col]))return;
  CandidateBoard.prototype.drawPiece.call(this,piece,opacity);
 };
 board.drawJellies=function(){this.core.jellyGrid.forEach((row,r)=>row.forEach((v,c)=>{const n=this.trackingObstacle(r,c,'targetJelly',v);if(n){const p=this.pieceCenter(r,c);jelly(this.ctx,p.x,p.y,this.tileSize,n,true);}}));};
 board.drawJellyBadges=function(){this.core.jellyGrid.forEach((row,r)=>row.forEach((v,c)=>{const n=this.trackingObstacle(r,c,'targetJelly',v);if(n){const p=this.pieceCenter(r,c);jelly(this.ctx,p.x,p.y,this.tileSize,n,false);}}));};
 board.drawIces=function(){this.core.iceGrid.forEach((row,r)=>row.forEach((v,c)=>{if(this.trackingObstacle(r,c,'targetIce',v)){const p=this.pieceCenter(r,c);ice(this.ctx,p.x,p.y,this.tileSize);}}));};
 board.drawYarn=function(){const source=this.core.yarnSource;if(!source)return;const hp=this.trackingObstacle(source.row,source.column,'targetYarnHealth',source.health);if(hp<=0)return;
 const vines=Object.assign({},this.core.yarnVines);this.specialEffects.forEach(e=>{if(e.targetYarnVine&&e.target&&e.life/e.maxLife<.64)vines[e.target.row+':'+e.target.column]=true;});
 const p=this.pieceCenter(source.row,source.column);yarn(this.ctx,p.x,p.y,this.tileSize,true,hp);Object.keys(vines).forEach(key=>{const rc=key.split(':').map(Number),p=this.pieceCenter(rc[0],rc[1]);yarn(this.ctx,p.x,p.y,this.tileSize,false,hp);});};
}
// Build one actual Game, then clone its exact frozen state into each real Board.
function synthetic(state){let seed=271828;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const underlays={},obstacles={},moonbuds=[];for(let c=0;c<5;c++){underlays['0:'+c]=1;underlays['1:'+c]=2;obstacles['2:'+c]=1;moonbuds.push('3:'+c);}
 const game=new Game({id:30,rows:8,columns:8,colorCount:5,moveCount:24,underlays,obstacles,moonbuds,yarn:{source:'4:0',health:3},parcels:[{id:'preview-parcel',row:7,column:6}],parcelExits:[6],goals:[{type:'jelly',target:15},{type:'ice',target:5},{type:'moonbud',target:5}]},{},random);
 game.grid=Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r*2+c)%5+1));
 // Each material row presents all five cat colours in the same left-to-right order.
 for(let r=0;r<5;r++)for(let c=0;c<5;c++)game.grid[r][c]=c+1;
 game.grid[7][6]=201;game.yarnVines={'4:1':true,'4:2':true,'4:3':true,'4:4':true};game.yarnSource.health=+state.slice(-1);game.moonbudOpen=state.startsWith('open');game.score=840;delete game.random;
 return JSON.stringify(game);}
function draw(w,state){width=+w;height={320:568,390:844,430:932}[width];selectedState=state;
 const snapshot=synthetic(state);for(const side of ['current','candidate']){const c=canvases[side]||(canvases[side]=document.querySelector('#'+side));c.width=width*2;c.height=height*2;c.style.width=width+'px';c.style.height=height+'px';
 const ctx=c.getContext('2d');ctx.scale(2,2);const screen={width,height,contentTop:91,safeTop:47,safeBottom:34};const Board=side==='current'?CurrentBoard:CandidateBoard;const board=boards[side]=new Board(ctx,screen);
 const core=Object.assign(Object.create(Game.prototype),JSON.parse(snapshot));board.setGame(core);board.setTools({hammer:2,bomb:1,color:0});if(side==='candidate')skin(board);board.draw();}
 if(JSON.stringify(boards.current.core)!==JSON.stringify(boards.candidate.core))throw Error('Comparison state mismatch');
 status.textContent='已加载本地实际 Board / GameCore / 图集 · '+width+'×'+height+' · '+state+' · 左右数据一致 · 2×输出。示例不能证明受击、交换或真实关卡表现。';}
async function capture(side,state,w){const name=side+'-'+state+'-'+w;const response=await fetch('/capture?name='+name,{method:'POST',headers:{'Content-Type':'text/plain'},body:canvases[side].toDataURL('image/png')});if(!response.ok)throw Error('保存失败 '+response.status);return response.text();}
function controls(disabled){document.querySelectorAll('button,select').forEach(e=>e.disabled=disabled);}
async function saveAll(batch){controls(true);try{const names=[];const originalWidth=width,originalState=selectedState;for(const w of batch?[320,390,430]:[width])for(const state of batch?states:[selectedState]){draw(w,state);for(const side of ['current','candidate'])names.push(await capture(side,state,w));}draw(originalWidth,originalState);status.textContent+='\\n已保存：\\n'+names.join('\\n');}catch(e){status.textContent=e.stack;}finally{controls(false);}}
for(const id of ['width','state'])document.querySelector('#'+id).onchange=()=>{if(ready)draw(document.querySelector('#width').value,document.querySelector('#state').value);};
document.querySelector('#save').onclick=()=>saveAll(false);document.querySelector('#batch').onclick=()=>saveAll(true);
async function imageAt(src){return new Promise((resolve,reject)=>{const img=wx.createImage();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('资源读取失败：'+src));img.src='/'+src;});}
(async()=>{try{const keys=['gameBackground','piece1','piece2','piece3','piece4','piece5','uiToolHammer','uiToolBomb','uiToolYarn'];await Promise.all(keys.map(async key=>{images[key]=await imageAt(assetModule.ASSETS[key]);}));images.atlas=await imageAt('result-art/goal-icons.png');if(images.atlas.width!==480||images.atlas.height!==320)throw Error('图集尺寸与约定不符');const p=new URLSearchParams(location.search),w=p.get('width'),state=p.get('state');if(['320','390','430'].includes(w))document.querySelector('#width').value=w;if(states.includes(state))document.querySelector('#state').value=state;ready=true;draw(document.querySelector('#width').value,document.querySelector('#state').value);controls(false);}catch(e){status.textContent=e.stack;}})();
window.obstaclePreview={boards,canvases,states,draw};
`;
const capturePattern = /^(current|candidate)-(open|closed)-[123]-(320|390|430)$/;
const allowedAssets = new Set(['res/home/moonlit-garden-bg.jpg', ...[1,2,3,4,5].map(n => 'res/piece'+n+'-runtime.png'), 'res/ui/tool-hammer.png', 'res/ui/tool-bomb.png', 'res/ui/tool-yarn.png', 'result-art/goal-icons.png']);
const server = http.createServer(async (req,res) => {
    try {
        const url = new URL(req.url, 'http://localhost');
        if (req.method === 'POST' && url.pathname === '/capture') {
            const name = url.searchParams.get('name');
            if (!capturePattern.test(name || '')) { res.writeHead(400); res.end('Invalid capture name'); return; }
            const chunks = []; let size = 0;
            for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) { res.writeHead(413); res.end('Too large'); return; } chunks.push(chunk); }
            const data = Buffer.concat(chunks).toString();
            if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) { res.writeHead(400); res.end('Expected PNG data URL'); return; }
            const png = Buffer.from(data.slice(22), 'base64');
            if (!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) { res.writeHead(400); res.end('Expected PNG'); return; }
            fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, name + '.png'), png); res.end(name + '.png'); return;
        }
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
        if (url.pathname === '/') { res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(html); return; }
        if (url.pathname === '/fixture.js') { res.setHeader('Content-Type','text/javascript; charset=utf-8'); res.end(script); return; }
        const asset = decodeURIComponent(url.pathname).slice(1);
        if (!allowedAssets.has(asset)) { res.writeHead(404); res.end(); return; }
        res.setHeader('Content-Type',asset.endsWith('.png')?'image/png':'image/jpeg');
        fs.readFile(path.join(root,asset),(error,data)=>{res.statusCode=error?404:200;res.end(error?'':data);});
    } catch (error) { res.writeHead(500); res.end('Local preview error'); }
});
server.listen(Number(process.argv[2]) || 0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
