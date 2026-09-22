/**
 * 消消乐双人对战云函数。
 * 用户身份由 cloud.getWXContext() 提供；房间关键操作均在单文档事务中完成。
 */

'use strict';

const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const logic = require('./logic');
const daily = require('./daily');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const rooms = db.collection('battle_rooms');
const CONFIG = logic.CONFIG;

function genRoomId() {
    return 'R' + Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
}

function now() { return Date.now(); }
const dailyService = daily.createService(db, crypto, now);

function createLimitDocId(openid) {
    return logic.CREATE_LIMIT_DOCUMENT_PREFIX + crypto.createHash('sha256')
        .update(String(openid))
        .digest('hex')
        .slice(0, 24);
}

function safeNickname(value) {
    if (typeof value !== 'string') return '玩家';
    const trimmed = value.trim().slice(0, 12);
    return trimmed || '玩家';
}

function newPlayer(openid, nickname, at, protocolVersion) {
    const player = {
        openid: openid,
        nickname: safeNickname(nickname),
        score: 0,
        ready: false,
        items: { ...CONFIG.INITIAL_ITEMS },
        itemCooldownUntil: 0,
        activeEffectUntil: 0,
        online: true,
        lastSeen: at
    };
    if (protocolVersion === 2) {
        player.wins = 0;
        player.rematchAccepted = false;
        player.left = false;
    }
    return player;
}

async function getRoom(ref) {
    const res = await ref.get();
    return res && res.data ? res.data : null;
}

async function runRoomTransaction(roomId, handler) {
    if (!logic.isValidRoomId(roomId)) return { ok: false, err: '房间号格式非法' };
    return db.runTransaction(async function (transaction) {
        const ref = transaction.collection('battle_rooms').doc(roomId);
        const room = await getRoom(ref);
        return handler(room, ref);
    });
}

function settlementId(roomId, roundId, openid) {
    return 's' + crypto.createHash('sha256')
        .update(String(roomId) + ':' + String(roundId) + ':' + String(openid))
        .digest('hex')
        .slice(0, 32);
}

function coinRewardFor(result) {
    return result === 'win' ? 150 : (result === 'draw' ? 50 : 30);
}

function settleV2Round(room, roomId) {
    if (room.protocolVersion !== 2 || room.settledRoundId === room.roundId) return;
    room.players.forEach(function (player) {
        const entry = room.result && room.result[player.openid];
        if (!entry) return;
        entry.roundId = room.roundId;
        entry.settlementId = entry.settlementId || settlementId(roomId, room.roundId, player.openid);
        entry.coinReward = Number.isSafeInteger(entry.coinReward) ? entry.coinReward : coinRewardFor(entry.result);
        player.wins = logic.finiteNonNegativeInteger(player.wins) ? player.wins : 0;
        if (entry.result === 'win') player.wins++;
    });
    room.settledRoundId = room.roundId;
}

function finishRoom(room, roomId, at, reason, loserOpenid) {
    room.status = 'finished';
    room.finishedAt = room.finishedAt || at;
    room.finishReason = room.finishReason || reason;
    room.result = logic.ensureSettlementResults(room, loserOpenid);
    settleV2Round(room, roomId);
}

