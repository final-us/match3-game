'use strict';

const KEYS = ['board_ready', 'first_match', 'guide_confirm', 'guide_skip'];
const LOCAL_NAMES = ['solo_board_ready', 'solo_first_match', 'solo_guide_confirm', 'solo_guide_skip'];

function validLevel(level) {
    return level && Number.isSafeInteger(level.id) && level.id > 0;
}

function eventId(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : '';
}

function create(platform, startupConfig, milestoneConfig, track) {
    const stats = {
        startupAttempted: 0, startupSucceeded: 0, startupFailed: 0,
        startupUnavailable: 0, startupEnvironmentBlocked: 0,
        milestoneAttempted: 0, milestoneSubmitted: 0, milestoneFailed: 0,
        milestoneUnavailable: 0, milestoneEnvironmentBlocked: 0,
        milestoneConfigMissing: 0, localFailed: 0
    };
    const rounds = new WeakMap();
    let interactiveAttempted = false;
    let environmentRead = false;
    let environment;

    function count(key) { stats[key] = Math.min(Number.MAX_SAFE_INTEGER, stats[key] + 1); }

    function eligible(config, blockedKey) {
        if (!config || config.enabled !== true) return false;
        if (config.testOnly !== true) return true;
        if (!environmentRead) {
            environmentRead = true;
            try { environment = platform.getAccountInfoSync().miniProgram.envVersion; } catch (e) { /* Fail closed. */ }
        }
        if (environment === 'develop' || environment === 'trial') return true;
        count(blockedKey);
        return false;
    }

    const startupEnabled = eligible(startupConfig, 'startupEnvironmentBlocked');
    const milestoneEnabled = eligible(milestoneConfig, 'milestoneEnvironmentBlocked');
    const supplied = milestoneConfig && milestoneConfig.eventIds;
    const ids = KEYS.map(function (key) { return eventId(supplied && supplied[key]); });
    const uniqueIds = ids.map(function (id) {
        return id && ids.indexOf(id) === ids.lastIndexOf(id) ? id : '';
    });

    function interactive() {
        if (!startupEnabled || interactiveAttempted) return;
        interactiveAttempted = true;
        if (!platform || typeof platform.reportScene !== 'function') {
            count('startupUnavailable');
            return;
        }
        let settled = false;
        function fail() {
            if (settled) return;
            settled = true;
            count('startupFailed');
        }
        count('startupAttempted');
        try {
            const pending = platform.reportScene({
                sceneId: 7,
                success: function () {
                    if (settled) return;
                    settled = true;
                    count('startupSucceeded');
                },
                fail: fail
            });
            if (pending && typeof pending.then === 'function') pending.then(undefined, fail);
        } catch (e) { fail(); }
    }

    function newRound(level) {
        if (!validLevel(level)) return null;
        const round = { levelId: level.id };
        rounds.set(round, { levelId: level.id, boardReady: false, firstMatch: false, guideOutcome: null });
        return round;
    }

    function restoreRound(level, saved) {
        if (!validLevel(level) || !saved || saved.version !== 1 || saved.levelId !== level.id ||
            typeof saved.boardReady !== 'boolean' || typeof saved.firstMatch !== 'boolean' ||
            (saved.firstMatch && !saved.boardReady) ||
            (saved.guideOutcome !== null && saved.guideOutcome !== 'confirm' && saved.guideOutcome !== 'skip')) return null;
        const round = newRound(level);
        const state = rounds.get(round);
        state.boardReady = saved.boardReady;
        state.firstMatch = saved.firstMatch;
        state.guideOutcome = saved.guideOutcome;
        return round;
    }

    function reportMilestone(index) {
        if (!milestoneEnabled) return;
        if (!uniqueIds[index]) { count('milestoneConfigMissing'); return; }
        if (!platform || typeof platform.reportEvent !== 'function') {
            count('milestoneUnavailable');
            return;
        }
        let failed = false;
        function fail() {
            if (failed) return;
            failed = true;
            count('milestoneFailed');
        }
        count('milestoneAttempted');
        try {
            const pending = platform.reportEvent(uniqueIds[index], { value: 1 });
            if (pending && typeof pending.then === 'function') pending.then(undefined, fail);
            if (!failed) count('milestoneSubmitted');
        } catch (e) { fail(); }
    }

    function mark(round, key) {
        const index = KEYS.indexOf(key);
        const state = round && rounds.get(round);
        if (!state || index < 0) return false;
        if (key === 'board_ready') {
            if (state.boardReady) return false;
            state.boardReady = true;
        } else if (key === 'first_match') {
            if (!state.boardReady || state.firstMatch) return false;
            state.firstMatch = true;
        } else {
            if (state.guideOutcome !== null) return false;
            state.guideOutcome = key === 'guide_confirm' ? 'confirm' : 'skip';
        }
        try {
            track(LOCAL_NAMES[index], { mode: 'solo', level: state.levelId, count: 1 });
        } catch (e) { count('localFailed'); }
        reportMilestone(index);
        return true;
    }

    function snapshot(round) {
        const state = round && rounds.get(round);
        if (!state) return null;
        return {
            version: 1, levelId: state.levelId, boardReady: state.boardReady,
            firstMatch: state.firstMatch, guideOutcome: state.guideOutcome
        };
    }

    return {
        interactive: interactive, newRound: newRound, restoreRound: restoreRound,
        mark: mark, snapshot: snapshot,
        diagnostics: function () { return Object.assign({}, stats); }
    };
}

module.exports = { create: create };
