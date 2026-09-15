# 原声音效精灵运行时 V8

状态：已按冻结决策接入。小游戏主包只包含 `match3-wechat/res/audio/sfx-acoustic.m4a`，所有 cue 共用一次文件读取和一次 WebAudio 解码。

## 最终精灵

- 格式：AAC/M4A，22050 Hz，单声道。
- cue：22 个，间隔 0.025 秒，总时长 10.797 秒。
- WAV 生成阶段：峰值 0.687866，RMS 0.057390，无削波。
- 文件大小：42,325 bytes。
- SHA256：`c199ca1193150ea0c950abfde37cd3094a70029e2ff74692a2e7397b4049915c`。
- 机器可读 offset/duration：`match3-wechat/js/sfx-acoustic-map.js`。

## 特殊棋子 cue

| cue | offset | duration | 离线输入与处理 |
| --- | ---: | ---: | --- |
| `rocket` | 3.219909 | 0.900 | Kinoton 真实火箭录音，`atempo=1.45`、6500 Hz 低通、0.58 增益；叠加现有 CC0 `Ding.ogg` 轻落点 |
| `color` | 4.144898 | 1.180 | reasanka 实录金属琴，180 Hz 高通、7200 Hz 低通，从 2.34 秒裁切、0.30 增益 |
| `bomb` | 5.349887 | 0.860 | animationIsaac 真实爆破，90 Hz 高通、5200 Hz 低通、动态压缩、0.34 增益；叠加现有 CC0 `Ding.ogg` 轻落点 |
| `specialCombo` | 6.234875 | 0.872018 | qubodup 音乐盒魔法音 V7 确认文件，统一 1.00 增益 |

其余 18 个 cue 保持 `sfx-acoustic-preview-v2.md` 的 CC0 来源与处理映射，仅因前述 cue 时长变化而顺延 offset。

运行时规则：`triggeredSpecials.length >= 2` 时只播放一次 `specialCombo`，并立即结束该 match payload 的音效处理，不串播 clear/combo、generated special、standalone special 或障碍 cue；长度为 1 时继续播放对应 `rocket`、`bomb` 或 `color`。精灵读取、解码或播放不可用时，组合仅调用一次 0.14 秒单音合成回退。

## 固化输入与许可

四个文件均位于 `docs/design/audio-sources/`，不在 `match3-wechat/` 小游戏主包目录中：

| 文件 | 来源 | 许可 | SHA256 |
| --- | --- | --- | --- |
| `sanxiao-real-rocket.ogg` | [Firework Single Rocket #1 / Kinoton](https://freesound.org/people/Kinoton/sounds/347163/) | CC0 | `564c8f6a84f4f8f3c46ffe83a8c550cfdcdea399b1d9c9a1f0761bf2a24722d2` |
| `sanxiao-real-explosion.ogg` | [Short Explosion.wav / animationIsaac](https://freesound.org/people/animationIsaac/sounds/207322/) | CC0 | `0da13ae23d0d3f3144ac10ba848910eaed83bdc2686a960083d6e1d0eb1f589b` |
| `sanxiao-real-magic.ogg` | [magical sound effect / reasanka](https://freesound.org/people/reasanka/sounds/429525/) | CC0 | `2192c661a77b1e505814172f93b319790b1b29bb74bea5d9745db361ac7328e6` |
| `sfx-special-combo-musicbox-v7.wav` | [Cliche Magic Spell Sound / qubodup](https://freesound.org/people/qubodup/sounds/817466/) | CC0 | `722634c0e05b58325737373c1423ebd4e2a1caf4508bfde6b8cd367795f35a45` |

## 复现

```sh
PATH=/path/to/temporary-ffmpeg:$PATH \
python3 match3-wechat/tools/gen-sfx-acoustic-preview.py --runtime-only
```

生成器只依赖 Python 标准库和临时 FFmpeg；FFmpeg、解码 PCM 与完整第三方源包不进入仓库或小游戏包。AAC 编码优先复用同一临时 FFmpeg，不支持时保留原 `afconvert` 路径。

## 音频冻结约束

以下原文于 2026-09-07 从项目 AGENTS.md 迁入，仅调整存放位置，未改动音频决策、资产或运行实现：

- 音频冻结规则：舒缓场景与 PvP 使用 Dylann Taylor 的 `PLAYFUL PIANO` CC0 循环（Atmos Loop → `calm.m4a`、JazzTrio Loop → `battle.m4a`；完整 51.20 秒、AAC/M4A、22050 Hz 单声道），`InnerAudioContext` 播放失败时回退 WebAudio 程序化旋律；音效优先播放 Robin Lamb/OpenGameArt、Kenney 与 Freesound 的 CC0 原声采样合成精灵 `sfx-acoustic.m4a`，读取或解码失败时回退原有 WebAudio 合成；同次 match 触发至少两个特殊棋子时只播放一次统一的 V7 音乐盒组合 cue，单特殊仍播放独立 V4 cue；音乐和音效独立控制，后台及音频中断时暂停。
