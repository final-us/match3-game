# 开源与素材合规台账

## 项目版权边界

- 仓库继续公开，但公开仓库不等于开源许可。
- 本项目代码、文档和自有素材不添加项目级开源许可证，保留默认版权；不得把整个项目表述为 MIT 或其他开源项目。
- 第三方通知随小游戏主包保存在 [`match3-wechat/THIRD_PARTY_NOTICES.txt`](../../match3-wechat/THIRD_PARTY_NOTICES.txt)。该文件只记录第三方授权，不改变项目本身的版权边界。
- `node_modules/` 仅用于本地依赖验证，不加入 Git。
- `assets/_incoming/` 是本地制作档案，不随公开 Git 分发；包含供应商输出/记录、未采用候选及第三方试听参考。下文对此目录的路径均为本地追溯位置，不是公开下载承诺。已采用游戏图片和原创 BGM 随 `match3-wechat/res/` 提交；含 Mixkit 的 `sfx-acoustic.mp3` 另按许可只保留本地终端发布副本。

## 笑脸页头猫 · 2026-10-25，已采用

用户明确要求重新设计，并回复“采用这张”。商店、每日任务和七日签到共用的`uiIllustrationHeaderCat`保持原路径`ui-art/header-cat.png`，现替换为新生成的微笑奶油白猫、淡粉珍珠蝴蝶结，448×336 RGBA、48,994bytes；没有改胜负结果猫或第7天独立奖励猫。旧56,992bytes图备份于`assets/_incoming/header-smile-20261025/previous-header-cat.png`，可原样回退。

本轮内置imagegen实际一次、新生成且无输入图，无外部供应商/购买、玩家资料或代码上传；模型/seed/费用工具未返回，记未知。原1448×1086真透明PNG、精确prompt、必要源/运行hash及处理参数见同目录`provenance.md`与`prompt.txt`。运行图等比缩至448宽、128色PNG（dither0.35、compression9），是有损调色板编码，不称无损；保留实际alpha。已经在原生Canvas三尺寸页头预览，角色采用由用户确认；不代替本轮最终真机或隐私/云端验收。

替换节省7,998bytes，ui-art15张PNG合计1,564,128/1,572,864bytes，内部余8,736bytes。主包没有新增图片，所有预算上限保持。以下各期数值及旧图来源保留为历史，不代表本轮当前包体。

## 花瓣与高光细节精修 · 2026-10-25

新增`ui-art/blossom-cluster.png`，128×128 RGBA、25,189bytes，替代房名牌/每日按钮的规则几何小花，并补签到主按钮、商店返回按钮两侧花饰。内置`image_gen`实际调用1次，沿用本轮内置不限次、自有参考/现有额度授权；输入仅为本项目`ui-art/header-cat.png`风格参考，无新增供应商、购买、代码或个人资料上传。原始1254×1254 RGBA图、完整提示、返回路径及必要来源hash在`assets/_incoming/ui-detail-polish-20261025/{source.png,prompt.txt,generation.json}`，model/seed/cost不可见，记未知。

生成源alpha范围0–255，795,176像素完全透明；白/暗底检查见同目录`alpha-review.png`，未见烘焙背景。运行图仅Lanczos等比缩为128×128、RGBA PNG无损编码，无调色板量化；绘制约18–37逻辑像素，适合2×显示。新增后ui-art合计1,572,126/1,572,864bytes，仍未放宽原预算；启动资源仍21keys/20unique，无新启动阻塞。按钮反光、猫爪浮雕与边框局部亮线是原生Canvas，不新增整图界面。2026-10-25用户明确“这次可以”，本轮本地视觉已接受；不等于独立QA、微信真机或发布接受。

## 第7天独立猫咪与胜利插画复用 · 2026-10-25

用户本轮要求第7天不要继续复用页头猫，并明确双人胜利复用单人胜利猫。双人胜利现直接使用既有`result-art/win-moon.png`，未重新生成该图。原`ui-art/win-cat.png`（61,922bytes）从活动分包移出，原样保留于`assets/_incoming/day7-reward-20261025/retired-pvp-win-cat.png`，来源继续见下方历史表。

