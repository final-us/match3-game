'use strict';

// All gameplay/security thresholds live here so production tuning is auditable.
const CONFIG = Object.freeze({
    BATTLE_DURATION_MS: 60 * 1000,
    READY_COUNTDOWN_MS: 3000,
    FREEZE_DURATION_MS: 3000,
    DISTURB_DURATION_MS: 5000,
    OFFLINE_GRACE_MS: 10 * 1000,
    WAITING_ROOM_TTL_MS: 10 * 60 * 1000,
    ROOM_RETENTION_MS: 7 * 24 * 60 * 60 * 1000,
    ITEM_LIMIT: 5,
    INITIAL_ITEMS: Object.freeze({ freeze: 1, disturb: 1 }),
    SCORE_LIMITS: Object.freeze({
        MAX_SINGLE_INCREMENT: 10000,
        BASE_ALLOWANCE: 5000,
        POINTS_PER_SECOND: 2500
    })
});

const OUTCOMES = ['win', 'lose', 'draw'];
// Current IDs are R + base36 timestamp + 10 random hex chars. Bound the
// timestamp segment so malformed input cannot become an arbitrarily long id.
const ROOM_ID_PATTERN = /^R[0-9a-z]{8,10}[0-9a-f]{10}$/;

function isValidRoomId(value) {
    return typeof value === 'string' && ROOM_ID_PATTERN.test(value);
}

function isWaitingRoomExpired(room, at, ttlMs) {
    if (!room || room.status !== 'waiting') return false;
    if (!Number.isFinite(room.createdAt) || !Number.isFinite(at)) return true;
    return at - room.createdAt >= (ttlMs == null ? CONFIG.WAITING_ROOM_TTL_MS : ttlMs);
}

function isCleanupTimerEvent(event, openid) {
    return !openid && !!event && event.Type === 'Timer' &&
        event.TriggerName === 'cleanup-battle-rooms';
}

function finiteNonNegativeInteger(value) {
    return Number.isSafeInteger(value) && value >= 0;
}

function scoreCeiling(startTime, at, limits) {
    const rules = limits || CONFIG.SCORE_LIMITS;
    const elapsedMs = Math.max(0, at - startTime);
    return rules.BASE_ALLOWANCE + Math.floor(elapsedMs * rules.POINTS_PER_SECOND / 1000);
}

function validateScoreSync(room, player, score, at, config) {
    const rules = config || CONFIG;
    if (!room || room.status !== 'playing') return { ok: false, err: '对局未开始' };
    if (!Number.isFinite(room.startTime) || room.startTime <= 0 || at < room.startTime) {
        return { ok: false, err: '对局尚未开始' };
    }
    if (at >= room.startTime + rules.BATTLE_DURATION_MS) return { ok: false, err: '对局已结束' };
    if (!finiteNonNegativeInteger(score)) return { ok: false, err: '分数格式非法' };

    const previousScore = finiteNonNegativeInteger(player && player.score) ? player.score : 0;
    if (score < previousScore) return { ok: false, err: '分数不能减少' };
    if (score - previousScore > rules.SCORE_LIMITS.MAX_SINGLE_INCREMENT) {
        return { ok: false, err: '单次分数增长异常' };
    }

    const ceiling = scoreCeiling(room.startTime, at, rules.SCORE_LIMITS);
    if (score > ceiling) return { ok: false, err: '分数增长速度异常' };
    return { ok: true, ceiling: ceiling };
}

function isHeartbeatExpired(player, at, graceMs) {
    if (!player || !Number.isFinite(player.lastSeen)) return true;
    return at - player.lastSeen > (graceMs == null ? CONFIG.OFFLINE_GRACE_MS : graceMs);
}

function determineFinish(room, queryingOpenid, at, config) {
    const rules = config || CONFIG;
    if (!room) return { finished: false };
    if (room.status === 'finished') return { finished: true, reason: 'existing' };
    if (room.status !== 'playing' || !Number.isFinite(room.startTime) || room.startTime <= 0) {
        return { finished: false };
    }
    if (at >= room.startTime + rules.BATTLE_DURATION_MS) return { finished: true, reason: 'time' };
    if (at < room.startTime) return { finished: false };

    const players = Array.isArray(room.players) ? room.players : [];
    const opponent = players.find(function (player) { return player.openid !== queryingOpenid; });
    if (opponent && isHeartbeatExpired(opponent, at, rules.OFFLINE_GRACE_MS)) {
        return { finished: true, reason: 'offline', loserOpenid: opponent.openid };
    }
    return { finished: false };
}

function invertOutcome(outcome) {
    if (outcome === 'win') return 'lose';
    if (outcome === 'lose') return 'win';
    return 'draw';
}

function validStoredResult(value) {
    return !!value && OUTCOMES.indexOf(value.result) >= 0;
}

function ensureSettlementResults(room, forcedLoserOpenid) {
    const players = room && Array.isArray(room.players) ? room.players : [];
    if (players.length !== 2 || !players[0].openid || !players[1].openid) {
        return room && room.result && typeof room.result === 'object' ? room.result : {};
    }

    const a = players[0];
    const b = players[1];
    const existing = room.result && typeof room.result === 'object' ? room.result : {};
    if (validStoredResult(existing[a.openid]) && validStoredResult(existing[b.openid])) return existing;

    let outcomeA;
    if (validStoredResult(existing[a.openid])) {
        outcomeA = existing[a.openid].result;
    } else if (validStoredResult(existing[b.openid])) {
        outcomeA = invertOutcome(existing[b.openid].result);
    } else if (forcedLoserOpenid) {
        outcomeA = a.openid === forcedLoserOpenid ? 'lose' : 'win';
    } else if (a.score > b.score) {
        outcomeA = 'win';
    } else if (a.score < b.score) {
        outcomeA = 'lose';
    } else {
        outcomeA = 'draw';
    }

    const scoreA = finiteNonNegativeInteger(a.score) ? a.score : 0;
    const scoreB = finiteNonNegativeInteger(b.score) ? b.score : 0;
    const results = {};
    results[a.openid] = { result: outcomeA, myScore: scoreA, oppScore: scoreB };
    results[b.openid] = { result: invertOutcome(outcomeA), myScore: scoreB, oppScore: scoreA };
    return results;
}

function effectsForPlayer(effects, openid) {
    if (!Array.isArray(effects)) return [];
    return effects.filter(function (effect) {
        if (!effect) return false;
        if (effect.toOpenid) return effect.toOpenid === openid;
        // Legacy effects did not store a target; infer it from the caster.
        return effect.fromOpenid !== openid;
    });
}

module.exports = {
    CONFIG: CONFIG,
    isValidRoomId: isValidRoomId,
    isWaitingRoomExpired: isWaitingRoomExpired,
    isCleanupTimerEvent: isCleanupTimerEvent,
    finiteNonNegativeInteger: finiteNonNegativeInteger,
    scoreCeiling: scoreCeiling,
    validateScoreSync: validateScoreSync,
    isHeartbeatExpired: isHeartbeatExpired,
    determineFinish: determineFinish,
    ensureSettlementResults: ensureSettlementResults,
    effectsForPlayer: effectsForPlayer
};
