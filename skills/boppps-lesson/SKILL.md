---
name: boppps-lesson
description: 按 BOPPPS 教学模式生成教学用 PPT 和配套教案：一个 Excalidraw 文档 = 一讲课。正面（Excalidraw 面）是 16:9 幻灯片（BOPPPS 六点进度、环节分隔页、时长徽章、代码高亮、Mermaid 图经插件内置 mermaid-to-excalidraw 转成原生图形、网上搜集的配图、逐条动画、演讲者备注，可用 Slideshow 放映），背面（Markdown 面）是根据这套 PPT 写的完整教案（学情、目标、重难点、BOPPPS 教学过程表、板书、作业、反思、图片来源），后面逐页附幻灯片引用和该页讲稿。用户提供资料就读资料，没提供就上网搜索教学内容。存入用户的 Obsidian vault，生成用本插件的 Excalidraw MCP 工具，Mermaid 转换与验图用 Obsidian Excalidraw 原生 CLI。当用户说"做一讲课件/PPT + 教案""按 BOPPPS 设计一节课""生成教学 PPT 和教案""给 X 主题备课"，或给出教材/讲义/链接希望做成课件和教案时使用。
---

# BOPPPS 课件 + 教案（boppps-lesson）

一讲课 = **一个文档** `<课程目录>/<NN 主题>/<NN 主题> 课件.excalidraw.md`：

- **正面（Excalidraw 面）**：教学 PPT。封面 → 每个 BOPPPS 环节一张分隔页 + 若干内容页。每页右上角有六点进度（当前环节高亮），标题旁有时长徽章（`badge`）和活动标签（`act`），要点逐条出现，`notes` 是讲稿。用 Slideshow 脚本放映。
- **背面（Markdown 面）**：
  1. 教案（`back`），按 [references/lesson-plan.md](references/lesson-plan.md) 模板写。教学过程表的"幻灯片"列链接到下面对应页（`[[课件#^p08|8]]`）。
  2. `## 幻灯片与讲稿`：工具根据 deck **自动生成**，每页一节 `### P<NN> <标题>` = 该页幻灯片嵌入 + `> [!note] 讲稿`（该页 `notes`）。每次重写自动更新，不要手写或手改。

  翻面用命令面板 `Excalidraw: Toggle between Excalidraw and Markdown mode`。

## 0. 环境（每次开始先确认）

| 项 | 值 |
|---|---|
| Vault | 用户指定的课程 vault（绝对路径，例如 `D:\notes\course`）。没指定时用 MCP 默认 vault（插件配置的 `OBSIDIAN_VAULT`）；两者都没有就问用户。下文 `<VAULT>` 指 vault 根目录，`<VNAME>` 指它在 Obsidian 里的名字（通常就是文件夹名） |
| 生成工具 | 本插件的 MCP 工具（名字以 `obsidian_` 结尾，如 `obsidian_write_slides`）。每次调用都传 `vault: "<VAULT>"` |
| Vault 准备 | 第一次在某个 vault 里用时，调用 `obsidian_install_vault_files`：先不带 `apply` 看计划，告诉用户要写哪些文件，同意后 `apply:true`，装上 `Excalidraw/Scripts/Mermaid to Excalidraw.md` 和 `theme/*.css`。已有文件不会被覆盖 |
| Mermaid 转换 | vault 脚本 `Excalidraw/Scripts/Mermaid to Excalidraw.md`（源文件在本技能 `scripts/`，用 `obsidian_install_vault_files` 安装） |
| 放映 | `Excalidraw/Scripts/Downloaded/Slideshow.md` |
| CLI | `obsidian vault=<VNAME> obsidian-excalidraw-plugin:<命令>`（Windows 上不在 PATH 时用 `"$LOCALAPPDATA/Programs/Obsidian/Obsidian.com"`）；第一次用前跑 `schema` 看各命令的参数 |
| 主题 | campus（默认，16:9）、campus43（4:3）、blackboard、ink、swiss。先找 vault 的 `theme/<名>.css`，没有就用本技能 `themes/` 自带的；vault 里用户改过的版本优先 |

1. 如果找不到 `obsidian_write_slides`，提示用户检查插件是否启用（`/plugin`）并重启 Claude Code。
2. 跑一次 CLI `status`，返回 `ok:true, ready:true, vault:"<VNAME>"` 才能做 Mermaid 转换和验图。Obsidian 没开时只生成，汇报里写明"Mermaid 仍是占位框，未经 Obsidian 渲染验证"。

## 1. 工作流

```
收集资料 → 学情与目标 → BOPPPS 设计 → 配图/代码/Mermaid → 写课件(正面+教案) → CLI 转 Mermaid → 导出验图 → 精修 → 汇报
```

