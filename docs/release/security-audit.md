# 发布前安全审计记录

## 2026-09-15 · 依赖安全修复（本地，尚未部署）

- 用户授权修复前一轮 7 项 npm 安全告警，并在本地验收后授权提交/推送本次修复到GitHub；不上传或部署微信、不操作凭据和用户数据。基线 `f85a8353de98a4d74cf5940dec245f0abc8a3c04`，验证对象为该基线上的本次依赖、测试及文档（随本记录提交）；客户端 UI/音频/玩法与云函数业务逻辑未修改。
- 官方 registry 查询：`wx-server-sdk` 最新仍为 `4.0.2`；直接升级 `@cloudbase/node-sdk` 到 `3.18.3` 仍带旧 axios 与 database，不能独立解决风险。保留 SDK `4.0.2` / CloudBase `3.17.2`，不执行自动 force 降级。

| 实际风险依赖 | 修复前 | 本次措施 |
| --- | --- | --- |
| axios | 0.27.2 | override 精确至 0.33.0，保持 0.x/CommonJS 调用方式；新增传递包 proxy-from-env 1.1.0。 |
| lodash.set | 4.3.2 | 独立包没有修复版；用自有 callable 适配层直接导出维护中的 lodash 4.18.1/set，不复制或改名掩盖旧实现。 |
| lodash.unset | 4.5.2 | override 精确至 4.18.0。 |
| qs | 6.15.3 | override 精确至 6.16.0。 |

- 最终 `npm audit --omit=dev --json` 返回 **0 项已知漏洞**（high/moderate/critical 均为 0，104 个非根依赖记录）。原 7 项包括 SDK 上层依赖受下层漏洞影响的重复链路，并非 7 个独立攻击入口。此结果只代表 npm 当前公告覆盖，不等于项目不存在安全风险。
- `cloud-dependency-security.js` 修改前已复现旧 set 经 `__proto__` 路径污染 Object.prototype；最终针对 CloudBase 实际解析的包验证 set/unset 字符串/数组危险路径、正常嵌套字段/数组/字面点号、返回值、qs 正常解析与污染防护。还检查锁文件与安装版本、无链接目录及 set 函数确实来自 lodash/set，避免仅让审计数字变绿。
- Axios 验证使用真实 SDK 暴露的 callable requestClient 与 metadata.lookup，但每次均注入内存 adapter：JSON 转换、响应 data、GET/POST 配置、错误传播和取消通过。**没有访问真实 metadata、读取云凭据、连接云数据库或执行真实事务**；HTTP 网络适配器、生产凭据获取和云端事务仍需部署后验证。
- Node `24.19.0` / npm `11.17.0`：在独立临时目录 `/private/tmp/match3-dependency-ci-1E7Vbb` 只复制最终 manifest/lock/.npmrc/vendor，`npm ci --ignore-scripts --no-audit --no-fund` 与 `npm ls --all` 均 exit 0；同一安全脚本对该干净安装与仓库安装都通过。无 invalid/extraneous/dangling 依赖；原有可选 peer `ws` 未安装不阻断本游戏的服务端事务链路。
- 安装调试曾出现 file override 按传递包位置解析出的 dangling link，随后直接根依赖仍有旧锁记录残留；已改用隔离干净安装定位，删除两条无效记录并持久化 `.npmrc` 的 `install-links=true`。其余原有传递版本保留，未采用全量重新解析导致的无关升级。兼容层是安装时打包的普通目录，不依赖 postinstall、机器绝对路径或手改 node_modules。
- 受影响回归：battle-cloud-function、battle-logic、battle-client、open-source-and-assets、release-gates 均通过；新增安全脚本及相关 JS 语法通过。对战测试为本地桩/模拟，不冒充联网或真机；未改客户端输入，复用既有视觉、声音、难度与包体证据，不重复跑全部模拟。
- 许可证：104 个非根记录含 103 个第三方包与 1 个自有适配层。新增 lodash 保留完整 MIT/OpenJS/Underscore LICENSE；自有适配层 UNLICENSED 为默认版权，不能误算为新的未知第三方授权。既有两个腾讯 UNDECLARED 厂商例外不变，详见合规台账。
- 非实现者独立复核条件PASS：未发现阻断本地Git交付的安全/安装/兼容缺陷；核对锁定版本、无悬空链接、自有层真实导出、SDK解析链与部署说明。保留“先干净ci，再运行安全检查”要求，不以单独安全脚本冒充安装新鲜性验证；真实云/双账号门槛不在本次通过范围。

