'use strict';

// Local, in-memory rematch fixture. It runs the real cloud handler and real
// Main state transitions; it never reads a user save or calls WeChat Cloud.
const assert = require('assert');
const Module = require('module');
const docs = Object.create(null);
let user = '';
let tail = Promise.resolve();
function ref(id) { return {
    get: () => Promise.resolve({ data: docs[id] || null }),
    set: o => { docs[id] = Object.assign({ _id: id }, o.data); return Promise.resolve({}); },
    update: o => { Object.assign(docs[id], o.data); return Promise.resolve({}); }
}; }
const tx = { collection: () => ({ doc: ref }) };
const cloudSdk = {
    DYNAMIC_CURRENT_ENV: 'local', init: () => {}, getWXContext: () => ({ OPENID: user }),
    database: () => ({ command: { lt: v => ({ lt: v }) }, collection: () => ({ where: () => ({ remove: () => Promise.resolve({ stats: { removed: 0 } }) }) }),
        runTransaction: fn => { const result = tail.then(() => fn(tx)); tail = result.catch(() => {}); return result; } })
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloudSdk;
    return originalLoad.call(this, request, parent, isMain);
};
const battle = require('../match3-wechat/cloudfunctions/battle/index');
Module._load = originalLoad;
function call(client, action, data) { user = client; return battle.main(Object.assign({ action: action }, data)); }

function noopContext() {
    const fn = () => {};
    return new Proxy({ canvas: { width: 750, height: 1334 }, measureText: t => ({ width: String(t).length * 10 }), createLinearGradient: () => ({ addColorStop: fn }), createRadialGradient: () => ({ addColorStop: fn }) }, {
        get: (target, key) => key in target ? target[key] : fn, set: () => true
    });
}
const storage = {};
const cloudClient = { init: () => {}, call: ({ name, data }) => Promise.resolve(call(window.__client, name, data)).then(result => ({ result: result })) };
global.window = global;
global.requestAnimationFrame = () => 0;
global.wx = {
    createCanvas: () => ({ width: 375, height: 812, getContext: noopContext }), createImage: () => ({ complete: true, width: 1, height: 1 }),
    getStorageSync: key => storage[key] || '', setStorageSync: (key, value) => { storage[key] = value; }, removeStorageSync: key => { delete storage[key]; },
    getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 812, pixelRatio: 1, safeArea: { top: 24, bottom: 778, left: 0, right: 375 } }),
    getMenuButtonBoundingClientRect: () => ({ bottom: 52, left: 340 }), onTouchStart: () => {}, onTouchMove: () => {}, onTouchEnd: () => {},
    createInnerAudioContext: () => ({ onCanplay: () => {}, onError: () => {}, play: () => {}, stop: () => {}, destroy: () => {} }),
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), cloud: cloudClient, showToast: () => {}, showShareMenu: () => {}, onShareAppMessage: () => {}
};
const cloudPath = require.resolve('../match3-wechat/js/net/cloud-battle');
require.cache[cloudPath] = { id: cloudPath, filename: cloudPath, loaded: true, exports: {
    init: () => {}, isValidRoomId: () => true, call: (action, data) => call(global.__client, action, data), describeCreateFailure: () => 'local'
} };
const Main = require('../match3-wechat/js/main');
const flush = () => new Promise(resolve => setImmediate(resolve));
async function poll(app, id) { app.applyPoll(await call(id, 'query', { roomId: app.battle.roomId, protocolVersion: 2 })); await flush(); }
(async () => {
    global.__client = 'fixture-host'; const host = new Main(); host.startPolling = () => {}; host.startBattle(); await flush();
    const roomId = host.battle.roomId; assert(roomId, 'host must create a v2 room');
    global.__client = 'fixture-guest'; const guest = new Main(); guest.startPolling = () => {}; guest.joinBattle(roomId); await flush();
    global.__client = 'fixture-host'; await poll(host, 'fixture-host'); global.__client = 'fixture-guest'; await poll(guest, 'fixture-guest');
    assert.strictEqual(host.battle.roundNumber, 1, 'first displayed round stays 1 when join advances the stale-request epoch');
    global.__client = 'fixture-host'; host.battleReady(); await flush(); global.__client = 'fixture-guest'; guest.battleReady(); await flush();
    global.__client = 'fixture-host'; await poll(host, 'fixture-host'); global.__client = 'fixture-guest'; await poll(guest, 'fixture-guest');
    assert.strictEqual(docs[roomId].status, 'playing'); assert(host.battleBoard || guest.battleBoard, 'ready must start the real board');
    docs[roomId].startTime = Date.now() - 61000;
    global.__client = 'fixture-host'; await poll(host, 'fixture-host'); global.__client = 'fixture-guest'; await poll(guest, 'fixture-guest');
    assert.strictEqual(host.state, 'battle_result'); assert.strictEqual(guest.state, 'battle_result');
    global.__client = 'fixture-host'; host.battleAgain(); await flush(); host.battleAgain(); await flush(); // explicit cancel
    assert.strictEqual(docs[roomId].players[0].rematchAccepted, false, 'rematch cancel must be explicit');
    host.battleAgain(); await flush(); global.__client = 'fixture-guest'; guest.battleAgain(); await flush();
    assert.strictEqual(docs[roomId].roundId, 3); assert.strictEqual(docs[roomId].status, 'waiting');
    global.__client = 'fixture-host'; await poll(host, 'fixture-host');
    assert.strictEqual(host.battle.roundNumber, 2, 'rematch advances the displayed round once');
    await call('fixture-guest', 'leave', { roomId: roomId, protocolVersion: 2, roundId: 3 });
    assert.strictEqual(docs[roomId].players.length, 1, 'waiting exit must release the seat');
    console.log('rematch runtime fixture: PASS', JSON.stringify({ roomId: roomId, roundId: docs[roomId].roundId }));
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
