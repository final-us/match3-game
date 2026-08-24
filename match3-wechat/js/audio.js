/**
 * 音频管理器：本地循环 BGM 与原声音效精灵优先，失败时回退 WebAudio 合成。
 * 首次触摸由 unlock() 解锁；音乐和音效保持独立开关。
 */

const SFX_SPRITE = require('./sfx-acoustic-map');

let ctx = null;
let sfxMaster = null;
let sfxMasterCtx = null;
let activeSfxVoices = 0;
let sfxSpriteBuffer = null;
let sfxSpriteLoading = false;
let sfxSpriteUnavailable = false;
let clickVariant = 0;
let noiseSeed = 2463534242;
let musicEnabled = true;
let sfxEnabled = true;
let scene = 'calm';
let musicTimer = null;
let musicStep = 0;
let localMusic = null;
let localMusicScene = '';
let localMusicPlaying = false;
let localMusicApiUnavailable = false;
let localMusicDuckTimer = null;
let unlocked = false;
let hidden = false;
let interrupted = false;
let lifecycleStore = null;
const musicSources = [];
const localMusicFailed = { calm: false, battle: false };

const AUDIO_KEY = 'match3_audio_enabled_v1';
const MUSIC_KEY = 'match3_music_enabled_v1';
const SFX_KEY = 'match3_sfx_enabled_v1';
const SFX_MASTER_VOLUME = 0.48;
const MAX_SFX_VOICES = 12;
const LOCAL_MUSIC_VOLUME = 0.52;
const OUTCOME_DUCK_MS = 600;
const BGM_FILES = {
    calm: 'res/audio/calm.m4a',
    battle: 'res/audio/battle.m4a'
};
const MUSIC_SCENES = {
    calm: { interval: 1450, duration: 0.42, volume: 0.045, notes: [523, 659, 784, 659, 587, 659, 523, 392] },
    battle: { interval: 560, duration: 0.24, volume: 0.055, notes: [392, 523, 659, 784, 659, 523, 440, 659] }
};

function getStore() {
    if (typeof wx !== 'undefined') return wx;
    if (typeof global !== 'undefined') return global.wx;
    return null;
}

function ensureCtx() {
    if (!ctx || ctx.state === 'closed') {
        try {
            if (typeof wx !== 'undefined' && wx.createWebAudioContext) ctx = wx.createWebAudioContext();
            else if (typeof AudioContext !== 'undefined') ctx = new AudioContext();
        } catch (e) { ctx = null; }
    }
    if (ctx && ctx.resume && ctx.state === 'suspended') {
        try {
            const result = ctx.resume();
            if (result && result.catch) result.catch(function () {});
        } catch (e) {}
    }
    return ctx;
}

function ensureSfxOutput() {
    if (!sfxEnabled) return null;
    const c = ensureCtx();
    if (!c) return null;
    if (!sfxMaster || sfxMasterCtx !== c) {
        try {
            sfxMaster = c.createGain();
            sfxMaster.gain.setValueAtTime(SFX_MASTER_VOLUME, c.currentTime);
            sfxMaster.connect(c.destination);
            sfxMasterCtx = c;
        } catch (e) {
            sfxMaster = null;
            sfxMasterCtx = null;
        }
    }
    return sfxMaster;
}

function markSfxSpriteUnavailable() {
    sfxSpriteLoading = false;
    sfxSpriteUnavailable = true;
}

function loadSfxSprite() {
    if (!sfxEnabled || sfxSpriteBuffer || sfxSpriteLoading || sfxSpriteUnavailable) return;
    const store = getStore();
    const c = ensureCtx();
    if (!store || typeof store.getFileSystemManager !== 'function' || !c || typeof c.decodeAudioData !== 'function') {
        markSfxSpriteUnavailable();
        return;
    }
    let fileSystem = null;
    try { fileSystem = store.getFileSystemManager(); } catch (e) {}
    if (!fileSystem || typeof fileSystem.readFile !== 'function') {
        markSfxSpriteUnavailable();
        return;
    }
    sfxSpriteLoading = true;
    try {
        fileSystem.readFile({
            filePath: SFX_SPRITE.file,
            success: function (result) {
                let settled = false;
                function accept(buffer) {
                    if (settled) return;
                    settled = true;
                    sfxSpriteLoading = false;
                    if (buffer) sfxSpriteBuffer = buffer; else markSfxSpriteUnavailable();
                }
                function reject() {
                    if (settled) return;
                    settled = true;
                    markSfxSpriteUnavailable();
                }
                try {
                    const pending = c.decodeAudioData(result.data, accept, reject);
                    if (pending && typeof pending.then === 'function') pending.then(accept).catch(reject);
                } catch (e) { reject(); }
            },
            fail: markSfxSpriteUnavailable
        });
    } catch (e) { markSfxSpriteUnavailable(); }
}

