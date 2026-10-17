/** Focused renderer contract checks for moon-crystal combo scopes. */
const assert = require('assert');
const BoardRenderer = require('../js/render/board-render');
const GameCore = require('../js/core/game-core');
const config = require('../js/core/config');

const level = { id: 1, rows: 8, columns: 8, moveCount: 20, goals: [{ type: 'score', target: 1 }] };
function board(reduceEffects) {
    const value = new BoardRenderer({}, { width: 320, height: 568, reduceEffects: !!reduceEffects });
    value.setGame(new GameCore(level, {}));
    return value;
}
function match(firstType, secondType) {
    return {
        removed: [{ row: 4, column: 4 }], jellyHits: [{ row: 4, column: 5 }], iceHits: [],
        triggeredSpecials: [
            { row: 4, column: 3, type: firstType },
            { row: 4, column: 4, type: secondType }
        ],
        specialCombo: {
            first: { row: 4, column: 3, type: firstType },
            second: { row: 4, column: 4, type: secondType },
            center: { row: 4, column: 4 }
        }
    };
}
function kind(first, second) {
    const value = board(false);
    value.spawnMatchEffects(match(first, second));
    return value.specialEffects[0].kind;
}

assert.strictEqual(kind(101, 102), 'cross', 'rocket pair must use a row/column cross');
assert.strictEqual(kind(101, 103), 'tripleCross', 'rocket+bomb must use three rows and columns');
assert.strictEqual(kind(103, 103), 'square', 'bomb pair must use a 5x5 ring');
assert.strictEqual(kind(104, 2), 'color', 'color ball must use actual targets');
assert.strictEqual(kind(104, 104), 'screen', 'two color balls must use board scope');

const chained = board(false);
chained.spawnMatchEffects({
    removed: [{ row: 2, column: 2 }],
    triggeredSpecials: [{ row: 2, column: 2, type: config.SPECIAL_TYPES.H_ROCKET }]
});
assert.strictEqual(chained.specialEffects.length, 1, 'single chained trigger keeps its local effect');
assert.strictEqual(chained.specialEffects[0].kind, undefined, 'single trigger must not invent a combo scope');

const adjacentChain = board(false);
adjacentChain.spawnMatchEffects({
    removed: [{ row: 2, column: 2 }],
    triggeredSpecials: [
        { row: 2, column: 2, type: config.SPECIAL_TYPES.H_ROCKET },
        { row: 2, column: 3, type: config.SPECIAL_TYPES.V_ROCKET }
    ]
});
assert.strictEqual(adjacentChain.specialEffects.some(function (effect) { return effect.kind === 'cross'; }), false,
    'adjacent chain records without explicit combo metadata must not become a cross');

const reduced = board(true);
reduced.spawnMatchEffects(match(101, 103));
assert.strictEqual(reduced.specialEffects[0].maxLife, 180, 'reduced effects retain the short inexpensive lifetime');

for (const reduceEffects of [false, true]) {
    const tracked = board(reduceEffects);
    tracked.core.jellyGrid = tracked.core.grid.map(row => row.map(() => 0));
    tracked.core.jellyGrid[1][6] = 1;
    const arrival = (reduceEffects ? 200 : 560) * 0.64;
    const timing = tracked.spawnMatchEffects({
        removed: [],
        triggeredSpecials: [
            { row: 4, column: 4, type: 105, target: { row: 1, column: 6 }, targetJelly: 2, targetIce: 0, targetYarnHealth: 0 },
            { row: 1, column: 6, type: 101 },
            { row: 1, column: 2, type: 103 },
            { row: 4, column: 5, type: 102 }
        ]
    });
    assert.strictEqual(timing.impact, arrival);
    assert.strictEqual(tracked.specialEffects[1].life, -arrival, 'remote rocket waits for paw arrival');
    assert.strictEqual(tracked.specialEffects[2].life, -arrival, 'remote rocket descendants share arrival timing');
    assert.strictEqual(tracked.specialEffects[3].life, 0, 'local cross triggers remain immediate');
    assert.strictEqual(tracked.visualJellyLeft(), 2, 'HUD retains the same layer snapshot as the target');
    tracked.update(arrival - 1);
    assert.strictEqual(tracked.visualJellyLeft(), 2);
    assert(tracked.specialEffects[1].life < 0);
    tracked.update(2);
    assert.strictEqual(tracked.visualJellyLeft(), 1, 'HUD reveals damage only at impact');
    assert(tracked.specialEffects[1].life >= 0);
    tracked.core.jellyGrid[1][6] = 0;
    tracked.specialEffects = [];
    tracked.spawnMatchEffects({ removed: [], triggeredSpecials: [
        { row: 4, column: 4, type: 105, target: { row: 1, column: 6 }, targetJelly: 1 }
    ] });
    assert.strictEqual(tracked.visualJellyLeft(), 1);
    tracked.update(arrival + 1);
    assert.strictEqual(tracked.visualJellyLeft(), 0, 'last-layer removal appears at impact');
}

