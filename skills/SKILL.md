---
name: llm-token-analyzer
description: Track and analyze LLM token usage. Supports statistics by model and date, provides cost estimation, incremental sync from tmp cache files, and interactive HTML visual reports.
---

# LLM Token Analyzer

This skill is used for in-depth tracking of LLM token consumption, supporting automated synchronization and visual chart analysis.

## Core Features

### 1. Incremental Auto-Sync

Scans the system's temporary directory to automatically extract and accumulate the most accurate metadata from multi-turn conversations.

**Usage Guide:**
Commands: "sync", "sync usage".
- Globally scans `~/.gemini/tmp/`.
- Automatically extracts title, model, and token fields.
- Incremental writing with no duplicates.

### 2. Multi-dimensional Visual Analysis

Provides terminal reports and web-based interactive charts.

**Usage Guide:**
- **Terminal Report**: Commands "show report", "analyze usage".
  - Provides ASCII histograms of model distribution.
  - Provides total cost estimation and aggregated statistics.
- **Chart Report**: Commands "generate chart", "show visual report".
  - Automatically generates an HTML file and opens it in the browser.
  - Includes pie charts (model distribution) and line charts (daily consumption trends).

**Underlying Commands:**
```bash
node scripts/analyze_tokens.cjs # Terminal report
node scripts/generate_report.cjs # Generate and open charts
```

## Storage & Security

To ensure data is completely independent and protected, it is stored in a dedicated hidden folder:
- **Storage Path**: `~/.token_usage/token_usage.jsonl`
- **Security**: This directory is independent of the Gemini and skill installation directories. Data will not be lost during reloads or other operations unless the system is reinstalled.

## Cost Estimation

Includes the latest pricing models for the Gemini 3 and Gemini 2.5 series (for reference only).
