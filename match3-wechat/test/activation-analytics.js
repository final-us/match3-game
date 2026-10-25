'use strict';

const assert = require('assert');
const create = require('../js/platform/activation-analytics').create;
const level = { id: 3, openid: 'private' };
const keys = ['board_ready', 'first_match', 'guide_confirm', 'guide_skip'];

function fixture(options) {
    options = options || {};
    const scenes = [];
    const events = [];
    const local = [];
    const rejections = [];
    let environmentReads = 0;
    const platform = {
        getAccountInfoSync: function () {
            environmentReads++;
            if (options.environmentThrows) throw new Error('synthetic private environment failure');
            return { miniProgram: { envVersion: options.environment || 'develop' } };
        },
        reportScene: function (payload) {
            scenes.push(payload);
            if (options.sceneThrows) throw new Error('synthetic private scene failure');
            if (options.sceneRejects) return Promise.reject(new Error('synthetic scene rejection'));
        },
        reportEvent: function (name, payload) {
            events.push({ name: name, payload: payload });
            if (options.eventThrows) throw new Error('synthetic private event failure');
            if (options.eventPending) return new Promise(function (resolve, reject) { rejections.push(reject); });
        }
    };
    ['getStorageSync', 'setStorageSync', 'getStorage', 'setStorage'].forEach(function (key) {
        Object.defineProperty(platform, key, { get: function () { throw new Error('storage must never be touched'); } });
    });
    const adapter = create(platform, options.startup || { enabled: true, testOnly: true },
        options.milestone || { enabled: false, testOnly: true }, function (name, payload) {
            local.push({ name: name, payload: payload });
            if (options.localThrows) throw new Error('synthetic private tracking failure');
        });
    return { adapter: adapter, scenes: scenes, events: events, local: local,
        rejections: rejections, environmentReads: function () { return environmentReads; } };
}

function mapped(extra) {
    return Object.assign({ enabled: true, testOnly: true, eventIds: {
        board_ready: 'fixture_ready', first_match: 'fixture_match',
        guide_confirm: 'fixture_confirm', guide_skip: 'fixture_skip'
    } }, extra);
}

