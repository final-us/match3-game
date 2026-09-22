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
    let playbackRateSetCount = 0;
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
        sourceRates: [],
        gainValues: [],
        createOscillator: function () {
            this.oscillatorCount++;
            return {
                frequency: param(),
                connect: function () {},
                start: function () {
                    if (options.autoEndOscillators && this.onended) this.onended();
                },
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
            const source = {
                connect: function () {},
                start: function (when, offset, duration) {
                    owner.sourceStarts.push({ when: when, offset: offset, duration: duration });
                    if (options.autoEnd && this.onended) this.onended();
                },
                onended: null,
                buffer: null
            };
            if (options.playbackRate !== 'missing') {
                source.playbackRate = {
                    setValueAtTime: function (value, when) {
                        const shouldThrow = options.playbackRate === 'throw' ||
                            (options.playbackRate === 'throw-once' && playbackRateSetCount++ === 0);
                        if (shouldThrow) throw new Error('playbackRate failed');
                        owner.sourceRates.push({ value: value, when: when });
                    }
                };
            }
            return source;
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
            else success({ duration: Math.max.apply(null, Object.values(SFX_SPRITE.cues).map(function (cue) {
                return cue.offset + cue.duration;
            })) + 0.005, _decoded: data });
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

test('音频精灵映射包含 21 个合法且不越界的 cue', function () {
    const cues = Object.keys(SFX_SPRITE.cues);
    assert.strictEqual(cues.length, 21);
    assert.deepStrictEqual(cues.slice(0, 3), ['click1', 'click2', 'click3']);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(SFX_SPRITE.cues, 'combo'), false,
        'combo cue 应已删除');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(SFX_SPRITE.cues, 'specialCombo'), false,
        'specialCombo cue 应已删除');
    assert(Number.isFinite(SFX_SPRITE.decodedSeconds) && SFX_SPRITE.decodedSeconds > 0,
        '缺少实测 decodedSeconds');
    cues.forEach(function (name) {
        const cue = SFX_SPRITE.cues[name];
        assert(cue.offset >= 0 && cue.duration > 0, name + ' cue 参数无效');
        assert(cue.offset + cue.duration <= SFX_SPRITE.decodedSeconds,
            name + ' cue 超出实测解码时长');
    });
});

