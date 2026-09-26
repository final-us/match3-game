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
const assets = require('./assets');
const THEME = require('./theme');
const typography = require('./typography');
const moon = require('./moon-controls');

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
    if (type === config.SPECIAL_TYPES.H_ROCKET) return 2;
    if (type === config.SPECIAL_TYPES.V_ROCKET) return 3;
    if (type === config.SPECIAL_TYPES.COLOR_BALL) return 5;
    return 4;
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
        this.battleMode = false; // 双人对战模式：不画单机顶部栏/道具栏
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
        const lowest = this.screen.height - (Number(this.screen.safeBottom) || 0) - r - 12;
        const y = Math.min(lowest, this.boardY + this.boardH + 76);
        this.tools = [];
        for (let i = 0; i < types.length; i++) {
            this.tools.push({ type: types[i], x: startX + i * gap, y: y, r: r });
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
            this.roundRect(left, this.tools[0].y - 44, right - left, 88, 30);
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

            // 数量角标
            if (count > 0) {
                ctx.fillStyle = THEME.primary;
                ctx.beginPath();
                ctx.arc(t.x + t.r * 0.62, t.y - t.r * 0.62, 11, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
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

        const top = Math.max(72, Number(this.screen.contentTop) || Number(this.screen.safeTop) || 0) + 118;
        // Reserve the full tool surface plus a gap; width alone overflows short phones.
        const bottom = this.screen.height - (Number(this.screen.safeBottom) || 0) - 108;
        this.tileSize = Math.max(1, Math.min(widthTileSize, Math.floor((bottom - top) / rows)));
        this.boardW = this.tileSize * cols;
        this.boardH = this.tileSize * rows;
        this.boardX = Math.floor(safeLeft + (safeWidth - this.boardW) / 2);
        this.boardY = Math.floor(top);
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
    animateInvalidSwap(from, to) {
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

    spawnSpecialEffect(type, x, y) {
        this.specialEffects.push({ type: type, x: x, y: y, life: 0, maxLife: this.screen.reduceEffects ? 180 : 420 });
    }

    /**
     * Add the moon-crystal overlay for one match payload.  The core deliberately
     * uses the core's explicit specialCombo contract plus the actual
     * removed/jelly/ice footprint. Chained specials stay local.
     */
    spawnMatchEffects(data) {
        const triggered = data.triggeredSpecials || [];
        const footprint = (data.removed || []).concat(data.jellyHits || [], data.iceHits || []);
        const combo = data.specialCombo || null;

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
            if (combo && ((item.row === combo.first.row && item.column === combo.first.column && item.type === combo.first.type) ||
                (item.row === combo.second.row && item.column === combo.second.column && item.type === combo.second.type))) continue;
            if (!config.isSpecialType(item.type)) continue;
            const center = this.pieceCenter(item.row, item.column);
            this.spawnSpecialEffect(item.type, center.x, center.y);
        }
    }

    /** 消除动画：棋子缩小消失 + 碎屑粒子 + 障碍反馈 + 特殊棋子生成（含连消触发的消除） */
    animateMatch(data) {
        const removed = data.removed;
        const jellyHits = data.jellyHits || [];
        const iceHits = data.iceHits || [];
        const generated = data.generated || [];
        const targets = [];
        this.spawnMatchEffects(data);
        for (let i = 0; i < removed.length; i++) {
            const p = this.findPiece(removed[i].row, removed[i].column);
            if (p) {
                const logicalType = this.core.grid[removed[i].row][removed[i].column];
                if (config.isSpecialType(logicalType) && p.type !== logicalType) {
                    p.type = logicalType;
                    p.baseType = this.core.getSpecialBaseType(removed[i]) || specialBaseType(logicalType);
                }
                p.targetScale = 0;
                p.dying = true;
                targets.push(p);

                // 每个被消除的棋子爆发碎屑粒子（颜色与棋子一致）
                const center = this.pieceCenter(p.row, p.col);
                const special = config.getSpecialDef(p.type);
                if (special) {
                    // 特殊棋子被触发：爆大粒子（特效感）
                    this.spawnBurst(center.x, center.y, [special.color, '#FFFFFF'], 22);
                } else {
                    const def = config.getPieceTypeDef(p.type);
                    this.spawnBurst(center.x, center.y, def ? [def.color] : ['#888888'], 10);
                }
            }
        }

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
            this.spawnBurst(center.x, center.y, ['#7ED6A5', '#FFFFFF'], cleared ? 10 : 5);
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
        }

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
        const y = Math.max(72, Number(this.screen.contentTop) || Number(this.screen.safeTop) || 0) + 6;
        const self = this;

        function pill(x, py, pw, ph, image, label, value, warning) {
            moon.button(ctx,x,py,pw,ph,'',warning?'pink':'blue');
            let textX = x + pw / 2;
            let textW = pw - 10;
            if (image) {
                const iconBox = Math.min(ph + 4, pw * 0.34);
                drawImageContain(ctx, image, x - 1, py - 2, iconBox, ph + 4);
                textX = x + iconBox + (pw - iconBox) / 2;
                textW = pw - iconBox - 8;
            }
            ctx.fillStyle = warning ? '#A92D52' : THEME.textDark;
            ctx.shadowColor = 'rgba(255,255,255,0.72)';
            ctx.shadowBlur = 2;
            typography.drawFit(ctx, String(value), textX, py + ph * 0.58, textW, {
                size: Math.max(15, Math.floor(ph * 0.42)), minSize: 8,
                weight: 'bold', numbers: true, align: 'center'
            });
            ctx.shadowColor = 'transparent';
            if (label) {
                ctx.fillStyle = THEME.textMid;
                typography.drawFit(ctx, label, textX, py + 9, textW, {
                    size: 9, minSize: 7, align: 'center'
                });
            }
        }

        const inner=w-16, levelW=inner*.22, scoreW=inner*.46-12, movesW=inner*.32;
        pill(8, y, levelW, 44, null, '关卡', this.core.level.id, false);
        pill(14+levelW, y, scoreW, 44, null, '当前得分', this.core.score, false);
        pill(w-8-movesW, y, movesW, 44, assets.get('uiMoves'), '剩余步数', this.core.movesLeft, this.core.movesLeft<=5);

        const goals = this.core.level.goals || [];
        const goalText = [];
        const collectGoal = goals.find(function (goal) { return goal.type === 'collect'; });
        for (let i = 0; i < goals.length; i++) {
            if (goals[i].type === 'jelly') goalText.push('果冻剩余 ' + this.core.getJellyLeft());
            if (goals[i].type === 'yarn') goalText.push(this.core.getYarnHealth() ? '毛线源头 ' + this.core.getYarnHealth() + '/' + goals[i].target : '毛线已清除');
            if (goals[i].type === 'score') goalText.push('目标分 ' + goals[i].target);
        }
        const timed = Number(this.core.timeLimitMs) > 0;
        const goalX = 8;
        const goalY = y + 52;
        const goalW = w - 16;
        const goalH = 50;
        moon.panel(ctx,this.screen,goalX,goalY,goalW,goalH);

        function drawGoals(x, width) {
            if (goals.length > 2) {
                for (let index = 0; index < goals.length; index++) {
                    const goal = goals[index];
                    const lineY = goalY + 9 + index * 16;
                    let label = '';
                    let icon = null;
                    if (goal.type === 'collect') {
                        const counts = self.core.collectedCounts || {};
                        const remaining = Math.max(0, goal.target - (counts[goal.pieceType] || 0));
                        label = remaining ? '还需 ' + remaining + ' 只' : '收集完成';
                        icon = assets.get('piece' + goal.pieceType);
                    } else if (goal.type === 'jelly') label = '果冻剩余 ' + self.core.getJellyLeft();
                    else if (goal.type === 'yarn') label = self.core.getYarnHealth() ?
                        '毛线源头 ' + self.core.getYarnHealth() + '/' + goal.target : '毛线已清除';
                    else if (goal.type === 'score') label = '目标分 ' + goal.target;
                    if (icon) drawImageContain(ctx, icon, x + 2, lineY - 10, 20, 20);
                    typography.drawFit(ctx, label, x + (icon ? 25 : 2), lineY,
                        width - (icon ? 27 : 4), {
                            size: 12, minSize: 9, weight: 'bold', numbers: true
                        });
                }
                return;
            }
            if (!collectGoal) {
                typography.drawFit(ctx, goalText.join(' · ') || '完成挑战', x + width / 2, goalY + goalH / 2, width, {
                    size: 15, minSize: 9, weight: 'bold', align: 'center', numbers: true
                });
                return;
            }
            const counts = self.core.collectedCounts || {};
            const remaining = Math.max(0, collectGoal.target - (counts[collectGoal.pieceType] || 0));
            const firstY = goalY + (goalText.length ? 14 : goalH / 2);
            drawImageContain(ctx, assets.get('piece' + collectGoal.pieceType), x + 2, firstY - 13, 26, 26);
            typography.drawFit(ctx, remaining ? '还需 ' + remaining + ' 只' : '收集完成', x + 34, firstY, width - 36, {
                size: 14, minSize: 11, weight: 'bold', numbers: true
            });
            if (goalText.length) {
                typography.drawFit(ctx, goalText.join(' · '), x + 2, goalY + 36, width - 4, {
                    size: 12, minSize: 10, numbers: true
                });
            }
        }

        if (timed) {
            const warning = Number(this.core.timeLeftMs) <= 10000;
            const timerW = Math.min(124, Math.max(112, goalW * 0.34));
            const timerX = goalX + goalW - timerW;
            ctx.fillStyle = THEME.textScene;
            drawGoals(goalX + 10, goalW - timerW - 18);
            ctx.fillStyle = warning ? '#A92D52' : THEME.textScene;
            typography.drawFit(ctx, '时间', timerX + timerW / 2, goalY + 15, timerW - 8, {
                size: 12, minSize: 8, weight: 'bold', align: 'center'
            });
            typography.drawFit(ctx, formatTimer(this.core.timeLeftMs), timerX + timerW / 2, goalY + 36, timerW - 8, {
                size: 23, minSize: 12, weight: 'bold', numbers: true, align: 'center'
            });
        } else {
            ctx.fillStyle = THEME.textScene;
            drawGoals(goalX + 8, goalW - 16);
        }
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

        // 果冻罩（绿色半透明圆罩，盖在棋子上）
        this.drawJellies();

        // 冰块罩（冰蓝方块罩，盖在棋子上）
        this.drawIces();

        this.drawYarn();

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
            const progress = Math.min(1, effect.life / effect.maxLife);
            const alpha = Math.sin(progress * Math.PI) * 0.92;
            ctx.save();
            ctx.beginPath();
            ctx.rect(this.boardX, this.boardY, this.boardW, this.boardH);
            ctx.clip();
            ctx.globalAlpha = alpha;
            if (!this.screen.reduceEffects) ctx.globalCompositeOperation = 'lighter';

            if (effect.kind) {
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
                const radius = this.tileSize * (0.45 + progress * 2.15);
                ctx.strokeStyle = '#FFD4F0';
                ctx.lineWidth = Math.max(2, this.tileSize * (0.13 - progress * 0.08));
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = '#FFE6A8';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(effect.x, effect.y, radius * 0.62, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }
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

    /**
     * 画果冻罩：绿色半透明圆形罩（盖住棋子，Q 弹果冻感），带高光+气泡
     * 与冰块（蓝色方块+雪花）形状/颜色/图标三重区分
     */
    drawJellies() {
        const ctx = this.ctx;
        const jelly = this.core.jellyGrid;
        for (let r = 0; r < jelly.length; r++) {
            for (let c = 0; c < jelly[r].length; c++) {
                const layers = jelly[r][c];
                if (!layers) continue;
                const offset = this.invalidSwapOffset(r, c);
                const cx = this.boardX + c * this.tileSize + this.tileSize / 2 + (offset ? offset.x : 0);
                const cy = this.boardY + r * this.tileSize + this.tileSize / 2 + (offset ? offset.y : 0);
                const s = this.tileSize * 0.46;

                // 果冻罩主体（半透明，棋子透过可见）
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#5ECB71';
                ctx.beginPath();
                ctx.arc(cx, cy, s, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;

                // 果冻边缘（深绿轮廓，圆润感）
                ctx.strokeStyle = '#2F8F4C';
                ctx.lineWidth = 2;
                ctx.stroke();

                // 顶部高光
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.beginPath();
                ctx.arc(cx - s * 0.32, cy - s * 0.38, s * 0.22, 0, Math.PI * 2);
                ctx.fill();

                // 气泡（果冻 Q 弹质感）
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.beginPath();
                ctx.arc(cx + s * 0.3, cy + s * 0.1, s * 0.12, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx + s * 0.05, cy + s * 0.42, s * 0.08, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * 画冰块罩：实心冰蓝方块盖住棋子（棋子若隐若现），白边 + 雪花 + 冰晶光
     */
    drawIces() {
        const ctx = this.ctx;
        const ice = this.core.iceGrid;
        for (let r = 0; r < ice.length; r++) {
            for (let c = 0; c < ice[r].length; c++) {
                if (!ice[r][c]) continue;
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
        if (!source || source.health <= 0) return;
        const ctx = this.ctx;
        const cells = [{ row: source.row, column: source.column, root: true }];
        Object.keys(this.core.yarnVines).forEach(function (key) {
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
                typography.drawFit(ctx, String(source.health), badgeX, badgeY, 15, {
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
            ctx.strokeStyle = piece.type === config.SPECIAL_TYPES.BOMB ? '#FF9ED2' : '#FFE09B';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, (half - 1) * pulse, 0, Math.PI * 2);
            ctx.stroke();

            if (piece.type === config.SPECIAL_TYPES.BOMB) {
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
            ctx.drawImage(pieceImg, -s / 2, -s / 2, s, s);
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

    onTouchStart(x, y) {
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

    onTouchMove(x, y) {
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

    onTouchEnd() {
        this.touchStartPos = null;
        this.touchStartGrid = null;
        this.pressGrid = null;
        this.touchMoved = false;
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
