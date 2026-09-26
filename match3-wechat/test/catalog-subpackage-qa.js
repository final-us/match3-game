'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const root = path.join(__dirname, '..');
const assetsFile = path.join(root, 'js/render/assets.js');
const mainFile = path.join(root, 'js/main.js');
const catalog = require('../js/platform/catalog-preview');
const CatalogUI = require('../js/render/catalog-ui');
const realAssets = require('../js/render/assets');

function timers() {
    let next = 1;
    const entries = new Map();
    return {
        setTimeout(fn, delay) {
            const id = next++;
            entries.set(id, { fn, delay, active: true });
            return id;
        },
        clearTimeout(id) {
            const entry = entries.get(id);
            if (entry) entry.active = false;
        },
        fire(id) {
            const entry = entries.get(id);
            assert(entry && entry.active, 'timer must be active');
            entry.fn();
        },
        entries
    };
}
function wxHarness(options) {
    const harness = { tasks: [], images: [], createCount: 0, loadCount: 0 };
    const settings = options || {};
    harness.wx = {
        createImage() {
            harness.createCount++;
            if (settings.createThrows) throw Error('create failed');
            const image = { width: 512, height: 512, src: '' };
            harness.images.push(image);
            return image;
        },
        loadSubpackage(callbacks) {
            harness.loadCount++;
            if (settings.loadThrows) throw Error('load failed');
            const task = { callbacks, progress: null };
            harness.tasks.push(task);
            return {
                onProgressUpdate(fn) {
                    if (settings.progressThrows) throw Error('progress subscription failed');
                    task.progress = fn;
                }
            };
        }
    };
    return harness;
}
function loadAssets(wx, clock) {
    const moduleFixture = { exports: {} };
    vm.runInNewContext(fs.readFileSync(assetsFile, 'utf8'), {
        module: moduleFixture,
        exports: moduleFixture.exports,
        wx,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout
    }, { filename: assetsFile });
    return moduleFixture.exports;
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }
async function settle() { await Promise.resolve(); await Promise.resolve(); }

function jpegSize(file) {
    const data = fs.readFileSync(file);
    assert(data[0] === 0xff && data[1] === 0xd8, file + ' must be JPEG');
    const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 8 < data.length) {
        while (data[offset] === 0xff) offset++;
        const marker = data[offset++];
        if (marker === 0xd8 || marker === 0x01) continue;
        if (marker === 0xd9 || marker === 0xda) break;
        const length = data.readUInt16BE(offset);
        if (sof.has(marker)) return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) };
        offset += length;
    }
    throw Error('missing JPEG dimensions: ' + file);
}
function canvasTrace() {
    const calls = [];
    const ctx = new Proxy({}, {
        get(target, key) {
            if (key in target) return target[key];
            if (key === 'measureText') return text => ({ width: String(text).length * 7 });
            if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
            if (key === 'drawImage') return (...args) => calls.push(args);
            return () => {};
        },
        set(target, key, value) { target[key] = value; return true; }
    });
    return { ctx, calls };
}

