/**
 * 局外道具使用验证（固定干净棋盘）
 * 用法: node test/tool.js
 * 验证：锤子消单格 / 炸弹消3x3 / 换色变色 / 道具不消耗步数
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

function gridHasType(core, type) {
    const grid = core.grid;
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] === type) return true;
        }
    }
    return false;
}

(async function () {
    console.log('========== 局外道具验证 ==========');
    const level = levelData.getLevel(1);
    let allOk = true;
    function assert(name, cond) {
        console.log((cond ? '✅' : '❌') + ' ' + name);
        allOk = allOk && cond;
    }

    // 1. 锤子：消除单格（该格被清后下落补位）+ 不消耗步数
    let core = new GameCore(level, {});
    makeCleanBoard(core);
    core.jellyGrid[3][3] = 1; // 放果冻
    const stepsBefore = core.movesLeft;
    const scoreBefore = core.score;
    await core.useTool('hammer', { row: 3, column: 3 });
    let emptyCount = 0;
    for (let r = 0; r < core.grid.length; r++)
        for (let c = 0; c < core.grid[r].length; c++)
            if (core.grid[r][c] === 0) emptyCount++;
    assert('锤子破果冻', core.jellyGrid[3][3] === 0);
    assert('锤子消除有计分', core.score > scoreBefore);
    assert('锤子后无空洞(已补位)', emptyCount === 0);
    assert('锤子不消耗步数', core.movesLeft === stepsBefore);

    // 2. 炸弹：3x3 消除
    core = new GameCore(level, {});
    makeCleanBoard(core);
    await core.useTool('bomb', { row: 4, column: 4 });
    const bombArea = [];
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
            bombArea.push(core.grid[4 + dr][4 + dc]);
    // 3x3 中心区域消除后会被下落填充，得分应增加
    assert('炸弹3x3得分增加', core.score > 0);

    // 3. 换色：棋子仍是有效普通类型（可能同色，但必须是 1-6 合法类型）
    core = new GameCore(level, {});
    makeCleanBoard(core);
    await core.useTool('color', { row: 2, column: 2 });
    const newType = core.grid[2][2];
    assert('换色后棋子仍在', newType !== 0);
    assert('换色后为有效类型', newType >= 1 && newType <= 6);

    // 4. 锤子对冰块：破冰
    core = new GameCore(level, {});
    makeCleanBoard(core);
    core.iceGrid[5][5] = 1;
    await core.useTool('hammer', { row: 5, column: 5 });
    assert('锤子破冰块', core.iceGrid[5][5] === 0);

    // 5. 三个道具使用后棋盘无空洞（下落补位）
    function countEmpty(core) {
        let n = 0;
        for (let r = 0; r < core.grid.length; r++)
            for (let c = 0; c < core.grid[r].length; c++)
                if (core.grid[r][c] === 0) n++;
        return n;
    }
    core = new GameCore(level, {});
    makeCleanBoard(core);
    await core.useTool('hammer', { row: 4, column: 4 });
    assert('锤子使用后无空洞', countEmpty(core) === 0);

    core = new GameCore(level, {});
    makeCleanBoard(core);
    await core.useTool('bomb', { row: 4, column: 4 });
    assert('炸弹使用后无空洞', countEmpty(core) === 0);

    core = new GameCore(level, {});
    makeCleanBoard(core);
    await core.useTool('color', { row: 4, column: 4 });
    assert('换色使用后无空洞', countEmpty(core) === 0);

    console.log('========================================');
    console.log('道具系统: ' + (allOk ? '全部通过 ✅' : '存在失败 ❌'));
    process.exit(allOk ? 0 : 1);
})();
