/**
 * 游戏主入口：场景管理 + 主循环 + 触摸转发 + 进度存档
 * 场景：menu（主菜单）→ playing（游戏中）→ result（结算）
 */

const GameCore = require('./core/game-core');
const levelData = require('./core/level');
const BoardRenderer = require('./render/board-render');
const UI = require('./render/ui');
const AudioFX = require('./audio');
const heart = require('./core/heart');
const ad = require('./core/ad');
const coin = require('./core/coin');
const share = require('./core/share');
const config = require('./core/config');
const assets = require('./render/assets');
const cloudBattle = require('./net/cloud-battle');
const BattleUI = require('./render/battle-ui');

// 存档 key
const STORAGE_KEY = 'match3_progress_v1';

// 对战棋盘配置（8x8 无目标无限步，纯比分，靠时间结束）
const BATTLE_LEVEL = {
    id: 0, name: '对战', rows: 8, columns: 8,
    moveCount: 999,
    goals: [{ type: 'score', target: 99999999 }] // 巨大分数目标，1 分钟内不可能达成
};

class Main {
    constructor() {
        // 主屏 canvas
        this.canvas = wx.createCanvas();
        this.ctx = this.canvas.getContext('2d');
        const info = wx.getSystemInfoSync();
        this.screen = {
            width: info.windowWidth,
            height: info.windowHeight
        };
        this.canvas.width = this.screen.width;
        this.canvas.height = this.screen.height;

        // 进度存档
        this.progress = wx.getStorageSync(STORAGE_KEY) || { unlockedLevel: 1, stars: {} };

        // 音效初始化
        AudioFX.init();

        // 素材预加载（猫咪 UI）
        assets.preload();

        // 状态
        this.state = 'menu';
        this.core = null;
        this.board = null;
        this.result = null;
        this.menuButtons = null;
        this.resultButtons = null;
        this.shopButtons = null;
        this.levelSelectButtons = null;
        this.reviveUsed = 0; // 本局已复活次数

        // 双人对战状态
        this.battle = null;       // 对战数据
        this.battleCore = null;   // 对战棋盘 GameCore
        this.battleBoard = null;  // 对战棋盘渲染
        this.battleButtons = null;
        this.lastScoreSync = 0;
        this.battleSelectedTool = null; // 对战选中的道具（锤/炸弹/换色）
        this.pollTimer = null;    // 轮询定时器
        this.effectSeen = 0;      // 已处理的 effect 数量

        // 初始化云开发（云函数对战）
        cloudBattle.init();

        // 监听小游戏从后台回到前台（好友点卡片进入时拿参数）
        if (wx.onShow) {
            wx.onShow(this.handleShow.bind(this));
        }

        // 绑定触摸事件
        wx.onTouchStart(this.handleTouchStart.bind(this));
        wx.onTouchMove(this.handleTouchMove.bind(this));
        wx.onTouchEnd(this.handleTouchEnd.bind(this));

        // 被动分享（右上角菜单）：自定义分享文案
        if (wx.onShareAppMessage) {
            wx.onShareAppMessage(function () {
                return { title: share.SHARE_CONFIG.title };
            });
        }

        // 主循环
        this.lastTime = Date.now();
        this.loop();
    }

    // ===== 场景切换 =====

    /** 开始一局（消耗 1 体力） */
    startGame(levelId) {
        // 兜底：关卡不存在时回退到最后一关（防止脏存档导致无法开始）
        let level = levelData.getLevel(levelId);
        if (!level) {
            levelId = levelData.getLevelCount();
            level = levelData.getLevel(levelId);
        }
        if (!level) return;

        // 修正越界存档（如解锁到不存在的关卡）
        if (this.progress.unlockedLevel > levelData.getLevelCount()) {
            this.progress.unlockedLevel = levelData.getLevelCount();
            wx.setStorageSync(STORAGE_KEY, this.progress);
        }

        // 消耗体力（不足则不进入）
        if (!heart.consumeHeart()) return;

        this.reviveUsed = 0;

        // 先创建渲染层（动画回调需要引用它）
        this.board = new BoardRenderer(this.ctx, this.screen);

        // 再创建逻辑层，动画回调绑定到渲染层
        this.core = new GameCore(level, {
            onSwap: (from, to) => {
                AudioFX.swap();
                return this.board.animateSwap(from, to);
            },
            onInvalidSwap: (from, to) => {
                AudioFX.invalid();
                return this.board.animateInvalidSwap(from, to);
            },
            onMatch: (data) => {
                AudioFX.match(data.combo);
                return this.board.animateMatch(data);
            },
            onGravity: (data) => this.board.animateGravity(data),
            onFill: (data) => {
                AudioFX.drop();
                return this.board.animateFill(data);
            },
            onColorChange: (data) => this.board.animateColorChange(data),
            onReshuffle: () => this.board.animateReshuffle(),
            onLevelEnd: this.handleLevelEnd.bind(this)
        });

        this.board.setGame(this.core);
        this.board.setTools(coin.getItems());
        this.board.onToolUsed = (toolType) => {
            coin.useItem(toolType);
            this.board.setTools(coin.getItems());
        };
        this.state = 'playing';
    }

