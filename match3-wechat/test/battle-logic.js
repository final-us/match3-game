'use strict';

const assert = require('assert');
const logic = require('../cloudfunctions/battle/logic');
const cloudBattle = require('../js/net/cloud-battle');

function player(openid, score, lastSeen) {
    return {
        openid: openid,
        score: score || 0,
        lastSeen: lastSeen || 0,
        items: { freeze: 1, disturb: 1 },
        usedCount: { freeze: 0, disturb: 0 }
    };
}

function room(status, startTime, players) {
    return {
        status: status,
        startTime: startTime,
        players: players,
        effects: [],
        result: {}
    };
}

(function run() {
    const config = logic.CONFIG;
    const validRoomId = 'R' + Date.now().toString(36) + 'a1b2c3d4e5';
    assert.strictEqual(logic.isValidRoomId(validRoomId), true);
    assert.strictEqual(cloudBattle.isValidRoomId(validRoomId), true);
    assert.strictEqual(logic.isValidRoomId('R123456'), false);
    assert.strictEqual(logic.isValidRoomId(validRoomId.slice(0, -1)), false);
    assert.strictEqual(logic.isValidRoomId(validRoomId.toUpperCase()), false);
    assert.strictEqual(logic.isValidRoomId(validRoomId + '0123456789'), false);
    assert.strictEqual(logic.isValidRoomId(' ' + validRoomId), false);
    assert.strictEqual(logic.isValidRoomId(null), false);

    const waiting = room('waiting', 0, []);
    waiting.createdAt = 1000;
    assert.strictEqual(logic.isWaitingRoomExpired(waiting, 1000 + config.WAITING_ROOM_TTL_MS - 1), false);
    assert.strictEqual(logic.isWaitingRoomExpired(waiting, 1000 + config.WAITING_ROOM_TTL_MS), true);
    assert.strictEqual(logic.isWaitingRoomExpired({ status: 'waiting' }, 1000), true);
    assert.strictEqual(logic.isWaitingRoomExpired({ status: 'playing', createdAt: 0 }, 999999), false);
    assert.strictEqual(logic.isCleanupTimerEvent({
        Type: 'Timer', TriggerName: 'cleanup-battle-rooms'
    }, ''), true);
    assert.strictEqual(logic.isCleanupTimerEvent({
        Type: 'Timer', TriggerName: 'cleanup-battle-rooms'
    }, 'client-openid'), false);
    assert.strictEqual(logic.isCleanupTimerEvent({
        Type: 'Timer', TriggerName: 'another-trigger'
    }, ''), false);

    const start = 100000;
    const me = player('me', 200, start);
    const opponent = player('opponent', 100, start);
    const active = room('playing', start, [me, opponent]);

    assert.strictEqual(logic.validateScoreSync(active, me, 300, start + 1000, config).ok, true);
    assert.strictEqual(logic.validateScoreSync(active, me, 199, start + 1000, config).ok, false);
    assert.strictEqual(logic.validateScoreSync(active, me, 999999, start + 1000, config).ok, false);
    assert.strictEqual(logic.validateScoreSync(active, me, 300, start - 1, config).ok, false);

    opponent.lastSeen = start - config.OFFLINE_GRACE_MS - 1;
    assert.strictEqual(logic.isHeartbeatExpired(opponent, start, config.OFFLINE_GRACE_MS), true);

    const finished = logic.determineFinish(active, 'me', start + config.BATTLE_DURATION_MS, config);
    assert.strictEqual(finished.finished, true);
    assert.strictEqual(finished.reason, 'time');

    active.effects = [
        { id: 'to-me', toOpenid: 'me' },
        { id: 'to-opponent', toOpenid: 'opponent' }
    ];
    assert.deepStrictEqual(logic.effectsForPlayer(active.effects, 'me').map(function (effect) {
        return effect.id;
    }), ['to-me']);

    active.status = 'finished';
    active.players[0].score = 500;
    active.players[1].score = 300;
    const results = logic.ensureSettlementResults(active, null);
    assert.strictEqual(results.me.result, 'win');
    assert.strictEqual(results.opponent.result, 'lose');

    console.log('battle logic tests passed');
})();
