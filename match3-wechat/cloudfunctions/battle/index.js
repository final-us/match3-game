/**
 * 消消乐双人对战云函数（替代 WebSocket 方案）
 * 架构：云函数处理操作 + 云数据库存房间状态 + 前端轮询同步
 *
 * 用户身份：云函数通过 cloud.getWXContext() 自动获取 OPENID（无需前端传，防作弊）
 *
 * action 类型：
 *   create / join / ready / syncScore / useItem / leave / query
 *
 * 数据库集合：battle_rooms
 * 房间文档结构：
 *   {
 *     _id: 'R123456',          // 房间号
 *     status: 'waiting'|'playing'|'finished',
 *     startTime: 0,            // 开局时间戳（服务端）
 *     createdAt: 0,
 *     players: [               // 玩家数组
 *       { openid, nickname, score, ready, items:{freeze,disturb}, usedCount:{freeze,disturb}, online, lastSeen }
 *     ],
 *     effects: [               // 道具效果队列（对手轮询发现新 effect）
 *       { id, item, duration, fromOpenid, at }
 *     ],
 *     result: {}               // 结算结果（每人一份）
 *   }
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const rooms = db.collection('battle_rooms');

// ===== 对战参数（可调）=====
const BATTLE_DURATION = 60 * 1000;
const READY_COUNTDOWN = 3000;
const FREEZE_DURATION = 3000;
const DISTURB_DURATION = 5000;
const OFFLINE_GRACE = 10 * 1000;
const ITEM_LIMIT = 5;
const INITIAL_ITEMS = { freeze: 1, disturb: 1 };

function genRoomId() {
    return 'R' + Math.floor(100000 + Math.random() * 900000);
}

function now() { return Date.now(); }

/** 创建房间 */
async function create(openid, event) {
    const roomId = genRoomId();
    const room = {
        _id: roomId,
        status: 'waiting',
        startTime: 0,
        createdAt: now(),
        players: [{
            openid: openid,
            nickname: event.nickname || '玩家',
            score: 0,
            ready: false,
            items: { ...INITIAL_ITEMS },
            usedCount: { freeze: 0, disturb: 0 },
            online: true,
            lastSeen: now()
        }],
        effects: [],
        result: {}
    };
    await rooms.add({ data: room });
    return { ok: true, roomId: roomId };
}

/** 加入房间 */
async function join(openid, event) {
    const roomId = event.roomId;
    const res = await rooms.doc(roomId).get().catch(() => null);
    if (!res || !res.data) return { ok: false, err: '房间不存在' };
    const room = res.data;
    if (room.status !== 'waiting') return { ok: false, err: '对局已开始' };

    const idx = room.players.findIndex(p => p.openid === openid);
    if (idx >= 0) {
        // 重连：更新在线状态
        room.players[idx].online = true;
        room.players[idx].lastSeen = now();
    } else {
        if (room.players.length >= 2) return { ok: false, err: '房间已满' };
        room.players.push({
            openid: openid,
            nickname: event.nickname || '玩家',
            score: 0,
            ready: false,
            items: { ...INITIAL_ITEMS },
            usedCount: { freeze: 0, disturb: 0 },
            online: true,
            lastSeen: now()
        });
    }
    await rooms.doc(roomId).update({ data: { players: room.players } });
    return { ok: true, roomId: roomId };
}

/** 准备 */
async function ready(openid, event) {
    const roomId = event.roomId;
    const res = await rooms.doc(roomId).get().catch(() => null);
    if (!res || !res.data) return { ok: false, err: '房间不存在' };
    const room = res.data;
    if (room.status !== 'waiting') return { ok: false, err: '对局已开始' };

    const p = room.players.find(p => p.openid === openid);
    if (!p) return { ok: false, err: '不在房间' };
    p.ready = true;
    p.lastSeen = now();

    // 双方就绪 → 3 秒后开局（记录 readyTime，query 时判断）
    const allReady = room.players.length === 2 && room.players.every(x => x.ready);
    const update = { players: room.players };
    if (allReady) {
        update.status = 'playing';
        update.startTime = now() + READY_COUNTDOWN;
    }
    await rooms.doc(roomId).update({ data: update });
    return { ok: true };
}

/** 同步分数（对战中） */
async function syncScore(openid, event) {
    const roomId = event.roomId;
    const res = await rooms.doc(roomId).get().catch(() => null);
    if (!res || !res.data) return { ok: false, err: '房间不存在' };
    const room = res.data;
    const p = room.players.find(p => p.openid === openid);
    if (!p) return { ok: false, err: '不在房间' };
    p.score = event.score || 0;
    p.lastSeen = now();
    await rooms.doc(roomId).update({ data: { players: room.players } });
    return { ok: true };
}

