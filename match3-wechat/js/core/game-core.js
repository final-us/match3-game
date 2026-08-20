/**
 * 游戏核心状态机（异步分步动画版）
 * 职责：交换校验、消除循环（消除→下落→填充→连消）、计分、胜负判定
 * 障碍系统：
 *   - 果冻（jellyGrid）：棋子在该格被消除时果冻破一层，多层需多次消除；目标=清完所有果冻
 *   - 冰块（iceGrid）：罩住棋子使其不能主动交换移动，只能被相邻消除波及，消除时冰碎棋消
 * 动画设计：每一步通过回调（返回 Promise）留出动画时间，逻辑与视觉通过事件同步
 */

const gridUtil = require('./grid');
const config = require('./config');

class GameCore {
    /**
     * @param {object} levelData 关卡数据 { rows, columns, moveCount, goals, underlays, obstacles }
     *   underlays: { 'row:col': 层数 } 果冻
     *   obstacles: { 'row:col': 1 } 冰块
     * @param {object} callbacks 回调 { onSwap, onInvalidSwap, onMatch, onGravity, onFill, onLevelEnd }
     */
    constructor(levelData, callbacks) {
        this.level = levelData;
        this.callbacks = callbacks || {};
        this.grid = [];
        this.jellyGrid = [];
        this.iceGrid = [];
        this.jellyTotal = 0;
        this.score = 0;
        this.movesLeft = levelData.moveCount || 25;
        this.processing = false;
        this.ended = false;
        this.won = false;
        this.minMatchCount = 3; // 最小消除数（默认 3 连；「干扰」道具时设为 4）
        this.pendingTriggers = []; // 玩家交换特殊棋子时待触发的列表
        this.initGrid();
    }

    /** 初始化棋盘 + 障碍层 */
    initGrid() {
        const rows = this.level.rows;
        const cols = this.level.columns;

        this.grid = gridUtil.createGrid(rows, cols, config.getCommonTypes());
        this.score = 0;
        this.movesLeft = this.level.moveCount || 25;
        this.processing = false;
        this.ended = false;
        this.won = false;
        this.pendingTriggers = [];

        // 果冻层
        this.jellyGrid = [];
        this.jellyTotal = 0;
        for (let r = 0; r < rows; r++) {
            this.jellyGrid[r] = [];
            for (let c = 0; c < cols; c++) this.jellyGrid[r][c] = 0;
        }
        const underlays = this.level.underlays || {};
        for (const key in underlays) {
            const parts = key.split(':');
            const r = parseInt(parts[0], 10);
            const c = parseInt(parts[1], 10);
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
                const layers = underlays[key] || 1;
                this.jellyGrid[r][c] = layers;
                this.jellyTotal += layers;
            }
        }

