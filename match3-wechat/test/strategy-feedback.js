'use strict';
const assert = require('assert');
const store = {
    match3_coin_v1: 730,
    match3_items_v1: { hammer: 1, bomb: 2, color: 0 },
    match3_music_enabled_v1: false,
    match3_sfx_enabled_v1: false,
    match3_onboarding_v1: { solo_intro: true, special_piece: true, obstacle: true, solo_item: true, pvp_wait: true }
};
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
global.wx = { getStorageSync: key => clone(store[key]), setStorageSync: (key, value) => { store[key] = clone(value); } };
const Main = require('../js/main');
const levels = require('../js/core/level');
const feedback = require('../js/core/strategy-feedback');
const onboarding = require('../js/core/onboarding');
const GuideUI = require('../js/render/onboarding');
const UI = require('../js/render/ui');

const text = [];
const ctx = new Proxy({}, {
    get(target, key) {
        if (key in target) return target[key];
        if (key === 'measureText') return value => ({ width: String(value).length * 12 });
        if (key === 'fillText') return (value, x, y) => text.push({ value: String(value), x, y });
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
        return () => {};
    },
    set(target, key, value) { target[key] = value; return true; }
});
const collectionLevel = Array.from({ length: 20 }, (_, i) => levels.getLevel(i + 1)).find(feedback.collectGoal);
assert(collectionLevel, '新版前20关应包含实际可玩的收集目标');
const app = Object.create(Main.prototype);
app.ctx = ctx;
app.screen = { width: 320, height: 568, contentTop: 91, safeTop: 47, safeBottom: 34 };
app.guideQueue = [];
app.progress = { unlockedLevel: 42, stars: { 1: 3, 6: 2, 21: 3 }, failures: { [collectionLevel.id]: 4, 21: 2, 31: 2 },
    contentRevisions: {21:'infinite-v4-difficulty',31:'infinite-v4-difficulty'} };
const stars = clone(app.progress.stars);
app.startGame(collectionLevel.id);
assert.strictEqual(app.progress.unlockedLevel, 42, '不得重置已解锁关卡');
assert.deepStrictEqual(app.progress.stars, stars, '不得重置最高星级');
assert.strictEqual(app.progress.failures[collectionLevel.id], undefined, '改变关卡不能沿用旧失败计数');
assert.strictEqual(app.progress.failures[21], 2, '尚未进入的关卡按需迁移');
assert.strictEqual(app.core.movesLeft, collectionLevel.moveCount, '迁移不应错误应用旧连败助力');
assert.strictEqual(store.match3_coin_v1, 730);
assert.deepStrictEqual(store.match3_items_v1, { hammer: 1, bomb: 2, color: 0 });
assert.strictEqual(store.match3_heart_v1.count, 4, '正常开始恰好消耗一点体力');
assert.strictEqual(app.guide.key, onboarding.GUIDE_KEYS.COLLECT, '旧玩家只看到新内容引导');
assert(app.core.timerPaused);
app.guideButtons = GuideUI.draw(ctx, app.screen, app.guide.key, app.guideContext());
const skip = app.guideButtons.skip;
assert(app.handleGuideTouch(skip.x + 2, skip.y + 2));
assert.strictEqual(app.guide, null);
assert.strictEqual(app.core.timerPaused, false);
assert(onboarding.hasSeen(onboarding.GUIDE_KEYS.COLLECT));

app.progress.failures[collectionLevel.id] = 2;
app.startGame(collectionLevel.id);
assert.strictEqual(app.core.movesLeft, collectionLevel.moveCount + 3, '同版本失败计数正常沿用');
assert.strictEqual(app.guide, null, '已跳过教学不再弹出');
app.startGame(21);
assert.strictEqual(app.core.movesLeft, levels.getLevel(21).moveCount, '21关接入循环后清除旧助力');
assert.strictEqual(app.progress.failures[21], undefined);
assert.strictEqual(feedback.syncContentRevision(app.progress, levels.getLevel(31)), true);
assert.strictEqual(app.progress.failures[31], undefined, '31关五色递进配置也须清除旧助力');
app.progress.failures[31] = 2;
assert.strictEqual(feedback.syncContentRevision(app.progress, levels.getLevel(31)), false);
assert.strictEqual(app.progress.failures[31], 2, '同版本失败助力继续有效');
assert.deepStrictEqual(app.progress.stars, stars);
assert.strictEqual(app.progress.unlockedLevel, 42);

