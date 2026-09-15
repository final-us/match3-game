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
console.log('board renderer combo scopes: ok');
