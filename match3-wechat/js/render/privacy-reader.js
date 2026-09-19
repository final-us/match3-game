'use strict';

const typography = require('./typography');
const moon = require('./moon-controls');
const policy = require('../core/privacy-policy');

// 阅读页缓存排版，不在每帧对完整协议重新测量。
let cache = null;
function layout(ctx, width) {
    if (cache && cache.width === width) return cache;
    const lines = [];
    let y = 0;
    function append(text, heading) {
        const size = heading ? 18 : 16;
        const height = heading ? 30 : 28;
        typography.set(ctx, size, heading ? 'bold' : '500');
        let line = '';
        // 按码点换行，中文及长邮箱不会溢出正文宽度。
        for (const ch of Array.from(text)) {
            if (line && typography.measure(ctx, line + ch) > width) {
                lines.push({ text: line, y: y, heading: heading });
                y += height;
                line = '';
            }
            line += ch;
        }
        if (line) { lines.push({ text: line, y: y, heading: heading }); y += height; }
        y += heading ? 6 : 14;
    }
    policy.sections().forEach(function (section, index) {
        if (index) y += 12;
        append(section.title, true);
        section.paragraphs.forEach(function (paragraph) { append(paragraph, false); });
    });
    cache = { width: width, lines: lines, height: Math.max(0, y - 14) };
    return cache;
}

function bounds(screen) {
    const top = Math.max(20, Number(screen.contentTop) || 0, (Number(screen.safeTop) || 0) + 12);
    const bottom = screen.height - (Number(screen.safeBottom) || 0) - 12;
    const width = Math.min(430, screen.width - 28);
    const x = (screen.width - width) / 2;
    const back = { x: x, y: bottom - 48, w: width, h: 48 };
    const navY = back.y - 56;
    return {
        top: top,
        panel: { x: x, y: top + 70, w: width, h: navY - (top + 70) - 10 },
        viewport: { x: x + 18, y: top + 88, w: width - 48, h: navY - (top + 88) - 26 },
        prev: { x: x, y: navY, w: 90, h: 44 },
        next: { x: x + width - 90, y: navY, w: 90, h: 44 },
        back: back
    };
}

function clamp(offset, max) {
    return Math.max(0, Math.min(max, Number(offset) || 0));
}

function draw(ctx, screen, requestedOffset) {
    const b = bounds(screen);
    const text = layout(ctx, b.viewport.w);
    const maxScroll = Math.max(0, text.height - b.viewport.h);
    const offset = clamp(requestedOffset, maxScroll);
    const cx = screen.width / 2;
    ctx.save();
    moon.panel(ctx, screen, b.panel.x, b.top - 6, b.panel.w, 66);
    ctx.fillStyle = '#293B63';
    typography.drawFit(ctx, '隐私保护指引', cx, b.top + 15, b.panel.w, { size: 24, weight: 'bold', align: 'center' });
    typography.drawFit(ctx, policy.publication.approvedForRelease ? '猫猫开心消 · 可离线阅读' : '正文待确认 · 暂勿送审', cx, b.top + 48,
        b.panel.w, { size: 13, minSize: 12, align: 'center' });
    moon.panel(ctx, screen, b.panel.x, b.panel.y, b.panel.w, b.panel.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.viewport.x, b.viewport.y, b.viewport.w, b.viewport.h);
    ctx.clip();
    text.lines.forEach(function (line) {
        const y = b.viewport.y + line.y - offset;
        if (y + 28 < b.viewport.y || y > b.viewport.y + b.viewport.h) return;
        ctx.fillStyle = '#293B63';
        typography.set(ctx, line.heading ? 18 : 16, line.heading ? 'bold' : '500', false, 'left', 'top');
        ctx.fillText(line.text, b.viewport.x, y);
    });
    ctx.restore();
    const barX = b.panel.x + b.panel.w - 16;
    const thumbH = Math.max(24, b.viewport.h * b.viewport.h / text.height);
    ctx.fillStyle = '#DADDEA';
    ctx.fillRect(barX, b.viewport.y, 3, b.viewport.h);
    ctx.fillStyle = '#687CAB';
    ctx.fillRect(barX, b.viewport.y + (maxScroll ? offset / maxScroll : 0) * (b.viewport.h - thumbH), 3, thumbH);
    const prevEnabled = offset > 0;
    const nextEnabled = offset < maxScroll;
    ctx.globalAlpha = prevEnabled ? 1 : 0.5;
    moon.button(ctx, b.prev.x, b.prev.y, b.prev.w, b.prev.h, '上一屏', 'blue', 15);
    ctx.globalAlpha = nextEnabled ? 1 : 0.5;
    moon.button(ctx, b.next.x, b.next.y, b.next.w, b.next.h, '下一屏', 'blue', 15);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#293B63';
    ctx.fillStyle = '#F6F4FF';
    ctx.fillRect(b.prev.x + b.prev.w + 4, b.prev.y + 8, b.panel.w - 188, 28);
    ctx.fillStyle = '#293B63';
    typography.drawFit(ctx, nextEnabled ? '上下滑动' : '已到末尾', cx, b.prev.y + 22, b.panel.w - 188,
        { size: 12, minSize: 11, align: 'center' });
    moon.button(ctx, b.back.x, b.back.y, b.back.w, b.back.h, '返回设置', 'blue', 17);
    ctx.restore();
    return Object.assign(b, {
        offset: offset, maxScroll: maxScroll, step: Math.max(28, b.viewport.h - 56),
        prevEnabled: prevEnabled, nextEnabled: nextEnabled
    });
}

module.exports = { draw: draw, layout: layout, bounds: bounds, clamp: clamp };