function buildQueryResponse(room, openid, at) {
    const me = room.players.find(function (player) { return player.openid === openid; });
    const opponent = room.players.find(function (player) { return player.openid !== openid; });
    const opponentOnline = opponent ? opponent.online !== false &&
        !logic.isHeartbeatExpired(opponent, at, CONFIG.OFFLINE_GRACE_MS) : false;
    const response = {
        ok: true,
        status: room.status,
        startTime: room.startTime,
        myReady: me ? me.ready : false,
        myScore: me ? me.score : 0,
        myItems: me ? me.items : { freeze: 0, disturb: 0 },
        myItemCooldownUntil: me ? Number(me.itemCooldownUntil) || 0 : 0,
        myActiveEffectUntil: me ? Number(me.activeEffectUntil) || 0 : 0,
        opp: opponent ? {
            nickname: opponent.nickname,
            score: opponent.score,
            ready: opponent.ready,
            configuring: !opponent.ready,
            online: opponentOnline
        } : null,
        effects: logic.effectsForPlayer(room.effects, openid).map(function (effect) {
            return { id: effect.id, item: effect.item, duration: effect.duration, at: effect.at, until: effect.until };
        }),
        casts: Array.isArray(room.casts) ? room.casts.filter(function (cast) {
            return cast && cast.fromOpenid === openid;
        }).map(function (cast) { return { id: cast.id, item: cast.item, at: cast.at }; }) : [],
        result: room.result && room.result[openid] ? room.result[openid] : null
    };
    if (room.protocolVersion === 2) {
        response.protocolVersion = 2;
        response.roundId = room.roundId;
        response.roundNumber = room.roundNumber;
        response.myWins = me && logic.finiteNonNegativeInteger(me.wins) ? me.wins : 0;
        response.oppWins = opponent && logic.finiteNonNegativeInteger(opponent.wins) ? opponent.wins : 0;
        response.myRematch = !!(me && me.rematchAccepted);
        response.oppRematch = !!(opponent && opponent.rematchAccepted);
        response.oppLeft = !!room.opponentLeft || !!(opponent && opponent.left);
        response.canRematch = room.status === 'finished' && !!opponent && !response.oppLeft &&
            !logic.isRematchRoomExpired(room, at) &&
            !logic.isHeartbeatExpired(opponent, at, CONFIG.OFFLINE_GRACE_MS);
    }
    return response;
}

function isV2(room) { return room && room.protocolVersion === 2; }

function staleRound(room, event) {
    if (!isV2(room)) return null;
    if (event.protocolVersion !== 2 || !Number.isSafeInteger(event.roundId) || event.roundId !== room.roundId) {
        return { ok: false, err: 'STALE_ROUND' };
    }
    return null;
}

function updateV2Room(room, at, keepWins) {
    room.roundId++;
    room.roundNumber = keepWins && Number.isSafeInteger(room.roundNumber) && room.roundNumber > 0
        ? room.roundNumber + 1 : 1;
    room.status = 'waiting';
    room.startTime = 0;
    room.waitingAt = at;
    room.finishedAt = 0;
    room.finishReason = '';
    room.result = {};
    room.effects = [];
    room.casts = [];
    room.settledRoundId = 0;
    room.opponentLeft = false;
    room.players.forEach(function (player) {
        player.score = 0;
        player.ready = false;
        player.items = { ...CONFIG.INITIAL_ITEMS };
        player.itemCooldownUntil = 0;
        player.activeEffectUntil = 0;
        player.rematchAccepted = false;
        player.left = false;
        if (!keepWins) player.wins = 0;
    });
}

async function cleanupExpiredRooms(at) {
    // 建房计数器也是带 createdAt 的控制文档；它们不匹配房间 ID，永远不会进入普通房间事务。
    const res = await rooms.where({
        createdAt: db.command.lt(at - CONFIG.ROOM_RETENTION_MS)
    }).remove();
    const removed = res && res.stats ? Number(res.stats.removed) : 0;
    const dailyRemoved = await dailyService.cleanup(at);
    const total = (Number.isSafeInteger(removed) && removed >= 0 ? removed : 0) + dailyRemoved;
    return { ok: true, deleted: total };
}

/** 创建房间。 */
async function create(openid, event) {
    const at = now();
    const protocolVersion = event.protocolVersion === 2 ? 2 : 1;
    return db.runTransaction(async function (transaction) {
        const limitRef = transaction.collection('battle_rooms').doc(createLimitDocId(openid));
        const counter = await getRoom(limitRef);
        const allowance = logic.consumeCreateRateLimit(counter, at, CONFIG.CREATE_RATE_LIMITS);
        if (!allowance.ok) return { ok: false, err: logic.CREATE_RATE_LIMIT_MESSAGE };

        const roomId = genRoomId();
        const roomRef = transaction.collection('battle_rooms').doc(roomId);
        const room = {
            status: 'waiting',
            startTime: 0,
            createdAt: at,
            players: [newPlayer(openid, event.nickname, at, protocolVersion)],
            effects: [],
            casts: [],
            result: {}
        };
        if (protocolVersion === 2) {
            room.protocolVersion = 2;
            room.roundId = 1;
            room.roundNumber = 1;
            room.waitingAt = at;
            room.settledRoundId = 0;
        }
        await limitRef.set({ data: Object.assign({ kind: 'create_rate_limit' }, allowance.next) });
        await roomRef.set({ data: room });
        return protocolVersion === 2
            ? { ok: true, roomId: roomId, protocolVersion: 2, roundId: 1, roundNumber: 1 }
            : { ok: true, roomId: roomId };
    });
}

