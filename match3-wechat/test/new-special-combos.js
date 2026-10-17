'use strict';

const assert = require('assert');
const GameCore = require('../js/core/game-core');
const BoardRenderer = require('../js/render/board-render');
const gridUtil = require('../js/core/grid');
const timing = require('../js/special-trigger-timing');
const seededRandom = require('../js/core/solo-snapshot').random;

const PAW = 105;
const BELL = 106;
const position = (row, column) => ({ row, column });
const key = cell => cell.row + ':' + cell.column;
const keys = cells => [...new Set(cells.map(key))].sort();
const contains = (cells, cell) => cells.some(item => key(item) === key(cell));
const clone = value => JSON.parse(JSON.stringify(value));
const cases = [];
const test = (name, run) => cases.push({ name, run });

function fixture(extra = {}) {
    const core = new GameCore(Object.assign({ id: 5, rows: 8, columns: 8, colorCount: 5,
        moveCount: 25, trackingPaw: true, colorBell: true,
        goals: [{ type: 'score', target: 999999 }] }, extra), {});
    core.grid = core.grid.map((row, rowIndex) => row.map((value, column) => (rowIndex * 2 + column) % 5 + 1));
    return core;
}

function cells(core, predicate) {
    return core.grid.flatMap((row, rowIndex) => row.flatMap((value, column) => {
        const cell = position(rowIndex, column);
        return predicate(cell, value) ? [cell] : [];
    }));
}

function area(core, type, origin) {
    return cells(core, cell => {
        const vertical = Math.abs(cell.row - origin.row);
        const horizontal = Math.abs(cell.column - origin.column);
        return type === 101 ? vertical === 0 : type === 102 ? horizontal === 0 :
            type === 103 ? vertical <= 1 && horizontal <= 1 : type === PAW && vertical + horizontal <= 1;
    });
}

async function swap(core, first, second) {
    const events = [];
    const order = [];
    core.callbacks.onMatch = data => {
        events.push({ data: clone(data), grid: clone(core.grid), jelly: clone(core.jellyGrid),
            ice: clone(core.iceGrid), yarn: core.getYarnHealth(), collected: clone(core.collectedCounts) });
        order.push('match');
    };
    core.callbacks.onGravity = () => order.push('gravity');
    assert.strictEqual(gridUtil.getMatches(core.grid).length, 0, 'fixture starts without ordinary matches');
    const beforeMoves = core.movesLeft;
    assert.strictEqual(await core.trySwap(first, second), true);
    assert.strictEqual(core.movesLeft, beforeMoves - 1, 'whole operation costs exactly one move');
    assert.strictEqual(core.specialComboCount, 1);
    events.forEach(event => {
        const triggers = event.data.triggeredSpecials;
        assert.strictEqual(keys(triggers).length, triggers.length, 'no duplicate trigger positions');
    });
    return { events, order, data: events[0].data };
}

const pairs = [[PAW, 101, 'pawRocket'], [PAW, 102, 'pawRocket'], [PAW, 103, 'pawBomb'],
    [PAW, PAW, 'pawPaw'], [BELL, 101, 'bellRocket'], [BELL, 102, 'bellRocket'],
    [BELL, 103, 'bellBomb'], [BELL, PAW, 'bellPaw'], [BELL, BELL, 'bellBell']];
const placements = [[position(3, 3), position(3, 4)], [position(3, 3), position(4, 3)],
    [position(0, 0), position(0, 1)], [position(6, 7), position(7, 7)]];

