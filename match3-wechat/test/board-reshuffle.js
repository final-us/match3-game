'use strict';

const assert = require('assert');
const GameCore = require('../js/core/game-core');
const BoardRenderer = require('../js/render/board-render');

function fixture(reduceEffects) {
    const context = new Proxy({}, { get(target, key) {
        if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
        return () => {};
    } });
    const core = new GameCore({ rows: 8, columns: 8, moveCount: 20,
        goals: [{ type: 'score', target: 99999 }] }, {});
    const board = new BoardRenderer(context, { width: 320, height: 568, reduceEffects });
    board.setGame(core);
    board.wait = duration => Promise.resolve(duration);
    return { board, core };
}

const normal = fixture(false);
const oldPiece = normal.board.pieces[0];
normal.core.grid[0][0] = oldPiece.type === 1 ? 2 : 1;
normal.board.animateReshuffle();
const newPiece = normal.board.pieces[0];
assert.notStrictEqual(newPiece, oldPiece);
assert.strictEqual(newPiece.type, normal.core.grid[0][0]);
assert(normal.board.reshuffleFeedback.oldPieces.includes(oldPiece));

const drawn = [];
normal.board.drawPiece = (piece, opacity) => drawn.push({ piece, opacity });
normal.board.drawBoard();
assert.strictEqual(drawn.find(item => item.piece === oldPiece).opacity, 1);
assert.strictEqual(drawn.find(item => item.piece === newPiece).opacity, 0);
normal.board.update(100);
drawn.length = 0;
normal.board.drawBoard();
assert(drawn.find(item => item.piece === oldPiece).opacity < 1);
assert(drawn.find(item => item.piece === newPiece).opacity > 0);
normal.board.update(120);
assert.strictEqual(normal.board.reshuffleFeedback, null);
drawn.length = 0;
normal.board.drawBoard();
assert(!drawn.some(item => item.piece === oldPiece));
assert.strictEqual(drawn.find(item => item.piece === newPiece).opacity, 1);

normal.board.animateReshuffle();
normal.board.setGame(fixture(false).core);
assert.strictEqual(normal.board.reshuffleFeedback, null, 'rebind cancels old transition');

const reduced = fixture(true);
reduced.board.animateReshuffle();
assert.strictEqual(reduced.board.reshuffleFeedback, null, 'reduced effects swap instantly');

console.log('board reshuffle feedback: ok');
