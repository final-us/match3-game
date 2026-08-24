# 原声采样试听样带 v2

试听文件均为 25.000 秒、22050 Hz、16-bit、mono：

- [`sfx-acoustic-preview-v2.wav`](sfx-acoustic-preview-v2.wav)：纯原声采样音效。
- [`sfx-acoustic-preview-mixed-v2.wav`](sfx-acoustic-preview-mixed-v2.wav)：同一音效叠加现有 `match3-wechat/res/audio/calm.m4a` 前 25 秒。

本版只使用缓存中的真实录音/真实乐器采样，未使用振荡器、噪声生成、音高变换或电子扫频。离线处理仅做 OGG/M4A→临时 PCM、单声道下混、裁剪、淡入淡出、增益和叠加。临时 PCM 只写入 `/tmp`，不进入小游戏包；本次没有修改 `match3-wechat/js/audio.js`、`package.json` 或运行时 `res/`。

混音基准为 `calm.m4a × 0.62`。只有胜利和失败 cue 开始后的 0.60 秒执行额外 15% duck（×0.85）；没有其他 BGM duck。脚本对最终输出保留 `< 0.90` 峰值安全门槛并拒绝削波。

## Cue 时间表

| 时刻（秒） | 事件 | 采样映射 |
|---:|---|---|
| 0.35 | 点击变体 1 | `ui_ogg/click_1.ogg` |
| 0.90 | 点击变体 2 | `ui_ogg/click_2.ogg` |
| 1.45 | 点击变体 3 | `ui_ogg/click_3.ogg` |
| 2.30 | 交换 | `Interface Sounds/Audio/switch_001.ogg` |
| 2.80 | 掉落 | `Interface Sounds/Audio/drop_003.ogg` |
| 3.35 | 无效 | `ui_ogg/negative_sound2.ogg` |
| 4.10 | 普通消除 | `ui_ogg/Ding.ogg` |
| 5.25 | 连消 | `ui_ogg/chimes.ogg` + `ui_ogg/Ding.ogg`（+0.11 秒） |
| 6.70 | 果冻 | `Impact Sounds/Audio/impactSoft_medium_000.ogg` + `RPG Audio/Audio/cloth2.ogg`（+0.02 秒） |
| 7.75 | 冰块 | `Interface Sounds/Audio/glass_001.ogg` + `Impact Sounds/Audio/impactGlass_light_000.ogg`（+0.03 秒） |
| 8.80 | 火箭 | `RPG Audio/Audio/cloth1.ogg` + `Impact Sounds/Audio/impactSoft_medium_000.ogg`（+0.10 秒） |
| 9.95 | 彩球 | `ui_ogg/ding_deep.ogg` + `ui_ogg/chimes.ogg`（+0.08 秒） |
| 11.10 | 炸弹 | `Impact Sounds/Audio/impactWood_heavy_000.ogg` + `Impact Sounds/Audio/impactSoft_heavy_000.ogg`（+0.02 秒） |
| 11.78 | 锤子 | `Impact Sounds/Audio/impactWood_medium_000.ogg` + `RPG Audio/Audio/cloth2.ogg`（+0.02 秒） |
| 12.35 | 购买 | `RPG Audio/Audio/handleCoins.ogg` + `Interface Sounds/Audio/confirmation_001.ogg`（+0.08 秒） + `ui_ogg/Ding.ogg`（+0.14 秒） |
| 13.70 | PvP 释放冰冻 | `Interface Sounds/Audio/glass_001.ogg` + `Impact Sounds/Audio/impactGlass_medium_000.ogg`（+0.03 秒） |
| 14.25 | PvP 受击冰冻 | `Impact Sounds/Audio/impactGlass_heavy_000.ogg` + `Impact Sounds/Audio/impactSoft_medium_000.ogg`（+0.03 秒） |
| 15.00 | PvP 释放干扰 | `RPG Audio/Audio/cloth1.ogg` + `ui_ogg/chimes.ogg`（+0.10 秒） |
| 15.60 | PvP 受击干扰 | `Impact Sounds/Audio/impactSoft_heavy_000.ogg` + `ui_ogg/negative_sound2.ogg`（+0.02 秒） |
| 17.10 | 胜利 | `ui_ogg/chimes.ogg` + `ui_ogg/Ding.ogg`（+0.18 秒、+0.36 秒） |
| 20.00 | 失败 | `ui_ogg/dum.ogg` + `ui_ogg/negative_sound.ogg`（+0.12 秒） + `ui_ogg/negative_sound2.ogg`（+0.22 秒） |

