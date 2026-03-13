# LLM Token Analyzer (Gemini 扩展)

**LLM Token Analyzer** 是一个专门为 Gemini CLI 打造的扩展，用于自动追踪、同步和可视化分析你的所有会话 Token 消耗。

## 核心功能
*   **全自动同步**: 通过扫描 `~/.gemini/tmp` 实现多轮对话的增量同步，支持标题智能提取。
*   **成本分析**: 内置最新的 Gemini 定价模型，实时计算每条会话的美元开销。
*   **可视化图表**: 一键生成交互式 HTML 看板，包含模型分布饼图和消耗趋势。
*   **数据安全**: 所有数据保存在本地 `~/.token_usage/`，完全离线运行。

## 安装指南
通过 Gemini CLI 直接安装：
```bash
gemini extensions install https://github.com/pityfish/llm-token-analyzer
```

## 命令速查
*   `/tokens:sync`: 自动同步最新用量。
*   `/tokens:analyze`: 终端查看详细成本报表。
*   `/tokens:chart`: 生成并打开网页版可视化图表。
*   `/tokens:log`: 手动记录一次 Token 消耗。

## 存储位置
数据存储在 `~/.token_usage/token_usage.jsonl`，该目录独立于扩展安装目录，确保数据持久化。
