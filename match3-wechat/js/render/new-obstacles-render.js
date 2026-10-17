/** Editable moon-garden target silhouettes; no raster or gameplay state. */
const typography = require('./typography');

// The whole rim is foreground UI. The clear centre keeps the cat's face/colour visible.
function moonbud(ctx, x, y, size, open, openness, showLabel) {
    const spread = openness === undefined ? (open ? 1 : 0) : openness;
    ctx.save(); ctx.translate(x, y);
    const edge = size * 0.445;
    const corner = size * (0.10 + spread * 0.16);
    ctx.beginPath();
    ctx.moveTo(-edge + corner, -edge);
    ctx.lineTo(edge - corner, -edge); ctx.quadraticCurveTo(edge, -edge, edge, -edge + corner);
    ctx.lineTo(edge, edge - corner); ctx.quadraticCurveTo(edge, edge, edge - corner, edge);
    ctx.lineTo(-edge + corner, edge); ctx.quadraticCurveTo(-edge, edge, -edge, edge - corner);
    ctx.lineTo(-edge, -edge + corner); ctx.quadraticCurveTo(-edge, -edge, -edge + corner, -edge);
    ctx.closePath();
    ctx.strokeStyle = open ? '#754164' : '#384A89';
    ctx.lineWidth = Math.max(2.6, size * 0.085); ctx.stroke();
    ctx.strokeStyle = open ? '#FFE4A8' : '#A8BDFF';
    ctx.lineWidth = Math.max(1.2, size * 0.035); ctx.stroke();
    // Broad pink petals unfold from slender, upright blue-violet leaves.
    for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 4);
        ctx.translate(0, -size * (0.36 + spread * 0.035));
        ctx.rotate((1 - spread) * (i % 2 ? -0.50 : 0.50));
        ctx.fillStyle = open ? '#F4B4D2' : '#7C8CC7';
        ctx.strokeStyle = open ? '#FFE6AB' : '#D7E2FF';
        ctx.lineWidth = Math.max(1, size * 0.025);
        ctx.beginPath();
        ctx.ellipse(0, 0, size * (0.042 + spread * 0.087), size * (0.115 - spread * 0.025), 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    if (showLabel !== false) moonbudLabel(ctx, x, y, size, open);
}
function moonbudLabel(ctx, x, y, size, open) {
    ctx.save(); ctx.translate(x, y);
    const badgeW = Math.max(12, size * 0.40), badgeH = Math.max(10, size * 0.29);
    const badgeY = size * 0.47 - badgeH;
    ctx.fillStyle = open ? '#FFF0BD' : '#414B86';
    ctx.strokeStyle = open ? '#915475' : '#C9D8FF';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(-badgeW / 2, badgeY, badgeW, badgeH); ctx.fill(); ctx.stroke();
    ctx.fillStyle = open ? '#74335C' : '#FFFFFF';
    typography.drawFit(ctx, open ? '开' : '合', 0, badgeY + badgeH / 2, badgeW - 1, {
        size: Math.max(9, Math.min(15, size * 0.28)), minSize: 9, weight: 'bold', align: 'center'
    });
    ctx.restore();
}
function moonbudEffect(ctx, centerX, centerY, tileSize, effect, reduced) {
    reduced = reduced || effect.reduced;
    const progress = Math.min(1, effect.elapsed / effect.duration);
    const eased = progress * progress * (3 - 2 * progress);
    ctx.save();
    ctx.beginPath(); ctx.rect(centerX - tileSize / 2, centerY - tileSize / 2, tileSize, tileSize); ctx.clip();
    if (effect.kind === 'phase') {
        const spread = Number(effect.fromOpen) + (Number(effect.toOpen) - Number(effect.fromOpen)) * eased;
        // Reduced mode uses fixed endpoint geometry; only its opacity changes.
        ctx.globalAlpha = 1 - eased;
        moonbud(ctx, centerX, centerY, tileSize, effect.fromOpen, reduced ? undefined : spread, false);
        ctx.globalAlpha = eased;
        moonbud(ctx, centerX, centerY, tileSize, effect.toOpen, reduced ? undefined : spread, false);
        ctx.globalAlpha = 1;
        moonbudLabel(ctx, centerX, centerY, tileSize, effect.toOpen);
    } else if (effect.kind === 'closedHit') {
        moonbud(ctx, centerX, centerY, tileSize, false);
        ctx.globalAlpha = 1 - eased;
        ctx.strokeStyle = '#F0E7FF'; ctx.lineWidth = Math.max(2, tileSize * 0.07);
        ctx.beginPath(); ctx.arc(centerX, centerY, tileSize * 0.40, 0, Math.PI * 2); ctx.stroke();
    } else {
        ctx.globalAlpha = 1 - eased;
        const y = centerY - (reduced ? 0 : tileSize * 0.18 * eased);
        moonbud(ctx, centerX, y, tileSize * (reduced ? 1 : 1 - 0.14 * eased), true);
        if (!reduced) {
            ctx.strokeStyle = '#FFE7A8'; ctx.lineWidth = Math.max(2, tileSize * 0.07);
            ctx.beginPath(); ctx.arc(centerX, centerY, tileSize * (0.24 + eased * 0.20), 0, Math.PI * 2); ctx.stroke();
        }
    }
    ctx.restore();
}
function fish(ctx, size) {
    ctx.beginPath();
    ctx.ellipse(-size * 0.025, 0, size * 0.13, size * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.08, 0);
    ctx.lineTo(size * 0.19, -size * 0.09);
    ctx.lineTo(size * 0.19, size * 0.09);
    ctx.closePath(); ctx.fill();
}
function parcel(ctx, x, y, size) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#D8C4A3'; ctx.strokeStyle = '#66557A'; ctx.lineWidth = Math.max(1.5, size * 0.035);
    ctx.beginPath();
    ctx.moveTo(-size * 0.35, -size * 0.24);
    ctx.quadraticCurveTo(0, -size * 0.39, size * 0.35, -size * 0.24);
    ctx.lineTo(size * 0.31, size * 0.28);
    ctx.quadraticCurveTo(0, size * 0.38, -size * 0.31, size * 0.28);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#F5E9F7'; ctx.lineWidth = size * 0.065;
    ctx.beginPath(); ctx.moveTo(0, -size * 0.29); ctx.lineTo(0, size * 0.30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-size * 0.32, -size * 0.10); ctx.lineTo(size * 0.32, -size * 0.10); ctx.stroke();
    ctx.fillStyle = '#504A72'; ctx.translate(0, size * 0.10); fish(ctx, size);
    ctx.restore();
}
function exit(ctx, x, y, size) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#66557A'; ctx.lineWidth = Math.max(3, size * 0.08);
    ctx.beginPath(); ctx.moveTo(-size * 0.29, -size * 0.04);
    ctx.lineTo(-size * 0.29, size * 0.02); ctx.lineTo(size * 0.29, size * 0.02);
    ctx.lineTo(size * 0.29, -size * 0.04); ctx.stroke();
    ctx.strokeStyle = '#F6DCA0'; ctx.lineWidth = Math.max(1.5, size * 0.045); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-size * 0.07, -size * 0.13);
    ctx.lineTo(0, -size * 0.06); ctx.lineTo(size * 0.07, -size * 0.13); ctx.stroke();
    ctx.restore();
}
module.exports = { moonbud, moonbudEffect, parcel, exit };
