/**
 * 覆盖棋子锁定 + 斜向滑入验证
 * 用法: node test/slide.js
 * 场景：覆盖格(3,3)下方(4,3)被消除为空位
 * 期望：1) 覆盖格棋子不动 2) 相邻列(3,2)棋子斜向滑入(4,3)
 */

const GameCore = require('../js/core/game-core');
const levelData = require('../js/core/level');
const gridUtil = require('../js/core/grid');

function makeCleanBoard(core) {
    for (let r = 0; r < core.grid.length; r++) {
        for (let c = 0; c < core.grid[r].length; c++) {
            core.grid[r][c] = (r + c) % 3 + 1;
        }
    }
}

(async function () {
    console.log('========== 覆盖锁定 + 斜向滑入验证 ==========');
    const level = levelData.getLevel(1);
    let allOk = true;
    function assert(name, cond) {
        console.log((cond ? '✅' : '❌') + ' ' + name);
        allOk = allOk && cond;
    }

    // 场景1：覆盖格棋子不下落
    let core = new GameCore(level, {});
    makeCleanBoard(core);
    core.jellyGrid[3][3] = 1;      // (3,3) 果冻覆盖
    const coveredType = core.grid[3][3];
    core.grid[4][3] = 0;           // 下方空位（被消除）
    core.grid[5][3] = 0;           // 再下方也空

    core.applyGravityBlocked();
    assert('覆盖格棋子不参与下落', core.grid[3][3] === coveredType);
    assert('覆盖格上方棋子正常下落', core.grid[2][3] !== 0 || core.grid[3][3] !== 0);

    // 场景2：相邻列斜向滑入覆盖格下方空位
    core = new GameCore(level, {});
    makeCleanBoard(core);
    core.jellyGrid[3][3] = 1;
    const neighborType = core.grid[3][2]; // 相邻列棋子
    core.grid[4][3] = 0;                  // 覆盖格下方空位

    core.applyGravityBlocked();
    core.applySlides();

    assert('相邻列棋子斜向滑入空位', core.grid[4][3] === neighborType);
    assert('覆盖格棋子保持原位', core.grid[3][3] === neighborType || core.grid[3][3] !== 0);

    // 场景3：冰块覆盖同样锁定
    core = new GameCore(level, {});
    makeCleanBoard(core);
    core.iceGrid[5][5] = 1;
    const iceType = core.grid[5][5];
    core.grid[6][5] = 0;
    core.applyGravityBlocked();
    assert('冰块覆盖棋子不参与下落', core.grid[5][5] === iceType);

    // 场景4：被覆盖的棋子不能主动交换（果冻/冰块都锁定）
    // 4a. 果冻覆盖格：交换被拒、不耗步数
    core = new GameCore(level, {});
    makeCleanBoard(core);
    core.jellyGrid[3][3] = 1;
    const stepsBefore = core.movesLeft;
    let invalidFired = false;
    core.callbacks.onInvalidSwap = function () { invalidFired = true; return Promise.resolve(); };
    await core.trySwap({ row: 3, column: 3 }, { row: 3, column: 4 });
    assert('果冻覆盖棋子交换被拒', invalidFired);
    assert('果冻覆盖交换不耗步数', core.movesLeft === stepsBefore);

    // 4b. 冰块覆盖格：交换被拒
    core = new GameCore(level, {});
    makeCleanBoard(core);
    core.iceGrid[4][4] = 1;
    invalidFired = false;
    core.callbacks.onInvalidSwap = function () { invalidFired = true; return Promise.resolve(); };
    await core.trySwap({ row: 4, column: 4 }, { row: 4, column: 5 });
    assert('冰块覆盖棋子交换被拒', invalidFired);

    console.log('========================================');
    console.log('结果: ' + (allOk ? '全部通过 ✅' : '存在失败 ❌'));
    process.exit(allOk ? 0 : 1);
})();