test('单人与PvP成功交换和补棋静音，保留动画及无效交换提示音', function () {
    const fs = require('fs');
    const vm = require('vm');
    const mainFile = require.resolve('../js/main');
    const mainRequire = require('module').createRequire(mainFile);
    ['solo', 'battle'].forEach(function (mode) {
        withAudio({ match3_music_enabled_v1: false }, { sprite: 'success', autoEnd: true }, function (audio, wx) {
            audio.init();
            audio.unlock();
            const animationResult = Promise.resolve();
            const fills = [];
            const swaps = [];
            const invalidSwaps = [];
            class BoardStub {
                setGame() {}
                setTools() {}
                animateSwap(from, to) { swaps.push([from, to]); return animationResult; }
                animateInvalidSwap(from, to) { invalidSwaps.push([from, to]); return animationResult; }
                animateMatch() { return animationResult; }
                animateFill(data) { fills.push(data); return animationResult; }
            }
            const mainModule = { exports: {} };
            vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), {
                module: mainModule,
                wx: wx,
                require: function (name) {
                    if (name === './audio') return audio;
                    if (name === './render/board-render') return BoardStub;
                    // No real entrypoint construction, stamina consumption or storage writes.
                    if (name === './core/heart') return { consumeHeart: function () { return true; } };
                    if (name === './core/coin') return { getItems: function () { return {}; } };
                    if (name === './core/analytics') return { track: function () {} };
                    return mainRequire(name);
                }
            }, { filename: mainFile });
            const app = Object.create(mainModule.exports.prototype);
            app.progress = { failures: {} };
            app.battle = { disturbUntil: 0 };
            app.showGuide = function () {};
            if (mode === 'solo') app.startGame(1);
            else app.startBattleBoard();
            const callbacks = (mode === 'solo' ? app.core : app.battleCore).callbacks;
            const from = { row: 0, column: 0 };
            const to = { row: 0, column: 1 };
            assert.strictEqual(callbacks.onSwap(from, to), animationResult, mode + '交换动画返回值丢失');
            assert.strictEqual(swaps.length, 1);
            assert.strictEqual(swaps[0][0], from);
            assert.strictEqual(swaps[0][1], to);
            assert.strictEqual(wx._context.sourceStarts.length, 0, mode + '成功交换不得播放音效');
            assert.strictEqual(wx._context.oscillatorCount, 0, mode + '成功交换不得使用合成音效');
            const payload = { combo: 1, generated: [], triggeredSpecials: [], iceHits: [], jellyHits: [] };
            assert.strictEqual(callbacks.onMatch(payload), animationResult, mode + '消除动画返回值丢失');
            const filled = { filled: [{ row: 0, column: 0 }] };
            assert.strictEqual(callbacks.onFill(filled), animationResult, mode + '补棋动画返回值丢失');
            assert.strictEqual(fills.length, 1);
            assert.strictEqual(fills[0], filled);
            assert.deepStrictEqual(wx._context.sourceStarts.map(function (s) { return s.offset; }),
                [SFX_SPRITE.cues.clear.offset], mode + '补棋不得追加drop或其他音效');
            assert.strictEqual(wx._context.oscillatorCount, 0, mode + '补棋不得使用合成音效');
            assert.strictEqual(callbacks.onInvalidSwap(from, to), animationResult, mode + '无效交换动画返回值丢失');
            assert.strictEqual(invalidSwaps.length, 1);
            assert.strictEqual(invalidSwaps[0][0], from);
            assert.strictEqual(invalidSwaps[0][1], to);
            assert.deepStrictEqual(wx._context.sourceStarts.map(function (s) { return s.offset; }),
                [SFX_SPRITE.cues.clear.offset, SFX_SPRITE.cues.invalid.offset], mode + '保留无效交换提示音');
        });
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
        assert.strictEqual(wx._inner.src, 'res/audio/calm.mp3');
        assert.strictEqual(wx._inner.loop, true);
        assert.strictEqual(wx._inner.playCount, 1);
        assert.strictEqual(timers.active.size, 0, '本地 BGM 不应启动回退 timer');
        audio.setScene('calm');
        assert.strictEqual(wx._inner.playCount, 1, '相同 scene 必须去重');
        audio.setScene('battle');
        assert.strictEqual(wx._innerCreateCount, 1, '切场景不得重复创建播放器');
        assert.strictEqual(wx._inner.src, 'res/audio/battle.mp3');
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
        assert.strictEqual(wx._inner.src, 'res/audio/battle.mp3');
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
        assert(wx._context.sourceStarts.length >= 14, '主要事件未全部走音频精灵');
        assert(wx._context.sourceStarts.every(function (item) {
            return item.when >= 0 && item.offset >= 0 && item.duration > 0;
        }), '音频精灵裁切参数无效');
        assert.strictEqual(wx._context.oscillatorCount, 0, '素材可用时不应触发合成回退');
        assert.strictEqual(wx._context.bufferCount, 0, '素材可用时不应生成噪声缓冲');
        assert(wx._context.gainValues.indexOf(0.48) >= 0, '缺少全局 SFX 缩放 gain');
    });
});

test('combo 1..6 复用 clear cue 并逐级加速，不叠层不增益', function () {
    const semitones = [0, 2, 4, 5, 7, 9];
    for (let combo = 1; combo <= 6; combo++) {
        withAudio({ match3_music_enabled_v1: false }, { sprite: 'success', autoEnd: true }, function (audio, wx) {
            audio.init();
            audio.unlock();
            const gainStart = wx._context.gainValues.length;
            audio.match(combo);
            const starts = wx._context.sourceStarts;
            const expectedRate = Math.pow(2, semitones[combo - 1] / 12);
            assert.strictEqual(starts.length, 1, '每次连消只应播放一个 clear cue');
            assert.strictEqual(starts[0].offset, SFX_SPRITE.cues.clear.offset, '连消必须复用 clear cue');
            assert.strictEqual(starts[0].duration, SFX_SPRITE.cues.clear.duration,
                'start.duration 必须保持源 cue 时长');
            assert.strictEqual(wx._context.gainValues.slice(gainStart).length, 0,
                '连消不得创建额外音量增益层');
            assert.deepStrictEqual(wx._context.sourceRates,
                combo === 1 ? [] : [{ value: expectedRate, when: 0 }],
                '连消速率必须按半音阶递增，combo1 不设置 playbackRate');
            assert.strictEqual(wx._context.oscillatorCount, 0, '素材可用时不得触发 oscillator 回退');
        });
    }
});

