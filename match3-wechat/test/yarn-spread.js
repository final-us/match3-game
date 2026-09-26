'use strict';

const assert = require('assert');
const GameCore = require('../js/core/game-core');
const levelData = require('../js/core/level');
const strategyFeedback = require('../js/core/strategy-feedback');
const config = require('../js/core/config');

function neighbors(pos) {
    return [
        { row: pos.row - 1, column: pos.column },
        { row: pos.row + 1, column: pos.column },
        { row: pos.row, column: pos.column - 1 },
        { row: pos.row, column: pos.column + 1 }
    ];
}

function firstMove(core) {
    for (let row = 0; row < 8; row++) {
        for (let column = 0; column < 8; column++) {
            const from = { row: row, column: column };
            if (core.isBlocked(from)) continue;
            for (const to of [{ row: row, column: column + 1 }, { row: row + 1, column: column }]) {
                if (to.row < 8 && to.column < 8 && !core.isBlocked(to) && core.validateMove(from, to)) {
                    return [from, to];
                }
            }
        }
    }
    return null;
}

(async function () {
    const level = levelData.getLevel(11);
    assert.deepStrictEqual(level.goals.map(goal => goal.type), ['yarn', 'score']);
    assert.deepStrictEqual(level.underlays, {});
    assert.strictEqual(level.yarn.health, 3);
    assert.strictEqual(levelData.getLevel(10).yarn, null);
    assert.strictEqual(levelData.getLevel(12).yarn, null);
    for (const id of [16, 19, 23, 26, 30, 33, 36, 40, 93, 96, 100, 100000]) {
        const mixed = levelData.getLevel(id);
        assert(mixed.yarn, '毛线应按十关节奏复现：' + id);
        assert.strictEqual(mixed.goals.filter(goal => goal.type === 'yarn').length, 1);
        assert(!mixed.underlays[mixed.yarn.source] && !mixed.obstacles[mixed.yarn.source]);
        assert(mixed.goals.length <= 3);
    }
    for (const id of [12, 15, 17, 20, 21, 22, 24, 25, 27, 29, 31, 99]) {
        assert.strictEqual(levelData.getLevel(id).yarn, null, '非投放关卡应保持原配置：' + id);
    }
    const progress = {
        unlockedLevel: 101,
        stars: { 16: 3, 30: 2 },
        failures: { 16: 4, 30: 4, 31: 4 },
        contentRevisions: {
            16: 'curated-v6-five-colors',
            30: 'infinite-v5-progressive-colors',
            31: 'infinite-v5-progressive-colors'
        }
    };
    assert(strategyFeedback.syncContentRevision(progress, levelData.getLevel(16)));
    assert(strategyFeedback.syncContentRevision(progress, levelData.getLevel(30)));
    assert.strictEqual(progress.failures[16], undefined);
    assert.strictEqual(progress.failures[30], undefined);
    assert.strictEqual(progress.failures[31], 4);
    assert.deepStrictEqual(progress.stars, { 16: 3, 30: 2 });
    assert.strictEqual(progress.unlockedLevel, 101);

    for (const id of [16, 19, 30, 100]) {
        const mixedCore = new GameCore(levelData.getLevel(id), {});
        mixedCore.score = 99999;
        mixedCore.jellyGrid.forEach(row => row.fill(0));
        mixedCore.level.goals.filter(goal => goal.type === 'collect').forEach(goal => {
            mixedCore.collectedCounts[goal.pieceType] = goal.target;
        });
        mixedCore.checkLevelEnd();
        assert.strictEqual(mixedCore.ended, false, '复合关必须先破除毛线：' + id);
        mixedCore.yarnSource.health = 0;
        mixedCore.checkLevelEnd();
        assert.strictEqual(mixedCore.won, true, '复合目标全完成才能获胜：' + id);
    }

    const goalCore = new GameCore(level, {});
    goalCore.score = 9999;
    goalCore.checkLevelEnd();
    assert.strictEqual(goalCore.ended, false, '分数达标但源头未破除不能过关');
    goalCore.yarnSource.health = 0;
    goalCore.checkLevelEnd();
    assert.strictEqual(goalCore.won, true, '双目标完成才可过关');

    const spreads = [];
    const core = new GameCore(level, { onYarnSpread: pos => spreads.push(pos) });
    const source = { row: core.yarnSource.row, column: core.yarnSource.column };
    const originalType = core.grid[source.row][source.column];
    const originalMoves = core.movesLeft;
    assert.strictEqual(await core.trySwap(source, neighbors(source)[0]), false);
    assert.strictEqual(core.yarnTurns, 0);
    assert.strictEqual(core.movesLeft, originalMoves);

    core.yarnSource.health = 30;
    for (let turn = 1; turn <= 2; turn++) {
        const move = firstMove(core);
        assert(move, '毛线关必须有合法交换');
        assert.strictEqual(await core.trySwap(move[0], move[1]), true);
        assert.strictEqual(core.yarnTurns, turn);
    }
    assert.strictEqual(spreads.length, 1);
    assert.strictEqual(Object.keys(core.yarnVines).length, 1);
    assert(core.hasValidMoves(), '蔓延后仍应能交换');
    assert.strictEqual(core.grid[source.row][source.column], originalType, '源头猫咪不得随重力移动');

    const vine = spreads[0];
    let vineRemoved = false;
    let firstHit = true;
    core.callbacks.onMatch = function (data) {
        if (firstHit && data.removed.some(pos => pos.row === vine.row && pos.column === vine.column)) vineRemoved = true;
        firstHit = false;
    };
    core.pendingRemovals = [neighbors(vine).find(pos => pos.row >= 0 && pos.row < 8 && pos.column >= 0 && pos.column < 8 &&
        !(pos.row === source.row && pos.column === source.column))];
    await core.processGrid();
    assert.strictEqual(core.yarnVines[vine.row + ':' + vine.column], undefined, '邻格消除应解开蔓延格');
    assert.strictEqual(vineRemoved, false, '解开毛线不应直接消除原猫咪');
    assert.strictEqual(core.yarnTurns, 2, '道具/直接消除不推进蔓延');

    const hitCore = new GameCore(level, {});
    const hitSource = { row: hitCore.yarnSource.row, column: hitCore.yarnSource.column };
    const adjacent = neighbors(hitSource)[0];
    hitCore.pendingRemovals = [adjacent];
    await hitCore.processGrid();
    assert.strictEqual(hitCore.getYarnHealth(), 2, '邻格命中伤害源头');
    hitCore.pendingRemovals = [adjacent];
    await hitCore.processGrid();
    assert.strictEqual(hitCore.getYarnHealth(), 1);
    hitCore.pendingRemovals = [adjacent];
    await hitCore.processGrid();
    assert.strictEqual(hitCore.getYarnHealth(), 0);
    assert.deepStrictEqual(hitCore.yarnVines, {});

    const specialCore = new GameCore(level, {});
    const specialSource = specialCore.yarnSource;
    const specialRow = specialSource.row;
    const specialColumn = specialSource.column > 0 ? specialSource.column - 1 : specialSource.column + 1;
    specialCore.grid[specialRow][specialColumn] = config.SPECIAL_TYPES.H_ROCKET;
    specialCore.pendingRemovals = [{ row: specialRow, column: specialColumn }];
    await specialCore.processGrid();
    assert.strictEqual(specialCore.getYarnHealth(), 2, '火箭命中源头每次操作最多一击');

    const reshuffleCore = new GameCore(level, {});
    const reshuffleSource = reshuffleCore.yarnSource;
    const cat = reshuffleCore.grid[reshuffleSource.row][reshuffleSource.column];
    await reshuffleCore.autoReshuffle();
    assert.strictEqual(reshuffleCore.grid[reshuffleSource.row][reshuffleSource.column], cat);
    assert(reshuffleCore.hasValidMoves());
    assert.strictEqual(reshuffleCore.getYarnHealth(), 3);

    const cappedCore = new GameCore(level, {});
    for (let attempt = 0; attempt < 8; attempt++) {
        cappedCore.spreadYarn();
        assert(Object.keys(cappedCore.yarnVines).length <= 3, '同时蔓延不得超过上限');
        assert(cappedCore.hasValidMoves(), '扩散不得封死全部交换');
    }

    console.log('yarn spread: ok');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