for (const [firstType, secondType, kind] of pairs) {
    for (const [layoutIndex, layout] of placements.entries()) {
        for (const reversedTypes of [false, true]) {
            for (const reversedSwap of [false, true]) {
                test(`${kind}/${firstType}+${secondType}/layout${layoutIndex}/types${+reversedTypes}/swap${+reversedSwap}`, async () => {
                    const core = fixture();
                    const types = reversedTypes ? [secondType, firstType] : [firstType, secondType];
                    layout.forEach((cell, index) => {
                        core.grid[cell.row][cell.column] = types[index];
                        core.setSpecialBaseType(cell, index ? 4 : 2);
                    });
                    const [from, to] = reversedSwap ? layout.slice().reverse() : layout;
                    const before = clone(core.grid);
                    const landingColor = core.getSpecialBaseType(from);
                    const { data } = await swap(core, from, to);
                    assert.strictEqual(data.specialCombo.kind, kind);
                    assert.deepStrictEqual(data.specialCombo.center, to);
                    assert.deepStrictEqual(data.specialCombo.obstacleSnapshots, []);
                    const sources = data.triggeredSpecials;
                    const expected = layout.slice();
                    const paws = sources.filter(source => source.type === PAW);
                    for (const source of sources) {
                        if (source.type === BELL) {
                            assert.deepStrictEqual(source.hitTargets, []);
                            continue;
                        }
                        const origin = source.effectOrigin || source;
                        const hits = area(core, source.type, origin);
                        if (source.type === PAW) {
                            assert(Array.isArray(source.pawTargets));
                            source.pawTargets.forEach(impact => {
                                assert.deepStrictEqual(Object.keys(impact).sort(),
                                    ['target', 'targetIce', 'targetJelly', 'targetYarnHealth', 'targetYarnVine'].sort());
                                hits.push(impact.target);
                            });
                            if (source.pawTargets.length) assert.deepStrictEqual(source.target, source.pawTargets[0].target);
                        }
                        assert.deepStrictEqual(keys(source.hitTargets), keys(hits), 'trigger footprint is independently derived');
                        expected.push(...hits);
                    }
                    assert.deepStrictEqual(keys(data.removed), keys(expected), 'no unreported or original remote-partner blast');
                    if (kind === 'pawRocket' || kind === 'pawBomb') {
                        const paw = paws[0];
                        const partner = sources.find(source => source.type !== PAW);
                        assert.strictEqual(paw.pawTargets.length, 1);
                        assert.strictEqual(paw.carriedType, partner.type);
                        assert.deepStrictEqual(partner.effectOrigin, paw.target);
                        assert.deepStrictEqual(partner.after, { row: paw.row, column: paw.column, phase: 'impact' });
                        assert(!contains(area(core, PAW, paw), paw.target), 'remote destination lies outside takeoff cross');
                    } else if (kind === 'pawPaw') {
                        const remote = paws.flatMap(source => source.pawTargets.map(impact => impact.target));
                        assert.strictEqual(remote.length, 3, 'three total remote hits, not three extra');
                        assert.strictEqual(keys(remote).length, 3);
                        remote.forEach(cell => paws.forEach(source => assert(!contains(area(core, PAW, source), cell))));
                    } else if (kind === 'bellBell') {
                        const expectedDye = cells(core, cell => Math.abs(cell.row - to.row) <= 1 &&
                            Math.abs(cell.column - to.column) <= 1 && !contains(layout, cell) &&
                            before[cell.row][cell.column] !== landingColor);
                        assert.deepStrictEqual(keys(data.colorChanges), keys(expectedDye));
                        data.colorChanges.forEach(change => assert.strictEqual(change.type, landingColor));
                    } else {
                        const bell = sources.find(source => source.type === BELL);
                        const original = sources.find(source => source.type !== BELL && !source.after);
                        assert.strictEqual(bell.replicas.length, 2);
                        assert.strictEqual(keys(bell.replicas).length, 2);
                        assert.deepStrictEqual(bell.colorChanges, []);
                        for (const replica of bell.replicas) {
                            assert.strictEqual(replica.previousType, bell.color);
                            assert.strictEqual(before[replica.row][replica.column], bell.color);
                            assert.strictEqual(replica.type, original.type);
                            assert(!contains(area(core, original.type, original), replica));
                            const trigger = sources.find(source => key(source) === key(replica));
                            assert.deepStrictEqual(trigger.after, { row: bell.row, column: bell.column, phase: 'cast' });
                        }
                    }
                });
            }
        }
    }
}

