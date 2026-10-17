'use strict';

const assert = require('assert');
const GameCore = require('../js/core/game-core');
const gridUtil = require('../js/core/grid');
const levelData = require('../js/core/level');
const strategyFeedback = require('../js/core/strategy-feedback');
const config = require('../js/core/config');

const pos = (row, column) => ({ row, column });
const key = p => p.row + ':' + p.column;
function seededRandom(seed) {
    return function () {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 0x100000000;
    };
}
const stable = () => Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 8 }, (_, c) => (r * 2 + c) % 5 + 1));

// Synthetic mechanism fixture, independent of the content recipe book. Real Core
// removal, gravity, refill, cascades and deadlock recovery run with a local RNG.
function fixture(callbacks = {}, source = '7:7') {
    const core = new GameCore({ rows: 8, columns: 8, colorCount: 5, moveCount: 30,
        goals: [{ type: 'yarn', target: 3 }], underlays: {}, obstacles: {},
        yarn: { source, health: 3, spreadEvery: 2, maxVines: 3 }
    }, callbacks, seededRandom(12345));
    core.grid = stable();
    return core;
}
function prepareSwap(core) {
    // Match at the top left, away from the bottom-right source/vines. Reset only
    // the ordinary board between isolated actions; yarn state is carried forward.
    core.grid = stable();
    core.grid[0][0] = 1;
    core.grid[0][1] = 1;
    core.grid[0][2] = 2;
    core.grid[1][2] = 1;
    assert.strictEqual(gridUtil.getMatches(core.grid).length, 0);
    assert(core.validateMove(pos(1, 2), pos(0, 2)));
    return [pos(1, 2), pos(0, 2)];
}
function assertYarnContract(level) {
    assert.deepStrictEqual(level.goals.filter(goal => goal.type === 'yarn'), [{ type: 'yarn', target: 3 }]);
    assert.strictEqual(level.yarn.health, 3);
    assert.strictEqual(level.yarn.spreadEvery, 2);
    assert.strictEqual(level.yarn.maxVines, 3);
    assert(/^\d:[0-7]$/.test(level.yarn.source));
    const [row, column] = level.yarn.source.split(':').map(Number);
    assert(row >= 0 && row < level.rows && column < level.columns);
    assert(!level.underlays[level.yarn.source] && !level.obstacles[level.yarn.source]);
}
function completeOtherGoals(core) {
    for (const goal of core.level.goals) {
        if (goal.type === 'collect') core.collectedCounts[goal.pieceType] = goal.target;
        else if (goal.type === 'jelly') core.jellyGrid.forEach(row => row.fill(0));
        else if (goal.type === 'ice') core.iceGrid.forEach(row => row.fill(0));
        else assert.strictEqual(goal.type, 'yarn', '毛线内容样本仅允许当前约定的收集/果冻/冰块组合');
    }
}

