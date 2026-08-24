# 特殊棋子写实音效 V4 试听

状态：火箭、炸弹、彩球三个独立 one-shot 已确认并接入运行时音效精灵；本文件保留试听和来源记录。特殊组合采用另行确认的 V7 统一 cue。

## 试听文件与时间轴

- `sfx-special-realistic-preview-mixed-v4.wav`：推荐审核，按游戏当前 BGM `0.52`、SFX master `0.48` 混合。
- `sfx-special-realistic-preview-v4.wav`：无背景音乐版本。

| 时间 | 内容 |
| ---: | --- |
| 0.65s | 火箭：真实单发烟花火箭，经加速和低通柔化，保留很轻的星光落点 |
| 3.45s | 炸弹：真实短爆破，削弱低频、尖峰和长尾 |
| 6.25s | 彩球：真实金属琴演奏片段，表现能量聚集与扩散 |
| 9.35s | 2 个特殊棋子：一次主爆破加一次延迟小爆破 |
| 12.85s | 3 个特殊棋子：一次主爆破加两次递减延迟爆破 |
| 16.45s | 4 个以上：一次主爆破、三次递减延迟爆破和轻微金属琴尾声 |

两份文件均为 20 秒、22050 Hz、16-bit、单声道；混合版峰值 `0.400280`，无削波。纯音效版 SHA256 为 `2fd2cfdc1aa776c95b36bbcfec038661e995e11e71e137a37b0c57c99a8652cc`，混合版 SHA256 为 `e1e47b8fd4cb2996c80c5511e1a4e52fa7edf7cba76460ed5b7fc244f69a2966`。

## 来源与许可

| 来源 | 用途 | 页面许可 | 本次试听缓存 SHA256 |
| --- | --- | --- | --- |
| [Firework Single Rocket #1 / Kinoton](https://freesound.org/people/Kinoton/sounds/347163/) | 火箭主体；真实录音 | CC0 | `564c8f6a84f4f8f3c46ffe83a8c550cfdcdea399b1d9c9a1f0761bf2a24722d2` |
| [Short Explosion.wav / animationIsaac](https://freesound.org/people/animationIsaac/sounds/207322/) | 炸弹与连锁主体；真实烟花录音后略作放大 | CC0 | `0da13ae23d0d3f3144ac10ba848910eaed83bdc2686a960083d6e1d0eb1f589b` |
| [magical sound effect / reasanka](https://freesound.org/people/reasanka/sounds/429525/) | 彩球主体；实录金属琴 | CC0 | `2192c661a77b1e505814172f93b319790b1b29bb74bea5d9745db361ac7328e6` |
| [Explosions / EZduzziteh](https://opengameart.org/content/explosions-4) | 连锁中的两种短小次级爆破 | CC0 | `explosion2.ogg`：`74de6dfd2c58d23886e14785fee7b876c02ef463fe24bb1e9ccf411d6997e246`；`explosions4.ogg`：`27c58b7f99c397f9279284c25b298f507dfb18906cbf6f2a8ad13f6724d6eba2` |

上述三个经确认的公开 CC0 输入已按表中 SHA256 固化为 `docs/design/audio-sources/sanxiao-real-{rocket,explosion,magic}.ogg`，仅作离线派生输入，不进入小游戏主包。运行时仍只包含压缩后的最终音效精灵；精确最终映射见 `sfx-acoustic-runtime-v8.md`。

## 处理原则

- 火箭保留真实发射和掠过特征，但加速至游戏动画时长，并低通削弱刺耳高频。
- 炸弹保留真实瞬态，使用高通、低通和动态压缩削弱手机扬声器上的轰鸣与爆音。
- 彩球没有现实对应物，因此使用真实金属琴而不是合成振荡器。
- 连锁不同时播放多个完整主体声；一次主爆破后按触发数量错开短爆破，响度逐次下降。
- 所有转换工具与源文件只存在于 `/tmp`，不加入项目依赖或小游戏包。
