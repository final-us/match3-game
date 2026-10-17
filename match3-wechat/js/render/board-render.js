/**
 * 棋盘渲染 + 动画 + 触摸交互（canvas 2D）
 * 视觉棋子（piece）与逻辑棋盘（grid）分离：
 *   - 逻辑层 grid 存 type，用于匹配计算
 *   - 视觉层 pieces 存显示位置/缩放/透明度，用于动画插值
 * 二者通过动画回调（animateSwap/animateMatch/animateGravity/animateFill）同步
 * 素材：猫咪 UI（assets.js 加载）
 */

const config = require('../core/config');
const coin = require('../core/coin');
const AudioFX = require('../audio');
const specialTriggerDelays = require('../special-trigger-timing');
const assets = require('./assets');
const THEME = require('./theme');
const typography = require('./typography');
const newObstacles = require('./new-obstacles-render');
const PARCEL_TYPE = (config.OBJECT_TYPES && config.OBJECT_TYPES.PARCEL) || 201;
const moon = require('./moon-controls');
const gameLayout = require('./game-layout');

function drawImageCover(ctx, img, w, h) {
    if (!img || !img.width || !img.height) return false;
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
    return true;
}

function drawImageContain(ctx, img, x, y, w, h) {
    if (!img || !img.width || !img.height) return false;
    const scale = Math.min(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return true;
}

function specialBaseType(type) {
    if (type === config.SPECIAL_TYPES.TRACKING_PAW) return 1;
    if (type === config.SPECIAL_TYPES.COLOR_BELL) return 5;
    if (type === config.SPECIAL_TYPES.H_ROCKET) return 2;
    if (type === config.SPECIAL_TYPES.V_ROCKET) return 3;
    if (type === config.SPECIAL_TYPES.COLOR_BALL) return 5;
    return 4;
}

function drawTrackingPaw(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    const beam = assets.get('uiSpecialRowBeam');
    if (beam && beam.width > 0) {
        ctx.drawImage(beam, beam.width * 0.34, 0, beam.width * 0.32, beam.height,
            -size / 2, -size / 2, size, size);
    } else {
        ctx.scale(size, size);
        ctx.fillStyle = '#FFD4F0';
        ctx.beginPath();
        ctx.ellipse(0, 0.15, 0.22, 0.17, 0, 0, Math.PI * 2);
        ctx.fill();
        [-0.27, -0.09, 0.09, 0.27].forEach(function (offset) {
            ctx.beginPath();
            ctx.ellipse(offset, Math.abs(offset) > 0.2 ? -0.08 : -0.22, 0.07, 0.09, 0, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    ctx.restore();
}

function drawColorBell(ctx, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    const pearl = ctx.createLinearGradient(-0.3, -0.32, 0.32, 0.3);
    pearl.addColorStop(0, '#FFFFFF');
    pearl.addColorStop(0.28, '#FFE4F6');
    pearl.addColorStop(0.66, '#D8A8F2');
    pearl.addColorStop(1, '#7C5CE7');
    const gold = ctx.createLinearGradient(-0.34, 0.17, 0.34, 0.32);
    gold.addColorStop(0, '#B57B33');
    gold.addColorStop(0.32, '#FFF0B9');
    gold.addColorStop(0.64, '#E9BF6D');
    gold.addColorStop(1, '#A0692F');
    ctx.fillStyle = 'rgba(63,39,82,0.22)';
    ctx.beginPath();
    ctx.ellipse(0.02, 0.4, 0.32, 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#A97635';
    ctx.lineWidth = 0.032;
    ctx.fillStyle = '#FFEDAE';
    ctx.beginPath();
    ctx.arc(0, -0.34, 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pearl;
    ctx.beginPath();
    ctx.moveTo(-0.32, 0.23);
    ctx.bezierCurveTo(-0.2, 0.11, -0.26, -0.25, 0, -0.25);
    ctx.bezierCurveTo(0.26, -0.25, 0.2, 0.11, 0.32, 0.23);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#8A5A2E';
    ctx.lineWidth = 0.022;
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.ellipse(0, 0.24, 0.34, 0.065, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFDF2';
    ctx.beginPath();
    ctx.arc(0, -0.02, 0.145, 0, Math.PI * 2);
    ctx.fill();
    const gem = ctx.createRadialGradient(-0.05, -0.065, 0.01, 0, -0.02, 0.15);
    gem.addColorStop(0, '#FFFFFF');
    gem.addColorStop(0.35, color);
    gem.addColorStop(1, '#6D6686');
    ctx.fillStyle = gem;
    ctx.beginPath();
    ctx.arc(0, -0.025, 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D5B783';
    ctx.lineWidth = 0.015;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(-0.16, 0.1);
    ctx.bezierCurveTo(-0.18, 0.025, -0.17, -0.13, -0.09, -0.17);
    ctx.stroke();
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(0, 0.34, 0.065, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawSparkle(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x + size * 0.2, y - size * 0.2, x + size, y);
    ctx.quadraticCurveTo(x + size * 0.2, y + size * 0.2, x, y + size);
    ctx.quadraticCurveTo(x - size * 0.2, y + size * 0.2, x - size, y);
    ctx.quadraticCurveTo(x - size * 0.2, y - size * 0.2, x, y - size);
    ctx.fill();
}

function bellColor(type) {
    const image = assets.get('piece' + type);
    const definition = config.getPieceTypeDef(type);
    const colors = ['#FFE29A', '#FF8FAB', '#8ED1F4', '#C9B6F0', '#A8E6A3'];
    return image && image.width > 0 ? (colors[type - 1] || '#FFE29A') :
        (definition ? definition.color : '#FFE29A');
}

function jellyPath(ctx, centerX, centerY, radius) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius * 0.98);
    ctx.bezierCurveTo(centerX + radius * 0.27, centerY - radius * 1.11, centerX + radius * 0.48, centerY - radius * 0.95, centerX + radius * 0.68, centerY - radius * 0.83);
    ctx.bezierCurveTo(centerX + radius * 0.94, centerY - radius * 0.71, centerX + radius * 1.08, centerY - radius * 0.43, centerX + radius * 1.01, centerY - radius * 0.18);
    ctx.bezierCurveTo(centerX + radius * 1.14, centerY + radius * 0.08, centerX + radius * 1.03, centerY + radius * 0.34, centerX + radius * 0.85, centerY + radius * 0.5);
    ctx.bezierCurveTo(centerX + radius * 0.84, centerY + radius * 0.78, centerX + radius * 0.58, centerY + radius * 0.97, centerX + radius * 0.29, centerY + radius * 0.92);
    ctx.bezierCurveTo(centerX + radius * 0.07, centerY + radius * 1.09, centerX - radius * 0.2, centerY + radius * 1.03, centerX - radius * 0.39, centerY + radius * 0.9);
    ctx.bezierCurveTo(centerX - radius * 0.7, centerY + radius * 0.96, centerX - radius * 0.96, centerY + radius * 0.75, centerX - radius * 0.92, centerY + radius * 0.45);
    ctx.bezierCurveTo(centerX - radius * 1.13, centerY + radius * 0.23, centerX - radius * 1.09, centerY - radius * 0.1, centerX - radius * 0.97, centerY - radius * 0.34);
    ctx.bezierCurveTo(centerX - radius * 1.02, centerY - radius * 0.66, centerX - radius * 0.78, centerY - radius * 0.88, centerX - radius * 0.48, centerY - radius * 0.87);
    ctx.bezierCurveTo(centerX - radius * 0.3, centerY - radius * 1.05, centerX - radius * 0.13, centerY - radius * 1.03, centerX, centerY - radius * 0.98);
    ctx.closePath();
}

class BoardRenderer {
    constructor(ctx, screen) {
        this.ctx = ctx;
        this.screen = screen;
        this.core = null;
        this.tileSize = 0;
        this.boardX = 0;
        this.boardY = 0;
        this.boardW = 0;
        this.boardH = 0;

        // 视觉棋子列表
        this.pieces = [];
        this.nextId = 1;

        // 粒子系统（碎屑效果）
        this.particles = [];
        this.specialEffects = [];
        this.moonbudEffects = [];
        this.moonbudFeedback = null;
        this.invalidSwapFeedback = null;
        this.pressFeedback = null;
        this.reshuffleFeedback = null;

        // 触摸状态
        this.touchStartPos = null;
        this.touchStartGrid = null;
        this.touchMoved = false;
        this.pressGrid = null;

        // 道具栏状态
        this.tools = [];
        this.toolsCount = { hammer: 0, bomb: 0, color: 0 };
        this.selectedTool = null;
        this.onToolUsed = null; // 由 Main 绑定（道具使用回调）
        this.onToolAd = null;
        this.toolAdAvailable = false;
        this.toolAdPending = false;
        this.toolAdTouch = null;
        this.battleMode = false; // 双人对战模式：不画单机顶部栏/道具栏
        this.pvpLayout = false; // 每日挑战与双人对战分别排布
    }

    /** 设置道具数量并计算道具栏位置 */
    setTools(items) {
        this.toolsCount = {
            hammer: items.hammer || 0,
            bomb: items.bomb || 0,
            color: items.color || 0
        };
        if (this.selectedTool && this.toolsCount[this.selectedTool] <= 0) {
            this.selectedTool = null;
        }
        const types = ['hammer', 'bomb', 'color'];
        const r = 35;
        const gap = Math.min(108, (this.screen.width - 92) / 2);
        const startX = (this.screen.width - (types.length - 1) * gap) / 2;
        const lowest = this.screen.height - (Number(this.screen.safeBottom) || 0) - 62;
        const y = Math.min(lowest, this.boardY + this.boardH + 64);
        this.tools = [];
        for (let i = 0; i < types.length; i++) {
            const x = startX + i * gap;
            this.tools.push({ type: types[i], x: x, y: y, r: r,
                adRect: { x: x + r * 0.62 - 22, y: y - r * 0.62 - 22, w: 44, h: 44 } });
        }
    }

    /** 绘制底部道具栏（3 个道具 + 数量角标） */
    drawTools() {
        const ctx = this.ctx;
        const defs = coin.ITEM_DEFS;
        if (this.tools.length) {
            const left = this.tools[0].x - 48;
            const right = this.tools[this.tools.length - 1].x + 48;
            ctx.fillStyle = THEME.glassBgSoft;
            this.roundRect(left, this.tools[0].y - 44, right - left, 104, 30);
            ctx.fill();
            ctx.strokeStyle = THEME.glassBorder;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        for (let i = 0; i < this.tools.length; i++) {
            const t = this.tools[i];
            const def = defs[t.type];
            const count = this.toolsCount[t.type];
            const selected = this.selectedTool === t.type;

            // 圆形底（选中高亮）
            ctx.fillStyle = selected ? THEME.primary : 'rgba(255,245,252,0.42)';
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = selected ? THEME.gold : THEME.glassBorder;
            ctx.lineWidth = selected ? 3 : 2;
            ctx.stroke();

            // 图标
            const key = t.type === 'hammer' ? 'uiToolHammer' : (t.type === 'bomb' ? 'uiToolBomb' : 'uiToolYarn');
            const img = assets.get(key);
            const iconSize = t.r * 1.55;
            if (img && img.width > 0) {
                ctx.drawImage(img, t.x - iconSize / 2, t.y - iconSize / 2, iconSize, iconSize);
            } else {
                ctx.fillStyle = '#FFF4FB';
                typography.drawFit(ctx, def.name, t.x, t.y, t.r * 1.6, {
                    size: 12, minSize: 8, weight: 'bold', align: 'center'
                });
            }

            ctx.fillStyle = THEME.textDark;
            typography.drawFit(ctx, def.name, t.x, t.y + 49, 88, {
                size: 13, minSize: 11, weight: 'bold', align: 'center'
            });
            // 沿用原数量角标；仅零库存且广告可用时替换为同风格加号。
            const canAdd = count === 0 && this.toolAdAvailable && this.onToolAd && !this.battleMode;
            ctx.fillStyle = THEME.primary;
            ctx.beginPath();
            ctx.arc(t.x + t.r * 0.62, t.y - t.r * 0.62, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            if (canAdd) {
                // 对称笔画直接以圆心定位，不受字体的加号基线偏移影响。
                const cx = t.x + t.r * 0.62, cy = t.y - t.r * 0.62;
                ctx.save();
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(cx - 3.5, cy); ctx.lineTo(cx + 3.5, cy);
                ctx.moveTo(cx, cy - 3.5); ctx.lineTo(cx, cy + 3.5);
                ctx.stroke();
                ctx.restore();
            } else {
                typography.drawFit(ctx, String(count), t.x + t.r * 0.62, t.y - t.r * 0.62 + 1, 18, {
                    size: 11, minSize: 8, weight: 'bold', numbers: true, align: 'center'
                });
            }
        }
    }

    /** 绑定游戏核心，并从 grid 初始化视觉棋子 */
    setGame(core) {
        this.invalidSwapFeedback = null;
        this.pressFeedback = null;
        this.reshuffleFeedback = null;
        this.core = core;
        this.visualMoonbuds = Object.assign({}, core.moonbudCells || {});
        this.visualMoonbudOpen = core.moonbudOpen !== false;
        this.visualParcelDelivered = core.parcelDelivered || 0;
        this.specialEffects = [];
        this.moonbudEffects = [];
        this.moonbudFeedback = null;
        this.particles = [];
        this.computeLayout();
        this.syncPiecesFromGrid();
    }

    /** 计算棋盘布局（适配屏幕宽度） */
    computeLayout() {
        const cols = this.core.level.columns;
        const rows = this.core.level.rows;
        const safeLeft = Number(this.screen.safeLeft) || 0;
        const safeRight = Number(this.screen.safeRight) || 0;
        const safeWidth = Math.max(0, this.screen.width - safeLeft - safeRight);
        const margin = this.battleMode ? 6 : 2;
        const widthTileSize = Math.floor((safeWidth - margin * 2) / cols);
        if (this.battleMode) {
            if (this.pvpLayout) {
                const layout = gameLayout.pvp(this.screen, cols, rows);
                this.tileSize = layout.tileSize;
                this.boardW = layout.boardW; this.boardH = layout.boardH;
                this.boardX = layout.boardX; this.boardY = layout.boardY;
                return;
            }
            const top = Math.max(72, Number(this.screen.contentTop) || Number(this.screen.safeTop) || 0) + 96;
            const bottom = this.screen.height - (Number(this.screen.safeBottom) || 0) - 104;
            const availableHeight = Math.max(rows, bottom - top);
            this.tileSize = Math.max(1, Math.min(widthTileSize, Math.floor(availableHeight / rows)));
            this.boardW = this.tileSize * cols;
            this.boardH = this.tileSize * rows;
            this.boardX = Math.floor(safeLeft + (safeWidth - this.boardW) / 2);
            this.boardY = Math.floor(top + (availableHeight - this.boardH) / 2);
            return;
        }

        const layout = gameLayout.solo(this.screen, cols, rows, {
            moonbuds: this.core.level.moonbuds && this.core.level.moonbuds.length,
            timed: this.core.timeLimitMs > 0,
            goalCount: (this.core.level.goals || []).length
        });
        this.tileSize = layout.tileSize;
        this.boardW = layout.boardW; this.boardH = layout.boardH;
        this.boardX = layout.boardX; this.boardY = layout.boardY;
    }

    /** 从逻辑 grid 一次性建立视觉棋子（初始状态，无动画） */
    syncPiecesFromGrid() {
        this.pieces = [];
        const grid = this.core.grid;
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                const type = grid[r][c];
                if (type) {
                    const piece = this.makePiece(type, r, c);
                    const pos = this.pieceCenter(r, c);
                    piece.x = piece.targetX = pos.x;
                    piece.y = piece.targetY = pos.y;
                    this.pieces.push(piece);
                }
            }
        }
    }

    /** 死局重排动画：重建所有视觉棋子 */
    animateReshuffle() {
        const oldPieces = this.pieces.slice();
        this.syncPiecesFromGrid();
        this.pressFeedback = null;
        if (this.screen.reduceEffects || !oldPieces.length) {
            this.reshuffleFeedback = null;
            return this.wait(100);
        }
        this.reshuffleFeedback = { oldPieces: oldPieces, elapsed: 0 };
        return this.wait(220);
    }

    /** 创建一个视觉棋子对象 */
    makePiece(type, row, col) {
        return {
            id: this.nextId++,
            type: type,
            row: row,
            col: col,
            x: 0, y: 0,
            targetX: 0, targetY: 0,
            scale: 1, targetScale: 1,
            alpha: 1,
            dying: false,
            baseType: config.isSpecialType(type)
                ? ((this.core && this.core.getSpecialBaseType({ row: row, column: col })) || specialBaseType(type))
                : type
        };
    }

    /** 格子中心像素坐标 */
    pieceCenter(row, col) {
        return {
            x: this.boardX + col * this.tileSize + this.tileSize / 2,
            y: this.boardY + row * this.tileSize + this.tileSize / 2
        };
    }

    /** 按逻辑位置找视觉棋子（排除正在消失的） */
    findPiece(row, col) {
        for (let i = 0; i < this.pieces.length; i++) {
            const p = this.pieces[i];
            if (!p.dying && p.row === row && p.col === col) return p;
        }
        return null;
    }

    /** 更新棋子的逻辑位置和目标像素坐标 */
    movePieceTo(piece, row, col) {
        piece.row = row;
        piece.col = col;
        const pos = this.pieceCenter(row, col);
        piece.targetX = pos.x;
        piece.targetY = pos.y;
    }

    /** Promise 延时工具 */
    wait(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    // ===== 动画回调（供 game-core 调用，返回 Promise）=====

    /** 交换动画：两棋子滑向对方位置，带粉碎粒子效果 */
    animateSwap(from, to) {
        const a = this.findPiece(from.row, from.column);
        const b = this.findPiece(to.row, to.column);
        if (!a || !b) return this.wait(200);

        // 交换起始：在两个棋子位置爆发碎屑粒子（粉碎效果）
        const colorA = config.getPieceTypeDef(a.type);
        const colorB = config.getPieceTypeDef(b.type);
        const fromCenter = this.pieceCenter(from.row, from.column);
        const toCenter = this.pieceCenter(to.row, to.column);
        this.spawnBurst(fromCenter.x, fromCenter.y, colorA ? [colorA.color] : ['#888888']);
        this.spawnBurst(toCenter.x, toCenter.y, colorB ? [colorB.color] : ['#888888']);

        this.movePieceTo(a, to.row, to.column);
        this.movePieceTo(b, from.row, from.column);
        return this.wait(220);
    }

    /** 无效换位：小幅顶碰、回弹、轻抖归位；只动显示层，不改格子位置。 */
    parcelHint(pos) {
        if (this.core && this.core.isParcel && this.core.isParcel(pos) && typeof wx !== 'undefined' && wx.showToast) {
            wx.showToast({ title: '清理下方，送到出口', icon: 'none', duration: 1400 });
        }
    }

    animateInvalidSwap(from, to) {
        this.parcelHint(from);
        if (!(this.core.isParcel && this.core.isParcel(from))) this.parcelHint(to);
        if (this.invalidSwapFeedback) return this.invalidSwapFeedback.promise;
        const a = this.findPiece(from.row, from.column);
        const b = this.findPiece(to.row, to.column);
        if (!a || !b) return Promise.resolve();
        const feedback = {
            from: { row: from.row, column: from.column },
            to: { row: to.row, column: to.column },
            elapsed: 0,
            duration: this.screen.reduceEffects ? 180 : 240,
            distance: Math.min(this.screen.reduceEffects ? 3 : 7, this.tileSize * 0.14)
        };
        this.pressGrid = null;
        this.invalidSwapFeedback = feedback;
        feedback.promise = this.wait(feedback.duration).finally(() => {
            // 后台计时到期或重绑棋盘后均不会留下位移，也不清除新棋盘的反馈。
            if (this.invalidSwapFeedback === feedback) this.invalidSwapFeedback = null;
        });
        return feedback.promise;
    }

    /** 棋子与障碍罩共享同一偏移，冰块/果冻只能轻颤，不能像成功换位一样滑走。 */
    invalidSwapOffset(row, column) {
        const f = this.invalidSwapFeedback;
        if (!f) return null;
        const sign = row === f.from.row && column === f.from.column ? 1
            : (row === f.to.row && column === f.to.column ? -1 : 0);
        if (!sign) return null;
        const t = Math.min(1, f.elapsed / f.duration);
        // 一次主撞击、一次反向回弹和更轻的余振；分段smoothstep保持圆润。
        const times = [0, 0.2, 0.46, 0.7, 1];
        const values = [0, 1, -0.42, 0.18, 0];
        let segment = 0;
        while (segment < 3 && t > times[segment + 1]) segment++;
        const p = (t - times[segment]) / (times[segment + 1] - times[segment]);
        const eased = p * p * (3 - 2 * p);
        const blockedScale = this.core.isBlocked({ row: row, column: column }) ? 0.55 : 1;
        const offset = (values[segment] + (values[segment + 1] - values[segment]) * eased)
            * f.distance * sign * blockedScale;
        return { x: (f.to.column - f.from.column) * offset, y: (f.to.row - f.from.row) * offset };
    }

    /** 爆发一组碎屑粒子 */
    spawnBurst(x, y, colors, count) {
        if (this.screen.reduceEffects) return;
        count = count || 12;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 140;
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 40,
                life: 0,
                maxLife: 260 + Math.random() * 160,
                size: 2 + Math.random() * 3,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
    }

    spawnSpecialEffect(type, x, y, delay) {
        this.specialEffects.push({ type: type, x: x, y: y, life: delay ? -delay : 0, maxLife: this.screen.reduceEffects ? 180 : 420 });
    }

    /**
     * Add the moon-crystal overlay for one match payload.  The core deliberately
     * uses the core's explicit specialCombo contract plus the actual
     * removed/jelly/ice footprint. Chained specials stay local.
     */
    spawnMatchEffects(data) {
        const triggered = data.triggeredSpecials || [];
        const delays = specialTriggerDelays(data, this.screen.reduceEffects);
        const pawArrival = (this.screen.reduceEffects ? 200 : 560) * 0.64;
        const timing = { impact: 0, dye: 0, sources: [] };
        const footprint = (data.removed || []).concat(data.jellyHits || [], data.iceHits || []);
        const enhanced = data.specialCombo && data.specialCombo.kind;
        const combo = data.specialCombo && [data.specialCombo.first.type, data.specialCombo.second.type].every(function (type) {
            return type !== config.SPECIAL_TYPES.TRACKING_PAW && type !== config.SPECIAL_TYPES.COLOR_BELL;
        }) ? data.specialCombo : null;

        if (enhanced) {
            const center = this.pieceCenter(data.specialCombo.center.row, data.specialCombo.center.column);
            this.specialEffects.push({ kind: 'color', x: center.x, y: center.y,
                targets: [data.specialCombo.first, data.specialCombo.second], life: 0,
                maxLife: this.screen.reduceEffects ? 180 : 420 });
        }

        if (combo) {
            const a = combo.first.type;
            const b = combo.second.type;
            const center = this.pieceCenter(combo.second.row, combo.second.column);
            let kind = '';
            if (a === config.SPECIAL_TYPES.COLOR_BALL && b === config.SPECIAL_TYPES.COLOR_BALL) kind = 'screen';
            else if (a === config.SPECIAL_TYPES.COLOR_BALL || b === config.SPECIAL_TYPES.COLOR_BALL) kind = 'color';
            else if ((a === config.SPECIAL_TYPES.H_ROCKET || a === config.SPECIAL_TYPES.V_ROCKET) &&
                (b === config.SPECIAL_TYPES.H_ROCKET || b === config.SPECIAL_TYPES.V_ROCKET)) kind = 'cross';
            else if (((a === config.SPECIAL_TYPES.H_ROCKET || a === config.SPECIAL_TYPES.V_ROCKET) && b === config.SPECIAL_TYPES.BOMB) ||
                ((b === config.SPECIAL_TYPES.H_ROCKET || b === config.SPECIAL_TYPES.V_ROCKET) && a === config.SPECIAL_TYPES.BOMB)) kind = 'tripleCross';
            else if (a === config.SPECIAL_TYPES.BOMB && b === config.SPECIAL_TYPES.BOMB) kind = 'square';
            if (kind) {
                this.specialEffects.push({ kind: kind, x: center.x, y: center.y, targets: footprint,
                    life: 0, maxLife: this.screen.reduceEffects ? 180 : 420 });
            }
        }

        // Draw ordinary or chained triggers only at their own real origin.
        for (let i = 0; i < triggered.length; i++) {
            const item = triggered[i];
            const delay = delays[i];
            timing.sources.push({ source: item, delay: delay });
            if (combo && ((item.row === combo.first.row && item.column === combo.first.column && item.type === combo.first.type) ||
                (item.row === combo.second.row && item.column === combo.second.column && item.type === combo.second.type))) continue;
            if (!config.isSpecialType(item.type)) continue;
            const origin = item.effectOrigin || item;
            const center = this.pieceCenter(origin.row, origin.column);
            if (item.after) timing.impact = Math.max(timing.impact, delay);
            if (item.type === config.SPECIAL_TYPES.TRACKING_PAW && item.target) {
                timing.impact = Math.max(timing.impact, delay + pawArrival);
                (item.pawTargets || [item]).forEach(impact => {
                    this.specialEffects.push({ type: item.type, x: center.x, y: center.y,
                        ...impact, destination: this.pieceCenter(impact.target.row, impact.target.column),
                        carriedType: item.carriedType, skipObstacleHold: !!enhanced,
                        life: delay ? -delay : 0, maxLife: this.screen.reduceEffects ? 200 : 560 });
                });
            } else if (item.type === config.SPECIAL_TYPES.COLOR_BELL) {
                timing.dye = Math.max(timing.dye, delay);
                this.specialEffects.push({ type: item.type, x: center.x, y: center.y, color: item.color,
                    changes: item.replicas || item.colorChanges || [], life: delay ? -delay : 0,
                    maxLife: this.screen.reduceEffects ? 180 : 440 });
            } else this.spawnSpecialEffect(item.type, center.x, center.y, delay);
        }
        if (enhanced) {
            const removed = data.removed || [];
            (data.specialCombo.obstacleSnapshots || []).forEach(snapshot => {
                const position = snapshot.target;
                const hitDelay = cell => {
                    const times = timing.sources.map(({ source, delay }) =>
                        specialTriggerDelays.hitTime(source, cell, delay, this.screen.reduceEffects));
                    const earliest = Math.min(...times);
                    return !Number.isFinite(earliest) && removed.some(item => item.row === cell.row && item.column === cell.column) ? 0 : earliest;
                };
                let delay = hitDelay(position);
                if (snapshot.targetIce || snapshot.targetYarnHealth) {
                    removed.filter(cell => Math.abs(cell.row - position.row) + Math.abs(cell.column - position.column) === 1)
                        .forEach(cell => { delay = Math.min(delay, hitDelay(cell)); });
                }
                if (delay > 0 && Number.isFinite(delay)) {
                    this.specialEffects.push({ kind: 'hitHold', ...snapshot, life: -delay, maxLife: 1 });
                }
            });
        }
        return timing;
    }

    /** 消除动画：棋子缩小消失 + 碎屑粒子 + 障碍反馈 + 特殊棋子生成（含连消触发的消除） */
    async animateMatch(data) {
        const removed = data.removed;
        const jellyHits = data.jellyHits || [];
        const iceHits = data.iceHits || [];
        const generated = data.generated || [];
        const targets = [];
        const effectTiming = this.spawnMatchEffects(data);
        const boundCore = this.core;
        const closedHits = data.moonbudClosedHits || [];
        const moonbudTargets = (data.moonbudHits || []).map(pos => ({ pos, kind: 'collect' }))
            .concat(closedHits.map(pos => ({ pos, kind: 'closedHit' })));
        const moonbudPhases = moonbudTargets.map(async ({ pos, kind }) => {
            // Use the first real special footprint that reaches this cell, including
            // rockets/bombs relayed by a remote paw. Keep the existing cat timing.
            const hitTimes = effectTiming.sources.flatMap(({ source, delay }) => {
                const time = specialTriggerDelays.hitTime(source, pos, delay, this.screen.reduceEffects);
                return Number.isFinite(time) ? [time] : [];
            });
            const delay = hitTimes.length ? Math.min(...hitTimes) : effectTiming.impact;
            if (delay) await this.wait(Math.ceil(delay));
            if (this.core !== boundCore) return;
            const key = pos.row + ':' + pos.column;
            if (!this.visualMoonbuds[key]) return;
            this.addMoonbudEffect(key, kind, kind === 'collect', kind === 'collect');
            if (kind === 'closedHit') {
                this.moonbudFeedback = { kind: 'closedHit', elapsed: 0, duration: 1800 };
            } else {
                delete this.visualMoonbuds[key];
                const center = this.pieceCenter(pos.row, pos.column);
                this.spawnBurst(center.x, center.y, ['#EFC9F0', '#EAF2FF'], 6);
            }
        });
        const dyeGroups = new Map();
        const dyeStates = new Map();
        let dyeOrder = 0;
        const groupDyes = (delay, changes) => {
            changes.forEach((change) => {
                const piece = this.findPiece(change.row, change.column);
                const key = change.row + ':' + change.column;
                if (!piece) return;
                if (!dyeStates.has(key)) {
                    dyeStates.set(key, { piece: piece, appliedOrder: -1 });
                    piece.type = change.previousType;
                }
                if (!dyeGroups.has(delay)) dyeGroups.set(delay, new Map());
                dyeGroups.get(delay).set(key, { state: dyeStates.get(key), type: change.type, order: dyeOrder++ });
            });
        };
        effectTiming.sources.forEach(({ source, delay }) => {
            if (source.type === config.SPECIAL_TYPES.COLOR_BELL) groupDyes(delay, source.colorChanges || []);
        });
        if (!dyeGroups.size) groupDyes(0, data.colorChanges || []);
        const phases = moonbudPhases.concat(effectTiming.sources.filter(({ source }) => {
            return source.type === config.SPECIAL_TYPES.TRACKING_PAW && source.target;
        }).map(async ({ source, delay }) => {
            if (delay) await this.wait(Math.ceil(delay));
            removed.forEach((position) => {
                if (Math.abs(position.row - source.row) + Math.abs(position.column - source.column) > 1) return;
                const piece = this.findPiece(position.row, position.column);
                if (!piece) return;
                piece.targetScale = 0;
                piece.dying = true;
                const center = this.pieceCenter(position.row, position.column);
                this.spawnBurst(center.x, center.y, ['#FFD3E5', '#FFF5CB'], 6);
            });
        }));
        effectTiming.sources.forEach(({ source, delay }) => {
            if (!source.replicas || !source.replicas.length) return;
            const replicas = source.replicas.map(change => ({ change, piece: this.findPiece(change.row, change.column) }));
            replicas.forEach(({ change, piece }) => { if (piece) piece.type = change.previousType; });
            phases.push((async () => {
                if (delay) await this.wait(Math.ceil(delay));
                await this.wait(this.screen.reduceEffects ? 40 : 100);
                if (this.core !== boundCore) return;
                replicas.forEach(({ change, piece }) => {
                    if (!piece || piece.dying) return;
                    piece.type = change.type;
                    piece.baseType = change.previousType;
                    piece.targetScale = this.screen.reduceEffects ? 1 : 1.18;
                });
                await this.wait(this.screen.reduceEffects ? 20 : 60);
                replicas.forEach(({ piece }) => { if (piece && !piece.dying) piece.targetScale = 1; });
            })());
        });
        dyeGroups.forEach((changes, delay) => {
            phases.push((async () => {
                if (delay) await this.wait(Math.ceil(delay));
                const changed = [];
                changes.forEach((change) => {
                    const piece = change.state.piece;
                    if (piece.dying || change.state.appliedOrder > change.order) return;
                    change.previousType = piece.type;
                    changed.push(change);
                    piece.targetScale = this.screen.reduceEffects ? 1 : 0.9;
                });
                await this.wait(this.screen.reduceEffects ? 40 : 100);
                changed.forEach((change) => {
                    const piece = change.state.piece;
                    if (piece.dying || change.state.appliedOrder > change.order) return;
                    piece.type = change.type;
                    change.state.appliedOrder = change.order;
                    if (!this.screen.reduceEffects) {
                        piece.dyeFromType = change.previousType;
                        piece.dyeElapsed = 0;
                        piece.dyeDuration = 150;
                    }
                    piece.targetScale = this.screen.reduceEffects ? 1 : 1.08;
                });
                await this.wait(this.screen.reduceEffects ? 40 : 150);
                changed.forEach((change) => {
                    const piece = change.state.piece;
                    if (!piece.dying && change.state.appliedOrder === change.order) piece.targetScale = 1;
                });
            })());
        });
        const removePiece = (position) => {
            const piece = this.findPiece(position.row, position.column);
            if (piece) {
                const logicalType = this.core.grid[position.row][position.column];
                if (config.isSpecialType(logicalType) && piece.type !== logicalType) {
                    piece.type = logicalType;
                    piece.baseType = this.core.getSpecialBaseType(position) || specialBaseType(logicalType);
                }
                piece.targetScale = 0;
                piece.dying = true;
                targets.push(piece);

                // 每个被消除的棋子爆发碎屑粒子（颜色与棋子一致）
                const center = this.pieceCenter(piece.row, piece.col);
                const special = config.getSpecialDef(piece.type);
                if (special) {
                    // 特殊棋子被触发：爆大粒子（特效感）
                    this.spawnBurst(center.x, center.y, [special.color, '#FFFFFF'], 22);
                } else {
                    const def = config.getPieceTypeDef(piece.type);
                    this.spawnBurst(center.x, center.y, def ? [def.color] : ['#888888'], 10);
                }
            }
        };
        const comboRemoval = data.specialCombo && data.specialCombo.kind;
        if (comboRemoval) removed.forEach(position => {
            phases.push((async () => {
                const hits = effectTiming.sources.map(({ source, delay }) =>
                    specialTriggerDelays.hitTime(source, position, delay, this.screen.reduceEffects)).filter(Number.isFinite);
                const delay = hits.length ? Math.min(...hits) : 0;
                if (delay) await this.wait(Math.ceil(delay));
                if (this.core === boundCore) removePiece(position);
            })());
        });
        if (effectTiming.impact) phases.push(this.wait(Math.ceil(effectTiming.impact)));
        if (phases.length) await Promise.all(phases);
        if (!comboRemoval) removed.forEach(removePiece);

        // 生成特殊棋子：位置棋子变特殊类型 + 弹出动画
        for (let i = 0; i < generated.length; i++) {
            const g = generated[i];
            const p = this.findPiece(g.pos.row, g.pos.column);
            if (p) {
                if (!config.isSpecialType(p.type)) p.baseType = p.type;
                p.type = g.type;
                p.targetScale = 1.35; // 弹出
                const self = this;
                setTimeout(function () {
                    if (p && !p.dying) p.targetScale = 1;
                }, 150);
            }
        }

        // 果冻反馈：每次破层都爆果冻粒子（清空时更多），破层看得见
        for (let i = 0; i < jellyHits.length; i++) {
            const pos = jellyHits[i];
            const cleared = this.core.jellyGrid[pos.row][pos.column] === 0;
            const center = this.pieceCenter(pos.row, pos.column);
            this.spawnBurst(center.x, center.y, ['#F9B4DF', '#FFF5CA', '#FFFFFF'], cleared ? 10 : 5);
            this.specialEffects.push({ kind: 'jellyHit', x: center.x, y: center.y,
                remaining: this.core.jellyGrid[pos.row][pos.column], life: 0,
                maxLife: this.screen.reduceEffects ? 180 : 380 });
        }

        // 冰块反馈：融化爆冰蓝碎屑
        for (let i = 0; i < iceHits.length; i++) {
            const pos = iceHits[i];
            const center = this.pieceCenter(pos.row, pos.column);
            this.spawnBurst(center.x, center.y, ['#C8E8F7', '#8FD3F4', '#FFFFFF'], 14);
        }

        if (data.yarnRootHit && this.core.yarnSource) {
            const source = this.core.yarnSource;
            const center = this.pieceCenter(source.row, source.column);
            this.spawnBurst(center.x, center.y, ['#F6D895', '#9C72B0', '#FFFFFF'], data.yarnCleared ? 18 : 9);
        }
        for (let i = 0; i < (data.yarnVineHits || []).length; i++) {
            const pos = data.yarnVineHits[i];
            const center = this.pieceCenter(pos.row, pos.column);
            this.spawnBurst(center.x, center.y, ['#DDA95C', '#FFFFFF'], 7);
        }

        const self = this;
        return (async function () {
            await self.wait(200);
            // 移除已消失的棋子
            self.pieces = self.pieces.filter(function (p) { return !p.dying; });
        })();
    }

    addMoonbudEffect(key, kind, fromOpen, toOpen) {
        this.moonbudEffects = this.moonbudEffects.filter(effect => effect.key !== key);
        this.moonbudEffects.push({ key, kind, fromOpen, toOpen, elapsed: 0, reduced: !!this.screen.reduceEffects,
            duration: this.screen.reduceEffects ? 160 : (kind === 'phase' ? 500 : 360) });
    }

    animateMoonbudPhase(data) {
        Object.keys(this.visualMoonbuds || {}).forEach(key => {
            this.addMoonbudEffect(key, 'phase', this.visualMoonbudOpen, data.open);
        });
        this.visualMoonbudOpen = data.open;
        return this.wait(this.screen.reduceEffects ? 0 : 120);
    }

    async animateParcelDelivered(data) {
        const boundCore = this.core;
        const delivered = data.parcels || [];
        // Gravity has arrived at the exit. Remove the visual object before refill.
        delivered.forEach((pos) => {
            this.pieces = this.pieces.filter(piece => !(piece.type === PARCEL_TYPE &&
                piece.row === pos.row && piece.col === pos.column));
            const center = this.pieceCenter(pos.row, pos.column);
            this.spawnBurst(center.x, center.y, ['#F6DCA0', '#EAF2FF'], 6);
        });
        if (this.core === boundCore) this.visualParcelDelivered = data.delivered;
        return this.wait(this.screen.reduceEffects ? 0 : 160);
    }

    animateYarnSpread(pos) {
        const center = this.pieceCenter(pos.row, pos.column);
        this.spawnBurst(center.x, center.y, ['#DDA95C', '#9C72B0'], 7);
        return this.wait(this.screen.reduceEffects ? 0 : 130);
    }

    /** 下落动画：棋子滑到新位置 */
    animateGravity(data) {
        const changes = data.changes;
        for (let i = 0; i < changes.length; i++) {
            const from = changes[i][0];
            const to = changes[i][1];
            const p = this.findPiece(from.row, from.column);
            if (p) this.movePieceTo(p, to.row, to.column);
        }
        return this.wait(260);
    }

    /** 填充动画：新棋子从棋盘上方掉落 */
    animateFill(data) {
        const filled = data.filled;
        for (let i = 0; i < filled.length; i++) {
            const pos = filled[i];
            const type = this.core.grid[pos.row][pos.column];
            const piece = this.makePiece(type, pos.row, pos.column);
            const center = this.pieceCenter(pos.row, pos.column);
            piece.x = center.x;
            piece.targetX = center.x;
            piece.y = this.boardY - this.tileSize; // 从上方进入
            piece.targetY = center.y;
            this.pieces.push(piece);
        }
        return this.wait(300);
    }

    /** 换色道具动画：棋子变色 + 弹出 */
    animateColorChange(data) {
        const p = this.findPiece(data.row, data.column);
        if (p) {
            p.type = data.type;
            p.targetScale = 1.35;
            const self = this;
            setTimeout(function () {
                if (p && !p.dying) p.targetScale = 1;
            }, 150);
        }
        return this.wait(150);
    }

    // ===== 每帧更新（动画插值）=====

    update(dt) {
        if (this.invalidSwapFeedback) this.invalidSwapFeedback.elapsed += Math.max(0, dt);
        if (this.reshuffleFeedback) {
            this.reshuffleFeedback.elapsed += Math.max(0, dt);
            if (this.reshuffleFeedback.elapsed >= 220) this.reshuffleFeedback = null;
        }
        if (this.pressFeedback) {
            this.pressFeedback.elapsed += Math.max(0, dt);
            if (this.pressFeedback.elapsed >= 180) this.pressFeedback = null;
        }
        const k = Math.min(1, dt / 100); // 约 100ms 内完成插值
        for (let i = 0; i < this.pieces.length; i++) {
            const p = this.pieces[i];
            p.x += (p.targetX - p.x) * k;
            p.y += (p.targetY - p.y) * k;
            p.scale += (p.targetScale - p.scale) * k;
            if (p.dyeDuration) {
                p.dyeElapsed += Math.max(0, dt);
                if (p.dyeElapsed >= p.dyeDuration) {
                    p.dyeFromType = 0;
                    p.dyeDuration = 0;
                }
            }
        }

        if (this.moonbudFeedback) {
            this.moonbudFeedback.elapsed += Math.max(0, dt);
            if (this.moonbudFeedback.elapsed >= this.moonbudFeedback.duration) this.moonbudFeedback = null;
        }
        this.moonbudEffects.forEach(effect => {
            if (this.screen.reduceEffects && !effect.reduced) {
                effect.elapsed = effect.elapsed / effect.duration * 160;
                effect.duration = 160;
                effect.reduced = true;
            }
            effect.elapsed += Math.max(0, dt);
        });
        this.moonbudEffects = this.moonbudEffects.filter(effect => effect.elapsed < effect.duration);

        // 粒子更新（带简单重力）
        const dtSec = dt / 1000;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.life += dt;
            p.x += p.vx * dtSec;
            p.y += p.vy * dtSec;
            p.vy += 260 * dtSec; // 重力下落
        }
        this.particles = this.particles.filter(function (p) { return p.life < p.maxLife; });
        for (let i = 0; i < this.specialEffects.length; i++) this.specialEffects[i].life += dt;
        this.specialEffects = this.specialEffects.filter(function (effect) { return effect.life < effect.maxLife; });
    }

    // ===== 绘制 =====

    draw() {
        if (!this.core) return;
        const ctx = this.ctx;

        if (!drawImageCover(ctx, assets.get('gameBackground'), this.screen.width, this.screen.height)) {
            const g = ctx.createLinearGradient(0, 0, 0, this.screen.height);
            g.addColorStop(0, THEME.bgTop);
            g.addColorStop(0.55, THEME.bgMid);
            g.addColorStop(1, THEME.bgBottom);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, this.screen.width, this.screen.height);
        }
        ctx.fillStyle = 'rgba(8, 12, 48, 0.12)';
        ctx.fillRect(0, 0, this.screen.width, this.screen.height);

        if (!this.battleMode) {
            this.drawTopBar();
        }
        this.drawBoard();

        // 底部道具栏（对战模式由 battle-ui 绘制）
        if (!this.battleMode) {
            this.drawTools();
        }
    }

    /** 顶部信息栏：月夜玻璃 HUD，所有数据由 Canvas 动态绘制 */
    drawTopBar() {
        const ctx = this.ctx;
        const w = this.screen.width;
        const layout = gameLayout.solo(this.screen, this.core.level.columns, this.core.level.rows, {
            moonbuds: this.core.level.moonbuds && this.core.level.moonbuds.length,
            timed: this.core.timeLimitMs > 0,
            goalCount: (this.core.level.goals || []).length
        });
        const y = layout.hudY;
        moon.scorePanel(ctx,this.screen,10,y,w-20,layout.hudH);
        ctx.save();
        ctx.fillStyle = '#FFF5E8';
        ctx.shadowColor = '#30375D'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
        if (layout.headlineY) typography.drawFit(ctx, '单人闯关', 14, layout.headlineY, Math.min(200, w - 140), {
            size: 16, minSize: 14, weight: 'bold'
        });
        ctx.restore();
        const sideW = (w - 96) / 2, roomy = layout.headerH > 60;
        const centers = [10+sideW/2,w/2,w-10-sideW/2];
        for (const [cx,width,label,value,color,size] of [
            [centers[0],sideW-12,'当前得分',this.core.score,'#914E73',roomy?32:28],
            [centers[1],68,'当前关卡',this.core.level.id,'#353D69',24],
            [centers[2],sideW-12,'剩余步数',this.core.movesLeft,this.core.movesLeft<=5?'#A92D52':'#426494',roomy?32:28]
        ]) {
            ctx.fillStyle = color;
            typography.drawFit(ctx,label,cx,y+14,width,{size:14,minSize:13,weight:'600',align:'center'});
            typography.drawFit(ctx,String(value),cx,y+layout.headerH*.65,width,{size,minSize:12,weight:'bold',numbers:true,align:'center'});
        }
        ctx.strokeStyle = '#DCD7E8'; ctx.lineWidth = 1;
        ctx.beginPath();ctx.moveTo(24, y + layout.headerH - 2);ctx.lineTo(w - 24, y + layout.headerH - 2);ctx.stroke();

        const goals = this.core.level.goals || [];
        const timed = this.core.timeLimitMs > 0;
        const aligned = goals.length === 2 && timed;
        const width = aligned ? (centers[1]-centers[0])*3 : w-36;
        const x = (w-width)/2, top = layout.goalsY;
        const rowH = layout.goalsH;
        const timerW = aligned ? width/3 : timed ? Math.min(82, width * .25) : 0;
        const areaW = width - timerW;
        const rows = goals.length > 3 ? 2 : 1;
        const cols = Math.max(1, Math.ceil(goals.length / rows));
        const cellW = areaW / cols, cellH = rowH / rows;
        const labels = {collect:'收集',jelly:'果冻层',ice:'冰块',yarn:'毛线源头',moonbud:'花苞',parcel:'配送',score:'目标分'};
        goals.forEach((goal,index) => {
            let left;
            if (goal.type === 'collect') left = Math.max(0,goal.target-((this.core.collectedCounts||{})[goal.pieceType]||0));
            else if (goal.type === 'jelly') left = this.visualJellyLeft();
            else if (goal.type === 'ice') left = this.visualIceLeft();
            else if (goal.type === 'yarn') left = this.core.getYarnHealth();
            else if (goal.type === 'moonbud') left = Object.keys(this.visualMoonbuds||{}).length;
            else if (goal.type === 'parcel') left = Math.max(0,(this.core.parcelTotal||goal.target)-this.visualParcelDelivered);
            else if (goal.type === 'score') left = Math.max(0,goal.target-this.core.score);
            const done = left === 0;
            const total = goal.type === 'jelly' ? this.core.jellyTotal || goal.target : goal.target;
            const progress = total > 0 ? Math.max(0,Math.min(1,(total-left)/total)) : done ? 1 : 0;
            const value = goal.type === 'score' ? goal.target :
                goal.type === 'yarn' ? left+'/'+goal.target : left;
            const gx = x+(index%cols)*cellW, gy = top+Math.floor(index/cols)*cellH;
            const dense = rows > 1;
            ctx.fillStyle = done ? '#8B637C' : '#626780';
            typography.drawFit(ctx,labels[goal.type]||'目标',dense?gx+24:gx+cellW/2,gy+(dense?cellH/2:cellH<45?7:9),
                dense?cellW-64:cellW-8,{size:dense?11:12,minSize:dense?9:10,weight:'600',align:dense?'left':'center'});
            const ringSize = dense ? 17 : cellH < 45 || aligned && cellW < 100 ? 22 : 30;
            const cy = gy+(dense?cellH/2:cellH-(cellH<45?12:17));
            const valueWidth = dense ? 34 : cellW-ringSize*(aligned?2:1)-14;
            const fullValue = goal.type === 'yarn' ? total+'/'+total : total;
            const valueSize = typography.fitFontSize(ctx,String(fullValue),valueWidth,dense?15:cellH<45?21:23,8,'bold',true);
            typography.set(ctx,valueSize,'bold',true);
            const textW = typography.measure(ctx,String(fullValue));
            const groupX = gx+(cellW-ringSize-6-textW)/2;
            const numberX = aligned ? gx+cellW/2 : groupX+ringSize+6+textW/2;
            this.drawGoalRing(goal,dense?gx+11:aligned?numberX-textW/2-6-ringSize/2:groupX+ringSize/2,cy,ringSize,progress);
            if (!done) {
                ctx.fillStyle = '#353D69';
                typography.drawFit(ctx,String(value),dense?gx+cellW-6:numberX,cy,valueWidth,{
                    size:valueSize,minSize:8,weight:'bold',numbers:true,align:dense?'right':'center'
                });
            }
            if (index%cols) {
                ctx.strokeStyle='#DCD7E8';ctx.lineWidth=1;ctx.beginPath();
                ctx.moveTo(gx,gy+7);ctx.lineTo(gx,gy+cellH-5);ctx.stroke();
            }
        });
        if (timed) {
            const tx = x+areaW+timerW/2;
            ctx.strokeStyle='#C9D6EA';ctx.lineWidth=1;ctx.beginPath();
            ctx.moveTo(x+areaW,top+5);ctx.lineTo(x+areaW,top+rowH-4);ctx.stroke();
            ctx.fillStyle=this.core.timeLeftMs<=10000?'#A92D52':'#426494';
            typography.drawFit(ctx,'时间',tx,top+9,timerW-6,{size:12,minSize:11,align:'center'});
            typography.drawFit(ctx,formatTimer(this.core.timeLeftMs),tx,top+(aligned?rowH-(rowH<45?12:17):rowH*(rowH<45?.72:.65)),timerW-6,{
                size:rowH<45?20:22,minSize:15,weight:'bold',numbers:true,align:'center'
            });
        }
    }

    drawGoalRing(goal,x,y,size,progress) {
        const ctx=this.ctx, done=progress===1, r=size/2-1;
        ctx.save();
        ctx.lineWidth=size<20?1.4:1.8;ctx.lineCap='round';
        ctx.strokeStyle=done?'#C99B92':'#DCDCE6';
        ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
        if (progress>0 && !done) {
            ctx.strokeStyle='#7FB9D8';ctx.beginPath();
            ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();
        }
        this.drawGoalIcon(goal,x,y,size*.7,done);
        if (done) {
            const sx=x+r*.72,sy=y+r*.6,b=size*.17;
            ctx.fillStyle='#D77F97';ctx.strokeStyle='#FFF7FA';ctx.lineWidth=1;
            ctx.beginPath();ctx.arc(sx,sy,b,0,Math.PI*2);ctx.fill();ctx.stroke();
            ctx.strokeStyle='#FFFFFF';ctx.lineWidth=Math.max(1,size*.05);ctx.lineJoin='round';
            ctx.beginPath();ctx.moveTo(sx-b*.5,sy);ctx.lineTo(sx-b*.12,sy+b*.35);ctx.lineTo(sx+b*.5,sy-b*.4);ctx.stroke();
        }
        ctx.restore();
    }

    drawGoalIcon(goal,x,y,size,completed) {
        const ctx=this.ctx;
        ctx.save();
        ctx.translate(x,y);ctx.scale(size/24,size/24);x=y=0;size=24;
        if (goal.type==='collect') drawImageContain(ctx,assets.get('piece'+goal.pieceType),x-size/2,y-size/2,size,size);
        else if (goal.type==='score') moon.battleIcon(ctx,'cheer',x-size/2,y-size/2,size);
        else if (goal.type==='moonbud') newObstacles.moonbud(ctx,x,y,size,completed||this.visualMoonbudOpen,undefined,false);
        else if (goal.type==='parcel') newObstacles.parcel(ctx,x,y,size);
        else if (goal.type==='jelly') {
            jellyPath(ctx,x,y,size*.42);ctx.fillStyle='#F3BDD7';ctx.fill();
            ctx.strokeStyle='#A36591';ctx.lineWidth=2;ctx.stroke();
        } else if (goal.type==='ice') {
            ctx.fillStyle='#87BDE5';this.roundRect(x-size*.44,y-size*.44,size*.88,size*.88,5);ctx.fill();
            ctx.strokeStyle='#FFFFFF';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#FFFFFF';
            typography.drawFit(ctx,'❄',x,y,size*.75,{size:16,minSize:12,align:'center'});
        } else if (goal.type==='yarn') {
            ctx.strokeStyle='#6F4A87';ctx.lineWidth=3;
            this.roundRect(x-size*.4,y-size*.4,size*.8,size*.8,5);ctx.stroke();
            ctx.strokeStyle='#D4AD62';ctx.lineWidth=1;
            this.roundRect(x-size*.28,y-size*.28,size*.56,size*.56,3);ctx.stroke();
        }
        ctx.restore();
    }

    /** 画棋盘底板 + 棋子 + 果冻罩 + 冰块罩 + 粒子 */
    drawBoard() {
        const ctx = this.ctx;

        // 棋盘底板
        ctx.save();
        if (!this.screen.reduceEffects) {
            ctx.shadowColor = 'rgba(8, 9, 43, 0.55)';
            ctx.shadowBlur = 18;
            ctx.shadowOffsetY = 6;
        }
        ctx.fillStyle = THEME.boardBg;
        this.roundRect(this.boardX, this.boardY, this.boardW, this.boardH, 12);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = THEME.boardBorder;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 轻格子纹理（每个格子的淡色底）
        const grid = this.core.grid;
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                const x = this.boardX + c * this.tileSize + 2;
                const y = this.boardY + r * this.tileSize + 2;
                ctx.fillStyle = THEME.tileEmpty;
                this.roundRect(x, y, this.tileSize - 4, this.tileSize - 4, 8);
                ctx.fill();
            }
        }

        this.drawJellies();

        // 棋子（按视觉位置绘制，支持动画）
        const reshuffle = this.reshuffleFeedback;
        if (reshuffle) {
            const oldAlpha = Math.max(0, 1 - reshuffle.elapsed / 180);
            for (let i = 0; i < reshuffle.oldPieces.length; i++) {
                this.drawPiece(reshuffle.oldPieces[i], oldAlpha);
            }
        }
        const newAlpha = reshuffle ? Math.max(0, Math.min(1, (reshuffle.elapsed - 20) / 200)) : 1;
        for (let i = 0; i < this.pieces.length; i++) {
            this.drawPiece(this.pieces[i], newAlpha);
        }

        this.drawJellyBadges();

        // 冰块罩（冰蓝方块罩，盖在棋子上）
        this.drawIces();

        this.drawYarn();

        Object.keys(this.visualMoonbuds || {}).forEach(key => {
            const cell = key.split(':').map(Number), center = this.pieceCenter(cell[0], cell[1]);
            const effect = this.moonbudEffects.find(item => item.key === key);
            if (!effect) newObstacles.moonbud(ctx, center.x, center.y, this.tileSize, this.visualMoonbudOpen);
        });
        (this.core.level.parcelExits || []).forEach(column => {
            const center = this.pieceCenter(grid.length - 1, column);
            newObstacles.exit(ctx, center.x, this.boardY + this.boardH - this.tileSize * 0.035, this.tileSize);
        });

        this.moonbudEffects.forEach(effect => {
            const cell = effect.key.split(':').map(Number), center = this.pieceCenter(cell[0], cell[1]);
            newObstacles.moonbudEffect(ctx, center.x, center.y, this.tileSize, effect, this.screen.reduceEffects);
        });

        // 粒子（碎屑效果，绘制在最上层）
        this.drawParticles();
        this.drawSpecialEffects();

        // 按住高亮
        if (this.pressGrid) {
            const x = this.boardX + this.pressGrid.column * this.tileSize;
            const y = this.boardY + this.pressGrid.row * this.tileSize;
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 3;
            this.roundRect(x + 3, y + 3, this.tileSize - 6, this.tileSize - 6, 8);
            ctx.stroke();
        }
    }

    /** 画碎屑粒子（带透明度渐隐） */
    drawParticles() {
        const ctx = this.ctx;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const alpha = 1 - p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }

    drawSpecialEffects() {
        const ctx = this.ctx;
        const beam = assets.get('uiSpecialRowBeam');
        for (let i = 0; i < this.specialEffects.length; i++) {
            const effect = this.specialEffects[i];
            if (effect.kind === 'hitHold') continue;
            if (effect.life < 0) continue;
            const progress = Math.min(1, effect.life / effect.maxLife);
            const alpha = Math.sin(progress * Math.PI) * 0.92;
            ctx.save();
            ctx.beginPath();
            ctx.rect(this.boardX, this.boardY, this.boardW, this.boardH);
            ctx.clip();
            ctx.globalAlpha = alpha;
            if (!this.screen.reduceEffects) ctx.globalCompositeOperation = 'lighter';

            if (effect.type === config.SPECIAL_TYPES.TRACKING_PAW && effect.destination) {
                this.drawTrackingEffect(effect, progress);
            } else if (effect.type === config.SPECIAL_TYPES.COLOR_BELL) {
                this.drawBellEffect(effect, progress);
            } else if (effect.kind === 'jellyHit') {
                ctx.globalCompositeOperation = 'source-over';
                this.drawJellyHit(effect, progress);
            } else if (effect.kind) {
                this.drawMoonComboEffect(effect, progress);
            } else if (effect.type === config.SPECIAL_TYPES.H_ROCKET || effect.type === config.SPECIAL_TYPES.V_ROCKET) {
                ctx.translate(effect.x, effect.y);
                if (effect.type === config.SPECIAL_TYPES.V_ROCKET) ctx.rotate(Math.PI / 2);
                const width = this.boardW * (0.55 + progress * 0.62);
                const height = this.tileSize * (0.72 + progress * 0.65);
                if (beam && beam.width > 0) {
                    ctx.drawImage(beam, -width / 2, -height / 2, width, height);
                } else {
                    const g = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
                    g.addColorStop(0, 'rgba(255,255,255,0)');
                    g.addColorStop(0.5, '#FFD1F0');
                    g.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = g;
                    ctx.fillRect(-width / 2, -height / 5, width, height * 0.4);
                }
            } else {
                this.drawSpecialPulse(effect.x, effect.y, progress, 1);
            }
            ctx.restore();
        }
    }

    drawJellyHit(effect, progress) {
        const ctx = this.ctx;
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = effect.remaining ? '#f9b4df' : '#fff5ca';
        ctx.lineWidth = this.screen.reduceEffects ? 2 : this.tileSize * 0.1 * (1 - progress) + 1;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, this.tileSize * (this.screen.reduceEffects ? 0.43 : 0.24 + progress * 0.43), 0, Math.PI * 2);
        ctx.stroke();
    }

    drawSpecialPulse(centerX, centerY, progress, scale) {
        const ctx = this.ctx;
        const radius = this.tileSize * (0.45 + progress * 2.15) * scale;
        ctx.strokeStyle = '#FFD4F0';
        ctx.lineWidth = Math.max(2, this.tileSize * (0.13 - progress * 0.08) * scale);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#FFE6A8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.62, 0, Math.PI * 2);
        ctx.stroke();
    }

    drawBellEffect(effect, progress) {
        const ctx = this.ctx;
        const beam = assets.get('uiSpecialRowBeam');
        this.drawMoonComboEffect({ kind: 'color', x: effect.x, y: effect.y, targets: effect.changes || [] }, progress);
        (effect.changes || []).forEach((change) => {
            const destination = this.pieceCenter(change.row, change.column);
            if (!this.screen.reduceEffects && beam && beam.width > 0) {
                const distance = Math.hypot(destination.x - effect.x, destination.y - effect.y);
                const reveal = Math.min(1, progress / 0.24);
                ctx.save();
                ctx.translate(effect.x, effect.y);
                ctx.rotate(Math.atan2(destination.y - effect.y, destination.x - effect.x));
                ctx.drawImage(beam, beam.width * 0.66, 0, beam.width * 0.34, beam.height,
                    0, -this.tileSize * 0.13, distance * reveal, this.tileSize * 0.26);
                ctx.restore();
            }
            if (progress > 0.22) this.drawSpecialPulse(destination.x, destination.y,
                this.screen.reduceEffects ? 0.45 : (progress - 0.22) / 0.78, 0.18);
        });
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        drawColorBell(ctx, effect.x, effect.y, this.tileSize * 0.66 * (1 + Math.sin(progress * Math.PI) * 0.07),
            bellColor(effect.color));
        ctx.restore();
    }

    drawTrackingEffect(effect, progress) {
        const ctx = this.ctx;
        const destination = effect.destination;
        const alpha = ctx.globalAlpha;
        ctx.strokeStyle = '#FFE09B';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(destination.x, destination.y, this.tileSize * 0.44, 0, Math.PI * 2);
        ctx.stroke();
        const travelTime = Math.max(0, Math.min(1, (progress - 0.14) / 0.5));
        const travel = 1 - Math.pow(1 - travelTime, 2);
        const controlX = (effect.x + destination.x) / 2;
        const controlY = Math.max(this.boardY + this.tileSize * 0.15,
            Math.min(effect.y, destination.y) - this.tileSize * 0.8);
        const pointAt = (amount) => ({
            x: (1 - amount) * (1 - amount) * effect.x + 2 * (1 - amount) * amount * controlX + amount * amount * destination.x,
            y: (1 - amount) * (1 - amount) * effect.y + 2 * (1 - amount) * amount * controlY + amount * amount * destination.y
        });
        if (!this.screen.reduceEffects && travel > 0 && travel < 1) {
            ctx.strokeStyle = '#D49AFF';
            ctx.lineWidth = this.tileSize * 0.065;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let step = 0; step <= 10; step++) {
                const point = pointAt(Math.max(0, travel - 0.22) + Math.min(travel, 0.22) * step / 10);
                if (step === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
            const head = pointAt(travel);
            const previous = pointAt(Math.max(0, travel - 0.05));
            const beam = assets.get('uiSpecialRowBeam');
            if (beam && beam.width > 0) {
                ctx.save();
                ctx.translate(head.x, head.y);
                ctx.rotate(Math.atan2(head.y - previous.y, head.x - previous.x));
                ctx.drawImage(beam, 0, 0, beam.width * 0.34, beam.height,
                    -this.tileSize * 1.2, -this.tileSize * 0.15, this.tileSize * 1.2, this.tileSize * 0.3);
                ctx.restore();
            }
            drawSparkle(ctx, head.x, head.y, this.tileSize * 0.06, '#F1F7FF');
        }
        const point = this.screen.reduceEffects ? destination : pointAt(travel);
        const impact = travelTime === 1 ? Math.max(0, (progress - 0.64) / 0.36) : 0;
        const size = this.tileSize * 0.68;
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.globalCompositeOperation = 'source-over';
        drawTrackingPaw(ctx, 0, 0, size);
        if (effect.carriedType) {
            const badgeSize = this.tileSize * 0.36;
            if (effect.carriedType === config.SPECIAL_TYPES.BOMB) {
                drawImageContain(ctx, assets.get('uiToolBomb'), size * 0.1, size * 0.02, badgeSize, badgeSize);
            } else {
                const beam = assets.get('uiSpecialRowBeam');
                ctx.translate(size * 0.3, size * 0.18);
                if (effect.carriedType === config.SPECIAL_TYPES.V_ROCKET) ctx.rotate(Math.PI / 2);
                drawImageContain(ctx, beam, -badgeSize / 2, -badgeSize / 2, badgeSize, badgeSize);
            }
        }
        ctx.restore();
        if (travelTime === 1 || this.screen.reduceEffects) {
            ctx.globalAlpha = alpha * (1 - impact);
            this.drawSpecialPulse(destination.x, destination.y, this.screen.reduceEffects ? 0.4 : impact, 0.35);
        }
    }

    trackingObstacle(row, column, kind, current) {
        const effect = this.specialEffects.find(function (item) {
            return item.target && item.target.row === row && item.target.column === column &&
                ((item.kind === 'hitHold' && item.life < 0) ||
                (item.type === config.SPECIAL_TYPES.TRACKING_PAW && !item.skipObstacleHold && item.life / item.maxLife < 0.64));
        });
        return effect ? effect[kind] : current;
    }

    visualJellyLeft() {
        let total = 0;
        this.core.jellyGrid.forEach((row, rowIndex) => {
            row.forEach((layers, column) => {
                total += this.trackingObstacle(rowIndex, column, 'targetJelly', layers);
            });
        });
        return total;
    }

    visualIceLeft() {
        let total = 0;
        this.core.iceGrid.forEach((row, rowIndex) => {
            row.forEach((occupied, column) => {
                if (this.trackingObstacle(rowIndex, column, 'targetIce', occupied)) total++;
            });
        });
        return total;
    }

    /** B direction: bounded moon-glass ribbons, rings, and deterministic stars. */
    drawMoonComboEffect(effect, progress) {
        const ctx = this.ctx;
        const pale = '#F1F7FF';
        const blue = '#93BFFF';
        const violet = '#D49AFF';
        const fade = 1 - progress * 0.45;
        const centerRow = Math.floor((effect.y - this.boardY) / this.tileSize);
        const centerCol = Math.floor((effect.x - this.boardX) / this.tileSize);
        const drawRibbon = (horizontal, offset) => {
            const length = horizontal ? this.boardW : this.boardH;
            const width = this.tileSize * (0.18 + (1 - progress) * 0.18);
            const x = horizontal ? this.boardX : effect.x + offset * this.tileSize;
            const y = horizontal ? effect.y + offset * this.tileSize : this.boardY;
            const g = horizontal ? ctx.createLinearGradient(this.boardX, 0, this.boardX + this.boardW, 0) :
                ctx.createLinearGradient(0, this.boardY, 0, this.boardY + this.boardH);
            g.addColorStop(0, 'rgba(147,191,255,0)');
            g.addColorStop(0.38, 'rgba(212,154,255,0.42)');
            g.addColorStop(0.5, 'rgba(241,247,255,0.92)');
            g.addColorStop(0.62, 'rgba(147,191,255,0.42)');
            g.addColorStop(1, 'rgba(147,191,255,0)');
            ctx.fillStyle = g;
            if (horizontal) ctx.fillRect(this.boardX, y - width / 2, length, width);
            else ctx.fillRect(x - width / 2, this.boardY, width, length);
        };
        const ring = (radius, color, width) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
            ctx.stroke();
        };
        const star = (x, y, radius) => {
            ctx.fillStyle = pale;
            ctx.beginPath();
            ctx.moveTo(x, y - radius);
            ctx.lineTo(x + radius * 0.22, y - radius * 0.22);
            ctx.lineTo(x + radius, y);
            ctx.lineTo(x + radius * 0.22, y + radius * 0.22);
            ctx.lineTo(x, y + radius);
            ctx.lineTo(x - radius * 0.22, y + radius * 0.22);
            ctx.lineTo(x - radius, y);
            ctx.lineTo(x - radius * 0.22, y - radius * 0.22);
            ctx.closePath();
            ctx.fill();
        };

        if (effect.kind === 'cross' || effect.kind === 'tripleCross') {
            const bands = effect.kind === 'tripleCross' ? [-1, 0, 1] : [0];
            for (let i = 0; i < bands.length; i++) {
                drawRibbon(true, bands[i]);
                drawRibbon(false, bands[i]);
            }
        } else if (effect.kind === 'square') {
            const radius = this.tileSize * (0.4 + progress * 2.8);
            ring(radius, violet, Math.max(2, this.tileSize * 0.08));
            ring(radius * 0.62, pale, 2);
        } else if (effect.kind === 'screen') {
            const radius = Math.max(this.boardW, this.boardH) * (0.08 + progress * 0.72);
            ring(radius, blue, Math.max(2, this.tileSize * 0.07));
            ring(radius * 0.7, violet, 2);
        } else if (effect.kind === 'color') {
            // The payload carries the actual target footprint, including obstacle hits.
            const targets = effect.targets || [];
            for (let i = 0; i < targets.length; i++) {
                const target = targets[i];
                if (target.row === centerRow && target.column === centerCol) continue;
                const point = this.pieceCenter(target.row, target.column);
                ctx.strokeStyle = i % 2 ? violet : blue;
                ctx.lineWidth = this.screen.reduceEffects ? 1.5 : 2.5;
                ctx.beginPath();
                ctx.moveTo(effect.x, effect.y);
                ctx.lineTo(effect.x + (point.x - effect.x) * (0.35 + progress * 0.65),
                    effect.y + (point.y - effect.y) * (0.35 + progress * 0.65));
                ctx.stroke();
                if (!this.screen.reduceEffects) star(point.x, point.y, 2.5);
            }
            ring(this.tileSize * (0.3 + progress * 0.55), pale, 2);
        }

        if (!this.screen.reduceEffects && effect.kind !== 'color') {
            const radius = this.tileSize * (0.65 + progress * 1.4);
            for (let i = 0; i < 6; i++) {
                const angle = i * Math.PI / 3 + progress * 2;
                star(effect.x + Math.cos(angle) * radius, effect.y + Math.sin(angle) * radius, 2.2 * fade);
            }
        }
    }

    drawJellies() {
        const ctx = this.ctx;
        const jelly = this.core.jellyGrid;
        for (let row = 0; row < jelly.length; row++) {
            for (let column = 0; column < jelly[row].length; column++) {
                const layers = this.trackingObstacle(row, column, 'targetJelly', jelly[row][column]);
                if (!layers) continue;
                const offset = this.invalidSwapOffset(row, column);
                const left = this.boardX + column * this.tileSize + (offset ? offset.x : 0);
                const top = this.boardY + row * this.tileSize + (offset ? offset.y : 0);
                const centerX = left + this.tileSize / 2;
                const centerY = top + this.tileSize / 2;
                const doubleLayer = layers > 1;
                const radius = this.tileSize * (doubleLayer ? 0.44 : 0.39);
                ctx.save();
                ctx.beginPath();
                ctx.rect(left + 1, top + 1, this.tileSize - 2, this.tileSize - 2);
                ctx.clip();
                ctx.shadowColor = 'rgba(71,30,91,0.6)';
                ctx.shadowBlur = this.tileSize * 0.09;
                ctx.shadowOffsetY = this.tileSize * 0.025;
                jellyPath(ctx, centerX, centerY, radius);
                ctx.fillStyle = doubleLayer ? '#7b397f' : '#efa5c6';
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
                ctx.strokeStyle = doubleLayer ? '#4c245f' : '#975177';
                ctx.lineWidth = this.tileSize * (doubleLayer ? 0.11 : 0.055);
                ctx.stroke();
                ctx.strokeStyle = doubleLayer ? '#f7c7f0' : '#fff0f5';
                ctx.lineWidth = this.tileSize * (doubleLayer ? 0.035 : 0.022);
                ctx.stroke();
                if (doubleLayer) {
                    jellyPath(ctx, centerX, centerY, radius * 0.77);
                    ctx.strokeStyle = '#d88ac9';
                    ctx.lineWidth = this.tileSize * 0.075;
                    ctx.stroke();
                }
                ctx.restore();
            }
        }
    }

    drawJellyBadges() {
        const ctx = this.ctx;
        this.core.jellyGrid.forEach((row, rowIndex) => {
            row.forEach((layers, column) => {
                const visibleLayers = this.trackingObstacle(rowIndex, column, 'targetJelly', layers);
                if (!visibleLayers) return;
                const offset = this.invalidSwapOffset(rowIndex, column);
                const left = this.boardX + column * this.tileSize + (offset ? offset.x : 0);
                const top = this.boardY + rowIndex * this.tileSize + (offset ? offset.y : 0);
                const centerX = left + this.tileSize / 2;
                const centerY = top + this.tileSize / 2;
                const doubleLayer = visibleLayers > 1;
                ctx.save();
                ctx.beginPath();
                ctx.rect(left + 1, top + 1, this.tileSize - 2, this.tileSize - 2);
                ctx.clip();
                // A faint surface film preserves the cat colours; its edge is more visible than its centre.
                const tint = doubleLayer ? '160,110,185' : '236,135,181';
                const film = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, this.tileSize * 0.48);
                film.addColorStop(0, 'rgba(' + tint + ',0.03)');
                film.addColorStop(0.60, 'rgba(' + tint + ',0.05)');
                film.addColorStop(1, 'rgba(' + tint + ',0.11)');
                jellyPath(ctx, centerX, centerY, this.tileSize * 0.42);
                ctx.fillStyle = film;
                ctx.fill();
                // Foreground candy rim stays visible over opaque cat art.
                jellyPath(ctx, centerX, centerY, this.tileSize * 0.42);
                ctx.strokeStyle = doubleLayer ? '#4c245f' : '#975177';
                ctx.lineWidth = this.tileSize * 0.14;
                ctx.stroke();
                ctx.strokeStyle = doubleLayer ? '#7b397f' : '#efa5c6';
                ctx.lineWidth = this.tileSize * 0.085;
                ctx.stroke();
                ctx.strokeStyle = doubleLayer ? '#f7c7f0' : '#fff0f5';
                ctx.lineWidth = this.tileSize * 0.025;
                ctx.stroke();
                if (doubleLayer) {
                    jellyPath(ctx, centerX, centerY, this.tileSize * 0.33);
                    ctx.strokeStyle = '#d88ac9';
                    ctx.lineWidth = this.tileSize * 0.045;
                    ctx.stroke();
                }
                if (!doubleLayer) { ctx.restore(); return; }
                const badgeX = this.boardX + column * this.tileSize + this.tileSize * 0.145 + (offset ? offset.x : 0);
                const badgeY = this.boardY + rowIndex * this.tileSize + this.tileSize * 0.145 + (offset ? offset.y : 0);
                const badgeRadius = this.tileSize * 0.128;
                ctx.shadowColor = 'rgba(40,20,64,0.65)';
                ctx.shadowBlur = this.tileSize * 0.045;
                ctx.fillStyle = '#63326f';
                ctx.beginPath();
                ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#ffe5f6';
                ctx.lineWidth = this.tileSize * 0.025;
                ctx.stroke();
                ctx.fillStyle = '#fffafc';
                typography.drawFit(ctx, '2', badgeX, badgeY + this.tileSize * 0.01, badgeRadius * 1.6, {
                    size: Math.round(this.tileSize * 0.19), minSize: 8, weight: 'bold', numbers: true, align: 'center'
                });
                ctx.restore();
            });
        });
    }

    /**
     * 画冰块罩：实心冰蓝方块盖住棋子（棋子若隐若现），白边 + 雪花 + 冰晶光
     */
    drawIces() {
        const ctx = this.ctx;
        const ice = this.core.iceGrid;
        for (let r = 0; r < ice.length; r++) {
            for (let c = 0; c < ice[r].length; c++) {
                if (!this.trackingObstacle(r, c, 'targetIce', ice[r][c])) continue;
                const offset = this.invalidSwapOffset(r, c);
                const x = this.boardX + c * this.tileSize + (offset ? offset.x : 0);
                const y = this.boardY + r * this.tileSize + (offset ? offset.y : 0);
                const pad = 2;

                // 冰块主体（高覆盖，棋子若隐若现）
                ctx.globalAlpha = 0.88;
                ctx.fillStyle = '#7FB8E6';
                this.roundRect(x + pad, y + pad, this.tileSize - pad * 2, this.tileSize - pad * 2, 10);
                ctx.fill();
                ctx.globalAlpha = 1;

                // 白色粗边框（冰块棱角感）
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2.5;
                this.roundRect(x + pad + 1.5, y + pad + 1.5, this.tileSize - pad * 2 - 3, this.tileSize - pad * 2 - 3, 8);
                ctx.stroke();

                // 雪花符号（一眼识别是冰块）
                ctx.fillStyle = '#FFFFFF';
                typography.drawFit(ctx, '❄', x + this.tileSize / 2, y + this.tileSize / 2 + 1, this.tileSize * 0.7, {
                    size: Math.floor(this.tileSize * 0.42), minSize: 8, align: 'center'
                });

                // 冰晶光泽（右上角）
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.beginPath();
                ctx.arc(x + this.tileSize * 0.28, y + this.tileSize * 0.28, this.tileSize * 0.1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    drawYarn() {
        const source = this.core.yarnSource;
        if (!source) return;
        const health = this.trackingObstacle(source.row, source.column, 'targetYarnHealth', source.health);
        if (health <= 0) return;
        const ctx = this.ctx;
        const cells = [{ row: source.row, column: source.column, root: true }];
        const visibleVines = Object.assign({}, this.core.yarnVines);
        this.specialEffects.forEach(effect => {
            if (effect.targetYarnVine && effect.target && effect.life / effect.maxLife < 0.64) {
                visibleVines[effect.target.row + ':' + effect.target.column] = true;
            }
        });
        Object.keys(visibleVines).forEach(function (key) {
            const parts = key.split(':').map(Number);
            cells.push({ row: parts[0], column: parts[1], root: false });
        });
        for (let index = 0; index < cells.length; index++) {
            const cell = cells[index];
            const offset = this.invalidSwapOffset(cell.row, cell.column);
            const x = this.boardX + cell.column * this.tileSize + (offset ? offset.x : 0);
            const y = this.boardY + cell.row * this.tileSize + (offset ? offset.y : 0);
            const pad = cell.root ? 2.5 : 3.5;
            ctx.save();
            ctx.strokeStyle = cell.root ? '#5A386F' : '#DDA95C';
            ctx.lineWidth = cell.root ? 4 : 3;
            this.roundRect(x + pad, y + pad, this.tileSize - pad * 2, this.tileSize - pad * 2, 9);
            ctx.stroke();
            ctx.strokeStyle = cell.root ? '#F6D895' : '#FFF0BC';
            ctx.lineWidth = 1.4;
            this.roundRect(x + pad + 3, y + pad + 3, this.tileSize - (pad + 3) * 2, this.tileSize - (pad + 3) * 2, 7);
            ctx.stroke();
            if (cell.root) {
                const badgeX = x + this.tileSize - 10;
                const badgeY = y + 10;
                ctx.fillStyle = '#5A386F';
                ctx.beginPath();
                ctx.arc(badgeX, badgeY, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFF4CE';
                typography.drawFit(ctx, String(health), badgeX, badgeY, 15, {
                    size: 12, minSize: 10, weight: 'bold', numbers: true, align: 'center'
                });
            }
            ctx.restore();
        }
    }

    /** 画一个视觉棋子（特殊棋子画专属样式，普通棋子画色块+emoji） */
    drawPiece(piece, opacity) {
        const ctx = this.ctx;
        const press = this.pressFeedback && this.pressFeedback.piece === piece
            ? Math.sin(Math.PI * (0.25 + 0.75 * this.pressFeedback.elapsed / 180)) : 0;
        const pressScaleX = 1 + press * 0.03;
        const pressScaleY = 1 - press * 0.06;
        const offset = this.invalidSwapOffset(piece.row, piece.col);
        const drawX = piece.x + (offset ? offset.x : 0);
        const drawY = piece.y + (offset ? offset.y : 0);

        if (piece.type === PARCEL_TYPE) {
            ctx.save();
            ctx.globalAlpha = piece.alpha * (opacity === undefined ? 1 : opacity);
            newObstacles.parcel(ctx, drawX, drawY, this.tileSize * piece.scale);
            ctx.restore();
            return;
        }

        // 特殊棋子：保留猫咪底图，叠加会呼吸的猫爪光束/魔法炸弹。
        const special = config.getSpecialDef(piece.type);
        if (special) {
            const size = this.tileSize * piece.scale;
            if (size < 1) return;
            ctx.save();
            ctx.globalAlpha = piece.alpha * (opacity === undefined ? 1 : opacity);
            ctx.translate(drawX, drawY);
            ctx.scale(piece.scale * pressScaleX, piece.scale * pressScaleY);

            const s = Math.min(this.tileSize - 2, this.tileSize * 0.94);
            const img = assets.get('piece' + (piece.baseType || specialBaseType(piece.type)));
            if (img && img.width > 0) ctx.drawImage(img, -s / 2, -s / 2, s, s);
            const pulse = this.screen.reduceEffects ? 1 : 1 + Math.sin(Date.now() / 150 + piece.id) * 0.07;
            const half = this.tileSize / 2 - 3;
            ctx.fillStyle = 'rgba(44, 28, 91, 0.20)';
            ctx.beginPath();
            ctx.arc(0, 0, half, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = piece.type === config.SPECIAL_TYPES.BOMB || piece.type === config.SPECIAL_TYPES.TRACKING_PAW ? '#FF9ED2' : '#FFE09B';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, (half - 1) * pulse, 0, Math.PI * 2);
            ctx.stroke();

            if (piece.type === config.SPECIAL_TYPES.TRACKING_PAW) {
                drawTrackingPaw(ctx, 0, 0, this.tileSize * 0.74 * pulse);
            } else if (piece.type === config.SPECIAL_TYPES.COLOR_BELL) {
                drawColorBell(ctx, 0, 0, this.tileSize * 0.66 * pulse, bellColor(piece.baseType));
            } else if (piece.type === config.SPECIAL_TYPES.BOMB) {
                const bomb = assets.get('uiToolBomb');
                const bombSize = this.tileSize * 0.66 * pulse;
                drawImageContain(ctx, bomb, -bombSize / 2, -bombSize / 2, bombSize, bombSize);
            } else if (piece.type === config.SPECIAL_TYPES.COLOR_BALL) {
                const orb = ctx.createRadialGradient(-half * 0.25, -half * 0.28, 1, 0, 0, half * 0.82);
                orb.addColorStop(0, '#FFF8C7');
                orb.addColorStop(0.45, '#FFB5E8');
                orb.addColorStop(1, '#7C5CE7');
                ctx.fillStyle = orb;
                ctx.beginPath();
                ctx.arc(0, 0, half * 0.72 * pulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                typography.drawFit(ctx, '🐾', 0, 1, this.tileSize * 0.62, {
                    size: Math.floor(this.tileSize * 0.42), minSize: 8, align: 'center'
                });
            } else {
                const beam = assets.get('uiSpecialRowBeam');
                ctx.save();
                if (piece.type === config.SPECIAL_TYPES.V_ROCKET) ctx.rotate(Math.PI / 2);
                const beamW = this.tileSize * 0.94 * pulse;
                const beamH = this.tileSize * 0.36 * pulse;
                if (beam && beam.width > 0) ctx.drawImage(beam, -beamW / 2, -beamH / 2, beamW, beamH);
                ctx.restore();
            }

            if (!this.screen.reduceEffects) {
                const sparkleAngle = Date.now() / 420 + piece.id;
                ctx.fillStyle = '#FFF3B0';
                for (let k = 0; k < 3; k++) {
                    const angle = sparkleAngle + k * Math.PI * 2 / 3;
                    ctx.beginPath();
                    ctx.arc(Math.cos(angle) * half * 0.75, Math.sin(angle) * half * 0.75, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.restore();
            return;
        }

        const def = config.getPieceTypeDef(piece.type);
        if (!def) return;

        const size = this.tileSize * piece.scale;
        if (size < 1) return;

        ctx.save();
        ctx.globalAlpha = piece.alpha * (opacity === undefined ? 1 : opacity);
        ctx.translate(drawX, drawY);
        ctx.scale(piece.scale * pressScaleX, piece.scale * pressScaleY);

        // 优先用猫咪素材图（type 1-5 对应 piece1-5），无图则回退代码绘制
        const pieceImg = assets.get('piece' + piece.type);
        const s = Math.min(this.tileSize - 2, this.tileSize * 0.94);
        if (pieceImg && pieceImg.width > 0) {
            const previous = piece.dyeFromType && assets.get('piece' + piece.dyeFromType);
            if (previous && previous.width > 0 && piece.dyeDuration) {
                const blend = Math.min(1, piece.dyeElapsed / piece.dyeDuration);
                const alpha = ctx.globalAlpha;
                ctx.globalAlpha = alpha * (1 - blend);
                ctx.drawImage(previous, -s / 2, -s / 2, s, s);
                ctx.globalAlpha = alpha * blend;
                ctx.drawImage(pieceImg, -s / 2, -s / 2, s, s);
            } else ctx.drawImage(pieceImg, -s / 2, -s / 2, s, s);
        } else {
            // 回退：渐变圆角 + emoji
            const half = this.tileSize / 2 - 3;
            const grad = ctx.createLinearGradient(-half, -half, half, half);
            grad.addColorStop(0, lighten(def.color));
            grad.addColorStop(1, def.color);
            ctx.fillStyle = grad;
            this.roundRect(-half, -half, half * 2, half * 2, 9);
            ctx.fill();
            typography.drawFit(ctx, def.label, 0, 1, this.tileSize * 0.8, {
                size: Math.floor(this.tileSize * 0.5), minSize: 8, align: 'center'
            });
        }

        ctx.restore();
    }

    // ===== 触摸 =====

    onTouchStart(x, y, identifier) {
        this.toolAdTouch = null;
        // 加号与使用道具分开命中；零库存也能进入激励领取。
        if (this.toolAdAvailable && this.onToolAd && !this.battleMode) {
            for (const tool of this.tools) {
                if (this.toolsCount[tool.type] !== 0) continue;
                const r = tool.adRect;
                if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.selectedTool = null;
                    this.touchStartPos = this.touchStartGrid = this.pressGrid = null;
                    if (!this.toolAdPending && this.core && this.core.isPlaying()) this.toolAdTouch = { tool, x, y, identifier, core: this.core };
                    return;
                }
            }
        }
        // 道具栏点击：选中/取消道具
        for (let i = 0; i < this.tools.length; i++) {
            const t = this.tools[i];
            const dx = x - t.x;
            const dy = y - t.y;
            if (dx * dx + dy * dy <= t.r * t.r) {
                if (this.toolsCount[t.type] > 0) {
                    this.selectedTool = this.selectedTool === t.type ? null : t.type;
                    AudioFX.click();
                }
                return;
            }
        }

        // 已选中道具 + 点在棋盘 → 使用道具
        if (this.selectedTool && this.core && this.core.isPlaying()) {
            const grid = this.pointToGrid(x, y);
            if (grid) {
                const tool = this.selectedTool;
                this.selectedTool = null;
                if (this.toolsCount[tool] <= 0) {
                    AudioFX.invalid();
                    return;
                }
                Promise.resolve(this.core.useTool(tool, grid)).then((success) => {
                    if (success) {
                        if (this.onToolUsed) this.onToolUsed(tool);
                    } else {
                        this.parcelHint(grid);
                        AudioFX.invalid();
                    }
                }).catch(function () {
                    AudioFX.invalid();
                });
            }
            return;
        }

        // 正常棋盘交互
        if (!this.core || !this.core.isPlaying()) return;
        const grid = this.pointToGrid(x, y);
        if (!grid) return;
        this.touchStartPos = { x: x, y: y };
        this.touchStartGrid = grid;
        this.pressGrid = { row: grid.row, column: grid.column };
        if (!this.screen.reduceEffects) {
            const piece = this.findPiece(grid.row, grid.column);
            this.pressFeedback = piece ? { piece: piece, elapsed: 0 } : null;
        }
        this.touchMoved = false;
    }

    onTouchMove(x, y, identifier) {
        if (this.toolAdTouch) {
            const t = this.toolAdTouch;
            if (t.identifier !== identifier || Math.abs(x - t.x) > 8 || Math.abs(y - t.y) > 8) this.toolAdTouch = null;
            return;
        }
        if (!this.core || !this.core.isPlaying()) return;
        if (!this.touchStartPos || !this.touchStartGrid) return;

        const dx = x - this.touchStartPos.x;
        const dy = y - this.touchStartPos.y;
        const threshold = this.tileSize * 0.4;

        if (!this.touchMoved && (Math.abs(dx) > threshold || Math.abs(dy) > threshold)) {
            this.touchMoved = true;
            this.pressFeedback = null;
            const from = this.touchStartGrid;
            let to = null;

            if (Math.abs(dx) > Math.abs(dy)) {
                to = { row: from.row, column: from.column + (dx > 0 ? 1 : -1) };
            } else {
                to = { row: from.row + (dy > 0 ? 1 : -1), column: from.column };
            }

            const grid = this.core.grid;
            if (to.row >= 0 && to.row < grid.length && to.column >= 0 && to.column < grid[0].length) {
                // 异步触发交换（不 await，动画在后台进行）
                this.core.trySwap(from, to);
            }
        }
    }

    onTouchEnd(x, y, identifier) {
        const touch = this.toolAdTouch;
        this.toolAdTouch = null;
        this.touchStartPos = null;
        this.touchStartGrid = null;
        this.pressGrid = null;
        this.touchMoved = false;
        if (touch && touch.identifier === identifier && this.core === touch.core && this.core.isPlaying() &&
            !this.toolAdPending && this.toolAdAvailable && !this.battleMode && this.toolsCount[touch.tool.type] === 0 &&
            Math.abs(x - touch.x) <= 8 && Math.abs(y - touch.y) <= 8) {
            const r = touch.tool.adRect;
            if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) this.onToolAd(touch.tool.type);
        }
    }

    onTouchCancel() {
        this.toolAdTouch = null;
        this.onTouchEnd();
    }

    /** 屏幕坐标 → 格子坐标 */
    pointToGrid(x, y) {
        if (x < this.boardX || x >= this.boardX + this.boardW) return null;
        if (y < this.boardY || y >= this.boardY + this.boardH) return null;
        const column = Math.floor((x - this.boardX) / this.tileSize);
        const row = Math.floor((y - this.boardY) / this.tileSize);
        return { row: row, column: column };
    }

    /** 圆角矩形路径 */
    roundRect(x, y, w, h, r) {
        const ctx = this.ctx;
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}

function formatTimer(ms) {
    const totalSeconds = Math.max(0, Math.ceil(Number(ms) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

/** 颜色变亮（用于棋子渐变高光） */
function lighten(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + 55);
    const g = Math.min(255, ((n >> 8) & 255) + 55);
    const b = Math.min(255, (n & 255) + 55);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
}

module.exports = BoardRenderer;
