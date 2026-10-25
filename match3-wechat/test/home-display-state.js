'use strict';
// Real Main + UI + wallet/heart/reward modules; in-memory storage and synthetic Canvas.
// This checks display freshness and transaction recovery, not device timing or pixels.
const assert = require('assert');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const noop = () => {};
let now = Date.UTC(2026, 9, 23, 0), disk, reads = 0, writes = 0, fault, readFault;
const realNow = Date.now;
Date.now = () => now;
const ctx = new Proxy({
    measureText: text => ({ width: String(text).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }), getLineDash: () => []
}, { get: (target, key) => key in target ? target[key] : noop });
global.requestAnimationFrame = noop;
global.wx = {
    createCanvas: () => ({ width: 390, height: 844, getContext: () => ctx }),
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2 }),
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }),
    getStorageSync(key) { reads++; if (key === readFault) throw Error('read_failure'); return key in disk ? clone(disk[key]) : ''; },
    setStorageSync(key, value) {
        writes++;
        const mode = fault && fault(key, value);
        if (mode === 'before') throw Error('write_before');
        disk[key] = clone(value);
        if (mode === 'after') throw Error('write_after');
    },
    removeStorageSync(key) { delete disk[key]; },
    onTouchStart: noop, onTouchMove: noop, onTouchEnd: noop, onTouchCancel: noop,
    onShow: noop, onHide: noop, showToast: noop, showShareMenu: noop,
    request() { throw Error('network forbidden'); }
};
const Main = require('../js/main'), coin = require('../js/core/coin'), heart = require('../js/core/heart');
const rewards = require('../js/core/ad-rewards'), UI = require('../js/render/ui');
let displayed;
const drawMenu = UI.drawMenu;
UI.drawMenu = function (ctx, screen, level, hearts, economy) {
    displayed = { hearts: clone(hearts), coins: economy.coins };
    return drawMenu.apply(this, arguments);
};
function setup() {
    fault = readFault = null;
    disk = { match3_coin_v1: 3000, match3_items_v1: { hammer: 1, bomb: 1, color: 1 },
        match3_heart_v1: { count: 3, lastLossTime: now, refundPending: false },
        match3_music_enabled_v1: false, match3_sfx_enabled_v1: false };
    const app = new Main({ retentionSample: true, catalogSample: true });
    app.render(); reads = writes = 0;
    return app;
}
function expectDisplay(app, count, balance) {
    app.render();
    assert.strictEqual(displayed.hearts.count, count);
    assert.strictEqual(displayed.coins, balance);
}
function failOnce(key, timing, occurrence = 1) {
    let seen = 0;
    fault = current => current === key && ++seen === occurrence ? timing : null;
}
try {
    let app = setup();
    const buttons = clone(app.menuButtons);
    for (let i = 0; i < 60; i++) { now += 16; app.render(); }
    assert.strictEqual(reads, 0, 'steady home frames must not read storage');
    assert.strictEqual(writes, 0, 'steady home frames must not write storage');
    assert.deepStrictEqual(app.menuButtons, buttons, 'hit regions remain stable');
    assert.strictEqual(displayed.hearts.timeLeftText, '10:00');
    now += 40; app.render();
    assert.strictEqual(displayed.hearts.timeLeftText, '09:59', 'countdown advances without disk reads');
    assert.strictEqual(reads, 0);
    now = disk.match3_heart_v1.lastLossTime + heart.HEART_CONFIG.regenMs;
    expectDisplay(app, 4, 3000);
    assert.strictEqual(disk.match3_heart_v1.count, 4, 'deadline recovery persists');
    now += heart.HEART_CONFIG.regenMs * 10;
    expectDisplay(app, 5, 3000);
    assert.strictEqual(displayed.hearts.timeLeftText, '00:00');
    assert(heart.consumeHeart(true)); expectDisplay(app, 4, 3000);
    assert(heart.refundConsumedHeart()); expectDisplay(app, 5, 3000);
    assert.strictEqual(heart.refundConsumedHeart(), false);
    heart.consumeHeart(); heart.consumeHeart(); expectDisplay(app, 3, 3000);
    app.buyHeart(); expectDisplay(app, 4, 2000);
    coin.addCoins(100); expectDisplay(app, 4, 2100);
    app.buyItem('hammer'); expectDisplay(app, 4, 1200);

    // Warm display snapshots before interruption: rendering must recover, not show the old balance.
    for (const [key, occurrence] of [['match3_coin_pending_credit_v1', 1], ['match3_coin_v1', 1],
        ['match3_coin_receipts_v1', 1], ['match3_coin_pending_credit_v1', 2]]) {
        for (const timing of ['before', 'after']) {
            app = setup(); failOnce(key, timing, occurrence);
            assert.strictEqual(coin.creditOnce('display-receipt', 150).ok, false);
            fault = null;
            const uncommitted = key === 'match3_coin_pending_credit_v1' && occurrence === 1 && timing === 'before';
            expectDisplay(app, 3, uncommitted ? 3000 : 3150);
            assert(coin.creditOnce('display-receipt', 150).ok);
            expectDisplay(app, 3, 3150);
            assert.strictEqual(coin.creditOnce('display-receipt', 150).credited, false);
            expectDisplay(app, 3, 3150);
        }
    }
    for (const timing of ['before', 'after']) {
        app = setup(); failOnce('match3_items_v1', timing);
        assert.strictEqual(coin.creditRewardOnce('retention-display', { coins: 100, items: { hammer: 1 } }).ok, false);
        fault = null; expectDisplay(app, 3, 3100);
        assert.strictEqual(coin.getItems().hammer, 2);
        assert.strictEqual(coin.creditRewardOnce('retention-display', { coins: 100, items: { hammer: 1 } }).credited, false);
        expectDisplay(app, 3, 3100);

        app = setup(); const claim = rewards.createClaim('heart_refill').claim;
        failOnce('match3_heart_v1', timing);
        assert.strictEqual(rewards.complete(claim).ok, false);
        fault = null;
        app.handleHide(); app.handleShow({}); expectDisplay(app, 4, 3000);
        assert.strictEqual(rewards.complete(claim).granted, false);
        expectDisplay(app, 4, 3000);
    }
    // A persistent storage fault remains visible; failed snapshots are not cached.
    app = setup(); readFault = 'match3_heart_v1'; heart.invalidateDisplayState();
    app.render(); assert.strictEqual(displayed.hearts.storageReady, false);
    readFault = null; expectDisplay(app, 3, 3000);
    failOnce('match3_coin_receipts_v1', 'before');
    assert.strictEqual(coin.creditOnce('retry-display', 50).ok, false);
    fault = () => 'before'; app.render(); assert.strictEqual(displayed.coins, null);
    fault = null; expectDisplay(app, 3, 3050);

    // Foreground refresh handles changed persistence and elapsed time before the next draw.
    app = setup(); app.handleHide();
    disk.match3_coin_v1 = 4321;
    disk.match3_heart_v1 = { count: 1, lastLossTime: now - 2 * heart.HEART_CONFIG.regenMs };
    app.handleShow({}); expectDisplay(app, 3, 4321);
    // onShow may exit early during an ad; it still invalidates snapshots.
    app.adFlow = true; disk.match3_coin_v1 = 4444; app.handleShow({}); app.adFlow = false;
    expectDisplay(app, 3, 4444);

    app = setup(); now -= 1000; app.render();
    assert(reads > 0, 'clock rollback rechecks heart persistence');
    wx.getMenuButtonBoundingClientRect=()=>({top:55,bottom:87,left:293,right:380,width:87,height:32});
    app=setup();
    assert.deepStrictEqual(app.screen.menuButtonRect,{x:293,y:55,w:87,h:32});
    assert.strictEqual(app.screen.contentTop,91,'native measurement does not change HUD safe-area semantics');
    app.startGame(16);app.guide=null;app.guideQueue=[];app.render();
    const settings=app.soloSettingsButton;
    app.handleTouchStart({touches:[{clientX:settings.x+settings.w/2,clientY:settings.y+settings.h/2}]});
    assert.strictEqual(app.state,'solo_settings','real Main opens settings through the rendered hit area');
    assert(app.core.timerPaused);
    wx.getMenuButtonBoundingClientRect=()=>({top:55,bottom:87,left:NaN,right:380});
    assert.strictEqual(setup().screen.menuButtonRect,null,'invalid platform rectangle is not trusted');
    wx.getMenuButtonBoundingClientRect=()=>{throw Error('native measurement unavailable');};
    assert.strictEqual(setup().screen.menuButtonRect,null);
    delete wx.getMenuButtonBoundingClientRect;
    console.log('PASS home display: 60 steady frames = 0 reads / 0 writes; countdown, regen, spend/refund, purchases, receipt WAL failures, mixed rewards, ad recovery, errors and foreground freshness');
} finally { Date.now = realNow; UI.drawMenu = drawMenu; }
