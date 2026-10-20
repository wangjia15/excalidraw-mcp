# Claude Code 技能（Skills）

两个基于本 MCP 的 Claude Code 技能，复制到 `~/.claude/skills/` 即可使用：

| 技能 | 做什么 | 主要工具 |
|---|---|---|
| [paper-zettel](paper-zettel/SKILL.md) | 卡片盒笔记法精读 LLM / 视觉论文：从 PDF 截取图表，每个知识点一张以图形为主的卡片，导图叶子就是卡片，Markdown 面写文献笔记和每卡背面 | `obsidian_write_paper_board`、`obsidian_write_card` |
| [boppps-lesson](boppps-lesson/SKILL.md) | 按 BOPPPS 生成教学 PPT（正面）和教案（背面）；Mermaid 图经插件内置 mermaid-to-excalidraw 转成原生图形并按 PPT 主题上色 | `obsidian_write_slides`（`mermaid`、`back`、`properties`） |

## 安装

```bash
cp -r skills/paper-zettel skills/boppps-lesson ~/.claude/skills/
```

技能里写死了作者本机的环境，使用前改成你自己的：

| 位置 | 默认值 | 改成 |
|---|---|---|
| `paper-zettel/SKILL.md` §0 | vault `I:\obsidiannote\paper-zettel`，MCP 服务器名 `excalidraw-zettel` | 你的论文 vault 和对应的 MCP 服务器名 |
| `boppps-lesson/SKILL.md` §0 | vault `I:\202609\course`，MCP 服务器名 `excalidraw` | 你的课程 vault 和对应的 MCP 服务器名 |
| 两个技能的 CLI 命令 | `"$LOCALAPPDATA/Programs/Obsidian/Obsidian.com" vault=<名>` | 你系统上的 Obsidian CLI |

每个 vault 对应一个 MCP 服务器实例（`OBSIDIAN_VAULT` 不同）：

```bash
claude mcp add -s user excalidraw-zettel -e OBSIDIAN_VAULT=/path/to/paper-zettel -- node /path/to/excalidraw-mcp/dist/index.js --stdio
claude mcp add -s user excalidraw        -e OBSIDIAN_VAULT=/path/to/course       -- node /path/to/excalidraw-mcp/dist/index.js --stdio
```

## 依赖

- Obsidian + [Excalidraw 插件](https://github.com/zsviczian/obsidian-excalidraw-plugin)，vault 里装好 Slideshow（两个技能）和 Mindmap Builder（paper-zettel）脚本。
- 验图和 Mermaid 转换用插件的原生 CLI（`obsidian-excalidraw-plugin:<命令>`：`status`、`open`、`script`、`export`、`apply`…）。Obsidian 没开时只能生成，不能转换和验图。
- boppps-lesson：把 [`boppps-lesson/scripts/Mermaid to Excalidraw.md`](boppps-lesson/scripts/Mermaid%20to%20Excalidraw.md) 复制到 vault 的 `Excalidraw/Scripts/`。
- paper-zettel：Python 3 + PyMuPDF（`pip install pymupdf`），用于 `scripts/pdf_figures.py` 截取论文图表。

## 示例

- 课件 deck：[docs/examples/boppps-deck.json](../docs/examples/boppps-deck.json)
- 论文卡片盒 board：[docs/examples/paper-board.json](../docs/examples/paper-board.json)
- 完整说明：[docs/使用手册.md](../docs/使用手册.md) 第 11–13 节

对 Claude Code 说：

- "精读这篇论文 https://arxiv.org/abs/2010.11929，做成卡片盒" → paper-zettel
- "给软件工程大二学生做一讲 Spring MVC 请求流程的课件和教案，45 分钟" → boppps-lesson
- "用这份讲义 `inbox/第5章.pdf` 按 BOPPPS 备一节课" → boppps-lesson（以讲义为准）