新增`ui-art/day7-cat.png`：抱粉色猫爪锤打盹的小猫，256×171 RGBA、54,720bytes，仅用于第7天奖励；原生200金币/锤子×1文字及规则不变。沿用本轮内置生成不限次、自有参考、现有额度授权，实际新增一次内置`image_gen`调用，无外部供应商/购买、代码或玩家资料上传。输入仅为本项目`ui-art/header-cat.png`风格参考；完整prompt、原始输出路径、来源hash、处理参数见`assets/_incoming/day7-reward-20261025/generation.json`，model/seed/cost未返回，记未知。原图1536×1024，直接Lanczos缩小、RGBA PNG无损编码，未调色板量化；原图与运行图均有真实透明通道，白/暗底检查在`alpha-review.png`。本地接入不代表最终视觉/设备或发布接受。替换后ui-art合计1,546,937bytes，预算上限不变。

## 平局与备战双猫 · 2026-10-25，本地接入

首轮经用户批准通过内置 `image_gen` 生成两张透明插画，仅使用自有参考和现有额度，不含代码、账号或玩家资料，无外部收费服务或购买。首轮完整prompt及原始输出路径见 `assets/_incoming/ui-illustration-production-20261020/refinement-20261022/generation.json`。用户随后将本轮内置生成次数授权改为不限次，实际另生成A/B两稿；原完成事件、prompt匹配、透明检查与来源见 `assets/_incoming/prep-duo-variants-20261022/generation.json`。2026-10-25用户明确选择“蓄势动作b”，本地采用B，A继续留在制作档案；未新增生成调用。model/seed/单次费用工具未返回，记未知。方向选择不代表最终运行、真机或发布接受。

- `ui-art/draw-cat.png`：平局的单猫/月牙/花饰，448×309，59,476bytes；与已接受胜负卡保持同一世界，未替换胜负插画。
- `ui-art/prep-duo.png`：B圆脸短绒双猫，左猫俯身蓄势、右猫抬爪回应，640×320 RGBA，250,060bytes；从1774×887原图用Lanczos等比缩小，PNG无损编码，无调色板量化。原90,035bytes活动图已备份为`prep-duo-before-b.png`。下方玩家头像仍为原生独立槽位；无人头像使用B图局部猫脸，保持本地，不上传虚构头像。
- 首轮两图先确认实际透明区域，再透明外围trim（threshold8）、Lanczos3等比缩放、256色PNG编码（dither0.6）；该RGB/alpha有损编码现仅适用于保留的平局图和旧双猫。B原图与运行图alpha范围均0–255，原图白/深底及运行小尺寸检查见UI任务记录。
- 现有 `ui-art/items.png` 保持768×384/4×2单元与内容，转为256色PNG，370,808降至96,705bytes；原文件另存 `items-before.png`，无重生成或删除原始制作档案。采用B后ui-art图片合计1,554,139bytes，保持既有1.5MiB上限；主包/总包/result-art上限不变。

## 页面复刻细节资产 · 前一轮本地候选

按用户继续对照已接受设计图的请求，由当前主会话通过内置 `image_gen` 追加四张独立无字透明装饰，未使用子智能体或外部供应商。原图、完整prompt、输入参照角色、返回来源和技术处理记录在 `assets/_incoming/ui-illustration-production-20261020/refinement/details/generation.json`；精确model、seed、cost未返回，均未知。不是整页截图：功能文字、数据、布局及操作仍为原生Canvas。

| 用途键 | 活动文件 | 尺寸 | 字节 |
| --- | --- | --- | ---: |
| 原uiIllustrationHeaderCat（已替换，见顶部） | 原ui-art/header-cat.png，备份于header-smile-20261025/previous-header-cat.png | 512×368 | 56,992 |
| 原uiIllustrationWinCat（已退出活动包） | 原ui-art/win-cat.png，保留于上方制作档案 | 512×368 | 61,922 |
| uiIllustrationCoins | ui-art/reward-coins.png | 256×160 | 18,699 |
| uiIllustrationResultFrame | ui-art/result-frame.png | 512×680 | 143,717 |

