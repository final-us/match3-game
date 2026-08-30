# 猫猫开心消 · 项目协作约定

## 产品简报

- 产品名：猫猫开心消。
- 首发平台：微信小游戏。
- 核心用户：偏女性用户，治愈、柔和、猫咪主题。
- 核心循环：进入游戏 → 单人闯关或好友实时对战 → 获得金币/进度 → 使用道具继续挑战。
- 首发差异化：60 秒双人实时 PvP，好友邀请进入同一房间。
- 商业模式：纯广告变现。激励视频只能兑换明确价值，不做误触、诱导分享或强制打断。

## 技术栈与目录

- `match3-wechat/`：原生 JavaScript + Canvas 2D 微信小游戏客户端，无构建步骤。
- `match3-wechat/js/core/`：三消、关卡、体力、金币、广告等纯逻辑。
- `match3-wechat/js/render/`：棋盘、菜单、对战 UI、主题与素材加载。
- `match3-wechat/js/net/`：云函数客户端适配层。
- `match3-wechat/cloudfunctions/battle/`：微信云开发双人对战云函数。
- `match3-wechat/levels/`：旧 20 关难度标定样本，仅供历史回归，已从客户端包排除。
- `match3-server/`：备用 WebSocket 服务端，不是当前首发主链路。
- `docs/`：产品、设计、合规与发布决策记录。

## 开发与验证

- 微信开发者工具导入目录：`match3-wechat/`。
- 客户端脚本无构建；修改后至少执行 `node --check` 和相关 `match3-wechat/test/*.js`。
- PvP 云函数逻辑测试：`node match3-wechat/test/battle-logic.js`。
- 上线前必须在真机验证：创建/加入/准备/倒计时/比分同步/道具/弱网/退后台/退出结算。
- 不把“脚本打印了失败但退出码为 0”视为通过。

## 架构与代码约定

- 保持平台 API、广告、存储、云函数调用位于适配层，核心棋盘逻辑不直接依赖微信 API。
- PvP 的身份、开局时间、比分合法性和结算以服务端为准；客户端只负责输入与展示。
- 不在客户端保存密钥或广告后台凭证。
- 先做小而完整的垂直切片，避免与需求无关的大型重构。
- 单人关卡由 `js/core/level.js` 按“生成器版本 + 关卡号”确定性生成；同一版本同一关配置固定，棋盘随机性独立保留。
- 新素材统一英文文件名，经 `js/render/assets.js` 注册；首页素材放在 `res/home/`。
- 棋子 `res/piece?-v2.png` 是保留的 512×512 源图，运行时只引用 256×256 的 `res/piece?-runtime.png`；包体忽略与预算由 `test/package-budget.js` 校验，不能忽略活跃素材。

## UI 约定

- 已选视觉方向：月夜猫咪花园；深蓝夜空、薰衣草紫、樱花粉、柔和暖光。
- 首页信息层级：品牌名 → 双人对战主入口 → 单人闯关次入口 → 商店/设置辅助入口。
- PvP 始终使用最高视觉优先级；单人玩法不可压过 PvP。
- 交互目标建议不小于 44 逻辑像素；适配异形屏安全区和常见窄屏。
- 当前可复用猫咪棋子，其他首页素材按 `docs/design/ui-redesign.md` 的槽位逐步替换。
- 所有页面文字经 `js/render/typography.js` 统一绘制；数字优先使用圆润数字栈并在所属控件内独立居中、自动缩放。

## 平台、变现与数据

- 发布前以微信官方当前文档复核包体、隐私、广告、分享、云开发和审核要求。
- 禁止“点击分享即发奖励”等无法验证分享成功、容易构成诱导分享的机制。
- 首发激励视频候选点：失败复活、体力不足时补充体力；都必须由用户主动触发。
- 商业化冻结规则：不接入 Banner；复活每次完整观看后增加 5 步且单局不限次数；插屏仅在单人每 3 局最终离开结算时尝试，间隔至少 120 秒，PvP 不展示广告。
- 视觉冻结规则：全核心页面属于同一“月夜猫咪花园”世界；首页级高精度静态 3D 质感，动态特效克制；普通棋子使用统一高清猫咪透明素材，特殊棋子以猫咪底图叠加原创透明光束/炸弹运行图与 Canvas 触发动画；鸿蒙继续降 DPR、关闭碎屑粒子并缩短特殊动画。
- 音频冻结规则：舒缓场景与 PvP 使用 Dylann Taylor 的 `PLAYFUL PIANO` CC0 循环（Atmos Loop → `calm.m4a`、JazzTrio Loop → `battle.m4a`；完整 51.20 秒、AAC/M4A、22050 Hz 单声道），`InnerAudioContext` 播放失败时回退 WebAudio 程序化旋律；音效优先播放 Robin Lamb/OpenGameArt、Kenney 与 Freesound 的 CC0 原声采样合成精灵 `sfx-acoustic.m4a`，读取或解码失败时回退原有 WebAudio 合成；同次 match 触发至少两个特殊棋子时只播放一次统一的 V7 音乐盒组合 cue，单特殊仍播放独立 V4 cue；音乐和音效独立控制，后台及音频中断时暂停。
- 可靠性冻结规则：全局错误只记录类别和计数；微信原生事件/监控上报默认关闭且必须配置显式映射；版本更新仅在非对局安全场景提示；隐私说明使用微信官方隐私合同入口。
- 关键事件至少包括：首页曝光、PvP 点击/建房/分享邀请/加入/准备/开局/完成/异常，单人选关/开局/完成，广告请求/展示/完成/失败。
- 上线门槛：启动耗时、帧率、内存、崩溃率、PvP 完成率和广告漏斗均可观测。

