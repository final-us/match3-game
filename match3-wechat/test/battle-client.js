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
    const cloud = {
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
        wx: {},
        require: function (name) {
            if (name === './net/cloud-battle') return cloud;
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
    return { app, clock, requests, notices, playing };
}

(async function () {
    const unhandled = [];
    const onUnhandled = function (error) { unhandled.push(error); };
    process.on('unhandledRejection', onUnhandled);
    try {
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
        assert.strictEqual(unhandled.length, 0, '网络失败不得产生未处理拒绝');
        console.log('battle client lifecycle tests passed');
    } finally {
        process.removeListener('unhandledRejection', onUnhandled);
    }
})().catch(function (error) { console.error(error); process.exitCode = 1; });