新增合计281,330字节。源RGBA保留，活动文件经透明边界裁切、Lanczos3等比缩放和256色PNG编码；RGB/alpha有损量化，不称无损。金币原源有极淡alpha噪声造成大留白，按alpha>8的实体边界加16源像素余量裁切再缩放，未改变币堆结构。主会话实际查看四资产原/量化白暗对照，未见背景烘焙、明显条带或边缘脏色。金币裁边后对照随记录更新。结算新框仅用于双人页，不替换已接受的单人结果素材；体力不足仍使用与失败页相同的旧`uiResultLoseMoon`，不把新睁眼猫替代它。

新`ui-art`为1,518,706字节，明确追加上述家族后的内部分包预算为1.5MiB；原主包4MiB、总包30MiB、result-art1.6MiB未变。微信编译、真机下载/解码/性能与发布不在本轮本地运行证明内。

## 页面插画路径迁移 · 2026-10-20

五张既有自有图片原样迁入普通 `ui-art/` 分包：`ui-art/tool-hammer.png`（39,822bytes）、`ui-art/tool-yarn.png`（50,478）、`ui-art/result-happy-cat.png`（143,010）、`ui-art/result-sad-cat.png`（156,531）、`ui-art/daily-invitation.png`（168,970）。来源仍继承本台账原 `res/ui/` 对应条目及原始制作记录；迁移未重新生成、改alpha或扩大许可。旧炸弹图 `res/ui/tool-bomb.png`（43,468bytes）保留启动加载，以维持局内类型标记及携带徽标；单人新道具插画仍用图集。历史表中的旧路径仅作来源追溯，当前发布路径以上述 `ILLUSTRATION_ASSETS` 为准。

新图集 `ui-art/items.png`（768×384 RGBA，370,808bytes）与 `ui-art/chests.png`（576×192 RGBA，162,133bytes）分别由本项目内置 `image_gen` 各一次生成，共两次，沿用用户接受的页面插画方向；无新外部供应商。原始返回路径逐项见 `assets/_incoming/ui-illustration-production-20261020/outputs.json`，对应本地留存 `items-source.png` / `chests-source.png`；完整提示为 `items-prompt.md` / `chests-prompt.md`，白/深底检查为 `items-white.jpg` / `items-dark.jpg` 与 `chests-white.jpg` / `chests-dark.jpg`。model、seed及独立cost未返回，均记为未知，不补造。

每个规则单元按alpha≥16内容边界裁切，再用Lanczos等比缩放到168px内容、居中放入192px透明单元；保留原生RGBA/alpha范围0–255，不删色或生成透明替代。道具4×2按行freeze/disturb/reflect/cheer/hammer/bomb/color/空，宝箱3×1。主任务实看静态素材通过，不代替整页运行视觉、微信/真机、商业账户条款与最终发布接受。旧 `result-art/` 四张素材及其来源保持不变。本轮仅本地实现，无上传、提交或部署。

### 空白纸面框补充 · 2026-10-21，本地

`ui-art/paper-frame.png`（512×680，145,624bytes）注册为 `uiIllustrationFrame`，参考已接受商店效果稿的右侧面板，由内置 `image_gen` 单次生成一张无文字空白装饰框：暖象牙纸面、金双细线、粉缎带和四角花、空白靛蓝标题牌及平直底，无猫、道具、按钮或台座。原始返回路径、完整prompt、原RGBA及全部编码/白暗底对照留存在 `assets/_incoming/ui-illustration-production-20261020/refinement/` 的 `paper-frame-output.json`、`paper-frame-prompt.md`、`paper-frame-source.png`、`paper-frame.png` 与对照图。model/seed/cost未返回，记未知；不追加外部供应商或生成调用。

先仅trim非零alpha边界、Lanczos3等比置入512×680透明画布，RGBA候选515,120bytes完整保留；活动版采用本地Sharp/libimagequant的256色PNG、dither1、compression9、effort10编码。此为有损RGB/alpha量化，不称完全无损：编码前alpha0–255，活动版0–253、最大逐像素alpha差42，真实透明外围保留。执行者实看原/量化白底及暗底对照，金线与透明边保留，无明显带状或脏边，纸面有轻微均匀抖动；主任务明确允许此编码alpha变化并采用，最终整页运行与独立视觉复核仍属对应验收。原RGBA未覆盖，包上限不变，含新框的ui-art图片共1,237,376bytes，低于既有1.2MiB；无提交、上线或外部上传。

## 第三方组件与调研来源

