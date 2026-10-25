'use strict';

const EVENT_ID = '10000003';
const COUNT_PREFIX = 'match3_level_analytics_entries_v1_';
const MAX = Number.MAX_SAFE_INTEGER;

function integer(value, min, max) {
    return Number.isSafeInteger(value) && value >= min && value <= max;
}

function validLevel(level) {
    return level && integer(level.id, 1, MAX) && typeof level.name === 'string' &&
        level.name.length > 0 && level.name.length <= 128 && !/[\x00-\x1f\x7f]/.test(level.name);
}

function create(platform, settings, now = Date.now) {
    let enabled = !!settings && settings.enabled === true;
    const runs = new WeakMap();
    const stats = {
        unavailable: 0, initFailed: 0, attempted: 0, succeeded: 0, failed: 0,
        storageReadFailed: 0, storageWriteFailed: 0, environmentBlocked: 0
    };
    let initialized = false;
    let manager = null;
    let gameVersion;

    let environment;
    if (enabled && (settings.testOnly === true || settings.debug === true || settings.debugInTest === true)) {
        try { environment = platform.getAccountInfoSync().miniProgram.envVersion; } catch (e) { /* Fail closed. */ }
        if (settings.testOnly === true && environment !== 'develop' && environment !== 'trial') {
            enabled = false;
            stats.environmentBlocked = 1;
        }
    }
    const debug = enabled && (settings.debug === true || settings.debugInTest === true) &&
        (environment === 'develop' || environment === 'trial');

    function trace(stage, level, action, error) {
        if (!debug) return;
        try {
            const detail = { stage: stage, eventID: EVENT_ID, environment: environment, debug: debug };
            if (level) detail.levelID = level.id;
            if (action !== undefined) detail.levelResult = action;
            const errCode = error && error.errCode;
            if (Number.isSafeInteger(errCode)) detail.errCode = errCode;
            console.log('[level-analytics] ' + JSON.stringify(detail));
        } catch (e) { /* Optional diagnostic output must not interrupt gameplay or SDK callbacks. */ }
    }
    trace('ready');

    function count(key) { stats[key] = Math.min(MAX, stats[key] + 1); }

    function initialize() {
        if (initialized) return manager;
        initialized = true;
        if (!platform || typeof platform.getMiniReportManager !== 'function') {
            count('unavailable');
            trace('api_unavailable');
            return null;
        }
        try {
            manager = platform.getMiniReportManager({ debug: debug, eventList: [EVENT_ID] });
            if (!manager || typeof manager.report !== 'function') throw new Error('unavailable');
        } catch (e) {
            manager = null;
            count('initFailed');
            trace('init_failed', undefined, undefined, e);
        }
        if (integer(settings.gameVersion, 1, MAX)) gameVersion = settings.gameVersion;
        else if (platform && typeof platform.getAccountInfoSync === 'function') {
            try {
                const info = platform.getAccountInfoSync();
                const version = info && info.miniProgram && info.miniProgram.version;
                if (typeof version === 'string' && /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.test(version)) {
                    const parts = version.split('.').map(Number);
                    const value = parts[0] * 1000000 + parts[1] * 1000 + parts[2];
                    if (value > 0) gameVersion = value;
                }
            } catch (e) { /* Optional published version is unavailable. */ }
        }
        return manager;
    }

    function owns(run) { return enabled && !!run && runs.has(run); }

    function report(run, action, progress, loginCount) {
        const logger = initialize();
        if (!logger) return;
        const level = runs.get(run);
        const payload = {
            eventID: EVENT_ID, levelID: level.id, levelName: level.name,
            levelAction: 1, levelResult: action
        };
        if (integer(progress, 0, 100)) payload.levelProgress = progress;
        if (action === 1 && run.timeKnown && integer(run.activeMs, 0, MAX)) {
            payload.levelTime = Math.floor(run.activeMs / 1000);
        }
        if (action === 5 && integer(loginCount, 1, MAX)) payload.loginCount = loginCount;
        if (gameVersion !== undefined) payload.gameVersion = gameVersion;
        let settled = false;
        payload.success = function () {
            if (!settled) { settled = true; count('succeeded'); trace('sdk_success', level, action); }
        };
        payload.fail = function (error) {
            if (!settled) { settled = true; count('failed'); trace('sdk_failed', level, action, error); }
        };
        count('attempted');
        trace('attempt', level, action);
        try {
            const pending = logger.report(payload);
            if (pending && typeof pending.then === 'function') pending.then(undefined, payload.fail);
        } catch (e) { payload.fail(e); }
    }

    function entryCount(id) {
        let prior;
        try {
            if (!platform || typeof platform.getStorageSync !== 'function') throw new Error('unavailable');
            prior = platform.getStorageSync(COUNT_PREFIX + id);
            if (prior === undefined || prior === null || prior === '') prior = 0;
            if (!integer(prior, 0, MAX - 1)) throw new Error('invalid counter');
        } catch (e) { count('storageReadFailed'); return undefined; }
        try {
            if (typeof platform.setStorageSync !== 'function') throw new Error('unavailable');
            platform.setStorageSync(COUNT_PREFIX + id, prior + 1);
        } catch (e) { count('storageWriteFailed'); return undefined; }
        return prior + 1;
    }

    function makeRun(level) {
        const run = {
            levelId: level.id, levelName: level.name, cycle: 0, resultCycle: -1,
            lastResult: null, closed: false, activeMs: 0, lastAt: null,
            running: false, timeKnown: true
        };
        runs.set(run, { id: level.id, name: level.name });
        return run;
    }

    function setRunning(run, running) {
        if (!owns(run) || run.closed) return;
        const at = now();
        if (run.running) {
            const elapsed = at - run.lastAt;
            if (!Number.isFinite(at) || !Number.isFinite(elapsed) || elapsed < 0 ||
                !integer(run.activeMs + Math.floor(elapsed), 0, MAX)) run.timeKnown = false;
            else run.activeMs += Math.floor(elapsed);
        }
        run.running = running === true && run.lastResult === null && Number.isFinite(at);
        run.lastAt = run.running ? at : null;
        if (!Number.isFinite(at)) run.timeKnown = false;
    }

    function start(level) {
        if (!enabled || !validLevel(level)) return null;
        const run = makeRun(level);
        report(run, 5, undefined, entryCount(level.id));
        return run;
    }

    function snapshot(run) {
        if (!owns(run)) return null;
        setRunning(run, run.running);
        return {
            version: 1, levelId: runs.get(run).id, cycle: run.cycle, resultCycle: run.resultCycle,
            lastResult: run.lastResult, closed: run.closed, activeMs: run.activeMs,
            timeKnown: run.timeKnown
        };
    }

    function restore(level, saved) {
        if (!enabled || !validLevel(level) || !saved || saved.version !== 1 ||
            saved.levelId !== level.id || !integer(saved.cycle, 0, MAX) ||
            !integer(saved.resultCycle, -1, saved.cycle) || typeof saved.closed !== 'boolean' ||
            !integer(saved.activeMs, 0, MAX) || typeof saved.timeKnown !== 'boolean' ||
            (saved.lastResult !== null && saved.lastResult !== 1 && saved.lastResult !== 2) ||
            (saved.lastResult === null ? saved.resultCycle !== -1 : saved.resultCycle !== saved.cycle)) return null;
        const run = makeRun(level);
        run.cycle = saved.cycle;
        run.resultCycle = saved.resultCycle;
        run.lastResult = saved.lastResult;
        run.closed = saved.closed;
        run.activeMs = saved.activeMs;
        // A cold restore cannot know foreground time since the last checkpoint.
        run.timeKnown = false;
        return run;
    }

    function result(run, win, progress) {
        if (!owns(run) || run.closed || typeof win !== 'boolean' || run.resultCycle === run.cycle) return;
        setRunning(run, false);
        run.resultCycle = run.cycle;
        run.lastResult = win ? 1 : 2;
        report(run, run.lastResult, win ? 100 : progress);
    }

    function revive(run, cycle, progress) {
        if (!owns(run) || run.closed || run.lastResult !== 2 || !integer(cycle, 1, MAX) || cycle <= run.cycle) return;
        setRunning(run, false);
        run.cycle = cycle;
        run.resultCycle = -1;
        run.lastResult = null;
        report(run, 4, progress);
    }

    function close(run, action, progress) {
        if (!owns(run) || run.closed) return;
        setRunning(run, false);
        run.closed = true;
        if (action === 3 || (action === 6 && run.lastResult !== 1)) report(run, action, progress);
    }

    function event(run, action, progress) {
        if (!owns(run) || run.closed) return;
        if ((action === 7 && run.lastResult === null) || (action === 8 && run.lastResult !== 1)) {
            report(run, action, progress);
        }
    }

    return {
        start: start, restore: restore, setRunning: setRunning, result: result,
        revive: revive, close: close, event: event, snapshot: snapshot,
        diagnostics: function () { return Object.assign({}, stats); }
    };
}

module.exports = { create: create };
