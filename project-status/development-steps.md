# 留存内容 · 增量开发顺序

<a id="experience-polish-20261025"></a>
## 真机验收后六项体验调整 · 2026-10-25

- 负责人：三消主综合实现，本轮直接推进；用户已确认上一候选真机功能正常，追加授权更新微信后台隐私、领奖/进入页去除整页加载跳转、三页换笑脸猫、首次入房头像授权提示与后续复用、核查线上battle的profile接口、单人局内设置。随后用户明确授权核环境并部署battle，后台隐私改由用户同步；保留其他owner工作，不提交/推送Git或上传/发布客户端。
- 合同：任务/签到/宝箱仍由玩家手领且可靠保存后才报成功；请求中保留内容和滚动，防重复触发，失败保留可重试状态。头像使用微信原生主动确认按钮，首次入房自动展示可拒绝的用途提示，不强取头像；持久选择与撤回规则同步正文。局内设置暂停单人计时，复用现有音频控制与退出确认。用户随后否决复用旧胜利猫，明确要求新设计一张；改为单次内置imagegen新稿，先隔离、待确认后替换同一页头图，不更换其他角色。
- 当前状态：用户已接受删除小标题后的候选，并明确授权保存本地Git、推送既有GitHub origin/main（final-us/match3-game）。本地实现与受影响检查已完成，本条随游戏候选保存；最终提交身份及推送回执见本轮Git历史/交付回复。正式微信上传/发布不在本次操作内；后台隐私由用户同步。其他改动按用户手机反馈正常，最新设置位置的手机复查仍保留。
- Git交付范围：本轮整合游戏代码、已采用运行素材、相关测试、UI预览工具及现有发布/任务记录，共110个变更文件（含路径迁移）；promo-duel宣传工程与.impeccable自动评议均未纳入，不删除或改动它们。assets/_incoming、node_modules、私有开发者配置、含Mixkit的sfx-acoustic.mp3按既有忽略规则留本地，不强制添加。fetch后HEAD...origin/main为0/0，允许正常前进推送，不重写历史。暂存文件路径/高置信凭据模式检查无发现，open-source-and-assets、release-gates及暂存diff空白检查通过；复用当前已验证的功能/视觉/云部署证据，没有因Git交付重复全套。修正文档中旧跨房头像同意表述以符合本轮已确认实现，未改变玩法/广告/隐私正文。
- 最后文字收尾：只删除棋盘页“单人闯关”绘制块，设置/状态栏/棋盘坐标保持。ui-smoke新增三尺寸/代表关卡均无小标题断言并通过，相关语法/diff检查通过；预览64862（exec37962）的390画面`/private/tmp/match3-solo-no-heading-20261025/solo-390.png`已目视，4个热区正常。复用三档对齐/44px/暂停回归及原包体上界3,378,913字节（仅删源码、无新素材），不重复无关检查。
- 实现：`platform/retention-client.js`增加非持久loaded/busy/pendingAction展示状态，保留单一sync Promise与原出站/凭据恢复；`render/retention-ui.js`保留内容和滚动、未知资格用占位并禁领，仅真正失败切恢复页。可靠保存后轻提示“领取成功”；仅ACK传输失败且无未保存凭据/请求时留在正常页，ACK仍保留，其他异常不伪装成功。`main.js`/`render/ui.js`增加单人局内设置，解析/存储操作忙时不打断，暂停计时、共享音频开关、继续及带确认的退出；关闭原局失败不丢局，收到邀请时不切走暂停中的单人局。设置最新位置见下方定位修复，已替代原先在HUD上方的布局。
- 单人设置最新定位：上一版信息卡左侧槽位已被用户否决，已撤回对数据三列/双目标/时间横向位置的改动，game-layout恢复至HEAD无差异，ui-smoke恢复关卡在屏幕中心及双目标/时间对应上排三列的原断言。Main只把已调用的getMenuButtonBoundingClientRect矩形经有限数/视口边界校验后保存到临时screen.menuButtonRect，不新增平台请求、存储或上报。UI设置位于左侧safeLeft+10、宽68，视觉高度和中心取实际微信胶囊矩形，点击范围至少44px并限制在原HUD上方；测量不可用时沿现有contentTop估计。既有标题/状态栏/棋盘/道具尺寸与位置保留。
- 定位验证：solo-settings与home-display-state改前分别复现“入口仍在HUD内”和“Main没有矩形”断言失败；改后15组（三宽×五种安全区/测量情况）检查视觉中心与胶囊一致、入口与标题/原HUD/目标不相交、44px热区与中心命中，保留暂停/音频/退出行为回归。真实Main构造+Core/UI/内存wx验证测量转换、contentTop仍91、通过绘制返回的热区实际点击进入设置且计时暂停，以及无效矩形/接口抛错安全处理。solo-settings/home-display-state/ui-smoke/activation-main均通过，8份相关JS、66模块预览语法及diff空白检查通过；layout detector改前/后均[]，不把静态扫描当视觉验收。没有新增安全/账务/云端改动，不重复旧全套。
- 定位画面：`/private/tmp/match3-solo-settings-capsule-20261025/solo-{320,390,430}.png`三档均已目视，左上设置与右上胶囊示意持平、标题和恢复后的三列数据无重叠；预览64862（exec44250）直接运行现有Canvas模块，390显示4个真实触区且无越界提示。右上胶囊是按代表性平台矩形画的示意，页面已明确说明，真实手机以微信API返回值为准；不当作微信原生画面证据。旧信息卡方案60704/exec68294已停止，截图只作历史，不继续推荐。
- 头像：真实create/join成功都调用beginRoom，首次显示可跳过的用途卡；原生按钮只覆盖明确“使用微信头像”操作，引导存在时不叠原生层。主动选择后仅保存安全头像URL和sharingConsentVersion1；后续房间核对wx.getSetting及当前getUserInfo返回头像一致性后才复用；拒绝、撤权、头像变化或检查失败走提示/猫咪，旧存档不等于同意。跨房和迟到回调有代次隔离，仅向现有profile接口写头像；无新云字段/收集对象/云端期限。官方小游戏SDK源文档确认scope.userInfo不能靠wx.authorize强弹，采用createUserInfoButton而不模拟原生点击；官方网页读取失败，参考微信官方开源SDK链接，不引用第三方教程为规则。
- 隐私：`core/privacy-policy.js`及[完整审阅稿](../docs/release/privacy-policy-review.md)同步2026-10-25.2、16节，原生效日/主体/联系方式保留，新增首次提示/本设备保存分享选择/后续授权核对。用户明确确认后approvedForRelease=true；privacy-reader全文镜像/排版与release-gates通过。微信后台mp.weixin.qq.com按用户本轮授权访问仍被浏览器站点安全策略明确阻止（未触发自动审批），未改用其他表面绕过、未改官方指引；需账号操作人手动同步已确认正文。
- 云端核查与部署：此前控制台cloud1的battle/$LATEST为100%流量、2026-10-17 23:58:06旧版，下载ZIP证实缺profile。用户随后明确授权核环境并部署，另明确允许本次临时CLI端口并在完成后关闭。官方CLI实际env list返回唯一cloud1-d9g4pv8m8457af92a，与客户端固定ID完全相同；部署前info为Active/Nodejs20.19/3秒，下载旧版至`/private/tmp/match3-battle-deploy-20261025/before`，可部署回退目录为同根`rollback/battle`。当前源较旧云业务代码仅index.js变化，锁/manifest/vendor及实际依赖库内容一致；旧下载的.bin/semver是平台序列化链接文本，非运行库变化。
- 部署结果：2026-10-25本轮官方CLI对匹配环境的battle执行deploy --remote-npm-install false，返回success:true、6911files、7.4MB；未另行修改客户端/数据库权限/触发器配置。随后info仍Active/Nodejs20.19/3秒；再次下载至`/private/tmp/match3-battle-deploy-20261025/after`，6911个上传文件与本地逐字节一致，包含profile函数及路由，下载副本cloud-dependency-security通过。CLI只省略npm命令入口符号链接.bin/semver，实际semver文件与依赖库完整；初次比对夹具误以为平台会保留序列化链接而ENOENT，独立命令修正为核对该精确遗漏及真实目标文件后exit0，未将同shell后续成功遮盖前一失败当通过。部署前本轮battle-profile、依赖安全/SDK适配、npm ls、daily-engine四文件同步核对均通过，未重复无关套件；之前有效干净ci证据按未变依赖输入复用。真实头像授权/房内展示仍由用户手机验收，不把文件校验当真实调用成功。
- 临时端口与意外操作：只开启本机CLI服务端口11779，登录票据/默认信任/多端插件均未启用；云端校验后经原生设置关闭，复选框0且明确“命令行和HTTP都无法调用工具”。定位控制台时误用快捷键触发一份开发预览（7857KB、二维码19:07失效、上传耗时9058ms），已向用户说明并关闭弹窗；没有正式上传/提审/发布。后续使用官方CLI及明确菜单，不再猜快捷键；此意外预览不冒充本轮正式上传授权或手机验收。
- 新猫：内置imagegen实际1次，无参考图/玩家资料/代码上传，无外部供应商或购买；具体模型/seed/费用未返回。用户已采用，`assets/_incoming/header-smile-20261025/`保留原图、448×336真透明候选48,994bytes、完整prompt和provenance，以及旧图备份。确认稿已原样推广至活动`ui-art/header-cat.png`，商店/每日任务/七日签到沿用同一素材key；比旧图56,992bytes少7,998bytes。最终画面直接加载活动图，不依赖候选覆盖参数。
- 有效回归：22项独立脚本通过（按变化重跑受影响项、复用本任务仍匹配结果）：user-profile、battle-client/avatar-main/wait-resilience、retention-client/manual/preview/integration/wallet/presentation、solo-settings/resume-main/economy、level-analytics-main、activation-main、audio、ad-main、ui-smoke、open-source-and-assets、privacy-reader/entry、package-budget。新增retention-presentation使用真实client/service/wallet加受控延迟，验证首开占位、请求锁/滚动、重复触发、可靠到账提示、ACK-only续页、真失败与重试一次；solo-settings覆盖真实Core暂停/继续、忙操作、音频、退出取消/保存失败及三档44px边界。旧测试中“引导时必须创建头像按钮”和旧成功文案与新合同冲突，已保留关键断言并改为引导关闭后验证异常/恢复，无逐帧重试。新猫接入及正文确认后，privacy-reader/release-gates/open-source-and-assets/illustration-art/illustration-art-loader/package-budget通过；本轮暂停修复后level-analytics-main/solo-settings/solo-resume-main/solo-resume/solo-economy通过，solo-resume含30个故障/重启/重放/时钟场景。相关JS语法、66模块预览语法、diff空白及原三份UI静态detector通过；无新增依赖或账务后端改造。
- 独立复核与修复：经用户明确许可，Chandrasekhar（01a1726d-c979-75c0-96ac-bd7b3bfe8681）只读审阅头像授权、领奖恢复及设置；请求配置GPT-6.1 Sol/medium，工具返回agent id，不证明上游实际模型。头像/领奖未发现具体阻塞；发现P2本地solo_complete用时把设置暂停算作游戏时长。主任务新增暂停累计及兼容旧存档的可选journal字段，保留原startedAt；后续复核指出写前失败恢复旧journal会覆盖累计。最终改为只对同journal id/startedAt/level的原局合并较大累计、补剩余设置暂停，仍使用recover后的revision与既有CAS保存，不同局不混入内存值。新增真实Main/Core/journal测试先复现0!=125000，再验证写前/写后throw→实际retry→125000ms累计、身份/体力/金币/道具不变、local lt_30s且official10秒；重复暂停、退出取消、统计关闭及正常checkpoint也通过。原审阅者定向复查通过，P2关闭，仅复用有效测试证据未重复执行或写入。双方候选none；平台与设备验收仍保留。
- 实际运行：隔离Main/Core/客户端/钱包/本地createService预览53568（exec6055），通过可见控件签到2460→2560、关闭重进仍2560且页面保持retention_preview；从真实首页选99关，按顺序完成可见引导，设置→音效开关（存储29→30）→继续→再开设置，状态playing/solo_settings及开关保持正确。只使用合成内存账号/存档，无真实云或广告；此fixture缺可选装饰分包能力，不作全素材外观凭据，也不代替手机原生头像授权。
- 画面证据：原UI装配24帧保留在`/private/tmp/match3-experience-polish-20261025/`，其中未变的三尺寸设置/授权卡按源匹配复用。Mac解锁后，最新58219（exec90818）直接使用正式活动页头图，在320/390/430补shop/signin/tasks/retention-loading/retention-claiming/solo共18帧，保存至`/private/tmp/match3-experience-polish-accepted-20261025/`，热区问题均0。目视320未知占位/禁领、390原页领取中及任务页、430商店，新猫和暖白提示已生效。三帧solo的旧通用热区检查只因settings在contentTop上方报警；专用测试证明其在safeTop与HUD之间并远离胶囊，工具判据已限定修正而非全局放宽。该预览为真实绘制模块加合成状态，不请求真实云/广告/存档；最新页保留供审核，不作真机或自然领奖证据。
- 当前静态预算：本轮胶囊对齐修后主包3,378,913/4,194,304bytes（余815,391），总包8,414,502/31,457,280bytes，93/136文件；素材/音频未变，启动21keys/20unique，预算通过。下一步先由用户看新位置，再在最新客户端预览中复查手机实际位置；其他改动按用户反馈正常保留，后台2026-10-25.2正文由用户同步。battle已部署并核匹配，布局修改无需再部署；未提交Git或正式上传/发布客户端。
- 记忆：严格approved项目召回hit，functional-preview r1原文复用且实际应用验证隔离方法；request-settle-once r1已读原始document，仅用于审查单一Promise/迟到与恢复边界，不把12秒推广至PvP或把客户端超时当服务端未执行。新增云部署范围检索仅返回functional-preview与low-maintenance r1，后者与部署无关，仅检索未采用。无规范module映射；复用本任务小批原Markdown审计unreviewed0、needs-evidence1，无冲突/新增相关待审。候选none（部署状态已有权威记录，无需重复提炼或推广）。
- 交付记录自检：当前turn的记忆绑定/交接已更新，Git提交前运行handoff.py；原analytics.py格式检查证据复用，diff空白检查通过。旧预览exec31435/6055/90818/68294/44250均已停止，最新64862由exec37962提供。候选none，本次保存项目候选与已接受决定，不新增记忆候选；Git提交身份由Git生成并在交付回复列出，不在提交内伪造自引用SHA。

```memory-task
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#experience-polish-20261025","session_id":"01a01f4a-9054-7200-a8c7-4d093c5c4127","turn_id":"01a1739e-c554-7861-af29-16596e157a72","state":"active"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-functional-preview","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#experience-polish-20261025","delivery_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#experience-polish-20261025","date":"2026-10-25","stage":"validated","purpose":"execution","action":"沿用真实Main/Core/钱包与隔离服务，通过可见控件验证签到2460→2560且重进不重领；真实选关进入设置、切换音效、继续再开。只证明本地隔离方法及对应消费者，不证明微信云/原生授权/真机。","check":{"result":"effective","evidence":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#experience-polish-20261025"}}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-request-settle-once","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#experience-polish-20261025","date":"2026-10-25","stage":"retrieved","purpose":"review","action":"核读原始document的适用/排除边界，以审查此次领奖单一Promise、迟到与恢复合同；没有修改cloud适配层，也不将12秒当通用超时或服务端ACK保证。"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-low-maintenance","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#experience-polish-20261025","date":"2026-10-25","stage":"retrieved","purpose":"review","action":"云部署增量approved检索返回留存低维护偏好，与环境核对和部署不相关，仅检索未采用。"}
```

```memory-handoff
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#experience-polish-20261025","turn_id":"01a1739e-c554-7861-af29-16596e157a72","recall":{"project":"reused","module":"not-applicable"},"memories":[{"memory_id":"match3-game-functional-preview","revision":1,"stage":"validated","purpose":"execution"},{"memory_id":"match3-game-request-settle-once","revision":1,"stage":"retrieved","purpose":"review"},{"memory_id":"match3-game-low-maintenance","revision":1,"stage":"retrieved","purpose":"review"}],"no_usage_reason":null}
```

<a id="release-review-20261025"></a>
## 近期改动整体检查与更新说明 · 2026-10-25