1. **明确参数**：主题、对象（年级/专业/先修）、课时（默认 1 节 45 分钟；90 分钟按两节设计）、所属课程目录。用户没说的取合理默认并在汇报里写出来，不要停下来问。
2. **收集资料**：
   - 用户给了资料（PDF、讲义、教材章节、链接、代码库）：先完整读资料，教学内容以资料为准，教案"参考资料"里列出出处（章节/页码）。
   - 没给资料：用 WebSearch 搜 3–6 个可靠来源（官方文档、教材、大学课程页、权威教程），WebFetch 读正文并核对；多个来源说法不一致时以官方文档为准。代码示例要能运行（能本地跑的就跑一下）。
   - 把关键事实、术语、常见误区、好的例子记下来，作为设计输入。
3. **BOPPPS 设计**：按 [references/boppps.md](references/boppps.md) 定每个环节的时长、活动和对应幻灯片。先写目标（O，可测量的动词），再倒推前测（P1）和后测（P3）题目，后测必须能检验每个目标。
4. **素材**：
   - **Mermaid**：流程、时序、类关系、状态机、架构用 `mermaid` 字段画在幻灯片上；教案背面可直接写 ```` ```mermaid ```` 代码块。规则见 [references/deck-spec.md](references/deck-spec.md#mermaid)。
   - **代码**：`code` 字段，≤ 18 行，只保留讲解要用的部分，用注释 `// ①` 与要点编号对应。
   - **网图**：见 [references/deck-spec.md](references/deck-spec.md#网上图片)。优先用有开放许可的图（Wikimedia Commons、官方文档图），下载到 `<讲目录>/assets/`，用 Read 看一遍确认内容合适，来源和许可写进教案。找不到合适的图时，用 `mcp__magpie-image__generate_image` 生成示意图作为后备，并在来源里注明"AI 生成"。
5. **写课件**：一次 `obsidian_write_slides` 写入：`deck` = 幻灯片（**每页都写 `notes` 讲稿**，规则见 [deck-spec.md](references/deck-spec.md#讲稿notes)），`back` = 教案全文（不含幻灯片与讲稿段），`properties` = frontmatter，`theme` 默认 `campus`。写完用 `obsidian_read_drawing`（`withBack:true`）确认背面的 `## 幻灯片与讲稿` 页数 = 幻灯片数、内容页都有讲稿。
6. **转换 Mermaid**：CLI `open` 打开课件，再执行 `script`，运行 `Mermaid to Excalidraw.md`，确认 `summary` 里转换数 = 占位框数，失败的按 `report[].error` 改 Mermaid 代码后重写重转。脚本会按课件主题给图上色（节点/判断/分组/连线/文字），需要时用 `args.style` 微调配色；`report[].minFont` < 16 说明图字太小，要改图。见 [references/tools.md](references/tools.md)。
7. **验图**：CLI `export source=disk` 导出 PNG，用 Read 看：文字溢出/重叠、Mermaid 图是否太小、代码是否完整、图片是否显示、六点进度是否对应环节。
8. **精修**：改 deck 后 `overwrite:true` 重写（不传 `back` 时教案保留，幻灯片与讲稿段按新 deck 重新生成；改讲稿就改 `notes`），**然后必须重新跑一次 Mermaid 转换**（重写会恢复成占位框）。用户手改过的文件不要覆盖，改用 CLI `apply` 局部修改。
9. **汇报**：文件路径、幻灯片清单（序号/环节/标题/时长/用了什么图）、教案要点、图片来源、预览 PNG 路径、实际做过的检查和未验证的部分。

## 2. 设计原则

- **以目标为纲**：每张内容页都服务于某个目标；和目标无关的内容删掉或放进教案"拓展阅读"。
- **参与优先**：P2 至少占总时长的 50%，每 8–10 分钟安排一次学生活动（提问、配对讨论、写代码、小测），活动页用 `act` 标出（如"配对讨论 3 分钟"）、用 `callouts` 的 `task`/`ask` 写任务。
- **一页一事**：每页一个观点，标题写成结论句（"DispatcherServlet 统一分发所有请求"），要点 ≤ 5 条、每条 ≤ 25 字；细节放 `notes` 和教案。
- **图先于字**：能画的就画（Mermaid、flow、vs、kpis、图片），纯文字页不超过总页数的 1/3。
- **时间可执行**：各环节 `badge` 时长相加 = 课时总长；教案过程表的时间与 PPT 徽章一致。
- **事实可查**：数据、定义、API 用法都要能在资料或来源里找到；不确定的标"待核实"，不要编造。

## 3. 安全与边界

- 只写目标 vault，路径一律用 vault 相对路径。新文件默认不覆盖；`overwrite:true` 只用于本技能生成的文件，覆盖前先读出原内容确认。
- 下载的网图放进**新建的**讲目录 `assets/`，只下载图片文件（png/jpg/svg/webp/gif），不执行下载内容。尊重版权：优先开放许可，教案中写明来源 URL 和许可；无法确定许可的图片只用于课堂内部，并在汇报里提醒用户。
- CLI 写操作（`script`、`apply`、`export`）每次用新的唯一 `requestId`，检查 `ok`、`mutation`、`persistence`；结果不确定的写操作用 `result requestId=…` 查回执，不要自动重试。
- 不要手工编辑 `.excalidraw.md` 里的压缩数据。
