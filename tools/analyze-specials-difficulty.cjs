'use strict';
// Offline measurement only: production rules, paired seeds, no player saves or network.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sim = require('../match3-wechat/test/helpers/solo-simulation');
const levels = require('../match3-wechat/js/core/level');
const recipeMove = require('../match3-wechat/test/helpers/recipe-move');
const option = (name, fallback) => process.argv.find(x => x.startsWith('--' + name + '='))?.split('=').slice(1).join('=') || fallback;
const ids = option('ids', '6,10,11,16,19,20,21,22,23,24,25,26,27,28,29,30,121,123,126,130,421,423,426,430').split(',').map(Number);
const rounds = Number(option('rounds', '200'));
const timings = option('timings', '3000,6000,untimed').split(',');
const variants = option('variants', 'off,goal,recipes').split(',');
const output = path.resolve(option('output', '/private/tmp/match3-specials-difficulty.json'));
const seedBases = [0x17a2c943, 0x8db731e5, 0xc406fa29];
const sourceHead = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }).trim();
assert(Number.isInteger(rounds) && rounds > 0);
assert(ids.every(id => levels.getLevel(id)));
assert(variants.every(v => ['off', 'goal', 'recipes'].includes(v)));
assert(timings.every(t => t === 'untimed' || Number(t) > 0));


function wilson(w, n) {
    const z = 1.959963984540054, p = w / n, d = 1 + z * z / n;
    const c = (p + z * z / (2 * n)) / d;
    const r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [c - r, c + r];
}

function describe(level) {
    const jelly = Object.keys(level.underlays || {}), ice = Object.keys(level.obstacles || {});
    const overlap = jelly.filter(k => ice.includes(k)).length;
    const root = level.yarn?.source;
    return { id: level.id, colors: level.colorCount, moves: level.moveCount, seconds: level.timeLimitSec,
        goals: level.goals, jellyCells: jelly.length, jellyLayers: Object.values(level.underlays || {}).reduce((s, n) => s + n, 0),
        iceCells: ice.length, yarn: level.yarn, lockedInitially: jelly.length + ice.length - overlap + (root && !jelly.includes(root) && !ice.includes(root) ? 1 : 0),
        lockedUpperBound: jelly.length + ice.length - overlap + (root ? 1 + level.yarn.maxVines : 0),
        layout: { jelly, ice, root: root || null }, contentRevision: level.contentRevision };
}

