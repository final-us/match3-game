# UI 生成素材记录（2026-08-23）

本目录保存本轮被选用的设计源图；小游戏运行图位于 `match3-wechat/res/ui/`。全部使用 Codex 内置 ImageGen 生成模式，以 `codex-clipboard-b484dd92-f43a-40a8-b557-b518619d026e.png` 和项目内月夜花园场景作为视觉参考；无 prompt ID、账户标识或商业授权结论的虚构记录。

| 源图 | 运行图 | 生成提示摘要 |
| --- | --- | --- |
| `coin.png` | `res/ui/coin.png` | 猫爪金币，暖金立体，奶油高光，透明背景，无文字数字 |
| `heart.png` | `res/ui/heart.png` | 樱花粉爱心体力图标，暖金描边，透明背景，无文字数字 |
| `shop.png` | `res/ui/shop.png` | 紫粉猫耳购物袋，暖金细节，透明背景，无文字 |
| `settings.png` | `res/ui/settings.png` | 奶油金猫咪齿轮，紫粉装饰，透明背景，无文字 |
| `timer.png` | `res/ui/timer.png` | 猫耳沙漏，暖金与薰衣草紫配色，透明背景，无数字 |
| `moves-paw.png` | `res/ui/moves-paw.png` | 粉紫猫爪步数徽章，暖金外圈，治愈 3D 质感，透明背景 |
| `tool-hammer.png` | `res/ui/tool-hammer.png` | 猫爪软锤道具，粉紫与暖金，透明背景，缩小时可读 |
| `tool-bomb.png` | `res/ui/tool-bomb.png` | 薰衣草紫猫咪炸弹，星光引线，透明背景，原创造型 |
| `tool-yarn.png` | `res/ui/tool-yarn.png` | 彩虹毛线球与猫爪魔法棒，透明背景，表达换色能力 |
| `result-happy-cat.png` | `res/ui/result-happy-cat.png` | 开心大笑、举起双爪的灰色猫咪，星光点缀，透明背景 |
| `result-sad-cat.png` | `res/ui/result-sad-cat.png` | 垂耳失望、沮丧含泪的灰色猫咪，透明背景 |
| `special-row-beam.png` | `res/ui/special-row-beam.png` | 横向猫爪魔法光束，粉紫光带、暖金星光、双向箭头，透明背景 |
| `level-nodes/level-node-current-source.png` | `res/ui/level-node-current-v2.png` | 当前关：粉紫猫耳圆形珐琅徽章、香槟金边、花朵与灯笼装饰；中心留空供代码绘制动态关卡号 |
| `level-nodes/level-node-done-source.png` | `res/ui/level-node-done-v2.png` | 已完成：与当前关同构的月光蓝紫徽章，降低视觉优先级；无文字、数字或星级 |
| `level-nodes/level-node-locked-source.png` | `res/ui/level-node-locked-v2.png` | 未解锁：深靛蓝低饱和徽章、暗化灯光与金边；中心留空，不内置锁或数字 |

派生方式：设计源图使用 macOS `sips` 缩放到目标运行尺寸；首批 12 张运行图再使用 Pillow 12.3.0 以 128 色调色板优化透明 PNG。三张关卡节点运行图最长边为 256px，保留透明背景和小尺寸轮廓。设计源图不在微信小游戏项目目录内，因此不会进入主包。

上线前仍需由运营主体确认生成账户适用条款允许目标商业使用，并保留可追溯的原始生成任务记录。
