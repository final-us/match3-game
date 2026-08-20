/**
 * 后端服务本地联调测试
 * 用法：npm install 后运行  node test-local.js
 * 流程：A 建房 → B 加入 → 双方准备 → 开局 → A 报分/用道具 → 结算
 */

const { spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = 8090;
const URL = 'ws://localhost:' + PORT;

// 用短时长快速跑完流程
const server = spawn('node', ['index.js'], {
    env: {
        ...process.env,
        PORT: String(PORT),
        BATTLE_DURATION: '3000',
        READY_COUNTDOWN: '1000'
    }
});

const results = [];
function log(name, pass) {
    console.log((pass ? '✅' : '❌') + ' ' + name);
    results.push(pass);
}

function connect(openId) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(URL);
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
    });
}

function send(ws, obj) {
    ws.send(JSON.stringify(obj));
}

// 等待某类型消息
function waitFor(ws, type, timeout) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout waiting ' + type)), timeout || 5000);
        const handler = (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === type) {
                clearTimeout(t);
                ws.removeListener('message', handler);
                resolve(msg);
            }
        };
        ws.on('message', handler);
    });
}

async function main() {
    await new Promise(r => setTimeout(r, 1200)); // 等服务器启动

    // A 建房
    const a = await connect('userA');
    send(a, { type: 'create_room', openId: 'userA', nickname: 'A', avatarUrl: '' });
    const created = await waitFor(a, 'created');
    const roomId = created.roomId;
    log('A 创建房间，房间号 ' + roomId, !!roomId);

    // B 加入
    const b = await connect('userB');
    send(b, { type: 'join_room', roomId, openId: 'userB', nickname: 'B', avatarUrl: '' });
    const joined = await waitFor(b, 'joined');
    log('B 加入房间', joined.roomId === roomId);

    // 双方收到 room_update（B 加入广播）
    const updA = await waitFor(a, 'room_update');
    log('A 收到房间更新（2人）', Object.keys(updA.players).length === 2);

    // 双方准备
    send(a, { type: 'ready', roomId });
    send(b, { type: 'ready', roomId });

    // 等待 battle_start
    const startA = await waitFor(a, 'battle_start');
    const startB = await waitFor(b, 'battle_start');
    log('双方开局（收到 battle_start）', !!startA.startTime && !!startB.startTime);

    // A 报分 → B 收到对手分数
    send(a, { type: 'sync_score', roomId, score: 1000 });
    const oppScore = await waitFor(b, 'opponent_score');
    log('B 收到 A 的分数 1000', oppScore.score === 1000);

    // A 用冰冻 → B 收到 effect
    send(a, { type: 'use_item', roomId, item: 'freeze' });
    const effect = await waitFor(b, 'effect');
    log('B 收到冰冻特效（3秒）', effect.item === 'freeze' && effect.duration === 3000);

    // A 的道具状态同步
    const myItems = await waitFor(a, 'my_items');
    log('A 冰冻道具扣减为 0', myItems.items.freeze === 0);

    // A 再用冰冻 → 应该道具不足
    send(a, { type: 'use_item', roomId, item: 'freeze' });
    const err = await waitFor(a, 'error');
    log('A 冰冻耗尽，报「道具不足」', !!err.message);

    // 等待结算（3 秒对战结束）
    const endA = await waitFor(a, 'battle_end', 6000);
    const endB = await waitFor(b, 'battle_end', 6000);
    log('A 结算：' + endA.result + '（A分' + endA.myScore + ' B分' + endA.oppScore + '）', !!endA.result);
    log('B 结算：' + endB.result, !!endB.result);

    const allPass = results.every(Boolean);
    console.log('========================================');
    console.log('后端对战流程: ' + (allPass ? '全部通过 ✅' : '存在失败 ❌'));

    a.close();
    b.close();
    server.kill();
    process.exit(allPass ? 0 : 1);
}

main().catch(e => {
    console.log('❌ 测试异常: ' + e.message);
    server.kill();
    process.exit(1);
});
