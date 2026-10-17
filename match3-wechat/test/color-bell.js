const assert = require('assert');
const GameCore = require('../js/core/game-core');
const config = require('../js/core/config');
const gridUtil = require('../js/core/grid');
const colorBell = require('../js/core/color-bell');
const levels = require('../js/core/level');

const bell = config.SPECIAL_TYPES.COLOR_BELL;
const from = { row: 4, column: 5 };
const to = { row: 4, column: 4 };

function fixture(extra) {
    const core = new GameCore(Object.assign({ id: 5, rows: 8, columns: 8, colorCount: 5,
        moveCount: 25, trackingPaw: true, colorBell: true, goals: [{ type: 'score', target: 999999 }] }, extra), {});
    core.grid = core.grid.map((row, rowIndex) => row.map((value, column) => (rowIndex * 2 + column) % 5 + 1));
    return core;
}

function setShape(core) {
    [[3, 2], [3, 3], [4, 3], [4, 5]].forEach(function (position) {
        core.grid[position[0]][position[1]] = 4;
    });
    core.grid[4][4] = 2;
    core.grid[5][3] = 1;
}

function capture(core) {
    const events = [];
    core.callbacks.onMatch = function (data) {
        events.push({ data: data, grid: core.grid.map(row => row.slice()), collected: Object.assign({}, core.collectedCounts) });
    };
    return events;
}

