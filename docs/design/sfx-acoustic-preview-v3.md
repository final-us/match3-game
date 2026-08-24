# 原声音效方案 V3 试听

状态：仅供听感确认，尚未替换运行时音效精灵或事件逻辑。

## 试听文件

- `sfx-acoustic-preview-mixed-v3.wav`：推荐审核，按游戏当前 BGM `0.52`、SFX master `0.48` 混合。
- `sfx-acoustic-preview-v3.wav`：无背景音乐版本，便于单独检查音色。

两份文件均为 26 秒、22050 Hz、16-bit、单声道；混合版峰值 `0.485875`，无削波。纯音效版 SHA256 为 `045c92632dc1fc671854a702b991becc03412a27f965991b705e74d621a289b7`，混合版 SHA256 为 `3fa0e1e6d0bb514add515fea9bb387c6c1b4f5734689be60915f681865882c3d`。

## 时间轴

| 时间 | 内容 |
| ---: | --- |
| 0.55s | 普通消除 |
| 2.10s | 2 连：单个温暖铃音 |
| 3.55s | 3 连：双音上行 |
| 5.00s | 4 连：三音上行 |
| 6.45s | 5 连：四音上行与轻微风铃尾音 |
| 7.95s | 6 连：五音短庆祝句与轻微风铃尾音 |
| 10.25s | 单独火箭：布料掠过、柔化切风与清脆落点 |
| 12.20s | 单独炸弹：低频软冲击与温暖铃音尾声 |
| 14.15s | 单独彩球：四音魔法铃音与风铃尾声 |
| 17.10s | 2 个特殊棋子连锁：一次冲击与双音尾声 |
| 20.10s | 3 个特殊棋子连锁：一次冲击与三音尾声 |
| 23.10s | 4 个以上特殊棋子连锁：一次冲击与四音尾声 |

连消 2–6 的 1 秒窗口 RMS 依次为 `0.0291 / 0.0394 / 0.0483 / 0.0562 / 0.0626`，强度严格递增；这次不再通过重复同一段完整 combo cue 制造差异。特殊棋子连锁也只保留一次主冲击，不叠放多个完整爆炸声。

## 来源与处理

继续只使用已核验的 CC0 来源：[Robin Lamb / OpenGameArt UI Sound Effects](https://opengameart.org/content/ui-sound-effects-button-clicks-user-feedback-notifications)、[Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds)、[Kenney RPG Audio](https://kenney.nl/assets/rpg-audio)。本轮没有新增授权来源。

| 原始文件 | 用途 | SHA256 |
| --- | --- | --- |
| `ui_ogg/Ding.ogg` | 普通消除、火箭落点 | `bc69b15effae9314e8afb86229bb83acdab6afd79d552b786f53a4812d902980` |
| `ui_ogg/ding_deep.ogg` | 连消音阶、炸弹和彩球尾音 | `7e61202079948a5bb7bb6bb37f22d3d367abdcfb9afd73a52e6f883a93de24be` |
| `ui_ogg/chimes.ogg` | 高级连消与彩球轻尾音 | `bb9c1826553beb87e47a534f9608a7dcd236614bb6194f4323d4661df81e895e` |
| `ui_ogg/dum.ogg` | 炸弹与连锁的柔和低频主体 | `5a6db933faefdde2572a23f41ab5f64912ef1c60cd5f8c4ab1ee5d03b04ea009` |
| `RPG Audio/Audio/cloth3.ogg` | 火箭布料掠过 | `a48632d17a4f1416541d261a32a31612e01267144c407fa3ecab3ff410f0085b` |
| `RPG Audio/Audio/knifeSlice.ogg` | 火箭切风，离线低通柔化 | `4cd96dc630bed9840c15f1dd2306da2cc56a4da26a5d3f1a03c5a7265ac5e54f` |
| `Impact Sounds/Audio/impactSoft_medium_001.ogg` | 炸弹与连锁软冲击 | `7642a4fd43e547afe4f7adfadb3dabb681c0ff512f52c1674bae30a726841faf` |

连消音阶由同一真实 `ding_deep` 采样离线移调 `0 / +3 / +5 / +7 / +12` 半音，保持统一原声质感；不使用振荡器、芯片音色或运行时变调。火箭切风只做低通，其他处理为裁切、淡入淡出、增益和分层混合。临时 FFmpeg 解码工具只存在于 `/tmp`，不进入仓库、项目依赖或发布包。
