const assert = require('assert');
const Core = require('../js/core/game-core');
const config = require('../js/core/config');
const grid = require('../js/core/grid');
const paw = require('../js/core/tracking-paw');
const bell = require('../js/core/color-bell');
const seededRandom = require('../js/core/solo-snapshot').random;
const P = config.OBJECT_TYPES.PARCEL;
const pos = (row, column) => ({ row, column });
const parcel = (id, row, column) => ({ id, row, column });
const stable = () => Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => (r * 2 + c) % 5 + 1));
function resetCats(core) {
    core.grid = stable();
    core.parcels.forEach(piece => { core.grid[piece.row][piece.column] = P; });
}
function fixture(extra = {}, callbacks = {}) {
    const core = new Core(Object.assign({ rows: 6, columns: 6, colorCount: 5, moveCount: 25,
        goals: [{ type: 'score', target: 999999 }] }, extra), callbacks);
    resetCats(core);
    // Deterministic refill oracle keeps fixtures focused on intended waves. Actual Core
    // removal, gravity, fill and all callbacks still run; cascades are staged explicitly.
    core.callbacks.onFill = () => resetCats(core);
    return core;
}
function tripleSwap(core) {
    core.grid[3][0] = 1; core.grid[3][1] = 1; core.grid[3][2] = 2; core.grid[2][2] = 1;
    return [pos(2, 2), pos(3, 2)];
}
(async () => {
    const bad = [
        { moonbuds: ['6:0'] }, { moonbuds: ['1:1', '1:1'] }, { moonbuds: ['x:y'] },
        { moonbuds: ['1:1'], underlays: { '1:1': 1 } },
        { moonbuds: ['1:1'], obstacles: { '1:1': 1 } },
        { moonbuds: ['1:1'], yarn: { source: '1:1', health: 2 } },
        { moonbuds: ['1:1'], initialSpecials: [{ row: 1, column: 1, type: 103 }] },
        { parcels: [parcel('a', 1, 1)], parcelExits: [2] },
        { parcels: [parcel('a', 1, 1), parcel('a', 2, 1)], parcelExits: [1] },
        { moonbuds: ['1:1'], parcels: [parcel('a', 1, 1)], parcelExits: [1] },
        { parcelExits: [1, 1] }, { moonbuds: ['1:1'], goals: [{ type: 'moonbud', target: 2 }] },
        { parcels: [parcel('a', 1, 1)], parcelExits: [1], goals: [{ type: 'parcel', target: 0 }] }
    ];
    bad.forEach(extra => assert.throws(() => fixture(extra), /Invalid/));
    assert(!config.isSpecialType(P));
    assert(!config.getCommonTypes(5).includes(P));
    assert.strictEqual(grid.getMatches([[P, P, P], [1, 2, 3], [2, 3, 4]]).length, 0);

    let core = fixture({ moonbuds: ['3:0', '4:4'] });
    const phases = [], waves = [];
    core.callbacks.onMoonbudPhase = async event => { await Promise.resolve(); phases.push(event.open); };
    core.callbacks.onMatch = event => { waves.push({ phase: core.moonbudOpen, hits: event.moonbudHits }); };
    let fills = 0;
    core.callbacks.onFill = () => {
        resetCats(core);
        if (++fills === 1) core.grid[4][3] = core.grid[4][4] = core.grid[4][5] = 2;
    };
    assert(await core.trySwap(...tripleSwap(core)));
    assert.deepStrictEqual(waves.map(wave => wave.phase), [true, true]);
    assert.deepStrictEqual(waves.map(wave => wave.hits), [[pos(3, 0)], [pos(4, 4)]]);
    assert.deepStrictEqual(phases, [false], 'full manual cascade toggles exactly once');
    assert.strictEqual(core.getMoonbudsLeft(), 0);

    core = fixture({ moonbuds: ['3:0'] });
    assert(core.isBlocked(pos(3, 0)), 'both bud phases lock the original cat');
    assert.strictEqual(await core.trySwap(pos(3, 0), pos(3, 1)), false);
    assert.strictEqual(await core.useTool('color', pos(3, 0)), false);
    assert(await core.useTool('hammer', pos(0, 5)));
    assert.strictEqual(core.moonbudOpen, false);
    assert.strictEqual(await core.useTool('hammer', pos(3, 0)), false, 'closed direct target is rejected without consumption');
    assert.strictEqual(core.moonbudOpen, false);
    resetCats(core);
    const collectedBeforeClosed = core.collectedCounts[1] || 0;
    let closedFeedback = false;
    core.callbacks.onMatch = event => {
        assert(!event.removed.some(p => p.row === 3 && p.column === 0));
        if (event.moonbudClosedHits.some(p => p.row === 3 && p.column === 0)) {
            closedFeedback = true;
            assert.strictEqual(core.grid[3][0], 1, 'closed match keeps original matched cat');
            assert.deepStrictEqual(event.moonbudHits, []);
            assert.strictEqual(event.removed.length, 2);
            assert.strictEqual(core.collectedCounts[1] - collectedBeforeClosed, 2, 'protected cat is not collected');
        }
    };
    assert(await core.trySwap(...tripleSwap(core)));
    assert(closedFeedback);
    assert.strictEqual(core.getMoonbudsLeft(), 1, 'closed bud preserves its cat and flower');
    assert.strictEqual(core.moonbudOpen, true);
    const snapshot = JSON.stringify(core.moonbudCells);
    core.pauseTimer(); core.resumeTimer();
    assert.strictEqual(core.moonbudOpen, true);
    core.grid = stable();
    assert.strictEqual(await core.trySwap(pos(0, 0), pos(0, 1)), false);
    assert.strictEqual(core.moonbudOpen, true);
    const reshuffleCat = core.grid[3][0];
    await core.autoReshuffle();
    assert.strictEqual(core.grid[3][0], reshuffleCat, 'reshuffle preserves flower cat');
    assert.strictEqual(core.moonbudOpen, true);
    assert.strictEqual(JSON.stringify(core.moonbudCells), snapshot);

    for (const open of [true, false]) {
        core = fixture({ moonbuds: ['2:2'] });
        core.moonbudOpen = open;
        const cat = core.grid[2][2];
        core.grid[3][2] = core.grid[4][2] = 0;
        core.applyGravityBlocked();
        assert.strictEqual(core.grid[2][2], cat, 'flower cat cannot fall in either phase');
        core.grid[3][1] = 0;
        core.iceGrid[2][1] = 1;
        core.applySlides();
        assert.strictEqual(core.grid[2][2], cat, 'flower cat cannot slide in either phase');
    }

    core = fixture({ moonbuds: ['2:2'] });
    assert(await core.useTool('hammer', pos(2, 2)), 'open flower accepts direct hammer');
    assert.strictEqual(core.getMoonbudsLeft(), 0);
    assert(!core.isBlocked(pos(2, 2)), 'collected flower releases the square');

    for (const attack of ['bomb', 'rocket', 'ballRocket']) {
        core = fixture({ moonbuds: ['2:2'] });
        core.moonbudOpen = false;
        const cat = core.grid[2][2];
        let feedback = false;
        core.callbacks.onMatch = event => {
            assert(!event.removed.some(p => p.row === 2 && p.column === 2));
            if (event.moonbudClosedHits.some(p => p.row === 2 && p.column === 2)) feedback = true;
            assert.strictEqual(core.grid[2][2], cat);
        };
        if (attack === 'bomb') assert(await core.useTool('bomb', pos(2, 1)));
        if (attack === 'rocket') { core.grid[2][0] = 101; assert(await core.trySwap(pos(2, 0), pos(2, 1))); }
        if (attack === 'ballRocket') {
            core.grid[0][0] = 104; core.grid[0][1] = 101;
            core.setSpecialBaseType(pos(0, 1), cat);
            assert(await core.trySwap(pos(0, 0), pos(0, 1)));
        }
        assert(feedback, attack + ' reports protected direct hit');
        assert.strictEqual(core.getMoonbudsLeft(), 1);
    }

    // A color-ball combo must directly hit yarn without replacing or triggering its original cat.
    const yarnConfig = { source: '5:5', health: 3, spreadEvery: 2, maxVines: 3 };
    for (const special of Object.values(config.SPECIAL_TYPES).filter(type => type !== config.SPECIAL_TYPES.COLOR_BALL)) {
        core = fixture({ yarn: yarnConfig });
        core.yarnVines['2:2'] = true;
        core.grid[2][2] = core.grid[5][5] = 1;
        core.grid[0][0] = config.SPECIAL_TYPES.COLOR_BALL;
        core.grid[0][1] = special;
        core.setSpecialBaseType(pos(0, 1), 1);
        const hits = [];
        core.callbacks.onMatch = event => {
            if (hits.length) return;
            hits.push(event);
            assert(event.yarnVineHits.some(piece => piece.row === 2 && piece.column === 2));
            assert(event.yarnRootHit);
            for (const held of [pos(2, 2), pos(5, 5)]) {
                assert.strictEqual(core.grid[held.row][held.column], 1, 'yarn retains original cat during combo ' + special);
                assert(!event.removed.some(piece => grid.comparePositions(piece, held)));
                assert(!event.triggeredSpecials.some(piece => grid.comparePositions(piece, held)));
                assert.strictEqual(core.getSpecialBaseType(held), 0);
            }
        };
        assert(await core.trySwap(pos(0, 0), pos(0, 1)));
        assert(hits.length);
        assert.strictEqual(core.yarnVines['2:2'], undefined);
        assert.strictEqual(core.getYarnHealth(), 2, 'combo still damages source exactly once');
    }

    core = fixture({ yarn: { ...yarnConfig, source: '0:1' }, trackingPaw: true });
    core.yarnVines['2:2'] = true;
    core.grid[2][2] = 1;
    core.grid[0][0] = config.SPECIAL_TYPES.TRACKING_PAW;
    let remoteVineHit = false;
    core.callbacks.onMatch = event => {
        const launch = event.triggeredSpecials.find(piece => piece.type === config.SPECIAL_TYPES.TRACKING_PAW);
        if (!launch) return;
        assert.deepStrictEqual(launch.target, pos(2, 2), 'root already hit by local cross leaves remote vine target');
        assert.strictEqual(launch.targetYarnVine, true);
        assert(event.yarnVineHits.some(piece => grid.comparePositions(piece, pos(2, 2))));
        assert(!event.removed.some(piece => grid.comparePositions(piece, pos(2, 2))));
        assert.strictEqual(core.grid[2][2], 1);
        remoteVineHit = true;
    };
    assert(await core.useTool('hammer', pos(0, 0)));
    assert(remoteVineHit);

    core = fixture({ yarn: yarnConfig });
    core.yarnVines['2:2'] = true;
    core.grid[2] = [1, 1, 1, 1, 1, 2];
    let generationVineHit = false;
    core.callbacks.onMatch = event => {
        if (!event.yarnVineHits.some(piece => grid.comparePositions(piece, pos(2, 2)))) return;
        assert.strictEqual(core.grid[2][2], 1);
        assert(!event.generated.some(piece => grid.comparePositions(piece.pos, pos(2, 2))));
        assert(!event.removed.some(piece => grid.comparePositions(piece, pos(2, 2))));
        generationVineHit = true;
    };
    await core.processGrid();
    assert(generationVineHit, 'normal special generation also preserves the directly matched vine cat');

    core = fixture({ moonbuds: ['2:2'] });
    core.moonbudOpen = false;
    core.grid[2][2] = 102; // Synthetic restored special under a closed flower.
    core.callbacks.onFill = () => { resetCats(core); core.grid[2][2] = 102; };
    let protectedTriggers = 0;
    core.callbacks.onMatch = event => { protectedTriggers += event.triggeredSpecials.filter(p => p.row === 2 && p.column === 2).length; };
    assert(await core.useTool('bomb', pos(2, 1)));
    assert.strictEqual(protectedTriggers, 0, 'remote hit cannot trigger a closed flower special');
    assert.strictEqual(core.grid[2][2], 102);

    core = fixture({ moonbuds: ['2:0', '2:1', '2:2'] });
    core.moonbudOpen = false;
    core.grid[2][0] = core.grid[2][1] = core.grid[2][2] = 1;
    await core.processGrid();
    assert.strictEqual(core.score, 0, 'fully protected match causes no repeat scoring');
    assert.strictEqual(core.maxCascade, 0, 'fully protected match does not loop');
    assert.strictEqual(core.getMoonbudsLeft(), 3);

    let initialReshuffles = 0;
    core = new Core({ rows: 3, columns: 3, colorCount: 5, moonbuds: ['1:1'],
        goals: [{ type: 'score', target: 999999 }] }, { onReshuffle: () => initialReshuffles++ }, seededRandom(3));
    assert(core.hasValidMoves(), 'flower locks cannot leave a new board without a legal swap');
    assert.strictEqual(core.grid[1][1], 4, 'initial recovery preserves the original flower cat');
    assert.strictEqual(initialReshuffles, 0, 'constructor recovery does not animate before the board is attached');

    core = new Core({ rows: 4, columns: 4, colorCount: 5, moonbuds: ['0:1', '1:0', '1:2', '2:1'],
        initialSpecials: [{ row: 1, column: 1, type: 101 }] }, {}, seededRandom(0));
    assert(core.hasValidMoves());
    assert.strictEqual(core.grid[1][1], 101, 'initial recovery preserves configured special at its position');
    assert.strictEqual(core.getSpecialBaseType(pos(1, 1)), 3, 'configured special retains original base color');

    {
        const open = false;
        core = new Core({ rows: 3, columns: 3, colorCount: 5, moonbuds: ['1:0', '1:1', '1:2'],
            goals: [{ type: 'score', target: 999999 }] }, {}, seededRandom(9));
        core.grid = [[2, 3, 4], [1, 1, 1], [3, 4, 5]];
        core.moonbudOpen = open;
        let reshuffles = 0;
        core.callbacks.onReshuffle = () => reshuffles++;
        assert(!core.hasValidMoves(), 'fixture starts with no available swap');
        await core.autoReshuffle();
        assert.strictEqual(reshuffles, 1, 'fixed flower triple cannot reject every reshuffle candidate');
        assert(core.hasValidMoves());
        assert.deepStrictEqual(core.grid[1], [1, 1, 1]);
        assert(grid.getMatches(core.grid).every(match => match.every(piece => core.moonbudCells[piece.row + ':' + piece.column])),
            'reshuffle permits only the fixed flower match, never matches containing free cats');
        assert.strictEqual(core.moonbudOpen, open, 'recovery does not advance the flower phase');
        assert.strictEqual(core.score, 0);
    }

    core = fixture({ moonbuds: ['2:0', '2:1', '2:2'] });
    core.grid[2][0] = core.grid[2][1] = core.grid[2][2] = 1;
    assert(await core.useTool('hammer', pos(0, 0)));
    assert.strictEqual(core.getMoonbudsLeft(), 0, 'open all-flower match still collects on the next valid action');

    core = fixture({ moonbuds: ['2:2'] });
    assert.deepStrictEqual(bell.dye(core, pos(2, 1), 4, []).filter(p => p.row === 2 && p.column === 2), []);
    assert.deepStrictEqual(paw.target(core, pos(5, 5), [], false), pos(2, 2), 'open flower retains its target priority');
    core.moonbudOpen = false;
    assert.notDeepStrictEqual(paw.target(core, pos(5, 5), [], false), pos(2, 2));

    for (const open of [true, false]) {
        core = fixture({ moonbuds: ['2:2'], trackingPaw: true });
        core.moonbudOpen = open;
        core.grid[0][0] = config.SPECIAL_TYPES.TRACKING_PAW;
        const pawEvents = [];
        core.callbacks.onMatch = event => pawEvents.push(event);
        assert(await core.useTool('hammer', pos(0, 0)), 'Core triggers a real paw attack');
        const launch = pawEvents.flatMap(event => event.triggeredSpecials)
            .find(piece => piece.type === config.SPECIAL_TYPES.TRACKING_PAW);
        assert(launch && launch.target, 'paw trigger reports its actual remote target');
        if (open) {
            assert.deepStrictEqual(launch.target, pos(2, 2));
            assert(pawEvents.some(event => event.moonbudHits.some(piece => piece.row === 2 && piece.column === 2)));
            assert.strictEqual(core.getMoonbudsLeft(), 0, 'open flower is collected through the Core paw path');
        } else {
            assert.notDeepStrictEqual(launch.target, pos(2, 2));
            assert(pawEvents.every(event => !event.removed.some(piece => piece.row === 2 && piece.column === 2)));
            assert.strictEqual(core.getMoonbudsLeft(), 1, 'closed flower is preserved and never remotely selected');
        }
    }

    core = fixture({ moonbuds: ['2:2'] });
    core.moonbudOpen = false;
    core.grid[2] = [1, 1, 1, 1, 1, 2];
    let generatedOnFlower = false;
    core.callbacks.onMatch = event => {
        generatedOnFlower = generatedOnFlower || event.generated.some(piece => piece.pos.row === 2 && piece.pos.column === 2);
        assert(!event.removed.some(piece => piece.row === 2 && piece.column === 2));
    };
    await core.processGrid();
    assert.strictEqual(generatedOnFlower, false, 'special generation cannot replace a protected flower cat');

    core = fixture({ moonbuds: ['3:3'], moveCount: 1, goals: [{ type: 'moonbud', target: 1 }] });
    core.grid[3][2] = config.SPECIAL_TYPES.H_ROCKET;
    assert(await core.trySwap(pos(3, 2), pos(3, 1)));
    assert(core.won, 'special hit completes bud on last step before loss');
    assert.strictEqual(core.movesLeft, 0);
    assert.strictEqual(core.getMoonbudsLeft(), 0);
    assert.strictEqual(core.moonbudOpen, false);

    const packageConfig = { parcels: [parcel('a', 2, 2)], parcelExits: [2] };
    core = fixture(packageConfig);
    const moves = core.movesLeft;
    for (const type of [1, config.SPECIAL_TYPES.H_ROCKET, config.SPECIAL_TYPES.COLOR_BALL]) {
        core.grid[2][1] = type;
        assert(!core.validateMove(pos(2, 1), pos(2, 2)));
        assert.strictEqual(await core.trySwap(pos(2, 1), pos(2, 2)), false);
    }
    for (const tool of ['hammer', 'bomb', 'color']) assert.strictEqual(await core.useTool(tool, pos(2, 2)), false);
    assert.strictEqual(core.movesLeft, moves);
    assert(!core.isBlocked(pos(2, 2)), 'package occupies grid without locking square');
    assert.deepStrictEqual(bell.dye(core, pos(2, 1), 4, []).filter(p => p.column === 2), []);
    assert.strictEqual(core.grid[2][2], P);
    assert.notDeepStrictEqual(paw.target(core, pos(5, 5), [], false), pos(2, 2));

    for (const attack of ['hammer', 'bomb', 'rocket', 'verticalRocket', 'doubleBall', 'ballRocket']) {
        core = fixture(packageConfig);
        let hit = false;
        core.callbacks.onMatch = event => {
            hit = true;
            assert(!event.removed.some(p => core.isParcel(p)), attack + ' cannot remove parcel');
            assert.strictEqual(core.grid[2][2], P, attack + ' cannot convert parcel');
        };
        if (attack === 'hammer') await core.useTool('hammer', pos(2, 1));
        if (attack === 'bomb') await core.useTool('bomb', pos(2, 1));
        if (attack === 'rocket') { core.grid[2][0] = 101; await core.trySwap(pos(2, 0), pos(2, 1)); }
        if (attack === 'verticalRocket') { core.grid[0][2] = 102; await core.useTool('hammer', pos(0, 2)); }
        if (attack === 'doubleBall' || attack === 'ballRocket') {
            core.grid[0][0] = 104; core.grid[0][1] = attack === 'doubleBall' ? 104 : 101;
            await core.trySwap(pos(0, 0), pos(0, 1));
        }
        assert(hit);
        assert.strictEqual(core.getParcelsLeft() + core.parcelDelivered, 1, 'immune target is retained or delivered through cleared path');
        if (attack !== 'doubleBall' && attack !== 'verticalRocket') assert.strictEqual(core.parcelDelivered, 0);
        if (attack === 'verticalRocket') assert.strictEqual(core.parcelDelivered, 1, 'column attack passes through parcel and clears cats below');
        assert.strictEqual(core.collectedCounts[P], undefined);
    }

    core = fixture({ parcels: [parcel('a', 1, 2)], parcelExits: [2], obstacles: { '3:2': 1 } });
    core.grid[0][2] = 102;
    assert(await core.useTool('hammer', pos(0, 2)));
    assert.strictEqual(core.iceGrid[3][2], 0, 'column attack opens ice-covered path');
    assert.strictEqual(core.parcelDelivered, 0, 'ice hit retains its cat and still blocks transport this wave');
    assert.deepStrictEqual(core.parcels, [parcel('a', 4, 2)], 'released ice cat falls first and retains the bottom stop');
    core.grid[0][2] = 102;
    assert(await core.useTool('hammer', pos(0, 2)));
    assert.strictEqual(core.parcelDelivered, 1, 'later column clear frees the transport path');

    core = fixture({ parcels: [parcel('a', 1, 2)], parcelExits: [2], obstacles: { '1:3': 1 } });
    core.grid[2][3] = 0;
    core.applySlides();
    assert.strictEqual(core.grid[1][2], P, 'package cannot slide sideways beneath lock');
    core.grid[2][2] = core.grid[3][2] = 0;
    await core.settleBoard();
    assert.deepStrictEqual(core.parcels, [parcel('a', 3, 2)], 'package identity follows vertical fall');
    await core.autoReshuffle();
    assert.deepStrictEqual(core.parcels, [parcel('a', 3, 2)]);
    assert.strictEqual(core.grid[3][2], P);
    assert.strictEqual(core.parcelTotal, 1);

    core = fixture({ parcels: [parcel('a', 3, 2)], parcelExits: [2], goals: [{ type: 'parcel', target: 1 }], moveCount: 1 });
    let gravityArrived = false, deliveries = 0;
    core.callbacks.onGravity = async event => {
        if (event.changes.some(change => change[1].row === 5 && core.isParcel(change[1]))) {
            assert.strictEqual(core.parcelDelivered, 0);
            await Promise.resolve(); gravityArrived = true;
        }
    };
    core.callbacks.onParcelDelivered = async event => {
        assert(gravityArrived, 'delivery waits for gravity arrival');
        assert.deepStrictEqual(event, { parcels: [parcel('a', 5, 2)], delivered: 1, total: 1 });
        assert.strictEqual(core.grid[5][2], 0);
        deliveries++; await Promise.resolve();
    };
    core.grid[4][2] = 0;
    core.grid[5][1] = 101;
    assert(await core.trySwap(pos(5, 1), pos(5, 0)));
    assert(core.won, 'delivered goal wins on final move');
    assert.strictEqual(deliveries, 1);
    await core.settleBoard();
    assert.strictEqual(deliveries, 1);
    assert.strictEqual(core.getParcelsLeft(), 0);

    core = fixture(Object.assign({}, packageConfig, { moonbuds: ['1:1'], moveCount: 1 }));
    assert(await core.trySwap(...tripleSwap(core)));
    assert(core.ended && !core.won);
    const preserved = [JSON.stringify(core.parcels), JSON.stringify(core.moonbudCells), core.moonbudOpen, core.parcelDelivered];
    assert(core.revive(5, 0));
    assert.deepStrictEqual([JSON.stringify(core.parcels), JSON.stringify(core.moonbudCells), core.moonbudOpen, core.parcelDelivered], preserved);

    core = fixture();
    let phaseEvents = 0, packageEvents = 0;
    core.callbacks.onMoonbudPhase = () => phaseEvents++;
    core.callbacks.onParcelDelivered = () => packageEvents++;
    assert(await core.trySwap(...tripleSwap(core)));
    assert.strictEqual(core.movesLeft, 24);
    assert.strictEqual(core.getMoonbudsLeft(), 0);
    assert.strictEqual(core.getParcelsLeft(), 0);
    assert.strictEqual(phaseEvents + packageEvents, 0);
    console.log('new-obstacles: all assertions passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
