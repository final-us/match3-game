# 发布检查 · 2026-09-15

<a id="git-delivery-20261017"></a>

## GitHub交付检查 · 2026-10-17（限定Git通过，微信验收待完成）

- 授权：用户要求检查近期项目更新，无阻断问题后提交本地Git并推送既有origin/main（final-us/match3-game）；不包含微信上传/云部署/提审/发布，也不授权清存档、修改广告后台或新付费创作。
- 基线：HEAD dea08fb，当前main；现有工作树包含普通玩法/难度与视觉、PvP、广告/奖励、单人续局及相关测试/文档增量。按实际变更与已接受证据确定交付范围，保留无关本地工具/推广目录和受限制素材，不整仓盲目暂存。
- 结论：限定Git交付检查无P1/P2阻断；按本次授权保存当前项目候选并推送既有origin/main。此结论不是微信上传/云部署或正式发布放行。已fetch远端，提交前HEAD与origin/main均为dea08fb、无分叉；不force、不改远端或Git身份。
- 范围：普通关卡v8/障碍与特殊组合、C绘本棋子和HUD、广告奖励/单人续局、PvP独立冷却/事务修复及对应测试/工具/文档，共131个项目文件（含本检查记录）。不纳入`.impeccable/`、`promo-duel/`、`node_modules/`、`assets/_incoming/`及含Mixkit的本地`res/audio/sfx-acoustic.mp3`；该MP3仍须由授权本地发布副本提供，Git克隆不包含完整发布音效。新增原创`sfx-new-specials.wav`有既有供应商/用户采用记录，不扩大许可或创作授权。
- 本轮检查：95个新增/修改JS/CJS语法exit0；`git diff --check`、`test/package-budget.js`、`test/open-source-and-assets.js`、`test/release-gates.js`、`tools/sync-daily-engine.cjs --check`均exit0（每日4文件一致）。公开文件定向凭证标记检查未命中，未修改依赖/预算或放宽断言；不宣称全仓安全审计或法律保证。
- 证据复用：当前客户端与10/17普通微信预览快照`/private/tmp/match3-ad-gesture-20261017-j49znplt`比较113个非私有输入（排除inputs索引/本机private配置），changed=[]、missing=[]。沿用相同输入的Main广告/恢复/音频、组合/障碍、UI与隐私现有回归及独立QA，不再为交付重跑整库/难度模拟。快照含受限本地音效仅作本机比较，不提交或再次上传。
- 独立复核：非实现者Franklin（01a14a98-e54f-7491-8d48-bd92f0e97b9c）只读核对广告严格isEnded、单次show/后台取消、奖励WAL/恢复、SDK JSON解码及原局身份；另逐字节确认57客户端JS与最近快照相同，复用141项七入口QA、桥接及奖励故障矩阵，无P1/P2。非实现者Hegel（01a14a98-e5c8-7801-8e15-91119a784638）只读核对可信身份/回合、精确事务冲突分类及SDK有界重试、独立10秒冷却/冻结、尾分/新局重置、retention并行档案与奖励原子回滚，复用10/17真实SDK隔离传输和既有独立probe，无P1/P2。均未改文件、操作云端或真实广告；工具固定worker Sol/medium路线，不声称核验上游实际模型。
- 包体：当前静态主包4,192,148/4,194,304字节（90文件，余2,156），总包5,987,513/31,457,280（112文件）；不可放宽预算或据此再加主包内容。该输入已有微信普通开发预览主包3774.6KB/总包5528KB证据，复用但不冒充正式上传产物。
- 微信仍待：商店iOS额外转场的新候选反馈；C圆环/双目标对齐/手绘棋子最终用户运行视觉及设备确认；双账号独立冷却、弱网/后台、事务部署效果和完整广告设备矩阵。此次包含battle云函数源码及新增transaction.js，用户更新微信时需同时按既有完整依赖部署约定更新battle；本轮不执行。旧生产问题不能仅凭离线通过宣布恢复。
- 共享记忆：approved项目hit，原文核读vfx-event-footprint/audio-feedback及独立复核引用的room-poll-write-gating r1，仅用于审查当前真实事件/音画时序和SDK事务证据的适用边界；不恢复旧组合音效、不外推生产归因。无规范模块身份。小批原Markdown审计unreviewed=0、needs-evidence=1，未改历史批准；本次候选none，两位复核者候选none，不将例行Git交付状态复制成长期记忆。
- Git交付：131个已审项目文件已精确暂存，index差异检查通过，相对require均可由Git内容解析，无受限/无关文件；本记录随同提交保存，所在提交即本次交付快照。最终提交SHA、推送结果及远端身份以实际Git记录和交付回复为准，不预报网络成功。工作树内容归属用户，本轮仅审查与交付，未修产品逻辑、删除存档或采用新素材。记忆格式与本task/turn交接自检均valid:true、issues:[]，不是技术验收替代。

