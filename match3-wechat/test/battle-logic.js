'use strict';

const assert = require('assert');
const logic = require('../cloudfunctions/battle/logic');
const cloudBattle = require('../js/net/cloud-battle');

function player(openid, score, lastSeen) {
    return {
        openid: openid,
        score: score || 0,
        lastSeen: lastSeen || 0,
        items: { freeze: 1, disturb: 2 },
        itemCooldownUntil: 0,
        activeEffectUntil: 0
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
    assert.deepStrictEqual(config.INITIAL_ITEMS, { freeze: 1, disturb: 2 });
    assert.strictEqual(config.ITEM_BUDGET, 3);
    assert.strictEqual(config.ITEM_COOLDOWN_MS, 10000);
    assert.deepStrictEqual(config.CREATE_RATE_LIMITS, { perMinute: 5, perUtcDay: 60 });
    let counter = null;
    const minuteAt = Date.UTC(2026, 0, 1, 12, 0, 0);
    for (let i = 0; i < 5; i++) {
        const allowed = logic.consumeCreateRateLimit(counter, minuteAt, config.CREATE_RATE_LIMITS);
        assert.strictEqual(allowed.ok, true);
        counter = allowed.next;
    }
    assert.strictEqual(logic.consumeCreateRateLimit(counter, minuteAt, config.CREATE_RATE_LIMITS).ok, false);
    const dayEnd = Date.UTC(2026, 0, 1, 23, 59, 59, 999);
    const dayCounter = {
        minuteKey: logic.utcMinuteKey(dayEnd), minuteCount: 0,
        dayKey: logic.utcDayKey(dayEnd), dayCount: 59
    };
    assert.strictEqual(logic.consumeCreateRateLimit(dayCounter, dayEnd, config.CREATE_RATE_LIMITS).ok, true);
    assert.strictEqual(logic.consumeCreateRateLimit(
        logic.consumeCreateRateLimit(dayCounter, dayEnd, config.CREATE_RATE_LIMITS).next,
        dayEnd + 1, config.CREATE_RATE_LIMITS
    ).next.dayCount, 1);
    assert.strictEqual(logic.consumeCreateRateLimit(Object.assign({}, dayCounter, { dayCount: 60 }), dayEnd, config.CREATE_RATE_LIMITS).err,
        logic.CREATE_RATE_LIMIT_MESSAGE);
    assert.strictEqual(logic.validateItemConfig({ freeze: 1, disturb: 2 }, config).ok, true);
    assert.strictEqual(logic.validateItemConfig({ freeze: 2, disturb: 2 }, config).ok, false);
    assert.strictEqual(logic.validateItemConfig({ freeze: 1, disturb: 2, hammer: 1 }, config).ok, false);
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

    assert.strictEqual(logic.validateItemUse(active, me, 'freeze', start + 1, config).ok, true);
    me.itemCooldownUntil = start + 10001;
    assert.strictEqual(logic.validateItemUse(active, me, 'disturb', start + 1, config).ok, false);
    me.itemCooldownUntil = 0;
    me.activeEffectUntil = start + 5000;
    assert.strictEqual(logic.validateItemUse(active, me, 'disturb', start + 1, config).ok, false);
    me.activeEffectUntil = 0;
    assert.strictEqual(logic.validateItemUse(active, me, 'hammer', start + 1, config).ok, false);

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