| 组件/来源 | 版本或精确信息 | 许可证/状态 | 采用范围与处置 |
| --- | --- | --- | --- |
| [pixi-game-match3](https://github.com/xiaozhu188/pixi-game-match3) | commit `658679250f30ef8d01ff570eb976017c5727cbf0`；`src/match3/Match3Utility.ts` | MIT；版权行见主包 notice | 仅采用三消棋盘工具逻辑的本地适配，详见 `match3-wechat/js/core/grid.js` 与 notice；不是整个项目的许可证。 |
| `wx-server-sdk` | `4.0.2`，直接依赖于 `match3-wechat/cloudfunctions/battle` | MIT（以官方包与 package-lock.json 记录为准） | 仅随云函数部署使用；其 MIT 声明不自动覆盖许可证元数据未声明的独立传递包。 |
| 云函数 `package-lock.json` | 104 个非根依赖记录（103 个第三方 + 1 个自有适配层） | MIT 72；BSD-3-Clause 13；Apache-2.0 10；ISC 4；BlueOak-1.0.0 1；0BSD 1；UNDECLARED 2；自有 UNLICENSED 1 | 客户端主包不包含 `cloudfunctions/`，但云函数部署会带入这些依赖。未声明项为 `@cloudbase/signature-nodejs@2.2.0` 与 `@cloudbase/wx-cloud-client-sdk@1.7.1`：二者的 npm 元数据和安装包均没有 license 声明或 LICENSE 文件。产品负责人决定继续采用腾讯官方依赖链，将二者登记为“厂商依赖例外”并接受残余商业合规风险；不虚构许可证、不复制或魔改签名代码，也不提交外部澄清请求。该例外不构成对二者授予 MIT 许可的声明。 |
| [lodash](https://github.com/lodash/lodash) 与自有 set 适配层 | lodash `4.18.1`；`@match3/lodash-set-compat@1.0.0` 安装为 `lodash.set` | lodash MIT；自有薄适配层 UNLICENSED（默认版权，不是第三方许可缺失） | 2026-09-15 替代有原型污染漏洞且无修复版的独立 `lodash.set@4.3.2`。适配层仅导出 `require('lodash/set')`，无复制旧漏洞代码。安装包 `node_modules/lodash/LICENSE` 保留完整 OpenJS/Underscore 版权与许可；新增 `proxy-from-env@1.1.0` 随 axios 引入，MIT。详情见云函数 `vendor/lodash-set-compat/README.md`；不扩大项目级许可。 |
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

### 2026-10-18 单人结算C保真修订 · 仅本地候选

`match3-wechat/result-art/frame.png`、`win-moon.png`、`lose-moon.png` 为本项目内置ImageGen各一次生成的独立无文字装饰，以已生成C概念作参考；不含第三方界面素材，未将整屏概念图接入产品。原始输出、完整提示、输入范围、原生alpha、裁切/缩放及来源记录见 `assets/_incoming/result-card-c-fidelity-20261018/README.md`、`prompts.md`、`technical.json`。仅在独立资源分包预取，文字/目标/统计/按钮仍原生。保持本地候选，待用户运行视觉与微信/真机接受；未上传、发布或提交，不将此条登记视为接受或新的外部许可证明。

2026-10-19按用户对失败目标区的反馈，另一次内置ImageGen生成六类无文字目标图集，运行文件`result-art/goal-icons.png`（480×320 RGBA，196,867字节）。同项目C概念作参考，每格机械裁边/缩放、保留原生alpha；完整输入、原始输出、裁切与四文件来源记录同上。目标名称/剩余数仍原生，收集猫仍复用既有棋子图；该新增候选同样未取得用户最终视觉或发布接受。

### 最新本地候选（2026-09-29）

本段覆盖下方制作历史中“仅develop样板”“旧原画”“25张活跃图”等旧状态，不等于正式客户端已经上传或发布。当前主包 `ASSETS` 注册27个用途键、26个唯一图片文件；首页/棋盘背景共用一份文件。图鉴 `CATALOG_ASSETS` 共21个文件：16张成长原画、初见图集和4张猫体遮罩。9月29日将初见图集与遮罩原样移入已有catalog分包，共227214字节；不重新生成、编码或改变画质，首页图鉴入口图标仍留主包，首页陪伴/故事初见原画等待分包就绪后绘制。

- **图鉴v2**：初见图集及16张成长图已替换为本项目内置ImageGen生成的首页同风格原画。来源、输入范围和动作说明见 [`cat-catalog-assets.md`](../design/cat-catalog-assets.md) 顶部及 `assets/_incoming/cat-catalog-v2/README.md`；生成源保留在 `initial-atlas-v2.png` / `sheets/`。本轮只补台账，没有新生成、第三方素材引入或新的授权声明。下方v1字节数、接受及迁移时间均保留为历史，不作为v2文件的现况。
- **锁定态遮罩**：沿用项目中现有的四张猫体alpha轮廓PNG，当前只用于划定原画局部模糊区域，不直接绘制黑色剪影。来源关系是本项目图鉴原画与对应猫体轮廓，具体使用及用户对灰底/模糊效果的确认见 [`UI制作记录`](../../project-status/ui-production.md) 的2026-09-28条目。原始PNG制备工具、精确参数没有独立制作记录，本台账不补造工具、模型、种子或费用。运行合成由 `js/render/catalog-locked-art.js` 在本地Canvas完成，不向外部服务传输图片。
- **普通棋子柔光**：`res/piece1-v2.png` 至 `res/piece5-v2.png` 及对应 `res/piece1-runtime.png` 至 `res/piece5-runtime.png`，已按既有本地确定性像素处理减弱大片镜面高光，保留alpha、五色识别与表情，512源图缩放为256运行图；无新生成或第三方图源。处理说明、原文件备份、派生图与棋盘截图见 `assets/_incoming/moon-ui-runtime/piece-gloss-softened-v2/README.md` 的 `original/`、`edited/`、`screens/`。原ImageGen来源不变；该制作记录仍标用户棋盘视觉确认待完成，不借补台账自动宣布接受。

图鉴专用发布文件（入口图标在主包，其余位于图鉴分包）：

| 发布路径 | 当前用途与来源 |
| --- | --- |
| `catalog/portraits-atlas.jpg` | 本项目ImageGen v2初见图集，700×776；来源见上述v2记录。 |
| `res/home/catalog-album.png` | 本项目ImageGen已接受的图鉴入口图标；来源及转换见下方2026-09-24记录。 |
| `catalog/cream-silhouette.png` | 奶糖原画猫体alpha轮廓；仅作局部模糊遮罩，继承项目自有图鉴素材来源。 |
| `catalog/ragdoll-silhouette.png` | 团子原画猫体alpha轮廓；仅作局部模糊遮罩，继承项目自有图鉴素材来源。 |
| `catalog/siamese-silhouette.png` | 芝麻原画猫体alpha轮廓；仅作局部模糊遮罩，继承项目自有图鉴素材来源。 |
| `catalog/calico-silhouette.png` | 布丁原画猫体alpha轮廓；仅作局部模糊遮罩，继承项目自有图鉴素材来源。 |

16张图鉴v2分包原画均为512×512 JPEG，来自同一项目原画板，运行路径如下（按熟悉/信任/依恋/挚友顺序）：

- 奶糖：`catalog/naitang-familiar.jpg`、`catalog/naitang-trust.jpg`、`catalog/naitang-attachment.jpg`、`catalog/naitang-best-friend.jpg`。
- 团子：`catalog/tuanzi-familiar.jpg`、`catalog/tuanzi-trust.jpg`、`catalog/tuanzi-attachment.jpg`、`catalog/tuanzi-best-friend.jpg`。
- 芝麻：`catalog/zhima-familiar.jpg`、`catalog/zhima-trust.jpg`、`catalog/zhima-attachment.jpg`、`catalog/zhima-best-friend.jpg`。
- 布丁：`catalog/buding-familiar.jpg`、`catalog/buding-trust.jpg`、`catalog/buding-attachment.jpg`、`catalog/buding-best-friend.jpg`。

以上不改变项目默认版权、供应商依赖例外或既有素材条款，也不把“来源记录已补齐”当作法律保证或微信审核保证。

### 图鉴制作与迁移历史（当前状态以上方为准）

2026-09-24图鉴开发样板新增：`res/catalog/portraits-atlas.jpg`（700×776，102460字节）从用户接受的内置ImageGen v8概念确定性提取四块插画，注册为 `catalogPortraits`。仅开发样板使用，trial/release入口隐藏，未发布；来源、接受范围、提示与本地处理见 [`cat-catalog-assets.md`](../design/cat-catalog-assets.md)。不是整张概念UI作为交互页面，也不是完整20张成长原画。

同日按用户反馈新增图鉴入口 `res/home/catalog-album.png`（160×160透明PNG，37859字节），内置ImageGen原创猫爪收藏册经本地Canvas缩放，注册为 `catalogIcon`。原图、提示、透明检查和使用范围见上述图鉴来源记录；图鉴底板及淡紫色按钮为原生Canvas绘制。新视觉仍待用户运行验收，未部署或发布。

奶糖成长第二阶段「熟悉」经用户接受后接入 `res/catalog/naitang-familiar.jpg`（512×512，50642字节），注册为 `catalogNaitangFamiliar`。内置ImageGen生成原图和已授权参考、本地完整构图缩放参数见 [`cat-catalog-assets.md`](../design/cat-catalog-assets.md)。仅develop样板使用，未发布。2026-09-25第三至第五阶段经接受后加入 `res/catalog/naitang-trust.jpg`（52149字节）、`res/catalog/naitang-attachment.jpg`（52194字节）、`res/catalog/naitang-best-friend.jpg`（53058字节），均为512×512；来源、提示与注册键见上述资产记录。随后按用户要求回退为静态原画，动画代码已移出运行包并留作下版本参考。另补12张团子/芝麻/布丁成长原画，用户已接受并授权开发部署，选择原生catalog子包。源1254×1254 PNG和完整提示留在assets/_incoming/cat-growth-complete-v1；运行采用512×512 JPEG质量0.84完整缩放，`CATALOG_ASSETS`注册12条`catalog/`路径。来源/参考/接受/转换逐项保存在provenance.json；无新增生成或外部服务。初见图集和奶糖4图当时仍在主包；实际部署见catalog-activation.md，未授权公开发布。

2026-09-26包体调整：上述4张奶糖成长JPEG原字节移动为当前运行路径 `catalog/naitang-familiar.jpg`、`catalog/naitang-trust.jpg`、`catalog/naitang-attachment.jpg`、`catalog/naitang-best-friend.jpg`，改由 `CATALOG_ASSETS` 在原生图鉴分包加载；上段 `res/catalog/` 路径仅记录迁移前历史。初见图集仍在主包，图鉴分包共16张成长原画。未重新生成、裁切或降低画质。

### 普通棋子最新来源 · C 绘本手绘（2026-10-05，本地候选）

用户在A哑光陶土、B羊毛毡、C绘本手绘的本地对比后选择C。`res/piece1-runtime.png` 至 `res/piece5-runtime.png` 及对应 `res/piece1-v2.png` 至 `res/piece5-v2.png` 已替换为本项目内置OpenAI image_gen生成的同一张五猫绘本原图派生；没有新增生成任务或外部供应商上传。完整最终提示、原始输出路径、生成时参考图、实际裁切及替换前备份见 `assets/_incoming/piece-styles-20261005/prompts.json` 和 `assets/_incoming/piece-styles-20261005/selected-c/provenance.json`。精确模型、seed、费用未由工具返回。

保留原生alpha；本地Sharp仅按透明间隙裁切、等比缩放、透明留白及无损PNG编码。512×512源图由原始裁片制作，256×256运行图与用户选中的预览解码像素完全一致；映射、512px源图排除规则及玩法逻辑不变。用户选择的是材质方向，整盘整合效果仍待确认，微信开发者工具/真机、商业账户条款及发布门槛仍按既有流程；本次未提交、上传或发布。下方琉璃棋子来源和早期字节表对这十个文件仅作历史记录。

### 本地 B 视觉候选覆盖（2026-09-12，尚未发布）

2026-09-13 地图/结算最新覆盖：`res/level-background-v2.jpg`为独立云海玻璃阶梯640×1384背景；`res/ui/result-happy-cat.png`、`res/ui/result-sad-cat.png`为新320×320真透明角色（单人及PvP共用）。内置ImageGen各生成一次，猫图checker-alpha保留原生alpha并经白/深底检查，确定性缩放。完整来源/提示/透明报告/hash/备份与运行映射见assets/_incoming/moon-ui-runtime/map-results/README.md。地图节点改为原生Canvas，旧三枚节点PNG仍注册保留但地图不绘制。本批本地待验收，未上线；下方早期来源表对此三文件仅作历史来源。商店/设置/道具前批现已获用户确认。

2026-09-13 支持页道具更新：`res/ui/tool-hammer.png`、`res/ui/tool-bomb.png`、`res/ui/tool-yarn.png` 替换为B低饱和珍珠材质160×160透明图。内置ImageGen单件生成，原生alpha保留/确定性缩放，未新增外部上传。完整提示、源文件、checker-alpha报告/hash、旧图备份和运行验证见 assets/_incoming/moon-ui-runtime/support-polish/README.md。下表原512px设计图对此三枚仅作历史来源；本地待验收，未上线。

2026-09-13 按钮图标精修：新增 `res/home/duel-heads.png`（256×171绒毛双猫），替换 `res/ui/shop.png` / `res/ui/settings.png`（144×144珍珠金边图标）。三张由内置 ImageGen 生成，checker-alpha 返回 already_has_alpha，白/深底检查后仅缩放、保留原生alpha。完整提示与原始任务路径见 assets/_incoming/moon-ui-runtime/button-polish/provenance.json，各alpha目录保留报告/hash；旧资源在previous，尚待用户视觉验收。按钮底板、文字、猫形副入口与金边细雕仍为Canvas。

2026-09-13 标题最新来源：res/home/title-logo.png 为新云朵铭牌/蝴蝶结 ImageGen 稿，经用户单独批准的本地精细蒙版后缩放748×374；source/output/runtime hash与提示见 assets/_incoming/moon-ui-runtime/title-contour/provenance.json。原生按钮与页脚形状直接由Canvas绘制，不增加外部下载美术。

2026-09-13 双猫最新来源：用户否决卡片，res/home/duel-cats.png 已改为原双猫 ImageGen 稿经用户明确批准的本地轮廓蒙版，768×512 RGBA。原图/hash/蒙版/处理/限制见 assets/_incoming/moon-ui-runtime/hero-contour/README.md；卡片不再运行。未发布。

最新双猫更新：`res/home/duel-cats.png` 已采用用户批准试作的内置 ImageGen 不透明插画卡片，720×480，原生圆角框。来源、完整提示和处理见 `assets/_incoming/moon-ui-runtime/hero-card/provenance.json`；关键首页视觉尚待验收。下文“旧双猫”仅作此前过程记录。

后续第五枚更新：`res/piece5-runtime.png` 和 `res/piece5-v2.png` 现也已采用内置 ImageGen 新薄荷图；最新提示、透明报告与来源见 `assets/_incoming/moon-ui-runtime/piece5-regenerated-alpha/provenance.json`。双猫仍为旧图。

当前工作区的 `res/home/moonlit-garden-bg.jpg`、`res/game-background-v2.jpg`、`res/level-background-v2.jpg`、`res/home/title-logo.png`、`res/piece1-runtime.png` 至 `res/piece4-runtime.png` 及对应 512px 源图，已被本项目内置 OpenAI ImageGen 的 B 风格候选覆盖。最新来源/提示/透明报告、未采用项和回滚副本见 [运行候选记录](../../assets/_incoming/moon-ui-runtime/README.md)。下文旧来源与压缩字节表对这些文件仅作历史记录；第五枚和双猫仍是旧图。平台发布、关键视觉和真机验收未完成。

以下四张表列出25张基础场景/棋子/UI图片；加上首页图鉴入口图标，合计26张主包图片、27个用途键，首页/棋盘背景共用一份文件。图鉴16张成长图、初见图集和4张遮罩单列于分包。2026-09-23无损包体清理只改变映射和忽略规则，不重新编码图片；旧节点及重复背景保留在下方回退来源表，不再随客户端发布。棋子和图鉴后续改版以顶部最新来源指针为准。

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

### 独立关卡场景（1 张，棋盘共用首页背景）

| 发布路径 | 来源记录 |
| --- | --- |
| `res/level-background-v2.jpg` | 本项目内 Codex/OpenAI ImageGen 生成 |

### 运行时棋子（5 张）

| 发布路径 | 来源记录 |
| --- | --- |
| `res/piece1-runtime.png` | 对应 `res/piece1-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |
| `res/piece2-runtime.png` | 对应 `res/piece2-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |
| `res/piece3-runtime.png` | 对应 `res/piece3-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |
| `res/piece4-runtime.png` | 对应 `res/piece4-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |
| `res/piece5-runtime.png` | 对应 `res/piece5-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |

### 统一 UI 运行图（13 张）

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
| `res/ui/daily-invitation.png` | 2026-09-22 内置 OpenAI image_gen 对本项目已接受参考图作1次去文字编辑；仅双猫/月徽/珍珠装饰，文字与按钮由代码绘制。1122×1402 RGBA源图经既有sharp缩放及调色板压缩为560×700、168970字节。提示、输入、源图和既有SHA256见 `assets/_incoming/daily-reference/skin/provenance.md`；最新弹窗接受记录见 `docs/content-update-1235.md`。适用[OpenAI条款](https://openai.com/policies/terms-of-use/)，未核实账户特有条款，不额外承诺权利保证。 |

### 保留但不打包的回退图片（2026-09-23）

| 保留路径 | 来源及退出发布包原因 |
| --- | --- |
| `res/game-background-v2.jpg` | 本项目内 Codex/OpenAI ImageGen 生成；与 `res/home/moonlit-garden-bg.jpg` 逐字节相同（200391字节），gameBackground用途键改用首页路径。原文件保留、精确排除。 |
| `res/ui/level-node-current-v2.png` | 本项目内 Codex/OpenAI ImageGen 生成，源图 `docs/design/generated-assets/level-nodes/level-node-current-source.png`；地图已由moon.levelNode原生绘制，不再注册/打包。 |
| `res/ui/level-node-done-v2.png` | 本项目内 Codex/OpenAI ImageGen 生成，源图 `docs/design/generated-assets/level-nodes/level-node-done-source.png`；同上。 |
| `res/ui/level-node-locked-v2.png` | 本项目内 Codex/OpenAI ImageGen 生成，源图 `docs/design/generated-assets/level-nodes/level-node-locked-source.png`；同上。 |

首批12张UI运行图于2026-08-23使用macOS `sips`缩放，再用Pillow 12.3.0进行128色透明PNG优化；已退役的三张关卡节点在同日使用内置ImageGen生成透明源图，再由`sips`缩放至最长边256px。完整提示摘要和派生记录见 `docs/design/generated-assets/README.md`。本次仅清理发布引用，不删除或改变来源记录。

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

上述21cue精灵保持不变；保留的animationIsaac爆破为CC0，Kinoton火箭仅作归档；qubodup历史组合音乐盒已无运行调用，原始输入保存在`docs/design/audio-sources/`。fourClear、clear、ice、rocket、bomb和win以外的15个cue来自既有项目原创文字生成/点击变体。2026-10-01另采用用户选定的ElevenLabs猫爪A与重做金属铃铛A；`res/audio/sfx-new-specials.wav`为独立monoPCM16/22050、1.849977秒、81,628字节，SHA256 `e1002e38f672d4eb43d35d84cccc30d325815b31172d5cda7ba4311402ead2d3`。来源、10/1条款复核、完整处理/批准记录及限制见`docs/design/audio-runtime-v9.md`与本地`assets/_incoming/special-sfx-runtime-20261001/runtime-provenance.json`；仅原创文字，完整已接受试听稿重采样/拼接，无新创作、上传或旧精灵重编码。

两个bank各读取/解码一次、独立失败状态、共用最多12声并发。四连规则及旧101–104音色不变；组合仍按前两个类别去重，新105/106使用棋盘共用动作起点，其他类别仍同时播放。胜负BGM压低不改；取消SFX涵盖所有已排程节点。商业用途受既有付费账户条款限制，不代表输出唯一、允许任何再上传/训练或已获发布授权。微信/真机另验。

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

- 2026-10-20 `res/ui/avatar-tap.png`：项目内程序生成的1×1全透明RGBA点击表面，只供原生可选头像按钮命中，避免遮盖Canvas中的真实头像；不含第三方内容，不作美术资产。
