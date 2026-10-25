'use strict';

const assert = require('assert');
const create = require('../js/platform/level-analytics').create;
const level = { id: 3, name: '第三关' };

function withoutTrace(work) {
    const originalLog = console.log;
    try { console.log = function () {}; return work(); }
    finally { console.log = originalLog; }
}

function fixture(options) {
    options = options || {};
    let clock = 0;
    const storage = {};
    const calls = [];
    const init = [];
    const platform = {
        getStorageSync: function (key) {
            if (options.readThrows) throw new Error('private read details');
            return storage[key];
        },
        setStorageSync: function (key, value) {
            storage[key] = value;
            if (options.writeThrows) throw new Error('private write details');
        },
        getAccountInfoSync: function () {
            if (options.accountThrows) throw new Error('private account details');
            return { miniProgram: { version: options.version || '1.2.3', envVersion: options.environment } };
        },
        getMiniReportManager: function (settings) {
            init.push(settings);
            if (options.initThrows) throw new Error('private init details');
            return { report: function (payload) {
                calls.push(payload);
                if (options.reportThrows) throw new Error('private SDK details');
                if (options.rejects) return Promise.reject(new Error('private rejected details'));
                if (options.fails) payload.fail({ errMsg: 'private callback details' });
                else if (!options.pending) payload.success({});
            } };
        }
    };
    const adapter = create(platform, options.settings || { enabled: true }, function () { return clock; });
    return { adapter: adapter, platform: platform, calls: calls, init: init, storage: storage,
        options: options, advance: function (ms) { clock += ms; } };
}

