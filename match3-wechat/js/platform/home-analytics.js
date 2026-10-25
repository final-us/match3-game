'use strict';

function branchId(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : '';
}

function create(platform, settings) {
    const stats = {
        attempted: 0, submitted: 0, failed: 0, unavailable: 0,
        environmentBlocked: 0, configMissing: 0
    };
    let enabled = !!settings && settings.enabled === true;
    let environment;
    if (enabled && (settings.testOnly === true || settings.debug === true)) {
        try { environment = platform.getAccountInfoSync().miniProgram.envVersion; } catch (e) { /* Fail closed. */ }
        if (settings.testOnly === true && environment !== 'develop' && environment !== 'trial') {
            enabled = false;
            stats.environmentBlocked = 1;
        }
    }
    const branches = settings && settings.branches;
    const ids = { solo: branchId(branches && branches.solo), pvp: branchId(branches && branches.pvp) };
    if (ids.solo && ids.solo === ids.pvp) ids.solo = ids.pvp = '';
    let visit;
    const debug = enabled && settings.debug === true && (environment === 'develop' || environment === 'trial');

    // Local test console only. No player data or raw SDK errors; submitted is not a server receipt.
    function trace(stage, key, eventType, gates) {
        if (!debug) return;
        try {
            console.log('[home-analytics] ' + JSON.stringify({stage: stage, branch: key, eventType: eventType,
                branchId: ids[key], environment: environment, gates: gates}));
        } catch (e) { /* Diagnostic output must not interrupt gameplay or reporting. */ }
    }

    function count(key) { stats[key] = Math.min(Number.MAX_SAFE_INTEGER, stats[key] + 1); }

    function beginVisit() {
        visit = { solo: { attempted: false, submitted: false }, pvp: { attempted: false, submitted: false } };
    }

    function submit(key, eventType) {
        if (!ids[key]) { count('configMissing'); trace('config_missing', key, eventType); return false; }
        if (!platform || typeof platform.reportUserBehaviorBranchAnalytics !== 'function') {
            count('unavailable');
            trace('api_unavailable', key, eventType);
            return false;
        }
        const attemptVisit = visit;
        const state = visit[key];
        let failed = false;
        function fail() {
            if (failed) return;
            failed = true;
            count('failed');
            trace('failed', key, eventType);
            if (eventType === 1 && visit === attemptVisit) state.submitted = false;
        }
        count('attempted');
        trace('attempt', key, eventType);
        try {
            const pending = platform.reportUserBehaviorBranchAnalytics({ branchId: ids[key], eventType: eventType });
            if (pending && typeof pending.then === 'function') pending.then(undefined, fail);
        } catch (e) { fail(); }
        if (failed) return false;
        // Native void return confirms submission only, not backend receipt.
        count('submitted');
        trace('submitted', key, eventType);
        if (eventType === 1) state.submitted = true;
        return true;
    }

    function expose(key) {
        if (!enabled || (key !== 'solo' && key !== 'pvp') || visit[key].attempted) return false;
        visit[key].attempted = true;
        return submit(key, 1);
    }

    function click(key) {
        if (!enabled || (key !== 'solo' && key !== 'pvp')) return false;
        if (!visit[key].submitted) { trace('click_no_exposure', key, 2); return false; }
        return submit(key, 2);
    }

    function inspectClick(key, flags) {
        if (!debug || (key !== 'solo' && key !== 'pvp')) return;
        const gates = {};
        for (const name of ['drawn','available','backgrounded','guide','stamina','ad','creating','press','busy','saveFailed','resume']) {
            gates[name] = flags && flags[name] === true;
        }
        trace('click_seen', key, 2, gates);
    }

    beginVisit();
    trace('ready');
    return {
        beginVisit: beginVisit, expose: expose, click: click, inspectClick: inspectClick,
        diagnostics: function () { return Object.assign({}, stats); }
    };
}

module.exports = { create: create };
