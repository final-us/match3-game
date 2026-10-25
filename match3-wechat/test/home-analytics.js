'use strict';

const assert = require('assert');
const create = require('../js/platform/home-analytics').create;

function fixture(options) {
    options = options || {};
    const calls = [];
    const rejections = [];
    let reads = 0;
    const platform = {
        getAccountInfoSync: function () {
            reads++;
            if (options.environmentThrows) throw new Error('synthetic private error');
            return { miniProgram: { envVersion: options.environment } };
        },
        reportUserBehaviorBranchAnalytics: function (payload) {
            calls.push(payload);
            if (options.throws) throw new Error('synthetic private error');
            if (options.pending) return new Promise(function (resolve, reject) { rejections.push(reject); });
        }
    };
    ['getStorageSync', 'setStorageSync', 'getStorage', 'setStorage'].forEach(function (key) {
        Object.defineProperty(platform, key, { get: function () { throw new Error('storage must never be accessed'); } });
    });
    const settings = options.settings || {
        enabled: true, testOnly: true, branches: { solo: 'fixture solo', pvp: 'fixture pvp' }
    };
    return {
        adapter: create(platform, settings), calls: calls, rejections: rejections,
        reads: function () { return reads; }, options: options
    };
}

async function main() {
    let touched = 0;
    const untouched = new Proxy({}, { get: function () { touched++; throw new Error('disabled touched platform'); } });
    [undefined, {}, { enabled: false }, { enabled: 'true', testOnly: true }].forEach(function (settings) {
        const disabled = create(untouched, settings);
        disabled.beginVisit();
        assert.strictEqual(disabled.expose('solo'), false);
        assert.strictEqual(disabled.click('solo'), false);
        assert.strictEqual(disabled.diagnostics().attempted, 0);
    });
    assert.strictEqual(touched, 0);

    const configured = require('../js/core/config').HOME_ANALYTICS_CONFIG;
    assert.strictEqual(configured.enabled, true);
    assert.strictEqual(configured.testOnly, false);
    assert.strictEqual(configured.debug, false);
    assert.deepStrictEqual(configured.branches, {solo:'BCBgAAoXHx5d0hJfR8jiP3',pvp:'BCBgAAoXHx5d0hJfR8jiP0'});
    const productionLog = console.log;
    const productionTrace = [];
    try {
        console.log = function (line) { productionTrace.push(line); };
        for (const environment of ['release', undefined, 'develop', 'trial']) {
            const configuredFixture = fixture({environment,settings:configured});
            configuredFixture.adapter.expose('solo'); configuredFixture.adapter.expose('pvp');
            configuredFixture.adapter.click('solo'); configuredFixture.adapter.click('pvp');
            configuredFixture.adapter.inspectClick('solo', {drawn:true,available:true});
            assert.deepStrictEqual(configuredFixture.calls, [
                {branchId:'BCBgAAoXHx5d0hJfR8jiP3',eventType:1},
                {branchId:'BCBgAAoXHx5d0hJfR8jiP0',eventType:1},
                {branchId:'BCBgAAoXHx5d0hJfR8jiP3',eventType:2},
                {branchId:'BCBgAAoXHx5d0hJfR8jiP0',eventType:2}
            ]);
            assert.strictEqual(configuredFixture.reads(), 0, 'production reporting must not depend on test-environment detection');
        }
        assert.deepStrictEqual(productionTrace, [], 'actual config must emit no local trace in any build environment');
    } finally { console.log = productionLog; }

    for (const environment of ['release', undefined, '', 'unknown']) {
        const blocked = fixture({ environment: environment });
        blocked.adapter.expose('solo');
        blocked.adapter.click('solo');
        blocked.adapter.beginVisit();
        blocked.adapter.expose('pvp');
        assert.strictEqual(blocked.calls.length, 0);
        assert.strictEqual(blocked.reads(), 1);
        assert.strictEqual(blocked.adapter.diagnostics().environmentBlocked, 1);
    }
    const unreadable = fixture({ environmentThrows: true });
    unreadable.adapter.expose('solo');
    assert.strictEqual(unreadable.calls.length, 0);
    assert.strictEqual(unreadable.adapter.diagnostics().environmentBlocked, 1);

    for (const environment of ['develop', 'trial']) {
        const f = fixture({ environment: environment });
        assert.strictEqual(f.adapter.click('solo'), false, 'click cannot fabricate exposure');
        assert.strictEqual(f.adapter.expose('solo'), true);
        for (let render = 0; render < 50; render++) assert.strictEqual(f.adapter.expose('solo'), false);
        assert.strictEqual(f.adapter.click('solo'), true);
        assert.strictEqual(f.adapter.click('solo'), true, 'legitimate repeated clicks remain reportable');
        assert.strictEqual(f.adapter.click('pvp'), false);
        assert.strictEqual(f.adapter.expose('pvp'), true);
        assert.strictEqual(f.adapter.click('pvp'), true);
        assert.deepStrictEqual(f.calls, [
            { branchId: 'fixture solo', eventType: 1 },
            { branchId: 'fixture solo', eventType: 2 },
            { branchId: 'fixture solo', eventType: 2 },
            { branchId: 'fixture pvp', eventType: 1 },
            { branchId: 'fixture pvp', eventType: 2 }
        ]);
        f.adapter.beginVisit();
        assert.strictEqual(f.adapter.click('solo'), false);
        assert.strictEqual(f.adapter.click('pvp'), false);
        assert.strictEqual(f.adapter.expose('solo'), true);
        assert.strictEqual(f.adapter.expose('pvp'), true);
        assert.strictEqual(f.adapter.diagnostics().submitted, 7);
        const diagnostics = f.adapter.diagnostics();
        diagnostics.submitted = 999;
        assert.strictEqual(f.adapter.diagnostics().submitted, 7);
        assert.strictEqual('succeeded' in diagnostics, false);
    }

    const invalidBranches = [undefined, {}, { solo: '', pvp: ' ' }, { solo: 123, pvp: {} },
        { solo: 'x'.repeat(129), pvp: '' }, { solo: 'same', pvp: ' same ' }];
    invalidBranches.forEach(function (branches) {
        const empty = fixture({ settings: { enabled: true, branches: branches } });
        empty.adapter.expose('solo');
        empty.adapter.expose('solo');
        empty.adapter.expose('pvp');
        empty.adapter.click('solo');
        assert.strictEqual(empty.calls.length, 0);
        assert.strictEqual(empty.adapter.diagnostics().configMissing, 2);
    });
    const partial = fixture({ settings: { enabled: true, branches: { solo: '  fixture / id  ', pvp: '' }, openid: 'private' } });
    partial.adapter.expose('solo', { openid: 'private' });
    partial.adapter.click('solo', { branchDim: 'private' });
    partial.adapter.expose('pvp');
    [null, undefined, 'other', '__proto__', {}, 1].forEach(function (key) {
        assert.strictEqual(partial.adapter.expose(key), false);
        assert.strictEqual(partial.adapter.click(key), false);
    });
    assert.deepStrictEqual(partial.calls, [
        { branchId: 'fixture / id', eventType: 1 }, { branchId: 'fixture / id', eventType: 2 }
    ]);
    assert.strictEqual(JSON.stringify(partial.calls).includes('private'), false);
    assert.strictEqual(partial.reads(), 0, 'environment read only required when testOnly true');

    const absent = create({}, { enabled: true, branches: { solo: 'fixture solo' } });
    assert.strictEqual(absent.expose('solo'), false);
    absent.expose('solo');
    assert.strictEqual(absent.click('solo'), false);
    assert.strictEqual(absent.diagnostics().unavailable, 1);
    assert.strictEqual(absent.diagnostics().attempted, 0);

    const throwing = fixture({ environment: 'develop', throws: true });
    for (let render = 0; render < 50; render++) throwing.adapter.expose('solo');
    assert.strictEqual(throwing.adapter.click('solo'), false);
    assert.strictEqual(throwing.calls.length, 1);
    assert.strictEqual(throwing.adapter.diagnostics().failed, 1);
    assert.strictEqual(throwing.adapter.diagnostics().submitted, 0);
    throwing.adapter.beginVisit();
    throwing.adapter.expose('solo');
    assert.strictEqual(throwing.calls.length, 2);

    const clickThrow = fixture({ environment: 'develop' });
    assert.strictEqual(clickThrow.adapter.expose('solo'), true);
    clickThrow.options.throws = true;
    assert.strictEqual(clickThrow.adapter.click('solo'), false);
    await Promise.resolve();
    assert.strictEqual(clickThrow.calls.length, 2, 'failed click must not retry automatically');
    clickThrow.options.throws = false;
    assert.strictEqual(clickThrow.adapter.click('solo'), true, 'click throw must preserve submitted exposure');
    assert.strictEqual(clickThrow.calls.length, 3);
    assert.strictEqual(clickThrow.adapter.diagnostics().failed, 1);

    const pending = fixture({ environment: 'trial', pending: true });
    assert.strictEqual(pending.adapter.expose('solo'), true);
    pending.rejections[0](new Error('synthetic private failure'));
    await Promise.resolve();
    assert.strictEqual(pending.adapter.click('solo'), false);
    assert.strictEqual(pending.adapter.expose('solo'), false, 'rejected exposure does not retry this visit');
    assert.strictEqual(pending.adapter.diagnostics().failed, 1);
    assert.strictEqual(pending.adapter.diagnostics().submitted, 1, 'submission does not claim backend success');

    pending.adapter.beginVisit();
    pending.adapter.expose('solo');
    pending.adapter.beginVisit();
    pending.adapter.expose('solo');
    pending.rejections[1](new Error('synthetic stale rejection'));
    await Promise.resolve();
    assert.strictEqual(pending.adapter.click('solo'), true, 'old visit failure cannot revoke current exposure');
    pending.rejections[3](new Error('synthetic click rejection'));
    await Promise.resolve();
    assert.strictEqual(pending.calls.length, 4, 'rejected click must not retry automatically');
    assert.strictEqual(pending.adapter.click('solo'), true, 'click rejection must preserve submitted exposure');
    assert.strictEqual(pending.calls.length, 5);
    assert.strictEqual(pending.adapter.diagnostics().failed, 3);
    assert.strictEqual(JSON.stringify(pending.adapter.diagnostics()).includes('synthetic'), false);

    const originalLog = console.log;
    const logs = [];
    try {
        console.log = function (line) { logs.push(JSON.parse(line.replace('[home-analytics] ', ''))); };
        const debugSettings = {enabled:true,testOnly:true,debug:true,
            branches:{solo:'fixture solo',pvp:'fixture pvp'}};
        const native = fixture({environment: 'develop', settings: debugSettings});
        native.adapter.expose('solo'); native.adapter.expose('pvp');
        native.adapter.click('solo'); native.adapter.click('pvp');
        assert.strictEqual(logs[0].stage, 'ready');
        assert.deepStrictEqual(logs.filter(x => x.stage === 'submitted').map(x => [x.branch, x.eventType]),
            [['solo',1],['pvp',1],['solo',2],['pvp',2]]);
        assert.ok(logs.every(x => Object.keys(x).every(key => ['stage','environment','branch','branchId','eventType'].includes(key))));
        native.options.throws = true;
        native.adapter.click('solo');
        assert.strictEqual(logs[logs.length - 1].stage, 'failed');
        const beforeInspect = native.calls.length;
        native.adapter.inspectClick('solo', {drawn:true, available:false, backgrounded:true, openid:'private', errMsg:'synthetic private error'});
        const inspected = logs[logs.length - 1];
        assert.strictEqual(inspected.stage, 'click_seen');
        assert.strictEqual(inspected.eventType, 2);
        assert.deepStrictEqual(inspected.gates, {drawn:true,available:false,backgrounded:true,guide:false,stamina:false,
            ad:false,creating:false,press:false,busy:false,saveFailed:false,resume:false});
        assert.strictEqual(native.calls.length, beforeInspect, 'observing a tap must not report a fabricated remote click');
        native.adapter.beginVisit();
        assert.strictEqual(native.adapter.click('solo'), false);
        assert.strictEqual(logs[logs.length - 1].stage, 'click_no_exposure');
        const beforeBlocked = logs.length;
        for (const environment of ['release', undefined]) {
            fixture({environment, settings: debugSettings}).adapter.expose('solo');
            fixture({environment, settings: Object.assign({}, debugSettings, {testOnly: false})}).adapter.expose('solo');
        }
        assert.strictEqual(logs.length, beforeBlocked, 'debug logging is test-environment only even if testOnly later changes');
        assert.strictEqual(JSON.stringify(logs).includes('synthetic'), false);
        assert.strictEqual(JSON.stringify(logs).includes('private'), false);
        console.log = function () { throw new Error('synthetic console failure'); };
        const brokenConsole = fixture({environment: 'trial', settings: debugSettings});
        assert.strictEqual(brokenConsole.adapter.expose('solo'), true);
        assert.strictEqual(brokenConsole.calls.length, 1);
    } finally { console.log = originalLog; }
    console.log('home analytics adapter tests passed');
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