```memory-task
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/release-check.md#git-delivery-20261017","session_id":"01a01f4a-9054-7200-a8c7-4d093c5c4127","turn_id":"01a14a96-82b0-7461-8c29-be12d298b8ed","state":"active"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-vfx-event-footprint","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/release-check.md#git-delivery-20261017","date":"2026-10-18","stage":"applied","purpose":"review","action":"核对当前specialCombo/命中字段与HUD延迟证据，复用匹配输入的组合及圆环独立QA，不用源码或静帧代替最终设备和视觉接受。"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-audio-feedback","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/release-check.md#git-delivery-20261017","date":"2026-10-18","stage":"applied","purpose":"review","action":"按当前音频合同核对新旧精灵、参与类别及共享延迟证据；保留已接受音色与后台取消边界，不将Git/技术通过当真机听审或许可保证。"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-room-poll-write-gating","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/release-check.md#git-delivery-20261017","date":"2026-10-18","stage":"applied","purpose":"review","action":"核读云端复核引用的批准原文，接受真实SDK隔离冲突/新快照及幂等证据的有限结论，保留query写入门控、身份回合校验与生产恢复待验边界。"}
```

```memory-handoff
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/release-check.md#git-delivery-20261017","turn_id":"01a14a96-82b0-7461-8c29-be12d298b8ed","recall":{"project":"hit","module":"not-applicable"},"memories":[{"memory_id":"match3-game-vfx-event-footprint","revision":1,"stage":"applied","purpose":"review"},{"memory_id":"match3-game-audio-feedback","revision":1,"stage":"applied","purpose":"review"},{"memory_id":"match3-game-room-poll-write-gating","revision":1,"stage":"applied","purpose":"review"}],"no_usage_reason":null}
```

## 当前任务：失败换位碰壁反馈

