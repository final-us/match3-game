'use strict';

// Synthetic canvas/native bridge and in-memory disk; real Main, UI, Board and solo engine.
// Synthetic high-target levels test attribution/lifecycle, not natural progression or device rendering.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const mainFile = path.resolve(__dirname, '../js/main.js');
const realRequire = require('module').createRequire(mainFile);
const createClock = require('./helpers/virtual-animation-clock');
const activation = require('../js/platform/activation-analytics');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
let disk = {}, scenes = [], events = [], nativeAdShows = 0;
const noop = () => {};
const ctx = new Proxy({
    measureText: text => ({ width: String(text).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    getLineDash: () => []
}, { get: (target, key) => key in target ? target[key] : noop });
const canvas = { width: 375, height: 667, getContext: () => ctx };
global.wx = {
    createCanvas: () => canvas,
    getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 1 }),
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getStorageSync: key => key in disk ? clone(disk[key]) : '',
    setStorageSync: (key, value) => { disk[key] = clone(value); },
    removeStorageSync: key => { delete disk[key]; },
    reportScene: payload => { scenes.push(payload); },
    reportEvent: (name, payload) => { events.push({ name, payload }); },
    onTouchStart: noop, onTouchMove: noop, onTouchEnd: noop,
    onTouchCancel: noop, onShow: noop, onHide: noop, showToast: noop,
    request: () => { throw Error('network forbidden in isolated fixture'); }
};
const audio = new Proxy({}, { get: () => noop });
const ad = {
    getDiagnosticLines: () => [], isRealRewardedAvailable: () => true,
    isRewardedAvailable: () => true, isBusy: () => false,
    getRewardedBlockReason: () => null, onShow: noop, onHide: noop,
    markRewardGranted: noop, onSoloResultExit: () => Promise.resolve(false),
    showRewarded: () => { nativeAdShows++; return Promise.resolve(true); }
};
const moduleMain = { exports: {} };
const frames = [];
vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), {
    module: moduleMain, wx: global.wx, requestAnimationFrame: fn => { frames.push(fn); },
    require: name => name === './audio' ? audio : name === './core/ad' ? ad : realRequire(name)
}, { filename: mainFile });
const Main = moduleMain.exports;
const Core = require('../js/core/game-core');
const levels = require('../js/core/level');
const snapshot = require('../js/core/solo-snapshot');
const journal = require('../js/core/solo-resume');
const onboarding = require('../js/core/onboarding');
const Board = require('../js/render/board-render');
const milestoneIds = { board_ready: 'fixture_ready', first_match: 'fixture_match',
    guide_confirm: 'fixture_confirm', guide_skip: 'fixture_skip' };

function reset() {
    disk = { match3_coin_v1: 0, match3_items_v1: { hammer: 3, bomb: 2, color: 1 },
        match3_heart_v1: { count: 5, lastLossTime: Date.now(), refundPending: false } };
    scenes = []; events = []; frames.length = 0; nativeAdShows = 0;
}

function app() {
    reset();
    const local = [];
    const reporter = activation.create(global.wx, { enabled: true, testOnly: true },
        { enabled: true, testOnly: true, eventIds: milestoneIds },
        (name, payload) => local.push({ name, payload }));
    Main.prototype.activationReporter = reporter;
    let value;
    try { value = new Main({ retentionSample: true, catalogSample: true }); }
    finally { delete Main.prototype.activationReporter; }
    value.activationReporter = reporter;
    value.activationLocal = local;
    assert(value.menuButtons, 'real constructor rendered menu hit targets');
    assert.strictEqual(scenes.length, 0, 'constructor first frame must wait for initial-entry resolution');
    const original = value.createSoloBoard;
    value.createSoloBoard = function (...args) {
        original.apply(this, args);
        assert(this.board instanceof Board);
        assert(this.core instanceof Core);
        const board = this.board;
        this.animationClock = createClock(dt => board.update(dt));
        board.wait = this.animationClock.wait;
    };
    return value;
}

