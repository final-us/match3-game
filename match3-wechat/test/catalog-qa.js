'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const preview = require('../js/platform/catalog-preview');
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

for (const channel of ['release', 'trial', '', null]) {
    assert(!preview.isEnabled({ getAccountInfoSync: () => ({ miniProgram: { envVersion: channel } }) }));
}
assert(preview.isEnabled({ getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }) }));
assert(!preview.isEnabled({ getAccountInfoSync() { throw Error('unsupported'); } }));
assert(!preview.isEnabled(null));

const first = preview.create();
assert(preview.cats.every(cat => preview.statusFor(first, cat.id) === 'adoptable'), 'first adoption must allow any cat');
first.selectedId = 'calico'; first.view = 'detail';
preview.activate(first, 'adopt'); preview.activate(first, 'adopt');
assert.deepStrictEqual(first.owned, ['calico'], 'first adoption replay must be idempotent');
assert(preview.cats.filter(cat => cat.id !== 'calico').every(cat => preview.statusFor(first, cat.id) === 'locked'));
first.days = 7;
assert(preview.cats.filter(cat => cat.id !== 'calico').every(cat => preview.statusFor(first, cat.id) === 'adoptable'),
    'day seven must allow any remaining cat as the second adoption');
first.selectedId = 'siamese'; preview.activate(first, 'adopt'); preview.activate(first, 'adopt');
assert.deepStrictEqual(first.owned, ['calico', 'siamese'], 'second adoption replay must be idempotent');
assert.strictEqual(preview.statusFor(first, 'cream'), 'locked');
assert.strictEqual(preview.statusFor(first, 'ragdoll'), 'locked');
assert.strictEqual(preview.condition(first), '后续解锁条件待确定');

const screenBase = { safeTop: 47, contentTop: 91, safeBottom: 34, safeLeft: 0, safeRight: 0 };
for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
    const screen = Object.assign({ width, height }, screenBase);
    const model = preview.create('adopted');
    let buttons = CatalogUI.draw(ctx, screen, model);
    model.offset = buttons.maxScroll;
    buttons = CatalogUI.draw(ctx, screen, model);
    assert(buttons['cat:calico'], width + ' must expose the fourth cat at the end of the list');
    for (const [key, rect] of Object.entries(buttons)) {
        if (key === 'viewport' || key === 'maxScroll') continue;
        assert(rect.w >= 44 && rect.h >= 44, width + ' ' + key + ' is smaller than 44px');
    }
}

const file = require.resolve('../js/main');
const req = require('module').createRequire(file);
const moduleFixture = { exports: {} };
const blocked = () => { throw Error('Catalog preview must not access storage or network'); };
vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module: moduleFixture,
    wx: { getStorageSync: blocked, setStorageSync: blocked, cloud: { callFunction: blocked } },
    require: name => name === './audio' ? { click() {}, unlock() {} } : req(name)
}, { filename: file });
const Main = moduleFixture.exports;

function makeApp() {
    const app = Object.create(Main.prototype);
    app.state = 'catalog_preview';
    app.catalogPreviewEnabled = true;
    app.catalogPreview = preview.create();
    app.catalogButtons = null;
    app.catalogTouch = null;
    app.handleGuideTouch = () => false;
    app.handleStaminaDialogTouch = () => false;
    app.screen = Object.assign({ width: 390, height: 844 }, screenBase);
    app.ctx = ctx;
    return app;
}
function render(app) { app.catalogButtons = CatalogUI.draw(ctx, app.screen, app.catalogPreview); }
function center(rect, identifier) {
    return { clientX: rect.x + rect.w / 2, clientY: rect.y + rect.h / 2, identifier };
}
function enterDetail(app, id) {
    render(app);
    const p = center(app.catalogButtons['cat:' + id], 11);
    app.handleTouchStart({ touches: [p] });
    app.handleTouchEnd({ changedTouches: [p], touches: [] });
    render(app);
}

{
    const app = makeApp();
    enterDetail(app, 'cream');
    const p = center(app.catalogButtons.adopt, 11);
    app.handleTouchStart({ touches: [p] });
    app.handleHide();
    app.handleTouchEnd({ changedTouches: [p], touches: [] });
    assert.deepStrictEqual(app.catalogPreview.owned, [], 'hide must cancel a pending adoption');
}

{
    const app = makeApp();
    enterDetail(app, 'cream');
    const firstFinger = center(app.catalogButtons.adopt, 11);
    const otherFinger = center(app.catalogButtons.adopt, 22);
    app.handleTouchStart({ touches: [firstFinger] });
    app.handleTouchEnd({ changedTouches: [otherFinger], touches: [firstFinger] });
    assert.deepStrictEqual(app.catalogPreview.owned, [], 'ending another finger must not adopt');
}

{
    const app = makeApp();
    enterDetail(app, 'cream');
    const firstFinger = center(app.catalogButtons.adopt, 11);
    const otherFinger = center(app.catalogButtons.adopt, 22);
    app.handleTouchStart({ touches: [firstFinger, otherFinger] });
    app.handleTouchEnd({ changedTouches: [firstFinger], touches: [otherFinger] });
    assert.deepStrictEqual(app.catalogPreview.owned, [], 'a multi-touch start must not adopt');
}

{
    const app = makeApp();
    enterDetail(app, 'cream');
    const firstFinger = center(app.catalogButtons.adopt, 11);
    const otherFinger = center(app.catalogButtons.adopt, 22);
    app.handleTouchStart({ touches: [firstFinger] });
    app.handleTouchMove({ touches: [otherFinger] });
    app.handleTouchEnd({ changedTouches: [firstFinger], touches: [] });
    assert.deepStrictEqual(app.catalogPreview.owned, [], 'switching fingers during a move must cancel adoption');
}

{
    const app = makeApp();
    enterDetail(app, 'cream');
    const p = center(app.catalogButtons.adopt, 11);
    app.handleTouchStart({ touches: [p] });
    app.catalogPreview.selectedId = 'ragdoll';
    render(app);
    app.handleTouchEnd({ changedTouches: [p], touches: [] });
    assert.deepStrictEqual(app.catalogPreview.owned, [], 'selection change during a touch must invalidate adoption');
}

console.log('catalog independent QA passed');