async function join(openid, event) {
    const at = now();
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
        if (isV2(room) && event.protocolVersion !== 2) return { ok: false, err: 'UPDATE_REQUIRED' };
        if (logic.isWaitingRoomExpired(room, at)) return { ok: false, err: '邀请已失效' };
        if (room.status !== 'waiting') return { ok: false, err: '对局已开始' };

        const players = Array.isArray(room.players) ? room.players : [];
        const index = players.findIndex(function (player) { return player.openid === openid; });
        if (index >= 0) {
            players[index].online = true;
            players[index].lastSeen = at;
        } else {
            if (players.length >= 2) return { ok: false, err: '房间已满' };
            // 换了对手后，留下的玩家也要重新确认准备。
            players.forEach(function (candidate) { candidate.ready = false; });
            players.push(newPlayer(openid, event.nickname, at, room.protocolVersion));
            if (isV2(room)) updateV2Room(room, at, false);
        }
        await ref.update({ data: isV2(room) ? {
            players: room.players, status: room.status, startTime: room.startTime, waitingAt: room.waitingAt,
            finishedAt: room.finishedAt, finishReason: room.finishReason, result: room.result, effects: room.effects,
            casts: room.casts, settledRoundId: room.settledRoundId, roundId: room.roundId, roundNumber: room.roundNumber
        } : { players: players } });
        return isV2(room)
            ? { ok: true, roomId: event.roomId, protocolVersion: 2, roundId: room.roundId, roundNumber: room.roundNumber }
            : { ok: true, roomId: event.roomId };
    });
}

async function ready(openid, event) {
    const at = now();
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
        const stale = staleRound(room, event);
        if (stale) return stale;
        if (logic.isWaitingRoomExpired(room, at)) return { ok: false, err: '邀请已失效' };
        if (room.status !== 'waiting') return { ok: false, err: '对局已开始' };

        const player = room.players.find(function (candidate) { return candidate.openid === openid; });
        if (!player) return { ok: false, err: '不在房间' };
        const requestedReady = isV2(room) ? event.ready : !player.ready;
        if (isV2(room) && typeof event.ready !== 'boolean') return { ok: false, err: '准备状态非法' };
        if (requestedReady && !player.ready) {
            const validation = logic.validateItemConfig(player.items, CONFIG);
            if (!validation.ok) return validation;
            player.items = validation.items;
        }
        player.ready = requestedReady;
        player.online = true;
        player.lastSeen = at;

        const update = { players: room.players };
        const allReady = room.players.length === 2 && room.players.every(function (candidate) {
            return candidate.ready;
        });
        if (allReady) {
            update.status = 'playing';
            update.startTime = at + CONFIG.READY_COUNTDOWN_MS;
        }
        await ref.update({ data: update });
        return isV2(room)
            ? { ok: true, ready: player.ready, items: player.items, protocolVersion: 2, roundId: room.roundId }
            : { ok: true, ready: player.ready, items: player.items };
    });
}

async function configureItems(openid, event) {
    const at = now();
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
        const stale = staleRound(room, event);
        if (stale) return stale;
        const validation = logic.validateItemConfig(event.items, CONFIG);
        if (!validation.ok) return validation;
        if (logic.isWaitingRoomExpired(room, at)) return { ok: false, err: '邀请已失效' };
        if (room.status !== 'waiting') return { ok: false, err: '对局已开始' };
        const player = room.players.find(function (candidate) { return candidate.openid === openid; });
        if (!player) return { ok: false, err: '不在房间' };
        if (player.ready) return { ok: false, err: '请先取消准备' };
        player.items = validation.items;
        player.online = true;
        player.lastSeen = at;
        await ref.update({ data: { players: room.players } });
        return isV2(room)
            ? { ok: true, items: player.items, protocolVersion: 2, roundId: room.roundId }
            : { ok: true, items: player.items };
    });
}

async function syncScore(openid, event) {
    const at = now();
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
        const stale = staleRound(room, event);
        if (stale) return stale;
        const player = room.players.find(function (candidate) { return candidate.openid === openid; });
        if (!player) return { ok: false, err: '不在房间' };

        const validation = logic.validateScoreSync(room, player, event.score, at, CONFIG);
        if (!validation.ok) return validation;

        player.score = event.score;
        player.online = true;
        player.lastSeen = at;
        await ref.update({ data: { players: room.players } });
        return isV2(room) ? { ok: true, protocolVersion: 2, roundId: room.roundId } : { ok: true };
    });
}

