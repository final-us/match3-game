'use strict';

// Local-only cat catalog UI acceptance harness. It runs the real Main canvas
// with recursively bundled client modules; companion selection alone uses page
// session storage. Other data stays in memory; cloud and audio are disabled.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '../match3-wechat');
const out = path.resolve(__dirname, '../assets/_incoming/cat-catalog-v1/screens');
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
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>猫咪图鉴 · 本地临时预览</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#dfe5f7;color:#17224f;font:13px/1.35 system-ui,-apple-system,sans-serif}
#toolbar{position:sticky;top:0;z-index:2;padding:8px 10px;background:#f7f8ff;border-bottom:1px solid #b8c2e1;box-shadow:0 2px 8px #36427022}
#toolbar strong{color:#8b356d}#toolbar .row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px}
button{font:inherit;min-height:30px;border:1px solid #aab4d5;border-radius:7px;background:white;color:#17224f;padding:4px 8px;cursor:pointer}
button:hover{background:#fff2fa}.sizes a{margin-right:7px;color:#4054a1}
#stage{padding:10px;display:flex;justify-content:center}canvas{display:block;touch-action:none;background:#111a48;box-shadow:0 8px 24px #27355d42}
#status{display:block;min-height:20px;color:#49557c;margin-top:5px}
</style></head><body><section id="toolbar">
<div><strong>开发预览：成长为临时数据，陪伴选择仅保存在本页会话。不连接真实云、不消耗货币。</strong></div>
<div class="row sizes">尺寸 <a href="/?width=320&height=568">320×568</a><a href="/?width=390&height=844">390×844</a><a href="/?width=430&height=932">430×932</a>
<button id="open">从首页打开</button><button id="reset">重置临时数据</button><button id="hide-show">模拟切后台/回前台</button></div>
<div class="row">快捷状态
<button data-preset="initial">初始</button><button data-preset="mixed">第7天</button><button data-preset="locked">第3天锁定</button><button data-preset="adopted">已领养两只</button>
<button data-preset="loading">加载</button><button data-preset="offline">断网</button><button data-preset="error">错误</button></div>
<div class="row">成长演示
<button data-preset="growth">奶糖 · 亲密3</button><button data-preset="hungry">小鱼干0</button><button data-preset="maxed">满级42</button><button data-preset="stages">回忆20</button>
<button id="round-win">模拟有效完成一局</button><button id="round-exit">模拟主动退出（不计）</button><button id="next-day">模拟下一日</button></div>
<output id="status"></output></section><main id="stage"><canvas></canvas></main><script src="/fixture.js"></script></body></html>`;

const fixture = `
const sources=${packedSources},cache=Object.create(null),params=new URLSearchParams(location.search),events={};
const width=Number(params.get('width'))||390,height=Number(params.get('height'))||844;
const canvas=document.querySelector('canvas'),statusLine=document.querySelector('#status');
canvas.style.width=width+'px';canvas.style.height=height+'px';
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const initialStorage={match3_music_enabled_v1:false,match3_sfx_enabled_v1:false,match3_coin_v1:2460,match3_onboarding_v1:{pvp_wait:true}};
const storedCompanion=sessionStorage.getItem('catalog-preview-companion');
if(storedCompanion)initialStorage.match3_companion_display_v1=JSON.parse(storedCompanion);
const storage=clone(initialStorage),storageWrites=[],cloudAttempts=[],notices=[];
window.fixture={width,height,storage,storageWrites,cloudAttempts,notices,events};
window.wx={
 createCanvas:()=>canvas,createImage:()=>new Image(),
 loadSubpackage:options=>{fixture.subpackageRequests=(fixture.subpackageRequests||0)+1;fixture.packageRequest=options;if(!fixture.holdPackage)setTimeout(()=>options.success(),50);return {onProgressUpdate(){}};},
 getStorageSync:key=>key in storage?clone(storage[key]):'',
 setStorageSync:(key,value)=>{if(key==='match3_companion_display_v1'){if(fixture.failCompanionWrite)throw Error('fixture write failure');sessionStorage.setItem('catalog-preview-companion',JSON.stringify(value));}storage[key]=clone(value);storageWrites.push({type:'set',key,value:clone(value)});},
 removeStorageSync:key=>{delete storage[key];storageWrites.push({type:'remove',key});},
 getSystemInfoSync:()=>({windowWidth:width,windowHeight:height,pixelRatio:2,platform:'devtools',safeArea:{top:47,bottom:height-34,left:0,right:width}}),
 getMenuButtonBoundingClientRect:()=>({top:51,bottom:83,left:width-92,right:width-8,width:84,height:32}),
 getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),
 onTouchStart:fn=>events.start=fn,onTouchMove:fn=>events.move=fn,onTouchEnd:fn=>events.end=fn,onTouchCancel:fn=>events.cancel=fn,
 onShow:fn=>events.show=fn,onHide:fn=>events.hide=fn,onError:()=>{},onUnhandledRejection:()=>{},
 showToast:options=>{const message=String(options&&options.title||'');notices.push(message);statusLine.textContent='本地提示：'+message;},
 showModal:options=>{statusLine.textContent='本地提示：'+String(options&&options.content||'');},
 showShareMenu:()=>{},onShareAppMessage:()=>{},
 createInnerAudioContext:()=>({play(){},pause(){},stop(){},destroy(){},onPlay(){},onError(){},onEnded(){},set src(value){},set loop(value){},set volume(value){}}),
 cloud:{init:()=>{},callFunction:options=>{const payload=clone(options&&options.data||{});cloudAttempts.push(payload);const error={errMsg:'local catalog preview rejects all cloud requests'};if(options&&options.fail)setTimeout(()=>options.fail(error),0);return Promise.resolve();}}
};
function load(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};
 const req=relative=>{const parts=id.split('/');parts.pop();relative.split('/').forEach(part=>part==='..'?parts.pop():part!=='.'&&parts.push(part));return load(parts.join('/')+'.js');};
 new Function('require','module','exports',sources[id])(req,module,module.exports);return module.exports;}
