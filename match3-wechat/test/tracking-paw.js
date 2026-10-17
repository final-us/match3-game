const assert = require('assert');
const GameCore = require('../js/core/game-core');
const config = require('../js/core/config');
const gridUtil = require('../js/core/grid');
const trackingPaw = require('../js/core/tracking-paw');
const levels = require('../js/core/level');

const paw = config.SPECIAL_TYPES.TRACKING_PAW;
const from = { row: 4, column: 4 };
const to = { row: 4, column: 3 };

function fixture(extra) {
    const core = new GameCore(Object.assign({ id: 16, rows: 8, columns: 8, colorCount: 5,
        moveCount: 25, trackingPaw: true, goals: [{ type: 'score', target: 999999 }] }, extra), {});
    core.grid = core.grid.map((row, rowIndex) => row.map((value, column) => (rowIndex * 2 + column) % 5 + 1));
    return core;
}

function setSquare(core) {
    [[3, 2], [3, 3], [4, 2], [4, 4]].forEach(function (position) {
        core.grid[position[0]][position[1]] = 4;
    });
    core.grid[4][3] = 2;
    core.grid[5][3] = 1;
}

function contains(positions, row, column) {
    return positions.some(function (position) { return position.row === row && position.column === column; });
}

function capture(core) {
    const events = [];
    core.callbacks.onMatch = function (data) {
        events.push({ data: data, jelly: core.jellyGrid.map(row => row.slice()), grid: core.grid.map(row => row.slice()),
            yarnHealth: core.getYarnHealth(), collected: Object.assign({}, core.collectedCounts) });
    };
    return events;
}