async function useItem(openid, event) {
    const at = now();

    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
        const stale = staleRound(room, event);
        if (stale) return stale;
        const item = event.item;
        if (CONFIG.ITEM_ALLOWLIST.indexOf(item) < 0) return { ok: false, err: '未知道具' };
        const player = room.players.find(function (candidate) { return candidate.openid === openid; });
        if (!player) return { ok: false, err: '不在房间' };
        const validation = logic.validateItemUse(room, player, item, at, CONFIG);
        if (!validation.ok) return validation;
        const opponent = room.players.find(function (candidate) { return candidate.openid !== openid; });
        if (!opponent) return { ok: false, err: '对手不存在' };

        player.items[item]--;
        const duration = item === 'freeze' ? CONFIG.FREEZE_DURATION_MS : CONFIG.DISTURB_DURATION_MS;
        player.itemCooldownUntil = at + CONFIG.ITEM_COOLDOWN_MS;
        player.activeEffectUntil = at + duration;
        player.online = true;
        player.lastSeen = at;
        const effects = Array.isArray(room.effects) ? room.effects : [];
        const effect = {
            id: 'e' + at + Math.floor(Math.random() * 1000),
            item: item,
            duration: duration,
            fromOpenid: openid,
            toOpenid: opponent.openid,
            at: at,
            until: at + duration
        };
        effects.push(effect);
        const casts = Array.isArray(room.casts) ? room.casts : [];
        casts.push({ id: effect.id, item: item, fromOpenid: openid, at: at });

        await ref.update({ data: { players: room.players, effects: effects, casts: casts } });
        const response = {
            ok: true,
            items: player.items,
            itemCooldownUntil: player.itemCooldownUntil,
            activeEffectUntil: player.activeEffectUntil,
            effect: { id: effect.id, item: effect.item, duration: effect.duration, at: effect.at, until: effect.until }
        };
        if (isV2(room)) {
            response.protocolVersion = 2;
            response.roundId = room.roundId;
        }
        return response;
    });
}

async function leave(openid, event) {
    const at = now();
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: true };
        const stale = staleRound(room, event);
        if (stale) return stale;
        const player = room.players.find(function (candidate) { return candidate.openid === openid; });
        if (!player) return { ok: true };

        if (room.status === 'waiting') {
            const remaining = room.players.filter(function (candidate) { return candidate.openid !== openid; });
            remaining.forEach(function (candidate) { candidate.ready = false; });
            if (isV2(room) && remaining.length) {
                room.players = remaining;
                updateV2Room(room, at, false);
            }
            const update = { players: remaining };
            if (isV2(room) && remaining.length) {
                update.players = room.players;
                update.status = room.status;
                update.startTime = room.startTime;
                update.waitingAt = room.waitingAt;
                update.finishedAt = room.finishedAt;
                update.finishReason = room.finishReason;
                update.result = room.result;
                update.effects = room.effects;
                update.casts = room.casts;
                update.settledRoundId = room.settledRoundId;
                update.roundId = room.roundId;
                update.roundNumber = room.roundNumber;
            }
            if (!remaining.length) {
                update.status = 'finished';
                update.finishedAt = at;
                update.finishReason = 'leave';
            }
            await ref.update({ data: update });
            return isV2(room) ? { ok: true, protocolVersion: 2, roundId: room.roundId } : { ok: true };
        }

        if (isV2(room) && room.status === 'finished') {
            player.left = true;
            player.online = false;
            player.lastSeen = at;
            room.opponentLeft = true;
            await ref.update({ data: { players: room.players, opponentLeft: true } });
            return { ok: true, protocolVersion: 2, roundId: room.roundId };
        }

        player.online = false;
        if (isV2(room)) player.left = true;
        player.lastSeen = at;
        const update = { players: room.players };
        if (room.status === 'playing' && room.players.length === 2) {
            finishRoom(room, event.roomId, at, 'leave', openid);
            update.status = room.status;
            update.finishedAt = room.finishedAt;
            update.finishReason = room.finishReason;
            update.result = room.result;
            if (isV2(room)) update.settledRoundId = room.settledRoundId;
        }
        await ref.update({ data: update });
        return isV2(room) ? { ok: true, protocolVersion: 2, roundId: room.roundId } : { ok: true };
    });
}

