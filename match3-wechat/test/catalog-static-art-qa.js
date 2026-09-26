'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const catalog = require('../js/platform/catalog-preview');
const assets = require('../js/render/assets');
const type = require('../js/render/typography');
const CatalogUI = require('../js/render/catalog-ui');

const screen = { width: 390, height: 844, safeTop: 47, contentTop: 91, safeBottom: 34, safeLeft: 0, safeRight: 0 };
const artKeys = ['catalogPortraits', 'catalogNaitangFamiliar', 'catalogNaitangTrust',
    'catalogNaitangAttachment', 'catalogNaitangBestFriend'];

function jpegSize(file) {
    const data = fs.readFileSync(file);
    assert(data[0] === 0xff && data[1] === 0xd8, file + ' must be a JPEG');
    let offset = 2;
    const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    while (offset + 8 < data.length) {
        while (data[offset] === 0xff) offset++;
        const marker = data[offset++];
        if (marker === 0xd8 || marker === 0x01) continue;
        if (marker === 0xd9 || marker === 0xda) break;
        const length = data.readUInt16BE(offset);
        if (sof.has(marker)) return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) };
        offset += length;
    }
    throw Error('JPEG dimensions not found: ' + file);
}
function context() {
    const trace = { drawImages: [] };
    const ctx = new Proxy({}, {
        get(target, key) {
            if (key in target) return target[key];
            if (key === 'measureText') return text => ({ width: String(text).length * 7 });
            if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
            if (key === 'drawImage') return (...args) => trace.drawImages.push(args);
            return () => {};
        },
        set(target, key, value) { target[key] = value; return true; }
    });
    return { ctx, trace };
}
function destination(args) {
    return args.length === 9
        ? { x: args[5], y: args[6], w: args[7], h: args[8] }
        : { x: args[1], y: args[2], w: args[3], h: args[4] };
}
function within(value, expected, epsilon = 1e-7) { return Math.abs(value - expected) <= epsilon; }
function assertFit(args, image, rect, label) {
    const dest = destination(args);
    const sourceAspect = args.length === 9 ? args[3] / args[4] : image.width / image.height;
    assert(dest.w > 0 && dest.h > 0, label + ' must have positive geometry');
    assert(within(dest.w / dest.h, sourceAspect), label + ' must preserve source aspect ratio');
    assert(dest.x >= rect.x - 1e-7 && dest.y >= rect.y - 1e-7 &&
        dest.x + dest.w <= rect.x + rect.w + 1e-7 && dest.y + dest.h <= rect.y + rect.h + 1e-7,
        label + ' must fit without cropping');
    assert(within(dest.x + dest.w / 2, rect.x + rect.w / 2) &&
        within(dest.y + dest.h / 2, rect.y + rect.h / 2), label + ' must remain centred');
}

const images = {};
for (const key of Object.keys(assets.ASSETS)) images[key] = { key, width: 200, height: 200 };
for (const key of Object.keys(assets.CATALOG_ASSETS)) images[key] = { key, width: 200, height: 200 };
for (const key of artKeys) {
    const relative = assets.ASSETS[key] || assets.CATALOG_ASSETS[key];
    const file = path.join(__dirname, '..', relative);
    assert(fs.existsSync(file), key + ' file must exist');
    Object.assign(images[key], jpegSize(file));
}
assert.deepStrictEqual([images.catalogPortraits.width, images.catalogPortraits.height], [700, 776]);
for (const key of artKeys.slice(1)) assert.deepStrictEqual([images[key].width, images[key].height], [512, 512]);