test('长连锁速率封顶且下一次连消重新计算', function () {
    withAudio({ match3_music_enabled_v1: false }, { sprite: 'success', autoEnd: true }, function (audio, wx) {
        audio.init();
        audio.unlock();
        audio.match(99);
        audio.match(1);
        audio.match(2);
        assert.deepStrictEqual(wx._context.sourceRates.map(function (item) { return item.value; }), [
            Math.pow(2, 9 / 12), Math.pow(2, 2 / 12)
        ], '超长连锁应封顶，后续连消不得沿用旧速率');
        assert.strictEqual(wx._context.sourceStarts.length, 3, '每次连消都应只有一个 clear cue');
        assert(wx._context.sourceStarts.every(function (item) {
            return item.duration === SFX_SPRITE.cues.clear.duration;
        }), '长连锁 start.duration 必须保持源 cue 时长');
    });
});

test('运行时 playbackRate 缺失或抛错时回退并释放声部', function () {
    for (const playbackRate of ['missing', 'throw']) {
        withAudio({ match3_music_enabled_v1: false },
            { sprite: 'success', autoEnd: true, playbackRate: playbackRate }, function (audio, wx) {
                audio.init();
                audio.unlock();
                audio.match(2);
                assert.strictEqual(wx._context.sourceStarts.length, 0,
                    playbackRate + ' 时不得启动失效 sprite');
                assert(wx._context.oscillatorCount > 0,
                    playbackRate + ' 时应回退到程序化消除音');
            });
    }
    withAudio({ match3_music_enabled_v1: false },
        { sprite: 'success', playbackRate: 'throw-once', autoEndOscillators: true }, function (audio, wx) {
            audio.init();
            audio.unlock();
            audio.match(2);
            for (let i = 0; i < 12; i++) audio.click();
            assert.strictEqual(wx._context.sourceStarts.length, 12,
                'rate 抛错后必须释放已占用的 voice，不能少于 12 个后续声部');
        });
});

test('四连以奖励音替代消除，其他特殊生成保留原消除且不提前爆发', function () {
    for (const combo of [1, 3]) {
        for (const type of [101, 102, 103, 104]) {
            withAudio({ match3_music_enabled_v1: false }, { sprite: 'success', autoEnd: true }, function (audio, wx) {
                audio.init();
                audio.unlock();
                audio.match({ combo: combo });
                const baseline = wx._context.sourceStarts.splice(0);
                audio.match({ combo: combo, generated: [{ type: type }, { type: type }] });
                if (type === 101 || type === 102) {
                    assert.deepStrictEqual(wx._context.sourceStarts, [{ when: 0,
                        offset: SFX_SPRITE.cues.fourClear.offset, duration: SFX_SPRITE.cues.fourClear.duration }],
                    '多条四连同轮只播放一次奖励音');
                } else {
                    assert.deepStrictEqual(wx._context.sourceStarts, baseline,
                        '炸弹/彩球生成不应增加或替换消除音');
                }
            });
        }
    }
    withAudio({ match3_music_enabled_v1: false }, { sprite: 'success', autoEnd: true }, function (audio, wx) {
        audio.init();
        audio.unlock();
        audio.match({ combo: 1, generated: [{ type: 101 }, { type: 103 }], triggeredSpecials: [{ type: 101 }] });
        assert.deepStrictEqual(wx._context.sourceStarts.map(item => item.offset),
            [SFX_SPRITE.cues.fourClear.offset, SFX_SPRITE.cues.rocket.offset],
            '同时生成并触发时，只为实际触发的火箭播放一次音效');
    });
    for (const failure of ['read-fail', 'decode-fail']) {
        withAudio({ match3_music_enabled_v1: false }, { sprite: failure }, function (audio, wx) {
            audio.init();
            audio.unlock();
            audio.match(1);
            const oscillators = wx._context.oscillatorCount;
            const buffers = wx._context.bufferCount;
            audio.match({ combo: 1, generated: [{ type: 101 }, { type: 103 }, { type: 104 }] });
            assert.strictEqual(wx._context.oscillatorCount, oscillators * 2, '回退时生成不得加合成音');
            assert.strictEqual(wx._context.bufferCount, buffers * 2, '回退时生成不得加噪声');
        });
    }
});