window.load=load;
function point(event){const rect=canvas.getBoundingClientRect();return {clientX:(event.clientX-rect.left)*width/rect.width,clientY:(event.clientY-rect.top)*height/rect.height};}
canvas.onpointerdown=event=>{canvas.setPointerCapture(event.pointerId);events.start&&events.start({touches:[point(event)]});};
canvas.onpointermove=event=>{if(event.buttons&&events.move)events.move({touches:[point(event)]});};
canvas.onpointerup=event=>{events.end&&events.end({changedTouches:[point(event)]});};
canvas.onpointercancel=event=>{events.cancel&&events.cancel({changedTouches:[point(event)]});};
window.app=new (load('js/main.js'))({retentionSample:true});
const catalogModel=load('js/platform/catalog-preview.js');
function replaceCatalogModel(next){if(next&&typeof next==='object')app.catalogPreview=next;app.catalogButtons=null;app.catalogTouch=null;return clone(app.catalogPreview);}
window.applyPreset=name=>replaceCatalogModel(catalogModel.create(name));
window.tapRect=rect=>{if(!rect)return false;const p={clientX:rect.x+rect.w/2,clientY:rect.y+rect.h/2};events.start&&events.start({touches:[p]});events.end&&events.end({changedTouches:[p]});return true;};
window.openCatalog=()=>tapRect(app.menuButtons&&app.menuButtons.catalog);
window.catalogStatus=id=>catalogModel.statusFor(app.catalogPreview,id);
window.activateCatalog=action=>replaceCatalogModel(catalogModel.activate(app.catalogPreview,action));
window.simulateRound=completed=>replaceCatalogModel(catalogModel.completeRound(app.catalogPreview,completed));
window.simulateNextDay=()=>replaceCatalogModel(catalogModel.nextDay(app.catalogPreview));
document.querySelector('#open').onclick=()=>{if(!openCatalog())statusLine.textContent='请先返回首页，或等待真实 Main 提供 menuButtons.catalog。';};
document.querySelector('#reset').onclick=()=>{sessionStorage.removeItem('catalog-preview-companion');location.reload();};
document.querySelector('#hide-show').onclick=()=>{events.hide&&events.hide();events.show&&events.show();};
document.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>applyPreset(button.dataset.preset));
document.querySelector('#round-win').onclick=()=>simulateRound(true);
document.querySelector('#round-exit').onclick=()=>simulateRound(false);
document.querySelector('#next-day').onclick=()=>simulateNextDay();
setInterval(()=>{statusLine.textContent='真实 Main Canvas｜'+width+'×'+height+'｜状态 '+app.state+'｜临时图鉴 '+JSON.stringify(app.catalogPreview&&app.catalogPreview.owned||[])+'｜存储写入 '+storageWrites.length+'｜云请求已拒绝 '+cloudAttempts.length;},250);
`;

function contentType(file) {
    const ext = path.extname(file).toLowerCase();
    return ({ '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.json': 'application/json; charset=utf-8' })[ext] || 'application/octet-stream';
}

const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
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

async function logicalPoint(page, x, y) {
    const box = await page.locator('canvas').boundingBox();
    assert(box, 'canvas has no browser layout box');
    const size = await page.evaluate(() => ({ width: fixture.width, height: fixture.height }));
    return { x: box.x + x * box.width / size.width, y: box.y + y * box.height / size.height };
}

async function clickRect(page, family, key) {
    await page.waitForFunction(([familyName, keyName]) => app[familyName] && app[familyName][keyName], [family, key]);
    const rect = await page.evaluate(([familyName, keyName]) => app[familyName][keyName], [family, key]);
    const point = await logicalPoint(page, rect.x + rect.w / 2, rect.y + rect.h / 2);
    await page.mouse.click(point.x, point.y);
    return rect;
}

async function setModel(page, preset) {
    await page.evaluate(name => applyPreset(name), preset);
    await page.waitForFunction(() => app.catalogButtons);
}

async function waitButtons(page) {
    await page.waitForFunction(() => app.catalogButtons);
}

async function waitFrame(page) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function assertActionInCanvas(page, key, label) {
    const result = await page.evaluate(action => {
        const rect = app.catalogButtons && app.catalogButtons[action];
        return { rect, width: fixture.width, height: fixture.height };
    }, key);
    assert(result.rect, label + ' action is missing');
    assert(result.rect.x >= 0 && result.rect.y >= 0 && result.rect.x + result.rect.w <= result.width &&
        result.rect.y + result.rect.h <= result.height, label + ' action is outside the canvas');
    assert(result.rect.w >= 44 && result.rect.h >= 44, label + ' action is smaller than 44px');
}

async function snapshot(page) {
    return page.evaluate(() => ({
        wallet: fixture.storage.match3_coin_v1,
        storage: JSON.stringify(fixture.storage),
        writes: fixture.storageWrites.length,
        cloud: fixture.cloudAttempts.length
    }));
}

async function assertExternalStateUnchanged(page, baseline, label) {
    assert.deepStrictEqual(await snapshot(page), baseline, label + ' changed wallet, storage, storage writes, or cloud attempts');
}

async function openFixture(browser, base, width, height, errors) {
    const page = await browser.newPage({ viewport: { width: Math.max(width, 980), height: Math.max(height + 220, 800) } });
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(width + 'x' + height + ': ' + String(error)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
    await page.goto(base + '/?width=' + width + '&height=' + height);
    await page.waitForFunction(() => app && app.state === 'menu' && app.menuButtons && app.menuButtons.catalog);
    await page.waitForTimeout(100);
    const baseline = await snapshot(page);
    await clickRect(page, 'menuButtons', 'catalog');
    await page.waitForFunction(() => app.state === 'catalog_preview' && app.catalogPreview && app.catalogButtons && load('js/render/assets.js').getCatalogState().status==='ready');
    return { page, baseline };
}

async function dragRect(page, rect, cancel) {
    const from = await logicalPoint(page, rect.x + rect.w / 2, rect.y + rect.h / 2);
    const to = await logicalPoint(page, rect.x + rect.w / 2, Math.max(5, rect.y - 80));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    if (cancel) {
        await page.evaluate(({ x, y }) => {
            const canvas = document.querySelector('canvas');
            const box = canvas.getBoundingClientRect();
            canvas.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1,
                clientX: box.left + x * box.width / fixture.width,
                clientY: box.top + y * box.height / fixture.height }));
        }, { x: rect.x + rect.w / 2, y: Math.max(5, rect.y - 80) });
        await page.mouse.up();
    } else {
        await page.mouse.up();
    }
    await page.waitForTimeout(100);
}

async function deepChecks(page, baseline) {
    await setModel(page, 'initial');
    assert.deepStrictEqual(await page.evaluate(() => app.catalogPreview.owned), [], 'initial catalog unexpectedly owns a cat');
    await clickRect(page, 'catalogButtons', 'cat:cream');
    await page.waitForFunction(() => app.catalogPreview.view === 'detail' && app.catalogPreview.selectedId === 'cream');
    assert.deepStrictEqual(await page.evaluate(() => app.catalogPreview.owned), [], 'opening a card adopted it');
    await page.locator('canvas').screenshot({ path: path.join(out, 'catalog-detail-cream-320.png') });
    await clickRect(page, 'catalogButtons', 'adopt');
    await page.waitForFunction(() => app.catalogPreview.owned.includes('cream'));
    assert.deepStrictEqual(await page.evaluate(() => app.catalogPreview.owned), ['cream'], 'free adoption did not add exactly one cat');
    await page.evaluate(() => activateCatalog('adopt'));
    assert.deepStrictEqual(await page.evaluate(() => app.catalogPreview.owned), ['cream'], 'adoption replay duplicated the cat');
    await clickRect(page, 'catalogButtons', 'back');
    await page.waitForFunction(() => app.catalogPreview.view === 'list');

    await setModel(page, 'locked');
    await clickRect(page, 'catalogButtons', 'cat:ragdoll');
    await page.waitForFunction(() => app.catalogPreview.view === 'detail' && app.catalogPreview.selectedId === 'ragdoll');
    await waitButtons(page);
    assert.notStrictEqual(await page.evaluate(() => catalogStatus('ragdoll')), 'adoptable', 'day 3 unlocked the second cat');
    assert(!await page.evaluate(() => !!app.catalogButtons.adopt), 'day 3 second cat exposes an adopt action');
    await clickRect(page, 'catalogButtons', 'back');

    await setModel(page, 'mixed');
    await clickRect(page, 'catalogButtons', 'cat:ragdoll');
    await page.waitForFunction(() => app.catalogPreview.view === 'detail' && app.catalogPreview.selectedId === 'ragdoll');
    assert.strictEqual(await page.evaluate(() => catalogStatus('ragdoll')), 'adoptable', 'day 7 did not unlock the second cat');
    await clickRect(page, 'catalogButtons', 'adopt');
    assert.deepStrictEqual(await page.evaluate(() => app.catalogPreview.owned), ['cream', 'ragdoll'], 'day 7 adoption did not add the second cat');
    await clickRect(page, 'catalogButtons', 'back');
    await page.waitForFunction(() => app.catalogPreview.view === 'list');
    await waitButtons(page);

    const viewport = await page.evaluate(() => app.catalogButtons.viewport);
    const ownedBeforeDrag = await page.evaluate(() => app.catalogPreview.owned.slice());
    const offsetBeforeDrag = await page.evaluate(() => Math.max(app.catalogPreview.offset || 0, app.catalogPreview.listOffset || 0));
    await dragRect(page, viewport, false);
    assert.deepStrictEqual(await page.evaluate(() => app.catalogPreview.owned), ownedBeforeDrag, 'drag adopted a cat');
    assert((await page.evaluate(() => Math.max(app.catalogPreview.offset || 0, app.catalogPreview.listOffset || 0))) >= offsetBeforeDrag,
        'drag produced an invalid scroll offset');
    const visibleCatKeys = await page.evaluate(() => Object.keys(app.catalogButtons).filter(key => key.startsWith('cat:')));
    assert(visibleCatKeys.length > 0, 'narrow scrolled list exposes no visible card hitboxes');
    assert((await page.evaluate(() => app.catalogButtons.maxScroll)) > 0, 'narrow catalog unexpectedly has no scrolling');
    assert(await page.evaluate(keys => keys.every(key => {
        const rect = app.catalogButtons[key], viewport = app.catalogButtons.viewport;
        return rect.y + rect.h > viewport.y && rect.y < viewport.y + viewport.h;
    }), visibleCatKeys), 'catalog exposed an offscreen card hitbox');
    const cancelTarget = await page.evaluate(key => app.catalogButtons[key], visibleCatKeys[0]);
    const selectedBeforeCancel = await page.evaluate(() => app.catalogPreview.selectedId);
    await dragRect(page, cancelTarget, true);
    assert.strictEqual(await page.evaluate(() => app.catalogPreview.view), 'list', 'cancelled pointer opened a detail');
    assert.strictEqual(await page.evaluate(() => app.catalogPreview.selectedId), selectedBeforeCancel, 'cancelled pointer changed selection');

    await page.evaluate(() => {
        app.catalogPreview.offset = app.catalogButtons.maxScroll;
        app.catalogPreview.listOffset = app.catalogButtons.maxScroll;
    });
    await page.waitForFunction(() => app.catalogButtons && app.catalogButtons['cat:siamese']);
    await clickRect(page, 'catalogButtons', 'cat:siamese');
    await page.waitForFunction(() => app.catalogPreview.view === 'detail' && app.catalogPreview.selectedId === 'siamese');
    await waitButtons(page);
    assert.notStrictEqual(await page.evaluate(() => catalogStatus('siamese')), 'adoptable', 'third cat unlocked after only two owned cats');
    assert(!await page.evaluate(() => !!app.catalogButtons.adopt), 'third cat exposes adoption after only two owned cats');
    await clickRect(page, 'catalogButtons', 'back');
    await clickRect(page, 'catalogButtons', 'close');
    await page.waitForFunction(() => app.state === 'menu');

    await clickRect(page, 'menuButtons', 'catalog');
    await page.waitForFunction(() => app.state === 'catalog_preview');
    const modelBeforeLifecycle = await page.evaluate(() => JSON.stringify(app.catalogPreview));
    await page.locator('#hide-show').click();
    await page.waitForTimeout(80);
    assert.strictEqual(await page.evaluate(() => JSON.stringify(app.catalogPreview)), modelBeforeLifecycle, 'hide/show changed temporary catalog state');
    await assertExternalStateUnchanged(page, baseline, 'catalog interactions');
}

async function stateScreens(page, baseline) {
    for (const state of ['loading', 'offline', 'error']) {
        await setModel(page, state);
        assert.strictEqual(await page.evaluate(() => app.catalogButtons.maxScroll), 0, state + ' status page unexpectedly scrolls');
        await page.locator('canvas').screenshot({ path: path.join(out, 'catalog-' + state + '-320.png') });
        if (state !== 'loading') {
            const retry = await page.evaluate(() => app.catalogButtons.retry);
            assert(retry, state + ' status has no retry hitbox');
            await dragRect(page, retry, true);
            assert.strictEqual(await page.evaluate(() => app.catalogPreview.status), state, state + ' cancelled pointer activated retry');
            await clickRect(page, 'catalogButtons', 'retry');
            await page.waitForFunction(() => app.catalogPreview.status === 'ready');
        }
    }
    await assertExternalStateUnchanged(page, baseline, 'catalog failure states');
}

async function growthChecks(page, baseline, width) {
    const shot = name => page.locator('canvas').screenshot({ path: path.join(out, name + '-' + width + '.png') });
    const growth = () => page.evaluate(() => ({
        affection: app.catalogPreview.affection.cream,
        fish: app.catalogPreview.fish,
        day: app.catalogPreview.previewDay,
        rounds: app.catalogPreview.roundsToday,
        days: app.catalogPreview.days,
        lastActiveDay: app.catalogPreview.lastActivePreviewDay,
        overlay: app.catalogPreview.overlay && clone(app.catalogPreview.overlay)
    }));

    await setModel(page, 'growth');
    assert(await page.evaluate(() => app.catalogPreview.view === 'detail' && app.catalogPreview.selectedId === 'cream' &&
        app.catalogPreview.owned.includes('cream')), 'growth preset did not open owned cream detail');
    assert.deepStrictEqual(await growth(), { affection: 3, fish: 2, day: 1, rounds: 0, days: 0,
        lastActiveDay: null, overlay: null });
    await assertActionInCanvas(page, 'feed', 'growth feed');
    await shot('growth-detail');

    await clickRect(page, 'catalogButtons', 'feed');
    await page.waitForFunction(() => app.catalogPreview.overlay && app.catalogPreview.overlay.kind === 'feed');
    await waitButtons(page);
    await assertActionInCanvas(page, 'confirm-feed', 'feed confirmation');
    await assertActionInCanvas(page, 'dismiss', 'feed cancellation');
    await shot('growth-confirm');
    const beforeCancel = await growth();
    await clickRect(page, 'catalogButtons', 'dismiss');
    await page.waitForFunction(() => !app.catalogPreview.overlay);
    assert.deepStrictEqual(await growth(), Object.assign({}, beforeCancel, { overlay: null }), 'cancelled feed changed growth');

    await clickRect(page, 'catalogButtons', 'feed');
    await clickRect(page, 'catalogButtons', 'confirm-feed');
    await page.waitForFunction(() => app.catalogPreview.overlay && app.catalogPreview.overlay.kind === 'unlock');
    await waitButtons(page);
    assert.deepStrictEqual(await page.evaluate(() => ({ affection: app.catalogPreview.affection.cream, fish: app.catalogPreview.fish })),
        { affection: 4, fish: 1 }, 'confirmed feed did not spend one fish for one affection');
    const afterConfirm = await growth();
    await page.evaluate(() => activateCatalog('confirm-feed'));
    await waitButtons(page);
    assert.deepStrictEqual(await growth(), afterConfirm, 'feed confirmation replay applied twice');
    await assertActionInCanvas(page, 'dismiss', 'unlock dismissal');
    await shot('growth-unlock');
    await clickRect(page, 'catalogButtons', 'dismiss');
    await page.waitForFunction(() => !app.catalogPreview.overlay);

    await setModel(page, 'stages');
    if (width === 320) {
        await page.evaluate(() => {
            app.catalogPreview.offset = app.catalogButtons.maxScroll;
            app.catalogButtons = null;
        });
        await waitFrame(page);
        await waitButtons(page);
    }
    assert(await page.evaluate(() => !!app.catalogButtons['stage:3']), 'unlocked affection-20 stage is not reachable');
    assert(await page.evaluate(() => !!app.catalogButtons['stage:4']), 'locked affection-42 threshold is not reachable');
    const beforeStage = await growth();
    await clickRect(page, 'catalogButtons', 'stage:4');
    await page.waitForFunction(() => app.catalogPreview.overlay && app.catalogPreview.overlay.kind === 'gallery' &&
        app.catalogPreview.overlay.stage === 4);
    await waitButtons(page);
    assert(!await page.evaluate(() => !!app.catalogButtons['show-stage']), 'locked affection-42 stage can be selected');
    const lockedGallery = await growth();
    await page.evaluate(() => activateCatalog('show-stage'));
    await waitButtons(page);
    assert.deepStrictEqual(await growth(), lockedGallery, 'locked-stage selection changed the model or closed its explanation');
    await clickRect(page, 'catalogButtons', 'dismiss');
    await page.waitForFunction(() => !app.catalogPreview.overlay);
    await clickRect(page, 'catalogButtons', 'stage:3');
    await page.waitForFunction(() => app.catalogPreview.overlay && app.catalogPreview.overlay.kind === 'gallery' &&
        app.catalogPreview.overlay.stage === 3);
    await waitButtons(page);
    await shot('growth-gallery');
    await assertActionInCanvas(page, 'show-stage', 'gallery selection');
    await assertActionInCanvas(page, 'dismiss', 'gallery dismissal');
    await clickRect(page, 'catalogButtons', 'show-stage');
    await page.waitForFunction(() => !app.catalogPreview.overlay);
    assert.deepStrictEqual(await page.evaluate(() => ({ affection: app.catalogPreview.affection.cream, fish: app.catalogPreview.fish })),
        { affection: beforeStage.affection, fish: beforeStage.fish }, 'stage review changed affection or fish');
    assert.strictEqual(await page.evaluate(() => app.catalogPreview.displayStages.cream), 3,
        'gallery selection did not keep the unlocked affection-20 stage visible');

    await setModel(page, 'hungry');
    await clickRect(page, 'catalogButtons', 'feed');
    await page.waitForFunction(() => app.catalogPreview.overlay && app.catalogPreview.overlay.kind === 'food');
    await waitButtons(page);
    await assertActionInCanvas(page, 'go-play', 'food go-play');
    await assertActionInCanvas(page, 'dismiss', 'food dismissal');
    await shot('growth-food');
    await clickRect(page, 'catalogButtons', 'go-play');
    await page.waitForFunction(() => app.state === 'menu');
    assert.strictEqual((await growth()).fish, 0, 'food prompt changed fish');
    await clickRect(page, 'menuButtons', 'catalog');
    await page.waitForFunction(() => app.state === 'catalog_preview');

    await setModel(page, 'maxed');
    const maxedBefore = await growth();
    assert.strictEqual(maxedBefore.affection, 42, 'maxed preset is not at affection 42');
    await clickRect(page, 'catalogButtons', 'interaction');
    await waitFrame(page);
    assert.deepStrictEqual(await page.evaluate(() => ({ affection: app.catalogPreview.affection.cream, fish: app.catalogPreview.fish })),
        { affection: 42, fish: maxedBefore.fish }, 'maxed interaction spent fish or exceeded affection 42');
    assert(await page.evaluate(() => !app.catalogPreview.overlay && /挚友互动/.test(app.catalogPreview.message)),
        'maxed free interaction did not provide feedback');
    await shot('growth-maxed');

    await setModel(page, 'growth');
    const dailyStart = await growth();
    await page.evaluate(() => simulateRound(true)); await waitButtons(page);
    assert.deepStrictEqual(await page.evaluate(() => ({ fish: app.catalogPreview.fish, affection: app.catalogPreview.affection.cream,
        rounds: app.catalogPreview.roundsToday, days: app.catalogPreview.days })),
        { fish: dailyStart.fish + 1, affection: dailyStart.affection, rounds: 1, days: dailyStart.days + 1 },
    'daily first completed round did not award one fish and one active day');
    const afterFirst = await growth();
    await page.evaluate(() => simulateRound(false)); await waitButtons(page);
    assert.deepStrictEqual(await growth(), afterFirst, 'active exit changed daily growth');
    await page.evaluate(() => simulateRound(true)); await waitButtons(page);
    assert.deepStrictEqual(await page.evaluate(() => ({ fish: app.catalogPreview.fish, rounds: app.catalogPreview.roundsToday,
        days: app.catalogPreview.days })),
        { fish: dailyStart.fish + 1, rounds: 2, days: dailyStart.days + 1 }, 'daily second round awarded fish or another active day');
    await page.evaluate(() => simulateRound(true)); await waitButtons(page);
    assert.deepStrictEqual(await page.evaluate(() => ({ fish: app.catalogPreview.fish, affection: app.catalogPreview.affection.cream,
        rounds: app.catalogPreview.roundsToday, days: app.catalogPreview.days })),
        { fish: dailyStart.fish + 2, affection: dailyStart.affection, rounds: 3, days: dailyStart.days + 1 },
    'daily third round did not award the second fish');
    await page.evaluate(() => simulateNextDay()); await waitButtons(page);
    assert.deepStrictEqual(await page.evaluate(() => ({ day: app.catalogPreview.previewDay, rounds: app.catalogPreview.roundsToday,
        days: app.catalogPreview.days })),
        { day: dailyStart.day + 1, rounds: 0, days: dailyStart.days + 1 }, 'next-day simulation did not reset daily rounds');
    await page.evaluate(() => simulateRound(true)); await waitButtons(page);
    assert.deepStrictEqual(await page.evaluate(() => ({ fish: app.catalogPreview.fish, affection: app.catalogPreview.affection.cream,
        rounds: app.catalogPreview.roundsToday, days: app.catalogPreview.days })),
        { fish: dailyStart.fish + 3, affection: dailyStart.affection, rounds: 1, days: dailyStart.days + 2 },
    'new day did not restore the first-round fish and active-day increment');

    await assertExternalStateUnchanged(page, baseline, width + ' growth preview');
}

async function subpackageChecks(browser, base, errors) {
    const {page,baseline}=await openFixture(browser,base,390,844,errors);
    assert.strictEqual(await page.evaluate(()=>fixture.subpackageRequests),1);
    const cats=['cream','ragdoll','siamese','calico'];
    if(!process.argv.includes('--recovery-only')) for(const cat of cats) for(let stage=0;stage<5;stage++) {
        await page.evaluate(({cat,stage})=>{
            const model=load('js/platform/catalog-preview.js').create();
            model.owned=[cat];model.affection[cat]=42;model.displayStages[cat]=stage;
            model.selectedId=cat;model.view='detail';app.catalogPreview=model;app.catalogButtons=null;
        },{cat,stage});
        await waitFrame(page);
        const before=await page.locator('canvas').screenshot();
        await page.waitForTimeout(450);
        const after=await page.locator('canvas').screenshot();
        assert(before.equals(after),cat+' stage '+stage+' unexpectedly animated');
        fs.writeFileSync(path.join(out,'subpackage-'+cat+'-'+stage+'.png'),before);
        if(stage) assert(await page.evaluate(({cat,stage})=>{
            const names={cream:'Naitang',ragdoll:'Ragdoll',siamese:'Siamese',calico:'Calico'};
            const key='catalog'+names[cat]+['','Familiar','Trust','Attachment','BestFriend'][stage];
            const img=load('js/render/assets.js').get(key);return img.width===512&&img.height===512;
        },{cat,stage}),cat+' missing decoded full-size art');
    }
    await assertExternalStateUnchanged(page,baseline,'all 20 static art');
    await page.reload();
    await page.waitForFunction(()=>app.state==='menu'&&app.menuButtons&&app.menuButtons.catalog);
    const recoveryBaseline=await snapshot(page);
    await page.evaluate(()=>{fixture.holdPackage=true;});
    await clickRect(page,'menuButtons','catalog');await waitFrame(page);
    assert.deepStrictEqual(await page.evaluate(()=>Object.keys(app.catalogButtons).sort()),['close','maxScroll','viewport']);
    await page.locator('canvas').screenshot({path:path.join(out,'subpackage-loading.png')});
    await clickRect(page,'catalogButtons','close');
    await page.evaluate(()=>fixture.packageRequest.fail());await waitFrame(page);
    assert.strictEqual(await page.evaluate(()=>app.state),'menu','late failure reopens catalog');
    await clickRect(page,'menuButtons','catalog');await waitFrame(page);
    assert.strictEqual(await page.evaluate(()=>fixture.subpackageRequests),2);
    await page.evaluate(()=>fixture.packageRequest.fail());await waitFrame(page);
    await page.locator('canvas').screenshot({path:path.join(out,'subpackage-error.png')});
    await page.evaluate(()=>{fixture.holdPackage=false;});
    await clickRect(page,'catalogButtons','retry-assets');
    await page.waitForFunction(()=>load('js/render/assets.js').getCatalogState().status==='ready'&&app.catalogButtons&&app.catalogButtons['cat:cream']);
    assert.strictEqual(await page.evaluate(()=>fixture.subpackageRequests),3);
    await clickRect(page,'catalogButtons','close');await clickRect(page,'menuButtons','catalog');
    assert.strictEqual(await page.evaluate(()=>fixture.subpackageRequests),3,'ready reentry redownloads');
    await assertExternalStateUnchanged(page,recoveryBaseline,'subpackage recovery');
    await page.close();
    console.log('catalog subpackage browser: all20 static, loading/return/failure/retry/cache and data isolation passed');
}

async function companionChecks(browser,base,errors) {
    for(const [width,height] of [[320,568],[390,844],[430,932]]){
        const {page,baseline}=await openFixture(browser,base,width,height,errors);
        await setModel(page,'stages');
        await page.evaluate(()=>{app.catalogPreview.offset=app.catalogButtons.maxScroll;app.catalogButtons=null;});await waitFrame(page);
        await clickRect(page,'catalogButtons','open-story');await waitFrame(page);
        assert.strictEqual(await page.evaluate(()=>app.companionView.stage),0,'catalog should open its first unread story');
        const chapters=await page.evaluate(()=>Array.from({length:5},(_,i)=>app.companionButtons['chapter:'+i]));
        chapters.forEach(r=>assert(r&&r.w>=44&&r.h>=44&&r.y>=0&&r.y+r.h<=height,'chapters must be visible on first screen'));
        await clickRect(page,'companionButtons','chapter:3');await waitFrame(page);
        assert(await page.evaluate(()=>app.companionView.readVisible),'whole story text must be visible');
        await page.locator('canvas').screenshot({path:path.join(out,'companion-story-'+width+'.png')});
        await page.evaluate(()=>{app.companionView.offset=app.companionButtons.maxScroll;});await waitFrame(page);
        await page.locator('canvas').screenshot({path:path.join(out,'companion-chapters-'+width+'.png')});
        await clickRect(page,'companionButtons','chapter:4');await waitFrame(page);
        assert(!await page.evaluate(()=>!!app.companionButtons.select),'locked story can select companion');
        await page.locator('canvas').screenshot({path:path.join(out,'companion-locked-'+width+'.png')});
        await clickRect(page,'companionButtons','feed');await waitFrame(page);
        assert.strictEqual(await page.evaluate(()=>app.catalogPreview.overlay.kind),'feed');
        await clickRect(page,'catalogButtons','dismiss');await waitFrame(page);
        await page.evaluate(()=>{app.catalogPreview.offset=app.catalogButtons.maxScroll;});await waitFrame(page);
        await clickRect(page,'catalogButtons','open-story');await waitFrame(page);
        await clickRect(page,'companionButtons','chapter:2');await waitFrame(page);
        const modelBefore=await page.evaluate(()=>JSON.stringify(app.catalogPreview));
        await clickRect(page,'companionButtons','select');await waitFrame(page);
        assert.strictEqual(await page.evaluate(()=>JSON.stringify(app.catalogPreview)),modelBefore,'select changed progression');
        assert.strictEqual(await page.evaluate(()=>app.state),'menu');
        await page.locator('canvas').screenshot({path:path.join(out,'companion-home-'+width+'.png')});
        const rectangles=await page.evaluate(()=>['battle','start','companionSwitch','companionStory'].map(k=>({key:k,...app.menuButtons[k]})));
        for(const r of rectangles){assert(r.w>=44&&r.h>=44&&r.x>=0&&r.y>=0&&r.x+r.w<=width&&r.y+r.h<=height,JSON.stringify(r));}
        for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){
            const a=rectangles[i],b=rectangles[j];assert(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'home controls overlap');
        }
        await clickRect(page,'menuButtons','companionStory');await waitFrame(page);
        assert.strictEqual(await page.evaluate(()=>app.companionView.stage),2,'home story drifted from selected art');
        assert(!await page.evaluate(()=>!!app.companionButtons.select),'current companion should not offer duplicate select');
        for(let i=0;i<4;i++){await clickRect(page,'companionButtons','chapter:'+i);await waitFrame(page);}
        assert(!await page.evaluate(()=>app.companion.hasUnread(app.catalogPreview)),'read stories keep their reminder');
        await clickRect(page,'companionButtons','close');await waitFrame(page);
        await clickRect(page,'menuButtons','companionSwitch');await waitFrame(page);
        await page.locator('canvas').screenshot({path:path.join(out,'companion-switch-'+width+'.png')});
        await clickRect(page,'companionButtons','choose:cream');await waitFrame(page);
        assert.strictEqual(await page.evaluate(()=>app.companionView.kind),'story','choose must open shape selection');
        assert.strictEqual(await page.evaluate(()=>app.companionView.stage),2);
        await clickRect(page,'companionButtons','close');await waitFrame(page);
        assert.strictEqual(await page.evaluate(()=>app.companionView.kind),'switch');
        await page.evaluate(()=>app.catalogPreview.owned.push('ragdoll'));await waitFrame(page);
        await page.locator('canvas').screenshot({path:path.join(out,'companion-switch-two-'+width+'.png')});
        await page.evaluate(()=>fixture.failCompanionWrite=true);
        await clickRect(page,'companionButtons','choose:ragdoll');await waitFrame(page);
        assert(await page.evaluate(()=>!!app.companionButtons['retry-save']&&!app.companionButtons.select),'failed read save must expose only retry');
        await page.locator('canvas').screenshot({path:path.join(out,'companion-read-error-'+width+'.png')});
        await page.evaluate(()=>fixture.failCompanionWrite=false);
        await clickRect(page,'companionButtons','retry-save');await waitFrame(page);
        assert.strictEqual(await page.evaluate(()=>app.companion.selection.id),'cream','read retry must not select another cat');
        assert(!await page.evaluate(()=>!!app.companion.error));
        const beforeSecond=await page.evaluate(()=>JSON.stringify(app.catalogPreview));
        await clickRect(page,'companionButtons','select');await waitFrame(page);
        assert.strictEqual(await page.evaluate(()=>app.companion.selection.id),'ragdoll');
        assert.strictEqual(await page.evaluate(()=>JSON.stringify(app.catalogPreview)),beforeSecond);
        await clickRect(page,'menuButtons','companionSwitch');await waitFrame(page);
        await clickRect(page,'companionButtons','choose:cream');await waitFrame(page);
        await clickRect(page,'companionButtons','chapter:2');await waitFrame(page);
        await clickRect(page,'companionButtons','select');await waitFrame(page);
        await clickRect(page,'menuButtons','companionSwitch');await waitFrame(page);
        await page.evaluate(()=>fixture.failCompanionWrite=true);
        await clickRect(page,'companionButtons','default');await waitFrame(page);
        assert.strictEqual(await page.evaluate(()=>app.state),'companion');
        assert.strictEqual(await page.evaluate(()=>app.companion.selection.id),'cream');
        assert(await page.evaluate(()=>app.companion.error));
        await page.locator('canvas').screenshot({path:path.join(out,'companion-save-error-'+width+'.png')});
        await page.evaluate(()=>fixture.failCompanionWrite=false);
        await page.reload();await page.waitForFunction(()=>app.state==='menu'&&app.menuButtons&&app.menuButtons.companionStory);
        assert.deepStrictEqual(await page.evaluate(()=>app.companion.selection),{id:'cream',stage:2,unlocked:3});
        assert.strictEqual(await page.evaluate(()=>app.catalogPreview),null,'presentation snapshot restored ownership');
        assert(!await page.evaluate(()=>app.companion.hasUnread(app.catalogPreview)),'read markers lost on reload');
        await clickRect(page,'menuButtons','companionStory');await page.waitForFunction(()=>app.companionButtons&&app.companionButtons.close);
        assert.strictEqual(await page.evaluate(()=>app.companionView.unlocked),3);
        assert(!await page.evaluate(()=>!!app.companionButtons.select),'snapshot grants live adoption');
        await clickRect(page,'companionButtons','close');
        await clickRect(page,'menuButtons','companionSwitch');await waitFrame(page);
        await clickRect(page,'companionButtons','default');await waitFrame(page);
        assert.strictEqual(await page.evaluate(()=>app.companion.selection),null);
        await page.reload();await page.waitForFunction(()=>app.state==='menu'&&app.menuButtons);
        assert(!await page.evaluate(()=>app.menuButtons.companionSwitch));
        assert.strictEqual(await page.evaluate(()=>fixture.storage.match3_coin_v1),baseline.wallet);
        assert.strictEqual(await page.evaluate(()=>fixture.cloudAttempts.length),0);
        await page.close();console.log('companion browser passed '+width+'x'+height);
    }
}

async function runChecks(base) {
    let chromium;
    try {
        chromium = require('playwright').chromium;
    } catch (error) {
        try {
            chromium = require('/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright').chromium;
        } catch (fallbackError) {
            throw new Error('The --check mode requires Playwright; the local preview server itself does not.');
        }
    }
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    const errors = [];
    try {
        if(process.argv.includes('--companion-check')){await companionChecks(browser,base,errors);assert.deepStrictEqual(errors,[]);return;}
        if(process.argv.includes('--subpackage-check')) {
            await subpackageChecks(browser,base,errors);assert.deepStrictEqual(errors,[]);return;
        }
        const widthOption = process.argv.find(argument => argument.startsWith('--width='));
        const requestedWidth = widthOption ? Number(widthOption.slice('--width='.length)) : 0;
        const sizes = [[320, 568], [390, 844], [430, 932]].filter(size => !requestedWidth || size[0] === requestedWidth);
        assert(sizes.length, 'unsupported --width; choose 320, 390 or 430');
        for (const [width, height] of sizes) {
            const { page, baseline } = await openFixture(browser, base, width, height, errors);
            await setModel(page, 'initial');
            await page.locator('canvas').screenshot({ path: path.join(out, 'catalog-list-' + width + '.png') });
            await clickRect(page, 'catalogButtons', 'cat:cream');
            await page.waitForFunction(() => app.catalogPreview.view === 'detail');
            await page.locator('canvas').screenshot({ path: path.join(out, 'catalog-detail-' + width + '.png') });
            await clickRect(page, 'catalogButtons', 'back');
            if (width === 320) {
                await deepChecks(page, baseline);
                await stateScreens(page, baseline);
            }
            await growthChecks(page, baseline, width);
            await assertExternalStateUnchanged(page, baseline, width + ' catalog preview');
            console.log(JSON.stringify({ width, height, passed: true, wallet: baseline.wallet, storageWrites: baseline.writes, cloudAttempts: baseline.cloud }));
            await page.close();
        }
        assert.deepStrictEqual(errors, []);
    } finally {
        await browser.close();
    }
}

const portOption = process.argv.find(argument => argument.startsWith('--port='));
server.listen(portOption ? Number(portOption.slice('--port='.length)) : 0, '127.0.0.1', async () => {
    const base = 'http://127.0.0.1:' + server.address().port;
    if (!process.argv.includes('--check') && !process.argv.includes('--subpackage-check') && !process.argv.includes('--companion-check')) {
        console.log('Catalog local preview: ' + base);
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
