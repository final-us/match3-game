'use strict';

// All gameplay/security thresholds live here so production tuning is auditable.
const CONFIG = Object.freeze({
    BATTLE_DURATION_MS: 60 * 1000,
    READY_COUNTDOWN_MS: 3000,
    FREEZE_DURATION_MS: 3000,
    DISTURB_DURATION_MS: 5000,
    OFFLINE_GRACE_MS: 10 * 1000,
    WAITING_ROOM_TTL_MS: 10 * 60 * 1000,
    REMATCH_ROOM_TTL_MS: 10 * 60 * 1000,
    ROOM_RETENTION_MS: 7 * 24 * 60 * 60 * 1000,
    ITEM_BUDGET: 3,
    ITEM_ALLOWLIST: Object.freeze(['freeze', 'disturb']),
    ITEM_COOLDOWN_MS: 10 * 1000,
    INITIAL_ITEMS: Object.freeze({ freeze: 1, disturb: 2 }),
    V3_ITEMS: Object.freeze({ freeze: 2, disturb: 1, reflect: 1, cheer: 1 }),
    V3_ITEM_ALLOWLIST: Object.freeze(['freeze', 'disturb', 'reflect', 'cheer']),
    V3_ITEM_BUDGET: 5,
    REFLECT_DURATION_MS: 5000,
    CHEER_DURATION_MS: 5000,
    SCORE_SAMPLE_FUTURE_MS: 1500,
    SCORE_SAMPLE_BATCH_MAX: 32,
    CREATE_RATE_LIMITS: Object.freeze({ perMinute: 5, perUtcDay: 60 }),
    SCORE_LIMITS: Object.freeze({
        MAX_SINGLE_INCREMENT: 10000,
        BASE_ALLOWANCE: 5000,
        POINTS_PER_SECOND: 2500
    })
});

const OUTCOMES = ['win', 'lose', 'draw'];
const CREATE_RATE_LIMIT_MESSAGE = '创建太频繁，请稍后再试';
const CREATE_LIMIT_DOCUMENT_PREFIX = 'L';
// Current IDs are R + base36 timestamp + 10 random hex chars. Bound the
// timestamp segment so malformed input cannot become an arbitrarily long id.
const ROOM_ID_PATTERN = /^R[0-9a-z]{8,10}[0-9a-f]{10}$/;

function isValidRoomId(value) {
    return typeof value === 'string' && ROOM_ID_PATTERN.test(value);
}

function isWaitingRoomExpired(room, at, ttlMs) {
    if (!room || room.status !== 'waiting') return false;
    const waitingAt = Number.isFinite(room.waitingAt) ? room.waitingAt : room.createdAt;
    if (!Number.isFinite(waitingAt) || !Number.isFinite(at)) return true;
    return at - waitingAt >= (ttlMs == null ? CONFIG.WAITING_ROOM_TTL_MS : ttlMs);
}

function isRematchRoomExpired(room, at, ttlMs) {
    if (!room || (room.status !== 'waiting' && room.status !== 'finished')) return false;
    const startedAt = room.status === 'finished' ? room.finishedAt : room.waitingAt;
    if (!Number.isFinite(startedAt) || !Number.isFinite(at)) return true;
    return at - startedAt >= (ttlMs == null ? CONFIG.REMATCH_ROOM_TTL_MS : ttlMs);
}

function isCleanupTimerEvent(event, openid) {
    return !openid && !!event && event.Type === 'Timer' &&
        event.TriggerName === 'cleanup-battle-rooms';
}

function finiteNonNegativeInteger(value) {
    return Number.isSafeInteger(value) && value >= 0;
}

function utcMinuteKey(at) {
    return Math.floor(Number(at) / 60000);
}

function utcDayKey(at) {
    return new Date(Number(at)).toISOString().slice(0, 10);
}

