'use strict';
// Local Canvas component preview. Synthetic scores only; no storage, accounts or cloud calls.
const fs = require('fs');
const path = require('path');
const http = require('http');
const root = path.resolve(__dirname, '../match3-wechat');
const out = path.resolve(__dirname, '../assets/_incoming/pvp-cooldowns-20261017');
const sources = {};
function collect(file) {
    const id = path.relative(root, file).replaceAll('\\', '/');
    if (sources[id]) return;
    sources[id] = fs.readFileSync(file, 'utf8');
    for (const match of sources[id].matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        if (match[1].startsWith('.')) collect(path.resolve(path.dirname(file), match[1] + '.js'));
    }
}
['render/battle-ui', 'render/board-render', 'core/game-core'].forEach(id => collect(path.join(root, 'js', id + '.js')));
const html = `<!doctype html><meta charset="utf-8"><title>对战记分牌 · 本地设计预览</title>
<style>body{margin:16px;background:#e9ebf5;color:#353d69;font:14px system-ui}nav{max-width:700px;line-height:2.6}button,a{margin-right:8px}button,select{font:inherit;padding:6px}canvas{display:block;margin-top:12px}p{max-width:650px}</style>
<nav><a href="?width=320&height=568">320</a><a href="?width=390&height=844">390</a><a href="?width=430&height=932">430</a>
<select id="mode"><option value="normal">正常对局</option><option value="cooldowns">独立冷却</option><option value="countdown">10秒倒计时</option><option value="warning">30秒提醒</option><option value="urgent">最后8秒</option><option value="settling">成绩确认</option><option value="large">长比分</option><option value="legacy">旧房间</option><option value="effects">效果提示</option></select><button id="save">保存当前画面</button></nav>
<p>仅本地视觉预览 · 比分为示例 · 棋盘和状态栏使用真实渲染模块</p><canvas></canvas><output></output><script src="/fixture.js"></script>`;
const script = `
const sources=${JSON.stringify(sources)},cache={},params=new URLSearchParams(location.search);
const width=+(params.get('width')||390),height=+(params.get('height')||844),canvas=document.querySelector('canvas');
window.wx={createImage:()=>new Image()};
function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};
 const req=relative=>{const p=id.split('/');p.pop();relative.split('/').forEach(x=>x==='..'?p.pop():x!=='.'&&p.push(x));return load(p.join('/')+'.js');};
 new Function('require','module','exports',sources[id])(req,m,m.exports);return m.exports;}
const BattleUI=load('js/render/battle-ui.js'),Board=load('js/render/board-render.js'),Game=load('js/core/game-core.js');
const assets=load('js/render/assets.js'),ctx=canvas.getContext('2d'),screen={width,height,contentTop:+(params.get('top')||91),safeTop:47,safeBottom:34,reduceEffects:params.get('reduce')==='1'};
canvas.width=width*2;canvas.height=height*2;canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.scale(2,2);
const board=new Board(ctx,screen);board.battleMode=true;board.pvpLayout=true;
board.setGame(new Game({id:0,rows:8,columns:8,moveCount:999,goals:[{type:'score',target:99999}]},{}));
let countdownStart=Date.now();
function draw(){const mode=document.querySelector('#mode').value;
 board.draw();
 BattleUI.drawTop(ctx,screen,{protocolVersion:mode==='legacy'?1:2,roundNumber:3,myWins:2,oppWins:1,
   myScore:mode==='large'?999999999:2480,oppScore:mode==='large'?999999999:1960,
   timeLeft:mode==='urgent'?8:mode==='settling'?0:mode==='warning'?30:42,settling:mode==='settling'});
 const remaining=mode==='countdown'?Math.max(0,10000-(Date.now()-countdownStart)):0;
 BattleUI.drawItems(ctx,screen,{itemRulesVersion:3,freeze:2,disturb:1,reflect:1,cheer:1,
   cooldowns:{freeze:mode==='cooldowns'?8200:remaining,disturb:0,reflect:mode==='cooldowns'?3200:0,cheer:0},settling:mode==='settling',pending:mode==='settling'});
 if(mode==='warning')BattleUI.drawWarning(ctx,screen);
 if(mode==='effects')BattleUI.drawEffects(ctx,screen,{itemRulesVersion:3,boardX:board.boardX,boardY:board.boardY,boardW:board.boardW,boardH:board.boardH,
   disturb:true,disturbRemaining:4000,reflectRemaining:4500,cheerRemaining:3500,castNotice:'cheer'});
}
document.querySelector('#mode').value=params.get('mode')||'normal';document.querySelector('#mode').onchange=()=>{countdownStart=Date.now();draw();};
setInterval(()=>{if(document.querySelector('#mode').value==='countdown')draw();},100);
document.querySelector('#save').onclick=async()=>{const mode=document.querySelector('#mode').value;
 const res=await fetch('/capture?width='+width+'&mode='+mode,{method:'POST',body:canvas.toDataURL('image/png')});
 document.querySelector('output').textContent=await res.text();};
assets.preload(draw);draw();
`;
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/capture') {
        const width = url.searchParams.get('width'), mode = url.searchParams.get('mode');
        if (!['320', '390', '430'].includes(width) || !['normal', 'cooldowns', 'countdown', 'warning', 'urgent', 'settling', 'large', 'legacy', 'effects'].includes(mode)) { res.writeHead(400);res.end();return; }
        const chunks = [];let size = 0;
        for await (const chunk of req) { size += chunk.length;if (size > 8 * 1024 * 1024) {res.writeHead(413);res.end();return;}chunks.push(chunk); }
        const data = Buffer.concat(chunks).toString();
        if (!data.startsWith('data:image/png;base64,')) {res.writeHead(400);res.end();return;}
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, mode + '-' + width + '.png'), Buffer.from(data.slice(22), 'base64'));
        res.end('已保存本地画面：' + mode + '-' + width + '.png');return;
    }
    if (req.method !== 'GET') {res.writeHead(405);res.end();return;}
    if (url.pathname === '/') {res.setHeader('Content-Type', 'text/html; charset=utf-8');res.end(html);return;}
    if (url.pathname === '/fixture.js') {res.setHeader('Content-Type', 'text/javascript; charset=utf-8');res.end(script);return;}
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep)) {res.writeHead(404);res.end();return;}
    fs.readFile(file, (error, data) => {res.statusCode = error ? 404 : 200;res.end(error ? '' : data);});
});
server.listen(0, '127.0.0.1', () => console.log('http://127.0.0.1:' + server.address().port));
