'use strict';

/** 音频管理器回归测试：Node mock WebAudio、timer 与微信生命周期 API。 */

const assert = require('assert');
const AUDIO_MODULE = require.resolve('../js/audio');

function makeTimers() {
    let nextId = 1;
    const active = new Map();
    return {
        active: active,
        setTimeout: function (fn, delay) {
            const id = nextId++;
            active.set(id, { fn: fn, delay: delay });
            return id;
        },
        clearTimeout: function (id) {
            active.delete(id);
        }
    };
}

function makeContext() {
    function param() {
        return {
            setValueAtTime: function () {},
            linearRampToValueAtTime: function () {},
            exponentialRampToValueAtTime: function () {}
        };
    }
    return {
        state: 'running',
        currentTime: 0,
        destination: {},
        oscillatorCount: 0,
        createOscillator: function () {
            this.oscillatorCount++;
            return {
                frequency: param(),
                connect: function () {},
                start: function () {},
                stop: function () {}
            };
        },
        createGain: function () {
            return { gain: param(), connect: function () {} };
        },
        createBuffer: function () {
            throw new Error('BGM 不应创建噪声 buffer');
        },
        resume: function () {
            this.state = 'running';
        }
    };
}

function makeWx(storage) {
    const context = makeContext();
    const handlers = { hide: [], show: [], begin: [], end: [] };
    return {
        getStorageSync: function (key) { return storage[key]; },
        setStorageSync: function (key, value) { storage[key] = value; },
        createWebAudioContext: function () { return context; },
        onHide: function (fn) { handlers.hide.push(fn); },
        onShow: function (fn) { handlers.show.push(fn); },
        onAudioInterruptionBegin: function (fn) { handlers.begin.push(fn); },
        onAudioInterruptionEnd: function (fn) { handlers.end.push(fn); },
        _context: context,
        _handlers: handlers
    };
}

function withAudio(storage, fn) {
    const oldWx = global.wx;
    const oldSetTimeout = global.setTimeout;
    const oldClearTimeout = global.clearTimeout;
    const timers = makeTimers();
    const wx = makeWx(storage);
    global.wx = wx;
    global.setTimeout = timers.setTimeout;
    global.clearTimeout = timers.clearTimeout;
    delete require.cache[AUDIO_MODULE];
    const audio = require('../js/audio');
    try {
        fn(audio, wx, timers);
    } finally {
        audio.setMusicEnabled(false);
        assert.strictEqual(timers.active.size, 0, '测试结束仍有音频 timer');
        delete require.cache[AUDIO_MODULE];
        if (oldWx === undefined) delete global.wx; else global.wx = oldWx;
        global.setTimeout = oldSetTimeout;
        global.clearTimeout = oldClearTimeout;
    }
}

let allOk = true;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
    } catch (e) {
        allOk = false;
        console.log('❌ ' + name + ' → ' + e.message);
    }
}

test('独立存储与旧总开关兼容', function () {
    withAudio({ match3_music_enabled_v1: false, match3_sfx_enabled_v1: true }, function (audio, wx) {
        audio.init();
        assert.strictEqual(typeof audio.unlock, 'function');
        assert.strictEqual(audio.isMusicEnabled(), false);
        assert.strictEqual(audio.isSfxEnabled(), true);
        audio.setEnabled(false);
        assert.strictEqual(audio.isSfxEnabled(), false);
        assert.strictEqual(audio.isMusicEnabled(), false);
        assert.strictEqual(wx.getStorageSync('match3_sfx_enabled_v1'), false);
    });
});

test('旧键迁移且保留关闭偏好', function () {
    withAudio({ match3_audio_enabled_v1: false }, function (audio, wx) {
        audio.init();
        assert.strictEqual(audio.isMusicEnabled(), false);
        assert.strictEqual(audio.isSfxEnabled(), false);
        assert.strictEqual(wx.getStorageSync('match3_music_enabled_v1'), false);
        assert.strictEqual(wx.getStorageSync('match3_sfx_enabled_v1'), false);
    });
});

test('相同 scene 去重，切场景停止旧 timer', function () {
    withAudio({}, function (audio, wx, timers) {
        audio.init();
        audio.setScene('calm');
        const calmIds = Array.from(timers.active.keys());
        assert.strictEqual(calmIds.length, 1);
        audio.setScene('calm');
        assert.deepStrictEqual(Array.from(timers.active.keys()), calmIds);
        audio.setScene('battle');
        assert.strictEqual(timers.active.size, 1);
        assert.strictEqual(timers.active.has(calmIds[0]), false);
        assert.strictEqual(audio.getScene(), 'battle');
        assert(wx._context.oscillatorCount > 0);
    });
});

test('禁用音乐时不调度，重新开启可恢复', function () {
    withAudio({}, function (audio, wx, timers) {
        audio.init();
        audio.setMusicEnabled(false);
        audio.setScene('battle');
        assert.strictEqual(timers.active.size, 0);
        audio.setMusicEnabled(true);
        assert.strictEqual(timers.active.size, 1);
        audio.setMusicEnabled(false);
        assert.strictEqual(timers.active.size, 0);
    });
});

test('重复 init 不重复注册，隐藏/恢复与中断/恢复遵从设置', function () {
    withAudio({}, function (audio, wx, timers) {
        audio.init();
        audio.init();
        assert.strictEqual(wx._handlers.hide.length, 1);
        assert.strictEqual(wx._handlers.show.length, 1);
        assert.strictEqual(wx._handlers.begin.length, 1);
        assert.strictEqual(wx._handlers.end.length, 1);

        audio.setScene('battle');
        assert.strictEqual(timers.active.size, 1);
        wx._handlers.hide[0]();
        assert.strictEqual(timers.active.size, 0);
        wx._handlers.show[0]();
        assert.strictEqual(timers.active.size, 1);
        wx._handlers.begin[0]();
        assert.strictEqual(timers.active.size, 0);
        wx._handlers.end[0]();
        assert.strictEqual(timers.active.size, 1);
        audio.setMusicEnabled(false);
        wx._handlers.show[0]();
        assert.strictEqual(timers.active.size, 0);
    });
});

console.log('========================================');
console.log('音频回归: ' + (allOk ? '全部通过 ✅' : '存在失败 ❌'));
process.exit(allOk ? 0 : 1);
