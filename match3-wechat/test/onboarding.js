'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const storage = {};
global.wx = {
    getStorageSync: function (key) { return storage[key]; },
    setStorageSync: function (key, value) { storage[key] = value; }
};

const onboarding = require('../js/core/onboarding');
const GuideUI = require('../js/render/onboarding');

assert.strictEqual(onboarding.shouldShow(onboarding.GUIDE_KEYS.SOLO), true);
assert.strictEqual(onboarding.markSeen(onboarding.GUIDE_KEYS.SOLO), true);
assert.strictEqual(onboarding.hasSeen(onboarding.GUIDE_KEYS.SOLO), true);
assert.strictEqual(onboarding.shouldShow(onboarding.GUIDE_KEYS.SOLO), false);
assert.strictEqual(onboarding.shouldShow('unknown'), false);

const ctx = new Proxy({}, {
    get: function (target, key) {
        if (key === 'measureText') return function (value) { return { width: String(value).length * 8 }; };
        if (key === 'createLinearGradient') return function () { return { addColorStop: function () {} }; };
        if (key === 'fillText') return function () {};
        return function () {};
    },
    set: function (target, key, value) { target[key] = value; return true; }
});
const screen = { width: 320, height: 568, safeTop: 24, safeBottom: 20 };
Object.keys(GuideUI.CONTENT).forEach(function (key) {
    const buttons = GuideUI.draw(ctx, screen, key);
    ['skip', 'confirm'].forEach(function (name) {
        const button = buttons[name];
        assert(button.x >= 0 && button.y >= screen.safeTop &&
            button.x + button.w <= screen.width && button.y + button.h <= screen.height - screen.safeBottom,
            key + ' 引导按钮溢出安全区');
        assert.strictEqual(GuideUI.hitTest(button.x + button.w / 2, button.y + button.h / 2, button), true);
    });
});

const mainSource = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
[
    'GUIDE_KEYS.SOLO', 'GUIDE_KEYS.SPECIAL', 'GUIDE_KEYS.OBSTACLE',
    'GUIDE_KEYS.SOLO_ITEM', 'GUIDE_KEYS.PVP_WAIT'
].forEach(function (marker) {
    assert(mainSource.includes(marker), '主流程缺少引导触发点 ' + marker);
});
assert(mainSource.includes('this.core.pauseTimer()') && mainSource.includes('this.core.resumeTimer()'),
    '单人引导未暂停并恢复关卡计时');

console.log('onboarding tests passed');
