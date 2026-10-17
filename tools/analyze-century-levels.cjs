'use strict';
// Offline measurement: real Core/Board animation, paired seeds, no storage or network.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sim = require('../match3-wechat/test/helpers/solo-simulation');
const recipeMove = require('../match3-wechat/test/helpers/recipe-move');
const levels = require('../match3-wechat/js/core/level');
const root = path.resolve(__dirname, '..');
const defaults = { ids: '1-10,11,20,30,41,61,81,91,100,101,121,200', runs: '200',
    thinkMs: '3000,6000,unlimited', strategies: 'goal,greedy,random',
    seedBase: '0x5eed1234', output: '/private/tmp/match3-century-levels.json' };

function options(args) {
    const out = { ...defaults };
    for (const arg of args) {
        const match = /^--([^=]+)=(.+)$/.exec(arg);
        if (!match || !Object.hasOwn(defaults, match[1])) throw new Error('Unknown option: ' + arg);
        out[match[1]] = match[2];
    }
    return out;
}
function parseIds(value) {
    const result = [];
    for (const part of value.split(',')) {
        const match = /^(\d+)(?:-(\d+))?$/.exec(part);
        if (!match) throw new Error('Invalid level IDs: ' + part);
        const from = Number(match[1]), to = Number(match[2] || match[1]);
        if (from < 1 || to < from || to > 10000) throw new Error('Invalid level range: ' + part);
        for (let id = from; id <= to; id++) if (!result.includes(id)) result.push(id);
    }
    return result;
}
function wilson(wins, n) {
    const z = 1.959963984540054, p = wins / n, d = 1 + z * z / n;
    const center = (p + z * z / (2 * n)) / d;
    const radius = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [Math.max(0, center - radius), Math.min(1, center + radius)];
}
function remainingGoals(level, state) {
    return level.goals.map((goal, index) => {
        let remaining;
        switch (goal.type) {
        case 'score': remaining = Math.max(0, goal.target - state.score); break;
        case 'collect': remaining = Math.max(0, goal.target - (state.collected[goal.pieceType] || 0)); break;
        case 'jelly': remaining = state.jelly.flat().reduce((sum, layers) => sum + layers, 0); break;
        case 'ice': remaining = state.ice.flat().filter(cell => cell === 1).length; break;
        case 'yarn': remaining = state.yarn ? state.yarn.health : 0; break;
        case 'moonbud': remaining = Object.keys(state.moonbuds).length; break;
        case 'parcel': remaining = state.parcels.length; break;
        default: throw new Error('Unknown goal: ' + goal.type);
        }
        return { index, ...goal, remaining };
    });
}
function sourceIdentity() {
    const files = ['js/core/level.js', 'js/core/curated-levels.js', 'js/core/level-templates.js', 'js/core/level-budgets.js', 'js/core/game-core.js',
        'js/core/grid.js', 'js/core/config.js', 'js/core/tracking-paw.js', 'js/core/color-bell.js',
        'js/render/board-render.js', 'js/render/new-obstacles-render.js', 'js/special-trigger-timing.js',
        'test/helpers/solo-simulation.js', 'test/helpers/recipe-move.js', 'test/helpers/virtual-animation-clock.js'];
    return { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        workingTree: 'HEAD plus local changes; configs captured per level',
        files: files.map(file => {
            const name = 'match3-wechat/' + file, stat = fs.statSync(path.join(root, name));
            return { path: name, bytes: stat.size, modified: stat.mtime.toISOString() };
        }) };
}
async function main() {
    if (process.argv.includes('--help')) {
        console.log('node tools/analyze-century-levels.cjs --ids=1-10,11,20,100 --runs=200 --thinkMs=3000,6000,unlimited --strategies=recipe,goal,greedy,random --seedBase=0x5eed1234 --output=/private/tmp/match3-century-levels.json');
        console.log('unlimited: diagnostic clone with timeLimitSec=0, thinkMs=3000; real animation still runs. Rates are measurements, not targetWinRate or human predictions.');
        return;
    }
    const args = options(process.argv.slice(2)), ids = parseIds(args.ids), runs = Number(args.runs);
    const seedBase = Number(args.seedBase), timings = args.thinkMs.split(','), strategies = args.strategies.split(',');
    if (!Number.isInteger(runs) || runs < 1 || runs > 100000) throw new Error('runs must be 1..100000');
    if (!Number.isInteger(seedBase) || seedBase < 0 || seedBase > 0xffffffff) throw new Error('seedBase must be uint32');
    if (!timings.every(t => t === 'unlimited' || /^\d+$/.test(t) && Number.isSafeInteger(Number(t)))) throw new Error('Invalid thinkMs');
    if (!strategies.every(s => ['recipe', 'goal', 'greedy', 'random'].includes(s))) throw new Error('Invalid strategies');
    const output = path.resolve(args.output), directory = fs.realpathSync(path.dirname(output));
    if (directory !== '/private/tmp' && !directory.startsWith('/private/tmp/')) throw new Error('Output must be under /private/tmp');
    if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('Output cannot be a symlink');
    const report = { version: 'century-levels-v1', complete: false, started: new Date().toISOString(),
        runtime: process.version, source: sourceIdentity(), runs, seedBase,
        seedFormula: '(seedBase + imul(levelId, 1000003) + imul(runIndex, 0x9e3779b1)) >>> 0; identical per timing/strategy',
        rules: 'production Core/Grid/Board; separate board/policy RNG; no items, revival or assistance; animationTime=true, reduceEffects=false',
        strategies: { goal: 'single-step matches, remaining collect and obstacle progress; fixed special preference; no drop lookahead',
            greedy: 'match length squared plus fixed special preference', random: 'uniform legal swap',
            recipe: 'unchanged existing recipes: accepted paw +40 (+60 with live yarn), accepted bell +30, no drop lookahead' },
        clocks: 'numeric thinkMs uses original level deadline plus real animation wall time. unlimited removes only cloned deadline and uses 3000ms thinking, diagnostic only.',
        configs: ids.map(id => levels.getLevel(id)), cells: [] };
    const persist = () => fs.writeFileSync(output, JSON.stringify(report, null, 2));
    for (const level of report.configs) for (const timing of timings) for (const strategy of strategies) {
        const candidate = JSON.parse(JSON.stringify(level));
        if (timing === 'unlimited') candidate.timeLimitSec = 0;
        const cell = { levelId: level.id, timing, diagnostic: timing === 'unlimited', strategy,
            n: runs, wins: 0, failureReasons: {}, actions: { sum: 0, min: Infinity, max: 0 },
            remaining: level.goals.map((g, index) => ({ index, ...g, sum: 0, failuresRemaining: 0 })),
            initialParcelPaths: (level.parcels || []).map(parcel => ({ ...parcel, distance: level.rows - 1 - parcel.row })),
            results: [] };
        for (let i = 0; i < runs; i++) {
            const seed = (seedBase + Math.imul(level.id, 1000003) + Math.imul(i, 0x9e3779b1)) >>> 0;
            const result = await sim.play({ level: candidate, seed, strategy,
                ...(strategy === 'recipe' ? { selectMove: recipeMove } : {}),
                thinkMs: timing === 'unlimited' ? 3000 : Number(timing), finalState: true });
            const remaining = remainingGoals(candidate, result.finalState);
            cell.wins += +result.win;
            if (!result.win) cell.failureReasons[result.reason] = (cell.failureReasons[result.reason] || 0) + 1;
            cell.actions.sum += result.actions;
            cell.actions.min = Math.min(cell.actions.min, result.actions); cell.actions.max = Math.max(cell.actions.max, result.actions);
            remaining.forEach((goal, index) => {
                cell.remaining[index].sum += goal.remaining;
                cell.remaining[index].failuresRemaining += +(!result.win && goal.remaining > 0);
            });
            cell.results.push({ runIndex: i, seed, ...result, remaining,
                remainingParcelPaths: result.finalState.parcels.map(parcel => ({ ...parcel, distance: candidate.rows - 1 - parcel.row })) });
        }
        cell.rate = cell.wins / runs; cell.ci95 = wilson(cell.wins, runs);
        cell.actions.mean = cell.actions.sum / runs;
        cell.remaining.forEach(goal => { goal.mean = goal.sum / runs; });
        report.cells.push(cell); persist();
        console.log(`level ${level.id} ${timing} ${strategy}: ${cell.wins}/${runs} (${(cell.rate * 100).toFixed(1)}%), CI95 ${(cell.ci95[0] * 100).toFixed(1)}–${(cell.ci95[1] * 100).toFixed(1)}%, actions ${cell.actions.mean.toFixed(2)}`);
    }
    report.complete = true; report.finished = new Date().toISOString(); persist();
    console.log('Measurement written to ' + output);
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
