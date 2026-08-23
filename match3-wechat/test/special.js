/**
 * 特殊棋子系统验证（使用固定干净棋盘，消除随机干扰）
 * 用法: node test/special.js
 * 验证：1) 4连横→横火箭 2) 4连竖→竖火箭 3) 5连→炸弹
 *       4) 交换触发（炸行） 5) 连锁触发（炸弹波及火箭）
 */

const GameCore = require('../js/core/game-core');
const levelData = require('../js/core/level');
const config = require('../js/core/config');
const gridUtil = require('../js/core/grid');

/**
 * 构造无任何横/竖 3 连的干净棋盘
 * (r+c)%3+1 周期3，横向/纵向都无同色相邻3连
 */
function makeCleanBoard(core) {
    for (let r = 0; r < core.grid.length; r++) {
        for (let c = 0; c < core.grid[r].length; c++) {
            core.grid[r][c] = (r + c) % 3 + 1;
        }
    }
}

function includesPosition(positions, row, column) {
    return positions.some(function (position) {
        return position.row === row && position.column === column;
    });
}

function wouldGenerate(core, type) {
    const matches = gridUtil.getMatches(core.grid, null, core.minMatchCount);
    return core.collectWithSpecials(matches).generated.some(function (item) {
        return item.type === type;
    });
}

(async function () {
    console.log('========== 特殊棋子系统验证 ==========');
    let failures = 0;
    function report(label, passed, detail) {
        if (!passed) failures++;
        console.log(label + ':', passed ? '✅' : '❌', detail || '');
    }
    const level = levelData.getLevel(1);

    // 1. 4连横 → 横火箭(101)
    let core = new GameCore(level, {});
    makeCleanBoard(core);
    core.grid[4][1] = 9; core.grid[4][2] = 9; core.grid[4][3] = 9; core.grid[4][4] = 9;
    report('4连横→生成横火箭', wouldGenerate(core, 101));

    // 2. 4连竖 → 竖火箭(102)
    core = new GameCore(level, {});
    makeCleanBoard(core);
    core.grid[2][3] = 8; core.grid[3][3] = 8; core.grid[4][3] = 8; core.grid[5][3] = 8;
    report('4连竖→生成竖火箭', wouldGenerate(core, 102));

    // 3. 5连 → 炸弹(103)
    core = new GameCore(level, {});
    makeCleanBoard(core);
    core.grid[5][1] = 7; core.grid[5][2] = 7; core.grid[5][3] = 7; core.grid[5][4] = 7; core.grid[5][5] = 7;
    report('5连→生成炸弹', wouldGenerate(core, 103));

    // 4. 交换触发：横火箭与相邻棋子交换 → 触发炸整行
    let firstMatch = null;
    core = new GameCore(level, {
        onMatch: function (data) { if (!firstMatch) firstMatch = data; }
    });
    makeCleanBoard(core);
    core.grid[4][3] = 101;
    const before = core.score;
    await core.trySwap({ row: 4, column: 3 }, { row: 4, column: 4 });
    const triggered = core.score > before && firstMatch &&
        includesPosition(firstMatch.removed, 4, 4) &&
        firstMatch.removed.filter(function (position) { return position.row === 4; }).length === core.grid[0].length;
    report('交换横火箭→触发炸行', triggered, '(得分+' + (core.score - before) + ')');

    // 5. 连锁触发：炸弹炸到横火箭 → 横火箭再炸整行
    firstMatch = null;
    core = new GameCore(level, {
        onMatch: function (data) { if (!firstMatch) firstMatch = data; }
    });
    makeCleanBoard(core);
    core.grid[4][4] = 103; // 炸弹
    core.grid[4][3] = 101; // 横火箭（炸弹 3x3 波及范围）
    const before2 = core.score;
    await core.trySwap({ row: 4, column: 4 }, { row: 5, column: 4 });
    const chain = core.score > before2 + 100 && firstMatch &&
        includesPosition(firstMatch.removed, 5, 4) &&
        includesPosition(firstMatch.removed, 4, 3);
    report('炸弹连锁火箭', chain, '(得分+' + (core.score - before2) + ', 两特殊棋均消失)');

    // 6. 火箭触发后炸到同一行的果冻格（果冻格本身不可交换）
    firstMatch = null;
    core = new GameCore(level, {
        onMatch: function (data) { if (!firstMatch) firstMatch = data; }
    });
    makeCleanBoard(core);
    core.jellyGrid[4][5] = 1; // 手动在火箭同一行放果冻
    core.grid[4][3] = 101;    // 横火箭在 (4,3)
    await core.trySwap({ row: 4, column: 3 }, { row: 4, column: 2 });
    const consumed = firstMatch && includesPosition(firstMatch.removed, 4, 2);
    const jellyBroken = core.jellyGrid[4][5] === 0;
    report('特殊棋子触发消耗+炸掉果冻', consumed && jellyBroken,
        '(火箭消失=' + consumed + ', 果冻破=' + jellyBroken + ')');

    console.log('========================================');
    if (failures > 0) process.exitCode = 1;
})();