/** 使用道具（冰冻/干扰） */
async function useItem(openid, event) {
    const roomId = event.roomId;
    const item = event.item;
    if (item !== 'freeze' && item !== 'disturb') return { ok: false, err: '未知道具' };

    const res = await rooms.doc(roomId).get().catch(() => null);
    if (!res || !res.data) return { ok: false, err: '房间不存在' };
    const room = res.data;
    if (room.status !== 'playing') return { ok: false, err: '对局未开始' };

    const p = room.players.find(p => p.openid === openid);
    if (!p) return { ok: false, err: '不在房间' };
    if (p.items[item] <= 0) return { ok: false, err: '道具不足' };
    if (p.usedCount[item] >= ITEM_LIMIT) return { ok: false, err: '已达本局上限' };

    p.items[item]--;
    p.usedCount[item]++;
    p.lastSeen = now();

    // 生成效果，写入 effects 队列
    const duration = item === 'freeze' ? FREEZE_DURATION : DISTURB_DURATION;
    room.effects.push({
        id: 'e' + now() + Math.floor(Math.random() * 1000),
        item: item,
        duration: duration,
        fromOpenid: openid,
        at: now()
    });

    await rooms.doc(roomId).update({ data: { players: room.players, effects: room.effects } });
    return { ok: true, items: p.items };
}

/** 退出房间 */
async function leave(openid, event) {
    const roomId = event.roomId;
    const res = await rooms.doc(roomId).get().catch(() => null);
    if (!res || !res.data) return { ok: true };
    const room = res.data;
    const p = room.players.find(p => p.openid === openid);
    if (p) p.online = false;
    await rooms.doc(roomId).update({ data: { players: room.players } });
    return { ok: true };
}

/** 查询房间状态（前端轮询用，核心） */
async function query(openid, event) {
    const roomId = event.roomId;
    const res = await rooms.doc(roomId).get().catch(() => null);
    if (!res || !res.data) return { ok: false, err: '房间不存在' };

    const room = res.data;
    const me = room.players.find(p => p.openid === openid);

    // 更新我的在线时间戳（心跳）
    if (me) {
        me.lastSeen = now();
        me.online = true;
    }

    // 结算判断
    let finished = room.status === 'finished';
    let myResult = room.result[openid] || null;

    if (room.status === 'playing') {
        // 时间到 → 结算
        if (room.startTime && now() >= room.startTime + BATTLE_DURATION) {
            finished = true;
            room.status = 'finished';
            myResult = settle(room, openid);
        } else {
            // 断线判负：对手 10 秒未上报
            const opp = room.players.find(p => p.openid !== openid);
            if (opp && !opp.online && now() - opp.lastSeen > OFFLINE_GRACE) {
                finished = true;
                room.status = 'finished';
                myResult = settle(room, openid, opp.openid);
            }
        }
    }

    if (finished) {
        // 持久化结算结果
        if (!room.result[openid]) room.result[openid] = myResult;
        await rooms.doc(roomId).update({
            data: { status: room.status, result: room.result, players: room.players }
        }).catch(() => {});
    } else {
        // 心跳持久化
        await rooms.doc(roomId).update({ data: { players: room.players } }).catch(() => {});
    }

    // 组装返回：对手信息 + 我的状态 + 新 effects
    const opp = room.players.find(p => p.openid !== openid);
    return {
        ok: true,
        status: room.status,
        startTime: room.startTime,
        myReady: me ? me.ready : false,
        myScore: me ? me.score : 0,
        myItems: me ? me.items : { freeze: 0, disturb: 0 },
        opp: opp ? { nickname: opp.nickname, score: opp.score, ready: opp.ready, online: opp.online } : null,
        effects: room.effects,   // 前端自己 diff 新效果
        result: myResult
    };
}

/** 结算（返回本人视角的结果） */
function settle(room, openid, leaverOpenId) {
    const a = room.players[0];
    const b = room.players[1];
    if (!a || !b) return { result: 'draw', myScore: 0, oppScore: 0 };
    const me = a.openid === openid ? a : b;
    const opp = a.openid === openid ? b : a;

    let result;
    if (leaverOpenId) {
        result = openid === leaverOpenId ? 'lose' : 'win';
    } else if (me.score > opp.score) {
        result = 'win';
    } else if (me.score < opp.score) {
        result = 'lose';
    } else {
        result = 'draw';
    }
    return { result: result, myScore: me.score, oppScore: opp.score };
}

exports.main = async (event) => {
    const { OPENID } = cloud.getWXContext();
    try {
        switch (event.action) {
            case 'create': return await create(OPENID, event);
            case 'join': return await join(OPENID, event);
            case 'ready': return await ready(OPENID, event);
            case 'syncScore': return await syncScore(OPENID, event);
            case 'useItem': return await useItem(OPENID, event);
            case 'leave': return await leave(OPENID, event);
            case 'query': return await query(OPENID, event);
            default: return { ok: false, err: '未知操作' };
        }
    } catch (e) {
        return { ok: false, err: e.message };
    }
};