for (const partner of [101, 102, 103, PAW]) {
    for (const count of [0, 1]) {
        test(`bell replica scarcity/${partner}/${count}`, async () => {
            const core = fixture({ colorCount: 4, moonbuds: ['0:0'], underlays: { '0:2': 2 },
                obstacles: { '0:4': 1 }, yarn: { source: '2:0', health: 3, spreadEvery: 2, maxVines: 3 } });
            const from = position(3, 3), to = position(3, 4);
            core.grid = core.grid.map((row, rowIndex) => row.map((value, column) => (rowIndex * 2 + column) % 4 + 1));
            core.grid[from.row][from.column] = BELL;
            core.grid[to.row][to.column] = partner;
            core.setSpecialBaseType(from, 5);
            core.grid[0][0] = 5;
            core.grid[0][1] = BELL;
            [position(0, 2), position(0, 4), position(2, 0), position(2, 2)].forEach(cell => {
                core.grid[cell.row][cell.column] = 5;
            });
            core.yarnVines['2:2'] = true;
            core.setSpecialBaseType(position(0, 1), 5);
            core.grid[7][7] = count ? 5 : 1;
            const { data } = await swap(core, from, to);
            const bell = data.triggeredSpecials.find(source => key(source) === key(to));
            assert.strictEqual(bell.replicas.length, count, 'locked/special cats cannot supply missing replicas');
            assert.deepStrictEqual(keys(bell.replicas), count ? ['7:7'] : []);
        });
    }
}

test('bellBell excludes locks/specials and matches before gravity', async () => {
    const core = fixture({ moonbuds: ['2:2'], underlays: { '2:3': 2 }, obstacles: { '2:4': 1 } });
    core.grid[3][2] = BELL;
    core.grid[3][3] = BELL;
    core.setSpecialBaseType(position(3, 2), 5);
    core.setSpecialBaseType(position(3, 3), 2);
    core.grid[4][4] = 101;
    const { data, events, order } = await swap(core, position(3, 2), position(3, 3));
    assert.deepStrictEqual(keys(data.colorChanges), ['3:4', '4:2', '4:3']);
    data.colorChanges.forEach(change => assert.strictEqual(change.type, 5));
    assert.deepStrictEqual(events[0].collected, {});
    assert.strictEqual(order[1], 'match', 'new dye match resolves before gravity');
    assert(contains(events[1].data.removed, position(4, 2)));
    assert(contains(events[1].data.removed, position(4, 3)));
    assert.strictEqual(events[1].data.specialCombo, null, 'dye-induced chain does not become a swap combo');
});

test('remote bomb obstacle overlap: snapshots, jelly peel, ice adjacency, closed flower, yarn cap', async () => {
    const core = fixture({ underlays: { '0:0': 2 }, obstacles: { '0:2': 1 },
        moonbuds: ['1:1'], yarn: { source: '1:0', health: 3, spreadEvery: 2, maxVines: 3 } });
    core.grid[4][3] = PAW;
    core.grid[4][4] = 103;
    core.moonbudOpen = false;
    const protectedCat = core.grid[1][1];
    const jellyCat = core.grid[0][0];
    const { data, events } = await swap(core, position(4, 3), position(4, 4));
    const paw = data.triggeredSpecials.find(source => source.type === PAW);
    assert.deepStrictEqual(paw.target, position(1, 0));
    assert.strictEqual(paw.pawTargets[0].targetYarnHealth, 3);
    assert.strictEqual(events[0].jelly[0][0], 1);
    assert.strictEqual(events[0].grid[0][0], jellyCat);
    assert.strictEqual(events[0].ice[0][2], 0, 'neighbor of remote blast melts ice');
    assert.strictEqual(events[0].grid[1][1], protectedCat);
    assert(contains(data.moonbudClosedHits, position(1, 1)));
    assert(!contains(data.removed, position(1, 1)));
    assert.strictEqual(events.filter(event => event.data.yarnRootHit).length, 1);
    assert.strictEqual(core.getYarnHealth(), 2);
    const snapshots = data.specialCombo.obstacleSnapshots;
    assert.strictEqual(snapshots.find(item => key(item.target) === '0:0').targetJelly, 2);
    assert.strictEqual(snapshots.find(item => key(item.target) === '0:2').targetIce, 1);
});

