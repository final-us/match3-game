'use strict';
// Local browser acceptance: isolated pages, real Main/Core/Board/UI and cloud handler.
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
const docs = Object.create(null);
let identity = '', transactionTail = Promise.resolve(), offset = 0;
const realNow = Date.now;
Date.now = () => realNow() + offset;
const clone = value => JSON.parse(JSON.stringify(value));
function ref(id) {
    return {
        get: async () => ({ data: docs[id] ? clone(docs[id]) : null }),
        set: async ({ data }) => { docs[id] = clone(data); },
        update: async ({ data }) => { Object.assign(docs[id], clone(data)); }
    };
}
const sdk = {
    DYNAMIC_CURRENT_ENV: 'local', init() {}, getWXContext: () => ({ OPENID: identity }),
    database: () => ({ command: { lt: value => ({ lt: value }) },
        collection: () => ({ where: () => ({ remove: async () => ({ stats: { removed: 0 } }) }) }),
        runTransaction: handler => {
            const run = transactionTail.then(() => handler({ collection: () => ({ doc: ref }) }));
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
const html = '<!doctype html><meta charset="utf-8"><title>好友续局 · 本地运行检查</title><style>body{margin:0}canvas{display:block;touch-action:none}</style><canvas></canvas><script src="/fixture.js"></script>';
const script = `
const sources=${JSON.stringify(sources)},cache={},params=new URLSearchParams(location.search);
const width=+params.get('width'),height=+params.get('height'),identity=params.get('identity');
const storage={match3_music_enabled_v1:false,match3_sfx_enabled_v1:false,match3_onboarding_v1:{pvp_wait:true}};
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
 const core=app.battleCore,board=app.battleBoard;
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
    const rect = await page.evaluate(([family, key]) => app[family][key], [family, key]);
    await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2);
}
async function state(page, expected) { await page.waitForFunction(expected => app.state === expected, expected); }
async function swap(page) {
    await page.waitForFunction(() => app.isBattleInputOpen(Date.now()) && app.battleCore && !app.battleCore.processing && !app.battleCore.preferredGenerationPositions.length);
    const move = await page.evaluate(() => nextMove());
    assert(move, 'real generated board must have a legal move');
    const before = await page.evaluate(() => app.battleCore.score);
    await page.mouse.move(move.from.x, move.from.y); await page.mouse.down();
    await page.mouse.move(move.to.x, move.to.y, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(before => app.battleCore.score > before && !app.battleCore.processing && !app.battleCore.preferredGenerationPositions.length, before);
    await page.waitForFunction(() => app.battle.syncedScore === app.battleCore.score);
}
(async () => {
    fs.mkdirSync(out, { recursive: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    const errors = [];
    try {
        for (const [width, height] of [[320, 568], [375, 812], [430, 932]]) {
            const pages = await Promise.all(['host', 'guest'].map(async role => {
                const page = await browser.newPage({ viewport: { width, height } });
                page.setDefaultTimeout(15000);
                page.on('pageerror', e => errors.push(String(e)));
                await page.goto('http://127.0.0.1:' + server.address().port + '/?width=' + width + '&height=' + height + '&identity=' + role + width);
                await page.waitForFunction(() => load('js/render/assets.js').isReady());
                await page.evaluate(value => { clockOffset = value; }, offset);
                return page;
            }));
            const [host, guest] = pages;
            console.log(width + ': isolated pages ready');
            await click(host, 'menuButtons', 'battle'); await state(host, 'battle_wait');
            const roomId = await host.evaluate(() => app.battle.roomId);
            await guest.evaluate(roomId => app.handleShow({ query: { roomId, invite: '1' } }), roomId);
            await state(guest, 'battle_wait');
            await host.waitForFunction(() => app.battle.oppJoined && app.battle.roundId > 1);
            assert.strictEqual(await host.evaluate(() => app.battle.roundNumber), 1);
            for (const page of pages) await click(page, 'battleButtons', 'ready');
            for (const page of pages) await state(page, 'battle_playing');
            console.log(width + ': first round playing');
            await swap(host);
            console.log(width + ': legal pointer swap scored');
            // Advance only the clocks. The real query handler determines the outcome from synced scores.
            offset += 65000;
            for (const page of pages) await page.evaluate(value => { clockOffset = value; }, offset);
            for (const page of pages) await state(page, 'battle_result');
            assert.strictEqual(await host.evaluate(() => app.battle.result), 'win');
            assert.strictEqual(await guest.evaluate(() => app.battle.result), 'lose');
            assert.strictEqual(await host.evaluate(() => storage.match3_coin_v1), 150);
            await host.screenshot({ path: path.join(out, 'rematch-live-result-' + width + '.png') });
            await click(host, 'battleButtons', 'again');
            await host.waitForFunction(() => app.battle.myRematch);
            await guest.waitForFunction(() => app.battle.oppRematch);
            await host.screenshot({ path: path.join(out, 'rematch-live-confirmed-' + width + '.png') });
            await click(host, 'battleButtons', 'again');
            await host.waitForFunction(() => !app.battle.myRematch && !app.battle.actionPending);
            await guest.waitForFunction(() => !app.battle.oppRematch);
            await host.evaluate(() => { networkOffline = true; });
            await host.waitForFunction(() => app.battle.offline);
            await host.screenshot({ path: path.join(out, 'rematch-live-offline-' + width + '.png') });
            await host.evaluate(() => { networkOffline = false; });
            await click(host, 'battleButtons', 'again');
            await host.waitForFunction(() => !app.battle.offline);
            await click(host, 'battleButtons', 'again'); await host.waitForFunction(() => app.battle.myRematch);
            await click(guest, 'battleButtons', 'again');
            for (const page of pages) await state(page, 'battle_wait');
            for (const page of pages) assert.strictEqual(await page.evaluate(() => app.battle.roundNumber), 2);
            await host.screenshot({ path: path.join(out, 'rematch-live-next-' + width + '.png') });
            for (const page of pages) await click(page, 'battleButtons', 'ready');
            for (const page of pages) await state(page, 'battle_playing');
            await swap(guest);
            offset += 65000;
            for (const page of pages) await page.evaluate(value => { clockOffset = value; }, offset);
            for (const page of pages) await state(page, 'battle_result');
            assert.strictEqual(await host.evaluate(() => app.battle.myWins), 1);
            assert.strictEqual(await host.evaluate(() => app.battle.oppWins), 1);
            assert.strictEqual(await host.evaluate(() => storage.match3_coin_v1), 180);
            assert.strictEqual(await guest.evaluate(() => storage.match3_coin_v1), 180);
            await click(guest, 'battleButtons', 'menu'); await state(guest, 'menu');
            await host.waitForFunction(() => app.battle.oppLeft);
            assert.strictEqual(await host.evaluate(() => app.battle.oppWins), 1, 'departure preserves cumulative wins');
            await host.screenshot({ path: path.join(out, 'rematch-live-left-' + width + '.png') });
            for (const page of pages) {
                assert.deepStrictEqual(await page.evaluate(() => errors), []);
                await page.close();
            }
            console.log(JSON.stringify({ width, result: 'passed', rounds: 2, wins: '1:1', walletEach: 180, pointerSwaps: 2 }));
        }
        assert.deepStrictEqual(errors, []);
    } finally {
        await browser.close(); server.close(); Date.now = realNow;
    }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); Date.now = realNow; });
