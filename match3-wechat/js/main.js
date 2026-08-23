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
const config = require('./core/config');
const runtime = require('./core/runtime');
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

const BATTLE_DURATION_MS = 60000;
const BATTLE_WARNING_MS = 30000;
const BATTLE_WARNING_DISPLAY_MS = 1400;
const COUNTDOWN_START_DISPLAY_MS = 650;
const BATTLE_INVITE_EXPIRED_MESSAGE = '邀请已失效或对局已结束，请让好友重新发起邀请';
const BATTLE_JOIN_NETWORK_MESSAGE = '暂时无法加入对局，请检查网络后重试';

class Main {
    constructor() {
        runtime.init('menu');

        // 主屏 canvas
        this.canvas = wx.createCanvas();
        this.ctx = this.canvas.getContext('2d');
        const info = typeof wx.getSystemInfoSync === 'function' ? (wx.getSystemInfoSync() || {}) : {};
        const width = Number(info.windowWidth) || this.canvas.width || 375;
        const height = Number(info.windowHeight) || this.canvas.height || 667;
        const safeArea = info.safeArea || {};
        const safeBottomEdge = Number(safeArea.bottom);
        const safeRightEdge = Number(safeArea.right);
        const deviceText = [info.platform, info.system, info.AppPlatform, info.osName, info.brand, info.model]
            .map(function (value) { return String(value || ''); })
            .join(' ')
            .toLowerCase();
        const isHarmony = /harmony|hongmeng|鸿蒙|ohos/.test(deviceText);
        const nativeDpr = Number(info.pixelRatio) || 1;
        const dpr = Math.min(isHarmony ? 1.25 : 2, Math.max(1, nativeDpr));
        this.screen = {
            width: width,
            height: height,
            safeTop: Math.max(0, Number(safeArea.top) || 0),
            safeBottom: safeBottomEdge > 0 ? Math.max(0, height - safeBottomEdge) : 0,
            safeLeft: Math.max(0, Number(safeArea.left) || 0),
            safeRight: safeRightEdge > 0 ? Math.max(0, width - safeRightEdge) : 0,
            dpr: dpr,
            isHarmony: isHarmony,
            reduceEffects: isHarmony
        };
        this.canvas.width = Math.round(this.screen.width * dpr);
        this.canvas.height = Math.round(this.screen.height * dpr);
        if (this.ctx && typeof this.ctx.setTransform === 'function') {
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        } else if (this.ctx && typeof this.ctx.scale === 'function') {
            this.ctx.scale(dpr, dpr);
        }

        // 进度存档
        this.progress = wx.getStorageSync(STORAGE_KEY) || { unlockedLevel: 1, stars: {} };

        // 音效初始化
        AudioFX.init();

        // 素材预加载（猫咪 UI）
        assets.preload();

        // 状态
        this.state = 'menu';
        this.audioScene = null;
        this.runtimeState = null;
        this.core = null;
        this.board = null;
        this.result = null;
        this.menuButtons = null;
        this.resultButtons = null;
        this.shopButtons = null;
        this.levelSelectButtons = null;
        this.settingsButtons = null;
        this.resultLeaving = false;

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
                return { title: '快来和我一起玩' + config.GAME_CONFIG.title + '！' };
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

        this.resultLeaving = false;

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
            // 只要激励视频可用，失败后可重复观看广告复活
            canRevive: !result.win && ad.isRewardedAvailable()
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
        ad.showRewarded('heart_refill').then(function (completed) {
            if (completed) {
                heart.markAdHeart();
                heart.addHeart(1);
                ad.markRewardGranted('heart_refill');
                AudioFX.win();
            }
        });
    }

    /** 看广告复活（+步数继续玩） */
    reviveGame() {
        const self = this;
        ad.showRewarded('revive').then(function (completed) {
            if (!completed) return;
            if (!self.core) return;
            // 复活：加步数、解除结束状态、回到游戏中
            self.core.movesLeft += config.AD_CONFIG.reviveSteps;
            self.core.ended = false;
            ad.markRewardGranted('revive');
            self.result = null;
            self.state = 'playing';
            AudioFX.win();
        });
    }