test('remote chain uses ordinary bomb and bell effects without recursive combo enhancement', async () => {
    const core = fixture();
    core.grid[4][3] = PAW;
    core.grid[4][4] = 101;
    core.grid[0][0] = 103;
    core.grid[0][1] = BELL;
    core.setSpecialBaseType(position(0, 1), 4);
    const { data } = await swap(core, position(4, 3), position(4, 4));
    const bomb = data.triggeredSpecials.find(source => source.type === 103);
    const bell = data.triggeredSpecials.find(source => source.type === BELL);
    assert(bomb && bell);
    assert.strictEqual(bomb.effectOrigin, undefined);
    assert.strictEqual(bell.replicas, undefined);
    assert.deepStrictEqual(keys(bomb.hitTargets), ['0:0', '0:1', '1:0', '1:1']);
    bell.colorChanges.forEach(change => assert(Math.abs(change.row - bell.row) + Math.abs(change.column - bell.column) === 1));
    for (const reduced of [false, true]) {
        const delays = timing(data, reduced);
        for (const source of [bomb, bell]) {
            assert(Math.abs(delays[data.triggeredSpecials.indexOf(source)] - (reduced ? 128 : 358.4)) < 1e-9,
                'remote chain inherits the real impact delay');
        }
    }
});

function board(core, reduced) {
    const renderer = new BoardRenderer({}, { width: 320, height: 568, reduceEffects: reduced });
    renderer.setGame(core);
    return renderer;
}

async function timeline(renderer, data) {
    let now = 0;
    let pending = [];
    let done = false;
    renderer.wait = duration => new Promise(resolve => pending.push({ at: now + duration, resolve }));
    const completion = renderer.animateMatch(data).then(() => { done = true; });
    async function advanceTo(target) {
        assert(target >= now);
        await new Promise(resolve => setImmediate(resolve));
        while (pending.some(item => item.at <= target)) {
            const next = Math.min(...pending.map(item => item.at));
            renderer.update(next - now);
            now = next;
            const ready = pending.filter(item => item.at === next);
            pending = pending.filter(item => item.at !== next);
            ready.forEach(item => item.resolve());
            await new Promise(resolve => setImmediate(resolve));
        }
        renderer.update(target - now);
        now = target;
    }
    return { advanceTo, async finish() {
        await advanceTo(2000);
        assert(done, 'animation completes');
        assert.strictEqual(pending.length, 0);
        await completion;
    } };
}

