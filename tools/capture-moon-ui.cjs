// Render the real CommonJS Canvas modules in Chromium; no platform/network mocks are acceptance evidence.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../match3-wechat');
const out = path.resolve(__dirname, '../assets/_incoming/moon-ui-runtime/screens');
const modes = process.argv.slice(2);
const sources = {};
function collect(file) {
  const id = path.relative(root, file).replaceAll('\\', '/');
  if (sources[id]) return;
  sources[id] = fs.readFileSync(file, 'utf8');
  for (const m of sources[id].matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
    if (m[1].startsWith('.')) collect(path.resolve(path.dirname(file), m[1] + '.js'));
  }
}
['render/ui','render/battle-ui','render/board-render','core/game-core','render/assets'].forEach(x => collect(path.join(root,'js',x+'.js')));
const server = http.createServer((req,res) => {
  if (req.url === '/') {res.setHeader('Content-Type','text/html');res.end('<canvas id="game"></canvas>');return;}
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) {res.end('<canvas id="game"></canvas>');return;}
  fs.readFile(file,(err,data)=>{res.statusCode=err?404:200;res.end(err?'missing':data);});
});
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try {
    const page = await browser.newPage();
    page.on('pageerror',e=>{throw e;});
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.evaluate(async sources=>{
      document.body.style.cssText='margin:0;background:#cbd6ef';
      const cache={};
      window.wx={createImage:()=>new Image()};
      window.load=(id)=>{
        if(cache[id]) return cache[id].exports;
        const m=cache[id]={exports:{}};
        const req=rel=>{
          const parts=id.split('/');parts.pop();
          rel.split('/').forEach(p=>p==='..'?parts.pop():p!=='.'&&parts.push(p));
          return load(parts.join('/')+'.js');
        };
        new Function('require','module','exports',sources[id])(req,m,m.exports);
        return m.exports;
      };
      await new Promise(r=>load('js/render/assets.js').preload(r));
    },sources);
    for(const [width,height] of [[320,568],[375,812],[430,932]]) {
      await page.setViewportSize({width,height});
      for(const mode of ['home','home-empty','board','board-tools','board-timed','settings','settings-off','shop','shop-safe','shop-empty','shop-pending','shop-no-ad','result','result-win','result-timeout','result-no-ad','map','map-states','map-scroll','map-scroll-end','battle-wait','battle-wait-empty','battle-wait-ready','battle-result','battle-result-draw','battle-result-lose','battle-board','battle-cooldown','battle-active','battle-countdown','battle-effects']) {
        if (modes.length && !modes.includes(mode)) continue;
        await page.evaluate(({width,height,mode})=>{
          const c=document.querySelector('canvas');c.width=width*2;c.height=height*2;c.style.width=width+'px';c.style.height=height+'px';
          const ctx=c.getContext('2d');ctx.scale(2,2);
          const screen={width,height,safeTop:24,safeBottom:20,reduceEffects:false};
          const UI=load('js/render/ui.js');
          const Battle=load('js/render/battle-ui.js');
          if(mode==='battle-wait') Battle.drawWait(ctx,screen,{roomId:'preview-room',myName:'我',myReady:false,oppName:'对手',oppReady:false,oppJoined:true,items:{freeze:1,disturb:2},isHost:true});
          if(mode==='battle-wait-empty') Battle.drawWait(ctx,{...screen,contentTop:72},{roomId:'preview-room',myName:'月光小猫',myReady:false,oppJoined:false,items:{freeze:1,disturb:2},isHost:true});
          if(mode==='battle-wait-ready') Battle.drawWait(ctx,{...screen,contentTop:72},{roomId:'preview-room',myName:'月光小猫',myReady:true,oppName:'星星猫咪',oppReady:true,oppJoined:true,items:{freeze:0,disturb:3},isHost:false});
          if(mode==='battle-result') Battle.drawResult(ctx,screen,{result:'win',myScore:3000,oppScore:2400,coinReward:150});
          if(mode==='battle-result-draw') Battle.drawResult(ctx,{...screen,contentTop:72},{result:'draw',myScore:4000,oppScore:4000,coinReward:50});
          if(mode==='battle-result-lose') Battle.drawResult(ctx,{...screen,contentTop:72},{result:'lose',myScore:3200,oppScore:4000,coinReward:0});
          if(mode==='home') UI.drawMenu(ctx,screen,5,{count:5,timeLeftText:'12:34',canPlay:true},{coins:1000});
          if(mode==='home-empty') UI.drawMenu(ctx,screen,5,{count:0,timeLeftText:'12:34',canPlay:false,canAd:true},{coins:0});
          if(mode==='settings') UI.drawSettings(ctx,screen,{musicEnabled:true,sfxEnabled:true});
          if(mode==='settings-off') UI.drawSettings(ctx,screen,{musicEnabled:false,sfxEnabled:false});
          if(mode==='shop') UI.drawShop(ctx,screen,1000,{hammer:2,bomb:1,color:0},{canReward:true,count:1,limit:10,pending:false});
          if(mode==='shop-safe') UI.drawShop(ctx,{...screen,contentTop:72},1000,{hammer:2,bomb:1,color:0},{canReward:true,count:1,limit:10,pending:false});
          if(mode==='shop-empty') UI.drawShop(ctx,screen,0,{hammer:0,bomb:0,color:0},{canReward:true,count:10,limit:10,pending:false});
          if(mode==='shop-pending') UI.drawShop(ctx,screen,1000,{hammer:2,bomb:1,color:0},{canReward:true,count:1,limit:10,pending:true});
          if(mode==='shop-no-ad') UI.drawShop(ctx,screen,1000,{hammer:2,bomb:1,color:0},{canReward:false});
          if(mode==='result') UI.drawResult(ctx,screen,{win:false,score:1800,coinReward:0,star:0,canRevive:true});
          if(mode==='result-win') UI.drawResult(ctx,{...screen,contentTop:72},{win:true,score:4200,coinReward:150,star:3,hasNext:true});
          if(mode==='result-timeout') UI.drawResult(ctx,{...screen,contentTop:72},{win:false,reason:'timeout',timed:true,score:2800,canRevive:true});
          if(mode==='result-no-ad') UI.drawResult(ctx,screen,{win:false,score:1800,canRevive:false});
          if(mode==='map') UI.drawLevelSelect(ctx,screen,5,1000,{},{});
          if(mode==='map-states') UI.drawLevelSelect(ctx,{...screen,contentTop:72},8,1000,{6:3,7:2},{offset:5});
          if(mode==='map-scroll') UI.drawLevelSelect(ctx,{...screen,contentTop:72},8,1000,{6:3,7:2},{offset:5.5});
          if(mode==='map-scroll-end') UI.drawLevelSelect(ctx,{...screen,contentTop:72},8,1000,{6:3,7:2},{offset:5.9});
          if(['board','board-tools','board-timed','battle-board','battle-cooldown','battle-active','battle-countdown','battle-effects'].includes(mode)) {
            // Visual fixture exercises all five production pieces, not the default four-color easy mode.
            load('js/core/config.js').GAME_CONFIG.mode='normal';
            const Core=load('js/core/game-core.js'), Board=load('js/render/board-render.js');
            const board=new Board(ctx,{...screen,contentTop:72});
            board.battleMode=mode.startsWith('battle-');
            board.setGame(new Core({id:5,rows:8,columns:8,moveCount:25,timeLimitSec:mode==='board-timed'?180:0,goals:[{type:'score',target:3600}]},{}));
            if(mode==='board-timed') {board.core.timeLeftMs=9000;board.core.movesLeft=4;}
            if(mode==='board-tools') { board.setTools({hammer:2,bomb:1,color:0});board.selectedTool='hammer'; }
            board.draw();
            if(board.battleMode) {
              Battle.drawTop(ctx,{...screen,contentTop:72},{timeLeft:mode==='battle-cooldown'?8:42,myScore:1280,oppScore:960});
              Battle.drawItems(ctx,screen,{freeze:mode==='battle-active'?0:1,disturb:2,cooldownRemaining:mode==='battle-cooldown'?4500:0,active:mode==='battle-active'});
              if(mode==='battle-countdown') Battle.drawCountdown(ctx,screen,{seconds:3});
              if(mode==='battle-effects') Battle.drawEffects(ctx,{...screen,contentTop:72},{frozen:true,frozenRemaining:2500,disturb:true,disturbRemaining:4000,castNotice:'freeze',boardX:board.boardX,boardY:board.boardY,boardW:board.boardW,boardH:board.boardH});
            }
          }
        },{width,height,mode});
        await page.screenshot({path:path.join(out,`${mode}-${width}.png`)});
      }
    }
    console.log('Captured requested real Canvas renders:',out);
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
