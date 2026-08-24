# 特殊棋子组合音效 V7 试听

状态：已确认并作为统一特殊棋子组合 cue 接入运行时音效精灵。

- `sfx-special-combo-musicbox-v7.wav`：最终候选 one-shot，时长 `0.872s`。
- `sfx-special-combo-preview-mixed-v7.wav`：在当前游戏 BGM 下分别于 `0.65s`、`3.15s`、`5.65s` 播放同一个候选音效，对应双、三、四个及以上特殊棋子组合。

三个档位统一使用同一个音乐盒魔法音文件、同一音量和一次播放调用，不再保留组合档位音色差异。处理方式为完整连续片段加速至原时长约 `42%`，保留音高并增加 `0.07s` 淡出，没有拼接其他音效。

候选音效峰值 `0.3188`、SHA256 `722634c0e05b58325737373c1423ebd4e2a1caf4508bfde6b8cd367795f35a45`；混合试听峰值 `0.4996`、SHA256 `04ec4d62db9d4fc5dc131c3740a257296fb52b6b7e47690f3f04ee5d81a00ede`，均无削波。

源素材：[Cliche Magic Spell Sound / qubodup](https://freesound.org/people/qubodup/sounds/817466/)，Creative Commons 0。确认文件已按原 SHA256 固化为 `docs/design/audio-sources/sfx-special-combo-musicbox-v7.wav`；它仅作离线输入，小游戏主包只包含压缩后的统一音效精灵。
