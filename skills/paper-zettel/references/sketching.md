# 草图画法

草图的作用是**帮助理解**，不是做成精美插图：手绘风格，元素少，标注清楚。

先看内置图形（`tensor`、`matrix`、`stack`、`patches`、`bars`、`template`，见 [card-spec.md](card-spec.md#图形visual)）能不能表达，不能时再画草图：卡片里写 `visual: {kind:"sketch", elements:[…]}`。

## 通用约定

- 元素用标准 Excalidraw JSON；`roughness: 1`、文字 `fontFamily: 5`（Excalifont）。在 `kind:"sketch"` 或 `obsidian_write_card` 的 `sketch` 里不写这两项时会自动填上。
- 坐标随意（从 0,0 开始即可），工具会把草图整体缩放后放进卡片的图形区（约 1000×650，两个图形时减半）。字号按缩放前写，画得太大字会被缩小。
- 颜色最多 3 种：主体 `#1e1e1e`，强调 `#e03131`（红），辅助 `#1971c2`（蓝）。浅色填充用 `#ffec99` / `#d0ebff` / `#ffc9c9`，`fillStyle: "hachure"` 更像手绘。
- 文字 ≥ 24px。标签文字单独做成 text 元素，坐标手动居中：`x = 框.x + (框.width - 字宽) / 2`；中文字宽 ≈ fontSize，英文 ≈ 0.56×fontSize。
- 元素顺序：先画背景框，再按每个节点“形状 → 标签”的顺序画，最后画箭头。
- id 用短字符串（如 `s1`、`s2`），工具会统一改成插件要求的 8 位 id。
- 张量形状写在箭头旁边，例如 `B×N×D`；不确定的维度写成符号，不要编数字。

## 常用草图套路

| 要理解的东西 | 画法 |
|---|---|
| 张量形状变化 | 一排矩形，宽高按维度大致成比例，中间用箭头连接，箭头上写操作名 |
| 注意力矩阵 | N×N 网格（4×4 就够），用深浅表示权重；因果掩码时把上三角涂灰 |
| Patch 切分 | 一个大正方形，画 3×3 虚线网格，旁边拉出一排小方块代表 token 序列 |
| 残差 / 归一化位置 | 竖向的模块堆叠，用一根弧线绕过模块表示残差，并标出 Pre-LN 还是 Post-LN |
| MoE 路由 | 一个 token 进入路由器，分出多条箭头指向专家框，只有 top-k 条用实线，其余用虚线（`strokeStyle: "dashed"`） |
| 损失曲线 / 扩展规律 | 坐标轴画两条 line，曲线用 line 多点折线表示，只画趋势，不标具体数值（除非论文给了） |
| 训练阶段 | 从左到右排几个圆角框，框下写数据量 |
| 对比学习 | 正样本对用绿色线拉近，负样本用红色线推开 |
| 扩散过程 | 一排图像框，从清晰到噪声，上面的箭头写 q（加噪），下面的箭头写 pθ（去噪） |

## 示例：缩放点积注意力（`elements` 数组）

```json
[
  {"type":"rectangle","id":"q","x":0,"y":120,"width":120,"height":240,"backgroundColor":"#d0ebff","fillStyle":"hachure"},
  {"type":"text","id":"qt","x":48,"y":222,"text":"Q","fontSize":36},
  {"type":"rectangle","id":"k","x":200,"y":180,"width":240,"height":120,"backgroundColor":"#d0ebff","fillStyle":"hachure"},
  {"type":"text","id":"kt","x":290,"y":222,"text":"Kᵀ","fontSize":36},
  {"type":"text","id":"x","x":150,"y":222,"text":"×","fontSize":36},
  {"type":"arrow","id":"a1","x":460,"y":240,"width":120,"height":0,"points":[[0,0],[120,0]]},
  {"type":"text","id":"a1t","x":470,"y":190,"text":"÷√d","fontSize":28,"strokeColor":"#e03131"},
  {"type":"rectangle","id":"s","x":600,"y":120,"width":240,"height":240,"backgroundColor":"#ffec99","fillStyle":"hachure"},
  {"type":"text","id":"st","x":640,"y":222,"text":"softmax","fontSize":32},
  {"type":"text","id":"n","x":600,"y":380,"text":"N×N 注意力权重","fontSize":24,"strokeColor":"#1971c2"}
]
```

## 独立草图（嵌入卡片正面）

图比较复杂（> 25 个元素）时，单独写成一个文件：

1. `obsidian_write_drawing`：`path: "Papers/<KEY>/sketches/<名称>.excalidraw.md"`，`style: "none"`，元素里自己写 `roughness: 1`、`fontFamily: 5`。可以同时写 `back`，说明这张草图在讲什么。
2. 在卡片里引用：`visual: {"kind": "figure", "path": "Papers/<KEY>/sketches/<名称>.excalidraw.md", "caption": "草图：…"}`。
3. 用 CLI 导出卡片 PNG，检查嵌入的草图能否正常显示。

## 用 CLI 在已有卡片上补画（精修）

用户在 Obsidian 里改过的卡片不要用 MCP 覆盖，而是用 `apply` 的 `add` 操作追加 skeleton 元素。skeleton 支持 `label`（容器内文字由插件自动测量和居中）和箭头的 `start`/`end` 绑定，比手算坐标更准。公式用 `latex` 操作：`{"op":"latex","text":"\\mathrm{softmax}(QK^T/\\sqrt{d})V","x":2100,"y":800}`。具体步骤见 [tools.md](tools.md)。