    backToMenu() {
        this.state = 'menu';
        this.core = null;
        this.board = null;
        this.result = null;
    }

    handleLevelEnd(result) {
        // 结算音效（胜利上行音 / 失败下行音）
        if (result.win) {
            AudioFX.win();
        } else {
            AudioFX.lose();
        }

        // 胜利：评星 + 发放金币（基础 + 步数奖励 + 星级加成）+ 解锁下一关
        let coinReward = 0;
        let star = 0;
        if (result.win) {
            star = coin.calcStars(result.movesLeft, this.core.level.moveCount);
            coinReward = coin.calcWinCoins(result.movesLeft, star);
            coin.addCoins(coinReward);

            // 存档最高星级
            if (!this.progress.stars) this.progress.stars = {};
            if ((this.progress.stars[this.core.level.id] || 0) < star) {
                this.progress.stars[this.core.level.id] = star;
                wx.setStorageSync(STORAGE_KEY, this.progress);
            }

            const next = Math.min(this.core.level.id + 1, levelData.getLevelCount());
            if (next > this.progress.unlockedLevel) {
                this.progress.unlockedLevel = next;
                wx.setStorageSync(STORAGE_KEY, this.progress);
            }
        }

        this.result = {
            win: result.win,
            score: result.score,
            levelId: this.core.level.id,
            hasNext: this.core.level.id < levelData.getLevelCount(),
            coinReward: coinReward,
            star: star,
            // 失败且本局复活次数未用满 → 可看广告复活
            canRevive: !result.win && this.reviveUsed < config.AD_CONFIG.reviveLimitPerGame
        };

        this.state = 'result';
    }

    /** 购买道具 */
    buyItem(type) {
        const def = coin.ITEM_DEFS[type];
        if (!def) return;
        if (coin.spendCoins(def.price)) {
            coin.addItem(type, 1);
            AudioFX.win();
        } else {
            AudioFX.invalid(); // 金币不足
        }
    }

    /** 看广告补体力（30 分钟冷却限频） */
    handleAddHeart() {
        if (!heart.canAdHeart()) {
            AudioFX.invalid(); // 冷却中
            return;
        }
        const self = this;
        ad.showRewarded().then(function (completed) {
            if (completed) {
                heart.markAdHeart();
                heart.addHeart(1);
                AudioFX.win();
            }
        });
    }

    /** 分享得体力（每日限次） */
    handleShare() {
        const result = share.shareAndReward();
        if (result.rewarded) {
            heart.addHeart(share.SHARE_CONFIG.heartReward);
            AudioFX.win();
        } else if (result.remaining <= 0) {
            AudioFX.invalid(); // 今日次数已用完
        }
    }

    /** 看广告复活（+步数继续玩） */
    reviveGame() {
        const self = this;
        ad.showRewarded().then(function (completed) {
            if (!completed) return;
            if (!self.core) return;
            // 复活：加步数、解除结束状态、回到游戏中
            self.core.movesLeft += config.AD_CONFIG.reviveSteps;
            self.core.ended = false;
            self.reviveUsed++;
            self.result = null;
            self.state = 'playing';
            AudioFX.win();
        });
    }

    // ===== 双人对战 =====

