/**
 * 校验运行时素材映射、PNG 尺寸、忽略规则和活跃素材包体预算。
 * 用法: node test/package-budget.js
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const resRoot = path.join(projectRoot, 'res');
const assets = require('../js/render/assets').ASSETS;
const config = require('../project.config.json');
const maxActiveBytes = 3.5 * 1024 * 1024;
const maxEstimatedMainPackageBytes = 4 * 1024 * 1024;
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
    assetPaths.add(relative);
    activeBytes += fs.statSync(file).size;
    assert(!isIgnored(relative), '活跃素材被忽略: ' + relative);
});

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

const estimatedMainFiles = walk(projectRoot).map(function (file) {
    return { file: file, relative: projectRelative(file) };
}).filter(function (item) {
    return !developerMetadata.has(item.relative) && !isIgnored(item.relative);
});
const estimatedMainBytes = estimatedMainFiles.reduce(function (total, item) {
    return total + fs.statSync(item.file).size;
}, 0);
assert(estimatedMainBytes <= maxEstimatedMainPackageBytes,
    '静态主包估算超过 4 MiB: ' + estimatedMainBytes + ' > ' + maxEstimatedMainPackageBytes);

console.log('包体预算: 通过');
console.log('活跃素材: ' + activeBytes + ' bytes / ' + maxActiveBytes + ' bytes');
console.log('静态主包估算: ' + estimatedMainBytes + ' bytes / ' + maxEstimatedMainPackageBytes + ' bytes (' + estimatedMainFiles.length + ' files)');
console.log('未引用 res 文件: ' + unreferenced.length + ' 个，均由精确 file 规则覆盖');
