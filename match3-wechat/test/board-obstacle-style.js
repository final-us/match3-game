'use strict';

const assert = require('assert');
const GameCore = require('../js/core/game-core');
const BoardRenderer = require('../js/render/board-render');
const assets = require('../js/render/assets');
const config = require('../js/core/config');

function gradientStop(offset, color) { this.stops.push({ offset, color }); }

function recordingContext() {
    const records = [];
    const stack = [];
    let state = { globalAlpha: 1, translateX: 0, translateY: 0 };
    let path = [];
    const context = new Proxy({}, {
        get(target, key) {
            if (Object.prototype.hasOwnProperty.call(state, key)) return state[key];
            if (key === 'save') return () => stack.push(Object.assign({}, state));
            if (key === 'restore') return () => { state = stack.pop(); };
            if (key === 'translate') return (horizontal, vertical) => {
                state.translateX += horizontal;
                state.translateY += vertical;
            };
            if (key === 'beginPath') return () => { path = []; };
            if (key === 'moveTo' || key === 'lineTo' || key === 'bezierCurveTo' || key === 'quadraticCurveTo') {
                return (...args) => path.push({ method: key, points: args.map((value, index) =>
                    value + (index % 2 ? state.translateY : state.translateX)) });
            }
            if (key === 'rect') return (horizontal, vertical, width, height) => {
                path.push({ method: key, points: [horizontal + state.translateX, vertical + state.translateY], args: [width, height] });
            };
            if (key === 'clip') return () => records.push({ method: key, path: path.slice() });
            if (key === 'arc' || key === 'ellipse') return (horizontal, vertical, ...args) => {
                path.push({ method: key, points: [horizontal + state.translateX, vertical + state.translateY], args });
            };
            if (key === 'fill' || key === 'stroke') return () => records.push({
                method: key, style: state[key + 'Style'], lineWidth: key === 'stroke' ? state.lineWidth : undefined,
                alpha: state.globalAlpha, path: path.slice()
            });
            if (key === 'fillText' || key === 'drawImage') return (value, horizontal, vertical, ...args) => {
                records.push({ method: key, value, horizontal: horizontal + state.translateX,
                    vertical: vertical + state.translateY, args, alpha: state.globalAlpha });
            };
            if (key === 'measureText') return value => ({ width: String(value).length * 8 });
            if (key === 'createLinearGradient' || key === 'createRadialGradient') {
                return () => ({ kind: key === 'createRadialGradient' ? 'radial' : 'linear', stops: [], addColorStop: gradientStop });
            }
            return () => {};
        },
        set(target, key, value) { state[key] = value; return true; }
    });
    return { context, records };
}

function fixture(reduceEffects) {
    const recording = recordingContext();
    const core = new GameCore({ rows: 8, columns: 8, moveCount: 20,
        goals: [{ type: 'jelly', target: 2 }] }, {});
    const board = new BoardRenderer(recording.context, { width: 320, height: 568, safeTop: 44, contentTop: 88, safeBottom: 34, reduceEffects });
    board.setGame(core);
    assert(board.tileSize <= 27 && board.tileSize >= 24, 'fixture covers the narrow320px live-board scale');
    core.jellyGrid = core.grid.map(row => row.map(() => 0));
    board.pieces = board.pieces.slice(0, 2);
    board.pieces.forEach(piece => { piece.type = 1; piece.alpha = 1; piece.scale = 1; });
    board.drawIces = () => {};
    board.drawYarn = () => {};
    board.drawParticles = () => {};
    board.drawSpecialEffects = () => {};
    return { board, core, records: recording.records };
}

function capture(fixtureValue, method) {
    fixtureValue.records.length = 0;
    fixtureValue.board[method]();
    return fixtureValue.records.slice();
}

