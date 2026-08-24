/**
 * 关卡难度标定：固定种子 + 随机合法交换，每关至少跑 200 局。
 * 用法: node test/winrate.js [局数] [每步虚拟耗时毫秒]
 */

const GameCore = require('../js/core/game-core');
const levelData = require('../js/core/level');

function createRandom(seed) {
    let state = seed >>> 0;
    return function () {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

async function withSeed(seed, fn) {
    const originalRandom = Math.random;
    Math.random = createRandom(seed);
    try {
        return await fn();
    } finally {
        Math.random = originalRandom;
    }
}

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
                if (!core.isBlocked(from) && !core.isBlocked(to) && core.validateMove(from, to)) {
                    moves.push([from, to]);
                }
            }
            if (r + 1 < rows) {
                const from = { row: r, column: c }, to = { row: r + 1, column: c };
                if (!core.isBlocked(from) && !core.isBlocked(to) && core.validateMove(from, to)) {
                    moves.push([from, to]);
                }
            }
        }
    }
    return moves;
}

async function playOne(level, seed, moveDurationMs) {
    return withSeed(seed, async function () {
        const core = new GameCore(level, {});
        let guard = 0;
        while (core.isPlaying() && guard < 300) {
            guard++;
            const moves = findValidMoves(core);
            if (!moves.length) break;
            shuffle(moves);
            await core.trySwap(moves[0][0], moves[0][1]);
            core.updateTime(moveDurationMs);
        }
        return { win: core.won, score: core.score, ended: core.ended, timeLeftMs: core.timeLeftMs };
    });
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

const rounds = Math.max(200, parseInt(process.argv[2], 10) || 200);
const moveDurationMs = Math.max(1, parseInt(process.argv[3], 10) || 6000);
const seedBase = 0x5EED1234;
// 新彩球与完整特殊组合会有意抬高随机玩家上限；仍严格阻止关卡变难，
// 对“变容易”保留较宽回归带，避免测试反向削弱本次冻结玩法规则。
const harderTolerance = 12;
const easierTolerance = 24;
const deviations = [];
const levelIds = [];
for (let id = 1; id <= 40; id++) levelIds.push(id);
for (let id = 100000; id < 100010; id++) levelIds.push(id);

(async function () {
    console.log('========== 关卡难度标定（固定种子随机合法交换 ' + rounds + ' 局/关，虚拟每步 ' + moveDurationMs + 'ms）==========');

    for (let index = 0; index < levelIds.length; index++) {
        const levelId = levelIds[index];
        const level = levelData.getLevel(levelId);
        const target = levelData.getTargetWinRate(levelId);
        let wins = 0;
        let timeout = 0;
        let totalScore = 0;
        let maxScore = 0;
        for (let i = 0; i < rounds; i++) {
            const r = await playOne(level, (seedBase + levelId * 1000003 + i) >>> 0, moveDurationMs);
            if (r.win) wins++;
            if (r.ended && !r.win && level.timeLimitSec > 0 && r.timeLeftMs === 0) timeout++;
            totalScore += r.score;
            if (r.score > maxScore) maxScore = r.score;
        }
        const winRateValue = wins / rounds * 100;
        const winRate = winRateValue.toFixed(1);
        const avgScore = Math.round(totalScore / rounds);
        if (target - winRateValue > harderTolerance || winRateValue - target > easierTolerance) {
            deviations.push('关卡' + levelId + ' 实测' + winRate + '% / 目标' + target + '%');
        }
        console.log('关卡' + levelId + '[' + level.name + '] 目标' + goalDesc(level) +
            ' 胜率' + winRate + '% 均分' + avgScore + ' 最高' + maxScore +
            ' 失败' + (rounds - wins) + '（其中超时' + timeout + '）' +
            ' 目标' + target + '%');
    }

    console.log('种子基准: 0x' + seedBase.toString(16) + '；合法步已排除冰块覆盖格');
    if (deviations.length) throw new Error('难度偏差超过变难-' + harderTolerance + '%/变易+' +
        easierTolerance + '%：' + deviations.join('；'));
    console.log('========================================');
})().catch(function (err) {
    console.error(err.stack || err);
    process.exitCode = 1;
});