/** 在事务中消费一次建房额度；计数器缺失或跨窗口时从零开始。 */
function consumeCreateRateLimit(counter, at, limits) {
    const rules = limits || CONFIG.CREATE_RATE_LIMITS;
    const minuteKey = utcMinuteKey(at);
    const dayKey = utcDayKey(at);
    const minuteCount = counter && counter.minuteKey === minuteKey && finiteNonNegativeInteger(counter.minuteCount)
        ? counter.minuteCount : 0;
    const dayCount = counter && counter.dayKey === dayKey && finiteNonNegativeInteger(counter.dayCount)
        ? counter.dayCount : 0;
    if (minuteCount >= rules.perMinute || dayCount >= rules.perUtcDay) {
        return { ok: false, err: CREATE_RATE_LIMIT_MESSAGE, minuteKey: minuteKey, dayKey: dayKey,
            minuteCount: minuteCount, dayCount: dayCount };
    }
    return {
        ok: true,
        next: {
            createdAt: at,
            minuteKey: minuteKey,
            minuteCount: minuteCount + 1,
            dayKey: dayKey,
            dayCount: dayCount + 1
        }
    };
}

function validateItemConfig(items, config) {
    const rules = config || CONFIG;
    if (!items || typeof items !== 'object' || Array.isArray(items)) {
        return { ok: false, err: '道具配置非法' };
    }
    const allowed = rules.ITEM_ALLOWLIST;
    const keys = Object.keys(items);
    for (let i = 0; i < keys.length; i++) {
        if (allowed.indexOf(keys[i]) < 0) return { ok: false, err: '道具配置非法' };
    }
    const normalized = {};
    let total = 0;
    for (let i = 0; i < allowed.length; i++) {
        const item = allowed[i];
        const count = items[item];
        if (!finiteNonNegativeInteger(count)) return { ok: false, err: '道具配置非法' };
        normalized[item] = count;
        total += count;
    }
    if (total !== rules.ITEM_BUDGET) return { ok: false, err: '道具总数必须为' + rules.ITEM_BUDGET };
    return { ok: true, items: normalized };
}

function itemRules(room, config) {
    const rules = config || CONFIG;
    return room && room.itemRulesVersion === 3
        ? { ITEM_ALLOWLIST: rules.V3_ITEM_ALLOWLIST, ITEM_BUDGET: rules.V3_ITEM_BUDGET }
        : { ITEM_ALLOWLIST: rules.ITEM_ALLOWLIST, ITEM_BUDGET: rules.ITEM_BUDGET };
}

function validateRoomItemConfig(room, items, ready, config) {
    const rules = itemRules(room, config);
    if (!items || typeof items !== 'object' || Array.isArray(items)) return { ok: false, err: '道具配置非法' };
    const keys = Object.keys(items);
    if (keys.some(function (key) { return rules.ITEM_ALLOWLIST.indexOf(key) < 0; })) return { ok: false, err: '道具配置非法' };
    let total = 0;
    const normalized = {};
    for (const item of rules.ITEM_ALLOWLIST) {
        if (!finiteNonNegativeInteger(items[item])) return { ok: false, err: '道具配置非法' };
        normalized[item] = items[item];
        total += items[item];
    }
    if (total > rules.ITEM_BUDGET || (ready && total !== rules.ITEM_BUDGET) ||
        (room && room.itemRulesVersion !== 3 && total !== rules.ITEM_BUDGET)) {
        return { ok: false, err: '道具总数必须为' + rules.ITEM_BUDGET };
    }
    return { ok: true, items: normalized };
}

function validateItemUse(room, player, item, at, config) {
    const rules = config || CONFIG;
    if (itemRules(room, rules).ITEM_ALLOWLIST.indexOf(item) < 0) return { ok: false, err: '未知道具' };
    if (!room || room.status !== 'playing' || !Number.isFinite(room.startTime) || at < room.startTime) {
        return { ok: false, err: '对局未开始' };
    }
    if (at >= room.startTime + rules.BATTLE_DURATION_MS) return { ok: false, err: '对局已结束' };
    if (!player || !player.items || !finiteNonNegativeInteger(player.items[item]) || player.items[item] <= 0) {
        return { ok: false, err: '道具不足' };
    }
    if (Number(player.itemCooldownUntil) > at) return { ok: false, err: '道具冷却中' };
    if (Number(player.activeEffectUntil) > at) return { ok: false, err: '已有道具生效中' };
    if (Number(player.frozenUntil) > at) return { ok: false, err: '冻结中不能使用道具' };
    return { ok: true };
}

