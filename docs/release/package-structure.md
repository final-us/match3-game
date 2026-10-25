# 微信小游戏包结构与忽略规则

## 当前页头猫替换 · 2026-10-25

用户已选定的新笑脸猫替换现有`ui-art/header-cat.png`，没有新增路径或分包。当前ui-art15张PNG合计1,564,128bytes，比替换前减少7,998bytes，原1.5MiB内部上限保持，余8,736bytes。仍由现有加载器整组发布，启动不等待装饰；当前整体预算与未验边界见[六项调整记录](../../project-status/development-steps.md#experience-polish-20261025)，来源与回退见[素材台账](open-source-and-assets.md)。以下为各次接入历史。

## 插画复刻细节家族初次接入 · 历史本地候选

`ui-art`目前12个已注册PNG：五张迁移原图、道具/宝箱图集、平底纸框，以及header-cat/win-cat/reward-coins/result-frame四张细节图。图片总1,518,706字节；在既有普通分包内追加281,330字节细节家族后，内部预算明确从1.2MiB调整为1.5MiB（1,572,864字节），没有放宽主包/总包/旧result-art上限、排除活动素材或增加分包。新四图用途、来源与有损透明编码见`open-source-and-assets.md`对应段。

仍由现有`loadIllustrationArt`一次下载、原子解码发布，启动不等待装饰。`illustration-art.paperFrame`用于平底暖纸；`resultFrame`使用独立弧冠星空到暖纸框；`drawFrame`保留旧素材供回退。`scene`只为新留存页绘制完整静态场景，避免透出首页控件；其他控件/标题/数量仍原生绘制。下方1.2MiB数据为初次迁移历史，不代表当前包体。

## 页面插画资源分包 · 2026-10-20，本地实现

新增普通 `ui-art/` 分包（独立于 `result-art/`，不是独立分包模式）。`ILLUSTRATION_ASSETS` 注册 `ui-art/items.png`（4列×2行，单元192或256px，按行freeze/disturb/reflect/cheer/hammer/bomb/color/空）与 `ui-art/chests.png`（3列×1行，相同单元规格），以及五张原图迁移：

| 用途键 | 新路径 | 原文件字节 |
| --- | --- | ---: |
| uiToolHammer | `ui-art/tool-hammer.png` | 39,822 |
| uiToolYarn | `ui-art/tool-yarn.png` | 50,478 |
| uiResultHappyCat | `ui-art/result-happy-cat.png` | 143,010 |
| uiResultSadCat | `ui-art/result-sad-cat.png` | 156,531 |
| dailyInvitation | `ui-art/daily-invitation.png` | 168,970 |

五图合计558,811字节，从 `res/ui/` 原样移动、不重复打包、不重编码；同名用途键从启动 `ASSETS` 移入 `ILLUSTRATION_ASSETS`，加载前由现有调用方选择原生回退。币、心、按钮及 `uiToolBomb` 等必要UI仍启动加载；旧炸弹图恢复 `res/ui/tool-bomb.png`，供局内BOMB类型与携带徽标使用，单人新插画仍从道具图集绘制。`loadIllustrationArt()` 非阻塞、并发复用同一Promise，下载及全部解码后一次发布；错误或20秒超时不发布半套资源，后续调用可重试，迟到回调失效。`getIllustrationArtState()` 返回idle/loading/ready/error/unavailable状态；`get()` 沿用原接口。

`illustration-art` 提供布尔返回值的 `drawItem(ctx,key,x,y,size)`、`drawChest(ctx,index,x,y,size)`（index 0–2）与 `drawFrame(ctx,x,y,w,h)`；缺图返回false，由调用方决定回退。前两者按单元裁图，后者复用 `uiResultFrame` 九切保留拱顶与花台。全部文字、数值及动作由原生UI负责。

实际道具图集768×384、370,808字节；宝箱576×192、162,133字节，均为192px单元。两图532,941字节，加迁移图共1,091,752字节；新包图片预算明确为1.2MiB（包含迁移图），仅允许空入口及全部注册的PNG。旧 `result-art` 四图/1.6MiB、主包4MiB、总包30MiB门及忽略规则不变。启动炸弹依赖修正后 `package-budget` 通过：ui-art图片1,091,752/1,258,291.2字节，静态主包3,644,543/4,194,304（89文件），总包8,207,756/31,457,280（124文件）；为当次共同工作树静态估算，非微信编译值，后续相关源变化须重新核对。迁移的daily-invitation为带tRNS的索引色PNG，预算检查识别该透明格式，不重编码旧图。主任务已实看素材白/深底预览，仅属静态素材检查；新包的微信编译、真机、整页视觉接受及发布仍需对应证据。

## 当前候选核对 · D2诊断预览，2026-10-18 16:38失效

- 微信实际主包3761.8KB、catalog1753.3KB、总包5515KB；原4M/4M/30M限制和忽略规则保持。
- 静态主包4,183,082/4,194,304字节（余11,222）、总包5,978,447；本轮没有新增素材压缩或画质/音频变更。
- 源输入/private/tmp/match3-ad-d2-20261018-dg3w00bm共116份，普通预览前后字节相同；截图/private/tmp/match3-ad-d2-preview-20261018.png。只做开发预览传输，未正式上传/提审发布。

## 历史候选 · D1诊断预览，2026-10-18 12:39失效

- 微信实际主包3760.9KB、catalog1753.3KB、总包5514KB；原4M/4M/30M限制及忽略规则不变。
- 静态主包4,181,524/4,194,304字节（余12,780）、总包5,976,889；新增诊断源码已计入，不把静态估算与原生结果混用。
- duel-heads.png只重编码IDAT，83,161→65,615字节，省17,546；全部非IDAT块与CRC保留、175,104解码RGBA字节相同，独立QA确认像素无损。
- 源输入/private/tmp/match3-ad-diagnostic-20261018-3d0th7jc共116份，普通预览前后逐字节相同；截图/private/tmp/match3-ad-diagnostic-preview-20261018.png。没有正式上传/提审/发布，后续输入变化不能沿用本候选身份。

## 历史候选 · 2026-10-17 22:43失效预览

- 全激励入口抬手修复候选：微信实际主包3774.6KB、catalog1753.3KB、总包5528KB；原4M/4M/30M限制及忽略规则均未改变。
- 静态主包4,192,148/4,194,304字节（余2,156）、总包5,987,513；静态估算与实际编译分别记录，不将二者混用。
- 图鉴入口图标仅作PNG IDAT无损重压缩，节省3,730字节；独立QA确认非IDAT块与解压扫描行逐字节一致、CRC有效，视觉/音频不变。
- 输入快照`/private/tmp/match3-ad-gesture-20261017-j49znplt`共114份；普通预览前后输入相同。截图`/private/tmp/match3-ad-gesture-preview-20261017.png`。后续源码变化须另核候选；本次没有正式上传、提审或发布。

## 项目根目录

- 微信开发者工具导入目录：`match3-wechat/`。
- 小游戏运行入口：`game.js`。
- 云函数根目录：`cloudfunctions/`，由 `project.config.json` 的 `cloudfunctionRoot` 声明。
- 云函数继续保留在项目内，通过微信开发者工具单独上传和部署；不移动目录。

## 客户端打包忽略规则

2026-10-18至19日本地结算C修订新增普通资源分包`result-art/`（`game.json`声明同名root/name），只含空入口`game.js`、3张无文字主装饰及1张六目标图集PNG，共1,675,962图片字节。`ASSETS`启动列表、catalog包与忽略规则保持；`RESULT_ASSETS`在单人开局调用独立加载器预取，四文件完全就绪才发布，失败不阻塞结算。`test/package-budget.js`另校验此包路径、唯一性、PNG尺寸/alpha、480×320图集合同及1.6MiB美术预算，同时保留原4MiB静态主包与30MiB总包门。当前源已不同于上方旧预览候选，最终本地静态数值见[本轮原任务记录](../../project-status/ui-production.md#单人结算卡片方案--2026-10-18)；未用旧微信包体证明新分包可用，也未发起预览上传。

`project.config.json` 的 `packOptions.ignore` 排除以下仅开发或服务端目录：

| 目录 | 原因 |
| --- | --- |
| `cloudfunctions/` | Node.js 云函数服务端代码，不应进入小游戏客户端预览或上传包。 |
| `test/` | 本地 Node.js 测试脚本，不是运行时依赖。 |
| `tools/` | 本地关卡与历史/回退音频生成工具，不是运行时依赖；`gen-audio.py` 不生成当前正式 BGM，中间 WAV 只写系统临时目录。 |
| `levels/` | 旧 20 关标定样本；当前运行时由 `js/core/level.js` 生成无限关卡。 |

规则使用微信开发者工具支持的 `{ "type": "folder", "value": "..." }` 格式，路径相对小游戏项目根目录。`packOptions.include` 保持为空，避免其更高优先级重新包含已忽略目录。

另外使用精确 `{ "type": "file", "value": "..." }` 规则排除以下不会被运行时引用的根目录素材：

```text
res/piece1-v2.png
res/piece2-v2.png
res/piece3-v2.png
res/piece4-v2.png
res/piece5-v2.png
res/game-icon-144.png
res/game-icon-source.png
res/game-background-v2.jpg
res/ui/level-node-current-v2.png
res/ui/level-node-done-v2.png
res/ui/level-node-locked-v2.png
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

当前 `js/render/assets.js` 引用25张唯一活跃图片（26个用途键），均不在忽略规则中：`res/home/` 下6张、1张关卡场景、5张运行时棋子和 `res/ui/` 下13张UI图。首页与棋盘用途键共用 `res/home/moonlit-garden-bg.jpg`；旧棋盘背景与该文件逐字节相同。三张旧关卡节点PNG已退出注册，地图继续用原生Canvas绘制。上述4文件仍保留供回退，仅由精确file规则排除；加载器对每个用途键的就绪回调逻辑不变，预算按唯一发布路径计量。

`res/audio/calm.mp3` 与 `res/audio/battle.mp3` 是运行时直接由 `wx.createInnerAudioContext` 播放的本地 BGM，不通过图片预加载器注册，也不在忽略规则中。`test/package-budget.js` 单独断言两文件均被打包且合计不超过 360 KiB；文件/API 播放失败时回退程序化 WebAudio BGM。旧 `calm.m4a`、`battle.m4a`、`sfx-acoustic.m4a` 只作 Git 可回滚历史，均由精确 file 规则排除。

棋子源图与运行图分离：`piece?-v2.png` 保留 512×512 透明源图，便于后续重新导出；小游戏运行时只加载由 `sips` 生成的 256×256 透明 `piece?-runtime.png`，不覆盖源图。

`game-icon-source.png` 与 `game-icon-144.png` 只用于平台图标资料，不被游戏运行时加载，因此保留在仓库但通过精确规则排除出客户端代码包。

## 当前体积快照

10/17最新问题修复预览：主包3775.3KB、catalog1753.3KB、总包5529KB，二维码14:03失效。修复SDK桥对象读档误拒及广告load→单次show，无玩家数据/配置/云端变更。源输入快照/private/tmp/match3-ad-fix-20261017-YnlF8V；静态主包4,191,526（余2,778）、总包5,986,891。实际与静态均满足各自检查；iOS额外转场仍待新包复测，普通原生推入不承诺移除。

最新普通开发预览（2026-10-17，含最终居中加号及等待状态修正）：主包3775.8KB、catalog分包1753.3KB、总包5529KB，满足工具当前4M/4M/30M限制。工具2.02.2608040、基础库3.16.2、原AppID/目录；二维码显示12:06失效。114份源输入与/private/tmp/match3-ad-candidate-20261017-XDPLMb在测试后及预览后路径/字节一致；未改配置/存档/云端，上报关闭。只有预览传输，未提审发布。

对应静态估算：主包4,193,550字节（余754）、总包5,988,915字节；不是微信实际编译值。已有本域回归和23项独立probe通过，三条手机确认仍待反馈。以下数值均为历史快照。

最新普通开发预览（2026-10-16，局内零库存“+”候选）：原项目、工具2.02.2608040/基础库3.16.2；工具实际显示主包3767.2KB、catalog分包1753.3KB、总包5520KB，均在4M主包/单分包及30M总包限制内。二维码显示00:37失效。上报关闭，未改后台配置/部署云函数/提审/发布。此前下列3758.8KB是旧预览，仅保留历史。

本轮最终静态检查：主包4,175,628字节（余18,676），总包5,970,993字节；含工作树其他模块并行更新，与实际微信包体是不同计量。产品素材/音频/39条忽略规则未由本域更改。局内入口相关回归及独立23项probe通过，不等于整包发布通过。

当前核对日期：2026-10-15。`node match3-wechat/test/package-budget.js`通过：静态主包4,161,272字节（88文件），距离4MiB余33,032；总包5,956,637字节（110文件）。活跃图片2,963,480字节，BGM288,392字节，旧音效精灵61,022字节，新特殊音效81,628字节，未引用的35个res文件均有精确忽略规则。当前数字替代下方历史体积，不代表微信生成包体。

微信实际检查更新：Stable 2.02.2608040、基础库3.16.2、原目录与AppID，先前`MaxSubPackageLimit / MaxCodeSize`属性缺项错误已在打开“详情→项目配置”重新加载属性后恢复；20:56启动、21:03再次普通编译均显示首页、0错误/1条平台提示，限制恢复为30M总包/4M主包，没有修改限制。未清存档/缓存，项目与安全配置保持。

**实际开发预览包体已取得（2026-10-15）**：用户随后明确授权本次开发预览及必要代码传输，工具成功生成二维码。“代码包”详情显示主包3758.8 KB、/catalog/分包1753.3 KB、总包5512 KB（另显示约5.4MB）；符合工具当前4M主包/单分包及30M总包限制，主包显示余量约337.2KB。以上为UI显示精度，不换算成伪精确bytes；正式提审/发布包仍须匹配最终候选，未授权发布。

167条编译提示为未上传文件；已显示100条均为packOptions.ignore，包含云函数业务源码、历史关卡/素材、源图和测试，另67条UI未显示。配置与忽略规则未改。没有部署云函数或修改后台配置，上报仍关。工具“本地代码12771KB”、普通编译及静态估算均不作实际预览包大小。完整边界见[当前核对记录](monetization.md#ad-integration-handoff)。

历史测量：2026-09-23（无损引用清理后）。

- 当前活跃图片共2,904,881字节；预算仍为3,670,016字节，余765,135字节。原图未重编码，三节点244,922字节与重复背景200,391字节共减少445,313字节资源。
- 双 BGM 实际时长均约 48.065 秒；calm 与 battle 均为 144,196 字节，合计 288,392 字节，低于 360 KiB 独立预算 80,248 字节。
- 2026-09-15采用完整横竖触发/通关尾音后，21cue音效精灵为61,022字节；独立预算由48KiB调整为64KiB，余4,514字节，保持32kbps质量。4MiB总上限不变。
- 按当前工作树排除开发/服务端目录、项目配置文件、README和精确文件规则后，客户端静态文件估算3,732,736字节（64个文件，包含THIRD_PARTY_NOTICES.txt），距离4MiB预算尚余461,568字节（约451KiB）。相比清理前4,178,174字节减少445,438字节，包含映射代码净减125字节。没有改音频、游戏逻辑或引入新依赖。
- 精确字节数和剩余预算由 `node test/package-budget.js` 输出；每次素材或运行时代码变更后以该测试结果覆盖本节快照。

以上是文件系统静态估算，不等同于微信开发者工具最终生成的主包大小；`node test/package-budget.js` 会同时校验活跃素材预算、4 MiB 静态主包预算和忽略覆盖，最终包体仍以开发者工具“预览/上传”的包体积与包内容详情为准。

## 发布前复核

1. 修改忽略规则后关闭并重新打开项目，再执行一次完整编译。
2. 在开发者工具包内容详情中确认不存在 `cloudfunctions/`、`test/`、`tools/`。
3. 确认不再出现云函数 `.js` 被小游戏运行环境打包或执行的告警。
4. 只读确认 `cloudfunctionRoot` 与本地云函数目录保留；实际上传和部署须另行明确授权，不为包体检查触发。
5. 记录预览包和上传包显示的实际主包大小；新增大体积素材后重新检查。