for (const reduced of [false, true]) {
    test(`early chain hit synchronizes replica type without resurrection/${reduced}`, async () => {
        const core = fixture();
        core.grid[4][3] = BELL;
        core.grid[4][4] = 101;
        core.grid[4][1] = 102;
        core.setSpecialBaseType(position(4, 3), 2);
        const renderer = board(core, reduced);
        let first = true;
        let failure;
        core.callbacks.onSwap = () => renderer.syncPiecesFromGrid();
        core.callbacks.onMatch = async data => {
            if (!first) return;
            first = false;
            const bell = data.triggeredSpecials.find(source => source.type === BELL);
            const replica = bell.replicas.find(cell => key(cell) === '0:1');
            assert(replica, 'the genuine combo selected the early-hit replica');
            const piece = renderer.findPiece(replica.row, replica.column);
            const delays = timing(data, reduced);
            const vertical = data.triggeredSpecials.findIndex(source => source.type === 102);
            assert.strictEqual(delays[vertical], 0);
            const clock = await timeline(renderer, data);
            const removedBeforeTransformation = piece.dying && piece.type === replica.previousType;
            assert.strictEqual(piece.type, replica.type);
            assert.strictEqual(piece.baseType, replica.previousType);
            assert.strictEqual(piece.dying, true);
            await clock.advanceTo(reduced ? 60 : 160);
            const center = renderer.pieceCenter(replica.row, replica.column);
            const effect = renderer.specialEffects.find(item => item.type === replica.type &&
                item.x === center.x && item.y === center.y);
            try {
                assert(effect && effect.life >= 0, 'replica fires after the cast deadline');
                assert.strictEqual(piece.dying, true);
                assert.strictEqual(piece.targetScale, 0, 'late cast cannot revive an already hit replica');
                assert.strictEqual(removedBeforeTransformation, false,
                    `replica (0,1) dies as ordinary type ${piece.type} at 0ms, then fires at ${reduced ? 60 : 160}ms`);
            } catch (error) { failure = error; }
            await clock.finish();
        };
        assert(await core.trySwap(position(4, 3), position(4, 4)));
        if (failure) throw failure;
    });

    test(`earliest hit wins when a later-listed root reaches a chained bomb/${reduced}`, async () => {
        const core = fixture();
        core.grid[4][3] = BELL;
        core.grid[4][4] = 101;
        core.grid[0][2] = 102;
        core.grid[4][2] = 103;
        core.setSpecialBaseType(position(4, 3), 2);
        const renderer = board(core, reduced);
        let first = true;
        let failure;
        core.callbacks.onSwap = () => renderer.syncPiecesFromGrid();
        core.callbacks.onMatch = async data => {
            if (!first) return;
            first = false;
            const bombIndex = data.triggeredSpecials.findIndex(source => source.type === 103);
            const rootIndex = data.triggeredSpecials.findIndex(source => source.type === 101 && !source.after);
            assert(bombIndex < rootIndex, 'real Core traversal emits the later-hit path before the root');
            const delays = timing(data, reduced);
            const bomb = renderer.findPiece(4, 2);
            const neighbor = renderer.findPiece(5, 2);
            const clock = await timeline(renderer, data);
            const effect = renderer.specialEffects.find(item => item.type === 103);
            try {
                assert.strictEqual(delays[rootIndex], 0);
                assert.strictEqual(bomb.dying, true, 'root rocket already removes the bomb at 0ms');
                assert.strictEqual(delays[bombIndex], 0,
                    `bomb removed at 0ms but effect.life=${effect.life}, neighbor.dying=${neighbor.dying}; later path must not override the direct root hit`);
                assert.strictEqual(neighbor.dying, true, 'bomb descendants clear when the earliest real hit activates it');
            } catch (error) { failure = error; }
            await clock.finish();
        };
        assert(await core.trySwap(position(4, 3), position(4, 4)));
        if (failure) throw failure;
    });

    test(`Board local bell rocket clears before replica cast/${reduced}`, async () => {
        const core = fixture();
        core.grid[3][3] = BELL;
        core.grid[3][4] = 101;
        core.setSpecialBaseType(position(3, 3), 2);
        const renderer = board(core, reduced);
        let first = true;
        let failure;
        core.callbacks.onSwap = () => renderer.syncPiecesFromGrid();
        core.callbacks.onMatch = async data => {
            if (!first) return;
            first = false;
            const localCat = renderer.findPiece(3, 0);
            const clock = await timeline(renderer, data);
            try {
                assert.strictEqual(localCat.dying, true,
                    'original rocket footprint clears at its own zero-delay firing, not at replica cast');
            } catch (error) { failure = error; }
            await clock.finish();
        };
        assert(await core.trySwap(position(3, 3), position(3, 4)));
        if (failure) throw failure;
    });

    for (const partner of [101, 103]) {
    test(`Core to Board remote footprint and obstacle HUD/${partner}/${reduced}`, async () => {
        const core = fixture({ underlays: { '0:0': 2, '0:5': 1 },
            obstacles: partner === 101 ? { '1:4': 1 } : { '2:1': 1 } });
        core.grid[4][3] = PAW;
        core.grid[4][4] = partner;
        const renderer = board(core, reduced);
        let first = true;
        let failure;
        core.callbacks.onSwap = () => renderer.syncPiecesFromGrid();
        core.callbacks.onMatch = async data => {
            if (!first) return;
            first = false;
            try {
                const arrival = reduced ? 128 : 358.4;
                const delays = timing(data, reduced);
                const partnerIndex = data.triggeredSpecials.findIndex(source => source.type === partner);
                assert(Math.abs(delays[partnerIndex] - arrival) < 1e-9);
                const clock = await timeline(renderer, data);
                const effect = renderer.specialEffects.find(item => item.type === partner);
                const center = renderer.pieceCenter(0, 0);
                assert.strictEqual(effect.x, center.x);
                assert.strictEqual(effect.y, center.y);
                assert(Math.abs(effect.life + arrival) < 1e-9);
                assert(renderer.specialEffects.some(item => item.carriedType === partner));
                assert.strictEqual(renderer.visualJellyLeft(), 3);
                assert.strictEqual(renderer.visualIceLeft(), 1);
                await clock.advanceTo(arrival - 1);
                assert.strictEqual(renderer.visualJellyLeft(), 3);
                assert.strictEqual(renderer.visualIceLeft(), 1);
                await clock.advanceTo(Math.ceil(arrival));
                assert.strictEqual(renderer.visualJellyLeft(), partner === 101 ? 1 : 2);
                assert.strictEqual(renderer.visualIceLeft(), 0);
                await clock.finish();
            } catch (error) { failure = error; }
        };
        assert(await core.trySwap(position(4, 3), position(4, 4)));
        if (failure) throw failure;
        assert.strictEqual(first, false);
    });
    }

    test(`Board dual paw renders exactly three distinct flights/${reduced}`, async () => {
        const core = fixture();
        core.grid[3][3] = PAW;
        core.grid[3][4] = PAW;
        const renderer = board(core, reduced);
        const { data } = await swap(core, position(3, 3), position(3, 4));
        renderer.spawnMatchEffects(data);
        const flights = renderer.specialEffects.filter(effect => effect.type === PAW);
        assert.strictEqual(flights.length, 3);
        assert.strictEqual(keys(flights.map(effect => effect.target)).length, 3);
        assert.deepStrictEqual(keys(flights.map(effect => effect.target)),
            keys(data.triggeredSpecials.flatMap(source => source.pawTargets.map(impact => impact.target))));
    });

    test(`Board replicas cast before firing and remote paw waits/${reduced}`, async () => {
        const core = fixture();
        core.grid[3][3] = BELL;
        core.grid[3][4] = PAW;
        core.setSpecialBaseType(position(3, 3), 2);
        let first = true;
        let failure;
        const renderer = board(core, reduced);
        core.callbacks.onSwap = () => renderer.syncPiecesFromGrid();
        core.callbacks.onMatch = async data => {
            if (!first) return;
            first = false;
            try {
                const bell = data.triggeredSpecials.find(source => source.type === BELL);
                const replica = bell.replicas[0];
                const cast = reduced ? 60 : 160;
                const arrival = reduced ? 128 : 358.4;
                const delays = timing(data, reduced);
                data.triggeredSpecials.forEach((source, index) => {
                    if (source.after) assert.strictEqual(delays[index], cast);
                });
                const clock = await timeline(renderer, data);
                const piece = renderer.findPiece(replica.row, replica.column);
                assert.strictEqual(piece.type, replica.previousType);
                await clock.advanceTo((reduced ? 40 : 100) - 1);
                assert.strictEqual(piece.type, replica.previousType);
                await clock.advanceTo(reduced ? 40 : 100);
                assert.strictEqual(piece.type, PAW);
                await clock.advanceTo(cast - 1);
                assert.strictEqual(piece.dying, false);
                await clock.advanceTo(cast);
                assert.strictEqual(piece.dying, true);
                assert(renderer.specialEffects.filter(item => item.type === PAW).length >= 3);
                assert(Math.max(...delays) + arrival > cast);
                await clock.finish();
            } catch (error) { failure = error; }
        };
        assert(await core.trySwap(position(3, 3), position(3, 4)));
        if (failure) throw failure;
    });
}