const synthetic = { id: 1, name: 'Synthetic activation fixture', rows: 8, columns: 8,
    colorCount: 5, moveCount: 50, goals: [{ type: 'score', target: 99999999 }] };

function newBoard(a, level = synthetic, seed = 123) {
    a.retentionSolo = null; a.soloResumeRecord = null; a.soloRunStartedAt = Date.now();
    a.soloResumeSaveFailed = false; a.soloOperationBusy = false;
    a.guide = null; a.guideQueue = []; a.result = null;
    const previousRandom = Math.random;
    Math.random = snapshot.random(seed);
    try { a.createSoloBoard(level); } finally { Math.random = previousRandom; }
    a.core.random = snapshot.random(seed + 1);
    a.state = 'playing';
    return a.core;
}

function move(core, valid) {
    for (let row = 0; row < core.grid.length; row++) for (let column = 0; column < core.grid[0].length; column++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
            const from = { row, column }, to = { row: row + dr, column: column + dc };
            if (to.row < core.grid.length && to.column < core.grid[0].length && !core.isBlocked(from) &&
                !core.isBlocked(to) && core.validateMove(from, to) === valid) return [from, to];
        }
    }
    throw Error('synthetic board has no ' + (valid ? 'valid' : 'invalid') + ' adjacent swap');
}

async function pump(a, pending) { await a.animationClock.drain(pending); return pending; }
const names = a => a.activationLocal.map(event => event.name);
const count = (a, name) => names(a).filter(value => value === name).length;
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

async function startupAndReadiness() {
    for (const blocker of ['backgrounded', 'adFlow', 'battleCreating', 'soloOperationBusy',
        'soloResumeSaveFailed', 'soloResumePrompt', 'initialEntryResolved']) {
        const a = app();
        const original = a[blocker];
        a[blocker] = blocker === 'initialEntryResolved' ? false : true;
        a.render();
        assert.strictEqual(scenes.length, 0, blocker + ' blocks interactive marker');
        a[blocker] = original;
        a.render();
        assert.strictEqual(scenes.length, 1, blocker + ' release permits real rendered controls');
        assert.deepStrictEqual(Object.keys(scenes[0]).sort(), ['sceneId', 'success', 'fail'].sort());
        assert.strictEqual(scenes[0].sceneId, 7);
        a.handleHide(); a.render(); a.handleShow({}); a.render();
        assert.strictEqual(scenes.length, 1, 'foreground return must not repeat startup');
    }
    const a = app();
    const core = newBoard(a);
    for (const state of ['daily_playing', 'battle_playing', 'menu']) {
        a.state = state; a.reportActivationFrame();
        assert.strictEqual(count(a, 'solo_board_ready'), 0, 'readiness only belongs to ordinary playing');
    }
    a.state = 'playing';
    for (const blocker of ['backgrounded', 'adFlow', 'soloOperationBusy', 'soloResumePrompt', 'soloResumeSaveFailed']) {
        a[blocker] = true; a.reportActivationFrame(); a[blocker] = false;
        assert.strictEqual(count(a, 'solo_board_ready'), 0, blocker + ' blocks board readiness');
    }
    a.guide = { key: onboarding.GUIDE_KEYS.SOLO }; a.render();
    assert.strictEqual(count(a, 'solo_board_ready'), 0);
    a.dismissGuide();
    a.staminaDialog = true; a.reportActivationFrame(); a.staminaDialog = false;
    assert.strictEqual(count(a, 'solo_board_ready'), 0);
    core.processing = true; a.reportActivationFrame(); core.processing = false;
    assert.strictEqual(count(a, 'solo_board_ready'), 0);
    a.render(); a.render();
    assert.strictEqual(count(a, 'solo_board_ready'), 1);
}

