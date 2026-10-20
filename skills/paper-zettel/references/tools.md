# 工具速查：图表截取 + MCP 生成 + CLI 验证与精修

## 截取论文图表

```sh
S=~/.claude/skills/paper-zettel/scripts/pdf_figures.py
A=I:/obsidiannote/paper-zettel/Papers/VIT/assets
python -I $S auto  Inbox/vit.pdf $A                 # fig<N>.png、tab<N>.png、figures.json
python -I $S pages Inbox/vit.pdf $A/../_preview --pages 8 --zoom 1   # 渲染整页，打印页面尺寸（pt）
python -I $S crop  Inbox/vit.pdf $A 8 380 335 510 592 fig6         # 按 PDF 坐标（pt）补截
```

- `auto` 按 "Figure N / Table N" 图注定位，图一般在图注上方，表在离图注较近的一侧。输出 `MISSING` 的条目也会写进 `figures.json`（`file: null`，带 `caption_bbox`），常见原因是正文环绕的侧边图。
- 补截：先 `pages` 渲染该页（`--zoom 1` 时图片像素 = pt），用 Read 看图估计坐标，再 `crop`。
- **每张要用的截图都用 Read 检查**：是否混进了别的图、正文，或缺了一部分。
- 同一编号出现多次时（正文中提到 "Figure 2"），脚本保留面积最大的那次。

## MCP（服务器 `excalidraw-zettel`，vault = paper-zettel）

| 工具 | 用途 |
|---|---|
| `obsidian_write_paper_board` | 一篇论文的卡片盒：导图 + 全部卡片 + Markdown 面（主力工具） |
| `obsidian_write_card` | 单张双面卡片，用于 `Zettel/` 永久卡 |
| `obsidian_read_drawing` | `withBack: true` 返回 `{frontmatter, back, elements}` |
| `obsidian_list_drawings` | 列出某个目录下的绘图，查重时用 |
| `obsidian_write_mindmap` | 领域地图 `Index/` |
| `obsidian_write_drawing` | 独立草图；或原样写回元素（例如只更新永久卡背面：`elements` = 原数组、`style:"none"`、新 `back`、`overwrite:true`） |
| `obsidian_write_template` / `obsidian_template_help` | 模板图；卡片里用 `visual.kind:"template"` 时查 spec 格式 |

所有写工具都支持 `back`、`properties`、`overwrite`。覆盖时省略 `back` 或 `properties`，会保留文件里原有的内容。

## CLI（Obsidian 原生命令）

```sh
OB="$LOCALAPPDATA/Programs/Obsidian/Obsidian.com"
"$OB" vault=paper-zettel obsidian-excalidraw-plugin:status
```

- `vault=` 必须放在命令前面。输出是 JSON，要检查 `ok`、`status`、`mutation`、`persistence`，退出码为 0 不代表成功。
- 写操作（`create` / `apply` / `export`）必须带唯一 `requestId`（`^[A-Za-z0-9_.-]{1,80}$`），例如 `vit-board-png-1`。
- 参数复杂时（如 `area`），把请求 JSON 写到 vault 的 `_cli/<requestId>.json`，再用 `input=_cli/<requestId>.json` 传入。
- 字段以运行时的 `schema action=<命令>` 返回为准。

### 验图

**像素上限**：插件按**整个场景**的尺寸 × `scale` 计算像素，即使只导出 `area`。限制是 宽×高×scale² ≤ 16M 且单边 ≤ 16384。卡片盒全图通常约 4600×2600，所以：

- 全图：`scale=0.4` 左右。
- 单张卡：`area` = 该卡的帧（读 `obsidian_read_drawing` 里 `type:"frame"` 元素的 x/y/width/height），`scale ≤ sqrt(16e6 / (全图宽×全图高))`，约 0.8。
- 报 "Export exceeds 16 million pixels" 就降低 scale。

```json
{"apiVersion":1,"command":"export","requestId":"vit-card-m01-1","path":"Papers/VIT/VIT 卡片盒.excalidraw.md",
 "source":"disk","out":"Papers/VIT/_preview/m01-1.png","scale":0.8,"area":{"x":355,"y":-560,"width":960,"height":540}}
```

```sh
"$OB" vault=paper-zettel obsidian-excalidraw-plugin:export input=_cli/vit-card-m01-1.json
```

用 Read 打开 `I:/obsidiannote/paper-zettel/Papers/VIT/_preview/m01-1.png`，检查：

- 标题、要点是否溢出或重叠；图形是否太小（太小就减少同卡图形数量，或改成上下排列的单一图形）
- 原图标注：红色编号圈和虚线框是否落在要解读的位置上
- 原图是否显示（空白框说明路径不对，或文件还没被索引）
- 链接：`read source=disk detail=elements` 后检查卡片背景元素的 `link`

`out` 已存在时，需要用户明确同意才能加 `overwrite=true`；否则换新文件名。

### 精修：apply

1. 读取实时版本号：`read path=... source=live detail=elements`，记下 `data.revision` 和要改的元素 id；有 `nextOffset` 就继续翻页。
2. 写请求文件 `_cli/vit-fix-1.json`：

```json
{"apiVersion":1,"command":"apply","requestId":"vit-fix-1","path":"Papers/VIT/VIT 卡片盒.excalidraw.md",
 "expectedRevision":"<revision>",
 "operations":[
   {"op":"update","id":"<元素id>","set":{"fontSize":20}},
   {"op":"latex","text":"z_0=[x_{cls};x_p^1E;\\dots]+E_{pos}","x":400,"y":-300}
 ]}
```

3. 执行：`"$OB" vault=paper-zettel obsidian-excalidraw-plugin:apply input=_cli/vit-fix-1.json`
4. `STALE_REVISION`：重新读版本号再判断是否还需要；`BUSY` 或输出丢失：用 `result requestId=vit-fix-1` 查回执，**不要自动重试**。
5. 重新导出 PNG 复查。

可用操作：add / update / delete / connect / group / ungroup / image / latex。卡片盒用 apply 改过之后，**不要再用 MCP `overwrite` 重写**，否则手工修改会丢失；确实需要重写时先告诉用户。