function readBool(store, key) {
    if (!store || !store.getStorageSync) return undefined;
    try {
        const value = store.getStorageSync(key);
        return typeof value === 'boolean' ? value : undefined;
    } catch (e) { return undefined; }
}

function writeBool(store, key, value) {
    if (!store || !store.setStorageSync) return;
    try { store.setStorageSync(key, !!value); } catch (e) {}
}

function loadSettings(store) {
    const oldValue = readBool(store, AUDIO_KEY);
    const savedMusic = readBool(store, MUSIC_KEY);
    const savedSfx = readBool(store, SFX_KEY);
    musicEnabled = savedMusic == null ? (oldValue == null ? true : oldValue) : savedMusic;
    sfxEnabled = savedSfx == null ? (oldValue == null ? true : oldValue) : savedSfx;
    if (oldValue != null) {
        if (savedMusic == null) writeBool(store, MUSIC_KEY, musicEnabled);
        if (savedSfx == null) writeBool(store, SFX_KEY, sfxEnabled);
    }
}

function canPlayMusic() {
    return unlocked && musicEnabled && !hidden && !interrupted;
}

function stopProceduralMusic() {
    if (musicTimer !== null) {
        clearTimeout(musicTimer);
        musicTimer = null;
    }
    for (let i = 0; i < musicSources.length; i++) {
        try { musicSources[i].stop(); } catch (e) {}
    }
    musicSources.length = 0;
}

function restoreLocalMusicVolume() {
    if (localMusicDuckTimer !== null) {
        clearTimeout(localMusicDuckTimer);
        localMusicDuckTimer = null;
    }
    if (localMusic) {
        try { localMusic.volume = LOCAL_MUSIC_VOLUME; } catch (e) {}
    }
}

function pauseLocalMusic() {
    if (!localMusic || !localMusicPlaying) return;
    restoreLocalMusicVolume();
    try { localMusic.pause(); } catch (e) {}
    localMusicPlaying = false;
}

function stopMusic() {
    stopProceduralMusic();
    pauseLocalMusic();
}

function duckLocalMusic() {
    if (!sfxEnabled || !canPlayMusic() || !localMusic || !localMusicPlaying) return;
    try { localMusic.volume = LOCAL_MUSIC_VOLUME * 0.85; } catch (e) { return; }
    if (localMusicDuckTimer !== null) clearTimeout(localMusicDuckTimer);
    localMusicDuckTimer = setTimeout(function () {
        localMusicDuckTimer = null;
        if (localMusic) {
            try { localMusic.volume = LOCAL_MUSIC_VOLUME; } catch (e) {}
        }
    }, OUTCOME_DUCK_MS);
}

function playMusicNote(freq, duration, volume) {
    const c = ensureCtx();
    if (!c || !canPlayMusic()) return;
    try {
        const t0 = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(volume, t0 + 0.025);
        gain.gain.linearRampToValueAtTime(0.001, t0 + duration);
        osc.connect(gain);
        gain.connect(c.destination);
        musicSources.push(osc);
        osc.onended = function () {
            const index = musicSources.indexOf(osc);
            if (index >= 0) musicSources.splice(index, 1);
        };
        osc.start(t0);
        osc.stop(t0 + duration + 0.05);
    } catch (e) {}
}

function scheduleProceduralMusic() {
    musicTimer = null;
    if (!canPlayMusic() || localMusicPlaying) return;
    const config = MUSIC_SCENES[scene];
    playMusicNote(config.notes[musicStep % config.notes.length], config.duration, config.volume);
    musicStep++;
    if (canPlayMusic() && !localMusicPlaying) musicTimer = setTimeout(scheduleProceduralMusic, config.interval);
}

function startProceduralMusic() {
    if (!canPlayMusic() || musicTimer !== null || localMusicPlaying || !ensureCtx()) return;
    scheduleProceduralMusic();
}

function markLocalMusicFailed(failedScene) {
    localMusicFailed[failedScene || scene] = true;
    pauseLocalMusic();
    if (canPlayMusic()) startProceduralMusic();
}

