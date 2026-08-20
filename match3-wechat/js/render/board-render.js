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
        const types = ['hammer', 'bomb', 'color'];
        const r = 30;
        const gap = 96;
        const startX = (this.screen.width - (types.length - 1) * gap) / 2;
        const y = this.screen.height - 74;
        this.tools = [];
        for (let i = 0; i < types.length; i++) {
            this.tools.push({ type: types[i], x: startX + i * gap, y: y, r: r });
        }
    }

    /** 绘制底部道具栏（3 个道具 + 数量角标） */
    drawTools() {
        const ctx = this.ctx;
        const defs = coin.ITEM_DEFS;
        for (let i = 0; i < this.tools.length; i++) {
            const t = this.tools[i];
            const def = defs[t.type];
            const count = this.toolsCount[t.type];
            const selected = this.selectedTool === t.type;

            // 圆形底（选中高亮）
            ctx.fillStyle = selected ? THEME.primaryLight : 'rgba(255,255,255,0.88)';
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = selected ? THEME.primaryDark : THEME.boardBorder;
            ctx.lineWidth = selected ? 3 : 2;
            ctx.stroke();

            // 图标
            ctx.font = '26px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(def.icon, t.x, t.y - 2);

            // 数量角标
            if (count > 0) {
                ctx.fillStyle = THEME.primary;
                ctx.beginPath();
                ctx.arc(t.x + t.r * 0.62, t.y - t.r * 0.62, 11, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText(String(count), t.x + t.r * 0.62, t.y - t.r * 0.62 + 1);
            }
        }
    }

    /** 绑定游戏核心，并从 grid 初始化视觉棋子 */
    setGame(core) {
        this.core = core;
        this.computeLayout();
        this.syncPiecesFromGrid();
    }

    /** 计算棋盘布局（适配屏幕宽度） */
    computeLayout() {
        const cols = this.core.level.columns;
        const rows = this.core.level.rows;
        const margin = 12;
        this.tileSize = Math.floor((this.screen.width - margin * 2) / cols);
        this.boardW = this.tileSize * cols;
        this.boardH = this.tileSize * rows;
        this.boardX = Math.floor((this.screen.width - this.boardW) / 2);
        this.boardY = 100;
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
        this.syncPiecesFromGrid();
        return this.wait(100);
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
            dying: false
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

    /** 无效交换动画：撞墙效果——向目标方向顶两下再弹回（不真的滑过去） */
    animateInvalidSwap(from, to) {
        const a = this.findPiece(from.row, from.column);
        const b = this.findPiece(to.row, to.column);
        if (!a || !b) return this.wait(200);

        // 交换方向（相邻格，单位向量）
        const dirRow = to.row - from.row;
        const dirCol = to.column - from.column;
        const nudge = this.tileSize * 0.28; // 每次顶出的位移量

        const self = this;
        return (async function () {
            // 第一下：顶出再弹回
            self.nudgePiece(a, dirRow, dirCol, nudge);
            self.nudgePiece(b, -dirRow, -dirCol, nudge);
            await self.wait(90);
            self.movePieceTo(a, from.row, from.column);
            self.movePieceTo(b, to.row, to.column);
            await self.wait(90);

            // 第二下：顶出再弹回（更轻）
            self.nudgePiece(a, dirRow, dirCol, nudge * 0.6);
            self.nudgePiece(b, -dirRow, -dirCol, nudge * 0.6);
            await self.wait(80);
            self.movePieceTo(a, from.row, from.column);
            self.movePieceTo(b, to.row, to.column);
            await self.wait(90);
        })();
    }

    /** 让棋子朝目标方向临时顶出一段距离（撞墙效果） */
    nudgePiece(piece, dirRow, dirCol, distance) {
        const center = this.pieceCenter(piece.row, piece.col);
        piece.targetX = center.x + dirCol * distance;
        piece.targetY = center.y + dirRow * distance;
    }

    /** 爆发一组碎屑粒子 */
    spawnBurst(x, y, colors, count) {
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

    /** 消除动画：棋子缩小消失 + 碎屑粒子 + 障碍反馈 + 特殊棋子生成（含连消触发的消除） */
    animateMatch(data) {
        const removed = data.removed;
        const jellyHits = data.jellyHits || [];
        const iceHits = data.iceHits || [];
        const generated = data.generated || [];
        const targets = [];
        for (let i = 0; i < removed.length; i++) {
            const p = this.findPiece(removed[i].row, removed[i].column);
            if (p) {
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

        const self = this;
        return (async function () {
            await self.wait(200);
            // 移除已消失的棋子
            self.pieces = self.pieces.filter(function (p) { return !p.dying; });
        })();
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
    }

    // ===== 绘制 =====

    draw() {
        if (!this.core) return;
        const ctx = this.ctx;

        // 渐变背景
        const g = ctx.createLinearGradient(0, 0, 0, this.screen.height);
        g.addColorStop(0, THEME.bgTop);
        g.addColorStop(0.55, THEME.bgMid);
        g.addColorStop(1, THEME.bgBottom);
        ctx.fillStyle = g;
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

    /** 顶部信息栏（卡片化：关卡名 / 分数 / 步数 / 目标） */
    /**
     * 顶部栏（素材版）：关卡号框 + 目标栏（4只猫+数字）+ 步数框
     * 数字用 canvas 动态覆盖在素材的示例数字位置
     */
    drawTopBar() {
        const ctx = this.ctx;
        const w = this.screen.width;

        // 三个框的布局（基于设计稿 720 宽按屏宽等比缩放）
        const scale = w / 720;
        const topY = 16;

        // 关卡号框（左）
        const lvlW = 68;
        const lvlH = 52;
        const lvlX = 10;
        const lvlImg = assets.get('levelBadge');
        if (lvlImg && lvlImg.width > 0) {
            ctx.drawImage(lvlImg, lvlX, topY, lvlW, lvlH);
        }
        // 覆盖关卡号
        ctx.fillStyle = '#5A3A1A';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(this.core.level.id), lvlX + lvlW / 2, topY + lvlH * 0.66);

        // 步数框（右）
        const mvW = 58;
        const mvH = 52;
        const mvX = w - mvW - 10;
        const mvImg = assets.get('movesBadge');
        if (mvImg && mvImg.width > 0) {
            ctx.drawImage(mvImg, mvX, topY, mvW, mvH);
        }
        ctx.fillText(String(this.core.movesLeft), mvX + mvW / 2, topY + mvH * 0.66);

        // 目标栏（中）
        const goalW = mvX - lvlX - lvlW - 16;
        const goalH = 42;
        const goalX = lvlX + lvlW + 8;
        const goalY = topY + 5;
        const goalImg = assets.get('goalBar');
        if (goalImg && goalImg.width > 0) {
            ctx.drawImage(goalImg, goalX, goalY, goalW, goalH);
        }
        // 覆盖目标数字（4 个等分位置）
        const goals = this.core.level.goals || [];
        const jellyLeft = this.core.getJellyLeft();
        const targets = [];
        for (let i = 0; i < goals.length && targets.length < 4; i++) {
            if (goals[i].type === 'jelly') targets.push(jellyLeft);
        }
        while (targets.length < 4) targets.push('');
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 13px sans-serif';
        ctx.textBaseline = 'alphabetic';
        for (let i = 0; i < 4; i++) {
            if (targets[i] === '') continue;
            const sx = goalX + goalW * (i + 0.5) / 4;
            ctx.fillText(String(targets[i]), sx, goalY + goalH - 4);
        }

        // 步数进度条（顶部框下）
        const pbW = w - 20;
        const pbH = 16;
        const pbX = 10;
        const pbY = topY + lvlH + 8;
        const pbImg = assets.get('progressBar');
        if (pbImg && pbImg.width > 0) {
            ctx.drawImage(pbImg, pbX, pbY, pbW, pbH);
        }
        // 进度条填充比例（movesLeft 越大，左侧猫越多——按比例）
        const total = this.core.level.moveCount || 20;
        const ratio = Math.max(0, Math.min(1, this.core.movesLeft / total));
        ctx.fillStyle = 'rgba(255, 138, 165, 0.6)';
        ctx.fillRect(pbX + 6, pbY + 4, (pbW - 12) * ratio, pbH - 8);
    }

    /** 画棋盘底板 + 棋子 + 果冻罩 + 冰块罩 + 粒子 */
    drawBoard() {
        const ctx = this.ctx;

        // 棋盘底板
        ctx.fillStyle = THEME.boardBg;
        this.roundRect(this.boardX, this.boardY, this.boardW, this.boardH, 12);
        ctx.fill();
        ctx.strokeStyle = THEME.boardBorder;
        ctx.lineWidth = 1.5;
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
        for (let i = 0; i < this.pieces.length; i++) {
            this.drawPiece(this.pieces[i]);
        }

        // 果冻罩（绿色半透明圆罩，盖在棋子上）
        this.drawJellies();

        // 冰块罩（冰蓝方块罩，盖在棋子上）
        this.drawIces();

        // 粒子（碎屑效果，绘制在最上层）
        this.drawParticles();

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
                const cx = this.boardX + c * this.tileSize + this.tileSize / 2;
                const cy = this.boardY + r * this.tileSize + this.tileSize / 2;
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
                const x = this.boardX + c * this.tileSize;
                const y = this.boardY + r * this.tileSize;
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
                ctx.font = Math.floor(this.tileSize * 0.42) + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText('❄', x + this.tileSize / 2, y + this.tileSize / 2 + 1);

                // 冰晶光泽（右上角）
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.beginPath();
                ctx.arc(x + this.tileSize * 0.28, y + this.tileSize * 0.28, this.tileSize * 0.1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /** 画一个视觉棋子（特殊棋子画专属样式，普通棋子画色块+emoji） */
    drawPiece(piece) {
        const ctx = this.ctx;

        // 特殊棋子样式（火箭/炸弹）
        const special = config.getSpecialDef(piece.type);
        if (special) {
            const size = this.tileSize * piece.scale;
            if (size < 1) return;
            ctx.save();
            ctx.globalAlpha = piece.alpha;
            ctx.translate(piece.x, piece.y);
            ctx.scale(piece.scale, piece.scale);

            const half = this.tileSize / 2 - 2;
            // 深色圆底
            ctx.fillStyle = special.color;
            ctx.beginPath();
            ctx.arc(0, 0, half, 0, Math.PI * 2);
            ctx.fill();
            // 白色内圈（特殊感）
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, half - 5, 0, Math.PI * 2);
            ctx.stroke();
            // 符号
            ctx.font = 'bold ' + Math.floor(this.tileSize * 0.5) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(special.label, 0, 1);

            ctx.restore();
            return;
        }

        const def = config.getPieceTypeDef(piece.type);
        if (!def) return;

        const size = this.tileSize * piece.scale;
        if (size < 1) return;

        ctx.save();
        ctx.globalAlpha = piece.alpha;
        ctx.translate(piece.x, piece.y);
        ctx.scale(piece.scale, piece.scale);

        // 优先用猫咪素材图（type 1-5 对应 piece1-5），无图则回退代码绘制
        const pieceImg = assets.get('piece' + piece.type);
        const s = this.tileSize * 0.78;
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
            ctx.font = Math.floor(this.tileSize * 0.5) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(def.label, 0, 1);
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
                this.core.useTool(tool, grid);
                if (this.onToolUsed) this.onToolUsed(tool);
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
        if (x < this.boardX || x > this.boardX + this.boardW) return null;
        if (y < this.boardY || y > this.boardY + this.boardH) return null;
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

/** 颜色变亮（用于棋子渐变高光） */
function lighten(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + 55);
    const g = Math.min(255, ((n >> 8) & 255) + 55);
    const b = Math.min(255, (n & 255) + 55);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
}

module.exports = BoardRenderer;