(async () => {
    const cells = [], comparisons = [], started = new Date().toISOString();
    function persist(complete) {
        fs.writeFileSync(output, JSON.stringify({ version: 'specials-difficulty-audit-v1', complete, started, finished: complete ? new Date().toISOString() : null,
            source: 'HEAD ' + sourceHead + ' plus current working tree; actual configs captured below', runtime: process.version, rounds, seedBases,
            policy: 'goal unchanged; recipes adds 40 (60 with live yarn) for accepted 2x2 and 30 for accepted Z, no drop lookahead',
            counterfactual: 'off disables 105/106 recipes and removes initial specials; same current Core/config, not archived historical source',
            clock: 'thinking before input plus production animation wall time; untimed removes timeLimitSec for diagnosis only',
            configs: ids.map(id => describe(levels.getLevel(id))), cells, comparisons }, null, 2));
    }
    for (const id of ids) for (const timing of timings) {
        const level = levels.getLevel(id);
        const summaries = Object.fromEntries(variants.map(variant => [variant, { levelId: id, timing, variant, n: rounds, wins: 0, timeouts: 0, moveFailures: 0,
            scoreSum: 0, actionsSum: 0, animationMsSum: 0, generatedPaw: 0, generatedBell: 0, triggeredPaw: 0, triggeredBell: 0,
            episodesPaw: 0, episodesBell: 0, yarnCleared: 0, failuresWithJelly: 0, failuresWithYarn: 0, failuresWithScore: 0, failuresWithCollect: 0,
            batchWins: [0, 0, 0], batchN: [0, 0, 0] }]));
        const pairs = Object.fromEntries(variants.filter(v => v !== 'off' && variants.includes('off')).map(v => [v, { offOnly: 0, newOnly: 0, both: 0, neither: 0 }]));
        for (let i = 0; i < rounds; i++) {
            const batch = i % seedBases.length;
            const seed = (seedBases[batch] + Math.imul(Math.floor(i / seedBases.length), 0x9e3779b1)) >>> 0;
            const outcomes = {};
            for (const variant of variants) {
                const candidate = JSON.parse(JSON.stringify(level));
                if (timing === 'untimed') candidate.timeLimitSec = 0;
                if (variant === 'off') { candidate.trackingPaw = false; candidate.colorBell = false; delete candidate.initialSpecials; }
                let coreRef, seenPaw = false, seenBell = false;
                const s = summaries[variant];
                const result = await sim.play({ level: candidate, seed, strategy: 'goal', thinkMs: timing === 'untimed' ? 3000 : Number(timing),
                    ...(variant === 'recipes' ? { selectMove: recipeMove } : {}),
                    onMatch(data, core) {
                        coreRef = core;
                        for (const g of data.generated || []) { s.generatedPaw += +(g.type === 105); s.generatedBell += +(g.type === 106); }
                        for (const t of data.triggeredSpecials || []) {
                            s.triggeredPaw += +(t.type === 105); s.triggeredBell += +(t.type === 106);
                            seenPaw ||= t.type === 105; seenBell ||= t.type === 106;
                        }
                    } });
                s.wins += +result.win; s.timeouts += +(result.reason === 'timeout'); s.moveFailures += +(result.reason === 'moves');
                s.scoreSum += result.score; s.actionsSum += result.actions; s.animationMsSum += result.animationMs;
                s.episodesPaw += +seenPaw; s.episodesBell += +seenBell;
                s.batchN[batch]++; s.batchWins[batch] += +result.win;
                if (coreRef) {
                    s.yarnCleared += +(!!level.yarn && coreRef.getYarnHealth() === 0);
                    if (!result.win) {
                        s.failuresWithJelly += +(coreRef.getJellyLeft() > 0);
                        s.failuresWithYarn += +(coreRef.getYarnHealth() > 0);
                        s.failuresWithScore += +candidate.goals.some(g => g.type === 'score' && coreRef.score < g.target);
                        s.failuresWithCollect += +candidate.goals.some(g => g.type === 'collect' && (coreRef.collectedCounts[g.pieceType] || 0) < g.target);
                    }
                }
                outcomes[variant] = result.win;
            }
            for (const [variant, p] of Object.entries(pairs)) {
                if (outcomes.off && outcomes[variant]) p.both++;
                else if (outcomes.off) p.offOnly++;
                else if (outcomes[variant]) p.newOnly++;
                else p.neither++;
            }
        }
        for (const s of Object.values(summaries)) { s.rate = s.wins / rounds; s.ci95 = wilson(s.wins, rounds); cells.push(s); }
        for (const [variant, p] of Object.entries(pairs)) {
            const difference = (p.newOnly - p.offOnly) / rounds;
            const se = rounds > 1 ? Math.sqrt(((p.newOnly + p.offOnly) / rounds - difference * difference) / (rounds - 1)) : 0;
            comparisons.push({ levelId: id, timing, variant, n: rounds, ...p, difference, approximatePairedCI95: [difference - 1.96 * se, difference + 1.96 * se] });
        }
        persist(false);
        console.log(JSON.stringify({ id, timing, n: rounds, rates: Object.fromEntries(Object.entries(summaries).map(([v, s]) => [v, +(100 * s.rate).toFixed(1)])) }));
    }
    persist(true);
    console.log('Measurement complete: ' + cells.reduce((s, c) => s + c.n, 0) + ' games; no target-tolerance or human-difficulty acceptance claimed.');
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