function ensureLocalMusic() {
    if (localMusic || localMusicApiUnavailable) return localMusic;
    const store = getStore();
    if (!store || typeof store.createInnerAudioContext !== 'function') {
        localMusicApiUnavailable = true;
        return null;
    }
    try {
        localMusic = store.createInnerAudioContext();
        localMusic.loop = true;
        localMusic.autoplay = false;
        localMusic.volume = LOCAL_MUSIC_VOLUME;
        localMusic.obeyMuteSwitch = true;
        if (localMusic.onError) localMusic.onError(function () { markLocalMusicFailed(localMusicScene); });
    } catch (e) {
        localMusic = null;
        localMusicApiUnavailable = true;
    }
    return localMusic;
}

function startLocalMusic() {
    if (!canPlayMusic() || localMusicFailed[scene]) return false;
    const player = ensureLocalMusic();
    if (!player) return false;
    const nextScene = scene;
    try {
        if (localMusicPlaying && localMusicScene === nextScene) return true;
        if (localMusicScene !== nextScene) {
            pauseLocalMusic();
            localMusicScene = nextScene;
            player.src = BGM_FILES[nextScene];
        }
        stopProceduralMusic();
        const result = player.play();
        localMusicPlaying = true;
        if (result && result.catch) result.catch(function () { markLocalMusicFailed(nextScene); });
        return true;
    } catch (e) {
        markLocalMusicFailed(nextScene);
        return false;
    }
}

function resumeMusic() {
    if (!canPlayMusic()) return;
    if (!startLocalMusic()) startProceduralMusic();
}

function registerLifecycleListeners(store) {
    if (!store || lifecycleStore === store) return;
    lifecycleStore = store;
    if (store.onHide) store.onHide(function () { hidden = true; stopMusic(); });
    if (store.onShow) store.onShow(function () { hidden = false; resumeMusic(); });
    if (store.onAudioInterruptionBegin) store.onAudioInterruptionBegin(function () { interrupted = true; stopMusic(); });
    if (store.onAudioInterruptionEnd) store.onAudioInterruptionEnd(function () { interrupted = false; resumeMusic(); });
}

function claimVoice(node) {
    if (activeSfxVoices >= MAX_SFX_VOICES) return false;
    activeSfxVoices++;
    node.onended = function () { activeSfxVoices = Math.max(0, activeSfxVoices - 1); };
    return true;
}

function playSprite(name, gain, delay) {
    if (!sfxEnabled) return true;
    const cue = SFX_SPRITE.cues[name];
    if (!cue) return false;
    if (!sfxSpriteBuffer) {
        loadSfxSprite();
        return false;
    }
    const output = ensureSfxOutput();
    const c = ctx;
    if (!output || !c || typeof c.createBufferSource !== 'function') return false;
    gain = gain == null ? 1 : gain;
    const startTime = c.currentTime + (delay || 0);
    let claimed = false;
    try {
        const source = c.createBufferSource();
        if (!claimVoice(source)) return true;
        claimed = true;
        source.buffer = sfxSpriteBuffer;
        if (gain !== 1) {
            const localGain = c.createGain();
            localGain.gain.setValueAtTime(gain, startTime);
            source.connect(localGain);
            localGain.connect(output);
        } else {
            source.connect(output);
        }
        source.start(startTime, cue.offset, cue.duration);
        return true;
    } catch (e) {
        if (claimed) activeSfxVoices = Math.max(0, activeSfxVoices - 1);
        return false;
    }
}