## 开源与授权

- 开源与素材边界、第三方 notice、素材来源和发布前检查项统一记录在 [`docs/release/open-source-and-assets.md`](docs/release/open-source-and-assets.md)；小游戏主包的上游 MIT 文本见 [`match3-wechat/THIRD_PARTY_NOTICES.txt`](match3-wechat/THIRD_PARTY_NOTICES.txt)。项目本身保持默认版权，不添加项目级开源许可证。
- 未明确授权的代码、字体、音乐、音效、图片和商标不得进入商业包。
- Holopix/生成式素材需保存生成记录，并确认平台条款允许商业使用。

<!-- PUBLIC_CAPABILITIES_PROTOCOL_START -->
## 公共能力与 Guild 激活协议

- 项目标识：`sanxiao`；项目 Team：`消除`；主 Agent：`未登记（仅规则接入）`。
- 公共能力权威仓库：`/Users/Admin/codex/gonggongnengli`。Git 是公共资产和项目采用记录的唯一事实来源；TencentDB Agent Memory 只是可重建运行副本。
- 本项目当前接入模式：`not-provisioned`；配置来源：本项目 `project-status/public-capabilities/config.json`。项目模式只允许 `off -> read-only -> on`，任何已接入状态都可回退到 `off`；前进切换需要用户批准引用、健康检查、Team/Agent 配对检查和召回检查。
- 本项目 provisioning 状态：`not-provisioned`。`not-provisioned` 项目只同步规则，不创建 TencentDB Team/Agent；其它项目也不得自行拼接或保存 TencentDB ID、密钥、原始 Chat Memory。
- 当前 Active Guild：平台发布与合规负责人、QA 与性能负责人。
- 当前 Preparation Guild：无。
- 当前 Dormant Guild：体验设计与美术负责人、玩法与技术核心负责人、关卡内容与数值负责人、广告与商业化负责人、后端与在线服务负责人。Preparation/Dormant Guild 只加载职责和激活条件，不处理常规候选、不建设或发布 Skill、不参与运行时召回。
- Guild 激活触发信号：两个以上项目出现同类重复问题、同一模块累计三条以上可复用候选、不同项目出现冲突做法需要统一边界、尚未激活的公共标准成为交付阻塞、出现高代价安全、支付、隐私、合规或数据风险。模块负责人先把脱敏后的结构化申请放入本项目 `project-status/public-capabilities/outbox/`，由项目主 Agent 检查事实、跨模块影响和证据，再路由给同名 Guild Owner；Dormant 状态只能按 `dormant -> preparation -> active-pilot -> active` 前进，且每次前进都需要用户批准。
- 公共能力候选只允许走 `candidate -> project-validated -> guild-reviewed -> cross-project-validated -> awaiting-user-approval -> published`；发布、同步、弃用和回滚必须以 Git 内容哈希、版本和审批记录为锚。项目不得直接修改公共 Skill。
- 项目规则优先级：安全与法律约束 > 本项目 `AGENTS.md` 和权威产品文档 > 冻结契约 > 当前任务验收标准 > 公共 Skill > 历史记忆。公共 Skill 不能覆盖本项目事实、接口或产品决策。
- 当前冻结项：对比实验、真实 Skill 发布/同步、真实 Guild 激活均冻结；只允许合成数据验证。本项目不在首期反馈门槛内，保持规则接入，不创建运行时 Team。
- 运行时接线必须 fail-closed：网络错误、超时、身份不匹配或召回校验失败不得阻断项目任务，必须返回明确的 `degraded=true` 降级结果；`read-only` 禁止 capture/create/update/delete，`on` 也不得把原始项目 Chat Memory 写入公共 Team。
- 新项目必须先登记到 `/Users/Admin/codex/gonggongnengli/registry/projects.json`，再运行：`python3 /Users/Admin/codex/gonggongnengli/scripts/sync_project_protocol.py <项目AGENTS.md>`。可用 `--check` 检查协议漂移；禁止手工复制旧的 Active/Dormant 名单。
- 原始项目 Chat Memory、凭据、AppID、个人数据、真实用户数据、未脱敏备案材料和受限商业资料不得进入公共能力仓库或公共 Team。
<!-- PUBLIC_CAPABILITIES_PROTOCOL_END -->