- Owner：当前项目任务；状态：`verified_for_git_delivery_device_acceptance_pending`。基线 `b7e4c76587564b914a42c67795e539940020927f`（安全修复已推送），本次仅无消除/冰块/果冻换位失败动效及既有音效接线确认。用户在本地验证后明确授权“推送”：仅本次代码、测试、预览工具与文档提交到origin/main，不部署微信，无外部创作费用或素材上传。Git身份与实际推送结果以本记录所在提交及交付回复为准；推送授权不代表已通过真机验收。
- 原因/实现：真实renderer回归红测复现 `animateInvalidSwap` 中错误的 `self` 引用；改成240ms、最大7逻辑像素的顶碰/回弹/余振，降效180ms/最大3像素，障碍与棋子共享显示偏移（锁定格55%幅度），不改变逻辑位置。独立输入锁阻止反馈期间连划/道具叠加，不使用processing锁，不暂停倒计时，finally释放。setGame清理旧反馈，旧Promise不会清除新棋盘反馈。
- 音频：复用已接受invalid 0.32秒采样，单人/PvP每次失败各一次；既有真实Main音频回归验证回调、动画Promise和cue调用。未改audio.js、精灵或授权边界，成功交换/补棋继续静音。
- 文件：`js/core/game-core.js`、`js/render/board-render.js`、`test/invalid-swap.js`（均在match3-wechat下）；扩展现有 `tools/preview-level-entry.cjs` 的 `?preview=invalid` 模式，用真实Main/Core/Board/Audio、内存存档、无云请求，可重复查看普通/冰块/果冻、横竖、静音与降效。
- 本地证据：新增invalid-swap从红转绿，覆盖五种失败来源、输入去重、步数/障碍/分数不变、计时推进、横竖、降效、重绑与异常解锁；audio、slide、timer、ui-smoke、battle-client、package-budget、special、tool、release-gates通过；相关JS语法/diff通过，Impeccable机械检测无发现（不能代替动效验收）。主包估算3,842,756/4,194,304字节、57文件，无新增二进制。既有不受影响云依赖审计证据复用。
- 运行证据：浏览器实际Canvas隔离预览390×844/320×568加载正式猫咪素材并触发失败反馈，步数保持28，偏移回到null，无unhandledrejection/控制台错误；静音/降效路径可运行。浏览器截图只能证明布局与状态，实际微信/iOS/鸿蒙的动画流畅度及听感仍需用户审核，不冒充真机验收。
- 独立非实现者审查：既有代理条件PASS，未发现阻断本地变更的具体问题；确认输入/计时隔离、位移边界、罩层一致、重绑identity guard与测试范围。未重复测试/真实Canvas/音频审查，音效Main绑定由主代理现有回归验证；未使用同一个core在反馈中途重跑initGrid的非当前运行路径作为已验证场景。
- 下一步：按授权提交并推送本次7个文件到 `https://github.com/final-us/match3-game.git` 的main，不force、不纳入音效/隔离素材/node_modules；随后由用户在微信开发者工具重新编译后审核三类失败换位及声音。本次不重新设计其他音效、画面或玩法，不代上传微信。共享记忆本任务检索无相关批准记录，适用结论已记在上述规范，不复制瞬时状态进记忆；无相关输入变化的已通过证据继续复用。

## 历史：battle 依赖安全修复（已推送b7e4c76）

- Owner：当前项目任务；状态：`verified_for_git_delivery`。用户授权修复前轮 7 项 npm 安全告警，并在本地验收后明确授权“推送”：仅本次依赖/兼容层、测试与文档提交并推送 origin/main；无云部署或微信上传授权。UI/音频/玩法/业务源码保持不变。最终Git身份与推送结果以本记录所在提交及交付回复为准。
- 身份：基线 `f85a8353de98a4d74cf5940dec245f0abc8a3c04`（此前已推送 main），加本次工作树。文件：battle `package.json` / `package-lock.json` / `.npmrc` / `vendor/lodash-set-compat/`，`test/cloud-dependency-security.js` / `test/open-source-and-assets.js`，小游戏 README 与安全/授权台账。本轮无客户端构建产物变化。
- 决策/修复：保留微信 SDK 4.0.2，不 force 降级；精确 override axios 0.33.0、lodash.unset 4.18.0、qs 6.16.0；以自有薄层导出 lodash 4.18.1/set 替代无修复版的独立 lodash.set。`install-links=true` 和根依赖引用避免部署依赖本机链接；保留未涉及的锁定版本。第一次路径解析和第二次残留树失败后改隔离干净安装定位，不沿用无效安装证据。
- 有效证据：Node 24.19.0/npm 11.17.0；最终仓库安装与 `/private/tmp/match3-dependency-ci-1E7Vbb` 独立 `npm ci --ignore-scripts --no-audit --no-fund` 成功；干净树 `npm ls --all` exit0。最终 `npm audit --omit=dev --json` 为0项、104非根依赖。安全回归旧set污染红测、最终真实依赖绿测；同一脚本在仓库和干净安装分别通过，包括路径安全/兼容、实际版本/无symlink/函数身份、qs、SDK内存请求adapter/取消/失败。
- 受影响验收：battle-cloud-function、battle-logic、battle-client、open-source-and-assets、release-gates 共5个现有脚本通过，新增安全脚本通过，3个新增/修改JS语法及diff检查通过。其他有效历史证据复用；没有重跑全量胜率/声音/UI/包体（客户端文件不变，README属开发元数据）。既有两个腾讯UNDECLARED厂商例外不变，新适配层是自有UNLICENSED，103个第三方依赖+1个自有层准确分开。
- 独立复核：既有非实现者代理 `01a0a078-7aad-77d3-b7a3-dcb20bd81bf6` 只读核对manifest/lock/.npmrc、适配层真实导出、wxSDK→CloudBase→database解析链、测试与部署契约，结论为条件PASS：未发现阻断本地Git交付的缺陷，真实云/上传/双账号仍未验收。安全脚本单独运行不证明安装新鲜，必须保留先干净ci的流程。既有模型未切换，实际模型/effort未核验。原审核回传延迟时短暂启动固定 `worker`（工具定义锁定gpt-5.6-luna/max，调用也显式指定）替代任务 `01a0a5aa-49c0-7e21-b142-e0a8f519fa1d`；原结果抵达即停止重复工作，不将替代任务冒充第二次验收。
- 限制/下一步：安全数字只覆盖npm当前已知公告，不是零风险承诺；未调用真实云数据库/元数据/凭据，未验证云端安装器。按用户授权交付本次修复到 `https://github.com/final-us/match3-game.git` 的main，不force、不提交node_modules/隔离素材/本地授权音效。随后由用户按README本地锁定安装→依赖/安全检查→完整云函数含node_modules部署，再双账号验证；本轮不代部署。旧弱网/服务端计分信任及合规门槛保持。详细风险与部署门槛见 `docs/release/security-audit.md`。