### 部署门槛与维护

1. 按小游戏 README 的安全依赖流程在 battle 目录完成本地安装/依赖树/安全检查，再将包含该 node_modules 与许可证的完整云函数上传；**本次没有部署，线上旧告警不会因本地修复自行消失**。
2. 不假定微信云端安装器支持 npm overrides/local file package。若选择云端安装依赖，需另行验证 npm 版本、.npmrc/vendor/lock 收录和最终实际依赖；未通过前使用已验证的本地完整依赖部署路径。真实云平台接收、Node运行版本和行为须由部署/真机门槛确认。
3. 上传后双账号复核建房/邀请/加入/准备/比分/道具/60秒结算/退出，检查云日志没有 SDK 加载、依赖或事务错误；不记录凭据。部署失败不要仅撤销 overrides 后继续发布，恢复先前版本也必须明确其已知漏洞。
4. 以后 SDK 升级时复核上游是否已经修复，再移除相应 override/兼容层；重新运行同一安全和对战验证。保留此前服务端计分信任、弱网与商业合规限制。

## 历史：2026-09-15 · GitHub 发布前复核（修复前）

- 只读查询 npm 官方 registry：`npm view wx-server-sdk version` 仍为 `4.0.2`，与锁定版本一致；未更新依赖或部署云函数。
- `npm audit --package-lock-only --omit=dev` 当前返回 7 项：5 high、2 moderate、0 critical（不是安全检查全绿）。涉及 `axios`、`lodash.set`、`lodash.unset`、`qs` 及其 SDK 上层依赖。完整本次日志保存在本机临时检查目录，未将依赖清单上传其他审计服务。
- 既有固定 CloudBase 目标、固定集合/字段、可信 OpenID 和服务端事务边界保持；本次未增加客户端可控 URL、对象路径、代理配置或 HTTP 解析入口。公开源码提交不部署/改变当前云服务，也不等于接受全部正式上线残余风险。
- 官方自动修复建议仍包含降级 `wx-server-sdk` 到 `2.5.3`；不执行 force。正式平台发布前继续按上一轮 SDK 依赖风险与实际可触达面复核；未来有兼容修复版时单独升级并验收云函数。
- 本轮唯一云端代码变动是等待房间成员退出/替补准备状态：仍由可信OpenID筛选本人、固定字段更新、同一房间事务；已开局的退出结算和分数截止/反作弊阈值不变。新增云函数桩回归覆盖等待退出、替补、双人重新准备、对局退出胜负及全员离开禁止复活旧邀请。源码交付后需要用户重新部署`battle`，本轮未操作云端。

## 2026-08-21 · PvP 云函数依赖

- `wx-server-sdk` 已从 `~2.6.3` 精确升级到官方当前文档列出的 `3.0.1`，并生成 `package-lock.json`。
- CloudBase 官方服务端事务文档确认 `runTransaction`、事务内 `get/update` 为支持接口；PvP 房间关键写操作据此使用单文档事务。
- `npm audit --omit=dev` 仍报告 12 个传递依赖问题：4 moderate、6 high、2 critical。
- 问题主要来自官方 SDK 传递依赖中的旧版 `axios`、`request`、`form-data`、`jsonwebtoken` 与 lodash 子包。npm 给出的自动修复方案会回退到 `wx-server-sdk 2.5.3`，因此本轮不执行自动降级。
- 当前云函数不接收或请求用户提供的 URL，也不使用上传表单或 JWT 校验路径，部分 SSRF/表单/JWT 风险不可直接触达；但这不等于漏洞已消除。

