# Excalidraw MCP App Server

MCP server that streams hand-drawn Excalidraw diagrams with smooth viewport camera control and interactive fullscreen editing.

![Demo](docs/demo.gif)

## Install

Works with any client that supports [MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps) — Claude, ChatGPT, VS Code, Goose, and others. If something doesn't work, please [open an issue](https://github.com/antonpk1/excalidraw-mcp-app/issues).

### Remote (recommended)

### `https://mcp.excalidraw.com`

For apps that don't yet have an official integration, you can add a custom MCP / connector (naming can vary between apps).

### Local

**Option A: Download Extension**

1. Download `excalidraw-mcp-app.mcpb` from [Releases](https://github.com/antonpk1/excalidraw-mcp-app/releases)
2. Double-click to install in Claude Desktop

**Option B: Build from Source**

```bash
git clone https://github.com/excalidraw/excalidraw-mcp.git
cd excalidraw-mcp-app
pnpm install && pnpm run build
```

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "node",
      "args": ["/path/to/excalidraw-mcp-app/dist/index.js", "--stdio"]
    }
  }
}
```

Restart Claude Desktop.

## Usage

Example prompts:
- "Draw a cute cat using excalidraw"
- "Draw an architecture diagram showing a user connecting to an API server which talks to a database"

## Obsidian Excalidraw plugin support

This fork can also read and write drawings in an Obsidian vault (the `.excalidraw.md` format of
[obsidian-excalidraw-plugin](https://github.com/zsviczian/obsidian-excalidraw-plugin)) and generate Chinese-optimised
diagrams, mind maps and slide decks. Set `OBSIDIAN_VAULT` to the vault root:

```bash
claude mcp add -s user excalidraw -e OBSIDIAN_VAULT=/path/to/vault -- node /path/to/excalidraw-mcp/dist/index.js --stdio
```

| Tool | What it does |
|---|---|
| `obsidian_list_drawings` / `obsidian_read_drawing` / `obsidian_write_drawing` | list, read and write vault drawings (professional style by default) |
| `obsidian_write_template` (+ `obsidian_template_help`) | 11 diagram templates: layers, timeline, compare, table, tree, swimlane, quadrant, funnel, cycle, cards, flow |
| `obsidian_write_mindmap` | XMind-style mind maps compatible with the Mindmap Builder script (all Growth Strategies, image nodes, themes, Slideshow frames) |
| `obsidian_write_slides` | slide decks for the Slideshow script: cover / stage dividers, cards, steps, tables, flows, KPI, VS, key-value, highlighted code, images, Mermaid placeholders, BOPPPS elements, Marp CSS themes (campus, blackboard, ink, swiss ...) |
| `obsidian_write_paper_board` | a paper as one drawing: mind map whose leaves are visual cards (annotated figures, tensor, matrix, stack, patches, bars), plus a Markdown side with a section per card |
| `obsidian_write_card` | a single two-sided card: slide on the front, Markdown note on the back |

All write tools take `back` (the Markdown side of the `.excalidraw.md`) and `properties` (frontmatter). Slide `mermaid`
fields are written as placeholders and converted inside Obsidian by the vault script
[`Mermaid to Excalidraw`](skills/boppps-lesson/scripts/Mermaid%20to%20Excalidraw.md), which uses the plugin's built-in
mermaid-to-excalidraw and colours the diagram with the slide theme. Examples: [docs/examples](docs/examples).

### Claude Code plugin

The repo is also a Claude Code plugin marketplace. The `excalidraw-obsidian` plugin bundles this MCP server (the committed
`dist/index.js`, Node.js 18+, no build needed) with two skills, `paper-zettel` (Zettelkasten reading of LLM / vision
papers) and `boppps-lesson` (BOPPPS teaching slides with a lesson plan on the back):

```
/plugin install excalidraw-obsidian --marketplace wangjia15/excalidraw-mcp
```

Every Obsidian tool takes an optional `vault` (absolute path of a folder containing `.obsidian/`); `OBSIDIAN_VAULT` is
the default. `obsidian_install_vault_files` copies the Mermaid script and the slide theme CSS into a vault (dry run by
default, never overwrites). Themes not found in `<vault>/theme/` fall back to `skills/boppps-lesson/themes/`.
See [skills/README.md](skills/README.md).

Full guide (Chinese): [docs/使用手册.md](docs/使用手册.md).

## What are MCP Apps and how can I build one?

Text responses can only go so far. Sometimes users need to interact with data, not just read about it. [MCP Apps](https://github.com/modelcontextprotocol/ext-apps/) is an official Model Context Protocol extension that lets servers return interactive HTML interfaces (data visualizations, forms, dashboards) that render directly in the chat.

- **Getting started for humans**: [documentation](https://modelcontextprotocol.io/docs/extensions/apps)
- **Getting started for AIs**: [skill](https://github.com/modelcontextprotocol/ext-apps/blob/main/plugins/mcp-apps/skills/create-mcp-app/SKILL.md)

## Contributing

PRs welcome! See [Local](#local) above for build instructions.

### Deploy your own instance

You can deploy your own copy to Vercel in a few clicks:

1. Fork this repo
2. Go to [vercel.com/new](https://vercel.com/new) and import your fork
3. No environment variables needed — just deploy
4. Your server will be at `https://your-project.vercel.app/mcp`

### Release checklist

<details>
<summary>For maintainers</summary>

```bash
# 1. Bump version in manifest.json and package.json
# 2. Build and pack
pnpm run build && mcpb pack .

# 3. Create GitHub release
gh release create v0.3.0 excalidraw-mcp-app.mcpb --title "v0.3.0" --notes "What changed"

# 4. Deploy to Vercel
vercel --prod
```

</details>

## Credits

Built with [Excalidraw](https://github.com/excalidraw/excalidraw) — a virtual whiteboard for sketching hand-drawn like diagrams.

## License

MIT
