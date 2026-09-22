/**
 * 确定性无限关卡回归：覆盖近端、分段边界和远端一个完整周期。
 * 用法: node test/infinite-levels.js
 */

const assert = require('assert');
const levelData = require('../js/core/level');
const GameCore = require('../js/core/game-core');
const gridUtil = require('../js/core/grid');

const expectedRates = [
    95, 80, 77, 74, 69, 65, 62, 58, 55, 45,
    75, 73, 70, 67, 64, 61, 58, 55, 47, 43
];
const cycle = [72, 70, 68, 65, 62, 60, 57, 54, 48, 40];

function expectedTime(rate, id) {
    if (id === 1) return 0;
    if (id === 6) return 165;
    if (rate >= 80) return 180;
    if (rate >= 68) return 165;
    if (rate >= 58) return 150;
    return 120;
}

function fingerprint(level) {
    return JSON.stringify({
        goals: level.goals,
        underlays: level.underlays,
        obstacles: level.obstacles
    });
}

function cells(layout) {
    return Object.keys(layout || {});
}

function checkLevel(id) {
    const first = levelData.getLevel(id);
    const second = levelData.getLevel(id);
    assert(first && second, '关卡 ' + id + ' 应可生成');
    assert.deepStrictEqual(first, second, '关卡 ' + id + ' 配置必须确定性相等');
    assert.strictEqual(first.id, id);
    assert.strictEqual(first.rows, 8);
    assert.strictEqual(first.columns, 8);
    assert(first.moveCount > 0, '关卡 ' + id + ' 步数必须为正');
    assert.strictEqual(first.timeLimitSec, expectedTime(levelData.getTargetWinRate(id), id));
    assert.strictEqual(first.targetWinRate, levelData.getTargetWinRate(id));
    assert.strictEqual(first.generatorVersion, id === 1 ? 'curated-v4' : (id <= 20 ? levelData.curatedGeneratorVersion : levelData.infiniteGeneratorVersion));
    assert.strictEqual(first.contentRevision, id === 1 ? 'curated-v4' : (id <= 20 ? 'curated-v5-difficulty' : (id <= 30 ? 'infinite-v4-difficulty-cycle21' : 'infinite-v4-difficulty')));

    const jelly = cells(first.underlays);
    const ice = cells(first.obstacles);
    ice.forEach(function (key) {
        assert(jelly.indexOf(key) === -1, '关卡 ' + id + ' 障碍与果冻不得同格: ' + key);
    });
    (first.goals || []).forEach(function (goal) {
        assert(goal.type === 'score' || goal.type === 'jelly' || goal.type === 'collect', '关卡 ' + id + ' 目标类型非法');
        if (goal.type === 'collect') {
            assert(Number.isInteger(goal.pieceType) && goal.pieceType >= 1 && goal.pieceType <= 4,
                '关卡 ' + id + ' 收集颜色非法');
        }
    });
    const jellyGoal = (first.goals || []).filter(function (goal) { return goal.type === 'jelly'; })[0];
    if (jellyGoal) assert.strictEqual(jellyGoal.target, jelly.length, '关卡 ' + id + ' 果冻目标数量不一致');
    if (id <= 20) {
        assert(first.goals.length <= 2, '精修关卡 ' + id + ' 不能同时显示超过两个目标');
        const core = new GameCore(first, {});
        assert.strictEqual(gridUtil.getMatches(core.grid, null, core.minMatchCount).length, 0,
            '精修关卡 ' + id + ' 初始棋盘不得已有匹配');
        assert(core.hasValidMoves(), '精修关卡 ' + id + ' 初始棋盘必须至少有一个可行交换');
    }
    return first;
}

function infiniteFingerprint(level) {
    return JSON.stringify({
        id: level.id,
        name: level.name,
        rows: level.rows,
        columns: level.columns,
        timeLimitSec: level.timeLimitSec,
        moveCount: level.moveCount,
        goals: level.goals,
        underlays: level.underlays,
        obstacles: level.obstacles,
        targetWinRate: level.targetWinRate,
        generatorVersion: level.generatorVersion
    });
}

