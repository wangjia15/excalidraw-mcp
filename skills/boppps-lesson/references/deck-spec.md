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
| `notes` | 讲稿/答案（Slideshow 演讲者备注） |
| `animate` | 默认 true，逐条出现；分析整页图时设 false |

每页内容不要堆：图（mermaid/image）+ ≤3 条 bullets，或 code + ≤3 条 bullets，或单独 vs/kpis/flow。

## Mermaid

正面的 `mermaid` 先写成占位框（虚线框 + 代码保存在 `customData.mermaid`，主题配色在 `customData.mermaidStyle`），再由 CLI 运行 `Mermaid to Excalidraw` 脚本，调用插件内置的 mermaid-to-excalidraw 转成原生元素，并按课件主题上色、换字体、去手绘、按占位框缩放（见 [tools.md](tools.md#按主题微调-mermaid-图)）。

- 支持良好：`flowchart`/`graph`、`sequenceDiagram`、`classDiagram`；其他类型（`stateDiagram`、`erDiagram`、`gantt`、`pie`…）插件会转成**图片**，也能显示但不可编辑。
- `flowchart LR` 节点 ≤ 6 个，多了用 `TD` 或拆两页（横向太长时缩放后字很小）；任何图 ≤ 10 个节点。
- 节点文字含 `()[]{}:;"` 时加引号：`A["service()"]`。中文可以直接写。
- `ratio`（宽/高）一般不用填：LR 2.4、TD 1.1、sequence 1.5、其他 1.6。图明显偏扁/偏高时再调。
- 简单线性流程优先用 `flow`（不需要转换）。

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
