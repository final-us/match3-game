'use strict';

/** 音频管理器回归：本地 BGM、WebAudio 回退、设置与微信生命周期。 */

const assert = require('assert');
const AUDIO_MODULE = require.resolve('../js/audio');
const SFX_SPRITE = require('../js/sfx-acoustic-map');

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
        clearTimeout: function (id) { active.delete(id); },
        run: function (id) {
            const timer = active.get(id);
            if (!timer) return;
            active.delete(id);
            timer.fn();
        }
    };
}

function makeContext(options) {
    options = options || {};
    function param(values) {
        return {
            setValueAtTime: function (value) { if (values) values.push(value); },
            linearRampToValueAtTime: function () {},
            exponentialRampToValueAtTime: function () {}
        };
    }
    const context = {
        state: 'running',
        currentTime: 0,
        sampleRate: 22050,
        destination: {},
        oscillatorCount: 0,
        bufferCount: 0,
        bufferSourceCount: 0,
        decodeCount: 0,
        sourceStarts: [],
        gainValues: [],
        createOscillator: function () {
            this.oscillatorCount++;
            return {
                frequency: param(),
                connect: function () {},
                start: function () {},
                stop: function () {},
                onended: null
            };
        },
        createGain: function () {
            return {
                gain: param(this.gainValues),
                connect: function () {}
            };
        },
        createBuffer: function (channels, count) {
            this.bufferCount++;
            const data = new Float32Array(count);
            return { getChannelData: function () { return data; } };
        },
        createBufferSource: function () {
            this.bufferSourceCount++;
            const owner = this;
            return {
                connect: function () {},
                start: function (when, offset, duration) {
                    owner.sourceStarts.push({ when: when, offset: offset, duration: duration });
                    if (options.autoEnd && this.onended) this.onended();
                },
                onended: null,
                buffer: null
            };
        },
        createBiquadFilter: function () {
            return {
                frequency: param(),
                Q: { value: 0 },
                connect: function () {}
            };
        },
        resume: function () { this.state = 'running'; },
        decodeAudioData: function (data, success, fail) {
            this.decodeCount++;
            if (options.sprite === 'decode-fail') fail(new Error('decode failed'));
            else success({ duration: 10.797, _decoded: data });
        }
    };
    return context;
}

function makeInnerAudio() {
    const handlers = { error: [] };
    return {
        src: '',
        loop: false,
        autoplay: true,
        volume: 1,
        obeyMuteSwitch: false,
        playCount: 0,
        pauseCount: 0,
        play: function () { this.playCount++; },
        pause: function () { this.pauseCount++; },
        onError: function (fn) { handlers.error.push(fn); },
        _handlers: handlers
    };
}

function makeWx(storage, options) {
    options = options || {};
    const context = makeContext(options);
    const inner = makeInnerAudio();
    const handlers = { hide: [], show: [], begin: [], end: [] };
    const wx = {
        getStorageSync: function (key) { return storage[key]; },
        setStorageSync: function (key, value) { storage[key] = value; },
        createWebAudioContext: function () { return context; },
        onHide: function (fn) { handlers.hide.push(fn); },
        onShow: function (fn) { handlers.show.push(fn); },
        onAudioInterruptionBegin: function (fn) { handlers.begin.push(fn); },
        onAudioInterruptionEnd: function (fn) { handlers.end.push(fn); },
        _context: context,
        _inner: inner,
        _handlers: handlers,
        _innerCreateCount: 0,
        _spriteReadCount: 0
    };
    if (options.innerAudio !== false) {
        wx.createInnerAudioContext = function () {
            wx._innerCreateCount++;
            return inner;
        };
    }
    if (options.sprite) {
        wx.getFileSystemManager = function () {
            return {
                readFile: function (request) {
                    wx._spriteReadCount++;
                    if (options.sprite === 'read-fail') request.fail(new Error('read failed'));
                    else request.success({ data: new ArrayBuffer(32) });
                }
            };
        };
    }
    return wx;
}

