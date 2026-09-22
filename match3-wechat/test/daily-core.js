'use strict';

const assert = require('assert');
const daily = require('../js/core/daily-challenge');
const cloudDaily = require('../cloudfunctions/battle/daily-engine/daily-challenge');

function nextMove(core) {
    for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
        const from = { row: row, column: column };
        for (const to of [{ row: row, column: column + 1 }, { row: row + 1, column: column }]) {
            if (to.row < 8 && to.column < 8 && core.validateMove(from, to)) return { from: from, to: to };
        }
    }
    throw new Error('daily engine produced no valid move');
}

async function movesFor(challenge) {
    const core = daily.createCore(challenge); const moves = [];
    while (!core.ended) {
        const move = nextMove(core);
        assert.strictEqual(await core.trySwap(move.from, move.to), true);
        moves.push(move);
    }
    return { core: core, moves: moves };
}

(async function () {
    const challenge = daily.challengeForDate('2026-09-22');
    assert.strictEqual(challenge.version, 'daily-v1');
    assert.strictEqual(challenge.reward, 500);
    const legacyChallenge = Object.assign({}, challenge, { reward: 300 });
    assert.strictEqual(daily.isChallenge(legacyChallenge), false, 'new client payloads must use the 500 reward');
    assert.strictEqual(daily.isRecordedChallenge(legacyChallenge), true, 'recorded 300-reward runs remain replayable');
    assert.deepStrictEqual(daily.createCore(challenge).grid, daily.createCore(challenge).grid, 'seeded initial grid differs');
    const first = await movesFor(challenge);
    const second = await movesFor(challenge);
    assert.strictEqual(first.moves.length, 25, 'daily must consume exactly 25 valid swaps');
    assert.strictEqual(first.core.movesLeft, 0);
    assert.strictEqual(first.core.ended, true);
    assert.deepStrictEqual(first.moves, second.moves, 'fixed seed has divergent valid move sequence');
    assert.strictEqual(first.core.score, second.core.score);
    assert.deepStrictEqual(first.core.grid, second.core.grid);
    const clientCore = daily.createCore(challenge);
    const cloudCore = cloudDaily.createCore(challenge);
    for (const move of first.moves) {
        assert.strictEqual(await clientCore.trySwap(move.from, move.to), true);
        assert.strictEqual(await cloudCore.trySwap(move.from, move.to), true);
        assert.deepStrictEqual(cloudCore.grid, clientCore.grid, 'cloud grid diverged after a replay step');
        assert.strictEqual(cloudCore.score, clientCore.score);
        assert.strictEqual(cloudCore.maxCascade, clientCore.maxCascade);
        assert.strictEqual(cloudCore.specialComboCount, clientCore.specialComboCount);
    }
    let releaseSwap;
    const locked = daily.createCore(challenge, { onSwap: function () { return new Promise(function (resolve) { releaseSwap = resolve; }); } });
    const lockMove = nextMove(locked);
    const pending = locked.trySwap(lockMove.from, lockMove.to);
    assert.strictEqual(locked.isPlaying(), false);
    assert.strictEqual(await locked.trySwap(lockMove.from, lockMove.to), false);
    assert.strictEqual(locked.movesLeft, 24, 'locked second swap consumed a move');
    releaseSwap(); await pending;
    const failing = daily.createCore(challenge, { onSwap: function () { throw new Error('animation'); } });
    const failingMove = nextMove(failing);
    await assert.rejects(failing.trySwap(failingMove.from, failingMove.to), /animation/);
    assert.strictEqual(failing.isPlaying(), true, 'swap lock was not released after callback failure');
    const replayed = await daily.replay(challenge, first.moves);
    assert.strictEqual(replayed.ok, true);
    assert.strictEqual(replayed.score, first.core.score);
    assert.strictEqual((await daily.replay(challenge, first.moves.slice(0, 24))).code, 'INVALID_MOVE_COUNT');
    const malformed = first.moves.slice(); malformed[0] = { from: { row: 8, column: 0 }, to: { row: 0, column: 0 } };
    assert.strictEqual((await daily.replay(challenge, malformed)).code, 'INVALID_MOVE_COORDINATES');
    const illegal = first.moves.slice(); illegal[0] = { from: { row: 0, column: 0 }, to: { row: 0, column: 1 } };
    assert.strictEqual((await daily.replay(challenge, illegal)).ok, false);
    assert.strictEqual((await daily.replay(legacyChallenge, first.moves)).ok, true);
    console.log('daily core tests passed; fixed strategy score=' + first.core.score + ' target=' + challenge.target);
})().catch(function (error) { console.error(error); process.exitCode = 1; });
