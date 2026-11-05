# 课件规格：`obsidian_write_slides`

| 参数 | 说明 |
|---|---|
| `path` | `<课程目录>/<NN 主题>/<NN 主题> 课件.excalidraw.md`，如 `springboot4/05 Spring MVC 请求流程/05 Spring MVC 请求流程 课件.excalidraw.md` |
| `deck` | deck JSON 字符串（见下） |
| `back` | 教案全文（[lesson-plan.md](lesson-plan.md)） |
| `properties` | frontmatter JSON |
| `theme` | `campus`（默认）/ `campus43` / `blackboard` / `ink` / `swiss` |
| `overwrite` | 重写时 true；省略 `back`/`properties` 会保留原值 |

```json
{"title":"Spring MVC 请求处理流程","titleFont":"sans","bodyFont":"sans",
 "slides":[
  {"title":"Spring MVC 请求处理流程","subtitle":"第 5 讲 · Spring Boot 4","type":"cover"},
  {"type":"stage","stage":"b","title":"导入","badge":"4 分钟"},
  {"stage":"b","title":"点一下按钮，后台发生了什么？","image":{"path":"springboot4/05 …/assets/browser.png","caption":"浏览器开发者工具"},"bullets":["…"],"notes":"讲稿…"},
  {"type":"stage","stage":"p2","title":"参与式学习","badge":"28 分钟"},
  {"stage":"p2","title":"1 DispatcherServlet 统一分发请求",
   "mermaid":{"code":"flowchart LR\n  A[浏览器] --> B[DispatcherServlet]\n  B --> C{HandlerMapping}\n  C --> D[Controller]","caption":"一次请求的路径"},
   "bullets":["前端控制器：所有请求先到这里","映射器：按 URL 找处理器"]},
  {"stage":"p2","title":"2 写一个最小 Controller","code":"@RestController\nclass HelloController {\n  @GetMapping(\"/hi\") // ①\n  String hi() { return \"hi\"; }\n}","codeLang":"java","bullets":["① 映射 GET /hi"]},
  {"stage":"p2","title":"配对讨论：请求为什么 404？","act":"配对讨论 · 3 分钟","callouts":[{"kind":"ask","text":"…"}]}
 ]}
```

## 字段

| 字段 | 用途 / 注意 |
|---|---|
| `title` | 结论句 ≤ 20 字；开头数字（`"2 …"`）显示为章节编号圈 |
| `subtitle` | 一句上下文 |
| `stage` | `b` `o` `p1` `p2` `p3` `s`，点亮六点进度 |
| `type` | `stage`：环节分隔页；`cover`：封面（第一页默认就是封面）；无内容的页自动变成分隔页 |
| `badge` | 时长，如 `"8 分钟"` |
| `act` | 活动标签，如 `"动手 · 8 分钟"` |
| `bullets` | ≤ 5 条。`"头：正文"` → 卡片；`①`/`1.` 开头 → 步骤；含 `→` → 表格；其他 → 列表。`layout` 可强制 `list/cards/steps/table` |
| `code` / `codeLang` / `codeTitle` | ≤ 18 行；java/ts/vue/yaml/json/http/sh/xml 高亮 |
| `flow` | 3–8 个短语 → 蛇形流程图（不需要 Mermaid 转换，适合简单线性流程） |
| `vs` | `{left:{title,items},right:{title,items}}` 对比 |
| `kpis` | `[{num,label}]` 大数字 |
| `kv` | `[[键,值]]` 定义/术语表 |
| `image` | `{path, caption}`，vault 内图片 |
| `mermaid` | 字符串，或 `{code, ratio?, caption?}`；与 `image` 二选一 |
| `callouts` | `[{kind:"tip"|"warn"|"task"|"ask", text}]`，最多 2 条 |
| `notes` | **讲稿**（必填，见下）：Slideshow 演讲者备注，同时写到背面该页的"讲稿"callout |
| `animate` | 默认 true，逐条出现；分析整页图时设 false |

每页内容不要堆：图（mermaid/image）+ ≤3 条 bullets，或 code + ≤3 条 bullets，或单独 vs/kpis/flow。

## 讲稿（`notes`）

背面会为每页自动生成一节：幻灯片嵌入 + `notes` 讲稿（见 [lesson-plan.md](lesson-plan.md)），所以讲稿就是教案里这一页的"怎么讲"：

- **每张内容页和活动页都必须有 `notes`**；封面、环节分隔页写一两句过渡语（"接下来我们先做个小测……"）。
- 写成老师能照着说的口语，按讲的顺序：开场一句 → 逐条讲要点（与 bullets/代码 ① 编号对应）→ 提问或过渡到下一页。一般 80–200 字，约等于这页的讲解时长。
- 活动页写清楚指令、时间、巡视看什么、预期答案和常见错误；前测/后测页写答案和讲评要点（答案只放这里，不放正面）。
- 用 `\n` 分段；可用 Markdown（加粗、`代码`），不要用标题行。

