# 工具速查：MCP 生成 + CLI 转 Mermaid + 验图

## MCP 工具（每次调用都传 `vault: "<VAULT>"`）

| 工具 | 用途 |
|---|---|
| `obsidian_write_slides` | 课件主力工具：`deck` + `back`（教案）+ `properties` + `theme` |
| `obsidian_read_drawing` | `withBack: true` 读出 `{frontmatter, back, elements}`，覆盖前确认 |
| `obsidian_list_drawings` | 查某课程目录下已有的课件，定讲次编号 |
| `obsidian_write_mindmap` | 可选：整门课的知识地图，叶子链接各讲课件 |
| `obsidian_write_template` | 可选：单独的模板图（对比、时间线、四象限…）嵌入课件 `image` |
| `obsidian_install_vault_files` | 把 Mermaid 转换脚本和主题 CSS 装进 vault；默认只列计划，`apply:true` 才写，已有文件不覆盖 |

## CLI（Obsidian 原生命令）

```sh
OB=obsidian   # Windows 不在 PATH 时：OB="$LOCALAPPDATA/Programs/Obsidian/Obsidian.com"
"$OB" vault=<VNAME> obsidian-excalidraw-plugin:status
```

- `vault=` 放在命令前。输出是 JSON，检查 `ok`、`status`、`mutation`、`persistence`；退出码 0 不代表成功。
- 写操作（`script` / `apply` / `export`）每次用新的唯一 `requestId`（`^[A-Za-z0-9_.-]{1,80}$`），如 `sb4-05-mmd-1`。
- 参数复杂时把请求 JSON 写到 vault 的 `_cli/<requestId>.json`，用 `input=_cli/<requestId>.json` 传入。字段以 `schema action=<命令>` 为准。

### 转换 Mermaid

```sh
P="springboot4/05 Spring MVC 请求流程/05 Spring MVC 请求流程 课件.excalidraw.md"
"$OB" vault=<VNAME> obsidian-excalidraw-plugin:open path="$P"
"$OB" vault=<VNAME> obsidian-excalidraw-plugin:script path="$P" \
  script="Excalidraw/Scripts/Mermaid to Excalidraw.md" trusted=true requestId=sb4-05-mmd-1
```

- 必须先 `open`（脚本作用于打开的视图）。
- 返回 `data.summary` 形如 `Mermaid to Excalidraw: 3/3 converted`；`data.report[]` 每项 `{id, ok, elements, scale}` 或 `{id, ok:false, error}`。
- 可选 `args='{"maxScale":1.8,"fontSize":20,"sketch":false}'`；`ids` 只转指定占位框。
- 每项 report 有 `minFont`（缩放后最小字号）：< 16 在 1920 宽的幻灯片上偏小 → 改 `TD`、减节点、缩短标签，或去掉该页 bullets 让图占满整页。

### 按主题微调 Mermaid 图

MCP 写占位框时把当前 `theme` 的配色存进 `customData.mermaidStyle`；脚本转换时自动套用：

| 角色 | 识别方式 | 默认取色（主题） |
|---|---|---|
| `node` | 普通矩形 | series[0]（campus：金边米底，圆角） |
| `decision` | 菱形 | series[1]（campus：藏青） |
| `terminal` | 椭圆/圆 | series[2] |
| `group` | 包住其他节点的框（subgraph） | soft 底 + line 细边 |
| `actor` | 时序图的参与者/注释框 | hintBg + accent |
| `line` / `edgeText` / `text` | 连线、边标签、节点文字 | ink2 / ink2 / ink |

同时：线条去手绘（roughness 0）、字体换成课件正文字体；标签放不下时先把字缩小到 0.85×，再加宽形状并把左右的节点和连线向两侧推开（不重叠）。

微调用 CLI 的 `args.style` 覆盖部分颜色（与主题合并），例如强调判断节点：

```sh
"$OB" vault=<VNAME> obsidian-excalidraw-plugin:script path="$P" script="Excalidraw/Scripts/Mermaid to Excalidraw.md"   trusted=true requestId=sb4-05-mmd-2 args='{"style":{"decision":{"fill":"#fdf3dc","stroke":"#b8923f"},"line":"#35495e"}}'
```

- `args.theme:false` 保留 mermaid 原色；`args.sketch:true` 保留手绘风格。
- 脚本只处理还没转换的占位框；要换配色重新转：先 MCP `overwrite` 重写（占位框回来），再带新 `args` 运行。只改个别元素用 `apply`。
- `persistence` 可能是 `unknown`：脚本最后会 `forceSave`，以 `export source=disk` 的结果为准。
- 脚本缺失时：调用 `obsidian_install_vault_files`（`items:["scripts"]`，先看计划，用户同意后 `apply:true`）。
- **MCP `overwrite` 重写后占位框会回来，必须重新转换。**
- 转换失败（`error`）：多半是 Mermaid 语法问题（未加引号的括号、冒号），改代码后重写再转。

### 验图

像素上限按**整个场景**算：宽×高×scale² ≤ 16M，单边 ≤ 16384，即使只导出 `area`。课件帧是 1920×1080 竖向排列，20 页约 1920×24000 → 全图要 `scale≈0.15`，太小看不清，所以：

- 全图概览：`scale=0.15`，只看页序和版式。
- 逐页检查：`area` = 该页帧（`obsidian_read_drawing` 里 `type:"frame"` 元素的 x/y/width/height），`scale ≤ sqrt(16e6/(场景宽×场景高))`；超限就降 scale，或分几次导出。

```json
{"apiVersion":1,"command":"export","requestId":"sb4-05-png-p8","path":"springboot4/05 Spring MVC 请求流程/05 Spring MVC 请求流程 课件.excalidraw.md",
 "source":"disk","out":"springboot4/05 Spring MVC 请求流程/_preview/p8.png","scale":0.5,"area":{"x":0,"y":8400,"width":1920,"height":1080}}
```

```sh
"$OB" vault=<VNAME> obsidian-excalidraw-plugin:export input=_cli/sb4-05-png-p8.json
```

用 Read 看 PNG，至少检查：封面、一张 Mermaid 页、一张代码页、一张图片页、一张活动页。重点：

- Mermaid 是否已转换（还是虚线占位框）、字是否太小（太小 → 改 `TD`、减节点或拆页）
- 代码是否被截断、文字是否溢出/重叠
- 图片是否显示（空白框 → 路径不对或文件还没被索引）
- 六点进度和徽章是否对应环节

`out` 已存在时换新文件名，不要擅自加 `overwrite=true`。

### 精修：apply

用户在 Obsidian 手改过课件后，只用 `apply` 局部修改：`read path=… source=live detail=elements` 取 `data.revision` → 写 `{"command":"apply","expectedRevision":…,"operations":[{"op":"update","id":"…","set":{…}}]}` → 执行 → 重新导出复查。`STALE_REVISION` 重新读版本；`BUSY`/输出丢失用 `result requestId=…` 查回执，不要自动重试。

### 放映

在 Obsidian 打开课件，命令面板运行 `Slideshow`（`Excalidraw/Scripts/Downloaded/Slideshow.md`），按帧顺序播放，`notes` 显示为演讲者备注。
