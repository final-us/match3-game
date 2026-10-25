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
const drawAdDiagnostics = require('./render/ad-diagnostics');
const adRewards = require('./core/ad-rewards');
const soloResume = require('./core/solo-resume');
const soloSnapshot = require('./core/solo-snapshot');
const coin = require('./core/coin');
const config = require('./core/config');
const runtime = require('./core/runtime');
const analytics = require('./core/analytics');
const levelAnalytics = require('./platform/level-analytics');
const homeAnalytics = require('./platform/home-analytics');
const activationAnalytics = require('./platform/activation-analytics');
const onboarding = require('./core/onboarding');
const strategyFeedback = require('./core/strategy-feedback');
const assets = require('./render/assets');
const cloudBattle = require('./net/cloud-battle');
const battleItems = require('./net/battle-items');
const BattleUI = require('./render/battle-ui');
const OnboardingUI = require('./render/onboarding');
const userProfile = require('./platform/user-profile');
const dailyEngine = require('./core/daily-challenge');
const dailyProgress = require('./core/daily-progress');
const DailyUI = require('./render/daily-ui');
const RetentionUI = require('./render/retention-ui');
const retentionPreview = require('./platform/retention-preview');
const retentionClient = require('./platform/retention-client');
const CatalogUI = require('./render/catalog-ui');
const catalogPreview = require('./platform/catalog-preview');
const catalogClient = require('./platform/catalog-client');
const releaseFeatures = require('./core/release-features');
const CompanionUI = require('./render/companion-ui');
const companionDisplay = require('./platform/companion');

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
    constructor(options) {
        this.initialEntryResolved = false;
        heart.invalidateDisplayState();
        coin.invalidateDisplayCoins();
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
        const menuTop = Number(menuButton.top), menuBottom = Number(menuButton.bottom);
        const menuLeft = Number(menuButton.left), menuRight = Number(menuButton.right);
        const validMenu = [menuTop, menuBottom, menuLeft, menuRight].every(Number.isFinite) &&
            menuTop >= 0 && menuBottom > menuTop && menuBottom <= height &&
            menuLeft >= 0 && menuRight > menuLeft && menuRight <= width;
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
            menuButtonRect: validMenu ? { x: menuLeft, y: menuTop, w: menuRight - menuLeft, h: menuBottom - menuTop } : null,
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
        assets.preload(() => { assets.loadIllustrationArt(); assets.loadResultArt(); });
        userProfile.init();
        userProfile.setChangeListener(() => this.syncBattleAvatar());

        // 状态
        this.state = 'menu';
        this.audioScene = null;
        this.runtimeState = null;
        this.core = null;
        this.board = null;
        this.result = null;
        this.menuButtons = null;
        this.menuBattlePress = null;
        this.catalogPreviewEnabled = releaseFeatures.enabled(wx);
        this.catalogPreview = null;
        const catalogSample=!!(options && options.catalogSample);
        this.companion = catalogSample ? companionDisplay.create(wx) : null;
        this.catalog = this.catalogPreviewEnabled && !catalogSample ? catalogClient.create(wx,cloudBattle.call,model=>{
            if(this.companionOwner!==model.owner){
                this.companionOwner=model.owner;
                this.companion=companionDisplay.create(wx,'match3_companion_display_v2_'+model.owner);
            }
            if(this.companion.selection && !model.owned.includes(this.companion.selection.id))this.companion.restoreDefault();
            if(this.companion.selection)assets.loadCatalog();
        }) : null;
        if(this.catalog)this.catalogPreview=this.catalog.model;
        this.companionView = null; this.companionTouch = null; this.companionButtons = null;
        if(this.companion && this.companion.selection)assets.loadCatalog();
        this.catalogButtons = null;
        this.catalogTouch = null;
        this.retentionPreviewEnabled = releaseFeatures.enabled(wx);
        this.retentionPreview = null;
        this.retentionButtons = null;
        this.retentionTouch = null;
        // The sample is injected only by the isolated local visual fixture.
        const resumeRead = soloResume.read();
        const resumeRun = resumeRead.ok && soloResume.eligible(resumeRead.record) && resumeRead.record.meta.retentionSolo;
        this.retention = this.retentionPreviewEnabled && !(options && options.retentionSample)
            ? retentionClient.create(wx,cloudBattle.call,coin,message=>{
                this.retentionNotice=message;this.showBattleNotice(message);
            }, undefined, resumeRun && resumeRun.id) : null;
        if(this.retention)this.retentionPreview=this.retention.model;
        this.resultButtons = null;
        this.shopButtons = null;
        this.shopOffset = 0;
        this.shopTouch = null;
        this.shopRewardPending = false;
        this.soloItemAdPending = false;
        this.staminaDialog = false;
        this.staminaDialogButtons = null;
        this.heartAdPending = false;
        this.adFlow = false;
        this.pendingRevive = null;
        this.backgrounded = false;
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
        this.soloSettingsPausedMs = 0;
        this.soloSettingsPausedAt = null;
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

        this.recoverAdRewards(false);

        // 初始化云开发（云函数对战）
        cloudBattle.init();
        if(this.retention)this.retention.sync();
        if(this.catalog)this.catalog.sync();

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
        if (typeof wx.onTouchCancel === 'function') {
            wx.onTouchCancel(this.handleTouchCancel.bind(this));
        }

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
        this.offerSoloResume(false);
        this.initialEntryResolved = true;
    }

    // ===== 场景切换 =====

    activationService() {
        if (!this.activationReporter) this.activationReporter = activationAnalytics.create(wx,
            config.STARTUP_ANALYTICS_CONFIG, config.MILESTONE_ANALYTICS_CONFIG, analytics.track);
        return this.activationReporter;
    }

    reportActivationFrame() {
        if (!this.initialEntryResolved || this.backgrounded || this.adFlow || this.battleCreating ||
            this.soloOperationBusy || this.soloResumeSaveFailed || this.soloResumePrompt) return;
        const boardReady = this.state === 'playing' && this.board && this.core && this.core.isPlaying();
        const controls = this.guide ? this.guideButtons : this.staminaDialog ? this.staminaDialogButtons :
            this.state === 'menu' ? this.menuButtons : this.state === 'levelselect' ? this.levelSelectButtons :
            this.state === 'result' ? this.resultButtons : this.state === 'battle_wait' ? this.battleButtons : boardReady;
        if (controls) this.activationService().interactive();
        if (boardReady && !this.guide && !this.staminaDialog) this.activationService().mark(this.soloActivation, 'board_ready');
    }

    homeReportService() {
        if (!this.homeReporter) this.homeReporter = homeAnalytics.create(wx, config.HOME_ANALYTICS_CONFIG);
        return this.homeReporter;
    }

    homeEntryAvailable() {
        return this.state === 'menu' && !!this.menuButtons && !this.backgrounded &&
            !this.guide && !this.staminaDialog && !this.adFlow && !this.battleCreating &&
            !this.menuBattlePress && !this.soloOperationBusy && !this.soloResumeSaveFailed && !this.soloResumePrompt;
    }

    reportHomeFrame() {
        if (this.state !== 'menu') {
            this.homeReportVisit = false;
            this.homeEntryDrawn = false;
            return;
        }
        const reporter = this.homeReportService();
        if (!this.homeReportVisit) { reporter.beginVisit(); this.homeReportVisit = true; }
        this.homeEntryDrawn = this.homeEntryAvailable();
        if (this.homeEntryDrawn) {
            if (this.menuButtons.start) reporter.expose('solo');
            if (this.menuButtons.battle) reporter.expose('pvp');
        }
    }

    reportHomeClick(branch) {
        const reporter = this.homeReportService();
        const drawn = !!this.homeEntryDrawn, available = this.homeEntryAvailable();
        reporter.inspectClick(branch, { drawn: drawn, available: available, backgrounded: !!this.backgrounded,
            guide: !!this.guide, stamina: !!this.staminaDialog, ad: !!this.adFlow,
            creating: !!this.battleCreating, press: !!this.menuBattlePress, busy: !!this.soloOperationBusy,
            saveFailed: !!this.soloResumeSaveFailed, resume: !!this.soloResumePrompt });
        if (drawn && available) reporter.click(branch);
    }

    soloReportService() {
        if (!this.levelReporter) this.levelReporter = levelAnalytics.create(wx, config.LEVEL_ANALYTICS_CONFIG);
        return this.levelReporter;
    }

    syncSoloReportClock() {
        if (this.soloReport) this.soloReportService().setRunning(this.soloReport,
            this.state === 'playing' && !!this.core && !this.core.ended &&
            !this.backgrounded && !this.adFlow && !this.soloResumeSaveFailed);
    }

    showGuide(key) {
        if (this.guide) {
            if (this.guide.key === key) return false;
            if (onboarding.shouldShow(key) && this.guideQueue.indexOf(key) < 0) this.guideQueue.push(key);
            return false;
        }
        if (!onboarding.shouldShow(key)) return false;
        this.guide = { key: key };
        if (this.soloResumeRecord) this.updateSoloClock(false);
        this.guideButtons = null;
        if (this.state === 'playing' && this.core) this.core.pauseTimer();
        return true;
    }

    dismissGuide(outcome) {
        if (this.guide && this.guide.key === onboarding.GUIDE_KEYS.SOLO && this.state === 'playing' &&
            (outcome === 'confirm' || outcome === 'skip')) {
            this.activationService().mark(this.soloActivation, 'guide_' + outcome);
        }
        if (this.guide) onboarding.markSeen(this.guide.key);
        this.guide = null;
        this.guideButtons = null;
        if (this.guideQueue.length) {
            this.showGuide(this.guideQueue.shift());
        } else if (this.state === 'playing' && this.core) {
            if (this.soloResumeRecord && !this.updateSoloClock(!this.backgrounded)) return;
            this.core.resumeTimer();
        }
    }

    handleGuideTouch(x, y) {
        if (!this.guide) return false;
        const buttons = this.guideButtons;
        if (buttons && OnboardingUI.hitTest(x, y, buttons.skip)) this.dismissGuide('skip');
        else if (buttons && OnboardingUI.hitTest(x, y, buttons.confirm)) this.dismissGuide('confirm');
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
        if (this.offerSoloResume(true)) return;
        const previous = soloResume.read();
        if (!previous.ok || (previous.record && !soloResume.close(previous.record).ok)) {
            this.showBattleNotice('原局记录暂不可用，请稍后重试'); return;
        }
        this.soloResumeRecord = null;
        this.soloResumeSaveFailed = false;
        this.pendingRevive = null;
        const level = levelData.getLevel(levelId);
        if (!level) return;
        const savedItems=coin.getItems();
        if(!savedItems){this.showBattleNotice('奖励正在恢复保存，请稍后重试');return;}

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
        this.soloSettingsPausedMs = 0;
        this.soloSettingsPausedAt = null;
        this.retentionSolo = this.retention ? this.retention.startSolo(level.id) : null;
        this.retentionNotice='';
        analytics.track('solo_start', { level: level.id });

        this.createSoloBoard(level);
        const previousReport = this.soloReport;
        const reporter = this.soloReportService();
        reporter.close(previousReport, previousReport && previousReport.levelId === level.id ? 3 : null);
        this.soloReport = reporter.start(level);
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

        this.state = 'playing';
        this.syncSoloReportClock();
        this.showGuide(onboarding.GUIDE_KEYS.SOLO);
        if (strategyFeedback.collectGoal(level)) this.showGuide(onboarding.GUIDE_KEYS.COLLECT);
        if (Object.keys(level.underlays || {}).length) this.showGuide(onboarding.GUIDE_KEYS.JELLY);
        if (Object.keys(level.obstacles || {}).length) this.showGuide(onboarding.GUIDE_KEYS.ICE);
        if (level.moonbuds && level.moonbuds.length) this.showGuide(onboarding.GUIDE_KEYS.MOONBUD);
        if (level.parcels && level.parcels.length) this.showGuide(onboarding.GUIDE_KEYS.PARCEL);
        if (level.yarn) this.showGuide(onboarding.GUIDE_KEYS.YARN);
        if (level.trackingPaw) this.showGuide(onboarding.GUIDE_KEYS.TRACKING_PAW);
        if (level.colorBell) this.showGuide(onboarding.GUIDE_KEYS.COLOR_BELL);
        if (savedItems.hammer > 0 || savedItems.bomb > 0 || savedItems.color > 0) {
            this.showGuide(onboarding.GUIDE_KEYS.SOLO_ITEM);
        }
    }

    createSoloBoard(level, restoredCore) {
        assets.loadResultArt();
        // Replacing the board retires only the previous live action, not a restore request.
        if (this.soloOperationBusy && this.soloOperationBusy.kind === 'action') {
            this.soloOperationBusy = false;
            this.soloDeferredResult = null;
        }
        // 先创建渲染层（动画回调需要引用它）
        const board = this.board = new BoardRenderer(this.ctx, this.screen);
        const core = restoredCore || new GameCore(level, {});
        if (!restoredCore) this.soloActivation = this.activationService().newRound(level);
        const activation = this.soloActivation;
        let inputAction = null;
        const run = this.retentionSolo, startedAt = this.soloRunStartedAt;
        const current = () => {
            if (this.core !== core || this.board !== board || this.retentionSolo !== run ||
                this.soloRunStartedAt !== startedAt) return false;
            const operation = this.soloOperationBusy;
            if (operation && operation.kind === 'action') return this.checkSoloOperation(operation);
            return !this.soloResumeRecord || (!this.soloResumeSaveFailed && soloResume.current(this.soloResumeRecord));
        };

        // 再创建逻辑层，动画回调绑定到渲染层
        const callbacks = {
            onSwap: (from, to) => {
                if (inputAction && inputAction.kind === 'swap') inputAction.validSwap = true;
                if(run)run.validMove=true;
                return board.animateSwap(from, to);
            },
            onInvalidSwap: (from, to) => {
                AudioFX.invalid();
                return board.animateInvalidSwap(from, to);
            },
            onMatch: (data) => {
                if (this.soloActivation === activation && inputAction && inputAction.kind === 'swap' &&
                    inputAction.validSwap && data && data.removed && data.removed.length) {
                    // A real accepted swap also proves board readiness if no render ran between input events.
                    const reporter = this.activationService();
                    reporter.mark(activation, 'board_ready');
                    reporter.mark(activation, 'first_match');
                }
                if(run){run.cleared+=data.removed.length;if(data.removed.length)run.validMove=true;}
                AudioFX.match(data, this.screen.reduceEffects);
                if (data && data.generated && data.generated.length) this.showGuide(onboarding.GUIDE_KEYS.SPECIAL);
                return board.animateMatch(data);
            },
            onGravity: (data) => board.animateGravity(data),
            onFill: (data) => board.animateFill(data),
            onColorChange: (data) => board.animateColorChange(data),
            onReshuffle: () => board.animateReshuffle(),
            onYarnSpread: (pos) => board.animateYarnSpread(pos),
            onMoonbudPhase: (data) => board.animateMoonbudPhase(data),
            onParcelDelivered: (data) => board.animateParcelDelivered(data),
            onLevelEnd: result => {
                if (this.soloOperationBusy) this.soloDeferredResult = result;
                else this.handleLevelEnd(result);
            }
        };
        Object.keys(callbacks).forEach(name => {
            const callback = callbacks[name];
            callbacks[name] = (...args) => current() ? callback(...args) : undefined;
        });
        this.core = core;
        core.callbacks = callbacks;

        // Preserve the engine's outcome/errors; only attribute matches to their actual input kind.
        const observeInput = (kind, work, args) => {
            if (inputAction || !current()) return work(...args);
            const action = inputAction = {kind, validSwap:false};
            try {
                return Promise.resolve(work(...args)).finally(() => {
                    if (inputAction === action) inputAction = null;
                });
            } catch (error) {
                if (inputAction === action) inputAction = null;
                throw error;
            }
        };
        const swap = core.trySwap.bind(core), tool = core.useTool.bind(core);
        core.trySwap = (...args) => observeInput('swap', swap, args);
        core.useTool = (...args) => observeInput('tool', tool, args);

        this.board.setGame(this.core);
        const items = coin.getItems();
        this.board.setTools(items || {});
        this.board.onToolAd = type => { if (current()) return this.claimSoloAdItem(type, true); };
        this.board.toolAdAvailable = ad.isRealRewardedAvailable();
        this.board.onToolUsed = (toolType) => {
            if (!current()) return;
            if(run)run.validMove=true;
            if (!this.soloResumeRecord) coin.useItem(toolType);
            const latestItems=coin.getItems();
            if(latestItems)this.board.setTools(latestItems);
            else this.showBattleNotice('道具记录暂未保存，请稍后重试');
            AudioFX.tool(toolType);
        };
    }

    soloResumeMeta(result) {
        const meta = { retentionSolo: this.retentionSolo || null, reviveCount: this.soloReviveCount || 0,
            failureRecorded: !!this.soloFailureRecorded, completionTracked: !!this.soloCompletionTracked,
            startedAt: this.soloRunStartedAt || Date.now(), settingsPausedMs: this.soloSettingsPausedMs || 0,
            result: result || this.result || null,
            guide: this.guide || null, guideQueue: this.guideQueue || [] };
        if (this.soloReport) meta.levelAnalytics = this.soloReportService().snapshot(this.soloReport);
        if (this.soloActivation) meta.activation = this.activationService().snapshot(this.soloActivation);
        return meta;
    }

    resumeSaveError() {
        this.soloResumeSaveFailed = true;
        this.syncSoloReportClock();
        if (this.core) this.core.pauseTimer();
        this.showBattleNotice('原局待保存，点击重试，不会重新看广告');
    }

    saveSoloResume(result) {
        const saved = soloResume.checkpoint(this.soloResumeRecord, this.core, this.soloResumeMeta(result));
        if (!saved.ok) { this.resumeSaveError(); return false; }
        this.soloResumeRecord = saved.record;
        this.soloResumeSaveFailed = false;
        return true;
    }

    soloResumeNeedsRestart(record) {
        const level = record.snapshot.level, current = levelData.getLevel(level.id);
        return !soloSnapshot.compatible(record.snapshot) || !current ||
            JSON.stringify(current) !== JSON.stringify(level);
    }

    offerSoloResume(interactive) {
        const saved = soloResume.read();
        if (!saved.ok) { if (interactive) this.showBattleNotice('原局记录暂不可用，请稍后重试'); return true; }
        if (!soloResume.eligible(saved.record)) return false;
        if (this.soloResumePrompt || this.soloOperationBusy) return true;
        if (this.state !== 'menu' && this.state !== 'levelselect') return true;
        const restart = this.soloResumeNeedsRestart(saved.record);
        if (typeof wx.showModal !== 'function') {
            if (interactive) this.restoreSoloResume(saved.record);
            return true;
        }
        this.soloResumePrompt = true;
        wx.showModal({ title: restart ? '关卡已更新' : '恢复原局',
            content: restart ? '原局使用的关卡规则已更新，无法继续恢复。重新开始会关闭原局，并按当前关卡消耗1点体力。' :
                '上次广告复活的单人关卡尚未结束。恢复不会重复扣体力或增加复活奖励。',
            confirmText: restart ? '重新开始' : '恢复原局', cancelText: '稍后', success: res => {
                this.soloResumePrompt = false;
                if (!res.confirm || this.soloOperationBusy || (this.state !== 'menu' && this.state !== 'levelselect')) return;
                if (!restart) { this.restoreSoloResume(saved.record); return; }
                const closed = soloResume.close(saved.record);
                if (!closed.ok) { this.showBattleNotice('原局记录暂不可用，请稍后重试'); return; }
                this.startGame(saved.record.snapshot.level.id);
            }, fail: () => { this.soloResumePrompt = false; } });
        return true;
    }

    async restoreSoloResume(record) {
        if (this.soloOperationBusy) return false;
        const request = { kind: 'restore', state: this.state, core: this.core, run: this.retentionSolo,
            startedAt: this.soloRunStartedAt, record: this.soloResumeRecord };
        const ownsRequest = () => this.soloOperationBusy === request && this.state === request.state &&
            this.core === request.core && this.retentionSolo === request.run &&
            this.soloRunStartedAt === request.startedAt && this.soloResumeRecord === request.record;
        this.soloOperationBusy = request;
        try {
            // A stored board is authoritative only for this exact content configuration.
            if (this.soloResumeNeedsRestart(record)) {
                this.showBattleNotice('原局版本与当前关卡不同，记录已保留'); return false;
            }
            const recovered = await soloResume.recover(record);
            if (!ownsRequest()) return false;
            if (!recovered.ok || !soloResume.current(recovered.record)) { this.resumeSaveError(); return false; }
            this.installSoloResume(recovered.record);
            return true;
        } catch (error) {
            if (ownsRequest()) this.resumeSaveError();
            return false;
        } finally {
            if (this.soloOperationBusy === request) this.soloOperationBusy = false;
        }
    }

    installSoloResume(record) {
        const core = soloSnapshot.restore(record.snapshot, {}), meta = record.meta;
        const sameRun = this.soloResumeRecord && this.soloResumeRecord.id === record.id &&
            this.soloRunStartedAt === meta.startedAt && this.core && this.core.level.id === core.level.id;
        // A failed checkpoint may leave this run's pause total newer than storage.
        // Merge once; the normal checkpoint below persists it under the recovered revision.
        let settingsPausedMs = Math.max(meta.settingsPausedMs || 0, sameRun ? this.soloSettingsPausedMs || 0 : 0);
        if (sameRun && this.state === 'solo_settings' && this.soloSettingsPausedAt != null)
            settingsPausedMs += Math.max(0, Math.floor(Date.now() - this.soloSettingsPausedAt));
        const sameActivation = this.soloActivation && this.soloResumeRecord && this.soloResumeRecord.id === record.id &&
            this.core && this.core.level.id === core.level.id;
        if (!sameActivation) this.soloActivation = this.activationService().restoreRound(core.level, meta.activation);
        const sameReport = this.soloReport && this.soloResumeRecord &&
            this.soloResumeRecord.id === record.id && this.soloReport.levelId === core.level.id;
        if (!sameReport) this.soloReport = this.soloReportService().restore(core.level, meta.levelAnalytics);
        this.soloResumeRecord = record;
        this.soloResumeSaveFailed = false;
        this.retentionSolo = meta.retentionSolo;
        this.soloReviveCount = meta.reviveCount;
        this.soloReportService().revive(this.soloReport, meta.reviveCount);
        this.soloFailureRecorded = meta.failureRecorded;
        this.soloCompletionTracked = meta.completionTracked;
        this.soloRunStartedAt = meta.startedAt;
        this.soloSettingsPausedMs = settingsPausedMs;
        this.soloSettingsPausedAt = null;
        this.soloPendingResult = null;
        this.resultLeaving = false;
        this.result = meta.result;
        this.guide = meta.guide || null; this.guideQueue = meta.guideQueue || [];
        this.createSoloBoard(core.level, core);
        this.bindSoloResume(core);
        if (core.ended && this.result && !this.result.win) this.result.remainingGoals = this.remainingSoloGoals();
        this.state = core.ended ? 'result' : 'playing';
        if (core.ended) {
            if (!this.soloCompletionTracked && meta.result) this.handleLevelEnd(meta.result);
        } else {
            if (!this.backgrounded && !this.guide) core.resumeTimer();
            if (!this.saveSoloResume()) core.pauseTimer();
            this.lastTime = Date.now();
        }
        this.syncSoloReportClock();
    }

    bindSoloResume(core) {
        const swap = core.trySwap.bind(core), tool = core.useTool.bind(core), tick = core.updateTime.bind(core);
        const run = this.retentionSolo, startedAt = this.soloRunStartedAt;
        core.updateTime = delta => {
            if (this.core !== core || this.retentionSolo !== run || this.soloRunStartedAt !== startedAt || this.soloResumeSaveFailed) return;
            const operation = this.soloOperationBusy;
            if (operation && operation.kind === 'action' && !this.checkSoloOperation(operation)) return;
            if (operation && operation.kind === 'action' && !core.processing && !core.ended && !core.timerPaused &&
                core.timerStarted && core.timeLimitMs > 0 && Number.isFinite(delta) && delta > 0 && delta >= core.timeLeftMs) {
                const saved = soloResume.timeoutBeforeResolve(operation.record);
                if (!saved.ok) { this.resumeSaveError(); return; }
                this.soloResumeRecord = operation.record = saved.record;
            }
            tick(delta);
        };
        core.trySwap = (from, to) => this.performResumedAction(core, 'swap', [from, to], swap);
        core.useTool = (type, pos) => this.performResumedAction(core, 'tool', [type, pos], tool);
    }

    ownsSoloOperation(operation) {
        return !!operation && operation.kind === 'action' && this.soloOperationBusy === operation && this.core === operation.core &&
            this.retentionSolo === operation.run && this.soloRunStartedAt === operation.startedAt &&
            this.soloResumeRecord === operation.record;
    }

    checkSoloOperation(operation) {
        if (!this.ownsSoloOperation(operation) || this.state !== 'playing' || this.soloResumeSaveFailed) return false;
        if (!soloResume.current(operation.record)) { this.resumeSaveError(); return false; }
        return true;
    }

    async performResumedAction(core, kind, args, work) {
        if (this.soloOperationBusy || this.soloResumeSaveFailed || this.core !== core || !core.isPlaying()) return false;
        const started = soloResume.begin(this.soloResumeRecord, core, kind, args, this.soloResumeMeta());
        if (!started.ok) { this.resumeSaveError(); return false; }
        this.soloResumeRecord = started.record;
        // Only this action's clock/timeout writes may advance its pending input version.
        const operation = { kind: 'action', core: core, run: this.retentionSolo, startedAt: this.soloRunStartedAt, record: started.record };
        this.soloOperationBusy = operation; this.soloDeferredResult = null;
        core.random = soloSnapshot.random(started.record.op.seed);
        try {
            const success = await work(...args);
            if (!this.checkSoloOperation(operation)) return false;
            if (success && kind === 'tool') {
                const spent = coin.useItemOnce(args[0], started.record.id + ':' + started.record.sequence);
                if (!spent.ok) { this.resumeSaveError(); return false; }
                if (this.retentionSolo) this.retentionSolo.validMove = true;
            }
            if (!this.saveSoloResume(this.soloDeferredResult)) return false;
            if (this.soloDeferredResult) this.handleLevelEnd(this.soloDeferredResult);
            return success;
        } catch (error) {
            if (this.ownsSoloOperation(operation) && this.state === 'playing') this.resumeSaveError();
            return false;
        } finally {
            if (this.soloOperationBusy === operation) { this.soloOperationBusy = false; this.soloDeferredResult = null; }
        }
    }

    updateSoloClock(running) {
        const operation = this.soloOperationBusy && this.soloOperationBusy.kind === 'action' ? this.soloOperationBusy : null;
        if (operation && !this.checkSoloOperation(operation)) return false;
        const saved = soloResume.clock(this.soloResumeRecord, running);
        if (!saved.ok) { this.resumeSaveError(); return false; }
        this.soloResumeRecord = saved.record;
        if (operation) operation.record = saved.record;
        return true;
    }

    retrySoloResume() {
        const saved = soloResume.read();
        if (!saved.ok || !saved.record) { this.resumeSaveError(); return; }
        this.restoreSoloResume(saved.record);
    }

    backToMenu() {
        this.retireSoloReport();
        this.guide = null;
        this.guideQueue = [];
        this.state = 'menu';
        this.core = null;
        this.board = null;
        this.result = null;
    }

    openSoloSettings() {
        if(this.state!=='playing'||!this.core||!this.core.isPlaying()||this.adFlow||this.soloOperationBusy||this.guide)return;
        this.board.onTouchCancel();
        this.core.pauseTimer();
        this.soloSettingsPausedAt=Date.now();
        this.state='solo_settings';this.soloSettingsButtons=null;
        this.syncSoloReportClock();
        if(this.soloResumeRecord)this.updateSoloClock(false);
    }

    resumeSoloSettings() {
        if(this.state!=='solo_settings'||!this.core)return;
        const at=Date.now();
        this.soloSettingsPausedMs=(this.soloSettingsPausedMs||0)+Math.max(0,Math.floor(at-(this.soloSettingsPausedAt==null?at:this.soloSettingsPausedAt)));
        this.soloSettingsPausedAt=at;
        if(this.soloResumeRecord&&!this.saveSoloResume())return;
        this.soloSettingsPausedAt=null;
        this.state='playing';this.lastTime=Date.now();
        if(this.soloResumeRecord&&!this.updateSoloClock(!this.backgrounded))return;
        if(!this.backgrounded&&!this.soloResumeSaveFailed)this.core.resumeTimer();
        this.syncSoloReportClock();
    }

    exitSoloSettings() {
        if(this.soloSettingsLeaving||this.state!=='solo_settings')return;
        const core=this.core;
        this.soloSettingsLeaving=true;
        const complete=()=>{this.soloSettingsLeaving=false;};
        try { wx.showModal({title:'返回首页？',content:'本局将结束，已消耗的体力不退回。',confirmText:'返回首页',cancelText:'继续游戏',success:res=>{
            if(this.state!=='solo_settings'||this.core!==core)return;
            if(!res.confirm){this.resumeSoloSettings();return;}
            if(this.soloResumeRecord&&!soloResume.close(this.soloResumeRecord).ok){this.showBattleNotice('本局记录暂未保存，请重试');return;}
            this.soloResumeRecord=null;
            this.backToMenu();
        },complete}); } catch(e){complete();this.showBattleNotice('暂时无法退出，请重试');}
    }

    retireSoloReport(preserveResume) {
        // A still-recoverable ordinary run is suspended, not permanently abandoned.
        const resumable = preserveResume && soloResume.eligible(this.soloResumeRecord);
        this.soloReportService().close(this.soloReport, resumable ? null : 6);
        this.soloReport = null;
        this.soloActivation = null;
    }

    remainingSoloGoals() {
        const core = this.core, goals = (core.level.goals || []).slice();
        if (core.jellyTotal > 0 && !goals.some(g => g.type === 'jelly')) goals.push({type:'jelly',target:core.jellyTotal});
        if (!goals.length) goals.push({type:'score',target:1000});
        const counts = {jelly:core.getJellyLeft(),ice:core.getIceLeft(),yarn:core.getYarnHealth(),
            moonbud:core.getMoonbudsLeft(),parcel:core.getParcelsLeft()};
        return goals.map(g => ({type:g.type,pieceType:g.pieceType,
            target:g.type === 'jelly' ? core.jellyTotal : g.target,
            left:g.type === 'score' ? Math.max(0,g.target-core.score) : g.type === 'collect' ?
                Math.max(0,g.target-(core.collectedCounts[g.pieceType]||0)) : counts[g.type]})).filter(g => g.left > 0);
    }

    handleLevelEnd(result) {
        if (this.soloCompletionTracked) return;
        this.soloReportService().result(this.soloReport, !!result.win);
        if (this.soloResumeRecord && !this.saveSoloResume(result)) return;
        if(this.retention&&this.retentionSolo) {
            this.retentionSolo.date=this.retention.date();
            this.retentionSolo.completed=true;
            this.retentionSoloSaved=this.retention.saveSolo(this.retentionSolo,true).ok;
        }
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
            remainingGoals: result.win ? [] : this.remainingSoloGoals(),
            // 只要激励视频可用，失败后可重复观看广告复活
            canRevive: !result.win && ad.isRewardedAvailable()
        };

        analytics.track('solo_complete', {
            level: levelId,
            result: result.win ? 'win' : 'lose',
            reason: this.result.reason,
            stars: star,
            durationBucket: durationBucket(Date.now() - this.soloRunStartedAt - (this.soloSettingsPausedMs || 0)),
            reviveCount: this.soloReviveCount
        });

            this.soloPendingResult = null;
            this.soloCompletionTracked = true;
            if(this.retention&&this.retentionSolo&&result.win)this.retention.finishSolo(this.retentionSolo);
            this.state = 'result';
            this.guide = null;
            this.guideQueue = [];
            if (this.soloResumeRecord) this.saveSoloResume();
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
        this.rewardedTouch = null;
        this.staminaDialog = true;
        this.staminaDialogButtons = null;
    }

    closeStaminaDialog() {
        this.rewardedTouch = null;
        this.staminaDialog = false;
        this.staminaDialogButtons = null;
    }

    readHeartState(notify) {
        try { return heart.getHeartState(); } catch (error) {
            if (notify) this.showBattleNotice('体力记录暂不可用，请稍后重试');
            return null;
        }
    }

    heartView() {
        try {
            const state = heart.getDisplayState();
            return { state: state, timeLeftText: heart.formatTimeLeft(state) };
        }
        catch (error) { return { state: null, timeLeftText: '--:--' }; }
    }

    buyHeart() {
        const state = this.readHeartState(true);
        if (!state) return;
        if (state.count >= heart.HEART_CONFIG.maxHeart || !coin.spendCoins(coin.STAMINA_PRICE)) {
            AudioFX.invalid();
            return;
        }
        heart.addHeart(1);
        AudioFX.reward();
        this.closeStaminaDialog();
    }

    /** 广告占用只在当前运行内生效；不改变玩家音乐/音效偏好。 */
    runAdFlow(work) {
        if (this.adFlow || ad.isBusy() || /^battle_|^daily_/.test(this.state || '')) return Promise.resolve(false);
        const originCore = this.core;
        this.adFlow = true;
        this.syncSoloReportClock();
        this.menuBattlePress = null;
        const context = this.adDiagnosticContext = {music:AudioFX.isMusicEnabled(), sfx:AudioFX.isSfxEnabled()};
        AudioFX.setAdActive(true);
        context.audioPausedAt = Date.now();
        if (this.core && this.state === 'playing') this.core.pauseTimer();
        return Promise.resolve().then(() => work(context)).catch(() => {
            this.showBattleNotice('广告暂不可用，请稍后重试');
            return false;
        }).then(value => {
            this.adFlow = false;
            this.syncSoloReportClock();
            if (this.adDiagnosticContext === context) this.adDiagnosticContext = null;
            this.lastTime = Date.now();
            AudioFX.setAdActive(false);
            if (this.adRewardSound) { this.adRewardSound = false; AudioFX.reward(); }
            if (!this.backgrounded && !this.soloResumeSaveFailed && this.state === 'playing' && this.core === originCore && this.core && !this.guide) this.core.resumeTimer();
            return value;
        });
    }

    playRewarded(placement, options) {
        const outcome = {}, diagnosticContext = this.adDiagnosticContext;
        if (diagnosticContext) diagnosticContext.toastAt = this.lastNativeNoticeAt;
        return ad.showRewarded(placement, Object.assign({}, options, {outcome, diagnosticContext})).then(completed => {
            if (!completed) this.showBattleNotice(ad.failureMessage(outcome));
            return completed;
        });
    }

    reportAdReward(result, placement, notify) {
        if (!result.ok) {
            if (notify) this.showBattleNotice('奖励待保存，请重试，无需再看广告');
            return false;
        }
        if (result.granted) {
            ad.markRewardGranted(result.kind || placement);
            if (this.adFlow) this.adRewardSound = true; else AudioFX.reward();
            if (notify) this.showBattleNotice('奖励已保存');
        }
        return true;
    }

    recoverAdRewards(notify) {
        const result = adRewards.recover();
        this.reportAdReward(result, result.kind, notify || result.pending);
        if (result.ok && this.state === 'playing' && this.board) {
            const items = coin.getItems();
            if (items) this.board.setTools(items);
        }
        return result;
    }

    /** 普通单人局内领取：每次完整观看＋1，不占商店每日额度。 */
    claimSoloAdItem(type, confirm) {
        if (this.state !== 'playing' || !this.core || !this.board || !coin.ITEM_DEFS[type] ||
            this.adFlow || ad.isBusy() || this.soloItemAdPending || this.soloOperationBusy ||
            this.soloResumeSaveFailed || this.backgrounded || this.guide || !this.core.isPlaying()) return Promise.resolve(false);
        if (adRewards.hasPending()) { this.recoverAdRewards(true); return Promise.resolve(false); }
        if (!ad.isRealRewardedAvailable()) { this.showBattleNotice(ad.failureMessage({reason:ad.getRewardedBlockReason()})); return Promise.resolve(false); }
        const core = this.core, board = this.board, run = this.retentionSolo, startedAt = this.soloRunStartedAt;
        const current = () => this.state === 'playing' && this.core === core && this.board === board &&
            this.retentionSolo === run && this.soloRunStartedAt === startedAt;
        const prepared = adRewards.createClaim('solo_item', type);
        if (!prepared.ok) {
            this.showBattleNotice('存储暂不可用，请稍后重试'); return Promise.resolve(false);
        }
        this.soloItemAdPending = board.toolAdPending = true;
        return this.runAdFlow(context => {
            if (this.soloResumeRecord && !this.saveSoloResume()) { adRewards.cancel(prepared.claim); return false; }
            const consent = confirm ? new Promise(resolve => {
                if (typeof wx.showModal !== 'function') { resolve(false); return; }
                context.modalOpenedAt = Date.now();
                wx.showModal({ title: '领取' + coin.ITEM_DEFS[type].name, content: '完整观看视频可获得' + coin.ITEM_DEFS[type].name + '×1。',
                    confirmText: '观看视频', cancelText: '取消',
                    success: result => { context.modalSuccessAt = Date.now(); resolve(!!result.confirm); },
                    fail: () => resolve(false), complete: () => { context.modalCompleteAt = Date.now(); } });
            }) : Promise.resolve(true);
            return consent.then(accepted => {
                if (!accepted || !current() || this.backgrounded) { adRewards.cancel(prepared.claim); return false; }
                return this.playRewarded('solo_item', { allowMock: false }).then(completed => {
                    if (!completed) { adRewards.cancel(prepared.claim); return false; }
                    return this.reportAdReward(adRewards.complete(prepared.claim), 'solo_item', true);
                });
            });
        }).then(value => {
            this.soloItemAdPending = false;
            board.toolAdPending = false;
            if (current()) {
                const items = coin.getItems();
                if (items) board.setTools(items);
                if (this.soloResumeRecord && !this.soloResumeSaveFailed) this.saveSoloResume();
            }
            return value;
        });
    }

    /** 商店真实激励视频领取：禁止mock；保存重试不要求重看。 */
    claimShopAdItem(type) {
        if (this.adFlow || this.shopRewardPending || !coin.ITEM_DEFS[type] || this.state !== 'shop') return Promise.resolve(false);
        if (adRewards.hasPending()) { this.recoverAdRewards(true); return Promise.resolve(false); }
        if (!ad.isRealRewardedAvailable()) { this.showBattleNotice(ad.failureMessage({reason:ad.getRewardedBlockReason()})); return Promise.resolve(false); }
        const state = coin.getRewardedItemState();
        if (!state) { this.showBattleNotice('奖励正在恢复保存，请稍后重试'); return Promise.resolve(false); }
        if (state.remaining <= 0) {
            analytics.track('shop_ad_reward_limit', { category: type, count: state.count });
            AudioFX.invalid(); return Promise.resolve(false);
        }
        const prepared = adRewards.createClaim('shop_item', type);
        if (!prepared.ok) { this.showBattleNotice('存储暂不可用，请稍后重试'); return Promise.resolve(false); }
        this.shopRewardPending = true;
        return this.runAdFlow(() => this.playRewarded('shop_item', { allowMock: false }).then(completed => {
            if (!completed) { adRewards.cancel(prepared.claim); return false; }
            const result = adRewards.complete(prepared.claim);
            const ok = this.reportAdReward(result, 'shop_item', true);
            analytics.track(ok ? 'shop_ad_reward_success' : 'shop_ad_reward_failure', { category: type });
            return ok;
        })).then(value => { this.shopRewardPending = false; return value; });
    }

    // 补体力，待兑付优先恢复。
    handleAddHeart(source) {
        if (this.adFlow || this.heartAdPending || /^battle_|^daily_/.test(this.state || '')) return Promise.resolve(false);
        if (adRewards.hasPending()) { this.recoverAdRewards(true); return Promise.resolve(false); }
        let state;
        try { state = heart.getHeartState(); } catch (error) {
            this.showBattleNotice('存储暂不可用，请稍后重试'); return Promise.resolve(false);
        }
        if (state.count >= heart.HEART_CONFIG.maxHeart) { AudioFX.invalid(); return Promise.resolve(false); }
        const prepared = adRewards.createClaim('heart_refill');
        if (!prepared.ok) { this.showBattleNotice('存储暂不可用，请稍后重试'); return Promise.resolve(false); }
        this.heartAdPending = true;
        const origin = this.state;
        return this.runAdFlow(() => this.playRewarded('heart_refill').then(completed => {
            if (!completed) { adRewards.cancel(prepared.claim); return false; }
            const result = adRewards.complete(prepared.claim);
            const ok = this.reportAdReward(result, 'heart_refill', true);
            if (ok && source === 'dialog' && this.state === origin) this.closeStaminaDialog();
            return ok;
        })).then(value => { this.heartAdPending = false; return value; });
    }

    handleStaminaDialogTouch(x, y, e) {
        if (!this.staminaDialog) return false;
        const buttons = this.staminaDialogButtons;
        if (!buttons) return true;
        if (UI.hitTest(x, y, buttons.buy)) this.buyHeart();
        else if (buttons.ad && UI.hitTest(x, y, buttons.ad)) this.armAdTouch(e, buttons.ad, () => this.handleAddHeart('dialog'));
        else if (UI.hitTest(x, y, buttons.close)) {
            AudioFX.click();
            this.closeStaminaDialog();
        }
        return true;
    }

    // 原局与复活结果均先落盘。
    applyPendingRevive() {
        const claim = this.pendingRevive;
        if (!claim || this.core !== claim.core || this.retentionSolo !== claim.run || this.state !== 'result') return false;
        const completed = soloResume.complete(claim.record);
        if (!completed.ok) {
            this.result.revivePending = true; this.result.canRevive = true;
            this.showBattleNotice('复活待保存，请点复活重试，无需再看广告'); return false;
        }
        try {
            if (this.retention && claim.run && !this.retention.saveSolo(claim.run, false).ok) throw Error('save_pending');
        } catch (e) {
            this.result.revivePending = true; this.result.canRevive = true;
            this.showBattleNotice('复活待保存，请点复活重试，无需再看广告'); return false;
        }
        this.installSoloResume(completed.record);
        this.pendingRevive = null;
        ad.markRewardGranted('revive');
        if (this.adFlow) this.adRewardSound = true; else AudioFX.reward();
        return !this.soloResumeSaveFailed;
    }

    reviveGame() {
        if (this.adFlow || this.resultLeaving || this.state !== 'result' || !this.core ||
            !this.result || this.result.win || this.soloPendingResult) return Promise.resolve(false);
        if (this.pendingRevive) return Promise.resolve(this.applyPendingRevive());
        const prepared = soloResume.prepare(this.core, this.soloResumeMeta(), this.soloResumeRecord);
        if (!prepared.ok) { this.showBattleNotice('原局暂未保存，请稍后重试'); return Promise.resolve(false); }
        this.soloResumeRecord = prepared.record;
        const claim = { core: this.core, run: this.retentionSolo, record: prepared.record };
        return this.runAdFlow(() => this.playRewarded('revive').then(completed => {
            if (!completed) return false;
            if (this.core !== claim.core || this.retentionSolo !== claim.run || this.state !== 'result') return false;
            this.pendingRevive = claim;
            return this.applyPendingRevive();
        }));
    }

    /** 最终离开单人结算；迟到结果不得导航到其他局或模式。 */
    leaveSoloResult(action) {
        if (this.resultLeaving || this.adFlow || this.state !== 'result') return Promise.resolve(false);
        if (this.pendingRevive) {
            this.showBattleNotice('复活待保存，请先点复活重试'); return Promise.resolve(false);
        }
        try {
            if (this.retention && this.retentionSolo && !this.retention.finishSolo(this.retentionSolo).ok) throw new Error('save_pending');
        } catch (error) {
            this.showBattleNotice('任务进度暂未保存，请重试'); return Promise.resolve(false);
        }
        if (this.soloResumeRecord && !soloResume.close(this.soloResumeRecord).ok) {
            this.showBattleNotice('原局结束记录待保存，请重试'); return Promise.resolve(false);
        }
        this.soloResumeRecord = null;
        const originCore = this.core, originResult = this.result;
        this.resultLeaving = true;
        return this.runAdFlow(() => ad.onSoloResultExit()).then(() => {
            this.resultLeaving = false;
            if (this.state === 'result' && this.core === originCore && this.result === originResult) { action(); return true; }
            return false;
        });
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
                onMatch: data => { AudioFX.match(data, this.screen.reduceEffects); return board.animateMatch(data); },
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
            if(this.retention){d.retentionPending=true;this.retentionNotice='';}
            if(this.retention&&!this.retention.record({id:'daily:'+pending.runId,mode:'daily',runId:pending.runId,
                date:res.date,cleared:0,validMove:true}).ok) {
                d.error='每日任务进度暂未保存，请重试';return;
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
        if (b.itemRulesVersion === 3 && b.scorePending) { b.pollWanted = true; return; }
        if (b.pollPending || b.actionPending || b.scorePending || b.expired || (b.completedTracked && b.protocolVersion !== 2)) return;
        b.pollWanted = false;
        b.pollPending = true;
        const revision = b.pollRevision;
        const sentAt = Date.now();
        cloudBattle.call('query', Object.assign({ roomId: b.roomId, protocolVersion: 2 }, b.itemRulesVersion === 3 ? { itemRulesVersion: 3, roundId: b.roundId } : {}), BATTLE_WAIT_REQUEST).then(function (res) {
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
                    userProfile.clearRoomProfile();
                    self.showBattleNotice(BATTLE_INVITE_EXPIRED_MESSAGE);
                }
                return;
            }
            b.offline = false;
            self.applyPoll(res, sentAt);
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
    applyPoll(res, sentAt) {
        if (!this.battle) return;
        const previousBattle = this.battle;
        let b = previousBattle;
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
        battleItems.configure(b, res);
        if (b !== previousBattle) this.syncBattleAvatar();
        if (b.itemRulesVersion === 3) {
            battleItems.status(b, res, sentAt);
            if (battleItems.acknowledge(b, res)) b.scoreUncertain = false;
            if (b.pendingItem && (res.casts || []).some(cast => cast.requestId === b.pendingItem.requestId)) b.pendingItem = null;
        }
        b.oppAvatarUrl = res.opp && res.opp.avatarUrl || '';
        if (b.completedTracked) return;
        if (b.itemRulesVersion !== 3 && Number.isFinite(res.myScore)) b.syncedScore = Math.max(b.syncedScore, res.myScore);

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
            const keys = battleItems.keys(b);
            for (let i = 0; i < keys.length; i++) {
                const item = keys[i];
                b.items[item] = Number(res.myItems[item]) || 0;
            }
        }
        battleItems.cooldowns(b, res, true);

        // 处理新效果（冰冻/干扰）
        if (b.itemRulesVersion === 3) {
            for (const effect of res.effects || []) {
                const state = effect.status || 'active';
                if (b.effectStates[effect.id] === state) continue;
                b.effectStates[effect.id] = state;
                this.applyEffect(effect);
            }
        } else if (res.effects && res.effects.length > this.effectSeen) {
            for (let i = this.effectSeen; i < res.effects.length; i++) {
                this.applyEffect(res.effects[i]);
            }
            this.effectSeen = res.effects.length;
        }
        if (b.itemRulesVersion === 3) {
            for (const cast of res.casts || []) {
                const status = cast.status || 'active';
                if (b.castStates[cast.id] === status) continue;
                b.castStates[cast.id] = status;
                if (this.battleNow() - cast.at < 2000) {
                    if (status === 'reflected') b.itemNotice = { text: '攻击被对手反弹', until: this.battleNow() + 1500 };
                    else b.castNotice = { item: cast.item, until: this.battleNow() + 1500 };
                }
            }
        } else if (res.casts && res.casts.length > this.castSeen) {
            for (let i = this.castSeen; i < res.casts.length; i++) {
                if (this.battleNow() - res.casts[i].at < 2000) b.castNotice = { item: res.casts[i].item, until: this.battleNow() + 1500 };
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
        const now = this.battleNow();
        const until = Number(effect.until) || (now + Number(effect.duration || 0));
        if (effect.status === 'blocked' || effect.status === 'triggered') {
            if (now - effect.at < 5000) this.battle.itemNotice = { text: effect.status === 'triggered' ? '镜面反弹 · 已反击' : '镜面反弹 · 已抵挡', until: now + 1500 };
            return;
        }
        if (until <= now) return;
        if (effect.item === 'freeze') {
            this.battle.frozenUntil = Math.max(this.battle.frozenUntil, until);
        } else if (effect.item === 'disturb') {
            this.battle.disturbUntil = Math.max(this.battle.disturbUntil, until);
            this.battle.disturbNoticeUntil = Math.min(until, now + 1000);
            if (this.battleCore) this.battleCore.minMatchCount = 4;
        } else if (effect.item === 'reflect') {
            // Poll/useItem status is authoritative: historical grants must not revive a consumed shield.
            return;
        } else if (effect.item === 'cheer') {
            this.battle.cheerUntil = Math.max(this.battle.cheerUntil, until);
            battleItems.window(this.battle, until);
        }
        if (effect.item === 'freeze' || effect.item === 'disturb') AudioFX.pvpHit(effect.item);
    }

    /** 结算 */
    applyBattleResult(result) {
        if (!this.battle || this.battle.completedTracked) return;
        this.battle.completedTracked = true;
        this.battle.result = result.result;
        this.battle.myScore = result.myScore;
        this.battle.oppScore = result.oppScore;
        if(this.retention&&this.battle.protocolVersion===2&&this.battle.retentionValidMove) {
            this.battle.retentionEvent={id:'pvp:'+this.battle.roomId+':'+this.battle.roundId,mode:'pvp',
                roomId:this.battle.roomId,roundId:this.battle.roundId,date:this.retention.date(),
                cleared:this.battle.retentionCleared||0,validMove:true};
            if(this.retention.record(this.battle.retentionEvent).ok)this.battle.retentionEvent=null;
        }
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
        if(this.retention&&b&&b.retentionEvent) {
            if(!this.retention.record(b.retentionEvent).ok)return false;
            b.retentionEvent=null;
        }
        if (!b || !b.rewardPending) return true;
        const credit = coin.creditOnce(b.rewardReceipt, b.rewardAmount);
        if (!credit.ok) return false;
        b.rewardPending = false;
        b.coinReward = b.rewardAmount;
        return true;
    }

    battleRequestData(b, fields) {
        return Object.assign({ roomId: b.roomId }, b.protocolVersion === 2
            ? { protocolVersion: 2, roundId: b.roundId } : {}, b.itemRulesVersion === 3 ? { itemRulesVersion: 3 } : {}, fields || {});
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
            this.lastNativeNoticeAt = Date.now();
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
        userProfile.clearRoomProfile();
        analytics.track('pvp_click');
        const self = this;
        const b = this.battle = this.newBattleState(true);
        cloudBattle.call('create', { nickname: '房主猫', protocolVersion: 2, itemRulesVersion: 3, retentionEnabled: !!this.retention }).then(function (res) {
            if (self.battle !== b) return;
            self.battleCreating = false;
            if (res.ok && res.roomId) {
                self.battle.roomId = res.roomId;
                b.protocolVersion = res.protocolVersion === 2 ? 2 : 1;
                b.roundId = res.roundId || 1;
                b.roundNumber = res.roundNumber || 1;
                battleItems.configure(b, res);
                self.state = 'battle_wait';
                userProfile.beginRoom();
                self.retireSoloReport(true);
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
        userProfile.clearRoomProfile();
        this.battleCreating = true;
        this.battleExitRequest = null;
        const b = this.battle = this.newBattleState(false);
        b.roomId = roomId;
        cloudBattle.call('join', { roomId: roomId, nickname: '挑战猫', protocolVersion: 2, itemRulesVersion: 3, retentionEnabled: !!this.retention }).then(function (res) {
            if (self.battle !== b) return;
            self.battleCreating = false;
            if (res.ok) {
                b.protocolVersion = res.protocolVersion === 2 ? 2 : 1;
                b.roundId = res.roundId || 1;
                b.roundNumber = res.roundNumber || 1;
                battleItems.configure(b, res);
                self.state = 'battle_wait';
                userProfile.beginRoom();
                self.retireSoloReport(true);
                analytics.track('pvp_join', { result: 'success' });
                self.showGuide(onboarding.GUIDE_KEYS.PVP_WAIT);
                self.startPolling();
            } else {
                AudioFX.invalid();
                analytics.track('pvp_join', { result: 'failure', reason: battleErrorReason(res, 'join') });
                self.battle = null;
                self.showBattleNotice(res.err === 'UPDATE_REQUIRED' ? '请更新游戏后加入这场对战' : BATTLE_INVITE_EXPIRED_MESSAGE);
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
            itemRulesVersion: 1, serverOffset: 0, reflectUntil: 0, cheerUntil: 0,
            effectStates: {}, castStates: {}, pendingItem: null, queuedItem: null, scoreUncertain: false,
            scoreSamples: [], nextScoreSeq: 0, scoreAckSeq: 0, lastSampleScore: 0, lastSampleAt: 0,
            cheerWindows: [], confirmedScore: 0, scoreCloseAt: 0, scoreFinalized: false, itemNotice: null,
            myRematch: false, oppRematch: false, canRematch: false, oppOnline: true,
            offline: false, expired: false, rewardPending: false,
            myName: '我',
            oppName: '',
            oppAvatarUrl: '', avatarProfileRequest: null, avatarProfileError: false,
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
            itemCooldowns: null,
            activeEffectUntil: 0,
            castNotice: null,
            frozenUntil: 0,
            disturbUntil: 0,
            disturbNoticeUntil: 0,
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
        heart.invalidateDisplayState();
        coin.invalidateDisplayCoins();
        if (this.backgrounded) this.homeReportVisit = false;
        this.backgrounded = false;
        this.syncSoloReportClock();
        ad.onShow();
        if (this.adFlow || (this.soloOperationBusy && this.soloOperationBusy.kind === 'restore')) {
            this.lastTime = Date.now(); return;
        }
        this.recoverAdRewards(false);
        if (this.soloResumeRecord && this.state === 'playing' && !this.soloResumeSaveFailed) {
            this.updateSoloClock(!this.guide);
        }
        this.lastTime = Date.now();
        if(this.retention)this.retention.sync();
        if(this.catalog && (this.state==='menu'||this.state==='catalog_preview'))this.catalog.sync();
        if (this.state === 'daily_detail') this.loadDailyInfo();
        if (this.state === 'playing' && this.core && !this.guide && !this.soloResumeSaveFailed) this.core.resumeTimer();

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
        if (this.state === 'playing' || this.state === 'solo_settings' || this.state === 'daily_playing') {
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

    // 后台暂停计时。
    handleHide() {
        this.backgrounded = true;
        this.homeEntryDrawn = false;
        this.syncSoloReportClock();
        this.rewardedTouch = null;
        ad.onHide();
        this.menuBattlePress = null;
        this.catalogTouch = null;
        this.companionTouch = null;
        this.privacyTouch = null;
        this.retentionTouch = null;
        this.lastTime = Date.now();
        if (this.state === 'playing' && this.core) this.core.pauseTimer();
        if (this.board && this.board.onTouchCancel) this.board.onTouchCancel();
        if (this.soloResumeRecord && this.state === 'playing') {
            if (this.soloOperationBusy) {
                this.updateSoloClock(false);
            } else this.saveSoloResume();
        }
    }

    /** 初始化对战棋盘（复用 GameCore + BoardRenderer，对战模式） */
    startBattleBoard() {
        this.retentionNotice='';
        this.battle.retentionCleared=0;
        this.battle.retentionValidMove=false;
        this.battleBoard = new BoardRenderer(this.ctx, this.screen);
        this.battleBoard.battleMode = true;
        this.battleBoard.pvpLayout = true;
        const board = this.battleBoard;
        const battle = this.battle;
        this.battleCore = new GameCore(BATTLE_LEVEL, {
            onSwap: (from, to) => {this.battle.retentionValidMove=true;return board.animateSwap(from, to);},
            onInvalidSwap: (from, to) => { AudioFX.invalid(); return board.animateInvalidSwap(from, to); },
            onMatch: (data) => { if (this.battle !== battle) return; battleItems.sample(battle, data.score);battle.retentionCleared+=data.removed.length;AudioFX.match(data, this.screen.reduceEffects); return board.animateMatch(data); },
            onGravity: (data) => board.animateGravity(data),
            onFill: (data) => board.animateFill(data),
            onColorChange: (data) => board.animateColorChange(data),
            onReshuffle: () => board.animateReshuffle(),
            onLevelEnd: () => {}
        });
        if (this.battle.disturbUntil > this.battleNow()) {
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
        if (this.battle.itemRulesVersion === 3 && !this.battle.myReady &&
            battleItems.KEYS.reduce((sum, key) => sum + this.battle.items[key], 0) !== 5) {
            this.showBattleNotice('请先分配完5次免费额度'); return;
        }
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
            this.battle.myReady || battleItems.keys(this.battle).indexOf(item) < 0) return;
        if (this.battle.offline) { this.pollRoom(); return; }
        const keys = battleItems.keys(this.battle), next = { ...this.battle.items };
        const direction = delta > 0 ? 1 : -1;
        if (this.battle.itemRulesVersion === 3) {
            const total = keys.reduce((sum, key) => sum + next[key], 0);
            if (direction > 0 ? total >= 5 : next[item] <= 0) return;
            next[item] += direction;
        } else {
            const other = keys.find(key => key !== item && (direction > 0 ? next[key] > 0 : next[item] > 0));
            if (!other) { AudioFX.invalid(); return; }
            next[item] += direction; next[other] -= direction;
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

    /** Optional portrait writes never lock readiness, items or score synchronization. */
    syncBattleAvatar() {
        const b = this.battle, avatarUrl = userProfile.getSharedAvatarUrl();
        const inRoom = this.state === 'battle_wait' || this.state === 'battle_playing' || this.state === 'battle_result';
        if (!b || !b.roomId || !inRoom || !avatarUrl || b.avatarProfileRequest) return;
        const request = b.avatarProfileRequest = {};
        b.avatarProfileError = false;
        cloudBattle.call('profile', this.battleRequestData(b, { avatarUrl }), BATTLE_WAIT_REQUEST).then(res => {
            if (this.battle !== b || b.avatarProfileRequest !== request) return;
            b.avatarProfileRequest = null;
            if (!res.ok) throw new Error('profile unconfirmed');
            if (userProfile.getSharedAvatarUrl() !== avatarUrl) this.syncBattleAvatar();
        }).catch(() => {
            if (this.battle !== b || (b.avatarProfileRequest && b.avatarProfileRequest !== request)) return;
            b.avatarProfileRequest = null;
            if (userProfile.getSharedAvatarUrl() !== avatarUrl) { this.syncBattleAvatar(); return; }
            b.avatarProfileError = true;
            if (this.state === 'battle_wait') this.showBattleNotice('头像暂未同步，点头像重试');
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
        userProfile.clearRoomProfile();
        this.battleCreating = false;
        this.battle = null;
        this.battleCore = null;
        this.battleBoard = null;
        this.state = 'menu';
    }

    /** 对战道具释放：每种道具使用服务端确认的独立冷却。 */
    battleUseItem(item) {
        const b = this.battle, now = this.battleNow();
        if (!this.isBattleInputOpen(now) || this.isFrozen() || b.actionPending || battleItems.keys(b).indexOf(item) < 0) return;
        if (b.offline || b.scoreUncertain) { this.pollRoom(); return; }
        const retry = b.pendingItem;
        if (retry && retry.item !== item) { this.showBattleNotice('上次道具尚未确认，请重试原道具'); return; }
        if (!retry && (b.items[item] <= 0 || now < battleItems.cooldownUntil(b, item))) { AudioFX.invalid(); return; }
        if (b.scorePending || b.queuedItem) {
            if (!b.queuedItem) b.queuedItem = item;
            this.showBattleNotice('道具已排队，成绩同步后释放'); return;
        }
        if (b.itemRulesVersion === 3 && b.scoreSamples.length > 32) { this.showBattleNotice('正在同步成绩，请稍后使用'); return; }
        // Retry identity is stable; reconcile the score batch so already-acked samples are not replayed.
        const payload = retry ? { ...retry, samples: b.scoreSamples.slice() } : (b.itemRulesVersion === 3 ? {
            item: item, requestId: 'cast_' + b.roundId + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10),
            samples: b.scoreSamples.slice()
        } : { item: item });
        if (b.itemRulesVersion === 3) b.pendingItem = payload;
        b.actionPending = true; b.pollRevision++;
        const sentAt = Date.now();
        cloudBattle.call('useItem', this.battleRequestData(b, payload), BATTLE_WAIT_REQUEST).then(res => {
            if (this.battle !== b || b.completedTracked) return;
            b.actionPending = false; b.pollRevision++;
            if (!res.ok) {
                b.pendingItem = null;
                AudioFX.invalid();
                if (res.err) this.showBattleNotice(res.err);
                b.scoreUncertain = b.itemRulesVersion === 3;
                this.pollRoom(); return;
            }
            b.pendingItem = null;
            battleItems.acknowledge(b, res);
            if (b.itemRulesVersion === 3) battleItems.status(b, res, sentAt);
            b.items = res.items;
            battleItems.cooldowns(b, res, false);
            b.castNotice = { item: item, until: this.battleNow() + 1500 };
            if (res.cast && res.cast.status === 'reflected') b.itemNotice = { text: '攻击被对手反弹', until: this.battleNow() + 1500 };
            if (item === 'freeze' || item === 'disturb') AudioFX.pvpCast(item);
            else AudioFX.click();
        }).catch(() => {
            if (this.battle !== b || b.completedTracked) return;
            b.actionPending = false; b.pollRevision++;
            b.offline = true;
            this.showBattleNotice('道具尚未确认，重连后请重试');
            AudioFX.invalid();
        });
    }

    flushBattleQueuedItem(b) {
        if (!b.queuedItem || b.scorePending || b.actionPending || b.offline || b.scoreUncertain ||
            (b.itemRulesVersion === 3 && b.scoreSamples.length > 32)) return;
        const item = b.queuedItem;
        b.queuedItem = null;
        const now = this.battleNow();
        if (!this.isBattleInputOpen(now)) return;
        if (this.isFrozen() || b.items[item] <= 0 || now < battleItems.cooldownUntil(b, item)) {
            this.showBattleNotice('道具状态已变化，本次未释放'); return;
        }
        this.battleUseItem(item);
    }

    battleNow() { return this.battle && this.battle.itemRulesVersion === 3 ? battleItems.serverNow(this.battle) : Date.now(); }

    /** 是否被冰冻（锁定输入） */
    isFrozen() {
        return this.battle && this.battleNow() < this.battle.frozenUntil;
    }

    isBattleInputOpen(now) {
        const b = this.battle;
        return !!(this.state === 'battle_playing' && b && !b.completedTracked &&
            b.startTime > 0 && now >= b.startTime && now < b.endTime);
    }

    /** 更新对战帧逻辑（干扰到期、分数上报、倒计时结束） */
    updateBattle(now) {
        if (!this.battle) return;
        if (this.battle.itemRulesVersion === 3) now = this.battleNow();
        if (this.battle.startTime && now < this.battle.startTime) return;
        if (!this.isBattleInputOpen(now)) {
            this.battle.queuedItem = null;
            if (!this.battle.inputClosed && this.battleBoard) this.battleBoard.onTouchEnd();
            this.battle.inputClosed = true;
            const b = this.battle;
            if (this.state === 'battle_playing' && !b.completedTracked && b.itemRulesVersion === 3 &&
                now >= b.endTime && now < b.scoreCloseAt) {
                b.myScore = battleItems.displayScore(b);
                this.syncBattleSamples(b, now);
            }
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
        if (b.itemRulesVersion === 3) {
            b.myScore = battleItems.displayScore(b);
            this.flushBattleQueuedItem(b);
            this.syncBattleSamples(b, now); return;
        }
        b.myScore = this.battleCore.score;
        this.flushBattleQueuedItem(b);
        // 显示分数与服务端确认分数分开。失败后下一窗口重试；截止前最后800ms立即提交新增分数。
        if (b.scorePending || b.actionPending || b.myScore <= b.syncedScore ||
            (now - b.lastScoreSyncAt < 800 && !(b.endTime - now <= 800 && b.myScore > b.lastSentScore))) return;
        const score = b.myScore;
        const self = this;
        b.scorePending = true;
        b.lastScoreSyncAt = now;
        b.lastSentScore = score;
        cloudBattle.call('syncScore', this.battleRequestData(b, { score: score }), BATTLE_WAIT_REQUEST).then(function (res) {
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

    syncBattleSamples(b, now) {
        const closing = now >= b.endTime;
        if (b.scoreFinalized || (closing && !(now < b.scoreCloseAt)) ||
            b.scorePending || b.pollPending || b.actionPending || b.scoreUncertain || b.offline ||
            (!closing && (!b.scoreSamples.length || (now - b.lastScoreSyncAt < 300 && b.endTime - now > 800)))) return;
        const final = closing && b.scoreSamples.length <= 32;
        const payload = { samples: b.scoreSamples.slice(0, 32) };
        if (final) payload.final = true;
        b.scorePending = true; b.pollRevision++; b.lastScoreSyncAt = now;
        const sentAt = Date.now();
        cloudBattle.call('syncScore', this.battleRequestData(b, payload), BATTLE_WAIT_REQUEST).then(res => {
            if (this.battle !== b || b.completedTracked) return;
            b.scorePending = false; b.pollRevision++;
            if (res.ok) {
                battleItems.acknowledge(b, res); battleItems.status(b, res, sentAt);
                if (final || b.pollWanted) this.pollRoom();
            }
            else {
                if (b.queuedItem) { b.queuedItem = null; this.showBattleNotice('成绩未确认，道具未释放，请重试'); }
                b.scoreUncertain = true; this.pollRoom();
            }
        }).catch(() => {
            if (this.battle !== b || b.completedTracked) return;
            b.scorePending = false; b.pollRevision++; b.scoreUncertain = true;
            this.pollRoom();
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

    openCompanion(kind,id,stage) {
        if(!this.companion)return;
        const model=this.catalogPreview,selection=this.companion.selection;
        id=id||(selection&&selection.id);
        const owned=model&&model.status==='ready'&&model.owned.includes(id);
        const saved=selection&&selection.id===id?selection:null;
        if(kind==='story'&&!owned&&!saved)return;
        const growth=owned?catalogPreview.growthFor(model,id):null;
        const unlocked=Math.max(owned?(growth.enabled?growth.stage:0):0,saved?saved.unlocked:0);
        const homeStage=this.state==='menu'&&saved?saved.stage:null;
        this.companionView={kind,catId:id,stage:stage==null?(homeStage!==null?homeStage:owned?(growth.enabled?growth.displayStage:0):saved?saved.stage:0):stage,
            unlocked,returnState:this.state,offset:0,message:''};
        this.companionButtons=null;this.companionTouch=null;this.state='companion';
        assets.loadCatalog();
    }

    companionAction(action) {
        const view=this.companionView;if(!view||!this.companion)return;
        const close=()=>{this.state=view.returnState==='catalog_preview'?'catalog_preview':'menu';this.companionView=null;this.companionButtons=null;this.companionTouch=null;
            if(view.backSwitch)this.openCompanion('switch');};
        if(action==='close'||action==='home'){close();return;}
        if(action==='retry-save'){this.companionAction(view.saveAction||'read');return;}
        if(action==='read'){view.readAttempted=true;view.saveAction='read';this.companion.markRead(view.catId,view.stage,view.unlocked);return;}
        if(action==='retry'){assets.loadCatalog();return;}
        if(action==='catalog'){this.openCatalogPreview();this.companionView=null;return;}
        if(action==='feed'){
            const model=this.catalogPreview,growth=model&&catalogPreview.growthFor(model,view.catId);
            if(!growth||!growth.enabled)return;
            model.view='detail';model.selectedId=view.catId;model.offset=0;model.overlay=null;
            catalogPreview.activate(model,'feed');this.state='catalog_preview';this.companionView=null;return;
        }
        if(action.indexOf('choose:')===0){
            const id=action.slice(7),selection=this.companion.selection;
            this.openCompanion('story',id,selection&&selection.id===id?selection.stage:undefined);
            if(this.companionView!==view){this.companionView.returnState='menu';this.companionView.backSwitch=true;}
            return;
        }
        view.saveAction=action;
        if(action==='default'){
            if(this.companion.restoreDefault()){this.state='menu';this.companionView=null;}
        }else if(action.indexOf('chapter:')===0){
            const stage=Number(action.slice(8));
            if(Number.isInteger(stage)&&stage>=0&&stage<5){view.stage=stage;view.offset=0;view.readAttempted=false;}
        }else if(action==='select'||action.indexOf('choose:')===0){
            const id=action==='select'?view.catId:action.slice(7),model=this.catalogPreview;
            if(action==='select'&&view.stage>view.unlocked)return;
            if(model&&model.owned.includes(id)){
                const growth=catalogPreview.growthFor(model,id);
                if(view.stage>(growth.enabled?growth.stage:0))return;
                const selected=action==='select'?Object.assign({},model,{displayStages:Object.assign({},model.displayStages,{[id]:view.stage})}):model;
                if(this.companion.select(selected,id)){this.state='menu';this.companionView=null;}
            }else if(this.companion.selection&&this.companion.selection.id===id){this.state='menu';this.companionView=null;}
        }
        this.companionButtons=null;this.companionTouch=null;
    }

    finishCompanionTouch(e) {
        const t=this.companionTouch;this.companionTouch=null;
        const p=t&&e&&e.changedTouches&&Array.from(e.changedTouches).find(p=>p.identifier===t.id);
        if(!p||t.dragged||(e.touches&&e.touches.length)||t.view!==this.companionView||t.stage!==this.companionView.stage||!this.companionButtons)return;
        if(Math.abs(p.clientX-t.x)>8||Math.abs(p.clientY-t.y)>8)return;
        const r=this.companionButtons[t.action];
        if(t.action&&UI.hitTest(t.x,t.y,r)&&UI.hitTest(p.clientX,p.clientY,r)){AudioFX.click();this.companionAction(t.action);}
    }

    openCatalogPreview() {
        if (!this.catalogPreviewEnabled) return;
        if (!this.catalogPreview) this.catalogPreview = catalogPreview.create();
        this.catalogPreview.view = 'list'; this.catalogPreview.selectedId = null;
        this.catalogPreview.offset = this.catalogPreview.listOffset = 0;
        this.catalogPreview.message = '';
        this.catalogPreview.overlay = null;
        this.catalogButtons = null; this.catalogTouch = null;
        this.state = 'catalog_preview';
        this.loadCatalogResources();
        if(this.catalog){
            const ready=this.retention?this.retention.sync():Promise.resolve();
            ready.then(()=>this.catalog.sync());
        }
    }

    loadCatalogResources() {
        this.catalogButtons = null; this.catalogTouch = null;
        assets.loadCatalog().then(() => {
            if (this.state === 'catalog_preview') {
                this.catalogButtons = null; this.catalogTouch = null;
            }
        });
    }

    finishCatalogTouch(e) {
        const t = this.catalogTouch;
        this.catalogTouch = null;
        const p = t && e && e.changedTouches && Array.from(e.changedTouches).find(point=>point.identifier===t.identifier);
        if (!t || !p || (e.touches && e.touches.length) || t.dragged || t.model !== this.catalogPreview || !this.catalogButtons ||
            t.view!==this.catalogPreview.view || t.selectedId!==this.catalogPreview.selectedId ||
            t.status!==this.catalogPreview.status ||
            t.overlay!==this.catalogPreview.overlay ||
            Math.abs(p.clientX-t.x)>8 || Math.abs(p.clientY-t.y)>8) return;
        const r = this.catalogButtons[t.action];
        if (!t.action || !UI.hitTest(t.x,t.y,r) || !UI.hitTest(p.clientX,p.clientY,r)) return;
        AudioFX.click();
        if(t.action==='open-story'||t.action==='set-companion'||t.action==='read-unlock'){
            const id=this.catalogPreview.selectedId;
            if(this.catalogPreview.status!=='ready'||!this.catalogPreview.owned.includes(id))return;
            if(t.action==='read-unlock'){
                const stage=this.catalogPreview.overlay&&this.catalogPreview.overlay.stage;
                this.catalogPreview.overlay=null;this.openCompanion('story',id,stage);
            }else if(t.action==='open-story'){
                const unread=this.companion.firstUnread(this.catalogPreview,id);
                this.openCompanion('story',id,unread===null?undefined:unread);
            }
            else if(this.companion && this.companion.select(this.catalogPreview,id))this.state='menu';
            else this.catalogPreview.message=this.companion?this.companion.error:'暂时无法保存';
            this.catalogButtons=null;return;
        }
        if (t.action === 'retry-assets') { this.loadCatalogResources(); return; }
        const navigation = this.catalog ? this.catalog.activate(t.action) : catalogPreview.activate(this.catalogPreview,t.action);
        this.catalogButtons = null;
        if (navigation === 'close') this.state = 'menu';
        else if (navigation === 'play') this.state = 'menu';
    }

    openRetentionPreview() {
        if (!this.retentionPreviewEnabled) return;
        if (!this.retentionPreview) this.retentionPreview = retentionPreview.create();
        this.retentionPreview.offset = 0;
        this.retentionPreview.message = '';
        this.retentionPreview.rules = false;
        this.retentionButtons = null;
        this.retentionTouch = null;
        this.state = 'retention_preview';
        if(this.retention)this.retention.sync();
    }

    finishRetentionTouch(e) {
        const touch = this.retentionTouch;
        this.retentionTouch = null;
        if (!touch || touch.dragged || !this.retentionButtons || !this.retentionPreview) return;
        const point = e && e.changedTouches && e.changedTouches[0];
        if (!point || Math.abs(point.clientY-touch.y)>8 || Math.abs(point.clientX-touch.x)>8) return;
        for (const action of ['close','signinTab','tasksTab','primary','task0','task1','task2','weekly0','weekly1','weekly2','previous0','previous1','previous2']) {
            const r = this.retentionButtons[action];
            if (!UI.hitTest(touch.x,touch.y,r) || !UI.hitTest(point.clientX,point.clientY,r)) continue;
            AudioFX.click();
            const navigation = this.retention ? this.retention.activate(action) : retentionPreview.activate(this.retentionPreview,action);
            this.retentionButtons = null;
            if (navigation === 'close' || navigation === 'play') this.state = 'menu';
            return;
        }
    }

    // Native overlays start only after the initiating finger is released.
    armAdTouch(e, rect, action) {
        if (!e || !e.touches || e.touches.length !== 1) return;
        const p = e.touches[0];
        this.rewardedTouch = { x:p.clientX, y:p.clientY, id:p.identifier, rect, action,
            state:this.state, core:this.core, result:this.result, dialog:this.staminaDialog };
    }

    validAdTouch(points) {
        const t = this.rewardedTouch, p = points && points[0];
        return !!(t && p && points.length === 1 && p.identifier === t.id &&
            Math.abs(p.clientX-t.x) <= 8 && Math.abs(p.clientY-t.y) <= 8 &&
            UI.hitTest(p.clientX,p.clientY,t.rect) && this.state === t.state &&
            this.core === t.core && this.result === t.result && this.staminaDialog === t.dialog &&
            !this.backgrounded && !this.guide && !this.battleCreating && !this.soloPendingResult &&
            !this.adFlow && !this.soloOperationBusy && !this.soloResumeSaveFailed && !this.soloResumePrompt);
    }

    handleTouchCancel() {
        this.rewardedTouch = null;
        this.shopTouch = null;
        this.retentionTouch = null; this.catalogTouch = null; this.companionTouch = null;
        if (this.board && this.board.onTouchCancel) this.board.onTouchCancel();
    }

    handleTouchStart(e) {
        this.rewardedTouch = null;
        this.shopTouch = null;
        if (this.adFlow || this.soloOperationBusy || this.soloResumePrompt) return;
        if (this.soloResumeSaveFailed) { this.retrySoloResume(); return; }
        if (!e.touches || !e.touches.length) return;
        if (this.state === 'settings') runtime.privacyDiagnostic('settings_touch');
        AudioFX.unlock();
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        if (this.handleGuideTouch(x, y)) return;
        if(this.state==='battle_wait'&&userProfile.isPromptOpen()){
            if(this.avatarConsentButtons&&UI.hitTest(x,y,this.avatarConsentButtons.cancel))userProfile.dismissPrompt();
            return;
        }
        if(this.state==='solo_settings'){
            const buttons=this.soloSettingsButtons;if(!buttons)return;
            if(UI.hitTest(x,y,buttons.resume))this.resumeSoloSettings();
            else if(UI.hitTest(x,y,buttons.home))this.exitSoloSettings();
            else if(UI.hitTest(x,y,buttons.music)){AudioFX.setMusicEnabled(!AudioFX.isMusicEnabled());if(AudioFX.isSfxEnabled())AudioFX.click();}
            else if(UI.hitTest(x,y,buttons.sfx)){const next=!AudioFX.isSfxEnabled();AudioFX.setSfxEnabled(next);if(next)AudioFX.click();}
            return;
        }
        if (this.battleCreating) return;
        if (this.handleStaminaDialogTouch(x, y, e)) return;

        if(this.state==='companion'){
            if(e.touches.length!==1){this.companionTouch=null;return;}
            const b=this.companionButtons;
            this.companionTouch={x,y,lastY:y,id:e.touches[0].identifier,view:this.companionView,stage:this.companionView.stage,dragged:false,
                action:b&&Object.keys(b).find(k=>k!=='viewport'&&k!=='maxScroll'&&UI.hitTest(x,y,b[k])),scroll:b&&UI.hitTest(x,y,b.viewport)};return;
        }
        if (this.state === 'catalog_preview') {
            if(e.touches.length!==1){this.catalogTouch=null;return;}
            const b=this.catalogButtons;
            const action=b && Object.keys(b).find(key=>key!=='viewport' && key!=='maxScroll' && UI.hitTest(x,y,b[key]));
            this.catalogTouch={x,y,lastY:y,dragged:false,action,model:this.catalogPreview,
                identifier:e.touches[0].identifier,view:this.catalogPreview.view,selectedId:this.catalogPreview.selectedId,
                status:this.catalogPreview.status,
                overlay:this.catalogPreview.overlay,
                scroll:!!b && UI.hitTest(x,y,b.viewport)};
            if(this.catalogPreview)this.catalogPreview.message='';
            return;
        }
        if (this.state === 'retention_preview') {
            this.retentionTouch = {x,y,lastY:y,dragged:false,
                scroll:!!this.retentionButtons && UI.hitTest(x,y,this.retentionButtons.viewport)};
            if (this.retentionPreview) this.retentionPreview.message = '';
            return;
        } else if (this.state === 'daily_detail' && this.dailyButtons) {
            if (UI.hitTest(x,y,this.dailyButtons.start)) this.dailyPrimary();
            else if (UI.hitTest(x,y,this.dailyButtons.back)) this.leaveDaily();
        } else if (this.state === 'daily_playing' && this.dailyBoard) {
            if (UI.hitTest(x,y,this.dailyButtons && this.dailyButtons.back)) this.leaveDaily();
            else this.dailyBoard.onTouchStart(x,y);
        } else if (this.state === 'playing' && this.board) {
            if (e.touches.length !== 1) { this.board.onTouchCancel(); return; }
            if(UI.hitTest(x,y,this.soloSettingsButton)){AudioFX.click();this.openSoloSettings();return;}
            if(this.board.selectedTool) {
                const savedItems=coin.getItems();
                if(!savedItems){this.board.selectedTool=null;this.showBattleNotice('道具记录待保存，请重试');return;}
                this.board.setTools(savedItems);
            }
            this.board.onTouchStart(x, y, e.touches[0].identifier);
        } else if (this.state === 'menu' && this.menuButtons) {
            if (this.menuBattlePress) return;
            if (UI.hitTest(x, y, this.menuButtons.battle)) {
                AudioFX.click();
                this.reportHomeClick('pvp');
                this.menuBattlePress = { elapsed: 0 };
            } else if (UI.hitTest(x, y, this.menuButtons.start)) {
                AudioFX.click();
                this.reportHomeClick('solo');
                if (this.offerSoloResume(true)) return;
                const hearts = this.readHeartState(true);
                if (!hearts) return;
                if (hearts.count <= 0) {
                    this.showStaminaDialog();
                } else {
                    this.levelMapOffset = Math.max(0, this.progress.unlockedLevel - 3);
                    this.levelMapTouch = null;
                    this.levelMapDragged = false;
                    this.state = 'levelselect';
                }
            } else if (UI.hitTest(x, y, this.menuButtons.addHeart)) {
                AudioFX.click();
                this.armAdTouch(e, this.menuButtons.addHeart, () => this.handleAddHeart());
            } else if (UI.hitTest(x, y, this.menuButtons.shop)) {
                AudioFX.click();
                this.state = 'shop';
                this.shopOffset = 0;
                this.recoverAdRewards(true);
            } else if (UI.hitTest(x, y, this.menuButtons.daily)) {
                AudioFX.click(); this.openDaily();
            } else if(UI.hitTest(x,y,this.menuButtons.companionSwitch)){
                this.openCompanion('switch');
            } else if(UI.hitTest(x,y,this.menuButtons.companionStory)){
                this.openCompanion('story');
            } else if (UI.hitTest(x, y, this.menuButtons.catalog)) {
                AudioFX.click(); this.openCatalogPreview();
            } else if (UI.hitTest(x, y, this.menuButtons.retention)) {
                AudioFX.click(); this.openRetentionPreview();
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
            if (e.touches.length !== 1) return;
            this.shopTouch = { x, y, lastY:y, id:e.touches[0].identifier,
                scroll:UI.hitTest(x,y,this.shopButtons.viewport) };
            if (UI.hitTest(x, y, this.shopButtons.buy_heart)) {
                this.armAdTouch(e, this.shopButtons.buy_heart, () => this.buyHeart());
            } else if (UI.hitTest(x, y, this.shopButtons.buy_hammer)) {
                this.armAdTouch(e, this.shopButtons.buy_hammer, () => this.buyItem('hammer'));
            } else if (UI.hitTest(x, y, this.shopButtons.buy_bomb)) {
                this.armAdTouch(e, this.shopButtons.buy_bomb, () => this.buyItem('bomb'));
            } else if (UI.hitTest(x, y, this.shopButtons.buy_color)) {
                this.armAdTouch(e, this.shopButtons.buy_color, () => this.buyItem('color'));
            } else if (UI.hitTest(x, y, this.shopButtons.reward_hammer)) {
                this.armAdTouch(e, this.shopButtons.reward_hammer, () => this.claimShopAdItem('hammer'));
            } else if (UI.hitTest(x, y, this.shopButtons.reward_bomb)) {
                this.armAdTouch(e, this.shopButtons.reward_bomb, () => this.claimShopAdItem('bomb'));
            } else if (UI.hitTest(x, y, this.shopButtons.reward_color)) {
                this.armAdTouch(e, this.shopButtons.reward_color, () => this.claimShopAdItem('color'));
            } else if (UI.hitTest(x, y, this.shopButtons.reward_heart)) {
                this.armAdTouch(e, this.shopButtons.reward_heart, () => this.handleAddHeart('shop'));
            } else if (UI.hitTest(x, y, this.shopButtons.back)) {
                this.armAdTouch(e, this.shopButtons.back, () => { AudioFX.click(); this.state = 'menu'; });
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
                this.armAdTouch(e, this.resultButtons.revive, () => this.reviveGame());
            } else if (UI.hitTest(x, y, this.resultButtons.main)) {
                const hearts = this.readHeartState(true);
                if (!hearts) return;
                if (hearts.count <= 0) {
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
            if (this.battle.avatarProfileError && BattleUI.hitTest(x, y, this.battleButtons.avatar)) {
                this.syncBattleAvatar();
            } else if (BattleUI.hitTest(x, y, this.battleButtons.invite)) {
                this.battleInvite();
            } else if (battleItems.keys(this.battle).some(key => {
                for (const [suffix, delta] of [['Minus', -1], ['Plus', 1]]) {
                    if (BattleUI.hitTest(x, y, this.battleButtons[key + suffix])) { this.battleAdjustItem(key, delta); return true; }
                }
                return false;
            })) {
                return;
            } else if (BattleUI.hitTest(x, y, this.battleButtons.ready)) {
                this.battleReady();
            } else if (BattleUI.hitTest(x, y, this.battleButtons.cancel)) {
                this.battleCancel();
            }
        } else if (this.state === 'battle_playing' && this.battleBoard) {
            if (!this.isBattleInputOpen(this.battleNow())) return;
            // 冰冻中不能操作
            if (this.isFrozen()) return;
            // 道具栏点击
            if (this.battleButtons) {
                const itemKeys = battleItems.keys(this.battle);
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
        // A drag may begin over a buy/video button. Cancel its release action,
        // then continue scrolling instead of spending coins or starting an ad.
        if (this.state === 'shop' && this.shopTouch) {
            const t=this.shopTouch,p=e.touches&&e.touches[0];
            if (!p || e.touches.length!==1 || p.identifier!==t.id || this.adFlow || this.backgrounded) {
                this.shopTouch=null;this.rewardedTouch=null;return;
            }
            if (Math.abs(p.clientX-t.x)>8 || Math.abs(p.clientY-t.y)>8) t.dragged=true;
            if (t.dragged) this.rewardedTouch=null;
            if (t.dragged && t.scroll && this.shopButtons) this.shopOffset=Math.max(0,Math.min(this.shopButtons.maxScroll||0,(this.shopOffset||0)+t.lastY-p.clientY));
            t.lastY=p.clientY;return;
        }
        if (this.rewardedTouch) {
            if (!this.validAdTouch(e.touches)) this.rewardedTouch = null;
            return;
        }
        if (this.soloOperationBusy || this.soloResumeSaveFailed || this.soloResumePrompt) return;
        if (this.adFlow) return;
        if (!e.touches || !e.touches.length) return;
        if (this.guide) return;
        if(this.state==='companion'){
            const t=this.companionTouch,p=e.touches[0];
            if(e.touches.length!==1||!t||p.identifier!==t.id){this.companionTouch=null;return;}
            if(Math.abs(p.clientX-t.x)>8||Math.abs(p.clientY-t.y)>8)t.dragged=true;
            if(t.scroll&&t.dragged&&this.companionButtons)this.companionView.offset=Math.max(0,Math.min(this.companionButtons.maxScroll,this.companionView.offset+t.lastY-p.clientY));
            t.lastY=p.clientY;return;
        }
        if (this.state === 'catalog_preview') {
            if(e.touches.length!==1){this.catalogTouch=null;return;}
            const t=this.catalogTouch,p=e.touches[0];
            if(t && p.identifier!==t.identifier){this.catalogTouch=null;return;}
            if(t && this.catalogButtons && this.catalogPreview){
                if(Math.abs(p.clientY-t.y)>8 || Math.abs(p.clientX-t.x)>8)t.dragged=true;
                if(t.scroll && t.dragged)this.catalogPreview.offset=Math.max(0,Math.min(this.catalogButtons.maxScroll,
                    this.catalogPreview.offset+t.lastY-p.clientY));
                t.lastY=p.clientY;
            }
            return;
        }
        if (this.state === 'retention_preview') {
            const t=this.retentionTouch,p=e.touches[0];
            if(t&&this.retentionButtons&&this.retentionPreview){
                if(Math.abs(p.clientY-t.y)>8||Math.abs(p.clientX-t.x)>8)t.dragged=true;
                if(t.scroll&&t.dragged)this.retentionPreview.offset=Math.max(0,Math.min(this.retentionButtons.maxScroll,
                    this.retentionPreview.offset+t.lastY-p.clientY));
                t.lastY=p.clientY;
            }
            return;
        } else if (this.state === 'privacy' && this.privacyTouch && this.privacyButtons) {
            const y = e.touches[0].clientY;
            this.privacyOffset = Math.max(0, Math.min(this.privacyButtons.maxScroll,
                this.privacyOffset + this.privacyTouch.lastY - y));
            this.privacyTouch.lastY = y;
        } else if (this.state === 'daily_playing' && this.dailyBoard) {
            this.dailyBoard.onTouchMove(e.touches[0].clientX,e.touches[0].clientY);
        } else if (this.state === 'playing' && this.board) {
            if (e.touches.length !== 1) { this.board.onTouchCancel(); return; }
            this.board.onTouchMove(e.touches[0].clientX, e.touches[0].clientY, e.touches[0].identifier);
        } else if (this.state === 'levelselect' && this.levelMapTouch && this.levelSelectButtons) {
            const y = e.touches[0].clientY;
            const dy = y - this.levelMapTouch.lastY;
            const stepPx = (this.levelSelectButtons.map && this.levelSelectButtons.map.stepPx) || 120;
            const maxOffset = (this.levelSelectButtons.map && this.levelSelectButtons.map.maxOffset) || 0;
            this.levelMapOffset = Math.max(0, Math.min(maxOffset, this.levelMapOffset + dy / stepPx));
            this.levelMapTouch.lastY = y;
            if (Math.abs(y - this.levelMapTouch.y) > 8) this.levelMapDragged = true;
        } else if (this.state === 'battle_playing' && this.battleBoard &&
            this.isBattleInputOpen(this.battleNow()) && !this.isFrozen()) {
            this.battleBoard.onTouchMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }

    handleTouchEnd(e) {
        this.shopTouch = null;
        if (this.rewardedTouch) {
            const t = this.rewardedTouch;
            const valid = e && !(e.touches && e.touches.length) && this.validAdTouch(e.changedTouches);
            this.rewardedTouch = null;
            if (valid) t.action();
            return;
        }
        if (this.soloOperationBusy || this.soloResumeSaveFailed || this.soloResumePrompt) return;
        if (this.adFlow) return;
        if (this.guide) return;
        if(this.state==='companion'){this.finishCompanionTouch(e);return;}
        if (this.state === 'catalog_preview') {
            this.finishCatalogTouch(e); return;
        }
        if (this.state === 'retention_preview') {
            this.finishRetentionTouch(e);
            return;
        } else if (this.state === 'privacy') {
            this.privacyTouch = null;
        } else if (this.state === 'daily_playing' && this.dailyBoard) {
            this.dailyBoard.onTouchEnd();
        } else if (this.state === 'playing' && this.board) {
            const touch = e && e.changedTouches && e.changedTouches[0];
            this.board.onTouchEnd(touch && touch.clientX, touch && touch.clientY, touch && touch.identifier);
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
            } else if (this.readHeartState(true)?.count > 0) {
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
        this.syncSoloReportClock();
        if (this.menuBattlePress) {
            if (this.state !== 'menu' || this.guide || this.battleCreating) {
                this.menuBattlePress = null;
            } else {
                this.menuBattlePress.elapsed += Math.max(0, dt);
                if (this.menuBattlePress.elapsed >= 160) {
                    this.menuBattlePress = null;
                    this.startBattle();
                }
            }
        }
        if (this.runtimeState !== this.state) {
            this.runtimeState = this.state;
            runtime.maybePromptUpdate(this.state);
            if (this.state === 'menu') analytics.trackOnce('home_exposure');
        }

        // 动画插值更新（仅游戏中）
        if (this.state === 'playing' && this.board) {
            if (this.core && !this.adFlow && !this.backgrounded) this.core.updateTime(dt);
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
        if(this.state==='companion'&&this.companionView.kind!=='switch'){
            this.companionButtons=CompanionUI.draw(this.ctx,this.screen,this.companionView,this.catalogPreview,this.companion,assets.getCatalogState());
            const view=this.companionView;
            if(!view.readAttempted&&view.readVisible)this.companionAction('read');
        } else if (this.state === 'catalog_preview') {
            this.catalogButtons = CatalogUI.draw(this.ctx,this.screen,this.catalogPreview,assets.getCatalogState(),this.companion);
        } else if (this.state === 'menu' || this.state === 'daily_detail' || this.state === 'retention_preview' || this.state==='companion') {
            const heartModel = this.heartView(), heartState = heartModel.state;
            const unlocked = this.progress.unlockedLevel;
            this.menuButtons = UI.drawMenu(this.ctx, this.screen, unlocked, {
                count: heartState ? heartState.count : '—',
                timeLeftText: heartModel.timeLeftText,
                storageReady: !!heartState,
                canPlay: !!heartState && heartState.count > 0,
                canAd: !!heartState && ad.isRewardedAvailable()
            }, { coins: coin.getDisplayCoins(), retentionPreview: this.retentionPreviewEnabled,
                catalogPreview: this.catalogPreviewEnabled,
                companion: this.companion && this.companion.selection,
                coinsReady: this.retention&&this.retention.hasClaimable(),
                storyNew: this.companion&&this.companion.hasUnread(this.catalogPreview),
                companionNew: this.companion&&this.companion.selection&&this.companion.hasUnread(this.catalogPreview,this.companion.selection.id),
                battlePress: this.state === 'menu' && this.menuBattlePress
                    ? (this.screen.reduceEffects ? 1 : Math.sin(Math.PI * this.menuBattlePress.elapsed / 160)) : 0 });
            if(this.state==='companion'){
                this.companionButtons=CompanionUI.draw(this.ctx,this.screen,this.companionView,this.catalogPreview,this.companion,assets.getCatalogState());
            } else if (this.state === 'daily_detail') {
                if(this.retention&&this.daily&&this.daily.retentionPending)this.daily.retentionMessage=
                    this.retentionNotice||'每日任务待同步';
                this.dailyButtons = DailyUI.drawDetail(this.ctx,this.screen,this.daily || {loading:true});
            } else if (this.state === 'retention_preview') {
                this.retentionButtons = RetentionUI.draw(this.ctx,this.screen,this.retentionPreview);
            }
        } else if (this.state === 'daily_playing' && this.dailyBoard) {
            this.dailyBoard.draw();
            this.dailyButtons = DailyUI.drawPlaying(this.ctx,this.screen,this.dailyCore,this.daily.challenge,this.daily);
        } else if (this.state === 'playing' && this.board) {
            this.board.toolAdAvailable = ad.isRealRewardedAvailable();
            this.board.draw();
            this.soloSettingsButton=UI.drawSoloSettingsButton(this.ctx,this.screen);
        } else if(this.state==='solo_settings'&&this.board){
            this.board.draw();
            this.soloSettingsButtons=UI.drawSoloSettings(this.ctx,this.screen,{musicEnabled:AudioFX.isMusicEnabled(),sfxEnabled:AudioFX.isSfxEnabled()});
        } else if (this.state === 'result') {
            if(this.retention&&this.result)this.result.retentionMessage=this.retentionNotice||
                (this.retentionSolo&&this.retentionSolo.validMove?(this.result.win?'每日任务待同步':'结束本局后同步每日任务'):'');
            this.resultButtons = UI.drawResult(this.ctx, this.screen, this.result);
        } else if (this.state === 'shop') {
            const rewardState = coin.getRewardedItemState();
            const heartState = this.readHeartState(false);
            this.shopButtons = UI.drawShop(this.ctx, this.screen, coin.getCoins(), coin.getItems(), {
                canReward: !!rewardState&&ad.isRealRewardedAvailable(),
                count: rewardState&&rewardState.count,
                limit: coin.REWARDED_ITEM_DAILY_LIMIT,
                pending: this.shopRewardPending,
                heartReady: !!heartState,
                heartCount: heartState ? heartState.count : null,
                heartMax: heart.HEART_CONFIG.maxHeart,
                heartPending: this.heartAdPending,
                offset: this.shopOffset
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
                items: this.battle.items, itemRulesVersion: this.battle.itemRulesVersion,
                isHost: this.battle.isHost,
                offline: this.battle.offline, actionPending: this.battle.actionPending,
                pendingAction: this.battle.pendingAction, pollPending: this.battle.pollPending,
                myAvatar: userProfile.getAvatarImage(), oppAvatar: userProfile.getOpponentAvatarImage(this.battle.oppAvatarUrl),
                canChangeAvatar: userProfile.canChangeAvatar(), avatarShared: !!userProfile.getSharedAvatarUrl()
            });
            if(!this.guide&&userProfile.isPromptOpen()){
                this.avatarConsentButtons=UI.drawAvatarConsent(this.ctx,this.screen,userProfile.canChangeAvatar());
                userProfile.ensureButton(this.avatarConsentButtons.confirm,{shareWithRoom:true});
            }else if(!this.guide){
                this.avatarConsentButtons=null;
                userProfile.ensureButton(this.battleButtons.avatar, { shareWithRoom: true });
            }else userProfile.destroyButton();
        } else if (this.state === 'battle_playing' && this.battleBoard && this.battle) {
            const now = this.battleNow();
            this.battleBoard.draw();
            const timeLeft = Math.max(0, Math.ceil((this.battle.endTime - now) / 1000));
            BattleUI.drawTop(this.ctx, this.screen, {
                protocolVersion: this.battle.protocolVersion, roundNumber: this.battle.roundNumber,
                myWins: this.battle.myWins, oppWins: this.battle.oppWins,
                timeLeft: timeLeft,
                myAvatar: userProfile.getAvatarImage(), oppAvatar: userProfile.getOpponentAvatarImage(this.battle.oppAvatarUrl),
                settling: this.battle.itemRulesVersion === 3 && now >= this.battle.endTime && this.battle.scoreCloseAt > this.battle.endTime,
                myScore: this.battle.myScore,
                oppScore: this.battle.oppScore,
                urgent: timeLeft <= 10
            });
            this.battleButtons = BattleUI.drawItems(this.ctx, this.screen, {
                itemRulesVersion: this.battle.itemRulesVersion,
                freeze: this.battle.items.freeze, disturb: this.battle.items.disturb,
                reflect: this.battle.items.reflect, cheer: this.battle.items.cheer,
                pending: this.battle.actionPending || this.battle.offline || now >= this.battle.endTime,
                settling: this.battle.itemRulesVersion === 3 && now >= this.battle.endTime,
                frozen: this.isFrozen(),
                cooldowns: battleItems.cooldownRemaining(this.battle, now),
                sharedCooldown: !this.battle.itemCooldowns
            });
            BattleUI.drawEffects(this.ctx, this.screen, {
                itemRulesVersion: this.battle.itemRulesVersion,
                reflectRemaining: Math.max(0, this.battle.reflectUntil - now),
                cheerRemaining: Math.max(0, this.battle.cheerUntil - now),
                notice: this.battle.itemNotice && this.battle.itemNotice.until > now ? this.battle.itemNotice.text : '',
                frozen: this.isFrozen(),
                frozenRemaining: Math.max(0, this.battle.frozenUntil - now),
                disturb: this.battle.disturbUntil > now,
                disturbRemaining: Math.max(0, this.battle.disturbUntil - now),
                disturbNotice: this.battle.disturbNoticeUntil > now,
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
                myName: this.battle.myName, oppName: this.battle.oppName,
                myAvatar: userProfile.getAvatarImage(), oppAvatar: userProfile.getOpponentAvatarImage(this.battle.oppAvatarUrl),
                myScore: this.battle.myScore,
                oppScore: this.battle.oppScore,
                coinReward: this.battle.coinReward,
                protocolVersion: this.battle.protocolVersion, roundNumber: this.battle.roundNumber,
                myWins: this.battle.myWins, oppWins: this.battle.oppWins,
                myRematch: this.battle.myRematch, oppRematch: this.battle.oppRematch,
                oppLeft: this.battle.oppLeft, oppOnline: this.battle.oppOnline,
                offline: this.battle.offline, expired: this.battle.expired,
                actionPending: this.battle.actionPending, rewardPending: this.battle.rewardPending,
                retentionMessage:this.retention&&(this.retentionNotice||(this.battle.retentionValidMove?'每日任务待同步':''))
            });
        }
        if (this.staminaDialog) {
            const heartModel = this.heartView(), heartState = heartModel.state;
            this.staminaDialogButtons = UI.drawStaminaEmpty(this.ctx, this.screen, {
                timeLeftText: heartModel.timeLeftText,
                storageReady: !!heartState,
                canBuy: !!heartState && heartState.count < heart.HEART_CONFIG.maxHeart && coin.getCoins() >= coin.STAMINA_PRICE,
                canAd: !!heartState && ad.isRewardedAvailable() && !this.heartAdPending,
                staminaPrice: coin.STAMINA_PRICE
            });
        }
        this.guideButtons = this.guide ? OnboardingUI.draw(this.ctx, this.screen, this.guide.key, this.guideContext()) : null;
        if (!this.guide && !/^battle_|^daily_/.test(this.state)) drawAdDiagnostics(this.ctx, this.screen, ad.getDiagnosticLines());
        this.reportHomeFrame();
        this.reportActivationFrame();
    }
}

module.exports = Main;
