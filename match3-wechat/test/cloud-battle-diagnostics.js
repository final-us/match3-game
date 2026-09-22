'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(require.resolve('../js/net/cloud-battle'), 'utf8');

function fixture(wx) {
    const module = { exports: {} };
    vm.runInNewContext(source, { module: module, wx: wx });
    return module.exports;
}

async function rejected(cloud) {
    try { await cloud.call('create', { nickname: '房主猫' }); }
    catch (error) { return error; }
    throw new Error('expected cloud rejection');
}

(async function () {
    let calls = 0;
    let initializationThrows = true;
    let mode = 'fail';
    const wx = {
        getAccountInfoSync: function () { return { miniProgram: { envVersion: 'release', appId: 'PRIVATE_APP' } }; },
        cloud: {
            init: function (options) {
                assert.strictEqual(options.env, 'cloud1-d9g4pv8m8457af92a');
                if (initializationThrows) throw { errCode: -601, errMsg: 'invalid environment token=PRIVATE_INIT' };
            },
            callFunction: function (options) {
                calls++;
                assert.strictEqual(options.name, 'battle');
                assert.strictEqual(options.data.action, 'create');
                assert.strictEqual(options.data.nickname, '房主猫');
                if (mode === 'success') return options.success({ result: { ok: true, roomId: 'ROOM' } });
                if (mode === 'throw') throw new Error('network offline PRIVATE_THROW');
                options.fail({ errCode: -501000, errMsg: 'callFunction:fail errCode: -501000 permission denied PRIVATE_CALL',
                    requestId: 'PRIVATE_REQUEST', openid: 'PRIVATE_OPENID' });
            }
        }
    };
    const cloud = fixture(wx);
    cloud.init();
    let failure = await rejected(cloud);
    let message = cloud.describeCreateFailure(failure, false);
    assert(message.includes('D1/CALL/-501000/PERMISSION'));
    assert(message.includes('初始化：-601/ENV'));
    assert(message.includes('正式版'));
    assert(!JSON.stringify(failure).includes('PRIVATE'), '拒绝对象不得留存原始敏感字段');
    assert(!message.includes('PRIVATE'));
    assert.strictEqual(calls, 1, '初始化异常仍尝试原有调用，不增加重试');
    initializationThrows = false;
    cloud.init();
    failure = await rejected(cloud);
    assert(!cloud.describeCreateFailure(failure, false).includes('初始化：'), '重新初始化成功清除旧线索');
    mode = 'success';
    const result = await cloud.call('create', { nickname: '房主猫' });
    assert.strictEqual(result.roomId, 'ROOM');
    mode = 'throw';
    failure = await rejected(cloud);
    assert(cloud.describeCreateFailure(failure, false).includes('/NA/NETWORK'));
    assert(!JSON.stringify(failure).includes('PRIVATE_THROW'));
    for (const runtime of [undefined, {}, { cloud: {} }]) {
        const unavailable = fixture(runtime);
        unavailable.init();
        const result = unavailable.describeCreateFailure(await rejected(unavailable), false);
        assert(result.includes('D1/'));
        assert(result.includes('版本：未知'));
    }
    const fromMessage = cloud.describeCreateFailure({ errMsg: 'errCode: -502005 function not found PRIVATE' }, false);
    assert(fromMessage.includes('/-502005/'));
    assert(!fromMessage.includes('PRIVATE'));
    for (const bad of ['PRIVATE', '123456789012345', '1e6', {}, Infinity, null]) {
        assert(cloud.describeCreateFailure({ errCode: bad }, false).includes('/NA/'));
    }
    for (const err of ['__proto__', 'constructor', 'PRIVATE']) {
        const message = cloud.describeCreateFailure({ err: err }, true);
        assert(message.includes('D1/SERVER/RESPONSE'));
        assert(!message.includes('PRIVATE'));
    }
    assert(cloud.describeCreateFailure({ err: '身份校验失败' }, true).includes('/IDENTITY'));
    assert(cloud.describeCreateFailure({ err: '服务异常' }, true).includes('/SERVICE'));
    const dailyServerCases = [
        ['未知操作', '每日挑战暂未开放'],
        ['身份校验失败', '登录状态已失效，请重新进入游戏'],
        ['挑战身份不符', '登录状态已失效，请重新进入游戏'],
        ['每日挑战开局过于频繁', '操作过于频繁，请稍后再试'],
        ['服务异常', '每日挑战服务暂时不可用，请稍后重试'],
        ['unknown PRIVATE_SERVER', '暂时无法连接每日挑战，请稍后重试']
    ];
    dailyServerCases.forEach(function (item) {
        const shown = cloud.describeDailyFailure({ err: item[0], errMsg: 'PRIVATE_SECRET' }, true);
        assert.strictEqual(shown, item[1]);
        assert(!shown.includes('PRIVATE'));
    });
    assert.strictEqual(cloud.describeDailyFailure({ battleDiagnostic: { stage: 'SDK', error: { kind: 'NETWORK' } } }, false),
        '当前微信版本暂不支持每日挑战');
    assert.strictEqual(cloud.describeDailyFailure({ battleDiagnostic: { stage: 'CALL', error: { kind: 'TIMEOUT' } } }, false),
        '连接超时，请稍后重试');
    assert.strictEqual(cloud.describeDailyFailure({ battleDiagnostic: { stage: 'CALL', error: { kind: 'NETWORK' } } }, false),
        '网络连接失败，请检查网络后重试');
    assert.strictEqual(cloud.describeDailyFailure({ errMsg: 'PRIVATE_URL' }, false), '暂时无法连接每日挑战，请稍后重试');

    let channel = 'develop';
    let platformError = { errCode: -1,
        errMsg: 'request:fail url not in domain list https://private.example/path?token=SECRET_TOKEN openid=PRIVATE_USER nickname="proxy" email=PRIVATE_MAIL phone=13800138000',
        cause: { errCode: -9003, message: 'errCode: -502005; TLS certificate verify failed PRIVATE_DETAIL' } };
    const dev = fixture({
        getAccountInfoSync: function () { return { miniProgram: { envVersion: channel } }; },
        cloud: { init: function () {}, callFunction: function (options) { options.fail(platformError); } }
    });
    failure = await rejected(dev);
    message = dev.describeCreateFailure(failure, false);
    assert(message.includes('D2/CALL/-1/UNKNOWN'));
    assert(message.includes('错误链：-1,-9003,-502005'));
    assert(message.includes('request:fail url not in domain list'));
    assert(message.includes('TLS certificate verify failed'));
    for (const secret of ['private.example', 'SECRET_TOKEN', 'PRIVATE_USER', 'PRIVATE_MAIL', '13800138000', 'PRIVATE_DETAIL', 'nickname', 'proxy']) {
        assert(!JSON.stringify(failure).includes(secret), '开发版拒绝对象不得保留敏感值: ' + secret);
        assert(!message.includes(secret));
    }
    const lateDevelopFailure = failure;
    for (const other of ['release', 'trial', 'unexpected', undefined]) {
        channel = other;
        failure = await rejected(dev);
        assert(!failure.battleDiagnostic.details, '非开发版不得收集详细错误');
        message = dev.describeCreateFailure(failure, false);
        assert(message.includes('D1/CALL/'));
        assert(!message.includes('脱敏说明') && !message.includes('domain list'));
        assert(!dev.describeCreateFailure(lateDevelopFailure, false).includes('脱敏说明'), '展示时也检查实际渠道');
    }
    channel = 'develop';
    platformError = { code: -1, message: '请求失败：不在合法域名列表中；姓名张三；IP 192.168.1.1；电话13800138000' };
    platformError.cause = platformError;
    failure = await rejected(dev);
    message = dev.describeCreateFailure(failure, false);
    assert(message.includes('合法域名列表中'));
    for (const secret of ['张三', '192.168.1.1', '13800138000']) assert(!JSON.stringify(failure).includes(secret));
    platformError = { errCode: -1, errMsg: 'network '.repeat(10000) };
    failure = await rejected(dev);
    assert(failure.battleDiagnostic.details.text.length <= 320);
    platformError = { errCode: -1, cause: { errCode: -2, cause: { errno: -3, cause: { errCode: -4 } } } };
    message = dev.describeCreateFailure(await rejected(dev), false);
    assert(message.includes('错误链：-1,-2,-3'));
    assert(!message.includes('-4'));
    platformError = null;
    assert(dev.describeCreateFailure(await rejected(dev), false).includes('平台未提供文字说明'));
    console.log('cloud battle diagnostic tests passed');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
