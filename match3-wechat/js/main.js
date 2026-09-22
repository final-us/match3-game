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
const analytics = require('./core/analytics');
const onboarding = require('./core/onboarding');
const strategyFeedback = require('./core/strategy-feedback');
const assets = require('./render/assets');
const cloudBattle = require('./net/cloud-battle');
const BattleUI = require('./render/battle-ui');
const OnboardingUI = require('./render/onboarding');
const userProfile = require('./platform/user-profile');
const dailyEngine = require('./core/daily-challenge');
const dailyProgress = require('./core/daily-progress');
const DailyUI = require('./render/daily-ui');

// 存档 key
const STORAGE_KEY = 'match3_progress_infinite_v1';
const LEGACY_PROGRESS_KEYS = ['match3_progress_v1', 'match3_progress_v2'];

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
const BATTLE_CREATE_RATE_LIMIT_MESSAGE = '创建太频繁，请稍后再试';
const SOLO_REVIVE_TIME_MS = 30000;
const BATTLE_ITEM_ALLOWLIST = ['freeze', 'disturb'];
const BATTLE_ITEM_BUDGET = 3;
const BATTLE_WAIT_REQUEST = { timeoutMs: 8000 };
const DAILY_REQUEST = { timeoutMs: 12000 };

function soloAssistanceFor(failureCount) {
    if (failureCount >= 4) return { moves: 5, timeMs: 35000, text: '+5步 · +35秒' };
    if (failureCount >= 2) return { moves: 3, timeMs: 20000, text: '+3步 · +20秒' };
    return null;
}

function durationBucket(durationMs) {
    const value = Number(durationMs);
    if (!Number.isFinite(value) || value < 30000) return 'lt_30s';
    if (value < 60000) return 'from_30_to_59s';
    if (value < 120000) return 'from_60_to_119s';
    return 'gte_120s';
}

