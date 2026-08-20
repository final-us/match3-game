/**
 * 关卡难度标定：每关跑 N 局"随机走棋"模拟，统计胜率
 * 基准参考（随机走棋的胜率，真人玩家会玩得更好）：
 *   关卡1 简单：60-80% | 关卡2 中等：30-50% | 关卡3 挑战：20-40%
 * 用法: node test/winrate.js [局数]
 */

const GameCore = require('../js/core/game-core');
const levelData = require('../js/core/level');

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
}

function findValidMoves(core) {
    const grid = core.grid;
    const rows = grid.length;
    const cols = grid[0].length;
    const moves = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (c + 1 < cols) {
                const from = { row: r, column: c }, to = { row: r, column: c + 1 };
                if (core.validateMove(from, to)) moves.push([from, to]);
            }
            if (r + 1 < rows) {
                const from = { row: r, column: c }, to = { row: r + 1, column: c };
                if (core.validateMove(from, to)) moves.push([from, to]);
            }
        }
    }
    return moves;
}

async function playOne(level) {
    const core = new GameCore(level, {});
    let guard = 0;
    while (core.isPlaying() && guard < 300) {
        guard++;
        const moves = findValidMoves(core);
        if (!moves.length) break;
        shuffle(moves);
        await core.trySwap(moves[0][0], moves[0][1]);
    }
    // 用核心的胜负判定（支持 score/jelly 多目标）
    return { win: core.won, score: core.score };
}

/** 目标描述（显示用） */
function goalDesc(level) {
    const parts = [];
    for (let i = 0; i < (level.goals || []).length; i++) {
        const g = level.goals[i];
        parts.push(g.type === 'score' ? '分' + g.target : '果冻' + g.target);
    }
    if ((level.underlays || {}) && parts.length === 0) {
        let total = 0;
        for (const k in level.underlays) total += level.underlays[k];
        parts.push('果冻' + total);
    }
    return parts.join('+') || '纯分';
}

const rounds = parseInt(process.argv[2], 10) || 30;

(async function () {
    console.log('========== 关卡难度标定（随机走棋 ' + rounds + ' 局/关）==========');

    for (let levelId = 1; levelId <= levelData.getLevelCount(); levelId++) {
        const level = levelData.getLevel(levelId);
        let wins = 0;
        let totalScore = 0;
        let maxScore = 0;
        for (let i = 0; i < rounds; i++) {
            const r = await playOne(level);
            if (r.win) wins++;
            totalScore += r.score;
            if (r.score > maxScore) maxScore = r.score;
        }
        const winRate = (wins / rounds * 100).toFixed(1);
        const avgScore = Math.round(totalScore / rounds);
        console.log('关卡' + levelId + '[' + level.name + '] 目标' + goalDesc(level) +
            ' 胜率' + winRate + '% 均分' + avgScore + ' 最高' + maxScore +
            (winRate < 15 ? '  ← 偏难' : winRate > 85 ? '  ← 偏易' : '  ← 合理区间'));
    }

    console.log('========================================');
})();