async function main() {
    const actual = require('../js/core/config');
    assert.deepStrictEqual(actual.STARTUP_ANALYTICS_CONFIG, {enabled:true,testOnly:false});
    assert.strictEqual(actual.REPORTING_CONFIG.enabled, false);
    assert.deepStrictEqual(actual.REPORTING_CONFIG.eventIds, {});
    assert.strictEqual(actual.MILESTONE_ANALYTICS_CONFIG.enabled, false);
    assert.strictEqual(actual.MILESTONE_ANALYTICS_CONFIG.testOnly, true);
    assert(keys.every(key => actual.MILESTONE_ANALYTICS_CONFIG.eventIds[key] === ''));
    for (const environment of ['release','unknown','develop','trial']) {
        const deployed = fixture({environment,startup:actual.STARTUP_ANALYTICS_CONFIG,milestone:actual.MILESTONE_ANALYTICS_CONFIG});
        deployed.adapter.interactive();
        deployed.adapter.interactive();
        const deployedRound = deployed.adapter.newRound(level);
        keys.forEach(key => deployed.adapter.mark(deployedRound, key));
        deployed.adapter.mark(deployed.adapter.newRound(level), 'guide_skip');
        assert.strictEqual(deployed.scenes.length, 1, 'actual startup config submits once per startup including release');
        assert.deepStrictEqual(Object.keys(deployed.scenes[0]).sort(), ['sceneId','success','fail'].sort());
        assert.strictEqual(deployed.scenes[0].sceneId, 7, 'only the system interactive marker is submitted');
        assert.strictEqual(deployed.environmentReads(), 0, 'production startup must not require test-environment detection');
        assert.strictEqual(deployed.events.length, 0, 'all milestone types remain local with actual config');
        assert.deepStrictEqual(deployed.local.map(event => event.name), [
            'solo_board_ready','solo_first_match','solo_guide_confirm','solo_guide_skip'
        ]);
    }
    let touched = 0;
    const untouched = new Proxy({}, { get: function () { touched++; throw new Error('disabled accessed platform'); } });
    const localOnly = [];
    const disabled = create(untouched, { enabled: false, testOnly: true }, { enabled: 'true', testOnly: true },
        function (name, payload) { localOnly.push({ name: name, payload: payload }); });
    disabled.interactive();
    const localRound = disabled.newRound(level);
    assert.strictEqual(disabled.mark(localRound, 'first_match'), false);
    assert.strictEqual(disabled.mark(localRound, 'board_ready'), true);
    assert.strictEqual(disabled.mark(localRound, 'board_ready'), false);
    assert.strictEqual(disabled.mark(localRound, 'first_match'), true);
    assert.strictEqual(disabled.mark(localRound, 'guide_confirm'), true);
    assert.strictEqual(disabled.mark(localRound, 'guide_skip'), false);
    assert.strictEqual(touched, 0, 'both remote paths off must not read environment or SDK');
    assert.deepStrictEqual(localOnly, [
        { name: 'solo_board_ready', payload: { mode: 'solo', level: 3, count: 1 } },
        { name: 'solo_first_match', payload: { mode: 'solo', level: 3, count: 1 } },
        { name: 'solo_guide_confirm', payload: { mode: 'solo', level: 3, count: 1 } }
    ]);

    for (const environment of ['develop', 'trial']) {
        const f = fixture({ environment: environment });
        assert.strictEqual(f.scenes.length, 0);
        f.adapter.interactive();
        f.adapter.interactive();
        assert.strictEqual(f.scenes.length, 1);
        assert.deepStrictEqual(Object.keys(f.scenes[0]).sort(), ['sceneId', 'success', 'fail'].sort());
        assert.strictEqual(f.scenes[0].sceneId, 7);
        assert.strictEqual(f.adapter.diagnostics().startupSucceeded, 0, 'void return is not callback success');
        f.scenes[0].success({ private: true });
        f.scenes[0].fail({ private: true });
        f.scenes[0].success({});
        assert.strictEqual(f.adapter.diagnostics().startupSucceeded, 1);
        assert.strictEqual(f.adapter.diagnostics().startupFailed, 0);
        assert.strictEqual(f.environmentReads(), 1);
    }
    for (const environment of ['release', 'unknown']) {
        const f = fixture({ environment: environment, milestone: mapped() });
        f.adapter.interactive();
        f.adapter.mark(f.adapter.newRound(level), 'board_ready');
        assert.strictEqual(f.scenes.length, 0);
        assert.strictEqual(f.events.length, 0);
        assert.strictEqual(f.local.length, 1);
        assert.strictEqual(f.adapter.diagnostics().startupEnvironmentBlocked, 1);
        assert.strictEqual(f.adapter.diagnostics().milestoneEnvironmentBlocked, 1);
        assert.strictEqual(f.environmentReads(), 1);
    }
    const unreadable = fixture({ environmentThrows: true });
    unreadable.adapter.interactive();
    assert.strictEqual(unreadable.scenes.length, 0);
    const absentEnvironment = create({}, { enabled: true, testOnly: true }, mapped(), function () {});
    absentEnvironment.interactive();
    assert.strictEqual(absentEnvironment.diagnostics().startupEnvironmentBlocked, 1);
    assert.strictEqual(absentEnvironment.diagnostics().milestoneEnvironmentBlocked, 1);

    const noApi = create({}, { enabled: true }, { enabled: false }, function () {});
    noApi.interactive();
    noApi.interactive();
    assert.strictEqual(noApi.diagnostics().startupUnavailable, 1);
    assert.strictEqual(noApi.diagnostics().startupAttempted, 0);
    for (const options of [{ sceneThrows: true }, { sceneRejects: true }]) {
        const f = fixture(options);
        f.adapter.interactive();
        f.adapter.interactive();
        await Promise.resolve();
        if (f.scenes[0]) f.scenes[0].success({});
        assert.strictEqual(f.scenes.length, 1);
        assert.strictEqual(f.adapter.diagnostics().startupFailed, 1);
        assert.strictEqual(f.adapter.diagnostics().startupSucceeded, 0);
    }
    const late = fixture();
    late.adapter.interactive();
    late.scenes[0].fail({ rawError: 'private' });
    late.scenes[0].success({});
    late.scenes[0].fail({});
    assert.strictEqual(late.adapter.diagnostics().startupFailed, 1);
    assert.strictEqual(late.adapter.diagnostics().startupSucceeded, 0);

    const remote = fixture({ startup: { enabled: false }, milestone: mapped() });
    const round = remote.adapter.newRound(level);
    assert.strictEqual(remote.events.length, 0);
    round.levelId = 'private';
    round.raw = 'private';
    keys.forEach(function (key) { remote.adapter.mark(round, key); remote.adapter.mark(round, key); });
    assert.deepStrictEqual(remote.events, [
        { name: 'fixture_ready', payload: { value: 1 } },
        { name: 'fixture_match', payload: { value: 1 } },
        { name: 'fixture_confirm', payload: { value: 1 } }
    ]);
    assert.strictEqual(JSON.stringify(remote.local).includes('private'), false);
    assert.strictEqual(remote.adapter.diagnostics().milestoneSubmitted, 3);
    const skipped = remote.adapter.newRound({ id: 4 });
    assert.strictEqual(remote.adapter.mark(skipped, 'guide_skip'), true);
    assert.strictEqual(remote.adapter.mark(skipped, 'guide_confirm'), false);
    assert.strictEqual(remote.events[3].name, 'fixture_skip');
    assert.strictEqual(remote.local[3].name, 'solo_guide_skip');

    const saved = remote.adapter.snapshot(round);
    assert.deepStrictEqual(saved, { version: 1, levelId: 3, boardReady: true, firstMatch: true, guideOutcome: 'confirm' });
    const restored = remote.adapter.restoreRound(level, JSON.parse(JSON.stringify(saved)));
    assert(restored);
    assert.strictEqual(remote.events.length, 4, 'restore never replays events');
    keys.forEach(function (key) { assert.strictEqual(remote.adapter.mark(restored, key), false); });
    saved.levelId = 999;
    saved.boardReady = false;
    assert.strictEqual(remote.adapter.snapshot(round).levelId, 3);
    assert.strictEqual(remote.adapter.snapshot(round).boardReady, true);
    [null, {}, { id: '3' }, { id: 0 }, { id: 1.5 }, { id: Infinity }].forEach(function (input) {
        assert.strictEqual(remote.adapter.newRound(input), null);
    });
    [null, {}, { version: 2 }, Object.assign({}, remote.adapter.snapshot(round), { levelId: 4 }),
        Object.assign({}, remote.adapter.snapshot(round), { boardReady: 1 }),
        Object.assign({}, remote.adapter.snapshot(round), { firstMatch: 'true' }),
        Object.assign({}, remote.adapter.snapshot(round), { boardReady: false }),
        Object.assign({}, remote.adapter.snapshot(round), { guideOutcome: 'other' })].forEach(function (input) {
        assert.strictEqual(remote.adapter.restoreRound(level, input), null);
    });
    for (const foreign of [null, {}, remote.adapter.snapshot(round), fixture().adapter.newRound(level)]) {
        assert.strictEqual(remote.adapter.mark(foreign, 'board_ready'), false);
        assert.strictEqual(remote.adapter.snapshot(foreign), null);
    }
    assert.strictEqual(remote.adapter.mark(round, '__proto__'), false);

    const partialSaved = { version: 1, levelId: 3, boardReady: true, firstMatch: false, guideOutcome: null };
    const partialRound = remote.adapter.restoreRound(level, partialSaved);
    assert.strictEqual(remote.adapter.mark(partialRound, 'board_ready'), false);
    assert.strictEqual(remote.adapter.mark(partialRound, 'first_match'), true);

    const blank = fixture({ milestone: mapped({ eventIds: { board_ready: ' ', first_match: 1 } }) });
    const blankRound = blank.adapter.newRound(level);
    blank.adapter.mark(blankRound, 'board_ready');
    blank.adapter.mark(blankRound, 'first_match');
    assert.strictEqual(blank.local.length, 2);
    assert.strictEqual(blank.events.length, 0);
    assert.strictEqual(blank.adapter.diagnostics().milestoneConfigMissing, 2);
    const duplicate = fixture({ milestone: mapped({ eventIds: {
        board_ready: ' shared ', first_match: 'shared', guide_skip: 'x'.repeat(129), guide_confirm: ' fixture_confirm '
    } }) });
    const duplicateRound = duplicate.adapter.newRound(level);
    keys.forEach(function (key) { duplicate.adapter.mark(duplicateRound, key); });
    assert.deepStrictEqual(duplicate.events, [{ name: 'fixture_confirm', payload: { value: 1 } }]);

    for (const options of [{ localThrows: true }, { eventThrows: true }, { eventPending: true }]) {
        const f = fixture(Object.assign({ milestone: mapped() }, options));
        const failedRound = f.adapter.newRound(level);
        assert.strictEqual(f.adapter.mark(failedRound, 'board_ready'), true);
        assert.strictEqual(f.adapter.mark(failedRound, 'board_ready'), false);
        if (options.eventPending) {
            f.rejections[0](new Error('synthetic private rejection'));
            await Promise.resolve();
        }
        assert.strictEqual(f.adapter.snapshot(failedRound).boardReady, true);
        assert.strictEqual(f.local.length, 1);
        assert.strictEqual(f.events.length, 1);
        assert.strictEqual(f.adapter.diagnostics().localFailed, options.localThrows ? 1 : 0);
        assert.strictEqual(f.adapter.diagnostics().milestoneFailed, options.localThrows ? 0 : 1);
        assert.strictEqual(JSON.stringify(f.adapter.diagnostics()).includes('private'), false);
    }
    const independent = fixture({ environment: 'release', milestone: mapped({ testOnly: false }) });
    independent.adapter.interactive();
    independent.adapter.mark(independent.adapter.newRound(level), 'board_ready');
    assert.strictEqual(independent.scenes.length, 0);
    assert.strictEqual(independent.events.length, 1, 'startup eligibility must not block configured milestone scope');
    console.log('activation analytics adapter tests passed');
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
