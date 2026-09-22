'use strict';

/** 纯 Node 合规回归：第三方 notice、项目版权边界、活跃素材与包体忽略规则。 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(projectRoot, '..');
const upstreamUrl = 'https://github.com/xiaozhu188/pixi-game-match3';
const upstreamCommit = '658679250f30ef8d01ff570eb976017c5727cbf0';
const upstreamFile = 'src/match3/Match3Utility.ts';
const sfxPath = 'res/audio/sfx-acoustic.mp3';
const sfxSha256 = 'dffb3257a79902f517013afdf09597fc13e36ba4e92e095d74444c542521337e';
const sfxSources = [
    'https://freesound.org/people/Kinoton/sounds/347163/',
    'https://freesound.org/people/animationIsaac/sounds/207322/',
    'https://freesound.org/people/qubodup/sounds/817466/',
    'https://opengameart.org/content/shimmer-glitter-magic',
    'https://freesound.org/people/timbreknight/sounds/342546/',
    'https://mixkit.co/free-sound-effects/sparkle/'
];
const activePaths = [
    'res/home/moonlit-garden-bg.jpg',
    'res/home/duel-cats.png',
    'res/home/duel-heads.png',
    'res/home/title-logo.png',
    'res/home/button-primary.png',
    'res/home/button-secondary.png',
    'res/level-background-v2.jpg',
    'res/ui/coin.png',
    'res/ui/heart.png',
    'res/ui/moves-paw.png',
    'res/ui/settings.png',
    'res/ui/shop.png',
    'res/ui/special-row-beam.png',
    'res/ui/timer.png',
    'res/ui/tool-bomb.png',
    'res/ui/tool-hammer.png',
    'res/ui/tool-yarn.png',
    'res/ui/result-happy-cat.png',
    'res/ui/result-sad-cat.png',
    'res/ui/daily-invitation.png',
    'res/piece1-runtime.png',
    'res/piece2-runtime.png',
    'res/piece3-runtime.png',
    'res/piece4-runtime.png',
    'res/piece5-runtime.png'
];
const pieceSourcePaths = [
    'res/piece1-v2.png',
    'res/piece2-v2.png',
    'res/piece3-v2.png',
    'res/piece4-v2.png',
    'res/piece5-v2.png'
];

function read(relativeTo, file) {
    return fs.readFileSync(path.join(relativeTo, file), 'utf8');
}

function isIgnored(relative, rules) {
    return rules.some(function (rule) {
        const value = String(rule.value || '').replace(/\/$/, '');
        if (rule.type === 'file') return value === relative;
        if (rule.type === 'folder') return relative === value || relative.indexOf(value + '/') === 0;
        return false;
    });
}

const notices = read(projectRoot, 'THIRD_PARTY_NOTICES.txt');
const ledger = read(repoRoot, 'docs/release/open-source-and-assets.md');
const readme = read(projectRoot, 'README.md');
const assets = require('../js/render/assets').ASSETS;
const config = require('../project.config.json');
const cloudLock = require('../cloudfunctions/battle/package-lock.json');
const cloudSdk = require('../cloudfunctions/battle/node_modules/wx-server-sdk');
const ignoreRules = (config.packOptions && config.packOptions.ignore) || [];

assert(notices.includes(upstreamUrl), 'notice 缺少上游 URL');
assert(notices.includes(upstreamCommit), 'notice 缺少精确上游 commit');
assert(notices.includes(upstreamFile), 'notice 缺少采用文件');
assert(notices.includes('MIT License'), 'notice 缺少 MIT 标题');
assert(notices.includes('Copyright (c) 2023-PRESENT hairyf <https://github.com/hairyf>'), 'notice 缺少 MIT 版权行');
assert(notices.includes('THE SOFTWARE IS PROVIDED "AS IS"'), 'notice 缺少 MIT 免责声明');
assert(notices.includes('wx-server-sdk 4.0.2'), 'notice 缺少 wx-server-sdk 版本');
assert(notices.includes('License: MIT'), 'notice 缺少 wx-server-sdk MIT 声明');
assert(notices.includes('ElevenLabs'), 'notice 缺少 ElevenLabs 生成素材记录');
assert(notices.includes('music_v1'), 'notice 缺少音乐模型记录');
assert(notices.includes('eleven_text_to_sound_v2'), 'notice 缺少音效模型记录');
sfxSources.forEach(function (url) {
    assert(notices.includes(url), 'notice 缺少音效来源: ' + url);
    assert(ledger.includes(url), '台账缺少音效来源: ' + url);
});
assert(notices.includes('derived 21-cue MP3 sprite'), 'notice 缺少音效精灵派生范围');
assert(notices.includes('https://mixkit.co/license/#sfxFree'), '缺少Mixkit音效许可');
assert(notices.includes('Magic wand sparkle'), '横竖特殊触发缺少新来源');
assert(notices.includes('Christmas reveal tones'), '通关成功缺少新来源');
assert(notices.includes('source-file redistribution'), '缺少Mixkit源码分发边界');
assert(read(repoRoot, '.gitignore').split(/\r?\n/).includes('match3-wechat/' + sfxPath), '含Mixkit运行音效必须与公开Git隔离');
assert(notices.includes('The Berklee College of Music'), '四连音效缺少作者署名');
assert(notices.includes('https://creativecommons.org/licenses/by/3.0/'), '四连音效缺少许可链接');
assert(notices.includes('Changes: resampled'), '四连音效缺少改编说明');
assert(ledger.includes('`' + sfxPath + '`'), '台账缺少正式音效精灵');
assert(ledger.includes(sfxSha256), '台账缺少正式音效精灵 SHA256');
const sfxFile = path.join(projectRoot, sfxPath);
assert(fs.existsSync(sfxFile), '正式音效精灵不存在');
assert(!isIgnored(sfxPath, ignoreRules), '正式音效精灵不得被包体忽略');
assert.strictEqual(fs.statSync(sfxFile).size, 61022, '正式音效精灵字节数发生漂移');
assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(sfxFile)).digest('hex'), sfxSha256,
    '正式音效精灵 SHA256 发生漂移');
assert.strictEqual(typeof cloudSdk.init, 'function', 'wx-server-sdk 缺少 init API');
assert.strictEqual(typeof cloudSdk.database, 'function', 'wx-server-sdk 缺少 database API');
assert.strictEqual(typeof cloudSdk.getWXContext, 'function', 'wx-server-sdk 缺少 getWXContext API');
assert.strictEqual(typeof cloudSdk.DYNAMIC_CURRENT_ENV, 'symbol', 'wx-server-sdk 缺少 DYNAMIC_CURRENT_ENV');
cloudSdk.init({ env: cloudSdk.DYNAMIC_CURRENT_ENV });
const cloudDatabase = cloudSdk.database({ throwOnNotFound: false });
assert.strictEqual(typeof cloudDatabase.collection, 'function', 'wx-server-sdk 数据库缺少 collection API');
assert.strictEqual(typeof cloudDatabase.runTransaction, 'function', 'wx-server-sdk 数据库缺少 runTransaction API');

const cloudPackages = cloudLock.packages || {};
const wxSdkPackage = cloudPackages['node_modules/wx-server-sdk'];
assert(wxSdkPackage && wxSdkPackage.version === '4.0.2', '云函数锁文件中的 wx-server-sdk 版本发生漂移');
assert(wxSdkPackage.license === 'MIT', '云函数锁文件未声明 wx-server-sdk 为 MIT');
const licenseCounts = {};
const undeclared = [];
Object.keys(cloudPackages).forEach(function (packagePath) {
    if (!packagePath) return;
    const license = cloudPackages[packagePath].license || 'UNDECLARED';
    licenseCounts[license] = (licenseCounts[license] || 0) + 1;
    if (license === 'UNDECLARED') undeclared.push(packagePath);
});
assert.deepStrictEqual(licenseCounts, {
    ISC: 4,
    MIT: 72,
    UNDECLARED: 2,
    'BSD-3-Clause': 13,
    UNLICENSED: 1,
    'Apache-2.0': 10,
    'BlueOak-1.0.0': 1,
    '0BSD': 1
}, '云函数依赖许可证统计发生漂移，请同步复核台账');
assert.strictEqual(cloudPackages['node_modules/lodash.set'].name, '@match3/lodash-set-compat');
assert.strictEqual(cloudPackages['node_modules/lodash.set'].license, 'UNLICENSED',
    '自有兼容层保持默认版权，不得误记为第三方未声明许可');
assert.deepStrictEqual(undeclared, [
    'node_modules/@cloudbase/signature-nodejs',
    'node_modules/@cloudbase/wx-cloud-client-sdk'
], '未声明许可证依赖发生漂移');

assert(!/Gem-Match3/i.test(readme), '公开小游戏 README 不得引用 Gem-Match3');
assert(!/(?:本项目|整个项目)[^\n。]{0,30}MIT/i.test(readme), 'README 不得把整个项目声称为 MIT');
assert(readme.includes('[' + 'pixi-game-match3](' + upstreamUrl + ')'), 'README 缺少可点击的精确上游 URL');
assert(readme.includes('[`THIRD_PARTY_NOTICES.txt`](THIRD_PARTY_NOTICES.txt)'), 'README 缺少 notice 链接');

assert.strictEqual(Object.keys(assets).length, activePaths.length + 1, '仅首页/棋盘背景允许共用一个文件');
assert.strictEqual(assets.gameBackground, assets.homeBackground, '相同背景必须共用发布文件');
assert.deepStrictEqual(Array.from(new Set(Object.values(assets))).sort(), activePaths.slice().sort(), 'assets.js 活跃素材清单发生漂移');
const retiredPaths = ['res/game-background-v2.jpg', 'res/ui/level-node-current-v2.png',
    'res/ui/level-node-done-v2.png', 'res/ui/level-node-locked-v2.png'];
retiredPaths.forEach(function (relative) {
    assert(fs.existsSync(path.join(projectRoot, relative)), '须保留回退源图: ' + relative);
    assert(!Object.values(assets).includes(relative), '退役素材不得再注册加载: ' + relative);
    assert(isIgnored(relative, ignoreRules), '退役素材须从发布包排除: ' + relative);
    assert(ledger.includes('`' + relative + '`'), '须保留来源记录: ' + relative);
});
activePaths.forEach(function (relative) {
    assert(ledger.includes('`' + relative + '`'), '台账缺少活跃素材: ' + relative);
    assert(fs.existsSync(path.join(projectRoot, relative)), '活跃素材不存在: ' + relative);
    assert(!isIgnored(relative, ignoreRules), '活跃素材被 project.config 忽略: ' + relative);
});

assert(fs.existsSync(path.join(projectRoot, 'THIRD_PARTY_NOTICES.txt')), 'notice 必须留在小游戏主包');
assert(!isIgnored('THIRD_PARTY_NOTICES.txt', ignoreRules), 'notice 不得被 project.config 忽略');
assert(ledger.includes('不得重新启用'), '台账必须禁止重新启用旧素材');
assert(ledger.includes('仅因包体体积被排除'), '台账必须区分可信棋子源图与来源待确认的旧素材');
assert(ledger.includes('macOS `sips`'), '台账缺少运行时棋子派生工具');
pieceSourcePaths.forEach(function (relative) {
    assert(ledger.includes('`' + relative + '`'), '台账缺少棋子源图: ' + relative);
    assert(fs.existsSync(path.join(projectRoot, relative)), '棋子源图不存在: ' + relative);
    assert(isIgnored(relative, ignoreRules), '512x512 棋子源图必须保持包体排除: ' + relative);
});
assert(ledger.includes('@cloudbase/signature-nodejs@2.2.0'), '台账缺少签名包未声明依赖');
assert(ledger.includes('@cloudbase/wx-cloud-client-sdk@1.7.1'), '台账缺少微信云客户端未声明依赖');
assert(ledger.includes('UNDECLARED'), '台账缺少 UNDECLARED 风险');
assert(ledger.includes('厂商依赖例外'), '台账缺少厂商依赖例外决策');
assert(ledger.includes('接受残余商业合规风险'), '台账缺少残余风险接受记录');
assert(ledger.includes('不提交外部澄清请求'), '台账缺少不对外问询决策');
assert(!ledger.includes('未完成前不得发布云函数生产版本'), '已接受厂商例外不得继续写成生产发布阻断');
assert(!/无 undeclared/i.test(ledger), '台账不得声称无 undeclared');

console.log('开源与素材合规检查: 通过');