function assertLayer(fixtureValue, layers) {
    const trays = capture(fixtureValue, 'drawJellies');
    const badges = capture(fixtureValue, 'drawJellyBadges');
    const fills = trays.filter(record => record.method === 'fill');
    const strokes = trays.filter(record => record.method === 'stroke');
    assert.strictEqual(fills.length, layers ? 1 : 0, 'one tray per occupied jelly cell');
    assert.strictEqual(trays.some(record => record.method === 'fillText'), false, 'tray never numbers or overlays the cat');
    if (layers) {
        assert.strictEqual(fills[0].style, layers === 2 ? '#7b397f' : '#efa5c6');
        assert(fills[0].path.some(segment => segment.method === 'bezierCurveTo'), 'demo soft candy contour');
        assert.strictEqual(strokes[0].style, layers === 2 ? '#4c245f' : '#975177');
        assert.strictEqual(strokes[0].lineWidth, fixtureValue.board.tileSize * (layers === 2 ? 0.11 : 0.055));
        assert.strictEqual(strokes.some(record => record.style === '#d88ac9'), layers === 2, 'double layer inner rim only');
    }
    const foregroundEdges = badges.filter(record => record.method === 'stroke' &&
        record.path.some(segment => segment.method === 'bezierCurveTo'));
    assert.strictEqual(foregroundEdges.length, layers === 2 ? 4 : layers === 1 ? 3 : 0,
        'both layers have a foreground silhouette; only double has an inner candy rim');
    if (layers) {
        const clip = badges.find(record => record.method === 'clip');
        assert(clip && clip.path.some(segment => segment.method === 'rect'), 'foreground is clipped to its own cell');
        assert(foregroundEdges.some(record => record.lineWidth >= 2.5), 'edge remains visible on the narrow board');
        const offset = fixtureValue.board.invalidSwapOffset(0, 0);
        const centerX = fixtureValue.board.boardX + fixtureValue.board.tileSize / 2 + (offset ? offset.x : 0);
        const centerY = fixtureValue.board.boardY + fixtureValue.board.tileSize / 2 + (offset ? offset.y : 0);
        // Curved edges surround a clear middle rather than putting a tinted fill over the face.
        foregroundEdges.forEach(record => record.path.forEach(segment => {
            for (let index = 0; index < segment.points.length; index += 2) {
                assert(Math.hypot(segment.points[index] - centerX, segment.points[index + 1] - centerY) >
                    fixtureValue.board.tileSize * 0.25, 'candy contour keeps the face centre clear');
            }
        }));
    } else assert.strictEqual(badges.length, 0, 'zero jelly has no foreground remnants');
    const numbers = badges.filter(record => record.method === 'fillText');
    assert.deepStrictEqual(numbers.map(record => String(record.value)), layers === 2 ? ['2'] : [], 'single layer has no number');
    assert.strictEqual(badges.filter(record => record.method === 'fill').length, layers === 2 ? 2 : layers === 1 ? 1 : 0);
    const films = badges.filter(record => record.method === 'fill' && record.style && record.style.kind === 'radial');
    assert.strictEqual(films.length, layers ? 1 : 0, 'surface film exists on both layers and vanishes with last layer');
    films.forEach(record => {
        assert(record.path.some(segment => segment.method === 'bezierCurveTo'), 'film covers the candy-shaped cat surface');
        assert.strictEqual(record.alpha, 1, 'film alpha lives in its gradient, never changes cat opacity');
        const stops = record.style.stops;
        const alphas = stops.map(stop => Number(stop.color.match(/,([0-9.]+)\)$/)[1]));
        assert(alphas[0] > 0 && alphas[0] <= 0.04, 'cat face receives a very faint real surface film');
        assert(alphas.every(alpha => alpha <= 0.12) && alphas.at(-1) >= 0.08, 'edge is visible but bounded to12percent');
        assert(alphas[0] < alphas.at(-1), 'centre is less tinted than perimeter');
        assert(stops.every(stop => stop.color.includes(layers === 2 ? '160,110,185' : '236,135,181')),
            'single pink and double violet films remain distinct');
    });
    if (layers === 2) {
        assert.strictEqual(badges.find(record => record.method === 'fill' && record.style === '#63326f').style, '#63326f');
        assert(numbers[0].horizontal < fixtureValue.board.boardX + fixtureValue.board.tileSize / 2, 'badge left of cat');
        assert(numbers[0].vertical < fixtureValue.board.boardY + fixtureValue.board.tileSize / 2, 'badge above cat');
    }
    return { trays, badges };
}

function assertShifted(before, after, offset) {
    assert.strictEqual(after.length, before.length);
    before.forEach((record, index) => {
        const shifted = Object.assign({}, record);
        if (record.path) shifted.path = record.path.map(segment => Object.assign({}, segment, {
            points: segment.points.map((value, coordinate) => value + (coordinate % 2 ? offset.y : offset.x))
        }));
        if (record.horizontal !== undefined) {
            shifted.horizontal += offset.x;
            shifted.vertical += offset.y;
        }
        const actual = after[index];
        if (shifted.horizontal !== undefined) {
            assert(Math.abs(shifted.horizontal - actual.horizontal) < 1e-9, 'shared image horizontal offset');
            assert(Math.abs(shifted.vertical - actual.vertical) < 1e-9, 'shared image vertical offset');
            shifted.horizontal = actual.horizontal;
            shifted.vertical = actual.vertical;
        }
        if (shifted.path) shifted.path.forEach((segment, segmentIndex) => {
            segment.points.forEach((value, coordinate) => {
                assert(Math.abs(value - actual.path[segmentIndex].points[coordinate]) < 1e-9, 'shared obstacle offset');
                segment.points[coordinate] = actual.path[segmentIndex].points[coordinate];
            });
        });
        assert.deepStrictEqual(actual, shifted);
    });
}