const v4LayoutSamples = {
    21: '{"id":21,"name":"新手入门 · 21","rows":8,"columns":8,"timeLimitSec":165,"moveCount":24,"goals":[{"type":"score","target":4200}],"underlays":{},"obstacles":{},"targetWinRate":72,"generatorVersion":"infinite-v4"}',
    24: '{"id":24,"name":"甜蜜开场 · 24","rows":8,"columns":8,"timeLimitSec":150,"moveCount":26,"goals":[{"type":"jelly","target":6}],"underlays":{"4:4":1,"3:4":1,"4:3":1,"3:3":1,"4:2":1,"3:2":1},"obstacles":{"5:5":1,"2:2":1},"targetWinRate":65,"generatorVersion":"infinite-v4"}',
    27: '{"id":27,"name":"缤纷世界 · 27","rows":8,"columns":8,"timeLimitSec":120,"moveCount":24,"goals":[{"type":"jelly","target":8},{"type":"score","target":2700}],"underlays":{"2:3":1,"2:4":1,"3:3":1,"3:4":1,"4:3":1,"4:4":1,"5:3":1,"5:4":1},"obstacles":{},"targetWinRate":57,"generatorVersion":"infinite-v4"}',
    30: '{"id":30,"name":"双倍挑战 · 30","rows":8,"columns":8,"timeLimitSec":120,"moveCount":22,"goals":[{"type":"jelly","target":8},{"type":"score","target":3800}],"underlays":{"4:2":1,"3:2":1,"4:3":1,"3:3":1,"4:4":1,"3:4":1,"4:5":1,"3:5":1},"obstacles":{"5:2":1,"2:2":1,"5:5":1,"2:5":1},"targetWinRate":40,"generatorVersion":"infinite-v4"}'
};

Object.keys(v4LayoutSamples).forEach(function (id) {
    assert.strictEqual(infiniteFingerprint(levelData.getLevel(Number(id))), v4LayoutSamples[id],
        '关卡 ' + id + ' 必须保留 v3 的布局/目标并采用 v4 难度预算');
});

for (let id = 1; id <= 40; id++) {
    const level = checkLevel(id);
    const expected = id <= 20 ? expectedRates[id - 1] : cycle[(id - 21) % cycle.length];
    assert.strictEqual(levelData.getTargetWinRate(id), expected, '关卡 ' + id + ' 胜率目标错误');
    if (id > 1) {
        assert.notStrictEqual(fingerprint(level), fingerprint(levelData.getLevel(id - 1)), '相邻关卡布局/目标不能完全相同');
    }
}

// 第21关起实际步数预算也进入同一循环，不能只替换目标百分比。
const cycleMoves = [24, 25, 25, 26, 23, 24, 24, 23, 24, 22];
for (let id = 21; id <= 60; id++) {
    assert.strictEqual(levelData.getLevel(id).moveCount, cycleMoves[(id - 21) % 10]);
}
checkLevel(1000);

const remoteStart = 100000;
for (let i = 0; i < cycle.length; i++) {
    const id = remoteStart + i;
    checkLevel(id);
    assert.strictEqual(levelData.getTargetWinRate(id), cycle[(id - 21) % cycle.length]);
    if (i > 0) assert.notStrictEqual(fingerprint(levelData.getLevel(id)), fingerprint(levelData.getLevel(id - 1)));
}

assert.strictEqual(levelData.getLevel(0), null);
assert.strictEqual(levelData.getTargetWinRate(1.5), null);
console.log('无限关卡: 1/2/10/11/31/1000/100000 确定性、v3布局保留、目标、障碍和时间档位通过');
console.log('generatorVersion:', levelData.generatorVersion);