async function realInputs() {
    const a = app(), core = newBoard(a, synthetic, 127);
    const rawMatch = { removed: [{ row: 0, column: 0 }], generated: [], score: 1 };
    await pump(a, core.callbacks.onMatch(rawMatch));
    assert.strictEqual(count(a, 'solo_first_match'), 0, 'manually firing match callback cannot invent a swap');
    const before = clone(core.grid), moves = core.movesLeft;
    assert.strictEqual(await pump(a, core.trySwap(...move(core, false))), false);
    assert.deepStrictEqual(core.grid, before);
    assert.strictEqual(core.movesLeft, moves);
    assert.strictEqual(count(a, 'solo_first_match'), 0, 'invalid swap is not first match');
    assert.strictEqual(await pump(a, core.useTool('unknown', move(core, true)[0])), false);
    assert.strictEqual(await pump(a, core.useTool('hammer', move(core, true)[0])), true);
    assert(core.score > 0, 'real tool did clear cells');
    assert.strictEqual(count(a, 'solo_first_match'), 0, 'tool clear is not first swap match');
    let matches = 0;
    const onMatch = core.callbacks.onMatch;
    core.callbacks.onMatch = data => { matches++; return onMatch(data); };
    const beforeSwapMoves = core.movesLeft;
    assert.strictEqual(await pump(a, core.trySwap(...move(core, true))), true);
    assert.strictEqual(core.movesLeft, beforeSwapMoves - 1, 'wrapper preserves engine progression');
    assert(matches >= 2, 'synthetic seed exercises real cascades as well as initial match');
    assert.strictEqual(count(a, 'solo_first_match'), 1);
    assert.strictEqual(count(a, 'solo_board_ready'), 1, 'accepted swap also establishes readiness');
    await pump(a, core.trySwap(...move(core, true)));
    assert.strictEqual(count(a, 'solo_first_match'), 1, 'later swaps/cascades do not repeat first match');
    const oldCore = core, oldBoard = a.board;
    newBoard(a, synthetic, 456);
    assert.strictEqual(count(a, 'solo_first_match'), 1);
    await oldCore.callbacks.onSwap({ row: 0, column: 0 }, { row: 0, column: 1 });
    await oldCore.callbacks.onMatch(rawMatch);
    assert.strictEqual(count(a, 'solo_first_match'), 1, 'old board callbacks cannot mark replacement round');
    assert.notStrictEqual(a.board, oldBoard);
    await pump(a, a.core.trySwap(...move(a.core, true)));
    assert.strictEqual(count(a, 'solo_first_match'), 2, 'new ordinary round resets first-match flag');

    const b = app(), failedCore = newBoard(b);
    const animateInvalid = b.board.animateInvalidSwap;
    const failure = Error('synthetic animation rejection');
    b.board.animateInvalidSwap = () => Promise.reject(failure);
    await assert.rejects(failedCore.trySwap(...move(failedCore, false)), error => error === failure);
    assert.strictEqual(failedCore.swapFeedbackPending, false, 'core cleans invalid-input pending flag on rejection');
    b.board.animateInvalidSwap = animateInvalid;
    await pump(b, failedCore.callbacks.onMatch(rawMatch));
    assert.strictEqual(count(b, 'solo_first_match'), 0, 'rejected input must release attribution');
    assert.strictEqual(await pump(b, failedCore.trySwap(...move(failedCore, true))), true);
    assert.strictEqual(count(b, 'solo_first_match'), 1, 'later valid input still attributes after rejection cleanup');
}

