/**
 * 消消乐双人对战云函数。
 * 用户身份由 cloud.getWXContext() 提供；房间关键操作均在单文档事务中完成。
 */

'use strict';

const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const logic = require('./logic');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const rooms = db.collection('battle_rooms');
const CONFIG = logic.CONFIG;

function genRoomId() {
    return 'R' + Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
}

function now() { return Date.now(); }

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

function newPlayer(openid, nickname, at) {
    return {
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

function finishRoom(room, at, reason, loserOpenid) {
    room.status = 'finished';
    room.finishedAt = room.finishedAt || at;
    room.finishReason = room.finishReason || reason;
    room.result = logic.ensureSettlementResults(room, loserOpenid);
}

function buildQueryResponse(room, openid, at) {
    const me = room.players.find(function (player) { return player.openid === openid; });
    const opponent = room.players.find(function (player) { return player.openid !== openid; });
    const opponentOnline = opponent ? !logic.isHeartbeatExpired(opponent, at, CONFIG.OFFLINE_GRACE_MS) : false;
    return {
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
        effects: logic.effectsForPlayer(room.effects, openid),
        casts: Array.isArray(room.casts) ? room.casts.filter(function (cast) {
            return cast && cast.fromOpenid === openid;
        }) : [],
        result: room.result && room.result[openid] ? room.result[openid] : null
    };
}

async function cleanupExpiredRooms(at) {
    // 建房计数器也是带 createdAt 的控制文档；它们不匹配房间 ID，永远不会进入普通房间事务。
    const res = await rooms.where({
        createdAt: db.command.lt(at - CONFIG.ROOM_RETENTION_MS)
    }).remove();
    const removed = res && res.stats ? Number(res.stats.removed) : 0;
    return { ok: true, deleted: Number.isSafeInteger(removed) && removed >= 0 ? removed : 0 };
}

/** 创建房间。 */
async function create(openid, event) {
    const at = now();
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
            players: [newPlayer(openid, event.nickname, at)],
            effects: [],
            casts: [],
            result: {}
        };
        await limitRef.set({ data: Object.assign({ kind: 'create_rate_limit' }, allowance.next) });
        await roomRef.set({ data: room });
        return { ok: true, roomId: roomId };
    });
}

async function join(openid, event) {
    const at = now();
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
        if (logic.isWaitingRoomExpired(room, at)) return { ok: false, err: '邀请已失效' };
        if (room.status !== 'waiting') return { ok: false, err: '对局已开始' };

        const players = Array.isArray(room.players) ? room.players : [];
        const index = players.findIndex(function (player) { return player.openid === openid; });
        if (index >= 0) {
            players[index].online = true;
            players[index].lastSeen = at;
        } else {
            if (players.length >= 2) return { ok: false, err: '房间已满' };
            players.push(newPlayer(openid, event.nickname, at));
        }
        await ref.update({ data: { players: players } });
        return { ok: true, roomId: event.roomId };
    });
}

async function ready(openid, event) {
    const at = now();
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
        if (logic.isWaitingRoomExpired(room, at)) return { ok: false, err: '邀请已失效' };
        if (room.status !== 'waiting') return { ok: false, err: '对局已开始' };

        const player = room.players.find(function (candidate) { return candidate.openid === openid; });
        if (!player) return { ok: false, err: '不在房间' };
        if (!player.ready) {
            const validation = logic.validateItemConfig(player.items, CONFIG);
            if (!validation.ok) return validation;
            player.items = validation.items;
        }
        player.ready = !player.ready;
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
        return { ok: true, ready: player.ready, items: player.items };
    });
}

async function configureItems(openid, event) {
    const at = now();
    const validation = logic.validateItemConfig(event.items, CONFIG);
    if (!validation.ok) return validation;
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
        if (logic.isWaitingRoomExpired(room, at)) return { ok: false, err: '邀请已失效' };
        if (room.status !== 'waiting') return { ok: false, err: '对局已开始' };
        const player = room.players.find(function (candidate) { return candidate.openid === openid; });
        if (!player) return { ok: false, err: '不在房间' };
        if (player.ready) return { ok: false, err: '请先取消准备' };
        player.items = validation.items;
        player.online = true;
        player.lastSeen = at;
        await ref.update({ data: { players: room.players } });
        return { ok: true, items: player.items };
    });
}

async function syncScore(openid, event) {
    const at = now();
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
        const player = room.players.find(function (candidate) { return candidate.openid === openid; });
        if (!player) return { ok: false, err: '不在房间' };

        const validation = logic.validateScoreSync(room, player, event.score, at, CONFIG);
        if (!validation.ok) return validation;

        player.score = event.score;
        player.online = true;
        player.lastSeen = at;
        await ref.update({ data: { players: room.players } });
        return { ok: true };
    });
}

async function useItem(openid, event) {
    const at = now();
    const item = event.item;
    if (CONFIG.ITEM_ALLOWLIST.indexOf(item) < 0) return { ok: false, err: '未知道具' };

    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
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
        return {
            ok: true,
            items: player.items,
            itemCooldownUntil: player.itemCooldownUntil,
            activeEffectUntil: player.activeEffectUntil,
            effect: effect
        };
    });
}

async function leave(openid, event) {
    const at = now();
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: true };
        const player = room.players.find(function (candidate) { return candidate.openid === openid; });
        if (!player) return { ok: true };

        player.online = false;
        player.lastSeen = at;
        const update = { players: room.players };
        if (room.status === 'playing' && room.players.length === 2) {
            finishRoom(room, at, 'leave', openid);
            update.status = room.status;
            update.finishedAt = room.finishedAt;
            update.finishReason = room.finishReason;
            update.result = room.result;
        }
        await ref.update({ data: update });
        return { ok: true };
    });
}

async function query(openid, event) {
    const at = now();
    return runRoomTransaction(event.roomId, async function (room, ref) {
        if (!room) return { ok: false, err: '房间不存在' };
        if (logic.isWaitingRoomExpired(room, at)) return { ok: false, err: '邀请已失效' };
        const me = room.players.find(function (candidate) { return candidate.openid === openid; });
        if (!me) return { ok: false, err: '不在房间' };

        me.lastSeen = at;
        me.online = true;

        const finish = logic.determineFinish(room, openid, at, CONFIG);
        if (finish.finished && room.status !== 'finished') {
            finishRoom(room, at, finish.reason, finish.loserOpenid);
        } else if (room.status === 'finished') {
            // Repair legacy rooms that persisted only one player's result.
            room.result = logic.ensureSettlementResults(room, finish.loserOpenid);
        }

        const update = {
            players: room.players,
            status: room.status,
            result: room.result || {}
        };
        if (room.finishedAt) update.finishedAt = room.finishedAt;
        if (room.finishReason) update.finishReason = room.finishReason;
        await ref.update({ data: update });
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
            default: return { ok: false, err: '未知操作' };
        }
    } catch (error) {
        console.error('battle action failed', action, error);
        return { ok: false, err: '服务异常' };
    }
};
