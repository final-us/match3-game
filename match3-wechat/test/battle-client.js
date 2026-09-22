'use strict';

// Real Main callbacks with deferred cloud responses; no account, network or real save access.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const mainFile = require.resolve('../js/main');
const mainRequire = require('module').createRequire(mainFile);
const flush = function () { return new Promise(function (resolve) { setImmediate(resolve); }); };

function fixture() {
    const clock = { now: 5000 };
    const requests = [];
    const notices = [];
    const modals = [];
    const receipts = new Set();
    const wallet = { fail: false, balance: 0, addCoins(n) { this.balance += n; },
        creditOnce(id, n) {
            if (this.fail) return { ok: false };
            if (!receipts.has(id)) { receipts.add(id); this.balance += n; }
            return { ok: true };
        } };
    const wx = { showModal: function (options) { modals.push(options); },
        showToast: function (options) { notices.push(options.title); } };
    const cloud = {
        describeCreateFailure: require('../js/net/cloud-battle').describeCreateFailure,
        isValidRoomId: function (id) { return /^R[0-9a-z]{8,10}[0-9a-f]{10}$/.test(id); },
        call: function (action, data) {
            return new Promise(function (resolve, reject) { requests.push({ action, data, resolve, reject }); });
        }
    };
    class Clock extends Date { static now() { return clock.now; } }
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), {
        module,
        Date: Clock,
        setInterval: function () { return 1; },
        clearInterval: function () {},
        wx: wx,
        require: function (name) {
            if (name === './net/cloud-battle') return cloud;
            if (name === './core/coin') return wallet;
            if (name === './audio') return new Proxy({}, { get: function () { return function () {}; } });
            if (name === './core/analytics') return { track: function () {} };
            if (name === './core/runtime') return { applyReadyUpdate: function () { return false; } };
            return mainRequire(name);
        }
    }, { filename: mainFile });
    const app = Object.create(module.exports.prototype);
    Object.assign(app, { state: 'menu', battle: null, battleCreating: false, pollTimer: null,
        lastScoreSync: 0, effectSeen: 0, castSeen: 0, guide: null, guideQueue: [] });
    app.showGuide = function () {};
    app.showBattleNotice = function (message) { notices.push(message); };
    app.shareBattleInvite = function () {};
    function playing() {
        const b = app.battle = app.newBattleState(true);
        b.roomId = 'R12345678abcdef0123';
        b.startTime = 1000; b.endTime = 61000;
        app.state = 'battle_playing';
        app.battleCore = { score: 1000, minMatchCount: 3 };
        app.battleBoard = { onTouchStart: function () {}, onTouchMove: function () {}, onTouchEnd: function () {} };
        return b;
    }
    return { app, clock, requests, notices, modals, wx, playing, wallet };
}

