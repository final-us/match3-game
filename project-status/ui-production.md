# UI production · 当前入口

## 当前修复：第一关入口命中区丢失 · 2026-09-15

- Owner：体验/美术UI集成；状态：`implemented_verified_pending_wechat_retest`。用户报告微信开发者工具重新编译后第一关点击无反应。仅修选关页命中边界，不改音频/关卡/存档/体力规则，不上传/提交。
- 原因：390×844、contentTop91/safeBottom34时最近节点84px，含padding命中高度94；旧中心y700导致hit底747>mapBottom746，因此drawLevelSelect不返回level_1命中区；可见但不可点击。375×812等全面屏也受影响。开发者工具截图见满体力5、控制台0错误；未凭此声称原生点击已复现，native模拟器点击无状态变化后改隔离真实模块路径验证。
- 修复文件：`match3-wechat/js/render/ui.js`。baseNodeSize共用，bottom同时受原布局位置与mapBottom减最大半命中高度约束；保留拖动中部分裁切节点不可点、防返回抢点击逻辑，390×844仅上移1px。
- 回归：`test/ui-smoke.js`新增静止地图五节点必须全部可点击，涵盖320×568/375×667/375×812/390×844/430×932、safeBottom0/20/34、offset0/5。旧滚动测试遇到缺失hit会跳过，未证明静止第一关可用。新测试修复前失败，修复后26项UI smoke全过；ui/test与fixture语法、diff、包体通过。静态主包3,836,245/4,194,304bytes（57文件）；资产/audio字节不变。
- 运行证据：`tools/preview-level-entry.cjs`复用现有本地fixture方法载入真实Main/UI/GameCore/Board，内存存储、关闭音乐音效、无Main构造主循环/微信账号/云端，仅127.0.0.1监听。CUA在390×844截图确认关卡按钮与返回区域后实际点击第一关，页面PASS、state playing、level1、pieces64、测试体力5→4、solo_intro；截图显示棋盘和引导。服务已关闭。该结果不是微信/iOS/鸿蒙真机证明，用户实际存档体力未改。
- 独立复核：既有Aristotle限定只读复核PASS，复用代码/fixture与包体证据，未扩展其他审计。下一步：用户重新编译微信项目复点第一关；若仍无响应，继续采集实际触摸/运行日志，不清存档或假称修复已在设备验收。


## 真机回归反馈 · 2026-09-14

- 用户真机确认单人闯关与双人对决主流程可用；发现分享卡片进入旧 UI、连消音高不明显、冰块/四连/特殊组合音效不满意。
- 已修复分享入口：当微信更新管理器已经下载好新包时，好友从邀请卡片进入会先应用新包，再恢复邀请参数进入房间；新增 `test/runtime.js` 回归。
- 已修复特殊组合音效：移除旧 `specialCombo` 单条 cue，改为同时播放组合中前两个实际特殊棋子的独立音效；新增音频回归。
- 连消、冰块和四连音效仍待重新制作并真机复听；当前供应商生成接口未在本任务工具中提供，暂不伪造已生成素材。

## 当前交付 · 2026-09-14