function tone(freq, duration, type, volume, delay, freqEnd) {
    const output = ensureSfxOutput();
    const c = ctx;
    if (!output || !c) return;
    let claimed = false;
    try {
        const osc = c.createOscillator();
        if (!claimVoice(osc)) return;
        claimed = true;
        const t0 = c.currentTime + (delay || 0);
        const gain = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
        gain.gain.setValueAtTime(volume == null ? 0.20 : volume, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
        osc.connect(gain);
        gain.connect(output);
        osc.start(t0);
        osc.stop(t0 + duration + 0.03);
    } catch (e) {
        if (claimed) activeSfxVoices = Math.max(0, activeSfxVoices - 1);
    }
}

function noise(duration, volume, delay, filterFrequency) {
    const output = ensureSfxOutput();
    const c = ctx;
    if (!output || !c || !c.createBuffer || !c.createBufferSource) return;
    let claimed = false;
    try {
        const count = Math.max(1, Math.floor(c.sampleRate * duration));
        const buffer = c.createBuffer(1, count, c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < count; i++) {
            noiseSeed ^= noiseSeed << 13;
            noiseSeed ^= noiseSeed >>> 17;
            noiseSeed ^= noiseSeed << 5;
            data[i] = ((noiseSeed >>> 0) / 4294967295 * 2 - 1) * (1 - i / count);
        }
        const source = c.createBufferSource();
        if (!claimVoice(source)) return;
        claimed = true;
        source.buffer = buffer;
        const gain = c.createGain();
        const t0 = c.currentTime + (delay || 0);
        gain.gain.setValueAtTime(volume == null ? 0.10 : volume, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
        if (filterFrequency && c.createBiquadFilter) {
            const filter = c.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(filterFrequency, t0);
            if (filter.Q) filter.Q.value = 0.8;
            source.connect(filter);
            filter.connect(gain);
        } else {
            source.connect(gain);
        }
        gain.connect(output);
        source.start(t0);
    } catch (e) {
        if (claimed) activeSfxVoices = Math.max(0, activeSfxVoices - 1);
    }
}

function specialKind(type) {
    if (type === 101 || type === 'horizontal' || type === 'hRocket') return 'horizontal';
    if (type === 102 || type === 'vertical' || type === 'vRocket') return 'vertical';
    if (type === 103 || type === 'bomb') return 'bomb';
    if (type === 104 || type === 'color' || type === 'colorBall') return 'color';
    return '';
}

function playSpecial(type, triggered) {
    const kind = specialKind(type);
    const sprite = kind === 'horizontal' || kind === 'vertical' ? 'rocket' : kind;
    if (sprite && playSprite(sprite)) return;
    const lift = triggered ? 1.08 : 1;
    if (kind === 'horizontal') {
        tone(560 * lift, 0.15, 'triangle', 0.14, 0, 980 * lift);
        tone(840 * lift, 0.12, 'sine', 0.07, 0.045, 1280 * lift);
    } else if (kind === 'vertical') {
        tone(690 * lift, 0.17, 'triangle', 0.13, 0, 1320 * lift);
        tone(1040 * lift, 0.10, 'sine', 0.06, 0.06, 760 * lift);
    } else if (kind === 'bomb') {
        tone(150, 0.18, 'sine', 0.18, 0, 72);
        noise(0.11, 0.10, 0.015, 720);
    } else if (kind === 'color') {
        const notes = [659, 784, 1047, 1319];
        for (let i = 0; i < notes.length; i++) tone(notes[i] * lift, 0.13, 'sine', 0.09, i * 0.045);
    }
}

function playObstacle(kind) {
    if (playSprite(kind)) return;
    if (kind === 'jelly') {
        tone(260, 0.10, 'sine', 0.11, 0, 190);
        tone(390, 0.08, 'triangle', 0.06, 0.035, 320);
    } else if (kind === 'ice') {
        noise(0.075, 0.09, 0, 3300);
        tone(1320, 0.09, 'sine', 0.07, 0.015, 1850);
    }
}

function playTool(type) {
    if (playSprite(type === 'color' ? 'color' : type)) return;
    if (type === 'hammer') {
        tone(210, 0.075, 'triangle', 0.16, 0, 135);
        tone(620, 0.055, 'sine', 0.05, 0.018, 470);
    } else if (type === 'bomb') playSpecial('bomb', true);
    else if (type === 'color') playSpecial('color', true);
}

function playPvp(item, received) {
    const sprite = item === 'freeze'
        ? (received ? 'freezeHit' : 'freezeCast')
        : (item === 'disturb' ? (received ? 'disturbHit' : 'disturbCast') : '');
    if (sprite && playSprite(sprite)) return;
    if (item === 'freeze') {
        tone(received ? 1180 : 760, 0.18, 'sine', 0.12, 0, received ? 520 : 1480);
        if (received) noise(0.07, 0.07, 0.025, 3100);
    } else if (item === 'disturb') {
        tone(received ? 240 : 330, 0.20, 'triangle', 0.12, 0, received ? 145 : 520);
        tone(received ? 310 : 440, 0.16, 'sine', 0.06, 0.045, received ? 190 : 620);
    }
}

function playWinFallback() {
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) tone(notes[i], 0.20, 'sine', 0.16, i * 0.12);
}

function playLoseFallback() {
    const notes = [392, 330, 262, 196];
    for (let i = 0; i < notes.length; i++) tone(notes[i], 0.22, 'sine', 0.13, i * 0.14);
}

const AudioFX = {
    init: function () {
        const store = getStore();
        loadSettings(store);
        registerLifecycleListeners(store);
        if (sfxEnabled) { ensureCtx(); loadSfxSprite(); }
    },

    setMusicEnabled: function (value) {
        musicEnabled = !!value;
        writeBool(getStore(), MUSIC_KEY, musicEnabled);
        if (musicEnabled) resumeMusic(); else stopMusic();
    },
    isMusicEnabled: function () { return musicEnabled; },

    setSfxEnabled: function (value) {
        sfxEnabled = !!value;
        writeBool(getStore(), SFX_KEY, sfxEnabled);
        if (sfxEnabled) { ensureSfxOutput(); loadSfxSprite(); }
    },
    isSfxEnabled: function () { return sfxEnabled; },

    unlock: function () {
        unlocked = true;
        if (sfxEnabled) { ensureSfxOutput(); loadSfxSprite(); }
        resumeMusic();
    },

    setEnabled: function (value) { this.setSfxEnabled(value); },
    isEnabled: function () { return sfxEnabled; },

    setScene: function (value) {
        const next = value === 'battle' ? 'battle' : 'calm';
        if (scene !== next) {
            stopMusic();
            scene = next;
            musicStep = 0;
        }
        resumeMusic();
    },
    getScene: function () { return scene; },

    swap: function () {
        if (playSprite('swap')) return;
        tone(430, 0.10, 'sine', 0.12, 0, 690);
        tone(620, 0.07, 'triangle', 0.05, 0.025, 790);
    },

    invalid: function () {
        if (playSprite('invalid')) return;
        tone(205, 0.10, 'sine', 0.13, 0, 145);
        noise(0.045, 0.045, 0.01, 650);
    },

    /** data 可为旧版 numeric combo，也可为完整 onMatch payload。 */
    match: function (data) {
        const payload = typeof data === 'number' ? { combo: data } : (data || {});
        const triggered = payload.triggeredSpecials || [];
        if (triggered.length >= 2) {
            if (!playSprite('specialCombo')) tone(784, 0.14, 'sine', 0.11);
            return;
        }
        const combo = Math.max(1, Math.min(Number(payload.combo) || 1, 6));
        const sampled = combo === 1 ? playSprite('clear') : playSprite('combo', 0.80 + combo * 0.06);
        if (sampled && combo > 1) {
            for (let layer = 1; layer < combo; layer++) playSprite('clear', 0.08, layer * 0.055);
        } else if (!sampled) {
            const scale = [523, 587, 659, 784, 880];
            const noteCount = Math.min(2 + Math.floor((combo - 1) / 2), 4);
            const octave = combo >= 4 ? 2 : 1;
            for (let i = 0; i < noteCount; i++) {
                const frequency = scale[Math.min(i + (combo - 1) % 3, scale.length - 1)] * octave;
                tone(frequency, 0.10, 'triangle', 0.12, i * 0.065);
                tone(frequency * 2, 0.065, 'sine', 0.035, i * 0.065);
            }
        }

        const generated = payload.generated || [];
        const seenGenerated = {};
        const seenTriggered = {};
        for (let i = 0; i < generated.length && i < 8; i++) {
            const type = generated[i].type;
            if (!seenGenerated[type]) { seenGenerated[type] = true; playSpecial(type, false); }
        }
        for (let i = 0; i < triggered.length && i < 12; i++) {
            const type = triggered[i].type;
            if (!seenTriggered[type]) { seenTriggered[type] = true; playSpecial(type, true); }
        }
        if (payload.jellyHits && payload.jellyHits.length) playObstacle('jelly');
        if (payload.iceHits && payload.iceHits.length) playObstacle('ice');
    },

    matchIce: function (combo) { this.match(combo); playObstacle('ice'); },
    matchCrystal: function (combo) { this.match(combo); playObstacle('ice'); },
    specialGenerated: function (type) { playSpecial(type, false); },
    specialTriggered: function (type) { playSpecial(type, true); },
    obstacleHit: function (kind) { playObstacle(kind); },
    tool: function (type) { playTool(type); },
    pvpCast: function (item) { playPvp(item, false); },
    pvpHit: function (item) { playPvp(item, true); },

    drop: function () {
        if (!playSprite('drop')) tone(310, 0.05, 'triangle', 0.055, 0, 230);
    },

    win: function () {
        if (!playSprite('win')) playWinFallback();
        duckLocalMusic();
    },

    lose: function () {
        if (!playSprite('lose')) playLoseFallback();
        duckLocalMusic();
    },

    reward: function () {
        if (!playSprite('purchase')) playWinFallback();
    },

    click: function () {
        const sprite = 'click' + (clickVariant + 1);
        clickVariant = (clickVariant + 1) % 3;
        if (playSprite(sprite)) return;
        tone(520, 0.055, 'triangle', 0.11, 0, 390);
        tone(1040, 0.075, 'sine', 0.055, 0.025, 920);
    }
};

module.exports = AudioFX;