(async function () {
    let core = fixture();
    setSquare(core);
    assert.strictEqual(gridUtil.getMatches(core.grid).length, 0);
    assert(core.validateMove(from, to), '只形成方块的交换也必须有效');
    let events = capture(core);
    assert(await core.trySwap(from, to));
    assert.strictEqual(core.movesLeft, 24);
    assert.deepStrictEqual(events[0].data.generated, [{ pos: to, type: paw, baseType: 4 }]);
    assert.strictEqual(events[0].data.removed.length, 3);
    assert(core.grid.some(row => row.includes(paw)), '合成后保留，且随重力移动');
    assert.strictEqual(events[0].data.triggeredSpecials.length, 0, '合成时不能立即发动');

    core = fixture({ trackingPaw: false });
    setSquare(core);
    assert(!core.validateMove(from, to), '未开放的模式不能识别方块');
    core = fixture();
    setSquare(core);
    core.minMatchCount = 4;
    assert(!core.validateMove(from, to), '干扰期间不以方块绕过最小匹配数');

    core = fixture();
    [[3, 2], [3, 3], [4, 2], [4, 3]].forEach(position => { core.grid[position[0]][position[1]] = 4; });
    core.grid[4][4] = 1;
    core.grid[5][3] = 1;
    assert.strictEqual(trackingPaw.newSquares(core, { row: 3, column: 2 }, { row: 3, column: 3 }).length, 0,
        '已有方块不能通过同色交换刷出猫爪');
    events = capture(core);
    await core.processGrid();
    assert.strictEqual(events.length, 0, '自然补棋形成方块不自动合成');

    core = fixture();
    setSquare(core);
    core.jellyGrid[3][2] = 1;
    assert(!core.validateMove(from, to), '方块不能使用锁定格');
    core = fixture();
    core.grid[3] = [1, 4, 4, 4, 4, 2, 3, 1];
    core.grid[4][2] = 4;
    core.grid[4][3] = 4;
    core.grid[5][3] = 1;
    const collected = core.collectWithSpecials(gridUtil.getMatches(core.grid), [{ row: 3, column: 3 }],
        [[{ row: 3, column: 2 }, { row: 3, column: 3 }, { row: 4, column: 2 }, { row: 4, column: 3 }]]);
    assert(collected.generated.some(item => item.type === config.SPECIAL_TYPES.H_ROCKET));
    assert(!collected.generated.some(item => item.type === paw), '重叠四连保留现有优先级');

    for (const layers of [1, 2]) {
        core = fixture({ underlays: { '1:6': layers }, goals: [{ type: 'jelly', target: 1 }] });
        core.callbacks.onFill = function (data) {
            data.filled.forEach(function (position) {
                core.grid[position.row][position.column] = (position.row * 2 + position.column) % 5 + 1;
            });
            assert.strictEqual(gridUtil.getMatches(core.grid).length, 0, '固定补棋不能产生额外自然匹配');
        };
        const cat = core.grid[1][6];
        for (let hit = 1; hit <= layers; hit++) {
            core.grid = core.grid.map((row, rowIndex) => row.map((value, column) => (rowIndex * 2 + column) % 5 + 1));
            core.grid[4][3] = paw;
            assert.strictEqual(core.jellyGrid[1][6], layers - hit + 1, '第二次命中必须沿用第一次的剩余层数');
            assert.strictEqual(core.grid[1][6], cat);
            assert.strictEqual(gridUtil.getMatches(core.grid).length, 0, '命中前没有自然匹配');
            const swapped = gridUtil.cloneGrid(core.grid);
            gridUtil.swapTypeInGrid(swapped, { row: 4, column: 3 }, { row: 4, column: 4 });
            assert.strictEqual(gridUtil.getMatches(swapped).length, 0, '交换本身不能附带自然匹配');
            events = capture(core);
            const moves = core.movesLeft;
            assert(await core.trySwap({ row: 4, column: 3 }, { row: 4, column: 4 }));
            assert.strictEqual(events.length, 1, '每次操作只有猫爪命中的第一轮');
            const first = events[0];
            const trigger = first.data.triggeredSpecials.find(item => item.type === paw);
            assert.deepStrictEqual(trigger.target, { row: 1, column: 6 });
            assert.strictEqual(trigger.targetJelly, layers - hit + 1, '命中数据保留原果冻层数');
            assert.deepStrictEqual(first.data.jellyHits, [{ row: 1, column: 6 }]);
            [[4, 4], [3, 4], [5, 4], [4, 3], [4, 5]].forEach(position => {
                assert(contains(first.data.removed, position[0], position[1]));
            });
            assert.strictEqual(first.data.removed.length, 5, '实际消除只包含猫爪十字');
            assert.strictEqual(first.jelly[1][6], layers - hit, '第一轮远程命中只扣一层果冻');
            assert.strictEqual(core.jellyGrid[1][6], layers - hit, '操作结束后的果冻层数与第一轮一致');
            assert.strictEqual(core.getJellyLeft(), layers - hit);
            assert(!contains(first.data.removed, 1, 6), '破层不计为普通猫消除');
            assert.strictEqual(first.grid[1][6], cat, '第一轮破层保留普通猫');
            assert.strictEqual(core.grid[1][6], cat, '完整操作后普通猫仍保留');
            assert.strictEqual(core.movesLeft, moves - 1, '远程破层不额外扣步');
            assert.strictEqual(core.ended, hit === layers, '尚有一层果冻不能误判整格清除并结束');
            assert.strictEqual(core.won, hit === layers, '果冻目标仅在最后一层清除后完成');
        }
    }

    core = fixture({ yarn: { source: '1:6', health: 3, spreadEvery: 2, maxVines: 3 } });
    core.grid[4][3] = paw;
    events = capture(core);
    await core.trySwap({ row: 4, column: 3 }, { row: 4, column: 4 });
    assert.strictEqual(events[0].yarnHealth, 2, '毛线源头只扣一格耐久');
    assert.deepStrictEqual(events[0].data.triggeredSpecials[0].target, { row: 1, column: 6 });

    core = fixture({ goals: [{ type: 'collect', pieceType: 5, target: 20 }] });
    core.grid[4][4] = paw;
    let removed = [{ row: 4, column: 4 }];
    let triggers = core.expandSpecialTriggers(removed, []);
    assert.strictEqual(core.grid[triggers[0].target.row][triggers[0].target.column], 5);
    core.collectedCounts[5] = 20;
    core.grid[0][0] = config.SPECIAL_TYPES.H_ROCKET;
    removed = [{ row: 4, column: 4 }];
    triggers = core.expandSpecialTriggers(removed, []);
    assert.deepStrictEqual(triggers[0].target, { row: 0, column: 0 });
    assert(triggers.some(item => item.type === config.SPECIAL_TYPES.H_ROCKET), '无障碍时可追踪特殊棋子并连锁');

    core = fixture();
    core.grid[0][0] = paw;
    removed = [{ row: 0, column: 0 }];
    triggers = core.expandSpecialTriggers(removed, []);
    assert.strictEqual(removed.length, 4, '边缘十字裁切为三格，再命中一个远处普通猫');
    assert.deepStrictEqual(triggers[0].target, { row: 7, column: 7 });

    for (const other of [paw, config.SPECIAL_TYPES.H_ROCKET, config.SPECIAL_TYPES.BOMB, config.SPECIAL_TYPES.COLOR_BALL]) {
        core = fixture();
        core.grid[4][3] = paw;
        core.grid[4][4] = other;
        core.setSpecialBaseType({ row: 4, column: 3 }, 3);
        events = capture(core);
        await core.trySwap({ row: 4, column: 3 }, { row: 4, column: 4 });
        assert.strictEqual(core.specialComboCount, 1);
        assert(events[0].data.triggeredSpecials.some(item => item.type === paw));
        const keys = events[0].data.triggeredSpecials.map(item => item.row + ':' + item.column);
        assert.strictEqual(new Set(keys).size, keys.length, '组合及连锁不重复触发同一棋子');
    }

    core = fixture();
    core.grid[4][4] = paw;
    events = capture(core);
    await core.useTool('hammer', { row: 4, column: 4 });
    assert(events[0].data.triggeredSpecials.some(item => item.type === paw));
    assert.strictEqual(core.movesLeft, 25, '道具连锁不额外扣步');
    assert(!levels.getLevel(2).trackingPaw);
    assert(levels.getLevel(3).trackingPaw && levels.getLevel(100).trackingPaw);
    console.log('追踪猫爪 PASS：合成/优先级/旧方块/模式隔离/目标选择/破层/边缘/组合/道具连锁');
})().catch(error => { console.error(error); process.exitCode = 1; });