- 用户已接受此前对战准备/PvP HUD与道具/胜平负结果、单人HUD批次，并授权继续整体状态与微信平台验收。当前状态in_progress：主要页面视觉已接受；本轮引导遗漏修补待用户查看，真机/全状态验收与发布未完成。
- 微信开发者工具实看：用户打开的/Users/Admin/Desktop/wechatwebdevtools.app，项目match3-wechat（本仓库match3-wechat/），Stable 2.02.2608040、基础库3.16.2、iPhone 12/13 (Pro)模拟器78%。首页透明主视觉/按钮和实际胶囊避让正常；商店真实价格/无库存/金币不足与无广告入口显示正常，返回成功；设置两开关及隐私/返回布局正常，未切换设置。地图已完成/当前/锁定三态、拖动从1–5至2–6、拖动后返回成功。观察到控制台0错误、1条通用HarmonyOS兼容警告。截图证据为本任务CUA工具返回图，不伪造本地截图文件；不是手机真机。
- 隐私入口：此前点击后没有可见平台合同面板或报错，本轮再观察仍在设置。源码main.js调用runtime.openPrivacyContract，适配层已有success/fail与不可用提示；缺少平台回调/真机证据，无法判定是模拟器限制还是平台配置问题，标为未通过/结论不足，不重复盲点、不改隐私流程。
- 补漏：五种首次引导原先保留旧金字/浅底白字按钮；本轮仅修改render/onboarding.js复用moon.panel/button，使用深靛蓝标题/正文、蓝色跳过/粉色知道了，纳入contentTop。保留五种key、文案、46px按钮和返回契约；按实测宽度换行，优先原句分句点，避免句号孤立与“5连”拆开。未改main.js、引导存储、计时暂停/恢复或触发规则。
- 本轮文件：match3-wechat/js/render/onboarding.js、test/onboarding.js、tools/preview-moon-guides.cjs与本记录/设计索引。独立本机fixture只载入真实渲染模块和素材，不运行main、不调用存储/云端；本机监听获工具审批，未外部上传。没消耗用户游戏资源、重置引导、切换项目或触发PvP/广告。
- 有效证据：onboarding及preview工具语法、onboarding与ui-smoke通过；新测试覆盖320×568/375×812/430×932、contentTop88/safeBottom34、44px命中/不交叠、原文拼接不变、正文最多4行/不溢出/标点不孤立。最终换行微调后复跑onboarding通过，其余调用契约不变，复用ui-smoke。最新包体检查通过：3,813,072 bytes / 4MiB；活跃素材3,181,224 bytes不变。无新位图、生成/上传、音频改动；HEAD f7ed98a+相关dirty源，无构建，用户其他dirty工作保留。
- 本轮视觉：CUA本机浏览器实际Canvas，五种引导320均已查看；修补后special320/375、pvp320/430、obstacle320、solo_item320复核，solo_intro短句布局未受换行分支影响。仅检查弹层材质/文字/布局；长屏截图完整显示弹层但页面底端不全，不能替代整体页面/微信触控证据。初次贪心换行出现孤立标点，均衡后仍拆“5连”，随后改优先原句分句点，最终代表长句通过；没有继续增加装饰。独立map_result_qa只读检查通过，未冒充截图或真机复核。
- 尚缺状态：assets.preload把load/error都计入完成，main初始化随即进入menu，缺少明确加载失败/重试界面；本轮仅诊断，启动恢复涉及既有平台/核心边界，未自行扩写。引导真实触发/关闭、游戏内完整触控/VFX、头像授权、云端对战、广告、后台、DPR与性能仍需对应平台/真机证据。
- 下一行动/授权门：请求本次当前客户端代码与素材上传腾讯微信预览服务，生成一次真机二维码供用户扫码；这不是发布、云函数部署或线上对战写入授权。未获批准前不点预览/真机调试。加载失败恢复需与用户确认责任/范围；commit/push/正式发布仍未授权。
- 技能与记忆：复用本任务已完成的approved项目match3-game/模块ui-production验收状态检索（均空），按游戏视觉QA与Impeccable保持既定B组件，Ponytail限定引导小修。新事实为任务证据/状态或已在权威记录说明，无需写重复记忆候选。前批已接受里程碑复盘见retrospectives/ui-pvp-hud-20260914.md。

## 已接受批次证据 · 2026-09-13

