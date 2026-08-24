/**
 * 单人倒计时状态测试
 * 用法: node test/timer.js
 */

const assert = require('assert');
const GameCore = require('../js/core/game-core');

function makeLevel(overrides) {
    return Object.assign({
        id: 1,
        name: '计时测试',
        rows: 8,
        columns: 8,
        moveCount: 20,
        timeLimitSec: 10,
        goals: [{ type: 'score', target: 999999 }]
    }, overrides || {});
}

function findValidMove(core) {
    for (let r = 0; r < core.grid.length; r++) {
        for (let c = 0; c < core.grid[r].length; c++) {
            const candidates = [
                [{ row: r, column: c }, { row: r, column: c + 1 }],
                [{ row: r, column: c }, { row: r + 1, column: c }]
            ];
            for (let i = 0; i < candidates.length; i++) {
                const from = candidates[i][0];
                const to = candidates[i][1];
                if (to.row >= core.grid.length || to.column >= core.grid[0].length) continue;
                if (!core.isBlocked(from) && !core.isBlocked(to) && core.validateMove(from, to)) {
                    return candidates[i];
                }
            }
        }
    }
    return null;
}

async function makeFirstMove(core) {
    const move = findValidMove(core);
    assert(move, '测试棋盘没有有效交换');
    await core.trySwap(move[0], move[1]);
    return move;
}

async function run() {
    const initial = new GameCore(makeLevel(), {});
    assert.strictEqual(initial.timeLimitMs, 10000, '计时上限未初始化');
    assert.strictEqual(initial.timeLeftMs, 10000, '初始剩余时间错误');
    initial.updateTime(3000);
    assert.strictEqual(initial.timeLeftMs, 10000, '首个有效交换前不应递减');

    await makeFirstMove(initial);
    assert.strictEqual(initial.timerStarted, true, '首个有效交换完成后未启动计时');
    initial.updateTime(1000);
    assert.strictEqual(initial.timeLeftMs, 9000, '倒计时未递减');

    const pausedTime = initial.timeLeftMs;
    initial.pauseTimer();
    initial.updateTime(2000);
    assert.strictEqual(initial.timeLeftMs, pausedTime, '暂停期间仍在递减');
    initial.resumeTimer();
    initial.updateTime(1000);
    assert.strictEqual(initial.timeLeftMs, pausedTime - 1000, '恢复后未继续递减');

    const toolStarted = new GameCore(makeLevel(), {});
    for (let r = 0; r < toolStarted.grid.length; r++) {
        for (let c = 0; c < toolStarted.grid[r].length; c++) toolStarted.grid[r][c] = (r + c) % 4 + 1;
    }
    assert.strictEqual(await toolStarted.useTool('hammer', { row: 3, column: 3 }), true, '首次有效道具未成功');
    assert.strictEqual(toolStarted.timerStarted, true, '首次有效道具后未启动倒计时');

    const rejectedTool = new GameCore(makeLevel(), {});
    rejectedTool.iceGrid[3][3] = 1;
    assert.strictEqual(await rejectedTool.useTool('hammer', { row: 3, column: 3 }), false, '阻挡格道具应拒绝');
    assert.strictEqual(rejectedTool.timerStarted, false, '失败道具错误启动倒计时');

    const assisted = new GameCore(makeLevel({ moveCount: 20, timeLimitSec: 10 }), {});
    assisted.applyAssistance(3, 20000);
    assert.strictEqual(assisted.movesLeft, 23, '连败助力未增加 3 步');
    assert.strictEqual(assisted.timeLeftMs, 30000, '连败助力未增加 20 秒');

    const events = [];
    const timeoutCore = new GameCore(makeLevel({ timeLimitSec: 1 }), {
        onLevelEnd: function (result) { events.push(result); }
    });
    const move = await makeFirstMove(timeoutCore);
    const movesAtTimeout = timeoutCore.movesLeft;
    timeoutCore.updateTime(1000);
    assert.strictEqual(timeoutCore.ended, true, '到 0 未结束');
    assert.strictEqual(timeoutCore.won, false, '超时错误判定为胜利');
    assert.strictEqual(events.length, 1, '超时回调不应重复');
    assert.strictEqual(events[0].reason, 'timeout', '超时 reason 错误');
    await timeoutCore.trySwap(move[0], move[1]);
    await timeoutCore.useTool('hammer', { row: 0, column: 0 });
    assert.strictEqual(timeoutCore.movesLeft, movesAtTimeout, '超时后仍可交换或消耗步数');
    timeoutCore.updateTime(1000);
    assert.strictEqual(events.length, 1, '超时后再次推进触发了重复回调');

    const priorityEvents = [];
    const priorityCore = new GameCore(makeLevel({ timeLimitSec: 1, goals: [{ type: 'score', target: 0 }] }), {
        onLevelEnd: function (result) { priorityEvents.push(result); }
    });
    priorityCore.timerStarted = true;
    priorityCore.timeLeftMs = 1;
    priorityCore.updateTime(1000);
    assert.strictEqual(priorityEvents.length, 1, '同帧目标完成未回调');
    assert.strictEqual(priorityEvents[0].win, true, '目标完成未优先于超时');
    assert.strictEqual(priorityEvents[0].reason, 'goal', '胜利 reason 错误');

    const cascadeEvents = [];
    const cascadeCore = new GameCore(makeLevel({ timeLimitSec: 1, goals: [{ type: 'score', target: 100 }] }), {
        onLevelEnd: function (result) { cascadeEvents.push(result); }
    });
    cascadeCore.timerStarted = true;
    cascadeCore.processing = true;
    cascadeCore.timeLeftMs = 1;
    cascadeCore.updateTime(1000);
    assert.strictEqual(cascadeCore.ended, false, '连消处理中不应抢先超时结算');
    cascadeCore.score = 100;
    cascadeCore.processing = false;
    cascadeCore.checkLevelEnd('timeout');
    assert.strictEqual(cascadeEvents[0].win, true, '连消完成目标未优先于超时');

    const revived = new GameCore(makeLevel({ timeLimitSec: 1 }), {});
    await makeFirstMove(revived);
    revived.updateTime(1000);
    const movesBeforeRevive = revived.movesLeft;
    assert.strictEqual(revived.revive(5, 30000), true, '失败局未能复活');
    assert.strictEqual(revived.ended, false, '复活后仍是结束状态');
    assert.strictEqual(revived.movesLeft, movesBeforeRevive + 5, '复活未恢复 5 步');
    assert.strictEqual(revived.timeLeftMs, 30000, '复活未增加 30 秒');
    revived.updateTime(1000);
    assert.strictEqual(revived.timeLeftMs, 29000, '复活后计时未恢复');

    console.log('计时测试全部通过 ✅');
}

run().catch(function (err) {
    console.error('计时测试失败 ❌', err.stack || err);
    process.exitCode = 1;
});
