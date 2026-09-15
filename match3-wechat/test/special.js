/**
 * 特殊棋子系统验证（使用固定干净棋盘，消除随机干扰）
 * 用法: node test/special.js
 * 验证：生成规则、玩家落点、完整组合矩阵、道具/交换连锁。
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
    core.grid[4][1] = 4; core.grid[4][2] = 4; core.grid[4][3] = 4; core.grid[4][4] = 4;
    report('4连横→生成横火箭', wouldGenerate(core, 101));

    // 2. 4连竖 → 竖火箭(102)
    core = new GameCore(level, {});
    makeCleanBoard(core);
    core.grid[2][3] = 4; core.grid[3][3] = 4; core.grid[4][3] = 4; core.grid[5][3] = 4;
    report('4连竖→生成竖火箭', wouldGenerate(core, 102));

    // 3. 直线5连 → 猫爪彩球(104)
    core = new GameCore(level, {});
    makeCleanBoard(core);
    core.grid[5][1] = 4; core.grid[5][2] = 4; core.grid[5][3] = 4; core.grid[5][4] = 4; core.grid[5][5] = 4;
    report('5连→生成猫爪彩球', wouldGenerate(core, config.SPECIAL_TYPES.COLOR_BALL));

    // 4. T/L → 范围炸弹，级联落在交点；玩家形成时优先移动落点。
    core = new GameCore(level, {});
    makeCleanBoard(core);
    [[3, 2], [3, 3], [3, 4], [2, 3], [4, 3]].forEach(function (p) { core.grid[p[0]][p[1]] = 4; });
    let matches = gridUtil.getMatches(core.grid, null, core.minMatchCount);
    let collected = core.collectWithSpecials(matches);
    report('T/L→交点生成范围炸弹', collected.generated.length === 1 &&
        collected.generated[0].type === config.SPECIAL_TYPES.BOMB &&
        collected.generated[0].pos.row === 3 && collected.generated[0].pos.column === 3);

    core = new GameCore(level, {});
    makeCleanBoard(core);
    core.grid[4][1] = 4; core.grid[4][2] = 4; core.grid[4][3] = 4; core.grid[4][4] = 4;
    matches = gridUtil.getMatches(core.grid, null, core.minMatchCount);
    collected = core.collectWithSpecials(matches, [{ row: 4, column: 4 }]);
    report('玩家形成特殊棋子→移动落点生成', collected.generated[0].pos.column === 4);

    // 5. 交换触发：横火箭与相邻棋子交换 → 触发炸整行
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
        firstMatch.removed.filter(function (position) { return position.row === 4; }).length === core.grid[0].length &&
        firstMatch.triggeredSpecials.some(function (item) {
            return item.row === 4 && item.column === 4 && item.type === config.SPECIAL_TYPES.H_ROCKET;
        });
    report('交换横火箭→触发炸行', triggered, '(得分+' + (core.score - before) + ')');

    // 6. 连锁触发：炸弹炸到横火箭 → 横火箭再炸整行
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
        includesPosition(firstMatch.removed, 4, 3) &&
        firstMatch.triggeredSpecials.some(function (item) { return item.type === config.SPECIAL_TYPES.BOMB; }) &&
        firstMatch.triggeredSpecials.some(function (item) { return item.type === config.SPECIAL_TYPES.H_ROCKET; });
    report('炸弹连锁火箭', chain, '(得分+' + (core.score - before2) + ', 两特殊棋均消失)');

    // 7. 火箭触发后炸到同一行的果冻格（果冻格本身不可交换）
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

    // 8. 完整组合矩阵（直接验证确定性命中范围/转换结果）。
    function comboCore() {
        const value = new GameCore(level, {});
        makeCleanBoard(value);
        return value;
    }
    function combo(firstType, secondType, firstPos, secondPos) {
        const value = comboCore();
        value.grid[firstPos.row][firstPos.column] = firstType;
        value.grid[secondPos.row][secondPos.column] = secondType;
        return { core: value, result: value.applySpecialCombo({
            first: { pos: firstPos, type: firstType },
            second: { pos: secondPos, type: secondType },
            center: secondPos
        }) };
    }
    const centerA = { row: 4, column: 3 };
    const centerB = { row: 4, column: 4 };
    let matrix = combo(config.SPECIAL_TYPES.H_ROCKET, config.SPECIAL_TYPES.V_ROCKET, centerA, centerB);
    report('火箭+火箭=十字行列', matrix.result.targets.length === 15);
    matrix = combo(config.SPECIAL_TYPES.H_ROCKET, config.SPECIAL_TYPES.BOMB, centerA, centerB);
    report('火箭+炸弹=3行+3列', matrix.result.targets.length === 39);
    matrix = combo(config.SPECIAL_TYPES.BOMB, config.SPECIAL_TYPES.BOMB, centerA, centerB);
    report('炸弹+炸弹=5x5', matrix.result.targets.length === 25);
    matrix = combo(config.SPECIAL_TYPES.COLOR_BALL, 2, centerA, centerB);
    report('彩球+普通=清除目标色', matrix.result.targets.some(function (p) {
        return matrix.core.grid[p.row][p.column] === 2;
    }));

    matrix = { core: comboCore() };
    matrix.core.grid[centerA.row][centerA.column] = config.SPECIAL_TYPES.COLOR_BALL;
    matrix.core.grid[centerB.row][centerB.column] = config.SPECIAL_TYPES.H_ROCKET;
    matrix.core.setSpecialBaseType(centerB, 2);
    matrix.result = matrix.core.applySpecialCombo({
        first: { pos: centerA, type: config.SPECIAL_TYPES.COLOR_BALL },
        second: { pos: centerB, type: config.SPECIAL_TYPES.H_ROCKET }, center: centerB
    });
    const transformedTypes = matrix.result.targets.map(function (p) { return matrix.core.grid[p.row][p.column]; });
    report('彩球+火箭=目标色转交替火箭', transformedTypes.indexOf(config.SPECIAL_TYPES.H_ROCKET) >= 0 &&
        transformedTypes.indexOf(config.SPECIAL_TYPES.V_ROCKET) >= 0);

    matrix = { core: comboCore() };
    matrix.core.grid[centerA.row][centerA.column] = config.SPECIAL_TYPES.COLOR_BALL;
    matrix.core.grid[centerB.row][centerB.column] = config.SPECIAL_TYPES.BOMB;
    matrix.core.setSpecialBaseType(centerB, 3);
    matrix.result = matrix.core.applySpecialCombo({
        first: { pos: centerA, type: config.SPECIAL_TYPES.COLOR_BALL },
        second: { pos: centerB, type: config.SPECIAL_TYPES.BOMB }, center: centerB
    });
    report('彩球+炸弹=目标色转炸弹', matrix.result.targets.some(function (p) {
        return matrix.core.grid[p.row][p.column] === config.SPECIAL_TYPES.BOMB &&
            !(p.row === centerB.row && p.column === centerB.column);
    }));
    matrix = combo(config.SPECIAL_TYPES.COLOR_BALL, config.SPECIAL_TYPES.COLOR_BALL, centerA, centerB);
    report('彩球+彩球=全屏清除', matrix.result.targets.length === core.grid.length * core.grid[0].length);

    // 回调为渲染提供明确组合元数据；不能由触发列表顺序猜测。
    firstMatch = null;
    core = new GameCore(level, { onMatch: function (data) { if (!firstMatch) firstMatch = data; } });
    makeCleanBoard(core);
    core.grid[4][3] = config.SPECIAL_TYPES.H_ROCKET;
    core.grid[4][4] = config.SPECIAL_TYPES.V_ROCKET;
    await core.trySwap({ row: 4, column: 3 }, { row: 4, column: 4 });
    report('特殊组合回调含明确渲染元数据', firstMatch && firstMatch.specialCombo &&
        firstMatch.specialCombo.first.type === config.SPECIAL_TYPES.V_ROCKET &&
        firstMatch.specialCombo.second.type === config.SPECIAL_TYPES.H_ROCKET &&
        firstMatch.specialCombo.center.row === 4 && firstMatch.specialCombo.center.column === 4);

    // 9. 锤子/炸弹命中特殊棋子必须触发特殊效果及连锁。
    firstMatch = null;
    core = new GameCore(level, { onMatch: function (data) { if (!firstMatch) firstMatch = data; } });
    makeCleanBoard(core);
    core.grid[3][3] = config.SPECIAL_TYPES.H_ROCKET;
    const hammerSuccess = await core.useTool('hammer', { row: 3, column: 3 });
    report('锤子命中特殊棋子触发整行', hammerSuccess && firstMatch &&
        firstMatch.removed.filter(function (p) { return p.row === 3; }).length === core.grid[0].length &&
        firstMatch.triggeredSpecials.some(function (item) {
            return item.row === 3 && item.column === 3 && item.type === config.SPECIAL_TYPES.H_ROCKET;
        }));

    console.log('========================================');
    if (failures > 0) process.exitCode = 1;
})();
