'use strict';

function bounds(screen) {
    const left = Number(screen.safeLeft) || 0, right = Number(screen.safeRight) || 0;
    const base = Math.max(72, Number(screen.contentTop) || Number(screen.safeTop) || 0);
    const headlineY = Math.max(60, (Number(screen.safeTop) || 0) + 14);
    return { left, width: screen.width - left - right, top: base + 6,
        headlineY: headlineY + 12 <= base + 2 ? headlineY : 0,
        bottom: screen.height - (Number(screen.safeBottom) || 0) - 12 };
}

function pvp(screen, columns, rows) {
    const b = bounds(screen), cols = columns || 8, count = rows || 8, space = b.bottom - b.top;
    const compact = space < 560;
    const hudH = compact ? 80 : Math.min(132, Math.round(space * .165));
    const dockH = compact ? 88 : Math.min(164, Math.round(space * .21));
    const gap = compact ? 12 : 20;
    const tileSize = Math.max(1, Math.min(Math.floor((b.width - 12) / cols),
        Math.floor((space - hudH - dockH - gap * 2) / count)));
    const boardW = tileSize * cols, boardH = tileSize * count;
    const spare = Math.max(0, space - hudH - dockH - boardH);
    const boardY = b.top + hudH + Math.floor(spare / 2);
    return { hudY: b.top, hudH, tileSize, boardW, boardH, boardY,
        boardX: Math.floor(b.left + (b.width - boardW) / 2),
        dockY: b.bottom - dockH, dockH,
        headlineY: b.headlineY };
}

function solo(screen, columns, rows, detail) {
    const b = bounds(screen), compact = screen.height < 740, info = detail || {};
    const headerH = compact ? 60 : 68;
    const goalsH = info.moonbuds ? (compact ? 38 : 52) : (!compact || info.goalCount > 2 || info.timed ? 50 : 38);
    const hudH = headerH + goalsH + 8, boardY = b.top + hudH + (compact ? 8 : 12);
    const bottom = screen.height - (Number(screen.safeBottom) || 0) - 116;
    const tileSize = Math.max(1, Math.min(Math.floor((b.width - 4) / columns),
        Math.floor((bottom - boardY) / rows)));
    return { hudY: b.top, hudH, headerH, goalsY: b.top + headerH, goalsH,
        tileSize, boardY, boardW: tileSize * columns, boardH: tileSize * rows,
        boardX: Math.floor(b.left + (b.width - tileSize * columns) / 2),
        headlineY: b.headlineY };
}

module.exports = { pvp, solo };
