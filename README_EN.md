# DeepSpider

[![npm version](https://img.shields.io/npm/v/deepspider.svg)](https://www.npmjs.com/package/deepspider)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Intelligent Web Scraping Platform — AI-powered Crawler Agent built on DeepAgents + Patchright

An end-to-end AI Agent solution from JS reverse engineering to production-ready crawler scripts.

[中文文档](README.md)

## Features

- **Reverse Engineering**: Webpack unpacking, deobfuscation, encryption algorithm identification & tracing
- **Dynamic Debugging**: Real browser + CDP breakpoint debugging, Hook injection
- **Code Conversion**: Automatic JS-to-Python encryption logic translation
- **CAPTCHA Handling**: Slider, click-based, and image CAPTCHAs
- **Anti-Detection**: Fingerprint spoofing, proxy rotation, risk control evasion
- **Crawler Orchestration**: Intelligent scheduling, outputs runnable Python crawlers
- **Interactive Panel**: Built-in browser analysis panel with element selection and chat

## Quick Start

### Installation

```bash
# Option 1: npm global install (recommended)
npm install -g deepspider

# Option 2: pnpm global install
pnpm approve-builds -g deepspider isolated-vm  # Approve native build scripts on first install
pnpm install -g deepspider

# Option 3: Clone the repository
git clone https://github.com/ma-pony/deepspider.git
cd deepspider
pnpm install
cp .env.example .env  # Configure environment variables
pnpm run setup:crypto  # Install Python crypto libraries (optional)
```

On first run, you'll be prompted to configure the LLM API.

> **Note**: This project depends on the `isolated-vm` native module, which requires a C++ build environment:
> - macOS: `xcode-select --install`
> - Ubuntu: `sudo apt install build-essential`
> - Windows: Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Configuration

DeepSpider requires an LLM API to run. Any OpenAI-compatible provider is supported.

| Config Key | Environment Variable | Description |
|------------|---------------------|-------------|
| `apiKey` | `DEEPSPIDER_API_KEY` | API key |
| `baseUrl` | `DEEPSPIDER_BASE_URL` | API endpoint URL |
| `model` | `DEEPSPIDER_MODEL` | Model name |
| `persistBrowserData` | `DEEPSPIDER_PERSIST_BROWSER` | Persist browser data (keep login sessions) |

Priority: Environment variables > Config file (`~/.deepspider/config/settings.json`) > Defaults

**Option 1: CLI commands (recommended)**

```bash
deepspider config set apiKey sk-xxx
deepspider config set baseUrl https://api.openai.com/v1
deepspider config set model gpt-4o
```

**Option 2: Environment variables**

```bash
export DEEPSPIDER_API_KEY=sk-xxx
export DEEPSPIDER_BASE_URL=https://api.openai.com/v1
export DEEPSPIDER_MODEL=gpt-4o
```

**Common provider examples**:

```bash
# OpenAI
deepspider config set baseUrl https://api.openai.com/v1
deepspider config set model gpt-4o

# DeepSeek
deepspider config set baseUrl https://api.deepseek.com/v1
deepspider config set model deepseek-chat
```

### Usage

#### Global install (npm/pnpm install -g)

```bash
# Start Agent - specify target website
deepspider https://example.com

# Start Agent - persist browser data (one-time)
deepspider --persist https://example.com

# Start Agent - interactive mode only
deepspider

# Show help
deepspider --help

# Manage configuration
deepspider config list            # List all settings
deepspider config set apiKey sk-xxx
deepspider config set model gpt-4o

# Persist browser data (for sites requiring login, auto-restores session on next launch)
deepspider config set persistBrowserData true

# Check for updates
deepspider update
```

#### Clone repository

```bash
# Configure (pick one)
cp .env.example .env  # Edit .env file
# or use CLI commands
node bin/cli.js config set apiKey sk-xxx
node bin/cli.js config set baseUrl https://api.openai.com/v1
node bin/cli.js config set model gpt-4o

# Install Python dependencies (optional, for running generated Python code)
pnpm run setup:crypto

# Start Agent
pnpm run agent https://example.com

# MCP service (for Claude Code, etc.)
pnpm run mcp

# Run tests
pnpm test
```

### Workflow

1. **Launch**: `deepspider https://target-site.com`
2. **Wait**: Browser opens, system automatically records data (no API cost)
3. **Interact**: Log in, paginate, trigger target requests on the website
4. **Select**: Click the panel's select button ⦿ to enter selection mode
5. **Analyze**: Click on target data elements, choose a quick action:
   - **Trace Data Source** — Locate the API endpoint for the selected data
   - **Analyze Encryption** — Identify and reverse-engineer encrypted parameters
   - **Full Analysis & Generate Crawler** — End-to-end: reverse, verify, generate code
   - **Extract Page Structure** — Analyze DOM structure, generate selectors and field configs
6. **Chat**: Continue asking questions in the panel or CLI for deeper analysis

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   DeepSpider                        │
│           (Crawler Orchestration - Smart Routing)   │
└──────────────────────┬──────────────────────────────┘
                       │ On-demand invocation
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│reverse-agent│ │captcha-agent│ │anti-detect  │
│ Reverse Eng │ │ CAPTCHA     │ │ Anti-detect │
└──────┬──────┘ └─────────────┘ └─────────────┘
       ▼
┌─────────────┐
│js2python    │
│ Code Convert│
└─────────────┘
```

### Sub-Agent System

| Sub-Agent | Responsibility | Core Tools |
|-----------|---------------|------------|
| crawler | Crawler orchestration: integrate modules, generate complete scripts | file, store, crawler |
| reverse | Full reverse engineering: deobfuscation, breakpoint debugging, Hook, sandbox, environment patching | tracing, deobfuscate, debug, capture, sandbox, env |
| js2python | JS-to-Python: encryption code conversion & verification | python, analyzer |
| captcha | CAPTCHA handling: OCR, slider, click-based | captcha_ocr, captcha_slide |
| anti-detect | Anti-detection: fingerprint management, proxy pool | proxy, fingerprint |

## Project Structure

```
deepspider/
├── bin/cli.js               # CLI entry (command routing)
├── src/
│   ├── agent/               # DeepAgent system
│   │   ├── tools/           # Tool collection (90+)
│   │   ├── subagents/       # Sub-agents
│   │   ├── skills/          # Domain skills
│   │   └── prompts/         # System prompts
│   ├── cli/                 # CLI commands
│   │   ├── config.js        # Config re-export
│   │   └── commands/        # Sub-commands (version/help/config/update)
│   ├── config/              # Core configuration
│   │   ├── paths.js         # Path constants
│   │   └── settings.js      # Config read/write (env vars/file/defaults)
│   ├── browser/             # Browser runtime
│   │   ├── client.js        # Patchright client
│   │   ├── cdp.js           # CDP session management
│   │   ├── defaultHooks.js  # Default injected Hooks
│   │   ├── interceptors/    # CDP interceptors
│   │   └── ui/              # In-browser UI panel
│   ├── analyzer/            # Static analyzer
│   ├── env/                 # Environment patching
│   ├── store/               # Data storage
│   └── mcp/                 # MCP service
└── test/                    # Tests
```

## Core Technologies

- **DeepAgents**: Multi-agent collaboration framework
- **Patchright**: Anti-detection browser automation
- **CDP**: Chrome DevTools Protocol deep integration
- **webcrack**: Webpack/Browserify unpacking
- **isolated-vm**: Secure sandbox execution

## Documentation

- [Development Guide](docs/GUIDE.md)
- [Debug Guide](docs/DEBUG.md)

## Contributing

Issues and Pull Requests are welcome!

## License

MIT
