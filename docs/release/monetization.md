# 商业化接入清单

<a id="wechat-official-analytics-20261020"></a>

## 微信官方分析 · 普通关卡基础收数已验证，待剩余上线准备项 · 2026-10-25

- 最新验收：用户明确确认这四条第16关记录来自微信后台“关卡事件测试页”，据此确认失败2、重试3、进入5已由后台收录，三类基础收数验证通过，不再索要这些记录或要求重测。结合此前后台成功1/levelProgress100/levelTime49和进入5记录，普通关卡进入、成功、失败、重试基础收数已接通。证据为用户从官方测试页反馈，非代理直接访问；不同时间/关卡记录不组合成同一局漏斗，粘贴顺序不作为严格时序或去重次数证明，也不推广为正式日表、复活4或启动系统7验收。debug差异因果仍未证实，不继续为即时空列表更改埋点。
- 当前下一步：本地配置、隐私确认、受影响测试、独立复核、编译与普通关卡基础收数已完成；仅请用户补充后台隐私2026-10-23.1同步状态、启动分析系统7可见情况，现有记录可直接核对，不要求新预览。正式日表需未来获批发布后另核，其他并行模块仍不由本任务放行。用户“暂不发布”的限制保持，不请求或执行正式上传/提审/发布。源码与配置未改，复用有效检查，候选none。

### 本轮诊断过程与证据（来源疑问已由上方最新验收解除）

- 来源确认前：用户提供第16关（月夜花园 · 16）、levelAction=1的四条字段记录：失败2、进入5/loginCount2、进入5/loginCount3、重试3。字段与三类动作匹配；无时间和stage，不按粘贴顺序认定实际为2→5→5→3或重复上报。随后用户明确这些来自官方后台测试页，已据此确认三类收数，不再补问来源或重测。是否同一次重试周期及严格次数仍不从这四条静态摘录扩大推断。
- 最新后台反馈：用户表示已能看到当天10:38的测试记录，认为页面可能延迟显示、无法实时刷新。这确认后台存在测试记录，但未给出该条关卡/动作/测试包对应关系；10:38早于本次12:25左右生成的诊断预览，不能配对成最新进入5已入库。停止以即时空列表判定漏报，不把debug差异认定为原因，也不承诺固定刷新延迟。当前开发版进入5的SDK成功已证实，较新记录待自然刷新后核对；无需重测进入或重新生成预览。下一步可在同一开发版正常失败后点击重试，先核对同关卡2→3→5的SDK成功回调，后台记录稍后对照。仍未发布，后台隐私同步及启动系统7等剩余项不由此放行。
- 最新真机证据：用户提供本次诊断预览的原生MiniReportManager.report日志及[level-analytics] sdk_success，eventID=10000003、environment=develop、debug=true、levelID=16、levelName=月夜花园 · 16、levelAction=1、levelResult=5、loginCount=4。本次进入事件的字段与成功回调符合预期，loginCount是本机接入后的累计次数，不是新增用户数；进入事件无levelTime符合协议。回调函数和__origin_*为SDK日志包装，不是新增业务字段。不再索要同一事件attempt或重新扫码；SDK成功不冒充后台测试页收录或正式汇总。最新进入事件的后台对应关系仍待自然刷新核对；后续失败/重试验证可先核对手机SDK回调，不再将后台即时可见作为操作前提。源码未再改，复用有效检查，候选none。
- 最新反馈：用户运行10月25日预览后，关卡事件“测试”页没有记录；不能据此判断接口未调用、SDK失败或正式数据未收录。该预览使用正式候选debug=false，而10月20日已收到进入5/成功1的测试包为debug=true，模式差异是待验证假设，不是已证实根因。先前直接要求用正式配置预览核对测试页，证据口径不足，暂停重复手机测试。
- 本轮交付：仅修改LEVEL配置、level-analytics适配器及其现有测试。LEVEL保留enabled=true/testOnly=false/debug=false，新增debugInTest=true；只有明确develop/trial才启用manager调试与本地[level-analytics]固定字段日志，release/未知/取环境失败均debug=false且正常上报门控不变。ready只代表诊断适配器就绪；attempt代表调用尝试，sdk_success只由成功回调产生，sdk_failed由失败回调/抛错/拒绝产生。日志不含玩家标识、关卡名称、原始异常或回执内容，不增加远端字段或自动重试。未改首页、启动、隐私、玩法、Main或其他任务的文件。
- 本轮有效验证：level_adapter完成level-analytics、level-analytics-main和三文件语法检查；独立level_analytics_review以额外探针核查实际环境矩阵、payload不扩展、console/错误getter异常与回调/Promise冲突隔离，无发现。主会话核读增量，focused diff检查通过。源码改变后重新核对包体：静态主包3,366,638/4,194,304字节，总包8,410,225/31,457,280字节，预算通过；包含其他域并行素材，不全部归因于统计增量。复用未变的隐私及其他统计证据。
- 原生运行：Stable2.02.2608040、基础库3.16.2，核对本项目目录/AppID后通过工具菜单明确“编译”项执行本地编译，无预览上传。首轮出现工具app.asar堆栈worker path empty，首页仍显示；源范围未发现createWorker/worker调用，未修改游戏来掩盖。待文件稳定后复编译，12:24:19新启动记录，首页完整，Errors0/Warnings1（HarmonyOS提示），该错误未复现。模拟器入口点击未成功导航，未声称关卡原生事件或手机链路已经通过；后续仍以诊断预览的手机回调和后台记录核对。
- 文档限制：Context7未匹配getMiniReportManager参数说明，搜索未取得适用官方结果；官方公开文档页随后被浏览器site-safety明确阻止，不经其他浏览器、CLI或间接方法重试。debug与测试页关系仍未得到当前官方说明验证。后台mp.weixin.qq.com的既有访问限制同样保留。
- 本次授权：用户明确选择“生成一次诊断预览”，仅本次一份match3-wechat当前客户端代码/游戏素材传至本项目微信预览服务，不导出玩家存档/日志，不正式上传版本、提审、发布或云部署。核对目录/AppID、登录状态及诊断开关后，只点击一次预览；上传成功，工具最终显示代码包7857KB、新二维码10月25日12:55失效，构建日志“上传完成，耗时10312ms”。本次一份预览授权已使用，不重复生成。产品源码未再改，复用上一轮有效测试、独立复核、包体和原生编译证据。已请用户扫码进入一条普通单人关卡，先复制[level-analytics]的进入5 attempt及sdk_success/sdk_failed（或ready/api_unavailable/init_failed/无日志），无需通关/重试；确认后再补失败路径。不承诺debug差异必然解决测试页空记录。共享记忆复用同任务批准召回，无新采用，候选none。

### 此前正式配置与预览证据

- 10月25日上线准备：用户要求开始准备上线并继续，提供线上版本“应该是2.0.0”；仅作为未核实输入，下一版草稿暂拟2.0.1，未改代码版本或声称已发布。已在ad-measurement-plan.md原章节补齐上传备注/玩家说明、已确认隐私正文引用、最小补验表、整包并行变更边界与正式取数/回退步骤。隐私是否已同步后台的问题尚未得到回答，保留未确认。
- 当前候选包检查：为新一轮待传输候选复核现有package-budget，主包静态估算3,359,285字节/4MiB、总包8,224,860字节/30MiB，共134文件，启动21key/20请求，素材/分包/精确忽略规则通过；当前包含其他域并行改动，不将这项检查当整包功能放行。统计/隐私相关有效测试、独立复核及24日本地原生编译证据继续复用，未改产品代码、配置、资产、测试、云端或其他owner归属。
- 本次预览授权与执行：用户明确授权本次仅一份match3-wechat候选代码/游戏素材传至本项目微信预览服务，不导出玩家存档/日志，不正式上传版本、提审或发布。此前未登录阻碍已在用户回复“已登陆”后解除；核对正确目录/AppID及登录状态后，只执行一次工具栏预览。工具显示“上传代码完成”、代码包7678KB（提示7.5MB）、二维码10月25日00:41失效，构建日志显示上传完成8279ms。本次授权的一份预览已完成，不重复生成；未正式上传版本、提审、发布或云部署。后台网页先前受限，不重试受限访问；本轮公开官方文档刷新工具返回不可打开/空结果，复用已有官方核查，未声称完成新的平台政策确认。
- 当前补验交接：已请用户用最新预览正常进行同一普通关卡失败→重试→再次进入，在关卡测试页提供levelResult 2、3、5的完整记录；启动系统7若可查则一并反馈，暂不可查记待收数，不要求反复重测。已有首页四项和关卡进入/成功证据不重做。新预览成功仅证明测试包生成传输，不代表剩余原生收数、后台隐私或正式版本验收通过。产品源码未在本轮再改，复用刚完成的当前包体与原生编译/相关测试证据；候选none。

- 本轮授权与范围：用户在了解正式版统计仍受testOnly限制后要求“做正式上线准备”。准备首页、关卡、启动三项原生分析的正式配置与隐私增量，关闭分析调试输出，保留通用事件/监控和四过程远端映射关闭。不执行正式上传、提审、发布、后台声明变更、投放或其他模块上线；原先测试候选的证据和未验证项按下文保留。
- 新增明确决定：2026年10月23日用户确认2026-10-23.1正式版隐私增量，已手动解锁Mac，要求继续本地编译和上线前检查、暂不发布。本轮仅将本地approvedForRelease置true并同步确认稿状态，正文版本和已审核内容不再变更；重跑先前隐私门禁及必要受影响检查，其他有效证据复用。
- 当前交付：config的LEVEL/HOME/STARTUP均enabled=true、testOnly=false，LEVEL/HOME debug=false；真实release允许原生上报，开发/体验运行也不再输出home诊断。通用REPORTING及四过程远端MILESTONE继续关闭/空映射。未改事件触发、门控、SDK字段或导航，不把此前加日志后的正常手机结果描述为根因修复。
- 隐私与操作稿：本地正文及镜像为已确认的2026-10-23.1，三项用途正式启用并明确已实现的关卡目标进度，其他披露保留。用户10月23日明确确认后approvedForRelease已置true，正文内容和版本未再改；不再索要同一确认。发布前仍需同步微信后台官方指引（运行优先打开官方指引），本任务未操作后台。正式取数路径、回退方式和剩余验收见ad-measurement-plan.md顶部。
- 本轮有效检查：level_adapter完成三adapter测试，实际release原生协议、debug关闭、系统7单次及未开放指标零远端通过，保留testOnly fixture回退/失败/去重。主会话home-main/level-main/activation-main及预算证据复用。用户确认后重跑release-gates通过（原失败仅隐私待确认，现已解除）、privacy-reader16节三视口/镜像一致通过，变更脚本语法与focused diff通过。最近静态主包3,359,291字节、总包8,224,866字节，含其他域并行素材变更，不作为正式打包产物；不把脚本门禁通过等同整体上线放行。
- 独立复核：level_analytics_review（沿用既有Sol medium有界路线）独立隔离探针确认真实release配置可调用三官方接口、home零trace、关卡manager debug=false、关闭项零远端；隐私字段/镜像/待确认门禁与清单一致，无发现。没有真实网络/UI/后台验收，不覆盖系统7、失败/重试/复活原生缺口和正式日表。主会话仅维护config/privacy/consumer检查和当前记录，不改既有owner归属。
- 原生操作证据（10月24日续做）：通过项目菜单切换至实际match3-wechat，未改另一个项目。工具Stable2.02.2608040仍保留10月22日预览面板；选择工具→编译后观察到二维码预览上传，尝试取消时已生成7678KB测试码（10月24日12:59到期）。如实记录这次微信预览服务代码传输，未执行正式版本上传/提审/发布，未将预览包当正式包。画面显示首页及0错误/1警告计数，但尚未核读本轮运行日志。关闭预览面板后再次选择纯编译时，CUA报告Mac重新锁屏，操作未完成；已请用户手动解锁，不索取密码或绕过锁屏。
- 本轮原生编译验收：用户明确“你操作实施”后，核对实际项目目录/AppID并通过新AX状态确认工具菜单中“编译”“预览”“上传”为独立菜单项；执行明确标注的“编译”。Stable2.02.2608040/基础库3.16.2控制台启动提示更新为2026年10月24日23:12:26（上海），随后截图确认首页完整正常，默认日志级别Errors=0/Warnings=1，唯一警告为微信基础库HarmonyOS兼容提示，未出现新的二维码预览上传面板。本次完成本地编译和启动检查，未生成新预览、正式上传、提审或发布。前轮坐标点击拒绝和旧预览上传事实保留，不再要求用户手动编译。
- 配置核对边界：候选源码只读加载确认LEVEL/HOME/STARTUP enabled=true、testOnly=false，LEVEL/HOME debug=false，REPORTING/MILESTONE远端关闭，隐私2026-10-23.1 approvedForRelease=true。原生启动日志无home诊断；附加控制台模块读取尝试未返回可见结果，不能当作已加载模块字段探针通过，也不用于替代既有源码测试。未改变产品代码、配置、测试或其他owner文件；复用既有通过的相关测试和独立复核。
- 剩余范围：系统7及关卡2→3→5/需要时4的手机后台证据、后台隐私同步和正式日表仍单列未验；这些不由本地编译通过代替。首页四类客户端提交及关卡进入/成功基础收数的既有证据有效。当前本地检查交付完成，仍暂不发布；候选none，本轮没有新的可推广方法卡。

### 历史测试与排查证据 · 2026-10-20至22日

以下旧testOnly范围和未发布描述为当时状态；当前本地候选配置以上述2026-10-23交付为准，线上版本没有由本任务改变。

- 最新验收：用户iPhone（截图基础库3.17.5）已提供四类完整submitted：solo/BCBgAAoXHx5d0hJfR8jiP3/type1、type2，pvp/BCBgAAoXHx5d0hJfR8jiP0/type1、type2，均environment=develop；单人另有type2的attempt以及drawn/available均true、其余阻挡项false的click_seen。确认实际手机两入口曝光/点击字段正确并执行微信接口调用后返回，达到本轮客户端逐项核对范围；用户复制顺序不用于推断真实时序，不据此证明精确次数、全路径无漏记或微信后台最终收录。新候选只加诊断，未改原点击条件，此前“只有type1”的原因仍未确证，不宣称修复。无需继续重复这四项手机测试，正式汇总待日后单独授权上线后验证，继续暂不发布。
- 本轮测试包证据：新增click_seen诊断的开发预览成功，原生工具显示8009KB、10月22日23:48到期、上传完成；沿用该预览取得上述手机反馈。仅向微信预览服务传输测试包，未执行正式版本上传/审核/发布。HOME_ANALYTICS_CONFIG保持enabled=true/testOnly=true/debug=true，正式环境仍禁用候选。只读独立复核、两份受影响测试、语法/diff和静态包体证据见下方，本轮候选none。

- 本轮定位：当前Main在导航前调用reportHomeClick，未证实顺序错误。独立只读探针复现（a）阻挡帧将homeEntryDrawn置false，阻挡解除后新绘制前点击仍导航但漏type2；（b）handleHide/Show后新绘制前PvP输入同样被绘制标志拦；（c）曝光若晚拒绝会在submitted后记failed并撤销点击资格。三者是隔离可复现路径，不能当作iPhone根因。原生模拟器坐标触摸未触发导航，未将它算点击验证。
- 新诊断候选：Main实际入口触摸添加click_seen及11个固定布尔gate，adapter未取得曝光资格时记click_no_exposure，branch/eventType提前显示；不改变上报门禁、导航、远端payload或重试策略。home-analytics/home-analytics-main、脚本语法、focused diff、包体预算通过（静态主包3,696,939字节，总包8,562,514字节，含并行其他域变更）。新测试刻画上述两个Main窗口，独立level_analytics_review验证诊断不增加远端调用、不泄露玩家或原始错误、正式/未知环境静默、console异常隔离，无发现。等待新手机gate日志后再定修复，不宣称已经修好。

- 排查输入（历史）：用户先给出solo/P3/eventType1 submitted，随后反馈“只有eventType1、无2”，并确认已成功进入单人选关与好友准备。由此增加上述诊断；最终新预览四项结果以本节顶部验收为准，早先缺日志的原因未确证。

- 初次手机截图（历史）：iPhone vConsole显示Wechat Lib 3.17.5、home-analytics ready/environment=develop及多次attempt→submitted，可见区无failed/api_unavailable/config_missing。因右侧branch/branchId/eventType横向截断，当时未作四类验收；后续完整文字证据已补齐，见本节顶部。始终未把submitted当作平台成功回执。

