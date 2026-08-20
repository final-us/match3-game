/**
 * 音效管理器：用 WebAudio 实时合成音效（零素材文件，不增加包体）
 * 微信小游戏环境：wx.createWebAudioContext()（基础库 2.19.0+）
 * 所有音效都是短音合成，触发时机都在用户触摸之后（满足移动端音频解锁要求）
 */

let ctx = null;

/** 获取 WebAudio 上下文（懒创建） */
function ensureCtx() {
    if (!ctx) {
        try {
            if (typeof wx !== 'undefined' && wx.createWebAudioContext) {
                ctx = wx.createWebAudioContext();
            } else if (typeof AudioContext !== 'undefined') {
                ctx = new AudioContext();
            }
        } catch (e) {
            ctx = null;
        }
    }
    if (ctx && ctx.resume && ctx.state === 'suspended') {
        try { ctx.resume(); } catch (e) {}
    }
    return ctx;
}

/**
 * 播放一个合成音
 * @param {number} freq 起始频率 Hz
 * @param {number} duration 时长 秒
 * @param {string} type 波形: sine/square/triangle/sawtooth
 * @param {number} volume 音量 0-1
 * @param {number} delay 延迟 秒
 * @param {number} freqEnd 结束频率（滑音用）
 */
function tone(freq, duration, type, volume, delay, freqEnd) {
    const c = ensureCtx();
    if (!c) return;
    try {
        const t0 = c.currentTime + (delay || 0);
        const osc = c.createOscillator();
        const gain = c.createGain();

        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        if (freqEnd) {
            osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
        }

        gain.gain.setValueAtTime(volume || 0.25, t0);
        gain.gain.linearRampToValueAtTime(0.001, t0 + duration);

        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.05);
    } catch (e) {}
}

/** 合成一段"噪声"（用于更丰富的声音质感） */
function noise(duration, volume, delay) {
    const c = ensureCtx();
    if (!c) return;
    try {
        const t0 = c.currentTime + (delay || 0);
        const bufferSize = Math.floor(c.sampleRate * duration);
        const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const src = c.createBufferSource();
        src.buffer = buffer;
        const gain = c.createGain();
        gain.gain.setValueAtTime(volume || 0.2, t0);
        gain.gain.linearRampToValueAtTime(0.001, t0 + duration);
        src.connect(gain);
        gain.connect(c.destination);
        src.start(t0);
    } catch (e) {}
}

/** 冰块碎裂脉冲：短促高频带通噪声（"咔嚓"感） */
function iceCrack(delay, freq, volume, dur) {
    const c = ensureCtx();
    if (!c) return;
    try {
        const t0 = c.currentTime + (delay || 0);
        const d = dur || 0.08;
        const bufferSize = Math.floor(c.sampleRate * d);
        const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
        const data = buffer.getChannelData(0);
        // 快速随机抖动 + 快速衰减 = 碎裂感
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.2);
        }
        const src = c.createBufferSource();
        src.buffer = buffer;
        // 带通滤波：突出中高频"咔嚓"质感
        const filter = c.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq || 3500, t0);
        filter.Q.value = 1.0;
        const gain = c.createGain();
        gain.gain.setValueAtTime(volume || 0.2, t0);
        gain.gain.linearRampToValueAtTime(0.001, t0 + d);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(c.destination);
        src.start(t0);
    } catch (e) {}
}

/** 水晶钟声：明亮高频 + 失谐泛音叠加 + 快速指数衰减（"叮~"的清脆感） */
function crystalTone(freq, duration, volume, delay) {
    const c = ensureCtx();
    if (!c) return;
    try {
        const t0 = c.currentTime + (delay || 0);
        const d = duration || 0.16;

        // 基频 + 两个轻微失谐的泛音（2.01x / 3.02x）→ 水晶"闪亮"质感
        const freqs = [freq, freq * 2.01, freq * 3.02];
        const oscs = [];
        for (let i = 0; i < freqs.length; i++) {
            const o = c.createOscillator();
            o.type = 'sine';
            o.frequency.setValueAtTime(freqs[i], t0);
            oscs.push(o);
        }

        const gain = c.createGain();
        gain.gain.setValueAtTime(volume || 0.2, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + d);

        for (let i = 0; i < oscs.length; i++) {
            oscs[i].connect(gain);
            oscs[i].start(t0);
            oscs[i].stop(t0 + d + 0.05);
        }
        gain.connect(c.destination);
    } catch (e) {}
}