test('四连与2–6次连锁分开识别，障碍和静音规则保留', function () {
    for (let combo = 2; combo <= 6; combo++) {
        withAudio({ match3_music_enabled_v1: false }, { sprite: 'success', autoEnd: true }, function (audio, wx) {
            audio.init(); audio.unlock();
            audio.match({ combo: combo });
            assert(wx._context.sourceStarts.every(x => x.offset !== SFX_SPRITE.cues.fourClear.offset));
            wx._context.sourceStarts.length = 0;
            wx._context.sourceRates.length = 0;
            audio.match({ combo: combo, generated: [{type:101},{type:102}], iceHits:[{}] });
            assert.deepStrictEqual(wx._context.sourceStarts.map(x => x.offset),
                [SFX_SPRITE.cues.fourClear.offset,SFX_SPRITE.cues.ice.offset]);
            assert.deepStrictEqual(wx._context.sourceRates, [], '四连和障碍音效必须保持 rate=1');
            assert.deepStrictEqual(wx._context.sourceStarts.map(x => x.duration),
                [SFX_SPRITE.cues.fourClear.duration, SFX_SPRITE.cues.ice.duration],
                '四连和障碍 start.duration 必须保持源 cue 时长');
            audio.setSfxEnabled(false);
            const count = wx._context.sourceStarts.length;
            audio.match({ combo: combo, generated: [{type:101}] });
            assert.strictEqual(wx._context.sourceStarts.length,count);
            assert.strictEqual(wx._context.oscillatorCount,0);
        });
    }
});

test('真实棋盘收集结果：横竖四连触发，五连和T形不误触', function () {
    const GameCore = require('../js/core/game-core');
    const grid = require('../js/core/grid');
    const patterns = [
        {cells:[[3,1],[3,2],[3,3],[3,4]], four:true},
        {cells:[[1,3],[2,3],[3,3],[4,3]], four:true},
        {cells:[[3,1],[3,2],[3,3],[3,4],[3,5]], four:false},
        {cells:[[3,1],[3,2],[3,3],[3,4],[2,3],[4,3]], four:false}
    ];
    for (const pattern of patterns) {
        const core = new GameCore({rows:7,columns:7,moveCount:20},{});
        for(let r=0;r<7;r++)for(let c=0;c<7;c++)core.grid[r][c]=(r+c)%3+1;
        pattern.cells.forEach(p => {core.grid[p[0]][p[1]]=5;});
        const collected = core.collectWithSpecials(grid.getMatches(core.grid,null,3));
        withAudio({ match3_music_enabled_v1: false }, { sprite:'success',autoEnd:true },function(audio,wx){
            audio.init();audio.unlock();
            audio.match({combo:1,generated:collected.generated});
            assert.deepStrictEqual(wx._context.sourceStarts.map(x=>x.offset),
                [SFX_SPRITE.cues[pattern.four?'fourClear':'clear'].offset]);
        });
    }
});

test('特殊棋子组合同时播放对应单独音效，单特殊保持独立', function () {
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
        assert.strictEqual(wx._context.sourceStarts.length, 2, '特殊组合应同时播放两个单独音效');
        [SFX_SPRITE.cues.rocket.offset, SFX_SPRITE.cues.bomb.offset].forEach(function (offset) {
            assert(wx._context.sourceStarts.some(function (item) { return item.offset === offset; }),
                '特殊组合应使用对应的单独音效');
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

    withAudio({ match3_music_enabled_v1: false }, { sprite: 'success', autoEnd: true }, function (audio, wx) {
        audio.init();
        audio.unlock();
        audio.match({ combo: 4, triggeredSpecials: [{ type: 101 }, { type: 104 }] });
        assert(wx._context.sourceStarts.some(function (item) {
            return item.offset === SFX_SPRITE.cues.rocket.offset;
        }), '特殊组合未播放火箭单独音效');
        assert(wx._context.sourceStarts.some(function (item) {
            return item.offset === SFX_SPRITE.cues.color.offset;
        }), '特殊组合未播放彩球单独音效');
    });

    ['read-fail', 'decode-fail'].forEach(function (failure) {
        withAudio({ match3_music_enabled_v1: false }, { sprite: failure }, function (audio, wx) {
            audio.init();
            audio.unlock();
            audio.match({ combo: 4, triggeredSpecials: [{ type: 101 }, { type: 104 }] });
            assert(wx._context.oscillatorCount >= 2, failure + ' 时应分别回退两个特殊棋子音效');
            assert.strictEqual(wx._context.bufferCount, 0, failure + ' 时不得叠加失效精灵');
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
