'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const catalog = require('../js/platform/catalog-preview');
const CatalogUI = require('../js/render/catalog-ui');
const assets = require('../js/render/assets');

assets.preload();
const ctx = new Proxy({}, {
    get(target, key) {
        if (key in target) return target[key];
        if (key === 'measureText') return text => ({ width: String(text).length * 7 });
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
        return () => {};
    },
    set(target, key, value) { target[key] = value; return true; }
});

const file = require.resolve('../js/main');
const req = require('module').createRequire(file);
const moduleFixture = { exports: {} };
const blocked = () => { throw Error('Growth preview must not access storage or network'); };
vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module: moduleFixture,
    wx: { getStorageSync: blocked, setStorageSync: blocked, cloud: { callFunction: blocked } },
    require: name => name === './audio' ? { click() {}, unlock() {} } : req(name)
}, { filename: file });
const Main = moduleFixture.exports;
const screen = { width: 390, height: 844, safeTop: 47, contentTop: 91, safeBottom: 34, safeLeft: 0, safeRight: 0 };

function makeApp(preset) {
    const app = Object.create(Main.prototype);
    app.state = 'catalog_preview';
    app.catalogPreviewEnabled = true;
    app.catalogPreview = catalog.create(preset || 'growth');
    app.catalogButtons = null;
    app.catalogTouch = null;
    app.handleGuideTouch = () => false;
    app.handleStaminaDialogTouch = () => false;
    app.screen = screen;
    app.ctx = ctx;
    return app;
}
function render(app) { app.catalogButtons = CatalogUI.draw(ctx, screen, app.catalogPreview); }
function point(rect, identifier) {
    return { clientX: rect.x + rect.w / 2, clientY: rect.y + rect.h / 2, identifier: identifier == null ? 17 : identifier };
}
function start(app, key, identifier) {
    render(app);
    assert(app.catalogButtons[key], 'missing action ' + key);
    const p = point(app.catalogButtons[key], identifier);
    app.handleTouchStart({ touches: [p] });
    return p;
}
function finish(app, p) { app.handleTouchEnd({ changedTouches: [p], touches: [] }); }
function tap(app, key) { const p = start(app, key); finish(app, p); render(app); }

{
    const app = makeApp();
    tap(app, 'feed');
    assert.deepStrictEqual(app.catalogPreview.overlay, { kind: 'feed', catId: 'cream' });
    assert.deepStrictEqual(Object.keys(app.catalogButtons).sort(), ['confirm-feed', 'dismiss', 'maxScroll'],
        'modal must replace every underlying hit target');
    const p = start(app, 'confirm-feed');
    app.handleHide();
    finish(app, p);
    assert.strictEqual(app.catalogPreview.affection.cream, 3, 'backgrounding must cancel feed confirmation');
    assert.strictEqual(app.catalogPreview.fish, 2);
}

{
    const app = makeApp();
    tap(app, 'feed');
    const p = start(app, 'confirm-feed');
    app.catalogPreview.overlay = { kind: 'feed', catId: 'cream' };
    render(app);
    finish(app, p);
    assert.strictEqual(app.catalogPreview.affection.cream, 3, 'replacement modal must invalidate the old press');
    assert.strictEqual(app.catalogPreview.fish, 2);
}

{
    const app = makeApp();
    tap(app, 'feed');
    const p = start(app, 'confirm-feed');
    app.catalogPreview.selectedId = 'ragdoll';
    render(app);
    finish(app, p);
    assert.strictEqual(app.catalogPreview.affection.cream, 3, 'switching cats must invalidate feed confirmation');
    assert.strictEqual(app.catalogPreview.fish, 2);
    assert.deepStrictEqual(app.catalogPreview.overlay, { kind: 'feed', catId: 'cream' });
}

{
    const app = makeApp();
    const p = start(app, 'feed');
    catalog.activate(app.catalogPreview, 'feed');
    render(app);
    finish(app, p);
    assert.strictEqual(app.catalogPreview.affection.cream, 3, 'opening a modal during a press must not click through');
    assert.strictEqual(app.catalogPreview.fish, 2);
    assert.deepStrictEqual(app.catalogPreview.overlay, { kind: 'feed', catId: 'cream' });
}

{
    const app = makeApp();
    tap(app, 'feed');
    const p = start(app, 'confirm-feed');
    finish(app, p);
    app.handleTouchEnd({ changedTouches: [p], touches: [] });
    assert.strictEqual(app.catalogPreview.affection.cream, 4, 'one confirmation must add exactly one affection');
    assert.strictEqual(app.catalogPreview.fish, 1, 'one confirmation must consume exactly one fish');
    assert.deepStrictEqual(app.catalogPreview.overlay, { kind: 'unlock', catId: 'cream', stage: 1 });
}

{
    const app = makeApp('stages');
    render(app);
    tap(app, 'stage:4');
    assert.deepStrictEqual(app.catalogPreview.overlay, { kind: 'gallery', catId: 'cream', stage: 4 });
    assert(!app.catalogButtons['show-stage'], 'locked stage must expose its threshold without a display action');
    assert(app.catalogButtons.dismiss, 'locked-stage modal must remain dismissible');
}

{
    const app = makeApp('hungry');
    tap(app, 'feed');
    assert.deepStrictEqual(app.catalogPreview.overlay, { kind: 'food', catId: 'cream' });
    tap(app, 'go-play');
    assert.strictEqual(app.state, 'menu', 'food prompt must return to the existing home screen');
    assert.strictEqual(app.catalogPreview.overlay, null);
}

{
    const app = makeApp('adopted');
    app.catalogPreview.view = 'detail';
    app.catalogPreview.selectedId = 'ragdoll';
    render(app);
    assert(!app.catalogButtons.feed && !app.catalogButtons.interaction,
        'growth controls must remain absent for later adopted cats');
}

console.log('catalog growth independent QA passed');
