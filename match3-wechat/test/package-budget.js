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
const maxEstimatedMainPackageBytes = 4 * 1024 * 1024;
const maxEstimatedTotalPackageBytes = 30 * 1024 * 1024;
const bgmPaths = ['res/audio/calm.mp3', 'res/audio/battle.mp3'];
const sfxPath = 'res/audio/sfx-acoustic.mp3';
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
    return {
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
assert(catalogAssets && Object.keys(catalogAssets).length === 16, '图鉴须注册 16 张成长原画');
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

// 运行真实微信分支，检查背景别名在异步加载下均可用，且不会请求被排除文件。
for (const failOne of [false, true]) {
    const requests = [];
    const fixture = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(projectRoot, 'js/render/assets.js'), 'utf8'), {
        module: fixture,
        wx: { createImage: function () { const img = {}; requests.push(img); return img; } }
    });
    const loader = fixture.exports;
    let completed = 0;
    loader.preload(function () { completed++; });
    assert(!loader.isReady() && completed === 0, '异步资源未完成时不得提前就绪');
    assert(requests.length === Object.keys(assets).length, '预加载数量须与注册键一致');
    requests.slice().reverse().forEach(function (img, index) {
        assert(!isIgnored(img.src) && fs.existsSync(path.join(projectRoot, img.src)), '请求资源必须在发布包中: ' + img.src);
        if (failOne && index === 0) img.onerror();
        else img.onload();
    });
    assert(loader.isReady() && loader.getProgress() === 1 && completed === 1, '异步加载完成/失败必须正确结束等待');
    assert(loader.get('homeBackground').src === loader.get('gameBackground').src, '两种背景入口须加载同一发布文件');
}

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
console.log('活跃素材: ' + activeBytes + ' bytes / ' + maxActiveBytes + ' bytes');
console.log('双 BGM: ' + bgmBytes + ' bytes / ' + maxBgmBytes + ' bytes');
console.log('音效精灵: ' + sfxBytes + ' bytes / ' + maxSfxBytes + ' bytes');
console.log('静态主包估算: ' + estimatedMainBytes + ' bytes / ' + maxEstimatedMainPackageBytes + ' bytes (' + estimatedMainFiles.length + ' files)');
console.log('静态总包估算: ' + estimatedTotalBytes + ' bytes / ' + maxEstimatedTotalPackageBytes + ' bytes (' + estimatedPackageFiles.length + ' files)');
console.log('未引用 res 文件: ' + unreferenced.length + ' 个，均由精确 file 规则覆盖');