## 来源与 SHA256

下表是脚本实际读取的缓存原始文件；同一文件被多个 cue 复用时只列一次。UI 包来自 Robin Lamb 的 OpenGameArt 发布，页面标注 CC0，并说明素材来自 VCSL 与 VSCO 2 CE 公共领域采样库；Kenney 三包的官方页面和包内 `License.txt` 均标注 Creative Commons CC0。来源页：[UI Sound Effects / Robin Lamb](https://opengameart.org/content/ui-sound-effects-button-clicks-user-feedback-notifications)、[Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds)、[Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds)、[Kenney RPG Audio](https://kenney.nl/assets/rpg-audio)。

| 缓存包 | 原始文件名 | 许可证 | SHA256 |
|---|---|---|---|
| `sanxiao-ui-acoustic` (`ui_ogg.zip`) | `ui_ogg/click_1.ogg` | CC0 | `bd60e7713a35250f8522a05c7e840adc6eab4f132cef30388ca8b46ca12c3122` |
| `sanxiao-ui-acoustic` (`ui_ogg.zip`) | `ui_ogg/click_2.ogg` | CC0 | `da523b03e042dde09cf4633615a42ad733cfb35899c5863b0cb9486269c78cd9` |
| `sanxiao-ui-acoustic` (`ui_ogg.zip`) | `ui_ogg/click_3.ogg` | CC0 | `deb8780085bd83a16bcfc8b1fae3a37e12bc7d6f667aef8830f214f1b82207f2` |
| `sanxiao-ui-acoustic` (`ui_ogg.zip`) | `ui_ogg/Ding.ogg` | CC0 | `bc69b15effae9314e8afb86229bb83acdab6afd79d552b786f53a4812d902980` |
| `sanxiao-ui-acoustic` (`ui_ogg.zip`) | `ui_ogg/chimes.ogg` | CC0 | `bb9c1826553beb87e47a534f9608a7dcd236614bb6194f4323d4661df81e895e` |
| `sanxiao-ui-acoustic` (`ui_ogg.zip`) | `ui_ogg/ding_deep.ogg` | CC0 | `7e61202079948a5bb7bb6bb37f22d3d367abdcfb9afd73a52e6f883a93de24be` |
| `sanxiao-ui-acoustic` (`ui_ogg.zip`) | `ui_ogg/dum.ogg` | CC0 | `5a6db933faefdde2572a23f41ab5f64912ef1c60cd5f8c4ab1ee5d03b04ea009` |
| `sanxiao-ui-acoustic` (`ui_ogg.zip`) | `ui_ogg/negative_sound.ogg` | CC0 | `c10a93a33e795d7e078e7dfe1baeb0fbe75e19fc65cb2e016a8ebe0b41be3745` |
| `sanxiao-ui-acoustic` (`ui_ogg.zip`) | `ui_ogg/negative_sound2.ogg` | CC0 | `a068c1a2a375149da67bb8e547079987800b1ce21debb7f51ca556eeeaabd56a` |
| `kenney-interface` (`Interface Sounds 1.0`) | `Audio/switch_001.ogg` | CC0 | `3b74efad87f1e69dbd1d05c5ad952ab90859b5a3d11da6ec5bd79b4f03b42afa` |
| `kenney-interface` (`Interface Sounds 1.0`) | `Audio/drop_003.ogg` | CC0 | `43d086d50f90493a98cd2e09aa6dbf150d164f1578e1ec768d21cb185571ad87` |
| `kenney-interface` (`Interface Sounds 1.0`) | `Audio/glass_001.ogg` | CC0 | `183eebee20eb0a532b0b85104d139cbf2673eb66d95c3cc733ac9ea98362e7e8` |
| `kenney-interface` (`Interface Sounds 1.0`) | `Audio/confirmation_001.ogg` | CC0 | `063564703b6094d70718a3e787a55cc9141611e4ecd6b6637f8828f79b4a8c3a` |
| `kenney-impact` (`Impact Sounds 1.0`) | `Audio/impactSoft_medium_000.ogg` | CC0 | `7d3ba0bb5e60a11b5d3e558c141303dcf494256675fbf753c0d252d2cf0481e3` |
| `kenney-impact` (`Impact Sounds 1.0`) | `Audio/impactSoft_heavy_000.ogg` | CC0 | `49e7ca88743fca974bb8676ea138b751cfd8f9033b5e7af8736c2a215d6edbc1` |
| `kenney-impact` (`Impact Sounds 1.0`) | `Audio/impactWood_medium_000.ogg` | CC0 | `1723a9fd25103ed41af06054814e84e65f4a772bac86ab2dc927da93d9592ff5` |
| `kenney-impact` (`Impact Sounds 1.0`) | `Audio/impactWood_heavy_000.ogg` | CC0 | `15ff82332f342c30e469215539e1cc57e11b221aa2cf7e11e811d313a9927f3d` |
| `kenney-impact` (`Impact Sounds 1.0`) | `Audio/impactGlass_light_000.ogg` | CC0 | `d750cf88097d0c3e69920e6e14496e1444e1a9da01aa4cca8f5ec8cb44c57b4f` |
| `kenney-impact` (`Impact Sounds 1.0`) | `Audio/impactGlass_medium_000.ogg` | CC0 | `9252d50bfb85edb17d6073c4a7806e10cdb9de56d3dbfc93a4b9727146d2df6d` |
| `kenney-impact` (`Impact Sounds 1.0`) | `Audio/impactGlass_heavy_000.ogg` | CC0 | `b44b39a940e8948e74b9bd3776bff980df43cf220abdaf0d467dc4c43c0244a5` |
| `kenney-rpg` (`RPG Audio 1.0`) | `Audio/handleCoins.ogg` | CC0 | `8a91f969e932df709df80ee124d86a51389eed9b67f22e5e716bc2bbf60d8dab` |
| `kenney-rpg` (`RPG Audio 1.0`) | `Audio/cloth1.ogg` | CC0 | `ddb93a3671233f95da0e0b10367f082f7eb42fa6caaddcf776410aa8833c747d` |
| `kenney-rpg` (`RPG Audio 1.0`) | `Audio/cloth2.ogg` | CC0 | `8a7451193c38bc05483aec25dd193e163a15d44cf7fff04ac7912573231b0201` |

混音输入另记录：项目现有 `match3-wechat/res/audio/calm.m4a`，来源为 Dylann Taylor 的 [PLAYFUL PIANO](https://dylanntaylor.itch.io/playful-piano) `PlayfulPiano_Atmos_Loop.ogg`，CC0；其当前文件 SHA256 为 `85944c9be34900792033e01ef920be1cb323e18531092caa31fa2fc0c5330cff`。该文件只用于试听混音，不复制、不替换运行时资源。

## 生成与自检

```sh
python3 match3-wechat/tools/gen-sfx-acoustic-preview.py
```

脚本会检查输入存在、输出为精确 25 秒/22050 Hz/16-bit/mono，并打印峰值、RMS 和削波状态。源文件是 OGG，重生成环境需提供 `ffmpeg`；脚本会在系统 CoreAudio 支持时尝试 `afconvert`，不支持时给出明确安装提示。`ffmpeg` 与原始压缩包只属于离线制作环境，不进入仓库依赖或小游戏包。交付自检已确认两份输出 SHA256 不同、`git diff --check` 通过。

确认试听后已接入运行时：`--runtime-only` 生成 `match3-wechat/res/audio/sfx-acoustic.m4a` 和 `match3-wechat/js/sfx-acoustic-map.js`。当前精灵包含 21 个 cue，时长 8.380 秒，22050 Hz 单声道，33,996 bytes，SHA256 为 `572b4bdfb098f856a8844297cf6fb06a226ef48f1bac4d3d681324e68ec947dc`；WAV 生成阶段峰值 0.596130，无削波。试听 WAV 仍只作设计审核，不进入小游戏运行时包。
