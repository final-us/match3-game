# 开源与素材合规台账

## 项目版权边界

- 仓库继续公开，但公开仓库不等于开源许可。
- 本项目代码、文档和自有素材不添加项目级开源许可证，保留默认版权；不得把整个项目表述为 MIT 或其他开源项目。
- 第三方通知随小游戏主包保存在 [`match3-wechat/THIRD_PARTY_NOTICES.txt`](../../match3-wechat/THIRD_PARTY_NOTICES.txt)。该文件只记录第三方授权，不改变项目本身的版权边界。
- `node_modules/` 仅用于本地依赖验证，不加入 Git。

## 第三方组件与调研来源

| 组件/来源 | 版本或精确信息 | 许可证/状态 | 采用范围与处置 |
| --- | --- | --- | --- |
| [pixi-game-match3](https://github.com/xiaozhu188/pixi-game-match3) | commit `658679250f30ef8d01ff570eb976017c5727cbf0`；`src/match3/Match3Utility.ts` | MIT；版权行见主包 notice | 仅采用三消棋盘工具逻辑的本地适配，详见 `match3-wechat/js/core/grid.js` 与 notice；不是整个项目的许可证。 |
| `wx-server-sdk` | `4.0.2`，直接依赖于 `match3-wechat/cloudfunctions/battle` | MIT（以官方包与 package-lock.json 记录为准） | 仅随云函数部署使用；其 MIT 声明不自动覆盖许可证元数据未声明的独立传递包。 |
| 云函数 `package-lock.json` | 102 个依赖记录 | MIT 71；BSD-3-Clause 13；Apache-2.0 10；ISC 4；BlueOak-1.0.0 1；0BSD 1；UNDECLARED 2 | 客户端主包不包含 `cloudfunctions/`，但云函数部署会带入这些依赖。未声明项为 `@cloudbase/signature-nodejs@2.2.0` 与 `@cloudbase/wx-cloud-client-sdk@1.7.1`：二者的 npm 元数据和安装包均没有 license 声明或 LICENSE 文件。产品负责人决定继续采用腾讯官方依赖链，将二者登记为“厂商依赖例外”并接受残余商业合规风险；不虚构许可证、不复制或魔改签名代码，也不提交外部澄清请求。该例外不构成对二者授予 MIT 许可的声明。 |
| Gem-Match3 | CC BY-NC-ND 4.0；仅做过调研 | 拒绝复用 | 未复制代码、素材或其他可识别内容；因商业使用与禁止演绎限制，不进入项目或发布包。公开 README 不引用该名称。 |

## 当前发布素材

以下 12 张是 `js/render/assets.js` 当前完整注册的活跃素材，来源均记录为本项目内 Codex/OpenAI ImageGen 生成：

本地文件时间可佐证的制作批次为：首页 5 张生成于 2026-08-20（Asia/Shanghai），游戏场景与 512×512 棋子源图生成于 2026-08-22，256×256 运行图于 2026-08-22 使用 macOS `sips` 从对应源图缩放生成。这些时间只作为仓库内制作记录，不替代生成服务的原始任务记录或账户授权证明。

### 首页素材（5 张）

| 发布路径 | 来源记录 |
| --- | --- |
| `res/home/moonlit-garden-bg.jpg` | 本项目内 Codex/OpenAI ImageGen 生成 |
| `res/home/duel-cats.png` | 本项目内 Codex/OpenAI ImageGen 生成 |
| `res/home/title-logo.png` | 本项目内 Codex/OpenAI ImageGen 生成 |
| `res/home/button-primary.png` | 本项目内 Codex/OpenAI ImageGen 生成 |
| `res/home/button-secondary.png` | 本项目内 Codex/OpenAI ImageGen 生成 |

### 游戏场景（2 张）

| 发布路径 | 来源记录 |
| --- | --- |
| `res/game-background-v2.jpg` | 本项目内 Codex/OpenAI ImageGen 生成 |
| `res/level-background-v2.jpg` | 本项目内 Codex/OpenAI ImageGen 生成 |

### 运行时棋子（5 张）

| 发布路径 | 来源记录 |
| --- | --- |
| `res/piece1-runtime.png` | 对应 `res/piece1-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |
| `res/piece2-runtime.png` | 对应 `res/piece2-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |
| `res/piece3-runtime.png` | 对应 `res/piece3-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |
| `res/piece4-runtime.png` | 对应 `res/piece4-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |
| `res/piece5-runtime.png` | 对应 `res/piece5-v2.png` 的 512×512 源图缩放；源图为本项目内 Codex/OpenAI ImageGen 生成 |

本台账不编造 prompt ID、账户标识或账户条款。发布前必须由运营主体确认生成账户适用条款允许目标商业使用，并确保原始生成记录可追溯；在确认完成前，不应把来源状态解释为已完成商业授权审查。

Holopix 当前未采用，暂不进入发布包。

## 非发布素材与其他媒体

`res/piece1-v2.png` 至 `res/piece5-v2.png` 是上述运行时棋子的 512×512 ImageGen 源图，来源已记录；它们仅因包体体积被排除，不属于来源待确认的旧素材，也不得直接恢复到运行时引用。需要重新导出运行图时，应继续从这些源图生成并记录派生过程。

除上述 5 张棋子源图外，当前被忽略或未被 `assets.js` 引用的旧素材均标记为：非发布素材、来源待确认、不得重新启用。未经重新完成来源核验和发布审查，不得重新加入 `assets.js` 或取消对应包体忽略规则。

当前包括：

```text
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

音乐与音效由 WebAudio/代码合成，项目没有音频文件；项目没有捆绑第三方字体。

## 上线前检查项

- [ ] 复核项目仍未添加项目级开源许可证，公开仓库描述没有把整个项目写成 MIT，并保留默认版权边界。
- [ ] 复核 `THIRD_PARTY_NOTICES.txt` 的上游 URL、精确 commit、采用文件和完整 MIT 文本与 `grid.js` 本地修改一致。
- [ ] 复核两项 `UNDECLARED` 腾讯传递依赖仍被准确登记为“厂商依赖例外”，并保留产品负责人接受残余风险、不提交外部澄清请求的决策记录；不得把二者误写为 MIT。
- [ ] 由运营主体确认 Codex/OpenAI ImageGen 生成账户适用条款与目标商业使用相容，并保存可追溯的原始生成记录；不得补写未经证实的 prompt ID、账户或条款。
- [ ] 确认 Holopix 未被 `assets.js`、包体或发布流程采用。
- [ ] 运行 `node match3-wechat/test/open-source-and-assets.js` 和 `node match3-wechat/test/package-budget.js`；确认 12 张活跃素材存在且未被忽略，notice 文件仍在小游戏主包。
- [ ] 确认旧素材仍保持非发布、来源待确认、不得重新启用；确认 `node_modules/` 未加入 Git。
- [ ] 确认 512×512 棋子源图仍只作可追溯源文件使用，256×256 运行图的派生方式与日期有记录。
- [ ] 按微信官方当前发布、隐私、素材和云函数要求完成运营主体复核与真机/开发者工具包体检查。
