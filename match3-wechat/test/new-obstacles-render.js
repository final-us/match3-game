'use strict';
const assert = require('assert');
const Board = require('../js/render/board-render');
const GameCore = require('../js/core/game-core');
const shapes = require('../js/render/new-obstacles-render');
const Guide = require('../js/render/onboarding');
const onboarding = require('../js/core/onboarding');
const gameLayout = require('../js/render/game-layout');
const assets = require('../js/render/assets');
const createClock = require('./helpers/virtual-animation-clock');
function context() {
    const records = [];
    return { records, ctx: new Proxy({}, {
        get(target, key) {
            if (key === 'measureText') return value => ({ width: Array.from(String(value)).reduce((sum, ch) =>
                sum + (/[^\x00-\xff]/.test(ch) ? 1 : 0.55), 0) * (parseFloat((target.font || '14px').match(/[\d.]+px/)[0]) || 14) });
            if (/^create.*Gradient$/.test(key)) return () => ({ addColorStop() {} });
            return (...args) => records.push({ key, args, font: target.font, align: target.textAlign,
                strokeStyle: target.strokeStyle, fillStyle: target.fillStyle, lineWidth: target.lineWidth });
        }, set(target, key, value) { target[key] = value; if (key === 'globalAlpha') records.push({ key, args: [value] }); return true; }
    }) };
}
function rings(records) {
    return records.filter(item => item.key === 'arc' && ['#DCDCE6', '#C99B92'].includes(item.strokeStyle)).map(item => {
        const [x, y, radius, start, end] = item.args;
        assert(Math.abs(end - start - Math.PI * 2) < 1e-10, 'every goal retains a full circular track');
        const arc = records.find(candidate => candidate.key === 'arc' && candidate.strokeStyle === '#7FB9D8' &&
            candidate.args[0] === x && candidate.args[1] === y && candidate.args[2] === radius);
        return { x, y, radius, edge: radius + item.lineWidth / 2,
            progress: item.strokeStyle === '#C99B92' ? 1 : arc ? (arc.args[4] - arc.args[3]) / (Math.PI * 2) : 0 };
    });
}
function seals(records) {
    return records.filter(item => item.key === 'arc' && item.fillStyle === '#D77F97' && item.strokeStyle === '#FFF7FA');
}
function hud(board, record) {
    record.records.length = 0; board.drawTopBar();
    return { rings: rings(record.records), seals: seals(record.records),
        text: record.records.filter(item => item.key === 'fillText').map(item => item.args[0]) };
}
function core() {
    return { level: { id: 1, rows: 8, columns: 8, moonbuds: ['1:6'], parcelExits: [3],
        goals: [{ type: 'moonbud', target: 1 }, { type: 'parcel', target: 1 }] },
        grid: Array.from({ length: 8 }, () => Array(8).fill(1)), moonbudCells: { '1:6': true },
        moonbudOpen: true, parcelTotal: 1, parcelDelivered: 0, jellyGrid: [], iceGrid: [],
        score: 0, movesLeft: 12, getYarnHealth: () => 0, isBlocked: () => false };
}
async function run() {
    const recorded = context();
    for (const openState of [true, false]) {
        recorded.records.length = 0;
        shapes.moonbud(recorded.ctx, 20, 20, 24, openState);
        const petals = recorded.records.filter(x => x.key === 'ellipse');
        assert.equal(petals.length, 8, 'whole-cell petals/leaflets, not a corner emblem');
        assert(recorded.records.some(x => x.key === 'fillText' && x.args[0] === (openState ? '开' : '合')),
            'colour-independent state label');
        assert(recorded.records.some(x => x.key === 'lineTo' && x.args[0] > 10), 'frame spans the 24px tile');
        if (openState) assert(petals[0].args[2] > 3, 'open petals have a broad silhouette');
        else assert(petals[0].args[2] < 1.1 && petals[0].args[3] > 2.7, 'closed leaves fold into a narrow silhouette');
    }
    for (const width of [320, 390, 430]) {
        const record = context(), board = new Board(record.ctx, { width, height: 740, reduceEffects: true });
        board.setGame(core());
        board.drawTopBar();
        assert(!record.records.some(x => x.key === 'fillText' && /开放 ·|闭合 ·|成功操作|刚才闭合|花苞已收齐/.test(x.args[0])));
        assert(board.boardY > Math.max(...record.records.filter(x => x.key === 'fillText').map(x => x.args[2])) + 10);
        for (const key of ['moonbud', 'parcel']) {
            record.records.length = 0;
            const buttons = Guide.draw(record.ctx, { width, height: 568, safeTop: 44, safeBottom: 34 }, key);
            assert(buttons.skip.x >= 0 && buttons.confirm.x + buttons.confirm.w <= width);
            const body = record.records.filter(x => x.key === 'fillText').slice(1, -2);
            assert(body.every(x => x.args[2] < buttons.skip.y - 10), 'body clears skippable controls');
        }
        record.records.length = 0;
        const packagePiece = board.makePiece(201, 7, 3);
        const center = board.pieceCenter(7, 3);
        packagePiece.x = center.x; packagePiece.y = center.y;
        board.drawPiece(packagePiece);
        assert(!record.records.some(x => x.key === 'drawImage'), 'parcel has no cat or ice base');
        record.records.length = 0;
        shapes.exit(record.ctx, center.x, board.boardY + board.boardH - board.tileSize * 0.035, board.tileSize);
        const exitTranslate = record.records.find(x => x.key === 'translate').args;
        record.records.filter(x => x.key === 'lineTo' || x.key === 'moveTo').forEach(x => {
            assert(exitTranslate[0] + x.args[0] >= board.boardX && exitTranslate[0] + x.args[0] <= board.boardX + board.boardW);
            assert(exitTranslate[1] + x.args[1] < board.boardY + board.boardH, 'exit remains inside bottom board edge');
        });
        const order = [];
        board.drawPiece = () => order.push('cat');
        const original = shapes.moonbud, originalExit = shapes.exit;
        shapes.moonbud = () => order.push('flower');
        shapes.exit = () => order.push('foregroundExit');
        board.drawJellies = board.drawJellyBadges = board.drawIces = board.drawYarn = board.drawParticles = board.drawSpecialEffects = () => {};
        board.drawBoard(); shapes.moonbud = original; shapes.exit = originalExit;
        assert(order.indexOf('flower') > order.lastIndexOf('cat'), 'the entire flower frame is above opaque cats');
        assert(order.indexOf('foregroundExit') > order.lastIndexOf('cat'), 'opaque bottom cat cannot hide exit');
    }
    for (const reduced of [false, true]) {
        const record = context(), board = new Board(record.ctx, { width: 320, height: 568, reduceEffects: reduced });
        board.setGame(core());
        const snapshots = [];
        const clock = createClock(() => snapshots.push(Object.keys(board.visualMoonbuds).length));
        board.wait = clock.wait;
        // Core has changed before its async-capable match callback.
        board.core.moonbudCells = {};
        assert.equal(Object.keys(board.visualMoonbuds).length, 1);
        const pending = board.animateMatch({ removed: [], moonbudHits: [{ row: 1, column: 6 }],
            triggeredSpecials: [{ type: 105, row: 4, column: 4, target: { row: 1, column: 6 } }] });
        assert.equal(Object.keys(board.visualMoonbuds).length, 1, 'tracking flower waits for arrival');
        assert.equal(board.moonbudEffects.length, 0, 'no collection cue before actual arrival');
        await clock.drain(pending);
        assert.equal(snapshots[0], 1);
        assert.equal(Object.keys(board.visualMoonbuds).length, 0);
        assert.equal(board.moonbudEffects[0].kind, 'collect');
        assert.equal(board.moonbudEffects[0].duration, reduced ? 160 : 360);
        const phase = board.animateMoonbudPhase({ open: false });
        await clock.drain(phase); assert.equal(board.visualMoonbudOpen, false);
        board.core.parcelDelivered = 1;
        const parcel = board.makePiece(201, 7, 3); board.pieces.push(parcel);
        assert.equal(board.visualParcelDelivered, 0, 'goal snapshot does not finish during gravity');
        await clock.drain(board.animateParcelDelivered({ parcels: [{ id: 'p', row: 7, column: 3 }], delivered: 1, total: 1 }));
        assert.equal(board.visualParcelDelivered, 1);
        assert.equal(board.pieces.includes(parcel), false, 'no parcel ghost during refill');
        if (reduced) assert.equal(board.particles.length, 0);
        board.setGame(core());
        assert.equal(Object.keys(board.visualMoonbuds).length, 1); assert.equal(board.visualParcelDelivered, 0);
        assert.equal(board.visualMoonbudOpen, true);
        assert.equal(board.moonbudEffects.length, 0, 'setGame clears visual tails');
    }
    for (const reduced of [false, true]) {
        const record = context();
        const level = { id: 1, rows: 5, columns: 5, pieceTypes: [1, 2, 3, 4], moveCount: 12,
            moonbuds: ['1:4'], goals: [{ type: 'moonbud', target: 1 }] };
        const board = new Board(record.ctx, { width: 320, height: 568, reduceEffects: reduced });
        const game = new GameCore(level, { onMatch: data => board.animateMatch(data) });
        game.grid = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => (r + c) % 4 + 1));
        game.grid[1][0] = 101; game.grid[3][0] = 105;
        board.setGame(game);
        const snapshots = [];
        const clock = createClock(() => {
            record.records.length = 0; board.drawTopBar();
            snapshots.push({ left: Object.keys(board.visualMoonbuds).length,
                rings: rings(record.records), seals: seals(record.records).length,
                hud: record.records.filter(x => x.key === 'fillText').map(x => x.args[0]) });
        });
        board.wait = clock.wait;
        const pending = game.useTool('hammer', { row: 3, column: 0 });
        assert.equal(Object.keys(board.visualMoonbuds).length, 1, 'paw→rocket flower persists at launch');
        await clock.drain(pending);
        assert.equal(snapshots[0].left, 1, 'relay flower survives until rocket starts at paw arrival');
        assert.equal(snapshots[0].hud[snapshots[0].hud.indexOf('花苞') + 1], '1', 'HUD count survives relay delay');
        assert.equal(snapshots[0].rings[0].progress, 0, 'ring also waits for the actual relay hit');
        assert.equal(snapshots[0].seals, 0, 'launch does not show a completion seal');
        assert.equal(Object.keys(board.visualMoonbuds).length, 0);
        assert(snapshots.some(state => state.left === 0 && state.rings[0].progress === 1 && state.seals === 1),
            'closed ring and one seal appear on actual hit');
        assert(clock.tape.some(wait => wait.duration === Math.ceil((reduced ? 200 : 560) * 0.64)), 'uses existing relay arrival time');
    }
    for (const reduced of [false, true]) {
        const record = context();
        const level = { id: 1, rows: 5, columns: 5, pieceTypes: [1, 2, 3, 4], moveCount: 12,
            moonbuds: ['1:4'], goals: [{ type: 'moonbud', target: 1 }] };
        const board = new Board(record.ctx, { width: 320, height: 568, reduceEffects: reduced });
        const game = new GameCore(level, { onMatch: data => board.animateMatch(data),
            onMoonbudPhase: data => board.animateMoonbudPhase(data) });
        game.grid = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => (r + c) % 4 + 1));
        game.grid[1][0] = 101; game.grid[3][0] = 105; game.moonbudOpen = false;
        board.setGame(game);
        const snapshots = [];
        const clock = createClock(dt => {
            board.update(dt);
            snapshots.push({ time: clock.now, feedback: board.moonbudFeedback, left: Object.keys(board.visualMoonbuds).length });
        });
        board.wait = clock.wait;
        const pending = game.useTool('hammer', { row: 3, column: 0 });
        assert.equal(board.moonbudFeedback, null, 'closed relay must not claim a hit at launch');
        await clock.drain(pending);
        assert.equal(snapshots[0].feedback, null, 'closed relay has no feedback before paw→rocket impact');
        assert(snapshots.some(state => state.feedback), 'real protected cell creates a closed-hit message');
        assert.equal(Object.keys(board.visualMoonbuds).length, 1, 'closed hit keeps the fixed flower');
        assert.equal(game.getMoonbudsLeft(), 1);
        assert.equal(game.grid[1][4], (1 + 4) % 4 + 1, 'closed flower protects its original cat');
        assert(board.findPiece(1, 4) && !board.findPiece(1, 4).dying, 'protected cat remains visible');
        record.records.length = 0; board.drawTopBar();
        assert(!record.records.some(x => x.key === 'fillText' && /刚才闭合|开放 ·|闭合 ·|成功操作/.test(x.args[0])),
            'the HUD has no flower explanation line, including after a protected hit');
        assert.equal(board.visualMoonbudOpen, true, 'the normal successful-action phase still advances');
        board.update(1800); assert.equal(board.moonbudFeedback, null, 'explanation expires independently of animation');
        board.addMoonbudEffect('1:4', 'closedHit', false, false);
        board.moonbudFeedback = { kind: 'closedHit', elapsed: 0, duration: 1800 };
        board.setGame(game); assert.equal(board.moonbudFeedback, null, 'scene reset clears the explanation');
        assert.equal(board.moonbudEffects.length, 0);

        // A dye-only payload is not an elimination, even on a closed flower.
        game.moonbudOpen = false; board.setGame(game);
        const noHit = board.animateMatch({ removed: [], colorChanges: [
            { row: 1, column: 4, previousType: 1, type: 2 }
        ] });
        await clock.drain(noHit);
        assert.equal(board.moonbudFeedback, null);
        assert.equal(board.moonbudEffects.length, 0);
    }
    for (const width of [320, 390, 430]) {
        const record = context(), board = new Board(record.ctx, { width, height: 568 });
        const game = core();
        game.timeLimitMs = 60000; game.timeLeftMs = 9000;
        game.level.goals.push({ type: 'collect', pieceType: 1, target: 30 }, { type: 'score', target: 9000 });
        board.setGame(game);
        const originalTile = board.tileSize, originalY = board.boardY;
        for (const open of [true, false]) {
            board.visualMoonbudOpen = open;
            record.records.length = 0; board.drawTopBar();
            const text = record.records.filter(x => x.key === 'fillText');
            ['花苞', '配送', '收集', '30', '目标分', '9000', '时间', '00:09'].forEach(label =>
                assert(text.some(item => item.args[0] === label), 'mixed timed HUD retains ' + label));
            assert(!text.some(item => /开放 ·|闭合 ·|成功操作|刚才闭合|花苞已收齐/.test(item.args[0])),
                'flower state does not restore the removed explanation line');
            assert.equal(board.tileSize, originalTile); assert.equal(board.boardY, originalY);
            const goalText = text.slice(6);
            goalText.forEach(item => {
                const size = parseFloat(item.font.match(/[\d.]+px/)[0]);
                const half = Array.from(item.args[0]).reduce((sum, ch) => sum + (/[^\x00-\xff]/.test(ch) ? 1 : 0.55), 0) * size / 2;
                const left = item.args[1] - (item.align === 'center' ? half : item.align === 'right' ? half * 2 : 0);
                assert(left >= 8 && left + half * 2 <= width - 8, 'HUD text remains inside its card');
                assert(item.args[2] + size / 2 <= board.boardY - 10, 'all goal/state text clears the board in the responsive HUD');
            });
        }
        board.visualMoonbuds = {}; board.visualParcelDelivered = 1;
        game.collectedCounts = { 1: 30 }; game.score = 9000;
        record.records.length = 0; board.drawTopBar();
        const completed = record.records.filter(x => x.key === 'fillText').map(x => x.args[0]);
        assert.equal(rings(record.records).filter(ring => ring.progress === 1).length, 4);
        assert.equal(seals(record.records).length, 4, 'each completed ring has its own non-colour seal');
        assert(!completed.includes('完成'), 'completion does not restore text capsules');
        assert(!completed.includes('30') && !completed.includes('9000', 6), 'completed goal values are hidden');
        assert(!completed.includes('花苞已收齐') && completed.includes('00:09'), 'completion uses rings and preserves the timer');
    }
    // Two collect subjects keep independent progress, including restored/over-target counts.
    {
        const record = context(), board = new Board(record.ctx, { width: 320, height: 568 });
        const game = core(); game.level.moonbuds = []; game.moonbudCells = {};
        game.level.goals = [{ type: 'collect', pieceType: 1, target: 12 }, { type: 'collect', pieceType: 2, target: 12 }];
        game.collectedCounts = { 1: 0, 2: 6 };
        const get = assets.get;
        try {
            assets.get = key => /^piece[12]$/.test(key) ? { key, width: 24, height: 24 } : get(key);
            board.setGame(game);
            const initial = hud(board, record);
            assert.deepEqual(initial.rings.map(ring => ring.progress), [0, .5]);
            assert.deepEqual(record.records.filter(item => item.key === 'drawImage').map(item => item.args[0].key), ['piece1', 'piece2']);
            assert(initial.text.includes('12') && initial.text.includes('6'));
            game.collectedCounts = { 1: -2, 2: 19 };
            const clamped = hud(board, record);
            assert.deepEqual(clamped.rings.map(ring => ring.progress), [0, 1], 'arc clamps under/over-target counters');
            game.collectedCounts = { 1: 6, 2: 12 }; board.setGame(game);
            const restored = hud(board, record);
            assert.deepEqual(restored.rings.map(ring => ring.progress), [.5, 1], 'setGame retains original collect targets');
            assert.deepEqual(restored.rings.map(({ x, y }) => [x, y]), initial.rings.map(({ x, y }) => [x, y]),
                'digit changes and completion keep subjects fixed');
            assert.equal(restored.seals.length, 1);
        } finally { assets.get = get; }
    }
    // Layer totals and delayed visual snapshots must remain distinct from cell count/core state.
    {
        const record = context(), board = new Board(record.ctx, { width: 320, height: 568 });
        const game = new GameCore({ id: 1, rows: 5, columns: 5, pieceTypes: [1, 2, 3, 4], moveCount: 12,
            underlays: { '1:1': 2, '2:2': 2 }, obstacles: { '3:1': 1, '3:2': 1 },
            goals: [{ type: 'jelly', target: 2 }, { type: 'ice', target: 2 }, { type: 'score', target: 1000 }] });
        board.setGame(game);
        assert.deepEqual(hud(board, record).rings.map(ring => ring.progress), [0, 0, 0]);
        game.jellyGrid[1][1] = 0; game.iceGrid[3][1] = 0; game.score = 500;
        board.setGame(game);
        const restored = hud(board, record);
        assert.deepEqual(restored.rings.map(ring => ring.progress), [.5, .5, .5],
            'two remaining jelly layers are half of the initial four, even after setGame');
        assert(restored.text.includes('1000'), 'score keeps its target while progress reflects the current score');
        assert(record.records.some(item => item.key === 'arc' && item.fillStyle === '#A97849'), 'score ring contains the existing star subject');
        board.specialEffects = [
            { kind: 'hitHold', life: -1, target: { row: 1, column: 1 }, targetJelly: 2 },
            { kind: 'hitHold', life: -1, target: { row: 3, column: 1 }, targetIce: 1 }
        ];
        assert.deepEqual(hud(board, record).rings.map(ring => ring.progress), [0, 0, .5], 'pending hits retain previous obstacle progress');
        board.specialEffects.forEach(effect => { effect.life = 0; });
        assert.deepEqual(hud(board, record).rings.map(ring => ring.progress), [.5, .5, .5], 'resolved hits reveal existing visual counts');
        game.jellyGrid[2][2] = 0; game.iceGrid[3][2] = 0; game.score = 1200;
        const done = hud(board, record);
        assert.deepEqual(done.rings.map(ring => ring.progress), [1, 1, 1]);
        assert.equal(done.seals.length, 3); assert(!done.text.includes('1000'));
    }
    // The original 38/50/52px goal rows and dense 19px rows contain rings and seals.
    for (const [height, flower, count, timed] of [
        [568, false, 1, false], [568, false, 3, true], [844, false, 3, true],
        [568, true, 3, true], [844, true, 3, true], [568, true, 4, true], [844, true, 4, true]
    ]) {
        const record = context(), screen = { width: 320, height }, board = new Board(record.ctx, screen);
        const game = core();
        if (!flower) { game.level.moonbuds = []; game.moonbudCells = {}; }
        game.level.goals = [flower ? { type: 'moonbud', target: 1 } : { type: 'score', target: 9000 },
            { type: 'collect', pieceType: 1, target: 30 }, { type: 'parcel', target: 1 },
            { type: 'score', target: 9000 }].slice(0, count);
        if (timed) { game.timeLimitMs = 60000; game.timeLeftMs = 9000; }
        board.setGame(game);
        const initial = hud(board, record), boardGeometry = [board.boardY, board.tileSize];
        const labels = record.records.filter(item => ['目标分', '花苞', '收集', '配送'].includes(item.args[0])).map(item => item.args);
        board.visualMoonbuds = {}; board.visualParcelDelivered = 1; game.collectedCounts = { 1: 30 }; game.score = 9000;
        const completed = hud(board, record);
        assert.equal(completed.rings.length, count); assert.equal(completed.seals.length, count);
        assert.deepEqual(completed.rings.map(({ x, y }) => [x, y]), initial.rings.map(({ x, y }) => [x, y]));
        assert.deepEqual(record.records.filter(item => ['目标分', '花苞', '收集', '配送'].includes(item.args[0])).map(item => item.args), labels);
        assert.deepEqual([board.boardY, board.tileSize], boardGeometry);
        const layout = gameLayout.solo(screen, 8, 8, { moonbuds: flower, timed, goalCount: count });
        const rows = count === 4 ? 2 : 1, cols = Math.ceil(count / rows);
        const cellH = layout.goalsH / rows, cellW = (timed ? 213 : 284) / cols;
        completed.rings.forEach((ring, index) => {
            const left = 18 + index % cols * cellW, top = layout.goalsY + Math.floor(index / cols) * cellH;
            const seal = completed.seals[index], [sx, sy, radius] = seal.args, edge = radius + seal.lineWidth / 2;
            assert(ring.x - ring.edge >= left && ring.x + ring.edge <= left + cellW);
            assert(ring.y - ring.edge >= top && ring.y + ring.edge <= top + cellH);
            assert(sx > ring.x && sy > ring.y, 'seal sits on lower-right ring edge');
            assert(sx - edge >= left && sx + edge <= left + cellW && sy - edge >= top && sy + edge <= top + cellH,
                'completion seal stays inside its original cell');
            const path = record.records.slice(record.records.indexOf(seal) + 1).slice(0, 8);
            assert.equal(path.filter(item => item.key === 'lineTo' && item.strokeStyle === '#FFFFFF').length, 2,
                'seal contains a vector check, not only a colour change');
        });
        if (timed) assert(completed.text.includes('00:09'));
        if (flower) assert(!completed.text.includes('花苞已收齐'));
    }
    for (const reduced of [false, true]) {
        const record = context(), board = new Board(record.ctx, { width: 320, height: 568, reduceEffects: reduced });
        board.setGame(core());
        const waits = []; board.wait = ms => { waits.push(ms); return Promise.resolve(); };
        await board.animateMoonbudPhase({ open: false });
        assert.deepEqual(waits, [reduced ? 0 : 120], 'visual tail does not extend callback wait');
        const effect = board.moonbudEffects[0];
        assert.equal(effect.fromOpen, true); assert.equal(effect.toOpen, false);
        assert.equal(effect.duration, reduced ? 160 : 500);
        record.records.length = 0;
        shapes.moonbudEffect(record.ctx, 20, 20, 24, effect, reduced);
        const initial = record.records.map(x => ({ key: x.key, args: x.args.slice() }));
        board.update(effect.duration / 2);
        assert.equal(effect.elapsed, effect.duration / 2);
        record.records.length = 0;
        shapes.moonbudEffect(record.ctx, 20, 20, 24, effect, reduced);
        assert.notDeepEqual(record.records, initial, 'phase has visible intermediate progress');
        const ellipseSizes = record.records.filter(x => x.key === 'ellipse').map(x => x.args[2]);
        if (reduced) {
            assert(ellipseSizes.some(radius => radius > 3) && ellipseSizes.some(radius => radius < 1.1),
                'reduced phase only fades between stationary endpoint petals');
        } else {
            assert(ellipseSizes.every(radius => radius > 1.1 && radius < 3),
                'normal phase unfolds the whole-cell petal geometry');
        }
        await board.animateMoonbudPhase({ open: true });
        assert.equal(board.moonbudEffects.length, 1, 'next phase replaces existing cell effect');
        board.update(reduced ? 160 : 500);
        assert.equal(board.moonbudEffects.length, 0, 'phase tail expires in update');
        board.addMoonbudEffect('1:6', 'collect', true, true);
        const collect = board.moonbudEffects[0];
        record.records.length = 0;
        shapes.moonbudEffect(record.ctx, 20, 20, 24, collect, reduced);
        const startY = record.records.find(x => x.key === 'translate').args[1];
        board.update(collect.duration / 2);
        record.records.length = 0;
        shapes.moonbudEffect(record.ctx, 20, 20, 24, collect, reduced);
        const halfwayY = record.records.find(x => x.key === 'translate').args[1];
        assert(reduced ? halfwayY === startY : halfwayY < startY, 'only normal collection floats');
        board.update(collect.duration / 2); assert.equal(board.moonbudEffects.length, 0);
        const plain = core(); plain.level.moonbuds = []; plain.moonbudCells = {};
        board.setGame(plain); await board.animateMoonbudPhase({ open: false });
        assert.equal(board.moonbudEffects.length, 0, 'unconfigured boards produce no flower effects');
    }
    for (const kind of ['phase', 'collect', 'closedHit']) {
        const record = context(), board = new Board(record.ctx, { width: 320, height: 568, reduceEffects: false });
        board.setGame(core());
        board.addMoonbudEffect('1:6', kind, true, false);
        const effect = board.moonbudEffects[0];
        const initialDuration = effect.duration;
        board.update(100);
        board.screen.reduceEffects = true;
        board.update(0);
        assert.equal(effect.duration, 160, 'mid-animation reduce maps onto160ms');
        assert(Math.abs(effect.elapsed / effect.duration - 100 / initialDuration) < 0.0001, 'normalized progress preserved');
        assert(effect.reduced);
        function reducedGeometry() {
            record.records.length = 0;
            shapes.moonbudEffect(record.ctx, 20, 20, 24, effect, board.screen.reduceEffects);
            return record.records.filter(x => x.key === 'ellipse' || x.key === 'translate').map(x => x.args);
        }
        const stationary = reducedGeometry();
        board.screen.reduceEffects = false;
        board.update(20);
        assert.deepEqual(reducedGeometry(), stationary, 'switching back cannot restore pulse or floating');
        assert.equal(effect.duration, 160);
        board.update(160);
        assert.equal(board.moonbudEffects.length, 0, 'remaining reduced lifetime is at most160ms');
    }
    assert.notEqual(onboarding.GUIDE_KEYS.MOONBUD, onboarding.GUIDE_KEYS.OBSTACLE);
    assert.notEqual(onboarding.GUIDE_KEYS.PARCEL, onboarding.GUIDE_KEYS.MOONBUD);
    console.log('new obstacle silhouettes, layers, HUD, guide and event snapshots: ok');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