const nestedPaw = board(false);
const nestedTiming = nestedPaw.spawnMatchEffects({ removed: [], triggeredSpecials: [
    { row: 4, column: 4, type: 105, target: { row: 1, column: 6 } },
    { row: 1, column: 6, type: 105, target: { row: 6, column: 6 } },
    { row: 6, column: 6, type: 101 }
] });
assert.strictEqual(nestedTiming.impact, 560 * 0.64 * 2, 'nested flights retain both travel phases');
assert.strictEqual(nestedPaw.specialEffects[2].life, -nestedTiming.impact);

const directPawCombo = board(false);
directPawCombo.spawnMatchEffects({ removed: [], triggeredSpecials: [
    { row: 4, column: 4, type: 105, target: { row: 1, column: 6 } },
    { row: 4, column: 5, type: 101 }
], specialCombo: { first: { row: 4, column: 4, type: 105 }, second: { row: 4, column: 5, type: 101 } } });
assert.strictEqual(directPawCombo.specialEffects[1].life, 0, 'direct combo sources are never delayed');

function timedMatch(reduceEffects, data) {
    const value = board(reduceEffects);
    value.core.grid = value.core.grid.map(row => row.map(() => 5));
    data.triggeredSpecials.forEach(source => { value.core.grid[source.row][source.column] = source.type; });
    value.syncPiecesFromGrid();
    (data.colorChanges || []).forEach(change => { value.core.grid[change.row][change.column] = change.type; });
    let elapsed = 0;
    let completed = false;
    const pending = [];
    value.wait = duration => new Promise(resolve => { pending.push({ time: elapsed + duration, resolve: resolve }); });
    const completion = value.animateMatch(data).then(() => { completed = true; });
    return {
        board: value,
        async advanceTo(time) {
            assert(time >= elapsed, 'fake clock must only advance');
            await new Promise(resolve => setImmediate(resolve));
            pending.sort((first, second) => first.time - second.time);
            while (pending.length && pending[0].time <= time) {
                const next = pending.shift();
                value.update(next.time - elapsed);
                elapsed = next.time;
                next.resolve();
                await new Promise(resolve => setImmediate(resolve));
                pending.sort((first, second) => first.time - second.time);
            }
            value.update(time - elapsed);
            elapsed = time;
        },
        async finish() {
            await this.advanceTo(1600);
            assert(completed, 'match must finish after all activation, dye and removal phases');
            assert.strictEqual(pending.length, 0, 'match must not leave delayed callbacks');
            await completion;
        }
    };
}

