'use strict';
// Action-count diagnosis only. Suggested budgets are not timed win-rate validation.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sim = require('../match3-wechat/test/helpers/solo-simulation');
const recipeMove = require('../match3-wechat/test/helpers/recipe-move');
const levels = require('../match3-wechat/js/core/level');
const root = path.resolve(__dirname, '..');
const defaults = { ids: '11-330', runs: '200', seedBase: '0x5eed1234',
    output: '/private/tmp/match3-century-budget-candidate.json', merge: '' };
function parseOptions(args) {
    const out = { ...defaults };
    for (const arg of args) {
        const match = /^--([^=]+)=(.+)$/.exec(arg);
        if (!match || !Object.hasOwn(defaults, match[1])) throw new Error('Unknown option: ' + arg);
        out[match[1]] = match[2];
    }
    return out;
}
function parseIds(value) {
    const ids = [];
    for (const part of value.split(',')) {
        const match = /^(\d+)(?:-(\d+))?$/.exec(part);
        if (!match) throw new Error('Invalid IDs: ' + part);
        const from = Number(match[1]), to = Number(match[2] || match[1]);
        if (from < 11 || to > 330 || to < from) throw new Error('Training IDs must be 11..330');
        for (let id = from; id <= to; id++) if (!ids.includes(id)) ids.push(id);
    }
    return ids;
}
function chooseBudget(distribution, runs, targetPercent) {
    const candidates = [];
    for (let moves = 6; moves <= 30; moves++) {
        const wins = distribution.slice(0, moves + 1).reduce((sum, count) => sum + count, 0);
        const percent = 100 * wins / runs;
        candidates.push({ moves, wins, percent, error: Math.abs(percent - targetPercent) });
    }
    // Integer budget closest to target; ties choose the smaller budget.
    const chosen = candidates.reduce((best, item) => item.error < best.error - 1e-10 ? item : best);
    return { ...chosen, targetPercent, candidates,
        floorTooHigh: candidates[0].percent > targetPercent,
        ceilingTooLow: candidates.at(-1).percent < targetPercent,
        floorPercent: candidates[0].percent, ceilingPercent: candidates.at(-1).percent,
        exactTrainingHit: chosen.error < 1e-10 };
}
function sourceIdentity() {
    const files = ['js/core/level.js', 'js/core/curated-levels.js', 'js/core/level-templates.js',
        'js/core/game-core.js', 'js/core/grid.js', 'js/core/config.js', 'js/core/tracking-paw.js',
        'js/core/color-bell.js', 'js/render/board-render.js', 'js/render/new-obstacles-render.js',
        'js/special-trigger-timing.js', 'test/helpers/solo-simulation.js',
        'test/helpers/recipe-move.js', 'test/helpers/virtual-animation-clock.js'];
    return { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        workingTree: 'HEAD plus current local changes',
        files: files.map(file => {
            const name = 'match3-wechat/' + file, stat = fs.statSync(path.join(root, name));
            return { path: name, bytes: stat.size, modified: stat.mtime.toISOString() };
        }) };
}
function mergeReports(files, output) {
    const reports = files.map(file => JSON.parse(fs.readFileSync(file, 'utf8'))), first = reports[0];
    for (const report of reports) {
        for (const field of ['version', 'runtime', 'runs', 'seedBase', 'strategy', 'source', 'rules', 'diagnostic', 'selection', 'seedFormula']) {
            if (JSON.stringify(report[field]) !== JSON.stringify(first[field])) throw new Error('Shard mismatch: ' + field);
        }
        if (report.sourceChangedDuringRun) throw new Error('Source changed in a shard');
    }
    const current = sourceIdentity();
    if (JSON.stringify(current) !== JSON.stringify(first.source)) throw new Error('Source changed since training began');
    const merged = { ...first, started: reports.map(r => r.started).sort()[0],
        levels: reports.flatMap(r => r.levels).sort((a, b) => a.id - b.id),
        early: Array(80).fill(null), peak: Array(240).fill(null),
        mergedFiles: files, interruptedInputFiles: files.filter((file, index) => !reports[index].complete) };
    const ids = new Set();
    for (const level of merged.levels) {
        if (ids.has(level.id)) throw new Error('Duplicate training level: ' + level.id);
        ids.add(level.id);
        if (level.results.length !== first.runs || level.distribution.reduce((s, n) => s + n, 0) + level.infinity !== first.runs) {
            throw new Error('Incomplete level: ' + level.id);
        }
        if (JSON.stringify(chooseBudget(level.distribution, first.runs, level.originalConfig.targetWinRate)) !== JSON.stringify(level.choice)) {
            throw new Error('Invalid budget selection: ' + level.id);
        }
        merged[level.id <= 90 ? 'early' : 'peak'][level.index] = level.choice.moves;
    }
    merged.ids = [...ids]; merged.complete = true;
    merged.fullTrainingCoverage = merged.early.every(Number.isInteger) && merged.peak.every(Number.isInteger);
    merged.unreachableFloors = merged.levels.filter(l => l.choice.floorTooHigh).map(l => l.id);
    merged.unreachableCeilings = merged.levels.filter(l => l.choice.ceilingTooLow).map(l => l.id);
    merged.sourceEnd = current; merged.sourceChangedDuringRun = false;
    merged.finished = new Date().toISOString(); merged.elapsedMs = Date.now() - Date.parse(merged.started);
    fs.writeFileSync(output, JSON.stringify(merged, null, 2));
    console.log(`Merged ${merged.levels.length} levels; fullTrainingCoverage=${merged.fullTrainingCoverage}; ${output}`);
}
async function main() {
    if (process.argv.includes('--help')) {
        console.log('node tools/calibrate-century-moves.cjs --ids=11-330 --runs=200 --seedBase=0x5eed1234 --output=/private/tmp/match3-century-budget-candidate.json');
        console.log('Merge matching completed level records: --merge=/private/tmp/shard1.json,/private/tmp/shard2.json --output=/private/tmp/merged.json');
        return;
    }
    const args = parseOptions(process.argv.slice(2)), ids = parseIds(args.ids), runs = Number(args.runs), seedBase = Number(args.seedBase);
    if (!Number.isInteger(runs) || runs < 1 || runs > 100000) throw new Error('runs must be 1..100000');
    if (!Number.isInteger(seedBase) || seedBase < 0 || seedBase > 0xffffffff) throw new Error('seedBase must be uint32');
    const output = path.resolve(args.output), directory = fs.realpathSync(path.dirname(output));
    if (directory !== '/private/tmp' && !directory.startsWith('/private/tmp/')) throw new Error('Output must be under /private/tmp');
    if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('Output cannot be a symlink');
    if (args.merge) { mergeReports(args.merge.split(','), output); return; }
    const began = Date.now();
    const report = { version: 'century-action-budget-diagnosis-v1', complete: false, started: new Date().toISOString(),
        source: sourceIdentity(), runtime: process.version, runs, seedBase, ids, strategy: 'recipe',
        seedFormula: '(seedBase + imul(levelId, 1000003) + imul(runIndex, 0x9e3779b1)) >>> 0; same formula as measurement tool',
        rules: 'production Core/Grid/Board; separate board/policy RNG; real animation waits; no items/revival/assistance',
        diagnostic: 'cloned moveCount=80, timeLimitSec=0, thinkMs=3000. Only wins have finite completion actions; failure is Infinity (serialized as null with completed=false). Budget estimates do not validate original deadlines.',
        selection: 'integer 6..30 with nearest empirical completion fraction to targetWinRate; tie chooses lower moves. targetWinRate is desired curve, never an observed win.',
        indexing: { early: 'id-11 for training IDs 11..90', peak: '(id-11)%240 for training IDs 91..330' },
        early: Array(80).fill(null), peak: Array(240).fill(null), levels: [] };
    const persist = () => fs.writeFileSync(output, JSON.stringify(report, null, 2));
    for (const id of ids) {
        const original = levels.getLevel(id), candidate = JSON.parse(JSON.stringify(original));
        candidate.moveCount = 80; candidate.timeLimitSec = 0;
        const distribution = Array(81).fill(0), results = [], failureReasons = {};
        let failures = 0;
        for (let i = 0; i < runs; i++) {
            const seed = (seedBase + Math.imul(id, 1000003) + Math.imul(i, 0x9e3779b1)) >>> 0;
            const result = await sim.play({ level: candidate, seed, strategy: 'recipe', thinkMs: 3000,
                selectMove: recipeMove, finalState: true });
            if (!result.finalState.ended || result.win !== result.finalState.won) throw new Error('Missing real Core settlement');
            if (result.win) distribution[result.actions]++;
            else { failures++; failureReasons[result.reason] = (failureReasons[result.reason] || 0) + 1; }
            results.push({ runIndex: i, seed, completed: result.win, completionActions: result.win ? result.actions : null,
                actions: result.actions, reason: result.reason, score: result.score, animationMs: result.animationMs,
                ...(result.win ? {} : { finalState: result.finalState }) });
        }
        const choice = chooseBudget(distribution, runs, levels.getTargetWinRate(id));
        const index = id <= 90 ? id - 11 : (id - 11) % 240;
        report[id <= 90 ? 'early' : 'peak'][index] = choice.moves;
        report.levels.push({ id, index, originalConfig: original, cloneConfig: candidate,
            distribution, infinity: failures, failureReasons, choice, results });
        if (report.levels.length % 10 === 0 || report.levels.length === ids.length) {
            report.elapsedMs = Date.now() - began; persist();
            console.log(`${report.levels.length}/${ids.length} levels, ${(report.elapsedMs / 1000).toFixed(1)}s; level ${id} -> ${choice.moves} moves, diagnostic ${choice.percent.toFixed(1)}%, desired ${choice.targetPercent}%, residual ${choice.error.toFixed(1)}pp`);
        }
    }
    report.sourceEnd = sourceIdentity();
    report.sourceChangedDuringRun = JSON.stringify(report.sourceEnd) !== JSON.stringify(report.source);
    report.complete = true; report.finished = new Date().toISOString(); report.elapsedMs = Date.now() - began;
    report.fullTrainingCoverage = report.early.every(Number.isInteger) && report.peak.every(Number.isInteger);
    report.unreachableFloors = report.levels.filter(level => level.choice.floorTooHigh).map(level => level.id);
    report.unreachableCeilings = report.levels.filter(level => level.choice.ceilingTooLow).map(level => level.id);
    persist(); console.log('Suggestions written to ' + output);
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
