/**
 * Canvas 统一排版：中文与数字使用稳定的系统回退栈，所有文本共享 baseline/fit 规则。
 * 不内置字体文件，微信端会按设备可用字体回退。
 */

const CHINESE_FONT_STACK = '"Hiragino Maru Gothic ProN", "PingFang SC", "Microsoft YaHei", sans-serif';
const NUMBER_FONT_STACK = '"Arial Rounded MT Bold", "SF Pro Rounded", "DIN Alternate", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif';
const TEXT_SCALE = 1.1;

function font(size, weight, numbers) {
    const px = Math.max(1, Math.round((Number(size) || 1) * TEXT_SCALE));
    const w = weight || '500';
    return w + ' ' + px + 'px ' + (numbers ? NUMBER_FONT_STACK : CHINESE_FONT_STACK);
}

function set(ctx, size, weight, numbers, align, baseline) {
    ctx.font = font(size, weight, numbers);
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'middle';
}

function measure(ctx, text) {
    if (ctx && typeof ctx.measureText === 'function') return Number(ctx.measureText(String(text)).width) || 0;
    return String(text).length * 8;
}

function fitFontSize(ctx, text, maxWidth, maxSize, minSize, weight, numbers) {
    let size = Math.max(1, Math.round(Number(maxSize) || 1));
    const minimum = Math.max(1, Math.round(Number(minSize) || 1));
    const width = Math.max(0, Number(maxWidth) || 0);
    while (size > minimum) {
        set(ctx, size, weight, numbers);
        if (measure(ctx, text) <= width) break;
        size--;
    }
    return size;
}

function drawFit(ctx, text, x, y, maxWidth, options) {
    const opts = options || {};
    const size = fitFontSize(ctx, text, maxWidth, opts.size || 16, opts.minSize || 10, opts.weight || '500', !!opts.numbers);
    set(ctx, size, opts.weight || '500', !!opts.numbers, opts.align || 'left', opts.baseline || 'middle');
    ctx.fillText(String(text), x, y);
    return size;
}

function drawCentered(ctx, text, x, y, width, height, options) {
    const opts = options || {};
    opts.align = 'center';
    opts.baseline = 'middle';
    return drawFit(ctx, text, x + width / 2, y + height / 2, width, opts);
}

module.exports = {
    CHINESE_FONT_STACK: CHINESE_FONT_STACK,
    NUMBER_FONT_STACK: NUMBER_FONT_STACK,
    font: font,
    set: set,
    measure: measure,
    fitFontSize: fitFontSize,
    drawFit: drawFit,
    drawCentered: drawCentered
};