## 历史：GitHub 交付前检查（已完成，f85a835）

- Owner：当前项目任务，发布前整体验证；状态：`verified_for_git_delivery`。代码检查与局部修复完成；Git交付以本记录所在提交及交付回复为准，微信部署/新一轮真机回归待用户操作。
- 授权：用户确认当前音效可用，要求最后整体查 bug，之后提交 Git 并推送 `https://github.com/final-us/match3-game.git`；微信上传由用户操作。本轮不部署云函数、不上传微信、不清除用户数据、不生成新素材或升级依赖。为修复等待席位修改了battle云函数源码，交付后必须由用户重新上传该云函数才能生效。
- 版本：基础 HEAD `f7ed98a` 加本次提交范围内的已接受月光 UI、音频、玩法表现、测试/文档及下述修复；原生微信客户端无构建步骤。检查对应工作树，最终 Git 身份以本记录所在提交及交付回复为准。

## 检查与修复

- 25 个 `match3-wechat/test/*.js` 脚本逐个以独立 Node 进程运行，退出码及失败标记均检查，无失败。包含单人核心/特殊/障碍/道具、计时/死局、经济/广告、PvP云函数桩/逻辑、UI/引导、音频/生命周期、发布门禁/素材/包体。`simulate`和部分障碍脚本属模拟冒烟，不冒充独立断言套件。
- `winrate.js`：固定种子，第1–40关及100000–100009关，每关200局，共10,000局，使用虚拟每步6秒的随机合法交换；全部在既定变难-12/变易+24个百分点容差内。不代表真人胜率。
- 78 个仓库 JS/CJS/MJS 语法检查通过；新修复相关脚本单独复查。公开候选源码、文档、配置及待推送的5个既有规则历史提交做敏感信息模式检查，未发现匹配；不是凭此声称绝无秘密。
- 广告失败回调：新增回归复现 `onError` 先把对象清空后 `show()` 拒绝导致未处理异常。修复使用稳定广告实例、请求身份、同步异常转失败；激励/插屏的旧实例回调不再结算新请求。覆盖事件与拒绝竞态、同步show/load错误、失败后重试和旧回调；修改前红、修改后商业化回归通过。广告总开关仍关闭，ID留空，未改变奖励/频控。
- 分享更新：新增回归复现单人对局也可能强制更新、同步更新异常却返回已处理吞邀请。修复传入真实场景并使用安全场景门禁，同步失败返回false；无效房间参数先校验。修改前2项失败，修改后runtime7项及release-gates通过；云函数与分享房间协议未改。
- 独立首轮复核发现额外5类边界，故暂停原提交流程并补修：单人playing收到邀请早退保留当前局；同步显示分数与已确认分数分离，网络/服务端失败在截止前重试，正常800ms节流，最后800ms只对新增加的分数提前同步（相同失败分数仍节流）；所有建房/加入/准备/配置/道具/轮询回调绑定battle对象，查询单在途且通过revision排除动作前旧结果，共享动作pending防重入；60秒截止停止新触摸/道具与新增分数显示；等待中退出释放席位、剩余/新加入者重新准备，全员离开使旧房间结束，对局中退出原结算不变。
- 新增`battle-client.js`使用真实Main与可控延迟云回调，验证上述客户端边界、取消后的旧响应、重复在途请求、陈旧轮询回滚、结算后迟到playing、临近截止重试节流。扩展既有云函数桩支持update并验证退出/替补/双方重新准备/开局中退出及空房旧邀请；席位修复前失败，修复后通过。
- 独立复核：既有非实现者代理`01a0a078-7aad-77d3-b7a3-dcb20bd81bf6`首轮发现5类问题；修复后静态契约基本PASS，未发现新的高严重度问题。确认ad实例/请求隔离、更新安全门禁、PvP会话/动作乱序/截止和成员事务规则；未重复主代理通过命令或冒充真实联网。保留离线退出未抵达服务端的席位限制，客户端追加恢复提示并通过回归。
- 资产原文件及声音未在本轮重编码；复用已有解码/听感和已接受视觉证据。`assets/_incoming/` 全部本地隔离，不将未采用候选、供应商记录、第三方参考或Mixkit原音/派生音推送公开Git。正式游戏图片/原创BGM、源码与审核摘要纳入提交；本地 `sfx-acoustic.mp3` 保留且不被微信打包忽略。