(async function run() {
    // Main preload must stay independent of every catalog illustration.
    {
        const clock = timers(), wx = wxHarness();
        const api = loadAssets(wx.wx, clock);
        const mainKeys = Object.keys(api.ASSETS);
        const catalogKeys = Object.keys(api.CATALOG_ASSETS);
        assert.strictEqual(catalogKeys.length, 16, 'all sixteen growth images belong in the catalog subpackage');
        assert.deepStrictEqual(mainKeys.filter(key => key.startsWith('catalog')).sort(), [
            'catalogIcon', 'catalogPortraits'
        ], 'main preload catalog set must contain only the atlas and entry icon');
        assert(catalogKeys.every(key => !mainKeys.includes(key)), 'main and catalog asset registries must be disjoint');
        api.preload();
        assert.strictEqual(wx.createCount, mainKeys.length, 'main preload must not decode subpackage images');
        assert(wx.images.every(image => !String(image.src).startsWith('catalog/')),
            'main preload must not request a catalog subpackage path');
    }

    // Concurrent callers dedupe; progress is bounded; decode publishes atomically.
    {
        const clock = timers(), wx = wxHarness();
        const api = loadAssets(wx.wx, clock);
        const first = api.loadCatalog(), second = api.loadCatalog();
        assert.strictEqual(first, second, 'concurrent catalog loads must share one promise');
        assert.strictEqual(wx.loadCount, 1);
        const timeout = [...clock.entries.entries()][0];
        assert.strictEqual(timeout[1].delay, 20000, 'catalog load must have a bounded timeout');
        wx.tasks[0].progress({ progress: 50 });
        assert.strictEqual(api.getCatalogState().progress, 40);
        wx.tasks[0].progress({ progress: 200 });
        assert.strictEqual(api.getCatalogState().progress, 80);
        wx.tasks[0].callbacks.success();
        const keys = Object.keys(api.CATALOG_ASSETS);
        assert.strictEqual(wx.images.length, keys.length);
        for (let index = 0; index < wx.images.length - 1; index++) wx.images[index].onload();
        assert.strictEqual(api.getCatalogState().status, 'loading');
        assert(keys.every(key => api.get(key) === undefined), 'partial decode must not publish any catalog image');
        wx.images[wx.images.length - 1].onload();
        assert.deepStrictEqual(plain(await first), { status: 'ready', progress: 100, message: '' });
        assert(keys.every(key => api.get(key)), 'successful decode must publish the complete image set');
        assert.strictEqual(clock.entries.get(timeout[0]).active, false, 'success must clear the timeout');
        await api.loadCatalog();
        assert.strictEqual(wx.loadCount, 1, 'ready catalog must not reload');
    }

    // Decode errors remain atomic, late callbacks are inert, and retry starts once.
    {
        const clock = timers(), wx = wxHarness();
        const api = loadAssets(wx.wx, clock);
        const first = api.loadCatalog();
        wx.tasks[0].callbacks.success();
        const keys = Object.keys(api.CATALOG_ASSETS);
        wx.images[0].onload();
        wx.images[1].onerror();
        assert.deepStrictEqual(plain(await first), {
            status: 'error', progress: 0, message: '原画读取失败，请重试'
        });
        assert(keys.every(key => api.get(key) === undefined), 'failed decode must publish no partial image');
        assert(wx.images.every(image => image.onload === null && image.onerror === null),
            'finish must detach every requested image callback');
        const retry = api.loadCatalog();
        assert.strictEqual(api.loadCatalog(), retry, 'retry callers must dedupe');
        assert.strictEqual(wx.loadCount, 2);
        wx.tasks[0].callbacks.success();
        assert.strictEqual(wx.images.length, keys.length, 'stale success must not allocate images for the new attempt');
        wx.tasks[0].progress({ progress: 1 });
        assert.strictEqual(api.getCatalogState().progress, 0, 'stale progress must not overwrite the retry');
        wx.tasks[1].callbacks.fail();
        await retry;
    }

    // Zero-size images, thrown image creation, download failure, and task setup failure resolve safely.
    for (const mode of ['zero', 'create-throws', 'download-fail', 'load-throws', 'progress-throws']) {
        const clock = timers();
        const wx = wxHarness({
            createThrows: mode === 'create-throws',
            loadThrows: mode === 'load-throws',
            progressThrows: mode === 'progress-throws'
        });
        const api = loadAssets(wx.wx, clock);
        let rejected = false;
        const pending = api.loadCatalog().catch(() => { rejected = true; });
        if (mode === 'download-fail') wx.tasks[0].callbacks.fail();
        else if (mode === 'zero') {
            wx.tasks[0].callbacks.success();
            wx.images[0].width = 0;
            wx.images[0].onload();
        } else if (mode === 'create-throws') wx.tasks[0].callbacks.success();
        await pending;
        assert.strictEqual(rejected, false, mode + ' must resolve an error state rather than reject');
        assert.strictEqual(api.getCatalogState().status, 'error', mode + ' must end in error');
        assert(Object.keys(api.CATALOG_ASSETS).every(key => api.get(key) === undefined),
            mode + ' must not publish catalog images');
    }

    // Timeout wins once; every late platform callback is ignored and a later retry is possible.
    {
        const clock = timers(), wx = wxHarness();
        const api = loadAssets(wx.wx, clock);
        const pending = api.loadCatalog();
        const timeout = [...clock.entries.entries()][0];
        clock.fire(timeout[0]);
        assert.deepStrictEqual(plain(await pending), {
            status: 'error', progress: 0, message: '加载超时，请检查网络后重试'
        });
        wx.tasks[0].callbacks.success();
        if (wx.tasks[0].progress) wx.tasks[0].progress({ progress: 100 });
        assert.strictEqual(wx.images.length, 0, 'callbacks after timeout must be inert');
        api.loadCatalog();
        assert.strictEqual(wx.loadCount, 2, 'timeout must leave the loader retryable');
    }

    // Missing or unsupported native APIs still return a resolved, actionable state.
    for (const unsupported of [undefined, { createImage() { return {}; } }]) {
        const clock = timers();
        const api = loadAssets(unsupported, clock);
        const result = await api.loadCatalog();
        assert.deepStrictEqual(plain(result), { status: 'error', progress: 0, message: '请更新微信后重试' });
    }

    // Main enters immediately, triggers loading, makes retry safe, and ignores completion after leaving.
    {
        const loads = [];
        const assetFixture = {
            loadCatalog() {
                let resolve;
                const promise = new Promise(done => { resolve = done; });
                loads.push({ promise, resolve });
                return promise;
            },
            getCatalogState() { return { status: 'loading', progress: 0, message: '' }; },
            preload() {}, get() {}
        };
        const moduleFixture = { exports: {} };
        const req = Module.createRequire(mainFile);
        vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), {
            module: moduleFixture,
            wx: {},
            require(name) {
                if (name === './render/assets') return assetFixture;
                if (name === './audio') return { click() {}, unlock() {} };
                return req(name);
            }
        }, { filename: mainFile });
        const Main = moduleFixture.exports;
        const app = Object.create(Main.prototype);
        Object.assign(app, {
            state: 'menu', catalogPreviewEnabled: true, catalogPreview: null,
            catalogButtons: { stale: true }, catalogTouch: { stale: true }
        });
        app.openCatalogPreview();
        assert.strictEqual(app.state, 'catalog_preview');
        assert.strictEqual(loads.length, 1);
        assert.strictEqual(app.catalogButtons, null);
        assert.strictEqual(app.catalogTouch, null);
        const outsideButtons = { keep: true }, outsideTouch = { keep: true };
        app.state = 'menu'; app.catalogButtons = outsideButtons; app.catalogTouch = outsideTouch;
        loads[0].resolve({ status: 'ready' });
        await settle();
        assert.strictEqual(app.catalogButtons, outsideButtons, 'completion after leaving must not clear another screen');
        assert.strictEqual(app.catalogTouch, outsideTouch, 'completion after leaving must not clear another screen touch');

        app.state = 'catalog_preview';
        app.catalogButtons = {
            'retry-assets': { x: 0, y: 0, w: 44, h: 44 },
            maxScroll: 0
        };
        app.catalogTouch = {
            x: 22, y: 22, lastY: 22, dragged: false, action: 'retry-assets',
            model: app.catalogPreview, identifier: 7, view: app.catalogPreview.view,
            selectedId: app.catalogPreview.selectedId, status: app.catalogPreview.status,
            overlay: app.catalogPreview.overlay
        };
        app.finishCatalogTouch({ changedTouches: [{ clientX: 22, clientY: 22, identifier: 7 }], touches: [] });
        assert.strictEqual(loads.length, 2, 'retry action must start one new load');
        assert.strictEqual(app.catalogButtons, null);
        assert.strictEqual(app.catalogTouch, null);
    }

    // Loading/error gates expose no catalog actions; all 4 cats x 5 stages map proportionally when ready.
    {
        const screen = { width: 390, height: 844, safeTop: 47, contentTop: 91, safeBottom: 34, safeLeft: 0, safeRight: 0 };
        const gateModel = catalog.create('maxed');
        const before = JSON.stringify(gateModel);
        let frame = canvasTrace();
        let buttons = CatalogUI.draw(frame.ctx, screen, gateModel, { status: 'loading', progress: 37, message: '' });
        assert(!buttons.feed && !buttons.interaction && !Object.keys(buttons).some(key => key.startsWith('stage:')));
        assert(!buttons['retry-assets']);
        buttons = CatalogUI.draw(canvasTrace().ctx, screen, gateModel,
            { status: 'error', progress: 0, message: '下载失败，请检查网络后重试' });
        assert(buttons['retry-assets']);
        assert(!buttons.feed && !buttons.interaction && !Object.keys(buttons).some(key => key.startsWith('stage:')));
        assert.strictEqual(JSON.stringify(gateModel), before, 'resource gates must not mutate the catalog model');

        const keysByCat = {
            cream: ['catalogPortraits', 'catalogNaitangFamiliar', 'catalogNaitangTrust', 'catalogNaitangAttachment', 'catalogNaitangBestFriend'],
            ragdoll: ['catalogPortraits', 'catalogRagdollFamiliar', 'catalogRagdollTrust', 'catalogRagdollAttachment', 'catalogRagdollBestFriend'],
            siamese: ['catalogPortraits', 'catalogSiameseFamiliar', 'catalogSiameseTrust', 'catalogSiameseAttachment', 'catalogSiameseBestFriend'],
            calico: ['catalogPortraits', 'catalogCalicoFamiliar', 'catalogCalicoTrust', 'catalogCalicoAttachment', 'catalogCalicoBestFriend']
        };
        const images = {};
        const registeredArt = Object.keys(realAssets.ASSETS).filter(key => key === 'catalogPortraits')
            .concat(Object.keys(realAssets.CATALOG_ASSETS));
        for (const key of registeredArt) {
            const index = registeredArt.indexOf(key);
            images[key] = { key, width: 430 + index * 7, height: 390 + index * 5 };
        }
        const originalGet = realAssets.get;
        realAssets.get = key => images[key] || { key, width: 200, height: 200 };
        try {
            for (const cat of catalog.cats) for (let stage = 0; stage < 5; stage++) {
                const model = catalog.create();
                model.view = 'detail';
                model.selectedId = cat.id;
                model.owned = [cat.id];
                model.affection[cat.id] = 42;
                model.displayStages[cat.id] = stage;
                const snapshot = JSON.stringify(model);
                frame = canvasTrace();
                CatalogUI.draw(frame.ctx, screen, model, { status: 'ready', progress: 100, message: '' });
                assert.strictEqual(JSON.stringify(model), snapshot, cat.id + ' stage ' + stage + ' render must be model-pure');
                const key = keysByCat[cat.id][stage], image = images[key];
                assert(image, 'missing registered image for ' + cat.id + ' stage ' + stage + ': ' + key);
                const calls = frame.calls.filter(args => args[0] === image);
                assert.strictEqual(calls.length, 1, cat.id + ' stage ' + stage + ' must draw its mapped art once');
                const args = calls[0];
                if (stage === 0) {
                    assert.strictEqual(args.length, 9, cat.id + ' initial art must use its atlas crop');
                    const sx = image.width / 700, sy = image.height / 776, crop = cat.crop;
                    assert.deepStrictEqual(args.slice(1, 5), [crop[0] * sx, crop[1] * sy, crop[2] * sx, crop[3] * sy]);
                    assert(Math.abs((args[7] / args[8]) - ((crop[2] * sx) / (crop[3] * sy))) < 1e-9);
                } else {
                    assert.strictEqual(args.length, 5, cat.id + ' stage ' + stage + ' must draw the full image');
                    assert(Math.abs((args[3] / args[4]) - (image.width / image.height)) < 1e-9,
                        cat.id + ' stage ' + stage + ' must preserve source aspect');
                }
            }
        } finally {
            realAssets.get = originalGet;
        }
    }

    // Registry paths are real decoded JPEGs inside the declared native subpackage.
    const packageConfig = JSON.parse(fs.readFileSync(path.join(root, 'game.json'), 'utf8'));
    assert(packageConfig.subpackages.some(item => item.name === 'catalog' && item.root === 'catalog/'));
    for (const [key, relative] of Object.entries(realAssets.CATALOG_ASSETS)) {
        assert(relative.startsWith('catalog/'), key + ' must point into the catalog subpackage');
        const file = path.join(root, relative);
        assert(fs.existsSync(file), key + ' is missing: ' + relative);
        const size = jpegSize(file);
        assert(size.width > 0 && size.height > 0, key + ' must be a decodable JPEG');
    }

    console.log('catalog subpackage independent QA passed');
})().catch(error => {
    console.error(error && error.stack || error);
    process.exitCode = 1;
});