function audioContext() {
    const starts = [];
    const stops = [];
    const parameter = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
    const context = { state: 'running', currentTime: 10, sampleRate: 22050, destination: {},
        createGain: () => ({ gain: parameter, connect() {} }),
        createOscillator: () => ({ frequency: parameter, connect() {}, start(at) { starts.push(at); }, stop(at) { stops.push(at); } }),
        createBuffer: (channels, length) => ({ getChannelData: () => new Float32Array(length) }),
        createBufferSource: () => ({ connect() {}, start(at) { starts.push(at); }, stop(at) { stops.push(at); } }),
        createBiquadFilter: () => ({ frequency: parameter, Q: parameter, connect() {} }) };
    return { context, starts, stops };
}

async function ordinaryPawEvent(type) {
    const core = fixture();
    core.grid[4][3] = PAW;
    const remote = type === 101 ? position(4, 0) : position(0, 4);
    const chained = type === 101 ? position(4, 1) : position(1, 4);
    core.grid[remote.row][remote.column] = type;
    core.grid[chained.row][chained.column] = 103;
    let data;
    core.callbacks.onMatch = event => { if (!data) data = clone(event); };
    assert.strictEqual(gridUtil.getMatches(core.grid).length, 0);
    assert(await core.trySwap(position(4, 3), position(4, 4)));
    assert.strictEqual(data.specialCombo, null);
    assert.deepStrictEqual(data.triggeredSpecials.map(source => source.type), [PAW, type, 103]);
    assert(data.triggeredSpecials.every(source => !source.after));
    assert(contains(data.removed, data.triggeredSpecials[0]));
    return { core, data };
}

