/** 收集目标和策略统计的行为回归。用法: node test/collect-goal.js */

const assert = require('assert');
const GameCore = require('../js/core/game-core');
const config = require('../js/core/config');

function cleanBoard(core) {
    for (let r = 0; r < core.grid.length; r++) {
        for (let c = 0; c < core.grid[r].length; c++) core.grid[r][c] = (r + c) % 3 + 1;
    }
}

(async function () {
    let result = null;
    let firstMatch = null;
    const core = new GameCore({
        rows: 6,
        columns: 6,
        moveCount: 8,
        goals: [{ type: 'collect', pieceType: 2, target: 3 }]
    }, {
        onMatch: function (value) { if (!firstMatch) firstMatch = value; },
        onLevelEnd: function (value) { result = value; }
    });
    cleanBoard(core);
    core.grid[2][1] = 2;
    core.grid[2][2] = 2;
    core.grid[2][3] = 2;
    core.grid[2][4] = config.SPECIAL_TYPES.H_ROCKET;
    core.setSpecialBaseType({ row: 2, column: 4 }, 2);
    core.jellyGrid[2][1] = 1;

    await core.trySwap({ row: 2, column: 4 }, { row: 3, column: 4 });
    assert(core.collectedCounts[2] >= 3, '实际消失的普通目标色应计入收集');
    assert(!firstMatch.removed.some(function (pos) { return pos.row === 2 && pos.column === 1; }),
        '果冻挡住的普通棋子不能作为实际消除');
    assert.strictEqual(core.collectedCounts[config.SPECIAL_TYPES.H_ROCKET], undefined, '特殊棋子及其底色不能重复计入收集');
    assert.strictEqual(core.jellyGrid[2][1], 0, '果冻挡住的普通棋子只破果冻、不计收集');
    assert.strictEqual(core.specialComboCount, 0, '单枚特殊棋子触发不是特殊组合');
    assert(core.maxCascade >= 1, '有效操作应留下至少一轮连消');
    assert(result && result.win, '达到收集目标后应结束并获胜');
    assert.deepStrictEqual(result.collectedCounts, core.collectedCounts, '结算应返回收集统计快照');

    const unknown = new GameCore({ rows: 6, columns: 6, moveCount: 1, goals: [{ type: 'unknown', target: 0 }] }, {});
    unknown.checkLevelEnd();
    assert.strictEqual(unknown.ended, false, '未知目标不得自动过关');

    const combo = new GameCore({ rows: 6, columns: 6, moveCount: 8, goals: [{ type: 'score', target: 1 }] }, {});
    cleanBoard(combo);
    combo.grid[2][2] = config.SPECIAL_TYPES.COLOR_BALL;
    combo.grid[2][3] = 2;
    await combo.trySwap({ row: 2, column: 2 }, { row: 2, column: 3 });
    assert.strictEqual(combo.specialComboCount, 0, '彩球与普通棋子的交换不是两枚特殊棋子组合');

    combo.initGrid();
    cleanBoard(combo);
    combo.grid[2][2] = config.SPECIAL_TYPES.H_ROCKET;
    combo.grid[2][3] = config.SPECIAL_TYPES.V_ROCKET;
    await combo.trySwap({ row: 2, column: 2 }, { row: 2, column: 3 });
    assert.strictEqual(combo.specialComboCount, 1, '玩家直接交换两枚特殊棋子只计一次组合');

    console.log('收集目标与策略统计: ok');
})().catch(function (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
});