(async function () {
    let core = fixture();
    setShape(core);
    assert.strictEqual(gridUtil.getMatches(core.grid).length, 0);
    assert(core.validateMove(from, to));
    let events = capture(core);
    assert(await core.trySwap(from, to));
    assert.deepStrictEqual(events[0].data.generated, [{ pos: to, type: bell, baseType: 4 }]);
    assert.strictEqual(events[0].data.removed.length, 3);
    assert.strictEqual(events[0].data.triggeredSpecials.length, 0);
    assert.strictEqual(core.movesLeft, 24);
    assert(core.grid.some(row => row.includes(bell)));

    const variants = [
        [[0, 0], [0, 1], [1, 1], [1, 2]], [[0, 1], [0, 2], [1, 0], [1, 1]],
        [[0, 1], [1, 0], [1, 1], [2, 0]], [[0, 0], [1, 0], [1, 1], [2, 1]]
    ];
    variants.forEach(function (shape) {
        core = fixture();
        const cells = shape.map(cell => ({ row: cell[0] + 2, column: cell[1] + 2 }));
        cells.forEach(cell => { core.grid[cell.row][cell.column] = 4; });
        const destination = cells[cells.length - 1];
        const source = { row: destination.row + 1, column: destination.column };
        core.grid[destination.row][destination.column] = 2;
        core.grid[source.row][source.column] = 4;
        assert(colorBell.newShapes(core, source, destination).some(function (candidate) {
            return cells.every(cell => gridUtil.includesPosition(candidate, cell));
        }), '旋转和镜像Z形均可识别');
    });

    for (const extra of [{ colorBell: false }, {}]) {
        core = fixture(extra);
        setShape(core);
        if (extra.colorBell !== false) core.minMatchCount = 4;
        assert(!core.validateMove(from, to));
    }
    core = fixture();
    setShape(core);
    core.jellyGrid[3][2] = 1;
    assert(!core.validateMove(from, to), '锁定格不能参与配方');
    core = fixture();
    [[3, 2], [3, 3], [4, 3], [4, 4]].forEach(position => { core.grid[position[0]][position[1]] = 4; });
    core.grid[5][3] = 1;
    assert.strictEqual(colorBell.newShapes(core, { row: 3, column: 2 }, { row: 3, column: 3 }).length, 0);
    core.grid[4][5] = 2;
    assert.strictEqual(gridUtil.getMatches(core.grid).length, 0);
    events = capture(core);
    await core.processGrid();
    assert.strictEqual(events.length, 0, '自然形成或同色交换不能刷出铃铛');

    core = fixture();
    core.grid[3] = [1, 4, 4, 4, 4, 2, 3, 1];
    core.grid[4][3] = 4;
    core.grid[4][4] = 4;
    core.grid[4][5] = 2;
    core.grid[5][3] = 1;
    core.grid[2][4] = 2;
    assert.strictEqual(gridUtil.getMatches(core.grid).length, 1);
    const recipe = [[{ row: 3, column: 2 }, { row: 3, column: 3 }, { row: 4, column: 3 }, { row: 4, column: 4 }]];
    const collected = core.collectWithSpecials(gridUtil.getMatches(core.grid), [{ row: 3, column: 3 }], [], recipe);
    assert(collected.generated.some(item => item.type === config.SPECIAL_TYPES.H_ROCKET));
    assert(!collected.generated.some(item => item.type === bell), '四连仍优先合成火箭');

    core = fixture({ goals: [{ type: 'collect', pieceType: 3, target: 99 }] });
    core.grid[4][3] = bell;
    core.setSpecialBaseType({ row: 4, column: 3 }, 1);
    events = capture(core);
    await core.trySwap({ row: 4, column: 3 }, { row: 4, column: 4 });
    const trigger = events[0].data.triggeredSpecials.find(item => item.type === bell);
    assert.strictEqual(trigger.color, 3, '交换选择普通猫颜色，而非铃铛底色');
    assert.strictEqual(events[0].data.removed.length, 1, '染色不直接消除邻猫');
    assert.deepStrictEqual(events[0].collected, {}, '仅染色不增加收集计数');
    assert.strictEqual(events[0].data.colorChanges.length, 3);
    events[0].data.colorChanges.forEach(change => { assert.strictEqual(events[0].grid[change.row][change.column], 3); });
    assert.strictEqual(core.movesLeft, 24);

    core = fixture({ underlays: { '3:4': 2 }, obstacles: { '5:4': 1 } });
    core.grid[4][4] = bell;
    core.grid[4][3] = config.SPECIAL_TYPES.TRACKING_PAW;
    assert.deepStrictEqual(colorBell.dye(core, { row: 4, column: 4 }, 1, []),
        [{ row: 4, column: 5, previousType: 4, type: 1 }], '障碍和特殊棋子不能染色');

    for (const length of [3, 4, 5]) {
        core = fixture({ goals: [{ type: 'collect', pieceType: 3, target: 99 }] });
        core.grid[4][3] = bell;
        core.setSpecialBaseType({ row: 4, column: 3 }, 1);
        core.grid[3][4] = 2;
        core.grid[2][3] = 1;
        core.grid[3][1] = 2;
        const columns = length === 3 ? [3, 5] : length === 4 ? [3, 5, 6] : [2, 3, 5, 6];
        columns.forEach(column => { core.grid[3][column] = 3; });
        assert.strictEqual(gridUtil.getMatches(core.grid).length, 0);
        events = capture(core);
        let firstGravity = 0;
        core.callbacks.onGravity = function () { if (!firstGravity) firstGravity = events.length; };
        await core.trySwap({ row: 4, column: 3 }, { row: 4, column: 4 });
        assert.deepStrictEqual(events[0].collected, {});
        assert(events.length >= 2 && firstGravity >= 2, '染色后的匹配必须先于下落结算');
        if (length > 3) {
            const type = length === 4 ? config.SPECIAL_TYPES.H_ROCKET : config.SPECIAL_TYPES.COLOR_BALL;
            assert(events[1].data.generated.some(item => item.type === type), '染色可继续合成火箭或彩球');
        }
        assert.strictEqual(events[1].collected[3], length === 3 ? 3 : length - 1);
        assert.strictEqual(core.movesLeft, 24, '染色连消不额外扣步');
        assert(core.grid.every(row => row.every(type => type !== 0)), '染色前置结算后仍须补齐空格');
    }

    for (const other of [bell, config.SPECIAL_TYPES.TRACKING_PAW, config.SPECIAL_TYPES.H_ROCKET,
        config.SPECIAL_TYPES.BOMB, config.SPECIAL_TYPES.COLOR_BALL]) {
        core = fixture();
        core.grid[4][3] = bell;
        core.grid[4][4] = other;
        core.setSpecialBaseType({ row: 4, column: 3 }, 2);
        events = capture(core);
        await core.trySwap({ row: 4, column: 3 }, { row: 4, column: 4 });
        assert.strictEqual(core.specialComboCount, 1);
        assert(events[0].data.triggeredSpecials.some(item => item.type === bell));
        const positions = events[0].data.triggeredSpecials.map(item => item.row + ':' + item.column);
        assert.strictEqual(new Set(positions).size, positions.length);
        assert(core.grid.every(row => row.every(type => type !== 0)));
    }
    core = fixture();
    core.grid[4][4] = bell;
    core.setSpecialBaseType({ row: 4, column: 4 }, 2);
    events = capture(core);
    await core.useTool('hammer', { row: 4, column: 4 });
    assert.strictEqual(events[0].data.triggeredSpecials[0].color, 2, '连锁/道具触发沿用底色');
    assert.strictEqual(core.movesLeft, 25);

    assert(!levels.getLevel(2).trackingPaw && !levels.getLevel(3).colorBell);
    assert(levels.getLevel(3).trackingPaw && levels.getLevel(4).colorBell);
    assert(levels.getLevel(6).trackingPaw && levels.getLevel(1000).colorBell);
    for (const id of [3, 4]) {
        for (let attempt = 0; attempt < 20; attempt++) {
            core = new GameCore(levels.getLevel(id), {});
            const piece = core.level.initialSpecials[0];
            assert.strictEqual(core.grid[piece.row][piece.column], id === 3 ? config.SPECIAL_TYPES.TRACKING_PAW : bell);
            assert(!core.isBlocked(piece));
            assert(config.getPieceTypeDef(core.getSpecialBaseType(piece)));
            assert.strictEqual(gridUtil.getMatches(core.grid).length, 0);
        }
    }
    console.log('染色铃铛 PASS：Z形/旋转镜像/模式隔离/选择颜色/障碍保护/先染后消/火箭彩球/组合/前5关必现');
})().catch(error => { console.error(error); process.exitCode = 1; });
