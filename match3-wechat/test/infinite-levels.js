/**
 * 确定性无限关卡回归：覆盖近端、分段边界和远端一个完整周期。
 * 用法: node test/infinite-levels.js
 */

const assert = require('assert');
const levelData = require('../js/core/level');

const expectedRates = [
    95, 88, 85, 82, 76, 73, 70, 64, 60, 52,
    84, 82, 79, 76, 73, 70, 67, 63, 57, 50,
    82, 80, 77, 74, 71, 68, 65, 61, 55, 49
];
const cycle = [80, 78, 76, 73, 70, 68, 65, 62, 56, 48];

function expectedTime(rate, id) {
    if (id === 1) return 0;
    if (rate >= 80) return 180;
    if (rate >= 68) return 165;
    if (rate >= 58) return 150;
    return 135;
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
    assert.strictEqual(first.generatorVersion, levelData.generatorVersion);

    const jelly = cells(first.underlays);
    const ice = cells(first.obstacles);
    ice.forEach(function (key) {
        assert(jelly.indexOf(key) === -1, '关卡 ' + id + ' 障碍与果冻不得同格: ' + key);
    });
    (first.goals || []).forEach(function (goal) {
        assert(goal.type === 'score' || goal.type === 'jelly', '关卡 ' + id + ' 目标类型非法');
    });
    const jellyGoal = (first.goals || []).filter(function (goal) { return goal.type === 'jelly'; })[0];
    if (jellyGoal) assert.strictEqual(jellyGoal.target, jelly.length, '关卡 ' + id + ' 果冻目标数量不一致');
    return first;
}

for (let id = 1; id <= 40; id++) {
    const level = checkLevel(id);
    const expected = id <= 30 ? expectedRates[id - 1] : cycle[(id - 31) % cycle.length];
    assert.strictEqual(levelData.getTargetWinRate(id), expected, '关卡 ' + id + ' 胜率目标错误');
    if (id > 1) {
        assert.notStrictEqual(fingerprint(level), fingerprint(levelData.getLevel(id - 1)), '相邻关卡布局/目标不能完全相同');
    }
}

checkLevel(1000);

const remoteStart = 100000;
for (let i = 0; i < cycle.length; i++) {
    const id = remoteStart + i;
    checkLevel(id);
    assert.strictEqual(levelData.getTargetWinRate(id), cycle[(id - 31) % cycle.length]);
    if (i > 0) assert.notStrictEqual(fingerprint(levelData.getLevel(id)), fingerprint(levelData.getLevel(id - 1)));
}

assert.strictEqual(levelData.getLevel(0), null);
assert.strictEqual(levelData.getTargetWinRate(1.5), null);
console.log('无限关卡: 1/2/10/11/31/1000/100000 确定性、目标、障碍和时间档位通过');
console.log('generatorVersion:', levelData.generatorVersion);