for (const reduced of [false, true]) {
    for (const layer of ['jelly', 'ice']) {
        test(`reachability protected paw ${layer} remains a root candidate/${reduced}`, async () => {
            const core = fixture(layer === 'jelly' ? { underlays: { '4:1': 2 } } : { obstacles: { '4:1': 1 } });
            core.grid[4][3] = 101;
            core.grid[4][1] = PAW;
            core.grid[0][1] = 102;
            let data;
            core.callbacks.onMatch = event => { if (!data) data = clone(event); };
            assert(await core.trySwap(position(4, 3), position(4, 4)));
            const paw = data.triggeredSpecials.find(source => source.type === PAW);
            const rocket = data.triggeredSpecials.find(source => source.type === 102);
            assert(contains(data.removed, paw), 'special consumes its protective layer and enters removed');
            assert.strictEqual(core.jellyGrid[4][1], 0);
            assert.strictEqual(core.iceGrid[4][1], 0);
            assert.deepStrictEqual(paw.target, position(0, 1));
            const delays = timing(data, reduced);
            assert.strictEqual(delays[data.triggeredSpecials.indexOf(paw)], 0);
            assert(Math.abs(delays[data.triggeredSpecials.indexOf(rocket)] - (reduced ? 128 : 358.4)) < 1e-9);
        });
    }

    test(`reachability after may precede parent and rejects an unrooted dependency cycle/${reduced}`, () => {
        const root = { row: 4, column: 4, type: PAW, target: position(0, 0) };
        const child = { row: 4, column: 3, type: 103, effectOrigin: position(0, 0),
            after: { row: 4, column: 4, phase: 'impact' } };
        const leaf = { row: 0, column: 1, type: 101 };
        const data = { removed: [root, child, leaf], triggeredSpecials: [leaf, child, root],
            specialCombo: { first: root, second: child, kind: 'pawBomb' } };
        const delays = timing(data, reduced);
        const arrival = reduced ? 128 : 358.4;
        assert(Math.abs(delays[0] - arrival) < 1e-9);
        assert(Math.abs(delays[1] - arrival) < 1e-9);
        assert.strictEqual(delays[2], 0);
        const isolated = [
            { row: 6, column: 6, type: 101, after: { row: 6, column: 7, phase: 'cast' } },
            { row: 6, column: 7, type: 101, after: { row: 6, column: 6, phase: 'cast' } }
        ];
        assert.throws(() => timing({ ...data, triggeredSpecials: [root, child, leaf, ...isolated] }, reduced),
            /Unreachable special trigger dependency/);
        assert.throws(() => timing({ triggeredSpecials: isolated }, reduced), /Unreachable special trigger dependency/);
        assert.throws(() => timing({ triggeredSpecials: [child] }, reduced), /Unreachable special trigger dependency/);
    });

    for (const type of [101, 102]) {
        for (const sampled of [false, true]) {
            test(`ordinary paw audio no-after rocket/${type}/${sampled ? 'loaded' : 'fallback'}/${reduced}`, async () => {
                const { core, data } = await ordinaryPawEvent(type);
                const arrival = reduced ? 128 : 358.4;
                const delays = timing(data, reduced);
                assert.strictEqual(delays[0], 0);
                assert(Math.abs(delays[1] - arrival) < 1e-9);
                assert(Math.abs(delays[2] - arrival) < 1e-9, 'rocket descendants inherit the earliest reachable impact');
                const renderer = board(core, reduced);
                renderer.spawnMatchEffects(data);
                assert(Math.abs(renderer.specialEffects.find(effect => effect.type === type).life + arrival) < 1e-9);
                const modulePath = require.resolve('../js/audio');
                const previousModule = require.cache[modulePath];
                const previousWx = global.wx;
                const { context, starts, stops } = audioContext();
                try {
                    delete require.cache[modulePath];
                    global.wx = { createWebAudioContext: () => context };
                    if (sampled) {
                        context.decodeAudioData = (buffer, accept) => accept({});
                        global.wx.getFileSystemManager = () => ({ readFile: request => request.success({ data: new ArrayBuffer(8) }) });
                    }
                    const audio = require('../js/audio');
                    audio.init();
                    audio.match(data, reduced);
                    assert.strictEqual(starts.length, sampled ? 2 : 6, 'only the first two actual types play; the third bomb stays excluded');
                    const partnerStarts = starts.slice(sampled ? 1 : 4);
                    const expected = context.currentTime + arrival / 1000;
                    assert(partnerStarts.every(at => at >= expected), `ordinary remote rocket audio starts ${partnerStarts}, expected >= ${expected}`);
                    assert(Math.abs(partnerStarts[0] - expected) < 1e-9);
                    audio.setSfxEnabled(false);
                    assert.strictEqual(stops.filter(at => at === undefined).length, starts.length,
                        'muting cancels immediate and future scheduled voices');
                    const count = starts.length;
                    audio.match(data, reduced);
                    assert.strictEqual(starts.length, count, 'muted matches cannot schedule new delayed voices');
                } finally {
                    if (previousWx === undefined) delete global.wx; else global.wx = previousWx;
                    delete require.cache[modulePath];
                    if (previousModule) require.cache[modulePath] = previousModule;
                }
            });
        }
    }
}

