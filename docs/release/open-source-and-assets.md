# 开源与素材合规台账

## 项目版权边界

- 仓库继续公开，但公开仓库不等于开源许可。
- 本项目代码、文档和自有素材不添加项目级开源许可证，保留默认版权；不得把整个项目表述为 MIT 或其他开源项目。
- 第三方通知随小游戏主包保存在 [`match3-wechat/THIRD_PARTY_NOTICES.txt`](../../match3-wechat/THIRD_PARTY_NOTICES.txt)。该文件只记录第三方授权，不改变项目本身的版权边界。
- `node_modules/` 仅用于本地依赖验证，不加入 Git。

## 第三方组件与调研来源

| 组件/来源 | 版本或精确信息 | 许可证/状态 | 采用范围与处置 |
| --- | --- | --- | --- |
| [pixi-game-match3](https://github.com/xiaozhu188/pixi-game-match3) | commit `658679250f30ef8d01ff570eb976017c5727cbf0`；`src/match3/Match3Utility.ts` | MIT；版权行见主包 notice | 仅采用三消棋盘工具逻辑的本地适配，详见 `match3-wechat/js/core/grid.js` 与 notice；不是整个项目的许可证。 |
| `wx-server-sdk` | `4.0.2`，直接依赖于 `match3-wechat/cloudfunctions/battle` | MIT（以官方包与 package-lock.json 记录为准） | 仅随云函数部署使用；其 MIT 声明不自动覆盖许可证元数据未声明的独立传递包。 |
| 云函数 `package-lock.json` | 102 个依赖记录 | MIT 71；BSD-3-Clause 13；Apache-2.0 10；ISC 4；BlueOak-1.0.0 1；0BSD 1；UNDECLARED 2 | 客户端主包不包含 `cloudfunctions/`，但云函数部署会带入这些依赖。未声明项为 `@cloudbase/signature-nodejs@2.2.0` 与 `@cloudbase/wx-cloud-client-sdk@1.7.1`：二者的 npm 元数据和安装包均没有 license 声明或 LICENSE 文件。产品负责人决定继续采用腾讯官方依赖链，将二者登记为“厂商依赖例外”并接受残余商业合规风险；不虚构许可证、不复制或魔改签名代码，也不提交外部澄清请求。该例外不构成对二者授予 MIT 许可的声明。 |
| [PLAYFUL PIANO](https://dylanntaylor.itch.io/playful-piano) | 作者 Dylann Taylor；`PlayfulPiano_Atmos_Loop.ogg`、`PlayfulPiano_JazzTrio_Loop.ogg`；CC0 1.0 Universal | 允许商业使用、随游戏发布及编辑/循环/混音；不主张本项目拥有作曲权。采用完整 loop 并转换为本地 AAC/M4A，不单独再分发源音频。 |
| [UI Sound Effects](https://opengameart.org/content/ui-sound-effects-button-clicks-user-feedback-notifications) | 发布者 Robin Lamb；页面标注 CC0；素材说明来源于 VCSL 与 VSCO 2 CE 公共领域采样库 | 采用 9 个点击、提示、铃声与负反馈 OGG 片段，离线裁切、包络、增益和叠加后并入 `sfx-acoustic.m4a`；不捆绑原始压缩包。 |
| [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | Interface Sounds 1.0；包内 `License.txt` 与官方页均标注 CC0 | 采用 4 个开关、掉落、玻璃和确认采样片段，仅并入最终音效精灵。 |
| [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) | Impact Sounds 1.0；包内 `License.txt` 与官方页均标注 CC0 | 采用 7 个软碰撞、木质和玻璃碰撞采样片段，仅并入最终音效精灵。 |
| [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) | RPG Audio 1.0；包内 `License.txt` 与官方页均标注 CC0 | 采用 3 个金币与布料采样片段，仅并入最终音效精灵。 |
| Freesound 特殊棋子采样 | [Kinoton 火箭](https://freesound.org/people/Kinoton/sounds/347163/)、[animationIsaac 爆破](https://freesound.org/people/animationIsaac/sounds/207322/)、[reasanka 金属琴](https://freesound.org/people/reasanka/sounds/429525/)、[qubodup 音乐盒魔法音](https://freesound.org/people/qubodup/sounds/817466/)；页面均标注 CC0 | 前三项分别用于 V4 火箭、炸弹和彩球独立 one-shot；第四项用于 V7 统一特殊组合 cue。批准离线输入固化在 `docs/design/audio-sources/`，不进入小游戏主包。 |
| [WeChat Mini Game QuickStart](https://github.com/wechat-miniprogram/miniprogram-game-quickstart) | `master`，2026-08-23 调研；MIT | 仅作小游戏音频架构与 `InnerAudioContext`/生命周期 API 使用方式参考；未复制其音频、产品内容或可识别实现。 |
| ZzFX / Jfxr | 公开的程序化音效与离线音效工具；仅调研 | 只作为合成音色与离线工具思路参考；未提取代码、未复制预设或音频，客户端没有其运行时依赖。 |
| Tone.js / Howler.js / SoundBox | 仅评估，未采用 | Tone.js 与 Howler.js 对当前少量原生音频需求增加不必要运行时和包体；SoundBox 的播放器/歌曲格式也未进入项目。当前直接复用微信本地音频 API 与既有 WebAudio 适配层。 |
| `imageio-ffmpeg` / FFmpeg | `imageio-ffmpeg 0.6.0` 临时下载的 FFmpeg 7.1 macOS arm64 二进制；包装器 BSD-2-Clause，所用二进制为 GPL build | 仅在本地 `/tmp` 把 PLAYFUL PIANO OGG 转为当前正式 AAC/M4A；`match3-wechat/tools/gen-audio.py` 仅保留为历史/回退程序化 BGM 工具，不生成当前正式素材；工具及其代码、许可证文件均不进入仓库、运行时或发布包。 |
| Gem-Match3 | CC BY-NC-ND 4.0；仅做过调研 | 拒绝复用 | 未复制代码、素材或其他可识别内容；因商业使用与禁止演绎限制，不进入项目或发布包。公开 README 不引用该名称。 |

## 当前发布素材

以下 27 张是 `js/render/assets.js` 当前完整注册的活跃素材，来源均记录为本项目内 Codex/OpenAI ImageGen 生成：

本地文件时间可佐证的制作批次为：首页 5 张生成于 2026-08-20（Asia/Shanghai），游戏场景与 512×512 棋子源图生成于 2026-08-22，256×256 运行图于 2026-08-22 使用 macOS `sips` 从对应源图缩放生成。这些时间只作为仓库内制作记录，不替代生成服务的原始任务记录或账户授权证明。

### 首页素材（5 张）

| 发布路径 | 来源记录 |
| --- | --- |
| `res/home/moonlit-garden-bg.jpg` | 本项目内 Codex/OpenAI ImageGen 生成 |
| `res/home/duel-cats.png` | 本项目内 Codex/OpenAI ImageGen 生成 |
| `res/home/title-logo.png` | 本项目内 Codex/OpenAI ImageGen 生成 |
| `res/home/button-primary.png` | 本项目内 Codex/OpenAI ImageGen 生成 |
| `res/home/button-secondary.png` | 本项目内 Codex/OpenAI ImageGen 生成 |

### 游戏场景（2 张）

| 发布路径 | 来源记录 |
| --- | --- |
| `res/game-background-v2.jpg` | 本项目内 Codex/OpenAI ImageGen 生成 |
| `res/level-background-v2.jpg` | 本项目内 Codex/OpenAI ImageGen 生成 |

### 运行时棋子（5 张）

| 发布路径 | 来源记录 |
| --- | --- |
| `res/piece1-runtime.png` | 对应 `res/piece1-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |
| `res/piece2-runtime.png` | 对应 `res/piece2-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |
| `res/piece3-runtime.png` | 对应 `res/piece3-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |
| `res/piece4-runtime.png` | 对应 `res/piece4-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |
| `res/piece5-runtime.png` | 对应 `res/piece5-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |

### 统一 UI 运行图（15 张）

| 发布路径 | 来源记录 |
| --- | --- |
| `res/ui/coin.png` | 本项目内 Codex/OpenAI ImageGen 生成，512px 设计源图见 `docs/design/generated-assets/coin.png` |
| `res/ui/heart.png` | 本项目内 Codex/OpenAI ImageGen 生成，512px 设计源图见 `docs/design/generated-assets/heart.png` |
| `res/ui/shop.png` | 本项目内 Codex/OpenAI ImageGen 生成，512px 设计源图见 `docs/design/generated-assets/shop.png` |
| `res/ui/settings.png` | 本项目内 Codex/OpenAI ImageGen 生成，512px 设计源图见 `docs/design/generated-assets/settings.png` |
| `res/ui/timer.png` | 本项目内 Codex/OpenAI ImageGen 生成，512px 设计源图见 `docs/design/generated-assets/timer.png` |
| `res/ui/moves-paw.png` | 本项目内 Codex/OpenAI ImageGen 生成，512px 设计源图见 `docs/design/generated-assets/moves-paw.png` |
| `res/ui/tool-hammer.png` | 本项目内 Codex/OpenAI ImageGen 生成，512px 设计源图见 `docs/design/generated-assets/tool-hammer.png` |
| `res/ui/tool-bomb.png` | 本项目内 Codex/OpenAI ImageGen 生成，512px 设计源图见 `docs/design/generated-assets/tool-bomb.png` |
| `res/ui/tool-yarn.png` | 本项目内 Codex/OpenAI ImageGen 生成，512px 设计源图见 `docs/design/generated-assets/tool-yarn.png` |
| `res/ui/result-happy-cat.png` | 本项目内 Codex/OpenAI ImageGen 生成，512px 设计源图见 `docs/design/generated-assets/result-happy-cat.png` |
| `res/ui/result-sad-cat.png` | 本项目内 Codex/OpenAI ImageGen 生成，512px 设计源图见 `docs/design/generated-assets/result-sad-cat.png` |
| `res/ui/special-row-beam.png` | 本项目内 Codex/OpenAI ImageGen 生成，设计源图见 `docs/design/generated-assets/special-row-beam.png` |
| `res/ui/level-node-current-v2.png` | 本项目内 Codex/OpenAI ImageGen 生成，设计源图见 `docs/design/generated-assets/level-nodes/level-node-current-source.png` |
| `res/ui/level-node-done-v2.png` | 本项目内 Codex/OpenAI ImageGen 生成，设计源图见 `docs/design/generated-assets/level-nodes/level-node-done-source.png` |
| `res/ui/level-node-locked-v2.png` | 本项目内 Codex/OpenAI ImageGen 生成，设计源图见 `docs/design/generated-assets/level-nodes/level-node-locked-source.png` |

首批 12 张 UI 运行图于 2026-08-23 使用 macOS `sips` 缩放，再用 Pillow 12.3.0 进行 128 色透明 PNG 优化；三张关卡节点在同日使用内置 ImageGen 生成透明源图，再由 `sips` 缩放至最长边 256px。完整提示摘要和派生记录见 `docs/design/generated-assets/README.md`。

### 主包 PNG 无损优化记录（2026-08-23）

按 `project.config.json` 的 `packOptions.ignore` 筛选出的 24 张主包 PNG，逐张先写入系统临时目录，使用 Pillow 12.3.0、`optimize=True`、`compress_level=9`；重新打开候选文件并校验尺寸、mode 和 RGBA 逐像素完全一致后才替换原文件。12 张无字节收益的候选保留原文件。

| 发布路径 | 优化前字节 | 优化后字节 | 节省字节 |
| --- | ---: | ---: | ---: |
| `res/home/button-primary.png` | 208,795 | 167,417 | 41,378 |
| `res/home/button-secondary.png` | 214,487 | 172,084 | 42,403 |
| `res/home/duel-cats.png` | 501,184 | 434,404 | 66,780 |
| `res/home/title-logo.png` | 242,606 | 212,973 | 29,633 |
| `res/piece1-runtime.png` | 92,827 | 80,073 | 12,754 |
| `res/piece2-runtime.png` | 94,030 | 81,067 | 12,963 |
| `res/piece3-runtime.png` | 76,440 | 63,318 | 13,122 |
| `res/piece4-runtime.png` | 93,125 | 80,443 | 12,682 |
| `res/piece5-runtime.png` | 95,770 | 82,872 | 12,898 |
| `res/ui/coin.png` | 6,363 | 6,363 | 0 |
| `res/ui/heart.png` | 3,973 | 3,973 | 0 |
| `res/ui/level-node-current-v2.png` | 91,432 | 79,304 | 12,128 |
| `res/ui/level-node-done-v2.png` | 93,264 | 81,689 | 11,575 |
| `res/ui/level-node-locked-v2.png` | 91,917 | 83,929 | 7,988 |
| `res/ui/moves-paw.png` | 6,640 | 6,640 | 0 |
| `res/ui/result-happy-cat.png` | 21,867 | 21,867 | 0 |
| `res/ui/result-sad-cat.png` | 23,229 | 23,229 | 0 |
| `res/ui/settings.png` | 5,390 | 5,390 | 0 |
| `res/ui/shop.png` | 6,616 | 6,616 | 0 |
| `res/ui/special-row-beam.png` | 6,236 | 6,236 | 0 |
| `res/ui/timer.png` | 6,510 | 6,510 | 0 |
| `res/ui/tool-bomb.png` | 7,398 | 7,398 | 0 |
| `res/ui/tool-hammer.png` | 6,414 | 6,414 | 0 |
| `res/ui/tool-yarn.png` | 7,293 | 7,293 | 0 |
| **合计** | **2,003,806** | **1,727,502** | **276,304** |

本台账不编造 prompt ID、账户标识或账户条款。发布前必须由运营主体确认生成账户适用条款允许目标商业使用，并确保原始生成记录可追溯；在确认完成前，不应把来源状态解释为已完成商业授权审查。

Holopix 当前未采用，暂不进入发布包。

## 非发布素材与其他媒体

`res/piece1-v2.png` 至 `res/piece5-v2.png` 是上述运行时棋子的 512×512 ImageGen 源图，来源已记录；它们仅因包体体积被排除，不属于来源待确认的旧素材，也不得直接恢复到运行时引用。需要重新导出运行图时，应继续从这些源图生成并记录派生过程。

除上述 5 张棋子源图外，当前被忽略或未被 `assets.js` 引用的旧素材均标记为：非发布素材、来源待确认、不得重新启用。未经重新完成来源核验和发布审查，不得重新加入 `assets.js` 或取消对应包体忽略规则。

当前包括：

```text
res/btnBack.png
res/btnClose.png
res/btnContinue.png
res/btnRefresh.png
res/btnStart.png
res/coinBar.png
res/goalBar.png
res/heartBar.png
res/levelBadge.png
res/movesBadge.png
res/navBar.png
res/nodeCurrent.png
res/nodeDone.png
res/nodeLocked.png
res/piece1.png
res/piece2.png
res/piece3.png
res/piece4.png
res/piece5.png
res/progressBar.png
res/toolBar.png
```

### 第三方循环音乐（2 首）

| 发布路径 | 来源记录 |
| --- | --- |
| `res/audio/calm.m4a` | Dylann Taylor / PLAYFUL PIANO 的 `PlayfulPiano_Atmos_Loop.ogg`；完整 51.20 秒；AAC-LC/M4A，22050 Hz，单声道，24,000 bit/s；159,820 bytes。 |
| `res/audio/battle.m4a` | Dylann Taylor / PLAYFUL PIANO 的 `PlayfulPiano_JazzTrio_Loop.ogg`；完整 51.20 秒；AAC-LC/M4A，22050 Hz，单声道，24,000 bit/s；160,085 bytes。 |

两首 BGM 均完整保留源文件 51.20 秒 loop，仅做 OGG→AAC-LC/M4A、22050 Hz、单声道及响度协调（calm +3 dB、battle +0.5 dB）；双文件合计 319,905 bytes，低于 360 KiB。当前正式素材不是本项目原创；CC0 仅适用于该音乐，不改变项目代码、文档和自有素材的默认版权边界。

### 第三方原声音效精灵

| 发布路径 | 来源与处理记录 |
| --- | --- |
| `res/audio/sfx-acoustic.m4a` | Robin Lamb/OpenGameArt、Kenney 与 Freesound 的 CC0 采样。22 个事件，10.797 秒，AAC/M4A、22050 Hz、单声道、42,325 bytes；SHA256 `c199ca1193150ea0c950abfde37cd3094a70029e2ff74692a2e7397b4049915c`。 |

正式音效仅包含上述最终精灵；完整第三方源包和临时工具只在本地 `/tmp` 使用，四个批准的特殊棋子离线输入保存在 `docs/design/audio-sources/`，均位于小游戏主包目录之外。处理包含解码、单声道混合、裁切、淡入淡出、滤波、动态压缩、保持音高的时长压缩、增益、分层叠加、事件间隔拼接和 AAC 压缩。运行时一次读取并解码精灵，按 `js/sfx-acoustic-map.js` 的偏移和时长播放；最多同时播放 12 声。同次 match 触发至少两个特殊棋子时只播放一次统一 V7 cue，并抑制该 payload 的普通消除、生成特殊、独立触发特殊和障碍音；单特殊继续播放独立 V4 cue。精灵不可用时组合只执行一次单音合成回退。胜负音效会把本地 BGM 压低 15% 约 0.6 秒，其他音效不触发压低。

保留 cue 的原始文件名与 SHA256 见 `docs/design/sfx-acoustic-preview-v2.md`；最终 22 cue 映射、新增源文件 SHA256 和派生方式见 `docs/design/sfx-acoustic-runtime-v8.md`。`tools/gen-sfx-acoustic-preview.py --runtime-only` 是离线派生工具，不引入客户端依赖；项目没有捆绑第三方字体或第三方音频运行时依赖。

`match3-wechat/tools/gen-audio.py` 作为历史/回退工具保留；它生成旧的程序化示例，不生成当前正式 BGM，不能作为正式素材来源记录。

## 上线前检查项

- [ ] 复核项目仍未添加项目级开源许可证，公开仓库描述没有把整个项目写成 MIT，并保留默认版权边界。
- [ ] 复核 `THIRD_PARTY_NOTICES.txt` 的上游 URL、精确 commit、采用文件和完整 MIT 文本与 `grid.js` 本地修改一致。
- [ ] 复核两项 `UNDECLARED` 腾讯传递依赖仍被准确登记为“厂商依赖例外”，并保留产品负责人接受残余风险、不提交外部澄清请求的决策记录；不得把二者误写为 MIT。
- [ ] 由运营主体确认 Codex/OpenAI ImageGen 生成账户适用条款与目标商业使用相容，并保存可追溯的原始生成记录；不得补写未经证实的 prompt ID、账户或条款。
- [ ] 确认 Holopix 未被 `assets.js`、包体或发布流程采用。
- [ ] 运行 `node match3-wechat/test/open-source-and-assets.js` 和 `node match3-wechat/test/package-budget.js`；确认 27 张活跃素材存在且未被忽略，notice 文件仍在小游戏主包。
- [ ] 确认旧素材仍保持非发布、来源待确认、不得重新启用；确认 `node_modules/` 未加入 Git。
- [ ] 确认 512×512 棋子源图仍只作可追溯源文件使用，256×256 运行图的派生方式与日期有记录。
- [ ] 运行 `node match3-wechat/test/audio.js`、`node match3-wechat/test/package-budget.js`、`node match3-wechat/test/open-source-and-assets.js`，并用音频工具复核两首正式 BGM 的 51.20 秒、AAC-LC、22050 Hz、单声道元数据与实际总字节；`gen-audio.py` 不用于生成正式素材。
- [ ] 复核 `sfx-acoustic.m4a` 的 22 个 cue、10.797 秒、42,325 bytes 与 SHA256；真机确认 V4 三种单特殊、V7 多特殊组合仅一次播放，以及冷启动首个点击、连续消除、三种单人道具、PvP 冰冻/干扰、胜负 BGM duck、后台恢复和关闭音效均正常。
- [ ] 按微信官方当前发布、隐私、素材和云函数要求完成运营主体复核与真机/开发者工具包体检查。
