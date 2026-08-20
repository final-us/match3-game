/**
 * 消消乐双人对战服务器
 * 技术栈：Node.js + WebSocket（ws 库），部署于微信云托管（CloudBase Run）
 *
 * 职责：
 *   1. 房间管理（创建/加入/退出/销毁）
 *   2. 消息转发（分数/道具在双方之间转发）
 *   3. 状态仲裁（服务端维护 score/ready/道具，防作弊）
 *   4. 对战计时（60s）+ 断线判负（10s）
 *
 * 消息协议见 PRD 5.4 节
 */

const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 80;

// ===== 对战参数（数据驱动，可调；支持环境变量覆盖，便于测试/调平衡）=====
const BATTLE_DURATION = parseInt(process.env.BATTLE_DURATION || '60000', 10);   // 对战时长 60 秒
const READY_COUNTDOWN = parseInt(process.env.READY_COUNTDOWN || '3000', 10);   // 双方准备后 3 秒开局
const FREEZE_DURATION = parseInt(process.env.FREEZE_DURATION || '3000', 10);   // 冰冻 3 秒
const DISTURB_DURATION = parseInt(process.env.DISTURB_DURATION || '5000', 10); // 干扰 5 秒
const OFFLINE_GRACE = parseInt(process.env.OFFLINE_GRACE || '10000', 10);      // 断线判负宽限 10 秒
const ITEM_LIMIT = 5;                           // 每局每种道具使用上限
const INITIAL_ITEMS = { freeze: 1, disturb: 1 }; // 开局各送 1 个

const rooms = new Map(); // roomId -> room

// ===== HTTP 健康检查（云托管探活用）=====
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
    } else {
        res.writeHead(404);
        res.end();
    }
});

const wss = new WebSocket.Server({ server });

// ===== 工具函数 =====

function genRoomId() {
    let id;
    do {
        id = String(Math.floor(100000 + Math.random() * 900000));
    } while (rooms.has(id));
    return id;
}

function send(ws, obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(obj));
    }
}

/** 根据 ws 找到所属房间和玩家 */
function roomByWs(ws) {
    for (const room of rooms.values()) {
        for (const p of Object.values(room.players)) {
            if (p.ws === ws) return { room, player: p };
        }
    }
    return null;
}

/** 找对手 */
function opponent(room, openId) {
    for (const [id, p] of Object.entries(room.players)) {
        if (id !== openId) return { openId: id, player: p };
    }
    return null;
}

/** 房间成员视图（不含 ws 引用，用于下发） */
function playersView(room) {
    const view = {};
    for (const [id, p] of Object.entries(room.players)) {
        view[id] = {
            nickname: p.nickname,
            avatarUrl: p.avatarUrl,
            ready: p.ready,
            score: p.score,
            online: p.online
        };
    }
    return view;
}

function broadcast(room, obj) {
    for (const p of Object.values(room.players)) {
        send(p.ws, obj);
    }
}

function makePlayer(ws, msg) {
    return {
        openId: msg.openId,
        nickname: msg.nickname || '玩家',
        avatarUrl: msg.avatarUrl || '',
        ws: ws,
        ready: false,
        score: 0,
        online: true,
        lastHeartbeat: Date.now(),
        items: { freeze: INITIAL_ITEMS.freeze, disturb: INITIAL_ITEMS.disturb },
        usedCount: { freeze: 0, disturb: 0 }
    };
}

// ===== 战斗流程 =====

function startBattle(room) {
    room.status = 'playing';
    room.startTime = Date.now();
    broadcast(room, { type: 'battle_start', startTime: room.startTime });

    // 60 秒后结算
    room.timer = setTimeout(() => finishBattle(room, null), BATTLE_DURATION);
}

function finishBattle(room, leaverOpenId) {
    if (room.status === 'finished') return;
    clearTimeout(room.timer);
    room.status = 'finished';

    const ids = Object.keys(room.players);
    if (ids.length !== 2) return; // 只有一人，无结算

    const a = room.players[ids[0]];
    const b = room.players[ids[1]];

    let resultA, resultB;
    if (leaverOpenId) {
        resultA = ids[0] === leaverOpenId ? 'lose' : 'win';
        resultB = ids[1] === leaverOpenId ? 'lose' : 'win';
    } else if (a.score > b.score) {
        resultA = 'win'; resultB = 'lose';
    } else if (a.score < b.score) {
        resultA = 'lose'; resultB = 'win';
    } else {
        resultA = 'draw'; resultB = 'draw';
    }

    send(a.ws, { type: 'battle_end', myScore: a.score, oppScore: b.score, result: resultA });
    send(b.ws, { type: 'battle_end', myScore: b.score, oppScore: a.score, result: resultB });

    // 结算后延迟销毁房间
    setTimeout(() => rooms.delete(room.roomId), 5000);
}

