const assert = require('assert');
const Core = require('../js/core/game-core');
const grid = require('../js/core/grid');
const config = require('../js/core/config');
const levels = require('../js/core/level');
const snapshot = require('../js/core/solo-snapshot');
const vm = require('vm');
const clone = v => JSON.parse(JSON.stringify(v));
const pos = (row, column) => ({ row, column });
const normalized = core => { const s = snapshot.capture(core); s.state.timerPaused = true; return s; };
function fixture() {
    return new Core({ rows: 8, columns: 8, colorCount: 5, moveCount: 25, timeLimitSec: 180,
        goals: [{ type: 'score', target: 999999 }], underlays: { '0:0': 2 }, obstacles: { '0:1': 1 },
        yarn: { source: '1:1', health: 3, spreadEvery: 2, maxVines: 3 },
        moonbuds: ['1:3'], parcels: [{ id: 'fish', row: 1, column: 5 }], parcelExits: [5],
        trackingPaw: true, colorBell: true,
        initialSpecials: Object.values(config.SPECIAL_TYPES).map((type, column) => ({ row: 4, column, type }))
    }, {}, snapshot.random(1));
}
async function replay(core, action, seed) {
    const before = snapshot.capture(core);
    const restored = snapshot.restore(before, {});
    core.pauseTimer();
    core.random = snapshot.random(seed);
    restored.random = snapshot.random(seed);
    const a = await action(core), b = await action(restored);
    assert.strictEqual(a, b);
    assert.deepStrictEqual(normalized(core), normalized(restored));
    return a;
}
(async () => {
    const core = fixture();
    core.yarnVines['2:1'] = true;
    core.yarnTurns = 1;
    core.collectedCounts = { 1: 12, 4: 8 };
    core.score = 800; core.timeLeftMs = 12345.25; core.timerStarted = true;
    core.maxCascade = 3; core.specialComboCount = 2; core.moonbudOpen = false;
    const captured = snapshot.capture(core);
    assert(snapshot.validate(captured));
    assert.strictEqual(captured.schema, 2);
    let callbacks = 0;
    const restored = snapshot.restore(clone(captured), { onLevelEnd: () => callbacks++ });
    assert(restored instanceof Core);
    assert.strictEqual(restored.timerPaused, true);
    assert.strictEqual(callbacks, 0);
    assert.deepStrictEqual(normalized(restored), normalized(core));
    const serialized = JSON.stringify(captured);
    core.grid[7][7] = 2; core.level.name = 'changed'; core.yarnSource.health = 2;
    assert.strictEqual(JSON.stringify(captured), serialized);
    restored.grid[7][7] = 3;
    assert.strictEqual(JSON.stringify(captured), serialized);
    assert(!serialized.includes('callbacks'));
    assert(!serialized.includes('random'));
    assert.strictEqual(core.random instanceof Function, true);

    const continuing = fixture();
    const detached = snapshot.capture(continuing), detachedJSON = JSON.stringify(detached);
    continuing.random = snapshot.random(15);
    await continuing.useTool('bomb', pos(4, 2));
    assert.strictEqual(JSON.stringify(detached), detachedJSON, 'actual cascades cannot mutate snapshot');
    const bound = snapshot.restore(detached, { onMatch: () => callbacks++ });
    bound.random = snapshot.random(15);
    await bound.useTool('bomb', pos(4, 2));
    assert(callbacks > 0, 'restored callbacks are rebound');
    callbacks = 0;
    bound.timerStarted = true;
    const left = bound.timeLeftMs; bound.updateTime(10);
    assert.strictEqual(bound.timeLeftMs, left, 'restored timer remains paused');
    const invalid = fixture();
    assert.strictEqual(await invalid.trySwap(pos(0, 1), pos(0, 2)), false);
    assert(snapshot.validate(snapshot.capture(invalid)), 'invalid swap feedback leaves stable state');
    const finalPhase = fixture(); finalPhase.movesLeft = 1;
    let phaseChecked = false;
    finalPhase.callbacks.onLevelEnd = () => {
        assert(finalPhase.ended && finalPhase.moonbudPhasePending);
        assert.throws(() => snapshot.capture(finalPhase), /unstable/);
    };
    finalPhase.callbacks.onMoonbudPhase = async () => {
        assert.throws(() => snapshot.capture(finalPhase), /unstable/);
        await Promise.resolve(); phaseChecked = true;
    };
    await finalPhase.trySwap(pos(4, 0), pos(5, 0));
    assert(phaseChecked && snapshot.validate(snapshot.capture(finalPhase)));

    // Real generated levels cover all currently persisted content metadata and obstacles.
    for (let id = 1; id <= 130; id++) {
        const c = new Core(levels.getLevel(id), {}, snapshot.random(id));
        assert.deepStrictEqual(normalized(snapshot.restore(snapshot.capture(c))), normalized(c), 'level ' + id);
    }
    for (const flag of ['processing', 'swapFeedbackPending', 'moonbudPhasePending', 'yarnAdvancePending']) {
        const c = fixture(); c[flag] = true; c.ended = true;
        assert.throws(() => snapshot.capture(c), /unstable/);
    }
    for (const queue of ['pendingTriggers', 'pendingRemovals', 'preferredGenerationPositions', 'pendingPawSquares', 'pendingBellShapes']) {
        const c = fixture(); c[queue].push(pos(2, 2)); assert.throws(() => snapshot.capture(c), /unstable/);
    }
    for (const field of ['pendingCombo', 'pendingBellColors']) {
        const c = fixture(); c[field] = { x: 1 }; assert.throws(() => snapshot.capture(c), /unstable/);
    }
    const ended = fixture(); ended.ended = true; ended.movesLeft = 0;
    const lost = snapshot.restore(snapshot.capture(ended), { onLevelEnd: () => callbacks++ });
    assert(lost.ended && !lost.won); assert.strictEqual(callbacks, 0);
    assert(lost.revive(5, 30000)); assert.strictEqual(lost.movesLeft, 5);

    // All six special types activate through actual swaps, plus all three tools.
    for (const type of Object.values(config.SPECIAL_TYPES)) {
        const c = fixture(); c.grid[4][0] = type;
        assert(await replay(c, c => c.trySwap(pos(4, 0), pos(5, 0)), 7), 'special ' + type);
    }
    for (const tool of ['hammer', 'bomb', 'color']) {
        const c = fixture();
        c.grid[6][0] = 1; c.grid[6][1] = 1; c.grid[6][2] = 2;
        assert(await replay(c, c => c.useTool(tool, pos(6, 2)), 123), tool);
    }
    const c = fixture();
    c.grid[6][0] = 1; c.grid[6][1] = 1; c.grid[6][2] = 2; c.grid[5][2] = 1;
    assert(await replay(c, c => c.trySwap(pos(5, 2), pos(6, 2)), 99));
    await replay(fixture(), c => c.autoReshuffle(), 42);
    const emptyA = [[0, 1, 0], [0, 2, 0], [1, 0, 2]], emptyB = clone(emptyA);
    grid.fillUp(emptyA, [1, 2, 3, 4], snapshot.random(9));
    grid.fillUp(emptyB, [1, 2, 3, 4], snapshot.random(9));
    assert.deepStrictEqual(emptyA, emptyB);
    const ra = snapshot.random(0), rb = snapshot.random(0);
    for (let i = 0; i < 1000; i++) { const n = ra(); assert(n >= 0 && n < 1); assert.strictEqual(n, rb()); }
    for (const seed of [-1, 2 ** 32, NaN, null, 1.5]) assert.throws(() => snapshot.random(seed));

    const original = Math.random;
    try {
        let calls = 0;
        Math.random = () => { calls++; return 0.5; };
        assert.strictEqual(grid.getRandomType([1, 2, 3, 4]), 3);
        assert.strictEqual(grid.getRandomType([1, 2, 3, 4], [3]), 2);
        const defaultCore = new Core({ rows: 3, columns: 3, moveCount: 10 });
        assert.strictEqual(defaultCore.random, undefined); assert(calls > 2);
        assert.strictEqual(grid.getRandomType([1, 2, 3, 4], undefined, () => 0), 1);
        calls = 0;
        snapshot.restore(captured); assert.strictEqual(calls, 0, 'restore never creates a random board');
    } finally { Math.random = original; }

    for (const extra of [{ moonbuds: ['1:1'] }, { yarn: { source: '1:1', health: 3, spreadEvery: 2, maxVines: 3 } }]) {
        const old = snapshot.capture(new Core(Object.assign({ rows: 6, columns: 6 }, extra)));
        old.schema = 1;
        assert(snapshot.validate(old), 'legacy rule snapshots stay structurally readable');
        assert.strictEqual(snapshot.compatible(old), false);
        assert.throws(() => snapshot.restore(old), error => error.code === 'incompatible_rules');
    }
    const legacy = snapshot.capture(new Core({ rows: 6, columns: 6 }));
    legacy.schema = 1;
    assert(snapshot.compatible(legacy), 'unaffected legacy board remains restorable');
    assert.deepStrictEqual(snapshot.capture(snapshot.restore(legacy)).state, { ...legacy.state, timerPaused: true });

    const bad = [null, [], {}, { ...captured, schema: 3 }];
    const mutate = fn => { const v = clone(captured); fn(v); bad.push(v); };
    mutate(v => { v.state.grid = null; });
    mutate(v => { v.state.grid[0].pop(); });
    mutate(v => { v.level.rows = 0; });
    mutate(v => { v.level.rows = 1000000; });
    mutate(v => { v.state.score = Infinity; });
    mutate(v => { v.state.grid[0][0] = 999; });
    mutate(v => { v.state.callbacks = {}; });
    mutate(v => { v.state.specialBases['99:0'] = 1; });
    mutate(v => { v.state.parcels[0].row = -1; });
    mutate(v => { v.state.parcels[0].id = 'unknown'; });
    mutate(v => { v.state.moonbudCells['0:0'] = true; });
    mutate(v => { v.state.yarnSource.health = 999; });
    mutate(v => { v.level.yarn.spreadEvery = 0; });
    mutate(v => { v.level.moonbuds = ['0:1']; });
    mutate(v => { v.level.goals = [{ type: 'parcel', target: 2 }]; });
    mutate(v => { v.state.collectedCounts = null; });
    mutate(v => { v.state.timerPaused = 1; });
    mutate(v => { v.state.grid[0] = new Array(8); });
    mutate(v => { v.state.grid[0].extra = true; });
    mutate(v => { v.state.score = NaN; });
    mutate(v => { v.level.goals[0].type = 'unknown'; });
    mutate(v => { v.state.jellyGrid[7][7] = 1; });
    mutate(v => { Object.defineProperty(v.state, 'score', { enumerable: true, get() { throw new Error('getter executed'); } }); });
    mutate(v => { Object.setPrototypeOf(v.level, { rows: 8 }); });
    mutate(v => { Object.setPrototypeOf(v.level, Object.create(null, {constructor:{value:Object}})); });
    mutate(v => { Object.setPrototypeOf(v.state.grid, Object.create(Array.prototype)); });
    mutate(v => { v.level.loop = v.level; });
    bad.push(JSON.parse(serialized.replace('"schema":2', '"__proto__":{},"schema":2')));
    bad.push(vm.runInNewContext('Object.assign(new (class Snapshot {})(), JSON.parse(input))',{input:serialized}));
    let reads=0;const getter=clone(captured);
    Object.defineProperty(getter.state,'score',{enumerable:true,get(){reads++;return 0;}});
    assert.strictEqual(snapshot.validate(getter),false);assert.strictEqual(reads,0,'validation must not execute getters');
    for (const v of bad) { assert.strictEqual(snapshot.validate(v), false); assert.throws(() => snapshot.restore(v)); }
    console.log('solo-snapshot: roundtrip, stability, RNG/replay and malformed-state checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