- 当前修复轮：用户已授权只修复下列4项并重跑相关回归，暂不提交或上传。4项本地修复及12项受影响回归已完成；直接实施，未委派。复用本任务上一轮approved召回、原文和未受影响证据，不重复检索/无关整库检查。隐私仅采用前轮明确提出的“准备、对局及结算页展示”补充，不新增收集/接收方/期限；本地版本2026-10-25.1、原生效日保持，后台同步仍未执行。下方35/36及缺陷表是修复前历史。
- 用户范围：先检查近期改动/潜在bug、汇总待办及更新说明，随后用户追加批准本地修复4项与相关回归。保留其他owner工作，不提交/推送/上传/部署/改平台，不扩大到玩法、奖励或数据采集行为改造。
- 检查身份：实际仓库HEAD d5a0d4c（main与本地origin/main指向同一提交）＋现有并行工作树，不把HEAD当全部当前候选。近期UI、启动与广告/官方统计增量由其他现有会话实现，本主任务作为这些增量的非实施者进行审查，不再委派；不沿用老QA覆盖新输入。源可能并行变化，交付核对相关变化后仅重跑受影响项。
- 权威证据入口：UI本地视觉已接受，后续未验边界见[UI production](ui-production.md#页面插画风格效果稿--2026-10-20)；启动优化见本文件原条目；广告/官方统计当前配置、手机回调和后台收数见[monetization](../docs/release/monetization.md#wechat-official-analytics-20261020)及[发布执行卡](../docs/release/ad-measurement-plan.md#wechat-native-phase1)。10/18自建统计是已被后续官方路线替代的历史草案，不据其推导当前隐私/费用/功能。
- 计划检查：比较当前源码与既有通过证据，针对共享Main/UI/钱包/头像/广告/官方统计/云profile的实际交叉边界做代码审查和本地回归；核包体/素材/隐私门禁，按需要实看现有合成预览及真实Main隔离入口。复用仍匹配的关卡平衡/音频/未变后端证据，不无差别重跑。应用启动/真实广告/原生头像/双账号网络/微信平台及设备结果不能由源码或合成预览替代。
- 当前状态：本地检查、4项修复及更新说明已完成，受影响回归通过。未发现已复现的新增P0/P1玩法/资产故障；未确认线上云版本/后台隐私/最新设备包身份，不能给无条件上线结论。用户明确要求暂不提交或上传，保持本地工作树。
- 记忆：当前严格approved项目召回hit，functional-preview r1/shop-list-cta r1已核读；前者实际用于下述真实Main隔离检查并验证方法有效，不代表微信验收；旧同行规则未采用。无规范module映射；小批原Markdown审计unreviewed0/needs-evidence1、无冲突/新增相关待审。候选none，本轮具体缺口与状态留权威记录，不重复捕获或批准旧候选。

### 修复结果与相关回归

- 引导改为“各道具独立冷却10秒”，签到副标题改为“签到领好礼”；仅修正文案，实际冷却、累计签到与奖励规则不变。onboarding/retention-preview补断言，先在改前源码分别复现失败，再在修复后通过；三档宽度的原绘制/触控边界检查保留。
- 可选头像用途补全“准备、对局及结算页展示”，本地正文和完整审阅镜像同步为2026-10-25.1（更新日10/25，原生效日9/19）。privacy-reader新增场景与版本断言，改前日期断言失败、改后16节逐段镜像与320/390/430全文排版/分页/滚动通过。正文确认仅覆盖用户明确批准的限定修复，approvedForRelease保持true；后台未更新，不替代平台一致性检查。
- battle-client钱包测试桩补invalidateDisplayCoins并计数，验证回前台调用一次；实际Main/coin缓存失效及发奖逻辑未动。原文件生命周期测试由失败恢复为通过，相关复用fixture的头像/时钟/比分道具/道具V3集成也通过。
- 本次12项原文件命令均退出0：node match3-wechat/test/{onboarding,retention-preview,privacy-reader,privacy-entry,release-gates,battle-client,battle-avatar-main,battle-clock-samples,battle-score-item-regression,battle-items-client-v3,ui-smoke,package-budget}.js（逐项执行，非通配符单次命令）。本次7份改动JS语法与全工作树diff空白检查通过；未重复上一轮未受影响的广告/钱包/核心/后端全套。
- UI仅两处短文案，沿用已接受布局/素材及上一轮隔离Main运行证据，不将其写成修后微信真机证据。Impeccable对onboarding/retention-ui手动detect退出0、无报告项；原绘制三尺寸回归验证字句无溢出，不据静态检测宣称所有设备无视觉问题。
- 修后静态包体：主包3,366,613/4,194,304字节（余827,691），总包8,410,200/31,457,280字节；93主包/136总文件。ui-art与result-art未变，仍分别只余738和约1760字节内部预算。此次无新增素材/依赖，实际微信打包与设备边界仍待后续。

### 历史：检查发现（修复前）

| 级别 | 位置与证据 | 影响与最小建议 |
| --- | --- | --- |
| P2 | js/render/onboarding.js:55的pvp_wait仍写“道具共享10秒冷却”，现行battle-items客户端/云集成与items-v3检查证明四道具独立冷却 | 新玩家会被错误引导。改为“各道具独立冷却10秒”，保留实际道具规则，补文案断言。不是发现现有逻辑仍共享。 |
| P2 | js/render/retention-ui.js:99副标题为“连续签到领好礼”；云retention.js:173–175及273–276按累计signCount推进，漏一天不清零 | 容易让玩家误解漏签失去奖励。建议用“签到领好礼”或“七日签到领好礼”，不改累计规则，不重新添加用户已要求删除的长规则文字。 |
| P2 | js/core/privacy-policy.js:80及审阅镜像只写“准备及结算页展示”；Main:2984–2992已在battle_playing传双方头像 | 用途说明不够完整。将该句限定补为“用于双方准备、对局及结算页展示”，同步正文/镜像并确认采用后在后台官方指引同步；不新增上传对象、数据或期限。是源码/披露差异，不在此断言平台法律违规或审核结论。 |
| P2 | 原命令node match3-wechat/test/battle-client.js退出1：coin.invalidateDisplayCoins is not a function；fixture的钱包桩在test/battle-client.js:18缺此新方法 | 阻断该项原文件回归，不是实际coin模块缺方法。仅内存替换fixture添加空invalidateDisplayCoins后整份对战生命周期套件通过；磁盘未改。建议只补测试桩并重跑本项/依赖此fixture的必要用例，不在产品里为测试移除缓存失效。 |

### 历史检查证据与仍适用的限界

- 本地Node v24.19.0，针对当前共享Main/新UI/官方统计与启动增量重新组合检查：原文件共36项，35通过、battle-client一项夹具失配失败；不能写成全部36通过。其余通过项为ad-lifecycle/ad-main/ad-rewards、home-display-state、solo-resume-main/solo-economy、coin-receipts、retention-wallet/integration/manual、level-analytics-main/home-analytics-main/activation-main、battle-avatar-main/battle-profile、user-profile、battle-items-client-v3/items-v3/rematch、ui-smoke/shop-card-layout/battle-illustration-ui/stamina-card-layout/retention-preview、illustration-art/loader/result-art-loader/catalog-subpackage-qa/open-source-and-assets、privacy-reader/privacy-entry、cloud-dependency-security/audio、package-budget/release-gates。逐项核对退出码和失败标记；原文件battle-client仅内存补桩诊断另行通过，未混入35项。
- 64份改动/新增JS或CJS执行node --check通过，game.json/project.config.json解析通过；全工作树git diff --check通过。变更信任边界重点核对头像profile的成员/轮次/URL范围、query仅同房、只更新自己头像且不触准备/道具/比分，原生统计缺接口/拒绝/日志门控与未开通指标零远端。未改变依赖/密钥或放宽保护，cloud依赖安全检查通过。未重做无变化的难度标定/音频制作/完整所有测试库。
- 本主任务作为近期实现的非实施者补代码/回归与代表运行画面复核；没有委派子智能体。实看最新同源已接受的320房间与第7天滚动截图，信息/按钮可读；Impeccable上下文与指定6个UI文件手动detect为[]。游戏Canvas并非普通网页，未虚构WCAG/读屏/所有机型评分，也不因自动检测空结果宣称无视觉问题。本轮没有重新设计或替换已接受素材。
- 独立运行现有tools/preview-retention.cjs --functional，真实Main/Core/UI/客户端/钱包与后端createService，只将传输替换为每页独立内存服务；127.0.0.1:55894，本轮exec91975，临时2460金币/99解锁/合成日期，无玩家存档或真实云/广告。CUA经可见辅助按钮运行两局真实核心（动画加速，不证明自然难度）：首局任务1/1/67、已领0/0/0、钱包2460；领取任务1后2500、活跃20；重复点击及关闭重进仍2500、已领1/0/0。第二局任务1/2/80、其余未领取，钱包仍2500；服务器日期+1天后任务0/0/0、已领0/0/0，点击原任务2热区不发奖。该UI检查证明刷新后无过期可领，精确北京时间午夜/旧请求拒绝由本轮retention-manual覆盖，不声称真实等待午夜或手机冷重启。可选装饰分包在此fixture无平台接口，使用可操作回退；不把它作为已接受全素材UI外观证据。
- 临时运行证据为/private/tmp/match3-release-review-20261025/{manual-claim-once.png,expired-task-no-credit.png}，仅合成数据；已存在的三尺寸正式素材/回退截图及对应受影响检查按UI当前条目复用，不将旧无效帧算新通过。
- 包体本次静态核对：主包3,366,638/4,194,304字节（约3.21MiB，余827,666字节），总包8,410,225/31,457,280字节（约8.02MiB），93主包/136总文件；启动21keys/20unique。ui-art1,572,126/1,572,864，内部余738字节；result-art1,675,962/1,677,721.6，内部余约1760字节，均通过但新素材需先留余量，不抬预算。这些内部装饰预算不是微信新增平台限制；静态估算不替代微信正式上传体积。
- 证据复查：本轮末Main、config、ad、coin、heart、assets、privacy-policy、battle/index的Git差异行数与开始时一致，未看到这些相关输入发生新并行修改；不将行数等同完整内容哈希或实际发布包身份。UI/统计各原生/真机证据沿各owner当前记录，只在其确切候选范围复用，不重复要求已确认的关卡进入/成功/失败/重试或10/18广告转场诊断。

### 仍需用户操作（收尾后集中处理）

1. 4项本地修复和相关回归已完成；采用的2026-10-25.1正文仍需在微信后台同步，包括已确认的10/23统计增量与本轮批准的局内头像展示补充。设置优先打开官方页，仅本地更新不足，后台同步仍未确认；不重复索要已确认正文。
2. 核对当前线上battle是否已有本地新增profile接口和头像投影；本轮未连接云端读取版本。未同步时需部署本仓库当前battle及依赖（含原transaction修复），已同步则不要无意义重复部署。客户端和云端要匹配，原环境ID/资格/广告位已确认的资料不重新索要。
3. 用最终同一候选做微信实际打包及一轮iOS/安卓或鸿蒙冒烟：冷启动/退后台体力金币更新；商店上下滚动不误买/误播；单人正常结算与复活恢复；任务手领/重进不重领；双账号首次头像选择、入局/结算头像、四道具独立冷却及断线/续局。仅正常路径一次，不刷真实广告、不清玩家存档或重开已按用户决定结束的开发版广告转场诊断。原生头像层、字体/安全区、分包弱网/首次加载、最新整包设备耗时尚未由本轮证明。
4. 统计仅补已有记录可查的启动系统7；自然复活4纳入发布路径时核对，不要求重测已由用户后台确认的关卡进入5/成功1/失败2/重试3及已有首页提交。正式DAY+1汇总需实际获批发布后核对，现阶段不伪造可提前完成。确认实际当前版本号（此前“应该2.0.0”未后台核实，2.0.1只是草稿）及最终采用范围，最后再执行另行批准的Git/微信上传、审核/发布；本轮未做这些操作。

更新说明已另存[下个版本更新说明草稿](../docs/release/release-notes-20261025.md)，仅列当前已实现/已核对内容，不含仍未正式接入的五类障碍、不宣称启动已实测缩短几秒或上线完成。

上轮检查交付自检：文档局部diff、analytics.py与当轮handoff.py通过，valid:true、issues:[]，usage2/2；只证明交付记录一致性。隔离预览服务exec91975已停止、临时浏览器页关闭，截图保留。本次修复沿用该运行证据限界，没有新增平台调用或后台业务任务；本地产品/测试修复如上。

本次修复交付自检：上述12项回归、7份JS语法、diff空白检查均通过；更新说明与发布卡已链接当前2026-10-25.1正文。analytics.py及本task/current turn的handoff.py通过，valid:true、issues:[]、usage2/2。无新的可复用方法候选（none），具体修复和状态只记本任务；未stage、commit、push、上传、部署或改后台。

```memory-task
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#release-review-20261025","session_id":"01a01f4a-9054-7200-a8c7-4d093c5c4127","turn_id":"01a17204-6b03-7861-b4a6-1ec6ecf1fb57","state":"active"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-functional-preview","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#release-review-20261025","date":"2026-10-25","stage":"validated","purpose":"review","action":"采用既有functional真实Main/客户端/钱包/Core和隔离内存服务，以可见辅助按钮跑两局、手领一次与重复/重进、模拟跨日；2460→2500且重复/过期不增。仅验证本地方法及对应链路，不等同微信真机/自然难度。","check":{"result":"effective","evidence":"/private/tmp/match3-release-review-20261025/manual-claim-once.png"}}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-shop-list-cta","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#release-review-20261025","date":"2026-10-25","stage":"retrieved","purpose":"review","action":"核读历史四商品/操作状态边界；旧同行排列已被用户明确上下排列取代，未以记忆否决新布局或把历史截图当当前手机证据。"}
```

```memory-handoff
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#release-review-20261025","turn_id":"01a17204-6b03-7861-b4a6-1ec6ecf1fb57","recall":{"project":"reused","module":"not-applicable"},"memories":[{"memory_id":"match3-game-functional-preview","revision":1,"stage":"validated","purpose":"review"},{"memory_id":"match3-game-shop-list-cta","revision":1,"stage":"retrieved","purpose":"review"}],"no_usage_reason":null}
```

<a id="ui-conversation-handoff-20261024"></a>
## ui美化-新 · 会话接续 · 2026-10-24

- 用户授权：创建“ui美化-新”，继承“ui美化”的所有事项，按当前进展继续；旧会话01a16188-82b1-7761-bdda-c23ab9d15632保持不变，原“页面美化”01a0d93b-1096-7f21-9808-15e4eb691813也保留。已在同一消除项目/本地工作区创建新会话01a16c6d-4979-71b0-9fe6-10b8a556d91a（host local）；没有新建或重置仓库、改名/归档旧会话、提交/推送/部署/上传。本协调条目不接管产品UI记录。
- 权威入口：[原UI任务](ui-production.md#页面插画风格效果稿--2026-10-20)，保留原task/delivery及已接受设计/有效证据；已分页核对原会话用户要求和最近结果，最新有用户“继续精修改动画面”，其后429/502及中断没有新增实施结果。10/23旧记录的paused是当时接续点，不覆盖本次恢复推进指令。
- 当前重点：原五项页面改版已本地实现且有124帧历史自检，随后用户否决双猫，要求多个更美观方案、商店道具往中间、继续对照设计精修。商店道具/底座/文字已内移约10–12px；房名牌/花簇/按钮猫爪有本地改动，五项受影响测试/语法通过但新Canvas批次未确认。先核验双猫A“原稿精修”/B“圆脸软萌”的原生成结果，放进同一房间布局比较，用户选定前不替换活动双猫；再补320/390/430本轮实际Canvas、触区/滚动及缺素材回退，按实际变化复用/更新测试证据。不把旧124帧或老双猫当新方案接受。
- 生成结果线索：assets/_incoming/prep-duo-variants-20261022/generation.json仍记录两个请求已发出但结果未知；本轮只读发现原会话生成目录有4张PNG，其中exec-2ad335c4-0307-4543-81ca-8afe7f18680f.png（1,823,212bytes）及exec-78b6af06-9d4c-41aa-90ca-d4e23dd51381.png（1,660,152bytes）晚于此前两图。只证明文件存在，尚未目视/核对对应A/B或透明/构图，不宣称生成成功或已采用；新会话先核对原返回/看图，再决定后续，不盲目重发。
- 继承授权与限制：原用户已明确不使用子智能体、直接Astra；请求新会话gpt-6-astra/xhigh，实际上游模型未验证。原会话已核实用户对本轮内置图像工具回复“使用内置工具不限次数”，仅沿用本轮UI、自有图片/现有额度、无外部服务/购买/其他资料上传的范围；次数授权不等于新增费用或供应商授权。素材未选定先隔离比较，视觉门/透明检查不免除。所有按钮仍淡粉主要/淡蓝退出/亮蓝广告，商店上下CTA及44px/滑动取消购买广告合同不倒退；原生数据/头像隐私/奖励/玩法不改。
- 其他既有事项：UI记录保留五类局内障碍材质已接受但正式接入/自然动画/平台验证未完成等后台事项，接任者按现有门和批准范围管理，不因继承全部事项就自动扩大当前精修范围。并行“启动性能优化”在本文件已有10/23有效实现与独立复核；coin/heart/main/assets及project.config改动保留，不拿UI旧包体数覆盖更新工作树，也不重复无关检查。广告/统计/隐私/其他dirty文件一并保留。
- 接续资料：assets/_incoming/ui-illustration-concepts-20261020/接受稿、ui-illustration-production-20261020/refinement-20261022/来源及runtime/历史；preview-ui-illustration-runtime.cjs当前输出runtime/refinement-20261022b，旧URL127.0.0.1:52162、exec24522仅历史，当前未核实存活。新会话核对后恢复必要预览；组件合成状态不是微信自然流程/真机证据。本轮主任务未改产品/素材或调用生成。
- 共享记忆：本轮严格approved召回hit，shop-list-cta r1/low-maintenance r1只检索；旧同行CTA不适用最新上下排列，未采用或批准新规则；无规范module映射。小批原Markdown审计unreviewed0、needs-evidence1，无冲突/新增相关待审。候选none，会话进度与未确认素材不写持久知识。
- 交接交付：新会话初始消息已包含当前接续点、全部原UI记录入口、最新A/B任务及生成目录线索、真实用户内置工具次数授权与边界、Astra直接执行/不委派偏好、启动优化保护及证据限制。通过检查点＋原始会话读取引用继承，不宣称新会话已自动载入全部原始聊天；源产品和素材仍由新owner核对推进，本主任务未并发实施。

```memory-task
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#ui-conversation-handoff-20261024","session_id":"01a01f4a-9054-7200-a8c7-4d093c5c4127","turn_id":"01a16c6a-7d05-7732-826c-341187a93e37","state":"active"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-shop-list-cta","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#ui-conversation-handoff-20261024","date":"2026-10-24","stage":"retrieved","purpose":"review","action":"承接时核对旧商店记忆，同行布局已被新用户上下排列覆盖；未采用旧排列，不把召回当视觉接受或额外授权。"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-low-maintenance","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#ui-conversation-handoff-20261024","date":"2026-10-24","stage":"retrieved","purpose":"review","action":"仅返回/读到留存低维护偏好，与本次UI会话恢复无关，未采用。"}
```

```memory-handoff
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#ui-conversation-handoff-20261024","turn_id":"01a16c6a-7d05-7732-826c-341187a93e37","recall":{"project":"hit","module":"not-applicable"},"memories":[{"memory_id":"match3-game-shop-list-cta","revision":1,"stage":"retrieved","purpose":"review"},{"memory_id":"match3-game-low-maintenance","revision":1,"stage":"retrieved","purpose":"review"}],"no_usage_reason":null}
```

<a id="startup-optimization-20261023"></a>
## 启动性能优化 · 2026-10-23

- Owner：启动性能优化；状态：本地实现与独立复核完成，awaiting_acceptance；下一步由用户决定是否生成手机候选并测安卓/iOS，不自动上传。用户批准前三项：排除未使用按钮运行图、同路径背景复用图片对象、首页展示使用可失效快照；保持内容/画面/操作体验，验证体力/金币/奖励恢复；未部署、上传、提交或推送，保留所有其他会话dirty改动。
- 基线：HEAD d5a0d4c＋本轮开始时工作区；仅相关改前副本保存在/private/tmp/match3-startup-20261023/{main,coin,heart,assets}.before.js、project.before.json、package-budget.before.js，HEAD全部差异不是本任务。最终无构建步骤；主包静态估算3,359,401字节/92文件，总包8,224,976字节。手机已安装包与当前本地候选未核对，不声称6秒已经缩短。
- 实现：assets.js排除homeButtonPrimary/Secondary注册，project.config.json精确忽略其源PNG（文件保留）；减少339,501字节资源，23个启动图片对象→20个、21个key，同路径背景别名指向同一Image，进度仍按key、成功/失败均只结算一次。没有改分包预取时机、音频、云请求、画质或绘制规格。
- 展示快照：core/coin.js新增getDisplayCoins，仅首页绘制使用；扣款/发奖/回执WAL仍走原持久化读取及恢复。所有钱包写尝试先失效，读取异常不保留成功快照；core/heart.js新增getDisplayState，倒计时由快照计算，恢复截止点重新读取/结算，写入及业务读取失效；main.js首次实例和onShow（含广告早退分支前）失效。失败快照不缓存，既有出错状态/重试保留。稳定首页60帧同步读取从旧调用链420次降为0次，写入0次；不等于真机耗时收益。
- 变更文件：match3-wechat/js/{main.js,core/coin.js,core/heart.js,render/assets.js}、project.config.json、test/{package-budget.js,catalog-subpackage-qa.js,home-display-state.js}；本记录只增加本owner条目，不接管其他owner记录。
- 有效验证：现有heart、coin、coin-receipts、ad-rewards、retention-wallet、solo-economy、stamina-purchase、solo-resume-main、home-analytics-main、activation-main均通过；日志/private/tmp/match3-startup-20261023/*.log，逐项核对exit0且无失败标记。新增home-display-state通过，实际Main/UI/核心配内存wx，覆盖60帧0读写、倒计时/到期恢复、扣心/返还、金币购买、预热缓存后回执各WAL阶段写前/写后失败、金币+道具部分到账、广告体力奖励与前台恢复、持续错误后重试、广告早退刷新和回拨时钟。package-budget、illustration/result loader、catalog-subpackage-qa、相关语法/定向diff检查通过。catalog旧测试按key计图片数量因复用设计过时，只改为唯一资源路径数，未放宽图鉴排除要求。
- 独立QA：非实施者Schrodinger/01a16461-beda-7881-bed1-5f3f082e1a80只读复核，无阻塞；/private/tmp/match3-startup-20261023/independent-qa.cjs通过115故障场景、11业务操作、1360断言，对照旧实现的返回值/持久化状态并检查展示刷新，覆盖初始待恢复WAL、重复回执、自然恢复、前台广告早退、广告体力恢复；资产同步/异步混合失败及重复回调、精确忽略规则也通过。不把测试文件名中的QA当独立角色证据。实施者与QA的有效证据互补，未重复跑全部套件。
- 浏览器画面/入口：复用tools/preview-retention.cjs的真实Main+UI+内存wx，临时runner只替换改前四份源码建立before与after对照；无真实存档/云/广告，均0云请求。固定时钟与相同绘制帧数，在320×568、390×844、430×932三尺寸，首页与浏览器真实指针点击“单人闯关”进入后的选关页像素完全相同、触区对象完全相同。结果/12帧在/private/tmp/match3-startup-20261023/visual-results.json及{before,after}-{home,levels}-{320,390,430}.png；Owner目视最终320/430首页与320选关。最初连续渲染采集一次早于切页绘制，另一次金币图标局部差异；改为控制相同帧数/时钟并等待实际绘制，不改产品或容差，最终严格像素一致。该证据不是微信安卓/iOS设备视觉/启动验收。
- 委派：资产独立文件包由Russell/01a1645f-f0b3-7b90-a784-b50491f6a452处理，owner负责展示边界及集成；两个worker本地配置worker.toml固定Sol/medium，工具返回agent id，不证明上游模型。两个worker均已关闭；未修改会话归属、未跨会话发送消息。实现拒收0轮；测试旧断言及采集夹具校正不计同criterion方案拒收；真机数据/成本未知。
- 共享记忆：复用同任务10/22严格approved项目召回；low-maintenance/audio-feedback不适用于本次执行，未采用，无module映射。候选match3-game-20261023-display-cache-transaction-boundary经v2/隐私检查，capture返回pending-local；尚未提交/提取/审阅/批准，独立QA与资产worker候选none。抽取内容仅展示缓存与事务恢复分离的可复用方法，非聊天/玩家数据。本任务交接以本条为准。

```memory-task
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#startup-optimization-20261023","session_id":"01a163fd-591f-7910-98f1-df37c63f4eb9","turn_id":"01a1645e-f3f3-7d71-904a-8ef9ac10f1b0","state":"active"}
```

```memory-handoff
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#startup-optimization-20261023","turn_id":"01a1645e-f3f3-7d71-904a-8ef9ac10f1b0","recall":{"project":"reused","module":"not-applicable"},"memories":[],"no_usage_reason":"复用同任务严格approved召回；返回的留存低维护偏好与音频反馈方法不适用于展示缓存及图片复用，没有采用相关规则。"}
```

<a id="ui-conversation-handoff-20261022"></a>
## 页面美化会话承接 · 2026-10-22

- 用户授权：原“页面美化”持续502，创建同项目新会话“ui美化”，继承工作记录和未完成事项。只创建承接，不归档/删除/改名旧会话，不提交或推送Git，不上传/部署。原“页面美化”ID为01a0d93b-1096-7f21-9808-15e4eb691813；已在消除项目本地创建“ui美化”，新ID为01a16188-82b1-7761-bdda-c23ab9d15632（host local），已发送明确检查点/最新要求/证据边界与文件入口。
- 权威工作记录仍为[UI production当前入口](ui-production.md#页面插画风格效果稿--2026-10-20)，素材/接受稿与现有源码继续使用，不另建重复产品任务。原最近请求turn为01a16157-b702-77d2-921d-307f17540877，只有用户消息、状态interrupted、未返回实施结果；不能因旧顶部记录暂停待验就漏掉这次要求。
- 待接续要求：①保留用户认可的胜/负结算卡，重设计平局猫；②准备房间补房名/准备/取消按钮周围装饰，中间改为两只备战猫插画，下方保留玩家小头像及猫咪名称，无好友时用插画猫头像占位；③商店对照稿精修间距/外框，购买和广告按钮改上下排列；④每日挑战中间猫咪、按钮和外框装饰贴近设计稿；⑤全游戏动作按钮淡粉、退出淡蓝、广告亮蓝。商店“上下排列”是更新的明确用户决定，优先于此前同行CTA及旧记忆，保留四商品/价格/库存/广告资格等业务边界。每日挑战不可未经核对当成每日金币签到页。
- 继承限制：原对话用户已明确“不用子智能体做，直接用astra做”；新会话请求gpt-6-astra/xhigh直接执行，不委派，不把请求配置声称为上游模型证明。先读取项目规则/视觉及创作指导与当前源差异，仅复用匹配的有效证据，保留并发广告/分析/隐私等改动；素材生成前核对既有授权的供应商/额度/有效期，不自动扩充付费生产。不得改玩法、奖励、广告触发、头像披露或云端规则以凑视觉。
- 既有证据入口：四张接受稿在assets/_incoming/ui-illustration-concepts-20261020/；产物/提示在assets/_incoming/ui-illustration-production-20261020/，细节源在refinement/details/generation.json；实际组件预览工具tools/preview-ui-illustration-runtime.cjs，旧URL127.0.0.1:50353不保证仍存活。旧104帧/受影响测试及静态主包3,689,335字节只覆盖当时源，不证明本轮改动、自然Main流程、真实广告/领奖、微信真机或上传放行。
- 本轮状态：承接材料及新会话创建已完成；本会话只维护本协调条目，不并发修改新会话接管的ui-production.md或产品代码。原最近用户要求、已完成项、待验项和原会话ID均已放入初始消息，原历史完整保留；通过明确检查点和文件引用接续，不宣称新会话自动包含整段原始聊天。请求配置为gpt-6-astra/xhigh，创建工具返回threadId，不返回实际模型证明。
- 承接确认：新会话首次wait_threads快照显示active，已明确回复接手、沿原项目/原记录继续，按平局猫→双人房间→商店→每日挑战→按钮配色核对，直接执行不委派；新素材若需追加授权会先集中列明。该确认只证明消息已收到并开始接续，不等于上述精修已完成。本会话交接结束，UI后续状态以ui-production及新会话为准。
- 共享记忆：严格approved项目召回hit，shop-list-cta r1及low-maintenance r1仅检索；前者同行CTA已被本次新决定覆盖，后者不适用会话承接。项目源/最新用户要求优先，无规范module映射。小批原Markdown审计unreviewed0/needs-evidence1、无冲突；没有新增需本轮审阅的原Markdown候选。候选none；会话进度/用户原话不另存记忆。

```memory-task
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#ui-conversation-handoff-20261022","session_id":"01a01f4a-9054-7200-a8c7-4d093c5c4127","turn_id":"01a16184-c5b0-7132-9978-cb570285a25b","state":"active"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-shop-list-cta","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#ui-conversation-handoff-20261022","date":"2026-10-22","stage":"retrieved","purpose":"review","action":"核对承接中旧商店同行CTA与最新用户明确上下排列的冲突；以最新用户要求为准，未采用旧排列。"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-low-maintenance","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#ui-conversation-handoff-20261022","date":"2026-10-22","stage":"retrieved","purpose":"review","action":"召回留存内容低维护偏好，与本轮创建承接会话无关；未采用或扩大为UI素材制作授权。"}
```

```memory-handoff
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#ui-conversation-handoff-20261022","turn_id":"01a16184-c5b0-7132-9978-cb570285a25b","recall":{"project":"hit","module":"not-applicable"},"memories":[{"memory_id":"match3-game-shop-list-cta","revision":1,"stage":"retrieved","purpose":"review"},{"memory_id":"match3-game-low-maintenance","revision":1,"stage":"retrieved","purpose":"review"}],"no_usage_reason":null}
```

<a id="analytics-next-version-20261018"></a>
## 下一版本：自建游戏统计 · 2026-10-18

- 用户决定：从下个版本开始建设自己的游戏统计；本轮只记录版本范围及现有接点，不修改刚推送的d5a0d4c候选、不启用远程上报、不改微信后台或部署/发布。不自动委派或跨会话通知。
- 当前任务（2026-10-18追加授权）：只读核对现有接点/官方资料，列出待确认的字段、保存期限、费用及隐私增量；用户确认后才开发。本节是计划，不是统计已上线或正式方案已批准；本轮不改代码、运行协议正文或后台。
- 现有接点：`js/core/analytics.js`已有track/trackOnce、本地200条/7天记录、字段白名单、reportEvent/reportMonitor适配及显式映射门禁；config的REPORTING_CONFIG仍false、映射为空。当前适配指向微信原生自定义事件/数值监控，尚无自建服务器或统计后台；“自建游戏统计”先指本游戏自己的事件口径，不自动承诺另建服务或改用第三方SDK。传输落点下一版本按可用性、包体、隐私和维护成本选择。
- 首期建议（待确认）：①广告请求→展示→完整观看→实际发奖，以及取消/失败/频控，区分观看完成和资产已可靠保存；②关卡开始/胜负/退出、耗时分档、复活/道具使用，按规则版本区分难度数据；③PvP创建/加入/准备/开局/结束及失败类别，用于定位转化和可识别的断线；④启动、网络、存储和奖励异常的分类计数。先回答广告损失在哪、哪些关卡卡住、对战哪一步失败，不先铺所有页面点击或建设大数据平台。
- 数据/安全边界：优先只用必要的低敏标量和受控枚举，不在统计属性中上传OpenID、昵称、头像、房间号、原始错误、访问凭证或棋盘轨迹；不把哈希标识称为匿名，不承诺未经验证的UV/留存去重。如果后续需要玩家级留存，单独明确关联标识、保留期、删除与适用披露。上报失败不阻塞游戏或兑付；是否采样/批量、重试和去重按选定传输合同设计，不臆定可靠送达。
- 开发/启用顺序：先确认首期事件字典、数据去向/保留期/费用上限及隐私增量→本地实现与去重/失败路径测试→独立复核、实际接收端与设备验收→用户批准启用/上传。先复用现有接口，不为统计直接塞入新SDK；当前主包静态余量2,156字节为已推送候选快照，下一版本须先腾出空间并重新核包，不能提高预算或排除活跃资源。
- 本轮结果：已整理下列待确认方案；仅修改本规划记录，未改代码/配置/运行协议正文、未运行应用或发送真实事件、未操作云环境/微信后台或Git提交推送。官方接口/计费资料核对不等于查看当前账号配置。复用刚完成交付的源与包体核对，文档只做局部diff与记忆交接校验，不重复应用测试。analytics用于按决策选事件，grilling用于集中暴露范围/费用/隐私取舍；缺失的LOCAL-GUIDANCE仍依项目约定处理，不照搬网站GA4/GTM方案。共享记忆沿用同任务hit，但只有无关的shop-list-cta与special-comprehensibility r1，未采用；小批审计无新增相关待审提示。候选none，未将待确认方案当作可复用事实。

### 1. 推荐路线与不做的事（待用户确认）

- 推荐复用现有腾讯云开发环境，新增与battle业务入口分离的轻量统计收集函数及受限集合；不新增第三方统计SDK、独立服务器或可视化后台。首期以受控查询/导出日汇总回答问题，分析查询只限运营方，不向玩家开放数据库读取。
- 不同时向微信原生自定义事件和自建端双发。现有适配仅为接点，不代表打开REPORTING_CONFIG就完成自建统计；新传输与字段合同需实现。reportMonitor已停止维护，不作为新方案基础；wx.reportEvent仍是可选替代，但本轮未找到能确认平台侧保存/删除期限的公开依据，不能把自建7/90天承诺套到平台数据上。
- 推荐提供“使用情况统计（可选）”设置，默认关闭，主动说明后由玩家选择开启；无预勾选，不把阅读隐私指引当同意。关闭后停止新上传、清空未上传统计队列；不影响单人、对战、领奖或正常广告功能。不追溯上传选择开启前的历史记录。
- 全部结论标注为“开启统计的玩家样本”，第一期不建立跨日玩家档案、不计算精确UV/DAU或次日/7日留存、不关联广告平台收入，也不扩展为每日金币/猫咪资产的完整分析系统。微信广告平台自身展示/收入报表与本方案分开。

### 2. 字段字典与计数口径

| 类别 | 拟收集字段 | 决策与限制 |
| --- | --- | --- |
| 公共字段 | 受控事件名、北京时间日期、客户端版本、玩法/关卡规则版本、模式、系统大类（iOS/Android/鸿蒙/其他或未知）、增量次数 | 不收精确机型、系统小版本、屏幕参数或精确操作时间线；系统识别不可靠时记未知，不按机型猜测。 |
| 广告 | 广告类型、入口位置、阶段（请求/展示调用成功/完整观看/取消/失败/实际发奖/频控）、受控失败类别、奖励类型及实际发放数量 | 判断漏斗损失；完整观看不等于奖励已保存。展示API成功不是平台计费曝光；不上传广告位ID或收入估算。 |
| 普通单人关卡 | 关卡号、开始或最终结果（胜利/最终失败/主动退出）、耗时分档、复活次数、道具类型和用量 | 开始须棋盘成功进入；一局失败后复活仍属同一原始局，最终结局最多记一次。时间建议<30/30–59/60–119/120–179/≥180秒。每日挑战首期只保留公共异常分类，不将其混入普通关卡胜率。 |
| 好友对战 | 创建/加入/准备/开局/结束步骤、步骤结果、胜负/退出或已识别断线、网络/超时/业务拒绝等失败类别 | 按参与人次，不称为去重房间局数；不上传房间号、邀请参数、对手身份或比分序列。仅发起分享不能算邀请送达或好友加入。 |
| 稳定性 | 可观测的启动成功/启动耗时分档、功能模块、受控操作类别、网络/云调用/存储/奖励等错误类别、当次新增次数 | 不上传异常原文、堆栈、URL、请求/响应正文。现有累计错误计数须转为增量，避免1+2+3重复累加；不能捕获的原生崩溃不据此计算“无崩溃率”。 |
| 技术去重 | 随机批次ID、协议版本、服务器收件时间 | 只用于批次重试去重/过期，不作为长期玩家ID。原始对局/资产收据ID留在原功能链路，不进统计属性。 |
| 服务端安全 | 微信可信调用上下文临时提供的OpenID；服务端据此生成按日变化、仅供限流的带密钥哈希及当日请求计数 | 不将OpenID写入事件、统计表或本功能日志；哈希仍属用户相关信息，不能称匿名。仅限流，不做行为画像/跨日关联；密钥只在服务端。 |
| 本地选择记录 | 开关状态、告知版本、选择时间 | 只在本地用于尊重选择；关闭时不能先发送一条“已关闭”统计。 |

- 不采集昵称、头像、手机号、UnionID、位置、通讯录、微信好友列表、聊天、棋盘轨迹、完整钱包/存档、原始错误或访问凭证；统计不参与反作弊处罚或决定玩家资产。
- 强杀/断网可能缺少结束事件，不能把“开始减成功”全部算成失败或断线。广告各阶段和奖励提交需分别有真实接点；不使用页面打开代替观看/领奖验收。当前trackOnce仅进程内去重，不是服务端幂等；开发需覆盖原始局结算、奖励完成及批次重传口径。
- 非逐帧/逐次换位上传。建议每批最多30条、8KiB，安全场景发送且相邻尝试至少60秒；队列沿用200条上限。服务端身份可信、字段/长度/日期有界、批次去重，建议每身份每日最多20批；超限丢弃统计而非阻断游戏。重试须有界，限流/丢弃造成的样本缺失在报表说明。独立函数仍共享环境资源，不能宣称绝不影响battle。

### 3. 保存期限与退出

| 数据 | 建议期限 | 清理/权利边界 |
| --- | --- | --- |
| 本地行为记录/待上传队列 | 最多200条，7天 | 按记录发生时间到期，读取/写入时清理；关闭统计清空未上传队列，不清金币/进度。 |
| 云端事件批次及其重传去重记录 | 事件日期起7天 | 不因迟到或重试续期，超期拒收/不再分析；按批次最早到期日清理可提前删除，不能保留更久。 |
| 按日、版本、关卡/入口等维度的汇总 | 统计日期起90天 | 不含玩家ID或逐条操作轨迹，超期不再参与查询；不按查询/更新续期。低样本单元不公开。 |
| 按日限流哈希及请求计数 | 对应日期起2天 | 独立受限保存，仅防滥用，不用于玩家留存。 |
| 本地统计开关/告知版本 | 至玩家变更选择或清除本地数据 | 重装/换设备不承诺继承同意，未知状态按关闭处理。 |

- 建议到期即从查询/分析排除，每日定时清理；正常运行下在到期后下一次清理（至多24小时）物理删除，清理故障需可见，恢复后补清，不承诺停服/故障时仍准点物理删除。
- 玩家关闭统计后不再上传；已经上传的数据不会因清除手机本地数据自动删除。可通过现有隐私联系邮箱提出查阅、更正或删除请求；由于不建立长期统计身份，核验/定位范围需如实说明，不承诺能精确还原或删除所有无个人标识的汇总，也不向请求人披露他人数据。
- 7/90/2天只覆盖新统计业务数据，不改现有房间、每日任务、图鉴等功能数据期限。云服务基础访问日志/备份由服务商和环境配置决定，尚未核实，不能沿用本表冒称同期限；启用前须查明并在最终告知中单列。新函数不主动打印业务正文、OpenID或哈希。

### 4. 费用、包体与维护边界

- 建议确认的是“每月新增统计资源费用目标不超过20元人民币”，不是云账单硬封顶或已开通套餐报价。无第三方SDK许可费、新服务器或独立后台订阅；现有云调用、数据库、日志和存储会消耗资源，可能与battle争用额度。当前环境套餐、地区、剩余额度/并发和告警能力尚未实查，不能断言免费额度够用。
- 量级示例而非流量预测：1000名日活玩家、每人每日2批、30天为6万次/月。若恰适用官方上海区资源点计费、每批平均6次数据库计费操作、128MiB函数运行0.5秒，列明的小游戏客户端API调用约1.20元、函数调用约0.08元、计算约0.42元、数据库调用约7.20元，合计约8.90元；不含基础套餐、额外服务端API、存储/索引、清理、日志、流量、峰值QPS及游戏本身费用。操作数/耗时必须以实测替换，翻倍请求量不保证仍在20元内。
- 官方资源点新计费不等于现有环境套餐；从旧计费切换可能不可逆，绝不自动切换、升级、购买或改账号配置。资源用量展示可能滞后，费用提醒/限流不是可靠账单硬停；先以小流量验证用量，出现持续异常或预算风险先关闭统计，保护核心玩法。若用户需要绝对不超支，未核实可用硬限制前不启用付费统计。
- 首期不造图表后台、用户分群、归因/留存和跨端画像，避免长期维护成本。所需人工主要是字段口径维护、清理任务和定期汇总核对；不为采集事件做全库扫描或每局同步写多份报表。
- 已推送候选主包静态余量仅2156字节，新代码必须先做不降画/音质的局部瘦身、重新通过4MiB预算及微信真实包核对；不得放宽上限、忽略活跃资源或把云端依赖放进主包。本轮不开始瘦身。

### 5. 隐私增量草稿（供确认，不是已采用正文）

> **可选的使用情况统计。** 为了解广告播放及奖励流程、关卡难度、好友对战连接和功能稳定性，我们提供默认关闭的使用情况统计。只有您主动开启后，才会将此后产生的必要统计批量提交到本游戏使用的腾讯云开发服务。拒绝或关闭不会影响游戏、对战、领奖和正常广告功能；本统计不用于个性化广告、跨日玩家画像或决定您的奖励。
>
> 统计字段包括事件类别、北京时间日期、游戏及规则版本、模式、系统大类、增量次数，以及相应的广告入口/阶段/实际奖励数量、关卡号/最终结果/耗时分档/复活与道具次数、对战步骤/结果和受控错误类别。为防止同一批数据重复计数，我们使用随机批次标识和服务器收件时间，不使用长期统计用户ID；不收集昵称、头像、手机号、位置、通讯录、好友列表、棋盘轨迹或完整错误内容。选择开启前的本地历史记录不会补传。
>
> 云调用过程中，微信可信调用上下文会向服务端提供OpenID。我们仅为验证调用和限制滥用而临时处理它，统计记录不保存OpenID；服务端保存按日变化的带密钥哈希及请求计数，最长2天，仅用于限流。该哈希仍与用户有关，并非匿名信息，不用于跨日追踪。
>
> 本地统计最多200条、保留7天；云端事件及批次去重记录自事件日期起最多7天；不含长期用户标识的按日汇总自统计日期起保留90天。到期不再用于分析并定期清理，通常在下一次每日清理中删除；故障时恢复后补清。云服务基础日志和备份的保存规则将按实际环境另行说明，不将它们等同于上述业务期限。
>
> 您可随时在设置中关闭统计；关闭会停止新的上传并清除尚未上传的本地统计，已经上传的数据不会因关闭或清除本地数据立即删除。您仍可通过本指引的联系邮箱行使相应权利；我们会在合理核验后，按照能够定位的数据范围处理，并如实说明不含个人标识汇总等数据的处理边界。微信广告平台自身的数据处理和报表不因该开关而改变。

- 正式落地前须同步修改现有指引的“远程统计关闭”“系统信息不进入事件”“广告事件/监控关闭”等旧表述，而不是只追加本段；本地说明、官方隐私指引/授权告知与实际处理保持一致。运营主体和原生效日不变，新增更新日期/版本在采用时确定。运行协议当前2026-10-15.2保持原样。
- 云存储地区、服务商日志/备份具体期限及当时适用的告知/授权配置尚未核实，是启用前必填核对项，不拿这份草稿当正式法律合规/过审保证。

### 6. 一次确认的范围与开发顺序

1. 用户确认四类事件/字段、可选默认关闭、业务7/90/2天期限、增量20元/月预算目标及隐私增量方向；此次确认只授权随后本地开发，不授权费用/套餐变更或生产操作。
2. 先核包体并腾空间，再做独立统计接收端/受控汇总、客户端批量/开关与本地隔离验证；不改奖励规则，不让统计故障阻断游戏。
3. 验证拒绝前零上传/旧记录不补传、关闭清队列、原始局复活不重复计数、完成观看与实际发奖分离、重试/重进幂等、跨日/过期清理、错误增量、限流/异常输入与授权边界；由非实现者复核统计和隐私链路。强杀丢失和参与人次等指标限界随报表保留。
4. 在相应有界授权下核对实际云套餐/资源、存储地区和日志/备份，完成接收端真实到账及微信设备验收，补全最终隐私说明与后台一致性；应用测试不能代替云接收/实际发奖证据。
5. 另行取得部署、正式启用及客户端上传授权后才上线；若费用、包体或隐私配置不满足则继续关闭统计，不默许付费升级。

资料依据（2026-10-18核对）：[wx.reportEvent](https://developers.weixin.qq.com/minigame/dev/api/data-analysis/wx.reportEvent.html)、[已停止维护的wx.reportMonitor](https://developers.weixin.qq.com/minigame/dev/api/data-analysis/wx.reportMonitor.html)（官方内容经Context7获取）；[腾讯云开发资源点价格及迁移说明](https://cloud.tencent.com/document/product/876/127357)。未查看当前账号控制台，不把公开单价当作本环境账单。

本轮文档验证：局部git diff --check通过；本task的check-record及handoff校验均valid:true、issues:[]。只更新方案/状态，未运行应用测试；其他未提交/未跟踪内容保持不动。

```memory-task
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#analytics-next-version-20261018","session_id":"01a01f4a-9054-7200-a8c7-4d093c5c4127","turn_id":"01a14aa8-1376-7861-b797-1817ca794bd7","state":"paused","reason":"待用户确认统计字段、保存期限、预算目标及隐私增量；本轮未开发、启用或操作云端。"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-shop-list-cta","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#analytics-next-version-20261018","date":"2026-10-18","stage":"retrieved","purpose":"review","action":"召回命中商店清单/CTA布局记录，范围不是统计设计；未采用或据此改变事件/数据方案。"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-special-comprehensibility","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#analytics-next-version-20261018","date":"2026-10-18","stage":"retrieved","purpose":"review","action":"召回命中新棋子可理解性偏好，范围不是统计设计；未采用或推断统计/难度效果。"}
```

```memory-handoff
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#analytics-next-version-20261018","turn_id":"01a14aa8-1376-7861-b797-1817ca794bd7","recall":{"project":"hit","module":"not-applicable"},"memories":[{"memory_id":"match3-game-shop-list-cta","revision":1,"stage":"retrieved","purpose":"review"},{"memory_id":"match3-game-special-comprehensibility","revision":1,"stage":"retrieved","purpose":"review"}],"no_usage_reason":null}
```

<a id="pvp-cooldowns-20261017"></a>
## PvP 数据异常排查与独立道具冷却 · 2026-10-17

- 当前负责人：本会话综合实现；冷却增量及已证实的房间事务冲突缺陷本地完成，独立复核通过。用户现追加授权图鉴/每日任务的3条同类错误一起本地修复，由用户自行上传；追加增量实现、回归及独立复核均通过。用户要求每种道具10秒独立冷却和各自倒计时，并报告北京时间今日20点左右消除得分时出现完整“数据异常”但游戏继续；用户随后指定扩大至18:00–21:00。线上错误实际为“服务异常”，精确客户端版本/文案对应仍未闭合。未部署、上传、提交、推送或改生产玩家数据；保留既有未提交工作。仅为下载线上源码，用户明确授权本轮临时开启微信CLI端口，下载后已关闭并从安全页确认所有四个开关恢复为0。
- 实现：battle玩家保存允许键的itemCooldowns，query返回myItemCooldowns，施法/幂等回复返回itemCooldowns，保留旧标量字段。每种10秒独立，己方效果生效不锁其他道具，冻结仍锁全部。旧玩家无map时保留原共享/效果锁，成功施法才迁移；query只投影不写房间。新局/换对手/续局归零。客户端按服务器时间和对应键判定、排队时复查；旧云无map时仍遵守共享限制。图标内倒数取整秒，到期恢复；耗尽保留“用尽”，文字/库存不随图标变暗。契约见docs/contracts/pvp-items-v3.md。
- 本次文件：cloudfunctions/battle/{index,logic,transaction,retention}.js，js/net/battle-items.js，js/main.js对战路径，js/render/battle-ui.js道具栏，test/{battle-items-v3,battle-rematch,battle-items-client-v3,ui-smoke,battle-wx-transaction-conflict}.js，tools/preview-battle-hud.cjs及本条/契约/验收入口。追加图鉴/每日修复仅新增共用transaction.js、index房间调用等价提取、retention7处事务接入及扩展真实SDK回归/相关文档，不改客户端或依赖。基线HEAD dea08fb；相关文件另有此前已验证增量，不能将整份Git差异均归本次。
- 异常排查：当前客户端及本轮下载的cloud1/battle均无“数据异常”文案；客户端消除回调仅采样/音效/动画，V3比分提交拒绝不直接弹原始错误，排队道具时会提示“成绩未确认，道具未释放，请重试”。施法拒绝才弹服务端err。服务端有格式/时间/单次增量/增长速度等校验；本次未放宽校验或隐藏错误。线上函数列表最后更新时间2026-10-02 23:27:25；下载源码在/private/tmp/match3-battle-inspect-20261017，logic与本地仅本次冷却差异，index同样只有冷却字段/赋值差异，旧尾分确认/整图重置修复已在该下载源中。源码不证明实际客户端版本或当时请求。
- 线上日志证据：用户将云控制台置前后，实际读取19:45–20:30仅6条陪伴/每日状态成功回包，无对战请求；云控制台仅一个环境，与客户端CLOUD_ENV一致。按用户指定18:00–21:00、全部函数、ret_msg包含err检索，逐条展开34条业务错误（19:24:47–19:32:07），均{ok:false,err:"服务异常"}且链路出现文档事务包装错误的errCode -501001与精确[ResourceUnavailable.TransactionConflict]；action为syncScore26、ready1、rematch2、query1、useItem1、retentionInfo1、catalogInfo2。200只说明函数执行完成，不能证明业务成功。记录仅保留时间/类别/统计，不复制原始标识或日志。该证据证明当时存在房间/进度档案读写事务冲突，但没有请求samples入参或用户客户端身份，不能把全部得分、分数校验、最终结算及字面“数据异常”都归为同一因果链；继续游戏不证明失败请求的比分已被接受。追加修复仅本地，未继续读云、重新开启端口或调用生产业务探针。
- 故障机制与修复：安装的真实wx-server-sdk4.0.2包装文档读写错误时去掉底层code，CloudBase事务只识别code=DATABASE_TRANSACTION_CONFLICT，因此包装后的冲突未自动重试。共用transaction.js在callback捕获异步错误，仅errCode===-501001且errMsg含精确事务冲突标记时在原错误补code再抛出，复用SDK原有3次重试/最多4次尝试及新快照；其他错误保持失败，耗尽保留原诊断并返回“服务异常”。房间事务及retention的info/sign/record/claimTask/claim/ack/catalogRequest共7个档案入口均接入；catalogInfo两条、retentionInfo一条的同类缺陷已纳入本地补丁。无外层重试、业务校验放宽、吞错或依赖修改；不迁移或更正历史比分/胜场/奖励，未改daily挑战或建房create的直接事务。
- 验证（Node v24.19.0，本地隔离）：服务端执行者通过battle-items-v3、battle-logic、battle-cloud-function、battle-rematch、battle-query-transaction、battle-score-finalization、battle-score-item-regression、battle-sdk-round-reset；综合主任务通过battle-items-client-v3、battle-client、battle-clock-samples、battle-score-item-regression、ui-smoke。覆盖交错施放、9999/10000ms边界、稳定重试ID、不延长/重复扣费、旧状态投影与迁移、冻结、续局；比分整数/尾分证据仅是回归，不是生产归因。语法与局部diff空白检查通过。图标之后恢复文字alpha后仅重跑受影响ui-smoke/包体，未重复其他通过套件。
- 事务补丁验证：新增battle-wx-transaction-conflict使用真实wx-server-sdk4.0.2与安装的底层Db，仅替换本机Request传输。旧实现先红（modifyDocument包装冲突未重试），补丁后通过：读/更新冲突新快照保留对手写入、失败尝试不重扣道具、竞争相同ID已提交时重试无第二次更新、迟到相同ID不续冷却、非冲突-501001不重试、持续冲突恰4次后失败且保留原errCode/errMsg。受影响battle-query-transaction、battle-items-v3、battle-score-finalization、battle-cloud-function及语法/局部diff通过；新增输入触发这些重跑，客户端/视觉输入未变，复用原证据。模拟传输不证明云端恢复。
- 图鉴/每日追加验证：扩展同一真实SDK fixture，原代码的retentionInfo/catalogInfo各自读取和set写入冲突四路径均先红，接入helper后通过；新快照保留并行catalog鱼干/revision及任务进度，claimTask回滚/相同领取已提交竞争均仅一张40金币收据和20活跃，喂食冲突/相同ID已提交竞争仅扣一鱼、增加一次亲密度。异主、旧修订和过期未确认任务仍拒绝/过期；签到、记录、ACK、周领取各经冲突，Info非冲突-501001各1次失败、持续冲突各4次失败并保留原诊断。新状态下battle-wx-transaction-conflict、retention-cloud、retention-manual、catalog-cloud、battle-query-transaction、battle-items-v3、retention-integration七项及4文件语法/局部diff均exit0（Node v24.19.0）；新增共享helper/档案事务是这些重跑的触发，未重复无关视觉/客户端/包体检查。
- 独立复核：按role-collaboration有界委派server_item_cooldowns实现服务端，主任务实现客户端/画面并排查；非实现者cooldown_review审查冷却全链路、房间及图鉴/每日追加事务补丁，无P1/P2。其独立真实Main probe通过迟到query不回滚冷却/库存、排队道具可在其他道具效果/冷却中释放、自身deadline变化取消请求；房间补丁另用本地真实SDK探针验证提交阶段原生冲突重试保留对手新分数、读取冲突后房间轮次变化会拒绝旧轮道具且库存/施法记录不变。图鉴/每日追加复核接受共享helper与全部7入口；未重复已通过套件，独立真实wx SDK/Db本地传输oracle验证claimTask先暂写receipt后profile持续冲突，恰4次失败时profile全不变且零receipt；另在首尝试已暂写receipt时触发profile冲突并模拟并发撤销资格，新快照重试返回NOT_ELIGIBLE，最终零receipt、claimed=false、activity=0。确认精确分类、新快照、有界重试、多文档原子回滚和重试后业务拒绝有效。非实现者未调用真实云或独立读线上日志，保留文案/上线效果限界。请求配置均Sol/medium，未核实上游实际模型。两位候选均none。
- 运行实看：现有本机Canvas组件预览以真实BattleUI/Board/Game模块、合成状态运行，无账号/存储/云业务调用。320×568、390×844、430×932混合9s/4s与两项可用已实看；430实时10秒到期后恢复。assets/_incoming/pvp-cooldowns-20261017/五张截图由非实现者独立查看，名称/库存/数字无裁切重叠，冷却与可用可区分。初始10s和到期图均保存。此组件预览与独立截图审阅不替代微信双账号/弱网/真机证据。
- 包体：初次静态主包4,195,849超4MiB；同工作区catalog-album.png被并行任务更新为34,129字节后，本任务尝试重压缩的断言在写入前停止，未修改该素材，不认领其来源。最后检查主包4,192,148/4,194,304，余2,156；总包5,987,513/31,457,280，90/112文件，package-budget通过。是当前工作树静态估算，不能替代最终微信包身份与打包数值；本任务没有生成/上传预览包。
- Memory recall: hit；追加图鉴/每日范围时刷新approved项目检索，仍命中match3-game-room-poll-write-gating r1，复用同任务已读原文；用于保留房间query门控、选用真实SDK包装/隔离传输证据及限制生产归因，未将房间轮询参数扩为档案业务规则。无独立模块身份，无关低维护偏好未采用。新故障机制/边界已进入项目契约，不重复捕获相同项目事实，候选none。当前turn的check-record与handoff均valid:true、issues:[]。
- 下一步：图鉴/每日追加修复本地交付完成；用户自行更新battle云函数（含新增transaction.js）和包含前述冷却的客户端后验证。图鉴/每日本轮没有客户端修改。生产恢复及真机验收未完成，字面提示与实际客户端身份仍待有证据时核对；本任务不执行部署/上传。

```memory-task
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#pvp-cooldowns-20261017","session_id":"01a0e89b-5d29-76a3-8dd2-44a29c763cc4","turn_id":"01a14a65-ac98-77e2-9646-c5e53bf55060","state":"active"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-room-poll-write-gating","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#pvp-cooldowns-20261017","date":"2026-10-17","stage":"applied","purpose":"execution","delivery_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#pvp-cooldowns-20261017","action":"保留query冷却投影和轮询写入门控；采用真实微信SDK包装、隔离传输和新快照故障注入检查共享事务提取与档案重试，区分本地恢复证据与线上效果。"}
```

```memory-handoff
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#pvp-cooldowns-20261017","turn_id":"01a14a65-ac98-77e2-9646-c5e53bf55060","recall":{"project":"hit","module":"not-applicable"},"memories":[{"memory_id":"match3-game-room-poll-write-gating","revision":1,"stage":"applied","purpose":"execution"}],"no_usage_reason":null}
```

## 首页小字精简 · 2026-10-03

- 按用户要求删除好友对战下方“60秒欢乐对决”和每日金币待领奖红点旁“可领”；仅修改 `js/render/ui.js` 两处文字绘制，红点颜色/大小/条件、按钮布局与点击范围不变，未修改奖励或云端逻辑。
- 受影响验证：`test/ui-smoke.js`、`test/retention-preview.js` 通过；新增320/390/430宽度有/无待领奖状态的实际绘制断言，检查两处文案不再绘制、原正红圆点仍有条件显示、三个入口矩形不变。UI语法、局部diff及原生Canvas辅助detector通过。
- 运行检查：现有 `tools/preview-retention.cjs --functional` 隔离内存服务和临时钱包，390×844真实Main首页已目视确认两处文字消失、每日金币仅留正红圆点；点击入口正常进入每日金币，钱包2460未变。未连接真实微信云或写用户存档；微信真机未验，未提交、推送或上传。不新增素材/布局或开启发布门禁；召回只有无关的新棋子偏好，未采用；持久候选none。

## 新障碍代表样板 · 2026-10-02

- 用户选择月相花苞与小鱼干包裹；宝匣/封印不再推进。当前综合实现归属保持；范围、接口、核心/渲染/独立QA证据和用户视觉门槛统一在[内容更新当前样板](../docs/content-update-1235.md)。
- 执行顺序：两类核心与必要显示 → 单人隔离可玩样板及独立QA → 用户实际视觉/策略验收 → 正式教学关与局部标定。用户2026-10-02接受整格花座/HUD/闭合反馈与新动画，随后澄清“把本地改好就行了，不必上传开发版”。第21/22关教学及每十关两个新目标槽已本地完成；局部工程测量、独立QA、真实指针重放、三宽12场运行与包体通过，入口及未验边界统一见[当前记录](../docs/content-update-1235.md)。保持每日/PvP、前20关及其他八个槽；未上传微信、改云、提审或公开发布。候选none；[本阶段复盘](retrospectives/new-obstacles-20261002.md)。
- 当前新增交付：紧凑曲线已本地完成curated-v8前10教学、11关起infinite-v8混编、清冰目标/双色提示与HUD、240真实空间配方、100关达最高档及6–30步moves-v1预算。布局/自然开局/独立QA、索引/进度保留通过。不同种子每关200、3秒/6秒真实动画持出覆盖八个代表章；6秒recipe章均从11–20的61.0%降到91–100的34.45%，100后已测代表章32.2–38.9%。独立QA发现194边缘配送接近零卡点，经两个Sol候选失败后按规则Astra/xhigh有界修复，仅最高档PJ边缘开口改1条原长路径、保留原果冻量/步数/180秒及策略；800定点补测和独立范围/实际终态复核通过，194六秒4.5%→27%，P1关闭。当前38,600条件样本含未变配置复用与四单元替换，不冒称重新测完八章；诊断/失效基线单列。五类障碍实际状态图及320/390/430实际Main显示已实看。训练残差与正式结果分开，不承诺逐关命中或真人胜率，微信真机仍未验。最终证据/限界统一见[当前记录](../docs/content-update-1235.md)，未上传/部署/提交/推送，candidate none。
- 本条仅维护增量依赖，不复制实现证据或接管下方留存任务；没有新增/改绑负责人或对话。

<a id="retention-manual-v1"></a>
## 每日任务手动领取与红点 · 2026-09-30

### 当前复核与验收 · 2026-10-04

- 用户已确认本次客户端与battle均已上传；具体客户端版本号、预览/体验/正式渠道及云端候选身份待确认。这是用户报告的上传事实，不是代理部署、发布或领奖验收证据。Git基线仍为dea08fb0ad3fb756d234660580a491ee77e56dcf；本地另有新障碍、难度与PvP等工作树改动，不能据Git基线推定上传包身份。本轮仅只读复核及更新本条记录，未修改产品/测试代码、调用真实云、操作玩家数据、提交/推送Git或启用CI。
- 非实现者Sartre（有界worker配置GPT-6.1 Sol／medium，任务01a1079b-84c6-76a1-8ba9-8f4a8baeba71）独立核对manual-v1迁移、事务、可信身份与客户端/钱包恢复，主任务审阅后接受其限定本地结论：未发现P1/P2必修问题。旧档完成项迁为已领、模式不回退；手动档完成任务不产生奖励/活跃度，日期与任务索引构成稳定收据；领取事务写领取位/活跃度/收据，已有收据优先于跨日过期判断；客户端持久化钱包入账后才ACK。此结论不覆盖其他未审增量或整包发布。
- 有效证据复用：10/4当前工作树的retention-manual/integration/cloud/qa-recovery/qa-routes及package-budget均exit0（Node v24.19.0）；相关retention客户端/服务/coin与manual/integration测试相对dea08fb未变，Main/入口与内存数据库helper的当前改动已纳入当日受影响测试。复用已有独立钱包故障矩阵；没有为此次交接重复运行通过套件。主包静态估算4,104,962 / 4,194,304字节，余89,342字节（约87.2KiB），不是微信实际打包值。
- 独立补验命令为一次离线`node <<'NODE'`内存probe（未保存新测试文件），真实retention client/service/coin配合模拟wx同步存储与串行事务fixture，7场景最终exit0。北京时间2026-10-04 23:59:59.999（UTC15:59:59.999）→10/5 00:00:00.000（UTC16:00:00.000），仅差1ms，日期转换断言通过。初始金币700：未确认请求跨日过期仍700；已提交领取丢回复、ACK丢回复、金币入账后收据历史写失败、钱包成功后客户端转存ACK失败四项均恢复为740，持久pending/receipts/acks清空、钱包该收据仅一条、服务端已ACK，再sync不增币，道具不变。停留旧任务页跨日首次点击未发领取请求，刷新后进度/领取位重置且金币700；手机初始快36小时仍采用服务器日期，随后时钟跳变48小时首次点击只校时，第二次有效点击到账40。后两项未直接断言全部队列清空。首次probe将明确断网误期望为error，校正测试预期offline后完成，不是产品修复。
- 证据边界：上述重建为保留同一模拟存储/数据库、同一Node进程和coin模块后重新client.create()，不是进程冷启动或微信重启；事务fixture串行执行，不证明真实CloudBase并发冲突/自动重试。未验证实际部署包、真实弱网、完整手机领奖链路或自然跨日。独立接受意见只关闭本地manual-v1复核缺口，不将9/23旧自动领奖复核或9/30页面连通证明替代这次手动领奖。
- P3非阻断观察：任务页停留跨日可能暂时保留昨日“领取”按钮/页签红点（retention-ui.js drawTasks及draw页签读取缓存进度；retention-client.js activate校验当前日期）。点击会先同步，未发昨日领取请求；首页hasClaimable已有日期守卫。显示滞后不导致越日发奖，本轮未修，后续可单独选择优化。
- 下一步为用户手机验收，不清存档、不伪造任务/日期：①最好重玩已通关关卡，记录任务完成前后金币，排除普通首次通关奖励及签到/其他领取；完成任务和访问任务页均不应发任务金币/活跃度。②手动领取未领任务1/2/3分别只增加40/60/60金币、20/30/30活跃，再点击不增加。③退出小游戏后重新进入，余额与已领取状态保持、不重复到账。④北京时间零点后未领的昨日任务过期、新日进度重置；昨日已被服务器确认的领取若回复丢失则允许恢复一次，不应误判为越日领奖。请记录客户端版本/渠道、设备系统、时间及余额前后；页面能打开不算以上通过。签到/周宝箱另有可领项时首页红点可继续存在。CI仍未实施，保留原评估的轻量方案，不开完整分支保护。
- 共享记忆：沿用本次评估的已批准召回；functional-preview用于区分真实消费者的隔离验证与手机/云门槛，combined-reward-wal用于核对真实coin的提交/ACK顺序并复用相关输入未变的故障证据。项目当前合同优先，旧自动领奖金额轨迹不采纳；用途为review，不推定开发提效。主任务与独立QA候选均none，本次不新增方法卡。

```memory-usage
{"schema_version":1,"memory_id":"match3-game-functional-preview","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#retention-manual-v1","date":"2026-10-04","stage":"applied","purpose":"review","action":"审阅真实Main/client/service/coin的隔离证据，仅用于本地手动领奖复核；排除旧自动领奖轨迹，不代替微信云或手机验收。"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-combined-reward-wal","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/project-status/development-steps.md#retention-manual-v1","date":"2026-10-04","stage":"applied","purpose":"review","action":"核对真实coin持久化入账后ACK及共享收据去重，复用相关输入未变的独立钱包故障矩阵，限定新增控制器恢复probe不代表完整进程冷启动。"}
```

### 2026-09-30实施与连通性恢复记录（历史，当前状态以上方为准）

- 当前交付：提交dea08fb0ad3fb756d234660580a491ee77e56dcf已推送origin/main（final-us/match3-game），包含20个本次每日金币相关文件；AGENTS.md、流程采用段、.impeccable/与promo-duel/未混入。用户随后确认微信客户端已上传，具体版本号、审核及正式发布状态未确认；代理未操作客户端上传或审核。复用相关源未变的自动测试与原生页面证据，Git交付和客户端上传不豁免下列独立复核与真机门槛。本次仅更新交付记录，不再次提交或推送。

- 云端修复结果（用户已批准）：原$LATEST保存为不可变版本4，备注before-startup-repair-20260930，列表时间11:29:09，未切换版本流量。首次“上传并部署：所有文件”因候选独立复核缺失被自动审批拒绝，未执行；只读CLI下载又因服务端口关闭退出。用户随后批准临时开启CLI端口，仅下载现有battle包到/private/tmp/match3-cloud-startup-GAS6na，下载成功后已关闭端口，并确认其他权限开关不变。
- 部署包比较与有界重试：线上17份源码/配置/vendor文件与本地逐字节一致，包含既有手动领奖业务；差异在node_modules。云端安装锁将lodash.set标为link:true，下载包对应路径是内容为../vendor/lodash-set-compat的普通文件，直接加载该下载包入口报Unexpected token '.'；本地对应完整依赖目录，入口及依赖安全检查通过。下载格式可能影响链接表现，不能仅凭下载包推断运行时文件语义。带着“业务源码完全相同、仅更换完整依赖”的新证据重新申请同一已授权部署，获准执行；控制台确认battle于11:48:50已部署。没有主动改运行时、云调用权限、数据库配置或客户端发布；未提交/推送Git。
- 实际微信SDK与原生页面证据：部署后开发者工具2.02.2608040/基础库3.16.2调用retentionInfo（未传manual-v1、未点击领奖）返回ok:true、hasState:true、mode:legacy-auto，原启动失败已消失。页面检查曾被Mac锁屏中断，用户解锁后确认七日签到、每日任务与完整周宝箱已显示，无未联网/加载错误；原生普通点击未切换页签，改为微幅模拟触摸拖动后切换和关闭成功，不把自动输入限制当产品故障。脱敏本地状态读取确认manual-v1、signed:true、taskClaimed全true，pending/receipts/acks均0，调试器0错误。全程未点击签到/任务/宝箱领取或开局；正常页面同步后钱包从0变150，钱包收据历史1条（150对应签到奖励），符合原有待办/收据恢复路径。同步前未采样待办与收据，不能精确区分旧领取请求重放或已发收据恢复，不能声称余额未改变。当前账号任务均已领，不能用本次查看证明新完成任务的手动领取链路。完整依赖重部署恢复调用与页面，支持部署依赖为故障来源；独立复核、手机验证仍待完成，不等同正式发布验收。

- 诊断修复候选：按用户“修复”授权，cloud-battle识别-1包裹的-504002执行失败并分类FUNCTION；retention-client复用平台脱敏分类，只在明确NETWORK时显示网络错误，超时/权限/环境/配额/未知分别保留可重试错误，失败保留待办/收据且重试成功清除诊断。retention-ui增加次级R1诊断码、不展示原始错误或身份。cloud-battle-diagnostics、retention-client/manual/qa-client/integration/preview与语法检查通过；丢回包的无分类异常测试现在期望error而不是错误断言offline，奖励去重断言不变。npm ls --omit=dev --offline、cloud-dependency-security及本地require入口成功，证明本地候选依赖完整；320×568状态预览通过（wallet2460、cloudAttempts0），诊断码与重试按钮已目视确认无重叠，初次夹具未传diagnostic已修正后复核，截图retention-error-320.png。复用相关输入未变的自动测试证据；云端恢复及原生未验项见上方当前结果，不把隔离预览当微信真机。

- 修复前云端诊断（2026-09-30历史）：用户已自行右键上传battle；控制台确认最后更新09:05:03、已部署，Node.js20.19/index.main/256MB/3s。10:06在当前match3-wechat开发者工具通过真实SDK仅调用retentionInfo（未传manual-v1、未领奖），返回-504002 functions execute fail / 0 code exit unexpected。对应云日志status_code443、Coldstart14ms、InitRuntime14ms、InitFunction0ms、Duration0ms，近期多次同类失败；没有业务异常堆栈。因此已定位云函数运行时启动/初始化阶段异常，不是已证实的断网、缺依赖或业务超时；具体部署包/平台原因待核对。本地直接require当前battle入口成功并导出main函数，但不等于云端包验证。retention-client将所有调用reject统一标记offline导致误导性“未联网”，未改代码。本次只读查配置/日志，未部署、改运行时、清缓存或领取奖励；未获得手动领取真实云成功证据。此前“未部署”描述仅指代理未部署，不能再当作用户未上传的依据。

- 综合主任务实施；用户已确认：任务自动统计、金币与活跃度逐项手动领取；首页与任务页签提示红点，访问页面不清除；未领取奖励北京时间次日零点失效；已确认旧收据继续恢复，其余奖励规则不变。提示改为醒目正红色后，用户接受颜色并要求去掉白边；最终采用 #F5222D、6px实心圆点，无描边，首页和任务页签一致。去白边后retention-preview、companion-qa及语法/diff检查通过。复用既有Canvas月光控件，不新增美术或依赖。本轮禁止委派，未启用助手，以下为自验证而非独立QA。
- 实现时基线为b1bdb0c加本次候选修改，现已提交为顶部所列dea08fb；未执行签到/任务/宝箱领取。其他任务的AGENTS.md、流程采用段及.impeccable/、promo-duel/改动仍保留，当前Git/上传状态以顶部交付条目为准。
- 服务端：retentionInfo协商并持久化manual-v1；完成任务仅记进度，retentionClaimTask校验本人日期/资格，在事务内写领取状态、活跃度和原确定性收据。旧档已完成任务迁为已领；新手动档缺少领取字段报损坏，不静默当旧档。旧账号保留旧行为，升级账号不再被旧客户端自动领奖。合同及回退限制见 docs/contracts/retention-v1.md 手动领取增量。
- 客户端：同步先确认云端能力，再发送持久待办；旧云不支持时保留请求并提示更新中，避免错误自动发奖。首页领取提示纳入未领任务；任务卡增加未完成/领取/已领取和当日到期说明，任务页签增加红点；触控沿用Main命中与滚动裁切。共享通知圆点统一正红，未修改陪伴解锁或奖励规则。
- 有效证据：retention-manual、retention-client、retention-qa-client、retention-integration、retention-cloud、retention-qa-recovery、retention-qa-routes、catalog-cloud、retention-preview、companion-qa均通过。覆盖手动才到账、页面访问不领取、重复/并发领取、身份伪造拒绝、旧档与旧收据、跨日未领过期/已确认恢复、丢回包/ACK、本地钱包失败、旧云能力阻断及鱼干不回归；语法和diff检查通过。测试文件名或控制台的QA字样不代表本轮独立验收。
- 运行证据：隔离本机 tools/preview-retention.cjs --functional，真实Main/core/client/service配合内存数据库与临时钱包，无真实微信请求。390×844单人结算后进度1/1/80、钱包2460、活跃0；打开任务页不入账；逐项领取任务1/3后钱包2560、活跃50、已领1/0/1且任务红点消失。320×568、390×844、430×932待领画面已目视检查，按钮/字体和正红圆点可见；320需滚动查看下部任务，三尺寸裁切命中与44px触控由现有测试覆盖。浏览器辅助按钮鼠标点击未生效后改用键盘Enter完成操作；不把该自动化限制记为游戏缺陷。最后服务端损坏字段校验及客户端响应/跨日守卫仅重跑受影响自动测试，视觉输入未变，复用截图观察。
- 包体检查通过：静态主包3,956,537 / 4,194,304字节，余237,767字节（约232KiB）；总包5,751,902 / 31,457,280字节。原生Canvas detector无发现，仅作辅助检查，不替代视觉验收。规则更新已写入 docs/design/retention-v1.md，事实已在项目文档维护，不重复写共享记忆。
- 下一步：本次每日金币连通性故障修复已完成（真实SDK及原生页面通过），battle依赖修复已生效、用户已上传客户端；非实现者复核奖励迁移/事务与客户端恢复，用户在新上传版本真机检查红点及领取体验。真机需验证完成任务不到账、点击才到账、重进不重领与跨日规则。尚无本次独立复核或真机证据，不直接宣布正式发布放行。已升级账号不能直接回滚旧云实现；回退须保留兼容字段/逻辑，保存的版本4与本次业务源码一致，不保证能回退为可用依赖包。
- 本地预览访问修复：用户两次反馈无法访问，确认64006及临时替代53352均已无监听。tools/preview-retention.cjs增加可选MATCH3_PREVIEW_PORT（默认仍随机端口）；以独立后台进程恢复127.0.0.1:64006，非系统自启动服务。页面及fixture.js HTTP 200，独立内存测试会话的retentionInfo manual-v1返回ok=true；语法/diff检查通过。仅预览进程和开发工具改变，未重跑输入不变的产品测试。已请求Codex打开同址，工具返回queued，不声称浏览器已实际刷新。
- 周宝箱裁切修复：用户反馈任务卡增高后宝箱被截断。任务卡改为70px高、8px间距，保留原字号及64×44领取按钮；收紧上下间隔和去玩按钮，布局/滚动高度共享常量，390×844与430×932无上周待领时首屏完整显示三个任务和周宝箱。320×568仍可滚动，底部宝箱完整命中；retention-preview增加这些明确断言并通过。现有预览脚本390/320/430三尺寸检查通过、cloudAttempts均0，已目视查看390/430任务页和320底部宝箱截图，见assets/_incoming/retention-daily-coins-v1/screens/。初次静态预览检查因新增图鉴默认查询触发隔离断言，修正夹具catalogSample=true后通过，未放宽断言、未发真实云请求；node_repl启动浏览器受限后改用已获准的现有检查脚本。固定64006后台预览已重启并HTTP200；未更改领奖逻辑或上线状态。
- 卡片文案精简：按用户最新要求删除累计签到/漏签说明、每日和每周刷新/到期时间、北京时间日期、规则入口及其不可达正文；“上周待领”标题与实际奖励周期不变，异常过期反馈保留。收紧被移除说明所在的内容间距，正式页无日期底栏，隔离样板仍标注“界面预览·奖励不入账”。retention-preview新增文字绘制断言；该测试、retention-client/integration通过。现有预览脚本320/390/430均通过且cloudAttempts=0，目视确认390签到和任务页文字删除、宝箱完整；固定64006后台预览已更新且HTTP200。未部署、提交或推送。

<!-- workflow-adoption-20260929:start -->
## 流程采用 · 2026-09-29

用户已批准采用[统一协作流程](/Users/Admin/.codex/guidance/role-collaboration.md)及一次性通知现有负责人。该决定只改变工作方式，不改变产品批准、阶段门槛、文件归属、负责人模型或发布权限；在下一安全工作/交接点采用，已有有效证据继续复用。

| 负责人 | 一次性采用确认 | 应用点 / 冲突 |
| --- | --- | --- |
| 三消-主 | 已读取并确认采用 | 保留综合主任务；后续评估有界执行包，复用有效证据、明确候选和未验项。本轮禁委派工具约束优先，不强行委派。 |
| 三消编程-子 | 已读取并确认采用 | 无新任务，继续待命；获准后按有界包执行、复用证据并稳定交接，保留独立验收。 |

本项目全部上述负责人已于2026-09-29收到一次性通知并明确采用方式；无阻塞流程采用的冲突。首次适用的正常交接尚待发生，此处不宣布产品验收或提效试验完成。

产品经理维护本表（消除由现有主任务维护）。确认要说明下一项工作的执行包/证据复用/交接安排；首次适用的正常交接验证后结束迁移跟踪，不重复索取回执。尚未发生实际新交接时，不将规则读取写成提效或质量保证。
<!-- workflow-adoption-20260929:end -->

## 每日任务同步提示修复 · 2026-09-30（本地完成，待手机验证）

- 用户反馈新版正式版每次新开一局出现“每日任务已同步”，授权修复。综合主任务执行；改动小且紧耦合，本轮工具禁止委派，未调用worker或改变模型。候选为已推送f929f3ff4293f79ee58b3508cd478494ee4a6b1f加本条所列未提交修改，既有流程采用文档改动保留。
- 原因：retention-client.run在retentionRecord成功、无新金币收据时无条件notify；Main在胜利及离开结算时提交/再次确认，异步回包可在下一局显示。仅移除普通同步成功提示，不停止任务上报、不改云端去重/进度/奖励，保留真实奖励到账、失败、过期和终止错误反馈。
- 文件：js/platform/retention-client.js；test/retention-qa-client.js增加普通/重复确认静默、迟到回包不打扰下一局且新草稿保留、真实奖励仍提示；test/retention-integration.js增加真实Main/core/client/service/wallet链路通知断言。测试先在旧实现复现失败，再修复转绿。
- 有效证据：retention-qa-client、retention-client、retention-integration、retention-qa-recovery共4项通过，含两局真实核心模拟、每日/每周奖励、断网过期、存储与ACK恢复；运行JS语法及git diff --check通过。为本地隔离测试和主任务自复核，不冒充独立QA或微信真机。不重复无关图鉴/视觉/整套发布测试，无新包资源或依赖。
- 交接：手机预览完成一局后立即下一局，再完成当日后续对局，应不再出现“每日任务已同步”，任务页进度和实际到账提示应正常；断网后保留可重试反馈。尚未执行微信真机验证；用户已授权本次修复提交并推送GitHub main，微信由用户上传，无需部署云函数，客户端发布后线上才会生效。原提交可作为回退基线，测试夹具不改玩家数据。修复结论已在此记录，不重复写入共享记忆。

## 主包瘦身 · 2026-09-29（本地完成，待微信实际打包/真机）

- 用户批准按推荐迁移四张猫体遮罩和初见图集；不压画质、音质，不扩展选关/音频分包。沿用84a4d21923ab30618e63bc340507fe95a9bcdecd＋现有未提交候选，保留其他任务改动；本轮未提交Git、上传客户端、部署云端或修改权限。
- 5个文件从res/catalog原样移动至catalog：portraits-atlas.jpg及cream/ragdoll/siamese/calico-silhouette.png，共227214字节，无重新编码。assets.js主预加载只保留图鉴入口图标；图鉴分包21项复用现有原子解码、去重、超时、迟到回调隔离和重试。companion-ui所有阶段（含初见）等待ready，保留首页导航和故事重试，未就绪不标记已读或允许选择新陪伴。更新包体、独立素材清单、来源台账及既有分包/陪伴回归。
- 包体实测为本地静态估算：主包4,181,228→3,953,911字节（3.771MiB），减少227317字节，余240393字节（234.76KiB）；总包5,749,276字节，77主包/99总文件。图片只是分包转移，总下载量基本不变；预算和ignore未放宽。下方9/28余12.77KiB记录为迁移前历史，不再代表当前候选。
- 有效验证：catalog-subpackage-qa、companion-qa、package-budget、catalog-static-art-qa、catalog-qa、catalog-growth-qa、open-source-and-assets共7项通过；两份改动运行JS及preview-catalog语法、git diff --check通过。新增320/390/430宽度的初见加载/错误/成功、故事不误标已读、重试/退出保持选择与成长状态断言；分包检查覆盖21项资源及PNG alpha、成功原子发布、失败/超时/迟到回调。其余未受影响发布检查复用9/28有效证据，未宣称重新跑完整67项。
- 运行画面：新启动tools/preview-catalog.cjs，真实Main＋隔离浏览器wx夹具，增加仅本地scene/package/preset参数复现首屏状态。经CUA目视320×568首页等待、初见故事失败/重试与返回控件，390×844图鉴灰底局部模糊，430×932首页初见原画和切换/故事控件，素材可读、画面保持。预览按钮的自动点击未产生可验证状态变化，备用Chrome连接不可用，故用启动参数覆盖可见状态，不冒充按钮实点或真实微信网络验证；重试行为由既有Main/加载器自动测试覆盖。本轮为主任务自复核，测试文件名中的independent QA不代表另有独立审核者。
- 下一步：微信开发者工具实际打包，并用手机冷启动检查已选初见陪伴、首次打开图鉴、分包网络失败后重试；最新模糊效果真机性能仍未验证。迁移无需重部署battle。无新商业素材或外部上传，未保存新的共享记忆候选（现况已完整记入本记录）。
- 本地版本保存：用户随后授权将当前待上传候选提交本地Git，范围包含正式猫咪成长/已确认隐私/视觉更新/检查修正和上述瘦身；不推送GitHub、不上传微信。排除无关.impeccable、promo-duel及已忽略的第三方音效/创作输入，手机图鉴检查由用户完成后再上传。该授权不把待验项自动改为通过。

## 上传前整体检查 · 2026-09-28（两项收尾已修正，待实际打包/真机）

- 目标：用户要求核查整个当前本地候选是否可上传新版，随后授权“开始修正”两项测试/台账缺口。已修改test/audio.js、test/open-source-and-assets.js及素材总台账；未修改运行代码、图片、忽略规则或预算，未提交Git、上传或部署。基线84a4d21923ab30618e63bc340507fe95a9bcdecd＋当前未提交正式猫咪/留存/隐私代码及v2原画、柔光棋子、锁定态模糊素材；不把该Git提交单独当当前发布包。
- 结果：67份顶层Node测试（含simulate，不含大规模winrate标定）65通过、2失败；57份运行JS语法、4份每日冻结引擎同步、git diff --check通过。已覆盖单人/障碍/道具/经济、每日挑战/留存/猫咪、对战四道具/续局/弱网、隐私、音频及依赖安全。无零退出码但打印失败的额外用例。关卡生成输入未变，复用既有难度模拟证据，不重新声称真人胜率已标定。完整本机日志：/var/folders/17/tk8vwp413sq9m0yzdt_fx6xc0000gp/T/match3-release-review-i5HWUa/。
- 已修正1：test/audio.js模拟onMatch数据按真实GameCore契约补齐removed:[]/score:0，不改Main的计数或音效逻辑；原文件执行21条音频断言全部通过。
- 已修正2：test/open-source-and-assets.js独立硬编码清单加入4张{cream,ragdoll,siamese,calico}-silhouette.png遮罩，保持键数、文件集合、存在性、未忽略和台账检查；总台账增加4项遮罩来源/用途、图鉴v2的17张原画记录与五枚棋子柔光来源指针，明确主包31图/32键及分包16图，保留历史而不冒充现状。原PNG精确制备工具/参数未单独留档这一限制如实写明，不补造授权、模型或费用。素材合规检查通过。
- 修复后有效结果：重跑audio、open-source-and-assets、package-budget及git diff --check均通过。其余65项输入未变，复用上述通过证据；合计本次67项检查均通过，不宣称又完整重跑67项。未进行新的图片生成、Canvas改动或视觉验收。
- 包体当前通过但余量很小：主包4,181,228 / 4,194,304字节，余13,076字节（12.77KiB）；总包5,749,379 / 31,457,280字节，82主包/99总文件。先前余157KiB或65KiB的记录已不适用。尚未获得微信工具本次真实打包体积；建议留更多余量，不得抬高预算或忽略活跃素材。
- 视觉按更近的project-status/ui-production.md为准：用户已接受灰底与猫咪局部模糊，不再采用下方历史手绘剪影。当前catalog-ui通过assets.getLockedPortrait使用cached Canvas合成；已复核390列表/320详情现成运行截图与代码一致，复用该模块三尺寸运行及用户接受证据。微信真机对最新多画布模糊的兼容/首次打开性能尚待验，不把浏览器结果当手机结果。普通棋子柔光当前记录仍标用户待确认，需与最终候选确认一致。
- 已有有效发布依据：隐私2026-09-27.1正文已确认；依赖安全和release-gates通过；battle于9/27 09:01:33部署并完成记录中的真实SDK基础验证，回退版本3保留。本次未重新连接线上读取版本，不把本地测试当再次线上验收。用户此前反馈图鉴入口/条件、对战、隐私、启动网络正常，应保留为当时候选的手机证据；最新锁定模糊/换图仍须覆盖。
- 下一步：两项检查/台账缺口已完成，执行微信工具实际打包并补最新锁定态真机检查后再提交正式审核；可生成开发预览用于验收。主包静态余量仍仅12.77KiB，本轮未开展包体瘦身。本轮没有发现由失败测试证明的运行玩法崩溃，但不对未验平台兼容给出无条件正式放行。

## 图鉴原画 v2 · 首页同风格与差异化动作（2026-09-27）

- 用户反馈图鉴原画不如首页猫咪可爱，确认按首页两只猫的圆润 3D 萌系质感重做，并补充要求每只猫的阶段动作差异化。已生成四猫初见图集与四张五阶段动作板，保留英短、布偶、暹罗、三花品种差异。
- 动作设计：奶糖偏探索撒娇，团子偏慵懒陪伴，芝麻偏灵巧玩耍，布丁偏安静观察与亲近；五阶段不复用同一套站姿模板。生成源与提示说明见 `assets/_incoming/cat-catalog-v2/README.md`。
- 运行接入：替换 `res/catalog/portraits-atlas.jpg` 初见图鉴图集；替换子包 16 张 `{naitang,tuanzi,zhima,buding}-{familiar,trust,attachment,best-friend}.jpg`。未修改图鉴交互、成长阈值、经济或本地陪伴存储。
- 包体：主包 `4,129,241 / 4,194,304` 字节，总包 `5,697,392 / 31,457,280` 字节；通过包体预算，未忽略活动素材或放宽上限。
- 验证：`catalog-static-art-qa.js`、`catalog-subpackage-qa.js`、`catalog-qa.js`、`catalog-growth-qa.js`、`open-source-and-assets.js`、`package-budget.js` 与 `git diff --check` 通过；`tools/preview-catalog.cjs --check --width=390`及`--companion-check`通过。390×844列表与详情截图确认四猫初见和阶段原画风格统一、裁切完整。
- 当前边界：仅本地工作区和预览验证，未上传/部署；四猫真实云成长与正式存档边界不因换图改变。

## 正式版接入 · 当前实施（2026-09-27）

- 用户确认原隐私正文2026-09-23.2，并要求按正式版完成；猫咪规则改为累计活跃7/14/21/28天逐只解锁，每次任选尚未领养猫咪，无首赠、不新增金币/付费购买。全部已领养猫可成长，亲密度0/4/10/20/42；第1/3局有效结算各1鱼，每日跨模式共2鱼，库存不跨日清空。develop演示领养/鱼干/外观记录不迁入正式资产。
- 本任务负责正式接入与记录。以84a4d21为Git基线，保持原视觉、20阶段原画和四道具方案，不新创作素材。既有助手此前只核对架构要点，未复核本轮实现；发现其实际模型不符用户要求后已停止派活。本轮不得将旧意见或QA命名的自动测试算作独立实现验收。
- 顺序：云端状态/协议及异常测试→真实客户端/既有页面与正式入口→集成复核（用户后改为主任务自复核）→有界云部署→平台/双账号真机验收→发布决定。隐私正文已确认，云部署已授权并完成；客户端上传、Git提交/推送仍需另行授权。
- 服务端复用retention_profiles嵌入catalog；结算复用retentionRecord及既有去重，任务满后仍接受至第三局发鱼。solo沿用有限可信结算上报，daily冻结重放，PvP服务端凭证；不声称完整反作弊。从新版启用后已验证结算开始积累，不虚构历史天数。
- 页面保留首页图鉴/金币入口、图鉴列表/详情、喂食确认/解锁/故事/陪伴切换；补真实加载、未解锁天数、处理中、断线重试与跨设备状态更新。新存档仅承认云端所有权，展示/阅读偏好仍本地。
- 本地实现、自复核及云部署完成，状态待完整平台/真机验收：新增catalog云事务与客户端持久化待确认请求；正式三渠道入口、跨账号陪伴偏好隔离、全部猫可成长、断线重试、CAS并发与不重扣落地。用户已审阅并确认2026-09-27.1完整隐私正文，approvedForRelease=true；这不代表微信后台指引已更新。
- 有效自动证据（84a4d21＋当前本轮未提交变更）：catalog-cloud/client、retention-cloud/integration及qa-client/recovery/routes/wallet、battle-items-client-v3、catalog-growth/qa/growth-qa/static-art-qa/subpackage-qa/companion-qa/storage通过。补充retention-cloud混合模式用同一账号验证solo→daily重放→PvP云凭据第1/3局发鱼、每日共2鱼与重试不增天数；初版测试漏传必填cleared被正常拒绝，补齐夹具后通过，未放宽产品校验。catalog-cloud覆盖28个非连续活跃日全部4次领养、全部猫成长、并发/重放/切号/坏档/旧档和清理保留；新增非字符串requestId拒绝断言通过。隐私reader/entry/release-gates通过；4份daily引擎同步、15个变更/新增JS语法、diff空白检查通过。未重跑输入未变的难度模拟。
- 运行证据：tools/preview-catalog.cjs的live=1使用真实Main与battle处理代码、隔离本地数据库/合成账号/模拟日期，无微信云调用或玩家数据。320×568检查0/7日门槛、领养、喂食丢回包→错误页/可返回；390×844重载恢复待确认请求只扣一次，14日第二猫领养并喂食；430×932重载显示已领养2/4、鱼干26、团子亲密度1，详情/确认控件未见遮挡，浏览器error日志为空。日期推进为测试工具，不是真实等待14日，也不是微信真机验收；工具栏不进入正式game.js。原生Canvas detector无发现，仅作源码辅助证据。
- 最终静态包体：主包4,033,838 / 4,194,304字节，余160,466字节（约157KiB）；总包4,926,927 / 31,457,280字节，77主包文件/94总文件。无新素材、未降画质或放宽预算；需微信工具实际打包确认。
- 最新用户将本轮复核改为“那你自己来复核吧”。主任务已完成自复核（不是非实现者独立QA）：检查云事务、身份边界、旧档惰性迁移、请求去重、CAS、客户端确认顺序、正式入口及演示隔离，未发现新增阻断性代码问题。新增catalog-cloud跨日已提交请求重试，catalog-client迟到回包不重开页面/异常响应保留待确认请求，retention-qa-routes三接口无身份拒绝与伪造账号隔离，companion-storage正式按账号key隔离及不迁移演示数据；四份受影响测试通过、diff检查通过。本轮仅测试/记录改动，运行代码与包体输入不变，复用上列其余证据。此前独立QA未完成这一事实保留，不冒称独立验收。
- 已获用户有界部署/测试授权并完成：2026-09-27 09:01:33既有环境battle已更新，部署前版本3（before-catalog-20260927）保留；未改运行时、内存、超时、清理开关、权限或流量分配。真实微信SDK猫咪查询0天0鱼/未达条件拒绝领养与喂食、retentionInfo/dailyInfo、新旧房间创建查询退出、新四道具配置均通过；测试房正常退出，无伪造活跃日/奖励。临时Console验证后重新编译正常首页，入口源码未改、余额1390/体力5不变；模拟器自动点击图鉴未成功，不记为原生交互通过。
- 下一步：预览版人工触控与手机双账号四道具/每日金币/正常结算发鱼、断线重启、跨设备验证，再决定客户端上传发布。自复核与SDK基础检查不等于真机或上线放行。未上传客户端、提交Git或推送；部署及证据边界见docs/release/catalog-activation.md顶部。旧五项优化与1.0.3开发上传记录如下保留。
- 2026-09-27补充视觉修复：用户反馈图鉴未解锁猫咪原画未置灰。`js/render/catalog-ui.js`新增列表卡片与详情页统一的锁定态灰度/降饱和遮罩，保留猫咪轮廓、锁图标和解锁条件；已领养卡片不受影响。`catalog-qa.js`、`catalog-growth-qa.js`、三尺寸`preview-catalog.cjs --check`通过；本地390×844真实Main预览目视确认布丁未解锁详情已明显灰化。未上传客户端。
- 随后按用户建议进一步改为剪影：锁定态保留月夜背景，叠加深色通用猫咪轮廓和微弱紫色描边，不再暴露脸部/毛色细节；不新增素材、不改变解锁逻辑。三尺寸预览回归及390×844目视确认通过，未上传客户端。
- 用户指出通用剪影与原画体态差异过大后再次细化：锁定态现在按奶糖前伸、团子横卧、芝麻长尾站姿、布丁圆坐四种原画构图分别绘制头部、耳朵、躯干、爪子和实心尾巴，并保留微弱边缘光；不再复用单一猫形路径。语法、图鉴两项回归、三尺寸预览和diff检查通过，未上传客户端。
- 2026-09-27再次按用户反馈校正轮廓：锁定态剪影改为与初见图集同构的四套裁切坐标，移除奶糖误加尾巴，补齐团子左侧蓬松尾、芝麻左侧高卷尾、布丁右侧绕尾，并将爪/身体底缘改为圆弧。`catalog-static-art-qa.js`、`catalog-qa.js`、`node --check`、`git diff --check`及320×568/390×844/430×932 `preview-catalog.cjs --check`通过；本地430×932锁定态截图完成运行时目视复核。未上传客户端。

## 猫咪故事与陪伴 · 五项优化实现（2026-09-26）

用户明确“全部一起做，紧凑弹窗”，授权审阅记录中的五项优化；沿用已接受月夜花园、淡紫控件和全部静态原画，无新创作、动画、社交或经济奖励。当前实现：
- 首页原画与打开的故事阶段一致；已领养当前猫点击后进入形象/章节选择，返回可回切换弹窗。缓存只读猫准确标示“查看已存故事”。
- 五章固定在故事页顶部，320窄屏首屏即可操作；48px按钮、选中描边、锁图标和未读点分明，正文三行完整。
- 锁定页在可成长时显示当前亲密度/还差几次喂食，并跳到该猫喂食确认；未开放成长和仅缓存状态分别解释，不授予进度。阶段解锁弹层新增“读新故事”。
- 首页之上显示高度随猫数变化的紧凑切换弹窗，遮罩隔离背景触摸；支持查看形象、去图鉴、恢复默认，恢复默认为次要按钮。
- 首页每日金币只在真实同步ready、服务端校时后的当天，存在签到/本周宝箱/有效上周宝箱可领时提示“可领”；pending/离线/跨日/过期/已领不提示。自动入账任务无虚构待领。新故事在首页/图鉴猫卡/故事入口/章节提示，图鉴入口优先未读；阅读正文可见且原画就绪后标记一次，读取失败或保存失败可重试，不循环写盘。

存储：沿用 `match3_companion_display_v1` version1，可选read位掩码兼容旧快照，仅记住展示选择和已读章节。恢复默认不抹已读；保存失败保留旧选择/标记。本机缓存章节与当前模型的可读范围取并集，但新设陪伴仍限当前已领养且实际解锁的形象，不恢复云领养、鱼干或亲密度。成长仍develop内存样板，第三/四猫解锁规则、正式云成长未扩展。

责任：主任务实现UI/Main/领取提示与三尺寸浏览器检查；companion_data有界维护陪伴存储/测试；catalog_package有界原样迁移四图与映射/预算测试；既有catalog_independent_qa独立验证。未改变角色归属、提交、推送、上传或部署。

包体配套：本轮开始时当前共享工作区主包4195089字节已略超4MiB。奶糖后四阶段JPEG原样迁移至已有catalog子包，共208043字节，图集初见仍留主包；分包图数12→16，解码进度分母取注册数。未降低图质、忽略活跃资源或放宽预算。最终读取预算：主包4011680 / 4194304字节（余182624，约178KiB），总包4904769 / 31457280字节。期间其他任务也在该共享工作区更新main/对战与关卡相关文件，均保留；不再使用此前余2420字节旧值。

有效证据：
- companion-storage、retention-client、catalog-qa、catalog-growth-qa、menu-battle-press通过；包迁移的catalog-subpackage-qa、catalog-static-art-qa、open-source-and-assets通过；相关语法与diff检查通过。
- `node tools/preview-catalog.cjs --companion-check` 三尺寸320×568/390×844/430×932通过：首次未读、固定章节、选中一致、锁章到喂食确认、当前猫重选/返回弹窗、第二猫选择、无进度变更、读后消除提示、失败保留、重载保存与恢复默认；钱包2460/云请求0不变。截图为真实Main Canvas浏览器wx夹具，路径 `assets/_incoming/cat-catalog-v1/screens/companion-{home,story,chapters,locked,switch,switch-two,save-error}-{320,390,430}.png`。
- 主任务一轮目视后集中修正320正文末行裁切及选中方框，最终复查三行完整、描边圆润、单/双猫弹窗紧凑。独立QA目视18张截图通过，并在companion-qa中发现保存失败时retry-save与select同区注册；改为互斥主操作后独立复测通过。浏览器补充团子首次阅读保存失败→实际点击重试→原陪伴不变→再选择，三尺寸通过（companion-read-error截图）。原生Canvas源码detector输出[]，不当作运行视觉证明。
- 微信工具2.02.2608040/基础库3.16.2：本轮看到真实“可领”标记、16图子包加载40%后四猫列表；实测奶糖领养、拖动详情、新故事入口、初见阅读、熟悉锁定条件、去喂奶糖到确认弹层通过；钱包1390不变。陪伴选择/重启保存的原生链路尚未确认。出现工具自身app.asar栈的worker path empty，后续热编译清除；共享工作区文件自动重编译也会打断当前页面。临时触摸console仅用于诊断，后续自动编译已清除，源码无诊断代码；最终可见0错误/1条平台提示。一次热编译后旧坐标误进对战准备，立即取消房间、未邀请或开局；因此停止对正在自动重编译的界面连续操作。其他任务01:05仍在更新test文件，不擅自关闭全局自动编译。不能把浏览器结果称为真机通过。

当前停点：用户运行视觉验收；独立QA已通过，原生完整链路待工作区稳定后补。http://127.0.0.1:61919/ 提供本机预览（session51691，包含本轮最终companion UI/恢复修复；其他任务后续非本模块代码变化不冒称已打进该浏览器夹具），此前1.0.3开发上传只包含原画子包，未包含本轮五项优化。历史审阅依据 `.impeccable/critique/2026-09-25T16-06-28Z__match3-wechat-js-render-companion-ui-js.md` 已由用户批准执行，不再待范围选择。

## 全部静态原画接入与原生图鉴子包 · 当前交付（2026-09-25）

状态：12张补图已由用户“可以，推进部署”接受，并选择A（微信原生图鉴子包）。实现与独立QA通过；微信开发者工具已编译并观察真实wx.loadSubpackage加载40%后进入图鉴。2026-09-25约12:00，微信返回“代码上传成功”，1.0.3开发版本上传完成；原生详情、领养、喂食、返回验证通过，具体结果统一记于 `docs/release/catalog-activation.md`。图鉴仍为develop、内存样板，真实云端成长/第三与第四只解锁未在本轮扩展。

交付：`catalog/`普通子包含12张512×512 JPEG和game.js入口，现有四猫atlas、奶糖4图、图标留主包。`assets.js`保留主预加载，新增独立注册与按需子包/解码加载，20秒总超时、重试、并发去重、原子发布和迟到回调隔离；`catalog-ui.js`接入四猫各五阶段静态映射和可返回的加载/错误页；Main进入/重试仅加载，返回不自动导航。动画全部延至下版本，不新增云资源/云函数/SDK。

责任：主任务负责加载器/Main/UI与平台验证；catalog_package为有界gpt-6-sol medium执行包，独占转换脚本、game.json、catalog目录和包体测试；既有catalog_independent_qa独立新增子包测试并审阅浏览器截图，不参与生产实现。工具确认指定路由，不以模型自述证明底层实际模型。未改角色归属、用户任务、Git提交/推送。

有效证据（当前未提交工作区）：
- 包体检查通过：主包4,173,051 / 4,194,304字节；总包4,858,097 / 31,457,280字节；新子包685,046字节。官方2026-09-25核对main4M、total30M，普通子包无独立4M上限；不能把活跃素材放入ignore规避预算。
- `catalog-qa.js`、`catalog-growth-qa.js`、`open-source-and-assets.js`及受影响语法/diff检查通过。独立 `catalog-subpackage-qa.js`通过：12图独立、主预加载不读子包、去重、超时/失败/缺失API、旧回调无效、原子解码、Main返回与重试、20阶段等比映射和实际JPEG尺寸，无开放P1/P2。
- `node tools/preview-catalog.cjs --check`：320×568、390×844、430×932通过；钱包2460、存储写入4、云0保持不变。`--subpackage-check`完成20阶段跨450ms静态像素检查与截图；首轮最后的数据断言错误复用了页面reload之前的analytics时间戳，修正为reload后的基线后只重跑`--subpackage-check --recovery-only`通过。没有改变产品行为以掩盖失败。
- 新截图 `assets/_incoming/cat-catalog-v1/screens/subpackage-{cream,ragdoll,siamese,calico}-{0..4}.png`、`subpackage-loading.png`、`subpackage-error.png`。20张由独立QA逐张目视通过，均为真实Main的本地浏览器wx夹具截图，不冒充微信/真机证据。主任务抽查团子挚友/芝麻信任/布丁依恋/错误页通过。
- 微信原生检查：Desktop版开发者工具2.02.2608040、基础库3.16.2、既有AppID；compile无错误，真实子包加载页到四猫图鉴成功。解锁后团子详情/免费领养/喂食确认/亲密度0→1、小鱼干2→1/返回列表与首页均实测通过，真实钱包1390不变；临时触摸诊断在11:54:27重新编译清除，0错误。微信实际打包上传通过，精确平台包字节未展示，静态估算不冒充平台测量。

已完成本阶段授权：1.0.3开发候选上传成功，无审核/公开发布，无battle重部署或真实猫咪云进度改动。后续手机真机/真实云成长是独立阶段，不把当前样板上传称为猫咪成长系统正式上线。原画生产历史如下。

## 静态原画恢复与四猫全阶段出图 · 生产历史（2026-09-25）

状态：静态回退完成；用户明确“先退回原画，下个版本再做动画，先把所有原画做出来”。采用已接受四猫身份与月夜花园风格，本轮补齐团子/芝麻/布丁第二至第五阶段共12张1254×1254独立原画候选（awaiting_acceptance）；加上四猫初见及奶糖后四阶段，共20个阶段均有图。初见四张仍沿用已接受图集区域，并非本轮重新生成独立高清初见。新12张尚未注册到游戏；真实多猫成长、云端与第三/四猫解锁规则仍未完成。

责任：主任务负责12张提示、内置ImageGen生产、逐张目视、来源/审阅页与静态运行验收；catalog_static_restore有界移除动画代码，明确选择工具支持的gpt-6-sol medium，未改变主所有者；catalog_independent_qa独立审阅静态回退/测试，不参与实现。未创建用户任务、提交、推送、部署、云资源或外部创作API。

交付：
- `match3-wechat/js/render/catalog-ui.js`恢复静态stageArt；`js/main.js`仅移除图鉴动画钩子，保留五阶段素材、成长/喂食/回顾/满级交互文案。网格、整图变形、星光、爱心均从当前运行路径移除。
- 动画模块/测试/浏览器工具保存到Git忽略的 `assets/_incoming/cat-animation-deferred/`，仅供下版本参考，当前不可运行也非已接受方向，说明见同目录README。没有用no-op接口保留死路径。
- `assets/_incoming/cat-growth-complete-v1/`：12张`{tuanzi,zhima,buding}-stage-{2..5}-v1.png`、完整提示 `*-full-prompt.txt`、`provenance.json`、README。每图内置ImageGen一次，共12次，无追加重试/付费CLI/外部服务；仅引用用户已批准的项目生成v8身份图与各猫本轮第二阶段参考，无照片/代码/凭证上传；实际内部模型/种子/费用未披露。
- `tools/preview-cat-art.cjs`为本机只读20阶段审阅页，只有明确图片白名单路由；五阶段横向对照、点击放大、窄屏双列。新原画留在incoming供用户接受，不塞入已接近预算的主包。

有效证据：
- 静态回退实现脚本语法、`catalog-qa.js`、`catalog-growth-qa.js`与包体检查通过；独立新增 `catalog-static-art-qa.js`通过：五张源图在列表/详情/回顾弹层完整居中等比；重复帧几何/命中区不变，clock/offscreen设为抛错仍可绘制，无mesh/ambient/burst接口，模型/鱼干/亲密度不变。独立另验 `catalog-growth.js`，无开放P1/P2。
- `node tools/preview-catalog.cjs --check`静态修订后320×568、390×844、430×932全部通过，钱包2460/存储4/云0不变。真实Main浏览器检查静态五阶段450ms跨帧像素完全一致，截图 `assets/_incoming/cat-catalog-v1/screens/static-restored-390.png`。
- 原画审阅检查：12张PNG均1254×1254；20阶段按钮、16独立图片+4原图集裁片全部加载；放大/关闭与390窄屏无横向溢出。截图 `assets/_incoming/cat-growth-complete-v1/all-20-review.png`、`{naitang,tuanzi,zhima,buding}-five-stages.png`及`review-mobile.png`。主任务已逐张目视生成输出及最终20阶段对照图；审阅页首轮发现HTML固有高度使缩略图卡片过高，补height:auto并加入方形断言后重取截图通过。原画无文字/控件、水印或明显多余肢体，三品种毛长/轮廓与花色可辨；用户尚未接受这12张。
- 当前包体4,167,418 / 4,194,304字节，余26,886；活跃素材3,253,243 / 3,670,016。新增12张未进主包，后续运行采用前必须确定分包/加载方案，不能提高预算或忽略活跃文件。

本机入口：静态游戏 `http://127.0.0.1:61919/`（session65898），全原画审阅 `http://127.0.0.1:61920/`（session63126）。仅本地、无真实存档/云端或发布；本轮未验微信真机。

下一步/停点：用户集中审阅12张新原画，接受后再按包体边界安排运行加载；动画明确延期至下一版本，不继续优化当前动画。原画制作完成不等于多猫成长/云接入完成。

## 首只猫成长与原画 · 动画尝试历史（2026-09-25，已按用户要求回退）

状态：成长样板与奶糖五阶段原画accepted；用户接受第四/第五阶段并要求简单动效。五阶段已完成运行集成。用户进一步要求猫咪本身动，现改为奶糖五姿势的头部轻摆和胸腹呼吸局部网格，外部背景锚定；星光与互动爱心保留。新版动效运行视觉awaiting_acceptance。样板规则仍为五阶段0/4/10/20/42、每喂1鱼+1亲密度、每日第1/3有效完成各1鱼总2、满级免费互动、已开放阶段永久回顾。详细规则/页面以 `docs/design/cat-companionship-v1.md` 为准。

最新交付：奶糖初见沿用图集，熟悉/信任/依恋/挚友采用已接受的独立原画。`cat-art-motion.js`按五种姿态配置头部/身体区域，16×16局部网格对头部做6.4秒周期小幅摆动、胸腹做3.8秒周期呼吸；脸中心近似刚体、毛发边缘羽化过渡，区域外网格点固定。替代上一轮整幅原画缩放/旋转，不新增或重绘位图，不制作眨眼/抬爪/骨骼动画。`catalog-ui.js`仅给奶糖启用局部动作，其他猫原画静止；文字/框/命中区静止，星光及1.4秒、6颗爱心/星光反馈保留。每模型最多一个384×384离屏缓冲（原始RGBA约0.56MiB，平台开销另计），24fps重绘缓存，无帧图集；平台没有离屏Canvas时直接绘制网格。减少特效/后台静态，离开图鉴释放模型关联缓存，无新增定时器、持久化或经济改动。

责任：主任务维护成长画布与Main触摸/返回集成；growth_model只改内存模型及逻辑测试；catalog_preview_harness只改本地浏览器夹具；catalog_independent_qa独立审查新增边界与视觉，未参与实现。沿用已披露可用gpt-5.6-sol medium代理路由，主所有者不变。

交付：
- `js/platform/catalog-preview.js`（相对match3-wechat）：首只猫成长、确认与取消、五阶段/展示阶段分离、锁定回顾、满级、食物不足与模拟日奖励；第二只可领养但本轮不开放成长，第三/四只规则不填。
- `js/render/catalog-ui.js` / `js/main.js`：等比原画、亲密度条、五阶段按钮、喂食/解锁/回顾/不足弹窗、固定底部操作。弹层仅返回自身按钮，Main保存overlay引用防跨弹层迟到触摸。
- `tools/preview-catalog.cjs`：加入“奶糖·亲密3”“小鱼干0”“满级42”“回忆20”状态，完成局/主动退出/下一日演示工具；工具仅调用内存模型，真实对局不发鱼。
- `test/catalog-growth.js`：成长边界测试。当前奶糖五阶段均可用；其他猫尚只有初见图，不能称已完成20张资产。

有效证据（当前未提交工作区）：
- `node match3-wechat/test/catalog-growth.js`：四阈值跨越、确认/取消/去重、目标猫与弹层校验、锁定原画拒选、回顾不减进度、无鱼/满级无扣、每日1/3/上限/退出/跨日、首只限定通过。
- `node match3-wechat/test/catalog-qa.js`：既有领养/路由/多指与选择变化安全回归通过。
- 独立QA新增并通过 `node match3-wechat/test/catalog-growth-qa.js`：弹层替换底层命中区、后台取消、overlay引用变化、按压期间出现弹层/切换猫咪、重复touchend、锁定阶段、无鱼返回、第二只不显示成长操作。独立逐张目视18张成长截图，无开放P1/P2；复用已有模型和真实Main浏览器证据，不重复全套。
- `node tools/preview-catalog.cjs --check`：320×568、390×844、430×932全部通过；喂食取消/确认/重放、阶段提示/回顾、锁定条件、无鱼回首页、满级互动、模拟每日奖励均经过真实Main浏览器。钱包2460、存储写入4不变，cloudAttempts=0。首次失败是工具错误地期待锁定阶段不可看条件，按已定契约改为可看但不可选后通过；未掩盖产品失败。
- 最新运行截图：`assets/_incoming/cat-catalog-v1/screens/growth-{detail,confirm,unlock,gallery,food,maxed}-{320,390,430}.png`。主任务目视390详情/满级及320确认/解锁/回顾/不足，原画比例、按钮与文案清晰，320详情可滚动到阶段节点。
- 主任务另补并目视 `growth-detail-bottom-320.png`：五阶段节点、回顾提示和固定喂食按钮均完整，44px以上命中区域可达；这张补图为主任务运行检查，不冒充独立QA复核。
- 熟悉原画集成后重跑三档 `preview-catalog.cjs --check`通过，wallet2460/storage4/cloud0不变。补图 `naitang-familiar-{detail,gallery,list}-{320,390,430}.png`来自原预览真实Main；逐次喂食、回顾选择初见再切熟悉，三尺寸确认displayStage=1/affection=4，未降低进度。主任务目视390详情/列表与320回顾，等比完整构图、其他猫素材不变。
- catalog_independent_qa只读复核素材绑定/等比绘制及上述9张截图、3张升级图：无开放P1/P2，确认奶糖卡片/详情/升级/回顾一致、其他猫未误替换、2/5与文案准确；未重复通过检查，未评价第三阶段候选方向。
- 动效集成后 `catalog-qa.js`、`catalog-growth-qa.js`、`retention-preview.js`、受影响脚本语法与diff检查通过；`preview-catalog.cjs --check`三档再次通过，钱包2460/存储4/云0保持不变。
- `node tools/preview-catalog-motion.cjs`三档通过：五阶段截图；390实际像素跨帧变化、reduceEffects与后台静止、回前台恢复，模型与按钮几何不变。实际Main触摸触发升级/普通喂食/满级互动并录制Canvas：`assets/_incoming/cat-catalog-v1/screens/catalog-motion-390.webm`；同目录`motion-stage-{0..4}-{320,390,430}.png`、`motion-{unlock,feed,pet}-burst-390.png`。主任务目视依恋390、挚友320与升级/互动390，比例、完整构图、淡紫控件和短屏固定操作正常；时序行为以实际像素检查和录像为证据。
- 局部网格更新后，`catalog-growth-qa.js`、`catalog-qa.js`再次通过；`preview-catalog-motion.cjs`三档原画及390生命周期/模型/命中区实际像素检查通过。未修改Main/模型，原有其他行为证据复用。
- 独立QA更新 `test/catalog-motion-qa.js`并通过：五姿势外部背景固定、全网格位移≤0.016、脸中心位移≤0.007且局部残差<0.0005（384px下<0.2px）；模型/命中区不变，reduceEffects/hidden/其他猫无mesh，单个384缓冲与24fps缓存复用，切阶段无帧图集，clearMotion清理与资源路由隔离。独立最终抽查熟悉/信任/挚友两相位：身份与比例保持，无明显网格裂缝、重影、透明缝或局部拉扯，背景与画框稳定，无开放P1/P2。变化刻意细微；WebM未逐帧播放，结论基于A/B运行帧、动态像素和点级测试，不覆盖微信真机/GPU性能。
- `node tools/check-cat-motion.cjs`使用实际浏览器Canvas：五阶段1.6/4.8秒取样，外部背景两处样区变化均0、猫区域超过阈值的变化像素分别14464/20635/18492/23389/17245。每帧绘制命令提交P95约0.4–0.6ms（本机Chrome，不能代表GPU完成时间或微信真机性能）。真实Main五姿势录像 `screens/cat-local-motion-390.webm`，约25秒；每姿势 `cat-local-motion-{0..4}-{a,b}.png`记录两个相位。主任务目视初见/依恋两相位，未见裂缝或脸型异常；文件均在上述screens目录。
- 最新 `package-budget.js`：4,172,775 / 4,194,304字节（76文件），活跃素材3,253,243 / 3,670,016字节。主包余21,529字节；未提高预算、未忽略活跃资产。先前相关输入未变的成长纯逻辑证据复用。

边界：仅develop、全内存、刷新清空，未写真实金币/鱼干/领养进度，未连接云端或部署；微信开发者工具/真机本轮未验。首次样板给2份演示鱼干，不是正式初始经济决定。奶糖五张已接受集成；其他猫尚未制作后续成长原画。

当前预览：http://127.0.0.1:61919/ ，本机session87911。原服务停止后在同端口加载新版局部动作。正常入口可领养首只后喂食；工具栏“奶糖·亲密3”可一喂体验熟悉原画解锁，另可看缺资源/满级/回顾并模拟日奖励。所有工具栏状态只用于本机浏览器。

下一步/停点：用户查看当前猫咪局部动作（尚无眨眼或抬爪）。当前主包余量21,529字节，完整20张原画不能直接塞入主包；资产加载方案须在批量扩展前确定。真实云端/对局数据接入另按具体范围推进，未执行部署。

## 猫咪图鉴 · 已接受样板证据（2026-09-24，历史）

状态：accepted。用户已以“可以，继续推进”接受图鉴。此前用户接受v8概念后明确“开始吧”，授权可点击样板：首页入口 → 四猫图鉴 → 条件/领养/已领养详情 → 返回。主任务负责UI与Main集成；catalog_preview_harness负责隔离浏览器工具；catalog_independent_qa独立审查相关行为与截图。两代理使用已披露gpt-5.6-sol medium；没有改变主任务模型或既有模块所有权。

输入与边界：采用已接受 `assets/_incoming/cat-catalog-v1/catalog-concept-v8-round-calico.png` 的四猫身份和2×2卡片，布丁圆脸正面自然趴卧。原PRD `docs/design/cat-companionship-v1.md` 中第三/四只解锁规则和成长数值尚未最终确认，本轮不擅自确定真实规则。样板仅develop可见，页面固定标明临时预览；不持久化图鉴，不接真实服务，不消耗货币。真实喂食、成长、20张独立原画及云端部署不计为本轮完成。

最新用户反馈修订：首页图鉴入口为淡紫猫爪收藏册，列表/详情沿用淡紫珍珠底板、内衬及按钮。在此基础上修复用户指出的原画竖向压扁：`portrait()`统一contain等比显示，列表按各行原画宽高比决定卡高，不再强压进统一高度；删除列表/详情顶部标题，返回与统计条并排、内容上移40px，详情插画上限252px/短屏下限156px。四猫原始素材、资格、触摸与数据边界未变。新图标来源与160px/44px透明验证见 `docs/design/cat-catalog-assets.md`，完整运行视觉待用户验收。

交付文件：
- `match3-wechat/js/platform/catalog-preview.js`：内存模型、首次任选、第二只累计7天演示资格、领养去重；已领养两只后剩余猫展示待定条件。
- `match3-wechat/js/render/catalog-ui.js`：原生Canvas卡片、文字、按钮、三态详情、五阶段说明、滚动及异常画面。
- `match3-wechat/js/main.js` / `js/render/ui.js` / `js/render/assets.js`（后两项相对match3-wechat）：首页入口、路由、触摸生命周期和素材注册。保留此前每日金币与其他未提交工作。
- `match3-wechat/res/catalog/portraits-atlas.jpg`：700×776、102460字节，只含四块猫咪画面，不含页面文字或按钮；`tools/prepare-catalog-assets.cjs`确定性提取已接受PNG，无新生成调用。运行背景复用现有月夜背景，卡框和控件原生绘制，非整张概念图加透明热区。
- `tools/preview-catalog.cjs` / `match3-wechat/test/catalog-qa.js`：真实Main浏览器夹具、独立触摸/资格回归。完整截图位于 `assets/_incoming/cat-catalog-v1/screens/`。

有效证据（当前工作区，未提交，无客户端构建步骤）：
- `node tools/preview-catalog.cjs --check`：320×568、390×844、430×932通过。首次详情不自动领养、免费领养与重复操作、3/7日资格、剩余锁定、返回与关闭、窄屏滚动/取消/后台、加载/断网/错误恢复均通过。钱包2460不变，启动后存储写入基线4不变，cloudAttempts=0。此证据为真实Main配本地内存wx夹具，不是微信云端或真机证据。
- 独立QA `node match3-wechat/test/catalog-qa.js` 通过。发现并修复双指/错误手指抬起、触摸中选中猫变更导致误领养；保留identifier/view/selectedId/status快照与多指取消。独立补充多指开始与移动切指回归并通过。无开放P1/P2。
- 最新运行截图：390/430完整2×2，320列表滚动仍可到第四只；顶部无标题，详情卡内保留猫名；320详情156px等比插画、固定条件与操作清楚。独立审阅已接受相应证据，用户运行视觉验收待进行。
- 受影响 `retention-preview.js`、`ui-smoke.js`（28项）通过；新脚本语法与相关diff空白检查通过。
- 等比/去标题修订后重跑真实Main的 `node tools/preview-catalog.cjs --check`：320/390/430通过，钱包2460、存储写入4、云请求0保持不变；列表/详情/异常截图已更新。`catalog-qa.js`、语法/diff检查通过。上一轮`catalog-home-390.png`及`ui-smoke.js`28项证据因相关首页代码未变而复用。
- 本轮独立视觉复核由catalog_independent_qa完成：检查等比绘制源码与三档最新列表/详情，猫咪比例自然、返回与统计条无碰撞、底板/卡片边距一致、小屏滚动及固定操作正常，无开放P1/P2。上一轮首页图标/透明边缘证据仍有效。首页320/430新实图与微信开发者工具/真机未验。
- 最新包体 `node match3-wechat/test/package-budget.js`：活跃素材3,045,200字节，静态主包3,944,380 / 4,194,304字节（71文件）。未扩大预算或排除活跃素材。
- 本地浏览器启动/监听在沙箱内遇到EPERM，使用针对本地预览的自动审查批准后完成；无外部上传。本轮CUA浏览器枚举返回fetch失败，未能代用户刷新可见页签；无头浏览器运行截图与交互检查有效。

历史预览已由上方成长样板在原端口替换；旧session74806已停止。正式客户端无调试工具栏。

本阶段已接受。复盘见 `project-status/retrospectives/catalog-ui-20260924.md`；成长样板的后续授权与工作以上方当前条目为准。云部署、发布及Git提交/推送均未执行。

用户随后确认成长门槛草案，进入上方首只猫成长样板；第三/四只解锁、云端、20张原画仍留待后续。

### 方向与开发顺序记录

已确定4只猫×5阶段×1张原画，共20张；手动喂食、首次免费与第二只累计7天解锁。v1同质化、v2第二/第四只接近，第四只经历孟加拉候选后按用户要求回到三花，姿势和脸型最终接受v8。详细概念源图及定向提示在 `assets/_incoming/cat-catalog-v1/`，旧候选不作为当前基准。

| 步骤 | 状态与交付 | 下一门槛 |
| --- | --- | --- |
| 图鉴优先的范围与页面 | 本阶段已获用户开始授权；完整成长规则仍有待定项 | 不将样板假定当真实规则 |
| 图鉴概念与基础四猫 | v8已接受 | 沿用身份与构图 |
| 可运行图鉴、条件与领养三态 | 已完成并获用户接受 | 后续保持已接受布局 |
| 喂食、五阶段与原画回顾 | 本地样板已完成、QA与用户确认；奶糖第二阶段原画候选已生成 | 单张角色原画验收与运行集成 |
| 云端进度、平台验证与发布 | 尚未实施 | 接口与部署准备就绪后具体授权 |

## 每日金币 · 既有交付与证据

日期：2026-09-23。范围仅为七日签到、每日任务、每周宝箱；不替代其他模块现有计划。

当前交付：2026-09-23用户授权“行，做云端吧”后，第5步云端接入与develop真实SDK验证已完成。既有环境4集合/4索引、清理开关、回退版本2及battle修复版部署（20:50:56）均已确认。真实SDK暴露的_id回写P1已修复，受影响回归与独立QA通过；签到100金币、任务160金币、丢回复/ACK断线及重启去重验证通过，任务[1,2,80]、活跃100、队列与待ACK清空。测试账号最终余额1390，其中额外130来自正常核心首通结算；验证脚本首轮动画等待错误已明确排除正常对局证据。旧daily读取和两类v2房间create/query/leave通过。临时game.js已恢复并编译，正常首页确认。详见 `docs/release/retention-activation.md`。仍只develop启用，trial/release隐藏；手机/双账号完整PvP、自然网络与真实跨日周、定时清理日志及隐私增量发布确认仍待后续验收，未发布客户端。原布局、深色标题与300/500/1000宝箱奖励不变。

当前责任与接口：本任务维护 `docs/contracts/retention-v1.md`、客户端适配/Main/界面与端到端整合，并执行已授权云部署；retention_wallet仅负责coin及故障测试，retention_server仅负责云服务/云路由/服务端测试，retention_logic_qa独立只读审阅，二者已完成本次SDK字段P1修复与复核。沿用role-collaboration的有界并行授权。工具提供的Sol路由为gpt-5.6-sol medium（所述gpt-6-sol不在可选列表），未改变主任务模型。无新用户任务、无提交/推送；云端实际变更以上方部署记录为准。独立QA已接受develop云候选证据，不代表真机或发布验收。

## 当前候选证据（第3/4步）

- 实现：`js/platform/retention-client.js`的持久请求/收据与Main真实玩法事件；`js/core/coin.js`的金币＋锤子单次入账；`cloudfunctions/battle/retention.js`及云路由的身份、事务、北京时间、签到/任务/宝箱与上周保留；路径均相对match3-wechat。合同在 `docs/contracts/retention-v1.md`。
- 核心有效检查：`retention-wallet.js`逐写入前/后故障及旧钱包兼容；`retention-client.js`丢回复/丢ACK/存储恢复/复活；`retention-cloud.js`并发、跨日周、身份、真实daily重演、PvP证明、损坏状态失败关闭、清理；`retention-integration.js`真实Main+核心两局、旧关不重发通关奖励、七次签到锤子、上周三档及离线过期，均通过。
- 受影响回归：coin/coin-receipts、commercialization、daily-progress、stamina-purchase、solo-economy；daily-client/daily-cloud/daily-core、battle-client/battle-cloud-function/battle-rematch/battle-logic、ui-smoke及retention-preview通过。使用各自相关输入后的证据，未把源检查充作微信证据。
- 独立QA：retention_logic_qa不参与实现，结论无开放P1/P2。其发现的已同步假待同步、存储失败假成功、daily缺任务反馈、开局短暂存储失败漏事件、损坏周日期静默清零均已修正；独立复现转为 `test/retention-qa-client.js`、`retention-qa-routes.js`、`retention-qa-recovery.js`，相对路径运行通过。实测云入口create/join/query/rematch/leave、双方加入候选、旧房隔离、主动退出排除、旧ACK清理后恢复及他人收据拒绝。
- 实际Canvas功能检查：`node tools/preview-retention.cjs --functional --check`在320×568、390×844通过。运行实际Main/GameCore/客户端/内存服务/钱包；2460→签到2560→两局2720，任务[1,2,80]、活跃100，旧关无首次通关收据；验证准确日期/周截止、离线与重试、换日刷新、关闭回首页。截图为 `assets/_incoming/retention-daily-coins-v1/screens/functional-*.png`，320任务首屏另有tasks-top图。工具阶段修正了下折叠区按钮定位、首局可能完成两项任务的断言和重绘等待，失败均非零退出；最终检查通过。主任务实看签到390、任务390/320首尾、结果320、离线390，控件与标题清楚；非微信环境。
- 当前交付预览：`http://127.0.0.1:62747/`，本机session1670，`--functional`模式。CUA复用页签1并点击首页入口，实际深色标题/签到页已显示。页面明示本地内存服务和临时钱包，未接真实云；旧样板服务34340/82390已关闭。保留此本机进程供用户检查。
- 额外恢复边界：仅已ACK收据35天后清理；丢ACK回复后长时间离线，已清理ID的确认重试为无副作用成功。未ACK收据保留。支持后台/前台往返；不新增进程完全结束后重建未完成solo/PvP能力，已结算草稿/待提交/已确认收据可重启恢复。
- 隐私增量：随包正文及 `docs/release/privacy-policy-review.md` 同步至2026-09-23.2，新增每日金币数据与期限；本增量尚待运营方确认，approvedForRelease=false，privacy-reader通过。原2026-09-23.1确认保留为历史。
- 包体：3,784,522 / 4,194,304字节（67文件）；素材2,904,881字节，未新增位图、SDK或字体；微信实际包体另验。受影响运行脚本语法、工具语法与diff空白检查通过。
- 部署准备：`docs/release/retention-activation.md`列明原环境cloud1-d9g4pv8m8457af92a的battle候选、4个仅服务端集合、索引、`RETENTION_CLEANUP_ENABLED=1`环境变量及保留未ACK记录的回退方案。定时器原配置不变。该条为本地候选准备证据；其后的实际云变更及剩余平台验收以上方当前交付与激活说明为准。
- 记忆：本轮新wallet/retention approved检索为空；审查代理写入的combined-reward-wal候选与实际代码/故障矩阵一致，保持candidate，未将单项目经验提升为通用规则；其余结果已充分记录在本项目，不重复写状态记忆。

以下为已确认开发顺序及第2步历史证据。

| 顺序 | 目标/主要交付 | 责任与前置输入 | 验收证据/用户门槛 | 后续 |
| --- | --- | --- | --- | --- |
| 1 | 确认PRD、页面状态及开发顺序 | 当前任务整理；用户决定产品范围，依据retention-v1 | 用户确认规则、奖励、边界与本表；不以沉默为确认 | 做样板 |
| 2 | 可运行福利弹窗样板及完整状态 | 现有UI所有者；复用已接受主题、素材和组件，不新建角色；仅清楚标注的预览数据 | 先确认一个签到样板，再扩展任务/周宝箱/异常状态；运行截图、小屏与安全区验证、独立QA，用户接受完整增量界面 | 接入真实进度 |
| 3 | 签到/任务/周进度与奖励恢复的本地垂直链路 | 现有玩法/资产所有者；已确认规则，先核对事件和组合入账能力 | 换日、换周、去重、组合奖励存储失败恢复、旧档兼容；使用隔离测试数据，不向正式钱包假发云奖励 | 云服务候选 |
| 4 | 云身份/资格/收据与客户端接入候选 | 现有服务端所有者；服务端时间、事件来源和有限可信合同已确认 | 仅服务端权限、幂等与过期策略、失败可恢复、隐私/清理期限定案、独立审阅；准备具体部署与回退清单 | 请求具体部署授权 |
| 5 | 获授权后部署与平台验收 | 用户授权具体环境/函数/集合/账号验证；复用现有发布所有者 | 微信开发者工具真实云验证、真机触控/弱网/恢复、现有玩法回归、包体核对；实际结果记录，不等同自动发布 | 提交发布审阅 |
| 6 | 经授权发布并观察留存 | 用户发布决定；隐私/上报开关/运营配置确认，发布候选可追溯 | 独立QA验收；按PRD分析定义记录D1/D7及经济指标；无足够数据时明确未验证效果 | 数据支持的后续调优 |

不承诺未评估的工期。本轮按用户开始推进授权及role-collaboration约定，使用两名Sol medium执行代理分别承担隔离预览工具和独立只读QA；未改变既有角色归属、未新建或迁移用户任务。实现与审阅职责分开，独立QA按既有所有权约定安排；每阶段只重复相关输入变化或失败项所需的检查。

此前规划验证：奖励算术及PRD/顺序/状态一致性检查通过；当时无运行代码变化。当前样板证据见下节，不将后续真实奖励的计划测试写成已完成。

## 已接受样板（第2步历史） · 2026-09-23

- 责任：当前任务负责还原与Main集成；retention_preview_harness仅持有本地预览工具，retention_ui_qa只读审查，不参与实现。均按工具显式选择Sol medium用于常规预览/QA，未切换主任务模型。
- 输入：已接受概念`assets/_incoming/retention-daily-coins-v1/daily-coins-concept-v1.png`。沿用现有dailyInvitation、金币、猫咪和道具图；卡片/宝箱/文字/按钮原生Canvas绘制，没有新位图或整图假交互。原概念睡猫改用已有猫咪姿态，宝箱用原生珍珠配色控件，属于实际可编辑还原而非逐像素贴图。
- 文件：`match3-wechat/js/render/retention-ui.js`、`js/platform/retention-preview.js`、`js/main.js`、`js/render/ui.js`、`test/retention-preview.js`（后四个相对match3-wechat/）；`tools/preview-retention.cjs`。基线HEAD `30e9088`加本轮工作区，无客户端构建步骤；未提交/推送，未改独立promo-duel。
- 能力：首页辅助入口、双页签、七天卡片、第7天奖励、任务进度、周宝箱各档、上周待领、规则、加载/离线/错误/待同步、临时领奖反馈、关闭与返回；小屏内部滚动，固定页签/关闭/规则区。触摸抬起才确认，拖动/取消/后台不误领；完全可见的控件才注册领奖热区。
- 有效自动证据：4个受影响运行脚本语法通过；ui-smoke 28项、daily-client通过；retention-preview专测覆盖渠道隐藏、临时领奖去重、Main触摸/拖动/后台取消、44px/安全边界/控件不交叠、规则返回、重试清offset；所有断言失败均非零退出。后续仅重跑变化所影响项。
- 真实Canvas浏览器证据：preview-retention --check三档320×568、390×844、430×932通过，签到/任务、短屏滚动、领取、离线重试和关闭；临时钱包始终2460，cloudAttempts=0。截图在`assets/_incoming/retention-daily-coins-v1/screens/`。是正式Main/Canvas触摸链路配本地wx夹具，不是微信真实云或手机实测。
- 本机CUA实看：390加载、待同步及规则页；点击待同步页X回首页，再打开规则页可见。状态栏仍为临时钱包2460、云请求0。没有打开微信CLI端口或上传客户端。
- 修正记录：首轮内容被下边框花饰干扰，增加安静内容底并收紧卡片；长屏减少底部空白，短屏保留滚动。独立QA指出规则X语义、窄屏角标越界、重试残留offset，均已针对修正并补受影响断言。短屏异常状态进一步收紧留白，重试按钮首屏可见；上周待领用实际Main点击验证不增加本周活跃度。
- 包体：最新静态主包3,757,955 / 4,194,304字节，活跃素材2,904,881字节不变；微信实际包体另验。未提高预算，未忽略活跃素材。
- 待验收：本次可运行样板的用户视觉确认；完整微信/真机触控和真实领奖/任务计数/跨日/服务故障恢复尚未实施或验证。后续真实奖励接入不使用本轮临时model作完成证据；云端及发布需到动作就绪时单独授权。

- 记忆：复用本任务项目match3-game approved空检索，本轮补module-ui-production相关检索亦无结果；权威事实维护于本记录，不另写重复状态候选。

- 最终增量证据：`preview-retention --check --width=320 --scenario=states`通过，loading/offline/error/pending首屏动作完整；`--scenario=previous`通过，上周领取后本周活跃度180不变、临时钱包2460、cloudAttempts=0；规则首尾、第7天领奖前/反馈/已领截图已补齐。非受影响390/430正常页复用三档检查。
- 最终独立QA：retention_ui_qa只读复核源码/专测与状态截图，结论无开放P1/P2；Main previous2已走实际tap断言。最终仅将异常提示改为面向玩家的清晰文案，并刷新states截图/测试通过，布局与交互不变。无微信/真机/真实服务证据。
- 当时样板预览：`http://127.0.0.1:56722`、session34340，后续已关闭，当前入口见上方候选证据。微信CLI服务端口未开启；本地浏览器夹具不上传文件、不接真实云。
<!-- memory-adoption-20261001:start -->
## 共享记忆采用 · 2026-10-01-v2

### 共享记忆指定主题审阅 · 2026-10-02

- 授权/责任：维护会话传达用户批准，要求现有三消主负责人审阅指定9主题及2份合并支持来源；不是全局角色任命或批量批准。保留独立QA/用户视觉/平台发布门槛；本次仅审阅、原任务记录及append-only记忆写入，不改游戏代码/资产/构建/云端/凭据/角色/模型，不发布/提交Git或自动向别的会话发消息。
- 路由/召回：已完整读取当前技能、hindsight-local、governance、record-contract及项目入口，activation为Hindsight已启用、Basic Memory已退役；原文根`/Users/Admin/.hindsight/source-memory`。解析实际仓库及“三消-主”得到canonical match3-game、module null/role unresolved，未推断旧标签为模块职责。approved bank `project-caa3c7c20278362b-approved`的严格approved/active/scope-project/project-match3-game、world/experience召回为`hit`（仅`match3-game-combined-reward-wal-r1`，与本批无关，未采用）；未做模块或候选规则召回。
- 原文核对：`audit --project match3-game --limit 9`确认9份草案及11主/支持源仍匹配（stale_sources为空），本批均无既有回执。逐条读原文和支持源，不上传旧原文/整段会话到模型，不用草案代替审批。旧v5数值/策略、第1关永久不变、首对相邻猜组合、统一specialCombo及2×2布局不作为当前规则；现行产品记录优先。本轮candidate none，是既有候选审阅而非历史批量抽取。
- 回执目录为source_root下`reviews/match3-game/`；项目目标为`projects/match3-game/`、revision 1、module=null。源ID保留各主题原legacy permalink；批准的只是有界方法/偏好，不放行完整产品、数值或设备版本。

| 指定主题 | 结论与边界 | 回执 / 项目目标 |
| --- | --- | --- |
| audio-runtime-feedback | `accepted`：用户已否决统一组合cue；当前AudioFX按参与类别去重播放真实特殊音色，旧101–104同时、新105/106按共用事件时序延迟。分享入口仅在非对局且新包已下载时应用更新。现行音频合同、既有独立复核与运行/测试证据支持该边界，旧采样、预算、额度不晋升。 | `match3-game-audio-feedback-review-20261002` / `match3-game-audio-feedback-r1` |
| difficulty-proxy-calibration | `accepted`：批准固定种子对照、变化范围独立revision及代理边界，而非旧v5数值/旧随机策略。现版已修正独立随机流、思考＋生产动画计时，并有真实指针逐步回放与非实现者复核；最新五类障碍曲线仍待审/标定，不被这条经验批准。 | `match3-game-difficulty-proxy-review-20261002` / `match3-game-difficulty-proxy-r1` |
| low-maintenance-retention | `accepted`：原文记录用户明确不希望持续周末主题更新带来高制作负担；后续项目采用固定任务与四猫成长的独立范围。仅保留本项目低持续维护的规划偏好，不把当时讨论当成长/经济/美术实施授权，也不否定已另获批准的后续功能。 | `match3-game-low-maintenance-review-20261002` / `match3-game-low-maintenance-r1` |
| small-screen-shop-and-cta | `accepted`：当前drawShop确为四行珍珠面板，rowH78、图标48、动作高44；UI记录明确用户否决2×2后接受清单。现有三宽截图与受影响检查支持本地布局，广告有/无CTA适配有效；不批准旧网格或真实广告配置。 | `match3-game-shop-list-cta-review-20261002` / `match3-game-shop-list-cta-r1` |
| request-settle-once | `accepted`：现行cloud-battle adapter的settled门与定时器清理未改；Main每日info/start/checkpoint/submit显式12000ms，daily-client真实消费者/伪SDK迟到用例及step1_qa接受记录支持客户端只结算一次。PvP已有独立超时合同，不能沿用候选‘永久未改PvP’为当前事实。 | `match3-game-request-settle-once-review-20261002` / `match3-game-request-settle-once-r1` |
| special-piece-comprehensibility | `accepted`：用户明确要求新棋子在分数/收集/障碍关都有可理解价值，否决2×2再接第五只的复杂配方。当前记录已移除该配方且强调玩法/视觉/音色分开接受；只保留产品偏好，Z形配方和新棋子具体平衡仍不在本次批准范围。 | `match3-game-special-comprehensibility-review-20261002` / `match3-game-special-comprehensibility-r1` |
| isolated-functional-preview | `accepted`：真实Main/客户端/钱包/Core/后端createService配每页内存数据库的隔离结构仍存在；既有功能运行与retention_logic_qa证据支持预览方法。当前手动领取已替代旧自动任务到账，旧钱包轨迹只作历史；本次不为尚待复核的产品链路放行。 | `match3-game-functional-preview-review-20261002` / `match3-game-functional-preview-r1` |
| vfx-follow-event-footprint | `accepted`：批准表现遵循核心真实作用范围/源事件的原则，不批准旧首对相邻启发式。现行Core已发specialCombo元数据，renderer以该信息识别旧组合，邻接chain无该元数据不扩大范围；Board正常/减弱时序、既有非实现者32组复核和用户接受的表现提供边界证据。 | `match3-game-vfx-event-footprint-review-20261002` / `match3-game-vfx-event-footprint-r1` |
| asset-highlight-local-repair | `needs-evidence`：README与UI当前记录仍明确待用户确认棋盘上的五只猫柔光结果；技术检查和三宽Canvas截图支持局部加工范围，但没有明确用户视觉采用记录，亦未见本轮独立美术复核闭环。保留待证据，不晋升；其他特殊棋子或图鉴接受不能代替此项。 | `match3-game-highlight-local-repair-review-20261002` / 无目标，缺用户视觉确认及必要独立复核 |

- 合并支持源单独处置：`shared-memory/inbox/match3-game/audio/match3-game-audio-20260910-v9-final-accepted` → `not-adopted`（回执`match3-game-audio-v9-old-support-review-20261002`）：当时选择仅为历史，旧统一组合cue/火箭/22cue预算已被替代；已核实的BGM只作主主题支持，不续期额度。`shared-memory/inbox/match3-game/general/match3-game-general-20260921-stamina-ui-polish` → `not-adopted`（回执`match3-game-shop-grid-old-support-review-20261002`）：2×2已被否决；仅有/无广告CTA和隔离尺寸证据作为清单主题支持。两源不重写，目标列明supporting_sources/supporting_reviews，不伪作accepted。
- 证据：timeout现行adapter/tests未改，复用daily-client及step1_qa迟到/凭证隔离接受；商店现行UI未改，复用三宽/ui-smoke/stamina-purchase本地证据及用户接受。音频/渲染/难度已有新工作树，核最新audio-runtime-v9、content-update-1235的局部检查/真实运行/非实现者复核，不把9月旧整套测试当当前全包PASS。functional工具仍使用真实消费者与每页内存后端，手动领取已替代旧自动到账；方法接受不替代手动领取待复核/真机状态。高光记录仍待用户确认，其他造型/图鉴接受不能代替。本轮未为记忆重复构建或游戏测试。
- 持久化/回读：19条精确参数v2校验通过，隐私/权限由现有项目主负责人逐条审核；经动作时沙箱审批，非覆盖write-record已追加11回执及8项目目标（无覆盖、无模型创作或历史批量归纳）。11回执archive原文与8目标approved原文均按后端实际document_id回读，正文逐字匹配计划；memory_id/record_kind/project_id、处置、目标及review_reference逐项一致。不是把queued/submitted当已批准：这8条是完成原门禁后的项目批准，未另capture/extract新候选。
- 最终audit：本项目累计approved_project=10、approved_module=0、review_receipts=15；指定批次及支持来源unreviewed=0、needs_evidence=1，无陈旧草案、冲突、accepted缺目标、孤立批准或无效记录。高光仍不晋升，保留现有三宽候选和修前备份等待本项视觉确认及必要独立复核，不重新生成、不索取技术门槛豁免。以上方法卡已索引可召回，但未声称本次有新产品运行效果或跨项目验证；原产品/视觉/发布待验项不变。本次记录差异/格式检查通过，无Git提交/推送。

### 首批三条审阅历史 · 2026-10-01

- 主任务已收到用户授权的一次性通知，完成此批三条候选审阅；只采用 v2 治理和有边界的项目知识，不批准全部历史经验或跨项目规则。保留“三消-主”及独立QA归属。本轮没有游戏代码、云端、发布、角色或模型变更，没有委派、提交或推送。
- 身份/召回：已读取 v2 技能、记录合同、治理及本项目入口，`resolve --root <实际仓库> --role 三消-主` 返回 `project_id=match3-game`、`module_id=null`、`role_unresolved=true`，按项目检索，不推断旧 battle 标签为模块职责。`sanxiao` 为同项目别名。结构化 `approved + project-match3-game` 首轮召回为 `empty`，审阅前回执检索亦为空；无旧 approved 知识应用于此次游戏实现。
- 首批审阅结果（保留旧候选，不覆盖；回执目录均为 `shared-memory/reviews/match3-game/`）：
  - `shared-memory/inbox/match3-game/general/match3-game-wallet-20260923-combined-reward-wal` → `accepted`。当前 `js/core/coin.js`、`test/retention-wallet.js` 与既有写前/写后故障矩阵及 retention_logic_qa 非实现者接受记录吻合；相关源码无未提交差异。回执 `match3-game-wallet-review-20261001`，项目目标 `shared-memory/projects/match3-game/match3-game-combined-reward-wal` revision 1。仅覆盖同步本地存储的金币+hammer共享收据恢复，不包含云端ACK/outbox、清档、并发或跨设备保证。
  - `shared-memory/inbox/match3-game/battle/match3-game-battle-20260925-transaction-poll-contention` → `accepted`（纠正历史边界后有界提炼）。当前 `match3-wechat/cloudfunctions/battle/index.js` 的 query 只在心跳到期/首次结算/旧结算修复时写房间；已完整结算的 finished 不每秒重写，但保留到期续局心跳和既有留存幂等捕获。与 `test/battle-query-transaction.js` 及 [对战检查记录](../docs/release/pvp-dual-account-checklist.md) 中 battle_qa 指出问题后修复、复验和独立复核闭环一致；相关源码无未提交差异。回执 `match3-game-battle-poll-review-20261001`，项目目标 `shared-memory/projects/match3-game/match3-game-room-poll-write-gating` revision 1。不沿用候选“finished持续写入”的旧断言，不把3秒/10秒外推为通用参数或正式版故障根因。
  - `shared-memory/inbox/sanxiao/general/sanxiao-catalog-20260928-source-driven-silhouettes` → `not-adopted`。用户已接受灰底、猫咪局部模糊，当前 catalog-ui/assets/catalog-locked-art 与 [视觉记录](ui-production.md) 一致；旧黑色 PNG 只作 alpha 遮罩，已迁入 catalog 子包。候选的黑色展示/主包路径已过时，不晋升为当前规则。回执 `match3-game-catalog-silhouette-review-20261001`，无 approved 目标；源图遮罩方法仅留历史参考，本地预览不证明微信/真机接受。
- 实际采用/检查：治理流程已用于上述三条“核现行源码与既有独立QA → 有界决定 → 精确计划写入参数校验 → MCP追加回执/项目目标 → 回读关联检查”。五条参数预检均通过、`overwrite=false`，三回执与两目标已实际写入并回读确认。只复用相关既有通过证据，未为记忆审阅重复跑游戏测试；新批准方法卡尚未宣称有新的运行时应用效果。写后 audit：项目 approved 2、模块 approved 0、回执 3；无冲突、孤立批准、accepted 缺目标或无效记录。余14条候选不在本批授权内，不一并批准。
- 首次正常交接的采用行为已得到以上实际记录，结束一次性跟踪，不新增调度/监控。后续交接仍注明候选 ID 或 `none`，仅本项目主任务晋升；跨项目模块晋升仍须两个不同真实项目及用户对具体做法的明确批准。此次局部记忆接受不解除手动领奖、整体留存、微信/真机或其他尚未完成的独立QA与发布门槛。
<!-- memory-adoption-20261001:end -->
