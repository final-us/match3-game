/**
 * 校验运行时素材映射、PNG 尺寸、忽略规则和活跃素材包体预算。
 * 用法: node test/package-budget.js
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const resRoot = path.join(projectRoot, 'res');
const assetModule = require('../js/render/assets');
const assets = assetModule.ASSETS;
const catalogAssets = assetModule.CATALOG_ASSETS;
const config = require('../project.config.json');
const gameConfig = require('../game.json');
const vm = require('vm');
const maxActiveBytes = 3.5 * 1024 * 1024;
const maxBgmBytes = 360 * 1024;
// Full accepted rocket/win tails add ~15KB; overall 4MiB package cap is unchanged.
const maxSfxBytes = 64 * 1024;
const maxNewSpecialSfxBytes = 84 * 1024;
const maxEstimatedMainPackageBytes = 4 * 1024 * 1024;
const maxEstimatedTotalPackageBytes = 30 * 1024 * 1024;
const bgmPaths = ['res/audio/calm.mp3', 'res/audio/battle.mp3'];
const sfxPath = 'res/audio/sfx-acoustic.mp3';
const newSpecialSfxPath = 'res/audio/sfx-new-specials.wav';
const developerMetadata = new Set([
    'README.md',
    'project.config.json',
    'project.private.config.json'
]);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function projectRelative(file) {
    return path.relative(projectRoot, file).split(path.sep).join('/');
}

function walk(directory) {
    const files = [];
    fs.readdirSync(directory, { withFileTypes: true }).forEach(function (entry) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push.apply(files, walk(file));
        else if (entry.isFile()) files.push(file);
    });
    return files;
}

function readPng(file) {
    const data = fs.readFileSync(file);
    assert(data.length >= 33 && data.subarray(0, 8).equals(pngSignature), '不是有效 PNG: ' + projectRelative(file));
    assert(data.readUInt32BE(8) === 13 && data.toString('ascii', 12, 16) === 'IHDR', 'PNG 缺少 IHDR: ' + projectRelative(file));
    let hasTransparencyChunk = false;
    for (let offset = 8; offset + 12 <= data.length;) {
        const length = data.readUInt32BE(offset);
        if (offset + length + 12 > data.length) break;
        if (data.toString('ascii', offset + 4, offset + 8) === 'tRNS') hasTransparencyChunk = true;
        offset += length + 12;
    }
    return {
        hasAlpha: data[25] === 4 || data[25] === 6 || (data[25] === 3 && hasTransparencyChunk),
        width: data.readUInt32BE(16),
        height: data.readUInt32BE(20),
        colorType: data[25]
    };
}

const ignoreRules = (config.packOptions && config.packOptions.ignore) || [];
const fileIgnoreValues = new Set(ignoreRules.filter(function (rule) {
    return rule.type === 'file';
}).map(function (rule) {
    return rule.value;
}));

function isIgnored(relative) {
    return ignoreRules.some(function (rule) {
        const value = String(rule.value || '').replace(/\/$/, '');
        if (rule.type === 'file') return value === relative;
        if (rule.type === 'folder') return relative === value || relative.indexOf(value + '/') === 0;
        return false;
    });
}

const assetPaths = new Set();
let activeBytes = 0;
Object.keys(assets).forEach(function (key) {
    const relative = assets[key];
    const file = path.resolve(projectRoot, relative);
    assert(file.indexOf(projectRoot + path.sep) === 0, '素材路径越出项目根目录: ' + key);
    assert(fs.existsSync(file) && fs.statSync(file).isFile(), '素材文件不存在: ' + key + ' → ' + relative);
    if (!assetPaths.has(relative)) activeBytes += fs.statSync(file).size;
    assetPaths.add(relative);
    assert(!isIgnored(relative), '活跃素材被忽略: ' + relative);
});

const packages = (gameConfig.subpackages || []).map(function (entry) {
    assert(entry && typeof entry.name === 'string' && typeof entry.root === 'string', '分包声明无效');
    const root = entry.root.replace(/\/$/, '');
    assert(root && !path.isAbsolute(root) && !root.split('/').includes('..'), '分包根目录无效: ' + entry.root);
    assert(fs.existsSync(path.join(projectRoot, root)) && fs.statSync(path.join(projectRoot, root)).isDirectory(), '分包目录不存在: ' + root);
    return { name: entry.name, root: root };
});
const catalogPackage = packages.find(function (entry) { return entry.name === 'catalog' && entry.root === 'catalog'; });
assert(catalogPackage, '图鉴须声明普通 catalog/ 分包');
const resultPackage = packages.find(entry => entry.name === 'result-art' && entry.root === 'result-art');
assert(resultPackage, '结算装饰须位于 result-art 分包，不占启动包');
const resultPaths = Object.values(assetModule.RESULT_ASSETS);
assert(resultPaths.length === 4 && new Set(resultPaths).size === 4, '结算须注册三个无字装饰与目标图集');
let resultBytes = 0;
resultPaths.forEach(relative => {
    assert(relative.startsWith('result-art/') && !relative.split('/').includes('..') && !isIgnored(relative), '结算素材路径无效');
    const file = path.join(projectRoot, relative), png = readPng(file);
    assert(png.width <= 640 && png.height <= 900 && (png.colorType === 4 || png.colorType === 6), '结算装饰尺寸/alpha不合规');
    if(relative===assetModule.RESULT_ASSETS.uiResultGoals)assert(png.width===480&&png.height===320, '目标图集须保持3×2个160px单元');
    resultBytes += fs.statSync(file).size;
});
assert(resultBytes <= 1.6 * 1024 * 1024, '结算装饰分包素材超过1.6MiB预算');
walk(path.join(projectRoot, resultPackage.root)).map(projectRelative).forEach(relative => {
    assert(relative === 'result-art/game.js' || resultPaths.includes(relative), '结算分包存在未注册文件: ' + relative);
});
const illustrationPackage = packages.find(entry => entry.name === 'ui-art' && entry.root === 'ui-art');
assert(illustrationPackage && !gameConfig.subpackages.find(entry => entry.name === 'ui-art').independent, '页面插画须声明普通 ui-art 分包');
assert(assets.uiToolBomb === 'res/ui/tool-bomb.png' && !assetModule.ILLUSTRATION_ASSETS.uiToolBomb, '局内炸弹类型标记须保留启动资源');
const illustrationPaths = Object.values(assetModule.ILLUSTRATION_ASSETS);
assert(illustrationPaths.length === 15 && new Set(illustrationPaths).size === 15, '页面插画须注册既有14图及独立花簇');
let illustrationBytes = 0;
illustrationPaths.forEach(relative => {
    assert(relative.startsWith('ui-art/') && !relative.split('/').includes('..') && !isIgnored(relative), '页面插画路径无效');
    const file = path.join(projectRoot, relative), png = readPng(file);
    assert(png.hasAlpha, '页面插画须保留alpha: ' + relative);
    if (relative === assetModule.ILLUSTRATION_ASSETS.uiIllustrationItems)
        assert([192, 256].some(cell => png.width === cell * 4 && png.height === cell * 2), '道具图集须为4×2个192或256px单元');
    if (relative === assetModule.ILLUSTRATION_ASSETS.uiIllustrationChests)
        assert([192, 256].some(cell => png.width === cell * 3 && png.height === cell), '宝箱图集须为3×1个192或256px单元');
    if (relative === assetModule.ILLUSTRATION_ASSETS.uiIllustrationFrame)
        assert(png.width === 512 && png.height === 680, '空白纸面框须保持512×680');
    illustrationBytes += fs.statSync(file).size;
});
walk(path.join(projectRoot, illustrationPackage.root)).map(projectRelative).forEach(relative => {
    assert(relative === 'ui-art/game.js' || illustrationPaths.includes(relative), '页面插画分包存在未注册文件: ' + relative);
});
assert(illustrationBytes <= 1.5 * 1024 * 1024, '含平局猫/备战双猫的页面插画分包超过1.5MiB预算');
assert(catalogAssets && Object.keys(catalogAssets).length === 21, '图鉴须注册 16 张成长原画、初见图集和 4 张遮罩');
const catalogPaths = new Set();
Object.keys(catalogAssets).forEach(function (key) {
    const relative = catalogAssets[key];
    assert(typeof relative === 'string' && relative.startsWith(catalogPackage.root + '/') &&
        !relative.split('/').includes('..'), '图鉴素材须位于已声明的 catalog/ 分包: ' + key);
    const file = path.resolve(projectRoot, relative);
    assert(fs.existsSync(file) && fs.statSync(file).isFile(), '图鉴素材文件不存在: ' + key + ' → ' + relative);
    assert(!isIgnored(relative), '活跃图鉴素材被忽略: ' + relative);
    assert(!catalogPaths.has(relative), '图鉴素材重复注册: ' + relative);
    catalogPaths.add(relative);
});
walk(path.join(projectRoot, catalogPackage.root)).map(projectRelative).forEach(function (relative) {
    assert(relative === 'catalog/game.js' || catalogPaths.has(relative), '图鉴分包存在未注册文件: ' + relative);
});

let bgmBytes = 0;
bgmPaths.forEach(function (relative) {
    const file = path.join(projectRoot, relative);
    assert(fs.existsSync(file) && fs.statSync(file).isFile(), 'BGM 文件不存在: ' + relative);
    assert(!isIgnored(relative), 'BGM 被打包规则忽略: ' + relative);
    assetPaths.add(relative);
    bgmBytes += fs.statSync(file).size;
});
assert(bgmBytes <= maxBgmBytes, '双 BGM 总体积超过预算: ' + bgmBytes + ' > ' + maxBgmBytes);

const sfxFile = path.join(projectRoot, sfxPath);
assert(fs.existsSync(sfxFile) && fs.statSync(sfxFile).isFile(), '音效精灵不存在: ' + sfxPath);
assert(!isIgnored(sfxPath), '音效精灵被打包规则忽略: ' + sfxPath);
assetPaths.add(sfxPath);
const sfxBytes = fs.statSync(sfxFile).size;
assert(sfxBytes <= maxSfxBytes, '音效精灵超过预算: ' + sfxBytes + ' > ' + maxSfxBytes);
const newSpecialSfxFile = path.join(projectRoot, newSpecialSfxPath);
assert(fs.existsSync(newSpecialSfxFile) && fs.statSync(newSpecialSfxFile).isFile(), '新特殊音效不存在');
assert(!isIgnored(newSpecialSfxPath), '新特殊音效被打包规则忽略');
assetPaths.add(newSpecialSfxPath);
const newSpecialSfxBytes = fs.statSync(newSpecialSfxFile).size;
assert(newSpecialSfxBytes <= maxNewSpecialSfxBytes, '新特殊音效超过独立预算');

for (let i = 1; i <= 5; i++) {
    const relative = assets['piece' + i];
    const png = readPng(path.join(projectRoot, relative));
    assert(png.width === 256 && png.height === 256, '运行时棋子尺寸错误: ' + relative);
    assert(png.colorType === 4 || png.colorType === 6, '运行时棋子不含 alpha: ' + relative + ' (color type ' + png.colorType + ')');
}

const unreferenced = walk(resRoot).map(projectRelative).filter(function (relative) {
    return !assetPaths.has(relative);
});
unreferenced.forEach(function (relative) {
    assert(fileIgnoreValues.has(relative), '未引用 res 文件没有精确 file 忽略规则: ' + relative);
});

assert(activeBytes <= maxActiveBytes, '活跃素材超过预算: ' + activeBytes + ' > ' + maxActiveBytes);

['Primary', 'Secondary'].forEach(function (variant) {
    const relative = 'res/home/button-' + variant.toLowerCase() + '.png';
    assert(!Object.prototype.hasOwnProperty.call(assets, 'homeButton' + variant), '未使用的首页按钮不得注册为启动素材');
    assert(fs.existsSync(path.join(projectRoot, relative)) && fileIgnoreValues.has(relative), '首页按钮源图须保留并精确排除: ' + relative);
});

// 运行真实微信分支，按源文件去重，但进度仍按注册键结算。
const startupKeys = Object.keys(assets);
const startupSources = new Set(Object.values(assets));
const assetSource = fs.readFileSync(path.join(projectRoot, 'js/render/assets.js'), 'utf8');
for (const failure of ['none', 'single', 'background']) {
    const requests = [];
    const fixture = { exports: {} };
    vm.runInNewContext(assetSource, {
        module: fixture,
        wx: { createImage: function () { const img = {}; requests.push(img); return img; } }
    });
    const loader = fixture.exports;
    let completed = 0;
    loader.preload(function () { completed++; });
    assert(!loader.isReady() && completed === 0, '异步资源未完成时不得提前就绪');
    assert(loader.getProgress() === 0, '异步资源初始进度须为零');
    assert(requests.length === startupSources.size && new Set(requests.map(img => img.src)).size === requests.length,
        '每个启动源文件须仅请求一个 Image');
    assert(loader.get('homeBackground') === loader.get('gameBackground'), '背景别名须共享同一个 Image');
    let settledKeys = 0;
    requests.slice().reverse().forEach(function (img, index) {
        assert(!isIgnored(img.src) && fs.existsSync(path.join(projectRoot, img.src)), '请求资源必须在发布包中: ' + img.src);
        if ((failure === 'single' && index === 0) || (failure === 'background' && img.src === assets.homeBackground)) img.onerror();
        else img.onload();
        settledKeys += startupKeys.filter(key => assets[key] === img.src).length;
        assert(loader.getProgress() === settledKeys / startupKeys.length, '共享素材成功/失败须按别名键数推进进度');
        assert(completed === (settledKeys === startupKeys.length ? 1 : 0), '全部键结算前不得触发完成回调');
        img.onload();
        img.onerror();
        assert(loader.getProgress() === settledKeys / startupKeys.length, '重复成功/失败回调不得重复结算');
        assert(completed === (settledKeys === startupKeys.length ? 1 : 0), '重复事件不得提前或重复触发完成回调');
    });
    assert(loader.isReady() && loader.getProgress() === 1 && completed === 1, '异步加载完成/失败必须正确结束等待');
}

// 同步开发分支也保留背景别名与逐键完成语义。
const synchronousFixture = { exports: {} };
vm.runInNewContext(assetSource, { module: synchronousFixture });
let synchronousCompleted = 0;
synchronousFixture.exports.preload(function () { synchronousCompleted++; });
assert(synchronousFixture.exports.get('homeBackground') === synchronousFixture.exports.get('gameBackground'), '同步背景别名须共享同一个对象');
assert(synchronousFixture.exports.isReady() && synchronousFixture.exports.getProgress() === 1 && synchronousCompleted === 1,
    '同步资源须结算全部键并仅回调一次');

const estimatedPackageFiles = walk(projectRoot).map(function (file) {
    return { file: file, relative: projectRelative(file) };
}).filter(function (item) {
    return !developerMetadata.has(item.relative) && !isIgnored(item.relative);
});
const isSubpackageFile = function (relative) {
    return packages.some(function (entry) { return relative.startsWith(entry.root + '/'); });
};
const estimatedMainFiles = estimatedPackageFiles.filter(function (item) {
    return !isSubpackageFile(item.relative);
});
const estimatedMainBytes = estimatedMainFiles.reduce(function (total, item) {
    return total + fs.statSync(item.file).size;
}, 0);
assert(estimatedMainBytes <= maxEstimatedMainPackageBytes,
    '静态主包估算超过 4 MiB: ' + estimatedMainBytes + ' > ' + maxEstimatedMainPackageBytes);
const estimatedTotalBytes = estimatedPackageFiles.reduce(function (total, item) {
    return total + fs.statSync(item.file).size;
}, 0);
assert(estimatedTotalBytes <= maxEstimatedTotalPackageBytes,
    '静态总包估算超过 30 MiB: ' + estimatedTotalBytes + ' > ' + maxEstimatedTotalPackageBytes);

console.log('包体预算: 通过');
console.log('启动图片: ' + startupKeys.length + ' keys / ' + startupSources.size + ' unique requests');
console.log('活跃素材: ' + activeBytes + ' bytes / ' + maxActiveBytes + ' bytes');
console.log('结算装饰分包: ' + resultBytes + ' bytes / ' + (1.6 * 1024 * 1024) + ' bytes');
console.log('页面插画分包: ' + illustrationBytes + ' bytes / ' + (1.5 * 1024 * 1024) + ' bytes');
console.log('双 BGM: ' + bgmBytes + ' bytes / ' + maxBgmBytes + ' bytes');
console.log('音效精灵: ' + sfxBytes + ' bytes / ' + maxSfxBytes + ' bytes');
console.log('新特殊音效: ' + newSpecialSfxBytes + ' bytes / ' + maxNewSpecialSfxBytes + ' bytes');
console.log('静态主包估算: ' + estimatedMainBytes + ' bytes / ' + maxEstimatedMainPackageBytes + ' bytes (' + estimatedMainFiles.length + ' files)');
console.log('静态总包估算: ' + estimatedTotalBytes + ' bytes / ' + maxEstimatedTotalPackageBytes + ' bytes (' + estimatedPackageFiles.length + ' files)');
console.log('未引用 res 文件: ' + unreferenced.length + ' 个，均由精确 file 规则覆盖');
