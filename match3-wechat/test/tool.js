/**
 * 局外道具使用验证（固定干净棋盘）
 * 用法: node test/tool.js
 * 验证：成功布尔值、无效不生效、特殊连锁、智能换色与不消耗步数。
 */

const GameCore = require('../js/core/game-core');
const levelData = require('../js/core/level');
const config = require('../js/core/config');
const BoardRenderer = require('../js/render/board-render');

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

    // 1. 锤子成功返回 true，消除单格并且不消耗步数。
    let core = new GameCore(level, {});
    makeCleanBoard(core);
    const stepsBefore = core.movesLeft;
    const scoreBefore = core.score;
    const hammerSuccess = await core.useTool('hammer', { row: 3, column: 3 });
    let emptyCount = 0;
    for (let r = 0; r < core.grid.length; r++)
        for (let c = 0; c < core.grid[r].length; c++)
            if (core.grid[r][c] === 0) emptyCount++;
    assert('锤子成功返回 true', hammerSuccess === true);
    assert('锤子消除有计分', core.score > scoreBefore);
    assert('锤子后无空洞(已补位)', emptyCount === 0);
    assert('锤子不消耗步数', core.movesLeft === stepsBefore);

    // 2. 炸弹：3x3 消除
    core = new GameCore(level, {});
    makeCleanBoard(core);
    const bombSuccess = await core.useTool('bomb', { row: 4, column: 4 });
    const bombArea = [];
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
            bombArea.push(core.grid[4 + dr][4 + dc]);
    // 3x3 中心区域消除后会被下落填充，得分应增加
    assert('炸弹成功并增加得分', bombSuccess === true && core.score > 0);

    // 3. 智能换色：只选不同颜色，制造最大即时匹配，稳定按普通类型顺序破并列。
    let changedType = 0;
    core = new GameCore(level, {
        onColorChange: function (data) { changedType = data.type; }
    });
    makeCleanBoard(core);
    core.grid[3][1] = 2;
    core.grid[3][2] = 2;
    core.grid[3][3] = 1;
    const colorSuccess = await core.useTool('color', { row: 3, column: 3 });
    assert('智能换色成功返回 true', colorSuccess === true);
    assert('智能换色确定性选择最大即时匹配颜色', changedType === 2);

    // 4. 越界、阻挡格、未知道具、无法产生消除的换色均返回 false。
    core = new GameCore(level, {});
    makeCleanBoard(core);
    core.iceGrid[5][5] = 1;
    assert('阻挡格拒绝且不破坏冰块', await core.useTool('hammer', { row: 5, column: 5 }) === false &&
        core.iceGrid[5][5] === 1);
    assert('越界点击拒绝', await core.useTool('hammer', { row: 8, column: 0 }) === false);
    assert('未知道具拒绝', await core.useTool('unknown', { row: 4, column: 4 }) === false);

    core = new GameCore(level, {});
    for (let r = 0; r < core.grid.length; r++) {
        for (let c = 0; c < core.grid[r].length; c++) core.grid[r][c] = (r + c) % 4 + 1;
    }
    assert('无法制造即时匹配时换色拒绝', await core.useTool('color', { row: 3, column: 3 }) === false);
    core.grid[3][3] = config.SPECIAL_TYPES.BOMB;
    assert('换色不得作用于特殊棋子', await core.useTool('color', { row: 3, column: 3 }) === false);

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
    core.grid[4][2] = 2;
    core.grid[4][3] = 2;
    core.grid[4][4] = 1;
    assert('成功换色使用后无空洞', await core.useTool('color', { row: 4, column: 4 }) === true && countEmpty(core) === 0);

    // 6. 渲染层必须 await 成功结果后才通知库存扣减。
    let consumed = 0;
    const board = new BoardRenderer({}, { width: 100, height: 100 });
    board.boardX = 0; board.boardY = 0; board.boardW = 80; board.boardH = 80; board.tileSize = 10;
    board.core = { isPlaying: function () { return true; }, useTool: function () { return Promise.resolve(false); } };
    board.selectedTool = 'hammer';
    board.onToolUsed = function () { consumed++; };
    board.onTouchStart(5, 5);
    await Promise.resolve();
    await Promise.resolve();
    assert('失败道具不通知库存扣减', consumed === 0);
    board.core.useTool = function () { return Promise.resolve(true); };
    board.setTools({ hammer: 1, bomb: 0, color: 0 });
    board.selectedTool = 'hammer';
    board.onTouchStart(5, 5);
    await Promise.resolve();
    await Promise.resolve();
    assert('成功道具才通知库存扣减', consumed === 1);

    // 7. 动画期间残留选中态也必须重新校验当前库存，不能免费再用一次。
    let coreCalls = 0;
    board.core.useTool = function () { coreCalls++; return Promise.resolve(true); };
    board.setTools({ hammer: 0, bomb: 0, color: 0 });
    board.selectedTool = 'hammer';
    board.onTouchStart(5, 5);
    await Promise.resolve();
    assert('库存归零后的残留选中态不能调用核心道具', coreCalls === 0 && consumed === 1);

    console.log('========================================');
    console.log('道具系统: ' + (allOk ? '全部通过 ✅' : '存在失败 ❌'));
    process.exit(allOk ? 0 : 1);
})();
