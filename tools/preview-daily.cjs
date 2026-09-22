'use strict';
// Local daily anchor acceptance: real Main, fixed daily core, pointer moves and replay service.
// Only wx storage/cloud and the wall clock are replaced. Never connects to WeChat.
const fs = require('fs');
const path = require('path');
const http = require('http');
const Module = require('module');
const assert = require('assert');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../match3-wechat');
const out = path.resolve(__dirname, '../assets/_incoming/moon-ui-runtime/screens');
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
const docs = {battle_rooms:Object.create(null),daily_runs:Object.create(null),daily_progress:Object.create(null)};
let identity = '', transactionTail = Promise.resolve(), offset = 0;
const realNow = Date.now;
Date.now = () => realNow() + offset;
const clone = value => JSON.parse(JSON.stringify(value));
function ref(collection,id) {
    const entries=docs[collection];
    return {
        get: async () => ({ data: entries[id] ? clone(entries[id]) : null }),
        set: async ({ data }) => { entries[id] = clone(data); },
        update: async ({ data }) => { Object.assign(entries[id], clone(data)); }
    };
}
const sdk = {
    DYNAMIC_CURRENT_ENV: 'local', init() {}, getWXContext: () => ({ OPENID: identity }),
    database: () => ({ command: { lt: value => ({ lt: value }) },
        collection: name => ({doc:id=>ref(name,id), where: () => ({ remove: async () => ({ stats: { removed: 0 } }) }) }),
        runTransaction: handler => {
            const run = transactionTail.then(() => handler({ collection: name => ({ doc: id=>ref(name,id) }) }));
            transactionTail = run.catch(() => {});
            return run;
        }
    })
};
const originalLoad = Module._load;
Module._load = function (name, parent, main) {
    return name === 'wx-server-sdk' ? sdk : originalLoad.call(this, name, parent, main);
};
const battle = require('../match3-wechat/cloudfunctions/battle/index');
Module._load = originalLoad;
const html = '<!doctype html><meta charset="utf-8"><title>每日挑战 · 本地详情样板</title><style>body{margin:0}canvas{display:block;touch-action:none}</style><canvas></canvas><script src="/fixture.js"></script>';
const script = `
const sources=${JSON.stringify(sources)},cache={},params=new URLSearchParams(location.search);
const width=+params.get('width'),height=+params.get('height'),identity=params.get('identity');
const storage=window.fixtureSaved||{match3_music_enabled_v1:false,match3_sfx_enabled_v1:false,match3_onboarding_v1:{pvp_wait:true}};
const realNow=Date.now;window.clockOffset=0;Date.now=()=>realNow()+window.clockOffset;
window.networkOffline=false;window.notices=[];window.errors=[];
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const canvas=document.querySelector('canvas');canvas.style.width=width+'px';canvas.style.height=height+'px';
const events={};
window.wx={createCanvas:()=>canvas,createImage:()=>new Image(),
 getStorageSync:key=>key in storage?JSON.parse(JSON.stringify(storage[key])):'',
 setStorageSync:(key,value)=>{storage[key]=JSON.parse(JSON.stringify(value));},removeStorageSync:key=>{delete storage[key];},
 getSystemInfoSync:()=>({windowWidth:width,windowHeight:height,pixelRatio:2,safeArea:{top:47,bottom:height-34,left:0,right:width}}),
 getMenuButtonBoundingClientRect:()=>({bottom:87,left:width-90}),
 onTouchStart:fn=>events.start=fn,onTouchMove:fn=>events.move=fn,onTouchEnd:fn=>events.end=fn,
 onShow:fn=>events.show=fn,onHide:fn=>events.hide=fn,
 showToast:options=>notices.push(options.title),shareAppMessage:options=>{window.invite=options.query;},onShareAppMessage:()=>{},
 cloud:{init:()=>{},callFunction:({data,success,fail})=>{
 if(networkOffline){fail({errMsg:'network offline'});return;}
 fetch('/call/'+identity,{method:'POST',body:JSON.stringify(data)}).then(r=>r.json()).then(result=>success({result})).catch(fail);
 }}};
function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};
 const req=relative=>{const p=id.split('/');p.pop();relative.split('/').forEach(x=>x==='..'?p.pop():x!=='.'&&p.push(x));return load(p.join('/')+'.js');};
 new Function('require','module','exports',sources[id])(req,m,m.exports);return m.exports;}
function point(e){const rect=canvas.getBoundingClientRect();return {clientX:(e.clientX-rect.left)*width/rect.width,clientY:(e.clientY-rect.top)*height/rect.height};}
canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);events.start({touches:[point(e)]});};
canvas.onpointermove=e=>{if(e.buttons)events.move({touches:[point(e)]});};
canvas.onpointerup=e=>events.end({changedTouches:[point(e)]});
window.app=new (load('js/main.js'))();window.storage=storage;
window.nextMove=()=>{
 const core=app.dailyCore,board=app.dailyBoard;
 for(let row=0;row<8;row++)for(let column=0;column<8;column++){
  const from={row,column};
  for(const to of [{row,column:column+1},{row:row+1,column}]){
   if(to.row<8&&to.column<8&&!core.isBlocked(from)&&!core.isBlocked(to)&&core.validateMove(from,to))
    return {from:board.pieceCenter(row,column),to:board.pieceCenter(to.row,to.column)};
  }
 }
 return null;
};

`;
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
    if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(script); return; }
    if (url.pathname.startsWith('/call/')) {
        let body = '';
        req.on('data', value => { body += value; });
        req.on('end', async () => {
            try {
                identity = url.pathname.split('/').pop(); // handler captures WXContext before its first await
                const result = await battle.main(JSON.parse(body));
                res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result));
            } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, err: String(e) })); }
        });
        return;
    }
    const file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep)) { res.statusCode = 404; res.end(); return; }
    fs.readFile(file, (error, data) => { res.statusCode = error ? 404 : 200; res.end(error ? '' : data); });
});

