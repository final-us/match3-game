'use strict';

// Local-only retention UI acceptance harness. It runs the real Main canvas and
// recursively bundled client modules, but keeps storage in page memory, rejects
// every cloud request and disables audio. It never reads or writes user saves.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const retentionBackend = require('../match3-wechat/cloudfunctions/battle/retention');
const { createRetentionDb } = require('../match3-wechat/test/helpers/retention-db');

const root = path.resolve(__dirname, '../match3-wechat');
const out = path.resolve(__dirname, '../assets/_incoming/retention-daily-coins-v1/screens');
const functionalMode = process.argv.includes('--functional');
const sources = Object.create(null);

function collect(file) {
    const id = path.relative(root, file).replaceAll('\\', '/');
    if (sources[id]) return;
    sources[id] = fs.readFileSync(file, 'utf8');
    for (const match of sources[id].matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        if (match[1].startsWith('.')) collect(path.resolve(path.dirname(file), match[1] + '.js'));
    }
}
collect(path.join(root, 'js/main.js'));

const packedSources = JSON.stringify(sources).replaceAll('</', '<\\/');
const staticControls = `<div class="row">快捷状态
<button data-preset="unsigned">未签到</button><button data-preset="signed">已签到</button><button data-preset="day7">第7天</button><button data-preset="tasks">任务进度</button><button data-preset="chests">宝箱可领</button><button data-preset="previous">上周待领</button><button data-preset="loading">加载</button><button data-preset="offline">断网</button><button data-preset="error">错误</button><button data-preset="pending">待同步</button><button data-preset="rules">规则</button></div>
<div class="row">自定义
<label>页签 <select id="tab"><option value="signin">签到</option><option value="tasks">任务</option></select></label>
<label>签到日 <input id="day" class="short" type="number" min="1" max="7" value="1"></label>
<label><input id="signed" type="checkbox">已签到</label>
<label>任务 <input id="progress" class="progress" value="0,0,0"></label>
<label>活跃 <input id="activity" class="short" type="number" min="0" max="500" value="0"></label>
<label>宝箱 <input id="claimed" class="progress" value="0,0,0"></label>
<label>状态 <select id="modelStatus"><option>ready</option><option>loading</option><option>offline</option><option>error</option><option>pending</option></select></label>
<label><input id="rules" type="checkbox">规则</label><button id="apply">应用</button></div>`;
const functionalControls = `<div class="row"><strong>功能模式：仅本机内存服务与临时钱包。</strong>
<button id="advance-day">服务器与页面日期 +1 天</button><button id="toggle-offline">切换离线</button>
<button id="run-solo">运行真实单人关卡</button></div>`;
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>每日金币 · 本地临时数据预览</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#dfe5f7;color:#17224f;font:13px/1.35 system-ui,-apple-system,sans-serif}
#toolbar{position:sticky;top:0;z-index:2;padding:8px 10px;background:#f7f8ff;border-bottom:1px solid #b8c2e1;box-shadow:0 2px 8px #36427022}
#toolbar strong{color:#8b356d}#toolbar .row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px}
button,select,input{font:inherit;min-height:30px;border:1px solid #aab4d5;border-radius:7px;background:white;color:#17224f;padding:4px 7px}
button{cursor:pointer}button:hover{background:#fff2fa}.sizes a{margin-right:7px;color:#4054a1}
label{display:inline-flex;align-items:center;gap:4px}.short{width:66px}.progress{width:92px}
#stage{padding:10px;display:flex;justify-content:center}canvas{display:block;touch-action:none;background:#111a48;box-shadow:0 8px 24px #27355d42}
#status{min-height:20px;color:#49557c}
</style></head><body>
<section id="toolbar">
<div><strong>本地临时数据预览，不连接真实云、不发放真实奖励、不写用户存档。</strong></div>
<div class="row sizes">尺寸 <a data-size="320x568" href="/?width=320&height=568">320×568</a><a data-size="390x844" href="/?width=390&height=844">390×844</a><a data-size="430x932" href="/?width=430&height=932">430×932</a>
<button id="open">从首页打开</button><button id="reset">重置临时数据</button></div>
${functionalMode ? functionalControls : staticControls}
<output id="status"></output>
</section><main id="stage"><canvas></canvas></main><script src="/fixture.js"></script></body></html>`;

const fixture = `
const sources=${packedSources},cache=Object.create(null),params=new URLSearchParams(location.search);
const functional=${JSON.stringify(functionalMode)},session='functional-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const width=Number(params.get('width'))||390,height=Number(params.get('height'))||844;
const canvas=document.querySelector('canvas'),statusLine=document.querySelector('#status'),events={};
canvas.style.width=width+'px';canvas.style.height=height+'px';
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const initialStorage={match3_music_enabled_v1:false,match3_sfx_enabled_v1:false,match3_coin_v1:2460,match3_onboarding_v1:{pvp_wait:true}};
if(functional)initialStorage.match3_progress_infinite_v1={unlockedLevel:99,stars:{},failures:{}};
const storage=clone(initialStorage),storageWrites=[],cloudAttempts=[];
const presets={
 unsigned:{tab:'signin',offset:0,signDay:1,signed:false,taskProgress:[0,0,0],activity:0,claimed:[false,false,false],status:'ready',message:'',rules:false},
 signed:{tab:'signin',offset:0,signDay:3,signed:true,taskProgress:[1,0,18],activity:40,claimed:[false,false,false],status:'ready',message:'今日签到奖励已领取',rules:false},
 day7:{tab:'signin',offset:0,signDay:7,signed:false,taskProgress:[1,2,80],activity:180,claimed:[false,false,false],status:'ready',message:'',rules:false},
 tasks:{tab:'tasks',offset:0,signDay:3,signed:true,taskProgress:[1,1,46],activity:70,claimed:[false,false,false],status:'ready',message:'',rules:false},
 chests:{tab:'tasks',offset:0,signDay:5,signed:true,taskProgress:[1,2,80],activity:500,claimed:[false,false,false],status:'ready',message:'',rules:false},
 previous:{tab:'tasks',offset:0,signDay:4,signed:true,taskProgress:[1,2,64],activity:180,claimed:[false,false,false],status:'ready',message:'',rules:false,previousWeek:{available:[true,true,true],claimed:[false,false,false]}},
 loading:{tab:'signin',offset:0,signDay:1,signed:false,taskProgress:[0,0,0],activity:0,claimed:[false,false,false],status:'loading',message:'正在读取今日进度',rules:false},
 offline:{tab:'signin',offset:0,signDay:2,signed:false,taskProgress:[1,0,22],activity:40,claimed:[false,false,false],status:'offline',message:'网络未连接，请重试',rules:false},
 error:{tab:'signin',offset:0,signDay:2,signed:false,taskProgress:[1,0,22],activity:40,claimed:[false,false,false],status:'error',message:'暂时无法读取进度，请重试',rules:false},
 pending:{tab:'tasks',offset:0,signDay:3,signed:true,taskProgress:[1,1,46],activity:70,claimed:[false,false,false],status:'pending',message:'奖励待同步，恢复网络后重试',rules:false},
 rules:{tab:'signin',offset:0,signDay:3,signed:true,taskProgress:[1,2,80],activity:180,claimed:[false,false,false],status:'ready',message:'',rules:true}
};
const notices=[];
window.fixture={width,height,storage,storageWrites,cloudAttempts,presets,notices,functional,offline:false,session};
function cloudCall(options){
 const payload=clone(options&&options.data||{});cloudAttempts.push(payload);
 if(!functional){const error={errMsg:'local retention preview rejects all cloud requests'};if(options&&options.fail)setTimeout(()=>options.fail(error),0);return Promise.resolve();}
 if(window.fixture.offline){const error={errMsg:'network offline'};if(options&&options.fail)setTimeout(()=>options.fail(error),0);return Promise.resolve();}
 return fetch('/functional-api?session='+encodeURIComponent(session),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
  .then(response=>{if(!response.ok)throw Error('local fixture response '+response.status);return response.json();})
  .then(result=>{if(options&&options.success)options.success({result});return {result};})
  .catch(error=>{const failure={errMsg:String(error&&error.message||error)};if(options&&options.fail)options.fail(failure);});
}
window.wx={
 createCanvas:()=>canvas,createImage:()=>new Image(),
 getStorageSync:key=>key in storage?clone(storage[key]):'',
 setStorageSync:(key,value)=>{storage[key]=clone(value);storageWrites.push({type:'set',key,value:clone(value)});},
 removeStorageSync:key=>{delete storage[key];storageWrites.push({type:'remove',key});},
 getSystemInfoSync:()=>({windowWidth:width,windowHeight:height,pixelRatio:2,platform:'devtools',safeArea:{top:47,bottom:height-34,left:0,right:width}}),
 getMenuButtonBoundingClientRect:()=>({top:51,bottom:83,left:width-92,right:width-8,width:84,height:32}),
 getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),
 onTouchStart:fn=>events.start=fn,onTouchMove:fn=>events.move=fn,onTouchEnd:fn=>events.end=fn,
 onShow:fn=>events.show=fn,onHide:fn=>events.hide=fn,onError:()=>{},onUnhandledRejection:()=>{},
 showToast:options=>{const message=String(options&&options.title||'');notices.push(message);statusLine.textContent='本地提示：'+message;},
 showModal:options=>{statusLine.textContent='本地提示：'+String(options&&options.content||'');},
 showShareMenu:()=>{},onShareAppMessage:()=>{},
 createInnerAudioContext:()=>({play(){},pause(){},stop(){},destroy(){},onPlay(){},onError(){},onEnded(){},set src(value){},set loop(value){},set volume(value){}}),
 cloud:{init:()=>{},callFunction:cloudCall}
};
function load(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};
 const req=relative=>{const parts=id.split('/');parts.pop();relative.split('/').forEach(part=>part==='..'?parts.pop():part!=='.'&&parts.push(part));return load(parts.join('/')+'.js');};
 new Function('require','module','exports',sources[id])(req,module,module.exports);return module.exports;}
window.load=load;
function point(event){const rect=canvas.getBoundingClientRect();return {clientX:(event.clientX-rect.left)*width/rect.width,clientY:(event.clientY-rect.top)*height/rect.height};}
canvas.onpointerdown=event=>{canvas.setPointerCapture(event.pointerId);events.start&&events.start({touches:[point(event)]});};
canvas.onpointermove=event=>{if(event.buttons&&events.move)events.move({touches:[point(event)]});};
canvas.onpointerup=event=>{events.end&&events.end({changedTouches:[point(event)]});};
window.app=new (load('js/main.js'))({retentionSample:!functional});
function cleanModel(value){const model={tab:value.tab==='tasks'?'tasks':'signin',offset:Math.max(0,Number(value.offset)||0),signDay:Math.max(1,Math.min(7,Number(value.signDay)||1)),signed:!!value.signed,taskProgress:(value.taskProgress||[0,0,0]).slice(0,3).map(n=>Math.max(0,Number(n)||0)),activity:Math.max(0,Number(value.activity)||0),claimed:(value.claimed||[false,false,false]).slice(0,3).map(Boolean),status:['ready','loading','offline','error','pending'].includes(value.status)?value.status:'ready',message:String(value.message||''),rules:!!value.rules};if(value.previousWeek)model.previousWeek={available:(value.previousWeek.available||[false,false,false]).slice(0,3).map(Boolean),claimed:(value.previousWeek.claimed||[false,false,false]).slice(0,3).map(Boolean)};return model;}
window.setFixtureModel=value=>{if(functional)throw Error('functional fixture cannot replace the real controller model');app.retentionPreview=cleanModel(value);fillControls(app.retentionPreview);return clone(app.retentionPreview);};
window.applyPreset=name=>setFixtureModel(presets[name]||presets.unsigned);
window.tapRect=rect=>{if(!rect)return false;const p={clientX:rect.x+rect.w/2,clientY:rect.y+rect.h/2};events.start&&events.start({touches:[p]});events.end&&events.end({changedTouches:[p]});return true;};
window.openRetention=()=>tapRect(app.menuButtons&&app.menuButtons.retention);
function fillControls(model){document.querySelector('#tab').value=model.tab;document.querySelector('#day').value=model.signDay;document.querySelector('#signed').checked=model.signed;document.querySelector('#progress').value=model.taskProgress.join(',');document.querySelector('#activity').value=model.activity;document.querySelector('#claimed').value=model.claimed.map(Number).join(',');document.querySelector('#modelStatus').value=model.status;document.querySelector('#rules').checked=model.rules;}
function readNumbers(id){return document.querySelector(id).value.split(',').map(value=>Number(value.trim())||0);}
document.querySelector('#open').onclick=()=>{if(!openRetention())statusLine.textContent='等待真实 Main 提供 menuButtons.retention…';};
document.querySelector('#reset').onclick=()=>location.reload();
if(!functional){
 document.querySelector('#apply').onclick=()=>setFixtureModel({tab:document.querySelector('#tab').value,offset:0,signDay:document.querySelector('#day').value,signed:document.querySelector('#signed').checked,taskProgress:readNumbers('#progress'),activity:document.querySelector('#activity').value,claimed:readNumbers('#claimed').map(Boolean),status:document.querySelector('#modelStatus').value,message:'',rules:document.querySelector('#rules').checked});
 document.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>applyPreset(button.dataset.preset));fillControls(presets.unsigned);
}
function nextMove(core){for(let row=0;row<core.grid.length;row++)for(let column=0;column<core.grid[row].length;column++){
 const from={row,column};for(const to of [{row:row+1,column},{row,column:column+1}])if(to.row<core.grid.length&&to.column<core.grid[row].length&&!core.isBlocked(from)&&!core.isBlocked(to)&&core.validateMove(from,to))return {from,to};}
 throw Error('No valid move');}
