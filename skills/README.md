# Claude Code 技能（Skills）

三个基于本 MCP 的 Claude Code 技能，和 MCP 一起打包成 Claude Code 插件 `excalidraw-obsidian`：

| 技能 | 做什么 | 主要工具 |
|---|---|---|
| [paper-zettel](paper-zettel/SKILL.md) | 卡片盒笔记法精读 LLM / 视觉论文：从 PDF 截取图表，每个知识点一张以图形为主的卡片，导图叶子就是卡片，Markdown 面写文献笔记和每卡背面 | `obsidian_write_paper_board`、`obsidian_write_card` |
| [boppps-lesson](boppps-lesson/SKILL.md) | 按 BOPPPS 生成教学 PPT（正面）和教案（背面）；Mermaid 图经插件内置转换器转成原生图形并按 PPT 主题上色 | `obsidian_write_slides`（`mermaid`、`back`、`properties`） |
| [excalidraw-topic](excalidraw-topic/SKILL.md) | 任意主题先拆为 63:88 竖版图文知识卡，在一张画布上组成可重排 mindmap；含使用场景、关联虚线、播放 frame，背面复用真实 frame 并附解释与 Mermaid | `obsidian_write_drawing`、原生 CLI、ExcalidrawAutomate、Mindmap Builder |

## 安装（Claude Code 插件）

本仓库本身就是一个插件市场。添加市场后安装插件：

```text
/plugin marketplace add wangjia15/excalidraw-mcp
/plugin install excalidraw-obsidian@wangjia15-excalidraw
```

已有安装可更新：

```text
/plugin marketplace update wangjia15-excalidraw
/plugin update excalidraw-obsidian@wangjia15-excalidraw
```

更新后重启 Claude Code。技能名为 `excalidraw-obsidian:paper-zettel`、`excalidraw-obsidian:boppps-lesson`、`excalidraw-obsidian:excalidraw-topic`。插件运行仓库里已构建好的 `dist/index.js`，只需要 Node.js 18+，不用自己构建。

**指定 vault**：每次调用工具都可以传 `vault`（vault 文件夹的绝对路径，里面要有 `.obsidian/`），所以同一个服务器可以写多个 vault。需要默认库时，在启动 Claude Code 前设置环境变量 `OBSIDIAN_VAULT`。

**vault 里的文件**：`obsidian_install_vault_files` 可将 Mermaid 脚本复制到 `Excalidraw/Scripts/`、主题 CSS 复制到 `theme/`。它先列计划，经用户同意后写入，已有文件不覆盖。`excalidraw-topic` 的原生卡片路线按需复制已审阅的辅助脚本，不要求安装整套主题；没有 Excalidraw Extras 时保留背面 Mermaid，并直接绘制原生机制图。

主题 CSS 来自 Marp 主题，只带配色和版式，没有字体文件。vault 缺少 `theme/<名>.css` 时，使用技能自带的 [boppps-lesson/themes/](boppps-lesson/themes)。MCP 只读主题配色；Marp 字体需自行配置，或使用系统字体回退。

### 不用插件

也可以只把技能复制到 `~/.claude/skills/`，再手动注册 MCP：

```bash
cp -r skills/paper-zettel skills/boppps-lesson skills/excalidraw-topic ~/.claude/skills/
claude mcp add -s user excalidraw-obsidian -e OBSIDIAN_VAULT=/path/to/vault -- node /path/to/excalidraw-mcp/dist/index.js --stdio
```

独立安装后命令名没有插件前缀，例如 `/excalidraw-topic`。

## 依赖

- Obsidian + [Excalidraw 插件](https://github.com/zsviczian/obsidian-excalidraw-plugin)。播放需要库中的 Slideshow；paper-zettel 和 excalidraw-topic 的原生重排需要 Mindmap Builder。
- 验图和 Mermaid 转换使用 Excalidraw 插件的原生 CLI（`obsidian-excalidraw-plugin:<命令>`）。Obsidian 未运行时只能生成，不能声称完成转换、重排或播放验证。
- 可选安装官方 [obsidian-excalidraw-cli](https://github.com/zsviczian/obsidian-excalidraw-cli) 技能（AGPL-3.0，需整包安装，不随本插件分发），其中有 CLI 协议、恢复规则和诊断脚本。
- boppps-lesson：转换时需要 vault 中的 `Mermaid to Excalidraw.md`；Excalidraw 2.29.0 实测还需检查 Extras 依赖。excalidraw-topic 带无 Extras 的原生图形路线。
- paper-zettel：Python 3 + PyMuPDF（`pip install pymupdf`），用于截取论文图表。
- excalidraw-topic：Python 3，CLI 包装器只使用标准库。辅助 EA 脚本和模板均随技能分发。

## 示例

```text
/excalidraw-obsidian:excalidraw-topic 用一张图解释 HTTP 缓存，面向后端初学者
/excalidraw-obsidian:excalidraw-topic 根据这份资料生成所有命令卡，加入使用场景、关联命令和虚线，兼容 Mindmap Builder 重排
```

- “精读这篇论文 https://arxiv.org/abs/2010.11929，做成卡片盒” → paper-zettel
- “给软件工程大二学生做一讲 Spring MVC 请求流程的课件和教案，45 分钟” → boppps-lesson
- “用这份讲义 `inbox/第5章.pdf` 按 BOPPPS 备一节课” → boppps-lesson（以讲义为准）

课件 deck：[docs/examples/boppps-deck.json](../docs/examples/boppps-deck.json)。论文卡片盒 board：[docs/examples/paper-board.json](../docs/examples/paper-board.json)。知识卡契约与实测：[card-mindmap.md](excalidraw-topic/references/card-mindmap.md)、[tested-example.md](excalidraw-topic/references/tested-example.md)。完整 MCP 手册：[docs/使用手册.md](../docs/使用手册.md)。
