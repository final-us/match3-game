# 每日挑战云启用 · 开发者工具验证通过

当前规则为每天一局、500金币及进行中检查点。2026-09-22 23:00前已按当前源码重建15文件候选zip，并更新隔离目录中变化的3份源码；现已完成云部署与开发者工具验证。

## 当前结论 · 2026-09-23

已部署并在微信开发者工具正式Main链路验证可用。cloud1-d9g4pv8m8457af92a的battle经官方CLI以本地依赖模式更新成功（success true、6908文件、7.4 MB），随后info显示Active、Nodejs20.19、timeout 3s；控制台确认更新时间2026-09-22 23:28:46、256M，以及cleanup-battle-rooms定时器0 0 3 * * * *仍保留。旧版本1（before-daily-20260922）保留，未切换流量、未发布客户端。

两个集合daily_runs/daily_progress已建立，创建时均明确选择“所有用户不可读写”；已分别建立createdAt_1/updatedAt_1普通非唯一升序索引，列表确认存在。真实客户端SDK尝试get均返回-502003，服务端真实调用成功；未另执行客户端写入探针。

真实dailyInfo返回daily-v1、25步、2000分和500金币，旧“未知操作/暂未开放”阻塞解除。正式Main在当前开发账号完成9月22日旧局5步后重载；首次重载dailyInfo遇12秒超时，显示可重试错误，明确再发起验证后成功。真实dailyStart返回moves:5，随后25步完成，服务端确认2130分、500金币入账。期间跨北京时间零点，成绩仍归9月22日，新日可开始符合规则。

9月23日新局完成25步、服务端2120分，另领取当天500金币；钱包由500变1000，体力始终5。两局重复提交分别返回相同收据，余额不重复增加；新日完成后dailyStart明确拒绝再次开局（locked=true），页面显示“今日奖励已领取/今日成绩2120分/今日已完成”。好友v2创建/查询/退出全部ok。

验证方式：开发者工具实际微信SDK、存储、Canvas、动画与云服务，临时入口用正式Main.handleTouchStart/Move/End驱动合法触摸坐标，没有mock云端或直接改分/钱包。原生模拟器点击不稳定，所以这不等同操作系统真实指针或手机实测。临时game.js已恢复原始字节，git diff为空；脚本仅留/private/tmp作诊断，未上传客户端。独立非实现者QA确认经过正式saveActive→dailyCheckpoint→savePending→dailySubmit→creditOnce链路。手机实测、双账号好友完整对局仍未执行。

## 只读核查步骤

解锁后检查当前客户端构建，再只读调用`battle`的`dailyInfo`，只记录ok、固定错误类型、challenge.version/target/reward，不输出身份、环境凭据、原始错误或存档。检查环境cloud1-d9g4pv8m8457af92a中battle更新时间和两个集合是否存在。未知操作说明缺少路由；服务异常需看集合/SDK等实际错误；ok但配置不匹配需要同步客户端与云端。读操作不冒充成功开局或奖励验证。

## 可审阅候选