function validateRawScoreSamples(room, player, samples, at, config) {
    const rules = config || CONFIG;
    if (!Array.isArray(samples) || samples.length > rules.SCORE_SAMPLE_BATCH_MAX) {
        return { ok: false, err: '分数样本格式非法' };
    }
    if (room.status !== 'playing' || !Number.isFinite(room.startTime) || at < room.startTime ||
        at >= room.startTime + rules.BATTLE_DURATION_MS) return { ok: false, err: '对局未开始或已结束' };
    let seq = Number(player.scoreSeq) || 0;
    let rawScore = Number(player.rawScore) || 0;
    let score = Number(player.score) || 0;
    let lastAt = Number(player.lastScoreAt) || room.startTime;
    const lastSample = player.lastScoreSample;
    const cheerWindows = Array.isArray(player.cheerWindows) ? player.cheerWindows : [];
    for (const sample of samples) {
        if (!sample || !finiteNonNegativeInteger(sample.seq) || !finiteNonNegativeInteger(sample.score) ||
            !Number.isSafeInteger(sample.at)) return { ok: false, err: '分数样本格式非法' };
        if (sample.seq === seq && lastSample && sample.score === lastSample.score && sample.at === lastSample.at) continue;
        if (sample.seq !== seq + 1) return { ok: false, err: 'STALE_SCORE_SAMPLE' };
        if (sample.at < room.startTime || sample.at >= room.startTime + rules.BATTLE_DURATION_MS ||
            sample.at < lastAt ||
            sample.at > at + rules.SCORE_SAMPLE_FUTURE_MS) return { ok: false, err: '分数样本时间非法' };
        const delta = sample.score - rawScore;
        if (delta <= 0 || delta > rules.SCORE_LIMITS.MAX_SINGLE_INCREMENT) {
            return { ok: false, err: '单次分数增长异常' };
        }
        if (sample.score > scoreCeiling(room.startTime, sample.at, rules.SCORE_LIMITS) ||
            sample.score > scoreCeiling(room.startTime, at, rules.SCORE_LIMITS)) {
            return { ok: false, err: '分数增长速度异常' };
        }
        const doubled = cheerWindows.some(function (window) { return sample.at >= window.at && sample.at < window.until; });
        score += delta * (doubled ? 2 : 1);
        seq = sample.seq;
        rawScore = sample.score;
        lastAt = sample.at;
    }
    const latest = samples[samples.length - 1];
    return { ok: true, scoreSeq: seq, rawScore: rawScore, score: score,
        lastScoreAt: lastAt, lastScoreSample: seq === Number(player.scoreSeq || 0) ? lastSample :
            { seq: latest.seq, score: latest.score, at: latest.at } };
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
    isRematchRoomExpired: isRematchRoomExpired,
    isCleanupTimerEvent: isCleanupTimerEvent,
    finiteNonNegativeInteger: finiteNonNegativeInteger,
    CREATE_RATE_LIMIT_MESSAGE: CREATE_RATE_LIMIT_MESSAGE,
    CREATE_LIMIT_DOCUMENT_PREFIX: CREATE_LIMIT_DOCUMENT_PREFIX,
    utcMinuteKey: utcMinuteKey,
    utcDayKey: utcDayKey,
    consumeCreateRateLimit: consumeCreateRateLimit,
    validateItemConfig: validateItemConfig,
    itemRules: itemRules,
    validateRoomItemConfig: validateRoomItemConfig,
    validateItemUse: validateItemUse,
    validateRawScoreSamples: validateRawScoreSamples,
    scoreCeiling: scoreCeiling,
    validateScoreSync: validateScoreSync,
    isHeartbeatExpired: isHeartbeatExpired,
    determineFinish: determineFinish,
    ensureSettlementResults: ensureSettlementResults,
    effectsForPlayer: effectsForPlayer
};