## Mermaid

正面的 `mermaid` 先写成占位框（虚线框 + 代码保存在 `customData.mermaid`，主题配色在 `customData.mermaidStyle`），再由 CLI 运行 `Mermaid to Excalidraw` 脚本，调用插件内置的 mermaid-to-excalidraw 转换，并按占位框缩放（见 [tools.md](tools.md#按主题微调-mermaid-图)）。**可视化内容尽量用 Mermaid 图型，少做纯文字页。**转换结果分两种：

- **原生元素**（可编辑、按课件主题上色、去手绘）：`flowchart`/`graph`、`sequenceDiagram`、`classDiagram`
- **图片元素**（整图转成一张图片，可显示、保留 mermaid 自身浅色配色、不可编辑、不套主题色、`minFont` 为 null）：其余类型都支持——`timeline`、`mindmap`、`xychart-beta`、`quadrantChart`、`radar-beta`、`sankey-beta`、`block-beta`、`packet-beta`、`gitGraph`、`pie`、`architecture-beta`、`journey`、`gantt`、`erDiagram`、`stateDiagram` 等（pele.run/examples 所列类型；2026-11 在 Excalidraw 2.29.1 实测前 12 种全部转换成功）
- **pele 样式模式**：转换脚本加 `args {"render":"pele"}` 时用 Obsidian 主题的 CSS 变量配色替代课件主题配色（pele 观感）；flowchart/sequence/class 仍是可编辑原生元素，图片型图型不变；见 [tools.md](tools.md#转换-mermaid)

### 按内容选图型

| 想表达 | 图型 |
|---|---|
| 数值对比、消融、趋势 | `xychart-beta`（bar 和 line 可同图） |
| 演进历程、方法谱系、课程回顾 | `timeline` |
| 知识结构、章节小结 | `mindmap` |
| 多维度对比（模型、方案） | `radar-beta` |
| 选型、优先级讨论 | `quadrantChart` |
| 占比、配比、流向 | `pie`；流向配比用 `sankey-beta` |
| 系统架构、部署组成 | `architecture-beta`；简单模块关系用 `block-beta` |
| 网络协议报文头 | `packet-beta` |
| 分支 / 版本管理演示 | `gitGraph` |
| 流程、数据流 | `flowchart`（原生） |
| 交互时序、类关系 | `sequenceDiagram`、`classDiagram`（原生） |

简单线性流程仍优先用 `flow` 字段（不需要转换）。

### 语法注意（转换器实测，2026-11）

- 节点/标签含 `()[]{}:;"` 时加引号：`A["service()"]`。中文一般可直接写。
- `radar-beta`：数值用**花括号** `curve c1["CNN"]{70, 60, 80, 90, 95}`（pele 示例的冒号写法不被转换器识别）。
- `architecture-beta`：没有 `storage` 关键字，统一写 `service 名(图标)[标签] in 组名`（图标：server/browser/database/cloud…）；边用**冒号方向**语法 `a:R --> L:b`（方向 R/L/T/B）。
- `sankey-beta`：节点名**只能 ASCII**（中文名加引号也解析失败），中文说明放 `caption`。
- `flowchart LR` 节点 ≤ 6 个，多了用 `TD` 或拆两页（横向太长时缩放后字很小）；任何图 ≤ 12 个节点。
- `ratio`（宽/高）参考：timeline/packet 2.2、gitGraph 2.0、xychart/sankey 1.7、architecture/block 1.5–1.6、mindmap 1.2、quadrant 1.1、radar/pie 1.0；图明显偏扁/偏高时再调。

## 网上图片

1. 搜：WebSearch `<关键词> site:commons.wikimedia.org` 或官方文档；也可在 WebFetch 的页面里找图片 URL。Wikimedia 图片页的原图 URL 形如 `https://upload.wikimedia.org/...`。
2. 下载到**新建的**讲目录 `assets/`：

   ```sh
   A="<VAULT>/<课程>/<NN 主题>/assets"; mkdir -p "$A"
   curl -L --fail -A "Mozilla/5.0" -o "$A/dispatcher.png" "<图片URL>"
   file "$A/dispatcher.png"     # 必须是 PNG/JPEG/GIF/WebP 图片
   ```

3. 用 Read 看图：内容是否正确、清晰度够不够、有没有水印。
4. SVG 先转 PNG（工具只读 PNG/JPEG/GIF/WebP 尺寸）：`magick in.svg out.png`；没有 ImageMagick 就换一张位图。
5. 在教案"参考资料与图片来源"写：文件名、来源页 URL、作者、许可。
6. 找不到合适的图：`mcp__magpie-image__generate_image`（`path` 设为 assets 下的文件），来源写"AI 生成"。