const originalGet = assets.get;
const catImages = Array.from({ length: 5 }, (_, index) => ({ width: 256, height: 256, src: 'test-cat-' + (index + 1) }));
assets.get = name => /^piece[1-5]$/.test(name) ? catImages[Number(name.slice(5)) - 1] : originalGet(name);
try {
    for (const reduceEffects of [false, true]) {
        const value = fixture(reduceEffects);
        value.core.jellyGrid[0][0] = 1;
        assertLayer(value, 1);
        value.core.jellyGrid[0][0] = 2;
        const unshifted = assertLayer(value, 2);
        value.core.jellyGrid[0][1] = 1;
        const boardRecords = capture(value, 'drawBoard');
        const catIndices = boardRecords.flatMap((record, index) => record.method === 'drawImage' ? [index] : []);
        assert.strictEqual(catIndices.length, 2, 'ordinary cats draw using their original asset');
        for (const style of ['#7b397f', '#efa5c6']) {
            assert(boardRecords.findIndex(record => record.method === 'fill' && record.style === style) < catIndices[0],
                'both trays render beneath every cat');
        }
        assert(boardRecords.findIndex(record => record.method === 'fillText') > catIndices[1], 'double badge renders after cats');
        const foreground = boardRecords.slice(catIndices[1] + 1);
        for (const style of ['#7b397f', '#efa5c6']) {
            assert(foreground.some(record => record.method === 'stroke' && record.style === style &&
                record.path.some(segment => segment.method === 'bezierCurveTo')),
                'single and double candy outlines actually render after the cat images');
        }
        assert(foreground.filter(record => record.method === 'fill').every(record => record.style === '#63326f' || record.style.kind === 'radial'),
            'foreground fills only the faint surface membrane and corner badge');
        assert.deepStrictEqual(boardRecords.slice(catIndices[0], catIndices[1] + 1).map(record => record.method),
            ['drawImage', 'drawImage'], 'no candy fill or stroke tints the cat image');
        catIndices.forEach(index => assert.strictEqual(boardRecords[index].alpha, 1));
        value.core.jellyGrid[0][1] = 0;
        const catBefore = capture(value, 'drawBoard').filter(record => record.method === 'drawImage').slice(0, 1);
        value.board.invalidSwapFeedback = { from: { row: 0, column: 0 }, to: { row: 0, column: 1 },
            elapsed: 36, duration: 180, distance: 3 };
        const offset = value.board.invalidSwapOffset(0, 0);
        assert(offset && (offset.x || offset.y), 'fixture exercises nonzero failed-swap displacement');
        const shifted = assertLayer(value, 2);
        assertShifted(unshifted.trays, shifted.trays, offset);
        assertShifted(unshifted.badges, shifted.badges, offset);
        assertShifted(catBefore, capture(value, 'drawBoard').filter(record => record.method === 'drawImage').slice(0, 1), offset);
        value.board.invalidSwapFeedback = null;
        for (let type = 1; type <= 5; type++) {
            value.board.pieces[0].type = type;
            for (const layers of [1, 2]) {
                value.core.jellyGrid[0][0] = layers;
                const shown = capture(value, 'drawBoard');
                const cat = shown.find(record => record.method === 'drawImage');
                assert.strictEqual(cat.value, catImages[type - 1], 'each original cat asset stays under the membrane');
                assert.strictEqual(cat.alpha, 1, 'all five colours keep their original cat opacity');
                assertLayer(value, layers);
            }
        }
        value.board.pieces[0].type = 1;

        for (const snapshot of [2, 1]) {
            value.core.jellyGrid[0][0] = snapshot - 1;
            value.board.specialEffects = [];
            const timing = value.board.spawnMatchEffects({ removed: [], triggeredSpecials: [
                { row: 4, column: 4, type: config.SPECIAL_TYPES.TRACKING_PAW,
                    target: { row: 0, column: 0 }, targetJelly: snapshot, targetIce: 0, targetYarnHealth: 0 }
            ] });
            const arrival = (reduceEffects ? 200 : 560) * 0.64;
            assert.strictEqual(timing.impact, arrival);
            assertLayer(value, snapshot);
            assert.strictEqual(value.board.visualJellyLeft(), snapshot);
            value.board.update(arrival - 1);
            assertLayer(value, snapshot);
            assert.strictEqual(value.board.visualJellyLeft(), snapshot);
            value.board.update(1);
            assertLayer(value, snapshot - 1);
            assert.strictEqual(value.board.visualJellyLeft(), snapshot - 1, 'tray, badge and HUD reveal damage together at impact');
        }
        value.core.yarnSource = { row: 4, column: 4, health: 3 };
        value.core.yarnVines = {};
        value.board.specialEffects = [];
        value.board.spawnMatchEffects({ removed: [], triggeredSpecials: [{ row: 5, column: 5,
            type: config.SPECIAL_TYPES.TRACKING_PAW, target: { row: 0, column: 1 },
            targetYarnVine: true, targetYarnHealth: 0, targetIce: 0, targetJelly: 0 }] });
        function vineStrokes() {
            value.records.length = 0;
            BoardRenderer.prototype.drawYarn.call(value.board);
            return value.records.filter(record => record.method === 'stroke' && record.style === '#DDA95C').length;
        }
        assert.strictEqual(vineStrokes(), 1, 'remote vine snapshot remains visible before arrival');
        value.board.update((reduceEffects ? 200 : 560) * 0.64);
        assert.strictEqual(vineStrokes(), 0, 'direct-hit vine disappears at actual arrival');
    }
} finally {
    assets.get = originalGet;
}

console.log('board obstacle demo style and impact snapshots: ok');