async function checkNestedPaw(reduceEffects) {
    const arrival = (reduceEffects ? 200 : 560) * 0.64;
    const timeline = timedMatch(reduceEffects, {
        removed: [
            { row: 4, column: 4 }, { row: 4, column: 5 },
            { row: 1, column: 6 }, { row: 1, column: 5 }, { row: 1, column: 7 },
            { row: 0, column: 6 }, { row: 2, column: 6 }, { row: 1, column: 5 },
            { row: 6, column: 6 }, { row: 6, column: 2 }
        ],
        triggeredSpecials: [
            { row: 4, column: 4, type: 105, target: { row: 1, column: 6 } },
            { row: 1, column: 6, type: 105, target: { row: 6, column: 6 } },
            { row: 6, column: 6, type: 101 }
        ]
    });
    const value = timeline.board;
    assert.strictEqual(value.findPiece(4, 4), null, 'root paw clears its origin immediately');
    assert.strictEqual(value.findPiece(4, 5), null, 'root paw clears its local cross immediately');
    const localCross = [[1, 6], [1, 5], [1, 7], [0, 6], [2, 6]].map(position => value.findPiece(...position));
    const remote = value.findPiece(6, 6);
    const remoteNeighbor = value.findPiece(6, 2);
    const bursts = [];
    const spawnBurst = value.spawnBurst.bind(value);
    value.spawnBurst = (horizontal, vertical, colors, count) => {
        bursts.push({ horizontal: horizontal, vertical: vertical });
        spawnBurst(horizontal, vertical, colors, count);
    };
    await timeline.advanceTo(arrival - 1);
    localCross.forEach(piece => {
        assert.strictEqual(piece.dying, false, 'nested paw cross survives until its source activates');
        assert.strictEqual(piece.scale, 1);
    });
    await timeline.advanceTo(reduceEffects ? 160 : 400);
    localCross.forEach(piece => {
        assert.strictEqual(piece.dying, true, 'nested paw clears its cross at takeoff, before its remote impact');
        assert.strictEqual(piece.targetScale, 0);
        assert(piece.scale < 1, 'nested paw cross visibly shrinks during the second flight');
    });
    const sharedCenter = value.pieceCenter(1, 5);
    assert.strictEqual(bursts.filter(burst => burst.horizontal === sharedCenter.x && burst.vertical === sharedCenter.y).length, 1,
        'duplicate removed positions must only burst once');
    assert.strictEqual(remote.dying, false, 'second destination is retained before arrival');
    assert.strictEqual(remoteNeighbor.dying, false);
    assert(value.specialEffects.find(effect => effect.type === 101).life < 0, 'remote rocket still waits for the second arrival');
    await timeline.advanceTo(Math.ceil(arrival * 2));
    assert.strictEqual(remote.dying, true);
    assert.strictEqual(remoteNeighbor.dying, true);
    await timeline.finish();
}

async function checkLocalAndRemoteBells(reduceEffects) {
    const arrival = (reduceEffects ? 200 : 560) * 0.64;
    const localChange = { row: 3, column: 3, previousType: 5, type: 2 };
    const remoteChange = { row: 1, column: 5, previousType: 5, type: 4 };
    const timeline = timedMatch(reduceEffects, {
        removed: [{ row: 4, column: 3 }, { row: 4, column: 4 }, { row: 1, column: 6 }],
        triggeredSpecials: [
            { row: 4, column: 3, type: 106, color: 2, colorChanges: [localChange] },
            { row: 4, column: 4, type: 105, target: { row: 1, column: 6 } },
            { row: 1, column: 6, type: 106, color: 4, colorChanges: [remoteChange] }
        ],
        colorChanges: [localChange, remoteChange]
    });
    const local = timeline.board.findPiece(3, 3);
    const remote = timeline.board.findPiece(1, 5);
    await timeline.advanceTo(Math.min(160, arrival - 1));
    assert.strictEqual(local.type, 2, 'local bell dyes on its own schedule');
    assert.strictEqual(remote.type, 5);
    assert.strictEqual(remote.targetScale, 1, 'remote dye cannot start before its bell activates');
    await timeline.advanceTo(160);
    assert.strictEqual(local.type, 2, 'at 160ms the local dye is visible in both modes');
    assert.strictEqual(remote.type, 5, 'at 160ms the remote dye has not switched in either mode');
    await timeline.advanceTo(Math.ceil(arrival) + (reduceEffects ? 40 : 100));
    assert.strictEqual(remote.type, 4, 'remote dye switches relative to its own source activation');
    await timeline.finish();
    assert.strictEqual(local.targetScale, 1);
    assert.strictEqual(remote.targetScale, 1);
}

