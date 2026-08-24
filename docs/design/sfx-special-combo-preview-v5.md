# 特殊棋子组合音效 V5 试听

状态：仅供听感确认，尚未替换运行时音效精灵或触发逻辑。V4 中已确认的火箭、炸弹和彩球单独音效保持不变；V5 只重做特殊棋子组合音效。

## 试听文件与时间轴

- `sfx-special-combo-preview-mixed-v5.wav`：推荐审核，按当前游戏背景音乐混合。
- `sfx-special-combo-preview-v5.wav`：无背景音乐版本。

| 时间 | 组合 | 实现 |
| ---: | --- | --- |
| 0.65s | 2 个特殊棋子 | 一段天然包含两次爆发的实录，单次播放 |
| 4.15s | 3 个特殊棋子 | 一段天然包含三次爆发的实录，单次播放 |
| 7.85s | 4 个及以上特殊棋子 | 一段天然包含多次爆发的实录，单次播放 |

每档组合都是独立资源、独立音色和一次播放调用。没有拼接或连播火箭、炸弹、彩球等已有音效，也没有在运行时叠加小爆炸。

两份文件均为 11 秒、22050 Hz、16-bit、单声道。纯音效版峰值 `0.5227`、SHA256 `9ef9e9885465630b3b2690bf44c939d636d248f0c1e08d14adb57cc3e3e45927`；混合版峰值 `0.7029`、SHA256 `2c91e8ddc99e3696fcb6ad9c2a048c0e5ebc737e567711329a5ef6bdee4fc440`，均无削波。

## 来源与许可

| 来源 | 用途 | 许可 | 本次公开 HQ 预览 SHA256 |
| --- | --- | --- | --- |
| [2 Firework pops / Rudmer_Rotteveel](https://freesound.org/people/Rudmer_Rotteveel/sounds/334042/) | 双特殊组合 | CC0 | `f05e0daf120e5ee516c07ebcdd241bcf5b630a77100d09507100f091bddb3a2e` |
| [tre hit long.aiff / SoundCollectah](https://freesound.org/people/SoundCollectah/sounds/109753/) | 三特殊组合 | CC0 | `c4e0d06e089309abeb635e75d5725432ecf80028d3f812a8efbbe2840b2c3127` |
| [multi low hits.aiff / SoundCollectah](https://freesound.org/people/SoundCollectah/sounds/109751/) | 四个及以上特殊组合 | CC0 | `6c7a4c64a87e97001fc4c8bacd8f533b27d2ad5854687ee01ca5e178a6d9c7fc` |

三段均为真实烟花爆发录音，页面许可为 Creative Commons 0，可修改并商用。本次只使用各源文件的一段连续录音，并做裁切、时间压缩、高低通、动态压缩和响度匹配；没有从多份素材重新拼出组合节奏。源文件与转换工具只保存在 `/tmp`，不进入小游戏包。