- 用户确认：B月光水晶/琉璃猫、首页、商店/设置/三道具、地图/单人结算、对战准备＋PvP HUD/道具/胜平负结算＋单人HUD均已接受。独立限定QA通过；不等于发布或全平台验收完成。以下保留该批交付时证据与限制。
- 本轮文件：match3-wechat/js/render/battle-ui.js、board-render.js、moon-controls.js、test/ui-smoke.js、tools/capture-moon-ui.cjs；本地Git HEAD f7ed98a＋当前上述dirty源，无构建步骤。用户已有音频/玩法/平台dirty变更保留；未改main.js、云端、广告或音频，未commit/push/部署。
- 实现：对战准备复用透明标题与棋子头像、珍珠双人卡、44px配额加减和48px并排准备/退出；准备后不注册配额命中区。冰冻/干扰由原生切面水晶/粉漩涡替代emoji；配额仍固定总数3、按原main.js相互调配，未改服务端校验。胜平负标题与真实比分/金币、再来一局/返回均原生；胜负复用已接受猫图、平局复用双猫头像。
- HUD：PvP双方分数/圆环秒数、底部48px道具与冷却/生效/用尽文字；受击/释放合并一行并保留4连规则和剩余秒数，不遮棋子；棋盘保留区top=max(72,contentTop/safeTop)+96、bottom=height-safeBottom-104。320短屏格宽34px（safeBottom20 fixture），真实8×8不变，长屏按可用区居中。单人HUD三列按宽度分配，修复原320px分数/步数框重叠，目标/倒计时仍共用第二行；单人棋盘/道具布局与已接受资产不变。
- 参考：assets/_incoming/ui-suites-20260912/b-support-v2.png、b-core-v2.png、b-results.png。本批不新增位图、付费生成或上传；背景/角色/图标授权与透明报告复用原批次。交付映射/限制见assets/_incoming/moon-ui-runtime/pvp-hud/README.md。
- 运行证据：screens下battle-wait/wait-empty/wait-ready、battle-result/result-draw/result-lose、battle-board/cooldown/active/countdown/effects、board/board-tools/board-timed，各320/375/430。真实CommonJS Canvas＋项目素材在Chromium渲染，不是微信实机。最新变化只刷新受影响组；先前接受页证据保留。
- 验证：受影响脚本语法、ui-smoke、包体、diff空白通过。ui-smoke新增contentTop72/88＋safeBottom34三档配额锁定、44px命中区/不相交、胜平负长分数、共享冷却/耗尽/组合受击文字与棋盘保留区覆盖。旧计时测试按计时/非计时同框体和实际坐标检查，避免以装饰填充次数误判。board-render-combo通过且后续未改其单人夹具/组合算法；素材来源证据复用（无资产/注册变化）。包体3,812,577 bytes / 4MiB；素材3,181,224 bytes不变。中途删除未用函数误截到房间名函数头，已恢复原函数并通过语法/运行/冒烟复核，无未解决失败。
- 独立QA：map_result_qa复用Luna low配置，限定6图battle-wait-320、wait-ready-375、effects-320、cooldown-430、result-draw-375、board-tools-320及布局/命中契约，结论通过，无重叠/棋盘遮挡；未重复通过命令，未替代主代理其余三档截图与微信真机。
- Impeccable：收到工具提醒后读取4.3.1与polish指导，context一次识别不到PRODUCT/DESIGN及Canvas平台；沿用AGENTS和现有项目记录，不启动init/重建系统。收尾采用保留风格/真实状态/复用组件/有限检查原则；手工detect一次返回[]，不能视为Canvas布局、可访问性或真机证明。critique参考仅查阅，未执行完整双评估报告流程，不宣称取得评分或浏览器覆盖层。
- 残余偏差：准备页没有原稿侧卧/背影双猫装饰，已接受棋子作默认头像；水晶/漩涡为可编辑原生图标，不是同原稿高精度位图。结果平局复用双猫头像而非新增姿态，未逐像素复刻。长屏对战棋盘维持原居中策略；原稿额外返回/暂停入口没有新增。其余已披露蒙版细边损失与旧注册节点保留情况不变。
- 平台未验证：微信胶囊/头像授权实际覆盖、触控/DPR/加载失败、真实联网准备与云端比分、广告/隐私、后台与完整VFX动态/低端帧率内存。Canvas状态截图只覆盖视觉，不能认定这些通过。没有新增动画时序，只更新既有倒计时/受击绘制。
- 下一步：用户接受本批后做整套一致性/缺失状态与微信开发者工具及真机验收；发布、提交、推送仍需明确授权。共享记忆本批项目match3-game和模块ui-production检索PvP/HUD均无相关批准条目；权威事实已记录，不写重复状态候选。

## 历史

商店/设置/三枚道具批次用户已确认；当批语法/ui-smoke/board-render-combo/来源/包体通过，moon_vfx只读QA无阻塞；其独立开关/广告状态/小屏棋盘证据仍有效，详见support-polish/README.md。复盘见project-status/retrospectives/ui-support-20260913.md。地图/结果本轮共享记忆已检索项目match3-game与模块ui-production，均无相关批准条目；沿用任务内检索，不重复。新增事实已落在权威记录，没有另外写入重复状态候选。

上一批完成首页绒毛双猫入口、珍珠商店/设置图标和按钮细雕，用户正向反馈后要求核对整套完成度。本批运行道具栏揭示旧单人320×568宽度优先棋盘会被工具面板遮挡，已通过按高度预留108px修复；未改PvP布局分支。

五枚棋子已真透明接入；双猫和标题的自动checker-alpha曾拒绝。均在用户另行明确授权后换本地逐组件蒙版，原图和失败候选保留在incoming，旧运行素材在previous。不透明卡片已被用户否决，不再运行。其余页面原有B组件与组合VFX、特殊组合明确元数据回归证据仍保留。