        // 冰块层
        this.iceGrid = [];
        for (let r = 0; r < rows; r++) {
            this.iceGrid[r] = [];
            for (let c = 0; c < cols; c++) this.iceGrid[r][c] = 0;
        }
        const obstacles = this.level.obstacles || {};
        for (const key in obstacles) {
            const parts = key.split(':');
            const r = parseInt(parts[0], 10);
            const c = parseInt(parts[1], 10);
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
                this.iceGrid[r][c] = 1;
            }
        }
    }

    /** 是否可交互 */
    isPlaying() {
        return !this.processing && !this.ended;
    }

    /** 剩余果冻单位数 */
    getJellyLeft() {
        let left = 0;
        for (let r = 0; r < this.jellyGrid.length; r++) {
            for (let c = 0; c < this.jellyGrid[r].length; c++) {
                left += this.jellyGrid[r][c];
            }
        }
        return left;
    }

    /** 是否有冰块障碍 */
    hasIce() {
        for (let r = 0; r < this.iceGrid.length; r++) {
            for (let c = 0; c < this.iceGrid[r].length; c++) {
                if (this.iceGrid[r][c]) return true;
            }
        }
        return false;
    }

    /**
     * 玩家尝试交换两个棋子（异步）
     */
    async trySwap(from, to) {
        if (!this.isPlaying()) return;

        // 覆盖锁定：被果冻/冰块覆盖的棋子不能主动交换（像钉住一样推不动）
        if (this.isBlocked(from) || this.isBlocked(to)) {
            if (this.callbacks.onInvalidSwap) await this.callbacks.onInvalidSwap(from, to);
            return;
        }

        const typeA = gridUtil.getPieceType(this.grid, from);
        const typeB = gridUtil.getPieceType(this.grid, to);
        if (!typeA || !typeB) return;
        const rowDiff = Math.abs(from.row - to.row);
        const colDiff = Math.abs(from.column - to.column);
        if (rowDiff + colDiff !== 1) return;

        const valid = this.validateMove(from, to);
        if (!valid) {
            if (this.callbacks.onInvalidSwap) await this.callbacks.onInvalidSwap(from, to);
            return;
        }

        gridUtil.swapTypeInGrid(this.grid, from, to);
        this.movesLeft--;

        // 特殊棋子被玩家交换 → 标记为待触发（交换后触发特效）
        this.pendingTriggers = [];
        const typeFromNew = gridUtil.getPieceType(this.grid, from);
        const typeToNew = gridUtil.getPieceType(this.grid, to);
        if (config.isSpecialType(typeFromNew)) {
            this.pendingTriggers.push({ row: from.row, column: from.column });
        }
        if (config.isSpecialType(typeToNew)) {
            this.pendingTriggers.push({ row: to.row, column: to.column });
        }

        if (this.callbacks.onSwap) await this.callbacks.onSwap(from, to);

        await this.processGrid();
    }

    /** 校验交换是否有效（特殊棋子交换视为有效，普通棋子需形成匹配） */
    validateMove(from, to) {
        const typeFrom = gridUtil.getPieceType(this.grid, from);
        const typeTo = gridUtil.getPieceType(this.grid, to);

        // 任一方向为特殊棋子 → 交换总是有效（用于触发特效）
        if (config.isSpecialType(typeFrom) || config.isSpecialType(typeTo)) return true;

        const tempGrid = gridUtil.cloneGrid(this.grid);
        gridUtil.swapTypeInGrid(tempGrid, from, to);
        const matches = gridUtil.getMatches(tempGrid, [from, to], this.minMatchCount);
        return matches.length >= 1;
    }

    /**
     * 收集消除位置并生成特殊棋子（4 连横→横火箭 / 4 连竖→竖火箭 / 5 连→炸弹）
     * @param {Array} matches 匹配列表
     * @returns {{removed: Array, generated: Array}} removed=要消除的位置，generated=[{pos, type}]
     */
    collectWithSpecials(matches) {
        const reserved = [];
        const generated = [];

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const len = match.length;
            const isHoriz = match.every(function (p) { return p.row === match[0].row; });

            let spType = 0;
            if (len >= 5) spType = config.SPECIAL_TYPES.BOMB;
            else if (len === 4 && isHoriz) spType = config.SPECIAL_TYPES.H_ROCKET;
            else if (len === 4 && !isHoriz) spType = config.SPECIAL_TYPES.V_ROCKET;

            if (spType) {
                const mid = match[Math.floor(len / 2)];
                // 去重：一个位置只生成一个特殊棋子（重叠匹配优先保留先生成的）
                if (!gridUtil.includesPosition(reserved, mid)) {
                    reserved.push({ row: mid.row, column: mid.column });
                    generated.push({ pos: { row: mid.row, column: mid.column }, type: spType });
                }
            }
        }

        // 普通消除位置 = 匹配中所有位置 - 生成特殊棋子的位置
        const removed = [];
        for (let i = 0; i < matches.length; i++) {
            for (let j = 0; j < matches[i].length; j++) {
                const pos = matches[i][j];
                if (gridUtil.includesPosition(reserved, pos)) continue;
                if (!gridUtil.includesPosition(removed, pos)) {
                    removed.push({ row: pos.row, column: pos.column });
                }
            }
        }
        return { removed: removed, generated: generated };
    }

    /**
     * 特殊棋子触发连锁：removed 中的特殊棋子触发特效（炸行/列/3x3），波及的棋子并入 removed
     * 波及到其他特殊棋子时递归触发（连锁反应）
     */
    expandSpecialTriggers(removed) {
        const grid = this.grid;
        const rows = grid.length;
        const cols = grid[0].length;
        const queue = [];

        // 初始：removed 中含特殊棋子的入队
        for (let i = 0; i < removed.length; i++) {
            if (config.isSpecialType(grid[removed[i].row][removed[i].column])) {
                queue.push({ row: removed[i].row, column: removed[i].column });
            }
        }

        let guard = 0;
        while (queue.length && guard < 200) {
            guard++;
            const pos = queue.pop();
            const type = grid[pos.row][pos.column];
            const targets = [];

            if (type === config.SPECIAL_TYPES.H_ROCKET) {
                // 炸整行
                for (let c = 0; c < cols; c++) targets.push({ row: pos.row, column: c });
            } else if (type === config.SPECIAL_TYPES.V_ROCKET) {
                // 炸整列
                for (let r = 0; r < rows; r++) targets.push({ row: r, column: pos.column });
            } else if (type === config.SPECIAL_TYPES.BOMB) {
                // 炸 3x3
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        targets.push({ row: pos.row + dr, column: pos.column + dc });
                    }
                }
            }

            for (let k = 0; k < targets.length; k++) {
                const t = targets[k];
                if (!gridUtil.isValidPosition(grid, t)) continue;
                if (!gridUtil.includesPosition(removed, t)) {
                    removed.push({ row: t.row, column: t.column });
                    // 波及到特殊棋子 → 入队连锁
                    if (config.isSpecialType(grid[t.row][t.column])) {
                        queue.push({ row: t.row, column: t.column });
                    }
                }
            }
        }
    }

    /** 判断位置是否被果冻/冰块覆盖（覆盖棋子锁定，不参与下落） */
    isBlocked(pos) {
        return this.jellyGrid[pos.row][pos.column] > 0 || this.iceGrid[pos.row][pos.column] === 1;
    }

    /** 是否存在可行交换（排除被覆盖棋子作为交换源/目标） */
    hasValidMoves() {
        const grid = this.grid;
        const rows = grid.length;
        const cols = grid[0].length;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cur = { row: r, column: c };
                if (this.isBlocked(cur)) continue;

                // 尝试与右邻交换
                if (c + 1 < cols) {
                    const to = { row: r, column: c + 1 };
                    if (!this.isBlocked(to) && this.swapCreatesMatch(cur, to)) return true;
                }
                // 尝试与下邻交换
                if (r + 1 < rows) {
                    const to = { row: r + 1, column: c };
                    if (!this.isBlocked(to) && this.swapCreatesMatch(cur, to)) return true;
                }
            }
        }
        return false;
    }

    /** 交换后是否会产生匹配（克隆棋盘检测，不修改实际棋盘） */
    swapCreatesMatch(from, to) {
        const temp = gridUtil.cloneGrid(this.grid);
        gridUtil.swapTypeInGrid(temp, from, to);
        return gridUtil.getMatches(temp, [from, to], this.minMatchCount).length > 0;
    }

    /**
     * 自动重排：棋盘无可行交换时，重建棋子（保留障碍层，确保无匹配且有可行步）
     */
    async autoReshuffle() {
        const types = config.getCommonTypes();
        let guard = 0;
        while (guard < 30) {
            guard++;
            // 用"无匹配生成器"重建棋子（障碍层 jellyGrid/iceGrid 不受影响）
            this.grid = gridUtil.createGrid(this.grid.length, this.grid[0].length, types);
            if (this.hasValidMoves()) break;
        }
        if (this.callbacks.onReshuffle) {
            await this.callbacks.onReshuffle();
        }
    }

    /** 带覆盖锁定的重力下落（被覆盖棋子不动） */
    applyGravityBlocked() {
        return gridUtil.applyGravity(this.grid, this.isBlocked.bind(this));
    }

    /**
     * 斜向滑入：被覆盖棋子正下方的空位，由相邻列的棋子斜向滑入填充
     * （被覆盖棋子保持原位不动）
     * @returns {Array} changes [[from, to], ...]
     */
    applySlides() {
        const rows = this.grid.length;
        const cols = this.grid[0].length;
        const changes = [];

        // 从下往上扫描
        for (let r = rows - 1; r >= 1; r--) {
            for (let c = 0; c < cols; c++) {
                // 上方 (r-1, c) 是被覆盖格，且 (r, c) 是空位
                if (!this.isBlocked({ row: r - 1, column: c })) continue;
                const emptyBelow = { row: r, column: c };
                if (gridUtil.getPieceType(this.grid, emptyBelow) !== 0) continue;

                // 尝试从相邻列斜向滑入（优先左，再右）
                const candidates = [];
                if (c - 1 >= 0) candidates.push({ row: r - 1, column: c - 1 });
                if (c + 1 < cols) candidates.push({ row: r - 1, column: c + 1 });

                for (let i = 0; i < candidates.length; i++) {
                    const cand = candidates[i];
                    const type = gridUtil.getPieceType(this.grid, cand);
                    if (type && !this.isBlocked(cand)) {
                        // 斜向滑入：相邻列棋子 → 覆盖格下方空位
                        gridUtil.setPieceType(this.grid, emptyBelow, type);
                        gridUtil.setPieceType(this.grid, cand, 0);
                        changes.push([
                            { row: cand.row, column: cand.column },
                            { row: emptyBelow.row, column: emptyBelow.column }
                        ]);
                        break;
                    }
                }
            }
        }
        return changes;
    }

    /**
     * 棋盘整理：下落（覆盖锁定）→ 斜向滑入 → 再下落 → 填充
     * 供消除循环与道具使用后共用（道具消除后即使无匹配也要补位）
     */
    async settleBoard() {
        // 下落 + 动画（被覆盖棋子锁定不动）
        const changes = this.applyGravityBlocked();
        if (this.callbacks.onGravity && changes.length) {
            await this.callbacks.onGravity({ changes: changes });
        }

        // 斜向滑入（覆盖格下方空位由相邻列棋子填充）
        const slides = this.applySlides();
        if (this.callbacks.onGravity && slides.length) {
            await this.callbacks.onGravity({ changes: slides });
        }

        // 滑走后留下的空位再次下落
        const changes2 = this.applyGravityBlocked();
        if (this.callbacks.onGravity && changes2.length) {
            await this.callbacks.onGravity({ changes: changes2 });
        }

        // 填充 + 动画
        const filled = gridUtil.fillUp(this.grid, config.getCommonTypes());
        if (this.callbacks.onFill && filled.length) {
            await this.callbacks.onFill({ filled: filled });
        }
    }

    /**
     * 消除主循环（异步分步）
     * 障碍规则：
     *   - 果冻：消除命中果冻格时，果冻破 1 层、棋子保留（需再消一次才消掉棋子）
     *   - 冰块：消除命中冰块格 或 其上下左右相邻格时，冰块融化、露出原棋子（棋子保留）
     */
    async processGrid() {
        this.processing = true;
        let round = 0;
        let guard = 0;

        while (guard < 50) {
            guard++;
            const matches = gridUtil.getMatches(this.grid, null, this.minMatchCount);
            // 有待触发特殊棋子时，即使无普通匹配也要继续处理
            const hasPending = this.pendingTriggers.length > 0;
            if (!matches.length && !hasPending) break;
            round++;

            // 收集消除位置 + 生成特殊棋子（4连/5连）
            const collect = this.collectWithSpecials(matches);
            const allRemoved = collect.removed.slice();
            const generated = collect.generated;

            // 合并玩家交换触发的特殊棋子（待触发）
            for (let i = 0; i < this.pendingTriggers.length; i++) {
                const pt = this.pendingTriggers[i];
                if (!gridUtil.includesPosition(allRemoved, pt)) {
                    allRemoved.push({ row: pt.row, column: pt.column });
                }
            }
            this.pendingTriggers = [];

            // 特殊棋子触发连锁（removed 中的特殊棋子炸行/列/3x3，波及并入）
            this.expandSpecialTriggers(allRemoved);

            // 第一遍：决定哪些棋子真正消除，哪些被障碍挡住（棋子保留）
            const jellyHits = [];
            const iceHits = [];
            const removed = []; // 真正被消除（置 0）的棋子

            for (let i = 0; i < allRemoved.length; i++) {
                const pos = allRemoved[i];
                const type = gridUtil.getPieceType(this.grid, pos);
                const isSpecial = config.isSpecialType(type);

                if (!isSpecial && this.jellyGrid[pos.row][pos.column] > 0) {
                    // 普通棋子 + 果冻：果冻破层，棋子保留
                    this.jellyGrid[pos.row][pos.column]--;
                    jellyHits.push({ row: pos.row, column: pos.column });
                } else if (!isSpecial && this.iceGrid[pos.row][pos.column]) {
                    // 普通棋子 + 冰块：冰块融化，棋子保留
                    this.iceGrid[pos.row][pos.column] = 0;
                    iceHits.push({ row: pos.row, column: pos.column });
                } else {
                    // 普通棋子正常消除；特殊棋子触发（消耗品，不受果冻/冰块阻挡）
                    removed.push({ row: pos.row, column: pos.column });

                    // 特殊棋子引爆时，所在格的障碍一并破坏
                    if (this.jellyGrid[pos.row][pos.column] > 0) {
                        this.jellyGrid[pos.row][pos.column] = 0;
                        if (!gridUtil.includesPosition(jellyHits, pos)) {
                            jellyHits.push({ row: pos.row, column: pos.column });
                        }
                    }
                    if (this.iceGrid[pos.row][pos.column]) {
                        this.iceGrid[pos.row][pos.column] = 0;
                        if (!gridUtil.includesPosition(iceHits, pos)) {
                            iceHits.push({ row: pos.row, column: pos.column });
                        }
                    }
                }
            }

            // 第二遍：消除位置的上下左右邻居，若有冰块则波及融化（露出邻居棋子）
            for (let i = 0; i < removed.length; i++) {
                const pos = removed[i];
                const neighbors = [
                    { row: pos.row - 1, column: pos.column },
                    { row: pos.row + 1, column: pos.column },
                    { row: pos.row, column: pos.column - 1 },
                    { row: pos.row, column: pos.column + 1 }
                ];
                for (let k = 0; k < neighbors.length; k++) {
                    const n = neighbors[k];
                    if (gridUtil.isValidPosition(this.grid, n) && this.iceGrid[n.row][n.column]) {
                        this.iceGrid[n.row][n.column] = 0;
                        if (!gridUtil.includesPosition(iceHits, n)) {
                            iceHits.push({ row: n.row, column: n.column });
                        }
                    }
                }
            }

            // 计分：实际消除棋子 + 连消加成 + 果冻/冰块奖励 + 特殊触发奖励
            const base = removed.length * 10;
            const comboBonus = (round - 1) * 50;
            const jellyBonus = jellyHits.length * 30;
            const iceBonus = iceHits.length * 50;
            this.score += base + comboBonus + jellyBonus + iceBonus;

            // 消除动画（removed=真正消失的棋子，generated=新生成的特殊棋子）
            if (this.callbacks.onMatch) {
                await this.callbacks.onMatch({
                    removed: removed,
                    combo: round,
                    score: this.score,
                    jellyHits: jellyHits,
                    iceHits: iceHits,
                    generated: generated
                });
            }

            // 置 0（只真正消除的棋子；被障碍挡住的棋子保留）
            for (let i = 0; i < removed.length; i++) {
                gridUtil.setPieceType(this.grid, removed[i], 0);
            }

            // 生成特殊棋子（写入 grid，作为棋盘上的新棋子；若生成位置被波及消除则放弃）
            for (let i = 0; i < generated.length; i++) {
                const g = generated[i];
                if (gridUtil.includesPosition(removed, g.pos)) continue;
                gridUtil.setPieceType(this.grid, g.pos, g.type);
            }

            // 棋盘整理（下落+斜向滑入+填充）
            await this.settleBoard();
        }

        this.processing = false;

        // 死局检测：无可行交换时自动重排（避免玩家卡死）
        if (!this.hasValidMoves()) {
            await this.autoReshuffle();
        }

        this.checkLevelEnd();
    }

    /** 检查关卡是否结束（多目标：分数 + 果冻） */
    checkLevelEnd() {
        if (this.ended) return;

        const goals = this.level.goals || [];
        let allGoalsDone = goals.length > 0;

        // 分数目标
        for (let i = 0; i < goals.length; i++) {
            if (goals[i].type === 'score' && this.score < goals[i].target) allGoalsDone = false;
        }

        // 果冻目标：显式定义或自动（有关卡果冻即要求清完）
        const jellyLeft = this.getJellyLeft();
        let hasJellyGoal = false;
        for (let i = 0; i < goals.length; i++) {
            if (goals[i].type === 'jelly') {
                hasJellyGoal = true;
                if (jellyLeft > 0) allGoalsDone = false;
            }
        }
        if (this.jellyTotal > 0 && !hasJellyGoal && jellyLeft > 0) {
            allGoalsDone = false;
        }

        // 无任何目标（纯分数挑战）
        if (goals.length === 0 && this.jellyTotal === 0) {
            allGoalsDone = this.score >= 1000;
        }

        if (allGoalsDone || this.movesLeft <= 0) {
            this.ended = true;
            this.won = allGoalsDone;
            if (this.callbacks.onLevelEnd) {
                this.callbacks.onLevelEnd({
                    win: allGoalsDone,
                    score: this.score,
                    movesLeft: this.movesLeft
                });
            }
        }
    }

    /**
     * 局外道具使用（不消耗步数）
     * @param {string} toolType 'hammer' | 'bomb' | 'color'
     * @param {{row:number,column:number}} pos 目标位置
     */
    async useTool(toolType, pos) {
        if (!this.isPlaying()) return;
        if (!gridUtil.isValidPosition(this.grid, pos)) return;

        if (toolType === 'color') {
            // 换色：棋子变随机普通类型
            const types = config.getCommonTypes();
            const newType = types[Math.floor(Math.random() * types.length)];
            gridUtil.setPieceType(this.grid, pos, newType);
            if (this.callbacks.onColorChange) {
                await this.callbacks.onColorChange({ row: pos.row, column: pos.column, type: newType });
            }
            await this.processGrid();
            return;
        }

        // 锤子：单格；炸弹：3x3
        const targets = [];
        if (toolType === 'hammer') {
            targets.push({ row: pos.row, column: pos.column });
        } else if (toolType === 'bomb') {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const t = { row: pos.row + dr, column: pos.column + dc };
                    if (gridUtil.isValidPosition(this.grid, t)) targets.push(t);
                }
            }
        } else {
            return;
        }

        // 破坏障碍 + 置 0 + 计分（道具消除有得分反馈）
        const jellyHits = [];
        const iceHits = [];
        for (let i = 0; i < targets.length; i++) {
            const p = targets[i];
            if (this.jellyGrid[p.row][p.column] > 0) {
                this.jellyGrid[p.row][p.column] = 0;
                jellyHits.push({ row: p.row, column: p.column });
            }
            if (this.iceGrid[p.row][p.column]) {
                this.iceGrid[p.row][p.column] = 0;
                iceHits.push({ row: p.row, column: p.column });
            }
            gridUtil.setPieceType(this.grid, p, 0);
        }
        this.score += targets.length * 10 + jellyHits.length * 30 + iceHits.length * 50;

        // 消除动画（复用 onMatch 动画回调）
        if (this.callbacks.onMatch) {
            await this.callbacks.onMatch({
                removed: targets,
                combo: 1,
                score: this.score,
                jellyHits: jellyHits,
                iceHits: iceHits,
                generated: []
            });
        }

        // 整理棋盘（道具消除后即使无匹配也要下落补位）
        await this.settleBoard();

        // 检测连消
        await this.processGrid();
    }
}

module.exports = GameCore;