app.core.grid = app.core.grid.map((row, r) => row.map((_, c) => (r + c) % 4 + 1));
app.core.iceGrid = app.core.grid.map(row => row.map(() => 0));
app.core.grid[2][2] = 101;
app.core.grid[2][3] = 103;
app.core.iceGrid[2][2] = 1;
assert.deepStrictEqual(feedback.specialPair(app.core), [], '冰封棋子不能作为可交换组合提示');
app.core.iceGrid[2][2] = 0;
app.core.jellyGrid = app.core.grid.map(row => row.map(() => 0));
app.core.jellyGrid[2][3] = 1;
assert.deepStrictEqual(feedback.specialPair(app.core), [], '果冻固定的棋子不能作为可交换组合提示');
app.core.jellyGrid[2][3] = 0;
app.runtimeState = 'playing';
app.update(0);
assert.strictEqual(app.guide.key, onboarding.GUIDE_KEYS.SPECIAL_COMBO);
assert.strictEqual(app.guideContext().spots.length, 2);
assert(app.core.timerPaused);
app.dismissGuide();
assert.strictEqual(app.core.timerPaused, false);
app.update(0);
assert.strictEqual(app.guide, null, '组合提示只出现一次');

app.core.maxCascade = 4;
app.core.specialComboCount = 2;
app.handleLevelEnd({ win: false, score: 1320, movesLeft: 0, reason: 'moves', timeLeftMs: 1000 });
assert.strictEqual(app.result.maxCascade, 4);
assert.strictEqual(app.result.specialComboCount, 2);
assert.strictEqual(app.state, 'result');
assert.strictEqual(app.guide, null, '结算不得残留引导遮挡按钮');

for (const [width, height] of [[320, 568], [375, 812], [430, 932]]) {
    const screen = { width, height, contentTop: 91, safeBottom: 34 };
    for (const y of [240, height - 150]) {
        const spot = { x: width / 2, y, size: 28 };
        const buttons = GuideUI.draw(ctx, screen, 'special_combo', { spots: [spot] });
        const panel = buttons.panel;
        assert(panel.y >= 91 && panel.y + panel.h <= height - 34);
        assert(spot.y + spot.size / 2 < panel.y || spot.y - spot.size / 2 > panel.y + panel.h,
            '情境引导不得盖住高亮目标');
        assert(buttons.skip.h >= 44 && buttons.confirm.h >= 44);
    }
    for (const result of [
        { win: true, star: 3, coinReward: 240, hasNext: true },
        { win: false, canRevive: false },
        { win: false, canRevive: true, timed: true, reason: 'timeout' }
    ]) {
        text.length = 0;
        const buttons = UI.drawResult(ctx, screen, { ...result, score: 4200, maxCascade: 4, specialComboCount: 2 });
        const statRows = text.filter(row => ['最高连消', '特殊组合', '4 连', '2 次'].includes(row.value));
        assert.strictEqual(statRows.length, 4);
        const firstButtonY = buttons.revive ? buttons.revive.y : buttons.main.y;
        assert(statRows.every(row => row.y < firstButtonY - 14), '统计不能和按钮重叠');
        const statTop = Math.min(...statRows.map(row => row.y));
        const otherBody = text.filter(row => row.value.includes('得分：') || row.value.includes('金币') || row.value.includes('别急'));
        assert(otherBody.every(row => row.y < statTop - 12), '统计不能遮挡分数、金币和失败说明');
    }
}
async function unsettledSwapDoesNotTeach() {
    const Core = require('../js/core/game-core');
    let release;
    const core = new Core({ rows: 8, columns: 8, moveCount: 10, goals: [{ type: 'score', target: 999999 }] }, {
        onSwap: () => new Promise(resolve => { release = resolve; })
    });
    core.grid = core.grid.map((row, r) => row.map((_, c) => (r + c) % 4 + 1));
    core.grid[1][0] = 101;
    core.grid[1][2] = 103;
    assert.deepStrictEqual(feedback.specialPair(core), []);
    const swap = core.trySwap({ row: 1, column: 0 }, { row: 1, column: 1 });
    assert.strictEqual(core.processing, false, '回归覆盖onSwap尚未完成、processing尚未开始的窗口');
    assert.deepStrictEqual(feedback.specialPair(core), [], '交换动画里的临时相邻棋子不能触发一次性教学');
    release();
    await swap;
}
unsettledSwapDoesNotTeach().then(() => {
    console.log('策略反馈：旧存档保留/按关卡版本助力/首次教学/组合高亮/动画中不误提示/结算与三档布局通过');
}).catch(error => { console.error(error); process.exitCode = 1; });