async function guides() {
    for (const outcome of ['confirm', 'skip']) {
        const a = app(); newBoard(a);
        assert(a.showGuide(onboarding.GUIDE_KEYS.SOLO));
        a.render();
        const button = a.guideButtons[outcome];
        assert(button, 'real guide drawing provides ' + outcome + ' target');
        assert(a.handleGuideTouch(button.x + button.w / 2, button.y + button.h / 2));
        assert.strictEqual(count(a, 'solo_guide_' + outcome), 1);
        assert.strictEqual(count(a, 'solo_guide_' + (outcome === 'skip' ? 'confirm' : 'skip')), 0);
        assert.strictEqual(a.guide, null);
        assert(onboarding.hasSeen(onboarding.GUIDE_KEYS.SOLO), 'existing seen-on-dismiss behavior preserved');
        a.guide = { key: onboarding.GUIDE_KEYS.SOLO };
        a.dismissGuide(outcome === 'skip' ? 'confirm' : 'skip');
        assert.strictEqual(count(a, 'solo_guide_confirm') + count(a, 'solo_guide_skip'), 1);
    }
    const a = app(); newBoard(a);
    a.showGuide(onboarding.GUIDE_KEYS.SOLO); a.dismissGuide();
    a.showGuide(onboarding.GUIDE_KEYS.SPECIAL); a.render();
    const confirm = a.guideButtons.confirm;
    a.handleGuideTouch(confirm.x + 1, confirm.y + 1);
    assert.strictEqual(count(a, 'solo_guide_confirm') + count(a, 'solo_guide_skip'), 0,
        'programmatic and special guide dismissal must not fabricate basic-guide outcome');
}

async function resume() {
    const a = app();
    newBoard(a, levels.getLevel(11));
    a.render();
    await pump(a, a.core.trySwap(...move(a.core, true)));
    a.guide = { key: onboarding.GUIDE_KEYS.SOLO }; a.dismissGuide('confirm');
    const flags = clone(a.soloResumeMeta().activation);
    assert(flags.boardReady && flags.firstMatch && flags.guideOutcome === 'confirm');
    a.core.processing = false; a.core.ended = true; a.core.won = false; a.core.movesLeft = 0;
    a.state = 'result'; a.result = { win: false, score: a.core.score, canRevive: true };
    const before = names(a).slice();
    assert.strictEqual(await a.reviveGame(), true);
    assert.strictEqual(nativeAdShows, 1, 'revival uses only synthetic native ad fixture');
    assert.strictEqual(a.state, 'playing');
    a.guide = null; a.guideQueue = []; a.render();
    assert.deepStrictEqual(names(a), before, 'same-process revival preserves milestone flags');
    assert.deepStrictEqual(clone(a.soloResumeMeta().activation), flags);
    const record = clone(journal.read().record);
    a.retireSoloReport(true);
    assert.strictEqual(a.soloActivation, null);
    a.installSoloResume(record);
    a.guide = null; a.guideQueue = []; a.render();
    assert.deepStrictEqual(names(a), before, 'journal restore does not backfill completed milestones');
    assert.deepStrictEqual(clone(a.soloResumeMeta().activation), flags);
    const coldRecord = clone(journal.read().record);
    const legacy = clone(journal.read().record);
    delete legacy.meta.activation;
    disk[journal.KEY] = clone(legacy);
    a.retireSoloReport(true);
    a.installSoloResume(legacy);
    assert.strictEqual(a.soloActivation, null, 'legacy untracked journal must remain excluded');
    a.guide = null; a.guideQueue = []; a.render();
    await pump(a, a.core.trySwap(...move(a.core, true)));
    assert.deepStrictEqual(names(a), before, 'old journal valid input must not fabricate historic milestones');

    const cold = app();
    disk[journal.KEY] = clone(coldRecord);
    assert.strictEqual(await cold.restoreSoloResume(coldRecord), true, 'fresh Main restores through real recovery');
    cold.guide = null; cold.guideQueue = []; cold.render();
    assert.deepStrictEqual(names(cold), [], 'cold restored tracked flags do not replay locally');
    assert.strictEqual(events.length, 0, 'cold restored flags do not replay custom native events');
    assert.deepStrictEqual(clone(cold.soloResumeMeta().activation), flags);
}

const guard = setTimeout(() => { console.error('activation Main fixture hung'); process.exit(1); }, 15000);
(async () => {
    await startupAndReadiness();
    await realInputs();
    await guides();
    await resume();
    await flush();
    console.log('activation Main integration passed: real render/input/guide/revival and journal boundaries');
})().catch(error => { console.error(error); process.exitCode = 1; })
    .finally(() => { clearTimeout(guard); delete global.wx; });