async function click(page, family, key) {
    await page.waitForFunction(([family, key]) => app[family] && app[family][key], [family, key]);
    const rect = await page.evaluate(([family,key])=>app[family][key],[family,key]);
    await page.mouse.click(rect.x+rect.w/2,rect.y+rect.h/2);
}
async function complete(page, goOffline) {
    for(let i=0;i<25;i++) {
        await page.waitForFunction(()=>app.state==='daily_playing'&&!app.dailyCore.processing&&!app.dailyCore.preferredGenerationPositions.length);
        const move=await page.evaluate(()=>nextMove()); assert(move);
        const before=await page.evaluate(()=>app.dailyCore.movesLeft);
        if(goOffline&&i===24) await page.evaluate(()=>{networkOffline=true;});
        await page.mouse.move(move.from.x,move.from.y);await page.mouse.down();
        await page.mouse.move(move.to.x,move.to.y,{steps:6});await page.mouse.up();
        if(i===0) {
            await page.mouse.move(move.from.x,move.from.y);await page.mouse.down();
            await page.mouse.move(move.to.x,move.to.y,{steps:2});await page.mouse.up();
        }
        await page.waitForFunction(before=>before===1&&app.state==='daily_detail'||app.dailyCore&&app.dailyCore.movesLeft===before-1&&!app.dailyCore.processing&&!app.dailyCore.preferredGenerationPositions.length,before);
        if(i<24) assert.strictEqual(await page.evaluate(()=>app.state),'daily_playing','reaching target must not end before 25 swaps');
    }
    await page.waitForFunction(()=>app.state==='daily_detail'&&!app.daily.loading);
}
(async()=>{
    fs.mkdirSync(out,{recursive:true});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    if(process.argv.includes('--serve')) { console.log('Daily local preview: http://127.0.0.1:'+server.address().port); return; }
    const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
    const errors=[];
    try {
        for(const [width,height] of [[320,568],[375,812],[430,932]].filter(size=>!process.argv[2]||String(size[0])===process.argv[2])) {
            offset=Date.UTC(2026,8,22,12)-realNow();
            const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(15000);
            page.on('pageerror',error=>errors.push(String(error)));
            await page.goto('http://127.0.0.1:'+server.address().port+'/?width='+width+'&height='+height+'&identity=daily'+width);
            await page.waitForFunction(()=>load('js/render/assets.js').isReady());
            await page.evaluate(value=>{clockOffset=value;},offset);
            const assetsBefore=await page.evaluate(()=>({progress:app.progress,heart:load('js/core/heart.js').getHeartState().count}));
            await page.screenshot({path:path.join(out,'daily-home-'+width+'.png')});
            await page.evaluate(()=>{networkOffline=true;});
            await click(page,'menuButtons','daily');
            await page.waitForFunction(()=>app.daily.error&&!app.daily.loading);
            await page.screenshot({path:path.join(out,'daily-error-'+width+'.png')});
            // The new detail is modal: the visible home controls underneath cannot act.
            await click(page,'menuButtons','shop');
            assert.strictEqual(await page.evaluate(()=>app.state),'daily_detail','daily modal leaked a tap to home');
            await click(page,'dailyButtons','back');
            await page.waitForFunction(()=>app.state==='menu');
            await click(page,'menuButtons','daily');
            await page.waitForFunction(()=>app.daily.error&&!app.daily.loading);
            await page.evaluate(()=>{networkOffline=false;});
            await click(page,'dailyButtons','start');
            await page.waitForFunction(()=>app.daily.challenge&&!app.daily.loading&&!app.daily.error);
            assert.strictEqual(await page.evaluate(()=>app.daily.challenge.date),'2026-09-22');
            await page.screenshot({path:path.join(out,'daily-detail-'+width+'.png')});
            const startRect=await page.evaluate(()=>app.dailyButtons.start);
            await click(page,'dailyButtons','start');
            await page.waitForFunction(()=>app.state==='daily_playing');
            const firstGrid=await page.evaluate(()=>app.dailyCore.grid);
            await page.screenshot({path:path.join(out,'daily-board-'+width+'.png')});
            if(width===375) { // start date remains fixed across Beijing midnight
                offset+=12*60*60*1000;
                await page.evaluate(value=>{clockOffset=value;},offset);
            }
            await complete(page,width===430);
            if(width===430) {
                assert(await page.evaluate(()=>!!load('js/core/daily-progress.js').read().active));
                await page.screenshot({path:path.join(out,'daily-pending-'+width+'.png')});
                const saved=await page.evaluate(()=>storage);
                await page.addInitScript(saved=>{window.fixtureSaved=saved;},saved);
                await page.reload();await page.waitForFunction(()=>load('js/render/assets.js').isReady());
                await page.evaluate(value=>{clockOffset=value;},offset);
                await click(page,'menuButtons','daily');
                await page.waitForFunction(()=>app.daily.active&&!app.daily.loading);
                await click(page,'dailyButtons','start');
                await page.waitForFunction(()=>!app.daily.active&&!app.daily.loading);
            }
            const local=await page.evaluate(()=>load('js/core/daily-progress.js').read());
            assert.strictEqual(local.best['2026-09-22'],2130);
            assert.strictEqual(local.claimed['2026-09-22'],true);
            assert.strictEqual(await page.evaluate(()=>load('js/core/coin.js').getCoins()),500);
            assert.strictEqual(local.pending,null);
            if(width===375) assert.strictEqual(await page.evaluate(()=>app.daily.challenge.date),'2026-09-23');
            await page.screenshot({path:path.join(out,'daily-complete-'+width+'.png')});
            if(width===320) {
                const beforeCoins=await page.evaluate(()=>load('js/core/coin.js').getCoins());
                assert.strictEqual(await page.evaluate(()=>!!app.dailyButtons.start),false,'completed daily must have no active start target');
                await page.mouse.click(startRect.x+startRect.w/2,startRect.y+startRect.h/2);
                await page.waitForTimeout(120);
                assert.notStrictEqual(await page.evaluate(()=>app.state),'daily_playing','same-day challenge must not start twice');
                assert.strictEqual(await page.evaluate(()=>load('js/core/coin.js').getCoins()),beforeCoins,'repeat daily attempt changed wallet');
            }
            assert.deepStrictEqual(await page.evaluate(()=>app.progress),assetsBefore.progress);
            assert.strictEqual(await page.evaluate(()=>load('js/core/heart.js').getHeartState().count),assetsBefore.heart);
            assert.deepStrictEqual(await page.evaluate(()=>errors),[]);
            await click(page,'dailyButtons','back');await page.waitForFunction(()=>app.state==='menu');
            console.log(JSON.stringify({width,passed:true,score:2130,coins:500,crossMidnight:width===375,pendingRestart:width===430}));
            await page.close();
        }
        assert.deepStrictEqual(errors,[]);
    } finally {await browser.close();server.close();Date.now=realNow;}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();Date.now=realNow;});