    /** 启动轮询（每 1 秒查询房间状态） */
    startPolling() {
        this.stopPolling();
        this.effectSeen = 0;
        const self = this;
        this.pollTimer = setInterval(function () {
            self.pollRoom();
        }, 1000);
    }

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    /** 轮询一次房间状态 */
    pollRoom() {
        if (!this.battle || !this.battle.roomId) return;
        const self = this;
        cloudBattle.call('query', { roomId: this.battle.roomId }).then(function (res) {
            if (!res.ok) return;
            self.applyPoll(res);
        }).catch(function () {});
    }

    /** 应用轮询结果 */
    applyPoll(res) {
        if (!this.battle) return;
        const b = this.battle;

        // 对手信息
        if (res.opp) {
            b.oppJoined = true;
            b.oppName = res.opp.nickname || '对手';
            b.oppReady = res.opp.ready;
            b.oppScore = res.opp.score;
        } else {
            b.oppJoined = false;
        }
        b.myReady = !!res.myReady;
        if (res.myItems) {
            b.items.freeze = res.myItems.freeze;
            b.items.disturb = res.myItems.disturb;
        }

        // 处理新效果（冰冻/干扰）
        if (res.effects && res.effects.length > this.effectSeen) {
            for (let i = this.effectSeen; i < res.effects.length; i++) {
                this.applyEffect(res.effects[i]);
            }
            this.effectSeen = res.effects.length;
        }

        // 状态切换：开局 / 结算
        if (res.status === 'playing' && this.state !== 'battle_playing') {
            this.battle.endTime = Date.now() + 60000;
            this.startBattleBoard();
            this.state = 'battle_playing';
            AudioFX.win();
        } else if (res.status === 'finished' && res.result && this.state !== 'battle_result') {
            this.applyBattleResult(res.result);
        }
    }

    /** 受击特效 */
    applyEffect(effect) {
        if (!this.battle) return;
        const now = Date.now();
        if (effect.item === 'freeze') {
            this.battle.frozenUntil = now + effect.duration;
        } else if (effect.item === 'disturb') {
            this.battle.disturbUntil = now + effect.duration;
            if (this.battleCore) this.battleCore.minMatchCount = 4;
        }
    }

    /** 结算 */
    applyBattleResult(result) {
        if (!this.battle) return;
        this.battle.result = result.result;
        this.battle.myScore = result.myScore;
        this.battle.oppScore = result.oppScore;
        const reward = result.result === 'win' ? 150 : (result.result === 'draw' ? 50 : 30);
        coin.addCoins(reward);
        this.battle.coinReward = reward;
        this.stopPolling();
        this.state = 'battle_result';
        if (result.result === 'win') AudioFX.win(); else AudioFX.lose();
    }

    /** 创建房间 + 分享邀请卡片 + 进等待页 */
    startBattle() {
        const self = this;
        this.battle = this.newBattleState(true);
        cloudBattle.call('create', { nickname: '我' }).then(function (res) {
            if (res.ok && res.roomId) {
                self.battle.roomId = res.roomId;
                self.state = 'battle_wait';
                self.shareBattleInvite(res.roomId);
                self.startPolling();
            } else {
                AudioFX.invalid();
                self.battle = null;
            }
        }).catch(function () {
            AudioFX.invalid();
            self.battle = null;
        });
    }

    /** 好友点卡片进入 → 加入房间 */
    joinBattle(roomId) {
        const self = this;
        this.battle = this.newBattleState(false);
        this.battle.roomId = roomId;
        cloudBattle.call('join', { roomId: roomId, nickname: '我' }).then(function (res) {
            if (res.ok) {
                self.state = 'battle_wait';
                self.startPolling();
            } else {
                AudioFX.invalid();
                self.battle = null;
            }
        }).catch(function () {
            AudioFX.invalid();
            self.battle = null;
        });
    }

    newBattleState(isHost) {
        return {
            roomId: null,
            myName: '我',
            oppName: '',
            myReady: false,
            oppReady: false,
            oppJoined: false,
            myScore: 0,
            oppScore: 0,
            endTime: 0,
            items: { freeze: 1, disturb: 1 },
            frozenUntil: 0,
            disturbUntil: 0,
            result: null,
            coinReward: 0,
            oppLeft: false,
            isHost: isHost,
            errorMsg: ''
        };
    }