async function main() {
    let touched = 0;
    const untouchable = new Proxy({}, { get: function () { touched++; throw new Error('disabled touched API'); } });
    const disabled = create(untouchable, { enabled: false, debug: true, debugInTest: true });
    assert.strictEqual(disabled.start(level), null);
    assert.strictEqual(disabled.restore(level, {}), null);
    disabled.result({}, true);
    disabled.close({}, 6);
    assert.strictEqual(disabled.snapshot({}), null);
    assert.strictEqual(touched, 0);
    assert.strictEqual(create(untouchable, {}).start(level), null);

    for (const environment of ['release', undefined, 'unknown']) {
        const blocked = fixture({ environment, settings: { enabled: true, testOnly: true, debug: true } });
        assert.strictEqual(blocked.adapter.start(level), null);
        assert.deepStrictEqual(blocked.init, []);
        assert.deepStrictEqual(blocked.storage, {});
        assert.strictEqual(blocked.adapter.diagnostics().environmentBlocked, 1);
    }
    const unknown = fixture({ accountThrows: true, settings: { enabled: true, testOnly: true } });
    assert.strictEqual(unknown.adapter.start(level), null);
    assert.deepStrictEqual(unknown.storage, {});
    for (const environment of ['develop', 'trial']) {
        const testBuild = withoutTrace(function () {
            const build = fixture({ environment, settings: { enabled: true, testOnly: true, debug: true } });
            assert(build.adapter.start(level));
            return build;
        });
        assert.strictEqual(testBuild.calls.length, 1);
        assert.deepStrictEqual(testBuild.init, [{debug:true,eventList:['10000003']}]);
    }
    const deployedSettings = require('../js/core/config').LEVEL_ANALYTICS_CONFIG;
    assert.strictEqual(deployedSettings.enabled, true);
    assert.strictEqual(deployedSettings.testOnly, false);
    assert.strictEqual(deployedSettings.debug, false);
    assert.strictEqual(deployedSettings.debugInTest, true);
    const releaseBuild = fixture({ environment: 'release', settings: deployedSettings });
    const releaseRun = releaseBuild.adapter.start(level);
    assert(releaseRun, 'actual release config must permit ordinary level tracking');
    releaseBuild.adapter.setRunning(releaseRun, true);
    releaseBuild.advance(2500);
    releaseBuild.adapter.result(releaseRun, true);
    releaseBuild.adapter.close(releaseRun, 6);
    releaseBuild.adapter.start(level);
    assert.deepStrictEqual(releaseBuild.init, [{debug:false,eventList:['10000003']}]);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(releaseBuild.calls)), [
        {eventID:'10000003',levelID:3,levelName:'第三关',levelAction:1,levelResult:5,loginCount:1,gameVersion:1002003},
        {eventID:'10000003',levelID:3,levelName:'第三关',levelAction:1,levelResult:1,levelProgress:100,levelTime:2,gameVersion:1002003},
        {eventID:'10000003',levelID:3,levelName:'第三关',levelAction:1,levelResult:5,loginCount:2,gameVersion:1002003}
    ], 'actual release settings retain native schema, timer/count scopes and success-navigation suppression');

    const f = fixture();
    assert.strictEqual(f.init.length, 0, 'manager must initialize lazily');
    const run = f.adapter.start(Object.assign({ openid: 'secret' }, level));
    assert.deepStrictEqual(f.init, [{ debug: false, eventList: ['10000003'] }]);
    const enter = f.calls[0];
    assert.strictEqual(enter.eventID, '10000003');
    assert.strictEqual(enter.levelID, 3);
    assert.strictEqual(enter.levelName, '第三关');
    assert.strictEqual(enter.levelAction, 1);
    assert.strictEqual(enter.levelResult, 5);
    assert.strictEqual(enter.loginCount, 1);
    assert.strictEqual(enter.gameVersion, 1002003);
    assert.strictEqual(enter.levelTime, undefined);

    f.adapter.setRunning(run, true);
    f.advance(10000);
    f.adapter.setRunning(run, false); // Background.
    f.advance(30000);
    f.adapter.setRunning(run, true);
    f.adapter.setRunning(run, false); // Rewarded ad.
    f.advance(20000);
    f.adapter.setRunning(run, true);
    f.advance(5000);
    run.openid = 'secret';
    run.levelId = { secret: true };
    run.levelName = 'secret';
    f.adapter.result(run, true, 4);
    f.advance(50000); // Result-screen wait.
    f.adapter.result(run, false, 10);
    f.adapter.close(run, 6);
    f.adapter.close(run, 3);
    assert.strictEqual(f.calls.length, 2);
    const success = f.calls[1];
    assert.strictEqual(success.levelTime, 15);
    assert.strictEqual(success.levelProgress, 100);
    assert.strictEqual(success.loginCount, undefined);
    assert.strictEqual(success.levelID, 3);
    assert.strictEqual(success.levelName, '第三关');
    assert.strictEqual(JSON.stringify(f.calls).includes('secret'), false);
    assert.deepStrictEqual(Object.keys(success).sort(), [
        'eventID', 'levelID', 'levelName', 'levelAction', 'levelResult', 'levelTime',
        'levelProgress', 'gameVersion', 'success', 'fail'
    ].sort());
    assert.strictEqual(f.adapter.diagnostics().succeeded, 2);

    const g = fixture();
    const failed = g.adapter.start(level);
    g.adapter.event(failed, 7, 12);
    g.adapter.event(failed, 9, 12);
    g.adapter.setRunning(failed, true);
    g.advance(3000);
    g.adapter.result(failed, false, 25);
    g.adapter.result(failed, false, 25);
    g.adapter.event(failed, 7, 25);
    g.adapter.event(failed, 8, 25);
    g.adapter.revive(failed, 1, 25);
    g.adapter.revive(failed, 1, 25);
    g.adapter.setRunning(failed, true);
    g.advance(2000);
    g.adapter.result(failed, true);
    g.adapter.revive(failed, 2);
    g.adapter.event(failed, 8);
    assert.deepStrictEqual(g.calls.map(function (c) { return c.levelResult; }), [5, 7, 2, 8, 4, 1]);
    assert.strictEqual(g.calls[2].levelTime, undefined);
    assert.strictEqual(g.calls[5].levelTime, 5);
    assert.strictEqual(g.init.length, 1);
    assert.strictEqual(g.adapter.start(level).lastResult, null);
    assert.strictEqual(g.calls[6].loginCount, 2);
    g.adapter.start({ id: 4, name: '第四关' });
    assert.strictEqual(g.calls[7].loginCount, 1);

    const h = fixture();
    const savedRun = h.adapter.start(level);
    h.adapter.setRunning(savedRun, true);
    h.advance(7500);
    const saved = h.adapter.snapshot(savedRun);
    assert.deepStrictEqual(Object.keys(saved).sort(), [
        'version', 'levelId', 'cycle', 'resultCycle', 'lastResult', 'closed', 'activeMs', 'timeKnown'
    ].sort());
    assert.strictEqual(saved.activeMs, 7500);
    assert.strictEqual(JSON.stringify(saved).includes('lastAt'), false);
    const cold = fixture();
    const restored = cold.adapter.restore(level, JSON.parse(JSON.stringify(saved)));
    assert.strictEqual(cold.calls.length, 0);
    assert.strictEqual(cold.init.length, 0);
    assert.strictEqual(Object.keys(cold.storage).length, 0);
    assert.strictEqual(restored.running, false);
    assert.strictEqual(restored.lastAt, null);
    assert.strictEqual(restored.timeKnown, false);
    cold.adapter.setRunning(restored, true);
    cold.advance(2000);
    cold.adapter.result(restored, true);
    assert.strictEqual(cold.calls[0].levelTime, undefined);
    assert.strictEqual(cold.calls[0].loginCount, undefined);
    assert.strictEqual(cold.adapter.restore(level, null), null);
    assert.strictEqual(cold.adapter.restore({ id: 4, name: '四' }, saved), null);
    assert.strictEqual(cold.adapter.restore(level, Object.assign({}, saved, { activeMs: -1 })), null);
    assert.strictEqual(cold.adapter.restore(level, Object.assign({}, saved, { lastResult: 2 })), null);
    assert.strictEqual(cold.adapter.restore(level, Object.assign({}, saved, { version: 2 })), null);

    const counter = fixture({ writeThrows: true });
    counter.adapter.start(level);
    assert.strictEqual(counter.calls[0].loginCount, undefined, 'throw after storage write must omit count');
    counter.options.writeThrows = false;
    counter.adapter.start(level);
    assert.strictEqual(counter.calls[1].loginCount, 2, 'must read persisted count, not invent a reset');
    counter.options.readThrows = true;
    counter.adapter.start(level);
    assert.strictEqual(counter.calls[2].loginCount, undefined);
    counter.options.readThrows = false;
    counter.storage[Object.keys(counter.storage)[0]] = 'corrupt';
    counter.adapter.start(level);
    assert.strictEqual(counter.calls[3].loginCount, undefined);

    const bad = fixture({ version: 'release-3', settings: { enabled: true, debug: 'true', gameVersion: '3' } });
    [null, {}, { id: '3', name: '三' }, { id: 0, name: '零' }, { id: 1, name: '' },
        { id: 1, name: 'x'.repeat(129) }].forEach(function (input) { assert.strictEqual(bad.adapter.start(input), null); });
    assert.strictEqual(bad.init.length, 0);
    const badRun = bad.adapter.start(level);
    bad.adapter.event(badRun, 7, NaN);
    bad.adapter.event(badRun, 7, 101);
    bad.adapter.event(badRun, '7', 50);
    bad.adapter.result(badRun, 'true', 50);
    assert.strictEqual(bad.calls.length, 3);
    assert.strictEqual(bad.calls[0].gameVersion, undefined);
    assert.strictEqual(bad.init[0].debug, false);
    assert.strictEqual(bad.calls[1].levelProgress, undefined);
    assert.strictEqual(bad.calls[2].levelProgress, undefined);
    bad.adapter.close(badRun, 3, 50);
    bad.adapter.close(badRun, 6);
    bad.adapter.event(badRun, 7);
    assert.strictEqual(bad.calls.length, 4);
    const nullClose = bad.adapter.start(level);
    bad.adapter.close(nullClose, null);
    assert.strictEqual(nullClose.closed, true);
    assert.strictEqual(bad.calls.length, 5);
    const exit = bad.adapter.start(level);
    bad.adapter.result(exit, false);
    bad.adapter.close(exit, 6);
    assert.strictEqual(bad.calls[7].levelResult, 6);

    const explicit = withoutTrace(function () {
        const build = fixture({ environment: 'develop', settings: { enabled: true, debug: true, gameVersion: 42 } });
        build.adapter.start(level);
        return build;
    });
    assert.strictEqual(explicit.calls[0].gameVersion, 42);
    assert.strictEqual(explicit.init[0].debug, true);
    const absent = create({}, { enabled: true });
    assert(absent.start(level));
    assert.strictEqual(absent.diagnostics().unavailable, 1);
    const initFailure = fixture({ initThrows: true });
    initFailure.adapter.start(level);
    initFailure.adapter.start(level);
    assert.strictEqual(initFailure.init.length, 1, 'no SDK initialization retries');
    assert.strictEqual(initFailure.adapter.diagnostics().initFailed, 1);
    for (const failure of [{ fails: true }, { reportThrows: true }, { rejects: true }]) {
        const broken = fixture(failure);
        const brokenRun = broken.adapter.start(level);
        broken.adapter.result(brokenRun, true);
        await Promise.resolve();
        const diag = broken.adapter.diagnostics();
        assert.strictEqual(diag.attempted, 2);
        assert.strictEqual(diag.failed, 2);
        assert.strictEqual(diag.succeeded, 0);
        assert.strictEqual(JSON.stringify(diag).includes('private'), false);
    }
    const pending = fixture({ pending: true });
    pending.adapter.start(level);
    assert.strictEqual(pending.adapter.diagnostics().succeeded, 0, 'SDK return is not callback success');
    pending.calls[0].fail({});
    pending.calls[0].success({});
    assert.strictEqual(pending.adapter.diagnostics().failed, 1);
    assert.strictEqual(pending.adapter.diagnostics().succeeded, 0);

    const originalLog = console.log;
    const logs = [];
    try {
        console.log = function (line) {
            assert.strictEqual(line.startsWith('[level-analytics] '), true);
            logs.push(JSON.parse(line.slice('[level-analytics] '.length)));
        };
        for (const environment of ['develop', 'trial']) {
            const from = logs.length;
            const testConfig = fixture({ environment, settings: deployedSettings, pending: true });
            assert.strictEqual(logs[from].stage, 'ready');
            testConfig.adapter.start(level);
            assert.deepStrictEqual(testConfig.init, [{debug:true,eventList:['10000003']}]);
            assert.deepStrictEqual(logs.slice(from).map(item => item.stage), ['ready','attempt']);
            assert.strictEqual(testConfig.adapter.diagnostics().succeeded, 0, 'normal return cannot claim SDK success');
            testConfig.calls[0].success({openid:'private response',errCode:123});
            testConfig.calls[0].success({});
            testConfig.calls[0].fail({errCode:99});
            assert.strictEqual(testConfig.adapter.diagnostics().succeeded, 1);
            assert.deepStrictEqual(logs.slice(from).map(item => item.stage), ['ready','attempt','sdk_success']);
            assert.strictEqual(logs[logs.length - 1].levelID, level.id);
            assert.strictEqual(logs[logs.length - 1].levelResult, 5);
        }
        const beforeSilent = logs.length;
        for (const options of [
            {environment:'release'}, {environment:'unknown'}, {}, {accountThrows:true}
        ]) {
            // Even the legacy explicit debug flag cannot turn on release/unknown SDK debugging.
            for (const settings of [deployedSettings, Object.assign({}, deployedSettings, {debug:true})]) {
                const silent = fixture(Object.assign({}, options, {settings}));
                assert(silent.adapter.start(level), 'environment lookup failure must not disable formal reporting');
                assert.deepStrictEqual(silent.init, [{debug:false,eventList:['10000003']}]);
                assert.strictEqual(silent.calls.length, 1);
            }
        }
        const strict = fixture({environment:'develop',settings:{enabled:true,debug:'true',debugInTest:'true'}});
        strict.adapter.start(level);
        assert.deepStrictEqual(strict.init, [{debug:false,eventList:['10000003']}]);
        assert.strictEqual(logs.length, beforeSilent, 'release, unknown, failed lookup and nonboolean flags must be silent');

        for (const errCode of [-42, '42', Number.MAX_SAFE_INTEGER + 1]) {
            const from = logs.length;
            const failing = fixture({environment:'trial',settings:deployedSettings,pending:true});
            failing.adapter.start(Object.assign({openid:'private level'}, level));
            failing.calls[0].fail({errCode,errMsg:'private callback',response:{openid:'private response'}});
            failing.calls[0].fail({errCode:1});
            failing.calls[0].success({});
            assert.strictEqual(failing.adapter.diagnostics().failed, 1);
            assert.strictEqual(failing.adapter.diagnostics().succeeded, 0);
            const failures = logs.slice(from).filter(item => item.stage === 'sdk_failed');
            assert.strictEqual(failures.length, 1);
            assert.strictEqual(failures[0].errCode, errCode === -42 ? -42 : undefined);
        }
        for (const failure of [{reportThrows:true}, {rejects:true}]) {
            const from = logs.length;
            const broken = fixture(Object.assign({environment:'develop',settings:deployedSettings}, failure));
            broken.adapter.start(level);
            await Promise.resolve();
            broken.calls[0].success({});
            broken.calls[0].fail({});
            assert.strictEqual(broken.adapter.diagnostics().failed, 1);
            assert.strictEqual(broken.adapter.diagnostics().succeeded, 0);
            assert.deepStrictEqual(logs.slice(from).map(item => item.stage), ['ready','attempt','sdk_failed']);
        }
        const beforeUnavailable = logs.length;
        const unavailable = fixture({environment:'develop',settings:deployedSettings});
        delete unavailable.platform.getMiniReportManager;
        unavailable.adapter.start(level); unavailable.adapter.start(level);
        assert.deepStrictEqual(logs.slice(beforeUnavailable).map(item => item.stage), ['ready','api_unavailable']);
        const beforeInitFailure = logs.length;
        const brokenInit = fixture({environment:'trial',settings:deployedSettings,initThrows:true});
        brokenInit.adapter.start(level); brokenInit.adapter.start(level);
        assert.deepStrictEqual(logs.slice(beforeInitFailure).map(item => item.stage), ['ready','init_failed']);

        assert(logs.every(item => Object.keys(item).every(key =>
            ['stage','eventID','environment','debug','levelID','levelResult','errCode'].includes(key))));
        assert(logs.every(item => item.eventID === '10000003' && item.debug === true &&
            ['develop','trial'].includes(item.environment)));
        assert.strictEqual(JSON.stringify(logs).includes('private'), false);
        assert.strictEqual(JSON.stringify(logs).includes('第三关'), false);
        console.log = function () { throw Error('private console failure'); };
        const noConsole = fixture({environment:'trial',settings:deployedSettings});
        const noConsoleRun = noConsole.adapter.start(level);
        noConsole.adapter.result(noConsoleRun, true);
        assert.strictEqual(noConsole.calls.length, 2);
        assert.strictEqual(noConsole.adapter.diagnostics().succeeded, 2);
        assert.strictEqual(noConsole.adapter.diagnostics().failed, 0);
        noConsole.options.reportThrows = true;
        assert(noConsole.adapter.start(level));
        assert.strictEqual(noConsole.adapter.diagnostics().attempted, 3);
        assert.strictEqual(noConsole.adapter.diagnostics().failed, 1, 'logging failure cannot swallow SDK failure accounting');
    } finally { console.log = originalLog; }
    console.log('level analytics adapter tests passed');
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