## 2026-08-22 · 升级到官方稳定版 4.0.2

- `wx-server-sdk` 已从精确版本 `3.0.1` 升级到官方稳定版 `4.0.2`；官方更新日志显示主要变化是将 `@cloudbase/node-sdk` 从 `2.10.0` 升至 `3.17.2`。
- 同口径 `npm audit --package-lock-only` 从 12 项（4 moderate、6 high、2 critical）降至 6 项（1 moderate、5 high、0 critical）；旧 `request`、旧 `form-data` 与旧 `jsonwebtoken` 风险链已移除。
- 剩余问题来自官方 SDK 传递依赖中的 `axios 0.27.2` 与 `@cloudbase/database` 使用的 lodash 子包。npm 的自动修复建议仍会回退到 `wx-server-sdk 2.5.3`，因此不执行 `npm audit fix --force`。
- 云函数只使用 SDK 固定的 CloudBase 服务目标；客户端不能提供请求 URL、云凭据或任意数据库字段路径。房间操作使用固定集合、固定更新字段和服务端事务。这缩小了当前 SSRF、凭据泄漏与原型污染公告的可触达面，但不代表漏洞已修复。
- 许可证清单中的两个 `UNDECLARED` 腾讯传递包按产品负责人决策登记为厂商依赖例外；接受残余商业合规风险，不阻断技术上线，也不提交外部澄清请求。

## 2026-08-22 · PvP 输入、时效与留存

- 房间 ID 在客户端分享入口和云函数事务入口双重校验，并限制长度；非法 ID 不进入数据库事务。
- 云函数普通操作必须获得可信 OpenID，内部异常仅向客户端返回通用错误，不透传 SDK 或数据库错误文本。
- 等待中房间在创建 10 分钟后失效；房间文档保留 7 天。`cleanup-battle-rooms` 每日定时清理只允许“无用户 OpenID + 匹配触发器名”的平台定时事件进入，普通客户端伪造同名事件不能执行清理。
- 当前分数仍由客户端上报，服务端只校验单调性、单次增量和时间上限。建房已在服务端事务中按 OpenID 限制为每 UTC 分钟 5 次、每 UTC 自然日 60 次；计数文档 ID 只保存不可逆 SHA-256 摘要，不返回客户端，并与房间创建在同一事务提交。若增加排行、奖池或可交易价值，仍必须升级为服务端权威棋盘与计分。

## 上线门槛

1. 在微信云开发测试环境部署最新 `battle` 云函数，确认 SDK 4.0.2 的事务行为、建房限流、`createdAt` 查询索引和权限规则；确认 `cleanup-battle-rooms` 定时触发器能删除 7 天前的测试房间及限流控制文档。
2. 使用两个真实账号完成建房、邀请、加入、准备、3 秒倒计时、60 秒结算、退后台、断网和主动退出测试。
3. 上线前依照顶部依赖修复记录核对实际部署版本和 `npm audit`；若出现新公告或SDK更新，复核传递依赖与兼容性，不假定直接换为 `@cloudbase/node-sdk` 就能清除风险。
4. 不以 `npm audit fix --force` 自动降级 SDK，因为可能破坏已采用的事务能力和官方当前兼容路径。

## 2026-08-23 验收进度

- 已由产品负责人确认：`battle` 已上传、`createdAt` 索引生效、客户端直连集合被拒绝、双账号真机核心链路正常。
- 已由产品负责人确认：定时触发器时区与实际执行日志正常，7 天测试房间已被清理且新房间不受影响。
- 当前免费开发环境未提供所需告警监控能力；云函数错误/调用量告警和腾讯云费用预算提醒延后到升级付费或正式环境时配置，不阻塞当前开发测试。