function battleErrorReason(error, category) {
    const text = error && typeof error.err === 'string' ? error.err : '';
    if (category === 'create' && text === BATTLE_CREATE_RATE_LIMIT_MESSAGE) return 'rate_limited';
    if (text === '邀请已失效' || text === '房间不存在') return 'expired';
    if (text === '房间已满' || text === '对局已开始') return 'unavailable';
    return 'network';
}

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
        let menuButton = {};
        if (typeof wx.getMenuButtonBoundingClientRect === 'function') {
            try { menuButton = wx.getMenuButtonBoundingClientRect() || {}; } catch (e) { menuButton = {}; }
        }
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
            contentTop: Math.max(0, Number(safeArea.top) || 0, (Number(menuButton.bottom) || 0) + 4),
            contentRight: Math.max(0, Math.min(width, Number(menuButton.left) || width) - 4),
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

        // 上线前切换为无限关卡：只废弃旧单人进度，金币、体力和道具使用各自存储，不受影响。
        if (typeof wx.removeStorageSync === 'function') {
            for (let i = 0; i < LEGACY_PROGRESS_KEYS.length; i++) {
                try { wx.removeStorageSync(LEGACY_PROGRESS_KEYS[i]); } catch (e) {}
            }
        }
        const savedProgress = wx.getStorageSync(STORAGE_KEY);
        this.progress = savedProgress && typeof savedProgress === 'object' ? savedProgress : {
            unlockedLevel: 1,
            stars: {}
        };
        const unlockedLevel = Number(this.progress.unlockedLevel);
        this.progress.unlockedLevel = Number.isFinite(unlockedLevel) && unlockedLevel > 0
            ? Math.floor(unlockedLevel)
            : 1;
        if (!this.progress.stars || typeof this.progress.stars !== 'object') this.progress.stars = {};
        if (!this.progress.failures || typeof this.progress.failures !== 'object') this.progress.failures = {};

        // 音效初始化
        AudioFX.init();

        // 素材预加载（猫咪 UI）
        assets.preload();
        userProfile.init();

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
        this.shopRewardPending = false;
        this.staminaDialog = false;
        this.staminaDialogButtons = null;
        this.heartAdPending = false;
        this.levelSelectButtons = null;
        this.levelMapOffset = 0;
        this.levelMapTouch = null;
        this.levelMapDragged = false;
        this.settingsButtons = null;
        this.privacyButtons = null;
        this.privacyOffset = 0;
        this.privacyTouch = null;
        this.privacyRequest = null;
        this.resultLeaving = false;
        this.soloFailureRecorded = false;
        this.soloCompletionTracked = false;
        this.soloReviveCount = 0;
        this.soloRunStartedAt = 0;
        this.guide = null;
        this.guideButtons = null;
        this.guideQueue = [];

        // 双人对战状态
        this.battle = null;       // 对战数据
        this.battleCore = null;   // 对战棋盘 GameCore
        this.battleBoard = null;  // 对战棋盘渲染
        this.battleButtons = null;
        this.lastScoreSync = 0;
        this.pollTimer = null;    // 轮询定时器
        this.effectSeen = 0;      // 已处理的 effect 数量
        this.castSeen = 0;        // 已处理的己方施法反馈数量
        this.battleCreating = false;

        // 初始化云开发（云函数对战）
        cloudBattle.init();

        // 监听小游戏从后台回到前台（好友点卡片进入时拿参数）
        if (wx.onShow) {
            wx.onShow(this.handleShow.bind(this));
        }
        if (wx.onHide) {
            wx.onHide(this.handleHide.bind(this));
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
        // 注册分享文案不会启用菜单，需要显式打开“发送给朋友”。
        if (typeof wx.showShareMenu === 'function') {
            wx.showShareMenu({ menus: ['shareAppMessage'] });
        }

        // 主循环
        this.lastTime = Date.now();
        this.loop();
    }

    // ===== 场景切换 =====

    showGuide(key) {
        if (this.guide) {
            if (this.guide.key === key) return false;
            if (onboarding.shouldShow(key) && this.guideQueue.indexOf(key) < 0) this.guideQueue.push(key);
            return false;
        }
        if (!onboarding.shouldShow(key)) return false;
        this.guide = { key: key };
        this.guideButtons = null;
        if (this.state === 'playing' && this.core) this.core.pauseTimer();
        return true;
    }

    dismissGuide() {
        if (this.guide) onboarding.markSeen(this.guide.key);
        this.guide = null;
        this.guideButtons = null;
        if (this.guideQueue.length) {
            this.showGuide(this.guideQueue.shift());
        } else if (this.state === 'playing' && this.core) {
            this.core.resumeTimer();
        }
    }

    handleGuideTouch(x, y) {
        if (!this.guide) return false;
        const buttons = this.guideButtons;
        if (buttons && (OnboardingUI.hitTest(x, y, buttons.skip) ||
            OnboardingUI.hitTest(x, y, buttons.confirm))) {
            this.dismissGuide();
        }
        return true;
    }

    guideContext() {
        if (!this.guide || !this.core || !this.board || this.state !== 'playing') return null;
        const key = this.guide.key;
        const cells = key === onboarding.GUIDE_KEYS.COLLECT ? strategyFeedback.collectCells(this.core) :
            (key === onboarding.GUIDE_KEYS.SPECIAL_COMBO ? strategyFeedback.specialPair(this.core) : []);
        return {
            spots: cells.map((cell) => {
                const center = this.board.pieceCenter(cell.row, cell.column);
                return { x: center.x, y: center.y, size: this.board.tileSize };
            }),
            goal: strategyFeedback.collectGoal(this.core.level)
        };
    }

    /** 开始一局（预扣1点，通关返还；失败/退出不返还） */
    startGame(levelId) {
        const level = levelData.getLevel(levelId);
        if (!level) return;

        // 消耗体力（不足则不进入）
        if (!heart.consumeHeart(true)) {
            this.showStaminaDialog();
            return;
        }

        if (strategyFeedback.syncContentRevision(this.progress, level)) {
            wx.setStorageSync(STORAGE_KEY, this.progress);
        }
        this.guide = null;
        this.guideQueue = [];

        this.resultLeaving = false;
        this.soloFailureRecorded = false;
        this.soloCompletionTracked = false;
        this.soloReviveCount = 0;
        this.soloPendingResult = null;
        this.soloRunStartedAt = Date.now();
        analytics.track('solo_start', { level: level.id });

        // 先创建渲染层（动画回调需要引用它）
        this.board = new BoardRenderer(this.ctx, this.screen);

        // 再创建逻辑层，动画回调绑定到渲染层
        this.core = new GameCore(level, {
            onSwap: (from, to) => this.board.animateSwap(from, to),
            onInvalidSwap: (from, to) => {
                AudioFX.invalid();
                return this.board.animateInvalidSwap(from, to);
            },
            onMatch: (data) => {
                AudioFX.match(data);
                if (data && data.generated && data.generated.length) this.showGuide(onboarding.GUIDE_KEYS.SPECIAL);
                return this.board.animateMatch(data);
            },
            onGravity: (data) => this.board.animateGravity(data),
            onFill: (data) => this.board.animateFill(data),
            onColorChange: (data) => this.board.animateColorChange(data),
            onReshuffle: () => this.board.animateReshuffle(),
            onLevelEnd: this.handleLevelEnd.bind(this)
        });

        const failureCount = Number(this.progress.failures[level.id]) || 0;
        const assistance = soloAssistanceFor(failureCount);
        if (assistance) {
            this.core.applyAssistance(assistance.moves, assistance.timeMs);
            if (wx.showToast) {
                wx.showToast({
                    title: this.core.timeLimitMs > 0 ? '连败助力已生效：' + assistance.text : '连败助力已生效：+' + assistance.moves + '步',
                    icon: 'none',
                    duration: 1800
                });
            }
        }

        this.board.setGame(this.core);
        const items = coin.getItems();
        this.board.setTools(items);
        this.board.onToolUsed = (toolType) => {
            coin.useItem(toolType);
            this.board.setTools(coin.getItems());
            AudioFX.tool(toolType);
        };
        this.state = 'playing';
        this.showGuide(onboarding.GUIDE_KEYS.SOLO);
        if (strategyFeedback.collectGoal(level)) this.showGuide(onboarding.GUIDE_KEYS.COLLECT);
        if (Object.keys(level.underlays || {}).length || Object.keys(level.obstacles || {}).length) {
            this.showGuide(onboarding.GUIDE_KEYS.OBSTACLE);
        }
        if (items.hammer > 0 || items.bomb > 0 || items.color > 0) {
            this.showGuide(onboarding.GUIDE_KEYS.SOLO_ITEM);
        }
    }

    backToMenu() {
        this.guide = null;
        this.guideQueue = [];
        this.state = 'menu';
        this.core = null;
        this.board = null;
        this.result = null;
    }

    handleLevelEnd(result) {
        if (this.soloCompletionTracked) return;
        // 旧存档的已解锁前置关和有星关都视为已通关，内容升级不重发金币。
        const firstClear = result.win && !(this.progress.stars && this.progress.stars[this.core.level.id] > 0) &&
            this.core.level.id >= this.progress.unlockedLevel;
        let firstReward = 0;
        if (result.win) {
            try {
                heart.refundConsumedHeart();
                if (firstClear) {
                    const amount = coin.calcWinCoins(result.movesLeft, coin.calcStars(result.movesLeft, this.core.level.moveCount));
                    const credit = coin.creditOnce('solo:first:' + this.core.level.id, amount);
                    if (!credit.ok) throw new Error('solo_reward_storage');
                    firstReward = credit.credited ? amount : 0;
                }
            } catch (e) {
                this.soloPendingResult = result;
                this.result = { win: true, score: result.score, coinReward: 0, star: 0, rewardPending: true };
                this.state = 'result'; this.guide = null; this.guideQueue = [];
                return;
            }
        }
        try {
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
            coinReward = firstReward;

            // 存档最高星级
            if (!this.progress.stars) this.progress.stars = {};
            if ((this.progress.stars[this.core.level.id] || 0) < star) {
                this.progress.stars[this.core.level.id] = star;
                wx.setStorageSync(STORAGE_KEY, this.progress);
            }

            const next = this.core.level.id + 1;
            if (next > this.progress.unlockedLevel) {
                this.progress.unlockedLevel = next;
                wx.setStorageSync(STORAGE_KEY, this.progress);
            }
        }

        const levelId = this.core.level.id;
        if (!this.progress.failures || typeof this.progress.failures !== 'object') {
            this.progress.failures = {};
        }
        if (result.win) {
            this.progress.failures[levelId] = 0;
        } else if (!this.soloFailureRecorded) {
            this.progress.failures[levelId] = (Number(this.progress.failures[levelId]) || 0) + 1;
            this.soloFailureRecorded = true;
        }
        wx.setStorageSync(STORAGE_KEY, this.progress);

        this.result = {
            win: result.win,
            score: result.score,
            reason: result.reason || (result.win ? 'goal' : 'moves'),
            timeLeftMs: result.timeLeftMs,
            timed: this.core.timeLimitMs > 0,
            levelId: this.core.level.id,
            hasNext: true,
            coinReward: coinReward,
            star: star,
            maxCascade: this.core.maxCascade || 0,
            specialComboCount: this.core.specialComboCount || 0,
            // 只要激励视频可用，失败后可重复观看广告复活
            canRevive: !result.win && ad.isRewardedAvailable()
        };

        analytics.track('solo_complete', {
            level: levelId,
            result: result.win ? 'win' : 'lose',
            reason: this.result.reason,
            stars: star,
            durationBucket: durationBucket(Date.now() - this.soloRunStartedAt),
            reviveCount: this.soloReviveCount
        });

            this.soloPendingResult = null;
            this.soloCompletionTracked = true;
            this.state = 'result';
            this.guide = null;
            this.guideQueue = [];
        } catch (e) {
            // Progress writes are part of settlement. Keep the result retryable if
            // storage fails after the wallet/heart receipt has already committed.
            this.soloCompletionTracked = false;
            this.soloPendingResult = result;
            this.result = { win: !!result.win, score: result.score, coinReward: 0, star: 0, rewardPending: true };
            this.state = 'result';
            this.guide = null;
            this.guideQueue = [];
        }
    }

    /** 购买道具 */
    buyItem(type) {
        const def = coin.ITEM_DEFS[type];
        if (!def) return;
        if (coin.spendCoins(def.price)) {
            coin.addItem(type, 1);
            AudioFX.reward();
        } else {
            AudioFX.invalid(); // 金币不足
        }
    }

    showStaminaDialog() {
        this.staminaDialog = true;
        this.staminaDialogButtons = null;
    }

    closeStaminaDialog() {
        this.staminaDialog = false;
        this.staminaDialogButtons = null;
    }

    buyHeart() {
        const state = heart.getHeartState();
        if (state.count >= heart.HEART_CONFIG.maxHeart || !coin.spendCoins(coin.STAMINA_PRICE)) {
            AudioFX.invalid();
            return;
        }
        heart.addHeart(1);
        AudioFX.reward();
        this.closeStaminaDialog();
    }

    /** 商店真实激励视频领取：禁止 debug mock，三种道具共享本地自然日上限。 */
    claimShopAdItem(type) {
        if (this.shopRewardPending || !coin.ITEM_DEFS[type]) return;
        if (!ad.isRealRewardedAvailable()) {
            analytics.track('shop_ad_reward_failure', { category: type, reason: 'unavailable' });
            AudioFX.invalid();
            return;
        }
        const state = coin.getRewardedItemState();
        if (state.remaining <= 0) {
            analytics.track('shop_ad_reward_limit', { category: type, count: state.count });
            AudioFX.invalid();
            return;
        }
        this.shopRewardPending = true;
        const self = this;
        ad.showRewarded('shop_item', { allowMock: false }).then(function (completed) {
            if (!completed) {
                analytics.track('shop_ad_reward_failure', { category: type, reason: 'not_completed' });
                AudioFX.invalid();
                self.shopRewardPending = false;
                return;
            }
            const claimed = coin.claimRewardedItem(type);
            if (!claimed.ok) {
                analytics.track(claimed.reason === 'limit' ? 'shop_ad_reward_limit' : 'shop_ad_reward_failure', {
                    category: type,
                    reason: claimed.reason,
                    count: claimed.state ? claimed.state.count : state.count
                });
                AudioFX.invalid();
                self.shopRewardPending = false;
                return;
            }
            ad.markRewardGranted('shop_item');
            analytics.track('shop_ad_reward_success', {
                category: type,
                count: claimed.state.count
            });
            AudioFX.reward();
            self.shopRewardPending = false;
        }).catch(function () {
            analytics.track('shop_ad_reward_failure', { category: type, reason: 'runtime_error' });
            AudioFX.invalid();
            self.shopRewardPending = false;
        });
    }

    /** 看广告补体力（无冷却、无次数上限） */
    handleAddHeart(source) {
        if (this.heartAdPending) return Promise.resolve(false);
        if (heart.getHeartState().count >= heart.HEART_CONFIG.maxHeart) {
            AudioFX.invalid();
            return Promise.resolve(false);
        }
        this.heartAdPending = true;
        const self = this;
        return ad.showRewarded('heart_refill').then(function (completed) {
            if (completed) {
                heart.addHeart(1);
                ad.markRewardGranted('heart_refill');
                AudioFX.reward();
                if (source === 'dialog') self.closeStaminaDialog();
            }
            self.heartAdPending = false;
        }).catch(function () {
            self.heartAdPending = false;
        });
    }

    handleStaminaDialogTouch(x, y) {
        if (!this.staminaDialog) return false;
        const buttons = this.staminaDialogButtons;
        if (!buttons) return true;
        if (UI.hitTest(x, y, buttons.buy)) this.buyHeart();
        else if (buttons.ad && UI.hitTest(x, y, buttons.ad)) this.handleAddHeart('dialog');
        else if (UI.hitTest(x, y, buttons.close)) {
            AudioFX.click();
            this.closeStaminaDialog();
        }
        return true;
    }

    /** 看广告复活（+步数继续玩） */
    reviveGame() {
        const self = this;
        ad.showRewarded('revive').then(function (completed) {
            if (!completed) return;
            if (!self.core) return;
            // 复活：加步数、恢复时间、解除结束状态、回到游戏中
            if (!self.core.revive(config.AD_CONFIG.reviveSteps, SOLO_REVIVE_TIME_MS)) return;
            ad.markRewardGranted('revive');
            self.soloReviveCount++;
            self.soloCompletionTracked = false;
            self.result = null;
            self.state = 'playing';
            AudioFX.reward();
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

    // ===== 每日挑战：详情样板与真实固定棋盘 =====
    openDaily() {
        this.state = 'daily_detail';
        this.dailyButtons = null;
        if (!this.daily || !this.daily.unsaved) this.daily = { challenge: null, loading: false, starting: false, error: '', pending: false };
        if (this.daily.unsaved) { this.daily.error = '成绩暂未保存，请点击重试'; return; }
        this.loadDailyInfo();
    }

    loadDailyInfo() {
        const d = this.daily;
        if (!d || d.loading || d.starting) return;
        const saved = dailyProgress.read();
        d.error = ''; d.pending = saved.ok && !!saved.pending;
        d.active = saved.ok && saved.active;
        if (!saved.ok) { d.error = '记录暂时无法读取，请重试'; return; }
        d.loading = true;
        cloudBattle.call('dailyInfo', {}, DAILY_REQUEST).then(res => {
            if (this.daily !== d) return;
            d.loading = false;
            if (!res || !res.ok) { d.error = cloudBattle.describeDailyFailure(res, true); return; }
            if (!(res.runId || res.claimed ? dailyEngine.isRecordedChallenge(res.challenge) : dailyEngine.isChallenge(res.challenge))) {
                d.error = '挑战内容暂时不匹配，请稍后重试'; return;
            }
            d.challenge = res.challenge;
            if (res.claimed) {
                const credit = dailyProgress.rememberReceipt(res.challenge.date, res.settlementId, res.coinReward);
                if (!credit.ok) { d.error = '奖励暂未保存，请重试'; return; }
            }
            const local = dailyProgress.read();
            if (!local.ok) { d.error = '记录暂时无法读取，请重试'; return; }
            d.best = Math.max(local.best[d.challenge.date] || 0, Number(res.score) || 0);
            d.completed = !!res.completed || !!res.claimed;
            d.attempted = !!res.attempted;
            d.refreshDate = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
            if (local.active && res.completed && local.active.runId === res.runId) {
                if (!dailyProgress.discardActive(local.active.runId).ok) { d.error = '进度暂未保存，请重试'; return; }
                d.active = null;
            } else d.active = local.active;
            d.claimed = !!local.claimed[d.challenge.date];
            d.pending = !!local.pending;
        }).catch(error => {
            if (this.daily !== d) return;
            d.loading = false; d.error = cloudBattle.describeDailyFailure(error, false);
        });
    }

    dailyPrimary() {
        const d = this.daily;
        if (!d || d.loading || d.starting) return;
        if (d.activeUnavailable && d.active) {
            wx.showModal({title:'清除过期进度？',content:'这局已过期，无法继续。清除后可查询今日挑战。',confirmText:'清除记录',success:res=>{
                if (!res.confirm || this.daily !== d) return;
                if (!dailyProgress.discardActive(d.active.runId).ok) { d.error = '记录暂时无法保存，请重试'; return; }
                d.activeUnavailable = false; d.active = null; this.loadDailyInfo();
            }});
            return;
        }
        if (d.pendingUnavailable) {
            if (typeof wx.showModal !== 'function') { this.showBattleNotice('上次记录已过期，请重新打开小游戏后处理'); return; }
            const pending = dailyProgress.read().pending;
            if (!pending) { d.pendingUnavailable = false; this.loadDailyInfo(); return; }
            wx.showModal({title:'清除已过期成绩？',content:'这次成绩已超出领取期限，无法领取奖励。清除后可开始今日挑战。',confirmText:'清除记录',success:res=>{
                if (!res.confirm || this.daily !== d) return;
                if (!dailyProgress.discardPending(pending.runId).ok) { d.error='记录暂时无法保存，请重试'; return; }
                d.pendingUnavailable=false; d.pending=false; this.loadDailyInfo();
            }});
            return;
        }
        if (d.unsaved || d.pending) { this.retryDailyResult(); return; }
        if (d.error || !d.challenge) { this.loadDailyInfo(); return; }
        if (d.completed && !d.active) return;
        this.startDailyRun();
    }

    async startDailyRun() {
        const d = this.daily;
        d.starting = true;
        try {
            const res = await cloudBattle.call('dailyStart', d.active ? {runId:d.active.runId} : {}, DAILY_REQUEST);
            if (this.daily !== d || this.state !== 'daily_detail') return;
            if (!res || !res.ok) {
                if (res && (res.err === '今日挑战已完成' || res.err === '挑战已完成')) {
                    // A stale local run can finish on another device or after midnight. Clear only
                    // the local pointer, then re-read the server's current-date state.
                    if (d.active && dailyProgress.discardActive(d.active.runId).ok) d.active = null;
                    d.completed = res.err === '今日挑战已完成';
                    this.loadDailyInfoAfterStart(d); return;
                }
                d.activeUnavailable = !!d.active && res && (res.err === '挑战已过期' || res.err === '挑战记录不存在');
                d.error = d.activeUnavailable ? '上次进度已过期，点击处理' : cloudBattle.describeDailyFailure(res, true);
                return;
            }
            if (!res.runId || !dailyEngine.isRecordedChallenge(res.challenge) || !Array.isArray(res.moves)) {
                d.error = '挑战内容暂时不匹配，请稍后重试'; return;
            }
            let moves = res.moves;
            const saved = dailyProgress.read();
            if (!saved.ok) { d.error = '记录暂时无法读取，请重试'; return; }
            // 本机已写、服务器回执未到的最后一步先确认；另一设备已有后续进度则以服务器为准。
            const active = saved.active;
            if (active && active.runId === res.runId && active.moves.length > moves.length &&
                JSON.stringify(active.moves.slice(0, moves.length)) === JSON.stringify(moves)) {
                const confirmed = await cloudBattle.call('dailyCheckpoint', {runId:res.runId,moves:active.moves}, DAILY_REQUEST);
                if (this.daily !== d || this.state !== 'daily_detail') return;
                if (!confirmed || !confirmed.ok) { d.error = '进度同步失败，请重试'; return; }
                moves = confirmed.moves;
            }
            const run = {runId:res.runId,challenge:res.challenge,moves:moves};
            if (!dailyProgress.saveActive(run).ok) { d.error = '进度暂未保存，请重试'; return; }
            const core = dailyEngine.createCore(res.challenge);
            for (const move of moves) {
                if (!await core.trySwap(move.from,move.to)) throw new Error('invalid_daily_resume');
            }
            if (this.daily !== d || this.state !== 'daily_detail') return;
            d.challenge = res.challenge; d.lastCompleted = null; d.run = run; d.active = run;
            d.best = saved.best[res.challenge.date] || 0; d.claimed = !!saved.claimed[res.challenge.date];
            if (core.ended) { this.finishDailyRun(d, run, core); return; }
            const board = new BoardRenderer(this.ctx, this.screen);
            board.battleMode = true;
            core.callbacks = {
                onSwap: (from,to) => board.animateSwap(from,to),
                onInvalidSwap: (from,to) => { AudioFX.invalid(); return board.animateInvalidSwap(from,to); },
                onMatch: data => { AudioFX.match(data); return board.animateMatch(data); },
                onGravity: data => board.animateGravity(data),
                onFill: data => board.animateFill(data),
                onColorChange: data => board.animateColorChange(data),
                onReshuffle: () => board.animateReshuffle()
            };
            const swap = core.trySwap.bind(core);
            let syncing = false;
            core.trySwap = async (from,to) => {
                if (syncing || this.daily !== d || d.run !== run) return false;
                if (core.processing || core.preferredGenerationPositions.length || core.ended) return false;
                if (core.isBlocked(from) || core.isBlocked(to) || !core.validateMove(from,to)) return swap(from,to);
                const move = {from:{row:from.row,column:from.column},to:{row:to.row,column:to.column}};
                const next = Object.assign({},run,{moves:run.moves.concat(move)});
                if (!dailyProgress.saveActive(next).ok) { this.pauseDailySync(d, '进度暂未保存，请重试'); return false; }
                syncing = true; d.syncing = true;
                try {
                    const accepted = await swap(from,to);
                    if (!accepted) throw new Error('daily_move_rejected');
                    run.moves = next.moves;
                    const response = await cloudBattle.call('dailyCheckpoint',{runId:run.runId,moves:run.moves},DAILY_REQUEST);
                    if (this.daily !== d || d.run !== run) return accepted;
                    if (!response || !response.ok) { this.pauseDailySync(d, '进度同步失败，请重试'); return accepted; }
                    if (core.ended) this.finishDailyRun(d, run, core);
                    return accepted;
                } catch (e) {
                    if (this.daily === d && d.run === run) this.pauseDailySync(d, '进度已保留，联网后继续');
                    return false;
                } finally { syncing = false; d.syncing = false; }
            };
            this.dailyCore = core; this.dailyBoard = board;
            board.setGame(core); this.dailyButtons = null; this.state = 'daily_playing';
        } catch (error) {
            if (this.daily === d) d.error = cloudBattle.describeDailyFailure(error, false);
        } finally { if (this.daily === d) d.starting = false; }
    }

    loadDailyInfoAfterStart(d) {
        d.starting = false;
        this.loadDailyInfo();
    }

    pauseDailySync(d, message) {
        d.run = null; this.dailyCore = null; this.dailyBoard = null;
        this.state = 'daily_detail'; this.dailyButtons = null;
        d.active = dailyProgress.read().active; d.error = message;
    }

    finishDailyRun(d, run, core) {
        d.unsaved = Object.assign({},run,{score:core.score,maxCascade:core.maxCascade,specialComboCount:core.specialComboCount});
        d.run = null; this.state = 'daily_detail'; this.dailyButtons = null;
        this.retryDailyResult();
    }

    retryDailyResult() {
        const d = this.daily;
        if (!d || d.loading) return;
        if (d.unsaved) {
            if (!dailyProgress.savePending(d.unsaved).ok) { d.error = '成绩暂未保存，请点击重试'; return; }
            d.unsaved = null;
        }
        const saved = dailyProgress.read();
        if (!saved.ok) { d.error = '记录暂时无法读取，请重试'; return; }
        if (!saved.pending) { d.pending = false; this.loadDailyInfo(); return; }
        d.pending = true; d.loading = true; d.error = '';
        const pending = saved.pending;
        cloudBattle.call('dailySubmit', {runId:pending.runId,moves:pending.moves}, DAILY_REQUEST).then(res => {
            if (this.daily !== d) return;
            d.loading = false;
            if (!res.ok) {
                d.pendingUnavailable = res.err === '挑战已过期' || res.err === '挑战记录不存在';
                d.error = d.pendingUnavailable ? '上次成绩已过期，点击处理' : cloudBattle.describeDailyFailure(res, true); return;
            }
            const stored = dailyProgress.finishPending(Object.assign({},res,{runId:pending.runId}));
            if (!stored.ok) { d.error = '奖励或纪录暂未保存，请重试'; return; }
            d.pending = false; d.lastCompleted = {date:res.date,score:res.score};
            this.loadDailyInfo();
        }).catch(error => {
            if (this.daily !== d) return;
            d.loading = false; d.error = '成绩已保存，联网后可重试';
        });
    }

    leaveDaily() {
        const d = this.daily;
        if (this.state === 'daily_detail') {
            if (d && d.unsaved) { this.showBattleNotice('成绩暂未保存，请先点击重试'); return; }
            this.state = 'menu'; return;
        }
        if (!d || !d.run || d.syncing || !this.dailyCore || this.dailyCore.processing || this.dailyCore.preferredGenerationPositions.length) return;
        if (typeof wx.showModal !== 'function') { this.showBattleNotice('完成剩余步数后即可返回'); return; }
        wx.showModal({title:'暂存本次挑战？',content:'今日只有这一局，进度已保存，回来后继续剩余步数。',confirmText:'暂存离开',cancelText:'继续挑战',success:res=>{
            if (!res.confirm || this.daily !== d || this.state !== 'daily_playing') return;
            d.run = null; this.dailyCore = null; this.dailyBoard = null; this.openDaily();
        }});
    }

    // ===== 双人对战 =====

    /** 启动轮询（每 1 秒查询房间状态） */
    startPolling() {
        this.stopPolling();
        this.effectSeen = 0;
        this.castSeen = 0;
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
        const b = this.battle;
        if (b.pollPending || b.actionPending || b.expired || (b.completedTracked && b.protocolVersion !== 2)) return;
        b.pollPending = true;
        const revision = b.pollRevision;
        cloudBattle.call('query', { roomId: b.roomId, protocolVersion: 2 }, BATTLE_WAIT_REQUEST).then(function (res) {
            b.pollPending = false;
            if (self.battle !== b || b.actionPending || revision !== b.pollRevision) return;
            if (!res.ok) {
                if (self.battle && !self.battle.queryErrorTracked) {
                    self.battle.queryErrorTracked = true;
                    analytics.track('pvp_error', { category: 'query', reason: battleErrorReason(res, 'query') });
                }
                b.offline = true;
                if (res.err === '邀请已失效' || res.err === '续局已失效' || res.err === '房间不存在' || res.err === '不在房间') {
                    if (b.completedTracked && b.protocolVersion === 2) {
                        b.expired = true; b.offline = false; self.stopPolling(); return;
                    }
                    self.stopPolling();
                    self.battle = null;
                    self.battleCore = null;
                    self.battleBoard = null;
                    self.state = 'menu';
                    self.showBattleNotice(BATTLE_INVITE_EXPIRED_MESSAGE);
                }
                return;
            }
            b.offline = false;
            self.applyPoll(res);
        }).catch(function (error) {
            b.pollPending = false;
            if (self.battle !== b || b.actionPending || revision !== b.pollRevision) return;
            b.offline = true;
            if (!b.queryErrorTracked) {
                b.queryErrorTracked = true;
                analytics.track('pvp_error', { category: 'query', reason: self.battleRequestFailureReason(error) });
            }
        });
    }

    /** 应用轮询结果 */
    applyPoll(res) {
        if (!this.battle) return;
        let b = this.battle;
        if (b.protocolVersion === 2) {
            if (res.protocolVersion !== 2 || !Number.isSafeInteger(res.roundId) || res.roundId < b.roundId) return;
            if (res.roundId > b.roundId) {
                if (b.rewardPending && !this.creditBattleReward()) return;
                if (this.battleBoard) this.battleBoard.onTouchEnd();
                const next = this.newBattleState(b.isHost);
                next.roomId = b.roomId; next.protocolVersion = 2; next.roundId = res.roundId;
                this.battle = b = next;
                this.battleCore = null; this.battleBoard = null; this.battleButtons = null;
                this.effectSeen = 0; this.castSeen = 0; this.guide = null;
                this.state = 'battle_wait';
            }
            b.roundNumber = res.roundNumber || 1;
            b.myWins = res.myWins || 0; b.oppWins = res.oppWins || 0;
            b.myRematch = !!res.myRematch; b.oppRematch = !!res.oppRematch;
            b.canRematch = !!res.canRematch; b.oppLeft = !!res.oppLeft;
            b.oppOnline = !!(res.opp && res.opp.online);
        }
        if (b.completedTracked) return;
        if (Number.isFinite(res.myScore)) b.syncedScore = Math.max(b.syncedScore, res.myScore);

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
            for (let i = 0; i < BATTLE_ITEM_ALLOWLIST.length; i++) {
                const item = BATTLE_ITEM_ALLOWLIST[i];
                b.items[item] = Number(res.myItems[item]) || 0;
            }
        }
        b.itemCooldownUntil = Number(res.myItemCooldownUntil) || 0;
        b.activeEffectUntil = Number(res.myActiveEffectUntil) || 0;

        // 处理新效果（冰冻/干扰）
        if (res.effects && res.effects.length > this.effectSeen) {
            for (let i = this.effectSeen; i < res.effects.length; i++) {
                this.applyEffect(res.effects[i]);
            }
            this.effectSeen = res.effects.length;
        }
        if (res.casts && res.casts.length > this.castSeen) {
            for (let i = this.castSeen; i < res.casts.length; i++) {
                b.castNotice = { item: res.casts[i].item, until: Date.now() + 1500 };
            }
            this.castSeen = res.casts.length;
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
            if (!b.startedTracked) {
                b.startedTracked = true;
                analytics.track('pvp_start', { durationBucket: durationBucket(BATTLE_DURATION_MS) });
            }
        } else if (res.status === 'finished' && res.result && this.state !== 'battle_result') {
            this.applyBattleResult(res.result);
        }
    }

    /** 受击特效 */
    applyEffect(effect) {
        if (!this.battle) return;
        const now = Date.now();
        const until = Number(effect.until) || (now + Number(effect.duration || 0));
        if (until <= now) return;
        if (effect.item === 'freeze') {
            this.battle.frozenUntil = Math.max(this.battle.frozenUntil, until);
        } else if (effect.item === 'disturb') {
            this.battle.disturbUntil = Math.max(this.battle.disturbUntil, until);
            if (this.battleCore) this.battleCore.minMatchCount = 4;
        }
        AudioFX.pvpHit(effect.item);
    }

    /** 结算 */
    applyBattleResult(result) {
        if (!this.battle || this.battle.completedTracked) return;
        this.battle.completedTracked = true;
        this.battle.result = result.result;
        this.battle.myScore = result.myScore;
        this.battle.oppScore = result.oppScore;
        const reward = result.result === 'win' ? 150 : (result.result === 'draw' ? 50 : 30);
        if (this.battle.protocolVersion === 2) {
            this.battle.rewardReceipt = result.settlementId;
            this.battle.rewardAmount = result.coinReward;
            this.battle.rewardPending = true;
            this.creditBattleReward();
        } else {
            coin.addCoins(reward);
            this.battle.coinReward = reward;
        }
        analytics.track('pvp_complete', {
            result: result.result,
            durationBucket: durationBucket(Date.now() - this.battle.startTime)
        });
        if (this.battle.protocolVersion !== 2) this.stopPolling();
        this.state = 'battle_result';
        if (result.result === 'win') AudioFX.win();
        else if (result.result === 'lose') AudioFX.lose();
        else AudioFX.reward();
    }

    creditBattleReward() {
        const b = this.battle;
        if (!b || !b.rewardPending) return true;
        const credit = coin.creditOnce(b.rewardReceipt, b.rewardAmount);
        if (!credit.ok) return false;
        b.rewardPending = false;
        b.coinReward = b.rewardAmount;
        return true;
    }

    battleRequestData(b, fields) {
        return Object.assign({ roomId: b.roomId }, b.protocolVersion === 2
            ? { protocolVersion: 2, roundId: b.roundId } : {}, fields || {});
    }

    battleAgain() {
        const b = this.battle;
        if (!b || b.actionPending) return;
        if (!this.creditBattleReward()) {
            this.showBattleNotice('金币暂未保存，请点击奖励重试'); return;
        }
        if (b.protocolVersion !== 2 || b.expired || b.oppLeft) {
            this.battleCancel(); this.startBattle(); return;
        }
        if (b.offline) { this.pollRoom(); return; }
        b.actionPending = true; b.pollRevision++;
        cloudBattle.call('rematch', this.battleRequestData(b, { accept: !b.myRematch })).then((res) => {
            if (this.battle !== b) return;
            b.actionPending = false; b.pollRevision++;
            if (res.ok) this.applyPoll(res);
            else { b.offline = true; this.showBattleNotice('续局状态待同步，请重试'); this.pollRoom(); }
        }).catch(() => {
            if (this.battle !== b) return;
            b.actionPending = false; b.pollRevision++; b.offline = true;
        });
    }

    /** 创建房间并进入等待页；邀请由房主主动点击。 */
    showBattleNotice(message) {
        if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
            wx.showToast({ title: message, icon: 'none', duration: 2200 });
        }
    }

    showBattleCreateError(error, service) {
        const content = cloudBattle.describeCreateFailure(error, service);
        const fallback = function () {
            if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
                wx.showToast({ title: content, icon: 'none', duration: 8000 });
            }
        };
        if (typeof wx !== 'undefined' && typeof wx.showModal === 'function') {
            try {
                wx.showModal({ title: '暂时无法创建对局', content: content,
                    showCancel: false, confirmText: '知道了', fail: fallback });
            } catch (e) { fallback(); }
        } else fallback();
    }

    startBattle() {
        if (this.battleCreating || this.state === 'playing' || this.state === 'daily_playing' || this.state === 'battle_wait' || this.state === 'battle_playing') return;
        this.battleExitRequest = null;
        this.battleCreating = true;
        analytics.track('pvp_click');
        const self = this;
        const b = this.battle = this.newBattleState(true);
        cloudBattle.call('create', { nickname: '房主猫', protocolVersion: 2 }).then(function (res) {
            if (self.battle !== b) return;
            self.battleCreating = false;
            if (res.ok && res.roomId) {
                self.battle.roomId = res.roomId;
                b.protocolVersion = res.protocolVersion === 2 ? 2 : 1;
                b.roundId = res.roundId || 1;
                b.roundNumber = res.roundNumber || 1;
                self.state = 'battle_wait';
                analytics.track('pvp_create', { result: 'success' });
                self.showGuide(onboarding.GUIDE_KEYS.PVP_WAIT);
                self.startPolling();
            } else {
                AudioFX.invalid();
                analytics.track('pvp_create', { result: 'failure', reason: battleErrorReason(res, 'create') });
                self.battle = null;
                if (res && res.err === BATTLE_CREATE_RATE_LIMIT_MESSAGE) {
                    self.showBattleNotice(BATTLE_CREATE_RATE_LIMIT_MESSAGE);
                } else self.showBattleCreateError(res, true);
            }
        }).catch(function (error) {
            if (self.battle !== b) return;
            self.battleCreating = false;
            AudioFX.invalid();
            analytics.track('pvp_create', { result: 'failure', reason: 'network' });
            self.battle = null;
            self.showBattleCreateError(error, false);
        });
    }

    /** 好友点卡片进入 → 加入房间 */
    joinBattle(roomId) {
        if (this.battleCreating || this.state === 'playing' || this.state === 'daily_playing' || this.state === 'battle_wait' || this.state === 'battle_playing') return;
        this.privacyRequest = null; // 新邀请接管交互，即使入房失败也不恢复旧协议请求。
        if (!cloudBattle.isValidRoomId(roomId)) {
            AudioFX.invalid();
            analytics.track('pvp_error', { category: 'join', reason: 'expired' });
            this.showBattleNotice(BATTLE_INVITE_EXPIRED_MESSAGE);
            return;
        }
        if (this.battle) {
            if (!this.creditBattleReward()) { this.showBattleNotice('金币暂未保存，请点击奖励重试'); return; }
            this.battleCancel();
        }
        const self = this;
        this.battleCreating = true;
        this.battleExitRequest = null;
        const b = this.battle = this.newBattleState(false);
        b.roomId = roomId;
        cloudBattle.call('join', { roomId: roomId, nickname: '挑战猫', protocolVersion: 2 }).then(function (res) {
            if (self.battle !== b) return;
            self.battleCreating = false;
            if (res.ok) {
                b.protocolVersion = res.protocolVersion === 2 ? 2 : 1;
                b.roundId = res.roundId || 1;
                b.roundNumber = res.roundNumber || 1;
                self.state = 'battle_wait';
                analytics.track('pvp_join', { result: 'success' });
                self.showGuide(onboarding.GUIDE_KEYS.PVP_WAIT);
                self.startPolling();
            } else {
                AudioFX.invalid();
                analytics.track('pvp_join', { result: 'failure', reason: battleErrorReason(res, 'join') });
                self.battle = null;
                self.showBattleNotice(BATTLE_INVITE_EXPIRED_MESSAGE);
            }
        }).catch(function () {
            if (self.battle !== b) return;
            self.battleCreating = false;
            AudioFX.invalid();
            analytics.track('pvp_join', { result: 'failure', reason: 'network' });
            self.battle = null;
            self.showBattleNotice(BATTLE_JOIN_NETWORK_MESSAGE);
        });
    }

    newBattleState(isHost) {
        return {
            roomId: null,
            protocolVersion: 1, roundId: 1, roundNumber: 1, myWins: 0, oppWins: 0,
            myRematch: false, oppRematch: false, canRematch: false, oppOnline: true,
            offline: false, expired: false, rewardPending: false,
            myName: '我',
            oppName: '',
            myReady: false,
            oppReady: false,
            oppJoined: false,
            myScore: 0,
            syncedScore: 0,
            scorePending: false,
            lastScoreSyncAt: 0,
            lastSentScore: 0,
            scoreErrorTracked: false,
            pollPending: false,
            pollRevision: 0,
            actionPending: false,
            inputClosed: false,
            oppScore: 0,
            startTime: 0,
            endTime: 0,
            countdownStarted: false,
            countdownStartUntil: 0,
            warningShown: false,
            warningUntil: 0,
            items: { freeze: 1, disturb: 2 },
            itemCooldownUntil: 0,
            activeEffectUntil: 0,
            castNotice: null,
            frozenUntil: 0,
            disturbUntil: 0,
            result: null,
            coinReward: 0,
            oppLeft: false,
            isHost: isHost,
            errorMsg: '',
            queryErrorTracked: false,
            startedTracked: false,
            completedTracked: false
        };
    }

    /** 等待页主动邀请；旧热区或迟到状态不能分享无效房间。 */
    battleInvite() {
        const b = this.battle;
        if (this.state !== 'battle_wait' || !b || !b.isHost || b.oppJoined ||
            b.offline || b.actionPending || !cloudBattle.isValidRoomId(b.roomId)) return;
        AudioFX.click();
        this.shareBattleInvite(b.roomId);
    }

    /** 分享邀请卡片（带 roomId），不据分享调用判定好友已加入。 */
    shareBattleInvite(roomId) {
        if (typeof wx !== 'undefined' && typeof wx.shareAppMessage === 'function') {
            try {
                analytics.track('pvp_invite_share', { status: 'requested' });
                wx.shareAppMessage({
                    title: '来和我 PK ' + config.GAME_CONFIG.title + '，60 秒见胜负！',
                    query: 'roomId=' + roomId + '&invite=1'
                });
                return;
            } catch (e) {
                analytics.track('pvp_error', { category: 'share', reason: 'api_failed' });
            }
        } else {
            analytics.track('pvp_error', { category: 'share', reason: 'api_unavailable' });
        }
        this.showBattleNotice('暂时无法打开分享，请稍后再点“邀请好友”');
    }

    /** 处理 onShow（好友点卡片进入时拿参数加入房间） */
    handleShow(res) {
        this.lastTime = Date.now();
        if (this.state === 'daily_detail') this.loadDailyInfo();
        if (this.state === 'playing' && this.core && !this.guide) this.core.resumeTimer();

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
        if (this.state === 'playing' || this.state === 'daily_playing') {
            this.showBattleNotice('请先完成当前挑战，再打开好友邀请');
            return;
        }
        if (this.battleCreating) return;
        if (!cloudBattle.isValidRoomId(query.roomId)) {
            analytics.track('pvp_error', { category: 'join', reason: 'expired' });
            this.showBattleNotice(BATTLE_INVITE_EXPIRED_MESSAGE);
            return;
        }
        // 仅在非对局安全场景应用已下载的新包；失败时继续处理邀请。
        if (runtime.applyReadyUpdate(this.state)) return;
        this.joinBattle(query.roomId);
    }

    /** 进入后台时暂停单人计时，并丢弃后台期间的主循环间隔 */
    handleHide() {
        this.privacyTouch = null;
        this.lastTime = Date.now();
        if (this.state === 'playing' && this.core) this.core.pauseTimer();
    }

    /** 初始化对战棋盘（复用 GameCore + BoardRenderer，对战模式） */
    startBattleBoard() {
        this.battleBoard = new BoardRenderer(this.ctx, this.screen);
        this.battleBoard.battleMode = true;
        const board = this.battleBoard;
        this.battleCore = new GameCore(BATTLE_LEVEL, {
            onSwap: (from, to) => board.animateSwap(from, to),
            onInvalidSwap: (from, to) => { AudioFX.invalid(); return board.animateInvalidSwap(from, to); },
            onMatch: (data) => { AudioFX.match(data); return board.animateMatch(data); },
            onGravity: (data) => board.animateGravity(data),
            onFill: (data) => board.animateFill(data),
            onColorChange: (data) => board.animateColorChange(data),
            onReshuffle: () => board.animateReshuffle(),
            onLevelEnd: () => {}
        });
        if (this.battle.disturbUntil > Date.now()) {
            this.battleCore.minMatchCount = 4;
        }
        this.battleBoard.setGame(this.battleCore);
    }

    battleRequestFailureReason(error) {
        const diagnostic = error && error.battleDiagnostic;
        return diagnostic && diagnostic.error && diagnostic.error.kind === 'TIMEOUT' ? 'timeout' : 'network';
    }

    battleWaitFailure(b, action, error, service) {
        b.actionPending = false;
        b.pendingAction = '';
        b.pollRevision++;
        b.offline = true;
        const reason = service ? battleErrorReason(error, action) : this.battleRequestFailureReason(error);
        analytics.track('pvp_error', { category: action, reason: reason });
        AudioFX.invalid();
        const label = action === 'configure_items' ? '道具' : '准备状态';
        this.showBattleNotice(error && error.err === '邀请已失效' ? BATTLE_INVITE_EXPIRED_MESSAGE :
            label + (reason === 'timeout' ? '同步超时' : '尚未确认') + '，请重试连接');
    }

    /** 等待页：准备 */
    battleReady() {
        if (!this.battle || !this.battle.roomId || this.state !== 'battle_wait' || this.battle.actionPending) return;
        if (this.battle.offline) { this.pollRoom(); return; }
        AudioFX.click();
        const self = this;
        const b = this.battle;
        b.actionPending = true;
        b.pollRevision++;
        b.pendingAction = 'ready';
        cloudBattle.call('ready', this.battleRequestData(b, b.protocolVersion === 2 ? { ready: !b.myReady } : {}), BATTLE_WAIT_REQUEST).then(function (res) {
            if (self.battle !== b || b.completedTracked) return;
            if (!res.ok) {
                self.battleWaitFailure(b, 'ready', res, true);
                return;
            }
            b.actionPending = false;
            b.pendingAction = '';
            b.pollRevision++;
            self.battle.myReady = !!res.ready;
            if (res.items) self.battle.items = res.items;
            analytics.track('pvp_ready', { status: res.ready ? 'ready' : 'cancelled' });
        }).catch(function (error) {
            if (self.battle !== b || b.completedTracked) return;
            self.battleWaitFailure(b, 'ready', error, false);
        });
    }

    /** 等待页按固定总预算调整自己可见的 PvP 道具配置。 */
    battleAdjustItem(item, delta) {
        if (!this.battle || this.state !== 'battle_wait' || this.battle.actionPending ||
            this.battle.myReady || BATTLE_ITEM_ALLOWLIST.indexOf(item) < 0) return;
        if (this.battle.offline) { this.pollRoom(); return; }
        const next = {};
        for (let i = 0; i < BATTLE_ITEM_ALLOWLIST.length; i++) {
            const key = BATTLE_ITEM_ALLOWLIST[i];
            next[key] = Number(this.battle.items[key]) || 0;
        }
        const direction = delta > 0 ? 1 : -1;
        const other = BATTLE_ITEM_ALLOWLIST.find(function (key) {
            return key !== item && (direction > 0 ? next[key] > 0 : next[item] > 0);
        });
        if (!other) {
            AudioFX.invalid();
            return;
        }
        if (direction > 0) {
            if (next[item] >= BATTLE_ITEM_BUDGET) return;
            next[item]++;
            next[other]--;
        } else {
            if (next[item] <= 0) return;
            next[item]--;
            next[other]++;
        }
        const self = this;
        const b = this.battle;
        b.actionPending = true;
        b.pollRevision++;
        b.pendingAction = 'items';
        cloudBattle.call('configureItems', this.battleRequestData(b, { items: next }), BATTLE_WAIT_REQUEST).then(function (res) {
            if (self.battle !== b || b.completedTracked) return;
            if (res.ok && res.items) {
                b.actionPending = false;
                b.pendingAction = '';
                b.pollRevision++;
                self.battle.items = res.items;
                AudioFX.click();
            } else {
                self.battleWaitFailure(b, 'configure_items', res, true);
            }
        }).catch(function (error) {
            if (self.battle !== b || b.completedTracked) return;
            self.battleWaitFailure(b, 'configure_items', error, false);
        });
    }

    /** 等待页：取消/退出 */
    battleCancel() {
        if (!this.battle) return;
        if (!this.creditBattleReward()) {
            this.showBattleNotice('金币暂未保存，请点击奖励重试'); return;
        }
        const self = this;
        const exiting = this.battleExitRequest = this.battle;
        if (this.battle.roomId) {
            cloudBattle.call('leave', this.battleRequestData(this.battle), BATTLE_WAIT_REQUEST).then(function (res) {
                if (!res.ok) throw new Error('leave unconfirmed');
            }).catch(function () {
                if (self.battleExitRequest !== exiting) return;
                analytics.track('pvp_error', { category: 'leave', reason: 'network' });
                if (self.state === 'menu' && !self.battle) {
                    self.showBattleNotice('退出尚未同步，请网络恢复后重新创建对局');
                }
            });
        }
        this.stopPolling();
        this.battleCreating = false;
        this.battle = null;
        this.battleCore = null;
        this.battleBoard = null;
        this.state = 'menu';
    }

    /** 对战道具释放：仅允许房间配置中的 freeze/disturb。 */
    battleUseItem(item) {
        if (!this.isBattleInputOpen(Date.now()) || this.battle.actionPending || BATTLE_ITEM_ALLOWLIST.indexOf(item) < 0) return;
        const now = Date.now();
        if (this.battle.items[item] <= 0 || now < this.battle.itemCooldownUntil ||
            now < this.battle.activeEffectUntil) {
            AudioFX.invalid();
            return;
        }
        const self = this;
        const b = this.battle;
        b.actionPending = true;
        b.pollRevision++;
        cloudBattle.call('useItem', this.battleRequestData(b, { item: item })).then(function (res) {
            if (self.battle !== b || b.completedTracked) return;
            b.actionPending = false;
            b.pollRevision++;
            if (!res.ok) {
                AudioFX.invalid();
                if (res.err) self.showBattleNotice(res.err);
                return;
            }
            self.battle.items = res.items;
            self.battle.itemCooldownUntil = Number(res.itemCooldownUntil) || 0;
            self.battle.activeEffectUntil = Number(res.activeEffectUntil) || 0;
            self.battle.castNotice = { item: item, until: Date.now() + 1500 };
            AudioFX.pvpCast(item);
        }).catch(function () {
            if (self.battle !== b || b.completedTracked) return;
            b.actionPending = false;
            b.pollRevision++;
            AudioFX.invalid();
        });
    }

    /** 是否被冰冻（锁定输入） */
    isFrozen() {
        return this.battle && Date.now() < this.battle.frozenUntil;
    }

    isBattleInputOpen(now) {
        const b = this.battle;
        return !!(this.state === 'battle_playing' && b && !b.completedTracked &&
            b.startTime > 0 && now >= b.startTime && now < b.endTime);
    }

    /** 更新对战帧逻辑（干扰到期、分数上报、倒计时结束） */
    updateBattle(now) {
        if (!this.battle) return;
        if (this.battle.startTime && now < this.battle.startTime) return;
        if (!this.isBattleInputOpen(now)) {
            if (!this.battle.inputClosed && this.battleBoard) this.battleBoard.onTouchEnd();
            this.battle.inputClosed = true;
            return;
        }
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
        const b = this.battle;
        if (!this.battleCore) return;
        b.myScore = this.battleCore.score;
        // 显示分数与服务端确认分数分开。失败后下一窗口重试；截止前最后800ms立即提交新增分数。
        if (b.scorePending || b.myScore <= b.syncedScore ||
            (now - b.lastScoreSyncAt < 800 && !(b.endTime - now <= 800 && b.myScore > b.lastSentScore))) return;
        const score = b.myScore;
        const self = this;
        b.scorePending = true;
        b.lastScoreSyncAt = now;
        b.lastSentScore = score;
        cloudBattle.call('syncScore', this.battleRequestData(b, { score: score })).then(function (res) {
            b.scorePending = false;
            if (self.battle !== b || b.completedTracked) return;
            if (res.ok) b.syncedScore = Math.max(b.syncedScore, score);
            else if (!b.scoreErrorTracked) {
                b.scoreErrorTracked = true;
                analytics.track('pvp_error', { category: 'sync_score', reason: 'unavailable' });
            }
        }).catch(function () {
            b.scorePending = false;
            if (self.battle !== b || b.completedTracked || b.scoreErrorTracked) return;
            b.scoreErrorTracked = true;
            analytics.track('pvp_error', { category: 'sync_score', reason: 'network' });
        });
    }

    battleBackToMenu() {
        if (!this.creditBattleReward()) {
            this.showBattleNotice('金币暂未保存，请点击奖励重试'); return;
        }
        this.battleCancel();
    }

    // 官方协议优先；离线说明仅作阅读兜底，不充当同意授权。
    openPrivacyNotice() {
        if (this.state !== 'settings' || this.privacyRequest) {
            runtime.privacyDiagnostic('request_ignored');
            return;
        }
        const request = this.privacyRequest = {};
        runtime.openPrivacyContract((opened) => {
            if (this.privacyRequest !== request) return;
            this.privacyRequest = null;
            if (opened || this.state !== 'settings' || this.battleCreating) return;
            runtime.privacyDiagnostic('local_fallback');
            this.privacyOffset = 0;
            this.privacyTouch = null;
            this.privacyButtons = null;
            this.state = 'privacy';
        });
    }

    // ===== 触摸处理 =====

    handleTouchStart(e) {
        if (!e.touches || !e.touches.length) return;
        if (this.state === 'settings') runtime.privacyDiagnostic('settings_touch');
        AudioFX.unlock();
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        if (this.handleGuideTouch(x, y)) return;
        if (this.battleCreating) return;
        if (this.handleStaminaDialogTouch(x, y)) return;

        if (this.state === 'daily_detail' && this.dailyButtons) {
            if (UI.hitTest(x,y,this.dailyButtons.start)) this.dailyPrimary();
            else if (UI.hitTest(x,y,this.dailyButtons.back)) this.leaveDaily();
        } else if (this.state === 'daily_playing' && this.dailyBoard) {
            if (UI.hitTest(x,y,this.dailyButtons && this.dailyButtons.back)) this.leaveDaily();
            else this.dailyBoard.onTouchStart(x,y);
        } else if (this.state === 'playing' && this.board) {
            this.board.onTouchStart(x, y);
        } else if (this.state === 'menu' && this.menuButtons) {
            if (UI.hitTest(x, y, this.menuButtons.battle)) {
                AudioFX.click();
                this.startBattle();
            } else if (UI.hitTest(x, y, this.menuButtons.start)) {
                AudioFX.click();
                if (heart.getHeartState().count <= 0) {
                    this.showStaminaDialog();
                } else {
                    this.levelMapOffset = Math.max(0, this.progress.unlockedLevel - 3);
                    this.levelMapTouch = null;
                    this.levelMapDragged = false;
                    this.state = 'levelselect';
                }
            } else if (UI.hitTest(x, y, this.menuButtons.addHeart)) {
                AudioFX.click();
                this.handleAddHeart();
            } else if (UI.hitTest(x, y, this.menuButtons.shop)) {
                AudioFX.click();
                this.state = 'shop';
            } else if (UI.hitTest(x, y, this.menuButtons.daily)) {
                AudioFX.click(); this.openDaily();
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
                runtime.privacyDiagnostic('button_hit');
                AudioFX.click();
                this.openPrivacyNotice();
            } else if (UI.hitTest(x, y, this.settingsButtons.back)) {
                AudioFX.click();
                this.privacyRequest = null;
                this.state = 'menu';
            }
        } else if (this.state === 'privacy' && this.privacyButtons) {
            const p = this.privacyButtons;
            this.privacyTouch = null;
            if (UI.hitTest(x, y, p.back)) {
                AudioFX.click();
                this.privacyTouch = null;
                this.state = 'settings';
            } else if (UI.hitTest(x, y, p.prev) && p.prevEnabled) {
                this.privacyOffset = Math.max(0, this.privacyOffset - p.step);
            } else if (UI.hitTest(x, y, p.next) && p.nextEnabled) {
                this.privacyOffset = Math.min(p.maxScroll, this.privacyOffset + p.step);
            } else if (UI.hitTest(x, y, p.viewport)) {
                this.privacyTouch = { lastY: y };
            }
        } else if (this.state === 'levelselect' && this.levelSelectButtons) {
            this.levelMapTouch = { x: x, y: y, lastY: y };
            this.levelMapDragged = false;
        } else if (this.state === 'shop' && this.shopButtons) {
            if (UI.hitTest(x, y, this.shopButtons.buy_heart)) {
                this.buyHeart();
            } else if (UI.hitTest(x, y, this.shopButtons.buy_hammer)) {
                this.buyItem('hammer');
            } else if (UI.hitTest(x, y, this.shopButtons.buy_bomb)) {
                this.buyItem('bomb');
            } else if (UI.hitTest(x, y, this.shopButtons.buy_color)) {
                this.buyItem('color');
            } else if (UI.hitTest(x, y, this.shopButtons.reward_hammer)) {
                this.claimShopAdItem('hammer');
            } else if (UI.hitTest(x, y, this.shopButtons.reward_bomb)) {
                this.claimShopAdItem('bomb');
            } else if (UI.hitTest(x, y, this.shopButtons.reward_color)) {
                this.claimShopAdItem('color');
            } else if (UI.hitTest(x, y, this.shopButtons.reward_heart)) {
                this.handleAddHeart('shop');
            } else if (UI.hitTest(x, y, this.shopButtons.back)) {
                AudioFX.click();
                this.state = 'menu';
            }
        } else if (this.state === 'result' && this.resultButtons) {
            if (this.soloPendingResult) {
                if (UI.hitTest(x, y, this.resultButtons.main) || UI.hitTest(x, y, this.resultButtons.menu)) {
                    this.handleLevelEnd(this.soloPendingResult);
                }
                return;
            }
            if (UI.hitTest(x, y, this.resultButtons.revive)) {
                AudioFX.click();
                this.reviveGame();
            } else if (UI.hitTest(x, y, this.resultButtons.main)) {
                if (heart.getHeartState().count <= 0) {
                    this.showStaminaDialog();
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
            if (BattleUI.hitTest(x, y, this.battleButtons.invite)) {
                this.battleInvite();
            } else if (BattleUI.hitTest(x, y, this.battleButtons.freezeMinus)) {
                this.battleAdjustItem('freeze', -1);
            } else if (BattleUI.hitTest(x, y, this.battleButtons.freezePlus)) {
                this.battleAdjustItem('freeze', 1);
            } else if (BattleUI.hitTest(x, y, this.battleButtons.disturbMinus)) {
                this.battleAdjustItem('disturb', -1);
            } else if (BattleUI.hitTest(x, y, this.battleButtons.disturbPlus)) {
                this.battleAdjustItem('disturb', 1);
            } else if (BattleUI.hitTest(x, y, this.battleButtons.ready)) {
                this.battleReady();
            } else if (BattleUI.hitTest(x, y, this.battleButtons.cancel)) {
                this.battleCancel();
            }
        } else if (this.state === 'battle_playing' && this.battleBoard) {
            if (!this.isBattleInputOpen(Date.now())) return;
            // 冰冻中不能操作
            if (this.isFrozen()) return;
            // 道具栏点击
            if (this.battleButtons) {
                const itemKeys = BATTLE_ITEM_ALLOWLIST;
                for (let i = 0; i < itemKeys.length; i++) {
                    const k = itemKeys[i];
                    if (BattleUI.hitTest(x, y, this.battleButtons[k])) {
                        this.battleUseItem(k);
                        return;
                    }
                }
            }
            // 正常交换
            this.battleBoard.onTouchStart(x, y);
        } else if (this.state === 'battle_result' && this.battleButtons) {
            if (BattleUI.hitTest(x, y, this.battleButtons.again)) {
                AudioFX.click();
                this.battleAgain();
            } else if (BattleUI.hitTest(x, y, this.battleButtons.reward)) {
                if (!this.creditBattleReward()) this.showBattleNotice('存储暂不可用，请稍后重试');
            } else if (BattleUI.hitTest(x, y, this.battleButtons.menu)) {
                AudioFX.click();
                this.battleBackToMenu();
            }
        }
    }

    handleTouchMove(e) {
        if (!e.touches || !e.touches.length) return;
        if (this.guide) return;
        if (this.state === 'privacy' && this.privacyTouch && this.privacyButtons) {
            const y = e.touches[0].clientY;
            this.privacyOffset = Math.max(0, Math.min(this.privacyButtons.maxScroll,
                this.privacyOffset + this.privacyTouch.lastY - y));
            this.privacyTouch.lastY = y;
        } else if (this.state === 'daily_playing' && this.dailyBoard) {
            this.dailyBoard.onTouchMove(e.touches[0].clientX,e.touches[0].clientY);
        } else if (this.state === 'playing' && this.board) {
            this.board.onTouchMove(e.touches[0].clientX, e.touches[0].clientY);
        } else if (this.state === 'levelselect' && this.levelMapTouch && this.levelSelectButtons) {
            const y = e.touches[0].clientY;
            const dy = y - this.levelMapTouch.lastY;
            const stepPx = (this.levelSelectButtons.map && this.levelSelectButtons.map.stepPx) || 120;
            const maxOffset = (this.levelSelectButtons.map && this.levelSelectButtons.map.maxOffset) || 0;
            this.levelMapOffset = Math.max(0, Math.min(maxOffset, this.levelMapOffset + dy / stepPx));
            this.levelMapTouch.lastY = y;
            if (Math.abs(y - this.levelMapTouch.y) > 8) this.levelMapDragged = true;
        } else if (this.state === 'battle_playing' && this.battleBoard &&
            this.isBattleInputOpen(Date.now()) && !this.isFrozen()) {
            this.battleBoard.onTouchMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }

    handleTouchEnd(e) {
        if (this.guide) return;
        if (this.state === 'privacy') {
            this.privacyTouch = null;
        } else if (this.state === 'daily_playing' && this.dailyBoard) {
            this.dailyBoard.onTouchEnd();
        } else if (this.state === 'playing' && this.board) {
            this.board.onTouchEnd();
        } else if (this.state === 'levelselect' && this.levelMapTouch && this.levelSelectButtons) {
            const changedTouch = e && e.changedTouches && e.changedTouches[0];
            const x = changedTouch ? changedTouch.clientX : this.levelMapTouch.x;
            const y = changedTouch ? changedTouch.clientY : this.levelMapTouch.lastY;
            if (!this.levelMapDragged) this.activateLevelMapAt(x, y);
            this.levelMapTouch = null;
            this.levelMapDragged = false;
        } else if (this.state === 'battle_playing' && this.battleBoard) {
            this.battleBoard.onTouchEnd();
        }
    }

    activateLevelMapAt(x, y) {
        let targetLevel = 0;
        const visibleLevels = this.levelSelectButtons.visibleLevels || [];
        for (let i = 0; i < visibleLevels.length; i++) {
            const levelId = visibleLevels[i];
            if (UI.hitTest(x, y, this.levelSelectButtons['level_' + levelId])) {
                targetLevel = levelId;
                break;
            }
        }
        if (targetLevel > 0) {
            if (targetLevel > this.progress.unlockedLevel) {
                AudioFX.invalid();
            } else if (heart.getHeartState().count > 0) {
                AudioFX.click();
                analytics.track('solo_level_select', { level: targetLevel });
                this.startGame(targetLevel);
            } else {
                AudioFX.invalid();
                this.showStaminaDialog();
            }
        } else if (UI.hitTest(x, y, this.levelSelectButtons.back)) {
            AudioFX.click();
            this.state = 'menu';
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
            if (this.state === 'menu') analytics.trackOnce('home_exposure');
        }

        // 动画插值更新（仅游戏中）
        if (this.state === 'playing' && this.board) {
            if (this.core) this.core.updateTime(dt);
            if (this.state === 'playing') this.board.update(dt);
            if (this.state === 'playing' && !this.guide && this.core && this.core.isPlaying() &&
                onboarding.shouldShow(onboarding.GUIDE_KEYS.SPECIAL_COMBO) &&
                strategyFeedback.specialPair(this.core).length) {
                this.showGuide(onboarding.GUIDE_KEYS.SPECIAL_COMBO);
            }
        } else if (this.state === 'daily_playing' && this.dailyBoard) {
            this.dailyBoard.update(dt);
        } else if (this.state === 'battle_playing' && this.battleBoard) {
            this.battleBoard.update(dt);
            this.updateBattle(Date.now());
        }
    }

    render() {
        if (this.state !== 'battle_wait') userProfile.destroyButton();
        const audioScene = this.state.indexOf('battle_') === 0 ? 'battle' : 'calm';
        if (audioScene !== this.audioScene) {
            this.audioScene = audioScene;
            AudioFX.setScene(audioScene);
        }
        if (this.state === 'menu' || this.state === 'daily_detail') {
            const heartState = heart.getHeartState();
            const unlocked = this.progress.unlockedLevel;
            this.menuButtons = UI.drawMenu(this.ctx, this.screen, unlocked, {
                count: heartState.count,
                timeLeftText: heart.formatTimeLeft(),
                canPlay: heartState.count > 0,
                canAd: ad.isRewardedAvailable()
            }, { coins: coin.getCoins() });
            if (this.state === 'daily_detail') {
                this.dailyButtons = DailyUI.drawDetail(this.ctx,this.screen,this.daily || {loading:true});
            }
        } else if (this.state === 'daily_playing' && this.dailyBoard) {
            this.dailyBoard.draw();
            this.dailyButtons = DailyUI.drawPlaying(this.ctx,this.screen,this.dailyCore,this.daily.challenge,this.daily);
        } else if (this.state === 'playing' && this.board) {
            this.board.draw();
        } else if (this.state === 'result') {
            this.resultButtons = UI.drawResult(this.ctx, this.screen, this.result);
        } else if (this.state === 'shop') {
            const rewardState = coin.getRewardedItemState();
            const heartState = heart.getHeartState();
            this.shopButtons = UI.drawShop(this.ctx, this.screen, coin.getCoins(), coin.getItems(), {
                canReward: ad.isRealRewardedAvailable(),
                count: rewardState.count,
                limit: coin.REWARDED_ITEM_DAILY_LIMIT,
                pending: this.shopRewardPending,
                heartCount: heartState.count,
                heartMax: heart.HEART_CONFIG.maxHeart,
                heartPending: this.heartAdPending
            });
        } else if (this.state === 'levelselect') {
            this.levelSelectButtons = UI.drawLevelSelect(
                this.ctx, this.screen,
                this.progress.unlockedLevel,
                coin.getCoins(),
                this.progress.stars || {},
                { offset: this.levelMapOffset }
            );
        } else if (this.state === 'privacy') {
            this.privacyButtons = UI.drawPrivacy(this.ctx, this.screen, this.privacyOffset);
            this.privacyOffset = this.privacyButtons.offset;
        } else if (this.state === 'settings') {
            this.settingsButtons = UI.drawSettings(this.ctx, this.screen, {
                musicEnabled: AudioFX.isMusicEnabled(),
                sfxEnabled: AudioFX.isSfxEnabled(),
                privacyPending: !!this.privacyRequest
            });
        } else if (this.state === 'battle_wait' && this.battle) {
            this.battleButtons = BattleUI.drawWait(this.ctx, this.screen, {
                protocolVersion: this.battle.protocolVersion, roundNumber: this.battle.roundNumber,
                myWins: this.battle.myWins, oppWins: this.battle.oppWins,
                roomId: this.battle.roomId || '...',
                myName: this.battle.myName,
                myReady: this.battle.myReady,
                oppName: this.battle.oppName,
                oppReady: this.battle.oppReady,
                oppJoined: this.battle.oppJoined,
                items: this.battle.items,
                isHost: this.battle.isHost,
                offline: this.battle.offline, actionPending: this.battle.actionPending,
                pendingAction: this.battle.pendingAction, pollPending: this.battle.pollPending,
                myAvatar: userProfile.getAvatarImage(), canChangeAvatar: userProfile.canChangeAvatar()
            });
            userProfile.ensureButton(this.battleButtons.avatar);
        } else if (this.state === 'battle_playing' && this.battleBoard && this.battle) {
            const now = Date.now();
            this.battleBoard.draw();
            const timeLeft = Math.max(0, Math.ceil((this.battle.endTime - now) / 1000));
            BattleUI.drawTop(this.ctx, this.screen, {
                protocolVersion: this.battle.protocolVersion, roundNumber: this.battle.roundNumber,
                myWins: this.battle.myWins, oppWins: this.battle.oppWins,
                timeLeft: timeLeft,
                myScore: this.battle.myScore,
                oppScore: this.battle.oppScore,
                urgent: timeLeft <= 10
            });
            this.battleButtons = BattleUI.drawItems(this.ctx, this.screen, {
                freeze: this.battle.items.freeze,
                disturb: this.battle.items.disturb,
                cooldownRemaining: Math.max(0, this.battle.itemCooldownUntil - now),
                active: now < this.battle.activeEffectUntil
            });
            BattleUI.drawEffects(this.ctx, this.screen, {
                frozen: this.isFrozen(),
                frozenRemaining: Math.max(0, this.battle.frozenUntil - now),
                disturb: this.battle.disturbUntil > now,
                disturbRemaining: Math.max(0, this.battle.disturbUntil - now),
                castNotice: this.battle.castNotice && this.battle.castNotice.until > now
                    ? this.battle.castNotice.item : '',
                boardY: this.battleBoard.boardY,
                boardH: this.battleBoard.boardH,
                boardX: this.battleBoard.boardX,
                boardW: this.battleBoard.boardW
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
                coinReward: this.battle.coinReward,
                protocolVersion: this.battle.protocolVersion, roundNumber: this.battle.roundNumber,
                myWins: this.battle.myWins, oppWins: this.battle.oppWins,
                myRematch: this.battle.myRematch, oppRematch: this.battle.oppRematch,
                oppLeft: this.battle.oppLeft, oppOnline: this.battle.oppOnline,
                offline: this.battle.offline, expired: this.battle.expired,
                actionPending: this.battle.actionPending, rewardPending: this.battle.rewardPending
            });
        }
        if (this.staminaDialog) {
            const heartState = heart.getHeartState();
            this.staminaDialogButtons = UI.drawStaminaEmpty(this.ctx, this.screen, {
                timeLeftText: heart.formatTimeLeft(),
                canBuy: heartState.count < heart.HEART_CONFIG.maxHeart && coin.getCoins() >= coin.STAMINA_PRICE,
                canAd: ad.isRewardedAvailable() && !this.heartAdPending,
                staminaPrice: coin.STAMINA_PRICE
            });
        }
        this.guideButtons = this.guide ? OnboardingUI.draw(this.ctx, this.screen, this.guide.key, this.guideContext()) : null;
    }
}

module.exports = Main;
