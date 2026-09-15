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

当前 `js/render/assets.js` 引用的 29 张活跃素材不在忽略规则中：`res/home/` 下 6 张、两张游戏场景、5 张运行时棋子，以及 `res/ui/` 下 16 张统一 UI 运行图（含 3 张关卡节点）。

`res/audio/calm.mp3` 与 `res/audio/battle.mp3` 是运行时直接由 `wx.createInnerAudioContext` 播放的本地 BGM，不通过图片预加载器注册，也不在忽略规则中。`test/package-budget.js` 单独断言两文件均被打包且合计不超过 360 KiB；文件/API 播放失败时回退程序化 WebAudio BGM。旧 `calm.m4a`、`battle.m4a`、`sfx-acoustic.m4a` 只作 Git 可回滚历史，均由精确 file 规则排除。

棋子源图与运行图分离：`piece?-v2.png` 保留 512×512 透明源图，便于后续重新导出；小游戏运行时只加载由 `sips` 生成的 256×256 透明 `piece?-runtime.png`，不覆盖源图。

`game-icon-source.png` 与 `game-icon-144.png` 只用于平台图标资料，不被游戏运行时加载，因此保留在仓库但通过精确规则排除出客户端代码包。

## 当前体积快照

测量日期：2026-09-15（最终检查后）。

- 当前活跃素材共 3,181,224 字节；活跃素材预算为 `3.5 * 1024 * 1024 = 3,670,016` 字节，当前余量 488,792 字节。
- 双 BGM 实际时长均约 48.065 秒；calm 与 battle 均为 144,196 字节，合计 288,392 字节，低于 360 KiB 独立预算 80,248 字节。
- 2026-09-15采用完整横竖触发/通关尾音后，21cue音效精灵为61,022字节；独立预算由48KiB调整为64KiB，余4,514字节，保持32kbps质量。4MiB总上限不变。
- 按当前工作树排除 `cloudfunctions/`、`test/`、`tools/`、`levels/`、项目配置文件、README 和精确文件规则后，客户端静态文件未压缩估算为3,842,756字节（57个文件，包含THIRD_PARTY_NOTICES.txt），距离4MiB预算尚余351,548字节。2026-09-15失败换位反馈修复增加1,397字节代码，无新图片/音频资源。
- 精确字节数和剩余预算由 `node test/package-budget.js` 输出；每次素材或运行时代码变更后以该测试结果覆盖本节快照。

以上是文件系统静态估算，不等同于微信开发者工具最终生成的主包大小；`node test/package-budget.js` 会同时校验活跃素材预算、4 MiB 静态主包预算和忽略覆盖，最终包体仍以开发者工具“预览/上传”的包体积与包内容详情为准。

## 发布前复核

1. 修改忽略规则后关闭并重新打开项目，再执行一次完整编译。
2. 在开发者工具包内容详情中确认不存在 `cloudfunctions/`、`test/`、`tools/`。
3. 确认不再出现云函数 `.js` 被小游戏运行环境打包或执行的告警。
4. 右键 `cloudfunctions/battle`，确认云函数仍可独立上传并部署。
5. 记录预览包和上传包显示的实际主包大小；新增大体积素材后重新检查。