    /** 分享邀请卡片（带 roomId） */
    shareBattleInvite(roomId) {
        if (typeof wx !== 'undefined' && wx.shareAppMessage) {
            wx.shareAppMessage({
                title: '来和我 PK 消消乐，60 秒见胜负！',
                query: 'roomId=' + roomId + '&invite=1'
            });
        }
    }

    /** 处理 onShow（好友点卡片进入时拿参数加入房间） */
    handleShow(res) {
        let query = (res && res.query) || null;
        if (!query && wx.getLaunchOptionsSync) {
            const opts = wx.getLaunchOptionsSync();
            query = opts && opts.query;
        }
        if (query && query.roomId && query.invite && this.state !== 'battle_wait' && this.state !== 'battle_playing') {
            this.joinBattle(query.roomId);
        }
    }

    /** 初始化对战棋盘（复用 GameCore + BoardRenderer，对战模式） */
    startBattleBoard() {
        this.battleBoard = new BoardRenderer(this.ctx, this.screen);
        this.battleBoard.battleMode = true;
        this.battleCore = new GameCore(BATTLE_LEVEL, {
            onSwap: (from, to) => { AudioFX.swap(); return this.battleBoard.animateSwap(from, to); },
            onInvalidSwap: (from, to) => { AudioFX.invalid(); return this.battleBoard.animateInvalidSwap(from, to); },
            onMatch: (data) => { AudioFX.match(data.combo); return this.battleBoard.animateMatch(data); },
            onGravity: (data) => this.battleBoard.animateGravity(data),
            onFill: (data) => { AudioFX.drop(); return this.battleBoard.animateFill(data); },
            onColorChange: (data) => this.battleBoard.animateColorChange(data),
            onReshuffle: () => this.battleBoard.animateReshuffle(),
            onLevelEnd: () => {}
        });
        this.battleBoard.setGame(this.battleCore);
    }

    /** 等待页：准备 */
    battleReady() {
        if (!this.battle || !this.battle.roomId) return;
        AudioFX.click();
        cloudBattle.call('ready', { roomId: this.battle.roomId });
    }

    /** 等待页：取消/退出 */
    battleCancel() {
        if (!this.battle) return;
        if (this.battle.roomId) {
            cloudBattle.call('leave', { roomId: this.battle.roomId });
        }
        this.stopPolling();
        this.battle = null;
        this.battleCore = null;
        this.battleBoard = null;
        this.state = 'menu';
    }

    /** 道具栏点击（冰冻/干扰直接释放，锤/炸弹/换色选中） */
    battleUseItem(item) {
        if (!this.battle) return;
        if (item === 'freeze' || item === 'disturb') {
            if (this.battle.items[item] <= 0) { AudioFX.invalid(); return; }
            cloudBattle.call('useItem', { roomId: this.battle.roomId, item: item });
        } else {
            // 锤/炸弹/换色：选中，等待点棋盘
            this.battleSelectedTool = this.battleSelectedTool === item ? null : item;
        }
    }

    /** 选中道具后点棋盘 */
    battleUseOwnTool(tool, pos) {
        if (!this.battleCore) return;
        const items = coin.getItems();
        if (items[tool] <= 0) { AudioFX.invalid(); return; }
        coin.useItem(tool);
        this.battleCore.useTool(tool, pos);
    }

    /** 是否被冰冻（锁定输入） */
    isFrozen() {
        return this.battle && Date.now() < this.battle.frozenUntil;
    }

    /** 更新对战帧逻辑（干扰到期、分数上报、倒计时结束） */
    updateBattle(now) {
        if (!this.battle) return;
        // 干扰到期恢复
        if (this.battle.disturbUntil && now >= this.battle.disturbUntil && this.battleCore && this.battleCore.minMatchCount !== 3) {
            this.battleCore.minMatchCount = 3;
            this.battle.disturbUntil = 0;
        }
        // 分数上报（300ms 节流）
        if (this.battleCore && now - this.lastScoreSync > 300 && this.battleCore.score !== this.battle.myScore) {
            this.battle.myScore = this.battleCore.score;
            this.lastScoreSync = now;
            cloudBattle.call('syncScore', { roomId: this.battle.roomId, score: this.battleCore.score });
        }
    }

    battleBackToMenu() {
        this.stopPolling();
        this.battle = null;
        this.battleCore = null;
        this.battleBoard = null;
        this.battleSelectedTool = null;
        this.state = 'menu';
    }