- 本轮范围：用户反馈10月21日首页“单人／双人入口”场景分析未出数，并明确授权真机调试曝光／点击、暂不发布。核对当前HOME_ANALYTICS_CONFIG仍enabled=true/testOnly=true，正式版禁用；官方场景分析说明以线上版发布后DAY+1汇总，开发预览不能仅凭等待次日视作收数验收。先核对原生调用、参数与错误，再区分客户端提交和平台收录，不改正式开关或投放。
- 调试准备：home-analytics适配器增加受debug及develop/trial双重约束的本地控制台日志（ready/attempt/submitted/failed及缺配置/接口），只列环境、分支名、branchId、eventType；不记录玩家信息或原始异常、不增加远端字段。HOME_ANALYTICS_CONFIG.debug=true，release/unknown无日志和无候选上报；console异常不影响原调用。官方接口未定义成功回执，submitted仅代表调用返回，不能宣称后台入库。
- 本轮验证：home-analytics、home-analytics-main、变更脚本语法和focused diff通过；独立level_analytics_review只读探针补查console缺失/属性及函数抛错、环境门禁、固定日志字段、失败和提交分离，无发现，未操作原生工具。静态主包3,690,305字节、总包8,680,472字节在预算内，含其他域并行变更。开发工具Stable2.02.2608040/基础库3.16.2已在正确项目自动编译，模拟器显示两分支eventType1 attempt→submitted，0错误/1条Harmony平台提示；这不是手机或后台收数证据。
- 真机连接状态：用户确认iPhone/iOS。本机工具二维码真机调试面板中iOS选项持续呈灰，AX点击一度显示Value1但实际截图仍Android/鸿蒙选中，不能据AX值声称切换成功；未修改工具内部限制。改用官方[手机vConsole路径](https://developers.weixin.qq.com/minigame/dev/guide/runtime/debug/vConsole)：开发预览→右上角开发调试/打开调试→重新进入→vConsole。新预览已成功，原生工具显示8007KB、10月22日12:25到期、上传完成；已请用户扫码后首页停留→单人入口→返回→好友对战，并提供[home-analytics]日志，不邀请好友。四种手机调用和后台收录尚未验收；普通预览仅向微信传输测试代码包，未执行正式版本上传/发布。本轮产品源码未再改，复用上一轮诊断日志和独立QA证据；原生预览包含其他域并行工作树，不将包体变化全归因于分析任务。

- 用户决定：采用微信小游戏官方分析，不自建统计系统；已确认账号可见“场景分析”和“收入诊断调优”。2026-10-20本轮明确批准按已给文案更新隐私说明并开启关卡统计，先真机测试、暂不发布。增加develop/trial限定以落实测试范围，正式release不启用本关卡候选；不改变既有广告接入任务归属。
- 当前新增范围：用户同意先补启动可交互、首次有效消除与引导完成，再补尚未覆盖的真机失败路径；仍不授权正式发布。官方复核确认系统启动场景7可直接reportScene({sceneId:7})，平台关联首屏至可交互耗时，不用业务Date差冒充全启动耗时；首次消除/引导采用实验工具独立定义事件，待账号生成代码，不能虚构事件或借用关卡动作枚举。
- 最新交付：新增activation-analytics平台适配器及两份测试，Main启动门禁/实际绘制触发系统7；每局棋盘就绪、首次有效交换消除、基础引导确认/跳过触发和最小续局元数据已接。STARTUP_ANALYTICS_CONFIG仅develop/trial开启；MILESTONE_ANALYTICS_CONFIG远端关闭、四映射空，本地沿用200条/7天低敏缓存，无自建统计后端/新身份。隐私版本2026-10-21.2同步当前真实范围。
- 当前账号能力决定：用户反馈“不能创建自定义事件”；停止要求创建四个实验指标事件，不把文档API存在当作账号可配置。四项过程计数只作本地诊断，远端保持false/空映射；当前不能在微信后台汇总首次消除和引导确认/跳过，不自建后端、不擅自切换第三方或启动A/B实验。保留可用的启动分析、首页场景分析和关卡分析。
- 预览恢复：用户手动解锁并明确要求继续生成预览；已通过项目菜单选择实际match3-wechat，核对目录与本项目AppID，未改其他项目。新开发预览成功，微信工具显示代码包7848KB、二维码2026-10-21 13:20失效、预览上传完成。产品代码未变，复用候选有效检查；未执行正式版本上传/审核/发布。
- 当前用户测试请求：扫码重新启动并核对系统7“游戏可交互”节点，另补关卡失败→重试→再进入2→3→5。等待反馈，不宣称原生启动时间或失败路径收数通过。后台四个自定义事件不可创建的反馈已作为当前账号限制记录，停止重复索要代码。
- 最新验证：worker level_adapter完成适配器unit和真实Main/Board/Core的activation-main测试；真实交换/无效交换/道具清除/两段连锁/基本引导按钮/复活与冷恢复、异常清理均通过（画布/原生/存储隔离，合成棋盘不证明自然进度）。主会话补实际配置的release/unknown零启动调用、develop/trial允许及过程远端零调用测试通过。home-main、level-main、solo-resume-main、onboarding、ad-main、solo-economy、analytics、privacy-reader16节、release-gates、语法/focused diff通过。静态主包3,684,651/4,194,304、总包8,393,488字节，含并行其他域当前变更，不归因全部增量于本任务。
- 最新独立复核：level_analytics_review额外探针验证交换过程中被拒绝的道具调用不串归因、更换棋盘后旧交换不记新局、替换后的新局仍可记录首次消除；检查启动/引导/恢复与SDK失败隔离，无发现。代码没有改变引导、交换、道具、奖励规则；运行只在已接受输入过程中观察。原生场景7时点及后台到达未验收。
- 本轮输入：用户提供首页两个原生场景分支的实际代码，单人ID尾P3、双人ID尾P0。沿用继续推进首页分析和仅开发/体验版测试的已定范围，填真实映射、开启测试并同步相应用途披露；不重新要求用户授权同一测试范围，不操作微信后台或发布。
- 本轮范围：2026-10-21用户要求继续推进并提供ID；首页单人/PvP映射已填、enabled=true/testOnly=true，仅开发/体验版上报。原生接口为reportUserBehaviorBranchAnalytics，eventType1曝光/2点击，不替换为实验reportEvent。一般事件/监控仍关闭，暂不发布。
- 首页候选交付：新增`js/platform/home-analytics.js`及两份home-analytics测试，Main实际绘制后曝光、被接受的原触摸入口记点击，按首页访问去重曝光。引导/体力/广告/建房/后台/续局阻塞不报，其他页面的首页底图不报；未修改原游戏触摸或导航时机。适配器无存储/身份字段/重试队列；缺ID不触发平台。配置和待同步隐私增量见[方案](ad-measurement-plan.md)。
- 首页验证：worker level_adapter 负责新增适配器及unit，主会话负责Main/config/消费者test，独立worker level_analytics_review只读检查（既有Sol medium路由复用）。父审一次发现点击失败误撤销已提交曝光资格，已修复并补抛错/异步拒绝回归。`home-analytics`与`home-analytics-main`通过；独立探针补验后台恢复前未绘制不复用旧曝光、绘制失败不报曝光、分支失败隔离/跨访问迟到隔离、仅两字段payload，无剩余发现。
- 首页启用差量检查：home-analytics/home-analytics-main增加实际ID对应与真实配置的release/unknown零上报、develop/trial允许断言；privacy-reader验证2026-10-21.1共15节、3视口、确认稿逐段一致，release-gates、level-analytics-main、package-budget均通过。独立QA复核ID精确对应、testOnly门控沿用、用途披露与两字段payload一致，无发现。最新主包静态估算3,664,608/4,194,304，总包8,227,821字节；其余未改消费者证据复用。
- 首页原生准备：微信工具在真实项目目录成功生成新开发预览，显示代码包7694KB、二维码2026-10-21 09:21失效，构建显示预览上传完成。用户随后确认“两个入口都正常”，并反馈微信场景记录目前只能查询昨天的数据。按用户反馈确认本轮真机入口功能正常；曝光/点击后台到达及数量仍未验证，不能把功能正常等同于上报已收数。
- 当前范围：普通单人关卡、首页及启动原生统计均开启测试候选；过程指标目前仅本地。平台原生注册/广告变现归因保留。关卡eventID=10000003、levelAction=1；结果1成功/2失败/3重试/4复活/5进入/6退出/7道具/8广告激励/9分享；loginCount仅进入、levelTime仅成功且不含后台/广告时间。隐私正文同步2026-10-21.2，仅开发/体验版远端统计；未修改微信后台线上声明、未执行正式版本上传/审核/发布。
- 执行分工：主会话维护 Main 接线、配置、真实消费者测试与项目记录；worker level_adapter 仅新增平台适配器及单元测试，level_analytics_review 独立只读复核。两路工具固定 gpt-6.1-sol/medium，上游运行模型独立证明不可用。未新建/改绑owner或其他聊天，未改广告、头像、玩法、美术、云端逻辑及其并行变更。
- 交付：关卡、首页、启动/过程三个平台适配器、Main消费者、独立testOnly配置及隔离测试；[配置、测试路径与隐私增量](ad-measurement-plan.md#wechat-native-phase1)。关卡六动作和首页两分支曝光/点击已接；启动有新候选，四过程事件仅本地待映射；道具/广告经营事件未接，不冒充全部正式漏斗已完成。
- 接线口径：棋盘创建后进入；复活不重复进入；结果按复活轮次去重；前台教学/游戏计时，后台/广告流程/结果等待不计。同进程续局保留耗时，跨进程无法确认全量耗时则省略；旧版无统计状态的续局不补造事件。进入次数是本机接入后累计，不是平台新用户或历史全量；版本取不到则省略，未使用示例3。通用REPORTING_CONFIG仍false，未放宽analytics字段过滤。
- 官方依据：小游戏场景分析、收入诊断调优、启动场景上报分析正文已于本任务公开文档核查；用户确认可见前两个入口。场景分析 DAY+1；branchDim 仅支持字符串形式 1–100 整数且须在后台启用；关卡通关率按次数，非新用户去重首局率；启动分析不能用于整局时长。用户账号协议与进入/成功实际字段已核对，其他原生路径和正式汇总口径仍待相应验证。
- 共享记忆：复用同一获客/归因分析任务的项目召回；无适用批准知识采用，无已识别模块。候选 none：当前接口/口径和有界运行证据已记录在项目文件，不另复制平台事实为方法卡。
- 有效验证：worker的`test/level-analytics.js`与适配器语法通过；主会话`level-analytics-main`使用真实Main/core/续局日志＋隔离SDK/内存存储/合成结果，覆盖10秒前台＋30秒后台＋20秒广告＋5秒前台=15秒、结果去重、复活/重试、冷恢复、配置关闭零上报/零计数写入、SDK失败不阻断奖励。既有`analytics`、`solo-resume-main`、`ad-main`通过；PvP接线修复后`level-analytics-main`、`battle-client`、`ad-main`、Main语法及focused diff通过。
- 独立复核：原生边界字段/外来run/时钟回拨/冲突迟到回调/关闭隔离均通过。QA初次发现结果页转入PvP后旧统计对象残留，导致后续新开局误记重试（同一准则一次失败）；已在成功建房/入房时退役旧统计对象，失败接管不关闭。可恢复原局视作暂离而非永久退出，玩法日志保持不变。QA针对两条入口独立确认不可恢复序列[5,2,6,5]、可恢复序列[5,2,4,2,4,1]和日志逐值不变；无剩余发现。
- 本轮启用验证：新增真实envVersion门控，release/未知/异常时零SDK、零统计写入；develop/trial允许。`level-analytics`（含实际配置门控）、`level-analytics-main`、`privacy-reader`（14节、3视口、正文与确认稿一致）、`release-gates`、`package-budget`、focused diff通过；独立QA以额外探针确认环境门控与隐私增量一致，无新问题。此前未改的玩法/广告回归证据复用。
- 包体与原生工具证据：HEAD d5a0d4c＋当前并行工作树，最新静态估算主包3,659,231/4,194,304字节、总包8,222,444字节。/Applications/wechatwebdevtools.app Stable2.02.2608040 打开实际match3-wechat目录，构建面板出现本轮adapter/config/privacy文件；预览成功，界面代码包7691KB、新二维码有效至2026-10-20 23:42。仅为开发预览发送测试代码包，未执行正式版本上传/审核/发布；未改变存档或清缓存。
- 真机/后台证据：用户扫码运行后从官方测试页提供第16关进入记录，levelAction1、levelResult5、loginCount1，名称与关卡一致，进入无levelTime；随后提供第15关成功记录，levelAction1、levelResult1、levelProgress100、levelTime49，字段符合协议。按用户反馈确认进入与成功含耗时字段的基础收数已通，非代理独立操作手机；两条记录来自不同关卡，不构造同一局配对漏斗。49秒是收到的计时值，并非外部秒表对后台/广告扣时的真机复测；后者已有隔离测试。其他原生动作和正式汇总未据此扩大验收。
- 关卡的10月20日真机反馈与未改源码证据继续有效；本轮增加首页代码后仅做上述受影响回归。用户继续要求暂不发布，关卡develop/trial限定及debug保持。
- 下一步：等待新预览的启动及失败/重试反馈；后续有实际复活测试时核对4不重复5、退后台恢复不记永久退出。四过程事件当前仅本地，不能作为线上汇总；引导按钮可后续另用已开放场景分支，但本轮未新增ID或接线。10月22日另查10月21日首页场景汇总，先核对测试流量是否纳入，不能保证次日必有。保持仅测试版、暂不发布。

```memory-task
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/docs/release/monetization.md#wechat-official-analytics-20261020","session_id":"01a0bf30-32a3-7481-9e5f-787a4b7d418b","turn_id":"01a17159-66e8-7530-8345-b3f258769bf5","state":"paused","reason":"普通关卡进入/成功/失败/重试基础后台收数已验证；等待后台隐私同步状态与启动系统7现有记录反馈，保持暂不发布。"}
```

```memory-handoff
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/docs/release/monetization.md#wechat-official-analytics-20261020","turn_id":"01a17159-66e8-7530-8345-b3f258769bf5","recall":{"project":"reused","module":"not-applicable"},"memories":[],"no_usage_reason":"复用同一官方分析任务批准召回，无适用知识采用。用户确认失败/重试/进入记录来自官方后台测试页，已登记基础收数通过并关闭重复取证；仍保留正式日表、启动及后台隐私边界。无代码变更或可推广新方法，候选none。"}
```

<a id="ad-measurement-plan-20261018"></a>

## 广告埋点与回收统计方案 · 2026-10-18

- 当前交付：依据现有五类广告点位编制事件合同、口径和可填数ROI工作簿，仅方案；不修改产品代码、配置、隐私正文或线上后台，不启动投放。既有广告接入归属及冻结规则保持。
- 输入：HEAD d5a0d4c及当前工作树；广告接入记录存在其他会话修改，保留。已读当前ad.js、analytics.js、config.js、main.js及ad-activation-draft.md相关规则。角色未另行识别，项目批准记忆沿用同一调研召回；不做跨项目模块召回。
- 共享记忆：hit/reused，match3-game-shop-list-cta r1，仅作为已读项目约定；本轮不修改UI，不宣称验证记忆效果。候选none：本次为未实施的测量方案，尚无可推广的运行方法证据。
- 状态：方案交付完成，未批准实施；产物为[埋点方案](ad-measurement-plan.md)及[ROI工作簿](../../../outputs/01a14d17-20df-7e13-ad7e-96b365de6598/ad-roi-template.xlsx)。五placement及entry、事件/字段/去重、插屏终态、归因与隐私能力边界明确；D0/D1/D7/D14/D30采用内部累计日龄，平台原口径需先转换。首次覆盖窗口仅人工判读，不声称逐日回本。
- 验证：Artifact Tool重算和隔离样本检查覆盖加权ROI、空值/0收入、重复cohort窗口、五个成熟度边界、全额广告金分母0、激励及插屏漏斗；公式错误扫描0，所有合成输入已移除，XLSX导出成功。三页渲染检查文字/列宽可读，导出XML无错误值且冻结行列正确。仅文档/工作簿检查，未运行游戏测试、未验证原生Excel/真实平台取数。
- 独立只读复核：worker Lovelace，工具固定配置gpt-6.1-sol/medium（未取得上游运行模型独立证明），未改文件；发现首次覆盖窗口输出描述、取消/关闭与show交集定义两处遗漏，已分别明确人工判读及交集/异常分流，并同步工作簿说明。主会话负责表格/视觉，worker仅检查合同，不另启owner或改绑任务。
- 下一步：用户审阅方案后，另定分析服务与数据授权、事件映射及隐私范围，再由既有负责人实施；本轮保持代码/上报/投放不变。候选none，本次方案无新的已验证可推广运行实践。
- 并行修改提示：交付时其他会话在ad.js/main.js新增本地诊断及相关测试，未覆盖或归属本轮。已针对性复核ad_complete插屏共用和上报配置仍匹配方案，文档注明实施前复用最新诊断阶段，不能把其本地诊断当线上ROI能力。记忆usage与handoff结构检查均valid、issues=[]。

```memory-task
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/docs/release/monetization.md#ad-measurement-plan-20261018","session_id":"01a14d17-20df-7e13-ad7e-96b365de6598","turn_id":"01a14d25-a25e-7db3-aabd-8449b2811cab","state":"active"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-shop-list-cta","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/docs/release/monetization.md#ad-measurement-plan-20261018","date":"2026-10-18","stage":"retrieved","purpose":"review"}
```

```memory-handoff
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/docs/release/monetization.md#ad-measurement-plan-20261018","turn_id":"01a14d25-a25e-7db3-aabd-8449b2811cab","recall":{"project":"reused","module":"not-applicable"},"memories":[{"memory_id":"match3-game-shop-list-cta","revision":1,"stage":"retrieved","purpose":"review"}],"no_usage_reason":null}
```

<a id="ad-integration-handoff"></a>

## 广告接入会话交接 · 2026-10-14（仅梳理待办）

- 用户授权将现有方案与预留接口同步给“广告接入”（01a13b02-ff73-76a1-a02e-c0e59d8fb275），先梳理后续工作。实际仓库为`/Users/Admin/codex/sanxiao/match3-game`，客户端为`match3-wechat/`，原生JS＋Canvas2D，无客户端构建。沿用既有综合主任务归属；本轮不修改产品/测试代码、启用广告/上报、操作微信后台、部署、上传、提交或推送。
- 同步状态：已向该会话发送本条来源、规则/接口摘要、具体风险与只读梳理要求，消息工具返回成功；要求在目标会话向用户输出依赖/优先级/成本、需用户资料和验收标准。未覆盖其模型或扩大实现权限；消息送达不等于对方已完成梳理。
- 当前源码快照：HEAD dea08fb，另有未提交的普通关卡、棋子美术、PvP等改动，须保留。AD_CONFIG仍为enabled=false、debugMockAds=false、两个广告位ID为空；REPORTING_CONFIG仍关闭且映射为空。不能据历史“尚无流量主资格”推定现在仍未开通，需用户确认资格、实际广告位及后台状态；本轮未访问后台或请求真实广告。

| 入口/规则 | 现有接线 | 边界 |
| --- | --- | --- |
| 单人失败复活 | `main.js reviveGame`→`ad.showRewarded('revive')`→`core.revive` | 完整观看每次＋5步；限时关同时＋30秒；单局不限次数；仍属同一局，旧局回调不能复活新局。 |
| 补体力 | 首页无体力入口、体力耗尽提醒和商店→`main.js handleAddHeart`→`showRewarded('heart_refill')`→`heart.addHeart(1)` | 每次完整观看＋1心，上限5心；不设广告冷却/次数上限，不占道具视频额度；满体力禁用。自然恢复10分钟1心，金币购心1000，旧500/25分钟记录已过时。 |
| 商店视频领道具 | `main.js claimShopAdItem`→`showRewarded('shop_item',{allowMock:false})`→`coin.claimRewardedItem` | 自选锤子/炸弹/换色，每次＋1；三种共享设备本地自然日10次上限，不是云端北京时间额度；库存只用于普通单人闯关，PvP与每日挑战不用。 |
| 单人结算插屏 | `main.js leaveSoloResult`→`ad.onSoloResultExit()` | 最终离开结算时计数，每3局尝试一次，成功关闭后重置计数并计120秒冷却；无填充/失败不阻断下一关、重试或回首页。不是对局中或复活时插入。 |

- 冻结边界：无Banner、无PvP广告；每日挑战不开放广告复活、库存道具或额外广告入口；签到不要求观看广告，不新增广告翻倍、小鱼干兑换、礼包或分享奖励。激励视频主动点击、完整观看才可发奖，提前关闭/加载失败不发奖。广告未配置时隐藏入口，不显示假广告或发模拟奖励。
- 预留接口：`js/core/config.js AD_CONFIG`（enabled/debugMockAds/rewardedAdUnitId/interstitialAdUnitId/reviveSteps/interstitialEveryGames/interstitialCooldownMs）；`js/core/ad.js`导出`isRewardedAvailable()`、`isRealRewardedAvailable()`、`showRewarded(placement,options)`、`markRewardGranted(placement)`、`onSoloResultExit()`。激励调用`wx.createRewardedVideoAd`，仅onClose.isEnded为真返回true；先show失败后load/show重试，实例与请求身份隔离、全局单请求。插屏使用`wx.createInterstitialAd`；频控存于`match3_interstitial_v1`。这些是当前代码事实，不代替最新官方API兼容性复核。
- 页面/经济：`js/render/ui.js drawShop`保留用户接受的珍珠面板四行清单，`main.js`以真实广告可用性控制视频列；未开放或无广告时隐藏整列。库存/额度接口在`js/core/coin.js getRewardedItemState/claimRewardedItem`；体力在`js/core/heart.js`。不要重新引入被否决的2×2商店布局。
- 事件接口：`js/core/analytics.js track/trackOnce/getEvents/reportEvent/reportMonitor`；现有ad_request/show/complete/cancel/fail/reward_granted/frequency_blocked及shop_ad_reward_*仅本地低敏记录，最多200条/7天。真实远端上报需要显式事件/监控映射和用户批准，禁止身份、头像、原始错误等字段；不能用本地事件缓存声称线上广告漏斗已可观测。
- 必须梳理的依赖：流量主资格与两类广告位；微信当前官方广告/隐私/审核规则；本地协议与微信后台声明同步；有/无广告页面状态；观看→单次兑付→持久化失败/重启恢复；取消、无填充、失败重试、迟到/重复回调及生命周期；插屏节奏和PvP/每日不串入；必要本地测试、独立复核、iOS/鸿蒙真机与微信实际包体；候选启用、用户验收及回退顺序。先给优先级、最小改动和大致成本，不执行。
- 专项复核点，不是已验证结论：商店奖励目前先写每日次数再加库存，需核对第二次写入失败是否消耗额度而未发道具；体力保存失败、广告异常后的可用性恢复、无关闭回调时导航/请求挂起也需评估。广告奖励没有自动获得留存云收据的钱包WAL保障，不得把每日任务领奖复核当广告兑付复核。
- 隐私就绪缺口明确存在：当前`js/core/privacy-policy.js`版本2026-09-27.1虽已确认，但广告章节写明“未启用真实广告、ID为空”。启用前应按实际服务起草增量正文，用户确认后与后台声明保持一致；现有release-gates只检查正文已确认等，不自动证明广告披露与开关匹配。本轮未修改隐私正文或确认状态。
- 有效证据与限制：仓库已有`test/commercialization.js`（默认关闭、mock隔离、完成/取消、插屏频控、show/load异常竞态/旧实例回调）、`coin.js`（10次/跨日）、`stamina-purchase.js`（满体力/连续视频）、`analytics.js`、`ui-smoke.js`、`release-gates.js`。历史通过记录见`project-status/release-check.md`及`ui-production.md`；本轮仅核对现有断言/接线，未重跑测试或做运行/真机验收，当前Main/UI有其他变更，历史结果需按相关输入判断是否仍有效。主包余量历史较小，实施后复核package-budget与微信实际打包，不复制旧字节数为当前值。
- 共享记忆召回hit：已读`match3-game-shop-list-cta`r1原文，结合现行drawShop核对有/无广告列与清单版约定，用于本轮交接，不豁免真实广告/触控验收。召回另含functional-preview r1，仅作为返回的批准资料记录，本轮不采用为广告测试结论；相关候选小批审计无未复核项，本次候选none。以上事实已有项目规范/源码，不另写方法卡。

```memory-usage
{"schema_version":1,"memory_id":"match3-game-shop-list-cta","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/docs/release/monetization.md#ad-integration-handoff","date":"2026-10-15","stage":"validated","purpose":"execution","action":"广告本地异常恢复保留四行珍珠清单与无广告列隐藏，体力存储不可用显示明确状态；未恢复旧网格。","check":{"result":"effective","evidence":"docs/release/monetization.md 当前执行·本地可靠性修复；ui-smoke及独立QA检查/private/tmp/match3-ad-visual-20261015/shop-no-ad-320.png与375.png，仅本地Canvas范围。"},"delivery_id":"/Users/Admin/codex/sanxiao/match3-game/docs/release/monetization.md#ad-integration-handoff"}
```

```memory-usage
{"schema_version":1,"memory_id":"match3-game-functional-preview","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/docs/release/monetization.md#ad-integration-handoff","date":"2026-10-14","stage":"retrieved","purpose":"review"}
```

```memory-handoff
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/docs/release/monetization.md#ad-integration-handoff","turn_id":"01a14f9a-519d-77d0-9c71-7e261cfcc2d0","recall":{"project":"reused","module":"not-applicable"},"memories":[{"memory_id":"match3-game-shop-list-cta","revision":1,"stage":"validated","purpose":"execution"},{"memory_id":"match3-game-functional-preview","revision":1,"stage":"retrieved","purpose":"review"},{"memory_id":"match3-game-request-settle-once","revision":1,"stage":"validated","purpose":"execution"}],"no_usage_reason":null}
```

```memory-task
{"schema_version":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/docs/release/monetization.md#ad-integration-handoff","session_id":"01a13b02-ff73-76a1-a02e-c0e59d8fb275","turn_id":"01a14f9a-519d-77d0-9c71-7e261cfcc2d0","state":"active"}
```

### 当前验收 · 广告域按用户决定阶段收尾（2026-10-18）

- 用户本次明确：正式版试用没有额外下滑再上滑；广告域先收尾，保留错误码/提示分类修复，确认正式版不显示诊断并更新记录。本域按此决定阶段收尾，取消当前继续扫码录屏/切音乐/刷次数的待办，不再为开发预览转场修改展示逻辑或生成新候选；不等于全游戏/所有设备/所有发布门槛放行。
- 正式版转场结论来自用户本次真机反馈；此前D1实测连续两次提前关闭后第三次可拉取、复活入口正常也保留为对应观察。开发预览仍曾出现商店偶发/局内加号额外转场，归入环境或版本差异观察记录，原因未查明，未断言微信SDK缺陷或永久不会复现。未读取线上版本号/包身份，不能证明线上包就是当前工作树。
- 保留实现：每请求独立outcome的安全整数错误码、sdk_1004等可清洗原因与阶段；取消/暂无广告/加载失败/展示失败/超时/等待关闭/后台取消分类提示；原奖励WAL、strict isEnded、单次show、超时隔离、分享兜底关闭、额度/存档均不变。AD_CONFIG.enabled=true、debugMockAds=false，REPORTING_CONFIG.enabled=false且映射为空。
- 正式诊断门控已核对：core/ad-diagnostics对release/trial优先返回false（即使platform=devtools也不能覆盖），getDiagnosticLines为空；Main把空数据传到render/ad-diagnostics后立即返回，背景、标题、文字都不绘制，开发专用onLoad观察也不注册。未知真实设备同样默认关闭；开发版保留D2用途，不删除有用错误分类或重开上报。
- 应用户本轮明确确认要求，执行`node /private/tmp/ad-release-closeout-check.cjs`退出0：release/trial×ios/android/devtools六组真实adapter/analytics＋真实renderer隔离校验，记录0行、诊断Canvas调用0、可选观察0、上报0；模拟1004仍保留错误码/正确提示，诊断/原始错误不落盘。真实Main消费者`test/ad-main.js`通过。其余D2有效证据复用，不为收尾重复全套或生成预览。
- 独立非实现者Aquinas只读复核限定PASS，核对release/trial优先门控、Main空数组→renderer早退、分类与安全错误码保留、上报false；复用此前D2独立测试证据，未修改文件或重复测试，不认证未读取的线上包。候选none。
- 当前HEAD d5a0d4c＋未提交改动；core/ad.js及两个诊断模块与D2候选相同，Main并行新增result-art加载/剩余目标展示等其他owner改动已针对性比对，广告诊断调用链未变且ad-main通过。本轮不改产品/测试/素材/配置/存档；不把历史D2包体或二维码当当前完整工作树的新构建证据。未后台操作、代码传输/新预览、云部署、提审发布、Git提交推送。
- 文档仅本域验收状态收尾，并修正一处先前全文件元数据替换误改的并行任务turn_id：ad-measurement-plan-20261018按原会话01a14d17-20df-7e13-ad7e-96b365de6598的成功handoff输出恢复01a14d25-a25e-7db3-aabd-8449b2811cab，未改其方案内容/usage/归属或发消息。此后元数据按task_id定点更新，保留其他owner部分。
- shared-memory复用原任务批准召回与真实usage证据，候选none（阶段状态不是可推广native修复方法，现有代码/验收记录已明确）；前轮候选批准状态不变。handoff只验证记录一致性。当前无广告域待用户继续执行的测试项；后续正式版出现新问题时再根据实际证据立项，不创建自动监控或跟进。

### D2前置时序诊断预览已交付（2026-10-18，历史）

- 用户确认第一次领取也会出现；只关闭音乐、音效不变后商店8次仅第2/3次额外上下滑，其余直接上滑，局内加号仍异常。说明BGM播放不是必要条件，不称关音乐已修复，也不排除全部原生音频上下文因素。保留当前用户设置，不再让用户刷次数。继续既有本地诊断/开发预览授权，不动后台/部署/提审发布，上报false。
- D1缺口是请求之前的native UI时序，D2仅补观测：Main.runAdFlow每流独立context，读取音乐/音效开关、记录音频锁完成时间；局内wx.showModal success/complete仅各记回调时刻；playRewarded复制本次调用前最近showBattleNotice的时间，随options.diagnosticContext传入本次request。旧modal complete只更新旧对象，不串到下一请求。没有加延时、等待complete、额外modal、hideToast、预加载/实例重建或重试，原微任务边界/锁/奖励/额度/存档不变。
- core/ad-diagnostics固定以show_call时刻计算间隔，返回两条D2 ctx摘要（music/sfx、audio→show、modal S/C→show、此前toast→show）及有界事件，最多40条副本；render固定两摘要＋最后四事件，返回后仍能看到前置数据。负间隔表示该回调晚于show_call，'-'表示没有捕获对应时间或尚未show。S/C分别是接口success/complete回调，不代表iOS动画完成；toast只覆盖本项目showBattleNotice，不是全平台窗口清单，不能凭'-'断言没有任何原生UI。
- 诊断仍仅开发版/模拟器启用，体验/正式版和未知真实设备关闭；内存有界、不上传、不持久化、不输出提示正文/身份/原始错误。音乐配置仅读取，未替用户恢复开关。Main context/lastNotice时间只在当前进程内存在，未接入analytics字段。D1原生两项根因不因本轮诊断交付而自动结案。
- 本域回归通过：ad-main（原112手势与奖励取消/失败保护）、ad-lifecycle新增精确20ms/5ms/-15ms/1000ms摘要、旧context不串新流、额外SECRET不输出；stamina-purchase、solo-resume-main、commercialization、analytics、语法与focused diff。audio测试替身只补现有isMusicEnabled/isSfxEnabled合同；fixture补模拟modal complete，未改变游戏规则或模拟真实iOS动画。
- 非实现者Aquinas独立`node /tmp/ad-d2-independent-qa.cjs`退出0，限定PASS：相对show_call固定、旧complete隔离、原Main微任务/锁保持、环境/副本/40条边界、无诊断网络/落盘/正文，320/390长间隔布局（含toast24小时、complete晚180秒）无溢出，输入前后稳定。复用D1保护证据，不重复无关全库。配置沿用worker Sol medium，不冒称底层runtime实测；未改实现，候选none。
- 实际本机Canvas操作：390局内加号→确认→模拟提前关闭，只有1次展示、库存/商店计数0，D2固定摘要modal S=0ms/C=0ms，音频锁至展示264ms（含用户确认等待），取消后摘要保持；320商店模拟load1004，暂无广告提示且无展示/发奖，未show的摘要间隔为'-'。截图/private/tmp/match3-ad-d2-390.png、/private/tmp/match3-ad-d2-320.png；不当真机native证据。仅本机53949隔离SDK/内存数据，没有真实广告请求。
- 本轮无素材优化/配置改变。静态主包4,183,082/4,194,304（余11,222）、总包5,978,447；输入快照/private/tmp/match3-ad-d2-20261018-dg3w00bm共116份，普通预览前后路径与字节相同。原AppID/目录，工具2.02.2608040，实际主包3761.8KB、catalog1753.3KB、总5515KB，满足原4M/4M/30M。预览前界面0错误/1平台提示；成功普通预览二维码显示10/18 16:38（上海）失效，截图/private/tmp/match3-ad-d2-preview-20261018.png。只做授权预览传输，未正式上传/后台/云部署/提审发布/Git提交推送。
- 产品写集main.js、core/ad.js、core/ad-diagnostics.js、render/ad-diagnostics.js；相关测试/本机fixture及原发布记录更新，保留其他owner改动。下一步用户正常对局触发一次局内+时录从点+前到返回后D2区的完整过程即可，不要求连续8次/再切音乐/重复取消矩阵。此交付为D2采证就绪，额外转场仍未定位或验收。shared-memory复用同任务批准usage，候选none（代码/记录已覆盖诊断方法，未验证新的native修复因果）。

### D1真机反馈后的入口差异诊断（2026-10-18，待单变量对照）

- 用户本轮报告D1候选连续取消两次后第三次已不再拉取失败；额外上下转场仍在商店视频道具和局内加号，失败复活正常。只记录本轮设备/会话实测，不推断永久解决。商店金币购买函数不请求广告，定位对象是视频领取列。原先“所有入口异常”的状态按此最新反馈细化。
- 用户截图D1 #10 solo_item：show_call6ms、show_ok21ms、hide35ms、show3452ms、close/end_cancel3672ms。本请求收到正常取消回调，应用回前台至close约220ms，未见timeout/1004；show行是应用onShow，不是第二次广告展示。最后6行不能充当全量native窗口/动画录像，show_ok也不能证明转场动画结束。
- 当前HEAD d5a0d4c＋D1未提交改动；116候选输入与/private/tmp/match3-ad-diagnostic-20261018-3d0th7jc逐字节一致（changed=[]），没有丢失诊断/前轮修复。未改变产品，不因新反馈重复已通过的模拟套件或再生成无差异预览。
- 主会话与既有升级诊断者Lorentz（escalation已配置Astra xhigh，本轮只读）独立核对：revive/shop_item/solo_item都是calm音乐场景，runAdFlow都暂停音乐/音效；结果页失败音只短暂duck BGM，并未停BGM，不能用“复活页静音”解释正常。onShow发生时adFlow锁仍在，正常路径不会立即恢复BGM。
- 确定差异：复活在touchstart播放click，再保存原局快照后进入共用广告流；商店视频无click，先建领取凭据；局内加号无click，先建凭据、可能保存原局、经过原生确认框。取消后均经同一playRewarded toast，再释放音频锁；完整道具领奖有“奖励已保存”toast，复活成功无该toast。确认框不是两个异常入口共有项，取消toast也不是三入口的差异，不能单凭这些存在而改动。
- D1记录起点是showRewarded，未覆盖此前音频暂停/确认框退出/残留toast，静态截图无法证明额外动画发生在哪个native操作。已向用户询问首次领取也发生还是仅连续领取，尚未收到答案；不把沉默作确认。不加猜测延时、额外modal、预加载/重建实例或变更奖励。
- 最小下一步无需换包：同一D1、同一商店视频入口，只在设置关闭音乐，保持音效与其他条件原样，从无残留提示/弹窗的页面观察一次。此对照检验正在播放BGM是否为必要条件；仍异常不能排除全部音频上下文问题，消失也不是修好证据。用户此前已说明异常在广告弹出阶段，避免重复询问这一已知事实。后续需要时再取一段异常转场录屏与正常复活对照，不要求重跑广告全矩阵。
- 本轮没有产品/测试/素材/配置/用户存档写入，没有真实广告请求或后台/预览传输/云部署/提审发布/Git提交。仅更新原诊断与验收记录；上报继续关闭，现有保护/额度不变。shared-memory复用同任务批准usage，候选none，未提炼未验证因果。诊断者只读，无新增测试/候选。交付记录检查不代表原生转场验收通过。

### 错误分类与本地诊断D1开发预览已交付（2026-10-18）

- 用户明确授权先修错误码丢失/提示混淆并生成本地诊断预览，再扫码录屏；只完成本诊断交付，不宣称原生额外上下转场或连续取消第三次不弹出已修好。上报保持false，广告enabled=true、mock=false、原广告位/奖励/额度/存档/后台配置不变；只执行授权普通预览传输，未部署云函数、正式上传、提审、发布或Git提交/推送。
- ad.showRewarded继续Promise<boolean>，新增调用者独立options.outcome容器，在该请求终态单次写reason/code/stage；正常关闭、创建/监听/加载/展示失败、onError、timeout、不可用/忙碌/隔离/后台早退均有归因。安全整数errCode在throw/reject/onError中保留，analytics以sdk_1004等可清洗枚举及source阶段记录；不放宽清洗器，不留原始错误/身份/广告位数据。旧回调/其他请求不覆盖该结果，不使用全局lastFailure。
- Main.playRewarded统一消费对应结果：提前关闭→“广告已提前关闭，未获得奖励”；1004→“暂无广告，请稍后再试”；另区分加载失败、展示失败、回调超时、等待广告关闭、后台取消。四种奖励消费者保留各自cancel/complete/WAL逻辑，只移除重复而含混的“未完成”提示。提前关闭或加载失败不发奖、不占商店额度；已完成待保存恢复仍不要求重看。
- core/ad-diagnostics只在develop或模拟器启用，release/trial优先关闭、未知真实设备默认关闭。最多40条内存记录、getDiagnosticLines返回副本；记录D1标记、请求序号、相对毫秒、固定入口及阶段/安全数字码（request/create/load/show/onLoad/close/onError/hide/show/timeout/quarantine/end_REASON）。退出进程丢弃，不持久化、不增加诊断网络/analytics阶段。每次请求判定环境，绘制读取不逐帧调用原生查询。onLoad仅开发观测，注册抛错不阻断正常广告，按已尝试注册状态解除。没有改load→单次show、2秒grace、超时隔离、strict isEnded、禁分享兜底或新增自动重试。
- render/ad-diagnostics在Main普通场景末尾画最近6行D1区域，不接收触控；启动未请求广告时不画，PvP/每日/引导不画。320/390宽真实Main Canvas＋内存SDK运行已看：两次取消后第3次模拟load1004，显示end_cancel与#3 load/end_load_failed1004、提示暂无广告，库存/额度不变且第三次不show。390截图/private/tmp/match3-ad-diagnostic-390.png；320画面已在工具观察，首次临时tab失效未保存，不伪造截图文件。隔离试玩53949仅本机，非真实广告，测试UI不进入包。
- 回归：worker Mill完成ad-lifecycle（真实analytics、结果隔离、取消两次/1004/恢复、环境gate、40条副本、无上报/存储泄漏、观察失败不影响业务）与commercialization；修正旧fixture load恒throw，使show_throw/event_then_reject真正到达show并断言调用次数。主会话ad-main（112原手势例＋新准确提示/真实SDK替身取消取消1004）、solo-resume-main、stamina-purchase、analytics、相关语法/focused diff/package-budget通过。solo-resume-main仅补新增结果/诊断接口的测试替身合同，未迁就玩法。
- 独立非实现者Aquinas最终执行`node /tmp/ad-diagnostics-independent-qa.cjs`退出0，18组adapter/diagnostic及真实Main路径PASS；输入前后稳定。核对safe code经真实清洗保留、并发早退/旧回调不串结果、失败不发奖/不扣额且后续成功只一次、环境优先禁用、不逐帧查询、诊断不落盘不上报。首次实现的onLoad注册可能影响业务/缺结果行/逐帧查询问题已在主review修复后冻结，再做最终QA。两名worker按既有Sol medium配置，无新增角色/所有权变更，配置不冒称底层runtime实测。
- 包体：沿用用户本地无损优化授权，仅对res/home/duel-heads.png重新编码IDAT，83,161→65,615（省17,546）；保留全部非IDAT块/CRC，256×171 RGBA解码175,104字节完全一致。主会话及独立Aquinas逐像素核对PASS；旧字节/private/tmp/m3-diag-duel-heads-original.png，无画质/透明度/色彩元数据/音频变化，未调包限制或忽略活跃素材。
- 最终静态主包4,181,524/4,194,304（余12,780）、总包5,976,889。输入快照/private/tmp/match3-ad-diagnostic-20261018-3d0th7jc共116份运行输入与配置，普通预览前后路径与字节比对changed=[]、removed=[]。原目录/AppID，微信工具2.02.2608040/基础库3.16.2实际主包3760.9KB、catalog1753.3KB、总包5514KB，满足原4M/4M/30M。
- 新普通预览二维码显示10/18 12:39（上海）失效，截图/private/tmp/match3-ad-diagnostic-preview-20261018.png。工具SDK只读查询确认AD_DIAG_ENV develop devtools；未拉真实广告。Console首个typeText输入丢标点导致诊断命令SyntaxError，改paste后读值成功；这是工具输入错误，没写产品源码，启动观察原为0错误/1条平台提示，不能把该输入错误说成产品失败或隐藏。编译/打包/预览返回成功。
- 下一步：用户扫D1新预览，在同一会话录两次提前关闭→第三次点击，保留返回小游戏后的D1区及最终提示（等待提示出现），无需完成观看或跑全矩阵；录屏用于继续定位两项原生问题。共享记忆复用同任务批准usage与真实证据，候选none（实现合同已有源码/测试/本记录，未形成新的已验证原生修复方法）；前轮候选批准状态不变。handoff检查仅记录一致性。

### iOS额外转场与连续取消继续诊断（2026-10-18，待真机证据）

- 用户明确最新状态：商店和局内“+”均有额外下滑再上滑；连续两次未看完，第三次提示“广告未完成或暂不可用”。此前“局内正常”不能沿用作当前真机PASS。两轮候选（单次show、抬手触发）没有达到消除原生异常的标准，本轮未宣称已修复，也未继续猜性加延时/确认框/重建实例/放宽保护。
- 当前HEAD d5a0d4c；main.js、core/ad.js与前轮实际候选/private/tmp/match3-ad-gesture-20261017-j49znplt逐字节相同，未发现广告改动丢失。回顾共用runAdFlow、audio.setAdActive与生命周期，音频仅暂停/恢复，无退出小游戏或再次展示广告调用；不能因此证明微信native没有异常。
- 主会话重新核对[微信团队官方API定义](https://raw.githubusercontent.com/wechat-miniprogram/minigame-api-typings/master/types/wx/lib.wx.api.d.ts)：默认小游戏全局singleton，create调用次数不能当实例数量；show声明从屏幕下方推入，所列参数没有动画开关。这只能解释标准行为，不能证明额外下滑再上滑正常；未找到可核实的对应官方修复说明。此前受限的开发文档域名没有通过替代传输绕过。
- 按同一真机标准两次失败规则，本次走escalation有界只读诊断，Lorentz（01a14d19-eabf-7e63-8e69-bfcf6f612d1e）；已核对路由配置gpt-6-astra/xhigh，不把配置当底层实际runtime证明。保留原广告owner，不新建/改绑角色。该非实现者只写/private/tmp/match3-ad-escalation-20261018/cancel-sequence.cjs及results.jsonl，未改产品或操作UI/真实广告。
- 独立六组实际adapter隔离singleton探针退出0：正常onClose(false)连续两次后第三次单次show可达；注入第二次返回前台2秒仍无close会触发abandoned；注入前台事件缺失被hidden阻止；第三次load不结算15秒失败且不展示；onError1004失败；仅load Promise reject1004则错误码丢失成load_failed。后五项是注入假设的路径证明，不是用户iOS根因；不据此移除超时隔离或增加自动重试。没有取消两次停用的本地计数规则，也没有证据认定微信限制两次。
- 独立复核补充测试证据边界：commercialization旧fixture的load恒抛错，使其中标注show_throw/event_then_reject的激励分支在当前load-first路径到不了show；不将该分支作为相应竞态覆盖证据。ad-lifecycle另有独立load/show失败用例，此缺口不等于所有既有测试失效，也不能解释用户真机现象。
- 另核实确定的诊断缺口：Promise catch未保留安全错误码；Main把取消、加载/展示失败统一提示未完成。probe的analytics是直接收集stub，原报告“onError1004保留本地原因”不能用于生产持久化结论；主会话实际core/analytics.js＋隔离storage验证reason:'1004'被SAFE_ENUM_KEY的字母开头规则过滤，未接触玩家存档或网络。已向诊断者反馈此边界修正。该缺口不是额外转场/第三次失败的已证实根因。
- 静态包体检查仍通过（主4,192,148、总5,987,513，原限制不变）。因本轮没有产品修改，不重复已通过的全库测试、不再次传输开发预览；旧22:43二维码已过期。本轮仅诊断与更新原记录；未改产品、配置、存档、音频、广告位/额度或安全保护，上报关闭，没有后台/云部署/提审/发布/提交/推送。
- 下一步所缺：同一次会话从第一次触发广告开始，连续两次提前关闭，再点第三次，保留转场与失败提示的短录屏，并提供微信版本。该信息用于分辨实际窗口切换、回调等待时长、加载失败等路径，不要求完成观看、刷次数或重测整张表。若录屏仍不能定因，再做开发预览限定的短本地诊断，不把采证工具当修复。不具备手机连接/真实SDK回调证据前，两项问题保持未解决，现有task暂停于此证据缺口。
- shared-memory复用同任务已批准召回/usage边界，候选none（没有已证实的原生修复方法），既有候选批准状态不变。handoff只检查记录一致性，不代替真机问题验收。

### 全激励入口抬手触发修复（2026-10-17）

- 用户确认失败页“再来一次/返回首页”正常、局内加号无额外下上转场；商店仍有，要求检查全部激励入口。保留这两项用户真机确认，不扩大为其他手机/场景已验。沿用开发预览及必要传输授权，工具被切到其他窗口时暂停，用户再次明确“可以，生成本次开发预览”后继续；未操作微信后台配置、云函数或提审发布。
- 源码差异：局内Board加号原已在touchend释放后确认；商店三个道具、商店补心、首页补心、体力弹窗补心、失败页复活七处仍在touchstart直接启动。本轮统一通过Main.armAdTouch记录触点/目标/场景，只有单指同ID、同场景/core/result/弹窗且移动≤8px的有效抬手才执行一次；滑离、取消、多点、后台、保存/广告占用、弹窗关闭重开、缺失结束事件均取消。已正常的局内加号、原生确认框、load→单次show适配器不变；不增加自动重试、延时或新确认弹窗。修复的是确定存在的触发时机差异，不能仅凭模拟测试断言iOS额外转场必已消失。
- 相关回归：ad-main新增112个七入口路由/手势用例及真实Main＋隔离SDK商店按下零请求、抬手单请求；原兑付、满额、复活、取消、迟到回调、音频锁与导航断言保持。ad-lifecycle、stamina-purchase、solo-resume-main、ui-smoke、语法及focused diff通过。最后补弹窗清理/缺失event后ad-main再次通过；不重复未变的全库测试。
- 非实现者Aquinas独立QA：`node /tmp/all-rewarded-gesture-independent-qa.cjs`退出0，141项通过；真实Main/adapter/reward隔离原生传输与存储，独立覆盖七入口、一次展示、手势取消/后台/状态变化、完整/取消/重复回调、10次商店满额与补心额度隔离。产品输入执行前后稳定；未改产品，未声称观察iOS动画；沿用既有worker配置。
- 运行：本机53948工具页真实Main/Core/UI＋内存SDK，商店锤子点击后请求1，模拟完整观看后锤子0→1、商店计数0→1，没有请求真实广告或修改玩家存档。最后的弹窗清理增量由上述独立测试覆盖；页面标签随后失效，未假称做完全部真机路径。tools/preview-level-entry.cjs仅补本机商店/首页/体力入口及正确pointercancel转发，未进入小游戏包。
- 用户既有本地无损优化授权内，仅重压缩res/home/catalog-album.png的IDAT：37,859→34,129字节，节省3,730。原文件/private/tmp/match3-catalog-album-before-ad-gesture.png；全部非IDAT块、160×160 RGBA IHDR、解压后102,560字节过滤扫描行一致，所有CRC有效。Aquinas独立Python只读核对PASS；没有改像素/透明度/尺寸/色彩元数据/音频，不调整包限制或忽略活跃资源。
- 静态预算最初略超限（同时有其他owner修改），无损优化后最新主包4,192,148/4,194,304、总包5,987,513；源输入快照/private/tmp/match3-ad-gesture-20261017-j49znplt，114份运行输入/配置。此前a6vaywvr发现battle-ui.js并行更新已废弃，未覆盖别人的修改。最终预览前后逐字节比对changed=[]、removed=[]。
- 微信实际普通预览成功：原目录/AppID、工具2.02.2608040/基础库3.16.2；主包3774.6KB、catalog1753.3KB、总包5528KB，满足原4M/4M/30M。二维码显示10/17 22:43（上海）失效，截图/private/tmp/match3-ad-gesture-preview-20261017.png；这是开发预览必要传输，不是上传正式版本。工具调试器另显示内部`worker path empty`（工具app.asar堆栈、客户端无createWorker调用），因此不宣称控制台零错误；编译、打包、预览返回成功、首页可运行。本轮未修复或替其他模块放行。
- 当前仅需用户扫码复测商店视频是否仍多一次下滑再上滑；完整观看后仍应对应+1。已确认正常的导航和局内加号不要求重跑；若自然遇到补心/复活可顺带观察，不安排刷广告。iOS动画问题仍待本候选真机反馈，未宣布全广告验收/正式发布完成。
- 本轮产品写集main.js与catalog-album.png；测试ad-main、隔离fixture及现有发布记录。上报false、mock=false、广告enabled=true、ID/奖励/额度/配置/玩家存档均保留。共享记忆复用同任务批准召回与既有usage边界；无新增候选（此触发修复真机因果未闭环，不提炼为已验证平台方法），前轮候选match3-game-sdk-storage-json-01a1480c的批准状态不因本轮改变。未提交/推送。

### iOS反馈：读档误拒与广告二次展示路径修复（2026-10-17）

- 用户反馈iPhone/iOS所有激励入口弹出时小游戏下滑再上滑；失败页“再来一次/返回首页”提示原局记录未保存，发生在看过广告与否暂不确定。授权查因修复，继续上报关闭，不改后台配置/云部署/提审发布；沿用开发预览传输授权。
- 保存根因已在微信工具真实模块复现：合成快照通过独立临时wx storage键往返，写前validate=true、读后=false、JSON内容相同。精确分支是safeJSON拒绝getter/accessor；微信SDK桥接返回的schema等字段是访问器，不能把桥接对象直接当已解码普通对象验证。仅原型跨realm兼容的首个候选未解决真实SDK问题，已撤回，最终没有放宽snapshot严格validator。
- 最终修复：solo-resume.read先对SDK存储返回值作JSON解码，再执行原有结构/快照校验；solo-resume.close在记录已不存在时幂等成功，修复清除已提交但接口抛错后重试永久stale；仍拒绝别局或新revision。Main.startGame在成功关闭旧记录后清本机旧resume/pending引用，不把旧句柄带入新局。未清玩家存档、跳过坏数据保护或改变奖励。
- 修复后的真实SDK结果：AD_STORAGE_FIXED显示nativeSnapshotValid=false、nativeSchemaAccessor=true、readerOK=true、readRedirected=true、correctRecord=true、restorable=true。探针只创建nonce临时键，并暂时将R.read读取重定向到该键；finally恢复SDK方法、清除本探针键，game.js及校验行号instrument均逐字节还原。未读用户iOS存档、不写玩家资产，无临时探针进入新包。早先Console require两次失败不算游戏模块证据；真正证据来自编译模块。Mac两次锁屏时均立即恢复临时入口，用户解锁后再验。
- 广告修复：原show拒绝→load→show可能造成同请求二次原生展示，且加载期间后台/返回会丢失wasHidden标记。改为用户主动请求内load→前台检查→单次show，不自动重试native presentation；独立sticky loadInterrupted在加载期间hide后一直阻止迟到展示。未真正show的close不能发奖；加载超时无覆盖层可重试，已尝试展示却缺终态的超时仍隔离，明确onError仍是失败终态可重试，严格isEnded不变。未主动预加载/增加展示次数、不变广告位或频控。
- 平台边界：[微信团队官方API定义](https://raw.githubusercontent.com/wechat-miniprogram/minigame-api-typings/master/types/wx/lib.wx.api.d.ts)说明show从屏幕下方推入。消除应用的二次show路径不等于关闭iOS原生转场；本轮没有手机动画回放证据，不能称用户观察到的额外转场已经在手机上消失。待新候选复测，若仍出现再查同一请求的原生时序。
- 回归通过：ad-lifecycle新增load先于show、load/show失败不自动重试、加载前后hide/show、加载超时和load阶段旧close；ad-main、commercialization；solo-resume-main新增realm/SDK accessor两种读取×菜单/重试×无广告/取消广告8种路径，以及clear写后异常重试；solo-resume、solo-snapshot保留恶意原型/getter不执行/循环/schema拒绝。首次广告回归卡住的load期间hide→show→load成功条件被独立QA定位，修复sticky标记后通过。最后语法与focused diff通过。
- 独立诊断Anscombe只读确认原重试竞态；非实现者Noether最终QA：node /tmp/match3-bridge-final-qa.cjs 6组PASS/exit0；node /tmp/match3-independent-ad-recheck.cjs 7组PASS（8场景）/exit0。覆盖native桥对象解码与非法数据、重复复活、旧revision/别局保护、已提交clear重试，以及loadInterrupted/失败可重试/显示超时隔离/迟到重复close不发多次。真实SDK操作由主会话执行，独立QA不冒称直接操作用户手机；均配置worker Sol/medium，未核实实际子runtime。
- 新普通预览：原AppID/目录、工具2.02.2608040/基础库3.16.2；实际主包3775.3KB、catalog1753.3KB、总包5529KB，满足4M/4M/30M。二维码显示10/17 14:03（上海时间）失效。源快照/private/tmp/match3-ad-fix-20261017-YnlF8V共114输入，预览前核对一致，禁止将上一版12:06二维码当修复版。最新静态主包4,191,526（余2,778）/总包5,986,891；静态和实际分别记录，配置/玩家存储不变。
- 预览完成时逐文件比对一致；收尾再次读取发现其他owner随后更新了js/render/board-render.js，本域三个修复文件及game.js仍与已打包快照一致。未覆盖该并行修改，也不把后续画面修改宣称已在14:03二维码中；本轮验收绑定上述源快照。
- 本域最终产品写集ad.js、solo-resume.js、main.js；测试ad-lifecycle、solo-resume-main、solo-snapshot及现有记录。solo-snapshot产品校验最终恢复原严格实现，game.js无净改动。没有提交/推送、后台改配、云部署或提审发布。共享记忆复用既有本项目边界；脱敏方法候选match3-game-sdk-storage-json-01a1480c已通过结构验证并排入pending-local，尚未提取/审阅/批准，只有项目主负责人可后续采用。用户只需复测这两个反馈，不重跑整张清单。

### 同源候选预览就绪，待三条最小真机确认（2026-10-17，修复前历史）

- 用户要求推进正式版本前收尾；沿用仅开发预览及必要代码传输授权，上报关闭，不改后台配置、不部署云函数、不提审/发布。用户现不能提供连接手机，明确选择稍后自行扫码最少项目，因此不冒充代理完成真机验证。用户此前“可以”已接受居中加号和等待时保持加号的最终样式。
- 原仓库HEAD dea08fb＋当前未提交工作树，包含其他模块既有改动。本轮未改产品/配置/素材/测试。打包前按现有ignore捕获114份客户端输入（含项目配置、未复制玩家存储）到/private/tmp/match3-ad-candidate-20261017-XDPLMb；测试后和预览传输后逐文件比对路径集合与完整字节均一致。它是源输入快照，不冒称wxapkg或Git提交；本地verification.json记录检查范围与包体。
- 因当前核心/关卡等输入相对历史验收有变化，补跑最小相关检查：ad-lifecycle、ad-main、ad-rewards（103故障/重载项）、solo-resume-main、privacy-reader、analytics、package-budget全部退出0。保留完整观看严格判断、分享兜底关闭、补心/复活/局内道具及商店额度隔离、取消/迟到/互斥、持久化重试、原局恢复与当前确认正文；未重复无关全库测试。
- Aquinas（既有独立worker，配置Sol/medium）只读本域审核并因依赖变化重跑/tmp/solo-ad-independent-qa.cjs，23项通过、退出0，前后相关源码/fixture size与mtime稳定；限定本地广告/触控/确认/恢复PASS，无必修问题。未改实现、不替其他模块/手机/整体发布放行；候选none。
- 微信原目录与原AppID，工具Stable2.02.2608040、基础库3.16.2启动0错误/1条平台提示。仅点击普通“预览”，新二维码成功生成，显示10/17 12:06（上海时间）失效；实际主包3775.8KB、catalog1753.3KB、总包5529KB，均满足4M主包/单分包、30M总包。主包显示余量约320.2KB，保留UI精度，不伪造精确字节。最终加号修正已在比对通过的源输入中，本轮未触发真实广告。
- 静态预算：主包4,193,550/4,194,304（余754字节），总包5,988,915；这是当前工作树文件估算，与微信编译后结果分别记录。后续任何相关修改须重核候选身份/包体，不能直接沿用本次结果。
- 下一步仅[三条手机确认](ad-activation-draft.md#minimal-phone-acceptance)：复活、补体力、零库存局内+，各覆盖提前关闭与完整观看。用户已验证插屏展示、商店播放发奖，不重测；三宽、超额、重复回调/保存失败等由本地证据承担，不要求刷广告凑次数。仍待用户反馈设备系统和三条结果，未宣称可以直接上线或默认获得发布授权。
- 共享记忆复用本任务仍适用的批准召回与边界；不写重复方法卡/临时状态，候选none。工作区产品代码不变，只更新现有发布记录和本地候选证据；未提交/推送Git、改后台、部署云函数或提审发布。

### 加号居中与等待态修正（2026-10-16，历史）

- 用户反馈小圆内加号不居中，且点击广告时三个加号都变为省略号。本轮仅改Board.drawTools及对应ui-smoke：零库存加号改为以角标圆心对称的白色圆头双笔画，避免字体baseline与旧数字＋1px偏移；等待中仍画同一加号，不再将全局toolAdPending显示成三个省略号。数字角标原样保留。
- 没有改变pending/adFlow交互锁、确认弹窗、奖励、额度或存储。重复点击仍被Board按下/抬手与Main两层阻止；只是取消误导的视觉替换。上报继续关闭，无后台/云函数/真实广告/发布操作。
- 语法、ui-smoke（含三宽/三个加号居中与pending前后保持）及ad-main通过；独立Aquinas只读复核限定PASS，确认不放开重复点击、不影响数字和0的绘制。复用既有不变奖励/复活证据，不重复全套故障测试。
- 当前完整工作树package-budget通过：静态主包4,192,742/4,194,304（余1,562）、总包5,988,107，含其他owner并行增加的文件；不把相对上轮的全部增长归为本次绘制修正，不当作新微信预览的实际包体。该预算随后续工作树改动失效。
- 已重启原本机隔离试玩页并真实点击：初始请求0；加号→确认观看后请求1，等待状态三加号仍居中；模拟提前关闭后库存三项仍0、商店计数0。真实Main/Board Canvas画面已检查，证据/private/tmp/match3-plus-center-20261016/waiting-390.png；测试未请求真实微信广告或触碰玩家存档。当前浏览器试玩已更新，旧手机预览不冒称含本轮小修复。
- 同任务shared-memory与游戏视觉技能规则复用；候选none，细节已有此记录。变更仅两产品/测试文件与本记录，保持其他owner的并行改动。

### 局内零库存广告补充与测试接管（2026-10-15实施；10-16预览收尾，历史）

- 用户已实测确认：插屏正常运行；商店激励可拉起、观看后发奖。记为用户报告的真实手机成功路径，不扩展为所有平台、频控边界、取消或异常恢复通过；不要求用户重复整张测试表。其余可代理的隔离回归/桌面运行由本会话承担，手机/云端不可替代项保留证据边界。
- 用户明确新规则：普通单人每道具入口看视频领对应道具1个，无次数上限，不与商店共享额度；商店原自然日10次保持。随后视觉澄清覆盖最初草案：恢复原圆形内居中图标与原数字角标，有库存显示数字，零库存时同位置/同样式显示“+”；名称独立放圆形下方，不显示“×数量”或“视频”小字。广告不可用/关闭时显示0，不展示可领假入口；PvP/每日不新增入口。
- 实现：Main绑定局内claimSoloAdItem，零库存加号有效抬手后通过原生确认框明确“完整观看视频…×1”，确认才请求原生激励；动画/引导/已有请求/后台时阻塞。广告及确认期间音频/计时暂停，已有原局快照保存暂停边界；旧完成回调可兑现已完成观看所得全局库存，但不改另一局棋盘/计时。领取仅入库存，不自动使用或改变棋盘/步数。
- coin/ad-rewards新增solo_item类别，复用完成日志、WAL和持久receipt去重；局内不写商店日期计数，满商店额度仍可局内领取。没有提高/删除商店上限、清玩家存档、扩大隐私数据类型或改云端。首个完成凭据未落盘即退出进程仍是既有不可恢复边界；当前只在已保存的复活原局范围提供棋盘重启恢复，不暗增普通所有对局保存。
- 写集：js/main.js、js/render/board-render.js、js/core/{coin,ad-rewards}.js，相关test/{ad-main,ad-rewards,solo-resume-main,ui-smoke}.js，既有tools/preview-level-entry.cjs增加toolads隔离模式与可指定本机端口；其余工作树改动/角色归属保持。未新增素材或音频、未变现有功能规则（除用户本轮明确的局内广告规则）。隐私2026-10-15.2已披露自愿道具奖励/本地完成记录，无新数据种类，正文不改。
- 核心worker Erdos（01a13fdd-063e-71c1-aa1c-2bc7f49bb820，配置Sol/medium）只写coin/ad-rewards及对应测试；主会话集成Main、交互及显示；独立Aquinas只读QA。核心ad-rewards通过103故障/重载用例、三道具各超过10次、商店满额与旧记录兼容；coin、coin-receipts、retention-wallet通过。主会话ad-main、ad-lifecycle、commercialization、solo-resume、solo-resume-main、daily-client、board-press、ui-smoke与语法通过。首次solo-resume-main因测试ad替身缺isRealRewardedAvailable导致安装棋盘中断，补齐替身真实接口后原断言通过，未改玩法迁就测试。
- 独立QA首次发现P2：touchstart即请求不能滑离取消。已改为Board记录原core/触点ID/起点，抬手同目标且移动≤8才触发；滑离、多点、系统取消、后台均清待点击。Main原生确认进一步区分“+”与真正观看；确认取消不请求，后台确认不播放。不得将首次失败覆盖为从未发生；收尾复验另记。
- 实际浏览器运行：真实Main/Core/Board，页内存档与隔离wx SDK，未调用真实广告或云。390宽真实指针：点击+先显示确认（请求0），取消仍0；再确认并完整关闭后锤子0→1、请求1、商店计数0。零库存三宽320×568、390×844、430×932及390宽2/1/12数字角标已实看，居中/文字/安全区无覆盖；图片在/private/tmp/match3-solo-tool-ad-20261015/。运行验证入口为本机53947的toolads=1模式，不属于微信候选运行代码。
- 当前静态主包4,171,034/4,194,304（余23,270），总包5,966,399，package-budget通过；旧预览3758.8KB不能当新源码的实际包体。上报false、mock=false、真实广告开关保持true；不改后台配置、不部署云函数、不提审/发布。后续开发预览只在既有本次验收传输范围内生成。
- shared-memory沿用已读同任务规则；核心worker命中并读combined-reward-wal r1用于复用已知事务顺序，不当跨项目或真机证明；本域不推广候选。候选none，事实/方法已保存在本记录。用户视觉最终验收仍以本次修正样式为准。
- 收尾独立QA：Aquinas复验/tmp/solo-ad-independent-qa.cjs共23项通过（退出0），原触控P2关闭；独立查看四张三宽/数字态图片通过。后续检测到其他owner更新game-core/solo-resume/关卡输入与battle-ui，主会话补跑受影响ad-main、solo-resume-main、solo-resume（当前30故障/重载/计时项）、solo-snapshot、ui-smoke通过；独立QA仅重跑其23项probe再通过，两者均核对执行期间相关源码size/mtime稳定。只接受本域结论，不为其他玩法或整包发布放行。
- 更新的普通开发预览已在用户关闭其他工具窗口后生成：原项目、Stable 2.02.2608040/基础库3.16.2，二维码标明2026-10-16 00:37失效；实际主包3767.2KB、catalog1753.3KB、总包5520KB，符合当前4M/4M/30M限制。没有修改包限制、忽略规则、后台配置、云函数部署、提审或发布。生成前曾因窗口状态变化进入本项目真机调试二维码流程并发生测试代码传输，未扫码连接设备；随后退出并明确生成上述普通二维码预览，不将两者混称。最终二维码留在微信工具窗口，图案未写入仓库/记忆。
- 最后一次静态检查为主包4,175,628/4,194,304（余18,676）、总包5,970,993，包含当时工作树其他模块的并行更新，不将净体积变化全部归于本域。真实预览值与静态值分别记录，不推算伪精确bytes。上报仍false、mock仍false；此次没有代替用户观看真实广告或伪造玩家资产。

### 开发预览已生成、实际预览包体通过（历史）（2026-10-15）

- 用户明确允许仅为包体检查与真机验收生成本次候选开发预览，包含必要代码传输；上报继续关闭，不改微信后台配置、不部署云函数、不提审或发布。本轮只点击原项目“预览”，未点击版本上传/自动预览/真机调试或后台入口；没有创建发布版本号或将预览冒充正式版。
- 原目录match3-wechat、原AppID、Stable 2.02.2608040/基础库3.16.2，输入仍为HEAD dea08fb＋本地现有未提交候选。微信工具完成编译、打包和本次授权预览传输，显示“上传代码完成”，二维码生成成功；这是开发预览所需传输，不是审核或正式发布。二维码标示2026-10-15 21:55（上海时间）失效，已留在工具窗口，未保存二维码到仓库/记忆或对外分享。
- 实际“代码包”对话框：**主包3758.8 KB，/catalog/分包1753.3 KB，总包5512 KB**；工具另显示编译后约5.4MB。按工具恢复的主包/单分包4M、分包总包30M限制，当前预览包通过；主包显示值距4096KB约337.2KB。数字保留UI原始精度，分别四舍五入，不伪造精确bytes，也不将先前12771KB本地代码或静态估算替代实测。后续源码/配置变化需要重新核对，正式提审/发布产物不由此自动批准。
- 编译提示167项属于“以下文件没有上传”；已显示的100项均标packOptions.ignore，包括cloudfunctions业务源码、历史levels、旧音频/旧素材/512源图及测试。UI明确另67项未展开，不冒称逐项检查完整产物清单。未改39条ignore或移除活跃资源；既有package-budget/素材清单/每日引擎及本地QA有效证据复用，未为生成预览重跑不变测试。
- 生成前核对AD_CONFIG=true、debugMockAds=false、REPORTING_CONFIG=false、原AppID/基础库/catalog配置；隐私仍2026-10-15.2。项目配置/game入口无新增diff；本轮产品/存档/音频/美术不改。沿用同任务shared-memory及已完成独立预检，此次只有UI预览操作与证据登记，没有新增手机/真实广告/云部署一致性通过声明。
- 下一步由用户用有权限的测试微信扫一扫当前工具二维码；确认进入猫猫开心消开发预览，记录设备/OS/微信/基础库及本次来源。先首页/图鉴/隐私，再按[手机清单](ad-activation-draft.md#device-user-steps)执行；真实广告启用，入口可能请求真实广告，模拟与上报仍关。云端本轮未部署，双账号/每日/图鉴验收仍须确认其与候选匹配。若二维码过期，仅重新生成同候选预览，不扩大为后台配置/部署/提审/发布。候选记忆none，任务证据已有本记录。

### 工具属性恢复、编译通过，正式包体仍待取得（历史）（2026-10-15）

- 用户授权继续定位/修复MaxCodeSize与MaxSubPackageLimit错误、做实际包体检查；保留存档和现有配置，不改玩法/包限制，上报关，不操作微信后台、不上传发布。沿用同任务shared-memory批准召回及现有任务归属。范围未扩大为上传/预览授权。
- **编译错误已恢复**：本机Stable 2.02.2608040、原目录/原AppID、基础库3.16.2。工具详情最初名称回退为match3-wechat、显示未发布、项目配置限额0M；这些是缺失的运行时元数据表现，不当作账号真实状态。通过UI打开“详情→项目配置”后，20:56:51重新取得属性，显示真实名称、已发布状态及30M总包/4M主包限制，并自动编译启动首页。21:03:31再次执行“工具→编译”，首页正常、0错误/1条Harmony平台提示；未请求广告或进入业务对局。限制由工具恢复，未人工填写/扩大。
- 定位证据：只读安装包reactiveProject.js的isAttrEqual会直接访问attr.setting；DevtoolsProject.attr缺setting时通过项目服务取属性，详情配置页亦有请求/刷新路径。已确认故障位于工具属性缺项及其未防护访问，不是包体超限；最初缺项的外部成因未证实，不能断言登录过期/网络故障或所有同类错误同因。没有修改安装源码、手工伪造attr或导入另一AppID。
- 恢复机制补核：详情父组件610fa…在项目配置tab点击/面板显示effect调用requestProjectAttr(true)，dccf816…随后取属性并更新项目/运行时元数据；不能误说子组件cbb614…挂载主动刷新。只读worker独立复核当前三份记录通过，确认未把普通编译、12771KB或静态估算冒充发布包；据建议将手机清单改为“实际正式打包产物”。focused diff检查通过，独立结论不覆盖未取得的包体或手机验收。
- 本轮没有清任何编译/数据/文件/授权缓存，没有重新登录、重装、整体退出工具或调整安全设置；玩家存储未清理，原存档首页仍可加载。两项目JSON相对原状态无diff，private配置基础库3.16.2/urlCheck=true/bigPackageSizeSupport=false等保持，39条ignore及空include保持。AD_CONFIG=true、mock=false、REPORTING_CONFIG=false不变，产品/测试/音频/美术均未修改。
- **正式包体仍未取得**：基本信息的“本地代码12771KB”不是本次最终发布包，不计为超限/通过；代码依赖分析页在本小游戏中未生成可用统计。只读安装工具代码确认上传对话框挂载会POST检查上传状态/最新版本；最终确认流程在本地packCodes后直接doUpload，没有已确认的正式UI只打包暂停入口。因此未点击上传/预览/真机调试，不拿缺失结果冒充实际包体。CLI只读preview --help未发现只编译/仅打包选项，未执行preview。原静态主包4,161,272、总包5,956,637证据继续有效，但不能代替最终包。
- 有界只读worker Kierkegaard（配置Sol/medium，01a13f9e-f74e-7a11-b281-b0b69f0adddb）定位属性、缓存、pack/上传边界；主会话操作UI，不让worker同时控制工具。其源码检查不代替主会话运行观察，也未核实子代理实际runtime。安装代码仅本地读取，不保存或上传大段第三方源码、账号缓存或凭据。
- 下一步仍需取得正式打包产物及匹配候选的手机证据；在本轮不后台/不上传约束下，未执行会传输代码的流程，不申请或推定豁免。工具可再次普通编译，原手机清单保留；不宣称整体上线放行。候选none：此次特定工具恢复与边界已保留于本记录，最初缺项成因未闭合，不推广为通用修复结论。

### 微信本地打包与上线前核对（历史）（2026-10-15）

- 用户授权完成可本地执行的实际微信打包检查及上线前核对，列出手机配合步骤；上报继续关闭，不操作微信后台、不上传发布。广告保持上一轮明确批准的本地测试候选enabled=true，mock=false；无新的真实广告请求授权推定。
- 当前结论：**实际微信编译受工具错误阻断，尚无实际代码包大小/包内容或手机验收结果，不能放行上线**。输入为HEAD dea08fb＋当前既有未提交工作树；不是单独HEAD产物，也未生成新版本号。两广告ID与隐私2026-10-15.2不变。
- 本机微信开发者工具Stable 2.02.2608040，原项目目录match3-wechat、原AppID、基础库3.16.2。通过本地UI直接打开既有项目，自动编译及工具菜单编译均失败；改用仅“重新打开此项目”后仍失败。构建日志先报`Cannot read properties of undefined (reading 'MaxSubPackageLimit')`，再报`MaxCodeSize`，模拟器启动失败；调用栈为工具自身`reactiveProject.js isAttrEqual → updateProject → getGameJSON`。只读核对已安装工具该函数，确实直接访问项目属性对象的setting字段；**缺失原因未确认，不能判定为包超限、游戏源码缺陷或账号无资格**，不向游戏JSON补造MaxCodeSize字段。
- CLI尝试受本机服务端口关闭限制，已改用UI；没有开启安全设置、修改AppID/基础库、清缓存/存档、重装工具或修改工具源码，没有点击预览/真机调试/上传/云控制台。预览二维码也可能涉及代码传输，本轮未生成。原项目project.config.json与game.json无新增diff。
- 本轮因用户要求当前打包/发布核对，补跑最小本地发布检查：package-budget通过（主包4,161,272/4,194,304，余33,032；总包5,956,637/31,457,280，110文件）；open-source-and-assets通过（仅自动清单检查，不代替账号商业授权）；sync-daily-engine --check通过4文件（只证明本地两端一致）。既有广告/钱包/复活/隐私测试复用，不重复跑全库。上报false、映射空，分享兜底禁用、严格完整观看发奖、当前隐私文本状态已只读核对。
- 独立只读QA Schrodinger（worker配置Sol/medium，01a13ed0-eae4-7213-837f-c35c41fe4dbb；未实现、不控制微信工具）复核跨域记录：不能把历史SDK/本地fixture或页面可打开当当前整包通过。10/4已有用户报告客户端和battle上传，仍缺精确版本与当前修改对应关系；不能断言线上仍为9/30版。当前双账号PvP、手动领奖/真实跨日、图鉴成长/跨设备以及两平台真实广告仍缺匹配候选证据。
- 后续按[可执行手机配合步骤](ad-activation-draft.md#device-user-steps)处理：先恢复本地编译并确认代码包，再确定与当前候选一致的手机获取渠道/匹配云端，最后逐项手机验收。无现成匹配手机包时，本轮“不上传”范围下不能补齐真机项；另行批准有限测试包传输后才执行。线上漏斗可观测门槛仍待在上报关闭约束下明确验收方式；没有擅自启用上报。素材台账的生成账户适用商业条款确认记录仍需运营核对，现有批准不可凭旧空勾选重复作废。
- shared-memory-workflow沿用本任务批准召回，包体范围补召回hit functional-preview r1（本轮仅相关性结果，未新采用为打包经验）；无匹配工具错误的已批准修复。临时工具错误原因未闭合，不提炼成方法；本轮候选none。没有Git提交/推送、后台变化、云调用测试、上传或发布。
- 独立复核收尾：Schrodinger对本段、package-structure当前快照、ad-activation-draft第5节返回限定文档PASS，确认授权范围、10/4上传事实、工具错误与静态/实际包体区分准确；不代表打包或上线通过。三文件focused diff检查通过。本轮仅改上述三份既有发布记录，无产品/测试/素材改动。

### 已批准的本地测试候选启用（历史）（2026-10-15）

- 用户对上一轮精确方案明确回复“好”：采用B/C隐私增量，仅开启本地广告总开关；模拟与上报继续关闭，不主动播放、不操作后台、不上传发布。本轮依此执行，不扩大权限、不再重复询问同一批准。沿用同任务有效shared-memory与记录。
- `js/core/config.js`的AD_CONFIG.enabled已为true，debugMockAds=false，REPORTING_CONFIG.enabled=false且映射空；两ID不变。分享兜底仍显式禁用。启用/查询可用性不自动创建实例；用户在微信内触发激励入口或符合插屏条件的单人结算离开时才可能请求真实广告。
- `privacy-policy.js`已采用已审B的3段及C的4段，版本2026-10-15.2；原始生效日期、运营主体/联系渠道及其他披露保持，确认稿逐段同步。正文确认仅覆盖本地测试候选，不是微信隐私声明/设备/平台审核或正式发布通过。
- 相关断言随候选状态更新，保留“填ID但关闭仍零实例/零展示/零完成事件”的回退用例，另验“启用后能力可用但仅查询仍零创建/零展示”。privacy-reader、ad-lifecycle、commercialization、analytics、release-gates、受影响语法均通过；所有广告调用测试使用隔离SDK/存储，没有连接真实微信广告或玩家数据。
- 静态主包4,161,272/4,194,304（余33,032），总包5,956,637，package-budget通过；尚未做微信实际打包、iOS/鸿蒙或真实广告验收。正文/文档/代码focused diff检查通过。本轮小配置/既定文案采用直接完成，无新的独立QA或平台通过声明。
- 交付：本地候选已就绪，真机清单仍逐项未验。本轮未打开微信端播放广告、未后台/云测试/上传/部署/发布/提交推送；后续操作按明确授权继续。候选none，本轮批准及结果已有此记录。

### 两项资料确认与启用批准前状态（历史）（2026-10-15）

- 用户明确回复：两项原生广告API未要求在MP指引单独声明；既有广告位可直接用于开发版/体验版真机测试。这两项资料问题关闭，不重复索取开通/ID/声明清单/另一套测试位。按用户提供的项目适用确认记录，不冒称已登录后台核实或已获真实广告测试结果。
- 已据此收敛`ad-activation-draft.md`：B中移除待补服务方表的承诺和材料阻塞，说明微信原生能力/禁用分享兜底/游戏自身处理；C保留奖励日志与原局快照的真实披露。B/C仍待用户批准采用。用户对测试办法的确认不自动解释为授权将enabled改true；原先“确认后再启用”的阶段要求继续保留。
- 本轮仅更新两个记录文档，未改代码、配置或运行隐私正文；广告/mock/reporting仍false，两ID保持预填，分享兜底禁用。无广告请求、后台操作、上传发布或Git操作。复用同任务有效记忆与测试，不因文档更新重复跑应用检查；focused diff通过。候选none，用户确认已在本记录保存。
- 准备请求的下一步：采用已整理的B/C作为本地启用候选隐私正文，开启本地AD_CONFIG.enabled；debugMockAds与REPORTING_CONFIG继续false，不主动播放、不操作后台、不上传发布。用户点击入口后会请求微信真实广告，可关本地开关回退。待该精确范围明确批准再执行。

### 已完成转来答复归类与禁用分享兜底（历史）（2026-10-15）

- 用户转来隐私、云测试/测试号/试玩、分享兜底资料，未附官方链接或工单标识。本轮沿用同任务shared-memory与已确认“无分享领奖、完整视频才兑付”边界；对答复作适用范围核对，不推定为广告启用或平台操作授权。
- 从微信官方API定义复核disableFallbackSharePage自3.7.7可用、默认false。为落实已确认产品规则，在`js/core/ad.js`激励实例创建处显式传true；未改奖励算法/插屏/运行开关，不按onLoad、分享或启动query发奖。用户转述的1004触发及回调细节尚未独立取得官方正文，不以此新增分享领奖分支。
- `test/ad-lifecycle.js`增加禁用参数、无isEnded的分享形状结果不能完成、真实视频完成不退化；`test/ad-main.js`验证wxad_fallback_share启动query不加心/库存或发起广告。两测试、commercialization、语法通过；零实例关闭回归保留通过。静态主包4,158,871/4,194,304（余35,433）、总包5,954,236，package-budget通过。尚无真实SDK/设备验证。
- [资料处理与剩余问题](ad-activation-draft.md#ad-official-materials)已更新：未列标准API不等于无需任何披露；云测试/测试号/试玩不等于现有广告位的测试资格；知识库未明确频控不等于平台无限制。剩余集中为当前指南与本小游戏声明的适用范围，以及两个现有广告位的具体真机测试/限频办法。不重复索要开通证明/ID，不要求无依据的SDK材料。
- 仅本域小修复/回归与记录，由本会话直接完成；没有独立QA或真机通过的新声明。广告/mock/reporting维持false、两ID预填不变；未修改隐私正文、AppID、域名校验、云端或后台，未创建云测试、上传、发布、提交推送或发送客服消息。候选none，已在本记录保留有界事实与限制。

### 已完成官方资料检索与剩余问题收敛（历史）（2026-10-15）

- 用户明确确认流量主已开通、激励/插屏广告位已创建，ID与代码示例已齐。按用户提供的信息记为已具备，不再索要重复证明；不冒称本会话登录核验过后台审核状态。授权本轮公开官方资料研究与记录，不启用广告/上报，不登录或操作后台、不上传发布。
- 已核对微信团队小游戏API定义原文、腾讯《关于广告》、腾讯官方政策索引及2024流量主成长营公开课件。API定义提供实例、完成回调、错误和版本信息；通用隐私页不等于两原生API的专属处理清单，旧课件不作为2026最新规范。2024课件下载到/tmp只读，核对文字与相关页面，不把第三方PDF放入发布包。
- [结果与可直接发给客服的问题](ad-activation-draft.md#ad-official-materials)已更新。缺口仅保留：专属隐私/平台声明分工、当前合规真机测试方法及iOS/鸿蒙支持、最新展示/频控和分享回退参数语义。用户当前只需补账号私有的现有隐私指引内容（如有）及一次性客服答复；公开通用技术资料由本会话整理。
- 来源范围：developers.weixin.qq.com此前浏览器安全策略拒绝未绕过；使用独立公开官方GitHub仓库、腾讯隐私站和培训站。培训PDF网页读取超时，改为获准公开下载后pypdf提取/渲染核对；未采用第三方转载、其他平台测试ID或他方游戏的隐私字段。具体引用、页码和局限在草案中记录。
- 本轮仅修改两个本域文档；配置、隐私正文2026-10-15.1、代码和测试均不变，已有有效关闭证据复用，无重复构建/回归。应用广告/mock/reporting仍false，既有两ID保持预填。无客服消息发送、后台变化、真实广告请求、上传或Git操作。共享记忆沿用此前适用范围，无新的批准隐私经验；候选none，来源结论已有本记录。

### 已完成关闭正文修正与官方资料清单（历史）（2026-10-15）

- 用户明确批准将当前隐私正文修正为“广告位已预填但未启用”，并要求列清启用前官方资料/获取入口；广告/mock/上报仍关闭，不操作后台、不上传发布。当前任务复用既有shared-memory召回，无新的隐私批准条目；此次直接用户决定高于草案的旧待确认状态。
- 已采用草案A的两段关闭状态文字，版本2026-10-15.1、更新日期2026年10月15日；原始生效日期、运营主体/联系渠道与其他正文保留。同步`privacy-policy-review.md`，保留已确认关闭正文标记。B/C广告启用与原局日志增量、服务方信息仍是草案，未混入或标记获批；后台声明/广告启用/发布也未获批。
- [官方资料获取清单](ad-activation-draft.md#ad-official-materials)列明四类缺项：本小游戏资格及广告位状态、原生广告服务隐私/主体与处理信息、本小游戏现有平台隐私声明、完整接入/运营/设备与测试规范。给出微信公众平台、腾讯官方隐私索引、已知API文档入口及客服索取模板；账号内菜单未验证，均明确为查找关键词，不虚构路径、政策或资格结论。
- 本轮小范围文案/版本与资料记录由本会话直接完成，不新委派。验证：privacy-reader通过正文一致性、完整换行、三档屏幕分页/拖动/返回及确认门禁；release-gates、相关语法通过。静态主包4,158,839/4,194,304（余35,465），总包5,954,204，package-budget通过。广告关闭零实例与上报默认关闭复用上轮未变config/ad/analytics证据，本轮未修改这些文件。
- 限制：公共资料检索未取得适用于本小游戏原生广告的完整服务隐私清单；腾讯官方索引仅证明查找入口，不替代专属条款。没有登录/操作微信后台、发客服消息、真实请求广告或上传发布。当前确认只覆盖关闭正文；后续资料补齐、正文确认及启用/测试授权仍按各自范围执行。候选none，事实已有本记录。

### 已完成广告位预填与启用前草案（历史）（2026-10-15）

- 用户明确批准填入两ID，但广告/mock/上报继续关闭；先准备隐私增量、真机验收清单，确认前不启用，不操作后台/上传/发布。当前已填`adunit-035fb16fac04d21b`与`adunit-d4c3fac373ac66c1`，其归属/资格/审核状态仍未后台核验。
- 本轮仅改`js/core/config.js`的两ID与说明，`test/ad-lifecycle.js`的安全默认断言及“填ID仍关闭”回归；适配层不复制执行用户示例的提前初始化，奖励/互斥/回调/频控合同保持。
- 激励示例show失败后load/show重试与现有方向相符，但片段末尾缺`)`、未包含完整观看判定/兑付；插屏示例只覆盖能力检测/创建/show。两份为用户提供示例，不据此宣称已核实最新官方完整规则或隐私字段。
- [启用前草案](ad-activation-draft.md)已保存：关闭候选的状态措辞、启用候选广告披露、本地日志/原局快照保留边界、服务方待核实项及iOS/鸿蒙逐项清单。正文尚未采用，也未把旧approvedForRelease标记当本次批准。旧运行正文“ID为空”与当前预填候选不一致，需确认后修正；当前不是可发布候选。
- 验证：ad-lifecycle、commercialization、analytics、配置语法通过。真实适配器配隔离SDK计数器验证“两个ID已填、enabled/debugMockAds=false”：三种激励placement和6次结算离开均false，创建/展示0次，无完成/发奖事件；上报仍false且映射空。静态主包4,158,751 /4,194,304（余35,553），总包5,954,116，package-budget通过，未做微信实际打包。
- 共享记忆按新增隐私范围补召回，仅hit已读shop-list-cta r1，用于保留关闭时隐藏入口边界；无适用广告隐私批准条目，不当作法律/平台确认。本轮小配置/草案范围由本会话直接完成，未委派、未改owner模型；候选none，事实已有本记录。
- 下一步为用户审阅草案及补齐具体微信广告服务方隐私/后台声明资料；批准正文、批准测试候选启用、后台操作、上传发布各按相应明确范围执行，不由预填ID或示例推定授权。暂无真实广告、iOS/鸿蒙或平台验收结论。

### 已完成每日挑战与毛线测试修复（历史）（2026-10-15）

- 用户授权查清并修复`daily-client`与`yarn-spread`两项既有失败，按当前已确认玩法核对，不改规则迁就测试；完成相关回归及独立QA。广告/mock/上报仍关闭，不操作微信后台，不上传/部署/发布或Git提交推送。本域与三消-主综合归属不变。
- 当前状态：两项根因已查清、测试端修复与相关回归完成，非实现者Fermat独立QA通过，无本轮阻塞。沿用现有Git工作树HEAD dea08fb＋既有未提交修改，本轮写集限定两个测试与本记录，产品源码/关卡/冻结每日引擎/云端/config/素材不改。
- 每日根因：测试用Object.create跳过Main构造，未提供screen；真实onMatch读取screen.reduceEffects触发TypeError，经每日swap错误处理变成false。临时诊断副本`/private/tmp/match3-daily-diagnostic-main.js`仅用于暴露原异常，未修改产品catch。测试补真实screen合同，正常/减弱特效各走25步，核对25个检查点、真实Main音频回调参数以及不写体力/库存；原跨日、待提交、12000ms超时/迟到回调断言保留。daily-client、daily-core（固定策略2130，达标线2000）、daily-progress通过，未把测试环境缺项改成产品默认值。
- 毛线根因与修复：旧测试把第11关固定为yarn+score并硬编码后续投放关号，已不符合当前第8关单毛线教学、11起混编。改为真实内容合同检查与明示合成机制fixture两层；扫描11–130实际28个毛线组合（不硬编码28或投放编号），双向检查目标不可绕过。使用确定性RNG保留三击源头、每2有效交换蔓延、最多3藤、无效交换、三种工具不推进/不扣步、邻消保猫、连锁火箭每操作一击与死局自动重排断言。yarn-spread及语法/diff检查通过，未改任何玩法源码。
- 委派：Averroes仅写yarn-spread，主会话写daily-client与本记录，Fermat独立只读QA。均明确请求默认Sol/medium；实际子代理runtime不可核验，不借父日志归因。本轮没有改变owner模型。
- 共享记忆：approved项目召回hit并读`match3-game-request-settle-once`r1原文；仅用于保留本项目每日显式超时、迟到不重复结算、失败保留pending边界，不预先认定当前测试通过。functional-preview r1仅召回未采用；毛线没有匹配批准经验，以当前项目记录与源码为准。候选暂none。
- 最终独立QA：`/private/tmp/match3-daily-yarn-independent-qa-20261015/REPORT.md`为PASS。原daily缺screen负对照复现TypeError；两正对照完成25真实交换/25检查点/2130分，500金币重复回调本机只入账一次，无体力/库存写。旧yarn原脚本在当前内容上预期失败；新测试通过，四种/tmp机制变异（伤害加倍、每步蔓延、上限增一、去掉自动重排）均被断言检出。QA只读仓库、无实现责任，不把伪SDK测试当服务端事务/真机证明。
- 有效命令：`node match3-wechat/test/daily-client.js`、`daily-core.js`、`daily-progress.js`、`yarn-spread.js`均退出0；独立`daily-fixture-control.cjs`及`yarn-mutations.py`退出0（其中负对照/各变异子进程退出1为预期）。修改的两个JS语法与focused diff检查通过。产品源码与上轮已接受QA源码快照逐文件一致；冻结daily/client/cloud目录无新diff。已有未提交修改保留，不重跑不变的全库/包体，不声称全仓或真机全绿。
- 交付：本轮只修改两个测试和本文件，两项旧失败已闭合。广告/mock/reporting仍false、运行ID仍空；用户提供ID只登记下节。未访问后台、运行真实广告、上传、发布或提交推送。候选none：诊断和修复方法已充分记入本记录，不重复提炼。

```memory-usage
{"schema_version":1,"memory_id":"match3-game-request-settle-once","revision":1,"project_id":"match3-game","task_id":"/Users/Admin/codex/sanxiao/match3-game/docs/release/monetization.md#ad-integration-handoff","date":"2026-10-15","stage":"validated","purpose":"execution","action":"修复每日fixture时保留真实Main与SDK适配器的12000ms超时、迟到不重复结算及pending恢复断言；仅补screen合同。","check":{"result":"effective","evidence":"docs/release/monetization.md 每日挑战与毛线测试修复；daily-client通过及/private/tmp/match3-daily-yarn-independent-qa-20261015/REPORT.md独立正负对照，仅本地消费者范围。"},"delivery_id":"/Users/Admin/codex/sanxiao/match3-game/docs/release/monetization.md#ad-integration-handoff"}
```

### 用户提供的广告位资料 · 2026-10-15（已预填，未启用）

- 激励视频：`adunit-035fb16fac04d21b`。
- 插屏：`adunit-d4c3fac373ac66c1`。
- 用户后续已明确授权预填本地运行配置，现已填写，但广告/mock/上报仍关闭、不创建或请求广告。未访问后台核验所属AppID、资格或审核状态，不据ID推定可投放。
- 用户可提供官方代码示例及对应官方文档链接，供后续原生API/回调/兼容性核对；不阻塞本轮测试修复，不需要密钥或登录信息。收到示例也不自动授权启用、后台操作或上传发布。

### 已完成复活跨重启与无损包体（历史，2026-10-15）

- 用户已批准下一节最小方案及本地无损包体优化，保持视觉/音频/既有功能；广告、模拟、上报继续关闭、ID空。不操作微信后台、不上传/部署/提交推送/发布。沿用同一任务锚点、广告接入本域与三消-主综合归属。
- 状态：本次选定的本地实现、受影响回归与非实现者独立QA已完成，待用户接受；不是整体发布验收。新增`solo-snapshot.js`稳定快照、`solo-resume.js`prepared/ready/action/result日志。完整观看先存含一次＋5步/限时＋30秒结果；重启须用户确认恢复原局，不重扣体力。每次操作先存输入与随机seed；未完成操作重放一次，库存用`coin.useItemOnce`收据/WAL防重扣。GameCore/grid只增可选随机源，默认普通/PvP行为及每日冻结文件保持。内容版本不符保留记录拒绝恢复；旧记录由id+revision的同步比较写入及异步重放后的再次校验拒绝。
- 计时：恢复前暂停，确认继续后走时，后台/引导保存暂停；无hide的异常退出保守扣除最后active时间锚点后的经过时间，避免杀进程回补计时。换色反馈阶段先超时的操作记录timeoutBeforeResolve，重放保持相同失败结果，不把已超时局改成目标胜利。快照不包含渲染、音频或异步队列。
- Main接线包括原生“恢复原局/稍后”弹窗、真实Board绑定、正常操作稳定点、道具扣费、失败重试、胜负结算与最终离开；retention-client可选resumeSoloId使已证明复活的同局不在启动时提前提交为结束。资源/功能默认无恢复记录时原流程不变；仍不能证明完整观看回调到首次完成凭据落盘前的杀进程窗口。
- 无损优化worker Galileo仅重压缩`res/home/duel-cats.png`，504,468→422,466字节，减少82,002。原件`/private/tmp/match3-lossless-png-20261015-cjyckg8e/originals/res/home/duel-cats.png`（与HEAD dea08fb同路径资源逐字节一致，可从Git恢复）；完整1,572,864字节RGBA（含透明RGB）与非IDAT块完全相等，CRC有效，无ICC/gAMA/sRGB块被删除；其他23张活跃PNG不变、音频与映射不改。Bacon另以Python标准库独立解码复核通过。最终静态主包4,158,671 / 4,194,304字节，余35,633；静态总包5,954,036 / 31,457,280字节，package-budget通过。没有放宽预算、修改打包配置或忽略活跃素材；微信实际打包未做。
- 最终有效证据：snapshot worker新测试覆盖130关与障碍/特殊往返、确定性重放和畸形输入，new-obstacles/special/timer通过；主会话solo-resume journal22故障/重启/clock/CAS场景、solo-resume-main真实Main/Board虚拟动画钟、ad-main、stamina-purchase、coin/coin-receipts/retention-wallet、ad-rewards64、retention-client、solo-economy、battle-client、daily-core、ui-smoke/release-gates通过。新增支出WAL曾吞掉已有item恢复granted标志，受影响ad-rewards回归发现后修复返回传播，再跑通过；不算故障收敛完成前的已验。
- 独立QA首轮Bacon：8通过/2失败（同一旧记录覆盖根因），脚本`/private/tmp/match3-revive-independent-qa-20261015/review.cjs`保留失败证据；现已用CAS修复、主会话新增复核通过。模型证据更正：Bacon/Fermat引用的Astra/high日志属于主会话，不能据此推断子代理实际模型；Fermat通过支持的default路由显式请求gpt-6.1-sol/medium，实际子代理运行元数据未暴露，不能声称已核验或切换成功。主会话模型未操作切换。Fermat复核color/invalid-swap超时写前/写后故障与重复复活取消再看通过，但发现第二个同标准缺口：Main实时await操作在CAS写回前先扣库存。报告`/private/tmp/match3-revive-independent-final-20261015/REPORT.md`与boundary原失败断言保留。两轮同标准拒绝后，已委派固定escalation路线Astra/xhigh仅修Main操作身份/扣费前校验及最小回归；实际子代理runtime同样不可核验，主会话模型未改。升级修复绑定原core/run/startedAt、操作请求和record，库存及任务等副作用前复核id/revision；合法clock/timeout写入才推进操作版本；旧回调与finally只能清自己的pending。restore安装前再核场景/core/请求与磁盘。Mencius仅改Main、solo-resume导出current、最小Main测试；请求固定Astra/xhigh，工具角色与本地配置可核，实际runtime不可核。
- 最终独立QA Fermat通过：原`boundary.cjs`逐字节未改、指向新源码复核7通过/0失败；color超时及写前/写后故障3通过，invalid-swap超时1通过，正常取消再看/后台重放/guide暂停3通过，旧回调与新pending隔离/迟到restore2通过；最新solo-resume-main退出0。报告`/private/tmp/match3-revive-independent-cas-fixed-20261015/REPORT.md`，测试源码快照与当前JS一致；原两轮失败证据保留，未变证据复用。最后复核为非实现者，未写仓库代码；本地有界QA无新阻塞。
- 既有失败另列：`yarn-spread.js:35`断言第11关旧yarn/score配方，与当前ice/moonbud内容不符；`daily-client.js:107`交换断言失败，本轮前Main备份配原测试同样复现。未修改关卡或每日冻结引擎/接口来让测试变绿。不能据当时有限测试声称整个仓库全绿；这两项现已在上方“每日挑战与毛线测试修复”中确诊为测试端问题并闭合，保留本段历史失败证据。
- 交付边界：当前本地范围完成，代码语法及差异检查通过；未调用真实广告、后台、上传、部署、Git提交/推送。广告/mock/reporting仍false、两个广告位ID空、上报映射空。无真实iOS/鸿蒙、真实杀进程/广告SDK与微信实际包体证据；未来启用仍需隐私增量和平台授权验收，不能把本地模拟当发布放行。共享记忆复用同任务shop-list-cta r1；新增快照/无损优化范围补充approved项目召回，仅返回已读shop条目，无匹配快照/压缩批准经验；不将其作恢复算法规则。功能预览记忆未代替广告验收。候选none：已有源码和本记录充分覆盖本次事实/方法，不重复提炼或申请批准。

### 已完成本地可靠性修复（历史）（2026-10-15）

- 用户已批准本地兑付、回调与异常恢复实现、相关测试和独立QA；广告/模拟/上报维持关闭，ID空。不操作微信后台、不上传/发布。复活跨重启仅出最小方案，待用户确认。保留三消-主综合归属及本任务原锚点，以下10/14梳理作为来源历史。
- 当前状态：本地功能修复完成，独立非实现者QA通过；包体门禁未通过，整体集成/发布仍阻塞，待用户决定包体处理及复活方案。主会话负责ad/Main/audio及受影响状态文案；worker Hubble负责coin/heart/ad-rewards及逐写点测试；Bacon独立只读QA。两worker工具类型与本地worker.toml均固定gpt-6.1-sol/medium；没有变更owner模型或新增角色会话。
- 代码：新增完成观看本机journal；道具库存/额度WAL、体力数量/收据同项落盘；广告统一请求互斥、逐请求listener、等待超时与不确定展示隔离；Main保存重试/原局身份检查、广告占用音频与计时、错误体力显示不可用。完整观看证明首次成功落盘前杀进程仍无跨重启保证；复活仅当前运行内重试。
- 最终有效检查：worker的ad-rewards（62故障案例）/coin/heart/coin-receipts/retention-wallet；主会话commercialization、ad-lifecycle、ad-main、stamina-purchase、audio（新增广告占用）、ui-smoke、release-gates、timer、analytics通过。应用实际代码变动才重跑受影响部分，不把历史总数当本轮证据。Canvas复活待保存与商店心不可用状态在/private/tmp/match3-ad-visual-20261015生成320/375/430截图；主会话已检查320/430，独立QA检查320/375，四行清单/无广告列/禁用状态与完整重试文案无裁切。无真实微信广告或设备验收。
- 明确阻塞：package-budget静态主包4,205,659 >4,194,304字节（超11,355；频控修复后最终复核）；未放宽预算、排除活跃素材、改打包配置或压扁无关源码。本地功能QA与包体/平台门禁分开记录；实际微信打包未执行。
- 独立QA：Bacon首轮`node /private/tmp/match3-ad-independent-qa-20261015/qa.cjs`为19通过/1失败，指出插屏关闭时间写失败后重启可能早于关闭后120秒展示；保留该失败证据。修复为展示前写awaitingClose，恢复遇未决关闭时从恢复时刻重新冷却并清计数。`node /private/tmp/match3-ad-independent-qa-20261015/frequency-rerun.cjs`原失败项及相邻故障10通过/0失败、退出0，原19项输入不变证据复用；真实Main/ad/Audio组合脚本`audio-combined.cjs`通过。独立QA结论为本地功能范围通过，不豁免包体/平台。该项1次实质QA拒绝、修复1轮，无两次失败升级条件。
- 本地应用检查由主会话补足`ad-main`真实Main消费者、`ad-lifecycle`含看门狗防止异步挂起却退出0；频控修复后重跑两项及commercialization均通过。worker初跑stamina旧stub失败已由主会话更新为新接口后通过，不作兑付故障反复失败计数。相关JS语法与文档/源码diff检查通过。包体失败不通过放宽断言处理。
- 范围与限制：全部改动限`js/core/ad.js/coin.js/heart.js/ad-rewards.js`、`js/main.js`、`js/audio.js`、`js/render/ui.js`受影响错误状态文案、三个新增广告测试及既有stamina/audio测试、本文件；既有工作树更改保留。`AD_CONFIG.enabled/debugMockAds=false`、两ID空、`REPORTING_CONFIG.enabled=false`及映射空已源检；无平台/上传/部署/Git提交操作。未知SDK把旧事件广播给新监听器的归因不能由本地请求ID证明；失联时不发奖且隔离未决广告到明确终态/重启。广告期间好友邀请不会自动切模式，需要重新打开邀请。底层本机兑付收据/日期持续保留；journal近期完成列表有64条上限。
- 下一步与授权边界：可另批一次本地包体收敛（优先评估现有运行素材无损压缩，保持像素、映射、音频和广告/上报配置；若需分包或有损处理，另提具体方案），至少补回当前11,355字节并保留余量。此前不会把当前候选称为可发布包。复活跨重启方案见下一节，未实现。候选none：验证结论与故障修复已充分记入本记录，不重复提炼方法卡；任务内复用shop-list-cta r1，functional-preview仍未用于广告验收。

### 复活跨重启：用户已批准的最小方案（2026-10-15）

建议仅覆盖“普通单人失败结算→主动观看复活→恢复这一个原局”，不扩展为全游戏自动续档，不涉及PvP/每日或云端服务。

1. 只在棋盘与结算都已稳定时，广告前写一份原局快照；写失败不播放。记录schema/content版本、原局ID、关卡配置、棋盘与特殊底色、冰/果冻/毛线/花苞/包裹状态、目标计数/分数、剩余步数与时间、原局体力/结算与任务身份。瞬时动画、音频、回调不序列化；不重新扣体力，不以新随机棋盘替代旧局。
2. 快照初始为未证明完成；完整观看回调后，写入同一原局的一次复活凭据与“已经加过＋5步/限时＋30秒”的结果快照，成功后才返回可操作棋盘。重启只恢复已有完成凭据的原局，原局/内容版本不匹配时保留记录并给出明确错误，不向新局兑付。
3. 启动提供“恢复原局”，恢复时计时暂停，用户继续后才走时；记录消费不能早于可恢复快照保存。为防复活快照反复回滚刷局，恢复后的该局须在每次稳定交换/道具/结算边界更新快照或终态；不能只保存广告结束一帧后立刻删收据。这是该方案额外工作量的主要部分。
4. 未收到完整观看回调，或回调后首次证明保存就失败且进程被杀，仍不能靠本地记录证明观看完成；最小本地方案不承诺这个窗口自动补奖。若用户要求该窗口也可靠补发，先核对平台可验证回执能力，再单独提服务端方案，不假设现有API有回执。
5. 独立验收：广告前/完成凭据/恢复后每个写点失败与重启、重复恢复不叠步数/时间、不重复扣心/发结算奖励、道具及新障碍状态一致、内容更新不串局；补充iOS/鸿蒙前后台/杀进程证据。预计另1–3人日，需结合包体余量重估。

用户已确认按上述边界实现；本轮仅本地实现/测试/独立QA，不授权开启真实广告或发布。

### 广告接入专项梳理 · 2026-10-14

- Owner：广告接入；三消-主继续综合实现/集成。状态：规划完成、待用户决定执行；不是广告就绪或发布验收。沿用本节原任务锚点，不新建角色/进度系统。本轮由本会话完成紧耦合只读核对，未委派实现或变更模型。
- 依据：HEAD dea08fb＋当前未提交源码；完整交接节、`ad.js`、`main.js`四入口与生命周期、`coin.js`、`heart.js`、`config.js`、`ui.js drawShop`、`analytics.js`、`privacy-policy.js`及相关测试断言。对照`ui-production.md`清单接受记录、`release-check.md`旧回调修复记录、`content-update-1235.md`当前模式边界。无客户端构建/上传包身份；未重跑应用测试、做运行验收或真实广告调用。
- 结论：入口/价值/频控大体已接好；不能仅填ID开总开关。先处理兑付一致性、恢复与生命周期，再确认披露、平台资格及真机表现。只更新本文件规划，既有工作树修改保留。

| 优先级与项 | 本轮源码事实 / 证据边界 | 执行时的最小工作与通过条件（建议，尚未实施） |
| --- | --- | --- |
| P0 商店额度与库存 | `coin.claimRewardedItem`先写`match3_rewarded_items_v1`再`addItem`写库存；第二步失败时返回失败，但没有撤销已写额度或记录该笔广告待兑付。现有10次/跨日用例未证明此故障路径。 | 先故障注入复现；将本次观看的道具入账与额度消耗绑定同一稳定本地领取标识，沿既有钱包约定做最小可恢复写入。逐写点失败/重启后只补一次、只扣一次，不为恢复要求重看广告；不得覆盖并发正常库存变动或把留存WAL直接视为已覆盖广告。 |
| P0 体力兑付 | `heart.addHeart`直接保存，写失败会抛出；`handleAddHeart`catch仅释放pending，没有待兑付凭据或用户可见保存失败提示。 | 本机保存失败可提示并重试、已保存不重复加心。核对自然恢复在广告期间到5心的边界，保持上限5；不引入道具额度。明确成功反馈仅在持久化成功后出现。 |
| P0 完整观看与重启边界 | `pendingReward`及消费回调仅在内存；`markRewardGranted`仅写事件，不是幂等收据。复活已有core/run/state身份检查，但修改的是内存棋盘；`retention.saveSolo`是任务记录，不是普通局完整快照。 | 区分“请求已发出”“完成回调已收到”“完成凭据已落盘”“奖励已入账”。已持久化的完成凭据可恢复；进程在收到回调之前、或任何完成凭据写入成功之前被杀，本地不能证明完整观看，不能仅凭请求记录补奖。道具/体力先设计本机恢复；复活跨重启需原局快照与幂等恢复，单独批准范围，不能将旧局奖励发到新局，也不能把丢失承诺奖励静默定为接受结果。 |
| P0 同实例迟到回调与互斥 | Promise链核对request；close/error仅核对广告对象。现有回归为每次create返回新对象，只证明不同旧实例不污染新请求；若同对象复用，迟到close可能命中新请求。激励与插屏各有pending，未形成两种广告的共同锁；复活等待与离开结算也未共同互斥。 | 用可复用实例的fixture复核重复/迟到close、error→reject、旧show/load结果、连点与激励/插屏竞争；按实际平台对象生命周期处理监听绑定/解绑和请求隔离，不假设创建必得新对象。只能一个广告占用入口，终态只结算一次。 |
| P0 可用性与挂起恢复 | `realRewardedUnavailable`遇onError或创建失败设true，没有复位；商店调用`isRealRewardedAvailable`会持续隐藏视频列。复活/补心使用另一可用性判断。show成功却没有close/error，以及永不结束的show/load，无终态兜底；插屏可让`resultLeaving`一直为true。 | 统一“未配置/暂不可用/请求中/展示中/待兑付/可重试”语义，暂时错误可有界恢复，不后台无限重拉。设置明确的请求等待上限；展示中的恢复须结合前后台与平台事件，不能用任意短超时把正在播放的广告判成完成或启动下一条。插屏失败/失联最终恢复原导航一次，迟到回调不能再导航。 |
| P1 生命周期/模式/频控 | Main已有前后台计时，Audio已有隐藏与中断暂停/恢复；没有广告专用占用状态。`handleShow`可处理好友邀请；结果页等待广告期间需防止邀请跳转或迟到导航影响新模式。插屏频控保存异常被吞掉，重启频控可能丢失。 | 核对广告返回事件顺序、广告期间来电/切后台、设置静音、计时恢复；邀请在广告流程结束后按安全场景处理。正常单人最终离开结算计数；前三局/120秒、失败后再尝试、重复退出、频控写失败须有保守策略。PvP与每日全程不请求/展示广告，不消费单人库存；保留无Banner。 |
| P0 披露与启用门禁 | 协议2026-09-27.1明确未启用广告；`release-gates`只调用正文确认检查，未校验广告实际开关/披露一致。REPORTING仍关闭。 | 按实际微信服务起草增量、标明待确认，用户确认后再同步后台；加入启用配置/ID/协议版本/确认状态一致性门禁。线上漏斗另以最少显式映射和字段审批，不把本地200条/7天事件当作线上可观测。 |

### 官方资料核对状态（2026-10-14）

- 已读取微信官方组织的[小游戏API类型测试示例](https://github.com/wechat-miniprogram/minigame-api-typings/blob/master/test/game.test.ts)：包含原生`createRewardedVideoAd`、`show/load`及`createInterstitialAd`、`onError/onClose`接线，支持继续采用现有原生适配层；它不是最新广告运营、隐私条款或真机兼容保证。本轮不引入SDK。
- 官方[广告能力入口](https://developers.weixin.qq.com/minigame/dev/guide/open-ability/ad/ad.html)、[完整观看关闭回调](https://developers.weixin.qq.com/minigame/dev/api/ad/RewardedVideoAd.onClose.html)、[插屏接口](https://developers.weixin.qq.com/minigame/dev/api/ad/wx.createInterstitialAd.html)本轮网页读取失败，浏览器进一步被站点安全策略拒绝；未绕过，未声称读到最新正文。这些链接是待核对入口，不是本轮已核实规则的引用。
- 启用前由可正常访问的官方渠道或用户提供的当前官方正文核对：流量主实际资格/广告位审核与测试方式；基础库与iOS/鸿蒙支持；对象复用及回调语义；激励按钮告知、完整观看发奖和取消行为；插屏允许场景/平台频控；后台隐私字段与必要授权、版本审核要求。项目“每3局/关闭后120秒”等是已定产品规则，不能宣称就是平台当前最低要求；冲突时回到用户决策。第三方转载及历史人数门槛均未采为现行规则。

### 最小执行顺序、依赖与估算

以现有原生实现、一个激励位＋一个插屏位、不新增SDK/远端反作弊/大规模上报为基线；以下为人日区间估算，不是报价或平台排期承诺。

| 顺序 | 交付与依赖 | 预计投入 |
| --- | --- | --- |
| 1 | 用户确认本域执行范围；补齐官方规则、后台资格/广告位资料。确定异常兑付及复活重启合同、隐私增量草案与验收矩阵。资料缺失时可继续离线设计，不打开广告。 | 0.5–1人日 |
| 2 | 先完成本机领取标识/可恢复兑付，再修ad状态、同实例回调、互斥、入口恢复与插屏安全导航；Main/coin/heart与三消-主顺序交接，避免并行写共享文件。基线不包含普通关完整快照。 | 2–3人日 |
| 3 | 受影响本地回归与运行状态检查，非实现者独立QA，修复后只重跑失败与受影响项；披露/开关一致性和低敏事件验证。 | 1–2人日 |
| 4 | 正文由用户确认、后台声明同步及真实测试候选的配置/上传分别获准后，iOS与鸿蒙验真实广告、音频/计时/弱网及实际包体；未验证项不得冒充通过。 | 1–2人日＋资格/填充/设备等待 |
| 5 | 汇总一次阶段验收；明确实际候选、全部相关未提交变更、平台记录、观测方案和回退对象，再申请发布。 | 0.5人日 |

基线合计约5–8.5人日；若批准普通单人复活跨重启快照，另预留约1–3人日并重估相关QA。现阶段无新增付费依赖计划；设备、外部服务实际费用及平台审核时间未知。若希望无本机完成凭据时仍保证自动补奖，需要先确认平台是否提供可验证证据，再单独评估服务端方案，不把本地请求ID当防作弊凭据。

### 用户一次性提供的资料与决策

1. 当前流量主是否已开通、有无审核/限制；对应小游戏AppID是否仍为本仓库项目（只需确认，勿发AppSecret）、激励/插屏广告位ID与各自状态，后台官方测试广告方式。可提供去除身份/财务信息的相关字段；无需账号密码、Cookie、后台凭证或玩家数据。
2. 当前官方运营/广告及隐私要求中与接入相关的正文或可访问资料及日期（本轮官方站无法读取）；当前后台隐私声明相关字段、实际使用的服务与信息处理范围、正文确认负责人。
3. 可用iOS与鸿蒙机型、系统/微信版本及测试协作者；期望上线窗口、是否仍按两种广告一起验收。先验激励、后验插屏属于测试顺序，不自动删减或改变上线范围。
4. 复活是否要求“完整观看后杀进程仍可恢复原局＋奖励”。建议先批准评估原局最小快照，不接受发到新局；如不做，需明确处理承诺奖励中断的产品方案后再启用该入口。补心在观看期间自然恢复到满心也需明确提示，保持5心上限。
5. 后续上线前批准最少线上漏斗事件映射、字段及目的，或提供满足既有可观测门槛的替代证据。本次不启用远程上报；广告后台展示量本身不能证明游戏奖励到账。

### 分层验收与回退标准

- **本地**：选择`commercialization/coin/heart/stamina-purchase/analytics/ui-smoke/release-gates`现有入口及最小补充故障注入；必要时覆盖`timer/audio`。逐写点失败/重启、完成/取消/错误/无填充、同实例及旧实例迟到回调、无回调、连点竞争、跨日10次/第11次、补心不占额度与满心、同局连续复活＋5步/限时＋30秒、插屏3局/120秒/导航一次均有行为断言。严格检查失败输出及退出码；测试桩不得调用真实广告或存档。新增用例只补缺口，不笼统重跑全库。
- **独立QA**：非实现者按冻结合同独立验证真实Main消费者与存储结果，尤其“记完成”不等于“已到账”；复核故障恢复与共享模式隔离。输入未变的历史证据可复用，但当前Main/UI已变，必须核对相关性，不能沿用旧通过总数。商店保留四行珍珠清单，320/375/430及安全区检查有/无广告、暂不可用、领取中、待保存、满心、额度满和实际命中区。
- **iOS/鸿蒙真机**：各自记录机型/系统/微信/基础库、实际候选版本及复现步骤；真实完整观看、提前关、失败与恢复、弱网/断网、后台/中断/音频独立开关、连续观看、原局计时、返回和重复点击。普通单人三种placement与插屏通过；PvP/每日进入、返回和邀请不串广告。平台不能自然复现的无填充/杀进程窗口标为未验，离线注入不能冒充真实平台证据。仅使用官方允许的测试方式，不制造无效流量或点击广告。
- **发布**：资格/广告位与最新规则核对完成，用户确认的新正文及后台声明相符，候选`debugMockAds=false`、正确ID/开关与最少上报授权一致；通过本地包体预算及微信实际打包，设备证据对应同一候选；无悬空兑现、重复发奖、永久等待或模式串入阻塞项。用户一次阶段接受后，再对确切版本/上传或发布动作履行操作时授权，不能用HEAD代替dirty包身份。
- **回退**：保留经过验收的无广告候选及存储兼容方案；关闭本包广告后入口隐藏、正常游戏/导航可用、玩家库存/体力/待兑付凭据保留且可恢复，不清玩家数据。现配置是本地常量，没有即时远程熔断；旧已安装包不能靠改本地文件关闭。运营需预先核对后台停投/禁用能力与实际生效范围，执行需授权，不能承诺即时覆盖。回退包上传/发布同样需用户批准；已发生的数据处理不能靠恢复旧“从未启用广告”正文抹去。
- **当前证据与下一步**：仅源码/断言审阅和本文件差异检查，未运行应用/测试/真实广告，未改产品、测试、素材、配置或后台。官方现行规则仍待核实。等待用户资料及执行授权；本轮没有新的已验证可复用方法，候选none。共享记忆沿用上方同锚点usage：shop-list-cta r1读原文并用于保留清单及广告列验收边界；functional-preview r1仅召回，不作广告验收依据，角色未映射跨项目模块。

## 当前本地测试候选配置

广告配置位于 `match3-wechat/js/core/config.js`。2026-10-15已按用户明确批准采用B/C并开启本地测试候选；当前配置为：

```js
enabled: true,
debugMockAds: false,
rewardedAdUnitId: 'adunit-035fb16fac04d21b',
interstitialAdUnitId: 'adunit-d4c3fac373ac66c1'
```

该配置允许真实广告入口；启动/可用性查询不自动创建实例。玩家主动选择激励视频或满足已定条件的单人结算离开可请求微信广告。模拟奖励及远程上报继续关闭，无Banner；实际平台行为待真机验证。

## 后续设备与发布验收（尚未执行）

1. 用户已确认流量主、两广告位和现有ID可直接测试；本地B/C正文及广告开关已获批准并完成。
2. 本地兑付/恢复和相关回归已有记录；真机SDK、原生隐私入口及实际平台行为仍需按清单验证。
3. 如需更新后台声明、启用平台测试服务或处理广告位状态，按具体操作另行授权；不由本地开关批准推定。
4. iOS/鸿蒙的实际设备测试、测试候选上传/体验版分发，按用户明确的设备、账号、目标与权限执行。上报仍关闭。
5. 微信实际包体、真实广告、设备及回退验收通过后，汇总明确版本再由用户批准发布；本轮不触发上述操作。

## 已冻结的展示规则

- 补体力：体力耗尽提醒和商店中均可主动观看激励视频，完整观看后增加 1 点体力，不设冷却和次数上限，也不计入商店道具每日视频额度；广告不可用或体力已满时入口隐藏或禁用。自然恢复改为每10分钟1点（上限5点）。
- 金币补体力：体力耗尽提醒和商店均可用 1000 金币购买 1 点体力，体力已满或金币不足时不可购买。
- 失败复活：完整观看后增加 5 步，同一局次数不限。
- 插屏：仅单人模式最终离开结算时计数；每 3 局最多一次，且两次展示至少间隔 120 秒。
- PvP、复活过程和首次启动不展示插屏。
- 不接入 Banner。

## 真机验收

执行以[最新启用前草案的双平台清单](ad-activation-draft.md#ad-device-checklist)为准，以下为原规则摘要；尚未开始真机验收。

- 激励视频完整看完才到账；提前关闭、加载失败、无填充均不发奖励。
- 广告不可用时入口隐藏，正常游戏和结算导航不被阻塞。
- 同一局可以重复复活，每次都必须重新完整观看。
- 第 1、2 局不展示插屏，第 3 局在点击离开结算后展示；120 秒内不重复展示。
- 插屏关闭、报错或无填充后都能继续原本的下一关、重试或返回首页操作。
- PvP 全流程不出现任何广告。

## 本地事件

`js/core/analytics.js` 仅在本地保存最近 200 条、7 天内的低敏标量事件，不上传数据。当前广告漏斗事件包括：

- `ad_request`
- `ad_show`
- `ad_complete`
- `ad_cancel`
- `ad_fail`
- `ad_reward_granted`
- `ad_frequency_blocked`

玩法核心漏斗同时包括 `home_exposure`，单人 `solo_level_select/solo_start/solo_complete`，以及 PvP `pvp_click/pvp_create/pvp_invite_share/pvp_join/pvp_ready/pvp_start/pvp_complete/pvp_error`。这些事件仍只进入本地缓冲；上线前配置明确的微信事件 ID 并复核字段后，才可打开远端上报。

禁止写入 OpenID、UnionID、昵称、头像、设备标识、手机号、邮箱、令牌或其他身份信息。
