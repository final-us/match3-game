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
assert.strictEqual(onboarding.shouldShow(onboarding.GUIDE_KEYS.JELLY), true);
assert.strictEqual(onboarding.shouldShow(onboarding.GUIDE_KEYS.ICE), true);
onboarding.markSeen(onboarding.GUIDE_KEYS.JELLY);
assert.strictEqual(onboarding.shouldShow(onboarding.GUIDE_KEYS.ICE), true, '果冻教学不能提前完成冰块教学');
storage[onboarding.STORAGE_KEY] = { obstacle: true };
assert.strictEqual(onboarding.shouldShow(onboarding.GUIDE_KEYS.JELLY), false, '旧玩家障碍教学完成标记保持有效');
assert.strictEqual(onboarding.shouldShow(onboarding.GUIDE_KEYS.ICE), false);

const textRecords = [];
const ctx = new Proxy({}, {
    get: function (target, key) {
        if (key === 'measureText') return function (value) { return { width: String(value).length * 15 }; };
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return function () { return { addColorStop: function () {} }; };
        if (key === 'fillText') return function (text, x, y) { textRecords.push({ text, x, y }); };
        return function () {};
    },
    set: function (target, key, value) { target[key] = value; return true; }
});
for (const [width, height] of [[320, 568], [375, 812], [430, 932]]) {
const screen = { width, height, safeTop: 44, contentTop: 88, safeBottom: 34 };
Object.keys(GuideUI.CONTENT).forEach(function (key) {
    textRecords.length = 0;
    const buttons = GuideUI.draw(ctx, screen, key);
    const body = textRecords.slice(1, -2);
    assert.strictEqual(body.map(line => line.text).join(''), GuideUI.CONTENT[key].lines.join(''), key + ' 文案发生变化');
    assert(body.length <= 4, key + ' 正文超过保留行数');
    body.forEach(function (line) {
        assert(!/^[，。、；：！？]/.test(line.text), key + ' 标点孤立行首');
        assert(line.text.length * 15 <= Math.min(348, width - 24) - 44, key + ' 正文溢出');
        assert(line.y > textRecords[0].y + 24 && line.y < buttons.skip.y - 24, key + ' 正文与标题/按钮重叠');
    });
    ['skip', 'confirm'].forEach(function (name) {
        const button = buttons[name];
        assert(button.x >= 0 && button.y >= screen.contentTop &&
            button.x + button.w <= screen.width && button.y + button.h <= screen.height - screen.safeBottom,
            key + ' 引导按钮溢出安全区');
        assert(button.w >= 44 && button.h >= 44, key + ' 引导按钮小于44px');
        assert.strictEqual(GuideUI.hitTest(button.x + button.w / 2, button.y + button.h / 2, button), true);
    });
    assert(buttons.skip.x + buttons.skip.w < buttons.confirm.x, key + ' 引导按钮重叠');
});
}

assert(GuideUI.CONTENT.moonbud.lines.join('').includes('不能交换或下落'));
assert(GuideUI.CONTENT.moonbud.lines.join('').includes('保护猫和花苞'));
assert(GuideUI.CONTENT.yarn_spread.lines.join('').includes('邻消不伤延伸藤'));
assert(GuideUI.CONTENT.yarn_spread.lines.join('').includes('解开留猫'));

const mainSource = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
[
    'GUIDE_KEYS.SOLO', 'GUIDE_KEYS.SPECIAL', 'GUIDE_KEYS.JELLY', 'GUIDE_KEYS.ICE',
    'GUIDE_KEYS.SOLO_ITEM', 'GUIDE_KEYS.PVP_WAIT', 'GUIDE_KEYS.YARN'
].forEach(function (marker) {
    assert(mainSource.includes(marker), '主流程缺少引导触发点 ' + marker);
});
assert(mainSource.includes('this.core.pauseTimer()') && mainSource.includes('this.core.resumeTimer()'),
    '单人引导未暂停并恢复关卡计时');

console.log('onboarding tests passed');