/** 处理玩家离线/退出 */
function handleOffline(room, openId) {
    const p = room.players[openId];
    if (!p) return;

    if (room.status === 'playing') {
        // 对战中：标记离线，10 秒内未重连判负
        p.online = false;
        const opp = opponent(room, openId);
        if (opp) send(opp.player.ws, { type: 'opponent_left' });
        room.offlineTimers[openId] = setTimeout(() => {
            const cur = room.players[openId];
            if (cur && !cur.online && room.status === 'playing') {
                finishBattle(room, openId);
            }
        }, OFFLINE_GRACE);
    } else {
        // 等待中：直接移除
        delete room.players[openId];
        broadcast(room, { type: 'room_update', status: room.status, players: playersView(room) });
        if (Object.keys(room.players).length === 0) {
            rooms.delete(room.roomId);
        }
    }
}

// ===== 消息分发 =====

function handleMessage(ws, raw) {
    let msg;
    try {
        msg = JSON.parse(raw);
    } catch (e) {
        return;
    }
    if (!msg || !msg.type) return;

    switch (msg.type) {
        case 'create_room': {
            const roomId = genRoomId();
            const room = {
                roomId: roomId,
                hostOpenId: msg.openId,
                status: 'waiting',
                startTime: 0,
                players: {},
                timer: null,
                readyTimer: null,
                offlineTimers: {}
            };
            room.players[msg.openId] = makePlayer(ws, msg);
            rooms.set(roomId, room);
            send(ws, { type: 'created', roomId: roomId });
            broadcast(room, { type: 'room_update', status: room.status, players: playersView(room) });
            break;
        }

        case 'join_room': {
            const room = rooms.get(msg.roomId);
            if (!room) { send(ws, { type: 'error', message: '房间不存在或已失效' }); break; }
            if (room.status !== 'waiting') { send(ws, { type: 'error', message: '对局已开始' }); break; }

            // 重连：同一 openId 更新 ws，恢复在线
            if (room.players[msg.openId]) {
                const p = room.players[msg.openId];
                p.ws = ws;
                p.online = true;
                if (room.offlineTimers[msg.openId]) {
                    clearTimeout(room.offlineTimers[msg.openId]);
                    delete room.offlineTimers[msg.openId];
                }
            } else {
                if (Object.keys(room.players).length >= 2) {
                    send(ws, { type: 'error', message: '房间已满' });
                    break;
                }
                room.players[msg.openId] = makePlayer(ws, msg);
            }

            send(ws, { type: 'joined', roomId: room.roomId });
            broadcast(room, { type: 'room_update', status: room.status, players: playersView(room) });
            break;
        }

        case 'ready': {
            const found = roomByWs(ws);
            if (!found) break;
            const { room, player } = found;
            if (room.status !== 'waiting') break;
            player.ready = true;
            broadcast(room, { type: 'room_update', status: room.status, players: playersView(room) });

            // 双方 ready → 3 秒后开局
            const ids = Object.keys(room.players);
            const allReady = ids.length === 2 && ids.every(id => room.players[id].ready);
            if (allReady && !room.readyTimer) {
                room.readyTimer = setTimeout(() => {
                    if (room.status === 'waiting') startBattle(room);
                }, READY_COUNTDOWN);
            }
            break;
        }

        case 'sync_score': {
            const found = roomByWs(ws);
            if (!found || found.room.status !== 'playing') break;
            found.player.score = msg.score;
            const opp = opponent(found.room, found.player.openId);
            if (opp) send(opp.player.ws, { type: 'opponent_score', score: msg.score });
            break;
        }

        case 'use_item': {
            const found = roomByWs(ws);
            if (!found || found.room.status !== 'playing') break;
            const { room, player } = found;
            const item = msg.item;
            if (item !== 'freeze' && item !== 'disturb') break;

            if (player.items[item] <= 0) { send(ws, { type: 'error', message: '道具不足' }); break; }
            if (player.usedCount[item] >= ITEM_LIMIT) { send(ws, { type: 'error', message: '已达本局上限' }); break; }

            player.items[item]--;
            player.usedCount[item]++;

            const opp = opponent(room, player.openId);
            if (opp) {
                const duration = item === 'freeze' ? FREEZE_DURATION : DISTURB_DURATION;
                send(opp.player.ws, { type: 'effect', item: item, duration: duration });
            }
            send(ws, { type: 'my_items', items: player.items });
            break;
        }

        case 'leave': {
            const found = roomByWs(ws);
            if (!found) break;
            handleOffline(found.room, found.player.openId);
            break;
        }

        case 'heartbeat': {
            const found = roomByWs(ws);
            if (!found) break;
            found.player.lastHeartbeat = Date.now();
            break;
        }
    }
}

// ===== 连接生命周期 =====

wss.on('connection', (ws) => {
    ws.on('message', (data) => {
        handleMessage(ws, data.toString());
    });
    ws.on('close', () => {
        const found = roomByWs(ws);
        if (found) handleOffline(found.room, found.player.openId);
    });
});

server.listen(PORT, () => {
    console.log('Battle server listening on port ' + PORT);
});