## 证据与限制

- 全套日志：本机 `/private/tmp/match3-final-check-ObDNoN/`，不随源码发布。新增后现有26个脚本；PvP修复后执行battle-client、battle-cloud-function、battle-logic、audio、timer、analytics、release-gates、runtime、commercialization、ui-smoke、open-source-and-assets、package-budget共12项，无失败；相关语法及diff通过，其他无相关输入变化的结果复用。
- 静态包体最终字节数见 `docs/release/package-structure.md`；它是文件系统估算，最终微信包体须在开发者工具核对。
- 最新 npm 官方查询：`wx-server-sdk` 最新仍为4.0.2；audit为7项（5 high、2 moderate、0 critical），详见 `docs/release/security-audit.md`。未强制降级或更换部署；本轮不能标记为零安全风险。
- PvP保留服务端60秒硬截止，未放宽迟到分数提交；持续断网到结算、或网络包抵达服务端时已超时，仍以服务端最后接受的分数为准。客户端修复不构成离线补分/服务端权威棋盘承诺。
- 等待态退出请求若因断网未抵达服务器，旧席位仍可能保留至房间TTL；本地返回首页后会提示“退出尚未同步，请网络恢复后重新创建对局”，此时不要继续用旧邀请。未引入后台补偿或放宽服务端权限。微信更新API按常规同步void处理；若平台适配返回异步拒绝Promise，首次邀请仍可能需要用户重开，未宣称此非标准分支已真机验证。
- 用户此前确认单人/双账号真机主流程与当前听感；本轮不声称新增iOS/鸿蒙性能、弱网/前后台或真实广告验证。实际微信上传后，建议两账号从同一体验版本复核分享入口及完整一局；真实广告留待开通后按清单验收。
- 运营主体、备案/隐私合同、商业条款、告警能力和实际平台审核仍由用户按既有记录确认；GitHub推送不是微信上线。素材加载失败的专用重试页尚未实现，当前使用既有绘制降级，不将该体验缺口冒充已完善。

## 下一步

完成精确暂存范围检查后提交/推送origin main；不使用force、不纳入本地隔离素材、不修改用户存档。用户上传顺序：更新battle云函数→上传客户端体验版→双账号测试同版本邀请、等待退出后重邀、开局/弱网恢复/60秒截止→按备案与平台资料提交审核；本轮不代执行。npm现存依赖告警未清零，不将源码交付称为“全部上线门槛通过”。
