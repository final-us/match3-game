/**
 * 确定性无限关卡回归：覆盖近端、分段边界和远端一个完整周期。
 * 用法: node test/infinite-levels.js
 */

const assert = require('assert');
const levelData = require('../js/core/level');
const GameCore = require('../js/core/game-core');
const gridUtil = require('../js/core/grid');

const expectedRates = [
    95, 80, 77, 74, 69, 85, 78, 72, 65, 58,
    78, 73, 70, 65, 60, 75, 65, 60, 55, 45
];
const cycle = [60, 58, 55, 54, 51, 48, 45, 42, 36, 28];

function expectedTime(rate, id) {
    if (id === 1) return 0;
    if (id >= 6 && id <= 20) return [165,165,150,135,135,165,165,150,150,150,165,150,135,120,120][id-6];
    if (id >= 21) return (id-21)%10 < 3 ? 165 : (id-21)%10 < 6 ? 150 : 135;
    if (rate >= 80) return 180;
    if (rate >= 68) return 165;
    if (rate >= 58) return 150;
    return 120;
}

function fingerprint(level) {
    return JSON.stringify({
        goals: level.goals,
        underlays: level.underlays,
        obstacles: level.obstacles,
        yarn: level.yarn
    });
}

function hasYarn(id) {
    return id === 11 || id === 16 || id === 19 ||
        (id >= 21 && [2, 5, 9].includes((id - 21) % 10));
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
    assert(first.moveCount >= 20 && first.moveCount <= 28, '关卡步数保持可玩范围');
    assert.strictEqual(first.colorCount, id <= 5 ? 4 : 5);
    assert.strictEqual(first.timeLimitSec, expectedTime(levelData.getTargetWinRate(id), id));
    assert.strictEqual(first.targetWinRate, levelData.getTargetWinRate(id));
    assert.strictEqual(first.generatorVersion, id === 1 ? 'curated-v4' : (id <= 5 ? 'curated-v5' : id <= 20 ? (hasYarn(id) && id !== 11 ? 'curated-v7' : levelData.curatedGeneratorVersion) : hasYarn(id) ? 'infinite-v6' : levelData.infiniteGeneratorVersion));
    assert.strictEqual(first.contentRevision, id === 1 ? 'curated-v4' : (id <= 5 ? 'curated-v5-difficulty' : id === 11 ? 'curated-v7-yarn-intro' : id <= 20 ? (hasYarn(id) ? 'curated-v7-yarn-rollout' : 'curated-v6-five-colors') : hasYarn(id) ? 'infinite-v6-yarn-cycle' : 'infinite-v5-progressive-colors'));

    const jelly = cells(first.underlays);
    const ice = cells(first.obstacles);
    ice.forEach(function (key) {
        assert(jelly.indexOf(key) === -1, '关卡 ' + id + ' 障碍与果冻不得同格: ' + key);
    });
    assert.strictEqual(!!first.yarn, hasYarn(id), '关卡 ' + id + ' 毛线投放不符合渐进规则');
    if (first.yarn) {
        assert(!first.underlays[first.yarn.source] && !first.obstacles[first.yarn.source], '毛线源头不能覆盖既有障碍');
        assert.strictEqual(first.yarn.health, 3);
        assert.strictEqual(first.yarn.spreadEvery, 2);
        assert.strictEqual(first.yarn.maxVines, 3);
        assert.strictEqual(first.goals.filter(goal => goal.type === 'yarn').length, 1);
        assert.strictEqual(first.goals.find(goal => goal.type === 'yarn').target, first.yarn.health);
    }
    (first.goals || []).forEach(function (goal) {
        assert(goal.type === 'score' || goal.type === 'jelly' || goal.type === 'collect' || goal.type === 'yarn', '关卡 ' + id + ' 目标类型非法');
        if (goal.type === 'collect') {
            assert(Number.isInteger(goal.pieceType) && goal.pieceType >= 1 && goal.pieceType <= first.colorCount,
                '关卡 ' + id + ' 收集颜色非法');
        }
    });
    const jellyGoal = (first.goals || []).filter(function (goal) { return goal.type === 'jelly'; })[0];
    if (jellyGoal) assert.strictEqual(jellyGoal.target, jelly.length, '关卡 ' + id + ' 果冻目标数量不一致');
    if (id <= 20) {
        assert(first.goals.length <= (first.yarn && id !== 11 ? 3 : 2), '精修关卡 ' + id + ' 目标过多');
        const core = new GameCore(first, {});
        assert.strictEqual(gridUtil.getMatches(core.grid, null, core.minMatchCount).length, 0,
            '精修关卡 ' + id + ' 初始棋盘不得已有匹配');
        assert(core.hasValidMoves(), '精修关卡 ' + id + ' 初始棋盘必须至少有一个可行交换');
    }
    return first;
}

for (let id = 1; id <= 30; id++) {
    const level = checkLevel(id);
    const expected = id <= 20 ? expectedRates[id - 1] : cycle[(id - 21) % cycle.length];
    assert.strictEqual(levelData.getTargetWinRate(id), expected, '关卡 ' + id + ' 胜率目标错误');
    if (id > 1) {
        assert.notStrictEqual(fingerprint(level), fingerprint(levelData.getLevel(id - 1)), '相邻关卡布局/目标不能完全相同');
    }
}

// 后段不只更改目标标签：同一周期位置的分数要求持续提高、步数不增加。
for (let position = 0; position < 10; position++) {
    let earlier = checkLevel(21 + position);
    for (const start of [31, 51, 121, 221, 421, 1021]) {
        const later = checkLevel(start + position);
        const score = level => level.goals.find(g => g.type === 'score').target;
        assert(score(later) > score(earlier), '后段必须提高实际目标');
        assert(later.moveCount <= earlier.moveCount);
        assert(later.targetWinRate <= earlier.targetWinRate);
        assert(score(later) <= score(levelData.getLevel(21 + position)) * 1.2 + 5, '目标增幅有界');
        earlier = later;
    }
}
assert.strictEqual(levelData.getLevel(21).moveCount, 24);
assert.strictEqual(levelData.getLevel(121).moveCount, 23);
assert.strictEqual(levelData.getLevel(421).moveCount, 23);
checkLevel(1000);

const remoteStart = 100000;
for (let i = 0; i < cycle.length; i++) {
    const id = remoteStart + i;
    checkLevel(id);
    assert(levelData.getTargetWinRate(id) >= 10 && levelData.getTargetWinRate(id) < cycle[(id-21)%10]);
    if (i > 0) assert.notStrictEqual(fingerprint(levelData.getLevel(id)), fingerprint(levelData.getLevel(id - 1)));
}

assert.strictEqual(levelData.getLevel(0), null);
assert.strictEqual(levelData.getTargetWinRate(1.5), null);
console.log('无限关卡: 1/2/10/11/31/1000/100000 确定性、颜色、递进难度、目标、障碍和预算通过');
console.log('generatorVersion:', levelData.generatorVersion);
