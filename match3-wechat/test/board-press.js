'use strict';

const assert = require('assert');
const GameCore = require('../js/core/game-core');
const BoardRenderer = require('../js/render/board-render');
const assets = require('../js/render/assets');

assets.preload();

function fixture(reduceEffects) {
    const scales = [];
    const context = {
        save() {}, restore() {}, translate() {}, drawImage() {},
        scale(scaleX, scaleY) { scales.push([scaleX, scaleY]); }
    };
    const core = new GameCore({ rows: 8, columns: 8, moveCount: 20,
        goals: [{ type: 'score', target: 99999 }] }, {});
    const board = new BoardRenderer(context, { width: 320, height: 568, reduceEffects: !!reduceEffects });
    board.setGame(core);
    return { board, core, scales };
}

function pieceScale(board, piece, scales) {
    scales.length = 0;
    board.drawPiece(piece);
    return scales[0];
}

const normal = fixture(false);
const position = normal.board.pieceCenter(3, 3);
const piece = normal.board.findPiece(3, 3);
normal.board.onTouchStart(position.x, position.y);
assert(normal.board.pressFeedback && normal.board.pressFeedback.piece === piece);
assert.deepStrictEqual(normal.board.pressGrid, { row: 3, column: 3 });
const pressed = pieceScale(normal.board, piece, normal.scales);
assert(pressed[0] > 1 && pressed[1] < 1, 'tap should squash the cat without moving it');
normal.board.update(60);
assert(pieceScale(normal.board, piece, normal.scales)[1] < pressed[1], 'squash should deepen briefly');
normal.board.onTouchEnd();
normal.board.update(120);
assert.strictEqual(normal.board.pressFeedback, null, 'tap pulse should finish after release');
assert.deepStrictEqual(pieceScale(normal.board, piece, normal.scales), [1, 1]);
assert.strictEqual(piece.scale, 1, 'tap must not alter other scale animations');

normal.core.trySwap = () => Promise.resolve(false);
normal.board.onTouchStart(position.x, position.y);
normal.board.onTouchMove(position.x + normal.board.tileSize * .5, position.y);
assert.strictEqual(normal.board.pressFeedback, null, 'swipe must cancel tap pulse before exchange');
normal.board.onTouchEnd();

normal.board.onTouchStart(position.x, position.y);
normal.board.setGame(fixture(false).core);
assert.strictEqual(normal.board.pressFeedback, null, 'new board must not inherit a stale pulse');

const reduced = fixture(true);
const reducedPosition = reduced.board.pieceCenter(3, 3);
reduced.board.onTouchStart(reducedPosition.x, reducedPosition.y);
assert.strictEqual(reduced.board.pressFeedback, null, 'reduced effects should keep static highlight only');
assert.deepStrictEqual(reduced.board.pressGrid, { row: 3, column: 3 });
assert.deepStrictEqual(pieceScale(reduced.board, reduced.board.findPiece(3, 3), reduced.scales), [1, 1]);

console.log('board press feedback: ok');