function withAudio(storage, options, fn) {
    if (typeof options === 'function') {
        fn = options;
        options = {};
    }
    const oldWx = global.wx;
    const oldSetTimeout = global.setTimeout;
    const oldClearTimeout = global.clearTimeout;
    const timers = makeTimers();
    const wx = makeWx(storage, options);
    global.wx = wx;
    global.setTimeout = timers.setTimeout;
    global.clearTimeout = timers.clearTimeout;
    delete require.cache[AUDIO_MODULE];
    const audio = require('../js/audio');
    try {
        fn(audio, wx, timers);
    } finally {
        audio.setMusicEnabled(false);
        assert.strictEqual(timers.active.size, 0, '测试结束仍有程序化 BGM timer');
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

test('音频精灵映射包含 22 个合法且不越界的 cue', function () {
    const cues = Object.keys(SFX_SPRITE.cues);
    assert.strictEqual(cues.length, 22);
    assert.deepStrictEqual(cues.slice(0, 3), ['click1', 'click2', 'click3']);
    assert(Math.abs(SFX_SPRITE.cues.specialCombo.duration - 0.872) < 0.001,
        '特殊组合 cue 时长应为 V7 短版 0.872s');
    cues.forEach(function (name) {
        const cue = SFX_SPRITE.cues[name];
        assert(cue.offset >= 0 && cue.duration > 0, name + ' cue 参数无效');
        assert(cue.offset + cue.duration <= 10.797, name + ' cue 超出精灵时长');
    });
});

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

test('首次触摸后复用本地 BGM context 并切换 calm/battle', function () {
    withAudio({}, function (audio, wx, timers) {
        audio.init();
        assert.strictEqual(wx._inner.playCount, 0, '未触摸前不得自动播放');
        audio.setScene('calm');
        assert.strictEqual(wx._inner.playCount, 0, '仅切场景不得绕过解锁');
        audio.unlock();
        assert.strictEqual(wx._innerCreateCount, 1);
        assert.strictEqual(wx._inner.src, 'res/audio/calm.m4a');
        assert.strictEqual(wx._inner.loop, true);
        assert.strictEqual(wx._inner.playCount, 1);
        assert.strictEqual(timers.active.size, 0, '本地 BGM 不应启动回退 timer');
        audio.setScene('calm');
        assert.strictEqual(wx._inner.playCount, 1, '相同 scene 必须去重');
        audio.setScene('battle');
        assert.strictEqual(wx._innerCreateCount, 1, '切场景不得重复创建播放器');
        assert.strictEqual(wx._inner.src, 'res/audio/battle.m4a');
        assert.strictEqual(wx._inner.playCount, 2);
        assert(wx._inner.pauseCount >= 1);
    });
});

test('音乐独立禁用和恢复控制本地 BGM', function () {
    withAudio({}, function (audio, wx) {
        audio.init();
        audio.unlock();
        audio.setMusicEnabled(false);
        const pauses = wx._inner.pauseCount;
        audio.setScene('battle');
        assert.strictEqual(wx._inner.playCount, 1);
        audio.setMusicEnabled(true);
        assert.strictEqual(wx._inner.playCount, 2);
        assert(wx._inner.pauseCount >= pauses);
    });
});

test('重复 init 不重复注册，隐藏和音频中断会暂停恢复', function () {
    withAudio({}, function (audio, wx) {
        audio.init();
        audio.init();
        assert.strictEqual(wx._handlers.hide.length, 1);
        assert.strictEqual(wx._handlers.show.length, 1);
        assert.strictEqual(wx._handlers.begin.length, 1);
        assert.strictEqual(wx._handlers.end.length, 1);
        audio.unlock();
        const initialPlays = wx._inner.playCount;
        wx._handlers.hide[0]();
        wx._handlers.show[0]();
        assert.strictEqual(wx._inner.playCount, initialPlays + 1);
        wx._handlers.begin[0]();
        wx._handlers.end[0]();
        assert.strictEqual(wx._inner.playCount, initialPlays + 2);
        audio.setMusicEnabled(false);
        wx._handlers.show[0]();
        assert.strictEqual(wx._inner.playCount, initialPlays + 2);
    });
});

test('InnerAudioContext API 缺失时使用程序化 BGM 回退', function () {
    withAudio({}, { innerAudio: false }, function (audio, wx, timers) {
        audio.init();
        audio.unlock();
        assert.strictEqual(timers.active.size, 1);
        assert(wx._context.oscillatorCount > 0);
        const oldIds = Array.from(timers.active.keys());
        audio.setScene('battle');
        assert.strictEqual(timers.active.size, 1);
        assert.strictEqual(timers.active.has(oldIds[0]), false);
    });
});

test('本地文件播放报错后回退，另一场景仍可尝试本地 BGM', function () {
    withAudio({}, function (audio, wx, timers) {
        audio.init();
        audio.unlock();
        wx._inner._handlers.error[0]({ errMsg: 'file missing' });
        assert.strictEqual(timers.active.size, 1);
        assert(wx._context.oscillatorCount > 0);
        audio.setScene('battle');
        assert.strictEqual(wx._inner.src, 'res/audio/battle.m4a');
        assert.strictEqual(wx._inner.playCount, 2);
        assert.strictEqual(timers.active.size, 0);
    });
});

test('完整匹配 payload 与道具/PvP 音效可调用且使用全局缩放', function () {
    withAudio({ match3_music_enabled_v1: false }, function (audio, wx) {
        audio.init();
        audio.unlock();
        audio.match(2);
        audio.match({
            combo: 3,
            generated: [{ type: 101 }, { type: 104 }],
            triggeredSpecials: [{ type: 102 }],
            jellyHits: [{ row: 1, column: 1 }],
            iceHits: [{ row: 2, column: 2 }]
        });
        audio.tool('hammer');
        audio.tool('bomb');
        audio.tool('color');
        audio.pvpCast('freeze');
        audio.pvpHit('disturb');
        assert(wx._context.oscillatorCount > 10);
        assert(wx._context.bufferCount > 0);
        assert(wx._context.gainValues.indexOf(0.48) >= 0, '缺少全局 SFX 缩放 gain');
    });
});

test('CC0 音频精灵只读取解码一次并覆盖主要事件', function () {
    withAudio({ match3_music_enabled_v1: false }, { sprite: 'success', autoEnd: true }, function (audio, wx) {
        audio.init();
        audio.init();
        audio.unlock();
        const defaultGainCount = wx._context.gainValues.length;
        audio.click();
        assert.strictEqual(wx._context.gainValues.length, defaultGainCount,
            '默认 gain=1 的精灵播放不应创建局部 GainNode');
        audio.click();
        audio.click();
        audio.swap();
        audio.drop();
        audio.invalid();
        audio.match({ combo: 2, generated: [{ type: 103 }], iceHits: [{}] });
        audio.tool('hammer');
        audio.pvpCast('freeze');
        audio.pvpHit('disturb');
        audio.reward();
        audio.win();
        audio.lose();
        assert.strictEqual(wx._spriteReadCount, 1, '音频精灵不得重复读取');
        assert.strictEqual(wx._context.decodeCount, 1, '音频精灵不得重复解码');
        assert(wx._context.sourceStarts.length >= 15, '主要事件未全部走音频精灵');
        assert(wx._context.sourceStarts.every(function (item) {
            return item.when >= 0 && item.offset >= 0 && item.duration > 0;
        }), '音频精灵裁切参数无效');
        assert.strictEqual(wx._context.oscillatorCount, 0, '素材可用时不应触发合成回退');
        assert.strictEqual(wx._context.bufferCount, 0, '素材可用时不应生成噪声缓冲');
        assert(wx._context.gainValues.indexOf(0.48) >= 0, '缺少全局 SFX 缩放 gain');
    });
});

test('combo 2..6 复用采样并逐级增强', function () {
    const profiles = [];
    for (let combo = 2; combo <= 6; combo++) {
        withAudio({ match3_music_enabled_v1: false }, { sprite: 'success', autoEnd: true }, function (audio, wx) {
            audio.init();
            audio.unlock();
            const gainStart = wx._context.gainValues.length;
            audio.match(combo);
            const gains = wx._context.gainValues.slice(gainStart);
            const starts = wx._context.sourceStarts;
            assert.strictEqual(starts[0].offset, SFX_SPRITE.cues.combo.offset, '主层必须复用 combo cue');
            assert.strictEqual(starts.length - 1, combo - 1, 'clear 叠加层数错误');
            assert(starts.slice(1).every(function (item) {
                return item.offset === SFX_SPRITE.cues.clear.offset && item.when > 0;
            }), 'clear 叠加必须使用正延迟');
            assert.strictEqual(gains.length, combo, '每个非默认增益层都应有独立 GainNode');
            assert.strictEqual(wx._context.oscillatorCount, 0, '素材可用时不得触发 oscillator 回退');
            profiles.push({ mainGain: gains[0], layers: starts.length - 1 });
        });
    }
    for (let index = 1; index < profiles.length; index++) {
        assert(profiles[index].mainGain > profiles[index - 1].mainGain, 'combo 主增益必须逐级增加');
        assert(profiles[index].layers >= profiles[index - 1].layers, 'clear 叠加层数不得下降');
    }
});

test('特殊棋子组合只播放一次 V7 cue，单特殊保持独立且失败只回退一次', function () {
    withAudio({ match3_music_enabled_v1: false }, { sprite: 'success', autoEnd: true }, function (audio, wx) {
        audio.init();
        audio.unlock();
        audio.match({
            combo: 5,
            generated: [{ type: 101 }, { type: 103 }],
            triggeredSpecials: [{ type: 102 }, { type: 103 }, { type: 104 }],
            jellyHits: [{}],
            iceHits: [{}]
        });
        assert.strictEqual(wx._context.sourceStarts.length, 1, '特殊组合必须只有一次 sprite start');
        assert.strictEqual(wx._context.sourceStarts[0].offset, SFX_SPRITE.cues.specialCombo.offset,
            '特殊组合必须使用 V7 cue');
        ['clear', 'combo', 'rocket', 'bomb', 'color'].forEach(function (name) {
            assert.notStrictEqual(wx._context.sourceStarts[0].offset, SFX_SPRITE.cues[name].offset,
                '特殊组合不得串播 ' + name);
        });
        assert.strictEqual(wx._context.oscillatorCount, 0, '素材可用时不得触发合成回退');
    });

    [101, 103, 104].forEach(function (type, index) {
        const cue = ['rocket', 'bomb', 'color'][index];
        withAudio({ match3_music_enabled_v1: false }, { sprite: 'success', autoEnd: true }, function (audio, wx) {
            audio.init();
            audio.unlock();
            audio.match({ combo: 1, triggeredSpecials: [{ type: type }] });
            assert(wx._context.sourceStarts.some(function (item) {
                return item.offset === SFX_SPRITE.cues[cue].offset;
            }), '单独特殊棋子未使用 ' + cue + ' cue');
        });
    });

    ['read-fail', 'decode-fail'].forEach(function (failure) {
        withAudio({ match3_music_enabled_v1: false }, { sprite: failure }, function (audio, wx) {
            audio.init();
            audio.unlock();
            audio.match({ combo: 4, triggeredSpecials: [{ type: 101 }, { type: 104 }] });
            assert.strictEqual(wx._context.oscillatorCount, 1, failure + ' 时特殊组合应只回退一次');
            assert.strictEqual(wx._context.bufferCount, 0, failure + ' 时不得叠加噪声回退');
        });
    });
});

test('音频精灵读取或解码失败时回退现有合成音效', function () {
    ['read-fail', 'decode-fail'].forEach(function (failure) {
        withAudio({ match3_music_enabled_v1: false }, { sprite: failure }, function (audio, wx) {
            audio.init();
            audio.unlock();
            audio.click();
            audio.invalid();
            assert(wx._context.oscillatorCount > 0, failure + ' 后没有合成音回退');
            assert.strictEqual(wx._spriteReadCount, 1, failure + ' 不应反复读取');
        });
    });
});

test('音频精灵并发声部最多 12 个', function () {
    withAudio({ match3_music_enabled_v1: false }, { sprite: 'success' }, function (audio, wx) {
        audio.init();
        audio.unlock();
        for (let i = 0; i < 24; i++) audio.click();
        assert.strictEqual(wx._context.sourceStarts.length, 12, '并发声部上限应为 12');
    });
});

test('胜负音效短暂压低本地 BGM，奖励音效不压低', function () {
    withAudio({}, { sprite: 'success', autoEnd: true }, function (audio, wx, timers) {
        audio.init();
        audio.unlock();
        audio.reward();
        assert.strictEqual(wx._inner.volume, 0.52, '奖励音效不应压低 BGM');
        assert.strictEqual(timers.active.size, 0, '奖励音效不应创建 duck timer');
        audio.win();
        assert(Math.abs(wx._inner.volume - 0.442) < 1e-9, '胜利时应将 BGM 压低 15%');
        assert.strictEqual(timers.active.size, 1, '胜利时应创建恢复 timer');
        const timerId = Array.from(timers.active.keys())[0];
        assert.strictEqual(timers.active.get(timerId).delay, 600, 'BGM 压低时间应为 600ms');
        timers.run(timerId);
        assert.strictEqual(wx._inner.volume, 0.52, 'duck 结束后应恢复 BGM 音量');
        audio.lose();
        assert.strictEqual(timers.active.size, 1, '失败时也应创建恢复 timer');
    });
});

console.log('========================================');
console.log('音频回归: ' + (allOk ? '全部通过 ✅' : '存在失败 ❌'));
process.exit(allOk ? 0 : 1);
