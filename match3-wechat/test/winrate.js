/**
 * 关卡难度标定：独立掉落/决策随机数 + 浏览器回放验证的计时，每关至少200局。
 * 用法: node test/winrate.js [局数] [每步思考毫秒，另计动画] [起始关] [结束关] [--greedy|--random] [--measure]
 */

const levelData = require('../js/core/level');
const simulation = require('./helpers/solo-simulation');
const greedy = process.argv.includes('--greedy');
const randomOnly = process.argv.includes('--random');
const measureOnly = process.argv.includes('--measure');
async function playOne(level, seed, thinkMs) {
    return simulation.play({level,seed,thinkMs,
        strategy:greedy || !randomOnly && level.id >= 6 ? 'goal' : 'random'});
}

/** 目标描述（显示用） */
function goalDesc(level) {
    const parts = [];
    for (let i = 0; i < (level.goals || []).length; i++) {
        const g = level.goals[i];
        if (g.type === 'score') parts.push('分' + g.target);
        else if (g.type === 'jelly') parts.push('果冻' + g.target);
        else if (g.type === 'collect') parts.push('收集' + g.pieceType + '×' + g.target);
        else if (g.type === 'yarn') parts.push('毛线源头' + g.target + '击');
        else parts.push('未知目标');
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
const startLevel = Math.max(1, parseInt(process.argv[4], 10) || 1);
const endLevel = Math.max(startLevel, parseInt(process.argv[5], 10) || 40);
const seedBase = 0x5EED1234;
// 固定工程容差保持不变；--measure只输出探索结果，不宣称标定通过。
const harderTolerance = 12;
const easierTolerance = 24;
const deviations = [];
const levelIds = [];
for (let id = startLevel; id <= endLevel; id++) levelIds.push(id);

(async function () {
    console.log('========== 关卡难度标定（' + (greedy ? '单步策略' : randomOnly ? '随机合法交换' : '教学随机/6关起单步策略') + ' ' + rounds + ' 局/关，每步思考 ' + moveDurationMs + 'ms另计动画，关卡 ' + startLevel + '–' + endLevel + '）==========');
    const ranges = [];
    for (let from = startLevel; from <= endLevel; from += 10) {
        const to = Math.min(from + 9, endLevel);
        ranges.push({label:from+'–'+to,from,to,wins:0,games:0});
    }
    if (endLevel-startLevel >= 10) ranges.push({label:startLevel+'–'+endLevel,from:startLevel,to:endLevel,wins:0,games:0});

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
            if (r.reason === 'timeout') timeout++;
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
        ranges.forEach(function (range) {
            if (levelId >= range.from && levelId <= range.to) {
                range.wins += wins;
                range.games += rounds;
            }
        });
    }

    ranges.forEach(function (range) {
        if (range.games) console.log('汇总 ' + range.label + ' 胜率' + (range.wins / range.games * 100).toFixed(2) + '%（' + range.wins + '/' + range.games + '）');
    });

    console.log('种子基准: 0x' + seedBase.toString(16) + '；模拟器v2独立随机流/思考及动画计时，旧目标曲线尚未经此口径重标定');
    if (measureOnly && deviations.length) console.log('仅测量，未通过目标容差：' + deviations.join('；'));
    if (!measureOnly && deviations.length) throw new Error('难度偏差超过变难-' + harderTolerance + '%/变易+' +
        easierTolerance + '%：' + deviations.join('；'));
    console.log('========================================');
})().catch(function (err) {
    console.error(err.stack || err);
    process.exitCode = 1;
});
