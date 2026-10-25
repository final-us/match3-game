// Passive development-only trace. No touch targets or player state changes.
const Type = require('./typography');
module.exports = function (ctx, screen, lines) {
    if (!lines.length) return;
    const context = lines.filter(line => line.startsWith('D2 ctx')).slice(-2);
    const rows = context.concat(lines.filter(line => !line.startsWith('D2 ctx')).slice(-(6-context.length)));
    const x = 8, y = (screen.safeTop || 0) + 46;
    const w = screen.width - 16;
    ctx.save();
    ctx.fillStyle = 'rgba(12,20,40,.9)';
    ctx.fillRect(x, y, w, 24 + rows.length * 14);
    ctx.fillStyle = '#fff';
    Type.drawFit(ctx, '本地广告诊断 D2 · 不上报', x+6, y+12, w-12, {size:12,minSize:10});
    rows.forEach((line,i) => Type.drawFit(ctx, line, x+6, y+30+i*14, w-12, {size:11,minSize:8}));
    ctx.restore();
};
