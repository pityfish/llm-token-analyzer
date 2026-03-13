# LLM Token Analyzer (Gemini Extension)

**LLM Token Analyzer** is a Gemini CLI extension designed to automatically track, sync, and visualize your token usage across all sessions.

## Features
- **Auto-Sync**: Incrementally scans `~/.gemini/tmp` to extract precise session metadata and titles.
- **Cost Analysis**: Built-in pricing for Gemini 3/2.5 series to calculate real-time USD costs.
- **Visual Dashboard**: One-click generation of interactive HTML charts (Model Distribution & Trends).
- **Privacy First**: All data is stored locally in `~/.token_usage/`, 100% offline.

## Installation
Install directly via Gemini CLI:
```bash
gemini extensions install https://github.com/pityfish/llm-token-analyzer
```

## Quick Commands
- `/tokens:sync`: Sync the latest usage data.
- `/tokens:analyze`: View detailed cost report in terminal.
- `/tokens:chart`: Generate and open the visual dashboard.
- `/tokens:log`: Manually log a specific token record.

## Storage
Data is stored at `~/.token_usage/token_usage.jsonl`. This directory is separate from the extension installation directory, ensuring data persistence even if the extension is re-installed.