const originalGet = assets.get;
const originalDrawFit = type.drawFit;
const originalNow = Date.now;
const originalWx = global.wx;
let labels = [];
assets.get = key => images[key];
type.drawFit = (ctx, text, ...rest) => { labels.push(String(text)); return originalDrawFit(ctx, text, ...rest); };
Date.now = () => { throw Error('static catalog rendering must not read the clock'); };
global.wx = Object.assign({}, originalWx, {
    createOffscreenCanvas() { throw Error('static catalog rendering must not allocate an offscreen canvas'); }
});
try {
    const model = catalog.create('maxed');
    const layouts = {};

    function render(view, stage, overlay) {
        model.view = view;
        model.selectedId = view === 'detail' ? 'cream' : null;
        model.displayStages.cream = stage;
        model.overlay = overlay || null;
        model.offset = 0;
        const before = JSON.stringify(model);
        const frame = context();
        const buttons = CatalogUI.draw(frame.ctx, screen, model);
        assert.strictEqual(JSON.stringify(model), before, view + ' stage ' + stage + ' render must not mutate model/economy');
        return { frame, buttons };
    }
    function targetCall(frame, key, rect) {
        const matches = frame.trace.drawImages.filter(args => {
            if (args[0] !== images[key]) return false;
            const d = destination(args);
            return d.x >= rect.x - 1e-7 && d.y >= rect.y - 1e-7 &&
                d.x + d.w <= rect.x + rect.w + 1e-7 && d.y + d.h <= rect.y + rect.h + 1e-7;
        });
        assert.strictEqual(matches.length, 1, key + ' must render exactly once in the target art rect');
        return matches[0];
    }

    for (let stage = 0; stage < 5; stage++) {
        const key = artKeys[stage];

        let l = CatalogUI.layout(screen, model);
        const listCard = { x: l.x, y: l.viewport.y + 12, w: l.cw, h: l.rowHeights[0] };
        const listRect = { x: listCard.x + 5, y: listCard.y + 13, w: listCard.w - 10, h: listCard.h - 117 };
        let result = render('list', stage);
        let call = targetCall(result.frame, key, listRect);
        assertFit(call, images[key], listRect, 'list stage ' + stage);

        l = CatalogUI.layout(screen, Object.assign(model, { view: 'detail', selectedId: 'cream' }));
        const artH = Math.min(252, Math.min(332, l.w - 4) * .8, Math.max(156, l.viewport.h - 208));
        const detailW = Math.min(332, l.w - 4);
        const detailX = (screen.width - detailW) / 2;
        const artW = Math.min(detailW - 14, artH);
        const detailRect = { x: detailX + (detailW - artW) / 2, y: l.viewport.y + 25, w: artW, h: artH };
        result = render('detail', stage);
        call = targetCall(result.frame, key, detailRect);
        assertFit(call, images[key], detailRect, 'detail stage ' + stage);

        const overlay = { kind: 'gallery', catId: 'cream', stage };
        l = CatalogUI.layout(screen, model);
        const overlayW = Math.min(334, l.w);
        const overlayX = (screen.width - overlayW) / 2;
        const overlayY = Math.max(l.top + 4, (l.top + l.footer - 350) / 2);
        const overlayRect = { x: overlayX + 18, y: overlayY + 76, w: overlayW - 36, h: 134 };
        result = render('detail', stage, overlay);
        call = targetCall(result.frame, key, overlayRect);
        assertFit(call, images[key], overlayRect, 'overlay stage ' + stage);

        if (stage === 0) {
            for (const checked of [
                targetCall(render('list', stage).frame, key, listRect),
                targetCall(render('detail', stage).frame, key, detailRect),
                targetCall(render('detail', stage, overlay).frame, key, overlayRect)
            ]) {
                assert.deepStrictEqual(checked.slice(1, 5), [0, 0, 350, 350],
                    'initial Naitang art must use the complete accepted atlas crop');
            }
        } else {
            assert.strictEqual(call.length, 5, 'stage ' + stage + ' must draw the complete source image');
        }
        layouts[stage] = result.buttons;
    }

    const stableModel = catalog.create('maxed');
    const first = context(), second = context();
    const before = JSON.stringify(stableModel);
    const firstButtons = CatalogUI.draw(first.ctx, screen, stableModel);
    const secondButtons = CatalogUI.draw(second.ctx, screen, stableModel);
    const normalize = trace => trace.drawImages.map(args => [args[0].key].concat(args.slice(1)));
    assert.deepStrictEqual(normalize(second.trace), normalize(first.trace), 'repeated static frames must have identical image geometry');
    assert.deepStrictEqual(secondButtons, firstButtons, 'repeated static frames must have identical hitboxes');
    assert.strictEqual(JSON.stringify(stableModel), before, 'repeated static frames must not change model/economy');

    labels = [];
    const growth = catalog.create('growth');
    let growthBefore = JSON.stringify(growth);
    CatalogUI.draw(context().ctx, screen, growth);
    assert.strictEqual(JSON.stringify(growth), growthBefore);
    for (const text of ['初见 · 亲密度 3', '再喂 1 次，成为「熟悉」', '喂食 · 1 份小鱼干']) {
        assert(labels.includes(text), 'growth view missing text: ' + text);
    }
    labels = [];
    growth.overlay = { kind: 'feed', catId: 'cream' };
    growthBefore = JSON.stringify(growth);
    CatalogUI.draw(context().ctx, screen, growth);
    assert.strictEqual(JSON.stringify(growth), growthBefore, 'feed modal rendering must not change fish or affection');
    for (const text of ['喂给奶糖', '1 份小鱼干 → 亲密度 +1', '现有 2 份 · 仅本次预览有效']) {
        assert(labels.includes(text), 'feed modal missing text: ' + text);
    }
    labels = [];
    const maxed = catalog.create('maxed');
    const maxedBefore = JSON.stringify(maxed);
    CatalogUI.draw(context().ctx, screen, maxed);
    assert.strictEqual(JSON.stringify(maxed), maxedBefore);
    for (const text of ['挚友 · 亲密度 42', '已经是最亲密的挚友啦',
        '挚友 · 已满级，不再消耗小鱼干', '摸摸它 · 免费互动']) {
        assert(labels.includes(text), 'maxed view missing text: ' + text);
    }
} finally {
    assets.get = originalGet;
    type.drawFit = originalDrawFit;
    Date.now = originalNow;
    if (originalWx === undefined) delete global.wx; else global.wx = originalWx;
}

const uiSource = fs.readFileSync(path.join(__dirname, '../js/render/catalog-ui.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
for (const token of ['cat-art-motion', 'Date.now', 'createOffscreenCanvas', 'livingArt', 'burst', 'sparkle', 'heartShape']) {
    assert(!uiSource.includes(token), 'static catalog UI must not retain motion path: ' + token);
}
assert(!/CatalogUI\.(?:react|pauseMotion|clearMotion)/.test(mainSource), 'Main must not retain catalog motion lifecycle calls');
assert(!fs.existsSync(path.join(__dirname, '../js/render/cat-art-motion.js')), 'active tree must not retain the deferred mesh module');
assert.deepStrictEqual(Object.keys(CatalogUI).sort(), ['background', 'button', 'draw', 'layout', 'portrait', 'stageArt']);

console.log('catalog static art independent QA passed');