async function query(openid, event) {
    const at = now();
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
        if (logic.isWaitingRoomExpired(room, at)) return { ok: false, err: '邀请已失效' };
        if (isV2(room) && room.status === 'finished' && logic.isRematchRoomExpired(room, at)) {
            return { ok: false, err: '续局已失效' };
        }
        const me = room.players.find(function (candidate) { return candidate.openid === openid; });
        if (!me || me.left) return { ok: false, err: '不在房间' };

        me.lastSeen = at;
        me.online = true;

        const finish = logic.determineFinish(room, openid, at, CONFIG);
        if (finish.finished && room.status !== 'finished') {
            finishRoom(room, event.roomId, at, finish.reason, finish.loserOpenid);
        } else if (room.status === 'finished') {
            // Repair legacy rooms that persisted only one player's result.
            room.result = logic.ensureSettlementResults(room, finish.loserOpenid);
            settleV2Round(room, event.roomId);
        }

        const update = {
            players: room.players,
            status: room.status,
            result: room.result || {}
        };
        if (room.finishedAt) update.finishedAt = room.finishedAt;
        if (room.finishReason) update.finishReason = room.finishReason;
        if (isV2(room)) {
            update.roundId = room.roundId;
            update.roundNumber = room.roundNumber;
            update.settledRoundId = room.settledRoundId;
            update.finishedAt = room.finishedAt || 0;
        }
        await ref.update({ data: update });
        return buildQueryResponse(room, openid, at);
    });
}

async function rematch(openid, event) {
    const at = now();
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
        const stale = staleRound(room, event);
        if (stale) return stale;
        if (!isV2(room)) return { ok: false, err: '不支持续局' };
        if (room.status !== 'finished') return { ok: false, err: '对局未结束' };
        if (logic.isRematchRoomExpired(room, at)) return { ok: false, err: '续局已失效' };
        if (typeof event.accept !== 'boolean') return { ok: false, err: '续局状态非法' };
        const player = room.players.find(function (candidate) { return candidate.openid === openid; });
        if (!player || player.left) return { ok: false, err: '不在房间' };
        const opponent = room.players.find(function (candidate) { return candidate.openid !== openid; });
        player.rematchAccepted = event.accept;
        player.online = true;
        player.lastSeen = at;
        if (event.accept && opponent && !opponent.left && opponent.rematchAccepted &&
            !logic.isHeartbeatExpired(opponent, at, CONFIG.OFFLINE_GRACE_MS)) {
            updateV2Room(room, at, true);
        }
        await ref.update({ data: {
            players: room.players, status: room.status, startTime: room.startTime, waitingAt: room.waitingAt,
            finishedAt: room.finishedAt, finishReason: room.finishReason, result: room.result, effects: room.effects,
            casts: room.casts, settledRoundId: room.settledRoundId, roundId: room.roundId, roundNumber: room.roundNumber
        } });
        return buildQueryResponse(room, openid, at);
    });
}

exports.main = async function (event) {
    const input = event && typeof event === 'object' ? event : {};
    const action = typeof input.action === 'string' ? input.action : '';
    try {
        const context = cloud.getWXContext() || {};
        const openid = context.OPENID;
        if (logic.isCleanupTimerEvent(input, openid)) return await cleanupExpiredRooms(now());
        if (!openid) return { ok: false, err: '身份校验失败' };
        switch (action) {
            case 'create': return await create(openid, input);
            case 'join': return await join(openid, input);
            case 'configureItems': return await configureItems(openid, input);
            case 'ready': return await ready(openid, input);
            case 'syncScore': return await syncScore(openid, input);
            case 'useItem': return await useItem(openid, input);
            case 'leave': return await leave(openid, input);
            case 'query': return await query(openid, input);
            case 'rematch': return await rematch(openid, input);
            case 'dailyInfo': return await dailyService.info(openid);
            case 'dailyStart': return await dailyService.start(openid, input);
            case 'dailyCheckpoint': return await dailyService.checkpoint(openid, input);
            case 'dailySubmit': return await dailyService.submit(openid, input);
            default: return { ok: false, err: '未知操作' };
        }
    } catch (error) {
        console.error('battle action failed', action, error);
        return { ok: false, err: '服务异常' };
    }
};