(async function () {
    const unhandled = [];
    const onUnhandled = function (error) { unhandled.push(error); };
    process.on('unhandledRejection', onUnhandled);
    try {
        {
            const f = fixture();
            f.app.startBattle();
            f.requests[0].reject({ errCode: -501000, errMsg: 'permission denied openid=PRIVATE' });
            await flush();
            assert.strictEqual(f.app.battle, null);
            assert.strictEqual(f.app.battleCreating, false);
            assert.strictEqual(f.app.state, 'menu');
            assert.strictEqual(f.modals.length, 1);
            assert(f.modals[0].content.includes('D1/CALL/-501000/PERMISSION'));
            assert(!f.modals[0].content.includes('PRIVATE'));
            assert.strictEqual(f.modals[0].showCancel, false);
            f.modals[0].fail();
            assert(f.notices[0].includes('D1/CALL/'));
            f.app.startBattle();
            f.requests[1].resolve({ ok: true, roomId: 'R12345678abcdef0123' });
            await flush();
            assert.strictEqual(f.app.state, 'battle_wait', '失败后仍可重试建房');
            assert.strictEqual(f.modals.length, 1, '成功不弹诊断');
        }
        for (const result of [{ ok: false, err: '身份校验失败' }, { ok: false, err: '服务异常' }, {}]) {
            const f = fixture();
            f.app.startBattle(); f.requests[0].resolve(result);
            await flush();
            assert.strictEqual(f.modals.length, 1);
            assert(f.modals[0].content.includes('D1/SERVER/'));
            assert.strictEqual(f.app.battleCreating, false);
        }
        {
            const f = fixture();
            f.app.startBattle(); f.requests[0].resolve({ ok: false, err: '创建太频繁，请稍后再试' });
            await flush();
            assert.strictEqual(f.modals.length, 0, '限流保留原有提示');
            assert.strictEqual(f.notices[0], '创建太频繁，请稍后再试');
        }
        {
            const f = fixture();
            f.wx.showModal = function () { throw new Error('modal unavailable'); };
            f.app.startBattle(); f.requests[0].reject({ errCode: -1 });
            await flush();
            assert.strictEqual(f.notices.length, 1, '弹窗不可用时降级提示');
            assert(f.notices[0].includes('D1/CALL/-1/'));
        }
        {
            const f = fixture();
            f.app.startBattle(); f.app.battleCancel();
            f.requests[0].reject({ errCode: -1 });
            await flush();
            assert.strictEqual(f.modals.length, 0, '取消后迟到失败不弹窗');
        }
        {
            const f = fixture();
            f.app.state = 'playing';
            f.app.core = { resumeTimer: function () {} };
            f.app.handleShow({ query: { invite: '1', roomId: 'R12345678abcdef0123' } });
            assert.strictEqual(f.requests.length, 0, '单人进行中不得被分享邀请切走');
            assert.strictEqual(f.app.state, 'playing');
            assert.strictEqual(f.notices.length, 1, '保留当前局时应说明如何再加入邀请');
        }
        {
            const f = fixture(), b = f.playing();
            f.app.updateBattle(f.clock.now);
            f.requests[0].reject(new Error('offline'));
            await flush();
            assert.strictEqual(b.syncedScore, 0, '未成功同步不得把本地分数标为已确认');
            f.clock.now += 801;
            f.app.updateBattle(f.clock.now);
            assert.strictEqual(f.requests.length, 2, '网络失败应在下一节流窗口重试');
            f.requests[1].resolve({ ok: false, err: '服务异常' });
            await flush();
            f.clock.now += 801;
            f.app.updateBattle(f.clock.now);
            assert.strictEqual(f.requests.length, 3, '服务端拒绝不能被当成确认');
            f.requests[2].resolve({ ok: true });
            await flush();
            assert.strictEqual(b.syncedScore, 1000);
            f.clock.now = 60500; f.app.battleCore.score = 1100;
            f.app.updateBattle(f.clock.now);
            f.requests[3].resolve({ ok: true });
            await flush();
            f.clock.now = 60700; f.app.battleCore.score = 1200;
            f.app.updateBattle(f.clock.now);
            assert.strictEqual(f.requests.length, 5, '最后800ms的新分数不得等待完整节流窗口');
            f.requests[4].resolve({ ok: true });
            await flush();
            f.clock.now = 61000; f.app.battleCore.score = 1400;
            f.app.updateBattle(f.clock.now);
            assert.strictEqual(f.requests.length, 5, '截止时间之后不再提交新增分数');
            assert.strictEqual(b.myScore, 1200, '截止后连锁动画不得增加显示分数');
            f.app.battleBoard.onTouchStart = f.app.battleBoard.onTouchMove = function () { throw new Error('late input'); };
            f.app.handleTouchStart({ touches: [{ clientX: 10, clientY: 10 }] });
            f.app.handleTouchMove({ touches: [{ clientX: 30, clientY: 10 }] });
            f.app.battleUseItem('freeze');
            assert.strictEqual(f.requests.length, 5, '截止之后不发送道具请求');
        }
        {
            const f = fixture(); f.playing();
            f.clock.now = 60500;
            f.app.updateBattle(f.clock.now);
            f.requests[0].reject(new Error('offline near deadline'));
            await flush();
            for (let i = 0; i < 10; i++) {
                f.clock.now += 16;
                f.app.updateBattle(f.clock.now);
            }
            assert.strictEqual(f.requests.length, 1, '临近截止的相同失败分数仍须节流，不可每帧重试');
        }
        {
            const f = fixture(), b = f.playing();
            f.app.pollRoom(); f.app.pollRoom();
            assert.strictEqual(f.requests.length, 1, '同房间查询不得并发乱序');
            const newer = f.app.battle = f.app.newBattleState(false);
            newer.roomId = 'R87654321abcdef0123';
            f.app.state = 'battle_wait';
            f.requests[0].resolve({ ok: true, status: 'playing', startTime: 2000, opp: { score: 9999 } });
            await flush();
            assert.strictEqual(f.app.battle, newer);
            assert.strictEqual(newer.oppScore, 0, '旧房间轮询不得污染新房间');
            assert.strictEqual(f.app.state, 'battle_wait');
            f.app.battle = b; b.completedTracked = true; f.app.state = 'battle_result';
            f.app.applyPoll({ ok: true, status: 'playing', startTime: 1000 });
            assert.strictEqual(f.app.state, 'battle_result', '已结算不可被迟到playing响应重开');
        }
        for (const action of ['battleReady', 'battleAdjustItem', 'battleUseItem']) {
            const f = fixture(); f.playing();
            if (action !== 'battleUseItem') f.app.state = 'battle_wait';
            f.app.pollRoom();
            f.app[action]('freeze', 1); f.app[action]('freeze', 1);
            assert.strictEqual(f.requests.length, 2, action + '应防止重复在途操作');
            f.requests[1].resolve({ ok: true, ready: true, items: { freeze: 0, disturb: 3 } });
            await flush();
            f.requests[0].resolve({ ok: true, status: 'waiting', myReady: false, myItems: { freeze: 1, disturb: 2 } });
            await flush();
            assert.strictEqual(f.app.battle.items.freeze, 0, action + '之前的旧轮询不得回滚道具');
        }
        for (const action of ['battleReady', 'battleAdjustItem', 'battleUseItem']) {
            const f = fixture(); f.playing();
            if (action !== 'battleUseItem') f.app.state = 'battle_wait';
            f.app[action]('freeze', 1);
            f.app.battleCancel();
            const newer = f.app.battle = f.app.newBattleState(false);
            f.requests[0].resolve({ ok: true, ready: true, items: { freeze: 0, disturb: 3 } });
            f.requests[1].reject(new Error('leave offline'));
            await flush();
            assert.strictEqual(newer.myReady, false);
            assert.strictEqual(newer.items.freeze, 1, action + '旧回调不得改动下一房间');
        }
        {
            const f = fixture(); f.playing();
            f.app.battleCancel();
            f.requests[0].reject(new Error('leave offline'));
            await flush();
            assert.strictEqual(f.app.state, 'menu');
            assert.strictEqual(f.notices.length, 1, '离线退出应明确提醒旧房间尚未同步');
        }
        for (const action of ['startBattle', 'joinBattle']) {
            const f = fixture();
            f.app[action]('R12345678abcdef0123');
            f.app[action]('R12345678abcdef0123');
            assert.strictEqual(f.requests.length, 1, action + '不得重复建房/加入');
            f.app.battleCancel();
            f.requests[0].resolve({ ok: true, roomId: 'R12345678abcdef0123' });
            await flush();
            assert.strictEqual(f.app.battle, null, action + '取消后不得重新进入旧房间');
            assert.strictEqual(f.app.state, 'menu');
        }
        {
            const f = fixture(); f.app.startBattle();
            assert.strictEqual(f.requests[0].data.protocolVersion, 2);
            f.requests[0].resolve({ok:true, roomId:'R12345678abcdef0123',protocolVersion:2,roundId:3});
            await flush();
            assert.strictEqual(f.app.battle.roundId,3);
            f.app.battleReady();
            assert.strictEqual(f.requests[1].data.roundId,3);
            assert.strictEqual(f.requests[1].data.ready,true);
        }
        {
            const f = fixture(), b = f.playing(); b.protocolVersion=2; b.roundId=1;
            const finished = {ok:true,protocolVersion:2,roundId:1,status:'finished',myWins:1,oppWins:0,
                opp:{nickname:'好友',score:900,online:true},canRematch:true,
                result:{result:'win',myScore:1000,oppScore:900,roundId:1,settlementId:'stable-1',coinReward:150}};
            f.app.applyPoll(finished); f.app.applyPoll(finished);
            assert.strictEqual(f.wallet.balance,150,'重复结算不能重复入账');
            assert.strictEqual(f.app.state,'battle_result');
            f.app.pollRoom();
            assert.strictEqual(f.requests.length,1,'v2结算继续轮询');
            f.requests[0].resolve({...finished,oppRematch:true}); await flush();
            assert.strictEqual(b.oppRematch,true);
            f.app.battleAgain(); f.app.battleAgain();
            assert.strictEqual(f.requests.length,2,'确认请求防重复');
            assert.strictEqual(f.requests[1].data.accept,true);
            f.requests[1].resolve({...finished,myRematch:true}); await flush();
            f.app.battleAgain();
            assert.strictEqual(f.requests[2].data.accept,false,'等待时可以取消');
            f.requests[2].resolve({...finished,myRematch:false}); await flush();
            b.frozenUntil=99999; b.disturbUntil=99999; b.inputClosed=true;
            f.app.effectSeen=3; f.app.castSeen=2;
            f.app.applyPoll({...finished,status:'waiting',roundId:2,result:null,myRematch:false,oppRematch:false,
                myReady:false,myItems:{freeze:1,disturb:2},effects:[],casts:[]});
            const next=f.app.battle;
            assert.notStrictEqual(next,b,'新局换对象，隔离旧回调');
            assert.strictEqual(next.roundId,2); assert.strictEqual(next.myWins,1);
            assert.strictEqual(next.myScore,0); assert.strictEqual(next.frozenUntil,0);
            assert.strictEqual(next.disturbUntil,0); assert.strictEqual(next.inputClosed,false);
            assert.strictEqual(f.app.battleCore,null); assert.strictEqual(f.app.effectSeen,0);
            f.app.applyPoll(finished);
            assert.strictEqual(f.app.state,'battle_wait','旧局结果不得覆盖新局');
            assert.strictEqual(f.wallet.balance,150);
        }
        {
            const f=fixture(),b=f.playing(); b.protocolVersion=2;
            f.app.battleUseItem('freeze');
            assert.strictEqual(f.requests[0].data.roundId,1);
            f.app.applyPoll({ok:true,protocolVersion:2,roundId:2,status:'waiting',myWins:1,oppWins:0});
            f.requests[0].resolve({ok:true,items:{freeze:0,disturb:0},activeEffectUntil:99999});
            await flush();
            assert.strictEqual(f.app.battle.items.freeze,1,'迟到道具回调不得污染第二局');
            assert.strictEqual(f.app.battle.activeEffectUntil,0);
        }
        {
            const f=fixture(),b=f.playing(); b.protocolVersion=2; f.wallet.fail=true;
            f.app.applyPoll({ok:true,protocolVersion:2,roundId:1,status:'finished',myWins:1,oppWins:0,
                result:{result:'win',myScore:1000,oppScore:900,roundId:1,settlementId:'storage-1',coinReward:150}});
            assert.strictEqual(b.rewardPending,true); assert.strictEqual(b.coinReward,0);
            f.app.battleBackToMenu(); assert.strictEqual(f.app.state,'battle_result','奖励保存失败不默默丢失');
            f.app.battleCancel(); assert.strictEqual(f.app.battle,b,'所有退出路径保留未持久化凭证');
            assert.strictEqual(f.requests.length,0);
            f.wallet.fail=false; assert.strictEqual(f.app.creditBattleReward(),true);
            assert.strictEqual(b.rewardPending,false); assert.strictEqual(f.wallet.balance,150);
            f.app.creditBattleReward(); assert.strictEqual(f.wallet.balance,150);
            f.app.pollRoom(); f.requests[0].reject(new Error('offline')); await flush();
            assert.strictEqual(b.offline,true);
            f.app.battleAgain(); assert.strictEqual(f.requests[1].action,'query','离线先同步，不猜确认状态');
            f.requests[1].resolve({ok:false,err:'续局已失效'}); await flush();
            assert.strictEqual(b.expired,true); assert.strictEqual(f.app.state,'battle_result','过期保留本局结果');
            f.app.battleAgain();
            assert.strictEqual(f.requests[2].action,'leave');
            assert.strictEqual(f.requests[2].data.roundId,1);
            assert.strictEqual(f.requests[3].action,'create','失效房间可重新邀请');
        }
        assert.strictEqual(unhandled.length, 0, '网络失败不得产生未处理拒绝');
        console.log('battle client lifecycle tests passed');
    } finally {
        process.removeListener('unhandledRejection', onUnhandled);
    }
})().catch(function (error) { console.error(error); process.exitCode = 1; });
