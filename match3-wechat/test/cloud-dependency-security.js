'use strict';

// Run against the installed dependency actually resolved by CloudBase, not a test replacement.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
// Optional directory lets the same regression inspect an isolated npm ci deployment artifact.
const cloudRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../cloudfunctions/battle');
const cloudRequire = createRequire(path.join(cloudRoot, 'package.json'));
const wxSdkRequire = createRequire(cloudRequire.resolve('wx-server-sdk'));
const nodeSdkRequire = createRequire(wxSdkRequire.resolve('@cloudbase/node-sdk'));
const databaseRequire = createRequire(nodeSdkRequire.resolve('@cloudbase/database'));
const set = databaseRequire('lodash.set');
const unset = databaseRequire('lodash.unset');
const lock = cloudRequire('./package-lock.json');
const expectedVersions = { axios: '0.33.0', lodash: '4.18.1', 'lodash.unset': '4.18.0', qs: '6.16.0' };
for (const [location, entry] of Object.entries(lock.packages)) {
    if (!location) continue;
    assert(!entry.link, '部署依赖不得依靠本机符号链接: ' + location);
    const installedDir = path.join(cloudRoot, location);
    assert(!fs.lstatSync(installedDir).isSymbolicLink(), '安装目录不得是符号链接: ' + location);
    for (const [name, version] of Object.entries(expectedVersions)) {
        if (location.endsWith('/node_modules/' + name) || location === 'node_modules/' + name) {
            assert.strictEqual(entry.version, version, '锁文件存在未审查版本: ' + location);
            assert.strictEqual(cloudRequire('./' + location + '/package.json').version, version,
                '实际安装版本与锁文件不符: ' + location);
        }
    }
    if (location.endsWith('/lodash.set')) {
        assert.strictEqual(entry.name, '@match3/lodash-set-compat', '不得恢复有漏洞的独立lodash.set包');
    }
}
assert.strictEqual(databaseRequire('lodash.set/package.json').name, '@match3/lodash-set-compat');
assert.strictEqual(set, cloudRequire('lodash/set'), 'CloudBase必须实际调用维护中的set实现');
assert.strictEqual(databaseRequire('lodash.unset/package.json').version, expectedVersions['lodash.unset']);
assert.strictEqual(nodeSdkRequire('axios/package.json').version, expectedVersions.axios);
const signatureRequire = createRequire(nodeSdkRequire.resolve('@cloudbase/signature-nodejs'));
const urlRequire = createRequire(signatureRequire.resolve('url/'));
assert.strictEqual(urlRequire('qs/package.json').version, expectedVersions.qs);
const qs = urlRequire('qs');
assert.deepStrictEqual(qs.parse('round=2&players%5B0%5D=cat'), { round: '2', players: ['cat'] });
assert.deepStrictEqual(qs.parse('__proto__[match3SecurityProbe]=bad'), {});

const pollutionKey = 'match3SecurityProbe';
try {
    for (const field of ['__proto__.' + pollutionKey, 'constructor.prototype.' + pollutionKey,
        ['__proto__', pollutionKey], ['constructor', 'prototype', pollutionKey]]) {
        set({}, field, 'polluted');
        assert.strictEqual(Object.prototype[pollutionKey], undefined, 'set不得污染Object.prototype');
    }
    const doc = {};
    assert.strictEqual(set(doc, 'scores.rounds[0].value', 150), doc);
    assert.strictEqual(doc.scores.rounds[0].value, 150);
    set(doc, ['literal.dot', 'nested'], 3);
    assert.strictEqual(doc['literal.dot'].nested, 3);
    assert.strictEqual(unset(doc, 'scores.rounds[0].value'), true);
    assert.strictEqual(doc.scores.rounds[0].value, undefined);
    Object.prototype[pollutionKey] = 'preserve';
    for (const field of ['__proto__.' + pollutionKey, 'constructor.prototype.' + pollutionKey,
        ['__proto__', pollutionKey], ['constructor', 'prototype', pollutionKey]]) {
        unset({}, field);
        assert.strictEqual(Object.prototype[pollutionKey], 'preserve', 'unset不得删除原型属性');
    }
    delete Object.prototype[pollutionKey];
} finally {
    delete Object.prototype[pollutionKey];
}

async function checkAxiosCompatibility() {
    const axios = nodeSdkRequire('axios');
    const cloudbase = wxSdkRequire('@cloudbase/node-sdk').init({ env: 'match3-offline-test' });
    for (const method of ['get', 'post', 'put', 'delete']) {
        assert.strictEqual(cloudbase.requestClient[method], axios, 'SDK callable axios contract');
    }
    // Every request uses an in-memory adapter. Never query cloud metadata or real credentials.
    const response = await cloudbase.requestClient.post({
        url: 'https://example.invalid/match3-offline-test', method: 'post', data: { score: 150 },
        adapter: async function (config) {
            assert.strictEqual(config.method, 'post');
            assert.strictEqual(config.data, '{"score":150}');
            return { data: '{"ok":true}', status: 200, statusText: 'OK', headers: {}, config };
        }
    });
    assert.deepStrictEqual(response.data, { ok: true });
    const metadata = nodeSdkRequire('./utils/metadata');
    const value = await metadata.lookup('match3-offline-test', { timeout: 200,
        adapter: async function (config) {
            assert.strictEqual(config.method, 'get');
            assert.strictEqual(config.timeout, 200);
            return { data: 'test-only', status: 200, statusText: 'OK', headers: {}, config };
        }
    });
    assert.strictEqual(value, 'test-only', 'SDK lookup应保留响应data语义');
    const timeout = new Error('test-only timeout');
    timeout.code = 'ECONNABORTED';
    await assert.rejects(metadata.lookup('match3-offline-test', {
        adapter: async function () { throw timeout; }
    }), function (error) { return error === timeout; }, 'SDK必须透传请求失败');
    const cancellation = axios.CancelToken.source();
    cancellation.cancel('test-only cancellation');
    await assert.rejects(axios.get('https://example.invalid/match3-offline-test', {
        cancelToken: cancellation.token,
        adapter: async function () { throw new Error('已取消请求不应抵达adapter'); }
    }), axios.isCancel);
}

checkAxiosCompatibility().then(function () {
    console.log('cloud dependency security, installed graph and SDK adapter compatibility passed');
}).catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