for (const reduced of [false, true]) {
    for (const [type, sampled] of [[101, false], [101, true], [103, false], [103, true]]) {
        test(`audio ${sampled ? 'loaded' : 'unavailable'} sprites preserve remote ${type} impact delay/${reduced}`, () => {
            const modulePath = require.resolve('../js/audio');
            const previousModule = require.cache[modulePath];
            const previousWx = global.wx;
            const { context, starts } = audioContext();
            try {
                delete require.cache[modulePath];
                global.wx = { createWebAudioContext: () => context };
                if (sampled) {
                    context.decodeAudioData = (buffer, accept) => accept({});
                    global.wx.getFileSystemManager = () => ({ readFile: request => request.success({ data: new ArrayBuffer(8) }) });
                }
                const audio = require('../js/audio');
                audio.init();
                audio.match({ triggeredSpecials: [
                    { row: 4, column: 4, type: PAW, target: position(0, 0) },
                    { row: 4, column: 3, type, effectOrigin: position(0, 0),
                        after: { row: 4, column: 4, phase: 'impact' } }
                ] }, reduced);
                assert(sampled ? starts.length === 2 : starts.length > 4, 'both paw and partner produce audio nodes');
                const partnerStarts = starts.slice(sampled ? 1 : 4);
                const expected = context.currentTime + (reduced ? 0.128 : 0.3584);
                assert(partnerStarts.every(at => at >= expected),
                    `remote fallback must wait until ${expected}s, actual starts ${partnerStarts.join(',')}`);
            } finally {
                if (previousWx === undefined) delete global.wx; else global.wx = previousWx;
                delete require.cache[modulePath];
                if (previousModule) require.cache[modulePath] = previousModule;
            }
        });
    }
}

(async () => {
    const originalRandom = Math.random;
    let passed = 0;
    let failed = 0;
    try {
        for (const entry of cases) {
            if (process.argv[2] && !entry.name.includes(process.argv[2])) continue;
            Math.random = seededRandom(74123);
            try {
                await entry.run();
                passed++;
            } catch (error) {
                failed++;
                console.error('FAIL ' + entry.name + '\n' + error.stack);
            }
        }
    } finally { Math.random = originalRandom; }
    console.log(`new-special-combos: ${passed} passed, ${failed} failed, ${passed + failed} selected / ${cases.length} total`);
    if (failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