async function checkRepeatedDyes(reduceEffects, remoteFirst) {
    const arrival = (reduceEffects ? 200 : 560) * 0.64;
    const changes = remoteFirst ? [
        { row: 3, column: 3, previousType: 5, type: 4 },
        { row: 3, column: 3, previousType: 4, type: 2 }
    ] : [
        { row: 3, column: 3, previousType: 5, type: 2 },
        { row: 3, column: 3, previousType: 2, type: 3 },
        { row: 3, column: 3, previousType: 3, type: 4 }
    ];
    const paw = { row: 4, column: 4, type: 105, target: { row: 2, column: 3 } };
    const sources = remoteFirst ? [
        paw,
        { row: 2, column: 3, type: 106, color: 4, colorChanges: [changes[0]] },
        { row: 4, column: 3, type: 106, color: 2, colorChanges: [changes[1]] }
    ] : [
        { row: 4, column: 3, type: 106, color: 2, colorChanges: [changes[0]] },
        { row: 3, column: 2, type: 106, color: 3, colorChanges: [changes[1]] },
        paw,
        { row: 2, column: 3, type: 106, color: 4, colorChanges: [changes[2]] }
    ];
    const timeline = timedMatch(reduceEffects, {
        removed: sources.map(source => ({ row: source.row, column: source.column })),
        triggeredSpecials: sources, colorChanges: changes
    });
    const piece = timeline.board.findPiece(3, 3);
    assert.strictEqual(piece.type, 5, 'overlapping bells start from the earliest previousType');
    await timeline.advanceTo(reduceEffects ? 41 : 101);
    assert.strictEqual(piece.type, remoteFirst ? 2 : 3, 'simultaneous local bells use their last target, not the final grid');
    if (!reduceEffects) assert.strictEqual(piece.dyeFromType, 5, 'local crossfade starts from the original color');
    await timeline.advanceTo(Math.ceil(arrival));
    assert.strictEqual(piece.type, remoteFirst ? 2 : 3, 'remote activation cannot rewind the visible color');
    await timeline.advanceTo(Math.ceil(arrival) + (reduceEffects ? 40 : 100));
    assert.strictEqual(piece.type, remoteFirst ? 2 : 4, 'delayed dye respects the ordered change targets');
    if (!reduceEffects && !remoteFirst) assert.strictEqual(piece.dyeFromType, 3, 'remote crossfade uses the preceding visible target');
    await timeline.finish();
    assert.strictEqual(piece.type, timeline.board.core.grid[3][3], 'reordered activations cannot overwrite a logically later dye');
    assert.strictEqual(piece.targetScale, 1);
}

async function checkDyingDuringDye(reduceEffects) {
    const change = { row: 3, column: 3, previousType: 5, type: 2 };
    const timeline = timedMatch(reduceEffects, {
        removed: [{ row: 4, column: 3 }],
        triggeredSpecials: [{ row: 4, column: 3, type: 106, color: 2, colorChanges: [change] }],
        colorChanges: [change]
    });
    const piece = timeline.board.findPiece(3, 3);
    await timeline.advanceTo(reduceEffects ? 20 : 60);
    piece.dying = true;
    piece.targetScale = 0;
    await timeline.advanceTo(reduceEffects ? 41 : 101);
    assert.strictEqual(piece.type, 5, 'pending dye does not recolor a dying piece');
    assert.strictEqual(piece.targetScale, 0, 'pending dye does not restore a dying piece scale');
    assert.strictEqual(piece.dyeDuration, undefined);
    await timeline.advanceTo(reduceEffects ? 81 : 251);
    assert.strictEqual(piece.targetScale, 0, 'dye completion does not restore a dying piece');
    await timeline.finish();
}

(async () => {
    for (const reduceEffects of [false, true]) {
        await checkNestedPaw(reduceEffects);
        await checkLocalAndRemoteBells(reduceEffects);
        await checkRepeatedDyes(reduceEffects, false);
        await checkRepeatedDyes(reduceEffects, true);
        await checkDyingDuringDye(reduceEffects);
        const ordinary = timedMatch(reduceEffects, {
            removed: [{ row: 2, column: 2 }],
            triggeredSpecials: [{ row: 2, column: 2, type: 101 }]
        });
        assert.strictEqual(ordinary.board.findPiece(2, 2), null, 'ordinary special removal remains immediate');
        await ordinary.finish();
    }
    console.log('board renderer combo scopes and intermediate timing: ok');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
