/**
 * 核心逻辑模拟测试（Node 环境运行）
 * 用法: node test/simulate.js
 * 模拟：创建关卡 → 随机找有效交换 → 执行 → 验证消除/计分/胜负
 */

const GameCore = require('../js/core/game-core');
const levelData = require('../js/core/level');
const gridUtil = require('../js/core/grid');

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
}

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

// 固定种子使问题复现，同时让有时间限制的关卡经过虚拟时钟。
Math.random = createRandom(0x51E3);

(async function () {
    console.log('========== 三消核心逻辑模拟测试 ==========');
    const sampleLevels = [1, 2, 10, 11, 31, 1000];

    for (let sample = 0; sample < sampleLevels.length; sample++) {
        const levelId = sampleLevels[sample];
        const level = levelData.getLevel(levelId);
        const events = [];

        const core = new GameCore(level, {
            onMatch: function (m) { events.push('连消x' + m.combo + ' 消除' + m.removed.length + '个 得分' + m.score); },
            onLevelEnd: function (r) {
                events.push('=== 结束: ' + (r.win ? '胜利' : '失败') + ' 得分' + r.score + ' 剩余步数' + r.movesLeft + ' ===');
            }
        });

        const initialMatches = gridUtil.getMatches(core.grid);
        console.log('关卡' + levelId + '[' + level.name + '] 初始消除数(应为0):', initialMatches.length);
        if (initialMatches.length > 0) console.log('  !! 警告: 初始棋盘存在预置消除');

        let guard = 0;
        while (core.isPlaying() && guard < 200) {
            guard++;
            const moves = findValidMoves(core);
            if (!moves.length) {
                events.push('!! 无有效移动(待后续版本加洗牌)');
                break;
            }
            shuffle(moves);
            await core.trySwap(moves[0][0], moves[0][1]);
            core.updateTime(5000);
        }

        console.log('  最终得分:', core.score, '剩余步数:', core.movesLeft);

        const keyEvents = events.filter(function (e) {
            return e.indexOf('=== 结束') !== -1 || e.indexOf('连消x2') !== -1 || e.indexOf('连消x3') !== -1;
        });
        keyEvents.slice(-5).forEach(function (e) { console.log('  ' + e); });

        const leftover = gridUtil.getMatches(core.grid);
        if (leftover.length > 0) console.log('  !! 警告: 结束后棋盘仍有消除未处理');
    }

    console.log('========== 测试完成 ==========');
})();