const AudioFX = {
    /** 初始化（建议在游戏启动时调用一次） */
    init: function () { ensureCtx(); },

    /** 交换棋子：短促"嗖"声（上滑音） */
    swap: function () {
        tone(500, 0.09, 'triangle', 0.14, 0, 900);
    },

    /** 无效交换（撞墙）：低沉"咚、咚"两下 */
    invalid: function () {
        tone(200, 0.1, 'square', 0.1, 0, 130);
        tone(160, 0.09, 'square', 0.09, 0.1, 110);
    },

    /** 消除：活泼可爱的五声音阶琶音，连消越高音符越多、音阶越高（当前选定版） */
    match: function (combo) {
        const c = Math.min(combo || 1, 6);
        // C 大调五声音阶（C D E G A），可爱风格
        const scale = [523, 587, 659, 784, 880];
        const octave = Math.floor((c - 1) / 3);       // 每 3 连消升一个八度
        const startIdx = (c - 1) % 3;
        const noteCount = Math.min(2 + Math.floor((c - 1) / 2), 4); // 连消越高音符越多

        for (let i = 0; i < noteCount; i++) {
            const idx = Math.min(startIdx + i, scale.length - 1);
            const f = scale[idx] * Math.pow(2, octave);
            const t = i * 0.075;
            noise(0.02, 0.04, t);               // 轻敲击起音（灵动感）
            tone(f, 0.1, 'triangle', 0.2, t);   // 主音（triangle 比 sine 更亮）
            tone(f * 2, 0.07, 'sine', 0.06, t); // 高八度泛音（层次感）
        }

        // 上滑尾音（灵动收尾）
        const tailIdx = Math.min(startIdx + noteCount, scale.length - 1);
        const tailF = scale[tailIdx] * Math.pow(2, octave);
        tone(tailF, 0.14, 'triangle', 0.14, noteCount * 0.075, tailF * 1.8);
    },

    // 备用：冰块碎裂版 / 水晶碰撞版（换回时把 match 换成对应实现，iceCrack/crystalTone 函数都在下方保留）
    matchIce: function (combo) {
        const c = Math.min(combo || 1, 5);
        const pulseCount = Math.min(1 + Math.floor((c + 1) / 2), 4);
        const baseFreq = 3000 + c * 200;
        for (let i = 0; i < pulseCount; i++) {
            iceCrack(i * 0.022, baseFreq + Math.random() * 800, 0.18 - i * 0.03, 0.08);
        }
        tone(baseFreq * 0.9, 0.04, 'square', 0.04, pulseCount * 0.022, baseFreq * 0.6);
    },

    matchCrystal: function (combo) {
        const c = Math.min(combo || 1, 6);
        const base = 1100 + Math.min(c, 4) * 130;
        const noteCount = Math.min(1 + Math.floor((c - 1) / 2), 4);
        for (let i = 0; i < noteCount; i++) {
            const f = base * Math.pow(1.12, i);
            const t = i * 0.07;
            noise(0.015, 0.03, t);
            crystalTone(f, 0.16, 0.2, t);
        }
        crystalTone(base * Math.pow(1.12, noteCount) * 1.25, 0.22, 0.12, noteCount * 0.07);
    },

    /** 新棋子掉落：轻微"啵"声 */
    drop: function () {
        tone(320, 0.05, 'triangle', 0.08, 0, 200);
    },

    /** 胜利：上行琶音 */
    win: function () {
        const notes = [523, 659, 784, 1047];
        for (let i = 0; i < notes.length; i++) {
            tone(notes[i], 0.2, 'sine', 0.22, i * 0.12);
        }
    },

    /** 失败：下行音 */
    lose: function () {
        const notes = [392, 330, 262, 196];
        for (let i = 0; i < notes.length; i++) {
            tone(notes[i], 0.22, 'sine', 0.18, i * 0.14);
        }
    },

    /** 按钮点击：轻"滴" */
    click: function () {
        tone(900, 0.06, 'triangle', 0.16, 0);
    }
};

module.exports = AudioFX;