    // ===== 触摸处理 =====

    handleTouchStart(e) {
        if (!e.touches || !e.touches.length) return;
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;

        if (this.state === 'playing' && this.board) {
            this.board.onTouchStart(x, y);
        } else if (this.state === 'menu' && this.menuButtons) {
            if (UI.hitTest(x, y, this.menuButtons.battle)) {
                AudioFX.click();
                this.startBattle();
            } else if (UI.hitTest(x, y, this.menuButtons.start)) {
                // 进入关卡地图（体力不足也可先看地图）
                AudioFX.click();
                this.state = 'levelselect';
            } else if (UI.hitTest(x, y, this.menuButtons.addHeart)) {
                AudioFX.click();
                this.handleAddHeart();
            } else if (UI.hitTest(x, y, this.menuButtons.shop)) {
                AudioFX.click();
                this.state = 'shop';
            } else if (UI.hitTest(x, y, this.menuButtons.share)) {
                AudioFX.click();
                this.handleShare();
            }
        } else if (this.state === 'levelselect' && this.levelSelectButtons) {
            // 关卡节点点击
            let targetLevel = 0;
            for (let i = 1; i <= levelData.getLevelCount(); i++) {
                if (UI.hitTest(x, y, this.levelSelectButtons['level_' + i])) {
                    targetLevel = i;
                    break;
                }
            }
            if (targetLevel > 0) {
                // 未解锁的关卡不能进入
                if (targetLevel > this.progress.unlockedLevel) {
                    AudioFX.invalid();
                } else if (heart.getHeartState().count > 0) {
                    AudioFX.click();
                    this.startGame(targetLevel);
                } else {
                    AudioFX.invalid(); // 体力不足
                }
            } else if (UI.hitTest(x, y, this.levelSelectButtons.back)) {
                AudioFX.click();
                this.state = 'menu';
            }
        } else if (this.state === 'shop' && this.shopButtons) {
            if (UI.hitTest(x, y, this.shopButtons.buy_hammer)) {
                this.buyItem('hammer');
            } else if (UI.hitTest(x, y, this.shopButtons.buy_bomb)) {
                this.buyItem('bomb');
            } else if (UI.hitTest(x, y, this.shopButtons.buy_color)) {
                this.buyItem('color');
            } else if (UI.hitTest(x, y, this.shopButtons.back)) {
                AudioFX.click();
                this.state = 'menu';
            }
        } else if (this.state === 'result' && this.resultButtons) {
            if (UI.hitTest(x, y, this.resultButtons.revive)) {
                AudioFX.click();
                this.reviveGame();
            } else if (UI.hitTest(x, y, this.resultButtons.main)) {
                AudioFX.click();
                if (this.result.win && this.result.hasNext) {
                    this.startGame(this.result.levelId + 1);
                } else {
                    this.startGame(this.result.levelId);
                }
            } else if (UI.hitTest(x, y, this.resultButtons.menu)) {
                AudioFX.click();
                this.backToMenu();
            }
        } else if (this.state === 'battle_wait' && this.battleButtons) {
            if (BattleUI.hitTest(x, y, this.battleButtons.ready)) {
                this.battleReady();
            } else if (BattleUI.hitTest(x, y, this.battleButtons.cancel)) {
                this.battleCancel();
            }
        } else if (this.state === 'battle_playing' && this.battleBoard) {
            // 冰冻中不能操作
            if (this.isFrozen()) return;
            // 道具栏点击
            if (this.battleButtons) {
                const itemKeys = ['hammer', 'bomb', 'color', 'freeze', 'disturb'];
                for (let i = 0; i < itemKeys.length; i++) {
                    const k = itemKeys[i];
                    if (BattleUI.hitTest(x, y, this.battleButtons[k])) {
                        this.battleUseItem(k);
                        return;
                    }
                }
            }
            // 选中道具后点棋盘
            if (this.battleSelectedTool) {
                const grid = this.battleBoard.pointToGrid(x, y);
                if (grid) {
                    this.battleUseOwnTool(this.battleSelectedTool, grid);
                    this.battleSelectedTool = null;
                }
                return;
            }
            // 正常交换
            this.battleBoard.onTouchStart(x, y);
        } else if (this.state === 'battle_result' && this.battleButtons) {
            if (BattleUI.hitTest(x, y, this.battleButtons.again)) {
                // 再来一局：返回菜单（简化，需重新建房）
                AudioFX.click();
                this.battleBackToMenu();
            } else if (BattleUI.hitTest(x, y, this.battleButtons.menu)) {
                AudioFX.click();
                this.battleBackToMenu();
            }
        }
    }

