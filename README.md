# VS Code PI Companion

A VS Code extension that provides real-time IDE context (files, selection) to pi and other agents.

## Features

- **Real-time context**: Monitors open files, cursor position, and selection
- **Instant updates**: Pushes context changes via SSE
- **Seamless integration**: Injects the current selection, or the active file (first 100 lines) if nothing is selected, into the LLM context
- **Widget display**: Shows current file/selection in pi UI

## Architecture

**VS Code Extension** → SSE ← **pi Extension**

- **VS Code**: Context tracking, SSE server, MCP server
- **pi**: SSE client, Widget, Context injection

## Installation

### 1. Install pi Extension

```bash
pi install npm:@ravshansbox/pi-vscode
```

### 2. Install VS Code Extension

The pi extension will auto-install the VS Code extension when you run `pi` in a VS Code terminal.

Alternatively, install it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ravshansbox.vscode-pi-companion) or run:

```bash
code --install-extension ravshansbox.vscode-pi-companion
```

Then reload VS Code window.

## Usage

1. Open a folder in VS Code
2. Open VS Code terminal (`Ctrl+\``)
3. Run `pi`
4. The extension auto-connects and shows current file in widget
5. Select code → widget updates instantly
6. The selection (or the active file) is injected into LLM context automatically

## Widget Display

```
vscode: disconnected  # VS Code extension not reachable
filename              # no selection
filename L9           # single line
filename L9:14        # multi-line selection
filename L9:14 +2     # 2 more files open
```

## VS Code Commands

- `PI Companion: Start Server`
- `PI Companion: Stop Server`
- `PI Companion: Show Status`

## pi Tools (for LLM)

| Tool | Description |
|------|-------------|
| `get_ide_context` | Full IDE context |
| `get_current_file` | Current file with selection |
| `list_open_files` | List all open files |

## MCP Server (for other agents)

The VS Code extension serves MCP at `http://127.0.0.1:$PI_COMPANION_PORT/mcp`. Send `Authorization: Bearer $PI_COMPANION_AUTH_TOKEN`. Both variables are set in VS Code terminals.

| Tool | Description |
|------|-------------|
| `get_open_files` | Open files with content, cursor and selection |
| `read_file` | Read a file by absolute path |
| `goto` | Open a file at a line and character |

## Development

```bash
npm install
npm run compile
npm test

# Package as .vsix
npm run package
```

Press F5 to run in Extension Development Host.
