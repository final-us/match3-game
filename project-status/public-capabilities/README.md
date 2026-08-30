# 消除公共能力接入

当前模式：`not-provisioned`。本项目只同步公共能力规则，不创建 TencentDB Team/Agent。项目侧可维护采用记录和 outbox，但不得保存运行时 ID、密钥或原始 Chat Memory。

未来如确需运行时接入，必须先将项目和主 Agent 登记到公共能力仓库，完成批准的 provisioning 与接入检查，再把模式按 `off -> read-only -> on` 推进。
