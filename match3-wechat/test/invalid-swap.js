'use strict';

const assert = require('assert');
const GameCore = require('../js/core/game-core');
const BoardRenderer = require('../js/render/board-render');

function fixture(reduceEffects) {
    const core = new GameCore({ rows: 6, columns: 6, moveCount: 20, timeLimitSec: 60,
        goals: [{ type: 'score', target: 99999 }] }, {});
    core.grid = Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => (r * 2 + c) % 5 + 1));
    const board = new BoardRenderer({}, { width: 390, height: 844, reduceEffects: !!reduceEffects });
    board.setGame(core);
    return { core, board };
}

async function run() {
    const from = { row: 1, column: 1 }, to = { row: 1, column: 2 };
    const first = fixture();
    first.board.wait = () => Promise.resolve();
    // Real renderer, not a stub: the former undefined `self` must fail this regression.
    await first.board.animateInvalidSwap(from, to);

    for (const reduced of [false, true]) {
        for (const mode of ['no-match', 'ice-from', 'ice-to', 'jelly-from', 'jelly-to']) {
            const { core, board } = fixture(reduced);
            const blocked = mode.endsWith('from') ? from : to;
            if (mode.startsWith('ice')) core.iceGrid[blocked.row][blocked.column] = 1;
            if (mode.startsWith('jelly')) core.jellyGrid[blocked.row][blocked.column] = 2;
            const before = JSON.stringify([core.grid, core.iceGrid, core.jellyGrid, core.movesLeft, core.score]);
            let finish, duration, feedbacks = 0;
            board.wait = ms => { duration = ms; return new Promise(resolve => { finish = resolve; }); };
            core.callbacks.onInvalidSwap = (a, b) => { feedbacks++; return board.animateInvalidSwap(a, b); };
            const pending = core.trySwap(from, to);
            assert.strictEqual(feedbacks, 1);
            assert.strictEqual(core.isPlaying(), false, '反馈期间禁止叠加输入');
            assert.strictEqual(await core.trySwap(from, to), false);
            assert.strictEqual(feedbacks, 1, '重复划动不能追加声音或动画');
            assert(duration <= 260);
            board.update(duration * 0.2);
            const peak = board.invalidSwapOffset(from.row, from.column);
            assert(peak.x > 0 && peak.x <= (reduced ? 3 : 7));
            assert.strictEqual(peak.y, 0);
            assert(board.invalidSwapOffset(to.row, to.column).x < 0);
            assert.strictEqual(board.invalidSwapOffset(4, 4), null, '无关棋子不抖动');
            board.update(duration * 0.26);
            assert(board.invalidSwapOffset(from.row, from.column).x < 0, '碰壁后反向回弹');
            core.timerStarted = true;
            core.updateTime(120);
            assert.strictEqual(core.timeLeftMs, 59880, '失败反馈不能暂停倒计时');
            finish();
            assert.strictEqual(await pending, false);
            assert.strictEqual(core.isPlaying(), true);
            assert.strictEqual(board.invalidSwapOffset(from.row, from.column), null);
            assert.strictEqual(JSON.stringify([core.grid, core.iceGrid, core.jellyGrid, core.movesLeft, core.score]), before,
                mode + '不得交换棋子、损坏障碍、扣步数或加分');
        }
    }

    const { core, board } = fixture();
    let finish;
    board.wait = () => new Promise(resolve => { finish = resolve; });
    const vertical = board.animateInvalidSwap(from, { row: 2, column: 1 });
    board.update(48);
    assert(board.invalidSwapOffset(1, 1).y > 0, '竖向换位按竖向撞回');
    board.setGame(fixture().core);
    assert.strictEqual(board.invalidSwapOffset(1, 1), null, '重绑棋盘清理旧反馈');
    finish();
    await vertical;
    core.callbacks.onInvalidSwap = async () => { throw new Error('animation failed'); };
    await assert.rejects(core.trySwap(from, to), /animation failed/);
    assert.strictEqual(core.isPlaying(), true, '动画失败也必须释放输入锁');
    console.log('invalid swap motion, obstacles, input lock and timer tests passed');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
