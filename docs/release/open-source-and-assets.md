# 开源与素材合规台账

## 项目版权边界

- 仓库继续公开，但公开仓库不等于开源许可。
- 本项目代码、文档和自有素材不添加项目级开源许可证，保留默认版权；不得把整个项目表述为 MIT 或其他开源项目。
- 第三方通知随小游戏主包保存在 [`match3-wechat/THIRD_PARTY_NOTICES.txt`](../../match3-wechat/THIRD_PARTY_NOTICES.txt)。该文件只记录第三方授权，不改变项目本身的版权边界。
- `node_modules/` 仅用于本地依赖验证，不加入 Git。
- `assets/_incoming/` 是本地制作档案，不随公开 Git 分发；包含供应商输出/记录、未采用候选及第三方试听参考。下文对此目录的路径均为本地追溯位置，不是公开下载承诺。已采用游戏图片和原创 BGM 随 `match3-wechat/res/` 提交；含 Mixkit 的 `sfx-acoustic.mp3` 另按许可只保留本地终端发布副本。

## 第三方组件与调研来源

| 组件/来源 | 版本或精确信息 | 许可证/状态 | 采用范围与处置 |
| --- | --- | --- | --- |
| [pixi-game-match3](https://github.com/xiaozhu188/pixi-game-match3) | commit `658679250f30ef8d01ff570eb976017c5727cbf0`；`src/match3/Match3Utility.ts` | MIT；版权行见主包 notice | 仅采用三消棋盘工具逻辑的本地适配，详见 `match3-wechat/js/core/grid.js` 与 notice；不是整个项目的许可证。 |
| `wx-server-sdk` | `4.0.2`，直接依赖于 `match3-wechat/cloudfunctions/battle` | MIT（以官方包与 package-lock.json 记录为准） | 仅随云函数部署使用；其 MIT 声明不自动覆盖许可证元数据未声明的独立传递包。 |
| 云函数 `package-lock.json` | 102 个依赖记录 | MIT 71；BSD-3-Clause 13；Apache-2.0 10；ISC 4；BlueOak-1.0.0 1；0BSD 1；UNDECLARED 2 | 客户端主包不包含 `cloudfunctions/`，但云函数部署会带入这些依赖。未声明项为 `@cloudbase/signature-nodejs@2.2.0` 与 `@cloudbase/wx-cloud-client-sdk@1.7.1`：二者的 npm 元数据和安装包均没有 license 声明或 LICENSE 文件。产品负责人决定继续采用腾讯官方依赖链，将二者登记为“厂商依赖例外”并接受残余商业合规风险；不虚构许可证、不复制或魔改签名代码，也不提交外部澄清请求。该例外不构成对二者授予 MIT 许可的声明。 |
| ElevenLabs | Starter；`music_v1`、`eleven_text_to_sound_v2`；2026-09-09 至 2026-09-10 | 付费套餐输出；当日官方价格页标示 Starter+ 音乐可商用、音效 royalty-free；当日条款说明付费用户可商用且用户与供应商之间保留输出权，但输出不保证唯一 | 采用用户确认的两首原创 BGM、16 个生成 cue，另由已确认点击生成两个本地变体；只提交原创文字提示，没有上传项目文件或参考素材。完整生成与费用记录位于 `assets/_incoming/audio-elevenlabs-20260909-match3-v9-pilot/`。 |
| PLAYFUL PIANO、Robin Lamb UI Sound Effects、Kenney Interface/Impact/RPG | 原正式 CC0 音频来源 | 仅保留为历史与可回滚输入，不再进入当前发布 MP3 | 旧 M4A 由 `project.config.json` 精确排除；不得误计为当前发布音频。 |
| Freesound 特殊棋子采样 | [Kinoton 火箭](https://freesound.org/people/Kinoton/sounds/347163/)、[animationIsaac 爆破](https://freesound.org/people/animationIsaac/sounds/207322/)、[qubodup 音乐盒魔法音](https://freesound.org/people/qubodup/sounds/817466/)；页面均标注 CC0 | 当前仅炸弹继续使用；火箭已由Mixkit替代，旧统一组合声只归档。批准离线输入固化在 `docs/design/audio-sources/`，不进入小游戏主包。 |
| [WeChat Mini Game QuickStart](https://github.com/wechat-miniprogram/miniprogram-game-quickstart) | `master`，2026-08-23 调研；MIT | 仅作小游戏音频架构与 `InnerAudioContext`/生命周期 API 使用方式参考；未复制其音频、产品内容或可识别实现。 |
| ZzFX / Jfxr | 公开的程序化音效与离线音效工具；仅调研 | 只作为合成音色与离线工具思路参考；未提取代码、未复制预设或音频，客户端没有其运行时依赖。 |
| Tone.js / Howler.js / SoundBox | 仅评估，未采用 | Tone.js 与 Howler.js 对当前少量原生音频需求增加不必要运行时和包体；SoundBox 的播放器/歌曲格式也未进入项目。当前直接复用微信本地音频 API 与既有 WebAudio 适配层。 |
| `mpg123-decoder` / `wasm-media-encoders` | 1.0.3 / 0.7.0；MIT | 仅在 `/private/tmp` 离线解码供应商 MP3、生成 PCM 及编码最终 MP3；没有加入 package.json、仓库、运行时或发布包。 |
| `imageio-ffmpeg` / FFmpeg | `imageio-ffmpeg 0.6.0` 临时下载的 FFmpeg 7.1 macOS arm64 二进制；包装器 BSD-2-Clause，所用二进制为 GPL build | 仅用于历史正式音频转换；2026-09-15采纳的新21cue精灵也使用已有FFmpeg7.1/libmp3lame离线重编码。工具及其代码、许可证文件均不进入仓库、运行时或发布包。 |
| Gem-Match3 | CC BY-NC-ND 4.0；仅做过调研 | 拒绝复用 | 未复制代码、素材或其他可识别内容；因商业使用与禁止演绎限制，不进入项目或发布包。公开 README 不引用该名称。 |

## 当前发布素材

### 本地 B 视觉候选覆盖（2026-09-12，尚未发布）

2026-09-13 地图/结算最新覆盖：`res/level-background-v2.jpg`为独立云海玻璃阶梯640×1384背景；`res/ui/result-happy-cat.png`、`res/ui/result-sad-cat.png`为新320×320真透明角色（单人及PvP共用）。内置ImageGen各生成一次，猫图checker-alpha保留原生alpha并经白/深底检查，确定性缩放。完整来源/提示/透明报告/hash/备份与运行映射见assets/_incoming/moon-ui-runtime/map-results/README.md。地图节点改为原生Canvas，旧三枚节点PNG仍注册保留但地图不绘制。本批本地待验收，未上线；下方早期来源表对此三文件仅作历史来源。商店/设置/道具前批现已获用户确认。

2026-09-13 支持页道具更新：`res/ui/tool-hammer.png`、`res/ui/tool-bomb.png`、`res/ui/tool-yarn.png` 替换为B低饱和珍珠材质160×160透明图。内置ImageGen单件生成，原生alpha保留/确定性缩放，未新增外部上传。完整提示、源文件、checker-alpha报告/hash、旧图备份和运行验证见 assets/_incoming/moon-ui-runtime/support-polish/README.md。下表原512px设计图对此三枚仅作历史来源；本地待验收，未上线。

2026-09-13 按钮图标精修：新增 `res/home/duel-heads.png`（256×171绒毛双猫），替换 `res/ui/shop.png` / `res/ui/settings.png`（144×144珍珠金边图标）。三张由内置 ImageGen 生成，checker-alpha 返回 already_has_alpha，白/深底检查后仅缩放、保留原生alpha。完整提示与原始任务路径见 assets/_incoming/moon-ui-runtime/button-polish/provenance.json，各alpha目录保留报告/hash；旧资源在previous，尚待用户视觉验收。按钮底板、文字、猫形副入口与金边细雕仍为Canvas。

2026-09-13 标题最新来源：res/home/title-logo.png 为新云朵铭牌/蝴蝶结 ImageGen 稿，经用户单独批准的本地精细蒙版后缩放748×374；source/output/runtime hash与提示见 assets/_incoming/moon-ui-runtime/title-contour/provenance.json。原生按钮与页脚形状直接由Canvas绘制，不增加外部下载美术。

2026-09-13 双猫最新来源：用户否决卡片，res/home/duel-cats.png 已改为原双猫 ImageGen 稿经用户明确批准的本地轮廓蒙版，768×512 RGBA。原图/hash/蒙版/处理/限制见 assets/_incoming/moon-ui-runtime/hero-contour/README.md；卡片不再运行。未发布。

最新双猫更新：`res/home/duel-cats.png` 已采用用户批准试作的内置 ImageGen 不透明插画卡片，720×480，原生圆角框。来源、完整提示和处理见 `assets/_incoming/moon-ui-runtime/hero-card/provenance.json`；关键首页视觉尚待验收。下文“旧双猫”仅作此前过程记录。

后续第五枚更新：`res/piece5-runtime.png` 和 `res/piece5-v2.png` 现也已采用内置 ImageGen 新薄荷图；最新提示、透明报告与来源见 `assets/_incoming/moon-ui-runtime/piece5-regenerated-alpha/provenance.json`。双猫仍为旧图。

当前工作区的 `res/home/moonlit-garden-bg.jpg`、`res/game-background-v2.jpg`、`res/level-background-v2.jpg`、`res/home/title-logo.png`、`res/piece1-runtime.png` 至 `res/piece4-runtime.png` 及对应 512px 源图，已被本项目内置 OpenAI ImageGen 的 B 风格候选覆盖。最新来源/提示/透明报告、未采用项和回滚副本见 [运行候选记录](../../assets/_incoming/moon-ui-runtime/README.md)。下文旧来源与压缩字节表对这些文件仅作历史记录；第五枚和双猫仍是旧图。平台发布、关键视觉和真机验收未完成。

以下 29 张是 `js/render/assets.js` 当前完整注册的活跃素材，来源均记录为本项目内 Codex/OpenAI ImageGen 生成：

本地文件时间可佐证的制作批次为：首页 5 张生成于 2026-08-20（Asia/Shanghai），游戏场景与 512×512 棋子源图生成于 2026-08-22，256×256 运行图于 2026-08-22 使用 macOS `sips` 从对应源图缩放生成。这些时间只作为仓库内制作记录，不替代生成服务的原始任务记录或账户授权证明。

### 首页素材（6 张）

| 发布路径 | 来源记录 |
| --- | --- |
| `res/home/moonlit-garden-bg.jpg` | 本项目内 Codex/OpenAI ImageGen 生成 |
| `res/home/duel-cats.png` | 本项目内 Codex/OpenAI ImageGen 生成 |
| `res/home/duel-heads.png` | 内置 ImageGen 绒毛双猫按钮图标，最新来源见 button-polish/provenance.json |
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

### 统一 UI 运行图（16 张）

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

### ElevenLabs 原创生成音乐（2 首）

| 发布路径 | 来源记录 |
| --- | --- |
| `res/audio/calm.mp3` | ElevenLabs `music_v1` 的 `calm-b-kalimba-waltz`；用户确认；48.065 秒、22050 Hz、单声道、24,000 bit/s；144,196 bytes；SHA256 `7665e8961c71f0d079555dcbf4a0ea0deb984cc4f3f11d53c567c29173650236`。 |
| `res/audio/battle.mp3` | ElevenLabs `music_v1` 的 `battle-d-lantern-waltz`；用户确认；48.065 秒、22050 Hz、单声道、24,000 bit/s；144,196 bytes；SHA256 `902e36eea70fab4d76785ae378c5d2a8b74c5fed24c16a7cebb06344737ebfe1`。 |

两首 BGM 均由原创文字提示生成，没有上传项目文件或参考素材；本地完成 48 秒循环交叉淡化、单声道下混、重采样、峰值配平和 MP3 编码。双文件合计 288,392 bytes，低于 360 KiB。供应商、套餐、商业权利核验、完整提示、参数、成本与哈希记录见 `assets/_incoming/audio-elevenlabs-20260909-match3-v9-pilot/` 和 `docs/design/audio-runtime-v9.md`。

### 混合来源音效精灵

| 发布路径 | 来源与处理记录 |
| --- | --- |
| `res/audio/sfx-acoustic.mp3` | 用户确认Mixkit消除/升调连消和Freesound冰裂，保留四连生成音A；横竖触发采用Magic wand sparkle，通关采用Christmas reveal tones。21个cue，15.255510秒、22050Hz、单声道、32,000bit/s、61,022 bytes；SHA256 `dffb3257a79902f517013afdf09597fc13e36ba4e92e095d74444c542521337e`。 |

正式音效仅包含上述最终精灵；保留的animationIsaac爆破为CC0，Kinoton火箭仅作归档；qubodup历史组合音乐盒已无运行调用，本轮从精灵移除并保留归档，原始输入保存在`docs/design/audio-sources/`。fourClear、clear、ice、rocket、bomb和win以外的15个正式cue来自既有项目原创文字生成/点击变体。运行时一次读取并解码精灵，最多12声并发。四枚成线时以一次fourClear替代本轮clear/combo，不额外提前响火箭音；特殊组合仍按当前代码同时播放前两个特殊类别并去重，优先于四连。胜负BGM压低等未改。

四连来源：[Shimmer glitter magic](https://opengameart.org/content/shimmer-glitter-magic)，作者The Berklee College of Music / Berklee，OGA提交者qubodup；原始[Berklee samples v.13归档](https://archive.org/details/Berklee44v13)及素材页均标明[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)。2026-09-14用户选定A；原FLAC SHA256为`b6802e6ef22189058a4406ae5c7bda9a54c47e908fad3fd6212650c1aa0170af`。仅重采样/编码，未变调、增益或裁剪；素材原文件、署名要求和构建脚本见`assets/_incoming/licensed-bling-candidates-20260914/`。署名/许可链接/改编说明已加入随包`THIRD_PARTY_NOTICES.txt`，其中明确本项目版权不限制该素材的CC许可权利，并提供原FLAC无保护下载地址；不对该声追加DRM或额外法律限制、不声称作者背书。没有采用熊猫办公原音或被否决的生成候选。

最终21cue映射、供应商记录、源文件SHA256和派生方式见`docs/design/audio-runtime-v9.md`。临时离线解码/编码工具只安装在`/private/tmp`，不引入客户端依赖；项目没有捆绑第三方字体或第三方音频运行时依赖。

`match3-wechat/tools/gen-audio.py` 作为历史/回退工具保留；它生成旧的程序化示例，不生成当前正式 BGM，不能作为正式素材来源记录。

## 上线前检查项

- [ ] 复核项目仍未添加项目级开源许可证，公开仓库描述没有把整个项目写成 MIT，并保留默认版权边界。
- [ ] 复核 `THIRD_PARTY_NOTICES.txt` 的上游 URL、精确 commit、采用文件和完整 MIT 文本与 `grid.js` 本地修改一致。
- [ ] 复核两项 `UNDECLARED` 腾讯传递依赖仍被准确登记为“厂商依赖例外”，并保留产品负责人接受残余风险、不提交外部澄清请求的决策记录；不得把二者误写为 MIT。
- [ ] 由运营主体确认 Codex/OpenAI ImageGen 生成账户适用条款与目标商业使用相容，并保存可追溯的原始生成记录；不得补写未经证实的 prompt ID、账户或条款。
- [ ] 确认 Holopix 未被 `assets.js`、包体或发布流程采用。
- [ ] 运行 `node match3-wechat/test/open-source-and-assets.js` 和 `node match3-wechat/test/package-budget.js`；确认 29 张活跃素材存在且未被忽略，notice 文件仍在小游戏主包。
- [ ] 确认旧素材仍保持非发布、来源待确认、不得重新启用；确认 `node_modules/` 未加入 Git。
- [ ] 确认 512×512 棋子源图仍只作可追溯源文件使用，256×256 运行图的派生方式与日期有记录。
- [ ] 运行 `node match3-wechat/test/audio.js`、`node match3-wechat/test/package-budget.js`、`node match3-wechat/test/open-source-and-assets.js`，并用音频工具复核两首正式 BGM 约 48.065 秒、MP3、22050 Hz、单声道元数据与实际总字节。
- [ ] 复核 `sfx-acoustic.mp3` 的 21 个 cue、15.255510 秒、61,022 bytes 与 SHA256 `dffb3257a79902f517013afdf09597fc13e36ba4e92e095d74444c542521337e`；真机确认四连 `fourClear`、三种单特殊、多特殊组合按参与类别同时播放独立声音，以及冷启动首个点击、连续消除、三种单人道具、PvP 冰冻/干扰、胜负 BGM duck、后台恢复和关闭音效均正常。
- [ ] 按微信官方当前发布、隐私、素材和云函数要求完成运营主体复核与真机/开发者工具包体检查。

## 2026-09-15 冰裂/消除正式采用补充

- Ice cracking，作者timbreknight，https://freesound.org/people/timbreknight/sounds/342546/ ，CC0 1.0。采用用户明确接受的公开MP3预览1.1–1.7秒，0.6秒，仅下混/边缘防接缝/重采样和编码；不需要等待原始WAV。
- Fairy arcade sparkle，Mixkit ID866，https://mixkit.co/free-sound-effects/sparkle/ ，许可https://mixkit.co/license/#sfxFree 。完整1.497秒作普通消除，第2–6连以+2/+4/+5/+7/+9半音播放速率复用，不叠加旧clear。允许商业游戏终端作品；禁止单独或随源码分发，不能主张原创或注册权利管理服务。
- `.gitignore`排除match3-wechat/res/audio/sfx-acoustic.mp3；selected-sfx-20260915目录排除全部原始/派生音频。本次Git只允许后续单独授权的代码和文本记录，不得强制加音频；微信本地终端发布包仍须含该文件。源码克隆者须自行获取许可输入/合法本地副本，否则不能完成正式音频/包体门禁。
- 精灵61,022bytes，21cue，15.255510秒；新rocket/win源哈希及编码延迟核验在assets/_incoming/selected-sfx-20260915/rocket-win/provenance.json，旧冰裂/消除来源见同目录上层runtime-provenance.json。随包THIRD_PARTY_NOTICES覆盖全部来源。本轮未提交、推送或上传。
