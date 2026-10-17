'use strict';
// Offline component preview: real Canvas renderers/content, illustrative scores, no account or cloud.
const fs = require('fs'), path = require('path'), http = require('http');
const root = path.resolve(__dirname, '../match3-wechat');
const out = path.resolve(__dirname, '../assets/_incoming/solo-goal-rings-20261017/no-caption');
const sources = {};
function collect(file) {
    const id = path.relative(root, file).replaceAll('\\', '/');
    if (sources[id]) return;
    sources[id] = fs.readFileSync(file, 'utf8');
    for (const m of sources[id].matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        if (m[1].startsWith('.')) collect(path.resolve(path.dirname(file), m[1] + '.js'));
    }
}
['render/battle-ui', 'render/board-render', 'core/game-core', 'core/level'].forEach(id => collect(path.join(root, 'js', id + '.js')));
const html = `<!doctype html><meta charset="utf-8"><title>C方案 · 目标进度圆环 · 本地预览</title>
<style>body{margin:16px;background:#e9ebf5;color:#353d69;font:14px system-ui}nav{line-height:2.8}button,a,label{margin-right:10px}button,select{font:inherit;padding:6px}main{display:flex;gap:24px;align-items:start;flex-wrap:wrap}h2{font-size:17px}canvas{display:block}output{display:block;padding:12px 0;white-space:pre-line}</style>
<nav><a href="?width=320">320</a><a href="?width=390">390</a><a href="?width=430">430</a>
<label>单人关卡 <select id="level"><option value="1">1 · 分数</option><option value="2">2 · 猫咪收集</option><option value="12">12 · 收集与毛线</option><option value="16">16 · 双目标</option><option value="100">100 · 三目标</option><option value="30">30 · 花苞与配送</option><option value="1-half">1 · 分数进度一半</option><option value="1-done">1 · 分数完成</option><option value="2-half">2 · 收集进度一半</option><option value="16-half">16 · 双目标部分进度</option><option value="30-partial">30 · 部分进度</option><option value="30-one">30 · 单项目标完成</option><option value="100-one">100 · 单项目标完成</option><option value="30-closed">30 · 花苞闭合</option><option value="30-hit">30 · 闭合受击反馈</option><option value="30-done">30 · 目标完成</option><option value="100-done">100 · 目标完成</option><option value="100-warning">100 · 最后9秒</option><option value="stress">长分数 / 高关卡 / 少步数</option></select></label>
<label>双人状态 <select id="mode"><option value="normal">正常</option><option value="cooling">冷却</option><option value="frozen">冰冻</option><option value="effects">干扰 / 反弹 / 鼓舞</option><option value="warning">30秒提醒</option><option value="urgent">最后8秒</option><option value="settling">成绩确认</option><option value="large">长比分</option><option value="legacy">旧房间</option></select></label>
<button id="save">保存两张实际画面</button><button id="batch">保存本轮检查画面</button></nav>
<p>C方案圆环 · 部分进度/完成为内存示例 · 单人下方保留原方案；双人使用横排无框道具 · 不连接云端</p>
<main><section><h2>单人闯关</h2><canvas id="solo"></canvas></section><section><h2>双人对战</h2><canvas id="pvp"></canvas></section></main><output>正在加载资源…</output><script src="/fixture.js"></script>`;
const script = `
const sources=${JSON.stringify(sources)},cache={},params=new URLSearchParams(location.search);
window.wx={createImage:()=>new Image()};
function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};
 const req=relative=>{const p=id.split('/');p.pop();relative.split('/').forEach(x=>x==='..'?p.pop():x!=='.'&&p.push(x));return load(p.join('/')+'.js');};
 new Function('require','module','exports',sources[id])(req,m,m.exports);return m.exports;}
const Battle=load('js/render/battle-ui.js'),Board=load('js/render/board-render.js'),Game=load('js/core/game-core.js');
const levels=load('js/core/level.js'),assets=load('js/render/assets.js');
const width=+(params.get('width')||390),height=width===320?568:width===430?932:844;
const screen={width,height,contentTop:+(params.get('top')||91),safeTop:47,safeBottom:34,reduceEffects:params.get('reduce')==='1'};
const canvases={},boards={};
for(const key of ['solo','pvp']) {const c=canvases[key]=document.querySelector('#'+key);c.width=width*2;c.height=height*2;c.style.width=width+'px';c.style.height=height+'px';const ctx=c.getContext('2d');ctx.scale(2,2);boards[key]=new Board(ctx,screen);}
const pvp=boards.pvp;pvp.battleMode=true;pvp.pvpLayout=true;
pvp.setGame(new Game({id:0,rows:8,columns:8,moveCount:999,goals:[{type:'score',target:99999}]},{}));
function solo(id) {
 id=String(id);const base=id==='stress'?1:+id.split('-')[0],game=new Game(levels.getLevel(base),{});
 game.score=id==='stress'?999999999:840;
 if(id==='stress'){game.level.id=123456;game.movesLeft=3;}
 if(id==='30-closed')game.moonbudOpen=false;
 if(id.endsWith('-half')||id==='30-partial'){
  game.score=500;
  for(const goal of game.level.goals)if(goal.type==='collect')game.collectedCounts[goal.pieceType]=Math.floor(goal.target/2);
  let jelly=Math.floor(game.jellyTotal/2);game.jellyGrid.forEach(r=>r.forEach((v,c)=>{const hit=Math.min(v,jelly);r[c]-=hit;jelly-=hit;}));
  let ice=0;game.iceGrid.forEach(r=>r.forEach((v,c)=>{if(v&&ice++%2===0)r[c]=0;}));
  Object.keys(game.moonbudCells).slice(0,2).forEach(k=>delete game.moonbudCells[k]);
  if(game.yarnSource)game.yarnSource.health=1;
 }
 if(id==='30-one')game.iceGrid.forEach(r=>r.fill(0));
 if(id==='100-one')game.jellyGrid.forEach(r=>r.fill(0));
 if(id.endsWith('-done'))for(const goal of game.level.goals){if(goal.type==='collect')game.collectedCounts[goal.pieceType]=goal.target;if(goal.type==='score')game.score=goal.target;}
 if(id.endsWith('-done')){game.jellyGrid.forEach(r=>r.fill(0));game.iceGrid.forEach(r=>r.fill(0));game.moonbudCells={};game.parcelDelivered=game.parcelTotal;if(game.yarnSource)game.yarnSource.health=0;game.yarnVines={};game.grid.forEach(r=>r.forEach((v,c)=>{if(v===201)r[c]=2;}));}
 if(id==='100-warning'){game.timeLimitMs=60000;game.timeLeftMs=9000;}
 boards.solo.setGame(game);if(id==='30-hit')boards.solo.moonbudFeedback={kind:'closedHit',elapsed:0,duration:1800};
 boards.solo.setTools({hammer:2,bomb:1,color:0});boards.solo.draw();
}
function pvpDraw(mode) {const ctx=pvp.ctx;pvp.draw();
 Battle.drawTop(ctx,screen,{protocolVersion:mode==='legacy'?1:2,roundNumber:3,myWins:2,oppWins:1,myScore:mode==='large'?999999999:2480,oppScore:mode==='large'?999999999:1960,timeLeft:mode==='urgent'?8:mode==='settling'?0:mode==='warning'?30:42,settling:mode==='settling'});
 Battle.drawItems(ctx,screen,{itemRulesVersion:mode==='legacy'?1:3,freeze:2,disturb:1,reflect:1,cheer:1,cooldownRemaining:mode==='cooling'?4200:0,settling:mode==='settling',pending:mode==='settling',frozen:mode==='frozen'});
 if(mode==='warning')Battle.drawWarning(ctx,screen);
 if(mode==='frozen'||mode==='effects') Battle.drawEffects(ctx,screen,{itemRulesVersion:3,boardX:pvp.boardX,boardY:pvp.boardY,boardW:pvp.boardW,boardH:pvp.boardH,frozen:mode==='frozen',frozenRemaining:2500,disturb:mode==='effects',disturbRemaining:4000,reflectRemaining:mode==='effects'?4500:0,cheerRemaining:mode==='effects'?3500:0,castNotice:mode==='effects'?'cheer':null});
}
async function save(key,state){const res=await fetch('/capture?name='+key+'-'+state+'-'+width,{method:'POST',body:canvases[key].toDataURL('image/png')});if(!res.ok)throw new Error('capture '+res.status);return res.text();}
document.querySelector('#level').onchange=e=>solo(e.target.value);
document.querySelector('#mode').onchange=e=>pvpDraw(e.target.value);
document.querySelector('#save').onclick=async()=>{document.querySelector('output').textContent=await save('solo',document.querySelector('#level').value)+'\\n'+await save('pvp',document.querySelector('#mode').value);};
document.querySelector('#batch').onclick=async()=>{const names=[];for(const id of [1,2,12,16,100,30,'1-half','1-done','2-half','16-half','30-partial','30-one','30-closed','30-hit','30-done','100-one','100-done','100-warning','stress']){solo(id);names.push(await save('solo',id));}for(const mode of ['normal']){pvpDraw(mode);names.push(await save('pvp',mode));}solo(document.querySelector('#level').value);pvpDraw(document.querySelector('#mode').value);document.querySelector('output').textContent=names.join('\\n');};
assets.preload(()=>{solo(1);pvpDraw('normal');document.querySelector('output').textContent='资源已加载 · '+width+'×'+height;});
`;
const server = http.createServer(async (req,res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method==='POST' && url.pathname==='/capture') {
        const name=url.searchParams.get('name');
        if (!/^(solo-(1|2|12|16|100|30|1-half|1-done|2-half|16-half|30-partial|30-one|30-closed|30-hit|30-done|100-one|100-done|100-warning|stress)|pvp-(normal|cooling|frozen|effects|warning|urgent|settling|large|legacy))-(320|390|430)$/.test(name||'')) {res.writeHead(400);res.end();return;}
        const chunks=[];let size=0;
        for await(const chunk of req) {size+=chunk.length;if(size>8*1024*1024){res.writeHead(413);res.end();return;}chunks.push(chunk);}
        const data=Buffer.concat(chunks).toString();
        if(!data.startsWith('data:image/png;base64,')){res.writeHead(400);res.end();return;}
        fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.slice(22),'base64'));
        res.end(name+'.png');return;
    }
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
    if(url.pathname==='/fixture.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(script);return;}
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
    fs.readFile(file,(e,data)=>{res.statusCode=e?404:200;res.end(e?'':data);});
});
server.listen(Number(process.argv[2])||0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