    handleTouchMove(e) {
        if (!e.touches || !e.touches.length) return;
        if (this.state === 'playing' && this.board) {
            this.board.onTouchMove(e.touches[0].clientX, e.touches[0].clientY);
        } else if (this.state === 'battle_playing' && this.battleBoard && !this.isFrozen()) {
            this.battleBoard.onTouchMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }

    handleTouchEnd() {
        if (this.state === 'playing' && this.board) {
            this.board.onTouchEnd();
        } else if (this.state === 'battle_playing' && this.battleBoard) {
            this.battleBoard.onTouchEnd();
        }
    }

    // ===== 主循环 =====

    loop() {
        const now = Date.now();
        const dt = now - this.lastTime;
        this.lastTime = now;

        this.update(dt);
        this.render();

        requestAnimationFrame(this.loop.bind(this));
    }

    update(dt) {
        // 动画插值更新（仅游戏中）
        if (this.state === 'playing' && this.board) {
            this.board.update(dt);
        } else if (this.state === 'battle_playing' && this.battleBoard) {
            this.battleBoard.update(dt);
            this.updateBattle(Date.now());
        }
    }

    render() {
        if (this.state === 'menu') {
            const heartState = heart.getHeartState();
            // 已解锁关数封顶显示（防止脏存档显示超范围关卡）
            const unlocked = Math.min(this.progress.unlockedLevel, levelData.getLevelCount());
            this.menuButtons = UI.drawMenu(this.ctx, this.screen, unlocked, {
                count: heartState.count,
                timeLeftText: heart.formatTimeLeft(),
                canPlay: heartState.count > 0
            }, share.getRemaining());
        } else if (this.state === 'playing' && this.board) {
            this.board.draw();
        } else if (this.state === 'result') {
            this.resultButtons = UI.drawResult(this.ctx, this.screen, this.result);
        } else if (this.state === 'shop') {
            this.shopButtons = UI.drawShop(this.ctx, this.screen, coin.getCoins(), coin.getItems());
        } else if (this.state === 'levelselect') {
            this.levelSelectButtons = UI.drawLevelSelect(
                this.ctx, this.screen,
                Math.min(this.progress.unlockedLevel, levelData.getLevelCount()),
                coin.getCoins(),
                levelData.getLevelCount(),
                this.progress.stars || {}
            );
        } else if (this.state === 'battle_wait' && this.battle) {
            this.battleButtons = BattleUI.drawWait(this.ctx, this.screen, {
                roomId: this.battle.roomId || '...',
                myName: this.battle.myName,
                myReady: this.battle.myReady,
                oppName: this.battle.oppName,
                oppReady: this.battle.oppReady,
                oppJoined: this.battle.oppJoined,
                isHost: this.battle.isHost
            });
        } else if (this.state === 'battle_playing' && this.battleBoard && this.battle) {
            this.battleBoard.draw();
            const timeLeft = Math.max(0, Math.ceil((this.battle.endTime - Date.now()) / 1000));
            BattleUI.drawTop(this.ctx, this.screen, {
                timeLeft: timeLeft,
                myScore: this.battle.myScore,
                oppScore: this.battle.oppScore
            });
            const items = coin.getItems();
            this.battleButtons = BattleUI.drawItems(this.ctx, this.screen, {
                hammer: items.hammer,
                bomb: items.bomb,
                color: items.color,
                freeze: this.battle.items.freeze,
                disturb: this.battle.items.disturb
            });
            BattleUI.drawEffects(this.ctx, this.screen, {
                frozen: this.isFrozen(),
                disturb: this.battle.disturbUntil > Date.now()
            });
        } else if (this.state === 'battle_result' && this.battle) {
            this.battleButtons = BattleUI.drawResult(this.ctx, this.screen, {
                result: this.battle.result,
                myScore: this.battle.myScore,
                oppScore: this.battle.oppScore,
                coinReward: this.battle.coinReward
            });
        }
    }
}

module.exports = Main;
