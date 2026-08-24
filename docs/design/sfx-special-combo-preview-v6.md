# 特殊棋子组合音效 V6 试听

状态：仅供听感确认，未修改运行时代码。V4 中已确认的火箭、炸弹和彩球单独音效保持不变。

## 时间轴

优先试听带当前游戏 BGM 的 `sfx-special-combo-preview-mixed-v6.wav`；`sfx-special-combo-preview-v6.wav` 为纯音效版。

| 时间 | 方案 | 组合 | 听感方向 |
| ---: | --- | --- | --- |
| 0.65s | A | 双特殊 | 马林巴、木琴式短句，轻快圆润 |
| 3.45s | A | 三特殊 | 上扬木琴滑奏，明亮但不爆裂 |
| 6.25s | A | 四个及以上 | 音乐盒梳音魔法扫过，层次最完整 |
| 10.40s | B | 双特殊 | 软质布偶冲击，短而不刺耳 |
| 13.20s | B | 三特殊 | 更厚的软质冲击 |
| 16.00s | B | 四个及以上 | 低调的实体铃声冲击 |

A、B 两组的每一档都是一个独立源文件经连续裁切、滤波、轻微变速和响度匹配得到；一次触发只播放一个完整 one-shot。没有拼接现有火箭、炸弹、彩球或其他短音效。

两份试听均为 18 秒、22050 Hz、16-bit、单声道。纯音效版峰值 `0.4603`、SHA256 `d96945346208d819570ca59d9e8995b3361a732430f45d2823ae7ad41113dc76`；混合版峰值 `0.5743`、SHA256 `79712bd6ae24ee9e6ce97715f8c7ea30c43568175021c9bfaed63750e633ea67`，均无削波。

## 来源与许可

| 来源 | 用途 | 许可 | 本次公开 HQ 预览/压缩包 SHA256 |
| --- | --- | --- | --- |
| [Blink sound effect / modusmogulus](https://freesound.org/people/modusmogulus/sounds/787872/) | A 组双特殊 | CC0 | `53996f39a5fbaeebd9e54d6667105e3fb494c55599c0557b5d274372725008e3` |
| [glissando_xylophone / HappyPizzaBread](https://freesound.org/people/HappyPizzaBread/sounds/823182/) | A 组三特殊 | CC0 | `c200c4b993c08da596ac523725e902aade96dff17f4382996b4ed0abe9250087` |
| [Cliche Magic Spell Sound / qubodup](https://freesound.org/people/qubodup/sounds/817466/) | A 组四个及以上 | CC0 | `36d951736776288334ca6a88a8d4afaafc159c6aca28fbeffe0b70804eb125d1` |
| [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) | B 组三档 | CC0 | `029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8` |

所有源素材及转换中间文件只保存在 `/tmp`，不进入小游戏包。正式接入时只保留最终选中的三段压缩音效。