    /** 最终离开单人结算：计入插屏节奏，广告关闭/失败后继续原导航。 */
    leaveSoloResult(action) {
        if (this.resultLeaving) return;
        this.resultLeaving = true;
        const self = this;
        function finish() {
            self.resultLeaving = false;
            action();
        }
        ad.onSoloResultExit().then(finish).catch(finish);
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
            if (!res.ok) {
                if (res.err === '邀请已失效' || res.err === '房间不存在') {
                    self.stopPolling();
                    self.battle = null;
                    self.battleCore = null;
                    self.battleBoard = null;
                    self.state = 'menu';
                    self.showBattleNotice(BATTLE_INVITE_EXPIRED_MESSAGE);
                }
                return;
            }
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
            this.battle.startTime = Number(res.startTime) || Date.now();
            this.battle.endTime = this.battle.startTime + BATTLE_DURATION_MS;
            this.battle.countdownStarted = false;
            this.battle.countdownStartUntil = 0;
            this.battle.warningShown = false;
            this.battle.warningUntil = 0;
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
    showBattleNotice(message) {
        if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
            wx.showToast({ title: message, icon: 'none', duration: 2200 });
        }
    }

    startBattle() {
        const self = this;
        this.battle = this.newBattleState(true);
        cloudBattle.call('create', { nickname: '房主猫' }).then(function (res) {
            if (res.ok && res.roomId) {
                self.battle.roomId = res.roomId;
                self.state = 'battle_wait';
                self.shareBattleInvite(res.roomId);
                self.startPolling();
            } else {
                AudioFX.invalid();
                self.battle = null;
                self.showBattleNotice('暂时无法创建对局，请稍后重试');
            }
        }).catch(function () {
            AudioFX.invalid();
            self.battle = null;
            self.showBattleNotice('暂时无法创建对局，请稍后重试');
        });
    }