(async function () {
    // Real content: level 8 is the sole yarn tutorial; later IDs are recipes,
    // not a fixed ten-level yarn schedule (docs/content-update-1235.md, top).
    const tutorial = levelData.getLevel(8);
    assertYarnContract(tutorial);
    assert.deepStrictEqual(tutorial.goals, [{ type: 'yarn', target: 3 }]);
    assert.deepStrictEqual(tutorial.underlays, {});
    assert.deepStrictEqual(tutorial.obstacles, {});
    assert.strictEqual((tutorial.moonbuds || []).length, 0);
    assert.strictEqual((tutorial.parcels || []).length, 0);
    for (let id = 1; id <= 10; id++) {
        if (id !== 8) assert.strictEqual(levelData.getLevel(id).yarn, null, '前十关仅8关教学毛线：' + id);
    }

    // Bounded current-content sample: discover yarn-bearing recipes in 11–130,
    // validate every such recipe, and require all three approved combinations.
    const combinations = new Set();
    let mixedCount = 0;
    for (let id = 11; id <= 130; id++) {
        const level = levelData.getLevel(id);
        if (!level.yarn) {
            assert(!level.goals.some(goal => goal.type === 'yarn'), '无源头不能声明毛线目标：' + id);
            continue;
        }
        mixedCount++;
        assertYarnContract(level);
        assert(level.goals.length >= 2 && level.goals.length <= 3);
        const combination = level.goals.map(goal => goal.type).sort().join('+');
        assert(['collect+yarn', 'jelly+yarn', 'ice+jelly+yarn'].includes(combination), combination);
        combinations.add(combination);
        // Check both directions of the conjunction. These are synthetic goal
        // completion states on real configurations, not natural-play evidence.
        const otherDone = new GameCore(level, {}, seededRandom(id));
        completeOtherGoals(otherDone);
        otherDone.checkLevelEnd();
        assert.strictEqual(otherDone.ended, false, '其他目标不能绕过源头：' + id);
        otherDone.yarnSource.health = 0;
        otherDone.checkLevelEnd();
        assert.strictEqual(otherDone.won, true, '全部目标完成应获胜：' + id);
        for (const remaining of level.goals.filter(goal => goal.type !== 'yarn')) {
            const yarnDone = new GameCore(level, {}, seededRandom(id));
            completeOtherGoals(yarnDone);
            yarnDone.yarnSource.health = 0;
            if (remaining.type === 'collect') yarnDone.collectedCounts[remaining.pieceType] = remaining.target - 1;
            if (remaining.type === 'jelly') {
                const [r, c] = Object.keys(level.underlays)[0].split(':').map(Number);
                yarnDone.jellyGrid[r][c] = 1;
            }
            if (remaining.type === 'ice') {
                const [r, c] = Object.keys(level.obstacles)[0].split(':').map(Number);
                yarnDone.iceGrid[r][c] = 1;
            }
            yarnDone.checkLevelEnd();
            assert.strictEqual(yarnDone.ended, false, '破源头不能绕过' + remaining.type + '：' + id);
        }
    }
    assert(mixedCount > 0, '有界样本必须包含毛线组合');
    assert.deepStrictEqual([...combinations].sort(), ['collect+yarn', 'ice+jelly+yarn', 'jelly+yarn']);

    const progress = {
        unlockedLevel: 101, stars: { 16: 3, 30: 2 }, failures: { 16: 4, 30: 4, 31: 4 },
        contentRevisions: { 16: 'curated-v6-five-colors', 30: 'infinite-v5-progressive-colors', 31: 'infinite-v5-progressive-colors' }
    };
    assert(strategyFeedback.syncContentRevision(progress, levelData.getLevel(16)));
    assert(strategyFeedback.syncContentRevision(progress, levelData.getLevel(30)));
    assert.strictEqual(progress.failures[16], undefined);
    assert.strictEqual(progress.failures[30], undefined);
    assert.strictEqual(progress.failures[31], 4);
    assert.deepStrictEqual(progress.stars, { 16: 3, 30: 2 });
    assert.strictEqual(progress.unlockedLevel, 101);

    const goalCore = new GameCore(tutorial, {}, seededRandom(8));
    goalCore.score = 99999;
    goalCore.checkLevelEnd();
    assert.strictEqual(goalCore.ended, false, '高分不能替代破源头');
    goalCore.yarnSource.health = 0;
    goalCore.checkLevelEnd();
    assert.strictEqual(goalCore.won, true, '毛线教学不附加分数任务');

    const spreads = [];
    const core = fixture({ onYarnSpread: p => spreads.push(p) });
    const originalCat = core.grid[7][7];
    for (let turn = 1; turn <= 6; turn++) {
        const move = prepareSwap(core);
        const before = core.grid.map(row => row.slice());
        const moves = core.movesLeft;
        // Covered source and an ordinary adjacent swap producing no match.
        for (const invalid of [[pos(7, 7), pos(7, 6)], [pos(4, 0), pos(4, 1)]]) {
            assert.strictEqual(await core.trySwap(...invalid), false);
            assert.strictEqual(core.yarnTurns, turn - 1, '无效交换不计数');
            assert.strictEqual(core.movesLeft, moves);
            assert.deepStrictEqual(core.grid, before);
        }
        assert.strictEqual(await core.trySwap(...move), true);
        assert.strictEqual(core.yarnTurns, turn);
        assert.strictEqual(core.movesLeft, moves - 1);
        assert.strictEqual(spreads.length, Math.floor(turn / 2), '每两次有效交换才蔓延一次');
        assert.strictEqual(Object.keys(core.yarnVines).length, Math.floor(turn / 2));
        assert.strictEqual(core.getYarnHealth(), 3, '远端匹配不命中源头');
        assert.strictEqual(core.grid[7][7], originalCat, '源头猫咪不随重力移动');
        assert(core.hasValidMoves(), '蔓延不得封死交换');
    }
    assert.strictEqual(core.spreadYarn(), null, '已有三藤不能再蔓延');
    assert.strictEqual(Object.keys(core.yarnVines).length, 3);

    // Only a direct hit unlocks a vine; adjacent clearing leaves it in place.
    let vineHit = false;
    const vineCore = fixture({ onMatch: event => {
        if (!event.yarnVineHits.some(p => key(p) === '6:7')) return;
        vineHit = true;
        assert(!event.removed.some(p => key(p) === '6:7'));
        assert.strictEqual(vineCore.grid[6][7], vineCat, '解缠动画前原猫仍在');
    } });
    vineCore.yarnVines['6:7'] = true;
    const vineCat = vineCore.grid[6][7];
    assert.strictEqual(await vineCore.useTool('hammer', pos(6, 6)), true);
    assert.strictEqual(vineHit, false);
    assert.strictEqual(vineCore.yarnVines['6:7'], true);
    assert.strictEqual(await vineCore.useTool('bomb', pos(5, 6)), true);
    assert(vineHit);
    assert.strictEqual(vineCore.yarnVines['6:7'], undefined);
    assert.strictEqual(vineCore.yarnTurns, 0);
    assert.strictEqual(vineCore.movesLeft, 30);

    let matchedVine = false;
    const matchedCore = fixture({ onMatch: event => {
        if (!event.yarnVineHits.some(p => key(p) === '0:0')) return;
        matchedVine = true;
        assert(!event.removed.some(p => key(p) === '0:0'), 'matching removes vine layer, retaining its cat');
        assert.strictEqual(matchedCore.grid[0][0], 1);
    } });
    const matchedMove = prepareSwap(matchedCore);
    matchedCore.yarnVines['0:0'] = true;
    assert.strictEqual(await matchedCore.trySwap(...matchedMove), true);
    assert(matchedVine, 'ordinary match directly clears the vine');

    // Three separate operations, even when multiple neighboring cells are hit.
    let rootHits = 0;
    const hitCore = fixture({ onMatch: event => { if (event.yarnRootHit) rootHits++; } }, '3:3');
    hitCore.yarnVines['7:7'] = true;
    for (let hit = 1; hit <= 3; hit++) {
        assert.strictEqual(await hitCore.useTool('bomb', pos(3, 2)), true);
        assert.strictEqual(hitCore.getYarnHealth(), 3 - hit);
        assert.strictEqual(rootHits, hit, '每个操作至多一击源头');
        assert.strictEqual(hitCore.yarnTurns, 0, '道具不推进蔓延');
        assert.strictEqual(hitCore.movesLeft, 30, '道具不扣步');
        assert.strictEqual(hitCore.won, hit === 3);
    }
    assert.deepStrictEqual(hitCore.yarnVines, {}, '破源头清空全部藤');
    assert.strictEqual(hitCore.spreadYarn(), null, '破源头后不再蔓延');

    const colorCore = fixture();
    prepareSwap(colorCore);
    assert.strictEqual(await colorCore.useTool('color', pos(0, 2)), true);
    assert.strictEqual(colorCore.yarnTurns, 0, '换色消除也不推进蔓延');
    assert.strictEqual(colorCore.movesLeft, 30);

    let rockets = 0;
    let rocketHits = 0;
    const specialCore = fixture({ onMatch: event => {
        rockets += event.triggeredSpecials.filter(piece => piece.type === config.SPECIAL_TYPES.H_ROCKET).length;
        if (event.yarnRootHit) rocketHits++;
    } }, '3:3');
    specialCore.grid[3][0] = config.SPECIAL_TYPES.H_ROCKET;
    specialCore.grid[3][6] = config.SPECIAL_TYPES.H_ROCKET;
    assert.strictEqual(await specialCore.trySwap(pos(3, 0), pos(3, 1)), true);
    assert(rockets >= 2, '必须实际触发连锁火箭');
    assert.strictEqual(rocketHits, 1, '火箭直击/邻击与连锁同操作只伤一次');
    assert.strictEqual(specialCore.getYarnHealth(), 2);
    assert.strictEqual(specialCore.yarnTurns, 1);

    let reshuffles = 0;
    const deadCore = fixture({ onReshuffle: () => { reshuffles++; } });
    deadCore.yarnVines['6:7'] = true;
    const rootCat = deadCore.grid[7][7], heldCat = deadCore.grid[6][7];
    assert.strictEqual(gridUtil.getMatches(deadCore.grid).length, 0);
    assert.strictEqual(deadCore.hasValidMoves(), false, '合成起点是真死局');
    await deadCore.processGrid();
    assert.strictEqual(reshuffles, 1, '结算应自动触发重排');
    assert(deadCore.hasValidMoves());
    assert.strictEqual(gridUtil.getMatches(deadCore.grid).length, 0);
    assert.strictEqual(deadCore.grid[7][7], rootCat);
    assert.strictEqual(deadCore.grid[6][7], heldCat);
    assert.deepStrictEqual(deadCore.yarnVines, { '6:7': true });
    assert.strictEqual(deadCore.getYarnHealth(), 3);
    assert.strictEqual(deadCore.yarnTurns, 0);
    assert.strictEqual(deadCore.movesLeft, 30);

    console.log('yarn spread: ok (tutorial, ' + mixedCount + ' mixed recipes, deterministic mechanisms)');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
