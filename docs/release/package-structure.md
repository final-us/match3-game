# 微信小游戏包结构与忽略规则

## 项目根目录

- 微信开发者工具导入目录：`match3-wechat/`。
- 小游戏运行入口：`game.js`。
- 云函数根目录：`cloudfunctions/`，由 `project.config.json` 的 `cloudfunctionRoot` 声明。
- 云函数继续保留在项目内，通过微信开发者工具单独上传和部署；不移动目录。

## 客户端打包忽略规则

`project.config.json` 的 `packOptions.ignore` 排除以下仅开发或服务端目录：

| 目录 | 原因 |
| --- | --- |
| `cloudfunctions/` | Node.js 云函数服务端代码，不应进入小游戏客户端预览或上传包。 |
| `test/` | 本地 Node.js 测试脚本，不是运行时依赖。 |
| `tools/` | 本地关卡生成工具，不是运行时依赖。 |

规则使用微信开发者工具支持的 `{ "type": "folder", "value": "..." }` 格式，路径相对小游戏项目根目录。`packOptions.include` 保持为空，避免其更高优先级重新包含已忽略目录。

另外使用精确 `{ "type": "file", "value": "..." }` 规则排除以下不会被运行时引用的根目录素材：

```text
res/piece1-v2.png
res/piece2-v2.png
res/piece3-v2.png
res/piece4-v2.png
res/piece5-v2.png
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

当前 `js/render/assets.js` 引用的 12 张活跃素材不在忽略规则中：`res/home/` 下 5 张、`res/game-background-v2.jpg`、`res/level-background-v2.jpg`，以及 `res/piece1-runtime.png` 至 `res/piece5-runtime.png`。

棋子源图与运行图分离：`piece?-v2.png` 保留 512×512 透明源图，便于后续重新导出；小游戏运行时只加载由 `sips` 生成的 256×256 透明 `piece?-runtime.png`，不覆盖源图。

## 当前体积快照

测量日期：2026-08-22。

- 12 张活跃素材优化前为 4,240,528 字节，切换运行图后为 3,053,060 字节，减少 1,187,468 字节（约 28.0%）。
- 活跃素材预算为 `3.5 * 1024 * 1024 = 3,670,016` 字节，当前余量 616,956 字节。
- 按当前工作树排除 `cloudfunctions/`、`test/`、`tools/`、项目配置文件、README 和上述精确文件规则后，客户端静态文件未压缩估算为 3,258,123 字节（52 个文件，包含 `THIRD_PARTY_NOTICES.txt`），距离 4 MiB 预算尚余 936,181 字节。

以上是文件系统静态估算，不等同于微信开发者工具最终生成的主包大小；`node test/package-budget.js` 会同时校验活跃素材预算、4 MiB 静态主包预算和忽略覆盖，最终包体仍以开发者工具“预览/上传”的包体积与包内容详情为准。

## 发布前复核

1. 修改忽略规则后关闭并重新打开项目，再执行一次完整编译。
2. 在开发者工具包内容详情中确认不存在 `cloudfunctions/`、`test/`、`tools/`。
3. 确认不再出现云函数 `.js` 被小游戏运行环境打包或执行的告警。
4. 右键 `cloudfunctions/battle`，确认云函数仍可独立上传并部署。
5. 记录预览包和上传包显示的实际主包大小；新增大体积素材后重新检查。