    /** 好友点卡片进入 → 加入房间 */
    joinBattle(roomId) {
        if (!cloudBattle.isValidRoomId(roomId)) {
            AudioFX.invalid();
            this.showBattleNotice(BATTLE_INVITE_EXPIRED_MESSAGE);
            return;
        }
        const self = this;
        this.battle = this.newBattleState(false);
        this.battle.roomId = roomId;
        cloudBattle.call('join', { roomId: roomId, nickname: '挑战猫' }).then(function (res) {
            if (res.ok) {
                self.state = 'battle_wait';
                self.startPolling();
            } else {
                AudioFX.invalid();
                self.battle = null;
                self.showBattleNotice(BATTLE_INVITE_EXPIRED_MESSAGE);
            }
        }).catch(function () {
            AudioFX.invalid();
            self.battle = null;
            self.showBattleNotice(BATTLE_JOIN_NETWORK_MESSAGE);
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
            startTime: 0,
            endTime: 0,
            countdownStarted: false,
            countdownStartUntil: 0,
            warningShown: false,
            warningUntil: 0,
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
                title: '来和我 PK ' + config.GAME_CONFIG.title + '，60 秒见胜负！',
                query: 'roomId=' + roomId + '&invite=1'
            });
        }
    }

    /** 处理 onShow（好友点卡片进入时拿参数加入房间） */
    handleShow(res) {
        let query = res && typeof res === 'object' ? res.query : null;
        if (!query && wx.getLaunchOptionsSync) {
            try {
                const opts = wx.getLaunchOptionsSync();
                query = opts && opts.query;
            } catch (e) {
                query = null;
            }
        }
        if (!query || typeof query !== 'object' || query.invite !== '1' ||
            this.state === 'battle_wait' || this.state === 'battle_playing') return;
        if (!cloudBattle.isValidRoomId(query.roomId)) {
            this.showBattleNotice(BATTLE_INVITE_EXPIRED_MESSAGE);
            return;
        }
        this.joinBattle(query.roomId);
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
        if (this.battle.disturbUntil > Date.now()) {
            this.battleCore.minMatchCount = 4;
        }
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
        if (this.battle.startTime && now < this.battle.startTime) return;
        if (this.battle.startTime && !this.battle.countdownStarted) {
            this.battle.countdownStarted = true;
            this.battle.countdownStartUntil = now + COUNTDOWN_START_DISPLAY_MS;
        }
        if (this.battle.endTime && !this.battle.warningShown && now >= this.battle.endTime - BATTLE_WARNING_MS) {
            this.battle.warningShown = true;
            this.battle.warningUntil = now + BATTLE_WARNING_DISPLAY_MS;
        }
        // 干扰到期恢复
        if (this.battle.disturbUntil && now >= this.battle.disturbUntil && this.battleCore && this.battleCore.minMatchCount !== 3) {
            this.battleCore.minMatchCount = 3;
            this.battle.disturbUntil = 0;
        }
        // 分数上报（800ms 节流，兼顾观感与云函数调用成本）
        if (this.battleCore && now - this.lastScoreSync > 800 && this.battleCore.score !== this.battle.myScore) {
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
        AudioFX.unlock();
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
            } else if (UI.hitTest(x, y, this.menuButtons.settings)) {
                AudioFX.click();
                this.state = 'settings';
            }
        } else if (this.state === 'settings' && this.settingsButtons) {
            if (UI.hitTest(x, y, this.settingsButtons.music)) {
                const next = !AudioFX.isMusicEnabled();
                AudioFX.setMusicEnabled(next);
                if (AudioFX.isSfxEnabled()) AudioFX.click();
            } else if (UI.hitTest(x, y, this.settingsButtons.sfx)) {
                const next = !AudioFX.isSfxEnabled();
                AudioFX.setSfxEnabled(next);
                if (next) AudioFX.click();
            } else if (UI.hitTest(x, y, this.settingsButtons.privacy)) {
                AudioFX.click();
                runtime.openPrivacyContract();
            } else if (UI.hitTest(x, y, this.settingsButtons.back)) {
                AudioFX.click();
                this.state = 'menu';
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
                if (heart.getHeartState().count <= 0) {
                    AudioFX.invalid();
                    return;
                }
                AudioFX.click();
                const result = this.result;
                this.leaveSoloResult(() => {
                    if (result.win && result.hasNext) {
                        this.startGame(result.levelId + 1);
                    } else {
                        this.startGame(result.levelId);
                    }
                });
            } else if (UI.hitTest(x, y, this.resultButtons.menu)) {
                AudioFX.click();
                this.leaveSoloResult(this.backToMenu.bind(this));
            }
        } else if (this.state === 'battle_wait' && this.battleButtons) {
            if (BattleUI.hitTest(x, y, this.battleButtons.ready)) {
                this.battleReady();
            } else if (BattleUI.hitTest(x, y, this.battleButtons.cancel)) {
                this.battleCancel();
            }
        } else if (this.state === 'battle_playing' && this.battleBoard) {
            if (this.battle && this.battle.startTime && Date.now() < this.battle.startTime) return;
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
        if (this.runtimeState !== this.state) {
            this.runtimeState = this.state;
            runtime.maybePromptUpdate(this.state);
        }

        // 动画插值更新（仅游戏中）
        if (this.state === 'playing' && this.board) {
            this.board.update(dt);
        } else if (this.state === 'battle_playing' && this.battleBoard) {
            this.battleBoard.update(dt);
            this.updateBattle(Date.now());
        }
    }

    render() {
        const audioScene = this.state.indexOf('battle_') === 0 ? 'battle' : 'calm';
        if (audioScene !== this.audioScene) {
            this.audioScene = audioScene;
            AudioFX.setScene(audioScene);
        }
        if (this.state === 'menu') {
            const heartState = heart.getHeartState();
            // 已解锁关数封顶显示（防止脏存档显示超范围关卡）
            const unlocked = Math.min(this.progress.unlockedLevel, levelData.getLevelCount());
            this.menuButtons = UI.drawMenu(this.ctx, this.screen, unlocked, {
                count: heartState.count,
                timeLeftText: heart.formatTimeLeft(),
                canPlay: heartState.count > 0,
                canAd: ad.isRewardedAvailable() && heart.canAdHeart()
            }, { coins: coin.getCoins() });
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
        } else if (this.state === 'settings') {
            this.settingsButtons = UI.drawSettings(this.ctx, this.screen, {
                musicEnabled: AudioFX.isMusicEnabled(),
                sfxEnabled: AudioFX.isSfxEnabled()
            });
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
            const now = Date.now();
            this.battleBoard.draw();
            const timeLeft = Math.max(0, Math.ceil((this.battle.endTime - now) / 1000));
            BattleUI.drawTop(this.ctx, this.screen, {
                timeLeft: timeLeft,
                myScore: this.battle.myScore,
                oppScore: this.battle.oppScore,
                urgent: timeLeft <= 10
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
                disturb: this.battle.disturbUntil > now,
                boardY: this.battleBoard.boardY,
                boardH: this.battleBoard.boardH
            });
            if (this.battle.warningUntil > now) {
                BattleUI.drawWarning(this.ctx, this.screen);
            }
            if (this.battle.startTime && now < this.battle.startTime) {
                BattleUI.drawCountdown(this.ctx, this.screen, {
                    seconds: Math.max(1, Math.ceil((this.battle.startTime - now) / 1000))
                });
            } else if (this.battle.countdownStartUntil > now) {
                BattleUI.drawCountdown(this.ctx, this.screen, { label: '开始' });
            }
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
