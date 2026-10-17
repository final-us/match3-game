const assert = require('assert');
const Core = require('../js/core/game-core');
const config = require('../js/core/config');
const pos = (row, column) => ({ row, column });
const stable = () => Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => (r * 2 + c) % 5 + 1));
function fixture(extra = {}, callbacks = {}) {
    const core = new Core(Object.assign({ rows: 6, columns: 6, colorCount: 5, moveCount: 5,
        obstacles: { '3:0': 1, '4:4': 1 }, goals: [{ type: 'ice', target: 2 }] }, extra), callbacks);
    core.grid = stable();
    // Same deterministic refill oracle as new-obstacles.js; real removal and settlement run.
    core.callbacks.onFill = () => { core.grid = stable(); };
    return core;
}
function tripleSwap(core) {
    core.grid[3][0] = 1; core.grid[3][1] = 1; core.grid[3][2] = 2; core.grid[2][2] = 1;
    return [pos(2, 2), pos(3, 2)];
}
(async () => {
    for (const extra of [
        { obstacles: undefined }, { obstacles: null }, { obstacles: [] }, { obstacles: '3:0' },
        { obstacles: {} }, { obstacles: { '6:0': 1 } }, { obstacles: { 'x:0': 1 } },
        { obstacles: { '3:0junk': 1 } }, { obstacles: { '3:0': 2 } },
        { obstacles: { '3:0': 1, '03:0': 1 } },
        ...[undefined, 0, -1, 1, 3, 2.5, '2'].map(target => ({ goals: [{ type: 'ice', target }] }))
    ]) assert.throws(() => fixture(extra), /Invalid ice/);

    let core = fixture();
    assert.strictEqual(core.iceTotal, 2);
    assert.strictEqual(core.getIceLeft(), 2);
    core.score = 999999;
    core.checkLevelEnd();
    assert(!core.ended, 'score never bypasses an ice goal');
    core.iceGrid[3][0] = 0;
    core.checkLevelEnd();
    assert(!core.ended, 'all ice cells are required');
    core.iceGrid[4][4] = 0;
    core.checkLevelEnd();
    assert(core.won);
    core.initGrid();
    assert.strictEqual(core.iceTotal, 2);
    assert.strictEqual(core.getIceLeft(), 2, 'restart resets initial count');

    core = fixture({ goals: [{ type: 'ice', target: 2 }, { type: 'collect', pieceType: 1, target: 6 }] });
    core.iceGrid = core.iceGrid.map(row => row.map(() => 0));
    core.checkLevelEnd();
    assert(!core.ended, 'ice clearance does not bypass collection');
    core.collectedCounts[1] = 6;
    core.iceGrid[3][0] = 1;
    core.checkLevelEnd();
    assert(!core.ended, 'collection does not bypass remaining ice');
    core.iceGrid[3][0] = 0;
    core.checkLevelEnd();
    assert(core.won);

    const events = [];
    core = fixture({ obstacles: { '3:0': 1 }, goals: [{ type: 'ice', target: 1 }], moveCount: 1 }, {
        onMatch: async event => {
            events.push('match');
            assert.deepStrictEqual(event.iceHits, [pos(3, 0)]);
            assert(!event.removed.some(p => p.row === 3 && p.column === 0));
            assert.strictEqual(core.grid[3][0], 1, 'breaking ice retains the original cat');
            assert.strictEqual(core.getIceLeft(), 0);
            assert(!core.ended, 'end waits for match animation');
            await Promise.resolve(); events.push('match-done');
        },
        onLevelEnd: event => { events.push('end'); assert(event.win); assert.strictEqual(event.reason, 'goal'); }
    });
    assert(await core.trySwap(...tripleSwap(core)));
    assert(core.won && core.movesLeft === 0, 'ice goal wins on last move');
    assert.deepStrictEqual(events, ['match', 'match-done', 'end']);

    core = fixture({ moveCount: 1 });
    assert(await core.trySwap(...tripleSwap(core)));
    assert(core.ended && !core.won && core.getIceLeft() === 1, 'last move loses if ice remains');

    // Ordinary adjacent removal and special direct hits preserve the covered ordinary cat.
    for (const attack of ['adjacent', 'rocket']) {
        let hit = false;
        core = fixture({ obstacles: { '3:3': 1 }, goals: [{ type: 'ice', target: 1 }] }, {
            onMatch: event => {
                if (!event.iceHits.length) return;
                hit = true;
                assert.deepStrictEqual(event.iceHits, [pos(3, 3)]);
                assert.strictEqual(core.grid[3][3], 2);
                assert(!event.removed.some(p => p.row === 3 && p.column === 3));
            }
        });
        core.grid[3][3] = 2;
        if (attack === 'adjacent') await core.trySwap(...tripleSwap(core));
        else {
            core.grid[3][0] = config.SPECIAL_TYPES.H_ROCKET;
            await core.trySwap(pos(3, 0), pos(3, 1));
        }
        assert(hit && core.won && core.getIceLeft() === 0, attack);
    }
    core = fixture({ goals: [{ type: 'score', target: 1 }] });
    core.score = 1; core.checkLevelEnd();
    assert(core.won && core.getIceLeft() === 2, 'levels without ice goals retain score-only semantics');
    console.log('ice-goal: configuration, counts, mixed goals, last move, event order and cat retention passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
