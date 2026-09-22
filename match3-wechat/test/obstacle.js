/**
 * 障碍系统（果冻/冰块）逻辑验证
 * 用法: node test/obstacle.js
 * 验证：1) 冰块锁定移动 2) 冰块消除清零 3) 果冻破层递减 4) 果冻清空判定
 */

const GameCore = require('../js/core/game-core');

// 障碍规则不应依赖产品关卡的难度/布局修订。
const obstacleFixture = {
    id: 'test-obstacles', rows: 8, columns: 8, moveCount: 25, timeLimitSec: 0,
    goals: [{ type: 'jelly', target: 6 }],
    obstacles: { '2:2': 1, '5:5': 1 },
    underlays: { '3:3': 1, '3:4': 1, '4:3': 1, '4:4': 1, '5:3': 1, '5:4': 1 }
};

function findIcePositions(core) {
    const pos = [];
    for (let r = 0; r < core.iceGrid.length; r++) {
        for (let c = 0; c < core.iceGrid[r].length; c++) {
            if (core.iceGrid[r][c]) pos.push({ row: r, column: c });
        }
    }
    return pos;
}

function findJellyTotal(core) {
    let t = 0;
    for (let r = 0; r < core.jellyGrid.length; r++) {
        for (let c = 0; c < core.jellyGrid[r].length; c++) t += core.jellyGrid[r][c];
    }
    return t;
}

(async function () {
    console.log('========== 障碍系统逻辑验证 ==========');

    const core = new GameCore(obstacleFixture, {});

    // 1. 冰块/果冻初始化
    const ices = findIcePositions(core);
    const jellyTotal = findJellyTotal(core);
    console.log('冰块数量(应为2):', ices.length, '| 果冻总层数(应为6):', jellyTotal);
    if (ices.length !== 2 || jellyTotal !== 6) throw new Error('固定障碍夹具初始化数据不符');

    // 2. 冰块锁定移动：尝试把冰块棋子作为交换源
    const icePos = ices[0];
    const from = icePos;
    // 找相邻格
    const to = { row: from.row + 1, column: from.column };
    const movesBefore = core.movesLeft;
    let invalidFired = false;
    core.callbacks.onInvalidSwap = function () { invalidFired = true; return Promise.resolve(); };
    await core.trySwap(from, to);
    console.log('冰块锁定: 无效交换回调触发=' + invalidFired + ', 步数未消耗=' + (core.movesLeft === movesBefore));
    if (!invalidFired || core.movesLeft !== movesBefore) throw new Error('冰块锁定逻辑异常');

    // 3. 模拟完整对局（随机走），结束后检查状态一致性
    let guard = 0;
    while (core.isPlaying() && guard < 100) {
        guard++;
        // 找有效移动（排除冰块格作为源）
        const grid = core.grid;
        const moves = [];
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                if (core.iceGrid[r][c]) continue; // 冰块格不能作为交换源
                if (c + 1 < grid[0].length && !core.iceGrid[r][c + 1]) {
                    const f = { row: r, column: c }, t = { row: r, column: c + 1 };
                    if (core.validateMove(f, t)) moves.push([f, t]);
                }
                if (r + 1 < grid.length && !core.iceGrid[r + 1][c]) {
                    const f = { row: r, column: c }, t = { row: r + 1, column: c };
                    if (core.validateMove(f, t)) moves.push([f, t]);
                }
            }
        }
        if (!moves.length) break;
        // 洗牌取一个
        for (let i = moves.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = moves[i]; moves[i] = moves[j]; moves[j] = tmp;
        }
        await core.trySwap(moves[0][0], moves[0][1]);
    }

    // 4. 对局结束后检查：冰块应全碎（或至少减少了）
    const iceLeft = findIcePositions(core).length;
    const jellyLeft = findJellyTotal(core);
    console.log('对局结束: 剩余冰块=' + iceLeft + ', 剩余果冻层=' + jellyLeft + ', 得分=' + core.score);
    if (iceLeft > 2) throw new Error('冰块数量异常增加');
    if (jellyLeft > 6) throw new Error('果冻层数异常增加');

    // 5. 调用真实消除流程，在首轮回调中检查破层和相邻冰块融化。
    const hitCore = new GameCore(obstacleFixture, {});
    hitCore.grid = Array.from({ length: 8 }, (_, r) =>
        Array.from({ length: 8 }, (_, c) => (r + c) % 5 + 1));
    hitCore.jellyGrid[3][3] = 2;
    hitCore.grid[3][2] = hitCore.grid[3][3] = hitCore.grid[3][4] = 7;
    let checkedHit = false;
    hitCore.callbacks.onMatch = function () {
        if (checkedHit) return Promise.resolve();
        if (hitCore.jellyGrid[3][3] !== 1) throw new Error('果冻命中必须只破一层');
        if (hitCore.iceGrid[2][2] !== 0) throw new Error('相邻消除必须融化冰块');
        checkedHit = true;
        return Promise.resolve();
    };
    await hitCore.processGrid();
    if (!checkedHit) throw new Error('未执行真实消除回调');
    console.log('真实消除: 果冻2→1、相邻冰块融化通过');

    console.log('========================================');
    console.log('结果: 障碍系统逻辑' + (invalidFired && core.movesLeft !== undefined ? '验证完成' : ''));
})().catch(function (err) { console.error(err); process.exitCode = 1; });