window.playActualSolo=async()=>{
 if(!functional)throw Error('actual solo helper is functional-only');if(app.state!=='menu')throw Error('actual solo requires Main home');
 const walletBefore=storage.match3_coin_v1;app.startGame(1);if(app.state!=='playing')throw Error('Main did not enter solo play');
 for(const method of ['animateSwap','animateInvalidSwap','animateMatch','animateGravity','animateFill','animateColorChange','animateReshuffle'])app.board[method]=async()=>{};
 let moves=0;while(!app.core.ended){const move=nextMove(app.core);if(!await app.core.trySwap(move.from,move.to))throw Error('valid move rejected');if(++moves>100)throw Error('solo harness move bound exceeded');}
 if(app.state!=='result'||!app.retentionSolo.validMove||app.retentionSolo.cleared<=0)throw Error('solo result missing real match evidence');
 return {id:app.retentionSolo.id,cleared:app.retentionSolo.cleared,moves,walletBefore,walletAfter:storage.match3_coin_v1,result:clone(app.result)};
};
window.finishActualSolo=async()=>{
 if(app.state!=='result')throw Error('no solo result to finish');app.leaveSoloResult(()=>app.backToMenu());
 for(let i=0;i<100&&app.state!=='menu';i++)await new Promise(resolve=>setTimeout(resolve,10));
 if(app.state!=='menu')throw Error('solo result did not close');await app.retention.sync();return clone(app.retention.model);
};
if(functional){
 document.querySelector('#advance-day').onclick=async()=>{await fetch('/functional-control?session='+encodeURIComponent(session),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'advanceDay'})});await app.retention.sync();};
 document.querySelector('#toggle-offline').onclick=()=>{window.fixture.offline=!window.fixture.offline;if(window.fixture.offline)app.retention.sync();};
 document.querySelector('#run-solo').onclick=async event=>{try{if(app.state==='result'){await finishActualSolo();event.target.textContent='运行真实单人关卡';}else{await playActualSolo();event.target.textContent='结束并同步本局';}}catch(error){statusLine.textContent='本地夹具错误：'+error.message;}};
}
setInterval(()=>{const wallet=storage.match3_coin_v1;statusLine.textContent='真实 Main Canvas｜'+width+'×'+height+'｜状态 '+app.state+'｜临时钱包 '+wallet+'｜存储写入 '+storageWrites.length+'｜'+(functional?'本地服务请求 ':'云请求已拒绝 ')+cloudAttempts.length;},250);
`;

function contentType(file) {
    const ext = path.extname(file).toLowerCase();
    return ({ '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.json': 'application/json; charset=utf-8' })[ext] || 'application/octet-stream';
}

const functionalSessions = new Map();
const functionalRoutes = {
    retentionInfo: 'info', retentionSign: 'sign', retentionRecord: 'record',
    retentionClaim: 'claim', retentionAck: 'ack'
};

function functionalSession(id) {
    if (!/^[a-z0-9-]{8,80}$/.test(id || '')) return null;
    if (!functionalSessions.has(id)) {
        const fixture = createRetentionDb();
        const state = { time: Date.UTC(2026, 8, 21, 4), fixture: fixture };
        state.service = retentionBackend.createService(fixture.db, crypto, () => state.time);
        functionalSessions.set(id, state);
    }
    return functionalSessions.get(id);
}

function readJson(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.setEncoding('utf8');
        request.on('data', chunk => {
            body += chunk;
            if (body.length > 65536) request.destroy(new Error('fixture request too large'));
        });
        request.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
        });
        request.on('error', reject);
    });
}

async function serveFunctional(request, response, url) {
    const state = functionalSession(url.searchParams.get('session'));
    if (!functionalMode || !state || request.method !== 'POST') {
        response.statusCode = 404; response.end(); return;
    }
    try {
        const input = await readJson(request);
        let result;
        if (url.pathname === '/functional-control') {
            if (input.action !== 'advanceDay') throw new Error('unsupported fixture control');
            state.time += 86400000;
            result = { ok: true, serverNow: state.time, date: retentionBackend.beijingDate(state.time) };
        } else {
            const method = functionalRoutes[input.action];
            if (!method) throw new Error('unsupported retention action');
            const payload = Object.assign({}, input); delete payload.action;
            result = await state.service[method]('functional-cat', payload);
        }
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify(result));
    } catch (error) {
        response.statusCode = 400;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify({ ok: false, code: 'FIXTURE_ERROR', err: String(error.message || error) }));
    }
}

const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/functional-api' || url.pathname === '/functional-control') {
        serveFunctional(request, response, url); return;
    }
    if (url.pathname === '/') {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(html);
        return;
    }
    if (url.pathname === '/fixture.js') {
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        response.end(fixture);
        return;
    }
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep)) {
        response.statusCode = 404;
        response.end();
        return;
    }
    fs.readFile(file, (error, data) => {
        response.statusCode = error ? 404 : 200;
        if (!error) response.setHeader('Content-Type', contentType(file));
        response.end(error ? '' : data);
    });
});

async function clickRect(page, family, key) {
    await page.waitForFunction(([familyName, keyName]) => app[familyName] && app[familyName][keyName], [family, key]);
    const rect = await page.evaluate(([familyName, keyName]) => app[familyName][keyName], [family, key]);
    const point = await logicalPoint(page, rect.x + rect.w / 2, rect.y + rect.h / 2);
    await page.mouse.click(point.x, point.y);
    return rect;
}

async function logicalPoint(page, x, y) {
    const box = await page.locator('canvas').boundingBox();
    assert(box, 'canvas has no browser layout box');
    const size = await page.evaluate(() => ({ width: fixture.width, height: fixture.height }));
    return { x: box.x + x * box.width / size.width, y: box.y + y * box.height / size.height };
}

async function scrollRetentionToBottom(page) {
    const viewport = await page.evaluate(() => app.retentionButtons.viewport);
    for (let i = 0; i < 7; i++) {
        const from = await logicalPoint(page, viewport.x + viewport.w / 2, viewport.y + viewport.h * 0.75);
        const to = await logicalPoint(page, viewport.x + viewport.w / 2, viewport.y + viewport.h * 0.2);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 8 });
        await page.mouse.up();
    }
    await page.waitForFunction(() => app.retentionButtons && app.retentionPreview.offset >= app.retentionButtons.maxScroll - 1);
}

async function assertStatusRetryVisibleAndDragSafe(page, expectedStatus) {
    await page.waitForFunction(status => app.retentionPreview.status === status &&
        app.retentionButtons && app.retentionButtons.primary, expectedStatus);
    const layout = await page.evaluate(() => ({
        primary: app.retentionButtons.primary,
        viewport: app.retentionButtons.viewport,
        maxScroll: app.retentionButtons.maxScroll
    }));
    assert(layout.primary, expectedStatus + ' retry is not actionable');
    assert.strictEqual(layout.maxScroll, 0, expectedStatus + ' status page unexpectedly scrolls');
    assert(layout.primary.y >= layout.viewport.y &&
        layout.primary.y + layout.primary.h <= layout.viewport.y + layout.viewport.h,
    expectedStatus + ' retry is not fully visible in the viewport');
    const from = await logicalPoint(page, layout.primary.x + layout.primary.w / 2, layout.primary.y + layout.primary.h / 2);
    const to = await logicalPoint(page, layout.primary.x + layout.primary.w / 2, layout.primary.y - 28);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(100);
    assert.strictEqual(await page.evaluate(() => app.retentionPreview.status), expectedStatus,
        expectedStatus + ' drag activated retry');
    assert.strictEqual(await page.evaluate(() => app.retentionPreview.offset), 0,
        expectedStatus + ' drag changed offset');
}

async function openFixture(browser, base, width, height, errors) {
    const page = await browser.newPage({ viewport: { width: Math.max(width, 980), height: Math.max(height + 220, 800) } });
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(String(error)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
    await page.goto(base + '/?width=' + width + '&height=' + height);
    await page.waitForFunction(() => app && app.menuButtons && app.menuButtons.retention);
    const wallet = await page.evaluate(() => fixture.storage.match3_coin_v1);
    await clickRect(page, 'menuButtons', 'retention');
    await page.waitForFunction(() => app.state === 'retention_preview' && app.retentionPreview && app.retentionButtons);
    return { page, wallet };
}

async function setModel(page, preset) {
    await page.evaluate(name => applyPreset(name), preset);
    await page.waitForTimeout(80);
}

async function assertWalletUnchanged(page, before, label) {
    assert.strictEqual(await page.evaluate(() => fixture.storage.match3_coin_v1), before, label + ' changed the real wallet key');
}

async function runFunctionalChecks(browser, base, errors) {
    const widthOption = process.argv.find(argument => argument.startsWith('--width='));
    const requestedWidth = widthOption ? Number(widthOption.slice('--width='.length)) : 0;
    const sizes = [[320, 568], [390, 844]].filter(size => !requestedWidth || size[0] === requestedWidth);
    assert(sizes.length, 'functional --width must be 320 or 390');
    for (const [width, height] of sizes) {
        const opened = await openFixture(browser, base, width, height, errors);
        const page = opened.page;
        await page.waitForFunction(() => app.retention && app.retentionPreview.real && app.retentionPreview.status === 'ready');
        assert.strictEqual(opened.wallet, 2460, 'functional wallet fixture changed its initial balance');
        assert.deepStrictEqual(await page.evaluate(() => ({
            date: app.retentionPreview.date,
            week: app.retentionPreview.week,
            refresh: new Date(app.retentionPreview.weekEndsAt + 8 * 3600000).toISOString().slice(0, 16)
        })), { date: '2026-09-21', week: '2026-09-21', refresh: '2026-09-28T00:00' });

        await scrollRetentionToBottom(page);
        await clickRect(page, 'retentionButtons', 'primary');
        await page.waitForFunction(() => app.retentionPreview.signed && app.retentionPreview.status === 'ready' && fixture.storage.match3_coin_v1 === 2560);
        assert((await page.evaluate(() => fixture.notices)).some(message => message.includes('+100金币')), 'signin reward feedback missing');
        const signinNoticeCount = await page.evaluate(() => fixture.notices.length);
        await appSync(page);
        assert.strictEqual(await page.evaluate(() => fixture.storage.match3_coin_v1), 2560, 'signin replay credited twice');
        await page.evaluate(() => { app.retentionPreview.offset = 0; });
        await page.waitForTimeout(100);
        await page.locator('canvas').screenshot({ path: path.join(out, 'functional-signin-' + width + '.png') });

        await clickRect(page, 'retentionButtons', 'close');
        await page.waitForFunction(() => app.state === 'menu');
        const first = await page.evaluate(() => playActualSolo());
        assert(first.cleared > 0 && first.moves > 0, 'first solo did not preserve real match counters');
        await page.locator('canvas').screenshot({ path: path.join(out, 'functional-result-' + width + '.png') });
        await page.evaluate(() => finishActualSolo());
        await page.waitForFunction(() => app.state === 'menu' && app.retentionPreview.status === 'ready');
        assert([2600, 2660].includes(await page.evaluate(() => fixture.storage.match3_coin_v1)),
            'first real game credited outside its eligible task rewards');
        assert(!(await page.evaluate(() => fixture.storage.match3_coin_receipts_v1 || [])).includes('solo:first:1'),
            'old fixture level received a first-clear reward');

        const second = await page.evaluate(() => playActualSolo());
        assert(second.cleared > 0 && second.id !== first.id, 'second solo did not create independent real match evidence');
        await page.evaluate(() => finishActualSolo());
        await page.waitForFunction(() => app.state === 'menu' && app.retentionPreview.status === 'ready' && fixture.storage.match3_coin_v1 === 2720);
        assert.deepStrictEqual(await page.evaluate(() => app.retentionPreview.taskProgress), [1, 2, 80]);
        const taskFeedbackTotal = (await page.evaluate(start => fixture.notices.slice(start), signinNoticeCount))
            .reduce((sum, message) => sum + Number((/\+(\d+)金币/.exec(message) || [0, 0])[1]), 0);
        assert.strictEqual(taskFeedbackTotal, 160, 'task reward feedback did not total 160 coins');
        assert(!(await page.evaluate(() => fixture.storage.match3_coin_receipts_v1 || [])).includes('solo:first:1'),
            'repeated old level received a first-clear reward');

        await clickRect(page, 'menuButtons', 'retention');
        await page.waitForFunction(() => app.state === 'retention_preview' && app.retentionButtons && app.retentionPreview.status === 'ready');
        await clickRect(page, 'retentionButtons', 'tasksTab');
        await page.waitForFunction(() => app.retentionButtons && app.retentionPreview.tab === 'tasks');
        if (width === 320) {
            await page.locator('canvas').screenshot({ path: path.join(out, 'functional-tasks-top-320.png') });
        }
        await page.evaluate(() => { app.retentionPreview.offset = app.retentionButtons.maxScroll; });
        await page.waitForTimeout(100);
        await page.locator('canvas').screenshot({ path: path.join(out, 'functional-tasks-' + width + '.png') });

        await page.evaluate(() => { fixture.offline = true; return app.retention.sync(); });
        await page.waitForFunction(() => app.retentionPreview.status === 'offline');
        await assertStatusRetryVisibleAndDragSafe(page, 'offline');
        await page.locator('canvas').screenshot({ path: path.join(out, 'functional-offline-' + width + '.png') });
        await page.evaluate(() => { fixture.offline = false; });
        await clickRect(page, 'retentionButtons', 'primary');
        await page.waitForFunction(() => app.retentionPreview.status === 'ready');
        assert.strictEqual(await page.evaluate(() => fixture.storage.match3_coin_v1), 2720, 'offline retry duplicated a reward');

        await page.locator('#advance-day').click();
        await page.waitForFunction(() => app.retentionPreview.status === 'ready' && app.retentionPreview.date === '2026-09-22');
        assert.deepStrictEqual(await page.evaluate(() => app.retentionPreview.taskProgress), [0, 0, 0]);
        await clickRect(page, 'retentionButtons', 'close');
        await page.waitForFunction(() => app.state === 'menu');
        assert.strictEqual(await page.evaluate(() => fixture.storage.match3_coin_v1), 2720, 'functional close changed wallet');
        assert((await page.evaluate(() => fixture.cloudAttempts)).every(request => /^retention/.test(request.action)),
            'functional fixture sent a non-retention service request');
        console.log(JSON.stringify({ width, height, functional: true, passed: true, wallet: 2720,
            taskProgress: [1, 2, 80], date: '2026-09-22' }));
        await page.close();
    }
}

async function appSync(page) {
    await page.evaluate(() => app.retention.sync());
    await page.waitForFunction(() => app.retentionPreview.status === 'ready');
}

async function runChecks(base) {
    let chromium;
    try {
        chromium = require('playwright').chromium;
    } catch (error) {
        try {
            chromium = require('/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright').chromium;
        } catch (fallbackError) {
            throw new Error('The --check mode requires Playwright in NODE_PATH; the default local preview server does not.');
        }
    }
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    const errors = [];
    try {
        if (functionalMode) {
            await runFunctionalChecks(browser, base, errors);
            assert.deepStrictEqual(errors, []);
            return;
        }
        const widthOption = process.argv.find(argument => argument.startsWith('--width='));
        const requestedWidth = widthOption ? Number(widthOption.slice('--width='.length)) : 0;
        const scenarioOption = process.argv.find(argument => argument.startsWith('--scenario='));
        const requestedScenario = scenarioOption ? scenarioOption.slice('--scenario='.length) : '';
        assert(!requestedScenario || ['previous', 'states'].includes(requestedScenario), 'unsupported --scenario');
        assert(requestedScenario !== 'states' || requestedWidth === 320, '--scenario=states requires --width=320');
        const sizes = [[320, 568], [390, 844], [430, 932]].filter(size => !requestedWidth || size[0] === requestedWidth);
        assert(sizes.length, 'unsupported --width; choose 320, 390 or 430');
        for (const [width, height] of sizes) {
            const opened = await openFixture(browser, base, width, height, errors);
            const page = opened.page;
            if (requestedScenario === 'previous') {
                await setModel(page, 'previous');
                const activityBefore = await page.evaluate(() => app.retentionPreview.activity);
                await scrollRetentionToBottom(page);
                await page.waitForFunction(() => app.retentionButtons && app.retentionButtons.previous0);
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-previous-week-before-' + width + '.png') });
                await clickRect(page, 'retentionButtons', 'previous0');
                await page.waitForFunction(() => app.retentionPreview.previousWeek.claimed[0] === true);
                assert.strictEqual(await page.evaluate(() => app.retentionPreview.activity), activityBefore, 'previous-week claim changed current activity');
                await assertWalletUnchanged(page, opened.wallet, 'previous-week preview');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-previous-week-after-' + width + '.png') });
                assert.strictEqual(await page.evaluate(() => fixture.cloudAttempts.length), 0, 'previous-week preview attempted a cloud request');
                await page.close();
                console.log(JSON.stringify({ width, height, scenario: 'previous', passed: true, wallet: opened.wallet, activity: activityBefore, cloudAttempts: 0 }));
                continue;
            }
            if (requestedScenario === 'states') {
                await setModel(page, 'loading');
                assert.strictEqual(await page.evaluate(() => app.retentionButtons.maxScroll), 0, 'loading status page unexpectedly scrolls');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-loading-320.png') });

                await setModel(page, 'pending');
                assert.strictEqual(await page.evaluate(() => app.retentionButtons.maxScroll), 0, 'pending status page unexpectedly scrolls');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-pending-320.png') });

                await setModel(page, 'offline');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-offline-320.png') });
                await assertStatusRetryVisibleAndDragSafe(page, 'offline');
                await clickRect(page, 'retentionButtons', 'primary');
                await page.waitForFunction(() => app.retentionPreview.status === 'ready');
                assert.strictEqual(await page.evaluate(() => app.retentionPreview.offset), 0, 'offline retry did not restore offset 0');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-offline-retry-320.png') });

                await setModel(page, 'error');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-error-320.png') });
                await assertStatusRetryVisibleAndDragSafe(page, 'error');
                await clickRect(page, 'retentionButtons', 'primary');
                await page.waitForFunction(() => app.retentionPreview.status === 'ready');
                assert.strictEqual(await page.evaluate(() => app.retentionPreview.offset), 0, 'error retry did not restore offset 0');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-error-retry-320.png') });

                await setModel(page, 'pending');
                await clickRect(page, 'retentionButtons', 'close');
                await page.waitForFunction(() => app.state === 'menu');
                await assertWalletUnchanged(page, opened.wallet, 'status preview');
                assert.strictEqual(await page.evaluate(() => fixture.cloudAttempts.length), 0, 'status preview attempted a cloud request');
                await page.close();
                console.log(JSON.stringify({ width, height, scenario: 'states', passed: true, wallet: opened.wallet, cloudAttempts: 0 }));
                continue;
            }
            await setModel(page, 'unsigned');
            await page.locator('canvas').screenshot({ path: path.join(out, 'retention-signin-' + width + '.png') });
            await setModel(page, 'tasks');
            await page.locator('canvas').screenshot({ path: path.join(out, 'retention-tasks-' + width + '.png') });
            await assertWalletUnchanged(page, opened.wallet, width + ' normal previews');

            if (width === 320) {
                await setModel(page, 'loading');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-loading-320.png') });

                await setModel(page, 'offline');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-offline-320.png') });
                await assertStatusRetryVisibleAndDragSafe(page, 'offline');
                await clickRect(page, 'retentionButtons', 'primary');
                await page.waitForFunction(() => app.retentionPreview.status === 'ready');
                assert.strictEqual(await page.evaluate(() => app.retentionPreview.offset), 0, 'offline retry did not restore offset 0');
                await assertWalletUnchanged(page, opened.wallet, 'offline retry preview');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-offline-retry-320.png') });

                await setModel(page, 'error');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-error-320.png') });
                await setModel(page, 'pending');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-pending-320.png') });

                await setModel(page, 'rules');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-rules-320.png') });
                await scrollRetentionToBottom(page);
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-rules-bottom-320.png') });
                await clickRect(page, 'retentionButtons', 'rules');
                assert.strictEqual(await page.evaluate(() => app.state), 'retention_preview', 'rules return left the retention page');
                assert.strictEqual(await page.evaluate(() => app.retentionPreview.rules), false, 'rules return did not restore the main retention page');
                assert.strictEqual(await page.evaluate(() => app.retentionPreview.offset), 0, 'rules return did not restore offset 0');

                await setModel(page, 'day7');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-day7-top-before-320.png') });
                await scrollRetentionToBottom(page);
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-scroll-bottom-320.png') });
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-day7-before-320.png') });
                await clickRect(page, 'retentionButtons', 'primary');
                await page.waitForFunction(() => app.retentionPreview.signed === true);
                await page.evaluate(() => { app.retentionPreview.offset = 0; });
                await page.waitForTimeout(80);
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-day7-reward-320.png') });
                await page.evaluate(() => { app.retentionPreview.message = ''; });
                await page.waitForTimeout(80);
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-day7-after-320.png') });
                await assertWalletUnchanged(page, opened.wallet, 'day 7 preview');

                await setModel(page, 'chests');
                await page.evaluate(() => { app.retentionPreview.offset = app.retentionButtons.maxScroll; });
                await page.waitForFunction(() => app.retentionButtons && app.retentionButtons.weekly0);
                const weekly = await page.evaluate(() => app.retentionButtons.weekly0);
                const weeklyFrom = await logicalPoint(page, weekly.x + weekly.w / 2, weekly.y + weekly.h / 2);
                const weeklyTo = await logicalPoint(page, weekly.x + weekly.w / 2, Math.max(weekly.y - 90, 10));
                await page.mouse.move(weeklyFrom.x, weeklyFrom.y);
                await page.mouse.down();
                await page.mouse.move(weeklyTo.x, weeklyTo.y, { steps: 8 });
                await page.mouse.up();
                await page.waitForTimeout(100);
                assert.strictEqual(await page.evaluate(() => app.retentionPreview.claimed[0]), false, 'scroll gesture claimed a weekly chest');
                await clickRect(page, 'retentionButtons', 'weekly0');
                assert.strictEqual(await page.evaluate(() => app.retentionPreview.claimed[0]), true, 'weekly chest click did not update preview state');
                await assertWalletUnchanged(page, opened.wallet, 'weekly chest preview');
                await page.locator('canvas').screenshot({ path: path.join(out, 'retention-chest-claimed-320.png') });

                await setModel(page, 'unsigned');
                await clickRect(page, 'retentionButtons', 'tasksTab');
                assert.strictEqual(await page.evaluate(() => app.retentionPreview.tab), 'tasks', 'tasks tab did not switch');
                await clickRect(page, 'retentionButtons', 'signinTab');
                assert.strictEqual(await page.evaluate(() => app.retentionPreview.tab), 'signin', 'signin tab did not switch');
                await clickRect(page, 'retentionButtons', 'close');
                await page.waitForFunction(() => app.state === 'menu');
                await assertWalletUnchanged(page, opened.wallet, 'tab and close preview');
            }
            assert.strictEqual(await page.evaluate(() => fixture.cloudAttempts.length), 0, 'retention preview attempted a cloud request');
            await page.close();
            console.log(JSON.stringify({ width, height, passed: true, wallet: opened.wallet, cloudAttempts: 0 }));
        }
        assert.deepStrictEqual(errors, []);
    } finally {
        await browser.close();
    }
}

server.listen(0, '127.0.0.1', async () => {
    const base = 'http://127.0.0.1:' + server.address().port;
    if (!process.argv.includes('--check')) {
        console.log('Retention local preview: ' + base);
        return;
    }
    try {
        await runChecks(base);
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    } finally {
        server.close();
    }
});
