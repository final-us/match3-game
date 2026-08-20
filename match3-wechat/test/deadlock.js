/**
 * 死局检测与自动重排验证
 * 用法: node test/deadlock.js
 * 死局棋盘：(r+c)%4+1，横竖都无匹配、任何交换都无解
 */

const GameCore = require('../js/core/game-core');
const levelData = require('../js/core/level');
const gridUtil = require('../js/core/grid');

(async function () {
    console.log('========== 死局检测 + 自动重排验证 ==========');
    const level = levelData.getLevel(1);
    let allOk = true;
    function assert(name, cond) {
        console.log((cond ? '✅' : '❌') + ' ' + name);
        allOk = allOk && cond;
    }

    // 构造死局棋盘（4 种棋子循环，无任何可行交换）
    const core = new GameCore(level, {});
    for (let r = 0; r < core.grid.length; r++) {
        for (let c = 0; c < core.grid[r].length; c++) {
            core.grid[r][c] = (r + c) % 4 + 1;
        }
    }

    assert('死局棋盘检测出无可行步', core.hasValidMoves() === false);

    // 自动重排
    await core.autoReshuffle();

    assert('重排后存在可行步', core.hasValidMoves() === true);

    // 重排后棋盘无初始 3 连匹配
    const matches = gridUtil.getMatches(core.grid);
    assert('重排后无初始匹配', matches.length === 0);

    // 重排不破坏障碍层（放一个果冻验证）
    const core2 = new GameCore(level, {});
    core2.jellyGrid[3][3] = 1;
    core2.iceGrid[5][5] = 1;
    for (let r = 0; r < core2.grid.length; r++) {
        for (let c = 0; c < core2.grid[r].length; c++) {
            core2.grid[r][c] = (r + c) % 4 + 1;
        }
    }
    await core2.autoReshuffle();
    assert('重排保留果冻层', core2.jellyGrid[3][3] === 1);
    assert('重排保留冰块层', core2.iceGrid[5][5] === 1);

    // 正常棋盘有可行步
    const core3 = new GameCore(level, {});
    assert('正常棋盘有可行步', core3.hasValidMoves() === true);

    console.log('========================================');
    console.log('结果: ' + (allOk ? '全部通过 ✅' : '存在失败 ❌'));
    process.exit(allOk ? 0 : 1);
})();