- 客户端：当前首页已获用户接受；daily-v1/500金币、每天一局及完整25步、持久化、去重链路已实现，本地证据见`docs/content-update-1235.md`。每日弹窗沿用已接受布局。
- 打包说明：`assets/_incoming/daily-activation/battle-candidate.zip`为15文件的源码候选（已补入`.npmrc`的`install-links=true`），不含node_modules，不把裸zip称为完整运行包。按已有云函数修复流程在隔离目录执行固定锁`npm ci --ignore-scripts --no-audit --no-fund`，之后使用开发者工具“上传并部署：所有文件”包含本地依赖；不采用未验证的云端安装。
- 本轮候选验证：`/private/tmp/daily-activation-20260922`隔离安装104包；首次offline复用用户缓存遇EPERM，改用临时缓存并受控联网安装成功，没有更改缓存所有权/全局设置。15份源码/锁/.npmrc/vendor安装后与候选和工作区逐字节一致；现有工作区node_modules与隔离重建逐文件无缺失、额外或内容差异。`npm ls --all --offline`、`cloud-dependency-security.js <artifact>`及入口require/main导出通过。未执行云业务；本地Node24不替代云端Node20验证。
- 服务端目录：`match3-wechat/cloudfunctions/battle/`；dailyInfo/dailyStart/dailyCheckpoint/dailySubmit路由、daily.js、daily-engine、已有依赖锁及vendor、本包MIT notice。
- 注意：本目录同时包含本轮好友续局v2及历史对战修复。更新共享battle会影响好友对战服务，不能称为仅更新一个不相关页面。升级前必须保存当前云版本或确认平台可回退版本，升级后测试既有创建/查询/退出；回滚需恢复先前云版本，不删除新集合。
- 新集合：daily_runs、daily_progress；客户端read=false/write=false，仅云函数可信身份读写。daily_runs按createdAt、daily_progress按updatedAt建立普通非唯一升序索引供现有定时清理使用。不开放客户端权限，不改battle_rooms规则。
- 保留现有清理触发器cleanup-battle-rooms；每日记录保留30天，未完成起局7天有效。开始记录绑定用户哈希/日期；逐步交换序列通过dailyCheckpoint保存于daily_runs，用于同局恢复和服务端重演，随每日记录清理；dailySubmit仍写入成绩和领奖凭证；发奖凭证按用户+日期稳定。
- 既有已确认隐私文案不自动冒充覆盖新增每日数据处理。需随首次启用确认docs/design/daily-challenge-v1.md中的数据增量；不上传用户资料用于设计、不新增统计服务。

## 实际执行进度

- 用户明确授权部署并验证，随后确认推进并允许临时本机CLI服务端口。此前锁屏/输入异常不撤销原部署授权。
- 原battle保存为不可变版本1，备注before-daily-20260922；原更新时间00:40:27，版本保存列表21:04:33。$LATEST 100%，保留回退。
- 为获授权的部署临时打开本机CLI服务端口，其他票据/默认信任开关未打开。验收后设置窗口操作异常，经用户授权重启仍未恢复稳定操作。2026-09-23用户确认已手动关闭服务端口，临时端口清理完成；关闭依据为用户确认，未另行自动复测。
- 两集合及两个索引已创建；官方CLI部署battle时显式--remote-npm-install false，包含已验证的本地固定锁依赖。不购买、不开放客户端权限、不发布客户端。
- 15文件zip完整性、工作区/zip/隔离目录逐字节一致、sync-daily-engine --check通过。只有index.js、daily.js、daily-engine/daily-challenge.js较旧候选变化，依赖输入未变，复用既有安装/安全验证。
- 上述真实云/游戏结果已完成，临时game.js恢复，现有主页及弹窗视觉未改变。当前测试账号9月23日机会已用于验收，按规则显示今日已完成；两个日期的正常奖励合计1000金币，没有删除云记录或重置每日次数。

## 实际启用的有界操作范围（已授权，执行中）

得到明确授权且只读核查吻合后：在cloud1-d9g4pv8m8457af92a备份/记录旧battle版本，更新battle代码，创建缺少的daily_runs/daily_progress及上述仅服务端权限和索引；不买套餐、不充值、不修改公共权限、不上传客户端/提审/发布。部署可回退代码，新增集合保留不删除。将产生正常云函数调用/数据库用量，不承诺为零费用。

验收：开发者工具中取得合法dailyInfo，开始一局并完成25步，服务端确认分数；500金币首次到账，重复提交同收据不重复入账；同日不能二次开局，断线续同局，失败后当天锁定；另核对好友创建/查询/退出。云验证会产生专用测试账号的起局/成绩记录，不能在未授权时提前写入。随后由用户手机实际点击验证。

云启用、开发者工具验证及临时端口清理已完成；端口关闭由用户确认。手机实际触控仍待验收。未使用本地绕过发奖来伪装恢复。
